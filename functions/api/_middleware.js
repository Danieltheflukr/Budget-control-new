import { DEFAULT_MEMBERS } from '../config.js';

const allowedIds = new Set(DEFAULT_MEMBERS.map(m => m.id));

export async function onRequest(context) {
  const { request, next, env } = context;

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

  // 2. Check for Local Development / Fallback (non-production only)
  // We check for X-Member-Id and verify it against allowed members.
  if (env.CF_PAGES_BRANCH !== 'main') {
    const memberId = request.headers.get("X-Member-Id");
    if (memberId && allowedIds.has(memberId)) {
      return next();
    }
  }

  // 3. Reject if neither condition is met
  return new Response("Unauthorized", { status: 401 });
}
