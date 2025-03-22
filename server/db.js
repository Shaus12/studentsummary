import pg from 'pg';
const { Pool } = pg;

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/studentsummary',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

console.log('Database config:', {
  connectionString: dbConfig.connectionString ? 'Set' : 'Not set',
  ssl: dbConfig.ssl
});

// Create a new database pool
const pool = new Pool(dbConfig);

// Test the database connection
pool.connect()
  .then(client => {
    console.log('Database connected successfully');
    client.release();
  })
  .catch(err => {
    console.error('Database connection error:', err);
  });

export default {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
}; 