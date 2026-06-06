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
  const raw = await env.LIUYINGCHUN_MOOD_KV.get('push_subscriptions');
  const subs = raw ? JSON.parse(raw) : {};
  // 用 endpoint 做 key，同一个设备重复订阅不会重复存
  subs[subscription.endpoint] = subscription;
  await env.LIUYINGCHUN_MOOD_KV.put('push_subscriptions', JSON.stringify(subs));
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS } });
}
