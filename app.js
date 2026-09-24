const $=id=>document.getElementById(id);
const video=$('cameraVideo'), gate=$('permissionGate'), toast=$('toast');
const pages=[...document.querySelectorAll('.page')];
const finder=$('finderFrame'), analysisOverlay=$('analysisOverlay'), analysisCtx=analysisOverlay.getContext('2d');
const histCanvas=$('histogramCanvas'), histCtx=histCanvas.getContext('2d');
const analysisBuffer=$('analysisBuffer'), bufferCtx=analysisBuffer.getContext('2d',{willReadFrequently:true});

let stream=null, track=null, facingMode='environment';
let activeLook='FUJI CLASSIC', pendingLook='FUJI CLASSIC', currentCategory='ALL';
let capturedBlob=null, originalBlob=null, lastObjectUrl=null, lastTickStep=null;
let rawEnabled=false,hdrEnabled=false,gridEnabled=true,histEnabled=true,zebraEnabled=false,peakingEnabled=false,stabEnabled=false;
let currentRatio='4:3', currentZoom=1, currentEV=0, analysisRAF=0;
let previewISO=100, previewShutter=3, previewWB=5200, focusMode='AF', meteringMode='EVALUATIVE';
let presetFrameData='';
const favorites=new Set();

const looks=[
 {name:'FUJI CLASSIC',cat:'FUJI',desc:'Muted documentary colour',filter:'contrast(1.12) saturate(.78) brightness(.98) sepia(.05) hue-rotate(-5deg)',thumb:'./assets/presets/classic_city.svg'},
 {name:'FUJI SOFT',cat:'FUJI',desc:'Pastel skin, lifted shadows',filter:'contrast(.86) saturate(.76) brightness(1.08) sepia(.05) hue-rotate(-2deg)',thumb:'./assets/presets/soft_blossom.svg'},
 {name:'FUJI STREET',cat:'FUJI',desc:'Dense blacks, urban colour',filter:'contrast(1.28) saturate(1.14) brightness(.95) hue-rotate(-8deg)',thumb:'./assets/presets/street_urban.svg'},
 {name:'FUJI WARM',cat:'FUJI',desc:'Amber highlights, soft greens',filter:'contrast(1.02) saturate(1.08) sepia(.24) brightness(1.01) hue-rotate(-7deg)',thumb:'./assets/presets/warm_interior.svg'},
 {name:'FUJI COOL',cat:'FUJI',desc:'Clean cyan, crisp daylight',filter:'contrast(1.09) saturate(.88) brightness(1.00) hue-rotate(12deg)',thumb:'./assets/presets/cool_bridge.svg'},
 {name:'FUJI MONO',cat:'B&W',desc:'Fine-grain tonal monochrome',filter:'grayscale(1) contrast(1.30) brightness(.95)',thumb:'./assets/presets/mono_portrait.svg'},
 {name:'PORTRAIT 400',cat:'MODERN',desc:'Warm skin, gentle roll-off',filter:'contrast(.92) saturate(.92) brightness(1.05) sepia(.10) hue-rotate(-3deg)',thumb:'./assets/presets/portrait_400.svg'},
 {name:'DAYLIGHT 250',cat:'CINEMA',desc:'Soft highlight cinema stock',filter:'contrast(.94) saturate(.84) brightness(1.02) sepia(.08) hue-rotate(-4deg)',thumb:'./assets/presets/daylight_250.svg'},
 {name:'TUNGSTEN 500',cat:'CINEMA',desc:'Cyan shadows, hot practicals',filter:'contrast(1.16) saturate(1.02) brightness(.93) hue-rotate(15deg)',thumb:'./assets/presets/tungsten_500.svg'},
 {name:'BLEACH',cat:'CINEMA',desc:'Silver blacks, restrained colour',filter:'contrast(1.42) saturate(.32) brightness(.94)',thumb:'./assets/presets/bleach.svg'}
];

function snapshotPresetFrame(){
 if(!video.videoWidth||!video.videoHeight)return '';
 try{
  const c=document.createElement('canvas');
  const targetW=420,targetH=250;
  c.width=targetW;c.height=targetH;
  const ctx=c.getContext('2d');
  const srcAspect=video.videoWidth/video.videoHeight;
  const dstAspect=targetW/targetH;
  let sx=0,sy=0,sw=video.videoWidth,sh=video.videoHeight;
  if(srcAspect>dstAspect){sw=video.videoHeight*dstAspect;sx=(video.videoWidth-sw)/2}
  else{sh=video.videoWidth/dstAspect;sy=(video.videoHeight-sh)/2}
  ctx.drawImage(video,sx,sy,sw,sh,0,0,targetW,targetH);
  presetFrameData=c.toDataURL('image/jpeg',.78);
  return presetFrameData;
 }catch(e){return ''}
}

