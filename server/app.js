import 'dotenv/config';
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import { promisify } from 'node:util';
import { sendAccountLink } from './email.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || (isProduction ? '' : randomBytes(32).toString('hex'));
const scrypt = promisify(scryptCallback);
const sessionCookie = 'tiendita_session';
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error('SESSION_SECRET debe tener al menos 32 caracteres en producción.');
}

app.set('trust proxy', 1);
app.use(cors((req, callback) => {
  const origin = req.get('origin');
  let sameOrigin = false;
  if (origin) {
    try {
      sameOrigin = new URL(origin).host === req.get('host');
    } catch {
      callback(new Error('Origen no permitido por la configuración CORS.'));
      return;
    }
  }
  if (origin && !sameOrigin && !allowedOrigins.includes(origin)) {
    callback(new Error('Origen no permitido por la configuración CORS.'));
    return;
  }
  callback(null, { origin: origin || false, credentials: true });
}));
app.use(express.json({ limit: '32kb' }));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function rateLimit({ limit, windowMs }) {
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const entry = clients.get(key);
    if (!entry || now >= entry.resetAt) {
      if (clients.size > 5000) {
        for (const [client, record] of clients) {
          if (now >= record.resetAt) clients.delete(client);
        }
      }
      clients.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (entry.count >= limit) {
      res.status(429).json({ error: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' });
      return;
    }
    entry.count += 1;
    next();
  };
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function getCookie(req, name) {
  const cookie = req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  if (!cookie) return '';
  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return '';
  }
}

function createSession(userId, authVersion = 0) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    authVersion,
    expiresAt: Date.now() + cookieOptions().maxAge
  })).toString('base64url');
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readSession(req) {
  const [payload, signature, extra] = getCookie(req, sessionCookie).split('.');
  if (!payload || !signature || extra) return null;

  const expected = createHmac('sha256', sessionSecret).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(data.userId) || data.userId <= 0
      || data.expiresAt <= Date.now()) return null;
    const authVersion = data.authVersion === undefined ? 0 : data.authVersion;
    if (!Number.isSafeInteger(authVersion) || authVersion < 0) return null;
    return { userId: data.userId, authVersion };
  } catch {
    return null;
  }
}

async function findSessionUser(req) {
  const session = readSession(req);
  if (!session) return null;
  const { rows } = await pool.query(
    `SELECT id_usuario, nombre_usuario, correo_electronico, correo_verificado, auth_version
     FROM usuarios WHERE id_usuario = $1`,
    [session.userId]
  );
  const user = rows[0];
  if (!user || user.auth_version !== session.authVersion) return null;
  return user;
}

function publicUser(user) {
  return {
    id_usuario: user.id_usuario,
    nombre_usuario: user.nombre_usuario,
    correo_electronico: user.correo_electronico,
    correo_verificado: user.correo_verificado
  };
}

