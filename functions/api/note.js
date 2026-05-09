const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

export async function onRequestPost({ env, request }) {
  const { text, mood } = await request.json();
  const date = getBeijingDate();
  const time = getBeijingTime();
  await env.LIUYINGCHUN_MOOD_KV.put(`note_${date}`, JSON.stringify({ text, mood, time }));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
