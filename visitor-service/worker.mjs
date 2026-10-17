export const ORIGIN = 'https://majiacheng619-collab.github.io';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function dayInShanghai(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
export function dayRange(end, length) {
  return Array.from({length}, (_, i) => new Date(Date.parse(end + 'T00:00:00Z') - (length - 1 - i) * 86400_000).toISOString().slice(0, 10));
}
async function digest(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
async function authorized(request, token) {
  if (!token || token.length < 24) return false;
  const value = request.headers.get('Authorization') || '';
  const [a, b] = await Promise.all([digest(value), digest('Bearer ' + token)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export default {
  async fetch(request, env) {
    const headers = {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Vary':'Origin', 'X-Content-Type-Options':'nosniff'};
    const origin = request.headers.get('Origin');
    if (origin === ORIGIN) Object.assign(headers, {'Access-Control-Allow-Origin':ORIGIN, 'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization', 'Access-Control-Max-Age':'600'});
    const reply = (data, status = 200) => new Response(data === null ? null : JSON.stringify(data), {status, headers});
    if (origin && origin !== ORIGIN) return reply({error:'origin_denied'}, 403);
    if (request.method === 'OPTIONS') return reply(null, origin === ORIGIN ? 204 : 403);
    if (!env.DB) return reply({error:'service_not_configured'}, 503);
    const url = new URL(request.url);
    try {
      if (url.pathname === '/visit' && request.method === 'POST') {
        // No private information, referrers, page paths or IP addresses are persisted.
        if (origin !== ORIGIN) return reply({error:'origin_required'}, 403);
        if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply({error:'json_required'}, 415);
        // Bound the body even when Content-Length is absent or forged.
        const reader = request.body?.getReader();
        if (!reader) return reply({error:'invalid_body'}, 400);
        let size = 0; const chunks = [];
        while (true) {
          const {value, done} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 256) { await reader.cancel(); return reply({error:'body_too_large'}, 413); }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        let body;
        try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply({error:'invalid_body'}, 400); }
        if (!body || !UUID.test(body.visitorId)) return reply({error:'invalid_visitor'}, 400);
        const hash = Array.from(await digest('mjc-visitors-v1:' + body.visitorId.toLowerCase()), x => x.toString(16).padStart(2,'0')).join('');
        const day = dayInShanghai();
        // D1 batch is transactional. Unique keys arbitrate concurrent tabs and retries.
        await env.DB.batch([
          env.DB.prepare('INSERT OR IGNORE INTO visitors (visitor_hash, first_day) VALUES (?, ?)').bind(hash, day),
          env.DB.prepare('INSERT OR IGNORE INTO daily_visitors (day, visitor_hash) VALUES (?, ?)').bind(day, hash)
        ]);
        return reply({ok:true, day});
      }
      if (url.pathname === '/stats' && request.method === 'GET') {
        if (!await authorized(request, env.ADMIN_TOKEN)) return reply({error:'unauthorized'}, 401);
        const days = Number(url.searchParams.get('days') || 30);
        if (!Number.isInteger(days) || days < 1 || days > 366) return reply({error:'invalid_range'}, 400);
        const today = dayInShanghai(); const dates = dayRange(today, days);
        const [total, daily, first, fresh] = await env.DB.batch([
          env.DB.prepare('SELECT COUNT(*) AS n FROM visitors'),
          env.DB.prepare('SELECT day, COUNT(*) AS visitors FROM daily_visitors WHERE day >= ? AND day <= ? GROUP BY day ORDER BY day').bind(dates[0], today),
          env.DB.prepare('SELECT MIN(first_day) AS day FROM visitors'),
          env.DB.prepare('SELECT first_day AS day, COUNT(*) AS visitors FROM visitors WHERE first_day >= ? AND first_day <= ? GROUP BY first_day').bind(dates[0], today)
        ]);
        const byDay = new Map(daily.results.map(row => [row.day, row.visitors]));
        const newByDay = new Map(fresh.results.map(row => [row.day, row.visitors]));
        return reply({timezone:'Asia/Shanghai', today, total:total.results[0].n, startedAt:first.results[0].day, updatedAt:new Date().toISOString(), days:dates.map(day => ({day, visitors:byDay.get(day) || 0, newVisitors:newByDay.get(day) || 0}))});
      }
      return reply({error:'not_found'}, 404);
    } catch {
      // Never return database errors or visitor identifiers to clients.
      return reply({error:'temporarily_unavailable'}, 503);
    }
  }
};
