const $=id=>document.getElementById(id);
const video=$('cameraVideo'), gate=$('permissionGate'), toast=$('toast');
const pages=[...document.querySelectorAll('.page')];
const finder=$('finderFrame'), analysisOverlay=$('analysisOverlay'), analysisCtx=analysisOverlay.getContext('2d');
const histCanvas=$('histogramCanvas'), histCtx=histCanvas.getContext('2d');
const analysisBuffer=$('analysisBuffer'), bufferCtx=analysisBuffer.getContext('2d',{willReadFrequently:true});

let stream=null, track=null, facingMode='environment', activeLook='FUJI CLASSIC', currentCategory='ALL';
let capturedBlob=null,lastObjectUrl=null,lastTickStep=null;
let rawEnabled=false,hdrEnabled=false,gridEnabled=true,histEnabled=true,zebraEnabled=false,peakingEnabled=false,stabEnabled=false;
let currentRatio='4:3', currentZoom=1, currentEV=0, lookStrength=1, analysisRAF=0;

const looks=[
 {name:'FUJI CLASSIC',cat:'FUJI',desc:'Rich tones, true to life',filter:'contrast(.97) saturate(.92) sepia(.09) hue-rotate(-4deg)',bg:'linear-gradient(135deg,#38271f 0%,#8b5c38 46%,#d8aa67 100%)'},
 {name:'FUJI SOFT',cat:'FUJI',desc:'Muted contrast, gentle film',filter:'contrast(.90) saturate(.82) brightness(1.03)',bg:'linear-gradient(135deg,#3f443d,#8fa28f,#d7d0c4)'},
 {name:'FUJI STREET',cat:'FUJI',desc:'Bold colours, urban soul',filter:'contrast(1.10) saturate(.94) hue-rotate(-7deg)',bg:'linear-gradient(135deg,#1e2f35,#7b5a4f,#c86b4e)'},
 {name:'FUJI WARM',cat:'FUJI',desc:'Golden skin, nostalgic feel',filter:'contrast(.98) saturate(1.02) sepia(.18) hue-rotate(-5deg)',bg:'linear-gradient(135deg,#56351f,#bd7f40,#e6bc72)'},
 {name:'FUJI COOL',cat:'FUJI',desc:'Crisp tones, modern look',filter:'contrast(1.03) saturate(.88) hue-rotate(8deg)',bg:'linear-gradient(135deg,#1d3943,#6b8f9c,#b8c8c9)'},
 {name:'FUJI MONO',cat:'B&W',desc:'Timeless black and white',filter:'grayscale(1) contrast(1.14)',bg:'linear-gradient(135deg,#111,#666,#d6d6d6)'},
 {name:'PORTRAIT 400',cat:'MODERN',desc:'Soft skin, clean colour',filter:'contrast(.95) saturate(.90) sepia(.06)',bg:'linear-gradient(135deg,#43362f,#a07d68,#d9c6b7)'},
 {name:'DAYLIGHT 250',cat:'CINEMA',desc:'Cinematic daylight stock',filter:'contrast(.95) saturate(.90) sepia(.05) brightness(1.02)',bg:'linear-gradient(135deg,#536b61,#b69c6f,#e0caa5)'},
 {name:'TUNGSTEN 500',cat:'CINEMA',desc:'Night colour, cyan shadows',filter:'contrast(1.05) saturate(.88) hue-rotate(8deg)',bg:'linear-gradient(135deg,#102d3b,#57556d,#d47c5c)'},
 {name:'BLEACH',cat:'CINEMA',desc:'Silver contrast, low colour',filter:'contrast(1.22) saturate(.44) brightness(.98)',bg:'linear-gradient(135deg,#202020,#77766d,#c8c5b5)'}
];

function showPage(id){ pages.forEach(p=>p.classList.toggle('active',p.id===id)); tick('soft'); }
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>showPage('cameraPage'));

function audioTick(freq=880,d=.028,g=.026){
 try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),gn=c.createGain();o.type='triangle';o.frequency.value=freq;gn.gain.setValueAtTime(g,c.currentTime);gn.gain.exponentialRampToValueAtTime(.0001,c.currentTime+d);o.connect(gn).connect(c.destination);o.start();o.stop(c.currentTime+d)}catch{}
}
function tick(kind='soft'){audioTick(kind==='major'?520:kind==='edge'?350:980,kind==='major'?.05:.027,kind==='major'?.045:.022)}
function showToast(msg){toast.textContent=msg;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),1100)}

