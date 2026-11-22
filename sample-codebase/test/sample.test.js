/**
 * Test Runner Demonstrating Failing Unit Test Suite
 */
console.log('🧪 Running Test Suite for Sample App...\n');

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${testName}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(err.stack || err);
    process.exitCode = 1;
  }
}

runTest('AuthService should handle valid session tokens', () => {
  const session = null;
  // Intended failure
  if (!session.isValid) {
    throw new Error('Session invalid');
  }
});
