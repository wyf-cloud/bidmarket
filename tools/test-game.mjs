import assert from 'node:assert/strict';
import { createRun, step, confirm, drain, STEP, CHAIN_WINDOW } from '../docs/assets/game-core.js';
import { FLOOR, jamCycle, levels } from '../docs/assets/game-levels.js';

// The walkthrough uses normal player inputs. Targeted edge cases also set up collisions.
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
    steer(typeof x==='function'?x():x,{...opts,jump:true,jumpHeld:true});
    until(`hop to ${x}`,()=>s.p.grounded&&land(),()=>steer(typeof x==='function'?x():x,{...opts,jumpHeld:true}),320);
  }
  function wait(seconds,opts={}){for(let i=0;i<Math.round(seconds/STEP)&&s.mode==='play';i++)tick(opts);}
  function end(){until('chapter checkpoint',()=>s.mode==='clear'||s.mode==='won',()=>tick({right:true,fire:true}));}
  return {s, tick, steer, until, go, hop, wait, end, events, rides, phases, attackPhases};
}
function verifyHealthSettlement(){
  const {s,go,tick,wait,events}=driver();
  go(166);
  const score=s.score;
  assert.ok(score>0 && s.totalPages>0);
  const foe=s.enemies[0];
  for(const hp of [2,1,0]){
    // Two simultaneous contacts must still count as just one hit.
    Object.assign(foe,{home:s.p.x+8,base:FLOOR,range:0,y:s.p.y});
    s.enemies=[foe,{...foe,id:1}];
    tick();
    assert.equal(s.p.hp,hp);
    assert.equal(s.mode,hp?'play':'lost');
    assert.equal(s.result===null,hp>0);
    if(hp){
      tick();assert.equal(s.p.hp,hp,'contact during invulnerability must not cost another heart');
      s.enemies=[];wait(1.35);
      assert.ok(s.p.grounded && s.p.flash===0);
    }
  }
  assert.equal(s.death,'damage');
  assert.deepEqual(s.result,{score,level:1,duration:Math.max(1,Math.round(s.duration)),pages:s.totalPages,certificates:s.certificates,won:false});
  assert.ok(Object.isFrozen(s.result));
  const {result,time,duration}=s;
  for(let i=0;i<120;i++)tick({right:true,jump:true,fire:true});
  assert.equal(s.mode,'lost');assert.equal(s.p.hp,0);assert.equal(s.result,result);
  assert.equal(s.time,time);assert.equal(s.duration,duration);assert.equal(s.score,score);
  assert.equal(events.filter(e=>e==='hurt').length,2);
  assert.equal(events.filter(e=>e==='lose').length,1);
  console.log('Edge: health 3 → 2 → 1 → 0, immediate settlement, frozen score and clock, one loss event.');
}
function verifyFallSettlement(){
  const {s,go,until,tick}=driver();
  go(740);
  until('first gap ends the run',()=>s.mode==='lost',()=>tick({right:true}));
  assert.equal(s.death,'fall');assert.equal(s.p.hp,0);
  assert.equal(s.result.score,s.score);assert.ok(s.score>0);
  console.log('Edge: falling directly settles the run with the collected points.');
}
function verifyShredSettlement(initial){
  const {s,until,tick,events}=driver(structuredClone(initial));
  until('floor route hits first shredder',()=>s.mode==='lost',()=>tick({right:true}));
  assert.equal(s.death,'shred');assert.equal(s.p.hp,0);
  assert.ok(s.count>0 && s.score>initial.score);
  assert.deepEqual(s.result,{score:s.score,level:3,duration:Math.max(1,Math.round(s.duration)),pages:s.totalPages,certificates:s.certificates,won:false});
  assert.equal(events.filter(e=>e==='lose').length,1);
  // A new run requires explicit confirmation and starts at the first chapter.
  confirm(s);
  assert.equal(s.index,0);assert.equal(s.mode,'play');assert.equal(s.p.hp,3);
  assert.equal(s.count,0);assert.equal(s.score,0);assert.equal(s.duration,0);
  assert.equal(s.totalPages,0);assert.equal(s.certificates,0);assert.equal(s.result,null);
  assert.equal(s.time,levels[0].time);assert.ok(s.pages.every(p=>!p.taken));
  console.log('Edge: shredder settles chapter three; confirming creates a fresh run from chapter one.');
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
  until('deadline expires',()=>s.mode==='lost',()=>tick(),3900);
  assert.equal(s.time,0);assert.equal(s.death,'time');assert.equal(s.p.hp,initial.p.hp);
  assert.deepEqual(s.result,{score:s.score,level:s.index+1,duration:Math.max(1,Math.round(s.duration)),pages:s.totalPages,certificates:s.certificates,won:false});
  assert.equal(events.filter(e=>e==='lose').length,1);
  console.log(`Edge: chapter ${s.index+1}, ${rate.toFixed(2)}× clock, one last-30 warning, immediate settlement on timeout.`);
}

function verifyJumpAndChain(){
  const height = held => {
    const {s,tick,until}=driver();
    const start=s.p.y;
    tick({jump:true,jumpHeld:true});
    if(!held)tick({jumpHeld:false});
    until('jump apex',()=>s.p.vy>=0,()=>tick({jumpHeld:held}));
    return start-s.p.y;
  };
  const low=height(false), high=height(true);
  assert.ok(low>=25 && high-low>=40,`short ${low}, high ${high}`);
  const {s,tick,wait}=driver();
  const foe=s.enemies[0];
  s.enemies=[];
  s.pages=[];
  function page(){s.pages.push({x:s.p.x+s.p.w/2,y:s.p.y+s.p.h/2});tick();}
  let total=0;
  for(const [i,points] of [25,35,45,55,55].entries()){
    page();total+=points;
    assert.equal(s.score,total);
    assert.equal(s.chain,i+1);
    assert.equal(s.chainLeft,CHAIN_WINDOW);
    wait(.1);
  }
  wait(CHAIN_WINDOW+.1);
  assert.equal(s.chain,0);
  page();assert.equal(s.score,total+25);assert.equal(s.chain,1);
  Object.assign(foe,{home:s.p.x+8,base:FLOOR,range:0,y:s.p.y});
  s.enemies=[foe];tick();assert.equal(s.p.hp,2);
  assert.equal(s.chain,0);assert.equal(s.chainLeft,0);
  console.log(`Edge: short jump ${low.toFixed(0)} px vs held jump ${high.toFixed(0)} px; chain bonus caps at +30, breaks on timeout and damage.`);
}

