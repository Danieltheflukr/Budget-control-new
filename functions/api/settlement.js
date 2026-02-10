import { EXPENSE_TYPE } from "../_constants.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id') || 'group_default';

  try {
    // 1. Calculate total paid per person for "Expense" (支出)
    const paidResults = await env.DB.prepare(`
      SELECT payer_id, SUM(amount) as total_paid
      FROM records
      WHERE group_id = ? AND type = ?
      GROUP BY payer_id
    `).bind(groupId, EXPENSE_TYPE).all();

    // 2. Get all members of the group
    const members = await env.DB.prepare(`SELECT id, name FROM members WHERE group_id = ?`).bind(groupId).all();

    if (!members.results || members.results.length === 0) {
      return Response.json({ total: 0, perPerson: 0, balances: [] });
    }

    const memberList = members.results;
    const paidMap = {}; // payer_id -> amount
    let totalGroupSpend = 0;

    if (paidResults.results) {
      paidResults.results.forEach(r => {
        paidMap[r.payer_id] = r.total_paid;
        totalGroupSpend += r.total_paid;
      });
    }

    const perPersonShare = totalGroupSpend / memberList.length;

    // 3. Calculate balances
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
    return Response.json({ error: err.message }, { status: 500 });
  }
}
