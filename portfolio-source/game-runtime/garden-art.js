(function(root){
'use strict';
const E=root.GardenEngine,TAU=Math.PI*2,INK='#304b3d',UI_FONT='-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
const PALETTES={emerald:{sky:'#bddce0',lawn:'#709f54',shadow:'#304d41',light:'#f5e4b2',accent:'#d29362'},noon:{sky:'#87c3db',lawn:'#a8b969',shadow:'#4b623a',light:'#fff0bc',accent:'#cf774b'},velvet:{sky:'#cf9fa9',lawn:'#748a66',shadow:'#3c4855',light:'#eacea0',accent:'#a86271'},eclipse:{sky:'#263544',lawn:'#45685e',shadow:'#101e2b',light:'#e9dcab',accent:'#85a5ad'}};
const ACCESSIBLE={paper:'#f5efd9',ink:'#263e33',muted:'#586954',focus:'#f7dd8a',danger:'#a84337',nightPaper:'#20312e',nightInk:'#f4eed8'};
const LIMITS={high:{ambient:28,effects:120,grass:360,caches:2},low:{ambient:8,effects:36,grass:120,caches:1}};
 let canvasFactory=null,lastAnimationTime=0,renderCounters={frames:0,cacheHits:0,cacheMisses:0,drawnEffects:0};const layerCache=new Map(),unitCache=new Map();let fogSurface=null,fogKey='';
function setCanvasFactory(fn){canvasFactory=typeof fn==='function'?fn:null;layerCache.clear();unitCache.clear();fogSurface=null;fogKey='';}
function surface(w,h){if(canvasFactory)return canvasFactory(w,h);if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(w,h);if(typeof document!=='undefined'&&document.createElement){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}return null;}
function clamp(n,a=0,b=1){return Math.max(a,Math.min(b,Number(n)||0));}
function roleFor(id){if(['sunbud','twinbud','moonbud'].includes(id))return 'economy';if(['wall','ironwall'].includes(id))return 'wall';if(['mine','thorn','boom'].includes(id))return 'trap';if(['wind','root','frost'].includes(id))return 'control';if(['healer','mint','lantern'].includes(id))return 'support';if(['skyreed','storm'].includes(id))return 'air';return 'ranged';}
function poseRig(c,e,kind,time,options={}){const still=options.still,attack=clamp((e.attack||0)/.2),hit=clamp((e.hit||0)/.08),death=clamp(options.death),phase=time*(kind==='enemy'?3.2:1.7)+(e.id||e.x||0)*.17,idle=still?0:Math.sin(phase),pivot=kind==='plant'?30:33;c.translate(e.x,e.y+pivot);c.rotate(still?death*1.35:(kind==='plant'?-attack*.09+idle*.014+hit*.075:-attack*.12+idle*.018-hit*.06)+death*1.35);c.scale(1+(still?0:attack*.07+idle*.008),1-(still?0:attack*.035+idle*.012)-death*.14);c.translate(-e.x,-e.y-pivot);}
function tint(hex,n){const v=parseInt(hex.slice(1),16);return '#'+[v>>16,(v>>8)&255,v&255].map(x=>Math.max(0,Math.min(255,x+n)).toString(16).padStart(2,'0')).join('');}
function material(c,fill,x,y,w,h){if(!c._gardenMaterial||typeof fill!=='string'||!/^#[0-9a-f]{6}$/i.test(fill)||w<13||h<12)return fill;const g=c.createLinearGradient(x,y,x+w*.75,y+h);g.addColorStop(0,tint(fill,28));g.addColorStop(.42,fill);g.addColorStop(1,tint(fill,-24));return g;}
function oval(c,x,y,rx,ry,fill,stroke=INK,lw=2){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);if(fill){c.fillStyle=material(c,fill,x-rx,y-ry,rx*2,ry*2);c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=c._gardenMaterial?lw*.72:lw;c.stroke();}}
function disc(c,x,y,r,fill,stroke=null,lw=2){oval(c,x,y,r,r,fill,stroke,lw);}
function shape(c,pts,fill,stroke=INK,lw=2){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();if(fill){let paint=fill;if(c._gardenMaterial&&typeof fill==='string'&&/^#[0-9a-f]{6}$/i.test(fill)){let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const p of pts){x=Math.min(x,p[0]);y=Math.min(y,p[1]);right=Math.max(right,p[0]);bottom=Math.max(bottom,p[1]);}paint=material(c,fill,x,y,right-x,bottom-y);}c.fillStyle=paint;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=c._gardenMaterial?lw*.72:lw;c.lineJoin='round';c.stroke();}}
function line(c,pts,color=INK,w=2){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.lineCap='round';c.lineJoin='round';c.lineWidth=w;c.strokeStyle=color;c.stroke();}
function box(c,x,y,w,h,r,fill,stroke=INK,lw=2){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
function seedRand(n){return ((Math.sin(n*92.173+19.62)*43758.5453)%1+1)%1;}
function leaf(c,x,y,angle,color='#68a446',scale=1){c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-11,-15,-5,-24,19,-23);c.bezierCurveTo(26,-11,13,0,0,0);c.fillStyle=color;c.fill();c.lineWidth=1.7;c.strokeStyle='#3e6b38';c.stroke();line(c,[[2,-3],[15,-17]],'#487637',1);c.restore();}
function stem(c,h=29){c.beginPath();c.moveTo(0,h);c.quadraticCurveTo(-8,9,0,-7);c.strokeStyle='#3d7338';c.lineWidth=7;c.lineCap='round';c.stroke();c.strokeStyle='#7faf48';c.lineWidth=3;c.stroke();leaf(c,-1,24,-1.3);leaf(c,2,27,.3,'#86b958',.9);}
function plantFace(c,x,y,gap=6,ink='#384a2c',expression='smile'){oval(c,x-gap,y,2.1,3.4,ink,null);oval(c,x+gap,y,2.1,3.4,ink,null);disc(c,x-gap+.6,y-1,.65,'#fff5cc');disc(c,x+gap+.6,y-1,.65,'#fff5cc');c.beginPath();if(expression==='serious'){c.moveTo(x-3,y+7);c.lineTo(x+3,y+7);}else c.arc(x,y+4,3.7,.15,Math.PI-.15);c.strokeStyle=ink;c.lineWidth=1.6;c.stroke();}
function sunflower(c,x,y,scale,time){c.save();c.translate(x,y);c.scale(scale,scale);c.rotate(Math.sin(time*1.5+x)*.045);stem(c);for(let i=0;i<10;i++){const a=i*TAU/10;c.save();c.translate(Math.cos(a)*20,-13+Math.sin(a)*20);c.rotate(a);oval(c,0,0,12,6.5,i%2?'#efb546':'#f7ce66','#ae7d34',1.8);c.restore();}disc(c,0,-13,17,'#c59250','#826c36',2.3);oval(c,-3,-17,11,9,'#e7bd74',null);for(let i=0;i<13;i++){const a=i*2.4,r=8+Math.sin(i)*4;disc(c,Math.cos(a)*r,-13+Math.sin(a)*r,1,'#b47a43');}plantFace(c,1,-13,5,'#604629');oval(c,-10,-5,3.5,2,'#e2a765',null);oval(c,11,-5,3.5,2,'#e2a765',null);c.restore();}
function slinger(c,x,y,scale,time){c.save();c.translate(x,y);c.scale(scale,scale);c.rotate(Math.sin(time*2+x)*.024);stem(c,30);leaf(c,-10,-24,-.7,'#7eac4f',.9);leaf(c,-12,-17,-1.4,'#557c36',.7);oval(c,-2,-10,22,19,'#91b74f','#365b31',2.5);oval(c,-8,-15,13,11,'#b0cc66',null);c.beginPath();c.moveTo(-12,-27);c.quadraticCurveTo(4,-37,16,-20);c.lineTo(8,-17);c.quadraticCurveTo(-2,-25,-12,-27);c.fillStyle='#77883e';c.fill();c.strokeStyle='#365b31';c.lineWidth=2;c.stroke();for(let i=0;i<4;i++)line(c,[[-8+i*5,-27],[-6+i*5,-23]],'#596d32',1);box(c,12,-14,23,16,7,'#6c913b','#365b31',2.4);oval(c,33,-6,5.2,7.5,'#cadba0','#365b31',2);oval(c,34,-6,2.8,4.4,'#314a27',null);oval(c,-6,-12,2.6,4,'#2d4526',null);disc(c,-5,-13.5,.8,'#f8ffcf');line(c,[[-11,-18],[-4,-20]],'#446c31',1.5);line(c,[[-5,0],[3,1]],'#45622d',1.5);c.restore();}
function crystalPetal(c,pts,fill){shape(c,pts,fill,'#447b81',1.7);line(c,[pts[0],pts[2]],'#ecffff66',1.1);}
function plant(c,...args){const previous=c._gardenMaterial;c._gardenMaterial=true;try{return plantCore(c,...args);}finally{c._gardenMaterial=previous;}}
function plantCore(c,type,x,y,time=0,scale=1,hit=0){
 c.save();c.translate(x,y);c.scale(scale,scale);c.lineCap='round';c.lineJoin='round';oval(c,2,31,type==='thorn'?34:26,7,'#254c3726',null);
 if(type==='sunbud')sunflower(c,0,0,1,time);
 else if(type==='twinbud'){line(c,[[0,28],[-10,0]],'#50813f',5);line(c,[[0,28],[12,-10]],'#50813f',5);sunflower(c,-12,0,.75,time);sunflower(c,13,-9,.76,time);}
 else if(type==='seed')slinger(c,0,0,1,time);
 else if(type==='twinseed'){slinger(c,-10,4,.77,time);slinger(c,8,-11,.81,time+.8);}
 else if(type==='wall'||type==='ironwall'){
  const heavy=type==='ironwall';c.rotate(Math.sin(time*1.1+x)*.01);c.beginPath();c.moveTo(-22,23);c.bezierCurveTo(-32,8,-28,-27,-8,-31);c.bezierCurveTo(19,-39,31,-15,27,12);c.quadraticCurveTo(22,30,0,30);c.closePath();c.fillStyle=heavy?'#7d8f6b':'#be9561';c.fill();c.strokeStyle=heavy?'#354b42':'#655236';c.lineWidth=2.8;c.stroke();
  if(heavy){shape(c,[[-22,-24],[-18,-39],[18,-39],[26,-23],[24,19],[0,32],[-25,18]],'#788c80','#354b42',2.4);box(c,-23,-28,47,9,2,'#b1bba0','#354b42',2);box(c,-17,-15,35,36,6,'#94a18a','#455b45',2);line(c,[[0,-13],[0,18]],'#60785e',1.2);for(const xx of [-19,20]){disc(c,xx,-23,2,'#d2d6b7','#526854',1);disc(c,xx,16,2,'#d2d6b7','#526854',1);}leaf(c,-4,-34,-.8,'#93b965',.65);}
  else{oval(c,-7,-8,14,20,'#d5b87c',null);for(const xx of [-17,16]){c.beginPath();c.moveTo(xx,-20);c.quadraticCurveTo(xx*1.4,0,xx,18);c.strokeStyle='#a27b4b';c.lineWidth=1.5;c.stroke();}line(c,[[-2,18],[-1,26]],'#927046',1.3);leaf(c,-3,-30,-.6,'#6d9b4c',.9);leaf(c,0,-31,.8,'#9ac26b',.7);}
  plantFace(c,0,-4,7,heavy?'#2f4135':'#655034','serious');oval(c,-11,4,4,2,heavy?'#b4b493':'#d7a076',null);oval(c,12,4,4,2,heavy?'#b4b493':'#d7a076',null);
 }else if(type==='boom'){
  c.rotate(Math.sin(time*2)*.03);box(c,-12,0,25,31,8,'#f2dfac','#826646',2);c.beginPath();c.moveTo(-32,2);c.bezierCurveTo(-28,-41,23,-45,33,0);c.quadraticCurveTo(6,10,-32,2);c.fillStyle='#ce6550';c.fill();c.strokeStyle='#754539';c.lineWidth=2.6;c.stroke();oval(c,-15,-10,6,4,'#f8d6a4','#b97356',1);oval(c,4,-25,6,4,'#f8d6a4','#b97356',1);oval(c,22,-7,4.5,3,'#f8d6a4','#b97356',1);plantFace(c,0,13,5,'#786044');line(c,[[1,-34],[5,-41],[1,-47]],'#695139',2);disc(c,1,-47,3,'#f5b23c');line(c,[[-1,-53],[-2,-56]],'#eca33a',1);line(c,[[8,-47],[12,-48]],'#eca33a',1);
 }else if(type==='frost'){
  stem(c);crystalPetal(c,[[-23,-7],[-24,-31],[-10,-19],[0,-40],[11,-21],[24,-30],[21,-4],[0,10]],'#8fcbd1');crystalPetal(c,[[-13,-3],[-10,-21],[0,-29],[10,-19],[12,-3],[0,8]],'#d2efea');plantFace(c,0,-5,6,'#396776');oval(c,20,0,5,6,'#c5e8e4','#447b81',1.6);line(c,[[-2,-20],[-2,-13]],'#ffffff',1.4);
 }else if(type==='thorn'){
  c.beginPath();c.moveTo(-33,20);c.bezierCurveTo(-19,8,15,9,33,18);c.quadraticCurveTo(35,31,0,33);c.quadraticCurveTo(-35,33,-33,20);c.fillStyle='#79964e';c.fill();c.strokeStyle='#486434';c.lineWidth=2.5;c.stroke();for(let i=0;i<7;i++){const xx=-27+i*9;shape(c,[[xx-5,22],[xx,-2-(i%3)*5],[xx+4,22]],i%2?'#b0c572':'#93b15b','#466535',1.7);}oval(c,-8,25,2,2.8,'#2f492b',null);oval(c,8,25,2,2.8,'#2f492b',null);
 }else if(type==='ember'){
  stem(c);for(let i=0;i<6;i++){const a=i*TAU/6;c.save();c.translate(0,-11);c.rotate(a);c.beginPath();c.moveTo(0,8);c.bezierCurveTo(-22,-4,-12,-24,0,-31);c.bezierCurveTo(11,-21,19,-6,0,8);c.fillStyle=i%2?'#e88d46':'#f4b365';c.fill();c.strokeStyle='#9b6036';c.lineWidth=1.8;c.stroke();c.restore();}disc(c,0,-11,14,'#f4cf88','#a57844',2);plantFace(c,0,-10,5,'#7e5534');shape(c,[[17,-9],[30,-14],[29,0],[17,2]],'#d98946','#9b6036',1.8);oval(c,28,-6,3.6,5,'#ffe6ac','#9b6036',1.4);
 }else if(type==='healer'){
  stem(c);for(let i=0;i<5;i++){const a=i*TAU/5;c.save();c.translate(0,-12);c.rotate(a);oval(c,0,-16,10,20,i%2?'#bda7d4':'#d2bfde','#81729a',1.7);c.restore();}disc(c,0,-12,14,'#f4e1b1','#9b84a3',2);plantFace(c,0,-11,5,'#615373');shape(c,[[-5,-33],[-5,-41],[1,-38],[7,-42],[7,-33]],'#d3bbdf','#8a75a0',1.4);disc(c,1,-35,2,'#f5e7ab');
 }else if(type==='lobber'){
  leaf(c,-18,24,-1.8,'#87a34c',1.1);leaf(c,12,27,.25,'#719544',1.2);oval(c,0,8,28,24,'#c89447','#725831',2.5);oval(c,-9,6,12,22,'#e2b05d','#a27b3d',1.2);oval(c,9,6,12,22,'#d3a052','#a27b3d',1.2);plantFace(c,-1,9,6,'#6d502b');line(c,[[2,-14],[8,-28],[24,-31]],'#61783b',6);line(c,[[2,-14],[8,-28],[24,-31]],'#96ad58',2);c.beginPath();c.moveTo(15,-34);c.quadraticCurveTo(24,-20,33,-34);c.strokeStyle='#526d36';c.lineWidth=3;c.stroke();oval(c,24,-37,9,7,'#dfb868','#866a36',1.5);line(c,[[24,-43],[22,-48]],'#647a3a',2);leaf(c,-4,-15,-.8,'#749646',.65);
 }else if(type==='wind'){
  stem(c);box(c,-4,-4,8,17,3,'#a79662','#6b7445',1.8);const turn=time*.75;for(let i=0;i<3;i++){c.save();c.translate(0,-17);c.rotate(i*TAU/3+turn);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-23,-7,-21,-35,-7,-30);c.bezierCurveTo(2,-27,11,-13,0,0);c.fillStyle=i%2?'#97baa2':'#b7d0b5';c.fill();c.strokeStyle='#5d8366';c.lineWidth=2;c.stroke();line(c,[[-7,-8],[-12,-22]],'#d7e2c5',1);c.restore();}disc(c,0,-17,7,'#d1b66c','#6b7445',2);plantFace(c,0,-17,2.4,'#67704c');
 }else if(type==='root'){
  c.beginPath();c.moveTo(-9,1);c.bezierCurveTo(-14,10,-27,6,-26,21);c.lineTo(-12,24);c.lineTo(-8,17);c.lineTo(-4,30);c.lineTo(4,26);c.lineTo(6,15);c.lineTo(15,25);c.lineTo(26,19);c.bezierCurveTo(19,8,10,7,10,0);c.closePath();c.fillStyle='#bfaa73';c.fill();c.strokeStyle='#6e7145';c.lineWidth=2.3;c.stroke();oval(c,0,-8,19,20,'#d2bd89','#6e7145',2.3);line(c,[[-10,-2],[-5,2]],'#af9965',1);line(c,[[6,4],[11,1]],'#af9965',1);leaf(c,-1,-25,-.9,'#719646',.95);leaf(c,3,-23,.7,'#95ac53',.8);plantFace(c,0,-9,5,'#706543','serious');line(c,[[-20,21],[-25,28],[-30,26]],'#8d8354',1.5);line(c,[[22,19],[29,25],[32,22]],'#8d8354',1.5);
 }else if(type==='mine'){
  oval(c,0,25,30,8,'#7d7950','#53693b',2);for(let i=0;i<5;i++)shape(c,[[-27+i*13,26],[-23+i*13,14],[-18+i*13,27]],'#84a455','#53693b',1.2);oval(c,0,15,17,15,'#b5b57d','#667344',2);oval(c,-5,11,8,8,'#d2c995',null);box(c,-5,-6,10,12,3,'#8ea55c','#667344',1.7);disc(c,0,-8,4,'#dcb86f','#887447',1.3);plantFace(c,0,14,4,'#636541','serious');
 }else if(type==='lantern'){
  stem(c);line(c,[[0,2],[-9,-16],[-2,-31],[9,-31]],'#708d49',5);line(c,[[0,2],[-9,-16],[-2,-31],[9,-31]],'#97ae60',2);shape(c,[[3,-31],[21,-31],[27,-23],[24,5],[14,13],[3,6],[-1,-18]],'#dfc372','#867541',2.1);shape(c,[[7,-25],[20,-25],[21,2],[13,7],[7,2]],'#f4dc94','#b19c5d',1);line(c,[[3,-22],[25,-22]],'#8d844a',1.2);line(c,[[12,-26],[12,5]],'#d4b36b',1);plantFace(c,15,-9,4,'#8c763e');leaf(c,14,-32,-.6,'#8a9d50',.6);
 }else if(type==='moonbud'){
  stem(c);for(let i=0;i<6;i++){const a=i*TAU/6;c.save();c.translate(0,-11);c.rotate(a);oval(c,0,-15,9,16,i%2?'#bfcbd9':'#d9e0df','#788d9e',1.6);c.restore();}disc(c,0,-11,14,'#ece4bb','#8e9b8b',1.7);disc(c,5,-16,11,'#d9e0df');plantFace(c,-3,-9,4,'#667b78');line(c,[[-17,-34],[-19,-39]],'#d8e2d9',1.2);line(c,[[18,-23],[23,-24]],'#d8e2d9',1.2);
 }else if(type==='skyreed'||type==='storm'){
  const storm=type==='storm';stem(c,30);line(c,[[-13,26],[-16,-12],[-9,-27]],storm?'#5f777b':'#659159',3);line(c,[[12,29],[18,-10],[13,-30]],storm?'#6d8892':'#7a9e61',3);leaf(c,-14,12,-1.4,storm?'#7c9b96':'#93b36b',.65);leaf(c,14,18,.1,storm?'#9cad9f':'#a7bf79',.65);
  if(storm){for(let i=0;i<5;i++){c.save();c.translate(0,-13);c.rotate(i*TAU/5);crystalPetal(c,[[0,9],[-10,-8],[0,-30],[10,-8]],i%2?'#95aec2':'#b4c4d2');c.restore();}disc(c,0,-14,11,'#d9d4af','#798b8f',1.8);shape(c,[[1,-35],[-7,-21],[0,-21],[-4,-8],[8,-24],[2,-24]],'#e4cf78','#a8995d',1.3);plantFace(c,0,-9,4,'#627782');}
  else{oval(c,0,-20,11,21,'#b5bf7d','#5b7a4b',2);line(c,[[-5,-34],[-5,-9]],'#d7daa6',1.2);box(c,-5,-47,11,19,4,'#799d74','#4c7055',1.8);oval(c,.5,-47,5.8,3.5,'#dbe9c3','#4c7055',1.2);oval(c,.5,-48,2.7,1.7,'#45634c',null);plantFace(c,0,-19,4,'#587444');}
  box(c,13,13,14,15,3,storm?'#9caec1':'#bccd91','#637c66',1);line(c,[[20,25],[20,16],[17,19],[20,16],[23,19]],'#3c6150',1.5);
 }else if(type==='mint'){
  stem(c);for(let i=0;i<4;i++){const a=i*TAU/4-.7;c.save();c.translate(0,-9);c.rotate(a);c.beginPath();c.moveTo(0,5);c.lineTo(-11,-3);c.lineTo(-14,-8);c.lineTo(-10,-13);c.lineTo(-14,-17);c.lineTo(-6,-22);c.lineTo(0,-29);c.lineTo(7,-22);c.lineTo(14,-18);c.lineTo(10,-13);c.lineTo(15,-8);c.lineTo(10,-3);c.closePath();c.fillStyle=i%2?'#80af72':'#a4c88f';c.fill();c.strokeStyle='#4d7f4f';c.lineWidth=1.5;c.stroke();line(c,[[0,1],[0,-22]],'#547f4b',1);c.restore();}disc(c,0,-10,13,'#d2dfaa','#679758',1.8);plantFace(c,0,-10,4,'#48744a');shape(c,[[17,11],[27,11],[22,18],[27,18],[16,27],[19,19],[15,19]],'#d7dfb4','#769658',1.2);
 }else if(type==='prism'){
  stem(c);for(let i=0;i<7;i++){const a=i*TAU/7;c.save();c.translate(0,-6);c.rotate(a);crystalPetal(c,[[0,10],[-10,-14],[0,-33],[10,-14]],i%2?'#7fbdac':'#b0d8bd');c.restore();}crystalPetal(c,[[0,-34],[-13,-12],[0,8],[13,-12]],'#d4f4d2');plantFace(c,0,-11,4,'#456d5d');line(c,[[0,-26],[0,-18]],'#fffce5',1.5);
 }
 if(hit>0){c.globalAlpha=.43;oval(c,0,-7,27,27,'#fffdf0',null);}c.restore();
}
function branchForm(c,p,time=0,front=false){
 if(p.stage!=='flower'||!['a','b'].includes(p.branch))return;const type=p.type,a=p.branch==='a',role=roleFor(type);c.save();c.translate(p.x,p.y);const bob=Math.sin(time*1.4+(p.id||0))*.7;
 if(!front){
  if(a){for(let i=0;i<5;i++){const angle=(i-2)*.33;c.save();c.translate(0,-12+bob);c.rotate(angle);leaf(c,-8,-11,-.2,role==='wall'?'#9ba16a':role==='air'?'#a5c0b4':'#b1bc77',1.05);c.restore();}line(c,[[-21,25],[-29,8]],'#657b4c',3);line(c,[[21,25],[29,8]],'#657b4c',3);}
  else{const g=c.createRadialGradient(0,-8,5,0,-8,46);g.addColorStop(0,'#e6ecd800');g.addColorStop(.78,'#c5dfc532');g.addColorStop(1,'#c5dfc500');disc(c,0,-8,46,g);c.strokeStyle='#a8c3ba';c.lineWidth=2;c.beginPath();c.ellipse(0,-7,34,41,0,.22,Math.PI*1.75);c.stroke();line(c,[[-31,7],[-27,21],[-15,32],[0,37],[16,30],[29,18]],'#d5dec58c',1.5);}
  c.restore();return;
 }
 if(a){
  switch(type){
   case 'sunbud':sunflower(c,1,-30,.44,0);break;
   case 'twinbud':sunflower(c,-2,-36,.48,0);leaf(c,-24,0,-1.2,'#c3c36a',.7);leaf(c,19,3,.1,'#c3c36a',.7);break;
   case 'seed':case 'twinseed':line(c,[[9,-14],[11,-33],[24,-35]],'#6d8843',3);box(c,13,-42,20,13,5,'#b2c273','#4c6d3c',1.5);oval(c,31,-35,4,5,'#dce6b0','#4c6d3c',1.2);if(type==='twinseed'){box(c,-8,-53,19,11,4,'#a9bd68','#4c6d3c',1.5);oval(c,9,-47,3,4,'#dce6b0','#4c6d3c',1);}break;
   case 'ember':for(let i=0;i<3;i++)shape(c,[[-22+i*21,-25],[-25+i*21,-40],[-17+i*21,-53],[-12+i*21,-31]],i%2?'#df9d5c':'#edc57b','#a7784c',1.4);break;
   case 'lobber':line(c,[[13,-23],[29,-42],[29,-52]],'#829351',4);oval(c,28,-53,12,9,'#dfb76a','#8a713d',1.5);line(c,[[28,-61],[27,-65]],'#6c834a',2);break;
   case 'thorn':for(let i=0;i<3;i++)shape(c,[[-28+i*28,17],[-24+i*28,-24],[-20+i*28,17]],'#a9bf7c','#57734b',1.6);break;
   case 'frost':for(let i=0;i<3;i++)crystalPetal(c,[[-26+i*26,-14],[-31+i*26,-32],[-22+i*26,-49],[-14+i*26,-29]],'#c6e0dd');break;
   case 'wind':for(const side of[-1,1]){line(c,[[side*11,13],[side*31,-8]],'#789476',2);for(let i=0;i<3;i++){c.save();c.translate(side*31,-9);c.rotate(i*TAU/3+time);oval(c,0,-7,4,8,'#a2c5ae','#688972',1);c.restore();}disc(c,side*31,-9,3,'#dbc68d');}break;
   case 'root':for(let i=0;i<5;i++){c.beginPath();c.moveTo(0,22);c.bezierCurveTo(-32+i*16,15,-36+i*18,34,-39+i*19,34);c.strokeStyle='#b5a877';c.lineWidth=3;c.stroke();}break;
   case 'wall':for(const side of[-1,1]){line(c,[[side*16,-20],[side*23,-38]],'#83794b',3);shape(c,[[side*20,-29],[side*29,-37],[side*23,-25]],'#a3ae6b','#627449',1.3);}leaf(c,-4,-35,-.5,'#bcc784',1);break;
   case 'ironwall':shape(c,[[-25,-26],[-25,-44],[-15,-44],[-15,-38],[-5,-38],[-5,-47],[5,-47],[5,-38],[15,-38],[15,-44],[25,-44],[25,-26]],'#a5b29a','#536b56',1.8);break;
   case 'boom':for(const side of[-1,1]){box(c,side*24-4,4,8,15,3,'#eddbb1','#927257',1);oval(c,side*24,0,12,9,'#c6755f','#8b5345',1.4);disc(c,side*24-3,-3,2,'#ebd0ac');}break;
   case 'mine':for(const side of[-1,1])shape(c,[[side*14,23],[side*23,-11],[side*31,24]],'#b0b986','#647752',1.7);line(c,[[0,-8],[0,-28]],'#81975c',2);shape(c,[[0,-27],[14,-25],[9,-17],[0,-18]],'#d5c79d','#7d8961',1);break;
   case 'lantern':for(const side of[-1,1]){line(c,[[0,-29],[side*28,-37],[side*28,-23]],'#7c9058',2);box(c,side*28-6,-23,12,20,4,'#ebd694','#988752',1.2);line(c,[[side*28,-20],[side*28,-6]],'#f6e7b6',2);}break;
   case 'moonbud':shape(c,[[-17,-40],[-10,-46],[-6,-54],[-1,-46],[7,-40],[0,-36],[0,-27],[-7,-33],[-17,-30],[-13,-38]],'#e6dfb8','#8c9e98',1.3);disc(c,23,-30,3,'#e9e4c4');break;
   case 'skyreed':for(const side of[-1,1]){line(c,[[side*15,-3],[side*24,-30]],'#789777',2);box(c,side*24-4,-47,8,20,3,'#97b198','#637f6b',1.4);oval(c,side*24,-47,4,2.5,'#d5e1bb','#637f6b',1);}break;
   case 'storm':line(c,[[-18,-28],[-25,-49],[-12,-43],[-18,-56]],'#dac78f',2.6);line(c,[[17,-29],[25,-52],[15,-47],[22,-61]],'#dac78f',2.6);break;
   case 'healer':for(const side of[-1,1]){line(c,[[0,15],[side*26,-15]],'#769770',2);for(let i=0;i<5;i++)oval(c,side*26+Math.cos(i*TAU/5)*6,-15+Math.sin(i*TAU/5)*6,4,6,'#d1bfd6','#95829e',1);disc(c,side*26,-15,4,'#eddcb0');}break;
   case 'mint':leaf(c,-25,9,-1.5,'#abc695',1.05);leaf(c,21,11,.3,'#abc695',1.05);leaf(c,-4,-27,-.6,'#8faf86',.85);break;
  }
 }else{
  switch(type){
   case 'sunbud':case 'twinbud':for(let i=0;i<7;i++){const a=i*TAU/7+time*.08;oval(c,Math.cos(a)*36,-11+Math.sin(a)*35,3.8,6,'#e9d899aa','#afab72',1);}if(type==='twinbud')line(c,[[-26,-37],[0,-47],[26,-37]],'#e6d5a7',1.4);break;
   case 'seed':case 'twinseed':shape(c,[[16,-31],[34,-22],[37,4],[23,16],[12,8]],'#bcd7b057','#80a089',1.7);line(c,[[27,-18],[31,-6],[25,9]],'#eff0cc',1.4);if(type==='twinseed')shape(c,[[-24,-26],[-12,-36],[-3,-21],[-15,-9]],'#bddbc957','#80a089',1.5);break;
   case 'ember':shape(c,[[0,-48],[27,-31],[35,-4],[23,24],[0,33],[-26,18],[-32,-9],[-20,-35]],'#e1ad6c22','#d0ad7a',1.5);for(const side of[-1,1])shape(c,[[side*26,1],[side*38,-7],[side*30,16]],'#f0d49e88','#c9a76f',1);break;
   case 'lobber':c.beginPath();c.ellipse(0,8,34,30,0,.1,Math.PI*1.5);c.strokeStyle='#d9cda0';c.lineWidth=3;c.stroke();oval(c,29,-32,8,5,'#ead7a633','#beaa73',1.4);oval(c,-29,-20,6,9,'#ead7a633','#beaa73',1.4);break;
   case 'thorn':shape(c,[[-38,16],[-29,5],[29,5],[38,16],[33,32],[-33,32]],'#c1d3b03d','#8aa589',1.5);line(c,[[-31,25],[30,25]],'#d9e2c4',1.2);break;
   case 'frost':for(const side of[-1,1])crystalPetal(c,[[side*25,-13],[side*36,-33],[side*28,-44],[side*20,-27]],'#c1dfde66');line(c,[[-32,11],[0,30],[30,10]],'#d5e6df',1.6);break;
   case 'wind':for(const side of[-1,1]){c.beginPath();c.moveTo(side*24,-34);c.bezierCurveTo(side*46,-18,side*43,4,side*27,23);c.strokeStyle='#cbded0';c.lineWidth=3;c.stroke();line(c,[[side*27,23],[side*37,29],[side*27,23],[side*20,30]],'#cbded0',1.6);}break;
   case 'root':c.beginPath();c.ellipse(0,21,36,14,0,0,TAU);c.strokeStyle='#c5c29a';c.lineWidth=3;c.stroke();for(const side of[-1,1])leaf(c,side*21,20,side<0?-1.5:.35,'#bdcaa18a',1.05);break;
   case 'wall':case 'ironwall':for(const side of[-1,1])shape(c,[[side*23,-17],[side*39,-10],[side*35,17],[side*24,29],[side*17,9]],'#b6ccb056','#7c9981',1.8);if(type==='ironwall')shape(c,[[-12,-39],[0,-54],[13,-38],[0,-28]],'#d5e4c944','#94afa4',1.6);break;
   case 'boom':c.beginPath();c.ellipse(0,-4,37,42,0,.23,Math.PI*1.85);c.strokeStyle='#e5caa0';c.lineWidth=2.1;c.stroke();for(let i=0;i<3;i++)disc(c,-19+i*19,-44-(i%2)*9,4,'#ead8b166','#b69c73',1);break;
   case 'mine':for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,22,28+i*8,8+i*3,0,0,TAU);c.strokeStyle='#c4d6b2';c.lineWidth=1.4;c.stroke();}disc(c,0,-17,6,'#d9e4be44','#9daa7e',1.3);break;
   case 'lantern':for(let i=0;i<8;i++){const a=i*TAU/8;line(c,[[12+Math.cos(a)*23,-10+Math.sin(a)*26],[12+Math.cos(a)*32,-10+Math.sin(a)*34]],'#eadba9',1.7);}shape(c,[[12,-45],[34,-27],[35,3],[13,21],[-9,3],[-9,-25]],'#e3dba622','#c2b67a',1.2);break;
   case 'moonbud':c.beginPath();c.ellipse(0,-10,41,25,-.4,0,TAU);c.strokeStyle='#cfded7';c.lineWidth=1.8;c.stroke();disc(c,34,-30,4,'#e8e6c8');shape(c,[[-29,-29],[-32,-37],[-35,-30],[-43,-27],[-35,-25],[-32,-17],[-29,-25],[-22,-27]],'#dae7dfaa','#97b4ab',1);break;
   case 'skyreed':for(const side of[-1,1]){c.beginPath();c.ellipse(side*19,-27,9,17,side*.3,0,TAU);c.strokeStyle='#d0e2cb';c.lineWidth=2;c.stroke();}line(c,[[-22,16],[0,32],[23,15]],'#c1d7b7',1.8);break;
   case 'storm':shape(c,[[0,-52],[31,-27],[34,9],[0,31],[-33,10],[-31,-25]],'#b7cee838','#94b2bc',1.7);disc(c,0,-17,31,null,'#d1dbd2',1.2);line(c,[[-27,12],[-18,27],[-5,35]],'#c4d9d0',1.4);break;
   case 'healer':c.beginPath();c.moveTo(-30,9);c.bezierCurveTo(-43,-21,-19,-42,0,-26);c.bezierCurveTo(17,-43,43,-22,30,8);c.strokeStyle='#d9c7dc';c.lineWidth=2;c.stroke();for(const side of[-1,1])oval(c,side*29,13,8,11,'#d9c7dc44','#b4a0bf',1.3);break;
   case 'mint':c.beginPath();c.moveTo(0,-6);c.bezierCurveTo(-43,-34,-43,19,0,-6);c.bezierCurveTo(43,-34,43,19,0,-6);c.strokeStyle='#bcd4b4';c.lineWidth=2.2;c.stroke();shape(c,[[-15,23],[0,36],[15,23],[0,17]],'#d1dec066','#91ad89',1.3);break;
  }
 }
 c.restore();
}
function hand(c,x,y,angle,skin){c.save();c.translate(x,y);c.rotate(angle);shape(c,[[0,-4],[-10,-5],[-16,-1],[-18,2],[-12,1],[-17,5],[-12,5],[-15,8],[-8,7],[-5,10],[0,6]],skin,'#405542',1.5);line(c,[[-9,0],[-13,2]],'#637955',1);c.restore();}
function zombieHead(c,skin,coat,type,motion){
 c.save();c.translate(-3,-28);c.rotate(-.075+Math.sin(motion*2)*.025);oval(c,-.5,0,18.5,21,skin,'#405542',2.5);oval(c,5,-8,12,12,tint(skin,18),null);oval(c,17,-1,4,6,skin,'#405542',1.5);line(c,[[16,-4],[15,0]],'#668062',1);
 shape(c,[[-17,-7],[-21,-4],[-21,1],[-15,3]],skin,'#405542',1.7);oval(c,-11,-4,6,7,'#eeeacb','#627260',1.3);oval(c,3,-5,6.6,7.5,'#f6efce','#627260',1.3);oval(c,-13,-3,2.1,3.4,'#313d2d',null);oval(c,1,-4,2.3,3.6,'#313d2d',null);line(c,[[-16,-13],[-7,-15]],'#3e5039',2);line(c,[[0,-16],[10,-12]],'#3e5039',2);shape(c,[[-9,5],[-14,12],[-4,15],[7,12],[8,7]],'#556742','#405542',1.5);box(c,-9,6,15,5,1,'#f4edd2','#62735a',1);line(c,[[-4,6],[-4,11],[1,6],[1,11]],'#7d8666',1);line(c,[[-3,1],[-6,4]],'#5a7452',1.4);line(c,[[7,17],[12,14]],'#71966f',1);
 if(type==='moss'||type==='healer'||type==='brute')shape(c,[[-17,-13],[-16,-22],[-10,-24],[-7,-20],[-3,-23],[3,-20],[8,-20],[12,-14],[6,-17],[-2,-17],[-6,-19],[-11,-16]],'#56644b',null);
 if(type==='dash'){shape(c,[[-18,-14],[-19,-24],[8,-25],[16,-17]],'#a74e40','#713e35',2);box(c,-4,-22,23,6,2,'#c16a49','#713e35',1.4);line(c,[[-13,-21],[-6,-22]],'#e0a15f',1.3);}
 if(type==='tank'||type==='boss'){shape(c,[[-22,-11],[-19,-29],[15,-30],[22,-13]],'#9a9d8d','#505b4d',2.6);box(c,-24,-14,49,7,2,'#bfc2a6','#505b4d',2);line(c,[[-13,-27],[-13,-18]],'#d4d6bd',2);line(c,[[15,-27],[16,-18]],'#737d68',1.7);box(c,18,-26,15,7,3,'#8f9883','#505b4d',1.5);}
 if(type==='leap'){box(c,-19,-17,39,6,2,'#c89262','#7d6040',1.8);shape(c,[[18,-17],[29,-12],[25,-6],[17,-10]],'#c89262','#7d6040',1.4);}
 if(type==='healer'){box(c,-16,1,30,12,3,'#d8d5b4','#758570',1.3);line(c,[[-16,5],[-22,0]],'#a2ab8a',1.1);line(c,[[14,5],[19,0]],'#a2ab8a',1.1);line(c,[[-7,4],[7,4]],'#b7baa0',1);}
 if(type==='summoner'){c.beginPath();c.moveTo(-26,-13);c.quadraticCurveTo(-23,-35,-4,-37);c.quadraticCurveTo(18,-36,26,-13);c.quadraticCurveTo(0,-4,-26,-13);c.fillStyle='#8a647c';c.fill();c.strokeStyle='#514750';c.lineWidth=2;c.stroke();oval(c,-13,-21,4.5,3,'#c6a788',null);oval(c,5,-29,5,3.5,'#c6a788',null);oval(c,18,-17,3,2,'#c6a788',null);}
 if(type==='boss'){shape(c,[[-20,-30],[-24,-45],[-13,-40],[-7,-53],[2,-43],[12,-51],[17,-36],[23,-40],[20,-30]],'#c1a04d','#655b39',2.3);disc(c,-6,-40,3,'#8e5147','#5e5238',1);}
 if(type==='push'){shape(c,[[-21,-13],[-20,-25],[-10,-31],[11,-31],[20,-25],[21,-13]],'#c49b53','#776b42',2);box(c,-24,-15,48,6,2,'#ddbb75','#776b42',1.4);line(c,[[0,-29],[0,-16]],'#edd698',2.2);}
 if(type==='burrow'){shape(c,[[-20,-12],[-17,-25],[13,-27],[22,-12]],'#778878','#435847',2);box(c,-22,-14,46,6,2,'#98aa8f','#435847',1.5);box(c,-7,-23,13,10,3,'#d7c482','#758068',1.4);disc(c,0,-18,3.5,'#f1df99','#a09a6c',1);}
 if(type==='boss_morning'){oval(c,0,-22,34,7,'#c6b06d','#7e7444',2);shape(c,[[-20,-25],[-12,-39],[16,-40],[23,-25]],'#d5bd77','#7e7444',2);box(c,-19,-28,40,5,1,'#78905c','#6a7b49',1);line(c,[[-7,-37],[-11,-27]],'#ece0a0',1);}
 if(type==='boss_noon'){shape(c,[[-23,-12],[-20,-34],[-9,-39],[14,-35],[23,-13]],'#917d64','#565845',2.4);box(c,-26,-15,53,7,2,'#bd9b70','#565845',1.8);for(let i=0;i<4;i++)line(c,[[9+i*3,-28],[9+i*3,-21]],'#4d5544',1.6);box(c,-23,-7,16,12,3,'#c5b398','#6b735c',1.4);box(c,-5,-8,17,12,3,'#c5b398','#6b735c',1.4);line(c,[[-8,-4],[-5,-4]],'#6b735c',2);}
 if(type==='boss_dusk'){c.beginPath();c.moveTo(-25,-13);c.lineTo(-6,-46);c.lineTo(21,-24);c.lineTo(27,-13);c.quadraticCurveTo(0,-5,-25,-13);c.fillStyle='#6b576e';c.fill();c.strokeStyle='#47424d';c.lineWidth=2;c.stroke();shape(c,[[-8,-30],[-2,-37],[5,-29],[1,-21]],'#b69f71','#655c49',1.2);}
 c.restore();
}
function zombieBody(c,e,time){
 const motion=time===0?0:(e.age||time),skin=e.type==='dash'?'#a0b98a':e.type==='brute'?'#8eaa7a':'#a5bb86',coat=({dash:'#a95343',healer:'#b4b593',summoner:'#73536b',boss:'#565247',brute:'#736759',push:'#bc8651',burrow:'#6d8172',boss_morning:'#7b985f',boss_noon:'#a5724f',boss_dusk:'#776079'})[e.type]||'#827055',step=Math.sin(motion*(e.type==='dash'?10:5.6))*7;
 oval(c,0,39,23,6,'#23463126',null);c.save();c.translate(0,Math.sin(motion*5.6)*1.2);
 shape(c,[[-13,11],[-1,12],[-6+step*.2,28],[-10+step*.7,40],[-20+step*.7,40],[-18+step*.2,27]],'#576477','#374a44',2.3);shape(c,[[2,10],[14,9],[18-step*.4,26],[13-step*.7,39],[3-step*.7,39],[6-step*.25,26]],'#627286','#374a44',2.3);
 shape(c,[[-21+step*.7,35],[-10+step*.7,35],[-8+step*.7,42],[-24+step*.7,44],[-27+step*.7,40]],'#48493e','#303e32',2);shape(c,[[3-step*.7,35],[13-step*.7,35],[15-step*.7,41],[-2-step*.7,43],[-5-step*.7,39]],'#535145','#303e32',2);
 shape(c,[[-15,-21],[10,-20],[18,-7],[16,16],[8,21],[3,16],[-3,22],[-9,17],[-18,21],[-19,1]],coat,'#454d3a',2.6);shape(c,[[-4,-18],[6,-17],[7,11],[-5,10]],'#d3c4a0','#776c50',1.4);shape(c,[[-3,-17],[1,-11],[0,-5],[-4,6],[-7,1],[-5,-6]],e.type==='boss'?'#ac634b':'#96724a','#685a3c',1.2);
 line(c,[[-13,-18],[-7,-9],[-12,-3]],tint(coat,-26),1.5);line(c,[[9,-18],[4,-7],[10,-3]],tint(coat,-26),1.5);line(c,[[12,8],[8,10]],tint(coat,-26),1.2);
 shape(c,[[9,-14],[14,-8],[2,-1],[-18,-6],[-17,-15],[0,-12]],tint(coat,-5),'#454d3a',2.1);shape(c,[[-14,-13],[-17,-3],[-30,-5],[-39,-9],[-36,-16],[-27,-12]],tint(coat,7),'#454d3a',2.1);hand(c,-18,-10,-.1,skin);hand(c,-39,-12,.2,skin);
 if(e.type==='tank'){box(c,-18,-18,33,32,5,'#87947d','#465740',2);line(c,[[-17,-3],[14,-3]],'#b4bba0',2);line(c,[[-3,-17],[-3,13]],'#61715a',2);disc(c,-10,-11,2,'#c4c9a9');disc(c,8,8,2,'#c4c9a9');}
 if(e.type==='brute'){shape(c,[[-19,-22],[-29,-12],[-23,2],[-13,-1]],'#8b8f77','#515e45',2);shape(c,[[10,-20],[22,-12],[21,3],[12,0]],'#8b8f77','#515e45',2);line(c,[[-27,-11],[-20,-8]],'#bbc2a1',1.8);}
 if(e.type==='healer'){line(c,[[9,-9],[19,15]],'#8b8369',3);box(c,13,7,21,20,3,'#a38e67','#5d6147',2);line(c,[[23,11],[23,22]],'#e5dbc0',3);line(c,[[18,16],[28,16]],'#e5dbc0',3);}
 if(e.type==='summoner'){line(c,[[16,29],[10,-32]],'#7c6241',4);disc(c,10,-35,7,'#a9ae7d','#5a6443',2);line(c,[[8,-38],[12,-34]],'#ded7ab',1);}
 if(e.type==='leap'){line(c,[[25,40],[17,-42]],'#5b6344',5);line(c,[[25,40],[17,-42]],'#ccb989',2.5);box(c,12,-46,10,7,2,'#839667','#506443',1.6);}
 if(e.type==='burrow'){line(c,[[18,27],[15,-7],[5,-13]],'#887651',4);shape(c,[[0,-16],[12,-19],[30,-8],[21,-8],[10,-12]],'#a2aea2','#596c59',1.8);box(c,-14,-1,26,17,2,'#647961','#465a46',1.4);}
 if(e.type==='push'){line(c,[[-10,8],[-45,17],[-51,32]],'#877657',4);disc(c,-40,31,10,'#5c6652','#384a38',2);disc(c,-40,31,3,'#c0b797');shape(c,[[-63,8],[-22,2],[-15,21],[-55,24]],'#a59d75','#657050',2.2);line(c,[[-57,13],[-29,9]],'#d0c495',1.3);}
 if(e.type==='boss_morning'){box(c,-17,-9,31,29,3,'#6b855b','#425b40',1.6);line(c,[[-13,-18],[-11,17]],'#aeb884',3);line(c,[[10,-18],[8,17]],'#aeb884',3);disc(c,-12,-5,2,'#dfd39c');disc(c,9,-5,2,'#dfd39c');line(c,[[20,30],[15,-18]],'#97774c',5);shape(c,[[11,-24],[26,-25],[30,-10],[15,-7]],'#adb0a0','#59654f',2);}
 if(e.type==='boss_noon'){box(c,9,-20,17,34,4,'#7b735c','#4c5644',2);line(c,[[15,-25],[15,-41],[23,-41]],'#7b735c',6);for(let i=0;i<3;i++)line(c,[[12+i*4,-3],[12+i*4,6]],'#bfb188',1);box(c,-34,-17,17,16,3,'#ae9870','#6a674b',2);line(c,[[-32,-10],[-21,-10]],'#d4c291',1.2);}
 if(e.type==='boss_dusk'){shape(c,[[-17,-19],[-26,23],[-12,17],[-7,26],[0,19],[6,27],[18,21],[25,27],[16,-16]],'#695273','#494551',1.8);line(c,[[17,-18],[24,29]],'#8e7755',4);box(c,16,-6,20,27,3,'#bda572','#6b704e',1.5);box(c,20,-1,12,16,1,'#e3cf8e','#ae9b68',1);}
 zombieHead(c,skin,coat,e.type,motion);c.restore();
}
function enemy(c,...args){const previous=c._gardenMaterial;c._gardenMaterial=true;try{return enemyCore(c,...args);}finally{c._gardenMaterial=previous;}}
function enemyCore(c,e,time=0){
 c.save();c.translate(e.x,e.y);if(e.jumpTime>0)c.translate(0,-Math.sin(e.jumpTime/.55*Math.PI)*43);
 if(e.underground){oval(c,0,29,25,7,'#50614950',null);shape(c,[[-20,29],[-14,22],[-5,25],[5,19],[15,25],[24,28]],'#8b8c64',null);for(let i=0;i<3;i++)disc(c,-15+i*14,26-(i%2)*3,2,'#b4a87a');c.restore();return;}
 if(e.type==='wisp'){const motion=time===0?0:e.age||time;c.translate(0,-10+Math.sin(motion*2.7)*4);oval(c,0,48,23,6,'#35595618',null);c.globalAlpha=.8;shape(c,[[-17,-19],[10,-22],[21,-5],[17,23],[9,39],[-1,28],[-13,37],[-18,19]],'#9fbfa9','#547c69',2.1);shape(c,[[-5,-17],[5,-17],[4,17],[-7,21]],'#d0d6af',null);shape(c,[[-17,-10],[-27,-2],[-38,-8],[-42,-2],[-33,4],[-22,5],[-10,-1]],'#a2c3ac','#547c69',1.6);zombieHead(c,'#bdd7b6','#9fbfa9','wisp',motion);c.globalAlpha=1;}
 else if(e.type==='bat'){const motion=time===0?0:e.age||time,flap=Math.sin(motion*9)*12;c.translate(0,-18+Math.sin(motion*4)*3);oval(c,0,52,22,5,'#39504724',null);shape(c,[[-9,-20],[-22,-36-flap],[-41,-15-flap],[-31,-14],[-29,-2],[-20,-6],[-16,7],[-7,-3]],'#897b9f','#574c68',1.9);shape(c,[[9,-20],[26,-34-flap],[43,-13-flap],[34,-11],[29,0],[21,-6],[15,8],[7,-3]],'#a395b2','#574c68',1.9);shape(c,[[-11,-25],[12,-25],[13,9],[0,17],[-13,10]],'#786886','#574c68',2);line(c,[[-30,-20],[-16,-12]],'#bcb0c5',1);line(c,[[30,-19],[17,-12]],'#c5bace',1);zombieHead(c,'#b4bc8e','#786886','bat',motion);}
 else{if(e.type==='brute')c.scale(1.27,1.27);if(E.ENEMIES?.[e.type]?.boss||e.type.startsWith('boss'))c.scale(e.type==='boss'?1.58:1.46, e.type==='boss'?1.58:1.46);zombieBody(c,e,time);}
 if(e.slow>0){for(let i=0;i<3;i++){const xx=-19+i*19,yy=26-i%2*12;line(c,[[xx-4,yy],[xx+4,yy]],'#b2e0e5',1.5);line(c,[[xx,yy-4],[xx,yy+4]],'#b2e0e5',1.5);}}
 if(e.burn>0){c.globalAlpha=.7;for(let i=0;i<3;i++){const xx=-16+i*15,yy=17+(time===0?0:Math.sin((e.age||time)*9+i)*3);shape(c,[[xx-5,yy+11],[xx-8,yy],[xx,yy-15],[xx+4,yy-1],[xx+7,yy+9]],'#ed9c46',null);shape(c,[[xx-2,yy+8],[xx-1,yy-4],[xx+3,yy+6]],'#f9d977',null);}c.globalAlpha=1;}
 if(e.root>0){for(let i=0;i<3;i++){c.beginPath();c.moveTo(-25+i*19,35);c.bezierCurveTo(-30+i*19,21,-17+i*19,13,-14+i*19,31);c.strokeStyle='#b9c181';c.lineWidth=3;c.stroke();}leaf(c,-23,31,-1.3,'#90a964',.45);}
 if(e.freeze>0){shape(c,[[-24,22],[-24,-7],[-14,-2],[-3,-14],[13,-3],[23,-8],[24,22]],'#a3d8e477','#72a8b7',1.6);line(c,[[-16,5],[-10,12],[-14,23]],'#e6f4e4',1.1);}
 if(e.vulnerable>0){line(c,[[-23,3],[-28,8],[-23,13]],'#dfbf79',2);line(c,[[23,3],[28,8],[23,13]],'#dfbf79',2);}
 if(e.hit>0){c.globalAlpha=.43;oval(c,-2,-26,22,24,'#fffdf0',null);}if(e.enraged){line(c,[[-20,-75],[-25,-84]],'#bd5a48',2);line(c,[[15,-75],[22,-83]],'#bd5a48',2);}c.restore();
}
const THEMES={
 emerald:{...PALETTES.emerald,skyBottom:'#f1ebc6',far:'#5e8459',grass:PALETTES.emerald.lawn,grassAlt:'#75a259',dark:PALETTES.emerald.shadow,fence:'#c3ae85',fenceShade:'#9f8e6f',accent:PALETTES.emerald.light,weather:'sun'},
 noon:{...PALETTES.noon,skyBottom:'#f1ecbc',far:'#84985d',grass:PALETTES.noon.lawn,grassAlt:'#abbc6f',dark:PALETTES.noon.shadow,fence:'#cda478',fenceShade:'#a58760',accent:PALETTES.noon.light,weather:'heat'},
 velvet:{...PALETTES.velvet,skyBottom:'#eacea0',far:'#687565',grass:PALETTES.velvet.lawn,grassAlt:'#798c6d',dark:PALETTES.velvet.shadow,fence:'#b19a8a',fenceShade:'#897e79',accent:PALETTES.velvet.light,weather:'sunset'},
 crystal:{sky:'#314b70',skyBottom:'#6a8391',far:'#3c675c',grass:'#56886b',grassAlt:'#5a8e71',dark:'#345d50',fence:'#8a8f80',fenceShade:'#727b70',accent:'#dcd8a5',light:'#dcd8a5',weather:'night'},
 frost:{sky:'#c4dbe4',skyBottom:'#e7edf0',far:'#829f99',grass:'#a1bdaa',grassAlt:'#aac6b3',dark:'#688879',fence:'#b3b3a2',fenceShade:'#969f91',accent:'#e2ead9',light:'#e2ead9',weather:'snow'},
 blight:{sky:'#91aaa7',skyBottom:'#b8c7b3',far:'#607c68',grass:'#72936b',grassAlt:'#779872',dark:'#466954',fence:'#a79f84',fenceShade:'#8b8972',accent:'#c4c497',light:'#c4c497',weather:'rain'},
 eclipse:{...PALETTES.eclipse,skyBottom:'#5a7275',far:'#3b5a54',grass:PALETTES.eclipse.lawn,grassAlt:'#496d61',dark:PALETTES.eclipse.shadow,fence:'#8b9a8d',fenceShade:'#61766e',accent:PALETTES.eclipse.light,weather:'eclipse'}
};
function cloud(c,x,y,size,color){c.save();c.translate(x,y);c.scale(size,size);c.beginPath();c.moveTo(-45,8);c.bezierCurveTo(-50,-9,-23,-13,-15,-7);c.bezierCurveTo(-9,-34,21,-31,25,-12);c.bezierCurveTo(45,-20,65,4,52,12);c.closePath();c.fillStyle=color;c.fill();c.restore();}
function shrub(c,x,y,r,color){for(let i=0;i<5;i++){const a=i*.9;oval(c,x+Math.cos(a)*r*.6,y-Math.sin(a)*r*.6,r*.58,r*.64,i%2?color:tint(color,7),null);}line(c,[[x-r*.65,y+4],[x+r*.7,y+3]],tint(color,-12),1);}
// The board is a single raised garden tray. Tile edges follow the engine grid exactly.
function lawn(c,level,th,tier='high'){
 c.save();
 box(c,90,117,830,447,22,th.dark+'66',null);
 const rim=c.createLinearGradient(0,111,0,561);rim.addColorStop(0,'#e9ead3');rim.addColorStop(.12,tint(th.fence,18));rim.addColorStop(1,tint(th.fenceShade,-18));
 box(c,92,112,826,447,18,rim,th.dark+'88',1);
 box(c,98,118,814,434,12,tint(th.dark,-12),null);
 for(let row=0;row<5;row++)for(let col=0;col<9;col++){
  const x=100+col*90,y=120+row*86,base=(row+col)%2?th.grassAlt:th.grass;
  const g=c.createLinearGradient(x,y,x+18,y+86);g.addColorStop(0,tint(base,19));g.addColorStop(.19,tint(base,7));g.addColorStop(1,tint(base,-9));
  box(c,x+1,y+1,88,84,8,g,null);
  line(c,[[x+9,y+2.5],[x+80,y+2.5]],'#ffffff24',1);
  line(c,[[x+7,y+83],[x+82,y+83]],th.dark+'42',1);
  // Very sparse clippings provide material scale without competing with units.
  for(let i=0;i<(tier==='low'?2:5);i++){const n=row*87+col*13+i,xx=x+9+seedRand(n+1)*70,yy=y+16+seedRand(n+9)*58;line(c,[[xx-2,yy],[xx,yy-3],[xx+2,yy]],i%2?'#f5ffdc1c':th.dark+'25',.8);}
 }
 // Inlaid rails establish both the protected edge and incoming enemy edge.
 box(c,94,133,4,402,2,'#f3e9c2',null);box(c,913,133,3,402,1.5,th.dark+'99',null);
 for(let row=0;row<5;row++){const y=163+row*86;disc(c,96,y,2.5,'#fff9df');line(c,[[917,y-7],[922,y],[917,y+7]],th.accent+'bb',1.4);}
 c.restore();
}
function porch(c,th){
 const g=c.createLinearGradient(0,110,90,555);g.addColorStop(0,tint(th.fence,24));g.addColorStop(1,tint(th.fenceShade,-10));box(c,-20,108,105,453,20,g,th.dark+'44',1);
 box(c,14,118,60,430,15,'#ffffff17','#ffffff35',1);
 for(let i=0;i<5;i++){const y=120+i*86;line(c,[[22,y+85],[66,y+85]],th.dark+'20',1);}
 line(c,[[80,133],[80,534]],'#fff7d75c',1.5);
}
function cottage(c,x,y,th,night=false){
 c.save();c.translate(x,y);shape(c,[[-58,0],[0,-41],[64,0],[60,47],[-55,47]],tint(th.far,27),th.dark,1.3);shape(c,[[-69,-2],[0,-49],[77,-1],[65,5],[0,-35],[-58,7]],th.weather==='sunset'?'#a18077':th.weather==='eclipse'?'#697b79':'#b58e6b',th.dark,1.5);box(c,-38,10,24,23,3,night?'#d6c58e':'#d3e3ce',th.dark,1.1);box(c,15,9,27,26,3,night?'#cabb91':'#d3e3ce',th.dark,1.1);line(c,[[-26,11],[-26,32]],tint(th.far,12),1);line(c,[[29,10],[29,34]],tint(th.far,12),1);line(c,[[16,23],[41,23]],tint(th.far,12),1);box(c,-6,24,14,23,2,tint(th.far,5),th.dark,1);line(c,[[-52,40],[54,40]],th.dark+'55',1);c.restore();
}
function paintFar(c,th){
 const g=c.createLinearGradient(0,0,0,150);g.addColorStop(0,th.sky);g.addColorStop(1,th.skyBottom);c.fillStyle=g;c.fillRect(0,0,1040,150);if(th.weather==='eclipse'||th.weather==='night'){for(let i=0;i<35;i++)disc(c,36+seedRand(i*3+2)*973,6+seedRand(i*7)*68,i%5===0?1.5:.8,th.light+'a8');}
 shape(c,[[0,95],[65,82],[154,92],[251,59],[353,80],[470,65],[598,84],[727,57],[861,74],[967,59],[1040,89],[1040,150],[0,150]],tint(th.far,19),null);shape(c,[[0,120],[58,104],[160,112],[272,94],[370,118],[466,93],[588,107],[668,83],[797,110],[901,85],[1040,104],[1040,150],[0,150]],th.far,null);
 for(let i=0;i<12;i++){const x=37+i*86,y=87+seedRand(i*13)*21;line(c,[[x,y+25],[x,y-14]],tint(th.far,-5),2);for(let j=0;j<3;j++)oval(c,x+(j-1)*8,y-j*6,15,13,tint(th.far,j*4),null);} 
}
function paintMid(c,th){
 const night=th.weather==='eclipse'||th.weather==='night';cottage(c,189,82,th,night);cottage(c,771,94,th,night);for(let i=0;i<21;i++)shrub(c,35+i*54,128,14+seedRand(i+2)*9,tint(th.far,-6));
 box(c,63,108,998,6,1,th.fenceShade,null);box(c,63,133,998,5,1,th.fenceShade,null);for(let i=0;i<30;i++){const x=60+i*35,y=96+seedRand(i*17)*7;shape(c,[[x,y+4],[x+13,y],[x+27,y+5],[x+27,138],[x,138]],i%4?th.fence:tint(th.fence,7),th.fenceShade,1);line(c,[[x+7,y+10],[x+7,133]],th.fenceShade+'7a',.8);line(c,[[x+20,116],[x+19,130]],th.fenceShade+'55',.8);disc(c,x+13,111,1.2,tint(th.fenceShade,-12));}
}
function paintTerrain(c,th,tier){
 c.save();c.translate(0,-120);c.fillStyle=['eclipse','night'].includes(th.weather)?'#526861':'#cdd0b9';c.fillRect(0,120,1040,500);lawn(c,{theme:'emerald'},th,tier);porch(c,th);
 c.fillStyle=['eclipse','night'].includes(th.weather)?'#5c7169':'#c4c8b2';c.fillRect(919,138,121,427);for(let i=0;i<13;i++){const y=140+i*33;shape(c,[[929,y+4],[979,y+2],[992,y+26],[929,y+30]],th.weather==='eclipse'?'#8a96824a':'#d5c9a85a','#78886a44',1);line(c,[[935,y+9],[953,y+7]],'#f0e1b433',1);}for(let i=0;i<(tier==='low'?25:75);i++)disc(c,923+seedRand(i*5)*95,145+seedRand(i*11)*410,.7,th.dark+'38');
 const lower=c.createLinearGradient(0,545,0,620);lower.addColorStop(0,th.far);lower.addColorStop(1,th.dark);c.fillStyle=lower;c.beginPath();c.moveTo(0,586);c.bezierCurveTo(132,574,332,592,523,582);c.bezierCurveTo(759,576,885,594,1040,579);c.lineTo(1040,620);c.lineTo(0,620);c.closePath();c.fill();for(let i=0;i<(tier==='low'?20:44);i++){const x=seedRand(i*23)*1040,y=588+seedRand(i*13)*30;leaf(c,x,y,-.7+(i%3)*.5,tint(th.far,15),.7);if(i%4===0){line(c,[[x+9,y],[x+10,y-15]],tint(th.far,-8),1.5);for(let j=0;j<5;j++)disc(c,x+10+Math.cos(j*TAU/5)*4,y-15+Math.sin(j*TAU/5)*4,2.8,i%8?th.light:'#c69280');disc(c,x+10,y-15,1.8,'#c5a764');}}
 c.restore();
}
function cachedLayers(theme,tier){
 const key=theme+'-'+tier;if(layerCache.has(key)){const result=layerCache.get(key);layerCache.delete(key);layerCache.set(key,result);renderCounters.cacheHits++;return result;}const far=surface(1040,150),mid=surface(1060,150),terrain=surface(1040,500);if(!far||!mid||!terrain)return null;const th=THEMES[theme]||THEMES.emerald;paintFar(far.getContext('2d'),th);paintMid(mid.getContext('2d'),th);paintTerrain(terrain.getContext('2d'),th,tier);const result={far,mid,terrain};layerCache.set(key,result);while(layerCache.size>LIMITS[tier].caches)layerCache.delete(layerCache.keys().next().value);renderCounters.cacheMisses++;return result;
}
function ambient(c,level,time,tier){
 const th=THEMES[level.theme]||THEMES.emerald,count=LIMITS[tier].ambient,kind=level.weather||(level.theme==='eclipse'?'firefly':level.theme==='velvet'&&String(level.id).endsWith('-4')?'rain':'pollen');c.save();for(let i=0;i<count;i++){const x=80+(i*137+time*(kind==='rain'?21:5+i%3))%950,y=122+(i*83+time*(kind==='rain'?185:3+i%2))%439;
 if(kind==='rain'){line(c,[[x,y],[x-5,y+13]],'#d9e6db5e',1);}else if(kind==='firefly'){const a=.2+.17*Math.sin(time*1.2+i);c.globalAlpha=a;disc(c,x,y,2,th.light);if(tier!=='low'){c.globalAlpha=a*.28;disc(c,x,y,5,th.light);}}else{c.globalAlpha=.25;oval(c,x,y,1.6,1,th.light,null);}}
 c.restore();
}
function backdrop(c,level,time=0,options={}){
 const th=THEMES[level.theme]||THEMES.emerald,tier=options.performanceTier==='low'?'low':'high',camera=options.camera||{x:0,y:0},layers=cachedLayers(level.theme,tier),farX=-18+camera.x*.12,midX=-18+camera.x*.3,nearX=camera.x*.6;
 c.fillStyle=th.sky;c.fillRect(0,0,1000,620);if(layers)c.drawImage(layers.far,farX,0);else{c.save();c.translate(farX,0);paintFar(c,th);c.restore();}
 if(th.weather==='eclipse'||th.weather==='night'){disc(c,840+camera.x*.1,39,23,th.light);disc(c,850+camera.x*.1,31,22,th.sky);}else{const sunX=th.weather==='sunset'?177:826,sunY=th.weather==='sunset'?82:th.weather==='heat'?25:44,sunR=th.weather==='heat'?27:22;disc(c,sunX+camera.x*.1,sunY,sunR,th.light);if(th.weather==='heat')for(let i=0;i<12;i++){const a=i*TAU/12;line(c,[[sunX+Math.cos(a)*34,sunY+Math.sin(a)*34],[sunX+Math.cos(a)*40,sunY+Math.sin(a)*40]],th.light+'99',1.4);}cloud(c,407+Math.sin(time*.045)*10+camera.x*.12,29,.95,th.light+'6b');cloud(c,970+Math.sin(time*.032)*12+camera.x*.12,51,.64,th.light+'75');}
 if(layers){c.drawImage(layers.mid,midX,0);c.drawImage(layers.terrain,0,120);}else{c.save();c.translate(midX,0);paintMid(c,th);c.restore();c.save();c.translate(0,120);paintTerrain(c,th,tier);c.restore();}
 if(level.rows)for(let row=0;row<5;row++)if(!level.rows.includes(row)){c.fillStyle=th.dark+'35';c.fillRect(100,120+row*86,810,86);for(let i=0;i<18;i++)leaf(c,111+i*45,153+row*86,-.85,tint(th.far,11),.36);}
 if(level.toxic)for(const t of level.toxic){const p=E.center(t.row,t.col);oval(c,p.x,p.y+6,36,28,'#62675977',null);for(let i=0;i<5;i++)line(c,[[p.x-23+i*11,p.y+14],[p.x-19+i*11,p.y+1]],'#c0ad8966',1.3);}
 const lighting=c.createLinearGradient(100,120,900,540);if(th.weather==='sun'){lighting.addColorStop(0,'#284e3438');lighting.addColorStop(1,'#f4e4b321');}else if(th.weather==='heat'){lighting.addColorStop(0,'#ffffff00');lighting.addColorStop(.6,'#fff1b619');lighting.addColorStop(1,'#fff1b633');}else if(th.weather==='sunset'){lighting.addColorStop(0,'#e8be922b');lighting.addColorStop(.55,'#a66d7730');lighting.addColorStop(1,'#393d5539');}else{lighting.addColorStop(0,'#20313911');lighting.addColorStop(1,'#101e2b3d');}c.fillStyle=lighting;c.fillRect(100,120,810,430);
 c.save();c.translate(nearX,0);for(let i=0;i<8;i++){const x=i<4?-7+i*19:954+(i-4)*17,y=602+i%3*5;c.beginPath();c.moveTo(x,620);c.bezierCurveTo(x-13+Math.sin(time*.4+i)*2,y-14,x-18,y-36,x-2,y-42);c.bezierCurveTo(x+18,y-17,x+15,y+8,x+9,620);c.fillStyle=i%2?th.far:tint(th.far,12);c.fill();c.strokeStyle=th.dark;c.lineWidth=1.2;c.stroke();}c.restore();ambient(c,level,time,tier);
}
function castShadow(c,x,y,kind,theme){const th=THEMES[theme]||THEMES.emerald,long=th.weather==='sun'?44:th.weather==='sunset'?37:18,dx=th.weather==='sun'?-23:th.weather==='sunset'?23:4;c.save();c.translate(x+dx,y+(kind==='enemy'?40:31));c.rotate(th.weather==='sun'?-.22:.15);const g=c.createRadialGradient(0,0,0,0,0,long);g.addColorStop(0,th.dark+'50');g.addColorStop(1,th.dark+'00');c.scale(1,.23);disc(c,0,0,long,g);c.restore();}

function mower(c,x,y,time=0,moving=false){c.save();c.translate(x,y);oval(c,0,24,27,5,'#2447332b',null);line(c,[[-14,-4],[-29,-23],[-37,-23]],'#606957',3.5);line(c,[[-12,-8],[-25,-26],[-37,-26]],'#929883',1.5);oval(c,-16,18,9,10,'#464e43','#2a392d',2);oval(c,21,18,9,10,'#464e43','#2a392d',2);disc(c,-16,18,3.7,'#c1bda3','#617059',1.3);disc(c,21,18,3.7,'#c1bda3','#617059',1.3);shape(c,[[-24,9],[-16,-3],[21,-4],[31,9],[30,16],[-23,16]],'#72946a','#35583a',2.3);box(c,-10,-14,26,17,4,'#bb6652','#704a3b',2);box(c,-5,-18,14,6,2,'#c89767','#704a3b',1.5);line(c,[[-5,-8],[11,-8]],'#ddac80',1.4);shape(c,[[26,2],[36,7],[36,14],[28,14]],'#8d9f79','#35583a',1.5);if(moving){line(c,[[-34,5],[-49,5]],'#b6c485',1.8);line(c,[[-31,13],[-45,14]],'#b6c485',1.8);c.save();c.translate(21,18);c.rotate(time*20);line(c,[[-5,0],[5,0]],'#bbc0a2',1);line(c,[[0,-5],[0,5]],'#bbc0a2',1);c.restore();}c.restore();}
function rock(c,o,th){const p=E.center(o.row,o.col);oval(c,p.x,p.y+28,30,7,'#344a3b28',null);shape(c,[[p.x-31,p.y+15],[p.x-24,p.y-7],[p.x-8,p.y-19],[p.x+13,p.y-16],[p.x+30,p.y+7],[p.x+25,p.y+24],[p.x-21,p.y+25]],'#989c83','#5d6d55',2.5);shape(c,[[p.x-24,p.y-7],[p.x-8,p.y-19],[p.x+13,p.y-16],[p.x+2,p.y+1],[p.x-20,p.y+6]],'#b6baa0',null);line(c,[[p.x+2,p.y+1],[p.x+13,p.y+17],[p.x+25,p.y+24]],'#7b866d',1.3);leaf(c,p.x-23,p.y+19,-1.2,th.dark,.45);}
function energy(c,t,time){c.save();c.translate(t.x,t.y);c.rotate(Math.sin(time*2+t.id)*.045);for(let i=0;i<10;i++){const a=i*TAU/10;shape(c,[[Math.cos(a)*20,Math.sin(a)*20],[Math.cos(a+.08)*27,Math.sin(a+.08)*27],[Math.cos(a+.19)*20,Math.sin(a+.19)*20]],'#f0c050','#b18a33',1);}disc(c,0,0,17,'#f6d472','#a18435',1.8);oval(c,-4,-5,9,7,'#ffe49a',null);c.restore();}
// Compact, continuous meters remain legible at phone sizes. A critical mark
// carries the same information as the red fill for colour-blind players.
function health(c,x,y,hp,max,w=32,always=false,numbers=false){
 const ratio=clamp(hp/Math.max(1,max));if(ratio>=1&&!always)return;c.save();
 box(c,x-w/2-1,y-1,w+2,7,3.5,'#20382cbd','#ffffff6b',.75);
 if(ratio>0)box(c,x-w/2,y,Math.max(3,w*ratio),5,2.5,ratio<=.3?'#ffb4a2':ratio<=.6?'#f4d294':'#d4edb0',null);
 if(ratio<=.3){disc(c,x-w/2-5,y+2.5,3,'#fff4ee');line(c,[[x-w/2-5,y+1],[x-w/2-5,y+2.7]],'#9c4639',1);disc(c,x-w/2-5,y+4,.55,'#9c4639');}
 if(numbers){const label=Math.max(0,Math.ceil(hp))+'';c.font='600 9px '+UI_FONT;c.textAlign='center';c.textBaseline='middle';const width=Math.max(20,c.measureText(label).width+10);box(c,x-width/2,y-17,width,14,5,'#243a30e8','#ffffff26',.65);c.fillStyle='#f7fbef';c.fillText(label,x,y-9.7);}
 c.restore();
}
// Every ability uses a drawn symbol; alphabetic abbreviations do not translate.
function abilityGlyph(c,kind,x,y,size=12,color='#355c4b'){
 c.save();c.translate(x,y);c.scale(size/16,size/16);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.7;c.lineCap='round';c.lineJoin='round';
 if(kind==='air'){line(c,[[-7,2],[-3,-2],[0,1],[3,-2],[7,2]],color,1.7);line(c,[[0,1],[0,5]],color,1.7);}
 else if(kind==='speed'){line(c,[[-6,-4],[-1,0],[-6,4]],color,1.8);line(c,[[0,-4],[5,0],[0,4]],color,1.8);}
 else if(kind==='shield'){shape(c,[[0,-7],[6,-4],[5,3],[0,7],[-5,3],[-6,-4]],null,color,1.6);line(c,[[0,-3],[0,3]],color,1.2);}
 else if(kind==='heal'){line(c,[[0,-5],[0,5]],color,2.5);line(c,[[-5,0],[5,0]],color,2.5);}
 else if(kind==='jump'){line(c,[[-6,5],[-6,1],[-1,-5],[5,0]],color,1.7);line(c,[[1,0],[5,0],[5,-4]],color,1.7);}
 else if(kind==='summon'){disc(c,-2,-1,3,null,color,1.5);line(c,[[3,3],[7,3],[5,1],[5,5]],color,1.5);line(c,[[-6,6],[-6,4],[-2,2],[1,4]],color,1.5);}
 else if(kind==='ghost'){c.beginPath();c.moveTo(-5,6);c.lineTo(-5,-1);c.bezierCurveTo(-5,-8,5,-8,5,-1);c.lineTo(5,6);c.lineTo(2,4);c.lineTo(0,6);c.lineTo(-2,4);c.closePath();c.stroke();disc(c,-2,-1,.9,color);disc(c,2,-1,.9,color);}
 else if(kind==='burrow'){line(c,[[-7,4],[-3,4],[0,0],[3,4],[7,4]],color,1.7);line(c,[[0,-7],[0,-2],[-3,-5],[0,-2],[3,-5]],color,1.7);}
 else if(kind==='push'){line(c,[[-6,-5],[-6,5]],color,1.7);line(c,[[-2,0],[6,0],[3,-3],[6,0],[3,3]],color,1.7);}
 else if(kind==='boss'){shape(c,[[-6,5],[-7,-4],[-3,0],[0,-6],[3,0],[7,-4],[6,5]],null,color,1.6);line(c,[[-5,2],[5,2]],color,1.2);}
 else if(kind==='snow'){for(let i=0;i<3;i++){const a=i*Math.PI/3;line(c,[[Math.cos(a)*-6,Math.sin(a)*-6],[Math.cos(a)*6,Math.sin(a)*6]],color,1.5);}}
 else if(kind==='fire'){shape(c,[[0,-7],[5,0],[4,5],[0,7],[-4,5],[-5,1],[-2,-2],[-2,2]],null,color,1.6);}
 else if(kind==='root'){line(c,[[0,-6],[0,3],[-4,6],[0,3],[4,6]],color,1.7);line(c,[[-5,-1],[0,2],[5,-1]],color,1.4);}
 else if(kind==='target'){disc(c,0,0,5,null,color,1.4);line(c,[[-7,0],[-3,0],[0,-7],[0,-3],[7,0],[3,0],[0,7],[0,3]],color,1.2);}
 else if(kind==='economy'){disc(c,0,0,4,null,color,1.6);for(let i=0;i<6;i++){const a=i*TAU/6;line(c,[[Math.cos(a)*6,Math.sin(a)*6],[Math.cos(a)*7.5,Math.sin(a)*7.5]],color,1.3);}}
 else if(kind==='trap'){shape(c,[[0,-7],[7,6],[-7,6]],null,color,1.6);line(c,[[0,-2],[0,1]],color,1.6);disc(c,0,3.5,.7,color);}
 else if(kind==='control'){line(c,[[-7,-3],[3,-3],[5,-5],[3,-7]],color,1.6);line(c,[[-7,2],[6,2]],color,1.6);line(c,[[-3,6],[2,6]],color,1.6);}
 else{line(c,[[-6,0],[5,0],[1,-4],[5,0],[1,4]],color,1.8);}
 c.restore();
}
function statusBadges(c,e,y){
 const items=[];if(e.freeze>0)items.push(['snow','#e5f7ff','#487689']);else if(e.slow>0)items.push(['snow','#e9f4f6','#487689']);if(e.burn>0)items.push(['fire','#fff0dc','#a96334']);if(e.root>0)items.push(['root','#edf4dc','#5b7442']);if(e.vulnerable>0)items.push(['target','#fff0dc','#986e36']);
 for(let i=0;i<items.length;i++){const [kind,bg,fg]=items[i],x=e.x+(i-(items.length-1)/2)*17;box(c,x-7,y,14,14,4,bg,'#ffffffb3',.7);abilityGlyph(c,kind,x,y+7,10,fg);}
}
function arrival(c,p,kind,reduced){
 if(reduced||!Number.isFinite(p.age)||p.age<0||p.age>.55)return;
 const t=clamp(p.age/.55),ease=1-Math.pow(1-t,3);c.save();c.globalAlpha=(1-t)*.5;c.beginPath();c.ellipse(p.x,p.y+29,14+ease*23,5+ease*7,0,0,TAU);c.strokeStyle=kind==='plant'?'#f0ffe3':'#fff0d8';c.lineWidth=2-t;c.stroke();c.restore();
}

const lit=(s,x,y)=>!s.level.fog||(typeof E.isLit==='function'?E.isLit(s,x,y):x<200);
function fog(c,s,time,tier='high'){
 if(!s.level.fog)return;const lights=s.plants.filter(p=>p.hp>0&&p.disabled<=0).map(p=>({x:p.x,y:p.y,r:typeof E.lightRadius==='function'?E.lightRadius(s,p):(E.PLANTS[p.type].light||0)*(p.stage==='sprout'?.75:p.stage==='flower'?1.15:1)*(s.darkPulse>0?.62:1)})).filter(p=>p.r>0),key=lights.map(p=>[p.x,p.y,p.r.toFixed(2)].join(',')).join('|')||'empty';if(!fogSurface)fogSurface=surface(1000,620);
 if(fogSurface){const f=fogSurface.getContext('2d');if(key!==fogKey){f.clearRect(0,0,1000,620);const edge=f.createLinearGradient(180,0,252,0);edge.addColorStop(0,'#14232b00');edge.addColorStop(1,'#14232bf2');f.fillStyle=edge;f.fillRect(180,116,72,441);f.fillStyle='#14232bf2';f.fillRect(252,116,748,441);f.globalCompositeOperation='destination-out';for(const p of lights){const g=f.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);g.addColorStop(0,'#000000');g.addColorStop(.52,'#000000ed');g.addColorStop(.8,'#0000007a');g.addColorStop(1,'#00000000');disc(f,p.x,p.y,p.r,g);}f.globalCompositeOperation='source-over';fogKey=key;}c.drawImage(fogSurface,0,0);}
 else{c.fillStyle='#14232bdf';c.fillRect(202,116,798,441);}
 for(const p of lights){const g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);g.addColorStop(0,'#f2dea522');g.addColorStop(.55,'#e3d4aa15');g.addColorStop(1,'#f2dea500');disc(c,p.x,p.y,p.r,g);}
 c.save();c.beginPath();c.rect(200,120,800,430);c.clip();for(let i=0;i<(tier==='low'?3:7);i++){const x=240+((i*151+time*4)%790),y=153+i*59;c.save();c.translate(x,y);c.scale(1,.22);const mist=c.createRadialGradient(0,0,0,0,0,133);mist.addColorStop(0,'#ccdbd015');mist.addColorStop(1,'#ccdbd000');disc(c,0,0,133,mist);c.restore();}c.restore();
}

function silhouette(c,x,y,time=0,opacity=.33){c.save();c.translate(x,y);c.translate(0,Math.sin(time*4)*1);c.globalAlpha*=opacity;oval(c,-2,-23,18,22,'#b4c4bd',null);shape(c,[[-15,-4],[13,-3],[17,22],[7,36],[-4,24],[-15,35],[-17,12]],'#b4c4bd',null);shape(c,[[-11,0],[-23,8],[-43,3],[-46,-4],[-28,-3],[-15,-9]],'#b4c4bd',null);c.restore();}
function enemyAbility(type){const d=E.ENEMIES?.[type]||{};return d.boss||type.startsWith('boss')?'boss':d.flying||type==='bat'?'air':({dash:'speed',tank:'shield',brute:'shield',healer:'heal',summoner:'summon',leap:'jump',wisp:'ghost',burrow:'burrow',push:'push'})[type];}
function enemyBadge(c,e,y){
 const kind=enemyAbility(e.type),boss=kind==='boss';
 if(!kind)return;c.save();box(c,e.x-39,y-7,17,17,5,boss?'#fff0d8':'#f3f8eddc','#ffffffa8',.9);abilityGlyph(c,kind,e.x-30.5,y+1.5,12,boss?'#8a6636':'#3d624e');c.restore();
}
function flag(c,s,time){if(!(s.flagTimer>0)&&!(s.phase==='flag'&&s.phaseTime>0))return;c.save();c.translate(945,77);line(c,[[0,2],[0,40]],'#6f7258',3);const bend=Math.sin(time*5)*3;shape(c,[[1,2],[33,5+bend],[26,15+bend],[33,26+bend],[1,23]],'#b57b57','#6e6750',1.5);line(c,[[12,8],[12,18]],'#ebd6a2',2);line(c,[[7,13],[17,13]],'#ebd6a2',2);c.restore();}
function growthMark(c,p,s){
 if(!p.stage)return;const x=p.x,y=p.y+30;
 if(p.stage==='sprout'){const progress=E.growthProgress(s,p);c.strokeStyle='#445e3f66';c.lineWidth=2;c.beginPath();c.ellipse(x,y,25,8,0,0,TAU);c.stroke();c.strokeStyle='#f0e0a9';c.beginPath();c.ellipse(x,y,25,8,0,-Math.PI/2,-Math.PI/2+TAU*progress);c.stroke();box(c,x+19,y-10,24,17,5,'#f5efd9','#7d8e60',.8);c.font='500 10px Arial';c.fillStyle='#536d40';c.textAlign='center';c.fillText(Math.max(0,Math.ceil(E.growthSeconds(s)-p.age))+'s',x+31,y+2);}
 else{disc(c,x+27,y-1,5.5,'#e7dfbb','#7d8e60',.8);c.font='bold 8px Arial';c.fillStyle='#536d40';c.textAlign='center';c.fillText(p.stage==='flower'?'3':'2',x+27,y+2);}
}
function terrainMarks(c,s,time,tier){
 const kind=s.level.terrain,th=THEMES[s.level.theme]||THEMES.emerald,rows=s.level.rows||[0,1,2,3,4];c.save();
 if(kind==='mud'){for(const row of rows){const y=E.center(row,0).y;oval(c,558+(row%2)*17,y+13,78,28,'#73684e27',null);oval(c,521,y+15,38,12,'#8b7a582d',null);for(let i=0;i<4;i++)line(c,[[490+i*35,y+7],[503+i*35,y+3]],'#c0a57755',1.3);}}
 else if(kind==='portal'){for(const row of rows){const y=E.center(row,0).y+26;c.save();c.translate(620,y);c.rotate(.045);c.beginPath();c.ellipse(0,0,26,9,0,0,TAU);c.strokeStyle='#b797746e';c.lineWidth=3;c.stroke();c.beginPath();c.ellipse(0,0,19,6,0,time*.2,time*.2+Math.PI*1.6);c.strokeStyle='#ece0ad9c';c.lineWidth=1.4;c.stroke();for(let i=0;i<3;i++)shape(c,[[-25+i*25,0],[-20+i*25,-5],[-15+i*25,0],[-20+i*25,4]],'#a9906288','#806e5359',.6);c.restore();}}
 else if(kind==='tide'){const row=typeof E.floodRow==='function'?E.floodRow(s):-1;if(row>=0){const y=120+row*86,g=c.createLinearGradient(0,y,0,y+86);g.addColorStop(0,'#b7d4ce19');g.addColorStop(.4,'#92b9b965');g.addColorStop(1,'#d0dfc432');c.fillStyle=g;c.beginPath();c.moveTo(100,y+6);for(let x=100;x<=910;x+=45)c.lineTo(x,y+6+Math.sin(x*.02+time)*3);c.lineTo(910,y+86);c.lineTo(100,y+86);c.closePath();c.fill();for(let i=0;i<(tier==='low'?6:15);i++){const x=117+i*51,y2=y+24+(i%3)*19;line(c,[[x,y2],[x+17,y2-1],[x+29,y2]],'#dfede074',1.2);}}else for(let i=0;i<5;i++)line(c,[[870,137+i*86],[899,135+i*86]],'#acbdb847',1.2);}
 else if(kind==='leaves'){for(let i=0;i<(tier==='low'?16:40);i++){const x=488+seedRand(i*17)*238,y=135+seedRand(i*23)*401;c.save();c.globalAlpha=.4;leaf(c,x,y,seedRand(i*9)*TAU,th.light,.24+seedRand(i*7)*.14);c.restore();}}
 c.restore();
}
function bondMark(c,b,time,strength=1){
 const points=b.points||[];if(points.length<2)return;const a=points[0],z=points[1],mx=(a.x+z.x)/2,my=(a.y+z.y)/2+25,colors={'freeze-blast':'#c9e0d6',nursery:'#d5c3cf','moon-harvest':'#e1d2a0'},col=colors[b.id]||'#d4ddbc';c.save();c.globalAlpha*=.32*strength;c.beginPath();c.moveTo(a.x,a.y+28);c.quadraticCurveTo(mx,my+12,z.x,z.y+28);c.strokeStyle=col;c.lineWidth=1.3;c.setLineDash([2,5]);c.lineDashOffset=-time*2;c.stroke();c.setLineDash([]);c.globalAlpha=Math.min(1,c.globalAlpha*2);disc(c,mx,my+7,6,col,'#647962',.8);
 if(b.id==='freeze-blast'){line(c,[[mx-3,my+7],[mx+3,my+7],[mx,my+7],[mx,my+4],[mx,my+10]],'#577b72',1);}
 else if(b.id==='nursery'){shape(c,[[mx,my+10],[mx-3,my+7],[mx-3,my+5],[mx-1,my+4],[mx,my+6],[mx+1,my+4],[mx+3,my+5],[mx+3,my+7]],'#8b748a',null);}
 else if(b.id==='moon-harvest'){disc(c,mx,my+7,3,'#8f895e');disc(c,mx+1.3,my+5.6,2.6,col);}else{oval(c,mx-1.5,my+7,2,1.5,null,'#6d846c',.8);oval(c,mx+1.5,my+7,2,1.5,null,'#6d846c',.8);}c.restore();
}
function blossom(c,p){for(const side of [-1,1]){const x=p.x+side*23,y=p.y+12;line(c,[[x,y+12],[x,y]],'#719751',1.2);for(let i=0;i<5;i++)disc(c,x+Math.cos(i*TAU/5)*3.5,y+Math.sin(i*TAU/5)*3.5,2.2,'#f0e8ce','#bfb289',.4);disc(c,x,y,1.7,'#d4b66a');}}
function inkUnit(c,p,kind,time,size,tier){
 const direct=()=>{if(kind==='plant'){branchForm(c,p,time,false);plant(c,p.type,p.x,p.y,time,size,p.hit);branchForm(c,p,time,true);}else enemy(c,p,time);};
 // A leap's vertical offset belongs to this frame, never to a shared sprite.
 // Only airborne enemies bypass the low-tier cache; grounded units keep its benefit.
 if(tier!=='low'||(kind==='enemy'&&p.jumpTime>0)){direct();return;}const key=[kind,p.type,p.stage,p.branch,p.hit>0,p.root>0,p.slow>0,p.burn>0,p.freeze>0,p.vulnerable>0,p.enraged,p.underground].join(':');let item=unitCache.get(key);if(item){unitCache.delete(key);unitCache.set(key,item);}else{const w=kind==='plant'?116:216,h=kind==='plant'?152:252,x=w/2,y=kind==='plant'?86:164,can=surface(w,h);if(!can){direct();return;}const cc=can.getContext('2d'),entity={...p,x:0,y:0};cc.translate(x,y);if(kind==='plant'){branchForm(cc,entity,0,false);plant(cc,p.type,0,0,0,1,p.hit);branchForm(cc,entity,0,true);}else enemy(cc,entity,0);item={can,w,h,x,y};unitCache.set(key,item);while(unitCache.size>72)unitCache.delete(unitCache.keys().next().value);}const scale=kind==='plant'?size:1;c.drawImage(item.can,p.x-item.x*scale,p.y-item.y*scale,item.w*scale,item.h*scale);
}
function rangePreview(c,s,tile,selected){if(!tile||s.status!=='playing')return;if(selected==='shovel'||!Number.isInteger(tile.row)||!Number.isInteger(tile.col)||tile.row<0||tile.row>=E.ROWS||tile.col<0||tile.col>=E.COLS)return;const existing=E.plantAt(s,tile.row,tile.col),id=existing?.type||selected,d=E.PLANTS[id];if(!d)return;const p=existing||{...E.center(tile.row,tile.col),type:id,stage:'sprout'},light=E.lightRadius(s,p),circle=d.radius||d.healRadius||(d.heal?148:0)||light;c.save();c.fillStyle=ACCESSIBLE.focus;c.strokeStyle=ACCESSIBLE.focus;c.lineWidth=1.5;c.setLineDash([6,5]);if(circle){c.globalAlpha=.12;c.beginPath();c.arc(p.x,p.y,circle,0,TAU);c.fill();c.globalAlpha=.55;c.stroke();}else if(d.fire){c.globalAlpha=.1;c.fillRect(p.x,p.y-38,Math.max(0,970-p.x),76);c.globalAlpha=.55;c.strokeRect(p.x,p.y-38,Math.max(0,970-p.x),76);}c.restore();}
// A footprint and status glyph make eligibility readable without relying on colour.
function placementPreview(c,s,h,selected,time){
 if(!Number.isInteger(h.row)||!Number.isInteger(h.col)||h.row<0||h.row>=E.ROWS||h.col<0||h.col>=E.COLS)return;
 if(selected!=='shovel'&&!E.PLANTS[selected])return;
 const p=E.center(h.row,h.col),error=selected==='shovel'?E.canRemove(s,h.row,h.col):E.canPlant(s,selected,h.row,h.col),allowed=!error,ink=allowed?'#246445':'#a23e35';
 c.save();box(c,p.x-43,p.y-41,86,82,9,allowed?'#effff347':'#fff5ef42',allowed?'#f5ffe9':'#ffe0d3',2);box(c,p.x-40,p.y-38,80,76,7,null,ink,1);line(c,[[p.x-34,p.y+34],[p.x+34,p.y+34]],allowed?'#eeffcf':'#ffd9ca',2.5);
 if(allowed&&E.PLANTS[selected]){c.globalAlpha=.62;plant(c,selected,p.x,p.y,time,.74);c.globalAlpha=1;}
 const x=p.x+29,y=p.y-28;disc(c,x,y,8,allowed?'#f5fff4':'#fff6f2',ink,1.2);
 if(allowed)line(c,[[x-3.5,y],[x-1,y+2.5],[x+4,y-3]],ink,1.6);
 else{line(c,[[x-2.5,y-2.5],[x+2.5,y+2.5]],ink,1.6);line(c,[[x+2.5,y-2.5],[x-2.5,y+2.5]],ink,1.6);}
 c.restore();
}
function lanePressure(c,s){
 // Count is backed by a shape as well as colour and stays outside the planting grid.
 c.save();for(let row=0;row<5;row++){
  if(s.level.rows&&!s.level.rows.includes(row))continue;
  const incoming=s.enemies.filter(e=>e.row===row&&e.hp>0&&!e.underground&&lit(s,e.x,e.y)),danger=incoming.some(e=>e.x<330),y=163+row*86;
  box(c,933,y-19,43,38,12,danger?'#9a493de0':'#f6f9eac9',danger?'#ffe0c199':'#ffffff88',1);
  c.font='600 10px '+UI_FONT;c.textAlign='center';c.textBaseline='middle';c.fillStyle=danger?'#fff5e8':'#425d4e';c.fillText(String.fromCharCode(65+row),945,y);
  if(incoming.length){c.font='700 12px '+UI_FONT;c.fillText(incoming.length+'',963,y);}
  else line(c,[[959,y],[965,y]],'#76917c',1.5);
 }
 c.restore();
}
function scene(c,s,ui={}){
 c.clearRect(0,0,1000,620);c.save();const tier=ui.performanceTier==='low'?'low':'high',time=ui.reduced?0:ui.hitStop?lastAnimationTime:s.time,th=THEMES[s.level.theme]||THEMES.emerald,failedLane=Number.isInteger(s.failedRow)&&s.failedRow>=0&&s.failedRow<5,camera={x:0,y:0};if(!ui.hitStop)lastAnimationTime=time;renderCounters.frames++;
 if(s.status==='lost'&&failedLane&&(ui.failZoom||ui.deathReplay)&&!ui.reduced&&!ui.noShake){const q=ui.deathReplay?clamp(ui.deathReplay.progress):typeof ui.failZoom==='number'?clamp(ui.failZoom):1;c.translate(500,310);c.scale(1+.065*q,1+.065*q);c.translate(-500-10*q,-310+(310-E.center(s.failedRow,0).y)*q*.12);camera.x=10*q;}
 else if(ui.cameraBoss&&!ui.reduced&&!ui.noShake){const q=clamp(typeof ui.cameraBoss==='number'?ui.cameraBoss:ui.cameraBoss.strength),x=Number.isFinite(ui.cameraBoss.x)?ui.cameraBoss.x:650,y=Number.isFinite(ui.cameraBoss.y)?ui.cameraBoss.y:310;camera.x=(x-500)*q*.035;camera.y=(y-310)*q*.025;c.translate(500,310);c.scale(1+.045*q,1+.045*q);c.translate(-500-camera.x,-310-camera.y);}
 backdrop(c,s.level,time,{performanceTier:tier,camera});
 for(let row=0;row<5;row++){if(s.level.rows&&!s.level.rows.includes(row))continue;if(s.guards[row])mower(c,57,E.center(row,0).y+5,time);else line(c,[[39,E.center(row,0).y+19],[61,E.center(row,0).y+19]],'#807d5c',2);}
 for(const o of s.obstacles||[])rock(c,o,th);terrainMarks(c,s,time,tier);
 rangePreview(c,s,ui.range||ui.hover,ui.selected);fog(c,s,time,tier);lanePressure(c,s);flag(c,s,time);const bonds=(s.bonds||[]).slice(0,tier==='low'?6:12);for(const b of bonds)if(b.points?.every(p=>lit(s,p.x,p.y)))bondMark(c,b,time);
 if(ui.hover&&s.status==='playing')placementPreview(c,s,ui.hover,ui.selected,time);
 const entities=[...s.plants.map(p=>({kind:'plant',p})),...s.enemies.map(p=>({kind:'enemy',p}))].sort((a,b)=>a.p.row-b.p.row||a.p.x-b.p.x);
 for(const item of entities){const p=item.p;if(item.kind==='plant'){
  arrival(c,p,'plant',ui.reduced);
  if(tier!=='low')castShadow(c,p.x,p.y,'plant',s.level.theme);
  if(p.protected){shape(c,[[p.x+20,p.y+24],[p.x+30,p.y+23],[p.x+29,p.y+31],[p.x+25,p.y+35],[p.x+21,p.y+31]],'#dfd9a56b','#a9b181',1);line(c,[[p.x+23,p.y+28],[p.x+25,p.y+31],[p.x+28,p.y+26]],'#667b4c',1);}
  c.save();poseRig(c,p,'plant',time,{still:ui.reduced||ui.noShake});const recoil=ui.reduced||ui.noShake?0:(p.attack||0)/.2;c.translate(-recoil*4,0);if(!ui.reduced&&!ui.noShake&&p.age<.5){const k=Math.sin((Math.max(0,p.age)/.5)*TAU)*Math.exp(-p.age*5);c.translate(p.x,p.y+30);c.scale(1+k*.13,1-k*.17);c.translate(-p.x,-p.y-30);}if(p.disabled>0)c.globalAlpha=.55;const size=p.stage==='sprout'?.55+E.growthProgress(s,p)*.08:.9;inkUnit(c,{...p,y:p.y+((p.stage==='sprout')?10:0)},'plant',time,size,tier);c.restore();if(p.stage==='sprout'){leaf(c,p.x-9,p.y+29,-1.25,'#a7c975',.43);leaf(c,p.x+5,p.y+29,.25,'#b7d38a',.4);}if(p.stage==='flower'&&!p.branch)blossom(c,p);growthMark(c,p,s);health(c,p.x,p.y+42,p.hp,p.maxHp,32,false,ui.inspect===p.id);
  if(p.type==='mine'){const mx=p.x+21,my=p.y+6;if(p.armed){shape(c,[[mx,my-8],[mx-7,my+5],[mx+7,my+5]],'#e8d59b','#8b8353',1);line(c,[[mx,my-3],[mx,my]],'#82754c',1.4);disc(c,mx,my+3,.8,'#82754c');}else{disc(c,mx,my,7,'#dcd5ad','#828656',1);c.fillStyle='#69764c';c.font='bold 8px Arial';c.textAlign='center';c.fillText(Math.max(0,Math.ceil(8-p.age))+'',mx,my+3);}}
  if(p.disabled>0){line(c,[[p.x+16,p.y-15],[p.x+24,p.y-7]],'#706d51',2);line(c,[[p.x+24,p.y-15],[p.x+16,p.y-7]],'#706d51',2);}
  if(!p.stage&&p.level>1)for(let i=0;i<p.level-1;i++)disc(c,p.x-3+i*7,p.y+46,2.1,'#eee0a5','#827c46',.7);if(ui.inspect===p.id){c.strokeStyle='#f0e1ab';c.lineWidth=1.5;c.beginPath();c.ellipse(p.x,p.y+28,29,9,0,0,TAU);c.stroke();}
 }else if(!lit(s,p.x,p.y)){if(p.underground)oval(c,p.x,p.y+29,19,4,'#95aaa226',null);else silhouette(c,p.x,p.y,time,.23);}else{
  arrival(c,p,'enemy',ui.reduced);if(tier!=='low')castShadow(c,p.x,p.y,'enemy',s.level.theme);c.save();const winding=p.attackTarget!=null&&p.biteTimer>0;const attacking=p.attack||(winding?.07+.1*(1-Math.min(1,p.biteTimer/.65)):0);poseRig(c,{...p,attack:attacking},'enemy',time,{still:ui.noShake||ui.reduced});if(!ui.noShake&&!ui.reduced&&p.hit>0)c.translate(Math.min(2,p.hit*25),0);if(winding&&!ui.noShake&&!ui.reduced)c.translate(-3*(1-Math.min(1,p.biteTimer/.65)),0);inkUnit(c,p,'enemy',time,1,tier);c.restore();if(p.attackTarget!=null){const target=s.plants.find(q=>q.id===p.attackTarget);if(target){c.save();c.strokeStyle='#fff1c8';c.lineWidth=2;c.beginPath();c.arc(target.x,target.y+22,25,-Math.PI/2,-Math.PI/2+TAU*(1-Math.min(1,(p.biteTimer||0)/.8)));c.stroke();c.restore();}}if(!p.underground){const boss=E.ENEMIES?.[p.type]?.boss||p.type.startsWith('boss'),y=p.y-(boss?122:p.type==='brute'?90:p.type==='bat'?91:74);health(c,p.x,y,p.hp,p.maxHp,boss?56:32,true,true);enemyBadge(c,p,y);statusBadges(c,p,p.y+47);if(s.focus===p.id){line(c,[[p.x-25,p.y-25],[p.x-30,p.y-25],[p.x-30,p.y-12]],'#efe4b8',1.8);line(c,[[p.x+25,p.y-25],[p.x+30,p.y-25],[p.x+30,p.y-12]],'#efe4b8',1.8);shape(c,[[p.x-5,p.y+48],[p.x,p.y+42],[p.x+5,p.y+48]],'#efe4b8','#737d54',.8);}}
 }}
 for(const b of s.bullets){if(!lit(s,b.x,b.y))continue;const lob=b.kind==='lob',by=b.y-(lob?Math.sin(Math.max(0,Math.min(1,b.flight||0))*Math.PI)*80:0),col=lob?'#deb16b':b.air?'#c7d9e4':b.ember?'#e5a15a':b.frost?'#bde4e8':'#d3bb75';c.save();c.translate(b.x,by);if(!lob&&!ui.reduced){line(c,[[-19,0],[-7,0]],col+'55',b.ember?4:2.5);line(c,[[-12,0],[-5,0]],col+'aa',1.5);}oval(c,0,0,lob?8:b.ember?7:5.8,lob?7:b.ember?5:4.1,col,b.air?'#667f8f':b.frost?'#598b98':'#6c7643',1.2);oval(c,-2,-1,2.3,1.2,b.frost?'#f1fcf6':'#f4e6b0',null);if(lob){line(c,[[0,-5],[0,5]],'#ab8d4f',1);leaf(c,0,-6,-.8,'#8e9b58',.22);}else if(b.air){line(c,[[-2,-2],[2,0],[-2,2]],'#708b94',1);}else if(!b.frost&&!b.ember)line(c,[[1,-1],[3,1]],'#899257',1);c.restore();}
 const effects=Array.isArray(ui.effects)?ui.effects:Array.isArray(ui.effects?.active)?ui.effects.active:Array.isArray(s.effects)?s.effects:[],begin=Math.max(0,effects.length-LIMITS[tier].effects);renderCounters.drawnEffects=0;for(let fi=begin;fi<effects.length;fi++){const fx=effects[fi];if(!fx||fx.life<=0||fx.active===false)continue;if(['kill','hit','damage','combo','emerge','summon','enrage','bossEntrance','portal','shot','bite','biteWindup'].includes(fx.type)&&!lit(s,fx.x,fx.y))continue;const progress=ui.reduced?.75:clamp(1-fx.life/(fx.max||1));renderCounters.drawnEffects++;c.save();c.globalAlpha=ui.reduced?.75:clamp(fx.life/(fx.max||1));
  if(fx.type==='tactic'){const row=Number.isInteger(fx.row)?fx.row:Math.max(0,Math.min(4,Math.floor((fx.y-120)/86))),y=120+row*86;const wash=c.createLinearGradient(100,y,910,y);wash.addColorStop(0,'#d7fff033');wash.addColorStop(.5,'#c7f8ec66');wash.addColorStop(1,'#d7fff000');box(c,101,y+2,808,82,8,wash,null);line(c,[[106,y+3],[905,y+3]],'#eafff0',1.5);for(let i=0;i<(tier==='low'?8:18);i++){const x=120+i*(tier==='low'?105:45),yy=y+12+((progress*67+i*13)%57);line(c,[[x+3,yy-8],[x,yy]],'#e7fff4',1.5);}box(c,439,y+27,132,29,14,'#e8fff1ee','#ffffff',1);c.font='600 12px '+UI_FONT;c.textAlign='center';c.fillStyle='#285b48';c.fillText(ui.lang==='en'?'TACTICAL RAIN':'战术雨露',505,y+46);}
  else if(fx.type==='hit'){const r=5+progress*13;c.strokeStyle='#fff9df';c.lineWidth=2*(1-progress)+.5;c.beginPath();c.arc(fx.x,fx.y-10,r,0,TAU);c.stroke();for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;line(c,[[fx.x+Math.cos(a)*(r+3),fx.y-10+Math.sin(a)*(r+3)],[fx.x+Math.cos(a)*(r+7),fx.y-10+Math.sin(a)*(r+7)]],'#f5e6b8',1.4);}}
  else if(fx.type==='shot'){if(!ui.reduced){c.beginPath();c.arc(fx.x+25,fx.y-6,5+progress*7,-.75,.75);c.strokeStyle='#eff8d0';c.lineWidth=1.8;c.stroke();}}
  else if(fx.type==='beam'){if(!lit(s,fx.x,fx.y)||!lit(s,fx.endX,fx.y)){c.restore();continue;}line(c,[[fx.x+8,fx.y-5],[fx.endX,fx.y-5]],'#b4e0b1',6);line(c,[[fx.x+8,fx.y-5],[fx.endX,fx.y-5]],'#ecf7c8',2);}
  else if(fx.type==='bite'){const r=15+progress*16;c.strokeStyle='#fff2d5';c.lineWidth=2.5;for(let i=0;i<4;i++){const a=(i/4)*TAU;c.beginPath();c.moveTo(fx.x+Math.cos(a)*r,fx.y+Math.sin(a)*r);c.lineTo(fx.x+Math.cos(a)*(r+7),fx.y+Math.sin(a)*(r+7));c.stroke();}}
  else if(fx.type==='biteWindup'){c.strokeStyle='#ffe2a9';c.lineWidth=2;c.beginPath();c.ellipse(fx.x,fx.y+26,26,9,0,-Math.PI/2,-Math.PI/2+TAU*progress);c.stroke();}
  else if(fx.type==='boom'){const r=progress*152;c.globalAlpha*=.5;oval(c,fx.x,fx.y,r,r*.62,'#e8c981',null);c.globalAlpha=ui.reduced?.75:clamp(fx.life/(fx.max||1));for(let i=0;i<11;i++){const a=i*TAU/11;line(c,[[fx.x+Math.cos(a)*r*.65,fx.y+Math.sin(a)*r*.65],[fx.x+Math.cos(a)*r,fx.y+Math.sin(a)*r]],i%2?'#e8bb6b':'#bb6e4a',3);}}
  else if(fx.type==='sweep'){const x=55+progress*1020;mower(c,x,fx.y+5,time,true);for(let i=0;i<7;i++)line(c,[[x-22-i*8,fx.y+20],[x-26-i*8,fx.y+14-i%3*4]],'#b5c786',1.5);}
  else if(fx.type==='kill'&&fx.enemyType){const corpse={type:fx.enemyType,x:fx.x,y:fx.y+7,age:0,hit:0,slow:0,burn:0};poseRig(c,corpse,'enemy',0,{death:Math.min(1,progress*2.2),still:ui.reduced});enemy(c,corpse,0);}
  else if(['plantLost','plantDeath','remove'].includes(fx.type)&&fx.plantType){const corpse={type:fx.plantType,x:fx.x,y:fx.y+(fx.stage==='sprout'?10:0),age:50,stage:fx.stage||(fx.branch?'flower':'adult'),branch:fx.branch};poseRig(c,corpse,'plant',0,{death:Math.min(1,progress*1.35),still:ui.reduced});branchForm(c,corpse,0,false);plant(c,corpse.type,corpse.x,corpse.y,0,corpse.stage==='sprout'?.58:.9);branchForm(c,corpse,0,true);for(let i=0;i<3;i++)leaf(c,fx.x-8+i*9,fx.y+22+progress*17,-1+progress*2,'#a5af76',.25);}
  else if(fx.type==='collect'){const from=fx.from||fx,q=ui.reduced?0:1-Math.pow(1-progress,3),x=from.x+(125-from.x)*q,y=from.y+(55-from.y)*q-Math.sin(q*Math.PI)*55;c.save();c.translate(x,y);c.scale(.7-q*.28,.7-q*.28);energy(c,{id:0,x:0,y:0},0);c.restore();c.fillStyle='#8a6533';c.font='bold 14px Arial';c.textAlign='center';c.fillText('+'+fx.value,x+15,y-12);}
  else if(fx.type==='damage'){const text=Math.round(fx.value||0)+'',x=fx.x+7,y=fx.y-42-progress*23;c.font='bold 11px Arial';c.textAlign='center';c.strokeStyle='#30473f';c.lineWidth=2.5;c.strokeText(text,x,y);c.fillStyle='#f3e6ba';c.fillText(text,x,y);}
  else if(fx.type==='shield'){const r=27+progress*8;shape(c,[[fx.x,fx.y-r-5],[fx.x+r,fx.y-r*.5],[fx.x+r,fx.y+r*.45],[fx.x,fx.y+r],[fx.x-r,fx.y+r*.45],[fx.x-r,fx.y-r*.5]],'#d5dfc91a','#d9e8cd',1.8);line(c,[[fx.x-8,fx.y],[fx.x-1,fx.y+7],[fx.x+10,fx.y-8]],'#e8edd5',2);}
  else if(fx.type==='portal'){for(let i=0;i<3;i++){c.beginPath();c.ellipse(fx.x,fx.y+25-i*12*progress,20+progress*12,6+progress*4,0,0,TAU);c.strokeStyle='#e8dba8';c.lineWidth=1.7;c.stroke();}}
  else if(fx.type==='bossEntrance'){for(let i=0;i<9;i++){const a=i*TAU/9,r=35+progress*52;line(c,[[fx.x+Math.cos(a)*r,fx.y+30+Math.sin(a)*r*.32],[fx.x+Math.cos(a)*(r+10),fx.y+30+Math.sin(a)*(r+10)*.32]],'#dac995',2);}c.beginPath();c.ellipse(fx.x,fx.y+30,34+progress*42,10+progress*15,0,0,TAU);c.strokeStyle='#e1cd9b';c.lineWidth=2;c.stroke();}
  else if(fx.type==='bond'){if(fx.points?.every(p=>lit(s,p.x,p.y)))bondMark(c,fx,time,2);}
  else if(fx.type==='heal'){c.strokeStyle='#c5b4d47d';c.lineWidth=1.2;c.beginPath();c.ellipse(fx.x,fx.y+12,progress*105,progress*48,0,0,TAU);c.stroke();}
  else if(fx.type==='chain'){const points=fx.points||[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(!lit(s,a.x,a.y)||!lit(s,b.x,b.y))continue;const dx=b.x-a.x,dy=b.y-a.y;line(c,[[a.x,a.y-10],[a.x+dx*.3+6,a.y+dy*.3-16],[a.x+dx*.48-7,a.y+dy*.48-5],[a.x+dx*.73+4,a.y+dy*.73-14],[b.x,b.y-10]],'#c4d4e8',2.5);disc(c,b.x,b.y-10,5,'#e2e6bd');}}
  else if(fx.type==='push'){const end=fx.endX||fx.x+100;if(!lit(s,fx.x,fx.y)||!lit(s,end,fx.y)){c.restore();continue;}for(let i=0;i<3;i++){const y=fx.y-13+i*14;line(c,[[fx.x+progress*25,y],[end-14,y],[end-20,y-4],[end-14,y],[end-20,y+4]],'#cbdcbd',1.5);}}
  else if(fx.type==='bind'){const x=fx.endX||fx.x;if(lit(s,x,fx.y)){for(let i=0;i<3;i++){c.beginPath();c.moveTo(x-20+i*18,fx.y+33);c.quadraticCurveTo(x-29+i*18,fx.y+10,x-12+i*18,fx.y+24);c.strokeStyle='#b9c081';c.lineWidth=3;c.stroke();}}}
  else if(['grown','evolve','upgrade','bloom'].includes(fx.type)){for(let i=0;i<8;i++){const a=i*TAU/8+progress*.4,r=12+progress*36;leaf(c,fx.x+Math.cos(a)*r,fx.y-4+Math.sin(a)*r*.68,a+Math.PI/2,fx.branch==='b'?'#cfdec3':'#e5d79e',.28+progress*.12);}}
  else for(let i=0;i<6;i++){const a=i*TAU/6,r=progress*22;disc(c,fx.x+Math.cos(a)*r,fx.y+Math.sin(a)*r,2.3,fx.type==='hit'?'#d9c28b':th.accent);}c.restore();
 }
 for(const t of s.energyTokens){energy(c,t,time);if(t.value>25){c.fillStyle='#725c30';c.font='bold 10px Arial';c.textAlign='center';c.fillText(t.value,t.x,t.y+4);}}
 if(s.warning&&s.warning.life>0){c.save();c.globalAlpha=.55+.1*Math.sin(time*4);silhouette(c,962,222,0,.78);box(c,948,144,27,24,7,'#e6ddbcdd','#697657',1.4);c.fillStyle='#435943';c.font='bold 19px Arial';c.textAlign='center';c.fillText('?',962,162);c.font='bold 7px Arial';c.fillStyle=s.level.fog?'#d8dfc8':'#4a6347';c.fillText('NEXT WAVE',959,276);c.restore();}
 if(s.status==='lost'&&failedLane){const y=120+s.failedRow*86,g=c.createLinearGradient(90,0,600,0);g.addColorStop(0,'#b2574452');g.addColorStop(1,'#b2574400');c.fillStyle=g;c.fillRect(90,y,820,86);}
 c.fillStyle=th.weather==='eclipse'||th.weather==='night'?'#d0d7bc99':'#4b634799';c.font='9px Arial,sans-serif';c.textAlign='left';c.fillText('JIACHENG MA · SPROUT PATROL',107,575);c.textAlign='right';c.fillText(s.level.id+' · '+s.level.name.en.toUpperCase(),903,575);c.restore();
}
function portrait(c,type,kind='plant',options={}){
 if(kind&&typeof kind==='object'){options=kind;kind=options.kind||'plant';}const w=options.width||c.canvas?.width||192,h=options.height||c.canvas?.height||192,theme=PALETTES[options.theme]||PALETTES.emerald,pose=options.pose||'idle',boss=kind==='enemy'&&E.ENEMIES?.[type]?.boss;let time=options.reduced?0:Number(options.time)||0;c.clearRect(0,0,w,h);c.save();
 if(options.background!==false){const g=c.createRadialGradient(w*.35,h*.25,0,w*.5,h*.6,w*.8);g.addColorStop(0,ACCESSIBLE.paper);g.addColorStop(1,theme.lawn+'33');c.fillStyle=g;c.fillRect(0,0,w,h);}
 c.translate(w*.5,h*(kind==='plant'?.64:.65));const scale=w/(kind==='plant'?118:boss?220:150);c.scale(scale,scale);if(pose==='death'){c.translate(-5,-13);c.scale(.82,.82);}const e={id:1,type,x:0,y:0,age:pose==='growth'?8:60,hit:pose==='hit'?.08:0,attack:pose==='attack'?.2:0,stage:options.stage||(pose==='growth'?'sprout':pose==='bloom'?'flower':'adult'),branch:options.branch||null,level:pose==='growth'?1:options.stage==='flower'?3:2,enraged:pose==='bloom',hp:100,maxHp:100};poseRig(c,e,kind,time,{death:pose==='death'?.9:0,still:options.reduced});
 if(options.reduced)time=0;if(kind==='plant'){branchForm(c,e,time,false);plant(c,type,0,e.stage==='sprout'?10:0,time,e.stage==='sprout'?.6:1,e.hit);branchForm(c,e,time,true);if(e.stage==='flower'&&!e.branch)blossom(c,e);if(e.stage==='sprout'){leaf(c,-8,29,-1.2,'#b3cf90',.42);leaf(c,5,30,.3,'#b3cf90',.42);}}
 else{if(pose==='growth'){c.translate(0,10);c.scale(.87,.87);c.globalAlpha=.72;}enemy(c,e,time);}c.restore();if(options.background!==false){c.save();const badge=Math.max(18,Math.min(28,w*.17)),bx=w-badge*.8,by=h-badge*.8;box(c,bx-badge*.55,by-badge*.55,badge*1.1,badge*1.1,badge*.34,'#ffffffd9','#ffffff',1);const role=kind==='plant'?roleFor(type):enemyAbility(type)||'ranged';abilityGlyph(c,role==='wall'?'shield':role==='support'?'heal':role,bx,by,badge*.7);c.restore();}
}
function createPreview(c,s,ui={}){scene(c,s,{performanceTier:'high',...ui});return renderCounters;}
function metrics(){return {...renderCounters,landscapeCache:layerCache.size,unitCache:unitCache.size,effectCaps:{high:LIMITS.high.effects,low:LIMITS.low.effects},ambientCaps:{high:LIMITS.high.ambient,low:LIMITS.low.ambient}};}
root.GardenArt={plant,enemy,scene,backdrop,portrait,abilityGlyph,createPreview,setCanvasFactory,metrics,THEMES,PALETTES,ACCESSIBLE};
})(globalThis);
