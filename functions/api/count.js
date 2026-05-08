const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getBeijingDate() {
  const beijing = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return beijing.toISOString().slice(0, 10);
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env }) {
  const date = getBeijingDate();
  const count = parseInt(await env.LIUYINGCHUN_MOOD_KV.get(`count_${date}`) || '0');
  return new Response(JSON.stringify({ date, count }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export async function onRequestPost({ env }) {
  const date = getBeijingDate();
  const current = parseInt(await env.LIUYINGCHUN_MOOD_KV.get(`count_${date}`) || '0');
  const count = current + 1;
  await env.LIUYINGCHUN_MOOD_KV.put(`count_${date}`, String(count));
  return new Response(JSON.stringify({ date, count }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
