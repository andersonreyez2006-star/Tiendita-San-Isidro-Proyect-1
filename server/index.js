import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por la configuración CORS.'));
  }
}));
app.use(express.json({ limit: '32kb' }));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

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
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    res.status(400).json({ error: 'La categoría seleccionada no existe.' });
    return;
  }
  if (error.code === 'ER_ROW_IS_REFERENCED_2') {
    res.status(409).json({ error: 'No se puede eliminar porque hay registros relacionados.' });
    return;
  }
  if (error.code === 'ER_DUP_ENTRY') {
    res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
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
