import { verifyGroupAccess } from "../_auth.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id') || 'group_default';

  try {
    if (!env.DB) {
      return Response.json({ error: "D1 Binding missing (DB)" }, { status: 500 });
    }

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

        await env.DB.prepare(`INSERT OR IGNORE INTO members (id, name, group_id) VALUES ('Daniel', 'Daniel', 'group_default')`).run();
        await env.DB.prepare(`INSERT OR IGNORE INTO members (id, name, group_id) VALUES ('Jacky', 'Jacky', 'group_default')`).run();

        // For the initial seed, we return the members.
        // Note: In a production environment, you might still want to verify the user.
        return Response.json([
          { id: 'Daniel', name: 'Daniel' },
          { id: 'Jacky', name: 'Jacky' }
        ]);
      } catch (seedErr) {
        console.error("Auto-seed failed:", seedErr);
        // Fallback
        return Response.json([
          { id: 'Daniel', name: 'Daniel' },
          { id: 'Jacky', name: 'Jacky' }
        ]);
      }
    }

    // Authorization Check for existing groups or non-default groups
    if (!await verifyGroupAccess(request, env, groupId)) {
      return Response.json({ error: "Unauthorized: You do not have access to this group" }, { status: 403 });
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

        await env.DB.prepare(`INSERT OR IGNORE INTO members (id, name, group_id) VALUES ('Daniel', 'Daniel', 'group_default')`).run();
        await env.DB.prepare(`INSERT OR IGNORE INTO members (id, name, group_id) VALUES ('Jacky', 'Jacky', 'group_default')`).run();

        return Response.json([
          { id: 'Daniel', name: 'Daniel' },
          { id: 'Jacky', name: 'Jacky' }
        ]);
      } catch (e2) {
        return Response.json({ error: "Schema init failed: " + e2.message }, { status: 500 });
      }
    }
    return Response.json({ error: err.message }, { status: 500 });
  }
}
