const PORT = process.env.PORT || 5001;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Base URL for client-facing URLs
const BASE_URL = isDevelopment ? `http://localhost:${PORT}` : '';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://tachlesai.com'
];

export {
  PORT,
  isDevelopment,
  BASE_URL,
  ALLOWED_ORIGINS
}; 