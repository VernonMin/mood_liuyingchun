const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getBeijingDate() {
  const beijing = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return beijing.toISOString().slice(0, 10);
}

function getBeijingTime() {
  const beijing = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return beijing.toISOString().slice(11, 16);
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env }) {
  const raw = await env.LIUYINGCHUN_MOOD_KV.get('whack_plays');
  const plays = raw ? JSON.parse(raw) : [];
  return new Response(JSON.stringify(plays), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export async function onRequestPost({ env, request }) {
  const { score } = await request.json();
  const date = getBeijingDate();
  const time = getBeijingTime();
  const city = request.cf?.city || request.cf?.region || '未知';

  const raw = await env.LIUYINGCHUN_MOOD_KV.get('whack_plays');
  const plays = raw ? JSON.parse(raw) : [];
  plays.push({ date, time, city, score });
  await env.LIUYINGCHUN_MOOD_KV.put('whack_plays', JSON.stringify(plays));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