let audioCtx=null;
function getAudio(){
 try{
  if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
 }catch{return null}
}
function tone(freq,start,dur,gain=.03,type='triangle',slideTo=null){
 const ctx=getAudio(); if(!ctx)return;
 const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime;
 o.type=type;o.frequency.setValueAtTime(freq,now+start);
 if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo,now+start+dur*.9);
 g.gain.setValueAtTime(.0001,now+start);
 g.gain.exponentialRampToValueAtTime(gain,now+start+.004);
 g.gain.exponentialRampToValueAtTime(.0001,now+start+dur);
 o.connect(g).connect(ctx.destination);o.start(now+start);o.stop(now+start+dur+.01);
}
function noiseBurst(start=.0,dur=.02,gain=.018,highpass=1200){
 const ctx=getAudio(); if(!ctx)return;
 const n=Math.max(1,Math.floor(ctx.sampleRate*dur));
 const b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);
 for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);
 const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain(),now=ctx.currentTime;
 src.buffer=b;f.type='highpass';f.frequency.value=highpass;g.gain.value=gain;
 src.connect(f).connect(g).connect(ctx.destination);src.start(now+start);
}
const sound={
 soft(){ tone(1280,0,.018,.012,'square',980); },
 toggleOn(){ tone(760,0,.028,.026,'triangle',1040);tone(1320,.024,.024,.018,'square');noiseBurst(.0,.015,.008,1800); },
 toggleOff(){ tone(980,0,.028,.022,'triangle',620);tone(420,.026,.035,.018,'sine'); },
 detent(){ noiseBurst(0,.012,.012,2200);tone(1180,0,.022,.014,'triangle',920); },
 majorDetent(){ noiseBurst(0,.016,.018,1500);tone(520,0,.042,.028,'triangle',430);tone(1420,.014,.02,.012,'square'); },
 preset(){ tone(420,0,.07,.018,'sine',620);tone(760,.035,.07,.02,'triangle',960);tone(1240,.07,.045,.012,'sine'); },
 cameraFlip(){ tone(420,0,.055,.024,'triangle',720);tone(920,.045,.045,.018,'triangle',520); },
 focus(){ tone(880,0,.028,.016,'sine');tone(1320,.038,.034,.014,'sine'); },
 shutter(){ noiseBurst(0,.024,.030,900);tone(180,0,.045,.032,'triangle',120);noiseBurst(.048,.022,.024,700);tone(120,.05,.05,.026,'sine',90); },
 error(){ tone(220,0,.07,.03,'square',170);tone(150,.055,.06,.022,'sine'); },
 leverRatchet(step=0){ const base=700+(step%4)*80;noiseBurst(0,.012,.016,1300);tone(base,0,.022,.015,'triangle',base*.78); },
 leverLatch(){ noiseBurst(0,.03,.032,700);tone(240,0,.11,.04,'triangle',110);tone(1280,.045,.028,.018,'square');tone(92,.08,.15,.03,'sine'); },
 launch(){ tone(140,0,.16,.025,'sine',82);tone(980,.035,.04,.018,'triangle',1320);tone(1680,.09,.025,.012,'square'); }
};

function showPage(id){
 pages.forEach(p=>p.classList.toggle('active',p.id===id));
 if(id==='presetsPage'){ pendingLook=activeLook; snapshotPresetFrame(); renderPresets(); }
 tick('soft');
}
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>showPage('cameraPage'));

function tick(kind='soft'){
 if(kind==='major') sound.majorDetent();
 else if(kind==='preset') sound.preset();
 else if(kind==='flip') sound.cameraFlip();
 else if(kind==='focus') sound.focus();
 else if(kind==='error') sound.error();
 else sound.detent();
}
function showToast(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),1200)}

