const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ env, request }) {
  const subscription = await request.json();
  if (!subscription?.endpoint) {
    return new Response(JSON.stringify({ error: 'invalid subscription' }), { status: 400, headers: CORS });
  }
  await env.LIUYINGCHUN_MOOD_KV.put('push_subscription', JSON.stringify(subscription));
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
}
