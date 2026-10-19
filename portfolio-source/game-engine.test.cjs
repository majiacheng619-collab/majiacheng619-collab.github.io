'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const dir=path.join(__dirname,'game-runtime');
const context=vm.createContext({TextEncoder,TextDecoder,Buffer});
for(const name of ['data','engine']){
 const file=fs.readdirSync(dir).find(n=>new RegExp('^garden-'+name+'(?:\\.[a-f0-9]+)?\\.js$').test(n));
 vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),context,{filename:file});
}
const E=context.GardenEngine;
function fixture(){
 const s=E.create(1,611,undefined,1);E.start(s);s.energy=10000;s.phaseTime=10000;s.deck=Object.keys(E.PLANTS);return s;
}
function plant(s,type='wall',row=2,col=4,adult=false){
 s.cooldowns[type]=0;
 const result=E.place(s,type,row,col);assert.equal(result.ok,true,result.error);
 const p=result.plant;p.timer=10000;
 if(adult){p.stage='adult';p.level=2;p.age=40;p.maxHp=E.plantMaxHp(s,p);p.hp=p.maxHp;}
 return p;
}
function enemy(s,p,type='moss'){return E.spawn(s,{type,row:p.row,x:p.x+30,unscaled:true});}
function ticks(s,n){for(let i=0;i<n;i++)E.step(s);}

