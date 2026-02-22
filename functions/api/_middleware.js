import { DEFAULT_MEMBERS } from '../config.js';

// 1. Pre-compute for performance (O(1) lookup)
const ALLOWED_IDS = new Set(DEFAULT_MEMBERS.map(m => m.id));
const ALLOWED_EMAILS = new Set(DEFAULT_MEMBERS.map(m => m.email).filter(Boolean));

export async function onRequest(context) {
  const { request, next, env } = context;

  // 2. Allow OPTIONS (CORS preflight) to bypass auth check
  if (request.method === "OPTIONS") {
    return next();
  }

  // 3. Production Check: Cloudflare Access
  // This header is only present when behind Cloudflare Access
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (email) {
    if (ALLOWED_EMAILS.has(email)) {
      return next();
    }
    return new Response("Forbidden: User not authorized", { status: 403 });
  }

  // 4. Local Development / Preview Check
  // Only allow X-Member-Id bypass if NOT on the main production branch
  const isProduction = env.CF_PAGES_BRANCH === 'main';
  if (!isProduction) {
    const memberId = request.headers.get("X-Member-Id");
    if (memberId && ALLOWED_IDS.has(memberId)) {
      return next();
    }
  }

  // 5. Default Reject
  return new Response("Unauthorized", { status: 401 });
}