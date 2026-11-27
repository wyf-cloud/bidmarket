import { FLOOR, HEIGHT, palettes, jamCycle } from './game-levels.js';

const fmt=(t)=>{const n=Math.max(0,Math.ceil(t));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
const rect=(c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h);};
function poly(c,points,col){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=col;c.fill();}
function text(c,str,x,y,size,color,weight=700,align='left',mono=false){
  c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';
  c.font=`${weight} ${size}px ${mono?'Consolas, monospace':'"Microsoft YaHei UI", "PingFang SC", sans-serif'}`;c.fillText(str,x,y);
}
const colors={ink:'#152f48',navy:'#254f7a',edge:'#456783',snow:'#eefaff',metal:'#7095b1',cyan:'#87e6f4',red:'#eb5264',gold:'#f9c15d',shade:'#0d233d'};
function clock(c,x,y,r,dark=false){
  rect(c,x-r-3,y-r-3,r*2+6,r*2+6,dark?'#596f94':'#738da7');rect(c,x-r,y-r,r*2,r*2,dark?'#273a57':'#e9f3fb');
  const fg=dark?'#a7bed9':'#4b6b8e';
  for(let i=0;i<12;i++){let a=i*Math.PI/6;rect(c,x+Math.sin(a)*(r-5)-1,y+Math.cos(a)*(r-5)-1,2,2,fg);}
  rect(c,x-2,y-r+8,3,r-6,fg);rect(c,x,y-1,Math.floor(r*.58),3,colors.red);
}
function cabinet(c,x,y,w,h,p,archive=false){
  rect(c,x+4,y+5,w,h,p.near);rect(c,x,y,w,h,archive?'#607c9f':p.far);rect(c,x,y,w,4,p.high);
  const n=h>106?4:3,g=7,dh=Math.floor((h-2*g)/n);
  for(let i=0;i<n;i++){
    const a=y+g+i*dh;
    rect(c,x+4,a,w-8,dh-3,archive?'#415b80':p.near);
    rect(c,x+5,a,w-10,2,archive?'#7c91b1':p.high);
    rect(c,x+w/2-10,a+5,20,5,p.high);rect(c,x+w/2-7,a+7,14,3,archive?'#9bb8d7':p.far);
    if(archive)rect(c,x+10,a+8,4,4,i%2?p.glow:'#df8a72');
  }
}
function stack(c,x,y,w,h,p){
  for(let i=0;i<5;i++){
    const off=(i*7)%9;
    rect(c,x+off,y+i*h/5,w-off,h/5-2,i%2?p.far:p.high);
    rect(c,x+off+5,y+i*h/5+h/5-4,w-off-8,2,p.near);
  }
}
function workstation(c,x,y,i,p){
  rect(c,x,y-78,160,103,p.near);rect(c,x,y-78,160,4,p.high);rect(c,x+1,y-72,158,19,p.far);
  rect(c,x+18,y-54,55,39,p.night);rect(c,x+22,y-50,47,30,p.high);rect(c,x+22,y-50,47,6,p.far);
  for(let q=0;q<3;q++)rect(c,x+28,y-40+6*q,24+q*3,2,p.near);
  rect(c,x+42,y-14,7,7,p.night);rect(c,x+25,y-8,42,3,p.night);
  stack(c,x+107,y-34,36,29,p);
  rect(c,x-4,y-4,173,6,p.high);rect(c,x-4,y+2,173,10,p.night);
  rect(c,x+3,y+12,7,34,p.night);rect(c,x+154,y+12,7,34,p.night);
  if(i%2===0){rect(c,x+83,y+7,29,23,p.near);rect(c,x+86,y+3,23,22,p.far);rect(c,x+95,y+27,6,19,p.night);rect(c,x+81,y+43,33,3,p.night);}
}
function printer(c,x,y,w,p,near=false){
  const col=near?'#355671':p.night;
  rect(c,x+3,y+14,w-5,63,col);rect(c,x,y+11,w-6,39,p.far);rect(c,x+7,y,w-22,14,p.high);
  rect(c,x+22,y+5,w-48,4,p.near);rect(c,x+9,y+35,w-27,28,p.near);
  rect(c,x+16,y+36,w-42,9,col);rect(c,x+23,y+43,w-57,15,p.high);
  for(let j=0;j<3;j++)rect(c,x+26,y+47+j*3,Math.max(8,w-64-j*5),1,p.near);
  rect(c,x+w-27,y+17,12,6,col);rect(c,x+w-24,y+19,6,2,p.glow);rect(c,x+7,y+73,w-21,3,p.high);
}
function binder(c,x,y,w,p,i=0){
  rect(c,x+8,y+55,w-17,19,p.near);rect(c,x,y+49,w,10,p.high);rect(c,x,y+43,w,9,p.far);
  poly(c,[[x+8,y+42],[x+8,y+25],[x+18,y+9],[x+w-14,y+9],[x+w-6,y+23],[x+w-6,y+43]],p.night);
  rect(c,x+20,y+17,w-40,5,p.near);rect(c,x+19,y+34,w-38,4,p.high);rect(c,x+w-24,y+25,8,3,p.glow);
  rect(c,x+18,y+3,w-36,6,p.near);rect(c,x+w/2-4,y,w/2-9,4,p.night);
  text(c,['订','胶','装'][i%3],x+w/2,y+28,9,p.high,700,'center');
}
function scenery(c,s,cam,vw){
  const k=s.index,p=palettes[k];
  const g=c.createLinearGradient(0,0,0,FLOOR);g.addColorStop(0,p.high);g.addColorStop(1,p.sky);c.fillStyle=g;c.fillRect(0,0,vw,HEIGHT);
  const bg=cam*.16;
  for(let i=Math.floor(bg/194)-1;i*194-bg<vw+193;i++){
    const x=i*194-bg+12;
    rect(c,x,35,182,9,p.near);rect(c,x+5,44,172,4,p.far);
    if(i%2===0){rect(c,x+43,52,93,9,p.far);rect(c,x+49,54,81,4,k===3?'#d2dfee':p.high);}
    rect(c,x+176,57,5,344,p.far);rect(c,x+181,57,2,344,p.high);
    if(k===0 || k===5){
      rect(c,x+3,81,158,151,p.far);rect(c,x+8,86,148,141,k===5?'#789bb9':'#8daec4');
      for(let j=0;j<6;j++){
        const h=14+(i*617+j*53&63);
        rect(c,x+10+j*24,226-h,17,h,j%2?'#668aa8':'#7999b1');
        if(j%2===0)for(let a=0;a<(h-5)/10;a++)rect(c,x+13+j*24,222-h+9*a,3,3,a%3?'#96b7ce':'#eadf9c');
      }
      rect(c,x+79,86,4,141,p.high);rect(c,x+8,191,148,3,p.high);
      poly(c,[[x+22,88],[x+66,88],[x+35,182],[x+19,182]],'#ffffff2a');
      rect(c,x,229,165,6,p.high);
    }else{
      rect(c,x+16,123,147,3,p.near);rect(c,x+16,129,147,2,p.high);
      if(i%2===0){rect(c,x+47,155,74,39,p.far);rect(c,x+48,156,71,3,p.high);text(c,['','文印设备','装订作业','受控区域','消防通道'][k]||'',x+84,176,12,p.night,800,'center');}
      else clock(c,x+90,163,18,k===3);
    }
  }
  rect(c,0,239,vw,3,p.high);rect(c,0,243,vw,7,p.far);rect(c,0,396,vw,8,p.far);rect(c,0,404,vw,3,p.near);
  const fg=cam*.39;
  for(let i=Math.floor(fg/232)-1;i*232-fg<vw+240;i++){
    const x=i*232-fg+23;
    if(k===0){workstation(c,x,397,i,p);if(i%2===0)cabinet(c,x+174,340,39,105,p);}
    else if(k===1){printer(c,x+16,326,136,p);stack(c,x+165,370,54,46,p);rect(c,x+5,406,212,7,p.night);rect(c,x+11,413,6,27,p.near);rect(c,x+199,413,6,27,p.near);}
    else if(k===2){binder(c,x+12,334,137,p,i);cabinet(c,x+167,331,45,112,p);}
    else if(k===3){cabinet(c,x,265,77,174,p,true);cabinet(c,x+84,271,83,168,p,true);rect(c,x+176,357,36,79,p.near);rect(c,x+179,368,30,5,p.glow);}
    else if(k===4){
      rect(c,x,258,148,183,p.night);rect(c,x+7,265,134,176,p.far);rect(c,x+10,270,128,171,p.near);rect(c,x+73,270,3,171,p.night);
      rect(c,x+54,259,39,12,p.night);text(c,'↑  01',x+74,264,9,p.glow,700,'center',true);
      rect(c,x+160,289,48,18,p.night);text(c,'出口  →',x+184,298,9,p.glow,700,'center');
    }else{
      rect(c,x+1,397,211,9,p.high);rect(c,x+8,405,196,31,p.night);rect(c,x+15,408,181,9,p.near);
      for(let j=0;j<3;j++){rect(c,x+51+44*j,363,20,24,p.near);rect(c,x+57+44*j,389,8,8,p.night);}
      if(i%2===0){rect(c,x+15,258,176,84,p.night);rect(c,x+20,263,166,74,'#193554');text(c,'投标截止倒计时',x+103,279,12,'#c3ddef',700,'center');text(c,fmt(s.time),x+103,308,26,s.time<=30?'#ff8190':'#96e5f5',800,'center',true);}
    }
  }
  rect(c,0,445,vw,27,k===3?'#344865':p.far);
  for(let i=-1;i<vw/66+2;i++)rect(c,i*66-(cam*.5%66),453,49,2,p.near);
}
function surface(c,r,p){
  const {x,y,w,h,kind}=r;
  if(r.item){
    rect(c,x+4,y+5,w,h,'#183c6260');rect(c,x,y,w,h,r.used?'#7188a0':'#244878');
    rect(c,x+3,y+3,w-6,h-6,r.used?'#899eb1':'#4283bc');rect(c,x+4,y+4,w-8,3,r.used?'#b1c5d4':'#a4f0ff');
    for(const a of [4,w-8])for(const b of [5,h-9])rect(c,x+a,y+b,4,4,colors.snow);
    if(r.used){rect(c,x+14,y+17,14,3,'#bbccdb');return;}
    const a=x+12,b=y+11;
    if(r.item==='coffee'){rect(c,a,b+4,15,14,colors.snow);rect(c,a+15,b+6,5,7,colors.snow);rect(c,a+2,b+5,10,4,'#c38959');rect(c,a+2,b+1,2,3,colors.gold);}
    else if(r.item==='usb'){rect(c,a+4,b,11,6,colors.snow);rect(c,a+2,b+6,15,13,p.glow);rect(c,a+7,b+9,5,6,colors.navy);}
    else {poly(c,[[a,b+9],[a+16,b+1],[a+19,b+3],[a+19,b+9],[a+3,b+14]],colors.snow);rect(c,a,b+15,20,4,p.glow);}
    return;
  }
  rect(c,x,y+h,w,7,'#162f4a30');rect(c,x,y,w,h,p.floor);rect(c,x,y,w,5,p.top);rect(c,x,y+5,w,3,p.near);
  if(y===FLOOR && !r.travel){
    const step=kind==='tile'?52:kind==='paper'?82:92;
    for(let a=x;a<x+w;a+=step){const sw=Math.min(step,x+w-a);
      rect(c,a,y+11,sw-3,7,p.near);rect(c,a,y+20,2,Math.min(44,sw),p.night);
      if(kind==='paper'){for(let j=0;j<6;j++)rect(c,a+2,y+20+j*7,sw-5,2,j%2?p.near:p.high);}
      else if(kind==='tile'||kind==='hall'){rect(c,a+4,y+31,sw-10,2,p.near);rect(c,a+4,y+61,sw-10,2,p.night);}
      else {rect(c,a+5,y+28,sw-10,14,p.night);rect(c,a+8,y+30,sw-16,11,p.near);rect(c,a+sw/2-7,y+32,14,3,p.top);}
    }
  }else{
    const a=x+7;
    if(kind==='printer'||kind==='mover'){rect(c,a,y+9,w-34,5,p.night);rect(c,a+7,y+13,w-48,5,p.high);rect(c,x+w-18,y+10,7,4,p.glow);}
    else if(kind==='paper'){for(let j=0;j<4;j++)rect(c,a+(j%2)*3,y+9+j*3,w-20,1,p.high);}
    else if(kind==='elevator'){for(let j=3;j<w-6;j+=14)poly(c,[[x+j,y+9],[x+j+6,y+9],[x+j+1,y+19],[x+j-3,y+19]],j%3?colors.gold:p.high);}
    else {rect(c,a,y+11,w-16,8,p.night);rect(c,x+w/2-10,y+12,20,3,kind==='bind'?p.glow:p.high);}
  }
}
function page(c,x,y,t){
  y+=Math.sin(t*4+x*.031)*3;
  rect(c,x-13,y-14,26,28,'#fbd3742c');rect(c,x-9,y-11,18,23,'#815736');
  poly(c,[[x-8,y-11],[x+3,y-11],[x+8,y-6],[x+8,y+10],[x-8,y+10]],'#ffe9ab');
  rect(c,x-6,y-8,2,16,'#ec9e41');rect(c,x-2,y-4,7,2,'#9e733e');rect(c,x-2,y+1,6,2,'#ba935d');rect(c,x-2,y+5,4,2,'#ba935d');
}
function player(c,p,t){
  if(p.flash>0&&Math.floor(t*14)%2)return;
  c.save();c.translate(Math.round(p.x+p.w/2),Math.round(p.y));c.scale(p.facing,1);
  const run=p.grounded&&Math.abs(p.vx)>25, j=p.grounded?0:2, feet=run?Math.round(Math.sin(t*(p.coffee?27:21))*5):0;
  if(p.shield>0){c.strokeStyle='#86f6fa';c.lineWidth=2;c.beginPath();c.ellipse(0,22,22,28,0,0,Math.PI*2);c.stroke();rect(c,-22,12,4,4,'#edffff');rect(c,16,37,4,4,'#edffff');}
  rect(c,-13,15,10,22,colors.ink);rect(c,-13,18,6,15,'#3d75a9');rect(c,-13,24,5,3,'#d7ac73');
  rect(c,-7,33,6,8-j+Math.max(-2,feet),colors.ink);rect(c,2,33,6,8-j+Math.max(-2,-feet),colors.navy);
  rect(c,-8-feet/3,40-j+Math.max(-2,feet),10,4,colors.shade);rect(c,1+feet/3,40-j+Math.max(-2,-feet),10,4,colors.shade);
  rect(c,-8,15,18,20,colors.ink);rect(c,-6,15,14,18,'#f0faff');rect(c,-6,28,14,5,'#aecce4');rect(c,-7,18,3,15,'#47678b');
  rect(c,2,18,4,4,colors.red);rect(c,3,22,3,7,'#ac3f59');rect(c,3,29,4,2,colors.red);
  rect(c,-7,2,15,13,'#d68e69');rect(c,-5,5,14,9,'#ffcca0');rect(c,-9,0,17,5,colors.shade);rect(c,-9,4,5,7,colors.shade);
  rect(c,8,7,3,4,'#ffcca0');rect(c,4,7,2,3,colors.shade);rect(c,5,12,4,1,'#b96559');
  rect(c,7,21-j,5,8,'#d9edf8');rect(c,10,25-j,4,4,'#ffc397');
  if(p.stapler){rect(c,11,21-j,13,4,'#286990');rect(c,12,20-j,12,2,'#b9f7ff');rect(c,12,26-j,8,2,colors.shade);}
  c.restore();
}
function foe(c,e,t){
  const x=e.x,y=e.y;
  if(e.kind==='typo'){
    rect(c,x-4,y+4,40,27,'#633e9e26');poly(c,[[x-1,y+7],[x+6,y],[x+26,y],[x+33,y+6],[x+33,y+26],[x+27,y+33],[x+6,y+33],[x-1,y+26]],'#71539e');
    rect(c,x+4,y+6,24,21,'#cdb8ee');text(c,['误','错','漏'][e.id%3],x+16,y+16,16,'#402863',900,'center');rect(c,x+4,y+28,25,3,'#ee728e');
  }else if(e.kind==='bug'){
    for(let a=3;a<34;a+=8)rect(c,x+a,y+18+Math.sin(t*21+a)*2,4,7,'#24483f');
    rect(c,x+1,y+8,36,12,'#276865');rect(c,x+4,y+4,30,13,'#59b5a1');
    for(let a=7;a<=25;a+=8){rect(c,x+a,y+7,3,8,'#c5f2cb');rect(c,x+a,y+8,5,2,'#215753');}
    const head=x+(e.dir<0?5:31);rect(c,head,y+4,3,7,'#f6fff5');rect(c,head+(e.dir<0?0:2),y+6,2,4,colors.ink);
  }else{
    c.save();c.globalAlpha=e.stun>0?.46:.9;
    poly(c,[[x-3,y+22],[x+4,y+9],[x+13,y+2],[x+35,y+2],[x+43,y+11],[x+47,y+21],[x+45,y+50],[x+35,y+45],[x+26,y+52],[x+17,y+45],[x+4,y+52],[x+2,y+33]],'#426b9b');
    poly(c,[[x+3,y+19],[x+10,y+8],[x+34,y+6],[x+42,y+17],[x+42,y+43],[x+34,y+38],[x+28,y+46],[x+18,y+38],[x+8,y+43]],'#b4e9f8');
    rect(c,x+11,y+16,6,8,colors.ink);rect(c,x+27,y+16,6,8,colors.ink);rect(c,x+17,y+28,12,3,colors.red);c.restore();
  }
}
function traps(c,s,r){
  const x=r.x,w=r.w;
  if(r.kind==='spill'){
    poly(c,[[x,FLOOR],[x+6,FLOOR-5],[x+19,FLOOR-5],[x+25,FLOOR-10],[x+w-8,FLOOR-8],[x+w-3,FLOOR-5],[x+w,FLOOR]],'#916047');rect(c,x+11,FLOOR-4,18,2,'#d79868');
  }else if(r.kind==='shred'){
    rect(c,x,FLOOR-37,w,37,'#243b54');rect(c,x+4,FLOOR-36,w-8,10,'#526e86');rect(c,x+7,FLOOR-35,w-14,4,'#101e36');
    for(let a=7;a<w-8;a+=9){const height=Math.round(4+3*Math.sin(s.age*16+a));poly(c,[[x+a,FLOOR-34],[x+a+4,FLOOR-34-height],[x+a+8,FLOOR-34]],'#e8f3fb');}
    for(let a=6;a<w-8;a+=14)poly(c,[[x+a,FLOOR-21],[x+a+7,FLOOR-21],[x+a+2,FLOOR-15],[x+a-3,FLOOR-15]],colors.gold);
    rect(c,x+w-13,FLOOR-9,7,4,colors.red);
  }else{
    const j=jamCycle(s.age,r.phase);rect(c,x,FLOOR-21,w,21,'#385b73');rect(c,x+3,FLOOR-20,w-6,4,'#a3c4dc');rect(c,x+6,FLOOR-15,w-12,4,'#1a304a');
    rect(c,x+4,FLOOR-8,7,4,j.warn?'#ff5e6c':'#ffca70');
    if(j.warn){rect(c,x+3,FLOOR-87,w-6,62,'#ea53612c');text(c,'!',x+w/2,FLOOR-69,22,'#bf3d52',900,'center',true);}
    if(j.height>2){const y=FLOOR-j.height-22;poly(c,[[x+4,y+5],[x+19,y+1],[x+w-5,y+5],[x+w-4,y+21],[x+7,y+24]],'#fee2df');rect(c,x+8,y+6,w-16,16,'#e96b73');text(c,'卡纸',x+w/2,y+14,10,'#fff',900,'center');}
  }
}
function finalBoss(c,b,t){
  const x=b.x,y=b.y;
  c.save();c.translate(x+52,y);c.scale(b.dir,1);c.translate(-52,0);
  const armed=b.wind>0, hit=b.flash>0&&Math.floor(t*14)%2;
  poly(c,[[0,62],[4,26],[16,26],[16,12],[32,12],[32,2],[83,2],[83,14],[96,14],[96,24],[104,24],[104,77],[0,77]],hit?'#fff1e8':'#292a4b');
  rect(c,13,35,81,39,armed?'#ac425f':'#744f77');rect(c,21,15,59,51,hit?'#fff0ec':'#ce757f');rect(c,24,17,52,6,'#ecb3aa');
  for(let j=0;j<b.phase;j++){const a=26+j*14;rect(c,a,8,9,12,'#f9c66b');rect(c,a,8,9,3,'#ffecc4');}
  rect(c,38,28,42,25,'#442841');rect(c,45,33,10,8,'#ffebb0');rect(c,64,33,10,8,'#ffebb0');rect(c,57,46,18,3,'#ff97a0');
  rect(c,77,53,26,18,armed?'#fce7a6':'#e08f8d');rect(c,78,62,26,8,'#71354c');rect(c,13,72,22,9,'#1f2038');rect(c,71,72,24,9,'#1f2038');
  if(armed){rect(c,102,52,6,20,'#fbe5a7');rect(c,108,57,8,8,'#fff5d5');}
  c.restore();
}
function goal(c,s){
  const x=s.level.end,p=palettes[s.index],ok=s.count>=s.level.required&&(!s.boss||s.boss.dead);
  if(s.boss){
    rect(c,x-28,307,126,165,colors.ink);rect(c,x-22,313,114,154,'#4d769b');rect(c,x-17,319,104,74,'#162d4c');
    text(c,'投标截止倒计时',x+35,337,11,'#c6e6f7',800,'center');text(c,fmt(s.time),x+35,365,25,s.time<=30?'#ffa6aa':'#94edfb',800,'center',true);
    rect(c,x-17,396,104,41,ok?'#6cbbbc':'#a1afc5');rect(c,x-16,437,102,8,p.top);text(c,'投标窗口',x+35,417,14,colors.ink,900,'center');
  }else{
    rect(c,x-35,FLOOR-8,78,8,p.night);rect(c,x-26,FLOOR-15,61,7,p.top);rect(c,x+3,303,7,157,p.night);rect(c,x+4,303,3,156,'#d7f5ff');
    rect(c,x+1,297,11,8,ok?p.glow:'#abc0d4');
    poly(c,[[x+10,315],[x+80,315],[x+69,337],[x+80,359],[x+10,359]],ok?'#1b7080':'#4e6581');
    text(c,'章节校对',x+40,331,11,'#ecfaff',900,'center');text(c,ok?'已齐备':`${s.count}/${s.level.required} 页`,x+40,346,10,ok?'#96f6dc':'#d7e6f5',700,'center');
  }
}
function sign(c,x,label,p){
  const w=Math.min(205,label.length*12+22);rect(c,x+10,414,4,57,p.night);rect(c,x,405,w,24,'#183653');rect(c,x+2,407,w-4,20,'#ecf9ff');text(c,label,x+8,417,11,colors.ink,800);
}
export function paint(c,s,vw,cam,t,reduced=false){
  const p=palettes[s.index];
  scenery(c,s,cam,vw);
  c.save();c.translate(-Math.round(cam),0);
  const visible=(x,w)=>x+w>=cam-48&&x<=cam+vw+48;
  for(const r of s.solids)if(visible(r.x,r.w)){
    if(r.travel){c.save();c.setLineDash([6,5]);c.strokeStyle='#42647f90';c.lineWidth=2;c.beginPath();
      if(r.vertical){c.moveTo(r.bx+r.w/2,r.by-r.travel);c.lineTo(r.bx+r.w/2,r.by+r.travel+26);}
      else {c.moveTo(r.bx-r.travel,r.by+13);c.lineTo(r.bx+r.travel+r.w,r.by+13);}c.stroke();c.restore();}
    surface(c,r,p);
  }
  for(const r of s.level.traps)if(visible(r.x,r.w))traps(c,s,r);
  for(const [x,label] of s.level.signs)if(visible(x,204))sign(c,x,label,p);
  for(const r of s.pages)if(!r.taken&&visible(r.x,20))page(c,r.x,r.y,reduced?0:t);
  if(visible(s.level.end-40,156))goal(c,s);
  for(const e of s.enemies)if(!e.dead&&e.active&&visible(e.x,e.w))foe(c,e,t);
  if(s.boss&&!s.boss.dead&&visible(s.boss.x,s.boss.w))finalBoss(c,s.boss,t);
  if(s.locked){
    for(const x of [s.level.boss.gate-5,s.level.boss.arenaEnd]){
      rect(c,x,286,8,186,'#932d4f');rect(c,x+2,292,4,170,'#ffc082');
      for(let j=300;j<461;j+=19)rect(c,x-1,j,10,4,'#ff7786');
    }
  }
  for(const r of s.risks){rect(c,r.x,r.y,r.w,r.h,'#b73f62');rect(c,r.x+2,r.y+3,r.w-4,r.h-6,'#ffa1a9');text(c,'!',r.x+r.w/2,r.y+r.h/2,13,'#73254d',900,'center',true);}
  for(const q of s.bolts){rect(c,q.x,q.y,q.w,3,'#f0fdff');rect(c,q.x+3,q.y+3,3,4,'#99d6f3');rect(c,q.x+11,q.y+3,3,4,'#99d6f3');}
  if(s.mode!=='ready')player(c,s.p,t);
  for(const a of s.bits){if(!visible(a.x,7))continue;c.save();c.translate(a.x,a.y);c.rotate(a.r);c.globalAlpha=Math.min(1,a.life/.3);rect(c,-2,-2,a.paper?7:4,a.paper?9:4,a.color);if(a.paper)rect(c,0,1,4,1,'#7197ae');c.restore();}
  c.restore();
  if(s.index===3){
    const dim=reduced?.18:.17+.16*(.5+.5*Math.sin(s.age*1.3));
    const light=c.createRadialGradient(s.p.x+14-cam,s.p.y+16,28,s.p.x+14-cam,s.p.y+16,350);
    light.addColorStop(0,'#08132700');light.addColorStop(1,`rgba(8,19,39,${dim})`);c.fillStyle=light;c.fillRect(0,0,vw,HEIGHT);
  }
  if(s.mode==='won'&&!reduced){
    const colors=['#84e2ef','#f8ce72','#fff8e8','#fc9ca7'];
    for(let i=0;i<86;i++){
      const a=s.sceneTime*(70+i%6*21)+i*37, x=((i*149+s.sceneTime*(i%2?24:-27))%vw+vw)%vw;
      c.save();c.translate(x,a%615-41);c.rotate(i+s.sceneTime*(i%2?2:-3));rect(c,-3,-4,6,9,colors[i%4]);c.restore();
    }
  }
}
