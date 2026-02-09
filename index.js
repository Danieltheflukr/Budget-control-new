const GROUP_DEFAULT = "group_default";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function notFound() {
  return json({ ok: false, error: "Not found" }, 404);
}

function badRequest(msg) {
  return json({ ok: false, error: msg }, 400);
}

function asNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

async function ensureSchema(db) {
  // 只在需要時建立表（IF NOT EXISTS 不會破壞既有資料）
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      group_id TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS records (
      record_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,          -- '支出' | '收入'
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      payer_id TEXT NOT NULL,      -- members.id
      group_id TEXT NOT NULL,
      date TEXT NOT NULL           -- ISO date string 'YYYY-MM-DD' or full ISO
    )
  `).run();

  // 索引：資料量變大後的穩定性
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_records_group_date ON records(group_id, date)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_records_group_payer ON records(group_id, payer_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id)`).run();

  // 自動塞入預設成員（只在 members 為空時）
  const { results: memberRows } = await db
    .prepare(`SELECT COUNT(1) AS c FROM members WHERE group_id = ?`)
    .bind(GROUP_DEFAULT)
    .all();

  const c = memberRows?.[0]?.c ?? 0;
  if (c === 0) {
    await db.prepare(`INSERT INTO members (id, name, group_id) VALUES (?, ?, ?)`)
      .bind("Daniel", "Daniel", GROUP_DEFAULT)
      .run();
    await db.prepare(`INSERT INTO members (id, name, group_id) VALUES (?, ?, ?)`)
      .bind("Jacky", "Jacky", GROUP_DEFAULT)
      .run();
  }
}

async function handleMembers(request, db) {
  if (request.method !== "GET") return badRequest("Method not allowed");
  const { results } = await db
    .prepare(`SELECT id, name FROM members WHERE group_id = ? ORDER BY name`)
    .bind(GROUP_DEFAULT)
    .all();
  return json(results);
}

async function handleRecords(request, db, url) {
  if (request.method === "GET") {
    const limit = Math.min(Math.max(asNumber(url.searchParams.get("limit"), 200), 1), 500);

    // records + join members 讓前端可以直接用 r.member
    const { results } = await db
      .prepare(`
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
      .bind(GROUP_DEFAULT, limit)
      .all();

    return json(results);
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON (missing or wrong Content-Type?)");
    }

    const record_id = String(body.record_id || Date.now().toString());
    const type = String(body.type || "").trim();
    const category = String(body.category || "").trim();
    const description = String(body.description || "").trim();
    const amount = Number(body.amount);
    const payer_id = String(body.payer_id || "").trim();
    const group_id = String(body.group_id || GROUP_DEFAULT).trim();
    const date = String(body.date || new Date().toISOString().slice(0, 10)); // default YYYY-MM-DD

    if (group_id !== GROUP_DEFAULT) return badRequest("Invalid group_id");
    if (!record_id) return badRequest("record_id required");
    if (!["支出", "收入"].includes(type)) return badRequest("type must be '支出' or '收入'");
    if (!category) return badRequest("category required");
    if (!description) return badRequest("description required");
    if (!Number.isFinite(amount) || amount <= 0) return badRequest("amount must be a positive number");
    if (!payer_id) return badRequest("payer_id required");

    // 確認 payer_id 存在
    const { results: member } = await db
      .prepare(`SELECT id FROM members WHERE id = ? AND group_id = ?`)
      .bind(payer_id, GROUP_DEFAULT)
      .all();
    if (!member || member.length === 0) return badRequest("payer_id not found in members");

    await db
      .prepare(`
        INSERT INTO records (record_id, type, category, description, amount, payer_id, group_id, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(record_id, type, category, description, amount, payer_id, GROUP_DEFAULT, date)
      .run();

    return json({ ok: true, record_id });
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return badRequest("Missing id");

    await db
      .prepare(`DELETE FROM records WHERE record_id = ? AND group_id = ?`)
      .bind(id, GROUP_DEFAULT)
      .run();

    return json({ ok: true });
  }

  return badRequest("Method not allowed");
}

async function handleStats(request, db) {
  if (request.method !== "GET") return badRequest("Method not allowed");

  // 本月支出按分類彙總（用日期範圍，避免跨年份混在一起）
  const { results } = await db
    .prepare(`
      SELECT category, SUM(amount) AS value
      FROM records
      WHERE group_id = ?
        AND type = '支出'
        AND date >= date('now', 'start of month')
        AND date <  date('now', 'start of month', '+1 month')
      GROUP BY category
      ORDER BY value DESC
    `)
    .bind(GROUP_DEFAULT)
    .all();

  return json(results);
}

async function handleSettlement(request, db) {
  if (request.method !== "GET") return badRequest("Method not allowed");

  // 1) 取本群組成員
  const { results: members } = await db
    .prepare(`SELECT id, name FROM members WHERE group_id = ? ORDER BY name`)
    .bind(GROUP_DEFAULT)
    .all();

  if (!members || members.length === 0) return json({ balances: [] });

  // 2) 取本群組「支出」總額與各 payer 支出
  const { results: totals } = await db
    .prepare(`
      SELECT payer_id, SUM(amount) AS total_paid
      FROM records
      WHERE group_id = ?
        AND type = '支出'
      GROUP BY payer_id
    `)
    .bind(GROUP_DEFAULT)
    .all();

  const paidMap = new Map();
  for (const r of totals || []) {
    paidMap.set(r.payer_id, Number(r.total_paid || 0));
  }

  const totalExpense = Array.from(paidMap.values()).reduce((a, b) => a + b, 0);
  const share = members.length > 0 ? totalExpense / members.length : 0;

  // balance = paid - share
  const balances = members.map(m => {
    const paid = paidMap.get(m.id) || 0;
    return {
      id: m.id,
      name: m.name,
      paid,
      share,
      balance: paid - share,
    };
  });

  return json({ totalExpense, share, balances });
}

export default {
  async fetch(request, env) {
    const db = env.MY_BINDING;
    if (!db) return json({ ok: false, error: "Missing D1 binding: MY_BINDING" }, 500);

    // schema 保底（第一次跑會建表 & 塞入 Daniel/Jacky）
    try {
      await ensureSchema(db);
    } catch (err) {
      return json({ ok: false, error: "Schema init failed: " + String(err) }, 500);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/members") return await handleMembers(request, db);
      if (path === "/api/records") return await handleRecords(request, db, url);
      if (path === "/api/stats") return await handleStats(request, db);
      if (path === "/api/settlement") return await handleSettlement(request, db);

      // 如果你是用 Pages 服務 HTML，這段可刪掉
      if (path === "/health") return json({ ok: true });

      return notFound();
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  },
};
