export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    const { payer_id, amount, description, target_name, date } = data;

    await env.DB.prepare(`
      INSERT INTO savings (date, payer_id, amount, description, target_name)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      date || new Date().toISOString(),
      payer_id,
      amount,
      description,
      target_name || 'General Savings'
    ).run();

    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
