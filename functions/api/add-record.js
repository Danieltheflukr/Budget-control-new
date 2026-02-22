function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    const type = String(data.type || '支出').trim();
    const category = String(data.category || '').trim();
    const description = String(data.description || '').trim();
    const amount = Number(data.amount);
    const payer_id = String(data.payer_id || '').trim();
    const group_id = String(data.group_id || 'group_default').trim();
    const daniel_share = Number(data.daniel_share || 0);
    const jacky_share = Number(data.jacky_share || 0);
    const date = String(data.date || new Date().toISOString().slice(0, 10)).trim();

    if (!['支出', '收入'].includes(type)) {
      return jsonResponse({ error: 'Invalid type' }, 400);
    }

    if (!category) {
      return jsonResponse({ error: 'Missing category' }, 400);
    }

    if (!description) {
      return jsonResponse({ error: 'Missing description' }, 400);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: 'Invalid amount' }, 400);
    }

    if (!payer_id) {
      return jsonResponse({ error: 'Missing payer_id' }, 400);
    }

    await env.DB.prepare(`
      INSERT INTO records (record_id, type, category, description, amount, payer_id, group_id, date, daniel_share, jacky_share)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      type,
      category,
      description,
      amount,
      payer_id,
      group_id,
      date,
      Number.isFinite(daniel_share) ? daniel_share : 0,
      Number.isFinite(jacky_share) ? jacky_share : 0
    ).run();

    return jsonResponse({ success: true }, 201);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
