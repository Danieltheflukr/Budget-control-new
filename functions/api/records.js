export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  try {
    // GET: 從 D1 讀取資料
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM records ORDER BY created_at DESC"
      ).all();
      return Response.json(results);
    }

    // POST: 將資料寫入 D1
    if (method === "POST") {
      const data = await request.json();
      const { record_id, type, category, description, amount, member } = data;
      
      // 注意：這裡的欄位順序要跟 SQL INSERT 完全一致
      await env.DB.prepare(
        "INSERT INTO records (record_id, type, category, description, amount, member) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(record_id, type, category, description, amount, member).run();
      
      return Response.json({ success: true }, { status: 201 });
    }

    // DELETE: 根據 record_id 刪除
    if (method === "DELETE") {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id) return Response.json({ error: "Missing ID" }, { status: 400 });

      await env.DB.prepare("DELETE FROM records WHERE record_id = ?").bind(id).run();
      return Response.json({ success: true });
    }

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
