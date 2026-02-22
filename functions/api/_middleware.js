import { DEFAULT_MEMBERS } from '../config.js';

export async function onRequest(context) {
  const { request, next } = context;

  // Allow OPTIONS (CORS preflight) to bypass auth check
  if (request.method === "OPTIONS") {
    return next();
  }

  // 1. Check for Cloudflare Access (Production)
  // We check for the presence of the authenticated email header AND verify it's an allowed user.
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (email) {
    const allowedEmails = DEFAULT_MEMBERS.map(m => m.email);
    if (allowedEmails.includes(email)) {
      return next();
    } else {
      // Authenticated by Cloudflare, but not authorized for this app
      return new Response("Forbidden: User not authorized", { status: 403 });
    }
  }

  // 2. Check for Local Development / Fallback
  // We check for X-Member-Id and verify it against allowed members.
  const memberId = request.headers.get("X-Member-Id");

  // Get allowed IDs from config
  const allowedIds = DEFAULT_MEMBERS.map(m => m.id);

  if (memberId && allowedIds.includes(memberId)) {
    return next();
  }

  // 3. Reject if neither condition is met
  return new Response("Unauthorized", { status: 401 });
}
