/* Targeted visual/gesture checks, called by the single portfolio release pass. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function auditGlass(page,origin,output){
 const readField=()=>page.locator('[data-optical-scene="webgl"]').evaluate(canvas=>{
  const sample=document.createElement('canvas');sample.width=sample.height=24;
  const ctx=sample.getContext('2d');ctx.drawImage(canvas,0,0,24,24);
  return [...ctx.getImageData(0,0,24,24).data];
 });
 const mean=bytes=>[0,1,2].map(c=>bytes.reduce((sum,v,i)=>sum+(i%4===c?v:0),0)/(bytes.length/4));
 const settle=selector=>page.waitForFunction(selector=>{
  const group=document.querySelector(selector),lens=group?.querySelector('.control-lens');
  const selected=group?.querySelector('[aria-selected="true"],[aria-pressed="true"],[aria-current]');
  if(!lens||!selected||lens.hidden)return false;
  const s=lens.style;
  return Math.abs(parseFloat(s.getPropertyValue('--control-x'))-selected.offsetLeft+group.scrollLeft)<1&&
   Math.abs(parseFloat(s.getPropertyValue('--control-y'))-selected.offsetTop+group.scrollTop)<1&&
   Math.abs(parseFloat(s.getPropertyValue('--control-width'))-selected.offsetWidth)<1;
 },selector);
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'no-preference'});
 if(!process.env.AUDIT_GLASS_FROM){
 await page.goto(origin+'/projects/sprout-patrol/');
 const group=page.locator('.growth-steps');await group.scrollIntoViewIfNeeded();await settle('.growth-steps');
 assert.equal(await group.locator('.control-lens').count(),1);
 assert.equal(await group.locator('button').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','Selected option stays transparent');
 const touch=await page.context().newCDPSession(page);
 const button=group.locator('button').nth(1),box=await button.boundingBox();
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
 // Wait for the visible frame, rather than assuming a loaded CI runner paints within 100 ms.
 await page.waitForFunction(el=>el.getAttribute('data-glass-pressed')==='true'&&Number(getComputedStyle(el,'::after').opacity)>.5&&new DOMMatrixReadOnly(getComputedStyle(el).transform).a<.99,await button.elementHandle(),{timeout:3000});
 assert.equal(await button.getAttribute('data-glass-pressed'),'true','Touch immediately marks the real control');
 const pressed=await button.evaluate(el=>({glow:getComputedStyle(el,'::after').opacity,scale:new DOMMatrixReadOnly(getComputedStyle(el).transform).a}));
 assert.ok(Number(pressed.glow)>.5&&pressed.scale<.99,'Touch produces visible light and compression');
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>document.querySelector('[data-growth-step="1"]').getAttribute('aria-pressed')==='true');
 await settle('.growth-steps');
 assert.equal(await page.locator('[data-growth-panel]:visible').count(),1);
 assert.equal(await page.locator('[data-growth-panel="1"]').isVisible(),true);
 if(output)await page.screenshot({path:path.join(output,'glass-growth-390.png')});
 await touch.detach();
 }
 await page.goto(origin+'/experience/');
 await page.locator('.case-jump a[href="#store"]').click();
 await page.waitForURL('**/experience/#store');
 await page.waitForFunction(()=>document.querySelector('.case-jump a[aria-current]')?.getAttribute('href')==='#store');
 await settle('.case-jump');
 assert.equal(await page.locator('.case-jump a[aria-current]').getAttribute('href'),'#store');
 if(output)await page.screenshot({path:path.join(output,'glass-experience-390.png')});
 for(const width of [320,768,1440]){
  await page.setViewportSize({width,height:900});await settle('.case-jump');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Glass controls fit '+width);
 }
 await page.setViewportSize({width:390,height:844});
 await page.waitForSelector('[data-optical-scene="webgl"]');
 const before=await readField();await page.waitForTimeout(1300);const after=await readField();
 const temporal=before.reduce((sum,v,i)=>sum+(i%4===3?0:Math.abs(v-after[i])),0)/(before.length*.75);
 assert.ok(temporal>.7,'Actual background pixels move: '+temporal.toFixed(2));
 const scene=page.locator('[data-optical-scene="webgl"]');
 const inputs=Number(await scene.getAttribute('data-optical-inputs')||0);
 await page.mouse.move(8,410);await page.mouse.down();
 assert.equal(await page.locator('.surface-touch').getAttribute('data-held'),'');
 await page.waitForFunction(previous=>Number(document.querySelector('[data-optical-scene]').dataset.opticalInputs)>previous,inputs);
 await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('.surface-touch').getAnimations().length>0);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelector('[data-optical-scene]').dataset.opticalMotion==='still');
 const still=await scene.getAttribute('data-optical-seconds');await page.waitForTimeout(160);
 assert.equal(await scene.getAttribute('data-optical-seconds'),still,'Reduced motion is stationary');
 const profiles=[];
 for(const route of ['projects/','experience/','honor/','contact/']){
  await page.goto(origin+'/'+route);await page.waitForSelector('[data-optical-scene="webgl"]');
  profiles.push({name:await page.locator('body').getAttribute('data-atmosphere'),rgb:mean(await readField())});
  if(output)await page.screenshot({path:path.join(output,'scene-'+profiles.at(-1).name+'.png')});
 }
 assert.equal(new Set(profiles.map(p=>p.name)).size,4);
 for(let i=0;i<profiles.length;i++)for(let j=0;j<i;j++){
  const distance=profiles[i].rgb.reduce((sum,c,k)=>sum+Math.abs(c-profiles[j].rgb[k]),0);
  assert.ok(distance>5,'Page atmospheres are visibly distinct: '+profiles[i].name+'/'+profiles[j].name);
 }
 console.log(JSON.stringify({glassControls:true,realTouch:true,nativeAnchors:true,backgroundPixelChange:temporal,pageAtmospheres:profiles}));
};
