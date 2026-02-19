import { DEFAULT_MEMBERS } from '../config.js';

const allowedIds = new Set(DEFAULT_MEMBERS.map(m => m.id));

export async function onRequest(context) {
  const { request, next } = context;

  // 1. 允許 OPTIONS (CORS 預檢) 直接通過
  if (request.method === "OPTIONS") {
    return next();
  }

  // 2. 檢查 Cloudflare Access 標頭
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (email) {
    return next();
  }

  // 3. 檢查自定義 Member-Id (確保你在外面用手機也能過關)
  const memberId = request.headers.get("X-Member-Id");
  if (memberId && allowedIds.has(memberId)) {
    return next();
  }

  // 4. 若皆未通過，回傳 401
  return new Response("Unauthorized", { status: 401 });
}
