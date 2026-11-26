import assert from 'node:assert/strict';
import { createRun, step, confirm, drain, STEP } from '../docs/assets/game-core.js';
import { jamCycle, levels } from '../docs/assets/game-levels.js';

// Both the walkthrough and targeted checks use the public game inputs only.
const stats = s => `${s.index+1}:${s.mode} x=${s.p.x.toFixed(0)} bottom=${(s.p.y+s.p.h).toFixed(0)} pages=${s.count} hp=${s.p.hp} t=${s.age.toFixed(2)}${s.death ? ' last='+s.death : ''}`;
function driver(s=createRun(true)) {
  const events = [], rides = new Set(), phases = new Set(), attackPhases = new Set();
  let attacks=0;
  function tick(input={}) {
    step(s,input);
    events.push(...drain(s));
    if(s.p.ride>=0)rides.add(s.solids[s.p.ride].kind);
    if(s.boss?.active){phases.add(s.boss.phase);if(s.boss.attack>attacks){attackPhases.add(s.boss.phase);attacks=s.boss.attack;}}
  }
  function steer(target,opts={}) {
    const d=target-s.p.x, v=s.p.vx;
    const friction=s.p.slip?140:s.p.grounded?2400:1710;
    const direction=Math.abs(d)<=2 ? 0 : Math.abs(d)<v*v/(2*friction)+2 && Math.sign(v)===Math.sign(d) ? 0 : Math.sign(d);
    tick({...opts,right:direction>0,left:direction<0});
  }
  function until(label, done, act=()=>tick(), n=960){
    for(let i=0;i<n;i++){
      if(done())return;
      if(s.mode!=='play')break;
      act();
    }
    assert.ok(done(),`${label}: ${stats(s)}`);
  }
  function go(x,opts={}){
    until(`go ${x}`,()=>Math.abs(s.p.x-x)<=4 && Math.abs(s.p.vx)<30&&s.p.grounded,()=>steer(x,opts));
  }
  function hop(x,opts={},land=()=>true){
    assert.ok(s.p.grounded,`hop from a surface: ${stats(s)}`);
    steer(typeof x==='function'?x():x,{...opts,jump:true});
    until(`hop to ${x}`,()=>s.p.grounded&&land(),()=>steer(typeof x==='function'?x():x,opts),320);
  }
  function wait(seconds,opts={}){for(let i=0;i<Math.round(seconds/STEP)&&s.mode==='play';i++)tick(opts);}
  function end(){until('chapter checkpoint',()=>s.mode==='clear'||s.mode==='won',()=>tick({right:true,fire:true}));}
  return {s, tick, steer, until, go, hop, wait, end, events, rides, phases, attackPhases};
}
function verifyShredRetry(initial){
  const {s,until,tick,events}=driver(structuredClone(initial));
  const prior={...s.base},attempts=s.attempts;
  until('floor route hits first shredder',()=>s.mode==='retry',()=>tick({right:true}));
  assert.equal(s.death,'shred');assert.equal(s.attempts,attempts-1);assert.equal(s.p.hp,3);
  assert.ok(s.count>0&&s.score>prior.score);assert.equal(events.filter(e=>e==='lose').length,1);
  confirm(s);
  assert.equal(s.index,2);assert.equal(s.mode,'play');assert.equal(s.attempts,attempts-1);
  assert.equal(s.count,0);assert.equal(s.time,levels[2].time);assert.ok(s.pages.every(p=>!p.taken));
  assert.deepEqual({score:s.score,totalPages:s.totalPages,certificates:s.certificates},prior);
  console.log('Edge: shredder consumes one attempt; chapter-only progress is reset.');
}
function verifyLateTimer(initial){
  const {s,until,tick,wait,events}=driver(structuredClone(initial));
  const rate=s.index===4?1.30:1;
  assert.ok(s.time>30&&!s.fast);
  tick();assert.ok(Math.abs(s.time-(s.level.time-rate*STEP))<1e-10);
  until('last-30 gate',()=>s.time<=30,()=>tick(),15000);
  assert.ok(s.fast);assert.ok(s.time>30-rate*STEP-1e-8);
  assert.equal(events.filter(e=>e==='warn').length,1);
  wait(2);assert.ok(s.fast);assert.equal(events.filter(e=>e==='warn').length,1);
  until('deadline expires',()=>s.mode==='retry',()=>tick(),3900);
  assert.equal(s.time,0);assert.equal(s.death,'time');assert.equal(s.attempts,initial.attempts-1);
  confirm(s);assert.ok(!s.fast);assert.equal(s.time,s.level.time);
  console.log(`Edge: chapter ${s.index+1}, ${rate.toFixed(2)}× clock, one last-30 warning, full timer restored on retry.`);
}

