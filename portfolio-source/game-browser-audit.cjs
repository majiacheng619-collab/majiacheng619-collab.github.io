/* Local-only interaction regression audit. node game-browser-audit.cjs _site
 * CHROME_PATH can select an installed Chromium. No QA request reaches production. */
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'_site');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp'};
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
async function checkpoint(page){return page.evaluate(()=>{dispatchEvent(new Event('gardencheckpoint'));return JSON.parse(sessionStorage.getItem('sprout-battle-v5')).data;});}
async function cellPoint(page,row=2,col=1){return page.locator('#garden').evaluate((canvas,{row,col})=>{const r=canvas.getBoundingClientRect(),p=GardenEngine.center(row,col);return {x:r.x+p.x*r.width/1000,y:r.y+p.y*r.height/620};},{row,col});}
async function tapPlant(page){await page.locator('#garden').scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const p=await cellPoint(page);await page.touchscreen.tap(p.x,p.y);await page.waitForSelector('#inspection-dialog[open]');await page.waitForTimeout(320);}
async function fixture(page,branch){
 // Install after pagehide rather than being overwritten by the outgoing battle's save.
 const data=await page.evaluate(()=>{const E=GardenEngine,p=E.freshProgress();p.cleared=5;const s=E.create(5,611,undefined,5,{meta:p.meta});E.start(s);s.energy=1000;const r=E.place(s,'seed',2,1);if(!r.ok)throw Error(JSON.stringify(r));Object.assign(r.plant,{stage:'adult',level:2,age:40});r.plant.hp=r.plant.maxHp=E.plantMaxHp(s,r.plant);return {progress:p,battle:E.snapshot(s)};});
 await page.evaluate(data=>localStorage.setItem('garden-qa-fixture',JSON.stringify(data)),data);
 await page.reload();await page.bringToFront();await page.locator('[data-action="resume"]').click();await page.waitForTimeout(3250);await page.waitForSelector('#overlay',{state:'hidden'}).catch(async error=>{console.log('Fixture diagnostic',await page.locator('#overlay').innerText(),await page.locator('#resume-count').innerText(),await page.evaluate(()=>({hidden:document.hidden,visibility:document.visibilityState})));throw error;});
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const report=[];try{
 // Keep Chromium multiprocess: the serverless helper's --single-process flag can
 // stop animation frames or terminate Chromium when a context closes.
 const args=['--no-sandbox','--disable-dev-shm-usage'];
 browser=await chromium.launch({headless:true,args,executablePath:process.env.CHROME_PATH||undefined});
 const origin=`http://127.0.0.1:${server.address().port}`;
 for(const [width,height]of (process.env.GARDEN_AUDIT_VIEWPORTS?JSON.parse(process.env.GARDEN_AUDIT_VIEWPORTS):[[320,568],[390,844],[844,390],[1440,900]])){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.log('Runtime error',e.message);});
  await page.addInitScript(()=>{const raw=localStorage.getItem('garden-qa-fixture');if(raw){const {progress,battle}=JSON.parse(raw);localStorage.setItem('sprout-story-v5',JSON.stringify(progress));sessionStorage.setItem('sprout-battle-v5',JSON.stringify(battle));}});
  await page.goto(origin+'/game/');await page.bringToFront();await page.waitForFunction(()=>window.GardenUI&&document.querySelector('#seed-cards button'));
  await fixture(page);await tapPlant(page);
  assert.equal(await page.locator('[data-bloom]').count(),2,'Opening with touch must not accidentally upgrade');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
  for(const branch of ['a','b']){
   const button=page.locator(`[data-bloom="${branch}"]`);assert.equal(await button.isEnabled(),true);await button.scrollIntoViewIfNeeded();
   const r=await button.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width+1,'Branch fits viewport');
   assert.ok(r.y>=0&&r.y+r.height<=height+1,'Branch becomes fully visible by scrolling');
  }
  const held=await checkpoint(page);await page.waitForTimeout(450);assert.equal((await checkpoint(page)).ticks,held.ticks,'Reading inspector freezes simulation');
  await page.locator('[data-bloom="b"]').click();await page.waitForSelector('.inspection-flowered');assert.equal((await checkpoint(page)).plants.find(p=>p.col===1&&p.row===2).branch,'b');
  await page.locator('.inspection-continue').scrollIntoViewIfNeeded();await page.locator('.inspection-continue').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'garden');
  const resumed=await checkpoint(page);await page.waitForTimeout(700);const resumedAfter=await checkpoint(page);if(resumedAfter.ticks<=resumed.ticks)console.log('Resume diagnostic',JSON.stringify({before:resumed.ticks,after:resumedAfter.ticks,dom:await page.evaluate(()=>({hidden:document.hidden,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),overlay:document.querySelector('#overlay').hidden,inspection:document.querySelector('#inspection-dialog').open}))}));assert.ok(resumedAfter.ticks>resumed.ticks,'Closing resumes simulation');
  await tapPlant(page);await page.locator('.inspection-close').click();await tapPlant(page);await page.keyboard.press('Escape');assert.equal(await page.locator('#inspection-dialog').evaluate(d=>d.open),false);
  // Mouse/touch cancellation and a swipe returning to its origin must never plant.
  const before=(await checkpoint(page)).plants.length;
  await page.locator('#garden').evaluate(canvas=>{const r=canvas.getBoundingClientRect(),p=GardenEngine.center(2,4),x=r.x+p.x*r.width/1000,y=r.y+p.y*r.height/620;
   const send=(type,dx=0)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:51,isPrimary:true,pointerType:'touch',button:0,clientX:x+dx,clientY:y}));
   send('pointerdown');send('pointermove',30);send('pointermove');send('pointerup');send('pointerdown');send('pointercancel');send('pointerup');
  });assert.equal((await checkpoint(page)).plants.length,before,'Cancelled and moved pointers do not plant');
  await page.locator('#pause').click();const paused=await checkpoint(page);await page.waitForTimeout(250);assert.equal((await checkpoint(page)).ticks,paused.ticks);await page.locator('[data-action="resume"]').click();
  await page.locator('#menu').click();await page.locator('#save-open').scrollIntoViewIfNeeded();await page.locator('#save-open').click();assert.match(await page.locator('#save-code').inputValue(),/^SP6-/);await page.locator('#close-save').click();assert.equal(await page.locator('#settings-dialog').evaluate(d=>d.open),true);await page.locator('#settings-resume').scrollIntoViewIfNeeded();await page.locator('#settings-resume').click();
  // Native fullscreen is not implemented in every engine. Exercise the viewport fallback explicitly.
  await page.evaluate(()=>{document.querySelector('#playfield').requestFullscreen=undefined;document.querySelector('#fullscreen').click();});
  assert.equal(await page.evaluate(()=>document.body.classList.contains('game-fullscreen')),true);await page.waitForTimeout(100);const fullscreenBounds=await page.locator('#playfield').boundingBox();assert.ok(Math.abs(fullscreenBounds.x)<1&&Math.abs(fullscreenBounds.y)<1&&Math.abs(fullscreenBounds.width-width)<1&&Math.abs(fullscreenBounds.height-height)<1,'Fullscreen fills the viewport without presentation margins');await tapPlant(page);assert.equal(await page.locator('#inspection-dialog').evaluate(d=>!!d.closest('#playfield')),true);await page.locator('.inspection-close').click();await page.evaluate(()=>document.querySelector('#fullscreen').click());
  // A second restored fixture tests the other branch independently.
  await fixture(page);await tapPlant(page);await page.locator('[data-bloom="a"]').scrollIntoViewIfNeeded();await page.locator('[data-bloom="a"]').click();await page.waitForSelector('.inspection-flowered');assert.equal((await checkpoint(page)).plants.find(p=>p.col===1&&p.row===2).branch,'a');
  assert.deepEqual(errors,[],'No browser runtime errors');report.push({width,height,branches:['a','b'],inspectorFreeze:true,closeResume:true,pointerCancellation:true,pause:true,saveTools:true,fullscreenFallback:true,errors});console.log(`Verified garden interactions ${width}×${height}`);await page.close();
 }
 console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();server.close();}})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