function authLimiter(limit, windowMs) {
  return rateLimit({ limit, windowMs });
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function createAuthToken(
  userId,
  email,
  purpose
) {
  const token = randomBytes(32).toString('hex');
  await pool.query('DELETE FROM auth_tokens WHERE expires_at <= CURRENT_TIMESTAMP');
  await pool.query('DELETE FROM auth_tokens WHERE id_usuario = $1 AND purpose = $2', [userId, purpose]);
  await pool.query(
    `INSERT INTO auth_tokens (token_hash, id_usuario, email, purpose, expires_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '1 hour')`,
    [hashToken(token), userId, email, purpose]
  );
  return token;
}

app.get('/api/auth/session', asyncRoute(async (req, res) => {
  const user = await findSessionUser(req);
  res.json({ user: user ? publicUser(user) : null });
}));

app.post('/api/auth/register', authLimiter(5, 60 * 60 * 1000), asyncRoute(async (req, res) => {
  const username = typeof req.body?.nombre_usuario === 'string' ? req.body.nombre_usuario.trim() : '';
  const email = normalizeEmail(req.body?.correo_electronico);
  const password = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
  if (!/^[\p{L}\p{N}_.-]{3,32}$/u.test(username)) {
    throw httpError(400, 'El usuario debe tener entre 3 y 32 caracteres (letras, números, punto, guion o guion bajo).');
  }
  if (!isValidEmail(email)) throw httpError(400, 'Ingresa un correo electrónico válido.');
  if (password.length < 12 || password.length > 128) {
    throw httpError(400, 'La contraseña debe tener entre 12 y 128 caracteres.');
  }

  const salt = randomBytes(16);
  const passwordHash = await scrypt(password, salt, 64);
  const storedHash = `${salt.toString('hex')}:${Buffer.from(passwordHash).toString('hex')}`;
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre_usuario, password_hash, correo_electronico)
     VALUES ($1, $2, $3) RETURNING id_usuario, auth_version`,
    [username, storedHash, email]
  );
  const user = {
    id_usuario: rows[0].id_usuario,
    nombre_usuario: username,
    correo_electronico: email,
    correo_verificado: false,
    auth_version: rows[0].auth_version
  };
  res.cookie(sessionCookie, createSession(user.id_usuario, user.auth_version), cookieOptions());
  let emailVerificationSent = true;
  let verificationToken = '';
  try {
    verificationToken = await createAuthToken(user.id_usuario, email, 'email_verification');
    await sendAccountLink({ to: email, token: verificationToken, purpose: 'email_verification' });
  } catch (error) {
    emailVerificationSent = false;
    if (verificationToken) {
      await pool.query(
        "DELETE FROM auth_tokens WHERE id_usuario = $1 AND purpose = 'email_verification'",
        [user.id_usuario]
      );
    }
    console.error('No se pudo enviar el correo de verificación:', error.message);
  }
  res.status(201).json({ user: publicUser(user), emailVerificationSent });
}));

app.post('/api/auth/login', authLimiter(10, 15 * 60 * 1000), asyncRoute(async (req, res) => {
  const username = typeof req.body?.nombre_usuario === 'string' ? req.body.nombre_usuario.trim() : '';
  const password = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
  const { rows } = await pool.query(
    `SELECT id_usuario, nombre_usuario, password_hash, correo_electronico,
            correo_verificado, auth_version
     FROM usuarios WHERE nombre_usuario = $1`,
    [username]
  );
  const user = rows[0];
  const [saltHex, hashHex] = (user?.password_hash || '').split(':');
  let passwordMatches = false;
  if (/^[a-f\d]{32}$/i.test(saltHex || '') && /^[a-f\d]{128}$/i.test(hashHex || '')) {
    const actualHash = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), 64));
    const expectedHash = Buffer.from(hashHex, 'hex');
    passwordMatches = timingSafeEqual(actualHash, expectedHash);
  } else {
    await scrypt(password, Buffer.alloc(16), 64);
  }
  if (!user || !passwordMatches || password.length > 128) {
    throw httpError(401, 'Usuario o contraseña incorrectos.');
  }

  res.cookie(sessionCookie, createSession(user.id_usuario, user.auth_version), cookieOptions());
  res.json({ user: publicUser(user) });
}));

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(sessionCookie, cookieOptions());
  res.status(204).end();
});

app.post('/api/auth/password/forgot', authLimiter(5, 60 * 60 * 1000), asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.correo_electronico);
  if (isValidEmail(email)) {
    const { rows } = await pool.query(
      `SELECT id_usuario, correo_electronico
       FROM usuarios
       WHERE correo_electronico = $1 AND correo_verificado = TRUE`,
      [email]
    );
    if (rows[0]) {
      try {
        const token = await createAuthToken(rows[0].id_usuario, email, 'password_reset');
        try {
          await sendAccountLink({ to: email, token, purpose: 'password_reset' });
        } catch (error) {
          await pool.query(
            "DELETE FROM auth_tokens WHERE id_usuario = $1 AND purpose = 'password_reset'",
            [rows[0].id_usuario]
          );
          throw error;
        }
      } catch (error) {
        console.error('No se pudo enviar el correo de restablecimiento:', error.message);
      }
    }
  }
  res.status(202).json({
    message: 'Si existe una cuenta con ese correo verificado, recibirás un enlace para continuar.'
  });
}));

app.post('/api/auth/password/reset', authLimiter(10, 60 * 60 * 1000), asyncRoute(async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
  if (!/^[a-f\d]{64}$/i.test(token)) throw httpError(400, 'El enlace no es válido o ya venció.');
  if (password.length < 12 || password.length > 128) {
    throw httpError(400, 'La contraseña debe tener entre 12 y 128 caracteres.');
  }

  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  const storedHash = `${salt.toString('hex')}:${Buffer.from(hash).toString('hex')}`;
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    const consumed = await connection.query(
      `DELETE FROM auth_tokens
       WHERE token_hash = $1 AND purpose = 'password_reset'
         AND expires_at > CURRENT_TIMESTAMP
       RETURNING id_usuario`,
      [hashToken(token)]
    );
    if (!consumed.rows[0]) {
      throw httpError(400, 'El enlace no es válido o ya venció.');
    }
    await connection.query(
      'UPDATE usuarios SET password_hash = $1, auth_version = auth_version + 1 WHERE id_usuario = $2',
      [storedHash, consumed.rows[0].id_usuario]
    );
    await connection.query(
      "DELETE FROM auth_tokens WHERE id_usuario = $1 AND purpose = 'password_reset'",
      [consumed.rows[0].id_usuario]
    );
    await connection.query('COMMIT');
    res.json({ message: 'Tu contraseña se actualizó. Ya puedes iniciar sesión.' });
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}));

app.post('/api/auth/email/verify', authLimiter(10, 60 * 60 * 1000), asyncRoute(async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!/^[a-f\d]{64}$/i.test(token)) throw httpError(400, 'El enlace de verificación no es válido o ya venció.');
  const { rows } = await pool.query(
    `WITH consumed AS (
       DELETE FROM auth_tokens
       WHERE token_hash = $1 AND purpose = 'email_verification'
         AND expires_at > CURRENT_TIMESTAMP
       RETURNING id_usuario, email
     )
     UPDATE usuarios AS u
     SET correo_verificado = TRUE
     FROM consumed
     WHERE u.id_usuario = consumed.id_usuario
       AND u.correo_electronico = consumed.email
     RETURNING u.id_usuario`,
    [hashToken(token)]
  );
  if (rows.length === 0) throw httpError(400, 'El enlace de verificación no es válido o ya venció.');
  await pool.query(
    "DELETE FROM auth_tokens WHERE id_usuario = $1 AND purpose = 'email_verification'",
    [rows[0].id_usuario]
  );
  res.json({ message: 'Correo verificado. Ya puedes usarlo para recuperar tu contraseña.' });
}));

app.use('/api', asyncRoute(async (req, _res, next) => {
  if (req.path === '/auth/session' || req.path === '/health') {
    next();
    return;
  }
  const user = await findSessionUser(req);
  if (!user) {
    next(httpError(401, 'Inicia sesión para continuar.'));
    return;
  }
  req.user = publicUser(user);
  next();
}));

app.get('/api/auth/account', asyncRoute(async (req, res) => {
  const user = await findSessionUser(req);
  if (!user) throw httpError(401, 'Inicia sesión para continuar.');
  res.json({ user: publicUser(user) });
}));

app.post('/api/auth/account/email', authLimiter(5, 60 * 60 * 1000), asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.correo_electronico);
  if (!isValidEmail(email)) throw httpError(400, 'Ingresa un correo electrónico válido.');
  const user = await findSessionUser(req);
  if (!user) throw httpError(401, 'Inicia sesión para continuar.');

  await pool.query(
    `UPDATE usuarios
     SET correo_electronico = $1, correo_verificado = FALSE
     WHERE id_usuario = $2`,
    [email, user.id_usuario]
  );
  await pool.query(
    "DELETE FROM auth_tokens WHERE id_usuario = $1 AND purpose = 'email_verification'",
    [user.id_usuario]
  );
  const token = await createAuthToken(user.id_usuario, email, 'email_verification');
  try {
    await sendAccountLink({ to: email, token, purpose: 'email_verification' });
  } catch (error) {
    await pool.query('DELETE FROM auth_tokens WHERE token_hash = $1', [hashToken(token)]);
    throw httpError(503, 'No se pudo enviar el correo de verificación. Revisa la configuración de Gmail API e inténtalo de nuevo.');
  }
  res.json({ message: 'Enviamos un enlace de verificación a tu correo.' });
}));

app.post('/api/auth/account/email/resend', authLimiter(5, 60 * 60 * 1000), asyncRoute(async (req, res) => {
  const user = await findSessionUser(req);
  if (!user) throw httpError(401, 'Inicia sesión para continuar.');
  if (!user.correo_electronico) throw httpError(400, 'Agrega un correo antes de solicitar la verificación.');
  if (user.correo_verificado) throw httpError(400, 'Ese correo ya está verificado.');
  const token = await createAuthToken(user.id_usuario, user.correo_electronico, 'email_verification');
  try {
    await sendAccountLink({ to: user.correo_electronico, token, purpose: 'email_verification' });
  } catch (error) {
    await pool.query('DELETE FROM auth_tokens WHERE token_hash = $1', [hashToken(token)]);
    console.error('No se pudo reenviar el correo de verificación:', error.message);
    throw httpError(503, 'No se pudo enviar el correo de verificación. Revisa la configuración de Gmail API e inténtalo de nuevo.');
  }
  res.json({ message: 'Enviamos un nuevo enlace de verificación a tu correo.' });
}));

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function positiveId(value, label = 'ID') {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw httpError(400, `${label} inválido.`);
  }
  return id;
}

function productInput(body) {
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
  const precio = Number(body?.precio_venta);
  const stock = Number(body?.stock);
  const idCategoria = Number(body?.id_categoria);

  if (!nombre || nombre.length > 150) throw httpError(400, 'El nombre debe tener entre 1 y 150 caracteres.');
  if (!Number.isFinite(precio) || precio < 0) throw httpError(400, 'El precio debe ser un número mayor o igual a cero.');
  if (!Number.isSafeInteger(stock) || stock < 0) throw httpError(400, 'El stock debe ser un entero mayor o igual a cero.');
  if (!Number.isSafeInteger(idCategoria) || idCategoria <= 0) throw httpError(400, 'Selecciona una categoría válida.');

  return { nombre, precio, stock, idCategoria };
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

app.get('/api/categorias', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id_categoria, c.nombre, COUNT(p.id_producto) AS cantidad_productos
     FROM categorias c
     LEFT JOIN productos p ON p.id_categoria = c.id_categoria
     GROUP BY c.id_categoria, c.nombre
     ORDER BY c.nombre`
  );
  res.json(rows.map((row) => ({
    ...row,
    cantidad_productos: Number(row.cantidad_productos)
  })));
}));

