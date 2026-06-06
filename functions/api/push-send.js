// Web Push sender — RFC 8291 (encryption) + RFC 8292 (VAPID)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Bytes helpers ──────────────────────────────────────────

function b64urlToBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes) {
  let str = '';
  for (const b of new Uint8Array(bytes)) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function concat(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// ── HKDF via HMAC-SHA256 ──────────────────────────────────

async function hmacSHA256(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

async function hkdf(salt, ikm, info, len) {
  const prk = await hmacSHA256(salt, ikm);
  const blocks = Math.ceil(len / 32);
  let t = new Uint8Array(0);
  let okm = new Uint8Array(0);
  for (let i = 1; i <= blocks; i++) {
    t = await hmacSHA256(prk, concat(t, info, new Uint8Array([i])));
    okm = concat(okm, t);
  }
  return okm.slice(0, len);
}

// ── RFC 8291 message encryption ───────────────────────────

async function encryptPayload(subscription, message) {
  const enc = new TextEncoder();
  const authSecret = b64urlToBytes(subscription.keys.auth);
  const uaPublicBytes = b64urlToBytes(subscription.keys.p256dh);

  const senderKP = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKP.publicKey));

  const uaPub = await crypto.subtle.importKey('raw', uaPublicBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPub }, senderKP.privateKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const info = concat(enc.encode('WebPush: info\0'), uaPublicBytes, senderPubRaw);
  const ikm = await hkdf(authSecret, ecdhSecret, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const padded = concat(enc.encode(message), new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cekKey, padded));

  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = 65;
  header.set(senderPubRaw, 21);

  return concat(header, ciphertext);
}

// ── RFC 8292 VAPID header ─────────────────────────────────

async function vapidHeader(endpoint, publicKey, privateKeyB64) {
  const { protocol, host } = new URL(endpoint);
  const audience = `${protocol}//${host}`;
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();

  const headerB64 = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payloadB64 = bytesToB64url(enc.encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: 'mailto:no-reply@example.com' })));
  const signingInput = `${headerB64}.${payloadB64}`;

  const privKey = await crypto.subtle.importKey(
    'pkcs8', b64urlToBytes(privateKeyB64),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = bytesToB64url(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, enc.encode(signingInput))));

  return `vapid t=${signingInput}.${sig},k=${publicKey}`;
}

// ── Handler ───────────────────────────────────────────────

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost({ env, request }) {
  const { title, body, secret } = await request.json();

  if (secret !== env.PUSH_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const subJson = await env.LIUYINGCHUN_MOOD_KV.get('push_subscriptions');
  if (!subJson) {
    return new Response(JSON.stringify({ error: 'no subscription' }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  const subs = Object.values(JSON.parse(subJson));
  if (subs.length === 0) {
    return new Response(JSON.stringify({ error: 'no subscription' }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const payload = JSON.stringify({ title: title || '刘迎春的开心小角落', body: body || '' });

  const results = await Promise.all(subs.map(async sub => {
    try {
      const encrypted = await encryptPayload(sub, payload);
      const auth = await vapidHeader(sub.endpoint, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'TTL': '86400',
        },
        body: encrypted,
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }));

  const failed = results.filter(r => !r.ok);
  return new Response(JSON.stringify({ ok: true, sent: results.length, failed: failed.length }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
