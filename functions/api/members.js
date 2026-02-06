export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const groupId = url.searchParams.get('group_id') || 'group_default';
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name FROM members WHERE group_id = ?"
    ).bind(groupId).all();
    return Response.json(results || []);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
