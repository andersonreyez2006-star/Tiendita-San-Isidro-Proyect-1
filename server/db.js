import 'dotenv/config';
import ws from 'ws';
import { neonConfig, Pool } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Falta la variable de entorno DATABASE_URL para conectar con Neon.');
}

neonConfig.webSocketConstructor = ws;

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_CONNECTION_LIMIT || 5),
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
  idleTimeoutMillis: 10000
});
