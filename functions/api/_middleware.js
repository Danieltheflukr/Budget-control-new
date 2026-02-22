import { DEFAULT_MEMBERS } from '../config.js';

// Pre-compute allowed IDs for O(1) lookup
const allowedIds = new Set(DEFAULT_MEMBERS.map(m => m.id));

// Optional: Pre-compute allowed emails if strict email checking is desired
// const allowedEmails = new Set(DEFAULT_MEMBERS.map(m => m.email).filter(Boolean));

export async function onRequest(context) {
  const { request, next, env } = context;

  // 1. Allow OPTIONS (CORS preflight) to bypass auth check
  if (request.method === "OPTIONS") {
    return next();
  }

  // 2. Check for Cloudflare Access (Production)
  // We check for the presence of the authenticated email header.
  // This header is added by Cloudflare Access after successful login.
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (email) {
    // Optionally validate specific emails here if Access policy is too broad
    // if (allowedEmails.has(email)) return next();
    return next();
  }

  // 3. Check for Local Development / Fallback
  // RESTRICTED: Only allow X-Member-Id bypass in non-production environments
  // We check env.CF_PAGES_BRANCH. If it's not 'main', we allow the header override.
  const isProduction = env.CF_PAGES_BRANCH === 'main';

  if (!isProduction) {
    const memberId = request.headers.get("X-Member-Id");
    if (memberId && allowedIds.has(memberId)) {
      return next();
    }
  }

  // 4. Reject if neither condition is met
  return new Response("Unauthorized", { status: 401 });
}
