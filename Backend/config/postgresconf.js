import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pgPool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

pgPool.on('connect', () => console.log('Connected to PostgreSQL'));
pgPool.on('error', (err) => console.error('PostgreSQL error:', err));

export default pgPool;