function getLook(name=activeLook){return looks.find(x=>x.name===name)||looks[0]}
function buildPreviewFilter(){
 const l=getLook();
 const isoBoost=Math.max(.82,Math.min(1.20,.88 + Math.log2(Math.max(50,previewISO)/50)*.045));
 const shutterStops=[.78,.84,.91,1,1.08,1.15,1.22];
 const shutterBoost=shutterStops[previewShutter]||1;
 const wbShift=(previewWB-5200)/3800;
 const wbHue=wbShift*7;
 const wbSepia=Math.abs(wbShift)*.08;
 const hdr=hdrEnabled?' contrast(.90) saturate(1.06) brightness(1.02)':'';
 return l.filter+` brightness(${(isoBoost*shutterBoost).toFixed(3)}) sepia(${wbSepia.toFixed(3)}) hue-rotate(${wbHue.toFixed(2)}deg)`+hdr;
}
function applyLook(){
 $('activeLookReadout').textContent=activeLook;
 $('colorCardValue').textContent=activeLook;
 video.style.filter=buildPreviewFilter();
}
function renderPresets(){
 const grid=$('presetGrid'); grid.innerHTML='';
 looks.filter(l=>currentCategory==='ALL'||(currentCategory==='FAV'?favorites.has(l.name):l.cat===currentCategory)).forEach(l=>{
  const card=document.createElement('article');
  card.className='preset-card'+(l.name===pendingLook?' active':'')+(favorites.has(l.name)?' favorite':'');
  card.setAttribute('role','button');card.tabIndex=0;
  const safe=l.name.replace(/'/g,"&#39;");
  card.innerHTML=`<div class="preset-preview" style="background-image:url('${l.thumb}');filter:${l.filter}"></div><button class="heart" type="button" aria-label="Favorite ${safe}">♡</button><div class="preset-copy"><b>${l.name}</b><small>${l.desc}</small></div>`;
  const choose=()=>{pendingLook=l.name;renderPresets();tick('major')};
  card.onclick=choose;
  card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}};
  const heart=card.querySelector('.heart');
  heart.onclick=e=>{e.stopPropagation();favorites.has(l.name)?favorites.delete(l.name):favorites.add(l.name);renderPresets();tick()};
  grid.appendChild(card);
 });
}
document.querySelectorAll('#presetTabs button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('#presetTabs button').forEach(x=>x.classList.remove('active'));
 b.classList.add('active');currentCategory=b.dataset.category;renderPresets();tick();
});
$('presetButton').onclick=()=>showPage('presetsPage');
$('colorCard').onclick=()=>showPage('presetsPage');
$('applyPresetButton').onclick=()=>{activeLook=pendingLook;applyLook();sound.preset();showPage('cameraPage');showToast(activeLook+' APPLIED')};

async function startCamera(){
 try{
  stream?.getTracks().forEach(t=>t.stop());
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1440}},audio:false});
  video.srcObject=stream;await video.play();track=stream.getVideoTracks()[0];
  gate.classList.add('hidden');inspectCapabilities();applyLook();runAnalysis();showToast('CAMERA LIVE');
 }catch(e){console.error(e);showToast('CAMERA ACCESS NEEDED')}
}
const lever=$('launchLever'),leverHandle=$('startCameraButton'),leverLabel=$('launchLeverLabel');
let leverDragging=false,leverStartX=0,leverX=0,lastLeverStep=-1,leverArmed=false;
function leverMax(){ return Math.max(120,Math.min(210,(lever?.clientWidth||320)-92)); }
function setLever(x){
 if(!lever)return;
 const max=leverMax(); leverX=Math.max(0,Math.min(max,x));
 const p=leverX/max;
 lever.style.setProperty('--lever-x',leverX+'px');
 lever.style.setProperty('--lever-p',(p*100).toFixed(1)+'%');gate.style.setProperty('--launch-p',p.toFixed(3));
 const step=Math.floor(p*9);
 if(step!==lastLeverStep&&leverDragging){
   lastLeverStep=step; sound.leverRatchet(step);
 }
 if(leverLabel) leverLabel.textContent=p>.78?'RELEASE TO ENGAGE':p>.28?'ARMING SENSOR':'PULL TO ARM';
 lever.classList.toggle('near-lock',p>.82);
}
function resetLever(){
 leverArmed=false; lever?.classList.remove('locked','near-lock');
 setLever(0); if(leverLabel)leverLabel.textContent='PULL TO ARM';
}
async function engageLever(){
 if(leverArmed)return;
 leverArmed=true;leverDragging=false;
 const max=leverMax();setLever(max);lever?.classList.add('locked');
 if(leverLabel)leverLabel.textContent='SENSOR ENGAGED';
 sound.leverLatch();
 gate.classList.add('launching','booting');
 setTimeout(()=>sound.launch(),105);
 try{await startCamera()}finally{setTimeout(()=>gate.classList.remove('launching','booting'),520)}
}
function leverPointX(e){return e.touches?.[0]?.clientX ?? e.clientX ?? 0}
leverHandle.addEventListener('pointerdown',e=>{
 getAudio();
 leverDragging=true;leverStartX=leverPointX(e)-leverX;lastLeverStep=-1;leverHandle.setPointerCapture?.(e.pointerId);
 gate.classList.add('lever-active');sound.toggleOn();
});
leverHandle.addEventListener('pointermove',e=>{
 if(!leverDragging)return;setLever(leverPointX(e)-leverStartX);
});
leverHandle.addEventListener('pointerup',e=>{
 if(!leverDragging)return;leverDragging=false;gate.classList.remove('lever-active');
 const armed=leverX/leverMax()>.78;
 if(armed) engageLever(); else {sound.toggleOff();resetLever()}
});
leverHandle.addEventListener('pointercancel',()=>{leverDragging=false;gate.classList.remove('lever-active');resetLever()});
leverHandle.addEventListener('click',e=>e.preventDefault());
$('switchCameraButton').onclick=async()=>{facingMode=facingMode==='environment'?'user':'environment';sound.cameraFlip();await startCamera()};

