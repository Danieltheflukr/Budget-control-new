export async function onRequest(context) {
  const { env } = context;
  try {
    // Group by category for current month (based on UTC 'now')
    // Filter for '支出' only
    const stats = await env.DB.prepare(`
      SELECT category, SUM(amount) as value
      FROM records
      WHERE type = '支出' AND strftime('%m', date) = strftime('%m', 'now')
      GROUP BY category
    `).all();

    // Ensure we return an array
    return Response.json(stats.results || []);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