app.post('/api/categorias', asyncRoute(async (req, res) => {
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  if (!nombre || nombre.length > 100) throw httpError(400, 'El nombre debe tener entre 1 y 100 caracteres.');

  const { rows } = await pool.query(
    'INSERT INTO categorias (nombre) VALUES ($1) RETURNING id_categoria',
    [nombre]
  );
  res.status(201).json({ id_categoria: rows[0].id_categoria, nombre });
}));

app.delete('/api/categorias/:id', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id, 'Categoría');
  const result = await pool.query('DELETE FROM categorias WHERE id_categoria = $1', [id]);
  if (result.rowCount === 0) throw httpError(404, 'La categoría no existe.');
  res.status(204).end();
}));

app.get('/api/productos', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id_producto, nombre, precio_venta, stock, id_categoria
     FROM productos
     ORDER BY nombre`
  );
  res.json(rows.map((row) => ({
    ...row,
    precio_venta: Number(row.precio_venta)
  })));
}));

app.post('/api/productos', asyncRoute(async (req, res) => {
  const data = productInput(req.body);
  const { rows } = await pool.query(
    'INSERT INTO productos (nombre, precio_venta, stock, id_categoria) VALUES ($1, $2, $3, $4) RETURNING id_producto',
    [data.nombre, data.precio, data.stock, data.idCategoria]
  );
  res.status(201).json({
    id_producto: rows[0].id_producto,
    nombre: data.nombre,
    precio_venta: data.precio,
    stock: data.stock,
    id_categoria: data.idCategoria
  });
}));

app.put('/api/productos/:id', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id, 'Producto');
  const data = productInput(req.body);
  const result = await pool.query(
    `UPDATE productos
     SET nombre = $1, precio_venta = $2, stock = $3, id_categoria = $4
     WHERE id_producto = $5`,
    [data.nombre, data.precio, data.stock, data.idCategoria, id]
  );
  if (result.rowCount === 0) {
    const { rows } = await pool.query('SELECT id_producto FROM productos WHERE id_producto = $1', [id]);
    if (rows.length === 0) throw httpError(404, 'El producto no existe.');
  }
  res.json({
    id_producto: id,
    nombre: data.nombre,
    precio_venta: data.precio,
    stock: data.stock,
    id_categoria: data.idCategoria
  });
}));

app.delete('/api/productos/:id', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id, 'Producto');
  const result = await pool.query('DELETE FROM productos WHERE id_producto = $1', [id]);
  if (result.rowCount === 0) throw httpError(404, 'El producto no existe.');
  res.status(204).end();
}));

app.get('/api/ventas', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id_venta, fecha_hora, total FROM ventas ORDER BY fecha_hora DESC, id_venta DESC'
  );
  res.json(rows.map((row) => ({ ...row, total: Number(row.total) })));
}));

app.get('/api/ventas/:id', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id, 'Venta');
  const { rows: sales } = await pool.query(
    'SELECT id_venta, fecha_hora, total FROM ventas WHERE id_venta = $1',
    [id]
  );
  if (sales.length === 0) throw httpError(404, 'La venta no existe.');

  const { rows: details } = await pool.query(
    `SELECT dv.id_detalle, dv.id_venta, dv.id_producto, p.nombre AS nombre_producto,
            dv.cantidad, dv.subtotal
     FROM detalle_venta dv
     LEFT JOIN productos p ON p.id_producto = dv.id_producto
     WHERE dv.id_venta = $1
     ORDER BY dv.id_detalle`,
    [id]
  );
  res.json({
    venta: { ...sales[0], total: Number(sales[0].total) },
    detalles: details.map((detail) => ({ ...detail, subtotal: Number(detail.subtotal) }))
  });
}));

app.post('/api/ventas', asyncRoute(async (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw httpError(400, 'La venta debe incluir entre 1 y 100 productos.');
  }

  const quantities = new Map();
  for (const item of items) {
    const id = positiveId(item?.id_producto, 'Producto');
    const cantidad = Number(item?.cantidad);
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
      throw httpError(400, 'La cantidad de cada producto debe ser un entero mayor a cero.');
    }
    quantities.set(id, (quantities.get(id) || 0) + cantidad);
  }

  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    let total = 0;
    const saleItems = [];
    const productIds = [...quantities.keys()].sort((a, b) => a - b);

    for (const id of productIds) {
      const cantidad = quantities.get(id);
      const { rows: products } = await connection.query(
        'SELECT id_producto, nombre, precio_venta, stock FROM productos WHERE id_producto = $1 FOR UPDATE',
        [id]
      );
      const product = products[0];
      if (!product) throw httpError(404, `El producto #${id} no existe.`);
      if (product.stock < cantidad) {
        throw httpError(409, `Stock insuficiente para "${product.nombre}". Existencias: ${product.stock}.`);
      }
      const subtotal = Number((product.precio_venta * cantidad).toFixed(2));
      total += subtotal;
      saleItems.push({ id, cantidad, subtotal });
    }

    total = Number(total.toFixed(2));
    const { rows: sales } = await connection.query(
      'INSERT INTO ventas (fecha_hora, total) VALUES (CURRENT_TIMESTAMP, $1) RETURNING id_venta',
      [total]
    );

    for (const item of saleItems) {
      await connection.query(
        'UPDATE productos SET stock = stock - $1 WHERE id_producto = $2',
        [item.cantidad, item.id]
      );
      await connection.query(
        'INSERT INTO detalle_venta (id_venta, id_producto, cantidad, subtotal) VALUES ($1, $2, $3, $4)',
        [sales[0].id_venta, item.id, item.cantidad, item.subtotal]
      );
    }

    await connection.query('COMMIT');
    res.status(201).json({
      id_venta: sales[0].id_venta,
      fecha_hora: new Date().toISOString(),
      total
    });
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}));