function getLook(){return looks.find(x=>x.name===activeLook)||looks[0]}
function applyLook(){
 const l=getLook();
 $('activeLookReadout').textContent=l.name;
 $('colorCardValue').textContent=l.name;
 video.style.filter=lookStrength<.02?'none':l.filter;
}
function renderPresets(){
 const grid=$('presetGrid'); grid.innerHTML='';
 looks.filter(l=>currentCategory==='ALL'||l.cat===currentCategory).forEach(l=>{
  const b=document.createElement('button');
  b.className='preset-card'+(l.name===activeLook?' active':'');
  b.innerHTML='<div class="preset-preview" style="--bg:'+l.bg+'"><span class="heart">♡</span></div><div class="preset-copy"><b>'+l.name+'</b><small>'+l.desc+'</small></div>';
  b.onclick=()=>{activeLook=l.name;applyLook();renderPresets();tick('major')};
  grid.appendChild(b);
 });
}
document.querySelectorAll('#presetTabs button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('#presetTabs button').forEach(x=>x.classList.remove('active'));
 b.classList.add('active');
 currentCategory=b.dataset.category;
 renderPresets();
 tick();
});
$('presetButton').onclick=()=>{renderPresets();showPage('presetsPage')};
$('colorCard').onclick=()=>{renderPresets();showPage('presetsPage')};
$('applyPresetButton').onclick=()=>{applyLook();showPage('cameraPage');showToast(activeLook+' APPLIED')};

async function startCamera(){
 try{
  stream?.getTracks().forEach(t=>t.stop());
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1440}},audio:false});
  video.srcObject=stream; await video.play(); track=stream.getVideoTracks()[0];
  gate.classList.add('hidden'); inspectCapabilities(); applyLook(); runAnalysis(); showToast('CAMERA LIVE');
 }catch(e){console.error(e);showToast('CAMERA ACCESS NEEDED')}
}
$('startCameraButton').onclick=startCamera;
$('switchCameraButton').onclick=async()=>{facingMode=facingMode==='environment'?'user':'environment';tick('major');await startCamera()};

function inspectCapabilities(){
 const caps=track?.getCapabilities?.()||{}, settings=track?.getSettings?.()||{};
 if(caps.zoom){
   currentZoom=settings.zoom||caps.zoom.min||1;
 } else currentZoom=1;
 $('isoCapability').textContent=caps.iso?'SENSOR CONTROL':'UNAVAILABLE IN SAFARI';
 $('isoSlider').disabled=!caps.iso;
 if(caps.iso){$('isoSlider').min=caps.iso.min;$('isoSlider').max=caps.iso.max;$('isoSlider').step=caps.iso.step||1;$('isoSlider').value=settings.iso||caps.iso.min;$('isoValue').textContent=settings.iso||caps.iso.min;$('isoReadout').textContent='ISO '+(settings.iso||caps.iso.min)}
 const shutterCap=caps.exposureTime||caps.exposureMode;
 $('shutterCapability').textContent=shutterCap?'SENSOR CONTROL':'UNAVAILABLE IN SAFARI';
 $('shutterSlider').disabled=!caps.exposureTime;
 const wbCap=caps.colorTemperature||caps.whiteBalanceMode;
 $('wbCapability').textContent=wbCap?'SENSOR CONTROL':'UNAVAILABLE IN SAFARI';
 $('wbSlider').disabled=!caps.colorTemperature;
 const evCap=caps.exposureCompensation;
 $('evCapability').textContent=evCap?'SENSOR CONTROL':'DIGITAL FALLBACK';
 if(evCap){$('proEvSlider').min=evCap.min;$('proEvSlider').max=evCap.max;$('proEvSlider').step=evCap.step||.1}
 updateLensAvailability(caps);
}
function updateLensAvailability(caps){
 document.querySelectorAll('.lens-pill').forEach(b=>{
   const z=parseFloat(b.dataset.zoom);
   if(caps.zoom && z>=caps.zoom.min && z<=caps.zoom.max)b.classList.remove('muted');
   else if(!caps.zoom && z>=1)b.classList.remove('muted');
 });
}

async function setZoom(z){
 z=parseFloat(z); currentZoom=z;
 const caps=track?.getCapabilities?.()||{};
 if(caps.zoom){
   z=Math.min(caps.zoom.max,Math.max(caps.zoom.min,z));
   try{await track.applyConstraints({advanced:[{zoom:z}]});video.style.transform='scale(1)'}catch{}
 }else video.style.transform='scale('+Math.max(1,z)+')';
 document.querySelectorAll('.lens-pill').forEach(b=>b.classList.toggle('active',Math.abs(parseFloat(b.dataset.zoom)-z)<.08));
 const step=Math.round(z*10); if(step!==lastTickStep){tick(step%10===0?'major':'soft');lastTickStep=step}
}
document.querySelectorAll('.lens-pill').forEach(b=>b.onclick=()=>{if(b.classList.contains('muted'))return showToast('LENS NOT EXPOSED');setZoom(b.dataset.zoom)});

