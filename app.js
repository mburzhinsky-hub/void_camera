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
 {name:'FUJI CLASSIC',cat:'FUJI',desc:'Muted documentary contrast',filter:'contrast(1.13) saturate(.78) brightness(.97) sepia(.05) hue-rotate(-3deg)',thumb:'./assets/presets/classic_city.svg'},
 {name:'FUJI SOFT',cat:'FUJI',desc:'Pastel skin, lifted shadows',filter:'contrast(.86) saturate(.76) brightness(1.06) sepia(.06) hue-rotate(2deg)',thumb:'./assets/presets/soft_blossom.svg'},
 {name:'FUJI STREET',cat:'FUJI',desc:'Dense blacks, bold urban colour',filter:'contrast(1.24) saturate(1.10) brightness(.94) sepia(.03) hue-rotate(-7deg)',thumb:'./assets/presets/street_urban.svg'},
 {name:'FUJI WARM',cat:'FUJI',desc:'Amber highlights, warm skin',filter:'contrast(1.03) saturate(1.13) brightness(1.01) sepia(.24) hue-rotate(-7deg)',thumb:'./assets/presets/warm_interior.svg'},
 {name:'FUJI COOL',cat:'FUJI',desc:'Cyan shadows, clean highlights',filter:'contrast(1.12) saturate(.90) brightness(.98) hue-rotate(11deg)',thumb:'./assets/presets/cool_bridge.svg'},
 {name:'FUJI MONO',cat:'B&W',desc:'Acros-style deep monochrome',filter:'grayscale(1) contrast(1.34) brightness(.94)',thumb:'./assets/presets/mono_portrait.svg'},
 {name:'PORTRAIT 400',cat:'MODERN',desc:'Cream skin, soft highlight rolloff',filter:'contrast(.91) saturate(.88) brightness(1.04) sepia(.11) hue-rotate(-3deg)',thumb:'./assets/presets/portrait_400.svg'},
 {name:'DAYLIGHT 250',cat:'CINEMA',desc:'Cinematic daylight, soft greens',filter:'contrast(.94) saturate(.82) brightness(1.02) sepia(.07) hue-rotate(4deg)',thumb:'./assets/presets/daylight_250.svg'},
 {name:'TUNGSTEN 500',cat:'CINEMA',desc:'Teal shadows, warm practicals',filter:'contrast(1.14) saturate(1.03) brightness(.93) hue-rotate(13deg)',thumb:'./assets/presets/tungsten_500.svg'},
 {name:'BLEACH',cat:'CINEMA',desc:'Silver density, crushed colour',filter:'contrast(1.38) saturate(.34) brightness(.92)',thumb:'./assets/presets/bleach.svg'}
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

function launchSound(){
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;
  const ctx=new Ctx();
  const now=ctx.currentTime;

  const pulse=(freq,start,dur,gain,type='triangle')=>{
   const o=ctx.createOscillator(),g=ctx.createGain();
   o.type=type;o.frequency.setValueAtTime(freq,now+start);
   g.gain.setValueAtTime(.0001,now+start);
   g.gain.exponentialRampToValueAtTime(gain,now+start+.004);
   g.gain.exponentialRampToValueAtTime(.0001,now+start+dur);
   o.connect(g).connect(ctx.destination);
   o.start(now+start);o.stop(now+start+dur+.01);
  };

  pulse(1180,0,.034,.045,'square');
  pulse(540,.028,.060,.035,'triangle');
  pulse(1720,.082,.028,.022,'square');
  pulse(270,.092,.110,.028,'sine');
 }catch(e){}
}

function showPage(id){
 pages.forEach(p=>p.classList.toggle('active',p.id===id));
 if(id==='presetsPage'){ pendingLook=activeLook; snapshotPresetFrame(); renderPresets(); }
 tick('soft');
}
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>showPage('cameraPage'));

function audioTick(freq=880,d=.028,g=.026){
 try{
  const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),gn=c.createGain();
  o.type='triangle';o.frequency.value=freq;gn.gain.setValueAtTime(g,c.currentTime);
  gn.gain.exponentialRampToValueAtTime(.0001,c.currentTime+d);o.connect(gn).connect(c.destination);o.start();o.stop(c.currentTime+d);
 }catch{}
}
function tick(kind='soft'){audioTick(kind==='major'?520:kind==='edge'?350:980,kind==='major'?.05:.027,kind==='major'?.045:.022)}
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
 const grid=$('presetGrid');grid.innerHTML='';
 looks.filter(l=>currentCategory==='ALL'||l.cat===currentCategory).forEach(l=>{
  const card=document.createElement('article');
  card.className='preset-card'+(l.name===pendingLook?' active':'')+(favorites.has(l.name)?' favorite':'');
  card.setAttribute('role','button');card.tabIndex=0;
  const safe=l.name.replace(/'/g,"&#39;");
  card.innerHTML=`<div class="preset-preview"><img src="${l.thumb}" alt="" draggable="false"></div><button class="heart" type="button" aria-label="Favorite ${safe}">♡</button><div class="preset-copy"><b>${l.name}</b><small>${l.desc}</small></div>`;
  const img=card.querySelector('img');
  img.style.filter=l.filter;
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
$('applyPresetButton').onclick=()=>{activeLook=pendingLook;applyLook();showPage('cameraPage');showToast(activeLook+' APPLIED')};

async function startCamera(){
 try{
  stream?.getTracks().forEach(t=>t.stop());
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1440}},audio:false});
  video.srcObject=stream;await video.play();track=stream.getVideoTracks()[0];
  gate.classList.add('hidden');inspectCapabilities();applyLook();runAnalysis();showToast('CAMERA LIVE');
 }catch(e){console.error(e);showToast('CAMERA ACCESS NEEDED')}
}
$('startCameraButton').onclick=()=>{
 launchSound();
 gate.classList.add('launching');
 startCamera().finally(()=>setTimeout(()=>gate.classList.remove('launching'),450));
};
$('switchCameraButton').onclick=async()=>{facingMode=facingMode==='environment'?'user':'environment';tick('major');await startCamera()};

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
 tick();
}
$('evSlider').oninput=e=>{setEV(e.target.value);$('proEvSlider').value=e.target.value};
$('proEvSlider').oninput=e=>{setEV(e.target.value);$('evSlider').value=Math.max(-2,Math.min(2,e.target.value))};

