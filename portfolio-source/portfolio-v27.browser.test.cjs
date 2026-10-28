/* Portfolio acceptance: responsive reading, native navigation, live material,
 * and byte-for-byte exclusion of the published game. */
'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(process.argv[2] || '_site');
const repo = path.resolve(__dirname, '..');
const baseline = process.env.V27_BASE_REF || 'origin/main';
const output = process.env.V27_REVIEW_OUTPUT;
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript', '.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.vtt':'text/vtt','.mp4':'video/mp4','.pdf':'application/pdf'};
const hash = payload => crypto.createHash('sha256').update(payload).digest('hex');

async function measurePixels(page,first,next){
  return page.evaluate(async ([a,b])=>{
      async function pixels(data){const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}
      const p=await pixels(a),q=await pixels(b);let sum=0,changed=0;
      for(let i=0;i<p.length;i+=4){const r=Math.abs(p[i]-q[i]),g=Math.abs(p[i+1]-q[i+1]),b=Math.abs(p[i+2]-q[i+2]);sum+=r+g+b;if(Math.max(r,g,b)>=5)changed++;}
      return {meanRGBDifference:sum/(p.length/4*3),changedFraction:changed/(p.length/4)};
    },[first.toString('base64'),next.toString('base64')]);
}

function assertGameExcluded() {
  const protectedPaths = ['portfolio-source/game-runtime','portfolio-source/game-overrides','portfolio-source/game_release.py','portfolio-source/liquid-game.css','portfolio-source/water-events.css','portfolio-source/optical-runtime.js'];
  const changed = execFileSync('git',['diff','--name-only',baseline,'--',...protectedPaths],{cwd:repo,encoding:'utf8'}).trim();
  const added = execFileSync('git',['ls-files','--others','--exclude-standard','--',...protectedPaths],{cwd:repo,encoding:'utf8'}).trim();
  assert.equal(changed, '', 'Game implementation must remain unchanged: '+changed);
  assert.equal(added, '', 'No new game implementation files: '+added);
  const archive = execFileSync('git',['show',baseline+':deploy.zip'],{cwd:repo,maxBuffer:64*1024*1024});
  const manifest = JSON.parse(execFileSync('python3',['-c',
    "import io,sys,zipfile,hashlib,json; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('game/') and not n.endswith('/')}))"
  ],{input:archive,maxBuffer:4*1024*1024}));
  const current = {};
  function walk(folder) {
    for (const item of fs.readdirSync(folder,{withFileTypes:true})) {
      const full = path.join(folder,item.name);
      if(item.isDirectory()) walk(full);
      else current[path.relative(root,full).split(path.sep).join('/')] = hash(fs.readFileSync(full));
    }
  }
  walk(path.join(root,'game'));
  assert.deepEqual(current,manifest,'Published game files, cache version and presentation must stay byte-identical');
  return Object.keys(current).length;
}

const server = http.createServer((req,res) => {
  let filename;
  try { filename = path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname)); }
  catch { res.writeHead(400).end(); return; }
  if(filename!==root && !filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename=path.join(filename,'index.html');
  if(!fs.existsSync(filename)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');
  res.end(fs.readFileSync(filename));
});

