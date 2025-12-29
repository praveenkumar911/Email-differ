// postgres-transport.js
import Transport from 'winston-transport';
import { Pool } from 'pg';

class PostgresTransport extends Transport {
  constructor(opts) {
    super(opts);

    this.pool = new Pool({
      user: process.env.PG_DB_USER,
      host: process.env.PG_DB_HOST,
      database: process.env.PG_DB_DATABASE,
      password: process.env.PG_DB_PASSWORD,
      port: parseInt(process.env.PG_DB_PORT, 10) || 5432,  // Ensure it's an integer
      connectionTimeoutMillis: 5000, // fail fast if unreachable
    });

    // Handle unexpected pool errors
    this.pool.on('error', (err) => {
      console.error('⚠️ PostgreSQL: Unexpected pool error:', err.message);
    });


    this.testConnection();
  }

  async testConnection() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('PostgreSQL: Connected to logs DB successfully');
      console.log(`API Logs are storing on the ${process.env.PG_DB_HOST} postgress DB`)
    } catch (error) {
      console.error('❌ PostgreSQL: Failed to connect to logs DB:');
      console.error('   Host:', process.env.PG_DB_HOST || '4.213.138.44');
      console.error('   Database:', process.env.PG_DB_DATABASE || 'c4gt_prod');
      console.error('   Error:', error.message);
    }
  }


  async log(info, callback) {
    const {
      timestamp,
      level,
      message,
      stack,
      endpoint,
      method,
      sourceIP,
      phoneNumber,
      moreInfo,
    } = info;

    const text = `
      INSERT INTO app_logs (
        timestamp, level, message, stack, endpoint, method, source_ip, phone_number, more_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const values = [
      timestamp || new Date().toISOString(),
      level,
      message || null,
      stack || null,
      endpoint || null,
      method || null,
      sourceIP || null,
      phoneNumber || null,
      (moreInfo && typeof moreInfo === 'object') ? moreInfo : null,
    ];

    try {
      await this.pool.query(text, values);
      callback();
    } catch (error) {
      console.error('PostgreSQL: Log insert failed:', error.message);
      callback();
    }
  }
}

export default PostgresTransport;