$('isoSlider').oninput=async e=>{
 previewISO=Math.round(+e.target.value);$('isoValue').textContent=previewISO;$('isoReadout').textContent='ISO '+previewISO;
 const caps=track?.getCapabilities?.()||{};
 if(caps.iso)try{await track.applyConstraints({advanced:[{iso:previewISO}]})}catch{}
 applyLook();tick(previewISO%100===0?'major':'soft');
};
const shutterValues=['1/4000','1/1000','1/250','1/60','1/15','1/4','1s'];
const shutterSeconds=[.00025,.001,.004,.0167,.0667,.25,1];
$('shutterSlider').oninput=async e=>{
 previewShutter=+e.target.value;const label=shutterValues[previewShutter];
 $('shutterValue').textContent=label;$('shutterReadout').textContent=label+' · F1.8';
 const caps=track?.getCapabilities?.()||{};
 if(caps.exposureTime)try{await track.applyConstraints({advanced:[{exposureTime:shutterSeconds[previewShutter]}]})}catch{}
 applyLook();tick(previewShutter===2||previewShutter===3?'major':'soft');
};
$('wbSlider').oninput=async e=>{
 previewWB=+e.target.value;$('wbValue').textContent=previewWB+'K';
 const caps=track?.getCapabilities?.()||{};
 if(caps.colorTemperature)try{await track.applyConstraints({advanced:[{colorTemperature:previewWB}]})}catch{}
 applyLook();tick(previewWB%1000===0?'major':'soft');
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
 rawEnabled=!rawEnabled;toggleState('rawTool',rawEnabled);toggleState('rawQuick',rawEnabled);
 $('qualityReadout').textContent=rawEnabled?'12MP RAW+JPEG':'12MP JPEG';
 showToast(rawEnabled?'ORIGINAL + LOOK JPEG':'PROCESSED JPEG');tick('major')
};
$('hdrTool').onclick=$('hdrQuick').onclick=()=>{hdrEnabled=!hdrEnabled;toggleState('hdrTool',hdrEnabled);toggleState('hdrQuick',hdrEnabled);applyLook();showToast(hdrEnabled?'HDR LOOK ON':'HDR OFF');tick()};

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

$('focusCard').onclick=async()=>{
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
 tick();
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
 if(!video.videoWidth)return showToast('CAMERA NOT READY');
 tick('major');
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
 input.style.setProperty('--progress',pct+'%');
 const wrap=input.closest('.range-ux');
 if(wrap){
  wrap.style.setProperty('--progress',pct+'%');
  const bubble=wrap.querySelector('.range-bubble');
  if(bubble){
   const source=input.id==='isoSlider'?Math.round(val):
                input.id==='wbSlider'?Math.round(val)+'K':
                input.id==='shutterSlider'?(shutterValues[Math.round(val)]||val):
                input.id==='focusDistanceSlider'?val.toFixed(2):
                (val>0?'+':'')+Number(val).toFixed(input.step&&String(input.step).includes('.')?1:0);
   bubble.textContent=source;
  }
 }
}
function initRangeUX(){
 document.querySelectorAll('input[type="range"]').forEach(input=>{
  if(input.closest('.range-ux'))return;
  const wrap=document.createElement('div');wrap.className='range-ux';
  input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
  const bubble=document.createElement('span');bubble.className='range-bubble mono';wrap.appendChild(bubble);
  const start=()=>{wrap.classList.add('dragging');updateRangeVisual(input);tick()};
  const end=()=>{wrap.classList.remove('dragging')};
  input.addEventListener('pointerdown',start);
  input.addEventListener('touchstart',start,{passive:true});
  input.addEventListener('pointerup',end);
  input.addEventListener('pointercancel',end);
  input.addEventListener('touchend',end,{passive:true});
  input.addEventListener('input',()=>updateRangeVisual(input));
  input.addEventListener('change',()=>{updateRangeVisual(input);end()});
  updateRangeVisual(input);
 });
}

renderPresets();applyLook();syncGrid(true);syncHist(true);initRangeUX();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=20260925-void-sliders-1',{updateViaCache:'none'}).catch(()=>{}));
