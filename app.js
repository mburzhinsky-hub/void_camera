const $=id=>document.getElementById(id);
const video=$('cameraVideo'), gate=$('permissionGate'), toast=$('toast');
const pages=[...document.querySelectorAll('.page')];
const finder=$('finderFrame'), filmCanvas=$('filmCanvas'), analysisOverlay=$('analysisOverlay'), analysisCtx=analysisOverlay.getContext('2d');
const histCanvas=$('histogramCanvas'), histCtx=histCanvas.getContext('2d');
const analysisBuffer=$('analysisBuffer'), bufferCtx=analysisBuffer.getContext('2d',{willReadFrequently:true});

let stream=null, track=null, facingMode='environment';
let activeLook='VOID CLASSIC', pendingLook='VOID CLASSIC', currentCategory='ALL';
let capturedBlob=null, originalBlob=null, lastObjectUrl=null, lastTickStep=null;
let rawEnabled=false,hdrEnabled=false,gridEnabled=true,histEnabled=true,zebraEnabled=false,peakingEnabled=false,stabEnabled=false;
let currentRatio='4:3', currentZoom=1, currentEV=0, analysisRAF=0;
let previewISO=100, previewShutter=3, previewWB=5200, focusMode='AF', meteringMode='EVALUATIVE';
let presetFrameData='';
const presetThumbCache=new Map();
let presetThumbGeneration=0;
const presetPhotoMap={
 'VOID CLASSIC':'Use as the neutral house look. Expose normally; it protects highlights without making shadows flat.','NOIR CITY':'noir-city','COLD CINEMA':'cold-cinema','CINEMA 25':'cinema-25',
 'SKIN CINEMA':'Prioritise the face. Keep WB close to neutral and avoid clipping cheeks or forehead highlights.','NEON NIGHT':'neon-night','RAIN GRADIENT':'rain-gradient','AUTO NIGHT':'auto-night',
 'ICE DAY':'Works in bright cold daylight. Add a little exposure only if snow starts looking grey.','CYAN WINTER':'cyan-winter','SNOW DAY':'snow-day','DEEP FOREST':'deep-forest',
 'NATURE SOFT':'Use when the scene already has strong texture. It opens shadows and reduces highlight bite.','AQUA SUMMER':'aqua-summer','PASTEL GLOW':'pastel-glow','WARM NATURAL':'warm-natural',
 'AUTUMN GOLD':'Best with existing yellow-green foliage or late sun. Avoid scenes already dominated by orange light.','CHROME FILM':'chrome-film','FUJI MONO':'fuji-mono','BLEACH':'bleach'
};
const presetTips={
 'VOID CLASSIC':'Use in neutral daylight when you want one reliable film look without pushing skin or skies too far.',
 'NOIR CITY':'Underexpose slightly. Let street lamps and windows stay bright while the blacks remain dense.',
 'COLD CINEMA':'Keep white balance neutral. Best on concrete, glass and grey skies where cool shadows can separate cleanly.',
 'CINEMA 25':'Expose a touch low. It is built for mixed daylight and skin, with warmer highlights against greener shadows.',
 'SKIN CINEMA':'Designed for faces. Keep white balance close to neutral and avoid clipping highlights on skin.',
 'NEON NIGHT':'Expose for the signs, not the shadows. The profile is designed to keep saturated neon from turning white.',
 'RAIN GRADIENT':'Use after rain or around reflective surfaces. Blue-violet shadows and warm reflections are the point of the look.',
 'AUTO NIGHT':'Meter for headlights and practicals. Cars and glossy surfaces benefit from the harder black point and halation.',
 'ICE DAY':'Cold daylight with a clean blue cast. Good for winter streets, pale architecture and bright skies.',
 'CYAN WINTER':'Best in shade or blue hour. Avoid already-cyan scenes unless you want an intentionally icy result.',
 'SNOW DAY':'Designed to keep snow bright while protecting skin. Slight positive exposure compensation often helps.',
 'DEEP FOREST':'Use under canopy or overcast light. The profile deepens green shadows and keeps warm earth from going muddy.',
 'NATURE SOFT':'A gentle default for parks, countryside and cloudy nature scenes with restrained contrast.',
 'AQUA SUMMER':'Use in direct clean daylight. Water and sky get extra separation while skin is protected from oversaturation.',
 'PASTEL GLOW':'Best with soft light and low contrast. Avoid harsh noon sun, where the lifted curve can look too flat.',
 'WARM NATURAL':'Use indoors or with people in warm daylight. Keep WB neutral so skin stays warm rather than orange.',
 'AUTUMN GOLD':'For leaves, golden hour and earthy scenes. Strongest when yellow-green tones are already present.',
 'CHROME FILM':'Good for travel and street in daylight. The look is intentionally slightly strange: cool shadows, muted chrome-like colour.',
 'FUJI MONO':'Look for directional light and clear shape. The grain and mid-tone contrast work best when the scene already has structure.',
 'BLEACH':'Use on architecture, hard light and graphic subjects. It intentionally sacrifices colour for silver density and punch.'
};
let filmEngine=null;
const mechanicalDials=[];
const favorites=new Set();