test('new sprouts remain during contact wind-up, then receive a visible bite',()=>{
 const s=fixture(),p=plant(s,'sunbud'),e=enemy(s,p),hp=p.hp;
 ticks(s,1);assert.equal(p.hp,hp);assert.equal(e.attackTarget,p.id);
 ticks(s,30);assert.equal(p.hp,hp);assert.ok(s.plants.includes(p));
 ticks(s,10);assert.equal(p.hp,0);assert.ok(!s.plants.includes(p));
 const events=E.drainEvents(s);assert.ok(events.some(e=>e.type==='biteWindup'));assert.ok(events.some(e=>e.type==='bite'&&e.sprout));
});
test('adult damage lands only on bite beats and preserves original sustained DPS',()=>{
 const s=fixture(),p=plant(s,'wall',2,4,true),e=enemy(s,p),hp=p.hp;
 ticks(s,38);assert.equal(p.hp,hp);
 ticks(s,1);assert.ok(Math.abs(hp-p.hp-e.damage*E.BITE_INTERVAL)<1e-8);assert.ok(e.attack>0);
 const after=p.hp;ticks(s,47);assert.equal(p.hp,after);ticks(s,1);assert.ok(p.hp<after);
});
test('pause freezes wind-up, growth, timers and all simulation state',()=>{
 const s=fixture(),p=plant(s),e=enemy(s,p);ticks(s,12);E.pause(s);
 const before=JSON.stringify(s);E.update(s,2);E.step(s);assert.equal(JSON.stringify(s),before);
 E.pause(s);ticks(s,26);assert.ok(p.hp>0);ticks(s,1);assert.equal(p.hp,0);assert.ok(e.attack>0);
});
test('switching to a new plant always starts a fresh wind-up',()=>{
 const s=fixture(),p=plant(s),e=enemy(s,p);ticks(s,35);
 s.plants=[];const next=plant(s);ticks(s,1);assert.equal(next.hp,next.maxHp);assert.equal(e.attackTarget,next.id);
 ticks(s,30);assert.equal(next.hp,next.maxHp);
});
test('shoved plants are not bitten after they leave contact range',()=>{
 const s=fixture(),p=plant(s,'sunbud'),e=enemy(s,p,'push');e.pushTimer=0;
 const hp=p.hp;ticks(s,1);assert.equal(p.col,3);assert.equal(p.hp,hp);assert.equal(e.attackTarget,null);
});
test('rooted enemies cannot shove or bite plants',()=>{
 const s=fixture(),p=plant(s),e=enemy(s,p,'push');e.pushTimer=0;e.root=1;
 ticks(s,40);assert.equal(p.col,4);assert.equal(p.hp,p.maxHp);assert.ok(!e.attackTarget);
});
test('a nursery shield absorbs a completed bite rather than first contact',()=>{
 const s=fixture(),p=plant(s,'sunbud'),guard=plant(s,'healer',1,4,true);
 guard.stage='flower';guard.branch='b';guard.level=3;guard.maxHp=E.plantMaxHp(s,guard);guard.hp=guard.maxHp;
 const e=enemy(s,p);ticks(s,38);assert.ok(!p.shieldUsed);ticks(s,1);
 assert.equal(p.shieldUsed,true);assert.equal(p.hp,p.maxHp);assert.ok(e.root>0);
});
test('growth carries the same health fraction into adulthood',()=>{
 const s=fixture(),p=plant(s);p.hp=p.maxHp/2;p.age=E.growthSeconds(s)-E.STEP/2;ticks(s,1);
 assert.equal(p.stage,'adult');assert.equal(p.hp,Math.round(p.maxHp/2));
});
test('flying and nonblocking plants do not start a bite',()=>{
 const s=fixture(),p=plant(s,'thorn'),e=enemy(s,p);ticks(s,50);assert.equal(e.attackTarget,null);assert.ok(e.x<p.x+30);
 const s2=fixture(),p2=plant(s2),e2=enemy(s2,p2,'wisp');ticks(s2,20);assert.equal(p2.hp,p2.maxHp);assert.equal(e2.attackTarget,null);
});
test('fixed-step update gives the same result at 30, 60 and 120 Hz',()=>{
 const states=[];for(const hz of [30,60,120]){const s=fixture(),p=plant(s,'wall',2,4,true);enemy(s,p);for(let i=0;i<hz*5;i++)E.update(s,1/hz);states.push(E.stateHash(s));}
 assert.equal(states[0],states[1]);assert.equal(states[1],states[2]);
});
test('ordinary saved progress and mid-bite snapshots round-trip',()=>{
 const progress=E.freshProgress();progress.cleared=1;
 const s=E.create(1,611,undefined,1);E.start(s);s.energy=1000;
 const type=s.deck.find(id=>!E.PLANTS[id].fuse),p=plant(s,type);enemy(s,p);ticks(s,10);
 const snap=E.snapshot(s),restored=E.restore(snap,progress);assert.ok(restored);assert.equal(restored.enemies[0].biteTimer,s.enemies[0].biteTimer);
 const code=E.exportCode(progress,s),imported=E.importCode(code);assert.equal(imported.ok,true);assert.ok(imported.battle);
 delete snap.data.enemies[0].biteTimer;delete snap.data.enemies[0].attackTarget;assert.ok(E.restore(snap,progress));
 snap.data.enemies[0].biteTimer=Infinity;assert.equal(E.restore(snap,progress),null);
});
test('current replays remain deterministic and obsolete 6.2 rules are rejected',()=>{
 const s=E.create(1,123,undefined,1);E.start(s);const type=s.deck[0];E.place(s,type,2,0);ticks(s,1000);
 const replay=E.replay(s),played=E.playReplay(replay);assert.equal(E.stateHash(played),E.stateHash(s));
 const old={...replay,version:'6.2.0'};assert.throws(()=>E.playReplay(old),/Unsupported replay/);
});

