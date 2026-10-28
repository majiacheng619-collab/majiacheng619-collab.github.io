'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('./game-runtime/garden-engine.js');
// Actual legal commands and simulation ticks: no patched energy, enemy health,
// completion counters or forced victory. This covers the whole first lesson.
function tend(s,tick){
 E.collectAll(s);
 if(s.tutorial&&!s.tutorial.done){
  if(s.tutorial.step===1)E.selectTutorial(s,'sunbud');
  else if(s.tutorial.step===2)E.place(s,'sunbud',2,0);
  else if(s.tutorial.step===3)for(const col of [1,2])E.place(s,'seed',2,col);
  else if(s.tutorial.step===5)E.selectTutorial(s,'shovel');
  else if(s.tutorial.step===6){const p=s.plants.find(p=>p.practice);if(p)E.remove(s,p.row,p.col);}
 }else if(tick%30===0){
  for(const row of s.level.rows||[0,1,2,3,4])
   for(const [type,cols] of [[s.deck.find(id=>E.PLANTS[id].produce),[0,1]],['seed',[2,3]],['wall',[6]],['skyreed',[4]],['lantern',[3]]])
    if(type&&s.deck.includes(type))for(const col of cols)E.place(s,type,row,col);
 }
}
test('first lesson can genuinely finish all waves and unlock the next mission',()=>{
 const p=E.freshProgress(),s=E.create(0,611);E.start(s);E.beginAttempt(p,s);
 const visited=new Set();
 for(let tick=0;tick<18000&&s.status==='playing';tick++){
  visited.add(s.tutorial.step);tend(s,tick);E.step(s);for(const event of E.drainEvents(s))if(event.type==='tutorial')visited.add(event.step);
  if(tick%300===0&&s.status==='playing')assert.ok(E.restore(E.snapshot(s),p),'Lesson checkpoint must restore');
 }
 assert.equal(s.status,'won');assert.equal(s.tutorial.done,true);
 for(const step of [0,1,2,3,4,5,6])assert.ok(visited.has(step),'Lesson step '+step+' is reachable');
 E.settle(p,s);assert.equal(p.cleared,1);assert.ok(E.create(1,612,undefined,p.cleared));
});
test('all twenty missions preserve legal live battle state through repeated save/import cycles',()=>{
 for(let index=0;index<20;index++){
  const p=E.freshProgress();p.cleared=index;p.stars.fill(3,0,index);
  let s=E.create(index,700+index,undefined,index);E.start(s);
  let saves=0;
  for(let tick=0;tick<12000&&s.status==='playing';tick++){
   tend(s,tick);E.step(s);E.drainEvents(s);
   if(tick%600===0&&s.status==='playing'){
    const restored=E.restore(E.snapshot(s),p);assert.ok(restored,'Mission '+index+' tick '+tick);
    assert.equal(restored.ticks,s.ticks);assert.equal(restored.energy,s.energy);
    assert.equal(E.importCode(E.exportCode(p,s)).ok,true);
    E.pause(restored);s=restored;saves++;
   }
  }
  assert.ok(saves>3,'Mission '+index+' exercises several real checkpoints');
 }
});