const looks=[
 {name:'VOID CLASSIC',cat:'FILM',desc:'Balanced film colour with soft highlights',use:'EVERYDAY · TRAVEL',filter:'contrast(1.06) saturate(.88) brightness(1.01) sepia(.05)',thumb:'./assets/presets/classic_city.svg'},
 {name:'NOIR CITY',cat:'CINEMA',desc:'Dense shadows, muted colour, warm lamps',use:'CITY · LOW LIGHT',filter:'contrast(1.22) saturate(.62) brightness(.90) hue-rotate(-5deg)',thumb:'./assets/presets/classic_city.svg'},
 {name:'COLD CINEMA',cat:'CINEMA',desc:'Steel-blue shadows with neutral highlights',use:'ARCHITECTURE · OVERCAST',filter:'contrast(1.15) saturate(.72) brightness(.95) hue-rotate(10deg)',thumb:'./assets/presets/daylight_250.svg'},
 {name:'CINEMA 25',cat:'CINEMA',desc:'Green-grey shadows, warm skin and firm blacks',use:'STREET · CINEMATIC',filter:'contrast(1.18) saturate(.82) brightness(.96) sepia(.05) hue-rotate(-6deg)',thumb:'./assets/presets/street_urban.svg'},
 {name:'SKIN CINEMA',cat:'PEOPLE',desc:'Protected skin, soft shoulder, restrained contrast',use:'PORTRAIT · SKIN',filter:'contrast(1.08) saturate(.92) brightness(1.02) sepia(.05)',thumb:'./assets/presets/portrait_400.svg'},
 {name:'NEON NIGHT',cat:'NIGHT',desc:'Magenta-cyan neon with deep wet blacks',use:'NIGHT · NEON',filter:'contrast(1.28) saturate(1.20) brightness(.92) hue-rotate(14deg)',thumb:'./assets/presets/neon_rain.svg'},
 {name:'RAIN GRADIENT',cat:'NIGHT',desc:'Cool shadows, violet mids, warm reflections',use:'RAIN · REFLECTIONS',filter:'contrast(1.20) saturate(1.04) brightness(.94) hue-rotate(9deg)',thumb:'./assets/presets/neon_rain.svg'},
 {name:'AUTO NIGHT',cat:'NIGHT',desc:'Hard blacks, warm practicals, red glow',use:'CARS · NIGHT',filter:'contrast(1.30) saturate(.92) brightness(.88) sepia(.04)',thumb:'./assets/presets/auto_night.svg'},
 {name:'ICE DAY',cat:'NATURE',desc:'Clean winter air with subtle cool shadows',use:'WINTER · DAYLIGHT',filter:'contrast(1.03) saturate(.90) brightness(1.04) hue-rotate(8deg)',thumb:'./assets/presets/snow_street.svg'},
 {name:'CYAN WINTER',cat:'NATURE',desc:'Deep cyan shade and desaturated snow',use:'SNOW · BLUE HOUR',filter:'contrast(1.17) saturate(.68) brightness(.94) hue-rotate(18deg)',thumb:'./assets/presets/snow_street.svg'},
 {name:'SNOW DAY',cat:'NATURE',desc:'Bright white snow with protected skin tones',use:'SNOW · PEOPLE',filter:'contrast(1.06) saturate(.82) brightness(1.08) hue-rotate(7deg)',thumb:'./assets/presets/snow_street.svg'},
 {name:'DEEP FOREST',cat:'NATURE',desc:'Dark greens, earthy warmth and dense depth',use:'FOREST · MOODY',filter:'contrast(1.18) saturate(.86) brightness(.93) hue-rotate(-10deg)',thumb:'./assets/presets/forest_mist.svg'},
 {name:'NATURE SOFT',cat:'NATURE',desc:'Open shadows, quiet greens, gentle highlights',use:'NATURE · CLOUDY',filter:'contrast(.96) saturate(.86) brightness(1.03)',thumb:'./assets/presets/forest_mist.svg'},
 {name:'AQUA SUMMER',cat:'NATURE',desc:'Clear aqua water and warm bright skin',use:'SEA · SUMMER',filter:'contrast(1.02) saturate(1.10) brightness(1.03) hue-rotate(5deg)',thumb:'./assets/presets/water_summer.svg'},
 {name:'PASTEL GLOW',cat:'PEOPLE',desc:'Lifted blacks, creamy highlights, pastel skin',use:'PORTRAIT · SOFT LIGHT',filter:'contrast(.88) saturate(.82) brightness(1.08) sepia(.08)',thumb:'./assets/presets/pastel_day.svg'},
 {name:'WARM NATURAL',cat:'PEOPLE',desc:'Warm neutral skin with gentle contrast',use:'PEOPLE · HOME',filter:'contrast(.98) saturate(.94) brightness(1.03) sepia(.10)',thumb:'./assets/presets/warm_interior.svg'},
 {name:'AUTUMN GOLD',cat:'NATURE',desc:'Golden highlights and controlled yellow-green',use:'AUTUMN · GOLDEN HOUR',filter:'contrast(.98) saturate(1.00) brightness(1.03) sepia(.14) hue-rotate(-8deg)',thumb:'./assets/presets/warm_interior.svg'},
 {name:'CHROME FILM',cat:'FILM',desc:'Muted chrome colour with cool shadow bias',use:'STREET · DAYLIGHT',filter:'contrast(1.12) saturate(.90) brightness(.98) sepia(.08) hue-rotate(-3deg)',thumb:'./assets/presets/classic_city.svg'},
 {name:'FUJI MONO',cat:'B&W',desc:'Tonal monochrome with firm mids and fine grain',use:'PORTRAIT · STREET',filter:'grayscale(1) contrast(1.30) brightness(.95)',thumb:'./assets/presets/mono_portrait.svg'},
 {name:'BLEACH',cat:'B&W',desc:'Silver contrast with almost-drained colour',use:'CINEMA · HARD LIGHT',filter:'contrast(1.42) saturate(.32) brightness(.94)',thumb:'./assets/presets/bleach.svg'}
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

const sound=window.VoidSound;
function getAudio(){ return sound?.unlock?.(); }
function showPage(id){
 pages.forEach(p=>p.classList.toggle('active',p.id===id));
 if(id==='presetsPage'){ pendingLook=activeLook; renderPresets(); closePresetDetail(); }
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
 if(filmEngine && filmEngine.ready){
   filmEngine.setLook(activeLook);
   filmEngine.setControls({iso:previewISO,shutterIndex:previewShutter,wb:previewWB,ev:currentEV,hdr:hdrEnabled});
   filmCanvas.classList.add('active');
   video.style.filter='none';
 }else{
   filmCanvas?.classList.remove('active');
   video.style.filter=buildPreviewFilter();
 }
}
function visibleLooks(){
 return looks.filter(l=>currentCategory==='ALL'||(currentCategory==='FAV'?favorites.has(l.name):l.cat===currentCategory));
}
function presetPhotoPath(l){
 const slug=presetPhotoMap[l.name];
 return slug?'./assets/preset-photos/'+slug+'.jpg':l.thumb;
}
function renderPresets(){
 const grid=$('presetGrid'); grid.innerHTML='';
 visibleLooks().forEach(l=>{
  const card=document.createElement('article');
  card.className='preset-card'+(l.name===activeLook?' active':'')+(favorites.has(l.name)?' favorite':'');
  card.setAttribute('role','button');card.tabIndex=0;
  const safe=l.name.replace(/'/g,"&#39;");
  card.innerHTML=`
    <div class="preset-preview" style="background-image:url('${presetPhotoPath(l)}')"></div>
    <button class="heart" type="button" aria-label="Favorite ${safe}">♡</button>
    <div class="preset-copy">
      <b>${l.name}</b>
      <small class="preset-desc">${l.desc}</small>
      <span class="preset-use mono">BEST · ${l.use}</span>
    </div>`;
  const open=()=>openPresetDetail(l);
  card.onclick=open;
  card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
  const heart=card.querySelector('.heart');
  heart.onclick=e=>{e.stopPropagation();favorites.has(l.name)?favorites.delete(l.name):favorites.add(l.name);renderPresets();tick()};
  grid.appendChild(card);
 });
}
function openPresetDetail(l){
 pendingLook=l.name;
 const panel=$('presetDetail');
 $('presetDetailImage').style.backgroundImage=`url('${presetPhotoPath(l)}')`;
 $('presetDetailName').textContent=l.name;
 $('presetDetailDesc').textContent=l.desc;
 $('presetDetailUse').textContent='BEST FOR · '+l.use;
 $('presetDetailTip').textContent=presetTips[l.name]||'Use this look when its colour and contrast suit the scene.';
 $('presetDetailCategory').textContent=l.cat;
 panel.classList.add('open');
 sound?.preset?.();
}
function closePresetDetail(){
 $('presetDetail')?.classList.remove('open');
}
document.querySelectorAll('#presetTabs button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('#presetTabs button').forEach(x=>x.classList.remove('active'));
 b.classList.add('active');currentCategory=b.dataset.category;renderPresets();closePresetDetail();tick();
});
$('presetButton').onclick=()=>showPage('presetsPage');
$('colorCard').onclick=()=>showPage('presetsPage');
$('applyPresetButton').onclick=()=>{activeLook=pendingLook;applyLook();sound.preset();showPage('cameraPage');showToast(activeLook+' APPLIED')};
$('presetDetailClose').onclick=closePresetDetail;
$('presetDetailUseButton').onclick=()=>{
 activeLook=pendingLook;
 applyLook();
 sound.preset();
 closePresetDetail();
 renderPresets();
 showPage('cameraPage');
 showToast(activeLook+' APPLIED');
};

async function startCamera(){
 try{
  stream?.getTracks().forEach(t=>t.stop());
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1440}},audio:false});
  video.srcObject=stream;await video.play();track=stream.getVideoTracks()[0];
  if(!filmEngine && window.VoidFilmEngine) filmEngine=new window.VoidFilmEngine(video,filmCanvas);
  filmEngine?.start?.();
  gate.classList.add('hidden');analysisCtx.clearRect(0,0,analysisOverlay.width,analysisOverlay.height);analysisOverlay.style.opacity=(zebraEnabled||peakingEnabled)?'1':'0';inspectCapabilities();applyLook();runAnalysis();showToast('CAMERA LIVE');
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
 filmEngine?.setControls?.({ev:currentEV});
 applyLook();
}
$('evSlider').oninput=e=>{
 setEV(e.target.value);
 $('proEvSlider').value=e.target.value;
 syncCustomSlider($('proEvSlider'));
 syncMainEV();
};
$('proEvSlider').oninput=e=>{
 setEV(e.target.value);
 $('evSlider').value=Math.max(-2,Math.min(2,e.target.value));
 syncCustomSlider($('proEvSlider'));
 syncMainEV();
};

