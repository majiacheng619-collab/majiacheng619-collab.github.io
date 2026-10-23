/* Real browser release audit. Usage: NODE_PATH=... node browser-audit.cjs _site */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || '_site');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.vtt':'text/vtt','.mp4':'video/mp4','.pdf':'application/pdf'};
const deviceAsset = JSON.parse(fs.readFileSync(path.join(__dirname,'device-asset.json')));
const pages = [];
function walk(folder) { for (const item of fs.readdirSync(folder, {withFileTypes:true})) {const f=path.join(folder,item.name);if(item.isDirectory())walk(f);else if(f.endsWith('.html'))pages.push(path.relative(root,f).split(path.sep).join('/'));} }
walk(root);
const server = http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)&&f!==root){res.writeHead(403);return res.end();}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 let browser,page;
 const failures=[],consoleErrors=[],httpErrors=[];
 const report={pages:pages.length,viewports:[],interactions:[],errors:failures};
 const AxeBuilder=process.env.AUDIT_ACCESSIBILITY==='1'?require('@axe-core/playwright').default:null;
 if(AxeBuilder)report.accessibility=[];
 async function auditAccessibility(route,state='page'){
   if(!AxeBuilder)return;
   // Measure the settled interface rather than a translucent entrance frame.
   await page.locator('dialog[open]').evaluateAll(async dialogs=>{await Promise.all(dialogs.flatMap(dialog=>dialog.getAnimations({subtree:true})).map(animation=>animation.finished.catch(()=>{})));});
   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   report.accessibility.push({route,state,violations:result.violations.length});
   for(const v of result.violations){failures.push(`Accessibility ${route} (${state}): ${v.id} (${v.nodes.length} elements)`);console.log(JSON.stringify({accessibilityFailure:{route,state,rule:v.id,nodes:v.nodes.map(node=>({target:node.target,summary:node.failureSummary,html:node.html}))}}));}
 }
 try {
 let args=['--no-sandbox'];if(process.env.CHROME_HELPER){const {default:c}=await import(process.env.CHROME_HELPER);args=c.args;}
 browser=await chromium.launch({headless:true,args,executablePath:process.env.CHROME_PATH||undefined});
 const context=await browser.newContext({hasTouch:true});
 // Audit the self-contained release and prevent accidental external requests.
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 page=await context.newPage();
 if(process.env.AUDIT_OUTPUT)fs.mkdirSync(process.env.AUDIT_OUTPUT,{recursive:true});
 page.on('pageerror',e=>consoleErrors.push(`${page.url()}: ${e.message}`));
 page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)httpErrors.push(`${r.status()} ${r.url()}`);});
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/');
 assert.equal(await page.locator('header,[data-menu-open],#menu-dialog,.chapter-nav,.reading-progress').count(),0,'Retired navigation must not return');
 assert.equal(await page.locator('[data-glass-dock]').count(),1,'One shared navigation surface');
 assert.equal(await page.locator('[data-search-open],#search-dialog,[data-search-index]').count(),0,'Website search is removed');
 // Clear glass is fixed; retired visitor controls and stored preferences cannot return.
 assert.equal(await page.locator('.capability-card').count(),3);
 assert.equal(await page.locator('.glass-preferences,#glass-clarity,#glass-motion').count(),0);
 await page.evaluate(()=>localStorage.setItem('portfolio-glass-appearance-v1',JSON.stringify({clarity:0,motion:false})));
 await page.reload();
 assert.equal(await page.evaluate(()=>localStorage.getItem('portfolio-glass-appearance-v1')),null);
 assert.ok(Number(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--glass-alpha')))<.06);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.documentElement.dataset.sceneMotion==='off');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.waitForFunction(()=>document.documentElement.dataset.sceneMotion==='on');
 assert.equal(await page.locator('.capability-card').first().evaluate(el=>getComputedStyle(el).backdropFilter.includes('blur')),true);
 await page.goto(origin+'/experience/');
 assert.equal(await page.locator('.case-study').count(),6);
 assert.equal(await page.locator('.star-grid article>h3').count(),24);
 assert.equal(await page.locator('.role-path').count(),5);
 assert.ok((await page.locator('#ecommerce').textContent()).includes('288'));
 await page.goto(origin+'/');
 report.interactions.push('Fixed clear material, removed appearance UI, legacy preference cleanup, system motion and six expanded STAR cases');
 await page.keyboard.press('Control+k');
 assert.equal(await page.locator('dialog[open]').count(),0,'Retired search shortcut opens no dialog');
 report.interactions.push('website search UI and shortcut removed');
 const dock=page.locator('[data-glass-dock]'),dockLinks=dock.locator('[data-dock-link]');
 assert.equal(await dockLinks.count(),5,'The dock retains five real navigation links');
 assert.equal(await dock.locator('[data-dock-item]').count(),5,'Five destination links');
 assert.equal(await dock.locator('button[data-dock-search]').count(),0);
 assert.equal(await dock.locator('[data-dock-lens]').count(),1,'One moving optical lens');
 assert.equal(await dock.locator('[data-dock-projection],.glass-dock__projection,.glass-dock__clone').count(),0,'No duplicated optical labels');
 assert.equal(await dock.locator('a span').count(),5,'Each navigation label is rendered once');
 const linkURLs=await dockLinks.evaluateAll(links=>links.map(a=>a.href));
 assert.equal(new URL(linkURLs[4]).pathname,'/contact/index.html','Contact is a standalone route');
 for(const href of linkURLs){const destination=new URL(href);assert.equal(destination.origin,origin);assert.equal((await context.request.get(destination.href)).status(),200,'Dock fallback destination exists: '+href);}
 for(const width of [320,390,768,1024,1440]){
   await page.setViewportSize({width,height:844});
   const bounds=await dock.boundingBox();
   assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'Dock fits '+width+'px viewport');
   assert.ok(bounds.y>=0&&bounds.y+bounds.height<844,'Dock remains above the bottom edge');
 }
 await page.setViewportSize({width:390,height:844});
 if(process.env.AUDIT_OUTPUT)await page.screenshot({path:path.join(process.env.AUDIT_OUTPUT,'glass-home-390.png')});
 const first=await dockLinks.nth(0).boundingBox(),second=await dockLinks.nth(1).boundingBox();
 await page.evaluate(()=>{window.__dockGestureLog=[];const dock=document.querySelector('[data-glass-dock]');for(const type of ['pointerdown','pointermove','pointercancel','pointerup','dragstart','lostpointercapture'])dock.addEventListener(type,e=>window.__dockGestureLog.push({type:e.type,target:e.target.tagName,x:e.clientX,y:e.clientY,primary:e.isPrimary,id:e.pointerId,buttons:e.buttons,prevented:e.defaultPrevented}));});
 const start={x:first.x+first.width/2,y:first.y+first.height/2},end={x:second.x+second.width/2,y:second.y+second.height/2};
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});
 assert.equal(await dock.getAttribute('data-dragging'),'true',JSON.stringify({errors:consoleErrors,events:await page.evaluate(()=>window.__dockGestureLog)}));
 if(process.env.AUDIT_OUTPUT)await page.screenshot({path:path.join(process.env.AUDIT_OUTPUT,'glass-drag-390.png')});
 const pointerId=await page.evaluate(()=>window.__dockGestureLog.find(event=>event.type==='pointerdown').id);
 await dock.dispatchEvent('pointercancel',{pointerId});await page.mouse.up();
 await page.waitForFunction(()=>!document.querySelector('[data-glass-dock]').hasAttribute('data-dragging'));
 assert.equal(page.url(),origin+'/','Cancelled drag must not navigate');
 const other=await dockLinks.nth(3).boundingBox();
 await page.mouse.move(other.x+other.width/2,other.y+other.height/2);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});
 assert.equal(await dock.getAttribute('data-dragging'),'true','A drag may start on a non-current destination');
 await Promise.all([page.waitForURL('**/projects/index.html'),page.mouse.up()]);
 assert.equal(await page.locator('[data-dock-link][aria-current]').count(),1,'Only one current destination after drag navigation');
 await page.locator('[data-dock-link]').first().focus();await page.keyboard.press('Tab');
 assert.equal(await page.locator('[data-dock-link]').nth(1).evaluate(a=>a===document.activeElement),true,'Tab follows real anchor order');
 await page.locator('[data-dock-link]').first().focus();
 await Promise.all([page.waitForURL(origin+'/index.html'),page.keyboard.press('Enter')]);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('[data-dock-link]').nth(2).focus();
 const reduced=await dock.evaluate(node=>{const selected=node.querySelector('[aria-current]').getBoundingClientRect(),rect=node.getBoundingClientRect(),style=getComputedStyle(node.querySelector('[data-dock-lens]'));return {x:parseFloat(style.getPropertyValue('--lens-x')),expected:selected.left-rect.left-node.clientLeft,stretch:parseFloat(style.getPropertyValue('--lens-stretch'))};});
 assert.ok(Math.abs(reduced.x-reduced.expected)<1,'Reduced motion keeps the lens on the current page while keyboard focus moves');assert.equal(reduced.stretch,1);
 await page.emulateMedia({reducedMotion:'no-preference'});
 // A long press must not expose selectable blue labels or accidentally navigate.
 await page.goto(origin+'/');
 const pressBox=await page.locator('[data-dock-link]').first().boundingBox();
 const pressURL=page.url();
 await page.mouse.move(pressBox.x+pressBox.width/2,pressBox.y+pressBox.height/2);
 await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up();
 assert.equal(page.url(),pressURL,'A held dock item must not trigger navigation');
 assert.equal(await dock.locator('span').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).userSelect==='none')),true,'Dock text never selects');
 assert.equal(await page.evaluate(()=>String(getSelection())), '','A held dock item must not select text');
 await page.waitForTimeout(1200);
 await page.evaluate(()=>{
   window.__dockIdleFrames=0;
   const native=window.requestAnimationFrame;
   window.requestAnimationFrame=function(callback){if(callback.name==='tick')window.__dockIdleFrames++;return native.call(this,callback);};
 });
 await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>window.__dockIdleFrames),0,'The settled liquid dock must not consume animation frames');
 for(const width of [320,390,768,1024,1440]){
   await page.setViewportSize({width,height:844});await page.goto(origin+'/');
   const controls=page.locator('[data-glass-dock] [data-dock-item]');
   if(process.env.AUDIT_OUTPUT)await page.screenshot({path:path.join(process.env.AUDIT_OUTPUT,`glass-initial-${width}.png`)});
   const startBox=await controls.first().boundingBox(),endBox=await controls.nth(2).boundingBox();
   await page.evaluate(()=>document.querySelector('[data-glass-dock]').addEventListener('pointerdown',event=>window.__auditPointer=event.pointerId,{once:true}));
   await page.mouse.move(startBox.x+startBox.width/2,startBox.y+startBox.height/2);await page.mouse.down();
   await page.mouse.move(endBox.x+endBox.width/2,endBox.y+endBox.height/2,{steps:12});
   assert.equal(await dock.getAttribute('data-dragging'),'true',`Real dock drag at ${width}px`);
   assert.equal(await dock.locator('[aria-current]').count(),1);
   assert.equal(await dock.locator('[data-active]').count(),1);
   assert.equal(await dock.locator('[data-dock-projection],.glass-dock__projection,.glass-dock__clone').count(),0);
   if(process.env.AUDIT_OUTPUT)await page.screenshot({path:path.join(process.env.AUDIT_OUTPUT,`glass-drag-${width}.png`)});
   await dock.dispatchEvent('pointercancel',{pointerId:await page.evaluate(()=>window.__auditPointer)});await page.mouse.up();
   assert.equal(page.url(),origin+'/',`Cancelled ${width}px drag keeps current page`);
 }
 // Real touch input exercises release behavior after the press animation has settled.
 const touchSession=await context.newCDPSession(page);
 async function touch(x,y,hold=80){
   await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,radiusX:2,radiusY:2,force:1,id:1}]});
   await page.waitForTimeout(hold);
   await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await page.goto(origin+'/');
 const shortPress=await dockLinks.first().boundingBox();
 await touch(shortPress.x+shortPress.width/2,shortPress.y+shortPress.height/2);
 await page.waitForTimeout(700);
 await page.waitForFunction(()=>{const s=getComputedStyle(document.querySelector('[data-dock-lens]'));return Math.abs(parseFloat(s.getPropertyValue('--lens-stretch'))-1)<.002&&Math.abs(parseFloat(s.getPropertyValue('--lens-squash'))-1)<.002;});
 const heldOther=await dockLinks.nth(3).boundingBox(),beforeHold=page.url();
 await touch(heldOther.x+heldOther.width/2,heldOther.y+heldOther.height/2,700);
 await page.waitForTimeout(700);
 assert.equal(page.url(),beforeHold,'A real touch hold on another destination must not navigate');
 await page.waitForFunction(()=>{const s=getComputedStyle(document.querySelector('[data-dock-lens]'));return Math.abs(parseFloat(s.getPropertyValue('--lens-stretch'))-1)<.002&&Math.abs(parseFloat(s.getPropertyValue('--lens-squash'))-1)<.002;});
 const rotateStart=await dockLinks.first().boundingBox(),rotateEnd=await dockLinks.nth(2).boundingBox();
 await page.mouse.move(rotateStart.x+rotateStart.width/2,rotateStart.y+rotateStart.height/2);await page.mouse.down();
 await page.mouse.move(rotateEnd.x+rotateEnd.width/2,rotateEnd.y+rotateEnd.height/2,{steps:8});
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(100);await page.mouse.up();
 await page.waitForTimeout(100);
 assert.equal(await dock.getAttribute('data-dragging'),null,'Rotation cancels an in-flight drag');
 const rotated=await dock.boundingBox();assert.ok(rotated.x>=0&&rotated.x+rotated.width<=844&&rotated.y>=0&&rotated.y+rotated.height<=390,'Rotated dock remains in viewport');
 await page.setViewportSize({width:390,height:844});
 report.interactions.push('real touch short press and 700ms hold release back to rest; rotation cancels drag');
 await context.addInitScript(()=>{
   let incoming;try{incoming=JSON.parse(sessionStorage.getItem('portfolio-dock-handoff-v2'));}catch{}
   if(!incoming)return;
   const observer=new MutationObserver(()=>{
     const lens=document.querySelector('[data-dock-lens]'),dock=document.querySelector('[data-glass-dock]');
     if(!lens||!dock||!Number.isFinite(parseFloat(lens.style.getPropertyValue('--lens-x'))))return;
     const links=[...dock.querySelectorAll('[data-dock-link]')],rect=dock.getBoundingClientRect();
     const xs=links.map(a=>a.getBoundingClientRect().left-rect.left-dock.clientLeft);
     window.__incomingDockFrame={x:parseFloat(lens.style.getPropertyValue('--lens-x')),expected:xs[0]+incoming.fraction*(xs.at(-1)-xs[0]),selected:links.find(a=>a.hasAttribute('aria-current')).getBoundingClientRect().left-rect.left-dock.clientLeft};
     observer.disconnect();
   });observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
 });
 await page.goto(origin+'/');
 await Promise.all([page.waitForURL('**/honor/index.html'),dockLinks.nth(3).click()]);
 const incomingFrame=await page.evaluate(()=>window.__incomingDockFrame);
 assert.ok(incomingFrame,'Cross-page activation supplies a destination animation handoff');
 assert.ok(Math.abs(incomingFrame.x-incomingFrame.expected)<1.5,'The first destination frame continues the departure lens position');
 report.interactions.push('cross-page first-frame lens continuity');

 report.interactions.push('liquid dock: five single-source items, five reachable links, five viewport bounds, real drag, cancellation, one current item, native Tab/Enter, long-press selection prevention, idle animation shutdown and reduced motion');
 await page.goto(origin+'/projects/sprout-patrol/');
 await page.locator('[data-growth-step="2"]').click();
 assert.equal(await page.locator('[data-growth-panel="2"]').isVisible(),true);
 assert.equal(await page.locator('[data-growth-panel="0"]').isVisible(),false);
 report.interactions.push('three-stage growth mechanism');
 await page.goto(origin+'/game/');
 await page.locator('[data-action="start"]').click();
 assert.equal(await page.locator('canvas').first().isVisible(),true);
 await page.locator('#pause').click();
 assert.equal(await page.locator('[data-action="resume"]').isVisible(),true);
 await page.locator('[data-action="resume"]').click();
 await page.locator('#menu').click();
 assert.equal(await page.locator('#settings-dialog').evaluate(e=>e.open),true);
 await page.locator('#settings-resume').click();
 assert.equal(await page.locator('#settings-dialog').evaluate(e=>e.open),false);
 report.interactions.push('game starts, renders, pauses, resumes and opens settings');
 await page.goto(origin+'/honor/');
 await page.locator('[data-image-open]').first().click();
 assert.equal(await page.locator('#image-dialog').evaluate(e=>e.open),true);
 assert.ok((await page.locator('[data-dialog-image]').getAttribute('src')).includes('live-honor'));
 await page.keyboard.press('Escape');
 report.interactions.push('image preview and dismissal');
 await page.goto(origin+'/');
 assert.equal(await page.locator('video').getAttribute('preload'),'none');
 assert.equal(await page.locator('video').evaluate(e=>e.paused),true);
 assert.equal(await page.locator('script[src*="visitor-tracker"],script[src*="visitors."],[data-visitor-count],[data-privacy-toggle]').count(),0,'Visitor analytics is removed');
 const pdf=await page.locator('a[download][href*="resume-"]').first().getAttribute('href');assert.equal((await context.request.get(origin+'/'+pdf)).status(),200);
 report.interactions.push('no automatic media playback; fingerprinted PDF downloads');
 await page.goto(origin+'/contact/');
 assert.equal(await page.locator('main h1').count(),1);
 assert.equal(await page.locator('a[download][href*="resume-"]').count(),1,'Contact has one resume download');
 assert.equal(await page.locator('[data-dock-link][aria-current]').last().textContent(),'联系');
 report.interactions.push('independent contact destination and single resume download');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(origin+'/projects/');
 assert.equal(await page.locator('.reveal-pending').count(),0);
 report.interactions.push('reduced motion keeps all reading content visible');
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const width of [320,390,768,1024,1440]) {
   await page.setViewportSize({width,height:900});
   for(const route of pages) {
     await page.goto(`${origin}/${route}`,{waitUntil:'load'});
     await page.evaluate(()=>document.fonts.ready);
     await page.waitForTimeout(80);
     const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,main:document.querySelectorAll('main').length,h1:[...document.querySelectorAll('h1')].filter(e=>!e.closest('[role="dialog"],dialog')).length,title:document.title,broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src'))}));
     if(metrics.scroll>width+1)failures.push(`${width}px ${route}: horizontal overflow ${metrics.scroll}`);
     if(metrics.main!==1||metrics.h1!==1)failures.push(`${route}: main=${metrics.main}, h1=${metrics.h1}`);
     if(!metrics.title)failures.push(`${route}: empty title`);
     if(metrics.broken.length)failures.push(`${route}: broken images ${metrics.broken.join(',')}`);
     if(!route.startsWith('game/')){
       const captures=await page.locator('main img[src*="garden-current-"]').evaluateAll(images=>images.map(image=>({src:image.getAttribute('src'),official:image.closest('[data-device-frame="ipad"][data-device-model="ipad-pro-2025"]')?.querySelectorAll('.ipad-hardware').length===1,legacy:!!image.closest('.device-frame--tablet,.device-frame__body')})));
       const expectedCaptures={'index.html':1,'projects/index.html':1,'projects/sprout-patrol/index.html':2}[route]||0;
       if(captures.length!==expectedCaptures||captures.some(capture=>!capture.official||capture.legacy))failures.push(`${width}px ${route}: screenshots must use the official 2025 iPad Pro ${JSON.stringify(captures)}`);
     }
     const devices=await page.locator('.device-frame').evaluateAll((frames,asset)=>frames.map(frame=>{
       if(frame.dataset.deviceFrame!=='ipad'||frame.dataset.deviceModel!=='ipad-pro-2025'||frame.querySelectorAll('.ipad-hardware').length!==1)return {invalidDevice:true,kind:frame.dataset.deviceFrame};
       const image=frame.querySelector('.device-frame__screen > img'),screen=frame.querySelector('.device-frame__screen'),base=frame.querySelector('.device-frame__base'),rect=frame.getBoundingClientRect(),r=image.getBoundingClientRect(),hardware=base?.getBoundingClientRect();
       const expected=asset.screenSourceRatio[0]/asset.screenSourceRatio[1];
       let projectionError=0,hardwareError=0,hardwareUnwarped=true;
       if(frame.dataset.deviceFrame==='ipad'){
         const [vx,vy,vw]=asset.viewport,scale=rect.width/vw,points=asset.screenCorners;
         const wanted={left:rect.left+(Math.min(...points.map(p=>p[0]))-vx)*scale,top:rect.top+(Math.min(...points.map(p=>p[1]))-vy)*scale,right:rect.left+(Math.max(...points.map(p=>p[0]))-vx)*scale,bottom:rect.top+(Math.max(...points.map(p=>p[1]))-vy)*scale};
         const actual=screen.getBoundingClientRect();projectionError=Math.max(...Object.keys(wanted).map(k=>Math.abs(actual[k]-wanted[k])));
         const hardwareImage=frame.querySelector('.ipad-hardware'),hardwareRect=hardwareImage.getBoundingClientRect();
         // The photographed surround must retain its crop and proportions on every page.
         const hardwareWanted={left:rect.left-vx*scale,top:rect.top-vy*scale,width:asset.sourceSize[0]*scale,height:asset.sourceSize[1]*scale};
         hardwareError=Math.max(...Object.keys(hardwareWanted).map(key=>Math.abs(hardwareRect[key]-hardwareWanted[key])));
         hardwareUnwarped=getComputedStyle(hardwareImage).transform==='none'&&new URL(hardwareImage.src).pathname.endsWith('/'+asset.asset);
       }
       return {projectionError,hardwareError,hardwareUnwarped,left:rect.left,right:rect.right,ratio:image.offsetWidth/image.offsetHeight,expected,fit:getComputedStyle(image).objectFit,overflow:getComputedStyle(frame.closest('a')||frame).overflow,baseLeft:hardware?.left??0,baseRight:hardware?.right??0};
     }),deviceAsset);
     for(const device of devices)if(device.invalidDevice||device.projectionError>1.5||device.hardwareError>1.5||!device.hardwareUnwarped||device.left< -1||device.right>width+1||device.baseLeft< -1||device.baseRight>width+1||Math.abs(device.ratio-device.expected)>.01||device.fit!=='contain'||device.overflow!=='visible')failures.push(`${width}px ${route}: device surround crops or overflows ${JSON.stringify(device)}`);
     if(!route.startsWith('game/')){
       const shell=await page.evaluate(()=>({dock:document.querySelectorAll('[data-glass-dock]').length,items:document.querySelectorAll('[data-glass-dock] [data-dock-item]').length,links:document.querySelectorAll('[data-glass-dock] a[data-dock-link]').length,search:document.querySelectorAll('[data-search-open]').length,current:document.querySelectorAll('[data-dock-link][aria-current]').length,retired:document.querySelectorAll('header,[data-menu-open],#menu-dialog,.chapter-nav,.reading-progress,script[src*="visitor-tracker"],script[src*="visitors."],[data-visitor-count],[data-privacy-toggle]').length,nav:document.querySelectorAll('nav').length}));
       if(shell.dock!==1||shell.items!==5||shell.links!==5||shell.search!==0||shell.current!==1||shell.retired!==0||shell.nav!==1)failures.push(`${width}px ${route}: invalid unified shell ${JSON.stringify(shell)}`);
       const editorial=await page.evaluate(()=>{
         const main=document.querySelector('main');
         const headings=[...main.querySelectorAll('h1,h2')].map(h=>h.textContent.replace(/\s+/g,'').trim()).filter(Boolean);
         const actions=[...main.querySelectorAll('a.button')].map(a=>`${a.textContent.replace(/\s+/g,'').trim()}|${a.href}`);
         const duplicates=items=>items.filter((value,index)=>items.indexOf(value)!==index);
         const footerBorders=[...document.querySelectorAll('footer,footer .footer-bottom')].filter(node=>{const s=getComputedStyle(node);return parseFloat(s.borderTopWidth)>0||parseFloat(s.borderBottomWidth)>0;}).length;
         return {pdfs:document.querySelectorAll('a[href*="resume"][href*=".pdf"]').length,about:!!document.querySelector('main #about'),contact:new URL(document.querySelector('[data-dock-link]:last-child').href).pathname,headings:duplicates(headings),actions:duplicates(actions),portraits:main.querySelectorAll('img[src*="portrait"]').length,footerBorders};
       });
       const expectedPDFs=route==='index.html'||route==='contact/index.html'?1:0;
       if(editorial.pdfs!==expectedPDFs)failures.push(`${width}px ${route}: resume CTA count ${editorial.pdfs}, expected ${expectedPDFs}`);
       if(editorial.contact!=='/contact/index.html')failures.push(`${route}: contact does not open independent page`);
       if(route==='index.html'&&editorial.about)failures.push('Home retains an embedded contact section');
       if(editorial.headings.length)failures.push(`${route}: repeated main headings ${editorial.headings.join(', ')}`);
       if(editorial.actions.length)failures.push(`${route}: repeated CTA ${editorial.actions.join(', ')}`);
       if(editorial.portraits>1)failures.push(`${route}: repeated portrait images`);
       if(editorial.footerBorders)failures.push(`${width}px ${route}: footer separator borders remain`);
       const dockBounds=await page.locator('[data-glass-dock]').boundingBox();
       if(!dockBounds||dockBounds.x<0||dockBounds.x+dockBounds.width>width+1||dockBounds.y<0||dockBounds.y+dockBounds.height>900)failures.push(`${width}px ${route}: dock outside safe viewport`);
     }
   }
   report.viewports.push({width,pages:pages.length}); console.log(`Verified ${pages.length} pages at ${width}px`);
 }
 await page.setViewportSize({width:390,height:844});
 if(process.env.AUDIT_ACCESSIBILITY==='1') {
   await page.emulateMedia({reducedMotion:'reduce'});
   const routes=['','contact/','projects/','experience/','projects/sprout-patrol/','projects/ai-content/','honor/','updates/','game/guide.html','game/codex.html','game/cloud.html'];
   for(const route of routes){
     await page.goto(origin+'/'+route);
     await auditAccessibility(route);
   }
 }
 const output=process.env.AUDIT_OUTPUT;
 if(output){
   fs.mkdirSync(output,{recursive:true});
   const screenshots=[['','home'],['contact/','contact'],['projects/','projects'],['experience/','experience'],['projects/sprout-patrol/','gamecase'],['projects/ai-content/','ai'],['honor/','honor'],['game/guide.html','guide'],['game/','game']];
   for(const [route,name] of screenshots)for(const width of [320,390,768,1024,1440]){
     await page.setViewportSize({width,height:900});await page.goto(origin+'/'+route);
     await page.evaluate(async()=>{await document.fonts.ready;for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight){scrollTo(0,y);await new Promise(r=>setTimeout(r,40));}await Promise.race([Promise.all([...document.images].map(image=>{image.loading='eager';return image.decode().catch(()=>{});})),new Promise(resolve=>setTimeout(resolve,2000))]);scrollTo(0,0);});
     await page.waitForTimeout(250);
     await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});
   }
 }
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const fallback=await noJS.newPage();await fallback.goto(origin+'/');assert.ok(await fallback.locator('[data-glass-dock]').isVisible());assert.equal(await fallback.locator('[data-dock-link][href]:visible').count(),5);await Promise.all([fallback.waitForURL('**/projects/index.html'),fallback.locator('[data-dock-link]').nth(1).click()]);await fallback.goto(origin+'/projects/sprout-patrol/');assert.equal(await fallback.locator('[data-growth-panel]:visible').count(),3);report.interactions.push('no-JavaScript dock navigation and mechanism fallback');
 failures.push(...new Set(consoleErrors),...new Set(httpErrors));
 report.ok=failures.length===0;
 console.log(JSON.stringify(report,null,2));
 if(output)fs.writeFileSync(path.join(output,'browser-audit.json'),JSON.stringify(report,null,2));
 if(!report.ok)process.exitCode=1;
 } finally {await browser?.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
