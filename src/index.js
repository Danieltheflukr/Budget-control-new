export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const KV = env.BUDGET_KV;

    // 設定跨域資源共享 (CORS) - 允許您的前端網頁呼叫此 API
    const corsHeaders = {
      "Access-Control-Allow-Origin": "budget.danieltheflukr.com", // 生產環境建議改為您的具體網域
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 處理 Preflight 請求
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 安全驗證：檢查 Authorization Header
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${env.API_AUTH_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // API 路由：取得所有紀錄
    if (url.pathname === "/api/records" && request.method === "GET") {
      const data = await KV.get("records");
      return new Response(data || "[]", {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // API 路由：新增一筆紀錄
    if (url.pathname === "/api/records" && request.method === "POST") {
      try {
        const newRecord = await request.json();
        // 讀取現有資料 -> 加入新資料 -> 寫回 KV
        const currentData = JSON.parse(await KV.get("records") || "[]");
        // 為新紀錄加上時間戳記 ID
        const recordWithId = { ...newRecord, record_id: Date.now().toString() };
        currentData.push(recordWithId);

        await KV.put("records", JSON.stringify(currentData));

        return new Response(JSON.stringify({ success: true, record: recordWithId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