$('isoSlider').oninput=async e=>{
 previewISO=Math.round(+e.target.value);$('isoValue').textContent=previewISO;$('isoReadout').textContent='ISO '+previewISO;
 const caps=track?.getCapabilities?.()||{};
 if(caps.iso)try{await track.applyConstraints({advanced:[{iso:previewISO}]})}catch{}
 filmEngine?.setControls?.({iso:previewISO});applyLook();
};
const shutterValues=['1/4000','1/1000','1/250','1/60','1/15','1/4','1s'];
const shutterSeconds=[.00025,.001,.004,.0167,.0667,.25,1];
$('shutterSlider').oninput=async e=>{
 previewShutter=+e.target.value;const label=shutterValues[previewShutter];
 $('shutterValue').textContent=label;$('shutterReadout').textContent=label+' · F1.8';
 const caps=track?.getCapabilities?.()||{};
 if(caps.exposureTime)try{await track.applyConstraints({advanced:[{exposureTime:shutterSeconds[previewShutter]}]})}catch{}
 filmEngine?.setControls?.({shutterIndex:previewShutter});applyLook();
};
$('wbSlider').oninput=async e=>{
 previewWB=+e.target.value;$('wbValue').textContent=previewWB+'K';
 const caps=track?.getCapabilities?.()||{};
 if(caps.colorTemperature)try{await track.applyConstraints({advanced:[{colorTemperature:previewWB}]})}catch{}
 filmEngine?.setControls?.({wb:previewWB});applyLook();
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
 showToast(rawEnabled?'ORIGINAL + LOOK JPEG':'PROCESSED JPEG')
};
$('hdrTool').onclick=$('hdrQuick').onclick=()=>{hdrEnabled=!hdrEnabled;toggleState('hdrTool',hdrEnabled);toggleState('hdrQuick',hdrEnabled);hdrEnabled?sound.toggleOn():sound.toggleOff();applyLook();showToast(hdrEnabled?'HDR LOOK ON':'HDR OFF')};

