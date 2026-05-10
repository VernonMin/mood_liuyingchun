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

function parseUA(ua) {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    const m = ua.match(/Android [^;]+;\s*([^)]+)\)/);
    return m ? m[1].trim() : 'Android';
  }
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Unknown';
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ env, request }) {
  const date = getBeijingDate();
  const time = getBeijingTime();
  const city = request.cf?.city || request.cf?.region || '未知';
  const ua = parseUA(request.headers.get('User-Agent') || '');

  const key = `visit_${date}`;
  const raw = await env.LIUYINGCHUN_MOOD_KV.get(key);
  const entries = raw ? JSON.parse(raw) : [];
  entries.push({ time, city, ua });
  await env.LIUYINGCHUN_MOOD_KV.put(key, JSON.stringify(entries));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
