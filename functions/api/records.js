export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  try {
    // 檢查 DB 是否有正確綁定
    if (!env.DB) {
      return Response.json({ error: "D1 Binding missing (DB)" }, { status: 500 });
    }

    if (method === "GET") {
      const response = await env.DB.prepare(
        "SELECT * FROM records ORDER BY id DESC LIMIT 100"
      ).all();
      
      // 確保即使沒資料也回傳空陣列 [] 而不是 null
      return Response.json(response.results || []);
    }

    if (method === "POST") {
      const data = await request.json();
      const { record_id, type, category, description, amount, member } = data;
      
      await env.DB.prepare(
        "INSERT INTO records (record_id, type, category, description, amount, member) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(record_id, type, category, description, amount, member).run();
      
      return Response.json({ success: true }, { status: 201 });
    }

    // ... 其餘 DELETE 邏輯
  } catch (err) {
    // 發生錯誤時回傳 JSON 格式的錯誤訊息，避免前端 res.json() 崩潰
    return Response.json({ error: err.message }, { status: 500 });
  }
}
