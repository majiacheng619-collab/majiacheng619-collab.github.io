/* Artwork reacts to reading and pointer position; text and native gestures stay put. */
(() => {
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),animations=new Map();
 const artworks=[...document.querySelectorAll('.work-art,.film-collection-cover')];
 let frame=0,pending=null;
 const reset=node=>{
  node.style.setProperty('--gallery-rx','0deg');node.style.setProperty('--gallery-ry','0deg');
  node.style.setProperty('--gallery-light-x','80%');node.style.setProperty('--gallery-light-y','0%');
 };
 for(const art of artworks){
  art.addEventListener('pointermove',event=>{
   if(reduced.matches||document.hidden||event.pointerType!=='mouse')return;
   pending={art,x:event.clientX,y:event.clientY};if(frame)return;
   frame=requestAnimationFrame(()=>{
    frame=0;if(!pending||reduced.matches||document.hidden)return;
    const {art,x,y}=pending,r=art.getBoundingClientRect();
    const nx=Math.max(0,Math.min(1,(x-r.left)/r.width)),ny=Math.max(0,Math.min(1,(y-r.top)/r.height));
    art.style.setProperty('--gallery-rx',((.5-ny)*4).toFixed(2)+'deg');
    art.style.setProperty('--gallery-ry',((nx-.5)*5).toFixed(2)+'deg');
    art.style.setProperty('--gallery-light-x',(nx*100).toFixed(1)+'%');
    art.style.setProperty('--gallery-light-y',(ny*100).toFixed(1)+'%');
   });
  },{passive:true});
  art.addEventListener('pointerleave',()=>{if(pending?.art===art)pending=null;reset(art);},{passive:true});
 }
 const clear=()=>{
  cancelAnimationFrame(frame);frame=0;pending=null;
  for(const animation of animations.values())animation.cancel();animations.clear();artworks.forEach(reset);
 };
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    const node=entry.target;
    if(!entry.isIntersecting){animations.get(node)?.cancel();continue;}
    observer.unobserve(node);
    if(reduced.matches||document.hidden||node.dataset.galleryEntered)continue;
    node.dataset.galleryEntered='true';
    const animation=node.animate([{opacity:.52,translate:'0 22px',scale:.97},{opacity:1,translate:'0 0',scale:1}],{duration:700,easing:'cubic-bezier(.18,.8,.22,1)'});
    animations.set(node,animation);animation.finished.catch(()=>{}).finally(()=>animations.delete(node));
   }
  },{threshold:.16});
  document.querySelectorAll('[data-gallery-reveal]').forEach(node=>observer.observe(node));
 }
 document.querySelectorAll('.proof-disclosure').forEach(details=>{
  details.addEventListener('toggle',()=>{
   const content=details.querySelector('.proof-content');if(!content)return;
   animations.get(content)?.cancel();if(!details.open||reduced.matches)return;
   const animation=content.animate([{opacity:.4,translate:'0 -6px'},{opacity:1,translate:'0 0'}],{duration:240,easing:'ease-out'});
   animations.set(content,animation);animation.finished.catch(()=>{}).finally(()=>animations.delete(content));
  });
 });
 reduced.addEventListener('change',clear);addEventListener('pagehide',clear);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
})();
