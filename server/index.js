import 'dotenv/config';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import { promisify } from 'node:util';

const app = express();
const port = Number(process.env.PORT || 3001);
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

if (isProduction && allowedOrigins.length === 0) {
  throw new Error('Configura CORS_ORIGINS con el dominio exacto del frontend en producción.');
}

app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por la configuración CORS.'));
  },
  credentials: true
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

function createSession(userId) {
  const payload = Buffer.from(JSON.stringify({
    userId,
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
    if (!Number.isSafeInteger(data.userId) || data.userId <= 0 || data.expiresAt <= Date.now()) return null;
    return data.userId;
  } catch {
    return null;
  }
}

async function findSessionUser(req) {
  const userId = readSession(req);
  if (!userId) return null;
  const [rows] = await pool.execute(
    'SELECT id_usuario, nombre_usuario FROM usuarios WHERE id_usuario = ?',
    [userId]
  );
  return rows[0] || null;
}

function publicUser(user) {
  return { id_usuario: user.id_usuario, nombre_usuario: user.nombre_usuario };
}

function authLimiter(limit, windowMs) {
  return rateLimit({ limit, windowMs });
}

app.get('/api/auth/session', asyncRoute(async (req, res) => {
  const user = await findSessionUser(req);
  res.json({ user: user ? publicUser(user) : null });
}));

app.post('/api/auth/register', authLimiter(5, 60 * 60 * 1000), asyncRoute(async (req, res) => {
  const username = typeof req.body?.nombre_usuario === 'string' ? req.body.nombre_usuario.trim() : '';
  const password = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
  if (!/^[\p{L}\p{N}_.-]{3,32}$/u.test(username)) {
    throw httpError(400, 'El usuario debe tener entre 3 y 32 caracteres (letras, números, punto, guion o guion bajo).');
  }
  if (password.length < 12 || password.length > 128) {
    throw httpError(400, 'La contraseña debe tener entre 12 y 128 caracteres.');
  }

  const salt = randomBytes(16);
  const passwordHash = await scrypt(password, salt, 64);
  const storedHash = `${salt.toString('hex')}:${Buffer.from(passwordHash).toString('hex')}`;
  const [result] = await pool.execute(
    'INSERT INTO usuarios (nombre_usuario, password_hash) VALUES (?, ?)',
    [username, storedHash]
  );
  const user = { id_usuario: result.insertId, nombre_usuario: username };
  res.cookie(sessionCookie, createSession(user.id_usuario), cookieOptions());
  res.status(201).json({ user: publicUser(user) });
}));

app.post('/api/auth/login', authLimiter(10, 15 * 60 * 1000), asyncRoute(async (req, res) => {
  const username = typeof req.body?.nombre_usuario === 'string' ? req.body.nombre_usuario.trim() : '';
  const password = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
  const [rows] = await pool.execute(
    'SELECT id_usuario, nombre_usuario, password_hash FROM usuarios WHERE nombre_usuario = ?',
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

  res.cookie(sessionCookie, createSession(user.id_usuario), cookieOptions());
  res.json({ user: publicUser(user) });
}));

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(sessionCookie, cookieOptions());
  res.status(204).end();
});

app.use('/api', asyncRoute(async (req, _res, next) => {
  if (req.path.startsWith('/auth/') || req.path === '/auth/session' || req.path === '/health') {
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
  const [rows] = await pool.query(
    `SELECT c.id_categoria, c.nombre, COUNT(p.id_producto) AS cantidad_productos
     FROM categorias c
     LEFT JOIN productos p ON p.id_categoria = c.id_categoria
     GROUP BY c.id_categoria, c.nombre
     ORDER BY c.nombre`
  );
  res.json(rows);
}));

app.post('/api/categorias', asyncRoute(async (req, res) => {
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  if (!nombre || nombre.length > 100) throw httpError(400, 'El nombre debe tener entre 1 y 100 caracteres.');

  const [result] = await pool.execute('INSERT INTO categorias (nombre) VALUES (?)', [nombre]);
  res.status(201).json({ id_categoria: result.insertId, nombre });
}));

app.delete('/api/categorias/:id', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id, 'Categoría');
  const [result] = await pool.execute('DELETE FROM categorias WHERE id_categoria = ?', [id]);
  if (result.affectedRows === 0) throw httpError(404, 'La categoría no existe.');
  res.status(204).end();
}));

