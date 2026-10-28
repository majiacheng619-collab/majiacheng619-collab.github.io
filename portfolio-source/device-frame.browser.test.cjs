/* Every portfolio screenshot uses the same photographed 2025 iPad Pro.
   Exercises home, portfolio overview, gameplay detail and journey detail. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const source=__dirname,repo=path.dirname(source);
const styles=['device-frame.css','glass-dock.css','sprite.css','control-glass.css','water-events.css','portfolio.css'];
const css=styles.map(file=>fs.readFileSync(path.join(source,file),'utf8')).join('\n');
const asset=JSON.parse(fs.readFileSync(path.join(source,'device-asset.json')));
const captures={home:[1376,1032],play:[1376,1032],journey:[974,700]};
const markup=Object.fromEntries(Object.entries(captures).map(([name,[width,height]])=>[name,execFileSync('python3',['-c',`from device_frames import device_frame; print(device_frame('<img src="/assets/garden-current-${name}.webp" alt="萌芽保卫队" width="${width}" height="${height}">'))`],{cwd:source,encoding:'utf8'})]));
const server=http.createServer((req,res)=>{
 const route=new URL(req.url,'http://local').pathname;
 if(route==='/site.css'){res.setHeader('content-type','text/css');return res.end(css);}
 if(route.startsWith('/assets/')){const file=path.join(source,'assets-overrides',path.basename(route));if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('content-type',route.endsWith('.jpg')?'image/jpeg':'image/webp');return res.end(fs.readFileSync(file));}
 let body;
 if(route==='/')body=`<div class="premium-home"><div class="premium-shell"><a class="premium-game-display device-preview">${markup.home}</a></div></div>`;
 else if(route==='/projects/')body=`<div class="detail-page"><div class="detail-shell"><a class="product-visual device-preview">${markup.home}</a></div></div>`;
 else body=`<div class="detail-page detail-game"><section class="detail-game-visual"><div class="detail-shell"><a class="product-visual device-preview">${markup.play}</a></div></section><section class="detail-split" id="journey"><div class="detail-shell"><div class="detail-split-copy"><h2>花园旅程</h2></div><div class="detail-split-media"><a class="product-visual device-preview">${markup.journey}</a></div></div></section></div>`;
 res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><base href="/"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site.css"></head><body class="${route==='/'?'home-page':'inner-page'}"><main>${body}</main></body></html>`);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  let args=['--no-sandbox'];if(process.env.CHROME_HELPER){const {default:c}=await import(process.env.CHROME_HELPER);args=c.args;}
  browser=await chromium.launch({headless:true,args,executablePath:process.env.CHROME_PATH||undefined});
  const page=await browser.newPage();
  for(const width of [320,390,768,1024,1440]){
   const snapshots=[];
   for(const route of ['/','/projects/','/projects/sprout-patrol/']){
    await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}${route}`);
    const frames=page.locator('.device-frame');
    assert.equal(await frames.count(),route.includes('sprout-patrol')?2:1,'All four real screenshot placements are covered');
    await page.locator('.device-frame').evaluateAll(async frames=>Promise.all(frames.flatMap(frame=>[...frame.querySelectorAll('img')].map(img=>img.decode()))));
    for(const frame of await frames.all()){
     assert.equal(await frame.getAttribute('data-device-frame'),'ipad','A generic tablet can never pass the device audit');
     assert.equal(await frame.getAttribute('data-device-model'),'ipad-pro-2025','Each placement explicitly identifies the approved 2025 hardware');
     assert.equal(await frame.locator('.ipad-hardware').count(),1,'One official photograph surrounds each screenshot');
     assert.equal(await frame.locator('.device-frame__body,.device-frame__camera,.device-frame__base').count(),0,'No fabricated hardware remains');
     const actual=await frame.evaluate((frame,a)=>{
      const rect=frame.getBoundingClientRect(),photo=frame.querySelector('.ipad-hardware'),screen=frame.querySelector('.device-frame__screen'),image=screen.querySelector('img');
      const p=photo.getBoundingClientRect(),s=screen.getBoundingClientRect(),[vx,vy,vw]=a.viewport,scale=rect.width/vw;
      const wanted={left:rect.left-vx*scale,top:rect.top-vy*scale,width:a.sourceSize[0]*scale,height:a.sourceSize[1]*scale};
      const points=a.screenCorners,screenWanted={left:rect.left+(Math.min(...points.map(p=>p[0]))-vx)*scale,top:rect.top+(Math.min(...points.map(p=>p[1]))-vy)*scale,right:rect.left+(Math.max(...points.map(p=>p[0]))-vx)*scale,bottom:rect.top+(Math.max(...points.map(p=>p[1]))-vy)*scale};
      const normalized=box=>[box.left-rect.left,box.top-rect.top,box.width,box.height].map(n=>n/rect.width);
      return {photoError:Math.max(...Object.keys(wanted).map(k=>Math.abs(p[k]-wanted[k]))),screenError:Math.max(...Object.keys(screenWanted).map(k=>Math.abs(s[k]-screenWanted[k]))),photo:normalized(p),screen:normalized(s),src:image.getAttribute('src'),photoSrc:photo.getAttribute('src'),ratio:image.offsetWidth/image.offsetHeight,fit:getComputedStyle(image).objectFit,position:getComputedStyle(image).objectPosition,natural:[image.naturalWidth,image.naturalHeight],declared:[Number(image.getAttribute('width')),Number(image.getAttribute('height'))],loaded:photo.naturalWidth===a.sourceSize[0]&&image.naturalWidth>0};
     },asset);
     assert.ok(actual.loaded,`${route} ${width}px loads the original photo and screenshot`);
     assert.ok(actual.photoSrc.endsWith(asset.asset),`${route} uses the official M5 iPad Pro resource`);
     assert.ok(actual.photoError<1.5,`${route} ${width}px photo geometry: ${JSON.stringify(actual)}`);
     assert.ok(actual.screenError<1.5,`${route} ${width}px screenshot matches the photographed display`);
     assert.ok(Math.abs(actual.ratio-4/3)<.01,`${route} ${width}px display remains 4:3`);
     assert.equal(actual.fit,'contain','Every screenshot preserves all of its content without stretching or cropping');
     assert.equal(actual.position,'50% 50%','Different source ratios remain centered in the display');
     assert.deepEqual(actual.natural,actual.declared,'Image dimensions describe the actual source, including the wider journey capture');
     snapshots.push(actual);
    }
   }
   assert.equal(snapshots[0].src,snapshots[1].src,'Home and portfolio overview use the same game capture');
   assert.equal(new Set(snapshots.map(s=>s.src)).size,3,'Home, gameplay and journey captures all receive the same hardware treatment');
   for(const actual of snapshots.slice(1))for(const part of ['photo','screen'])snapshots[0][part].forEach((n,i)=>assert.ok(Math.abs(n-actual[part][i])<.002,`${width}px ${part} geometry matches in every placement`));
  }
  console.log('2025 iPad Pro: all 4 screenshot placements and 3 original capture ratios verified at 5 viewports.');
 }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