function setEV(v){
 currentEV=parseFloat(v); $('evReadout').textContent=currentEV>0?'+'+currentEV.toFixed(1):currentEV.toFixed(1); $('proEvValue').textContent=$('evReadout').textContent;
 const caps=track?.getCapabilities?.()||{};
 if(caps.exposureCompensation){track.applyConstraints({advanced:[{exposureCompensation:currentEV}]}).catch(()=>{})}
 else video.style.opacity=Math.max(.55,Math.min(1,1+currentEV*.08));
 tick();
}
$('evSlider').oninput=e=>{setEV(e.target.value);$('proEvSlider').value=e.target.value};
$('proEvSlider').oninput=e=>{setEV(e.target.value);$('evSlider').value=Math.max(-2,Math.min(2,e.target.value))};

$('isoSlider').oninput=async e=>{
 if(!track||e.target.disabled)return;
 const iso=Math.round(+e.target.value);
 try{await track.applyConstraints({advanced:[{iso}]});$('isoValue').textContent=iso;$('isoReadout').textContent='ISO '+iso;tick(iso%100===0?'major':'soft')}catch{showToast('ISO REJECTED')}
};
const shutterValues=['1/4000','1/1000','1/250','1/60','1/15','1/4','1s'];
$('shutterSlider').oninput=async e=>{
 const i=+e.target.value,label=shutterValues[i];$('shutterValue').textContent=label;$('shutterReadout').textContent=label;tick(i===2||i===3?'major':'soft');
 const caps=track?.getCapabilities?.()||{}; if(caps.exposureTime){const sec=[.00025,.001,.004,.0167,.0667,.25,1][i];try{await track.applyConstraints({advanced:[{exposureTime:sec}]})}catch{}}
};
$('wbSlider').oninput=async e=>{
 const k=+e.target.value;$('wbValue').textContent=k+'K';tick(k%1000===0?'major':'soft');
 const caps=track?.getCapabilities?.()||{};if(caps.colorTemperature){try{await track.applyConstraints({advanced:[{colorTemperature:k}]})}catch{}}
};

function toggleState(btn,state,fn){$(btn).classList.toggle('active',state);fn?.()}
function syncGrid(state){gridEnabled=state;$('gridOverlay').classList.toggle('off',!state);toggleState('gridQuick',state);toggleState('gridTool',state)}
$('gridQuick').onclick=()=>{syncGrid(!gridEnabled);tick()};
$('gridTool').onclick=()=>{syncGrid(!gridEnabled);tick()};
function syncHist(state){histEnabled=state;$('histogram-box');document.querySelector('.histogram-box').classList.toggle('off',!state);toggleState('histQuick',state);toggleState('histTool',state)}
$('histQuick').onclick=()=>{syncHist(!histEnabled);tick()};
$('histTool').onclick=()=>{syncHist(!histEnabled);tick()};
$('zebraTool').onclick=()=>{zebraEnabled=!zebraEnabled;toggleState('zebraTool',zebraEnabled);tick()};
$('peakingTool').onclick=()=>{peakingEnabled=!peakingEnabled;toggleState('peakingTool',peakingEnabled);tick()};
$('stabTool').onclick=()=>{stabEnabled=!stabEnabled;toggleState('stabTool',stabEnabled);showToast(stabEnabled?'STABILISATION ON':'STABILISATION OFF');tick()};
$('rawTool').onclick=$('rawQuick').onclick=()=>{rawEnabled=!rawEnabled;toggleState('rawTool',rawEnabled);toggleState('rawQuick',rawEnabled);showToast(rawEnabled?'RAW UI ON':'RAW UI OFF');tick('major')};
$('hdrTool').onclick=$('hdrQuick').onclick=()=>{hdrEnabled=!hdrEnabled;toggleState('hdrTool',hdrEnabled);toggleState('hdrQuick',hdrEnabled);showToast(hdrEnabled?'HDR LOOK ON':'HDR OFF');tick()};

$('proButton').onclick=()=>showPage('proPage');
$('resetPro').onclick=()=>{syncGrid(true);syncHist(true);zebraEnabled=peakingEnabled=rawEnabled=hdrEnabled=stabEnabled=false;['zebraTool','peakingTool','rawTool','rawQuick','hdrTool','hdrQuick','stabTool'].forEach(x=>$(x).classList.remove('active'));setEV(0);$('evSlider').value=0;$('proEvSlider').value=0;showToast('PRO RESET')};