$('proButton').onclick=()=>showPage('proPage');
$('resetPro').onclick=()=>{
 syncGrid(true);syncHist(true);zebraEnabled=peakingEnabled=rawEnabled=hdrEnabled=stabEnabled=false;
 ['zebraTool','peakingTool','rawTool','rawQuick','hdrTool','hdrQuick','stabTool'].forEach(x=>$(x)?.classList.remove('active'));
 previewISO=100;previewShutter=3;previewWB=5200;currentEV=0;
 $('isoSlider').value=100;$('isoValue').textContent='100';
 $('shutterSlider').value=3;$('shutterValue').textContent='1/60';
 $('wbSlider').value=5200;$('wbValue').textContent='5200K';
 $('evSlider').value=0;$('proEvSlider').value=0;setEV(0);applyLook();syncAllCustomControls();showToast('PRO RESET');
};

$('ratioTool').onclick=()=>{
 currentRatio=currentRatio==='4:3'?'3:2':currentRatio==='3:2'?'16:9':'4:3';
 finder.dataset.ratio=currentRatio;$('ratioGlyph').textContent=currentRatio;tick('major')
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
 sound?.focusStep?.();
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
 const rect=finder.getBoundingClientRect();
 analysisOverlay.width=rect.width*devicePixelRatio;
 analysisOverlay.height=rect.height*devicePixelRatio;
 analysisCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
 analysisCtx.clearRect(0,0,rect.width,rect.height);

 if(!zebraEnabled && !peakingEnabled){
   analysisOverlay.style.opacity='0';
   return;
 }
 analysisOverlay.style.opacity='1';

 const lumAt=(x,y)=>{
   const i=(y*w+x)*4;
   return d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722;
 };

 if(zebraEnabled){
   analysisCtx.strokeStyle='rgba(255,255,255,.28)';
   analysisCtx.lineWidth=.85;
   const cell=6;
   for(let y=2;y<h-2;y+=cell){
     for(let x=2;x<w-2;x+=cell){
       const l0=lumAt(x,y),l1=lumAt(Math.min(w-1,x+2),y),l2=lumAt(x,Math.min(h-1,y+2)),l3=lumAt(Math.min(w-1,x+2),Math.min(h-1,y+2));
       const avg=(l0+l1+l2+l3)*.25;
       if(avg>246){
         const px=x/w*rect.width,py=y/h*rect.height;
         const sx=cell/w*rect.width,sy=cell/h*rect.height;
         analysisCtx.beginPath();
         analysisCtx.moveTo(px-sx*.15,py+sy*.85);
         analysisCtx.lineTo(px+sx*.85,py-sy*.15);
         analysisCtx.stroke();
       }
     }
   }
 }

 if(peakingEnabled){
   analysisCtx.fillStyle='rgba(255,255,255,.34)';
   for(let y=2;y<h-2;y+=4){
     for(let x=2;x<w-2;x+=4){
       const gx=Math.abs(lumAt(x+1,y)-lumAt(x-1,y));
       const gy=Math.abs(lumAt(x,y+1)-lumAt(x,y-1));
       const edge=gx+gy;
       const lum=lumAt(x,y);
       if(edge>92 && lum>24 && lum<238){
         const px=x/w*rect.width,py=y/h*rect.height;
         analysisCtx.fillRect(px,py,1.05,1.05);
       }
     }
   }
 }
}

