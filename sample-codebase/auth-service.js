/**
 * Auth Service - Demonstrates TypeError (Cannot read properties of undefined)
 */
export function authenticateUser(credentials) {
  console.log('Authenticating:', credentials);
  const authPayload = undefined; // Simulated failed lookup
  // Bug: Accessing property on undefined reference
  const token = authPayload.token;
  return { success: true, token };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('auth-service.js')) {
  authenticateUser({});
}
