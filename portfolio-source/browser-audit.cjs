/* Real browser release audit. Usage: NODE_PATH=... node browser-audit.cjs _site */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || '_site');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.vtt':'text/vtt','.mp4':'video/mp4','.pdf':'application/pdf'};
const pages = [];
function walk(folder) { for (const item of fs.readdirSync(folder, {withFileTypes:true})) {const f=path.join(folder,item.name);if(item.isDirectory())walk(f);else if(f.endsWith('.html'))pages.push(path.relative(root,f).split(path.sep).join('/'));} }
walk(root);
const server = http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)&&f!==root){res.writeHead(403);return res.end();}if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 const failures=[],consoleErrors=[],httpErrors=[];
 const report={pages:pages.length,viewports:[],interactions:[],errors:failures};
 try {
 let args=['--no-sandbox'];if(process.env.CHROME_PATH){const {default:c}=await import(process.env.CHROME_HELPER);args=c.args;}
 browser=await chromium.launch({headless:true,args,executablePath:process.env.CHROME_PATH||undefined});
 const context=await browser.newContext({hasTouch:true});
 // QA traffic must not add a visitor to the production statistics.
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 const page=await context.newPage();
 page.on('pageerror',e=>consoleErrors.push(`${page.url()}: ${e.message}`));
 page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)httpErrors.push(`${r.status()} ${r.url()}`);});
 for(const width of [320,390,768,1440]) {
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
   }
   report.viewports.push({width,pages:pages.length}); console.log(`Verified ${pages.length} pages at ${width}px`);
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/');
 await page.locator('[data-menu-open]').click();
 assert.equal(await page.locator('#menu-dialog').evaluate(e=>e.open),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('[data-menu-open]').evaluate(e=>e===document.activeElement),true);
 assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'');
 report.interactions.push('mobile menu, Escape, focus restoration, scroll unlocking');
 await page.locator('[data-search-open]').click();
 for (const query of ['学历','学校','专业','毕业时间','联系方式','Excel','电商','萌芽']) {
   await page.locator('[data-search-input]').fill(query);
   assert.ok(await page.locator('[data-search-item]:visible').count()>0,query+' must have a result');
 }
 await page.locator('[data-search-input]').fill('学历');
 assert.ok((await page.locator('[data-search-item]:visible').first().textContent()).includes('本科'));
 await page.locator('[data-search-item]:visible').first().click();
 assert.ok(page.url().endsWith('/experience/index.html#education'));
 assert.equal(await page.locator('#search-dialog').evaluate(e=>e.open),false);
 await page.locator('[data-search-open]').click();
 await page.locator('[data-search-input]').fill('萌芽');
 assert.ok(await page.locator('[data-search-item]:visible').count()>0);
 await page.locator('[data-search-input]').fill('no-such-project-12345');
 assert.equal(await page.locator('[data-search-item]:visible').count(),0);
 assert.equal(await page.locator('[data-search-empty]').isVisible(),true);
 await page.keyboard.press('Escape');
 await page.keyboard.press('Control+k');
 assert.equal(await page.locator('#search-dialog').evaluate(e=>e.open),true);
 await page.keyboard.press('Escape');
 report.interactions.push('search: eight recruiter queries, education destination, empty state, keyboard shortcut');
 await page.locator('[data-menu-open]').dispatchEvent('pointerdown',{button:0,clientX:350,clientY:30});
 assert.equal(await page.locator('[data-menu-open] .liquid-wave').count(),1);
 report.interactions.push('pointer-generated liquid touch feedback');
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
 await page.goto(origin+'/privacy/');
 const toggle=page.locator('[data-privacy-toggle]');
 await toggle.click();assert.equal(await page.evaluate(()=>localStorage.getItem('mjc-visitor-opt-out')),'1');
 await toggle.click();assert.equal(await page.evaluate(()=>localStorage.getItem('mjc-visitor-opt-out')),'0');
 report.interactions.push('privacy preference persists and toggles');
 await page.goto(origin+'/visitors/');
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('script[src*="visitors."]').count(),1);
 report.interactions.push('private dashboard scripts and noindex metadata');
 await page.goto(origin+'/');
 assert.equal(await page.locator('video').getAttribute('preload'),'none');
 assert.equal(await page.locator('video').evaluate(e=>e.paused),true);
 assert.ok(await page.locator('script[src*="visitor-tracker"]').count());
 const pdf=await page.locator('a[download][href*="resume-"]').first().getAttribute('href');assert.equal((await context.request.get(origin+'/'+pdf)).status(),200);
 report.interactions.push('no automatic media playback; fingerprinted PDF downloads');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(origin+'/projects/');
 assert.equal(await page.locator('.reveal-pending').count(),0);
 report.interactions.push('reduced motion keeps all reading content visible');
 if(process.env.AUDIT_ACCESSIBILITY==='1') {
   const {default:AxeBuilder}=require('@axe-core/playwright');
   await page.emulateMedia({reducedMotion:'reduce'});
   const routes=['','projects/','experience/','projects/sprout-patrol/','projects/ai-content/','honor/','updates/','privacy/','visitors/','game/guide.html','game/codex.html','game/cloud.html'];
   report.accessibility=[];
   for(const route of routes){
     await page.goto(origin+'/'+route);
     const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
     report.accessibility.push({route,violations:result.violations.length});
     for(const v of result.violations)failures.push(`Accessibility ${route}: ${v.id} (${v.nodes.length} elements)`);
   }
 }
 const output=process.env.AUDIT_OUTPUT;
 if(output){fs.mkdirSync(output,{recursive:true});for(const [route,name] of [['','home'],['projects/','projects'],['projects/ai-content/','ai'],['game/guide.html','guide'],['game/','game']])for(const width of [390,1440]){await page.setViewportSize({width,height:900});await page.goto(origin+'/'+route);await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=innerHeight){scrollTo(0,y);await new Promise(r=>setTimeout(r,40));}scrollTo(0,0);});await page.waitForTimeout(250);await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});}}
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const fallback=await noJS.newPage();await fallback.goto(origin+'/');assert.ok(await fallback.locator('.desktop-nav').isVisible());await fallback.goto(origin+'/projects/sprout-patrol/');assert.equal(await fallback.locator('[data-growth-panel]:visible').count(),3);report.interactions.push('no-JavaScript navigation and mechanism fallback');
 failures.push(...new Set(consoleErrors),...new Set(httpErrors));
 report.ok=failures.length===0;
 console.log(JSON.stringify(report,null,2));
 if(output)fs.writeFileSync(path.join(output,'browser-audit.json'),JSON.stringify(report,null,2));
 if(!report.ok)process.exitCode=1;
 } finally {await browser?.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