$('ratioTool').onclick=()=>{
 currentRatio=currentRatio==='4:3'?'3:2':currentRatio==='3:2'?'16:9':'4:3';
 finder.className='finder-frame ratio-'+currentRatio.replace(':','-');
 $('ratioGlyph').textContent=currentRatio;tick('major')
};

$('focusCard').onclick=()=>{const manual=$('focusCardValue').textContent==='AF';$('focusCardValue').textContent=manual?'MF':'AF';$('focusReadout').textContent=manual?'MF':'AF';tick()};
document.querySelectorAll('.mode-strip button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.mode-strip button').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(b.dataset.mode!=='PHOTO')showToast(b.dataset.mode+' / PREVIEW');tick()});

function runAnalysis(){
 cancelAnimationFrame(analysisRAF);
 const loop=()=>{
  if(video.readyState>=2){
   const w=160,h=120;bufferCtx.drawImage(video,0,0,w,h);const img=bufferCtx.getImageData(0,0,w,h),d=img.data;
   if(histEnabled) drawHistogram(d);
   drawOverlays(d,w,h);
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
 const rect=finder.getBoundingClientRect();analysisOverlay.width=rect.width*devicePixelRatio;analysisOverlay.height=rect.height*devicePixelRatio;analysisCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);analysisCtx.clearRect(0,0,rect.width,rect.height);
 if(zebraEnabled){analysisCtx.strokeStyle='rgba(255,255,255,.55)';analysisCtx.lineWidth=1;for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3){const i=(y*w+x)*4;const lum=(d[i]+d[i+1]+d[i+2])/3;if(lum>225){const px=x/w*rect.width,py=y/h*rect.height;analysisCtx.beginPath();analysisCtx.moveTo(px-3,py+3);analysisCtx.lineTo(px+3,py-3);analysisCtx.stroke()}}}
 if(peakingEnabled){analysisCtx.fillStyle='rgba(255,255,255,.65)';for(let y=1;y<h-1;y+=3)for(let x=1;x<w-1;x+=3){const i=(y*w+x)*4,ir=(y*w+x+1)*4,id=((y+1)*w+x)*4;const g=Math.abs(d[i]-d[ir])+Math.abs(d[i+1]-d[ir+1])+Math.abs(d[i+2]-d[ir+2])+Math.abs(d[i]-d[id])+Math.abs(d[i+1]-d[id+1])+Math.abs(d[i+2]-d[id+2]);if(g>180)analysisCtx.fillRect(x/w*rect.width,y/h*rect.height,1.6,1.6)}}
}

function capture(){
 if(!video.videoWidth)return showToast('CAMERA NOT READY');
 tick('major');
 const c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=video.videoWidth;c.height=video.videoHeight;ctx.filter=getComputedStyle(video).filter||'none';
 const scale=parseFloat((video.style.transform.match(/scale\(([^)]+)\)/)||[])[1]||'1');
 if(scale>1){const sw=c.width/scale,sh=c.height/scale,sx=(c.width-sw)/2,sy=(c.height-sh)/2;ctx.drawImage(video,sx,sy,sw,sh,0,0,c.width,c.height)}else ctx.drawImage(video,0,0,c.width,c.height);
 c.toBlob(blob=>{capturedBlob=blob;if(lastObjectUrl)URL.revokeObjectURL(lastObjectUrl);lastObjectUrl=URL.createObjectURL(blob);$('reviewImage').src=lastObjectUrl;$('reviewLook').textContent=activeLook;$('reviewPanel').classList.add('open');const old=$('lastShotThumb');old.outerHTML='<img id="lastShotThumb" src="'+lastObjectUrl+'" alt="Last shot">';},'image/jpeg',.95)
}
$('shutterButton').onclick=capture;
$('reviewCloseButton').onclick=()=>$('reviewPanel').classList.remove('open');
$('lastShotButton').onclick=()=>{if(lastObjectUrl)$('reviewPanel').classList.add('open')};
async function shareCapture(){if(!capturedBlob)return;const f=new File([capturedBlob],'void-'+Date.now()+'.jpg',{type:'image/jpeg'});if(navigator.share&&navigator.canShare?.({files:[f]})){try{await navigator.share({files:[f],title:'VOID Camera'})}catch{}}else saveCapture()}
function saveCapture(){if(!lastObjectUrl)return;const a=document.createElement('a');a.href=lastObjectUrl;a.download='void-'+Date.now()+'.jpg';a.click()}
$('shareButton').onclick=shareCapture;$('saveButton').onclick=saveCapture;

renderPresets();applyLook();syncGrid(true);syncHist(true);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=20260925-void-ref-1',{updateViaCache:'none'}).catch(()=>{}));
