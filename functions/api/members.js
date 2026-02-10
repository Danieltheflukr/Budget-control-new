import { DEFAULT_MEMBERS } from '../config.js';

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
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            group_id TEXT NOT NULL
          )
        `).run();

        const statements = DEFAULT_MEMBERS.map(member =>
          env.DB.prepare(
            `INSERT OR IGNORE INTO members (id, name, group_id) VALUES (?, ?, ?)`
          ).bind(member.id, member.name, member.group_id)
        );

        await env.DB.batch(statements);

        return Response.json(DEFAULT_MEMBERS.map(m => ({ id: m.id, name: m.name })));
      } catch (seedErr) {
        console.error("Auto-seed failed:", seedErr);
        // Fallback
        return Response.json(DEFAULT_MEMBERS.map(m => ({ id: m.id, name: m.name })));
      }
    }

    return Response.json(results || []);
  } catch (err) {
    if (String(err).includes("no such table")) {
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            group_id TEXT NOT NULL
          )
        `).run();

        const statements = DEFAULT_MEMBERS.map(member =>
          env.DB.prepare(
            `INSERT OR IGNORE INTO members (id, name, group_id) VALUES (?, ?, ?)`
          ).bind(member.id, member.name, member.group_id)
        );

        await env.DB.batch(statements);

        return Response.json(DEFAULT_MEMBERS.map(m => ({ id: m.id, name: m.name })));
      } catch (e2) {
        return Response.json({ error: "Schema init failed: " + e2.message }, { status: 500 });
      }
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}