test('all 20 campaign chapters simulate and restore without invalid numeric state',()=>{
 const progress=E.freshProgress();progress.cleared=20;
 for(let i=0;i<20;i++){
  const s=E.create(i,611,undefined,20);E.start(s);s.tutorial=null;s.energy=10000;
  const rows=s.level.rows||[0,1,2,3,4],type=s.deck.find(id=>E.PLANTS[id].fire)||s.deck[0];
  for(const row of rows){s.cooldowns[type]=0;E.place(s,type,row,0);}
  ticks(s,3600);
  for(const item of [...s.plants,...s.enemies,...s.bullets])for(const key of ['x','y','hp','damage'])if(item[key]!==undefined)assert.ok(Number.isFinite(item[key]),`chapter ${i}: ${key}`);
  if(['playing','ready','paused'].includes(s.status))assert.ok(E.restore(E.snapshot(s),progress),`restore chapter ${i}`);
 }
});
test('6.2 battle migration updates engine metadata while preventing false replays',()=>{
 const progress=E.freshProgress();progress.cleared=1;
 const s=E.create(1,611,undefined,1);E.start(s);ticks(s,10);
 const snap=E.snapshot(s);snap.data.engineVersion='6.2.0';snap.data.dataHash='old-data-hash';
 const restored=E.restore(snap,progress);assert.ok(restored);assert.equal(restored.engineVersion,E.VERSION);assert.equal(restored.dataHash,E.DATA_HASH);assert.equal(restored.replayUnavailable,true);
 const r=E.replay(restored);assert.equal(r.version,'6.2.0');assert.equal(r.unavailable,true);assert.throws(()=>E.playReplay(r),/Historical battle/);
 const second=E.restore(E.snapshot(restored),progress);assert.equal(second.replayUnavailable,true);
});
test('6.0 replay execution remains historical, while restored battles migrate safely',()=>{
 const file=fs.readdirSync(dir).find(n=>/^garden-legacy6(?:\.[a-f0-9]+)?\.js$/.test(n));vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),context);
 const L=context.GardenLegacy6,progress=E.freshProgress();progress.cleared=1;
 const old=L.create(1,123,undefined,1);L.start(old);for(let i=0;i<120;i++)L.step(old);
 const historical=L.replay(old);assert.equal(E.stateHash(E.playReplay(historical)),L.stateHash(old));
 const migrated=E.restore(L.snapshot(old),progress);assert.ok(migrated);assert.equal(migrated.engineVersion,E.VERSION);assert.equal(migrated.replayUnavailable,true);
 E.pause(migrated);ticks(migrated,120);assert.ok(Number.isFinite(migrated.time));
 assert.equal(E.resolveReplayEngine(E.replay(migrated)),E);assert.throws(()=>E.playReplay(E.replay(migrated)),/Historical battle/);
});

test('shovers respect blocked terrain instead of creating an unusable occupied obstacle',()=>{
 const s=fixture(),p=plant(s,'sunbud'),e=enemy(s,p,'push');
 s.obstacles.push({row:p.row,col:p.col-1});e.pushTimer=0;ticks(s,1);
 assert.equal(p.col,4);assert.ok(p.disabled>0);assert.equal(e.attackTarget,p.id);
});
test('disabled shield plants cannot protect sprouts until they recover',()=>{
 const s=fixture(),p=plant(s,'sunbud'),guard=plant(s,'healer',1,4,true);
 guard.stage='flower';guard.branch='b';guard.level=3;guard.maxHp=E.plantMaxHp(s,guard);guard.hp=guard.maxHp;guard.disabled=10;
 enemy(s,p);ticks(s,39);assert.equal(p.hp,0);assert.ok(!p.shieldUsed);
});
test('piercing projectiles resolve stacked targets during the same swept collision',()=>{
 const s=fixture(),a=E.spawn(s,{type:'moss',row:2,x:500,unscaled:true}),b=E.spawn(s,{type:'moss',row:2,x:500,unscaled:true});
 const hp=a.hp;s.bullets.push({id:s.nextId++,kind:'straight',row:2,x:479,y:a.y,damage:10,pierce:2,hitIds:[]});
 ticks(s,1);assert.equal(a.hp,hp-10);assert.equal(b.hp,hp-10);assert.equal(s.bullets.length,0);
});
test('control plants remain ready while every target is outside their actual range',()=>{
 const s=fixture(),p=plant(s,'root',2,0,true);p.timer=0;
 const e=E.spawn(s,{type:'moss',row:p.row,x:p.x+E.PLANTS.root.range+5,unscaled:true});
 ticks(s,1);assert.equal(p.timer,0);assert.equal(e.root,0);
 e.x=p.x+200;ticks(s,1);assert.ok(e.root>0);assert.ok(p.timer>0);
});

test('6.3 replays use frozen rules and preserve their recorded state exactly',()=>{
 const L=context.GardenLegacy63;assert.ok(L);
 const s=L.create(1,733,undefined,1);L.start(s);L.place(s,s.deck[0],2,0);
 for(let i=0;i<1200;i++)L.step(s);
 const recording=L.replay(s),played=E.playReplay(recording);
 assert.equal(E.resolveReplayEngine(recording),L);assert.equal(L.stateHash(played),L.stateHash(s));
 const progress=E.freshProgress();progress.cleared=1;
 const resumed=E.restore(L.snapshot(s),progress);assert.ok(resumed);
 if(E.VERSION!==L.VERSION){assert.equal(resumed.engineVersion,E.VERSION);assert.equal(resumed.replayUnavailable,true);}
});

