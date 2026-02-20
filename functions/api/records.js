import { sendTelegramNotification } from "../_utils.js";

async function ensureCoreTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS records (
      record_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      payer_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      date TEXT NOT NULL,
      daniel_share REAL DEFAULT 0,
      jacky_share REAL DEFAULT 0
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      group_id TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare("INSERT OR IGNORE INTO members (id, name, group_id) VALUES ('Daniel', 'Daniel', 'group_default')").run();
  await env.DB.prepare("INSERT OR IGNORE INTO members (id, name, group_id) VALUES ('Jacky', 'Jacky', 'group_default')").run();
}

async function migrateLegacyRecordsSchema(env) {
  await ensureCoreTables(env);

  const tableInfo = await env.DB.prepare("PRAGMA table_info(records)").all();
  const columns = new Set((tableInfo.results || []).map((c) => c.name));

  if (!columns.has("group_id")) {
    await env.DB.prepare("ALTER TABLE records ADD COLUMN group_id TEXT").run();
    await env.DB.prepare("UPDATE records SET group_id = 'group_default' WHERE group_id IS NULL OR TRIM(group_id) = ''").run();
  }

  if (!columns.has("payer_id")) {
    await env.DB.prepare("ALTER TABLE records ADD COLUMN payer_id TEXT").run();

    if (columns.has("member")) {
      await env.DB.prepare("UPDATE records SET payer_id = member WHERE payer_id IS NULL OR TRIM(payer_id) = ''").run();
    }

    await env.DB.prepare("UPDATE records SET payer_id = 'Daniel' WHERE payer_id IS NULL OR TRIM(payer_id) = ''").run();
  }

  if (!columns.has("daniel_share")) {
    await env.DB.prepare("ALTER TABLE records ADD COLUMN daniel_share REAL DEFAULT 0").run();
  }

  if (!columns.has("jacky_share")) {
    await env.DB.prepare("ALTER TABLE records ADD COLUMN jacky_share REAL DEFAULT 0").run();
  }
}

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

      if (!["支出", "收入"].includes(type)) return Response.json({ error: "Invalid type" }, { status: 400 });
      if (!category) return Response.json({ error: "Missing category" }, { status: 400 });
      if (!description) return Response.json({ error: "Missing description" }, { status: 400 });
      if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: "Invalid amount" }, { status: 400 });
      if (!payer_id) return Response.json({ error: "Missing payer_id" }, { status: 400 });

      // Optimised: Verify and Insert in one go
      const result = await env.DB.prepare(`
        INSERT INTO records (record_id, type, category, description, amount, payer_id, group_id, date)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
        WHERE EXISTS (SELECT 1 FROM members WHERE id = ?6 AND group_id = ?7)
      `).bind(record_id, type, category, description, amount, payer_id, group_id, date).run();

      if (result.meta.changes === 0) {
         return Response.json({ error: "payer_id not found in group" }, { status: 400 });
      }
      
      // Send Telegram notification if configured
      const msg = `New Record:\nType: ${type}\nCategory: ${category}\nDescription: ${description}\nAmount: ${amount}\nPayer: ${payer_id}\nDate: ${date}`;
      sendTelegramNotification(env, msg);

      return Response.json({ success: true, record_id }, { status: 201 });
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

      const result = await env.DB.prepare("DELETE FROM records WHERE record_id = ? AND group_id = ?")
        .bind(id, groupId)
        .run();

      if (result.meta.changes === 0) {
        return Response.json({ error: "Record not found" }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (err) {
    const errorText = String(err);

    if (errorText.includes("no such table")) {
      try {
        await ensureCoreTables(env);

        // Retry the original operation if possible, but for simplicity, just return empty or error asking to retry
        return Response.json({ error: "Table created, please retry" }, { status: 503 });
      } catch (e2) {
        return Response.json({ error: "Schema init failed: " + e2.message }, { status: 500 });
      }
    }

    if (
      errorText.includes("no column named payer_id") ||
      errorText.includes("no such column: r.payer_id") ||
      errorText.includes("no such column: payer_id") ||
      errorText.includes("no such column: group_id") ||
      errorText.includes("no such column: daniel_share") ||
      errorText.includes("no such column: jacky_share")
    ) {
      try {
        await migrateLegacyRecordsSchema(env);
        return Response.json({ error: "Schema updated, please retry" }, { status: 503 });
      } catch (e2) {
        return Response.json({ error: "Schema migration failed: " + e2.message }, { status: 500 });
      }
    }

    return Response.json({ error: err.message }, { status: 500 });
  }
}
