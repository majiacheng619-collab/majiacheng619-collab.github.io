/* Targeted visual/gesture checks, called by the single portfolio release pass. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function auditGlass(page,origin,output){
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
 const styles = await page.locator('.ambient-field').evaluate(el => getComputedStyle(el).backgroundImage);
 assert.ok(styles.includes('radial-gradient'));
 assert.equal(await page.locator('canvas[data-optical-scene]').count(),0,'Reading surfaces use the static gradient on first load');
 await page.getByRole('button',{name:'控制中心'}).click();
 const modes = ['light','dark','auto'];
 for (const mode of modes) {
  await page.locator('select[data-appearance]').selectOption(mode);
  const theme = await page.locator('html').getAttribute('data-tone');
  assert.equal(theme,mode==='dark'?'dark':'light');
  assert.equal(await page.locator('meta[name=theme-color]').getAttribute('content'),theme==='dark'?'#071625':'#ecf5ff');
 }
 await page.keyboard.press('Escape');
 console.log(JSON.stringify({glassControls:true,realTouch:true,nativeAnchors:true,theme:true}));
};
