import { DEFAULT_MEMBERS } from '../config.js';

export async function onRequest(context) {
  const { request, next } = context;

  // Allow OPTIONS (CORS preflight) to bypass auth check
  if (request.method === "OPTIONS") {
    return next();
  }

  // 1. Check for Cloudflare Access (Production)
  // We check for the presence of the authenticated email header.
  // This header is added by Cloudflare Access after successful login.
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (email) {
    return next();
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