app.get('/api/productos', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id_producto, nombre, precio_venta, stock, id_categoria
     FROM productos
     ORDER BY nombre`
  );
  res.json(rows);
}));

app.post('/api/productos', asyncRoute(async (req, res) => {
  const data = productInput(req.body);
  const [result] = await pool.execute(
    'INSERT INTO productos (nombre, precio_venta, stock, id_categoria) VALUES (?, ?, ?, ?)',
    [data.nombre, data.precio, data.stock, data.idCategoria]
  );
  res.status(201).json({
    id_producto: result.insertId,
    nombre: data.nombre,
    precio_venta: data.precio,
    stock: data.stock,
    id_categoria: data.idCategoria
  });
}));

app.put('/api/productos/:id', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id, 'Producto');
  const data = productInput(req.body);
  const [result] = await pool.execute(
    `UPDATE productos
     SET nombre = ?, precio_venta = ?, stock = ?, id_categoria = ?
     WHERE id_producto = ?`,
    [data.nombre, data.precio, data.stock, data.idCategoria, id]
  );
  if (result.affectedRows === 0) {
    const [rows] = await pool.execute('SELECT id_producto FROM productos WHERE id_producto = ?', [id]);
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
  const [result] = await pool.execute('DELETE FROM productos WHERE id_producto = ?', [id]);
  if (result.affectedRows === 0) throw httpError(404, 'El producto no existe.');
  res.status(204).end();
}));

app.get('/api/ventas', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT id_venta, fecha_hora, total FROM ventas ORDER BY fecha_hora DESC, id_venta DESC'
  );
  res.json(rows);
}));

app.get('/api/ventas/:id', asyncRoute(async (req, res) => {
  const id = positiveId(req.params.id, 'Venta');
  const [sales] = await pool.execute(
    'SELECT id_venta, fecha_hora, total FROM ventas WHERE id_venta = ?',
    [id]
  );
  if (sales.length === 0) throw httpError(404, 'La venta no existe.');

  const [details] = await pool.execute(
    `SELECT dv.id_detalle, dv.id_venta, dv.id_producto, p.nombre AS nombre_producto,
            dv.cantidad, dv.subtotal
     FROM detalle_venta dv
     LEFT JOIN productos p ON p.id_producto = dv.id_producto
     WHERE dv.id_venta = ?
     ORDER BY dv.id_detalle`,
    [id]
  );
  res.json({ venta: sales[0], detalles: details });
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

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let total = 0;
    const saleItems = [];
    const productIds = [...quantities.keys()].sort((a, b) => a - b);

    for (const id of productIds) {
      const cantidad = quantities.get(id);
      const [products] = await connection.execute(
        'SELECT id_producto, nombre, precio_venta, stock FROM productos WHERE id_producto = ? FOR UPDATE',
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
    const [saleResult] = await connection.execute(
      'INSERT INTO ventas (fecha_hora, total) VALUES (CURRENT_TIMESTAMP, ?)',
      [total]
    );

    for (const item of saleItems) {
      await connection.execute(
        'UPDATE productos SET stock = stock - ? WHERE id_producto = ?',
        [item.cantidad, item.id]
      );
      await connection.execute(
        'INSERT INTO detalle_venta (id_venta, id_producto, cantidad, subtotal) VALUES (?, ?, ?, ?)',
        [saleResult.insertId, item.id, item.cantidad, item.subtotal]
      );
    }

    await connection.commit();
    res.status(201).json({
      id_venta: saleResult.insertId,
      fecha_hora: new Date().toISOString(),
      total
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.use((error, _req, res, _next) => {
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'].includes(error.code)) {
    console.error(`MySQL no está disponible (${error.code}). Revisa las variables DB_* y la conexión de red.`);
    res.status(503).json({
      error: 'El backend no puede conectarse a MySQL. Revisa DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_NAME.'
    });
    return;
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    res.status(400).json({ error: 'La categoría seleccionada no existe.' });
    return;
  }
  if (error.code === 'ER_ROW_IS_REFERENCED_2') {
    res.status(409).json({ error: 'No se puede eliminar porque hay registros relacionados.' });
    return;
  }
  if (error.code === 'ER_DUP_ENTRY') {
    res.status(409).json({ error: 'El nombre de usuario ya está en uso.' });
    return;
  }
  if (error.code === 'ER_NO_SUCH_TABLE') {
    res.status(503).json({ error: 'Falta una tabla de la base de datos. Importa database/schema.sql y reinicia el backend.' });
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

  console.error(error);
  res.status(error.status || 500).json({
    error: error.status ? error.message : 'Error interno del servidor.'
  });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`API escuchando en el puerto ${port}`);
});

async function shutdown() {
  server.close();
  await pool.end();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
