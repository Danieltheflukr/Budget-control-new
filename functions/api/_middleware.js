import { DEFAULT_MEMBERS } from '../config.js';

const allowedIds = new Set(DEFAULT_MEMBERS.map(m => m.id));

export async function onRequest(context) {
  const { request, next, env } = context;

  // 1. 允許 OPTIONS 請求 (CORS 預檢) 直接通過
  if (request.method === "OPTIONS") {
    return next();
  }

  // 2. 優先檢查 Cloudflare Access 標頭
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (email) {
    return next();
  }

  // 3. 檢查自定義 Member-Id 標頭 (現在正式與測試環境皆適用)
  const memberId = request.headers.get("X-Member-Id");
  if (memberId && allowedIds.has(memberId)) {
    return next();
  }

  // 4. 若以上皆未通過，則回傳 401
  return new Response("Unauthorized", { status: 401 });
}
