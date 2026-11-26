/* A tiny synthesized score and tactile office effects, unlocked by a user gesture. */
const lead=[72,76,79,0,81,79,76,0, 74,77,81,0,79,77,74,0, 72,76,79,84,83,79,76,0, 74,77,79,0,77,74,71,0];
const bass=[48,48,53,53,57,57,55,55];
const hz=(m)=>440*2**((m-69)/12);
export function createAudio(){
  let ctx,out,noise,muted=false,tick=0,next=0,clock=0;
  function unlock(){
    if(muted)return;
    const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)return;
    try{
      if(!ctx){
        ctx=new Audio();out=ctx.createGain();out.gain.value=.39;out.connect(ctx.destination);
        noise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.33),ctx.sampleRate);
        const arr=noise.getChannelData(0);for(let i=0;i<arr.length;i++)arr[i]=Math.random()*2-1;
      }
      if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    }catch{/* Gameplay works without audio. */}
  }
  function tone(time,m,d,vol,shape='square',bend=0){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=shape;o.frequency.value=hz(m);
    if(bend)o.frequency.exponentialRampToValueAtTime(hz(m+bend),time+d);
    g.gain.setValueAtTime(.0001,time);g.gain.linearRampToValueAtTime(vol,time+.006);g.gain.exponentialRampToValueAtTime(.0001,time+d);
    o.connect(g);g.connect(out);o.start(time);o.stop(time+d+.012);
  }
  function scrape(time,d,volume,freq){
    const n=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noise;
    filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=.85;g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.0001,time+d);
    n.connect(filter);filter.connect(g);g.connect(out);n.start(time);n.stop(time+d+.01);
  }
  function effect(id){
    if(!ctx||ctx.state!=='running'||muted)return;const t=ctx.currentTime+.004;
    const notes=(ns,d=.13)=>ns.forEach((n,i)=>tone(t+i*d*.62,n,d,.15,i%2?'triangle':'square'));
    switch(id){
      case 'key':scrape(t,.047,.28,1690);tone(t,55,.046,.12,'triangle');break;
      case 'jump':scrape(t,.095,.16,1970);tone(t,57,.11,.13,'triangle',12);break;
      case 'page':scrape(t,.11,.32,3060);tone(t,81,.09,.13,'triangle',7);break;
      case 'print':scrape(t,.20,.25,955);tone(t,43,.14,.1,'sawtooth',-3);break;
      case 'staple':scrape(t,.06,.32,2310);tone(t,68,.04,.14,'triangle');break;
      case 'coffee':notes([64,69,76]);break;
      case 'usb':notes([71,78,83]);break;
      case 'stapler':scrape(t,.07,.29,2460);notes([60,72,79]);break;
      case 'certificate':notes([72,76,79,84],.15);break;
      case 'clear':notes([67,72,76,79,84],.18);break;
      case 'win':notes([72,76,79,84,81,84,88,91],.20);break;
      case 'hurt':tone(t,51,.18,.18,'triangle',-8);break;
      case 'lose':notes([69,64,57,48],.21);break;
      case 'stomp':tone(t,51,.105,.16,'triangle',-4);scrape(t,.06,.21,1150);break;
      case 'warn':tone(t,62,.13,.12,'triangle');tone(t+.15,62,.13,.12,'triangle');break;
    }
  }
  return {
    unlock,effect,
    toggle(){muted=!muted;if(!muted)unlock();if(ctx&&out)out.gain.setTargetAtTime(muted?0:.39,ctx.currentTime,.016);return muted;},
    play(active,fast,level){
      if(!ctx||ctx.state!=='running'||muted)return;
      const t=ctx.currentTime;
      if(!active){next=0;return;}
      if(!next||t>next+.2)next=t+.06;
      const length=fast?.113:.168;
      while(next<t+.075){
        const trans=[0,2,0,-2,2,4][level], note=lead[tick%lead.length];
        if(note)tone(next,note+trans,length*.78,.062,'square');
        if(tick%2===0)tone(next,bass[Math.floor(tick/4)%8]+trans,length*1.08,.105,'triangle');
        if(tick%4===1||tick%4===3)scrape(next,.043,.084,2700);
        tick++;next+=length;clock++;
      }
    },
    stop(){if(ctx && ctx.state!=='closed')ctx.close().catch(()=>{});}
  };
}
