/* Real touch paths must move the lens and activate the destination, not just glow. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function auditDrag(page,origin,output){
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({reducedMotion:'no-preference'});
 const touch=await page.context().newCDPSession(page);
 const start=p=>touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
 const move=async p=>{await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});await page.waitForTimeout(25);};
 const end=()=>touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const cancel=()=>touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 const point=box=>({x:box.x+box.width/2,y:box.y+box.height/2});
 async function prepare(selector){
  const group=page.locator(selector);await group.scrollIntoViewIfNeeded();
  await page.waitForFunction(selector=>document.querySelector(selector)?.hasAttribute('data-control-ready'),selector);
  return group;
 }
 async function trace(group,from,to,release=true){
  const controls=group.locator(':scope > button,:scope > a');
  const a=point(await controls.nth(from).boundingBox()),b=point(await controls.nth(to).boundingBox());
  const initial=await group.locator('.control-lens').evaluate(e=>parseFloat(e.style.getPropertyValue('--control-x')));
  await start(a);
  for(let i=1;i<=8;i++)await move({x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*Math.max(0,i-2)/6});
  assert.equal(await group.getAttribute('data-control-dragging'),'true','Horizontal intent grabs the lens');
  const during=await group.locator('.control-lens').evaluate(e=>parseFloat(e.style.getPropertyValue('--control-x')));
  assert.ok(Math.abs(during-initial)>20,'Lens physically follows the finger before release');
  assert.equal(await controls.nth(to).getAttribute('data-control-preview'),'','Destination previews under the finger');
  if(release)await end();
 }
 await page.goto(origin+'/projects/sprout-patrol/');
 const growth=await prepare('.growth-steps');
 await page.evaluate(()=>{window.__growthClicks=0;document.querySelector('.growth-steps').addEventListener('click',()=>window.__growthClicks++);});
 await trace(growth,0,2);
 await page.waitForFunction(()=>document.querySelector('[data-growth-step="2"]').getAttribute('aria-pressed')==='true');
 assert.equal(await page.locator('[data-growth-panel="2"]').isVisible(),true,'Drag changes the actual growth content');
 assert.equal(await page.evaluate(()=>window.__growthClicks),1,'A drag commits exactly one click');
 await trace(growth,2,0,false);await cancel();
 assert.equal(await page.locator('[data-growth-step="2"]').getAttribute('aria-pressed'),'true','Cancelled drag preserves selection');
 assert.equal(await page.evaluate(()=>window.__growthClicks),1,'Cancellation cannot activate a control');
 // Esc and release outside are independent cancellation paths for a desktop pointer.
 const items=growth.locator('button'),a=point(await items.nth(2).boundingBox()),b=point(await items.first().boundingBox());
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});
 await page.keyboard.press('Escape');await page.mouse.up();
 assert.equal(await items.nth(2).getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>window.__growthClicks),1);
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});
 await page.mouse.move(b.x,b.y+150,{steps:5});await page.mouse.up();
 assert.equal(await items.nth(2).getAttribute('aria-pressed'),'true','Releasing outside returns to the original selection');
 assert.equal(await page.evaluate(()=>window.__growthClicks),1);
 // A vertical swipe starting on a control must still scroll the document.
 await growth.scrollIntoViewIfNeeded();const v=point(await items.nth(1).boundingBox()),scroll=await page.evaluate(()=>scrollY);
 await start(v);for(let i=1;i<=6;i++)await move({x:v.x,y:v.y-i*22});await end();
 await page.waitForTimeout(120);
 assert.ok(await page.evaluate(()=>scrollY)>scroll+25,'Vertical scrolling stays native');
 assert.equal(await items.nth(2).getAttribute('aria-pressed'),'true');
 await page.goto(origin+'/');const studio=await prepare('.studio-tabs');
 await trace(studio,0,2);
 await page.waitForFunction(()=>document.querySelector('[data-studio-tab="field"]').getAttribute('aria-selected')==='true');
 assert.equal(await page.locator('[data-studio-panel="field"]').isVisible(),true,'Drag changes the actual work preview');
 if(output)await page.screenshot({path:path.join(output,'drag-work-selected.png')});
 // Wrapped navigation supports a diagonal path after horizontal intent wins.
 await page.goto(origin+'/experience/#ecommerce');const cases=await prepare('.case-jump');
 await trace(cases,0,5,false);
 assert.ok(page.url().endsWith('#ecommerce'),'Preview never navigates while held');await end();
 await page.waitForURL('**/experience/#digital-work');
 await page.waitForFunction(()=>document.querySelector('.case-jump a[aria-current]')?.getAttribute('href')==='#digital-work');
 assert.equal(await cases.locator('[data-control-preview]').count(),0);
 // Check the bottom navigation too: it must really navigate on touch release.
 const dock=page.locator('[data-glass-dock]'),links=dock.locator('[data-dock-link]');
 const d0=point(await links.nth(2).boundingBox()),d1=point(await links.nth(4).boundingBox());
 await start(d0);for(let i=1;i<=8;i++)await move({x:d0.x+(d1.x-d0.x)*i/8,y:d0.y});
 assert.equal(await dock.getAttribute('data-dragging'),'true');await end();
 await page.waitForURL('**/contact/index.html');
 // Reduced motion keeps direct manipulation functional, including on a narrow phone.
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:844});
 await page.goto(origin+'/');const narrow=await prepare('.studio-tabs');await trace(narrow,0,1);
 await page.waitForFunction(()=>document.querySelector('[data-studio-tab="film"]').getAttribute('aria-selected')==='true');
 assert.equal(await page.locator('[data-studio-panel="film"]').isVisible(),true);
 await touch.detach();
 console.log(JSON.stringify({directTouchDrag:true,releaseCommitsOnce:true,cancelRestores:true,nativeVerticalScroll:true,workPreview:true,wrappedCaseNavigation:true,dockNavigation:true,reducedMotionDrag:true}));
};
