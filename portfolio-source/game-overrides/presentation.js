/* 我只在交互发生时更新材质，让战斗循环专注于草坪。 */
(() => {
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const nav=document.querySelector('.gp-nav'),menu=document.querySelector('.gp-menu');
 const isEnglish=()=>document.documentElement.dataset.language==='en';
 function closeMenu(focus=false){if(!nav||!menu)return;nav.classList.remove('gp-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label',isEnglish()?'Open navigation':'展开导航');if(focus)menu.focus();}
 if(nav&&menu){
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';nav.classList.toggle('gp-open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',isEnglish()?(open?'Close navigation':'Open navigation'):(open?'收起导航':'展开导航'));});
  nav.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>closeMenu()));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('gp-open')){e.preventDefault();e.stopImmediatePropagation();closeMenu(true);}},true);
  document.addEventListener('pointerdown',e=>{if(nav.classList.contains('gp-open')&&!nav.contains(e.target))closeMenu();},{passive:true});
  matchMedia('(min-width:761px)').addEventListener('change',e=>{if(e.matches)closeMenu();});
 }
 const targets='button:not(:disabled),.button,.pill,.gp-nav nav a,.book-tabs a';
 function wave(target,x,y){
  if(reduced.matches)return;
  const box=target.getBoundingClientRect();if(!box.width||!box.height)return;
  const node=document.createElement('i');node.className='liquid-wave';node.setAttribute('aria-hidden','true');
  node.style.setProperty('--wave-size',Math.max(box.width,box.height)*1.3+'px');node.style.setProperty('--wave-x',x-box.left+'px');node.style.setProperty('--wave-y',y-box.top+'px');
  target.querySelectorAll('.liquid-wave').forEach(n=>n.remove());target.append(node);
  node.addEventListener('animationend',()=>node.remove(),{once:true});setTimeout(()=>node.remove(),1100);
 }
 document.addEventListener('pointerdown',e=>{const target=e.target.closest(targets);if(target&&e.button===0)wave(target,e.clientX,e.clientY);},{passive:true});
 document.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key)||e.repeat)return;const target=e.target.closest(targets);if(target){const r=target.getBoundingClientRect();wave(target,r.left+r.width/2,r.top+r.height/2);}});
 let pointerFrame=0,pointerTarget=null,point=null;
 document.addEventListener('pointermove',e=>{if(reduced.matches||e.pointerType!=='mouse')return;const target=e.target.closest(targets);if(!target)return;point={x:e.clientX,y:e.clientY};pointerTarget=target;if(pointerFrame)return;pointerFrame=requestAnimationFrame(()=>{pointerFrame=0;if(!pointerTarget?.isConnected)return;const b=pointerTarget.getBoundingClientRect();pointerTarget.classList.add('gp-material');pointerTarget.style.setProperty('--light-x',(point.x-b.left)+'px');pointerTarget.style.setProperty('--light-y',(point.y-b.top)+'px');});},{passive:true});
 let scrollFrame=0;function scrollState(){document.body.classList.toggle('has-scrolled',scrollY>20);}scrollState();
 addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;scrollState();});},{passive:true});
 // 标题卡保持原有游戏按钮与焦点，不复制或接管游戏状态。
 const overlay=document.getElementById('overlay');
 function decorateTitle(){
  const card=overlay?.querySelector('.overlay-card');if(!card||!card.querySelector('h1')||card.classList.contains('gp-title'))return;
  card.classList.add('gp-title');
  const mark=document.createElement('img');mark.className='gp-title-mark';mark.width=72;mark.height=72;mark.alt='';mark.src=document.querySelector('.brand img')?.getAttribute('src')||'favicon.svg';card.prepend(mark);
  const growth=document.createElement('div');growth.className='gp-growth';growth.setAttribute('aria-label',isEnglish()?'Three growth stages':'三个生长阶段');
  [['幼芽','Sprout'],['成株','Mature'],['开花','Bloom']].forEach(([zh,en])=>{const item=document.createElement('span');const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');item.append(dot);const z=document.createElement('span');z.className='zh';z.textContent=zh;const n=document.createElement('span');n.className='en';n.lang='en';n.textContent=en;item.append(z,n);growth.append(item);});
  const action=card.querySelector('[data-action="resume"]');if(action)card.insertBefore(growth,action);
 }
 if(overlay){new MutationObserver(decorateTitle).observe(overlay,{childList:true});decorateTitle();}
 if(!reduced.matches&&'IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting){target.classList.add('gp-enter');observer.unobserve(target);}}),{threshold:.08});document.querySelectorAll('.gp-feature,.guide-step,.gp-info-card,.gp-world,.change-entry').forEach(el=>observer.observe(el));}
 document.addEventListener('gardenlanguage',()=>closeMenu());
})();
