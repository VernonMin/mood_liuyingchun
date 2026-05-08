const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getBeijingDate() {
  const beijing = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return {
    date: beijing.toISOString().slice(0, 10),
    time: beijing.toISOString().slice(11, 16),
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env }) {
  const moods = await env.LIUYINGCHUN_MOOD_KV.get('moods', 'json') || [];
  return new Response(JSON.stringify(moods), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export async function onRequestPost({ request, env }) {
  const { mood, emoji } = await request.json();
  const { date, time } = getBeijingDate();

  const moods = await env.LIUYINGCHUN_MOOD_KV.get('moods', 'json') || [];
  const idx = moods.findIndex(m => m.date === date);
  const entry = { date, time, mood, emoji };

  if (idx >= 0) moods[idx] = entry;
  else moods.unshift(entry);

  moods.splice(60); // 保留最近60天

  await env.LIUYINGCHUN_MOOD_KV.put('moods', JSON.stringify(moods));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