function walkthrough(){
  const d=driver(),{s,go,hop,until,tick,wait,end}=d;
  const next=()=>{assert.equal(s.mode,'clear');console.log(stats(s));confirm(s);d.rides.clear();};
  go(245);hop(245);assert.ok(s.p.coffee>0);go(315);hop(450);go(475);hop(605);go(740);hop(925);go(975);hop(1120);hop(1270);hop(1390);go(1473);hop(1663);go(1740);hop(1860);hop(2015);hop(2160);end();next();
  go(252);hop(252);assert.ok(s.p.shield>0);go(320);hop(450);go(522);
  const ride=(i)=>{const r=s.solids.filter(r=>r.kind==='mover'||r.kind==='elevator'&&r.travel)[i];hop(()=>r.x+r.w*.5-14,{},()=>s.p.ride===r.id);};
  ride(0);hop(845);go(890);hop(1010);go(1040);go(1233);ride(1);hop(1530);go(1585);hop(1720);hop(1870);go(1950);hop(2152);go(2195);hop(2310);hop(2470);end();assert.ok(d.rides.has('mover'));next();
  verifyShredRetry(s);
  go(228);hop(228);go(260);hop(390);hop(511);assert.ok(s.p.y+s.p.h<310);hop(625);hop(759);hop(824);hop(968);hop(1133);hop(1300);hop(1490);hop(1615);hop(1790);hop(1953);hop(2130);go(2164);hop(2360);hop(2490);end();next();
  go(217);hop(217);assert.ok(s.p.stapler);go(302);until('ghost stunned',()=>s.enemies.some(e=>e.stun>0),()=>tick({left:s.p.facing===1,fire:s.p.facing===-1}),100);
  go(315,{fire:true});hop(455,{fire:true});go(560,{fire:true});hop(692,{fire:true});go(756,{fire:true});hop(925,{fire:true});go(969,{fire:true});hop(1115,{fire:true});hop(1280,{fire:true});go(1430,{fire:true});hop(1627,{fire:true});go(1670,{fire:true});hop(1790,{fire:true});hop(1990,{fire:true});go(2080,{fire:true});hop(2263,{fire:true});hop(2390,{fire:true});end();next();
  verifyLateTimer(s);
  go(240);hop(240);go(338,{fire:true});hop(460,{fire:true});go(510,{fire:true});hop(693,{fire:true});go(764,{fire:true});hop(847,{fire:true});hop(995,{fire:true});go(1058,{fire:true});hop(1247,{fire:true});go(1300,{fire:true});hop(1413,{fire:true});go(1470,{fire:true});hop(1661,{fire:true});go(1855,{fire:true});ride(0);ride(1);hop(2305,{fire:true});hop(2410,{fire:true});go(2508,{fire:true});hop(2694,{fire:true});go(2740,{fire:true});hop(2865,{fire:true});end();assert.ok(d.rides.has('elevator')&&d.rides.has('mover'));next();
  verifyLateTimer(s);
  go(257);hop(377);go(420);go(475);go(490);hop(490);assert.ok(s.p.stapler);go(560,{fire:true});hop(659,{fire:true});go(767,{fire:true});hop(945,{fire:true});go(977,{fire:true});hop(1100,{fire:true});go(1141);hop(1141);go(1207,{fire:true});hop(1355,{fire:true});go(1520,{fire:true});
  assert.ok(s.count>=15,stats(s));go(1698);assert.equal(s.boss.max,6);assert.ok(!s.result);
  for(const phase of [1,2,3]){
    until(`attack pattern ${phase}`,()=>d.attackPhases.has(phase),()=>{if(s.p.grounded){tick({jump:true});}else tick();},560);
    until(`defeat phase ${phase}`,()=>s.boss.phase>phase||s.boss.dead,()=>{
      const b=s.boss, target=b.x<s.p.x ? Math.max(1675,b.x+155) : Math.max(1665,Math.min(1685,b.x-155));
      if(Math.abs(s.p.x-target)>8)d.steer(target,{fire:true});
      else if(s.p.facing!==Math.sign(b.x-s.p.x))tick({right:b.x>s.p.x,left:b.x<s.p.x});
      else tick({fire:true});
    },780);
  }
  assert.deepEqual([...d.phases],[1,2,3]);assert.ok(!s.result,'defeating the boss alone must not submit the bid');
  go(2435);end();assert.equal(s.result.won,true);assert.equal(s.result.level,6);assert.ok(s.attempts===3);assert.equal(d.events.filter(e=>e==='win').length,1);
  console.log(stats(s),s.result,`certificates=${s.certificates}`);
}

assert.deepEqual(jamCycle(1.80),{warn:true,height:0});
assert.ok(jamCycle(2.66).height>99);
assert.deepEqual(jamCycle(3.10),{warn:false,height:0});
walkthrough();
