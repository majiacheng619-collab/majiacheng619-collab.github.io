/* 我在本机验证完整离线安装与重开，测试请求不离开本机。 */
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'_site');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
let args=['--no-sandbox'];if(process.env.CHROME_HELPER){const {default:c}=await import(process.env.CHROME_HELPER);args=c.args;}
browser=await chromium.launch({args,executablePath:process.env.CHROME_PATH||undefined});
const context=await browser.newContext(),page=await context.newPage(),origin=`http://127.0.0.1:${server.address().port}`;
await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(origin+'/game/');await page.waitForFunction(()=>globalThis.GardenEngine?.VERSION==='6.4.0');
const cached=await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js',{scope:'./'});await navigator.serviceWorker.ready;const keys=await caches.keys();const key=keys.find(k=>k.includes('6.4.0-'));if(!key)throw Error('Current cache missing');const cache=await caches.open(key);return {key,entries:(await cache.keys()).length};});
assert.ok(cached.entries>=130,'Precache must contain complete playable game and reference pages');
await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);
for(const route of ['game/','game/codex.html','game/guide.html','game/about.html']){await page.goto(origin+'/'+route);assert.ok(await page.locator('main').isVisible());}
await page.goto(origin+'/game/');await page.waitForFunction(()=>globalThis.GardenEngine?.VERSION==='6.4.0');await page.locator('[data-action="start"]').click();assert.ok(await page.locator('#garden').isVisible());assert.deepEqual(errors,[]);
console.log(JSON.stringify({ok:true,...cached,offlineRoutes:4,offlineBoot:true,errors}));
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
