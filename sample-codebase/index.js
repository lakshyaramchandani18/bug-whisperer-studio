/**
 * Sample Application Main Entry
 */
import { authenticateUser } from './auth-service.js';
import { loadUserProfile } from './user-profile.js';

console.log('🚀 Starting Sample Buggy App...');

try {
  console.log('Step 1: Authenticating user...');
  authenticateUser({ name: 'Alice' }); // Missing token property triggers error
} catch (err) {
  console.error(err);
}
