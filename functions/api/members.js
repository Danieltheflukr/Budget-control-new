export async function onRequest(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare("SELECT * FROM members").all();
    return Response.json(results || []);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
