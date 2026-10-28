/* Spatial material lifecycle and the native case-reading index. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'_site');
const server=http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const origin='http://127.0.0.1:'+server.address().port;await page.goto(origin);
 await page.waitForSelector('.era-silk[data-art-state="ready"]');
 assert.equal(await page.locator('.hero-water').evaluate(e=>getComputedStyle(e).display),'none','Reduced motion also stops the hero water');
 const art=page.locator('.home-page .spatial-hero-art');
 assert.equal(await art.count(),1,'One finished hero artwork');
 assert.ok(await art.evaluate(image=>image.complete&&image.naturalWidth>=1000),'The high-resolution alpha asset decodes');
 assert.equal(await art.evaluate(image=>getComputedStyle(image).animationName),'none','Reduced motion leaves a stationary sculpture');
 await page.emulateMedia({reducedMotion:'no-preference'});
 assert.equal(await art.evaluate(image=>getComputedStyle(image).animationName),'spatial-ribbon-float');
 await page.mouse.move(310,600);
 await page.waitForFunction(()=>{const value=document.querySelector('[data-era-hero]').style.getPropertyValue('--art-rotate-y');return value.trim()!==''&&value!=='0deg';});
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.spatial-art').first().evaluate(e=>getComputedStyle(e).transform),'none');
 // Exercise real coarse-input gestures rather than dispatching implementation events.
 await page.locator('[data-studio-preview]').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
 const touchSession=await context.newCDPSession(page);
 async function swipe(dx,dy){
  const box=await page.locator('[data-studio-panel]:visible').boundingBox();
  const x=dx<0?300:85,y=Math.max(90,Math.min(550,box.y+110));
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=5;i++){
   await touchSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/5,y:y+dy*i/5}]});
   await page.waitForTimeout(25);
  }
  await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await swipe(-160,0);
 await page.waitForFunction(()=>document.querySelector('[data-studio-tab="film"]').getAttribute('aria-selected')==='true');
 assert.equal(await page.locator('#intro-video').evaluate(e=>e.paused),true,'Swiping over the work never starts playback');
 assert.equal(new URL(page.url()).pathname,'/','A swipe never follows a preview link');
 await swipe(160,0);
 await page.waitForFunction(()=>document.querySelector('[data-studio-tab="product"]').getAttribute('aria-selected')==='true');
 await swipe(0,-170);
 assert.equal(await page.locator('[data-studio-tab="product"]').getAttribute('aria-selected'),'true','Vertical touch keeps the selected work');
 assert.ok(await page.evaluate(()=>scrollY)>0,'Vertical scrolling remains native');
 const tabGeometry=await page.locator('.studio-tabs[role="tablist"]').evaluate(e=>({x:parseFloat(e.style.getPropertyValue('--studio-tab-x')),width:parseFloat(e.style.getPropertyValue('--studio-tab-width')),selectedX:e.querySelector('[aria-selected="true"]').offsetLeft,selectedWidth:e.querySelector('[aria-selected="true"]').offsetWidth}));
 assert.equal(tabGeometry.x,tabGeometry.selectedX);assert.equal(tabGeometry.width,tabGeometry.selectedWidth);
 await touchSession.detach();
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await page.goto(origin+'/experience/');
  const links=page.locator('.case-index a');assert.equal(await links.count(),6);
  assert.equal(await page.locator('.case-overview').count(),6);
  assert.equal(await page.locator('.star-grid > article:first-child.star-result').count(),6,'Every case leads with its published result');
  assert.equal(await page.locator('.case-overview').first().evaluate(e=>getComputedStyle(e).position),width===1440?'sticky':'static');
  await links.nth(3).click();await page.waitForURL('**/experience/#field');
  await page.waitForFunction(()=>document.querySelector('.case-index a[href="#field"]').getAttribute('aria-current')==='location');
  const bounds=await page.locator('.case-index').boundingBox();assert.ok(bounds.y>=0&&bounds.y<130,'The case index stays reachable');
  const target=await page.locator('#field').boundingBox();assert.ok(target.y>=bounds.y+bounds.height-3,'The destination heading clears the index');
  await page.goto(origin+'/contact/');
  assert.equal(await page.locator('.contact-profile img').count(),1,'A real personal identity anchors contact');
  if(width===390){const methods=await page.locator('.contact-methods').boundingBox(),identity=await page.locator('.contact-identity').boundingBox();assert.ok(methods.y<identity.y,'Direct contact leads on a phone');}
 }
 assert.deepEqual(errors,[]);
 await context.route('**/assets/liquid-ribbon.*',route=>route.abort());
 const fallback=await context.newPage();await fallback.goto(origin);
 await fallback.waitForSelector('.home-page .era-silk[data-art-error]');
 assert.equal(await fallback.locator('.home-page .era-silk svg').evaluate(e=>getComputedStyle(e).visibility),'visible','Failed artwork requests restore the authored visual');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,heroArtwork:true,artParallax:true,reducedMotion:true,assetRecovery:true,nativeCaseIndex:true,contactPriority:true}));
 await context.close();
 }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
