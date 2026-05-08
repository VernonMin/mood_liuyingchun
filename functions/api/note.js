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
  const date = getBeijingDate();
  const raw = await env.LIUYINGCHUN_MOOD_KV.get(`note_${date}`);
  const note = raw ? JSON.parse(raw) : null;
  return new Response(JSON.stringify({ date, note }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export async function onRequestPost({ env, request }) {
  const { text, mood } = await request.json();
  const date = getBeijingDate();
  const time = getBeijingTime();
  const note = { text, mood, time };
  await env.LIUYINGCHUN_MOOD_KV.put(`note_${date}`, JSON.stringify(note));
  return new Response(JSON.stringify({ date, note }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
