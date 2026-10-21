/* Device geometry regression. Uses real device markup/assets and the complete CSS cascade.
   node portfolio-source/device-frame.browser.test.cjs
   DEVICE_CSS_BASELINE=HEAD demonstrates the original cross-page regression. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const source=__dirname,repo=path.dirname(source);
const styles=['site.css','foundation.css','experience.css','detail-premium.css','home-premium.css','liquid.css','contact.css','device-frame.css','glass-dock.css'];
const css=styles.map(file=>process.env.DEVICE_CSS_BASELINE?execFileSync('git',['show',`${process.env.DEVICE_CSS_BASELINE}:portfolio-source/${file}`],{cwd:repo,encoding:'utf8'}):fs.readFileSync(path.join(source,file),'utf8')).join('\n');
const asset=JSON.parse(fs.readFileSync(path.join(source,'device-asset.json')));
const markup=execFileSync('python3',['-c',`from device_frames import device_frame; print(device_frame('<img src="/assets/garden-current-home.webp" alt="萌芽保卫队" width="1376" height="1032">', 'ipad'))`],{cwd:source,encoding:'utf8'});
const server=http.createServer((req,res)=>{
 const route=new URL(req.url,'http://local').pathname;
 if(route==='/site.css'){res.setHeader('content-type','text/css');return res.end(css);}
 if(route.startsWith('/assets/')){const file=path.join(source,'assets-overrides',path.basename(route));if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('content-type',route.endsWith('.jpg')?'image/jpeg':'image/webp');return res.end(fs.readFileSync(file));}
 const detail=route==='/projects/';
 const body=detail?`<div class="detail-page"><div class="detail-shell"><a class="product-visual device-preview">${markup}</a></div></div>`:`<div class="premium-home"><div class="premium-shell"><a class="premium-game-display device-preview">${markup}</a></div></div>`;
 res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><base href="/"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site.css"></head><body class="${detail?'inner-page':'home-page'}"><main>${body}</main></body></html>`);
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
   for(const route of ['/','/projects/']){
    await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}${route}`);
    await page.locator('.device-frame').evaluate(async frame=>Promise.all([...frame.querySelectorAll('img')].map(img=>img.decode())));
    const actual=await page.locator('.device-frame').evaluate((frame,a)=>{
     const rect=frame.getBoundingClientRect(),photo=frame.querySelector('.ipad-hardware'),screen=frame.querySelector('.device-frame__screen'),image=screen.querySelector('img');
     const p=photo.getBoundingClientRect(),s=screen.getBoundingClientRect(),[vx,vy,vw]=a.viewport,scale=rect.width/vw;
     const wanted={left:rect.left-vx*scale,top:rect.top-vy*scale,width:a.sourceSize[0]*scale,height:a.sourceSize[1]*scale};
     const normalized=box=>[box.left-rect.left,box.top-rect.top,box.width,box.height].map(n=>n/rect.width);
     return {photoError:Math.max(...Object.keys(wanted).map(k=>Math.abs(p[k]-wanted[k]))),photo:normalized(p),screen:normalized(s),src:image.getAttribute('src'),ratio:image.offsetWidth/image.offsetHeight,loaded:photo.naturalWidth===a.sourceSize[0]&&image.naturalWidth>0};
    },asset);
    assert.ok(actual.loaded,`${route} ${width}px loads both real assets`);
    assert.ok(actual.photoError<1.5,`${route} ${width}px hardware must preserve full-source geometry: ${JSON.stringify(actual)}`);
    assert.ok(Math.abs(actual.ratio-4/3)<.01,`${route} ${width}px game capture remains 4:3`);
    snapshots.push(actual);
   }
   assert.equal(snapshots[0].src,snapshots[1].src,'Both pages present the same game capture');
   for(const part of ['photo','screen'])snapshots[0][part].forEach((n,i)=>assert.ok(Math.abs(n-snapshots[1][part][i])<.002,`${width}px ${part} geometry is consistent across pages`));
  }
  console.log('Device frame: matching hardware and screen geometry across home/projects at 5 viewports.');
 }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