function walkthrough(){
  const d=driver(),{s,go,hop,until,tick,wait,end}=d;
  const next=()=>{assert.equal(s.mode,'clear');console.log(stats(s));confirm(s);assert.equal(s.p.hp,3);d.rides.clear();};
  go(245);hop(245);assert.ok(s.p.coffee>0);go(315);hop(450);go(475);hop(605);go(740);hop(925);go(975);hop(1120);hop(1270);hop(1390);go(1473);hop(1663);go(1740);hop(1860);hop(2015);hop(2160);end();next();
  go(252);hop(252);assert.ok(s.p.shield>0);go(320);hop(450);go(522);
  const ride=(i)=>{const r=s.solids.filter(r=>r.kind==='mover'||r.kind==='elevator'&&r.travel)[i];hop(()=>r.x+r.w*.5-14,{},()=>s.p.ride===r.id);};
  ride(0);hop(845);go(890);hop(1010);go(1040);go(1233);ride(1);hop(1530);go(1585);hop(1720);hop(1870);go(1950);hop(2152);go(2195);hop(2310);hop(2470);end();assert.ok(d.rides.has('mover'));next();
  verifyShredSettlement(s);
  go(228);hop(228);go(260);hop(390);hop(511);assert.ok(s.p.y+s.p.h<310);hop(625);hop(759);hop(824);hop(968);hop(1133);hop(1300);hop(1490);hop(1615);hop(1790);hop(1953);hop(2130);go(2164);hop(2360);hop(2490);end();next();
  go(217);hop(217);assert.ok(s.p.stapler);go(302);until('ghost stunned',()=>s.enemies.some(e=>e.stun>0),()=>tick({left:s.p.facing===1,fire:s.p.facing===-1}),100);
  go(315,{fire:true});hop(455,{fire:true});go(560,{fire:true});hop(692,{fire:true});go(756,{fire:true});hop(925,{fire:true});go(969,{fire:true});hop(1115,{fire:true});hop(1280,{fire:true});go(1430,{fire:true});hop(1627,{fire:true});go(1670,{fire:true});hop(1790,{fire:true});hop(1990,{fire:true});go(2080,{fire:true});hop(2263,{fire:true});hop(2390,{fire:true});end();next();
  verifyLateTimer(s);
  go(240);hop(240);go(338,{fire:true});hop(460,{fire:true});go(510,{fire:true});hop(693,{fire:true});go(764,{fire:true});hop(847,{fire:true});hop(995,{fire:true});go(1058,{fire:true});hop(1247,{fire:true});go(1300,{fire:true});hop(1413,{fire:true});go(1470,{fire:true});hop(1661,{fire:true});go(1855,{fire:true});ride(0);ride(1);hop(2305,{fire:true});hop(2410,{fire:true});go(2508,{fire:true});hop(2694,{fire:true});go(2740,{fire:true});hop(2865,{fire:true});end();assert.ok(d.rides.has('elevator')&&d.rides.has('mover'));next();
  verifyLateTimer(s);
  go(257);hop(377);go(420);go(475);go(490);hop(490);assert.ok(s.p.stapler);go(560,{fire:true});hop(659,{fire:true});go(767,{fire:true});hop(945,{fire:true});go(977,{fire:true});hop(1100,{fire:true});go(1141);hop(1141);go(1207,{fire:true});hop(1355,{fire:true});go(1520,{fire:true});
  assert.ok(s.count>=15,stats(s));go(1698);assert.equal(s.boss.max,6);assert.ok(!s.result);
  for(const phase of [1,2,3]){
    until(`attack pattern ${phase}`,()=>d.attackPhases.has(phase),()=>{if(s.p.grounded){tick({jump:true,jumpHeld:true});}else tick({jumpHeld:true});},560);
    until(`defeat phase ${phase}`,()=>s.boss.phase>phase||s.boss.dead,()=>{
      const b=s.boss, target=b.x<s.p.x ? Math.max(1675,b.x+155) : Math.max(1665,Math.min(1685,b.x-155));
      if(Math.abs(s.p.x-target)>8)d.steer(target,{fire:true});
      else if(s.p.facing!==Math.sign(b.x-s.p.x))tick({right:b.x>s.p.x,left:b.x<s.p.x});
      else tick({fire:true});
    },780);
  }
  assert.deepEqual([...d.phases],[1,2,3]);assert.ok(!s.result,'defeating the boss alone must not submit the bid');
  go(2435);end();assert.equal(s.result.won,true);assert.equal(s.result.level,6);assert.equal(d.events.filter(e=>e==='lose').length,0);assert.equal(d.events.filter(e=>e==='win').length,1);
  console.log(stats(s),s.result,`certificates=${s.certificates}`);
}

assert.deepEqual(jamCycle(1.80),{warn:true,height:0});
assert.ok(jamCycle(2.66).height>99);
assert.deepEqual(jamCycle(3.10),{warn:false,height:0});
verifyHealthSettlement();
verifyFallSettlement();
verifyJumpAndChain();
walkthrough();