function drawCapture(canvas,withLook=true){
 if(withLook && filmEngine?.ready){
   filmEngine.setLook(activeLook);
   filmEngine.setControls({iso:previewISO,shutterIndex:previewShutter,wb:previewWB,ev:currentEV,hdr:hdrEnabled});
   if(filmEngine.captureTo(canvas,2200)) return;
 }
 const ctx=canvas.getContext('2d');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
 ctx.filter=withLook?buildPreviewFilter():'none';
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

const customSliderMap=new WeakMap();

function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function snapValue(input,raw){
 const min=Number(input.min)||0,max=Number(input.max)||100,step=Number(input.step)||1;
 const snapped=Math.round((raw-min)/step)*step+min;
 const decimals=(String(step).split('.')[1]||'').length;
 return Number(clamp(snapped,min,max).toFixed(decimals));
}
function formatSliderValue(input,val){
 if(input.id==='isoSlider') return 'ISO '+Math.round(val);
 if(input.id==='wbSlider') return Math.round(val)+'K';
 if(input.id==='shutterSlider') return shutterValues[Math.round(val)]||'AUTO';
 if(input.id==='focusDistanceSlider') return Number(val).toFixed(2);
 if(input.id==='proEvSlider') return (val>0?'+':'')+Number(val).toFixed(1);
 return String(val);
}
function syncCustomSlider(input){
 const ui=customSliderMap.get(input); if(!ui)return;
 const min=Number(input.min)||0,max=Number(input.max)||100,val=Number(input.value);
 const p=max===min?0:clamp((val-min)/(max-min),0,1);
 ui.root.style.setProperty('--p',(p*100).toFixed(3)+'%');
 ui.bubble.textContent=formatSliderValue(input,val);
 ui.root.setAttribute('aria-valuenow',String(val));
}
function setInputFromPointer(input,ui,clientX,commit=false){
 const r=ui.track.getBoundingClientRect();
 const p=clamp((clientX-r.left)/Math.max(1,r.width),0,1);
 const min=Number(input.min)||0,max=Number(input.max)||100;
 const val=snapValue(input,min+p*(max-min));
 if(Number(input.value)!==val){
   input.value=String(val);
   input.dispatchEvent(new Event('input',{bubbles:true}));
 }
 syncCustomSlider(input);
 if(commit) input.dispatchEvent(new Event('change',{bubbles:true}));
}
function buildCustomSlider(input){
 if(customSliderMap.has(input))return;
 input.classList.add('native-range-hidden');

 const root=document.createElement('div');
 root.className='void-range'+(input.classList.contains('temp-range')?' temperature':'');
 root.tabIndex=0;
 root.setAttribute('role','slider');
 root.setAttribute('aria-label',input.id);
 const track=document.createElement('div');
 track.className='void-range-track';
 track.innerHTML='<span class="void-range-fill"></span><span class="void-range-rail"></span><span class="void-range-thumb"></span>';
 const bubble=document.createElement('span');
 bubble.className='void-range-bubble mono';
 root.append(track,bubble);
 input.insertAdjacentElement('afterend',root);

 const ui={root,track,bubble};customSliderMap.set(input,ui);
 let dragging=false,pointerId=null;

 const startDrag=e=>{
   dragging=true;pointerId=e.pointerId;
   root.classList.add('dragging');
   root.setPointerCapture?.(pointerId);
   getAudio();
   setInputFromPointer(input,ui,e.clientX);
 };
 const move=e=>{if(dragging)setInputFromPointer(input,ui,e.clientX)};
 const endDrag=e=>{
   if(!dragging)return;
   dragging=false;root.classList.remove('dragging');
   setInputFromPointer(input,ui,e.clientX??track.getBoundingClientRect().left,false);
   input.dispatchEvent(new Event('change',{bubbles:true}));
   if(pointerId!==null)root.releasePointerCapture?.(pointerId);
   pointerId=null;
 };
 root.addEventListener('pointerdown',startDrag);
 root.addEventListener('pointermove',move);
 root.addEventListener('pointerup',endDrag);
 root.addEventListener('pointercancel',()=>{dragging=false;root.classList.remove('dragging')});
 root.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
   e.preventDefault();
   const step=Number(input.step)||1;
   input.value=String(snapValue(input,Number(input.value)+(e.key==='ArrowRight'?step:-step)));
   input.dispatchEvent(new Event('input',{bubbles:true}));
   input.dispatchEvent(new Event('change',{bubbles:true}));
   syncCustomSlider(input);
 });
 input.addEventListener('input',()=>syncCustomSlider(input));
 syncCustomSlider(input);
}

