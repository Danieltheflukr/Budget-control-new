import { EXPENSE_TYPE } from "../_constants.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id') || 'group_default';

  try {
    // Group by category for current month
    // Filter for '支出' only
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
