(() => {
  'use strict';
  if (location.hostname !== 'majiacheng619-collab.github.io' || navigator.webdriver || window.top !== window.self) return;
  if (/^\/visitors(?:\/|$)/.test(location.pathname) || /^\/privacy(?:\/|$)/.test(location.pathname)) return;
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  const idKey = 'mjc-visitor-id-v1', dayKey = 'mjc-visitor-day-v1';
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function today() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
  async function record() {
    try {
      if (localStorage.getItem('mjc-visitor-opt-out') === '1' || localStorage.getItem('mjc-visitor-owner') === '1') return;
      if (localStorage.getItem(dayKey) === today()) return;
      const response = await fetch('/assets/visitor-config.json', {cache:'no-store'});
      if (!response.ok) return;
      const {endpoint} = await response.json();
      if (!endpoint || !/^https:\/\/[a-z0-9.-]+\.(?:workers\.dev|pages\.dev)$/.test(endpoint)) return;
      // Cookie provides a shared fallback across tabs; a Web Lock serializes first creation.
      const cookie = document.cookie.split('; ').find(x => x.startsWith(idKey + '='))?.slice(idKey.length + 1);
      let visitorId = cookie || localStorage.getItem(idKey);
      if (!uuidPattern.test(visitorId || '')) visitorId = crypto.randomUUID();
      document.cookie = idKey + '=' + visitorId + '; Path=/; Max-Age=34560000; SameSite=Lax; Secure';
      localStorage.setItem(idKey, visitorId);
      // If neither persistent store works, skip instead of counting every reload as new.
      if (localStorage.getItem(idKey) !== visitorId) return;
      const result = await fetch(endpoint + '/visit', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({visitorId}), credentials:'omit', keepalive:true});
      if (result.ok) {
        const data = await result.json();
        if (data.ok && /^\d{4}-\d{2}-\d{2}$/.test(data.day)) localStorage.setItem(dayKey, data.day);
      }
    } catch { /* Statistics must never interrupt the website or game. */ }
  }
  let busy = false;
  async function run() {
    if (busy || document.visibilityState !== 'visible') return;
    busy = true;
    try {
      if (navigator.locks) await navigator.locks.request('mjc-visitor-record', record);
      else await record();
    } finally { busy = false; }
  }
  setTimeout(run, 1600);
  document.addEventListener('visibilitychange', run);
  // A tab kept open over midnight should count on the next day while visible.
  setInterval(run, 60000);
})();