function firstWaveClearedWithGarden(full=false){
 const s=E.create(0,611);E.start(s);s.energy=10000;s.tutorial.step=4;
 if(full){s.level={...s.level,objective:null};for(const row of s.level.rows||[0,1,2,3,4])for(let col=0;col<9;col++)plant(s,'sunbud',row,col);}
 else plant(s,'sunbud',2,7);
 // A real simulation tick completes the first wave and enters the shovel lesson.
 s.wave=1;s.phase='combat';s.schedule=[];s.spawnIndex=0;s.enemies=[];
 ticks(s,1);return s;
}
test('shovel lesson finds a free tile when the preferred tile is already planted',()=>{
 const s=firstWaveClearedWithGarden(),original=E.plantAt(s,2,7),practice=s.plants.find(p=>p.practice);
 assert.equal(s.tutorial.step,5);assert.ok(practice);assert.notEqual(practice.id,original.id);
 assert.equal(new Set(s.plants.map(p=>p.row+','+p.col)).size,s.plants.length);
 E.selectTutorial(s,'shovel');assert.equal(E.canRemove(s,practice.row,practice.col),null);
 assert.equal(E.remove(s,practice.row,practice.col),true);assert.ok(s.plants.includes(original));
 assert.equal(s.tutorial.done,true);ticks(s,481);assert.equal(s.wave,2);
});
test('a full garden finishes the lesson without deleting plants or blocking the next wave',()=>{
 const s=firstWaveClearedWithGarden(true),ids=s.plants.map(p=>p.id);
 assert.equal(s.tutorial.done,true);assert.equal(s.tutorial.step,7);assert.equal(s.plants.some(p=>p.practice),false);
 ticks(s,481);assert.equal(s.wave,2);assert.deepEqual(s.plants.map(p=>p.id),ids);
});
test('snapshot extensions reject malformed perk, bond and command payloads at import',()=>{
 const progress=E.freshProgress();progress.cleared=1;
 const s=E.create(1,611,undefined,1);E.start(s);
 const checks=[
  d=>d.perks={},d=>d.perks=['unknown'],d=>d.perks=['rain','rain'],d=>d.perks=Array(4).fill('rain'),
  d=>d.perkChoices=['unknown'],d=>{d.phase='draft';d.perkChoices=['unknown'];},d=>d.bonds={},
  d=>d.bonds=[{id:'nursery',key:'bad',ids:[1,2],points:[null,null]}],
  d=>d.bonds=[{id:'unknown',key:'bad',ids:[1,2],points:[{x:0,y:0},{x:1,y:1}]}],
  d=>d.commands={},d=>d.commands=[{tick:-1,type:'auto',args:[true]}],
  d=>d.commands=[{tick:0,type:'unknown',args:[]}],
  d=>d.commands=[{tick:0,type:'place',args:['unknown',2,0]}],
  d=>d.commands=[{tick:0,type:'remove',args:[2,9]}],
  d=>d.commands=[{tick:1,type:'auto',args:[true]}]
 ];
 for(const mutate of checks){
  const snap=E.snapshot(s);mutate(snap.data);assert.equal(E.restore(snap,progress),null);
  const text=JSON.stringify({version:6,progress,battle:snap});
  const code='SP6-'+E.crc(text)+'-'+Buffer.from(text).toString('base64');
  assert.equal(E.importCode(code).ok,false);
 }
 assert.ok(E.restore(E.snapshot(s),progress));
});
test('valid endless drafts and recorded card selections still round-trip',()=>{
 const progress=E.freshProgress();progress.cleared=20;
 const s=E.create(1,611,undefined,20,{mode:'endless'});E.start(s);
 E.selectTutorial(s,s.deck.find(id=>id!=='sunbud'));
 s.phase='draft';s.perkChoices=['rain','roots','shell'];s.perks=['tempo'];
 const restored=E.restore(E.snapshot(s),progress);assert.ok(restored);
 E.pause(restored);assert.equal(E.choosePerk(restored,'rain'),true);
 assert.equal(restored.phase,'break');assert.ok(restored.perks.includes('rain'));
});

