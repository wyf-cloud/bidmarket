import { levels, FLOOR, jamCycle } from './game-levels.js';
export const STEP = 1/120, CHAIN_WINDOW = 2.1;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const approach = (v,to,by) => v<to ? Math.min(v+by,to) : Math.max(v-by,to);
const crossX=(a,b,pad=0)=>a.x+a.w>b.x+pad && a.x<b.x+b.w-pad;
const hit=(a,b)=>crossX(a,b) && a.y+a.h>b.y && a.y<b.y+b.h;
const names = {coffee:'咖啡冲刺',usb:'U 盘护盾',stapler:'订书机已装载'};
const failureText = {fall:'掉进了漏页坑',shred:'碰到了碎纸机',time:'本章截止时间已到',damage:'三颗心已耗尽'};
const size = {typo:[33,34],bug:[38,25],ghost:[44,53]};

export function createRun(play = false) {
  const s={index:0, score:0, totalPages:0, certificates:0, duration:0, mode:'ready', events:[], result:null};
  load(s,0);
  s.mode=play?'play':'ready';
  return s;
}
function load(s,index) {
  const level=levels[index];
  Object.assign(s,{index,level,age:0,time:level.time,count:0,earned:false,mode:'brief',message:'',death:null,hintTime:0,sceneTime:0,
    fast:false,locked:false,chain:0,chainLeft:0,bolts:[],risks:[],bits:[],
    p:{x:82,y:FLOOR-44,w:28,h:44,vx:0,vy:0,facing:1,hp:3,grounded:true,ride:-1,coyote:.1,buffer:0,jumpRise:false,flash:0,coffee:0,shield:0,stapler:false,cool:0,slip:false},
    solids:level.solids.map((r,i)=>({...r,id:i,bx:r.x,by:r.y,dx:0,dy:0,used:false})), pages:level.pages.map(r=>({...r,taken:false})),
    enemies:level.enemies.map((r,i)=>({...r,id:i,home:r.x,base:r.y,w:size[r.kind][0],h:size[r.kind][1], y:r.y-size[r.kind][1], active:r.kind!=='ghost',dead:false,stun:0,kick:0,dir:-1})),
    boss:level.boss ? {x:level.boss.x,y:FLOOR-82,w:104,h:82,hp:9,max:9,phase:1,active:false,dead:false,flash:0,clock:1.45,wind:0,burst:0,attack:0,dir:-1,dash:0,vy:0} : null});
}
function emit(s,id){s.events.push(id);}
export function drain(s){return s.events.splice(0);}
function notice(s,msg,seconds=2.4){s.message=msg;s.hintTime=seconds;}
function particles(s,x,y,color,n=7,paper=false){
  for(let i=0;i<n;i++){
    const a=((i*2.39996+s.age*5)%(2*Math.PI));
    const speed=55+(i*41)%136;
    s.bits.push({x,y,dx:Math.cos(a)*speed,dy:-75+Math.sin(a)*speed,life:.35+(i%3)*.14,max:.65,color,paper,spin:i%2?-5:6,r:i*.8});
  }
}
function finish(s,won){
  if(s.result)return;
  s.mode=won?'won':'lost';s.sceneTime=0;
  s.result=Object.freeze({score:s.score,level:s.index+1,duration:Math.max(1,Math.round(s.duration)),pages:s.totalPages,certificates:s.certificates,won});
  emit(s,won?'win':'lose');
}
function fail(s,why) {
  if(s.mode!=='play')return;
  s.message=failureText[why];s.death=why;
  if(why==='fall'||why==='shred')s.p.hp=0;
  particles(s,s.p.x+14,Math.min(FLOOR-15,s.p.y+20),'#f6fbff',13,true);
  finish(s,false);
}
export function confirm(s){
  if(s.mode==='ready' || s.mode==='brief'){s.mode='play';s.sceneTime=0;emit(s,'key');}
  else if(s.mode==='clear'){load(s,s.index+1);s.mode='play';notice(s,s.level.note,5);emit(s,'key');}
  else if(s.mode==='won' || s.mode==='lost') {Object.assign(s,createRun(true));emit(s,'key');}
}
function damage(s,source){
  const p=s.p;
  if(s.mode!=='play' || p.flash>0 || p.shield>0)return;
  p.hp=Math.max(0,p.hp-1);s.chain=0;s.chainLeft=0;p.jumpRise=false;
  if(p.hp===0){fail(s,'damage');return;}
  p.flash=1.30;p.vy=-300;p.vx=p.x+p.w/2 < source ? -285 : 285;p.grounded=false;p.ride=-1;
  emit(s,'hurt');particles(s,p.x+14,p.y+22,'#ff7285',8);
}
function collect(s,r){
  r.taken=true;s.count++;s.totalPages++;
  s.chain++;s.chainLeft=CHAIN_WINDOW;
  const bonus=Math.min(30,(s.chain-1)*10);
  s.score+=25+bonus;emit(s,'page');
  particles(s,r.x,r.y,bonus===30?'#fff2ac':'#ffd16f',bonus===30?9:6,true);
  if(!s.earned && s.count>=s.level.bonus){
    s.earned=true;s.certificates++;s.score+=300;
    notice(s,'加分资质证书 +300',3);emit(s,'certificate');
  }else if(s.count===s.level.required)notice(s,s.boss?'章节齐备 · 尽量多收集以削弱护甲':'章节齐备 · 校对旗已开放');
}
function useBlock(s,r){
  if(r.used || !r.item)return;
  r.used=true;const p=s.p;
  if(r.item==='coffee')p.coffee=8;
  if(r.item==='usb')p.shield=8;
  if(r.item==='stapler')p.stapler=true;
  emit(s,r.item);
  particles(s,r.x+r.w/2,r.y,'#8bf0ff',12);
  notice(s,names[r.item]+(r.item==='stapler'?' · X / 发射':' · 8 秒'));
}
function defeatFoe(s,e){
  e.dead=true;s.score+=e.kind==='bug'?100:75;
  emit(s,'stomp');particles(s,e.x+e.w/2,e.y+e.h/2,e.kind==='bug'?'#a1f0bd':'#cfb9fd',10,true);
}
function bossHit(s){
  const b=s.boss;
  if(!b?.active || b.flash>0 || b.dead)return false;
  b.hp--;b.flash=.57;s.score+=100;emit(s,'stomp');
  particles(s,b.x+b.w/2,b.y+20,'#ffab80',11,true);
  if(b.hp===0){
    b.dead=true;s.locked=false;s.risks.length=0;s.score+=700;
    emit(s,'certificate');notice(s,'废标风险已清除 · 前往投标窗口',4);return true;
  }
  const phase=1+Math.floor((b.max-b.hp)/(b.max/3));
  if(phase!==b.phase){
    b.phase=phase;b.clock=1.25;b.wind=0;b.dash=0;b.vy=0;s.risks.length=0;
    notice(s,phase===2?'阶段 2 · 格式警报：注意弹跳的错误批注':'阶段 3 · 废标冲刺：从头顶跃过',3);
    emit(s,'warn');
  }
  return true;
}
function updateBoss(s,dt,prevBottom){
  const b=s.boss;if(!b || b.dead)return;
  const {gate,arenaEnd,weakPages}=s.level.boss;const p=s.p;
  if(!b.active && p.x>gate+34){
    b.active=true;s.locked=true;
    if(s.count>=weakPages){b.hp=b.max=6;notice(s,'页码充足 · 废标护甲已削弱',3.2);}
    else notice(s,'废标风险兽 · 第一阶段：跳过红色批注',3.2);
    emit(s,'warn');
  }
  if(!b.active)return;
  p.x=clamp(p.x,gate,arenaEnd-p.w);
  b.flash=Math.max(0,b.flash-dt);
  const oldY=b.y;
  if(b.dash>0){ b.dash-=dt;b.x+=b.dir*330*dt; }
  else if(b.wind>0){
    b.wind-=dt;
    if(b.wind<=0){
      b.attack++;emit(s,'print');
      const x=b.x+b.w/2+(b.dir*34);
      const add=(vx,vy,y,w,h,gravity)=>s.risks.push({x:x-w/2,y,w,h,vx,vy,gravity,life:4});
      if(b.phase===1) add(b.dir*234,0,FLOOR-29,25,23,0);
      else if(b.phase===2){add(b.dir*186,-520,b.y+20,21,24,1100);add(b.dir*254,-300,b.y+27,21,24,1050);}
      else {b.dash=.73;add(-b.dir*220,0,FLOOR-24,27,23,0);b.vy=-155;}
      b.clock=[0,1.68,1.45,1.24][b.phase];
    }
  } else {
    const diff=p.x+p.w/2-(b.x+b.w/2);
    if(Math.abs(diff)>10)b.dir=Math.sign(diff);
    if(Math.abs(diff)>104)b.x+=b.dir*(b.phase===1?40:b.phase===2?60:84)*dt;
    if((b.clock-=dt)<=0)b.wind=b.phase===3?.46:.60;
  }
  b.x=clamp(b.x,gate+40,arenaEnd-b.w-26);
  if(b.vy!==0 || b.y+b.h<FLOOR){b.y+=b.vy*dt;b.vy+=850*dt;if(b.y+b.h>=FLOOR){b.y=FLOOR-b.h;b.vy=0;}}
  if(hit(p,b)){
    if(p.vy>=0 && prevBottom<=oldY+10 && crossX(p,b,7)){
      bossHit(s);p.y=b.y-p.h-2;p.vy=-566;p.grounded=false;p.ride=-1;
    } else damage(s,b.x+b.w/2);
  }
  for(const r of s.risks){
    r.life-=dt;r.x+=r.vx*dt;r.y+=r.vy*dt;r.vy+=r.gravity*dt;
    if(r.y+r.h>FLOOR){r.y=FLOOR-r.h;if(r.gravity)r.vy=-Math.min(230,Math.abs(r.vy)*.61);}
    if(r.x+r.w<gate || r.x>arenaEnd)r.life=0;
    if(r.life>0 && hit(p,r)){damage(s,r.x+r.w/2);r.life=0;}
  }
  s.risks=s.risks.filter(r=>r.life>0);
}
function shots(s,dt,fire){
  const p=s.p;
  if(fire && p.stapler && p.cool<=0){
    s.bolts.push({x:p.facing===1?p.x+p.w:p.x-16,y:p.y+20,w:16,h:7,vx:p.facing*535,life:.95});
    p.cool=.27;emit(s,'staple');
    particles(s,p.x+p.w/2+p.facing*16,p.y+22,'#eaffff',4);
  }
  for(const q of s.bolts){
    q.life-=dt;q.x+=q.vx*dt;
    if(q.life<=0)continue;
    if(s.boss?.active&&!s.boss.dead&&hit(q,s.boss)){bossHit(s);q.life=0;continue;}
    const e=s.enemies.find(r=>r.active&&!r.dead&&hit(q,r));
    if(!e)continue;
    q.life=0;
    if(e.kind==='ghost'){
      e.stun=2.7;e.kick=Math.sign(q.vx)*280;s.score+=e.hit?0:120;e.hit=true;
      emit(s,'stomp');particles(s,e.x+22,e.y+25,'#86eeff',10,true);
    }else defeatFoe(s,e);
  }
  s.bolts=s.bolts.filter(q=>q.life>0);
}
export function step(s,input={},dt=STEP){
  s.sceneTime+=dt;
  for(const r of s.bits){r.x+=r.dx*dt;r.y+=r.dy*dt;r.dy+=430*dt;r.r+=r.spin*dt;r.life-=dt;}
  s.bits=s.bits.filter(r=>r.life>0);
  if(s.mode!=='play')return;
  const p=s.p,l=s.level;
  s.age+=dt;s.duration+=dt;s.time=Math.max(0,s.time-dt*(l.rate||1));
  if(s.time<=0){fail(s,'time');return;}
  if(s.index>=4 && s.time<=30 && !s.fast){s.fast=true;emit(s,'warn');notice(s,'最后 30 秒 · 加快节奏',2);}
  s.hintTime=Math.max(0,s.hintTime-dt);
  s.chainLeft=Math.max(0,s.chainLeft-dt);if(!s.chainLeft)s.chain=0;
  for(const key of ['flash','shield','coffee','cool'])p[key]=Math.max(0,p[key]-dt);
  for(const r of s.solids){
    const prevX=r.x,prevY=r.y;
    const move=r.travel?Math.sin(s.age*r.speed)*r.travel:0;
    r.x=r.bx+(r.vertical?0:move);r.y=r.by+(r.vertical?move:0);
    r.dx=r.x-prevX;r.dy=r.y-prevY;
  }
  if(p.grounded && p.ride>=0){const ride=s.solids[p.ride];p.x+=ride.dx;p.y+=ride.dy;}
  if(input.jump)p.buffer=.14;else p.buffer-=dt;
  if(p.grounded)p.coyote=.1;else p.coyote-=dt;
  if(p.buffer>0 && p.coyote>0){
    p.vy=-615;p.jumpRise=true;p.buffer=0;p.coyote=0;p.grounded=false;p.ride=-1;
    emit(s,'jump');particles(s,p.x+10,p.y+22,'#eefaff',8,true);
  }
  if(p.jumpRise && (!input.jumpHeld || p.vy>=0)){
    if(p.vy < -295)p.vy=-295;
    p.jumpRise=false;
  }
  const dir=Number(!!input.right)-Number(!!input.left);
  p.slip=p.grounded && l.traps.some(r=>r.kind==='spill'&&p.y+p.h>=FLOOR-3&&crossX(p,r));
  if(dir)p.facing=dir;
  const speed=p.slip?126:p.coffee>0?320:250;
  p.vx=approach(p.vx,dir*speed,(p.slip?(dir?400:140):p.grounded?2400:1710)*dt);
  p.x=clamp(p.x+p.vx*dt,3,l.width-p.w-3);
  const prevY=p.y,prevBottom=p.y+p.h;
  p.vy=Math.min(810,p.vy+1510*dt);p.y+=p.vy*dt;
  p.grounded=false;p.ride=-1;
  if(p.vy>=0){
    let land=null;
    for(const r of s.solids){
      if(crossX(p,r,2)&&prevBottom<=r.y-r.dy+4&&p.y+p.h>=r.y-.25&&(!land||r.y<land.y))land=r;
    }
    if(land){p.y=land.y-p.h;p.vy=0;p.grounded=true;p.ride=land.id;}
  }else{
    const r=s.solids.find(r=>r.item && crossX(p,r,3) && prevY>=r.y+r.h-2 && p.y<r.y+r.h);
    if(r){p.y=r.y+r.h;p.vy=25;useBlock(s,r);}
  }
  if(p.y>548){fail(s,'fall');return;}
  for(const r of s.pages){
    if(!r.taken&&hit(p,{x:r.x-12,y:r.y-15,w:24,h:30}))collect(s,r);
  }
  for(const r of l.traps){
    if(r.kind==='shred'&&hit(p,{x:r.x+4,y:FLOOR-40,w:r.w-8,h:48})){fail(s,'shred');return;}
    if(r.kind==='jam'){
      const j=jamCycle(s.age,r.phase);
      if(j.height>2&&jamCycle(s.age-dt,r.phase).height<=2&&Math.abs(p.x-(r.x+r.w/2))<280)emit(s,'print');
      if(j.height>11 && hit(p,{x:r.x+7,y:FLOOR-j.height-22,w:r.w-14,h:26}))damage(s,r.x+r.w/2);
    }
  }
  if(s.mode!=='play')return;
  for(const e of s.enemies){
    if(e.dead)continue;
    const oldY=e.y;
    if(e.kind==='ghost'){
      if(!e.active && p.x>e.home-38){e.active=true;e.x=Math.max(0,p.x-165);e.y=p.y-24;emit(s,'warn');}
      if(!e.active)continue;
      e.stun=Math.max(0,e.stun-dt);
      if(e.stun>0){e.x=clamp(e.x+e.kick*dt,0,l.width-e.w);e.kick=approach(e.kick,0,440*dt);}
      else {
        const dx=p.x-e.x,dy=p.y-9-e.y;e.dir=Math.sign(dx)||e.dir;
        e.x=approach(e.x,p.x,162*dt);e.y+=clamp(dy,-84*dt,84*dt)+Math.sin(s.age*7)*22*dt;
        if(hit(p,e))damage(s,e.x+22);
      }
    } else {
      const phase=s.age*(e.kind==='typo'?1.35:1.2)+e.id*1.47;
      e.x=e.home+Math.sin(phase)*e.range;e.dir=Math.sign(Math.cos(phase));
      e.y=e.base-e.h-(e.kind==='typo'?20+Math.sin(phase*2)*12:0);
      if(hit(p,e)){
        if(p.vy>=0 && prevBottom<=oldY+8 && crossX(p,e,3)){
          defeatFoe(s,e);p.y=e.y-p.h-1;p.vy=-404;p.jumpRise=false;p.grounded=false;p.ride=-1;
        }else if(p.shield>0)defeatFoe(s,e);
        else damage(s,e.x+e.w/2);
      }
    }
    if(s.mode!=='play')return;
  }
  updateBoss(s,dt,prevBottom);
  if(s.mode!=='play')return;
  shots(s,dt,!!input.fire);
  if(hit(p,{x:l.end-13,y:285,w:65,h:207})){
    if(s.boss&&!s.boss.dead){ if(s.hintTime===0)notice(s,'先清除废标风险'); }
    else if(s.count<l.required){ if(s.hintTime===0)notice(s,`还差 ${l.required-s.count} 页 · 返回补齐本章`); }
    else {
      s.score+=400+(Math.floor(s.time)*2);
      if(s.boss)finish(s,true);
      else{s.mode='clear';s.sceneTime=0;emit(s,'clear');}
    }
  }
}
