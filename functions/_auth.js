/**
 * Verifies if the authenticated user has access to the specified group.
 * @param {Request} request The incoming request
 * @param {object} env The environment object (containing DB binding)
 * @param {string} groupId The group ID to check access for
 * @returns {Promise<boolean>} True if authorized, false otherwise
 */
export async function verifyGroupAccess(request, env, groupId) {
  // 1. Identify the user.
  // Primary: Cloudflare Access header
  // Secondary: X-Member-Id (for local development/testing as per memory)
  const userId = request.headers.get('Cf-Access-Authenticated-User-Email') ||
                 request.headers.get('X-Member-Id');

  if (!userId) {
    console.warn("Authorization failed: No user identity found in headers");
    return false;
  }

  try {
    // 2. Check if the user is a member of the group
    const member = await env.DB.prepare(
      "SELECT 1 FROM members WHERE id = ? AND group_id = ?"
    ).bind(userId, groupId).first();

    return !!member;
  } catch (err) {
    console.error("Database error during authorization check:", err);
    return false;
  }
}