let mainEVUI=null;
function syncMainEV(){
 if(!mainEVUI)return;
 const input=$('evSlider'),min=Number(input.min),max=Number(input.max),val=Number(input.value);
 const p=clamp((val-min)/(max-min),0,1);
 mainEVUI.root.style.setProperty('--p',(p*100).toFixed(3)+'%');
 mainEVUI.value.textContent=(val>0?'+':'')+val.toFixed(1);
 mainEVUI.root.setAttribute('aria-valuenow',String(val));
}
function buildMainEV(){
 const input=$('evSlider');if(!input||mainEVUI)return;
 input.classList.add('native-range-hidden');
 const root=document.createElement('div');
 root.className='ev-scrubber';
 root.tabIndex=0;root.setAttribute('role','slider');root.setAttribute('aria-label','Exposure compensation');
 root.innerHTML='<div class="ev-scrubber-labels mono"><span>-2</span><span>-1</span><b class="ev-live-value">0.0</b><span>+1</span><span>+2</span></div><div class="ev-scrubber-track"><span class="ev-minor-ticks"></span><span class="ev-center-line"></span><span class="ev-marker"></span></div>';
 input.insertAdjacentElement('afterend',root);
 const track=root.querySelector('.ev-scrubber-track'),value=root.querySelector('.ev-live-value');
 mainEVUI={root,track,value};
 let dragging=false,id=null;
 const set=e=>{
   const r=track.getBoundingClientRect(),p=clamp((e.clientX-r.left)/Math.max(1,r.width),0,1);
   const val=snapValue(input,Number(input.min)+p*(Number(input.max)-Number(input.min)));
   if(Number(input.value)!==val){
     input.value=String(val);input.dispatchEvent(new Event('input',{bubbles:true}));
   }
   syncMainEV();
 };
 root.addEventListener('pointerdown',e=>{dragging=true;id=e.pointerId;root.setPointerCapture?.(id);root.classList.add('dragging');getAudio();set(e)});
 root.addEventListener('pointermove',e=>{if(dragging)set(e)});
 root.addEventListener('pointerup',e=>{if(!dragging)return;set(e);dragging=false;root.classList.remove('dragging');input.dispatchEvent(new Event('change',{bubbles:true}));root.releasePointerCapture?.(id);id=null});
 root.addEventListener('pointercancel',()=>{dragging=false;root.classList.remove('dragging')});
 root.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
   e.preventDefault();const step=Number(input.step)||.1;
   input.value=String(snapValue(input,Number(input.value)+(e.key==='ArrowRight'?step:-step)));
   input.dispatchEvent(new Event('input',{bubbles:true}));syncMainEV();
 });
 input.addEventListener('input',syncMainEV);
 syncMainEV();
}

