const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DEFAULT = { dogs: 0, tokens_earned: 0, tokens_used: 0, daily_date: '' };

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env }) {
  const raw = await env.LIUYINGCHUN_MOOD_KV.get('cd_state');
  const state = raw ? JSON.parse(raw) : { ...DEFAULT };
  return new Response(JSON.stringify(state), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export async function onRequestPost({ env, request }) {
  const state = await request.json();
  await env.LIUYINGCHUN_MOOD_KV.put('cd_state', JSON.stringify(state));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
