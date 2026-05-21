const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const KV_KEY     = 'prizes_list';
const LEGACY_KEY = 'lottery520_result';

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// GET：返回全部战利品（自动兼容旧的 520 记录）
export async function onRequestGet({ env }) {
  let prizes = await env.LIUYINGCHUN_MOOD_KV.get(KV_KEY, 'json') || [];

  // 兼容旧版 520 单条记录，若尚未迁移则动态合并
  const legacy = await env.LIUYINGCHUN_MOOD_KV.get(LEGACY_KEY, 'json');
  if (legacy && legacy.prize) {
    const alreadyIn = prizes.some(
      p => p.activity === '五月礼遇' && p.prize === legacy.prize
    );
    if (!alreadyIn) {
      const raw  = legacy.time || '';
      const date = raw.slice(0, 10).replace(/-/g, '.') || '2025.05.20';
      prizes = [
        { activity: '五月礼遇', prize: legacy.prize, date, slogan: '心有所念，皆能如愿', redeemed: false },
        ...prizes,
      ];
    }
  }

  return new Response(JSON.stringify(prizes), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// POST：新增一条战利品记录
export async function onRequestPost({ request, env }) {
  const { activity, prize, date, slogan } = await request.json();
  if (!activity || !prize) {
    return new Response(JSON.stringify({ ok: false, reason: 'missing_fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const prizes = await env.LIUYINGCHUN_MOOD_KV.get(KV_KEY, 'json') || [];
  prizes.push({ activity, prize, date: date || '', slogan: slogan || '', redeemed: false });
  await env.LIUYINGCHUN_MOOD_KV.put(KV_KEY, JSON.stringify(prizes));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// PATCH：更新指定 index 的兑换状态
export async function onRequestPatch({ request, env }) {
  const { index, redeemed } = await request.json();
  if (typeof index !== 'number' || typeof redeemed !== 'boolean') {
    return new Response(JSON.stringify({ ok: false, reason: 'invalid_params' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const prizes = await env.LIUYINGCHUN_MOOD_KV.get(KV_KEY, 'json') || [];
  if (index < 0 || index >= prizes.length) {
    return new Response(JSON.stringify({ ok: false, reason: 'out_of_range' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  prizes[index].redeemed = redeemed;
  await env.LIUYINGCHUN_MOOD_KV.put(KV_KEY, JSON.stringify(prizes));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
