function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!env?.DB) {
      return jsonResponse({ error: "D1 Binding missing (DB)" }, 500);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const payer_id = String(data.payer_id || "").trim();
    const amount = Number(data.amount);
    const description = String(data.description || "").trim();
    const target_name = String(data.target_name || "General Savings").trim() || "General Savings";
    const date = String(data.date || new Date().toISOString().slice(0, 10)).trim();

    if (!payer_id) {
      return jsonResponse({ error: "Missing payer_id" }, 400);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: "Invalid amount" }, 400);
    }

    await env.DB.prepare(`
      INSERT INTO savings (date, payer_id, amount, description, target_name)
      VALUES (?, ?, ?, ?, ?)
    `)
      .bind(date, payer_id, amount, description, target_name)
      .run();

    return jsonResponse({ success: true }, 201);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
