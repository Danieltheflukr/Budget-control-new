export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  try {
    // GET: 取得所有紀錄
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM records ORDER BY created_at DESC"
      ).all();
      return Response.json(results);
    }

    // POST: 新增紀錄
    if (method === "POST") {
      const data = await request.json();
      const { record_id, type, category, description, amount } = data;
      
      await env.DB.prepare(
        "INSERT INTO records (record_id, type, category, description, amount) VALUES (?, ?, ?, ?, ?)"
      ).bind(record_id, type, category, description, amount).run();
      
      return Response.json({ success: true }, { status: 201 });
    }

    // DELETE: 刪除紀錄 (可選擴充)
    if (method === "DELETE") {
      const id = url.searchParams.get('id');
      await env.DB.prepare("DELETE FROM records WHERE record_id = ?").bind(id).run();
      return Response.json({ success: true });
    }

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