test('6.4 recordings run with frozen rules and old battle saves gain Dewfall safely',()=>{
 const L=context.GardenLegacy64;assert.ok(L);
 const s=L.create(1,733,undefined,1);L.start(s);L.place(s,s.deck[0],2,0);
 for(let i=0;i<1200;i++)L.step(s);
 const recording=L.replay(s);assert.equal(E.resolveReplayEngine(recording),L);
 assert.equal(L.stateHash(E.playReplay(recording)),L.stateHash(s));
 const progress=E.freshProgress();progress.cleared=1;
 const resumed=E.restore(L.snapshot(s),progress);assert.ok(resumed);
 assert.equal(resumed.engineVersion,E.VERSION);assert.equal(resumed.replayUnavailable,true);
 assert.equal(resumed.tacticCooldown,E.TACTIC.initialCharge);assert.equal(resumed.tacticsUsed,0);
 assert.throws(()=>E.playReplay(E.replay(resumed)),/Historical battle/);
});
test('Dewfall heals only its lane, slows grounded targets and consumes exactly one charge',()=>{
 const s=fixture(),p=plant(s,'wall',2,4,true),other=plant(s,'sunbud',1,0);
 p.hp=p.maxHp*.2;other.hp=other.maxHp*.2;
 const hp=p.hp,otherHp=other.hp,e=E.spawn(s,{type:'moss',row:2,x:800,unscaled:true});
 const flyer=E.spawn(s,{type:'wisp',row:2,x:800,unscaled:true});
 const underground=E.spawn(s,{type:'moss',row:2,x:800,unscaled:true});underground.underground=true;
 assert.equal(E.castTactic(s,2).error,'cooldown');assert.equal(s.commands.filter(c=>c.type==='tactic').length,0);
 s.tacticCooldown=0;assert.equal(E.castTactic(s,2).ok,true);
 assert.equal(p.hp,hp+p.maxHp*E.TACTIC.healFraction);assert.equal(other.hp,otherHp);
 assert.equal(e.slow,E.TACTIC.slowSeconds);assert.equal(flyer.slow,0);assert.equal(underground.slow,0);
 assert.equal(s.tacticsUsed,1);assert.equal(s.tacticCooldown,E.TACTIC.cooldown);
 assert.equal(E.castTactic(s,2).error,'cooldown');assert.equal(s.tacticsUsed,1);
 assert.equal(s.commands.filter(c=>c.type==='tactic').length,1);
 E.pause(s);const paused=JSON.stringify(s);E.update(s,1);E.step(s);assert.equal(JSON.stringify(s),paused);
 E.pause(s);ticks(s,60);assert.ok(Math.abs(s.tacticCooldown-(E.TACTIC.cooldown-1))<1e-8);
});
test('Dewfall rejects tutorial, inactive, empty and invalid lanes without changing state',()=>{
 const s=E.create(0,611);E.start(s);s.tacticCooldown=0;
 assert.equal(E.castTactic(s,2).error,'tutorial');
 s.tutorial.done=true;
 for(const row of [-1,5,2.5,NaN,'2'])assert.equal(E.castTactic(s,row).error,'lane');
 assert.equal(E.castTactic(s,2).error,'empty');assert.equal(s.tacticCooldown,0);assert.equal(s.tacticsUsed,0);
 s.level={...s.level,rows:[2]};assert.equal(E.castTactic(s,1).error,'lane');
 E.pause(s);assert.equal(E.castTactic(s,2).error,'inactive');
});
test('paused tutorial selection cannot advance or append commands, and planting requires a valid grass tile',()=>{
 const s=E.create(0,611);E.start(s);s.tutorial.step=1;E.pause(s);
 const before=JSON.stringify(s);E.selectTutorial(s,'sunbud');assert.equal(JSON.stringify(s),before);
 E.pause(s);E.selectTutorial(s,'sunbud');assert.equal(s.tutorial.step,2);
 for(const [r,c] of [[NaN,0],[2,.5],[2,9],[-1,0]])assert.equal(E.canPlant(s,'sunbud',r,c),'outside');
 assert.equal(E.canPlant(s,'sunbud',2,1),'tutorial');assert.equal(E.canPlant(s,'sunbud',2,0),null);
});
test('Dewfall commands replay deterministically at the exact activation tick',()=>{
 const s=E.create(1,123,undefined,1);E.start(s);
 for(let n=0;n<4000&&!s.enemies.length;n++)E.step(s);
 assert.ok(s.enemies.length);assert.equal(E.castTactic(s,s.enemies[0].row).ok,true);
 ticks(s,120);const recording=E.replay(s),played=E.playReplay(recording);
 assert.equal(E.stateHash(played),E.stateHash(s));assert.equal(played.tacticsUsed,1);
});
test('current Dewfall saves round-trip their charge and reject missing or invalid tactic fields',()=>{
 const progress=E.freshProgress();progress.cleared=1;
 const s=E.create(1,611,undefined,1);E.start(s);ticks(s,300);
 const resumed=E.restore(E.snapshot(s),progress);assert.ok(resumed);
 assert.equal(resumed.tacticCooldown,s.tacticCooldown);assert.equal(resumed.tacticsUsed,0);assert.ok(!resumed.replayUnavailable);
 const changes=[d=>{delete d.tacticCooldown;delete d.tacticsUsed;},d=>d.tacticCooldown=-1,d=>d.tacticCooldown=46,d=>d.tacticsUsed=.5,d=>d.tacticsUsed=-1,d=>d.commands.push({tick:0,type:'tactic',args:[5]})];
 for(const mutate of changes){const snap=E.snapshot(s);mutate(snap.data);assert.equal(E.restore(snap,progress),null);}
});

