import { verifyGroupAccess } from "../_auth.js";
import { EXPENSE_TYPE, INCOME_TYPE } from "../_constants.js";

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id') || 'group_default';

  try {
    if (!env.DB) {
      return Response.json({ error: "D1 Binding missing (DB)" }, { status: 500 });
    }

    if (method === "GET") {
      // Authorization Check (From security branch)
      if (!await verifyGroupAccess(request, env, groupId)) {
        return Response.json({ error: "Unauthorized: You do not have access to this group" }, { status: 403 });
      }

      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);

      // records + join members to get payer name
      const { results } = await env.DB.prepare(`
        SELECT
          r.record_id, r.type, r.category, r.description, r.amount,
          r.payer_id, r.group_id, r.date,
          m.name AS member
        FROM records r
        LEFT JOIN members m ON m.id = r.payer_id AND m.group_id = r.group_id
        WHERE r.group_id = ?
        ORDER BY r.date DESC, r.record_id DESC
        LIMIT ?
      `)
      .bind(groupId, limit)
      .all();
      
      return Response.json(results || []);
    }

    if (method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const record_id = String(body.record_id || Date.now().toString());
      const type = String(body.type || "").trim();
      const category = String(body.category || "").trim();
      const description = String(body.description || "").trim();
      const amount = Number(body.amount);
      const payer_id = String(body.payer_id || "").trim();
      const group_id = String(body.group_id || groupId).trim();
      const date = String(body.date || new Date().toISOString().slice(0, 10)); // YYYY-MM-DD

      // Authorization Check (From security branch)
      if (!await verifyGroupAccess(request, env, group_id)) {
        return Response.json({ error: "Unauthorized: You do not have access to this group" }, { status: 403 });
      }

      // Validation using Constants (From main branch)
      if (![EXPENSE_TYPE, INCOME_TYPE].includes(type)) {
          return Response.json({ error: "Invalid type" }, { status: 400 });
      }

      if (!category) return Response.json({ error: "Missing category" }, { status: 400 });
      if (!description) return Response.json({ error: "Missing description" }, { status: 400 });
      if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: "Invalid amount" }, { status: 400 });
      if (!payer_id) return Response.json({ error: "Missing payer_id" }, { status: 400 });

      // Verify payer exists in group
      const memberCheck = await env.DB.prepare(
        "SELECT id FROM members WHERE id = ? AND group_id = ?"
      ).bind(payer_id, group_id).first();

      if (!memberCheck) {
         return Response.json({ error: "payer_id not found in group" }, { status: 400 });
      }
      
      await env.DB.prepare(
        "INSERT INTO records (record_id, type, category, description, amount, payer_id, group_id, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(record_id, type, category, description, amount, payer_id, group_id, date).run();
      
      // Send Telegram notification if configured
      if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
        const msg = `New Record:\nType: ${type}\nCategory: ${category}\nDescription: ${description}\nAmount: ${amount}\nPayer: ${payer_id}\nDate: ${date}`;
        const tgUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${env.TELEGRAM_CHAT_ID}&text=${encodeURIComponent(msg)}`;
        // Fire and forget
        fetch(tgUrl).catch(console.error);
      }

      return Response.json({ success: true, record_id }, { status: 201 });
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      // Authorization Check (From security branch)
      if (!await verifyGroupAccess(request, env, groupId)) {
        return Response.json({ error: "Unauthorized: You do not have access to this group" }, { status: 403 });
      }

      await env.DB.prepare("DELETE FROM records WHERE record_id = ? AND group_id = ?")
        .bind(id, groupId)
        .run();

      return Response.json({ success: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}