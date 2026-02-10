import { verifyGroupAccess } from "../_auth.js";
import { EXPENSE_TYPE } from "../_constants.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id') || 'group_default';

  try {
    if (!env.DB) {
      return Response.json({ error: "D1 Binding missing (DB)" }, { status: 500 });
    }

    // Authorization Check
    // Uses verifyGroupAccess from ../_auth.js
    if (!await verifyGroupAccess(request, env, groupId)) {
      return Response.json({ error: "Unauthorized: You do not have access to this group" }, { status: 403 });
    }

    // Group by category for current month
    // Filter for 'Expense' only using EXPENSE_TYPE from ../_constants.js
    const stats = await env.DB.prepare(`
      SELECT category, SUM(amount) as value
      FROM records
      WHERE group_id = ?
        AND type = ?
        AND date >= date('now', 'start of month')
        AND date < date('now', 'start of month', '+1 month')
      GROUP BY category
      ORDER BY value DESC
    `).bind(groupId, EXPENSE_TYPE).all();

    return Response.json(stats.results || []);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}