function inspectCapabilities(){
 const caps=track?.getCapabilities?.()||{},settings=track?.getSettings?.()||{};
 currentZoom=settings.zoom||caps.zoom?.min||1;
 updateLensAvailability(caps);

 setupControlCapability('isoSlider','isoCapability',caps.iso,'ISO');
 if(caps.iso){
  $('isoSlider').min=caps.iso.min;$('isoSlider').max=caps.iso.max;$('isoSlider').step=caps.iso.step||1;
  previewISO=settings.iso||caps.iso.min;$('isoSlider').value=previewISO;$('isoValue').textContent=Math.round(previewISO);$('isoReadout').textContent='ISO '+Math.round(previewISO);
 }

 setupControlCapability('shutterSlider','shutterCapability',caps.exposureTime,'SHUTTER');
 setupControlCapability('wbSlider','wbCapability',caps.colorTemperature,'WHITE BALANCE');

 const evCap=caps.exposureCompensation;
 $('evCapability').textContent=evCap?'SENSOR CONTROL':'WEB PREVIEW';
 $('proEvSlider').closest('.control-card')?.classList.toggle('preview-control',!evCap);
 if(evCap){$('proEvSlider').min=evCap.min;$('proEvSlider').max=evCap.max;$('proEvSlider').step=evCap.step||.1}

 const focusCap=caps.focusDistance||caps.focusMode;
 $('focusCapability').textContent=focusCap?'SENSOR CONTROL':'WEB PREVIEW';
 ['rawTool','hdrTool','stabTool'].forEach(id=>$(id).classList.add('preview-only'));
}
function setupControlCapability(sliderId,labelId,capability){
 const slider=$(sliderId);
 slider.disabled=false;
 $(labelId).textContent=capability?'SENSOR CONTROL':'WEB PREVIEW';
 slider.closest('.control-card')?.classList.toggle('preview-control',!capability);
}
function updateLensAvailability(caps){
 document.querySelectorAll('.lens-pill').forEach(b=>{
  const z=parseFloat(b.dataset.zoom);
  b.classList.remove('muted');
  if(z<1 && (!caps.zoom||z<caps.zoom.min)) b.classList.add('muted');
  if(caps.zoom&&z>caps.zoom.max) b.classList.add('muted');
 });
}

async function setZoom(z){
 z=parseFloat(z);currentZoom=z;
 const caps=track?.getCapabilities?.()||{};
 if(caps.zoom){
  z=Math.min(caps.zoom.max,Math.max(caps.zoom.min,z));
  try{await track.applyConstraints({advanced:[{zoom:z}]});video.style.transform='scale(1)'}catch{video.style.transform='scale('+Math.max(1,z)+')'}
 }else video.style.transform='scale('+Math.max(1,z)+')';
 document.querySelectorAll('.lens-pill').forEach(b=>b.classList.toggle('active',Math.abs(parseFloat(b.dataset.zoom)-z)<.08));
 const step=Math.round(z*10);if(step!==lastTickStep){tick(step%10===0?'major':'soft');lastTickStep=step}
}
document.querySelectorAll('.lens-pill').forEach(b=>b.onclick=()=>{
 if(b.classList.contains('muted'))return showToast('0.6× NOT EXPOSED BY SAFARI');
 setZoom(b.dataset.zoom)
});

