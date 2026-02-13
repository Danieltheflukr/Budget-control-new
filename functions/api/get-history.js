export async function onRequestGet(context) {
  const { env } = context;

  try {
    // 使用您在 SQL 中建立的 Index 來優化查詢
    const { results } = await env.DB.prepare(`
      SELECT 
        r.date, 
        r.category, 
        r.description, 
        r.amount, 
        m.name AS payer_name,
        r.daniel_share,
        r.jacky_share
      FROM records r
      LEFT JOIN members m ON r.payer_id = m.id
      ORDER BY r.date DESC, r.record_id DESC
      LIMIT 100
    `).all();

    return new Response(JSON.stringify(results, null, 2), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
