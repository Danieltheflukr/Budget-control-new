async function initializeMembers(env) {
  const defaultMembers = [
    { id: 'Daniel', name: 'Daniel' },
    { id: 'Jacky', name: 'Jacky' }
  ];

  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        group_id TEXT NOT NULL
      )
    `),
    ...defaultMembers.map(m =>
      env.DB.prepare(`INSERT OR IGNORE INTO members (id, name, group_id) VALUES (?, ?, 'group_default')`).bind(m.id, m.name)
    )
  ]);

  return defaultMembers;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id') || 'group_default';

  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name FROM members WHERE group_id = ?"
    ).bind(groupId).all();

    if ((!results || results.length === 0) && groupId === 'group_default') {
      try {
        const members = await initializeMembers(env);
        return Response.json(members);
      } catch (seedErr) {
        console.error("Auto-seed failed:", seedErr);
        // Fallback
        return Response.json([
          { id: 'Daniel', name: 'Daniel' },
          { id: 'Jacky', name: 'Jacky' }
        ]);
      }
    }

    return Response.json(results || []);
  } catch (err) {
    if (String(err).includes("no such table")) {
      try {
        const members = await initializeMembers(env);
        return Response.json(members);
      } catch (e2) {
        return Response.json({ error: "Schema init failed: " + e2.message }, { status: 500 });
      }
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}
