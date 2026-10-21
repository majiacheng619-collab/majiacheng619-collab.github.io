(function(root){'use strict';const E=GardenEngine,T=GardenCopy,SITE_URL=new URL('./',location.href).href.replace(/\/$/,'');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A single optical grid keeps navigation, actions and resources legible at 14–24 px.
// Icons are decorative; the surrounding button or link owns its accessible name.
const paths=Object.freeze({
leaf:'M5 20C2.5 11.5 8 4 20 4c0 11-5.5 17-15 16ZM5 20l9-9',
play:'M8 5.5a.8.8 0 0 1 1.2-.7l10 6.5a.8.8 0 0 1 0 1.4l-10 6.5a.8.8 0 0 1-1.2-.7Z',
arrow:'M4.5 12h15m-6-6 6 6-6 6',
sun:'M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0',
plus:'M12 5v14M5 12h14',
shovel:'m9 15 7-7m-.5-4.5 5 5m-5-5 2-2 5 5-2 2M9 13l3 3-4 4c-1.5 1.5-4.5 1-5 1 0-.5-.5-3.5 1-5Z',
pause:'M7.5 5.5h2v13h-2ZM14.5 5.5h2v13h-2Z',
book:'M12 5.5C9 3.7 5.5 3.5 3 4.5v14c3-1 6-.5 9 1.5m0-14.5c3-1.8 6.5-2 9-1v14c-3-1-6-.5-9 1.5Z',
person:'M15.5 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0M4.5 20v-1a7.5 7.5 0 0 1 15 0v1Z',
film:'M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5ZM7 3.5v17m10-17v17M3.5 8H7m-3.5 8H7m10-8h3.5M17 16h3.5',
gear:'m10 3-.5 2a7 7 0 0 0-1.7 1L5.8 5.4l-2 3.4 1.5 1.4a7 7 0 0 0 0 2l-1.5 1.4 2 3.4 2-.6a7 7 0 0 0 1.7 1l.5 2h4l.5-2a7 7 0 0 0 1.7-1l2 .6 2-3.4-1.5-1.4a7 7 0 0 0 0-2l1.5-1.4-2-3.4-2 .6a7 7 0 0 0-1.7-1L14 3ZM15 11.2a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
expand:'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
close:'m6 6 12 12M6 18 18 6',
lock:'M7 10h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm1 0V7a4 4 0 0 1 8 0v3m-4 4v3',
check:'m5 12 4.5 4.5L19 6.5',
phone:'M5 3.5h3l2 4.5-2 2c1.5 3 3 4.5 6 6l2-2 4.5 2v3a1.5 1.5 0 0 1-1.5 1.5C10 20.5 3.5 14 3.5 5A1.5 1.5 0 0 1 5 3.5Z',
upgrade:'m6 10.5 6-6 6 6M12 4.5v15M5 20h14',
flag:'M5 21V4m0 0c5-3.5 9 3.5 14 0v10c-5 3.5-9-3.5-14 0',
star:'m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.3-5.7-3-5.7 3 1.1-6.3L3.2 9.6l6.3-.9Z',
target:'M12 2v3m0 14v3M2 12h3m14 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0',
swap:'M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4',
restart:'M4.5 10a8 8 0 1 1 .6 6M4 4.5V10h5.5',
info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6m0-10v.1',
help:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M9.5 8.5a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1.1-1.5 2.5m0 3v.1',
home:'m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9',
sound:'M4 9h4l5-4v14l-5-4H4Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
mute:'M4 9h4l5-4v14l-5-4H4Zm13 1 4 4m-4 0 4-4',
heart:'M12 20 4.5 12.5A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.5Z'
});
const icon=k=>'<svg class="garden-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+(Object.prototype.hasOwnProperty.call(paths,k)?paths[k]:paths.leaf)+'"/></svg>';
function read(key,fallback,session=false){try{return JSON.parse((session?sessionStorage:localStorage).getItem(key))??fallback;}catch{return fallback;}}
function write(key,value,session=false){try{const st=session?sessionStorage:localStorage;if(value===null)st.removeItem(key);else st.setItem(key,JSON.stringify(value));}catch{}}
const params=new URLSearchParams(location.search),blind=params.get('blindtest')==='1';let lang=(params.get('lang')||(location.pathname?.endsWith('.en.html')?'en':null)||read('sprout-campaign-language','zh'))==='en'?'en':'zh';const t=p=>p[lang],u=k=>t(T[k]||{en:k,zh:k});
const DEFAULT_KEYS={seed1:'1',seed2:'2',seed3:'3',seed4:'4',seed5:'5',seed6:'6',seed7:'7',harvest:'e',flower:'u',shovel:'0',pause:'p'};
function prefs(){const raw=read('sprout-settings-v5',{}),p={difficulty:Object.prototype.hasOwnProperty.call(E.DIFFICULTIES,raw.difficulty)?raw.difficulty:'standard',soundVolume:Math.min(1,Math.max(0,Number.isFinite(raw.soundVolume)?raw.soundVolume:.65)),musicVolume:Math.min(1,Math.max(0,Number.isFinite(raw.musicVolume)?raw.musicVolume:.2)),auto:!!raw.auto,speed:raw.speed===2?2:1,fontScale:[1,1.15,1.3].includes(raw.fontScale)?raw.fontScale:1,noShake:raw.noShake===true,oneHand:raw.oneHand===true,keys:{...DEFAULT_KEYS}};const ks=raw.keys;if(ks&&Object.keys(DEFAULT_KEYS).every(k=>typeof ks[k]==='string'&&ks[k].length===1)&&new Set(Object.values(ks)).size===11)p.keys={...ks};return p;}
function applyPrefs(p){document.documentElement.style.setProperty('--type-scale',p.fontScale);document.documentElement.dataset.noShake=String(p.noShake);document.documentElement.dataset.oneHand=String(p.oneHand);}
function savePrefs(p){write('sprout-settings-v5',p);applyPrefs(p);window.dispatchEvent(new Event('gardenprefs'));}
function translate(){document.documentElement.lang=lang==='en'?'en':'zh-CN';document.documentElement.dataset.language=lang;document.documentElement.classList.add('js');document.querySelectorAll('[data-tr]').forEach(e=>e.textContent=u(e.dataset.tr));document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));document.querySelectorAll('.site-nav nav a').forEach(a=>{const l=a.querySelector('[data-tr]');if(l)a.setAttribute('aria-label',u(l.dataset.tr));});document.querySelectorAll('[data-close]').forEach(b=>b.setAttribute('aria-label',u('close')));const b=document.getElementById('language');if(b){b.textContent=lang==='zh'?'EN':'中文';b.setAttribute('aria-label',lang==='zh'?'Switch to English':'切换至中文');}const meta=root.GardenPages?.[document.body.dataset.page];if(meta){document.title=t(meta.title);for(const [selector,value]of [['meta[name="description"]',meta.description],['meta[property="og:title"]',meta.title],['meta[property="og:description"]',meta.description]])document.querySelector(selector)?.setAttribute('content',t(value));}applyPrefs(prefs());}
function setLanguage(v){lang=v==='en'?'en':'zh';write('sprout-campaign-language',lang);translate();window.dispatchEvent(new Event('gardenlanguage'));}
// Validate the identity and core progress before sanitizing optional fields. Sanitizing
// an unsupported/corrupt primary alone would silently reset a healthy checkpoint.
function validProgress(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||![4,5,6].includes(raw.schema))return false;
 const limit=raw.schema===4?12:20;
 if(!Number.isInteger(raw.cleared)||raw.cleared<0||raw.cleared>limit)return false;
 if(raw.stars!==undefined&&(!Array.isArray(raw.stars)||raw.stars.some(n=>!Number.isInteger(n)||n<0||n>3)))return false;
 return true;
}
function progress(){
 const key=blind?'sprout-blind-story-v5':'sprout-story-v5',raw=read(key,null,blind),backup=read(key+'-checkpoint',null,blind);
 const checkpoint=backup&&backup.crc===E.crc(JSON.stringify(backup.data))&&validProgress(backup.data)?backup.data:null;
 const legacy=blind?null:read('sprout-story-v4',null);
 const selected=validProgress(raw)?raw:checkpoint||(validProgress(legacy)?legacy:null);
 if(selected===raw&&raw?.schema===5&&!blind){const text=JSON.stringify({version:5,build:'5.0.0',progress:raw,battle:read('sprout-battle-v5',null,true)}),code='SP5-'+E.crc(text)+'-'+(typeof Buffer!=='undefined'?Buffer.from(text).toString('base64'):(()=>{const b=new TextEncoder().encode(text);let t='';for(let i=0;i<b.length;i+=32768)t+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(t);})());const old=backups();if(!old.some(v=>v.code===code))write('sprout-backups-v5',[{date:new Date().toISOString(),version:'5.0.0',code},...old].slice(0,3));}
 return E.sanitizeProgress(selected);
}
const saveProgress=p=>{const key=blind?'sprout-blind-story-v5':'sprout-story-v5';write(key,p,blind);write(key+'-checkpoint',{crc:E.crc(JSON.stringify(p)),data:p},blind);};
const saveBattle=s=>{const snapshot=E.snapshot(s),key=blind?'sprout-blind-battle-v5':'sprout-battle-v5';write(key,snapshot,true);if(snapshot)write(key+'-checkpoint',{crc:E.crc(JSON.stringify(snapshot)),data:snapshot},blind);};
const loadBattle=p=>{const key=blind?'sprout-blind-battle-v5':'sprout-battle-v5',a=E.restore(read(key,null,true),p);if(a)return a;const checkpoint=read(key+'-checkpoint',null,blind);return checkpoint&&checkpoint.crc===E.crc(JSON.stringify(checkpoint.data))?E.restore(checkpoint.data,p):null;};
const clearBattle=()=>{const key=blind?'sprout-blind-battle-v5':'sprout-battle-v5';write(key,null,true);write(key+'-checkpoint',null,blind);};
function backups(){const list=read(blind?'sprout-blind-backups-v5':'sprout-backups-v5',[],blind);return (Array.isArray(list)?list:[]).filter(item=>item&&typeof item==='object'&&typeof item.date==='string'&&typeof item.version==='string'&&typeof item.code==='string').slice(0,3);}
function backup(p,s){const code=E.exportCode(p,s),key=blind?'sprout-blind-backups-v5':'sprout-backups-v5',list=backups();const item={date:new Date().toISOString(),version:E.VERSION,code};write(key,[item,...list].slice(0,3),blind);return item;}
function download(name,text,mime='application/json'){const url=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function copy(text){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}}catch{}const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();let ok=false;try{ok=document.execCommand('copy');}catch{}area.remove();return ok;}
function portrait(canvas,id,enemy=false,locked=false,scale=.85){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();if(enemy){ctx.translate(canvas.width/2,canvas.height*.59);ctx.scale(scale,scale);root.GardenArt.enemy(ctx,{type:id,x:0,y:0,hp:1,maxHp:1,age:0,hit:0,slow:0,root:0,jumpTime:0},0);}else root.GardenArt.plant(ctx,id,canvas.width/2,canvas.height*.57,0,scale,0);ctx.restore();if(locked){ctx.save();ctx.globalCompositeOperation='source-in';ctx.fillStyle=root.GardenArt.ACCESSIBLE.muted;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}}
function dailyDate(){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=k=>parts.find(v=>v.type===k).value;return get('year')+'-'+get('month')+'-'+get('day');}
function objective(l,s){const o=l.objective;if(o&&['double','rations','repair','boss'].includes(o.type))return {double:{zh:'双线同时来客',en:'Two lanes at once'},rations:{zh:'每波随机种子补给',en:'A random seed ration each wave'},repair:{zh:'修补半残阵型',en:'Repair the damaged formation'},boss:{zh:'Boss 三阶段：召唤 / 换路 / 破绽',en:'Boss phases: summon / switch / vulnerable'}}[o.type][lang];if(!o)return u('endlessGoal');const num=Number.isFinite(s?.spent)?Math.floor(s.spent):0;return o.type==='limit'?u('goalLimit')+' '+o.limit:o.type==='budget'?u('goalBudget')+' '+num+'/'+o.limit:o.type==='protect'?u('goalProtect')+' '+(o.row+1)+'–'+(o.col+1):o.type==='time'?u('goalTime')+' '+Math.max(0,Math.ceil(o.limit-(s?.time||0)))+'s':u('goalRoster');}
function share(s){return '萌芽保卫队 / Sprout Patrol · '+E.VERSION+'\n'+(s.mode==='endless'?u('endless')+' '+s.completedWaves+' '+u('wavesCompleted'):t(s.level.name)+' · '+s.level.id+' · '+'★'.repeat(E.stars(s))+'☆'.repeat(3-E.stars(s)))+'\n'+t(E.DIFFICULTIES[s.difficulty].name)+' · '+Math.round(s.time)+'s · '+Math.floor(s.energy)+' '+u('sun')+'\n'+SITE_URL;}
function metrics(p){const levels=E.LEVELS.map((l,i)=>{const runs=p.attempts.filter(r=>r.levelIndex===i&&['adventure','replay'].includes(r.mode)),completed=runs.filter(r=>['won','lost','abandoned'].includes(r.result)),wins=completed.filter(r=>r.result==='won'),failures=completed.filter(r=>r.result!=='won');return {id:l.id,attempts:runs.length,completed:completed.length,wins:wins.length,winRate:completed.length?wins.length/completed.length:null,averageWinSeconds:wins.length?Math.round(wins.reduce((n,r)=>n+r.time,0)/wins.length*10)/10:null,failedRoutes:Array.from({length:5},(_,r)=>failures.filter(f=>f.failedRow===r).length),difficulties:Object.fromEntries(Object.keys(E.DIFFICULTIES).map(d=>{const a=completed.filter(r=>r.difficulty===d);return [d,{attempts:a.length,wins:a.filter(r=>r.result==='won').length}];}))};});return {schema:1,build:E.VERSION,exportedAt:new Date().toISOString(),localOnly:true,blindTest:blind,levels,attempts:p.attempts};}
root.GardenUI={asset:path=>root.GardenAssets?.[path]||path,SITE_URL,blind,params,DEFAULT_KEYS,esc,icon,read,write,t,u,get lang(){return lang;},prefs,savePrefs,translate,setLanguage,progress,saveProgress,saveBattle,loadBattle,clearBattle,backups,backup,download,copy,portrait,dailyDate,objective,share,metrics,stars:n=>'<span class="stars" aria-label="'+n+' / 3">'+'★'.repeat(n)+'<i>'+'☆'.repeat(3-n)+'</i></span>'};
function init(){if(['en','zh'].includes(params.get('lang')))write('sprout-campaign-language',lang);translate();document.getElementById('language')?.addEventListener('click',()=>setLanguage(lang==='zh'?'en':'zh'));if(blind)document.querySelectorAll('a[href]').forEach(a=>{const href=a.getAttribute('href');if(href&&/^[\w-]+\.html(?:#.*)?$/.test(href))a.setAttribute('href',href.replace('.html','.html?blindtest=1'));});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(globalThis);
