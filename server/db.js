import mysql from 'mysql2/promise';

const required = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 5000),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  decimalNumbers: true,
  charset: 'utf8mb4'
});
