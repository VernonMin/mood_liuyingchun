const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env }) {
  const name = await env.LIUYINGCHUN_MOOD_KV.get('dog_name');
  return new Response(JSON.stringify({ name: name || '豆豆' }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export async function onRequestPost({ env, request }) {
  const { name } = await request.json();
  await env.LIUYINGCHUN_MOOD_KV.put('dog_name', name || '豆豆');
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
