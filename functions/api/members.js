import { EXPENSE_TYPE } from "../_constants.js";
import { DEFAULT_MEMBERS } from '../config.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id') || 'group_default';

  try {
    // 1. Attempt to fetch data (Parallelized)
    let [paidResults, members] = await Promise.all([
      env.DB.prepare(`
        SELECT payer_id, SUM(amount) as total_paid
        FROM records
        WHERE group_id = ? AND type = ?
        GROUP BY payer_id
      `).bind(groupId, EXPENSE_TYPE).all(),
      env.DB.prepare(`SELECT id, name FROM members WHERE group_id = ?`).bind(groupId).all()
    ]);

    // 2. Auto-Seed Logic (From main branch)
    // If members table is missing or empty for default group, try to initialize schema/data
        const member = await env.DB.prepare(
      "SELECT 1 FROM members WHERE id = ? AND group_id = ?"
    ).bind(userId, groupId).first();
    if ((!members.results || members.results.length === 0) && groupId === 'group_default') {
      try {
        // Create Table if not exists
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            group_id TEXT NOT NULL
          )
        `).run();

        // Seed Data
        const statements = DEFAULT_MEMBERS.map(member =>
          env.DB.prepare(
            `INSERT OR IGNORE INTO members (id, name, group_id) VALUES (?, ?, ?)`
          ).bind(member.id, member.name, member.group_id)
        );
        await env.DB.batch(statements);

        // Re-fetch members after seeding
        members = await env.DB.prepare(`SELECT id, name FROM members WHERE group_id = ?`).bind(groupId).all();

      } catch (seedErr) {
        console.error("Auto-seed failed:", seedErr);
        // Fallback to in-memory default if DB fails
        members = { results: DEFAULT_MEMBERS.filter(m => m.group_id === groupId) };
      }
    }

    // 3. Settlement Calculation Logic (From security/perf branch)
    const memberList = members.results || [];
    
    if (memberList.length === 0) {
        return Response.json({ total: 0, perPerson: 0, balances: [] });
    }

    const paidMap = {}; // payer_id -> amount
    let totalGroupSpend = 0;

    if (paidResults.results) {
      paidResults.results.forEach(r => {
        paidMap[r.payer_id] = r.total_paid;
        totalGroupSpend += r.total_paid;
      });
    }

    const perPersonShare = totalGroupSpend / memberList.length;

    // Positive balance = You paid more than share, you receive money.
    // Negative balance = You paid less than share, you owe money.
    let balances = memberList.map(m => {
      const paid = paidMap[m.id] || 0;
      return {
        id: m.id,
        name: m.name,
        paid: paid,
        balance: paid - perPersonShare
      };
    });

    return Response.json({
        total: totalGroupSpend,
        perPerson: perPersonShare,
        balances: balances
    });

  } catch (err) {
    // Catch-all for schema errors that weren't caught in the seed block
    return Response.json({ error: err.message }, { status: 500 });
  }
}
