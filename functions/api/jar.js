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
  const raw = await env.LIUYINGCHUN_MOOD_KV.get('jar_entries');
  const entries = raw ? JSON.parse(raw) : [];
  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export async function onRequestPost({ env, request }) {
  const { text } = await request.json();
  const raw = await env.LIUYINGCHUN_MOOD_KV.get('jar_entries');
  const entries = raw ? JSON.parse(raw) : [];
  const entry = { text, date: getBeijingDate(), time: getBeijingTime() };
  entries.unshift(entry);
  await env.LIUYINGCHUN_MOOD_KV.put('jar_entries', JSON.stringify(entries));
  return new Response(JSON.stringify(entry), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
