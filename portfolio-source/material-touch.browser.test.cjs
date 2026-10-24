/* Touch feedback must identify a real control while preserving scrolling and navigation. */
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'_site');
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(f!==root&&!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const origin=`http://127.0.0.1:${server.address().port}`;
 await page.goto(origin+'/');await page.waitForSelector('[data-optical-scene="webgl"]',{state:'attached'});
 assert.equal(await page.locator('.water-events').evaluate(e=>e.hidden),true,'Live optics replace the decorative CSS fallback');
 const optical=page.locator('[data-optical-scene]');
 await optical.evaluate(c=>{const loss=c.getContext('webgl').getExtension('WEBGL_lose_context');c.restoreOpticalTestContext=()=>loss.restoreContext();loss.loseContext();});
 await page.waitForFunction(()=>document.querySelector('[data-optical-scene]').hidden);
 assert.equal(await page.locator('.water-events').evaluate(e=>e.hidden),false,'Context loss restores the authored fallback');
 await optical.evaluate(c=>{c.restoreOpticalTestContext();delete c.restoreOpticalTestContext;});
 await page.waitForFunction(()=>!document.querySelector('[data-optical-scene]').hidden&&document.querySelector('.water-events').hidden);

 // Only the owning pointer can release a water contact; a tap has an entry and exit wave.
 async function waterPointer(type,id=31,primary=true){await page.evaluate(({type,id,primary})=>document.dispatchEvent(new PointerEvent(type,{bubbles:true,isPrimary:primary,pointerId:id,pointerType:'touch',button:0,clientX:240,clientY:280})),{type,id,primary});}
 const inputCount=()=>optical.evaluate(c=>Number(c.dataset.opticalInputs||0));
 let count=await inputCount();await waterPointer('pointerdown');await waterPointer('pointerup',32,false);
 assert.equal(await inputCount(),count+1,'A second finger does not release the primary contact');
 await waterPointer('pointerup');assert.equal(await inputCount(),count+2,'Lifting the owning finger emits an exit wave');
 count=await inputCount();await waterPointer('pointerdown');await waterPointer('pointercancel');await waterPointer('pointerup');
 assert.equal(await inputCount(),count+1,'Cancelled gestures do not emit a confirming exit wave');
 await waterPointer('pointerdown');await page.emulateMedia({reducedMotion:'reduce'});await waterPointer('pointerup');
 count=await inputCount();await page.emulateMedia({reducedMotion:'no-preference'});await waterPointer('pointerup');
 assert.equal(await inputCount(),count,'Changing motion preference clears contact ownership');
 assert.equal(await page.evaluate(()=>matchMedia('(hover:hover) and (pointer:fine)').matches),false,'Test a real coarse-input layout');
 await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
 const card=page.locator('.capability-card').first();await card.scrollIntoViewIfNeeded();await page.waitForTimeout(100);
 async function touch(type,dx=0){await card.evaluate((e,{type,dx})=>{const r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent(type,{bubbles:true,isPrimary:true,pointerId:23,pointerType:'touch',button:0,clientX:r.left+r.width*.35+dx,clientY:r.top+70}));},{type,dx});}
 await touch('pointerdown');await page.waitForTimeout(120);
 assert.equal(await card.getAttribute('data-glass-pressed'),'true','Touch identifies the selected card');
 assert.notEqual(await card.evaluate(e=>getComputedStyle(e).transform),'none','Coarse touch visibly depresses the material');
 if(process.env.TOUCH_OUTPUT){fs.mkdirSync(process.env.TOUCH_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.TOUCH_OUTPUT,'pressed-phone.png')});}
 assert.ok(Number(await card.evaluate(e=>getComputedStyle(e,'::after').opacity))>.5,'Contact glint is visible');
 await touch('pointermove',60);
 assert.equal(await card.getAttribute('data-glass-pressed'),null,'A swipe cancels the press');
 await page.evaluate(()=>scrollBy(0,100));assert.ok(await page.evaluate(()=>scrollY)>0,'Scrolling remains native');
 await touch('pointerdown');await touch('pointercancel');
 assert.equal(await card.getAttribute('data-glass-pressed'),null,'Cancellation leaves no stuck material');
 assert.equal(await card.getAttribute('data-glass-released'),null,'Cancelled input does not confirm activation');
 await touch('pointerdown');await touch('pointerup');
 assert.equal(await card.getAttribute('data-glass-released'),'true','A completed press gets a release response');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.documentElement.dataset.sceneMotion==='off');await touch('pointerdown');
 assert.equal(await card.evaluate(e=>getComputedStyle(e).transform),'none','Reduced motion uses a stationary selection cue');
 assert.equal(await card.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
 await touch('pointerup');await card.focus();
 const summary=page.locator('.premium-transcript summary');await summary.focus();
 await page.keyboard.down(' ');assert.equal(await summary.getAttribute('data-glass-pressed'),'true');await page.locator('.hero-title, h1').first().evaluate(e=>{e.tabIndex=-1;e.focus();});
 assert.equal(await summary.getAttribute('data-glass-pressed'),null,'Moving keyboard focus clears pressure');
 await page.keyboard.up(' ');await card.focus();
 await Promise.all([page.waitForURL('**/experience/index.html#ecommerce'),page.keyboard.press('Enter')]);
 assert.equal(await page.locator('#ecommerce').count(),1,'Native keyboard navigation reaches the promised case');
 assert.deepEqual(errors,[]);
 await context.close();
 const desktop=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const desktopPage=await desktop.newPage();await desktopPage.goto(origin+'/');
 await desktopPage.addStyleTag({content:'html{scroll-behavior:auto!important}'});
 const story=desktopPage.locator('.premium-story').first();await story.hover();await desktopPage.mouse.down();await desktopPage.waitForTimeout(120);
 assert.equal(await story.getAttribute('data-glass-pressed'),'true');
 assert.equal(await story.evaluate(e=>getComputedStyle(e).transitionDuration.split(',')[0]),'0.09s','Hover does not override the immediate press transition');
 assert.ok(await story.evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m11<1),'Hovered control still compresses');
 await desktopPage.mouse.move(1,1);await desktopPage.mouse.up();await desktop.close();
 console.log(JSON.stringify({ok:true,coarseTouch:true,press:true,swipe:true,cancel:true,release:true,reducedMotion:true,nativeNavigation:true,pointerOwnership:true,keyboardFocus:true,desktopPress:true}));
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
