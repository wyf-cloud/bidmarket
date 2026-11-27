import { createRun, step, confirm, drain, STEP, CHAIN_WINDOW } from './game-core.js';
import { HEIGHT, WIDTH } from './game-levels.js';
import { paint } from './game-art.js';
import { createAudio } from './game-audio.js';

const forKey={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',KeyX:'fire',KeyJ:'fire'};
const pad=(v)=>String(v).padStart(2,'0');
const mmss=(v)=>`${pad(Math.floor(Math.ceil(v)/60))}:${pad(Math.ceil(v)%60)}`;
const format=(v)=>String(v).replace(/\B(?=(\d{3})+(?!\d))/g,',');

export function startGame(canvas,{onFinish}={}){
  const root=canvas.closest('.game-cabinet'), art=canvas.parentElement,c=canvas.getContext('2d');
  const a=createAudio(),s=createRun(), keys=new Set(), heldActivation=new Map(), fingers=new Map(), listeners=new AbortController();
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  const dom=(id)=>root.querySelector(`[data-game="${id}"]`);
  const overlay=dom('overlay'), status=dom('status'), stats=dom('stats'), submission=dom('submission'), play=dom('play'), pause=dom('pause'), sound=dom('sound'), nav=[...root.querySelectorAll('[data-game-level]')];
  const fields={};for(const el of root.querySelectorAll('[data-game-value]'))fields[el.dataset.gameValue]=el;
  const set=(k,v)=>{const el=fields[k],str=String(v);if(el&&el.textContent!==str)el.textContent=str;};
  let raf,last,carry=0,cam=0,view=WIDTH,stopped=false,paused=false,jump=false,shown='',oldMode='',oldIndex=-1,lastHint='',reported=null;
  const add=(node,type,fn)=>node.addEventListener(type,fn,{signal:listeners.signal});
  function clearControls(){keys.clear();fingers.clear();jump=false;for(const el of root.querySelectorAll('[data-game-control]'))el.removeAttribute('data-held');}
  function begin(){
    a.unlock();
    if(paused){paused=false;}
    else if(s.mode!=='play')confirm(s);
    clearControls();
    art.focus({preventScroll:true});
    renderUI();
  }
  function togglePause(force=false){
    if(s.mode!=='play')return;
    paused=force===true?true:!paused;clearControls();
    if(!paused){a.unlock();art.focus({preventScroll:true});}
    renderUI();
  }
  function renderUI(){
    const p=s.p,l=s.level,mode=paused?'paused':s.mode;
    root.dataset.gameMode=mode;
    set('chapter',`${pad(s.index+1)} / 06`);set('area',l.area);set('timer',mmss(s.time));set('score',format(s.score));
    set('health','♥'.repeat(p.hp)+'♡'.repeat(3-p.hp));set('pages',`${s.count} / ${l.required}`);set('bonus',s.earned?'已取得':`≥ ${l.bonus} 页`);
    set('gear',[p.stapler?'订书机':'',p.coffee>0?`咖啡 ${Math.ceil(p.coffee)}s`:'',p.shield>0?`U 盘 ${Math.ceil(p.shield)}s`:''].filter(Boolean).join(' · ')||'顶砖获取道具');
    set('chain',s.chain>1?`×${s.chain} · +${Math.min(30,(s.chain-1)*10)}`:s.chain===1?'×1':'—');
    const fill=`${s.chainLeft/CHAIN_WINDOW*100}%`;
    if(fields.progress.style.width!==fill)fields.progress.style.width=fill;
    fields.timer.toggleAttribute('data-urgent',s.time<=30);
    fields.health.setAttribute('aria-label',`生命 ${p.hp} / 3`);
    pause.disabled=s.mode!=='play';pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?'继续':'暂停';
    const message=s.hintTime>0&&mode==='play'?s.message:'';
    if(message!==lastHint){status.textContent=message;status.hidden=!message;lastHint=message;}
    const boss=dom('boss');boss.hidden=!s.boss?.active||s.boss.dead||mode!=='play';
    if(!boss.hidden){set('boss',`废标风险兽 · 阶段 ${s.boss.phase}/3`);fields.bossBar.style.width=`${s.boss.hp/s.boss.max*100}%`;}
    const lock=`${mode}:${s.index}`;
    if(shown===lock)return;
    shown=lock;overlay.hidden=mode==='play';overlay.dataset.scene=mode;
    nav.forEach((item,i)=>{
      if(i===s.index)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
      item.toggleAttribute('data-done',i<s.index||mode==='won');
    });
    const result=s.result;
    const terminal=mode==='won'||mode==='lost';
    stats.hidden=!terminal;
    submission.hidden=true;submission.textContent='';
    if(terminal){
      clearControls();
      set('endScore',format(result.score));set('endPages',result.pages);set('endCert',result.certificates);set('endTime',mmss(result.duration));
      if(root.contains(document.activeElement))art.focus({preventScroll:true});
    }
    if(mode==='play')return;
    const info={
      ready:['截标前夜 · 第 01 章','标书员大冒险','小张只剩最后一晚。捡齐散落的标书页码，穿过六个办公区域，把完整标书送到投标窗口。','开始投标旅程','键盘或触屏 · 支持静音'],
      paused:[l.area,'已暂停','本章的倒计时暂停了，随时继续。','继续游戏','P / Esc'],
      clear:[`章节 ${pad(s.index+1)} · ${l.chapter}`,'校对通过',`本章收齐 ${s.count} 页${s.earned?'，已获得加分资质证书':''}。下一站：${nav[s.index+1]?.querySelector('b')?.textContent ?? '投标窗口'}。`,'进入下一章','Enter'],
      lost:s.result&&['投标回执 · 交付未完成','本局结算',`${s.message}。本局止于第 ${s.result.level} 章「${l.name}」。`,'再来一局','Enter'],
      won:['投标回执 · 六章齐备','中标成功！',`小张赶在截止前提交了完整标书，六章校对全部通过。`,'再玩一次','Enter']
    }[mode];
    if(info){for(const [i,key] of ['tag','title','copy','buttonHint','shortcut'].entries())set(key,info[i]);}
    if(mode==='paused'||mode==='clear')play.focus({preventScroll:true});
  }
  add(play,'click',begin);
  add(pause,'click',()=>togglePause());
  add(sound,'click',()=>{const muted=a.toggle();sound.textContent=muted?'声音：关':'声音：开';sound.setAttribute('aria-pressed',String(!muted));});
  window.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey)return;
    const key=e.code;
    if(!root.contains(document.activeElement) || e.target.closest?.('input,textarea,select,[contenteditable=true]'))return;
    const activate=key==='Space'||key==='Enter';
    if(activate){
      const press=heldActivation.get(key);
      if(!press&&!e.repeat)heldActivation.set(key,{mode:s.mode,result:s.result});
      const changed=press&&(press.mode!==s.mode||press.result!==s.result);
      if(changed || ((paused||s.mode!=='play')&&e.repeat)){e.preventDefault();return;}
      if(e.target.closest?.('button,a'))return;
      if(!e.repeat&&((key==='Enter'&&(paused||s.mode!=='play'))||(key==='Space'&&s.result))){e.preventDefault();begin();return;}
    }
    if((key==='KeyP'||key==='Escape')&&s.mode==='play'&&!e.repeat){e.preventDefault();togglePause();return;}
    if(paused||s.mode!=='play'||!forKey[key])return;
    e.preventDefault();a.unlock();keys.add(key);if(forKey[key]==='jump'&&!e.repeat)jump=true;
  },{capture:true,signal:listeners.signal});
  window.addEventListener('keyup',e=>{
    keys.delete(e.code);
    const press=heldActivation.get(e.code);heldActivation.delete(e.code);
    if(press&&(press.mode!==s.mode||press.result!==s.result)&&root.contains(document.activeElement))e.preventDefault();
  },{capture:true,signal:listeners.signal});
  add(window,'blur',()=>{heldActivation.clear();togglePause(true);});
  add(document,'visibilitychange',()=>{if(document.hidden)togglePause(true);});
  for(const el of root.querySelectorAll('[data-game-control]')){
    add(el,'pointerdown',e=>{
      if(s.mode!=='play'||paused||e.button!==0)return;
      e.preventDefault();a.unlock();art.focus({preventScroll:true});el.setPointerCapture(e.pointerId);
      const act=el.dataset.gameControl;fingers.set(e.pointerId,act);el.dataset.held='';if(act==='jump')jump=true;
    });
    const release=e=>{const act=fingers.get(e.pointerId);fingers.delete(e.pointerId);if(![...fingers.values()].includes(act))el.removeAttribute('data-held');};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])add(el,type,release);
    add(el,'click',e=>{
      if(e.detail!==0||s.mode!=='play'||paused)return;
      const act=el.dataset.gameControl;
      if(act==='jump')jump=true;
      else {const token=Symbol();fingers.set(token,act);setTimeout(()=>fingers.delete(token),180);}
    });
  }
  const resize=()=>{
    const box=art.getBoundingClientRect();if(box.width<=0||box.height<=0)return;
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);
    view=box.width/box.height*HEIGHT;
    c.setTransform(canvas.width/view,0,0,canvas.height/HEIGHT,0,0);c.imageSmoothingEnabled=false;
  };
  const ro=new ResizeObserver(resize);ro.observe(art);resize();
  function frame(stamp){
    if(stopped)return;
    if(!root.isConnected){api.stop();return;}
    const t=stamp/1000,elapsed=last===undefined?0:Math.min(.085,t-last);last=t;
    if(!paused){
      carry+=elapsed;
      const held=(cmd)=>[...keys].some(k=>forKey[k]===cmd)||[...fingers.values()].includes(cmd);
      const input={left:held('left'),right:held('right'),fire:held('fire'),jump,jumpHeld:held('jump')};
      while(carry>=STEP){step(s,input);carry-=STEP;jump=false;input.jump=false;}
    }else carry=0;
    if(s.mode==='play'&&(oldMode==='won'||oldMode==='lost'||oldIndex!==s.index))cam=0;
    oldMode=s.mode;oldIndex=s.index;
    const dest=Math.max(0,Math.min(s.level.width-view,s.p.x-view*.32));
    cam=paused?cam:cam+(dest-cam)*Math.min(1,elapsed*11);
    for(const event of drain(s))a.effect(event);
    a.play(!paused&&s.mode==='play',s.fast,s.index);
    paint(c,s,view,cam,reduce.matches?0:s.age+(s.mode==='ready'?t:s.sceneTime*.08),reduce.matches);
    renderUI();
    if(s.result&&s.result!==reported){
      const result=reported=s.result;
      Promise.resolve(onFinish?.(result,()=>!stopped&&s.result===result)).catch(err=>console.error('[bidgame] score submission',err));
    }
    raf=requestAnimationFrame(frame);
  }
  const api={stop(){if(stopped)return;stopped=true;cancelAnimationFrame(raf);ro.disconnect();listeners.abort();clearControls();a.stop();}};
  renderUI();raf=requestAnimationFrame(frame);
  return api;
}
