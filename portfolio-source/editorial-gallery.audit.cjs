/* Verify that the works gallery leads to live projects and real evidence. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');

module.exports=async function auditGallery(page,origin,output){
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(origin+'/projects/');
  assert.equal(await page.locator('.work-card').count(),3);
  assert.equal(await page.locator('.theme-art,.detail-number,.project-collection').count(),0);
  assert.equal(await page.locator('main img[src*="poster-preview"]').count(),0,'The original poster stays in the evidence disclosure');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Gallery fits '+width);

  const material=await page.locator('.work-event .button.primary').evaluate(el=>({color:getComputedStyle(el).backgroundColor,backdrop:getComputedStyle(el).backdropFilter}));
  assert.equal(material.color,'rgba(0, 0, 0, 0)');
  assert.ok(material.backdrop.includes('blur'),'Actions use the clear material');
  const game=page.locator('.work-feature .work-art').getByRole('img',{name:'萌芽保卫队实际游戏画面'});
  await game.scrollIntoViewIfNeeded();
  assert.ok(await game.evaluate(async img=>{await img.decode();return img.naturalWidth>=1000;}),'The game preview uses its real screen capture');
  assert.match(await page.locator('.work-event .event-preview').textContent(),/19\.9/);
  if(output&&(width===390||width===1440))await page.screenshot({path:path.join(output,'gallery-'+width+'.png'),fullPage:true});
 }
 assert.equal((await page.request.get(origin+'/projects/ai-content/')).status(),404,'The retired works route is out of the release');
 await page.setViewportSize({width:390,height:844});
 await page.goto(origin+'/poster/');
 const disclosure=page.locator('.proof-disclosure'),poster=disclosure.locator('img');
 assert.equal(await poster.isVisible(),false,'Original material is secondary evidence');
 await disclosure.locator('summary').click();
 assert.equal(await poster.isVisible(),true);
 await disclosure.locator('a').click();
 const dialog=page.locator('#image-dialog');
 const close=dialog.getByRole('button',{name:'关闭大图'});
 assert.equal(await dialog.getAttribute('open'),'');
 const position=await close.evaluate(button=>({
  inside:button.getBoundingClientRect().top>=button.closest('dialog').getBoundingClientRect().top,
  absolute:getComputedStyle(button).position==='absolute',
  size:button.offsetWidth,
 }));
 assert.ok(position.inside&&position.absolute&&position.size>=44,'The full-size image has a reachable close control');
 await close.click();
 assert.equal(await dialog.isVisible(),false);
 assert.equal(await disclosure.locator('a').evaluate(el=>document.activeElement===el),true);

 await page.goto(origin+'/');
 await page.locator('[data-studio-tab="field"]').click();
 assert.equal(await page.locator('[data-studio-panel="field"] img').count(),0);
 assert.equal(await page.locator('.event-preview').isVisible(),true);
 await Promise.all([page.waitForURL('**/poster/index.html'),page.locator('[data-studio-panel="field"] .button').click()]);

 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:900});
 await page.goto(origin+'/projects/');
 const art=page.locator('.work-feature .work-art');
 await art.scrollIntoViewIfNeeded();
 const b=await art.boundingBox();
 await page.mouse.move(b.x+b.width*.8,b.y+b.height*.6);
 await page.waitForFunction(()=>parseFloat(document.querySelector('.work-feature .work-art').style.getPropertyValue('--gallery-ry'))>.1);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await art.evaluate(el=>getComputedStyle(el).transform),'none','Reduced motion clears the artwork tilt');
 console.log(JSON.stringify({editorialGallery:true,viewports:4,originalEvidence:true,artMotion:true}));
};