function setEV(v){
 currentEV=parseFloat(v);$('evReadout').textContent=currentEV>0?'+'+currentEV.toFixed(1):currentEV.toFixed(1);$('proEvValue').textContent=$('evReadout').textContent;
 const caps=track?.getCapabilities?.()||{};
 if(caps.exposureCompensation)track.applyConstraints({advanced:[{exposureCompensation:currentEV}]}).catch(()=>{});
 else video.style.opacity=Math.max(.62,Math.min(1,1+currentEV*.07));
 sliderSound($('proEvSlider'),currentEV);
}
$('evSlider').oninput=e=>{setEV(e.target.value);$('proEvSlider').value=e.target.value};
$('proEvSlider').oninput=e=>{setEV(e.target.value);$('evSlider').value=Math.max(-2,Math.min(2,e.target.value))};

$('isoSlider').oninput=async e=>{
 previewISO=Math.round(+e.target.value);$('isoValue').textContent=previewISO;$('isoReadout').textContent='ISO '+previewISO;
 const caps=track?.getCapabilities?.()||{};
 if(caps.iso)try{await track.applyConstraints({advanced:[{iso:previewISO}]})}catch{}
 applyLook();sliderSound($('isoSlider'),previewISO);
};
const shutterValues=['1/4000','1/1000','1/250','1/60','1/15','1/4','1s'];
const shutterSeconds=[.00025,.001,.004,.0167,.0667,.25,1];
$('shutterSlider').oninput=async e=>{
 previewShutter=+e.target.value;const label=shutterValues[previewShutter];
 $('shutterValue').textContent=label;$('shutterReadout').textContent=label+' · F1.8';
 const caps=track?.getCapabilities?.()||{};
 if(caps.exposureTime)try{await track.applyConstraints({advanced:[{exposureTime:shutterSeconds[previewShutter]}]})}catch{}
 applyLook();sliderSound($('shutterSlider'),previewShutter);
};
$('wbSlider').oninput=async e=>{
 previewWB=+e.target.value;$('wbValue').textContent=previewWB+'K';
 const caps=track?.getCapabilities?.()||{};
 if(caps.colorTemperature)try{await track.applyConstraints({advanced:[{colorTemperature:previewWB}]})}catch{}
 applyLook();sliderSound($('wbSlider'),previewWB);
};

function toggleState(btn,state){$(btn)?.classList.toggle('active',state)}
function syncGrid(state){gridEnabled=state;$('gridOverlay').classList.toggle('off',!state);toggleState('gridQuick',state);toggleState('gridTool',state)}
$('gridQuick').onclick=()=>{syncGrid(!gridEnabled);tick()};
$('gridTool').onclick=()=>{syncGrid(!gridEnabled);tick()};
function syncHist(state){histEnabled=state;document.querySelector('.histogram-box').classList.toggle('off',!state);toggleState('histQuick',state);toggleState('histTool',state)}
$('histQuick').onclick=()=>{syncHist(!histEnabled);tick()};
$('histTool').onclick=()=>{syncHist(!histEnabled);tick()};
$('zebraTool').onclick=()=>{zebraEnabled=!zebraEnabled;toggleState('zebraTool',zebraEnabled);tick()};
$('peakingTool').onclick=()=>{peakingEnabled=!peakingEnabled;toggleState('peakingTool',peakingEnabled);tick()};
$('stabTool').onclick=()=>{stabEnabled=!stabEnabled;toggleState('stabTool',stabEnabled);showToast(stabEnabled?'WEB STABILISATION PREVIEW ON':'STABILISATION OFF');tick()};
$('rawTool').onclick=$('rawQuick').onclick=()=>{
 rawEnabled=!rawEnabled;toggleState('rawTool',rawEnabled);toggleState('rawQuick',rawEnabled);rawEnabled?sound.toggleOn():sound.toggleOff();
 $('qualityReadout').textContent=rawEnabled?'12MP RAW+JPEG':'12MP JPEG';
 showToast(rawEnabled?'ORIGINAL + LOOK JPEG':'PROCESSED JPEG');tick('major')
};
$('hdrTool').onclick=$('hdrQuick').onclick=()=>{hdrEnabled=!hdrEnabled;toggleState('hdrTool',hdrEnabled);toggleState('hdrQuick',hdrEnabled);hdrEnabled?sound.toggleOn():sound.toggleOff();applyLook();showToast(hdrEnabled?'HDR LOOK ON':'HDR OFF');tick()};