(async()=>{
  const gameFiles = assertGameExcluded();
  if(output) fs.mkdirSync(output,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:'+server.address().port;
  let browser;
  const errors = [], report = {gameFilesUnchanged:gameFiles,layouts:[],liveMaterial:false,reducedMotion:false,nativeNavigation:false,accessibility:[]};
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
    // The first desktop compositor tile used to turn the pale section below the
    // dark hero black until the first scroll. Read the displayed output rather
    // than the WebGL buffer, which still reported correctly painted pixels.
    const firstPaintContext=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'no-preference'});
    await firstPaintContext.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const firstPaintPage=await firstPaintContext.newPage();
    await firstPaintPage.goto(origin+'/');
    const desktopFirstPaint=[];
    for(const elapsed of [700,1400]) {
      await firstPaintPage.waitForTimeout(700);
      const screenshot=await firstPaintPage.screenshot();
      const samples=await firstPaintPage.evaluate(async data=>{
        const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const context=canvas.getContext('2d');context.drawImage(image,0,0);
        return [[700,850],[10,950]].map(([x,y])=>({x,y,rgb:[...context.getImageData(x,y,1,1).data].slice(0,3)}));
      },screenshot.toString('base64'));
      assert.ok(samples.every(sample=>sample.rgb.every(channel=>channel>180)),'The pale section below the hero stays painted on initial desktop load at '+elapsed+'ms: '+JSON.stringify(samples));
      desktopFirstPaint.push({elapsed,samples});
    }
    report.desktopFirstPaint=desktopFirstPaint;
    await firstPaintContext.close();
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)errors.push(r.status()+' '+r.url());});
    const routes=['','projects/','experience/','projects/ai-content/','projects/sprout-patrol/','poster/','honor/','updates/','contact/'];
    for(const width of [320,390,768,1024,1440]) {
      await page.setViewportSize({width,height:900});
      for(const route of routes) {
        await page.goto(origin+'/'+route);
        await page.evaluate(()=>document.fonts.ready);
        const reading=await page.evaluate(()=>{
          const main=document.querySelector('main');
          const headings=[...main.querySelectorAll('h1,h2')].map(e=>e.textContent.replace(/\s+/g,'').trim());
          const actions=[...main.querySelectorAll('a.button')].map(e=>e.textContent.trim()+'|'+e.getAttribute('href'));
          const duplicate=values=>values.filter((value,index)=>values.indexOf(value)!==index);
          const rect=document.querySelector('[data-glass-dock]').getBoundingClientRect();
          return {width:innerWidth,scroll:document.documentElement.scrollWidth,h1:main.querySelectorAll('h1').length,headings:duplicate(headings),actions:duplicate(actions),dock:{left:rect.left,right:rect.right,bottom:rect.bottom},links:[...document.querySelectorAll('[data-dock-link]')].map(a=>({href:a.getAttribute('href'),height:a.getBoundingClientRect().height})),hidden:[...main.querySelectorAll('h1,h2,h3,p')].filter(e=>getComputedStyle(e).visibility==='hidden'||getComputedStyle(e).opacity==='0').length};
        });
        assert.ok(reading.scroll<=width+1,route+' overflows at '+width);
        assert.equal(reading.h1,1,route+' has one page title');
        assert.deepEqual(reading.headings,[],route+' repeats main headings');
        assert.deepEqual(reading.actions,[],route+' repeats identical CTA');
        assert.equal(reading.hidden,0,route+' reading content must remain visible in reduced motion');
        assert.equal(reading.links.length,5,'Five native destinations remain');
        assert.ok(reading.links.every(a=>a.href&&a.height>=44),'Native navigation has usable targets at '+route+' '+width+': '+JSON.stringify(reading.links));
        assert.ok(reading.dock.left>=-1&&reading.dock.right<=width+1&&reading.dock.bottom<=900,'Dock fits safe viewport');
        if(output&&((route===''&&(width===390||width===1440))||(route==='experience/'&&width===1440)||(route==='contact/'&&width===390))) {
          await page.screenshot({path:path.join(output,(route?route.replaceAll('/','-'):'home')+width+'.png')});
        }
      }
      report.layouts.push({width,pages:routes.length});
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(origin+'/');
    await page.waitForSelector('[data-studio-ready="true"]');
    const previewTabs=page.locator('.studio-tabs').getByRole('tab');
    assert.equal(await previewTabs.count(),3,'Three real work previews');
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});
      for(const key of ['product','film','field']){
        await page.locator('[data-studio-tab="'+key+'"]').click();
        assert.equal(await page.locator('[data-studio-panel="'+key+'"]').isVisible(),true);
        assert.equal(await page.locator('[data-studio-panel]:visible').count(),1);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Every preview fits '+width);
        if(output&&width===390)await page.locator('[data-studio-preview]').screenshot({path:path.join(output,'preview-'+key+'.png')});
      }
    }
    await previewTabs.nth(0).focus();await page.keyboard.press('ArrowRight');
    assert.equal(await previewTabs.nth(1).getAttribute('aria-selected'),'true','Keyboard switches previews');
    assert.equal(await page.locator('#intro-video').evaluate(v=>v.paused),true,'Switching previews never autoplays media');
    assert.equal(await page.locator('[data-play-intro]').count(),0,'The overview uses one native video control surface');
    assert.equal(await page.locator('#intro-video').evaluate(v=>v.controls),true,'The overview retains native playback controls');
    await page.locator('[data-studio-panel="film"] a.button').first().click();
    await page.waitForURL('**/projects/ai-content/index.html');
    assert.equal(await page.locator('main h1').count(),1,'The film preview opens its real case study');
    report.workPreviews=true;
    // The dock must match the actual surface at its position, across orientations.
    await page.goto(origin+'/');
    assert.equal(await page.locator('.era-hero .era-fold').count(),3,'Three authored silk layers');
    for(const viewport of [{width:1440,height:900},{width:390,height:740}]){
      await page.setViewportSize(viewport);
      await page.evaluate(()=>scrollTo(0,0));
      await page.waitForFunction(()=>document.body.dataset.eraDark==='true');
      assert.equal(await page.locator('.era-fold').first().evaluate(e=>getComputedStyle(e).animationName),'none','Silk respects reduced motion');
      await page.evaluate(()=>scrollTo(0,document.querySelector('[data-era-hero]').offsetHeight+100));
      await page.waitForFunction(()=>document.body.dataset.eraDark==='false');
    }
    report.surfaceNavigation=true;

    await page.setViewportSize({width:390,height:844});
    await page.goto(origin+'/');
    await page.emulateMedia({reducedMotion:'no-preference'});
    // The dark opening owns its orbital scene; inspect its visible output separately.
    const heroFirst=await page.locator('[data-era-hero]').screenshot();
    await page.waitForTimeout(1800);
    const heroNext=await page.locator('[data-era-hero]').screenshot();
    const orbitalMotion=await measurePixels(page,heroFirst,heroNext);
    assert.ok(orbitalMotion.meanRGBDifference>=1&&orbitalMotion.changedFraction>=.05,'Orbital opening has visible material movement');
    report.orbitalMotion=orbitalMotion;
    // The shared water material is visible on reading pages, below the dark stage.
    await page.goto(origin+'/contact/');
    const optical=page.locator('[data-optical-scene]');
    await page.waitForSelector('[data-optical-scene="webgl"]',{state:'attached'});
    const start=Number(await optical.getAttribute('data-optical-frames')||0);
    await page.waitForFunction(start=>Number(document.querySelector('[data-optical-scene]').dataset.opticalFrames)>start+2,start);
    await page.waitForFunction(()=>!document.querySelector('main').getAnimations({subtree:true}).some(a=>a.playState==='running'&&a.effect.getTiming().iterations!==Infinity));
    const first=await optical.screenshot();
    const firstClock=Number(await optical.getAttribute('data-optical-seconds'));
    await page.waitForTimeout(1800); // Sample a perceptible interval, not just a different frame.
    const next=await optical.screenshot();
    const clockAdvance=Number(await optical.getAttribute('data-optical-seconds'))-firstClock;
    const visibleMotion=await measurePixels(page,first,next);
    console.log('Visible motion',JSON.stringify({...visibleMotion,clockAdvance}));
    assert.ok(visibleMotion.meanRGBDifference>=2.5&&visibleMotion.changedFraction>=.20,'Background motion must be visibly present within two seconds');
    assert.ok(clockAdvance>=1.5,'Animation clock must follow elapsed time rather than slow with dropped frames');
    report.visibleMotion={...visibleMotion,clockAdvance};
    if(output) {
      fs.writeFileSync(path.join(output,'live-home-first.png'),first);
      fs.writeFileSync(path.join(output,'live-home-next.png'),next);
    }
    const before=Number(await optical.getAttribute('data-optical-inputs')||0);
    await page.evaluate(()=>{
      const options={bubbles:true,isPrimary:true,pointerId:71,pointerType:'touch',button:0,clientX:220,clientY:340};
      document.dispatchEvent(new PointerEvent('pointerdown',options));
      document.dispatchEvent(new PointerEvent('pointerup',options));
    });
    assert.equal(Number(await optical.getAttribute('data-optical-inputs')),before+2,'Contact and release each reach the live material');
    report.liveMaterial=true;
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>{
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
      const c=document.querySelector('[data-optical-scene]'),count=c.dataset.opticalFrames,now=performance.now();
      if(!c.pauseProbe||c.pauseProbe.count!==count){c.pauseProbe={count,since:now};return false;}
      return now-c.pauseProbe.since>=500;
    },undefined,{polling:100});
    const stopped=await optical.getAttribute('data-optical-frames');
    await page.waitForTimeout(250);
    assert.equal(await optical.getAttribute('data-optical-frames'),stopped,'Reduced motion leaves a stationary atmospheric frame');
    await optical.evaluate(c=>{delete c.pauseProbe;});
    report.reducedMotion=true;
    await page.locator('[data-dock-link]').nth(2).focus();
    await Promise.all([page.waitForURL('**/experience/index.html'),page.keyboard.press('Enter')]);
    assert.equal(await page.locator('[data-dock-link][aria-current]').count(),1);
    report.nativeNavigation=true;
    if(process.env.V27_ACCESSIBILITY==='1') {
      const AxeBuilder=require('@axe-core/playwright').default;
      for(const route of ['', 'contact/','experience/']) {
        await page.goto(origin+'/'+route);
        const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],route+' accessibility');
        report.accessibility.push({route,violations:0});
      }
    }
    await page.goto(origin+'/contact/');
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedContact=value;}}}));
    await page.getByRole('button',{name:'复制邮箱',exact:true}).click();
    await page.waitForFunction(()=>window.copiedContact==='19870043434@163.com');
    assert.match(await page.locator('[data-contact-row]').first().textContent(),/已复制到剪贴板/);
    await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('denied');};});
    await page.getByRole('button',{name:'复制手机号',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-copy-status]')[1].textContent.includes('长按'));
    assert.equal(await page.locator('a[href="tel:19870043434"]').count(),1,'Native phone link remains when clipboard is unavailable');
    report.contactCopy=true;
    const fallbackContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
    await fallbackContext.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...options){return type==='webgl'||type==='webgl2'?null:original.call(this,type,...options);};
    });
    const fallbackPage=await fallbackContext.newPage();
    fallbackPage.on('pageerror',e=>errors.push(e.message));
    await fallbackPage.goto(origin+'/contact/');
    await fallbackPage.waitForFunction(()=>document.body.dataset.atmosphereRenderer==='fallback');
    await fallbackPage.waitForFunction(()=>!document.querySelector('main').getAnimations({subtree:true}).some(a=>a.playState==='running'&&a.effect.getTiming().iterations!==Infinity));
    const fallbackFirst=await fallbackPage.screenshot();
    await fallbackPage.waitForTimeout(1800);
    const fallbackNext=await fallbackPage.screenshot();
    const fallbackMotion=await measurePixels(fallbackPage,fallbackFirst,fallbackNext);
    console.log('Fallback motion',JSON.stringify(fallbackMotion));
    if(output){fs.writeFileSync(path.join(output,'fallback-first.png'),fallbackFirst);fs.writeFileSync(path.join(output,'fallback-next.png'),fallbackNext);}
    assert.ok(fallbackMotion.meanRGBDifference>=2&&fallbackMotion.changedFraction>=.15,'CSS fallback keeps visible continuous movement when WebGL is unavailable');
    await fallbackPage.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await fallbackPage.locator('.ambient-field').evaluate(e=>getComputedStyle(e,'::before').animationName),'none','Fallback also respects reduced motion');
    report.fallbackMotion=fallbackMotion;
    await fallbackContext.close();
    assert.deepEqual(errors,[],'No console or local asset errors');
    report.ok=true;
    console.log(JSON.stringify(report,null,2));
    if(output)fs.writeFileSync(path.join(output,'acceptance.json'),JSON.stringify(report,null,2));
  } finally {await browser?.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
