(() => {
  'use strict';
  const root = document.querySelector('[data-visitor-dashboard]'); if (!root) return;
  const el = key => root.querySelector('[data-va-' + key + ']');
  const state = root.querySelector('.va-state');
  const fmt = value => new Intl.NumberFormat('zh-CN').format(value);
  let endpoint = '', token = '', days = 30, latest = null, loading = false;
  const owner = el('owner');
  try { owner.checked = localStorage.getItem('mjc-visitor-owner') === '1'; } catch { owner.disabled = true; }
  owner.addEventListener('change', () => {
    try { localStorage.setItem('mjc-visitor-owner', owner.checked ? '1' : '0'); }
    catch { el('message').textContent = '浏览器未允许保存偏好，请在浏览器设置中允许网站存储。'; }
  });
  function lock() {
    token = ''; latest = null; el('content').hidden = true; el('access').hidden = false;
    el('rows').replaceChildren(); el('chart').replaceChildren(); root.querySelector('#va-token').value = '';
    el('state').textContent = endpoint ? '站主专属' : '尚未接通'; state.dataset.ready = 'false';
  }
  function chart(rows) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 940 270'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '最近' + rows.length + '天的每日访客趋势，准确数值见下方逐日记录');
    const add = (tag, attrs, text) => { const node = document.createElementNS(NS,tag); for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,String(value)); if (text !== undefined) node.textContent = text; svg.append(node); return node; };
    const max = Math.max(1,...rows.map(row => row.visitors));
    const ceiling = Math.max(1, Math.ceil(max / 4) * 4);
    for (let i=0;i<=4;i++) { const y=20+i*50; add('line',{x1:44,x2:922,y1:y,y2:y,stroke:'#e5e7ec','stroke-width':1}); add('text',{x:33,y:y+4,'text-anchor':'end',fill:'#86868b','font-size':12}, Math.round(ceiling*(4-i)/4)); }
    const points=rows.map((row,i)=>[44 + (rows.length === 1 ? 439 : i*878/(rows.length-1)),220-row.visitors/ceiling*200]);
    add('polygon',{points:'44,220 '+points.map(p=>p.join(',')).join(' ')+' 922,220',fill:'#0071e30b'});
    add('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#0071e3','stroke-width':3,'stroke-linejoin':'round','stroke-linecap':'round'});
    if(rows.length<=30) points.forEach((point,i)=>{ const node=add('circle',{cx:point[0],cy:point[1],r:3,fill:'#0071e3'}); const title=document.createElementNS(NS,'title');title.textContent=rows[i].day+'：'+rows[i].visitors+' 人';node.append(title); });
    [0, Math.floor((rows.length-1)/2),rows.length-1].forEach((index,i)=>add('text',{x:44+i*439,y:254,'text-anchor':i===0?'start':i===2?'end':'middle',fill:'#86868b','font-size':12},rows[index].day.slice(5).replace('-','/')));
    el('chart').replaceChildren(svg);
  }
  function render(data) {
    const current=data.days.at(-1); el('today').textContent=fmt(current.visitors); el('total').textContent=fmt(data.total); el('new').textContent=fmt(current.newVisitors);
    el('updated').textContent='更新于 '+new Date(data.updatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
    el('started').textContent=data.startedAt ? '首次记录 · '+data.startedAt : '尚无到访记录';
    el('chart-note').textContent=data.total===0 ? '统计已连接。第一位访客到访后，记录会出现在这里。' : '所选时段每日访客合计 '+fmt(data.days.reduce((sum,row)=>sum+row.visitors,0))+' 人次；跨日期的同一浏览器会在累计访客中去重。';
    el('rows').replaceChildren(...data.days.slice().reverse().map(row=>{const tr=document.createElement('tr');[row.day,fmt(row.visitors),fmt(row.newVisitors)].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);});return tr;}));
    chart(data.days); el('content').hidden=false; el('access').hidden=true;
    el('state').textContent='已连接 · 私密查看';state.dataset.ready='true';
    root.querySelectorAll('[data-va-range]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.vaRange)===data.days.length)));
  }
  async function load(requestedDays=days) {
    if (loading || !endpoint || !token) return;
    loading=true; el('message').textContent='正在读取记录…';
    root.querySelectorAll('button').forEach(button=>button.disabled=true);
    try {
      const response=await fetch(endpoint+'/stats?days='+requestedDays,{headers:{Authorization:'Bearer '+token},cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(12000)});
      if(response.status===401){lock();throw new Error('访问密钥不正确，请重新输入。');}
      if(!response.ok)throw new Error('暂时无法读取统计，请稍后重试。');
      const data=await response.json();
      if(!Number.isSafeInteger(data.total)||data.total<0||!Array.isArray(data.days)||data.days.length!==requestedDays||!data.days.every(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.day)&&Number.isSafeInteger(row.visitors)&&row.visitors>=0&&Number.isSafeInteger(row.newVisitors)&&row.newVisitors>=0))throw new Error('统计返回异常，请稍后重试。');
      latest=data; days=requestedDays; render(data); el('message').textContent='';
    }catch(error){el('message').textContent=error.name==='TimeoutError'?'连接超时，请检查网络后重试。':error.message;}
    finally{loading=false;root.querySelectorAll('button').forEach(button=>button.disabled=false);}
  }
  el('login').addEventListener('submit',event=>{event.preventDefault();token=root.querySelector('#va-token').value.trim();root.querySelector('#va-token').value='';load();});
  el('refresh').addEventListener('click',()=>load());el('lock').addEventListener('click',lock);
  root.querySelectorAll('[data-va-range]').forEach(button=>button.addEventListener('click',()=>load(Number(button.dataset.vaRange))));
  el('export').addEventListener('click',()=>{if(!latest)return;const csv='\ufeff日期,独立访客,其中新访客\r\n'+latest.days.map(row=>[row.day,row.visitors,row.newVisitors].join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='访客记录_'+latest.today+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  fetch('/assets/visitor-config.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error();return response.json();}).then(config=>{
    if(!/^https:\/\/[a-z0-9.-]+\.(?:workers\.dev|pages\.dev)$/.test(config.endpoint||'')){
      el('state').textContent='尚未接通';root.querySelector('#va-login-title').textContent='访客面板已准备好';el('prompt').textContent='统计服务尚未接通。接通后开始记录真实访问，不回填历史人数。';el('login').hidden=true;return;
    }
    endpoint=config.endpoint;el('state').textContent='站主专属';
  }).catch(()=>{el('state').textContent='连接不可用';el('prompt').textContent='无法读取统计配置，请稍后刷新重试。';el('login').hidden=true;});
})();