$('proButton').onclick=()=>showPage('proPage');
$('resetPro').onclick=()=>{
 syncGrid(true);syncHist(true);zebraEnabled=peakingEnabled=rawEnabled=hdrEnabled=stabEnabled=false;
 ['zebraTool','peakingTool','rawTool','rawQuick','hdrTool','hdrQuick','stabTool'].forEach(x=>$(x)?.classList.remove('active'));
 previewISO=100;previewShutter=3;previewWB=5200;currentEV=0;
 $('isoSlider').value=100;$('isoValue').textContent='100';
 $('shutterSlider').value=3;$('shutterValue').textContent='1/60';
 $('wbSlider').value=5200;$('wbValue').textContent='5200K';
 $('evSlider').value=0;$('proEvSlider').value=0;setEV(0);applyLook();showToast('PRO RESET');
};

$('ratioTool').onclick=()=>{
 currentRatio=currentRatio==='4:3'?'3:2':currentRatio==='3:2'?'16:9':'4:3';
 finder.className='finder-frame ratio-'+currentRatio.replace(':','-');$('ratioGlyph').textContent=currentRatio;tick('major')
};

$('focusCard').onclick=async()=>{sound.focus();
 focusMode=focusMode==='AF'?'MF':'AF';$('focusCardValue').textContent=focusMode;$('focusReadout').textContent=focusMode;
 $('focusManualControl').hidden=focusMode!=='MF';
 const caps=track?.getCapabilities?.()||{};
 if(caps.focusMode)try{await track.applyConstraints({advanced:[{focusMode:focusMode==='AF'?'continuous':'manual'}]})}catch{}
 tick('major');
};
$('focusDistanceSlider').oninput=async e=>{
 const v=+e.target.value;$('focusDistanceValue').textContent=v.toFixed(2);
 const caps=track?.getCapabilities?.()||{};
 if(caps.focusDistance){
  const d=caps.focusDistance.min+(caps.focusDistance.max-caps.focusDistance.min)*v;
  try{await track.applyConstraints({advanced:[{focusMode:'manual',focusDistance:d}]})}catch{}
 }
 sliderSound($('focusDistanceSlider'),v);
};

$('meteringCard').onclick=()=>{
 const modes=['EVALUATIVE','CENTER','SPOT'];meteringMode=modes[(modes.indexOf(meteringMode)+1)%modes.length];
 $('meteringCard').querySelector('b').textContent=meteringMode;
 $('meteringReticle').classList.toggle('active',meteringMode==='SPOT');
 showToast(meteringMode+' METERING');tick();
};

finder.addEventListener('click',e=>{
 if(meteringMode!=='SPOT'&&focusMode!=='MF')return;
 const r=finder.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
 const ret=$('meteringReticle');ret.style.left=x+'px';ret.style.top=y+'px';ret.classList.add('active');tick('major');
});

document.querySelectorAll('.mode-strip button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('.mode-strip button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
 if(b.dataset.mode==='MORE')showPage('proPage');
 else if(b.dataset.mode==='VIDEO')showToast('VIDEO UI READY · CAPTURE NEXT');
 else if(b.dataset.mode==='PORTRAIT')showToast('PORTRAIT PREVIEW');
 else if(b.dataset.mode==='SLO-MO')showToast('SLO-MO PREVIEW');
 tick();
});