function syncAllCustomControls(){
 const focus=$('focusDistanceSlider'); if(focus) syncCustomSlider(focus);
 mechanicalDials.forEach(d=>d.syncFromInput());
 syncMainEV();
}

function initMechanicalDials(){
 if(!window.VoidMechanicalDial)return;
 const specs=[
  {id:'isoSlider',values:[50,100,200,400,800,1600],format:v=>String(v),major:v=>[100,200,400,800,1600].includes(v),sound:(v,m)=>sound?.iso?.(m)},
  {id:'shutterSlider',values:[0,1,2,3,4,5,6],format:v=>shutterValues[v],major:()=>true,sound:()=>sound?.shutterStep?.()},
  {id:'wbSlider',values:[2500,3200,4000,4500,5200,6000,7000,8000,9000],format:v=>v+'K',major:v=>[3200,5200,7000].includes(v),sound:(v,m)=>sound?.wb?.(m)},
  {id:'proEvSlider',values:[-3,-2.5,-2,-1.5,-1,-.5,0,.5,1,1.5,2,2.5,3],format:v=>(v>0?'+':'')+v.toFixed(1),major:v=>Number.isInteger(v),sound:(v,m)=>sound?.ev?.(m)}
 ];
 specs.forEach(spec=>{
  const input=$(spec.id);if(!input)return;
  const dial=new window.VoidMechanicalDial(input,spec);
  mechanicalDials.push(dial);
 });
}
function initCustomControls(){
 const focus=$('focusDistanceSlider');
 if(focus) buildCustomSlider(focus);
 buildMainEV();
}

renderPresets();applyLook();syncGrid(true);syncHist(true);initMechanicalDials();initCustomControls();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=20260925-void-photofix-1',{updateViaCache:'none'}).catch(()=>{}));

const presetMenu=$('presetMenuButton');
if(presetMenu) presetMenu.onclick=()=>{
 const onlyFav=currentCategory==='FAV';
 if(onlyFav){currentCategory='ALL';showToast('ALL PRESETS')}
 else{currentCategory='FAV';showToast('FAVORITES')}
 document.querySelectorAll('#presetTabs button').forEach(x=>x.classList.remove('active'));
 renderPresets();closePresetDetail();
 tick('major');
};
