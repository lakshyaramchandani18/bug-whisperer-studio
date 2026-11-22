/**
 * Configuration Module - Demonstrates TypeError: Assignment to constant variable
 */
const API_URL = 'https://api.production.example.com';

export function updateEndpoint(newUrl) {
  console.log('Attempting to reassign constant API_URL...');
  // Bug: Reassigning a const variable
  API_URL = newUrl;
  return API_URL;
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('config.js')) {
  updateEndpoint('https://api.staging.example.com');
}