app.use((error, _req, res, _next) => {
  if (error.code?.startsWith('08') || ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '28P01', '3D000', '57P01'].includes(error.code)) {
    console.error(`PostgreSQL no está disponible (${error.code}). Revisa DATABASE_URL y el estado de Neon.`);
    res.status(503).json({
      error: 'El backend no puede conectarse a PostgreSQL. Revisa DATABASE_URL y el estado de la base en Neon.'
    });
    return;
  }
  if (error.code === '23503' && error.constraint === 'fk_productos_categorias') {
    res.status(400).json({ error: 'La categoría seleccionada no existe.' });
    return;
  }
  if (error.code === '23503') {
    res.status(409).json({ error: 'No se puede eliminar porque hay registros relacionados.' });
    return;
  }
  if (error.code === '23505') {
    if (error.constraint === 'usuarios_nombre_usuario_key') {
      res.status(409).json({ error: 'El nombre de usuario ya está en uso.' });
      return;
    }
    if (['usuarios_correo_electronico_key', 'usuarios_correo_electronico_unique_idx'].includes(error.constraint)) {
      res.status(409).json({ error: 'Ese correo ya está asociado a otra cuenta.' });
      return;
    }
    console.error(error);
    res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
    return;
  }
  if (error.code === '42P01') {
    res.status(503).json({ error: 'Falta una tabla de la base de datos. Ejecuta database/schema.sql o la migración correspondiente en Neon.' });
    return;
  }
  if (error.code === '42703') {
    res.status(503).json({ error: 'Falta una columna de la base de datos. Ejecuta database/migrations/001_password_recovery.sql en Neon.' });
    return;
  }
  if (error.message?.includes('Origen no permitido')) {
    res.status(403).json({ error: error.message });
    return;
  }
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'El cuerpo de la solicitud no contiene JSON válido.' });
    return;
  }

  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: error.status ? error.message : 'Error interno del servidor.'
  });
});

export default app;
