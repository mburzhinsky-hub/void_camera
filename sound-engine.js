(()=> {
  class VoidSoundEngine {
    constructor(){
      this.ctx=null;
      this.master=null;
      this.last=new Map();
      this.enabled=true;
    }
    unlock(){
      try{
        if(!this.ctx){
          const Ctx=window.AudioContext||window.webkitAudioContext;
          this.ctx=new Ctx();
          this.master=this.ctx.createGain();
          this.master.gain.value=.72;
          this.master.connect(this.ctx.destination);
        }
        if(this.ctx.state==='suspended') this.ctx.resume();
      }catch{}
      return this.ctx;
    }
    allow(channel,ms=46){
      const now=performance.now(),prev=this.last.get(channel)||0;
      if(now-prev<ms)return false;
      this.last.set(channel,now);return true;
    }
    tone(freq,start,dur,gain=.03,type='triangle',endFreq=null,pan=0){
      const c=this.unlock(); if(!c||!this.enabled)return;
      const o=c.createOscillator(),g=c.createGain(),now=c.currentTime;
      const p=c.createStereoPanner?c.createStereoPanner():null;
      o.type=type;o.frequency.setValueAtTime(freq,now+start);
      if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),now+start+dur*.9);
      g.gain.setValueAtTime(.0001,now+start);
      g.gain.exponentialRampToValueAtTime(gain,now+start+.003);
      g.gain.exponentialRampToValueAtTime(.0001,now+start+dur);
      if(p){p.pan.value=pan;o.connect(g).connect(p).connect(this.master)}else{o.connect(g).connect(this.master)}
      o.start(now+start);o.stop(now+start+dur+.012);
    }
    noise(start=0,dur=.018,gain=.014,highpass=1500,lowpass=9000){
      const c=this.unlock(); if(!c||!this.enabled)return;
      const n=Math.max(1,Math.floor(c.sampleRate*dur)),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
      for(let i=0;i<n;i++){const e=Math.pow(1-i/n,2.25);d[i]=(Math.random()*2-1)*e}
      const src=c.createBufferSource(),hp=c.createBiquadFilter(),lp=c.createBiquadFilter(),g=c.createGain(),now=c.currentTime;
      src.buffer=b;hp.type='highpass';hp.frequency.value=highpass;lp.type='lowpass';lp.frequency.value=lowpass;g.gain.value=gain;
      src.connect(hp).connect(lp).connect(g).connect(this.master);src.start(now+start);
    }
    soft(){ if(!this.allow('soft',48))return; this.noise(0,.008,.006,2800);this.tone(1100,0,.016,.008,'triangle',920); }
    detent(){ this.iso(false); }
    majorDetent(){ this.iso(true); }
    cameraFlip(){ this.flip(); }
    iso(major=false){
      if(!this.allow('iso',54))return;
      if(major){this.noise(0,.013,.013,1800);this.tone(430,0,.037,.023,'triangle',360);this.tone(1350,.012,.018,.009,'square',1040)}
      else{this.noise(0,.010,.009,2500);this.tone(1120,0,.018,.010,'triangle',930)}
    }
    shutterStep(){
      if(!this.allow('shutter-step',70))return;
      this.noise(0,.016,.016,1200);this.tone(310,0,.045,.025,'triangle',225);this.tone(980,.018,.024,.010,'square',760);
    }
    wb(major=false){
      if(!this.allow('wb',62))return;
      const base=major?920:1180;
      this.tone(base,0,.045,.014,'sine',base*1.18,-.12);
      this.tone(base*1.45,.018,.038,.010,'triangle',base*1.25,.12);
    }
    ev(major=false){
      if(!this.allow('ev',58))return;
      const f=major?760:980;this.noise(0,.008,.006,3000);this.tone(f,0,.016,.008,'square',f*.88);
    }
    focusStep(){
      if(!this.allow('focus-step',64))return;
      this.tone(1240,0,.024,.009,'sine',1380);this.tone(1640,.020,.020,.006,'sine',1480);
    }
    toggle(on){
      if(!this.allow('toggle',70))return;
      if(on){this.noise(0,.012,.008,2000);this.tone(620,0,.032,.018,'triangle',900);this.tone(1320,.025,.023,.012,'square',1480)}
      else{this.tone(1080,0,.030,.016,'triangle',620);this.tone(360,.028,.040,.012,'sine',280)}
    }
    preset(){
      if(!this.allow('preset',130))return;
      this.tone(380,0,.065,.014,'sine',520);this.tone(700,.036,.070,.017,'triangle',920);this.tone(1260,.075,.045,.010,'sine',1420);
    }
    focus(){
      if(!this.allow('focus',110))return;
      this.tone(920,0,.028,.012,'sine',1040);this.tone(1440,.038,.034,.010,'sine',1280);
    }
    flip(){
      if(!this.allow('flip',140))return;
      this.tone(360,0,.060,.018,'triangle',780,-.18);this.tone(920,.044,.055,.014,'triangle',480,.18);
    }
    shutter(){
      if(!this.allow('shutter',220))return;
      this.noise(0,.026,.030,700,5600);this.tone(165,0,.052,.028,'triangle',105);
      this.noise(.050,.024,.024,650,4300);this.tone(112,.052,.060,.020,'sine',86);
    }
    error(){
      if(!this.allow('error',180))return;
      this.tone(230,0,.075,.025,'square',180);this.tone(145,.058,.070,.016,'sine',120);
    }
    leverGrab(){
      if(!this.allow('lever-grab',100))return;
      this.noise(0,.018,.011,1600);this.tone(560,0,.038,.016,'triangle',690);
    }
    leverRatchet(step=0){
      if(!this.allow('lever-ratchet',48))return;
      const f=680+(step%4)*55;this.noise(0,.011,.012,1400);this.tone(f,0,.021,.011,'triangle',f*.76);
    }
    leverLatch(){
      if(!this.allow('lever-latch',180))return;
      this.noise(0,.032,.028,620,4200);this.tone(235,0,.115,.035,'triangle',105);this.tone(1240,.043,.030,.015,'square',980);this.tone(88,.085,.160,.024,'sine',70);
    }
    boot(){
      if(!this.allow('boot',300))return;
      this.tone(86,0,.24,.022,'sine',54);this.tone(520,.035,.095,.013,'sine',760);this.tone(980,.090,.075,.014,'triangle',1380);this.tone(1820,.155,.045,.009,'sine',2080);
    }
  }
  window.VoidSound=new VoidSoundEngine();
})();