test('first lesson accepts shooters only on its two glowing middle tiles before combat',()=>{
 const s=E.create(0,611);E.start(s);s.energy=10000;s.tutorial.step=2;
 plant(s,'sunbud',2,0);assert.equal(s.tutorial.step,3);
 const before=JSON.stringify(s);
 for(const [type,row,col] of [['seed',2,3],['seed',2,4],['sunbud',2,1]]){
  assert.equal(E.place(s,type,row,col).error,'tutorial');
  assert.equal(JSON.stringify(s),before);
 }
 plant(s,'seed',2,1);s.phaseTime=0;ticks(s,1);
 assert.equal(s.phase,'prep');assert.equal(s.tutorial.step,3);assert.equal(s.wave,0);
 plant(s,'seed',2,2);ticks(s,2);
 assert.equal(s.tutorial.step,4);assert.equal(s.wave,1);
});
test('resuming an older freely planted tutorial preserves its board and can still begin combat',()=>{
 const s=E.create(0,611);E.start(s);s.energy=10000;s.tutorial.step=4;
 plant(s,'sunbud',2,0);plant(s,'sunbud',2,1);plant(s,'seed',2,4);
 // This layout was legal under the old step-three rules, but blocks a glowing tile.
 s.tutorial.step=3;const before=s.plants.map(p=>p.id),restored=E.restore(E.snapshot(s),E.freshProgress());
 assert.ok(restored);assert.equal(restored.tutorial.legacyPlacement,true);
 assert.equal(restored.replayUnavailable,true);assert.deepEqual(restored.plants.map(p=>p.id),before);
 E.pause(restored);plant(restored,'seed',2,5);restored.phaseTime=0;ticks(restored,2);
 assert.equal(restored.tutorial.step,4);assert.equal(restored.wave,1);
});
test('a conforming tutorial snapshot retains the glowing-tile restrictions after resume',()=>{
 const s=E.create(0,611);E.start(s);s.energy=10000;s.tutorial.step=2;
 plant(s,'sunbud',2,0);plant(s,'seed',2,1);
 const restored=E.restore(E.snapshot(s),E.freshProgress());assert.ok(restored);
 E.pause(restored);restored.cooldowns.seed=0;
 assert.equal(E.canPlant(restored,'seed',2,3),'tutorial');
 assert.equal(E.canPlant(restored,'seed',2,2),null);
 plant(restored,'seed',2,2);restored.phaseTime=0;ticks(restored,2);
 assert.equal(restored.tutorial.step,4);assert.equal(restored.wave,1);
});

test('an older step-four preparation with freely placed shooters is not held by the new lesson',()=>{
 const s=E.create(0,611);E.start(s);s.energy=10000;s.tutorial.step=4;
 plant(s,'sunbud',2,0);plant(s,'seed',2,4);plant(s,'seed',2,5);
 const restored=E.restore(E.snapshot(s),E.freshProgress());assert.ok(restored);
 assert.equal(restored.tutorial.legacyPlacement,true);
 E.pause(restored);restored.phaseTime=0;ticks(restored,2);assert.equal(restored.wave,1);
});
