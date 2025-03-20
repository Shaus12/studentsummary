// src/config.js
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

// Set the appropriate base URL
const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5001/api' 
  : '/api';  // Use relative path in production

console.log('Environment:', isDevelopment ? 'Development' : 'Production');
console.log('API_BASE_URL:', API_BASE_URL);

export default API_BASE_URL;