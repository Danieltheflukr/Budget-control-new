export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  try {
    // GET: 從 D1 抓取資料
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM records ORDER BY created_at DESC LIMIT 100"
      ).all();
      return Response.json(results);
    }

    // POST: 將資料存入 D1
    if (method === "POST") {
      const data = await request.json();
      const { record_id, type, category, description, amount, member } = data;
      
      await env.DB.prepare(
        "INSERT INTO records (record_id, type, category, description, amount, member) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(record_id, type, category, description, amount, member).run();
      
      return Response.json({ success: true }, { status: 201 });
    }

    // DELETE: 根據 record_id 刪除
    if (method === "DELETE") {
      const id = url.searchParams.get('id');
      if (!id) return Response.json({ error: "Missing ID" }, { status: 400 });

      await env.DB.prepare("DELETE FROM records WHERE record_id = ?").bind(id).run();
      return Response.json({ success: true });
    }

    return new Response("Method Not Allowed", { status: 405 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
