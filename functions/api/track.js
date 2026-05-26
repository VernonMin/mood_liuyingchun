const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ env, request }) {
  try {
    const { event, page } = await request.json();

    const ua = request.headers.get('user-agent') || '';
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);
    const device = isMobile ? 'mobile' : 'desktop';

    // Cloudflare 自动填充城市信息
    const city    = request.cf?.city    || '未知';
    const country = request.cf?.country || '';
    const region  = request.cf?.region  || '';

    const time = new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

    const entry = { event, page: page || 'index', time, device, city, region, country };

    const existing = await env.LIUYINGCHUN_MOOD_KV.get('track_events', 'json') || [];
    existing.push(entry);
    // 保留最近 2000 条
    if (existing.length > 2000) existing.splice(0, existing.length - 2000);

    await env.LIUYINGCHUN_MOOD_KV.put('track_events', JSON.stringify(existing));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
