export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    const { type, category, description, amount, payer_id, daniel_share, jacky_share, date } = data;

    // 執行寫入 records 資料表
    await env.DB.prepare(`
      INSERT INTO records (record_id, type, category, description, amount, payer_id, group_id, date, daniel_share, jacky_share)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      type || 'expense',
      category,
      description,
      amount,
      payer_id, // 'Daniel' 或 'Jacky'
      'group_default',
      date || new Date().toISOString(),
      daniel_share, // Daniel 應負擔金額
      jacky_share   // Jacky 應負擔金額
    ).run();

    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
