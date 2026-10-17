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