function runAnalysis(){
 cancelAnimationFrame(analysisRAF);
 const loop=()=>{
  if(video.readyState>=2){
   const w=160,h=120;bufferCtx.drawImage(video,0,0,w,h);const img=bufferCtx.getImageData(0,0,w,h),d=img.data;
   if(histEnabled)drawHistogram(d);drawOverlays(d,w,h);
  }
  analysisRAF=requestAnimationFrame(loop);
 };
 loop();
}
function drawHistogram(d){
 const bins=new Uint32Array(32);for(let i=0;i<d.length;i+=4){const y=(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)|0;bins[Math.min(31,y>>3)]++}
 const max=Math.max(...bins,1);histCtx.clearRect(0,0,histCanvas.width,histCanvas.height);histCtx.strokeStyle='rgba(255,255,255,.75)';histCtx.beginPath();
 bins.forEach((v,i)=>{const x=i/(bins.length-1)*histCanvas.width,y=histCanvas.height-(v/max)*(histCanvas.height-5);if(i===0)histCtx.moveTo(x,y);else histCtx.lineTo(x,y)});histCtx.stroke();
}
function drawOverlays(d,w,h){
 const rect=finder.getBoundingClientRect();analysisOverlay.width=rect.width*devicePixelRatio;analysisOverlay.height=rect.height*devicePixelRatio;
 analysisCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);analysisCtx.clearRect(0,0,rect.width,rect.height);
 if(zebraEnabled){analysisCtx.strokeStyle='rgba(255,255,255,.55)';analysisCtx.lineWidth=1;for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3){const i=(y*w+x)*4,lum=(d[i]+d[i+1]+d[i+2])/3;if(lum>225){const px=x/w*rect.width,py=y/h*rect.height;analysisCtx.beginPath();analysisCtx.moveTo(px-3,py+3);analysisCtx.lineTo(px+3,py-3);analysisCtx.stroke()}}}
 if(peakingEnabled){analysisCtx.fillStyle='rgba(255,255,255,.65)';for(let y=1;y<h-1;y+=3)for(let x=1;x<w-1;x+=3){const i=(y*w+x)*4,ir=(y*w+x+1)*4,id=((y+1)*w+x)*4;const g=Math.abs(d[i]-d[ir])+Math.abs(d[i+1]-d[ir+1])+Math.abs(d[i+2]-d[ir+2])+Math.abs(d[i]-d[id])+Math.abs(d[i+1]-d[id+1])+Math.abs(d[i+2]-d[id+2]);if(g>180)analysisCtx.fillRect(x/w*rect.width,y/h*rect.height,1.6,1.6)}}
}

function drawCapture(canvas,withLook=true){
 const ctx=canvas.getContext('2d');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
 ctx.filter=withLook?(getComputedStyle(video).filter||'none'):'none';
 const scale=parseFloat((video.style.transform.match(/scale\(([^)]+)\)/)||[])[1]||'1');
 if(scale>1){const sw=canvas.width/scale,sh=canvas.height/scale,sx=(canvas.width-sw)/2,sy=(canvas.height-sh)/2;ctx.drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height)}
 else ctx.drawImage(video,0,0,canvas.width,canvas.height);
}
function capture(){
 if(!video.videoWidth){sound.error();return showToast('CAMERA NOT READY')}
 sound.shutter();
 const processed=document.createElement('canvas');drawCapture(processed,true);
 const original=document.createElement('canvas');if(rawEnabled)drawCapture(original,false);
 processed.toBlob(blob=>{
  capturedBlob=blob;if(lastObjectUrl)URL.revokeObjectURL(lastObjectUrl);lastObjectUrl=URL.createObjectURL(blob);
  $('reviewImage').src=lastObjectUrl;$('reviewLook').textContent=activeLook;$('reviewPanel').classList.add('open');
  const old=$('lastShotThumb');old.outerHTML='<img id="lastShotThumb" src="'+lastObjectUrl+'" alt="Last shot">';
 },'image/jpeg',.95);
 if(rawEnabled)original.toBlob(blob=>{originalBlob=blob},'image/jpeg',.98);else originalBlob=null;
}
$('shutterButton').onclick=capture;
$('reviewCloseButton').onclick=()=>$('reviewPanel').classList.remove('open');
$('lastShotButton').onclick=()=>{if(lastObjectUrl)$('reviewPanel').classList.add('open')};
async function shareCapture(){
 if(!capturedBlob)return;
 const files=[new File([capturedBlob],'void-look-'+Date.now()+'.jpg',{type:'image/jpeg'})];
 if(rawEnabled&&originalBlob)files.push(new File([originalBlob],'void-original-'+Date.now()+'.jpg',{type:'image/jpeg'}));
 if(navigator.share&&navigator.canShare?.({files}))try{await navigator.share({files,title:'VOID Camera'})}catch{}
 else saveCapture();
}
function saveCapture(){
 if(!lastObjectUrl)return;
 const a=document.createElement('a');a.href=lastObjectUrl;a.download='void-look-'+Date.now()+'.jpg';a.click();
 if(rawEnabled&&originalBlob){setTimeout(()=>{const u=URL.createObjectURL(originalBlob),b=document.createElement('a');b.href=u;b.download='void-original-'+Date.now()+'.jpg';b.click();setTimeout(()=>URL.revokeObjectURL(u),2000)},250)}
}
$('shareButton').onclick=shareCapture;$('saveButton').onclick=saveCapture;

