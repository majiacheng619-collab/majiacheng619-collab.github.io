/* Regression checks for the reported mobile glass/lesson failures and live optics. */
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'_site');
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
const output=process.env.REPAIR_OUTPUT||'/tmp/sprout-repair-review';fs.mkdirSync(output,{recursive:true});
async function checkpoint(page){return page.evaluate(()=>{dispatchEvent(new Event('gardencheckpoint'));return JSON.parse(sessionStorage.getItem('sprout-battle-v5')).data;});}
async function tapCell(page,row,col){await page.locator('#garden').evaluate((c,{row,col})=>{const r=c.getBoundingClientRect(),p=GardenEngine.center(row,col),o={bubbles:true,isPrimary:true,pointerId:17,pointerType:'touch',button:0,clientX:r.left+p.x*r.width/1000,clientY:r.top+p.y*r.height/620};c.dispatchEvent(new PointerEvent('pointerdown',o));c.dispatchEvent(new PointerEvent('pointerup',o));},{row,col});}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const report=[];
 for(const width of JSON.parse(process.env.REPAIR_WIDTHS||'[320,390,1440]')){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:true,serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/');
  const optical=page.locator('[data-optical-scene]');await page.waitForSelector('[data-optical-scene="webgl"]',{state:'attached'});
  assert.equal(await optical.getAttribute('data-optical-samples'),'1228800');
  const a=await optical.screenshot();await page.waitForTimeout(650);const b=await optical.screenshot();
  assert.equal(a.equals(b),false,'Actual rendered pixels change with time');
  const inputs=Number(await optical.getAttribute('data-optical-inputs')||0);await page.mouse.click(width*.75,200);
  assert.ok(Number(await optical.getAttribute('data-optical-inputs'))>inputs,'Pointer input reaches the optical field');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);
  const stopped=await optical.getAttribute('data-optical-frames');await page.waitForTimeout(250);assert.equal(await optical.getAttribute('data-optical-frames'),stopped,'Reduced motion stops the renderer');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.screenshot({path:path.join(output,'home-'+width+'.png')});
  await page.goto(origin+'/game/');await page.waitForFunction(()=>GardenEngine.VERSION==='7.0.1');
  await page.waitForSelector('[data-optical-scene="webgl"]',{state:'attached'});
  assert.ok(await page.locator('.gp-nav .brand img').evaluate(i=>i.complete&&i.naturalWidth>0),'Brand asset loads');
  const header=await page.locator('.gp-nav .brand').evaluate(e=>getComputedStyle(e).color);assert.equal(header,'rgb(33, 62, 54)','Light header has readable dark text');
  await page.locator('[data-action="start"]').click();await page.waitForSelector('#overlay',{state:'hidden'});
  await page.waitForFunction(()=>{dispatchEvent(new Event('gardencheckpoint'));return JSON.parse(sessionStorage.getItem('sprout-battle-v5')).data.energyTokens.length>0;});
  const before=await checkpoint(page);
  // A tap 18 CSS pixels from the token still collects it on a narrow phone.
  await page.locator('#garden').evaluate(c=>{dispatchEvent(new Event('gardencheckpoint'));const s=JSON.parse(sessionStorage.getItem('sprout-battle-v5')).data,t=s.energyTokens[0],r=c.getBoundingClientRect();const o={bubbles:true,isPrimary:true,pointerId:18,pointerType:'touch',button:0,clientX:r.left+t.x*r.width/1000+18,clientY:r.top+t.y*r.height/620};c.dispatchEvent(new PointerEvent('pointerdown',o));c.dispatchEvent(new PointerEvent('pointerup',o));});
  assert.ok((await checkpoint(page)).energy>before.energy,'Minimum touch area collects a sun');
  await page.locator('[data-seed="sunbud"]').click();await tapCell(page,2,0);
  assert.equal(await page.locator('[data-seed="seed"]').getAttribute('aria-pressed'),'true','Lesson selects the required thrower');
  assert.match(await page.locator('#tutorial-tip').textContent(),/0\/2/);
  assert.match(await page.locator('#phase-label').textContent(),/完成引导/);
  const lawn=await page.locator('#garden').boundingBox(),tip=await page.locator('#tutorial-tip').boundingBox();assert.ok(tip.y>=lawn.y+lawn.height,'Lesson does not cover grass or sunlight');const firstTip=page.locator('#first-tip');if(await firstTip.isVisible()){const box=await firstTip.boundingBox();assert.ok(box.y>=lawn.y+lawn.height,'New-plant hint also stays outside the lawn');}
  for(const selector of ['.game-toolbar','.seed-tray','.game-status'])assert.equal(await page.locator(selector).evaluate(e=>getComputedStyle(e).borderTopWidth),'0px','No square glass frame: '+selector);
  await page.screenshot({path:path.join(output,'game-'+width+'.png'),fullPage:true});
  const AxeBuilder=require('@axe-core/playwright').default;
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  if(axe.violations.length)console.log(JSON.stringify(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),null,2));
  assert.deepEqual(axe.violations,[],'Actual playing UI passes accessibility checks');
  await page.locator('#pause').click();await page.reload();await page.locator('[data-action="resume"]').click();await page.waitForSelector('#overlay',{state:'hidden',timeout:1500});
  const resumed=await checkpoint(page);assert.equal(resumed.status,'paused'); // Snapshot stores playing battles paused.
  await page.waitForTimeout(250);assert.ok((await checkpoint(page)).ticks>resumed.ticks,'Explicit resume starts immediately');
  assert.deepEqual(errors,[]);report.push({width,liveField:true,changedPixels:true,touch:true,lesson:true,resume:true,accessibility:true});await context.close();
 }
 console.log(JSON.stringify({ok:true,report}));
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
