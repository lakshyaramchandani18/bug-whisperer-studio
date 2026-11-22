/**
 * User Profile Service - Demonstrates ReferenceError
 */
export function loadUserProfile(userId) {
  console.log(`Loading profile for user: ${userId}`);
  // Bug: fetchProfileData function is never imported or defined
  const profile = fetchProfileData(userId);
  return profile;
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('user-profile.js')) {
  loadUserProfile('usr_42');
}
