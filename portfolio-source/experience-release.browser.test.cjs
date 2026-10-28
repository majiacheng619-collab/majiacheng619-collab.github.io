/* One release pass: current portfolio content, destinations, input and layout. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(process.argv[2]||'_site');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.vtt':'text/vtt','.pdf':'application/pdf'};
const server=http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
 let args=['--no-sandbox','--enable-unsafe-swiftshader'];
 if(process.env.CHROME_HELPER){const {default:c}=await import(process.env.CHROME_HELPER);args=c.args;}
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,args,headless:true});
 const origin='http://127.0.0.1:'+server.address().port;
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
 const external=[],errors=[],missing=[];
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin===origin||['data:','blob:'].includes(url.protocol))return route.continue();
  external.push(url.href);return route.abort();
 });
 const Axe=process.env.AUDIT_ACCESSIBILITY==='1'?require('@axe-core/playwright').default:null;
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)missing.push(r.url());});
 const routes=['','projects/','experience/','projects/sprout-patrol/','projects/ai-content/','poster/','honor/','updates/','contact/'];
 const screenshot=process.env.AUDIT_OUTPUT;if(screenshot)fs.mkdirSync(screenshot,{recursive:true});
 const scope=process.env.AUDIT_SCOPE||'all';
 const resume=JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8')).resume;
 const digest=file=>require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 assert.equal(digest(resume.file),resume.sha256,'Fingerprint download is the current resume');
 assert.equal(digest('resume.pdf'),resume.sha256,'Stable download alias is the same current resume');
 if(scope==='all'||scope==='companion'){
  for(const width of [320,390,768,1024,1440]){
   await page.setViewportSize({width,height:844});await page.goto(origin);
   const launcher=page.locator('.sprite-launcher');await launcher.waitFor({state:'visible'});
   assert.equal(await page.locator('.sprite-creature').isVisible(),true,'The floating character stays visible at '+width);
   assert.equal(await page.locator('.sprite-search-symbol,.sprite-search-label,.portfolio-toolbar').count(),0);
   const geometry=await page.locator('.sprite').evaluate(node=>{
    const a=node.querySelector('button').getBoundingClientRect(),b=document.querySelector('.glass-dock').getBoundingClientRect();
    return {fixed:getComputedStyle(node).position==='fixed',fits:a.x>=0&&a.right<=innerWidth&&a.y>=0&&a.bottom<=innerHeight,overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top};
   });
   assert.deepEqual(geometry,{fixed:true,fits:true,overlap:false});
   await launcher.click();assert.equal(await page.locator('#sprite-panel').isVisible(),true);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#sprite-panel').hidden);
   assert.equal(await launcher.evaluate(node=>node===document.activeElement),true);
  }
  await page.setViewportSize({width:390,height:844});await page.goto(origin);
  const launcher=page.locator('.sprite-launcher');await launcher.waitFor({state:'visible'});
  const box=await launcher.boundingBox(),touch=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(40-x)*i/8,y:y+(240-y)*i/8}]});
  assert.equal(await page.locator('.sprite').getAttribute('data-dragging'),'','Touch moves the floating character');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok((await launcher.boundingBox()).x<=11,'The character docks at the nearest edge');
  assert.equal(await page.locator('#sprite-panel').isVisible(),false,'Dragging never opens the window');
  await touch.detach();await page.reload();await launcher.waitFor({state:'visible'});
  assert.ok((await launcher.boundingBox()).x<=11,'The dragged position survives navigation');
  if(screenshot){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(screenshot,'floating-sprite-390.png')});}
  await page.evaluate(()=>sessionStorage.removeItem('mjc-sprite-position'));
 }
 if(scope==='all')for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of (width===1024?['']:routes)){
   await page.goto(origin+'/'+route);await page.waitForSelector('.sprite-launcher:not([hidden])');
   assert.equal(await page.locator('main').count(),1);
   assert.equal(await page.locator('h1').count(),1);
   assert.equal(await page.locator('[data-glass-dock]').count(),1);
   assert.equal(await page.locator('.sprite-launcher').count(),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow: '+route+' at '+width);
   const bad=await page.locator('main a').evaluateAll(links=>links.filter(a=>!a.getAttribute('href')||a.getAttribute('href')==='#').length);
   assert.equal(bad,0,'Every action has a destination');
   for(const href of await page.locator('main a[href$=".pdf"]').evaluateAll(nodes=>nodes.map(node=>node.href)))assert.ok(href.endsWith('/'+resume.file),'Every visible resume entry uses the current version');
   if(!route){
    assert.equal(await page.locator('.lens-tabs,.lens-evidence,.hero-command,.studio-contact-band,.orbital-field,.orbital-reticle').count(),0);
    assert.equal(await page.locator('a[href$=".pdf"]').count(),1);
    if(width<=768){
     assert.equal(await page.evaluate(()=>{
      const search=document.querySelector('.sprite-launcher').getBoundingClientRect(),dock=document.querySelector('.glass-dock').getBoundingClientRect();
      return search.left<dock.right&&search.right>dock.left&&search.top<dock.bottom&&search.bottom>dock.top;
     }),false,'Floating character never overlaps navigation');
    }
    const cards=await page.locator('.practice-card').evaluateAll(nodes=>nodes.map(node=>{
      const r=node.getBoundingClientRect(),a=node.querySelector('.practice-link').getBoundingClientRect(),s=getComputedStyle(node);
      return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom-a.bottom,padding:s.padding,border:s.borderRadius};
    }));
    assert.equal(cards.length,4,'Every business uses the shared card');
    for(const card of cards){
      assert.ok(Math.abs(card.w-cards[0].w)<1,'Business widths are equal');
      assert.ok(Math.abs(card.h-cards[0].h)<1,'Business heights are equal');
      assert.ok(Math.abs(card.bottom-cards[0].bottom)<1,'Business actions share the same bottom inset');
      assert.equal(card.padding,cards[0].padding);assert.equal(card.border,cards[0].border);
    }
    if(width<768)assert.ok(cards.every(card=>Math.abs(card.x-cards[0].x)<1),'Mobile card edges align');
    else {assert.ok(Math.abs(cards[0].y-cards[1].y)<1);assert.ok(Math.abs(cards[2].y-cards[3].y)<1);}
    if(width<=1099){
      const items=await page.locator('.glass-dock__link').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
      assert.equal(items.length,5);
      for(const item of items){assert.ok(item.w>=44&&item.h>=44);assert.ok(Math.abs(item.w-items[0].w)<1);assert.ok(Math.abs(item.y-items[0].y)<1);assert.ok(Math.abs(item.h-items[0].h)<1);}
      assert.equal(await page.locator('.sprite-creature').isVisible(),true,'The floating character is visible on phones and tablets');
      assert.equal(await page.locator('.sprite-search-symbol,.sprite-search-label').count(),0,'The character is not replaced by a search icon');
      assert.equal(await page.locator('.sprite').evaluate(node=>getComputedStyle(node).position),'fixed');
      await page.locator('.sprite-launcher').click();
      const panel=await page.locator('#sprite-panel').boundingBox();
      assert.ok(panel.x>=7&&panel.x+panel.width<=width-7,'Search stays in the viewport');
      assert.ok(panel.width>width*.6||panel.width>=600,'Floating window stays independent of the navigation');
      await page.keyboard.press('Escape');
    }
    const tabs=page.locator('[data-studio-tab]');
    await tabs.first().focus();await page.keyboard.press('ArrowRight');
    assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('[data-studio-panel]:visible').count(),1);
    await page.keyboard.press('End');assert.equal(await tabs.nth(2).getAttribute('aria-selected'),'true');
    await page.keyboard.press('Home');
    if(screenshot&&(width===390||width===1440)){
     await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await Promise.all([...document.images].filter(image=>image.loading!=='lazy').map(image=>image.decode().catch(()=>{})));});
     await page.screenshot({path:path.join(screenshot,'home-'+width+'.png')});
     await page.locator('#career-lens').screenshot({path:path.join(screenshot,'practice-'+width+'.png')});
    }
   }
   if(Axe&&width===390&&['','experience/','contact/'].includes(route)){
    const audit=await new Axe({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],'Accessibility: '+route);
   }
   if(route==='contact/'){
    const email=page.locator('.contact-methods a[href^="mailto:"]');
    assert.ok(await email.evaluate(node=>node.getBoundingClientRect().height<=parseFloat(getComputedStyle(node).lineHeight)+1),'Email address never leaves an orphaned character');
   }
   if(route==='experience/'){
    assert.equal(await page.locator('.case-study').count(),7);
    assert.equal(await page.locator('.case-transfer').count(),0);
    const details=page.locator('.case-context').first();await details.locator('summary').click();
    assert.equal(await details.getAttribute('open'),'');
    assert.ok((await details.textContent()).includes('在校学生'));
    await details.locator('summary').click();assert.equal(await details.getAttribute('open'),null);
   }
  }
 }
 if(scope==='all'||scope==='cleanup'){
  for(const [old,anchor] of [['service-work','ecommerce'],['campus-work','printing']]){
   await page.goto(origin+'/projects/index.html#'+old);
   await page.waitForURL('**/experience/index.html#'+anchor);
   assert.equal(await page.locator('#'+anchor).count(),1,'Saved business links reach their complete case');
  }
  await page.goto(origin+'/contact/');
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  for(const value of ['19870043434@163.com','19870043434']){
   const copy=page.locator('[data-copy-value="'+value+'"]');await copy.click();
   await page.waitForFunction(value=>navigator.clipboard.readText().then(text=>text===value),value);
   assert.equal(await copy.textContent(),'已复制');
  }
  await context.clearPermissions();
 }
 if(scope==='all'||scope==='controls')await require('./control-glass.audit.cjs')(page,origin,screenshot);
 if(scope==='all'||scope==='drag')await require('./drag-glass.audit.cjs')(page,origin,screenshot);
 if(scope==='all'||scope==='gallery')await require('./editorial-gallery.audit.cjs')(page,origin,screenshot);
 if(scope!=='controls'&&scope!=='drag'&&scope!=='gallery'){
 await page.setViewportSize({width:390,height:844});await page.goto(origin);
 const launcher=page.locator('.sprite-launcher'),input=page.locator('.sprite-form input');
 await page.keyboard.press('Control+k');await input.waitFor({state:'visible'});
 assert.equal(await input.evaluate(e=>e===document.activeElement),true);
 for(const query of ['学历','那什么时候毕业？','学费是多少','宿舍打印店','电商累计净利润','直播曝光']){
  await input.fill(query);await input.press('Enter');await page.locator('.sprite-answer').waitFor();
  const links=await page.locator('.sprite-answer a').evaluateAll(nodes=>nodes.map(a=>a.href));
  assert.equal(new Set(links).size,links.length,'No repeated destination in a search answer');
  assert.equal(await page.locator('.sprite-sources details').count(),0);
 }
 await input.fill('不存在zzzzzz');await input.press('Enter');await page.locator('.sprite-empty').waitFor();
 await page.locator('[data-sprite-clear-input]').click();assert.equal(await input.inputValue(),'');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#sprite-panel').hidden);
 assert.equal(await launcher.evaluate(e=>e===document.activeElement),true);
 await launcher.click();await input.fill('学历');await input.press('Enter');await page.locator('.sprite-answer-source').first().click();
 await page.waitForURL('**/experience/index.html#education');
 await page.waitForFunction(()=>document.querySelector('#sprite-panel').hidden);
 assert.equal(await page.locator('#education').count(),1);
 await launcher.click();await input.fill('下载简历');await input.press('Enter');await page.locator('.sprite-resume').waitFor();
 assert.ok((await page.locator('.sprite-resume').getAttribute('href')).endsWith('/'+resume.file),'Search download on a page without a PDF button uses the new resume');
 await page.keyboard.press('Escape');
 if(Axe){await launcher.click();await input.fill('学历');await input.press('Enter');await page.locator('.sprite-answer').waitFor();const audit=await new Axe({page}).include('#sprite-panel').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(v=>v.id),[],'Search accessibility');await page.keyboard.press('Escape');}
 assert.deepEqual(external,[],'Portfolio makes no external or AI service requests');
 assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 const fallback=await noJS.newPage();await fallback.goto(origin);
 assert.equal(await fallback.locator('[data-studio-panel]:visible').count(),3,'Works remain readable without scripts');
 assert.equal(await fallback.locator('.sprite-launcher').isVisible(),false);
 assert.equal(await fallback.locator('#career-lens a').count(),4,'Every practice stays reachable without scripts');
 // Printing excludes the floating search without clearing an in-progress query.
 await page.goto(origin);await launcher.click();await input.fill('学历');await input.press('Enter');
 await page.locator('.sprite-answer').waitFor();
 await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('[data-sprite]').isVisible(),false,'Search stays out of print and PDF output');
 assert.equal(await page.locator('main').isVisible(),true);
 assert.equal(await page.locator('[data-studio-panel]:visible').count(),3,'Printed work previews remain readable');
 await page.emulateMedia({media:'screen'});
 assert.equal(await page.locator('#sprite-panel').isVisible(),true,'Returning from print preserves the open search');
 assert.equal(await input.inputValue(),'学历');
 await page.keyboard.press('Escape');
 }
 assert.deepEqual(external,[]);assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,scope,routes:scope==='all'?routes.length:undefined,glassControls:scope!=='search',localSearch:scope!=='controls'&&scope!=='drag'}));
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
