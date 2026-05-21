const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const KV_KEY     = 'prizes_list';
const LEGACY_KEY = 'lottery520_result';

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// GET：返回全部战利品，首次调用时自动迁移旧 520 记录
export async function onRequestGet({ env }) {
  let prizes = await env.LIUYINGCHUN_MOOD_KV.get(KV_KEY, 'json') || [];

  // 一次性迁移：把旧 lottery520_result 写入 prizes_list 并删除
  const legacy = await env.LIUYINGCHUN_MOOD_KV.get(LEGACY_KEY, 'json');
  if (legacy && legacy.prize) {
    const alreadyIn = prizes.some(
      p => p.activity === '五月礼遇' && p.prize === legacy.prize
    );
    if (!alreadyIn) {
      const raw  = legacy.time || '';
      const date = raw.slice(0, 10).replace(/-/g, '.') || '2025.05.20';
      prizes = [
        { activity: '五月礼遇', prize: legacy.prize, date, slogan: '心有所念，皆能如愿' },
        ...prizes,
      ];
      // 永久写入新结构，删除旧 key
      await env.LIUYINGCHUN_MOOD_KV.put(KV_KEY, JSON.stringify(prizes));
      await env.LIUYINGCHUN_MOOD_KV.delete(LEGACY_KEY);
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
  prizes.push({ activity, prize, date: date || '', slogan: slogan || '' });
  await env.LIUYINGCHUN_MOOD_KV.put(KV_KEY, JSON.stringify(prizes));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
