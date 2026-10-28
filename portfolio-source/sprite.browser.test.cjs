/* Minimal local search: real records, focus, keyboard, IME and viewport bounds. */
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'_site');
const server=http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
 let args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'];if(process.env.CHROME_HELPER){const {default:c}=await import(process.env.CHROME_HELPER);args=c.args;}
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568}]){
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args});
  const context=await browser.newContext({viewport,isMobile:viewport.width<800,hasTouch:viewport.width<800,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const origin=`http://127.0.0.1:${server.address().port}`;await page.goto(origin);
  const panel=page.locator('.sprite-panel'),input=panel.locator('input'),answer=panel.locator('.sprite-answer');
  await page.locator('.sprite-launcher').click();await panel.waitFor({state:'visible'});
  assert.equal(await input.evaluate(e=>document.activeElement===e),true);
  assert.equal(await panel.locator('button').count(),3,'Only done, clear and search controls exist');
  assert.equal(await panel.locator('[data-sprite-query],[data-sprite-mode],.sprite-suggestions,.sprite-local-ai,.sprite-tabs,.sprite-filters').count(),0,'No mode selectors, AI panel or shortcut destinations');
  assert.equal(await page.locator('.sprite-close').textContent(),'完成');
  assert.ok((await panel.boundingBox()).height<180,'An empty search is compact');
  assert.ok(await page.locator('.sprite-close').evaluate(e=>e.offsetWidth>=44&&e.offsetHeight>=44));
  assert.equal(await panel.locator('button[type="submit"]').isDisabled(),true);
  for(const query of ['学历','毕业院校','教育经厉','學歷']){
   await input.fill(query);await input.press('Enter');await answer.waitFor();
   assert.match(await answer.textContent(),/本科|专科/);
   assert.equal(new URL(page.url()).pathname,'/');
   assert.equal(await panel.locator('.sprite-result').count(),0,'Answer does not duplicate source results');
   const evidence=answer.locator('.sprite-sources');
   assert.equal(await evidence.locator('details,p').count(),0,'Direct source links do not repeat the answer');
   const destinations=await evidence.locator('a').evaluateAll(nodes=>nodes.map(n=>n.href));
   assert.equal(new Set(destinations).size,destinations.length,'Each destination appears once');
   for(const href of await evidence.locator('a').evaluateAll(nodes=>nodes.map(n=>n.href))){const source=new URL(href);assert.equal(source.origin,origin);assert.equal(source.hash,'#education');}
  }
  await input.fill('学历');await input.press('Enter');await answer.waitFor();
  await input.focus();await input.press('ArrowDown');assert.equal(await answer.locator('.sprite-answer-source').first().evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('ArrowUp');assert.equal(await input.evaluate(e=>e===document.activeElement),true);
  await input.fill('那什么时候毕业？');await input.press('Enter');await answer.waitFor();assert.match(await answer.textContent(),/2027/);
  await input.fill('适合什么岗位，会用哪些工具？');await input.press('Enter');await answer.waitFor();
  assert.match(await answer.textContent(),/运营|市场|商务/);assert.match(await answer.textContent(),/Excel|Codex|ChatGPT|Word|Canva/);
  assert.ok(await answer.locator('.sprite-answer-paragraph').evaluateAll(nodes=>nodes.every(node=>node.textContent.length<=181)),'Answer previews stay brief; complete experiences are one tap away');
  await input.fill('简历');await input.press('Enter');await answer.waitFor();
  const resume=new URL(await answer.locator('[data-sprite-action="resume"]').getAttribute('href'));assert.equal(resume.origin,origin);
  const pdf=await context.request.get(resume.href);assert.equal(pdf.status(),200);assert.equal((await pdf.body()).subarray(0,5).toString(),'%PDF-');
  await input.fill('zzzzzzzz不存在');await input.press('Enter');await panel.locator('.sprite-empty').waitFor();
  await input.fill('<svg onload=alert(919191)>');await input.press('Enter');assert.equal(await panel.locator('.sprite-empty').count(),1);assert.equal(await panel.locator('.sprite-results svg').count(),0);
  await page.locator('[data-sprite-clear-input]').click();assert.equal(await input.inputValue(),'');assert.equal(await panel.locator('.sprite-results').textContent(),'');
  assert.equal(await input.evaluate(e=>document.activeElement===e),true);
  await input.evaluate(e=>e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true})));
  await input.fill('电商');await input.press('Enter');assert.equal(await answer.count(),0,'Enter during IME composition does not commit a search');
  await input.evaluate(e=>e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await answer.waitFor();
  await input.press('Enter');assert.match(await answer.textContent(),/288|电商/);
  await input.fill('288');await input.press('Enter');await answer.waitFor();
  assert.ok((await panel.boundingBox()).height<400,'A single tuition fact does not leave a large empty workspace');
  await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.equal(await page.locator('.sprite-launcher').evaluate(e=>document.activeElement===e),true);
  const pageControl=page.locator('a[href]').filter({visible:true}).first();await pageControl.focus();await page.keyboard.press('Control+k');await panel.waitFor({state:'visible'});
  assert.equal(await input.inputValue(),'288');await page.locator('.sprite-close').click();await panel.waitFor({state:'hidden'});assert.equal(await pageControl.evaluate(e=>document.activeElement===e),true);
  await page.locator('.sprite-launcher').click();await pageControl.focus();await panel.waitFor({state:'hidden'});
  assert.equal(await pageControl.evaluate(e=>document.activeElement===e),true,'Returning focus to the page dismisses nonmodal search without stealing focus');
  await page.locator('.sprite-launcher').click();await page.mouse.click(2,Math.max(2,viewport.height-3));await panel.waitFor({state:'hidden'});
  await page.locator('.sprite-launcher').click();
  const rect=await panel.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=viewport.width+1);
  if(viewport.width<800){
   assert.equal(await input.evaluate(e=>getComputedStyle(e).fontSize),'16px');
   await page.evaluate(()=>{const original=visualViewport;window.__viewport=original;Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:240,width:innerWidth,offsetTop:0}});original.dispatchEvent(new Event('resize'));});
   await page.waitForFunction(()=>{const r=document.querySelector('.sprite-form input').getBoundingClientRect();return r.top>=0&&r.bottom<=240;});
   assert.ok(await page.locator('.sprite-close').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=240;}));
   await page.evaluate(()=>{const original=window.__viewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:320,width:innerWidth,offsetTop:80}});original.dispatchEvent(new Event('scroll'));});
   assert.ok(await panel.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=80&&r.bottom<=400;}));
   await page.evaluate(()=>{const original=window.__viewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:original});original.dispatchEvent(new Event('resize'));});
  }
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.sprite-body').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  if(process.env.SPRITE_OUTPUT){fs.mkdirSync(process.env.SPRITE_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.SPRITE_OUTPUT,`sprite-${viewport.width}.png`)});}
  for(const route of ['/experience/','/projects/ai-content/','/contact/']){
   await page.goto(origin+route);await page.locator('.sprite-launcher').click();await input.fill('学历');await input.press('Enter');await answer.waitFor();
   const destination=answer.locator('.sprite-answer-source').first();const target=new URL(await destination.getAttribute('href'));
   assert.equal(target.origin,origin);assert.equal(target.pathname,'/experience/index.html');assert.equal(target.hash,'#education');
   if(route==='/experience/'){
    await destination.click();await page.waitForURL('**/experience/index.html#education');
    await panel.waitFor({state:'hidden'});
    assert.equal(await page.locator('#education').count(),1,'Search arrives directly at the matching experience');
   }
  }
  assert.deepEqual(errors,[]);await browser.close();browser=null;
  console.log(`PASS: local search at ${viewport.width}px`);
 }
 console.log('PASS: compact local search, aliases, grounded answers, direct destinations, compound and follow-up questions, real PDF, focus, IME, keyboard bounds, reduced motion and detail pages.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
