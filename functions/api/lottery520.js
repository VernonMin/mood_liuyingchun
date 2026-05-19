const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const KV_KEY = 'lottery520_result';

function beijingTime() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// GET：查询是否已抽过，返回结果
export async function onRequestGet({ env }) {
  const result = await env.LIUYINGCHUN_MOOD_KV.get(KV_KEY, 'json');
  return new Response(JSON.stringify(result || null), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// POST：保存中奖结果（已抽过则拒绝）
export async function onRequestPost({ request, env }) {
  const existing = await env.LIUYINGCHUN_MOOD_KV.get(KV_KEY, 'json');
  if (existing) {
    return new Response(JSON.stringify({ ok: false, reason: 'already_played' }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const { prize } = await request.json();
  const record = { prize, time: beijingTime() };
  await env.LIUYINGCHUN_MOOD_KV.put(KV_KEY, JSON.stringify(record));

  return new Response(JSON.stringify({ ok: true, record }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
