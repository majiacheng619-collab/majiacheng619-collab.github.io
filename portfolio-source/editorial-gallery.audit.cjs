/* A compact visual contract for the new gallery and its preserved evidence. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function auditGallery(page,origin,output){
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.goto(origin+'/projects/');
  assert.equal(await page.locator('.work-card').count(),3);
  assert.equal(await page.locator('.theme-art,.detail-number,.project-collection').count(),0,'Retired cover placeholders cannot return');
  assert.equal(await page.locator('main img[src*="poster-preview"]').count(),0,'Raw event poster is not a portfolio cover');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Gallery fits '+width);
  const material=await page.locator('.work-film .button.primary').evaluate(el=>({color:getComputedStyle(el).backgroundColor,backdrop:getComputedStyle(el).backdropFilter}));
  assert.equal(material.color,'rgba(0, 0, 0, 0)');assert.ok(material.backdrop.includes('blur'),'Actions use the clear material');
  const cover=page.locator('.work-film .work-art img');
  await cover.scrollIntoViewIfNeeded();await cover.evaluate(img=>img.decode());
  assert.ok(await cover.evaluate(img=>img.naturalWidth>=1200),'Cinematic cover is a real high-resolution asset');
  if(width===390||width===1440){
   const height=(await page.locator('.work-film .work-art').boundingBox()).height;
   assert.ok(height<(width===390?210:380),'Cover stays proportionate to the content');
   if(output)await page.screenshot({path:path.join(output,'gallery-'+width+'.png'),fullPage:true});
  }
  await page.goto(origin+'/projects/ai-content/');
  assert.equal(await page.locator('.film-entry').count(),3);
  assert.equal(await page.locator('.theme-art').count(),0);
  assert.equal(await page.locator('.film-entry a[target="_blank"]').count(),3);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(output&&width===390)await page.screenshot({path:path.join(output,'films-390.png'),fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});await page.goto(origin+'/poster/');
 const disclosure=page.locator('.proof-disclosure'),poster=disclosure.locator('img');
 assert.equal(await poster.isVisible(),false,'Original material is secondary evidence');
 await disclosure.locator('summary').click();assert.equal(await poster.isVisible(),true);
 await disclosure.locator('a').click();assert.equal(await page.locator('#image-dialog').getAttribute('open'),'');
 await page.locator('[data-dialog-close]').click();
 await page.goto(origin+'/');
 await page.locator('[data-studio-tab="field"]').click();
 assert.equal(await page.locator('[data-studio-panel="field"] img').count(),0);
 assert.equal(await page.locator('.event-preview').isVisible(),true);
 await page.locator('[data-studio-tab="film"]').click();
 assert.ok((await page.locator('.studio-film-cover img').getAttribute('src')).includes('film-editorial.'));
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:900});
 await page.goto(origin+'/projects/');const art=page.locator('.work-film .work-art');await art.scrollIntoViewIfNeeded();
 const b=await art.boundingBox();await page.mouse.move(b.x+b.width*.8,b.y+b.height*.6);
 await page.waitForFunction(()=>parseFloat(document.querySelector('.work-film .work-art').style.getPropertyValue('--gallery-ry'))>.1);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await art.evaluate(el=>getComputedStyle(el).transform),'none','Reduced motion clears the artwork tilt');
 console.log(JSON.stringify({editorialGallery:true,realCover:true,viewports:4,originalEvidence:true,noPlaceholderArt:true,artMotion:true}));
};