function updateRangeVisual(input){
 const min=+input.min||0,max=+input.max||100,val=+input.value;
 const pct=max===min?0:((val-min)/(max-min))*100;
 input.style.setProperty('--p',pct+'%');
 const card=input.closest('.control-card,.focus-manual-control');
 if(card){
   const bubble=card.querySelector('.slider-bubble');
   if(bubble){
     bubble.style.setProperty('--x',pct+'%');
     bubble.textContent=formatSliderValue(input,val);
   }
 }
}
function formatSliderValue(input,val){
 if(input.id==='isoSlider') return 'ISO '+Math.round(val);
 if(input.id==='wbSlider') return Math.round(val)+'K';
 if(input.id==='shutterSlider') return shutterValues[Math.round(val)]||'AUTO';
 if(input.id==='focusDistanceSlider') return Number(val).toFixed(2);
 if(input.id==='proEvSlider') return (val>0?'+':'')+Number(val).toFixed(1);
 return String(val);
}

const detentState=new Map();
function shouldSoundDetent(input,val){
 const now=performance.now();
 const id=input.id;
 let key='';
 if(id==='isoSlider') key='iso:'+Math.round(val/100)*100;
 else if(id==='wbSlider') key='wb:'+Math.round(val/500)*500;
 else if(id==='proEvSlider') key='ev:'+Math.round(val*2)/2;
 else if(id==='focusDistanceSlider') key='focus:'+Math.round(val*10)/10;
 else if(id==='shutterSlider') key='shutter:'+Math.round(val);
 else key='generic:'+Math.round(val);
 const last=detentState.get(id)||{key:null,t:0};
 if(last.key===key || now-last.t<55) return false;
 detentState.set(id,{key,t:now});
 return true;
}
function sliderSound(input,val){
 if(!shouldSoundDetent(input,val)) return;
 if(input.id==='shutterSlider') return sound.majorDetent();
 if(input.id==='isoSlider'){
   const major=[100,200,400,800,1600].includes(Math.round(val));
   return major?sound.majorDetent():sound.detent();
 }
 if(input.id==='wbSlider'){
   const major=Math.round(val)%1000===0;
   return major?sound.majorDetent():sound.detent();
 }
 if(input.id==='proEvSlider'){
   const major=Math.abs((val*2)-Math.round(val*2))<.001;
   return major?sound.majorDetent():sound.detent();
 }
 sound.detent();
}
function initSliderUX(){
 document.querySelectorAll('.pro-range').forEach(input=>{
   const card=input.closest('.control-card,.focus-manual-control');
   if(!card)return;
   let bubble=card.querySelector('.slider-bubble');
   if(!bubble){
     bubble=document.createElement('div');
     bubble.className='slider-bubble mono';
     card.appendChild(bubble);
   }
   const start=()=>{card.classList.add('dragging');getAudio();updateRangeVisual(input)};
   const end=()=>card.classList.remove('dragging');
   input.addEventListener('pointerdown',start);
   input.addEventListener('pointerup',end);
   input.addEventListener('pointercancel',end);
   input.addEventListener('input',()=>updateRangeVisual(input));
   input.addEventListener('change',()=>{updateRangeVisual(input);end()});
   updateRangeVisual(input);
 });
}

renderPresets();applyLook();syncGrid(true);syncHist(true);initSliderUX();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=20260925-void-audiofix-1',{updateViaCache:'none'}).catch(()=>{}));


const presetMenu=$('presetMenuButton');
if(presetMenu) presetMenu.onclick=()=>{
 const onlyFav=currentCategory==='FAV';
 if(onlyFav){currentCategory='ALL';showToast('ALL PRESETS')}
 else{currentCategory='FAV';showToast('FAVORITES')}
 document.querySelectorAll('#presetTabs button').forEach(x=>x.classList.remove('active'));
 renderPresets();
 tick('major');
};
