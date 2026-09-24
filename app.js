
const video = document.getElementById('cameraVideo');
const startBtn = document.getElementById('startCameraButton');
const gate = document.getElementById('permissionGate');
const shutterBtn = document.getElementById('shutterButton');
const switchBtn = document.getElementById('switchCameraButton');
const proPanel = document.getElementById('proPanel');
const lookPanel = document.getElementById('lookPanel');
const reviewPanel = document.getElementById('reviewPanel');
const reviewImage = document.getElementById('reviewImage');
const presetRail = document.getElementById('presetRail');
const toast = document.getElementById('toast');
const grid = document.getElementById('gridOverlay');
const zoomSlider = document.getElementById('zoomSlider');
const isoSlider = document.getElementById('isoSlider');
const lookSlider = document.getElementById('lookSlider');

let stream = null;
let currentTrack = null;
let facingMode = 'environment';
let activeLook = 'VOID 400';
let lookStrength = 1;
let capturedBlob = null;
let lastObjectUrl = null;
let lastTickStep = null;

const looks = [
  {name:'VOID 400', note:'warm skin / soft roll-off', css:'contrast(.96) saturate(.92) sepia(.10) hue-rotate(-4deg)', swatch:'linear-gradient(135deg,#6d513a,#b78662,#d8c8ae)'},
  {name:'CHROME', note:'documentary / muted color', css:'contrast(1.08) saturate(.72) brightness(.98)', swatch:'linear-gradient(135deg,#2d3540,#6f7475,#b2a995)'},
  {name:'NEGATIVE', note:'cyan shadows / rich reds', css:'contrast(1.12) saturate(.86) hue-rotate(-8deg)', swatch:'linear-gradient(135deg,#25373b,#825a4c,#c28768)'},
  {name:'250D', note:'cinematic daylight', css:'contrast(.95) saturate(.90) sepia(.05) brightness(1.02)', swatch:'linear-gradient(135deg,#667c72,#c0a871,#e0c9a5)'},
  {name:'500T', note:'night / tungsten / cyan', css:'contrast(1.04) saturate(.88) hue-rotate(8deg) brightness(.98)', swatch:'linear-gradient(135deg,#18303b,#6c5f68,#d1845d)'},
  {name:'MONO', note:'deep monochrome', css:'grayscale(1) contrast(1.16) brightness(.98)', swatch:'linear-gradient(135deg,#111,#666,#ddd)'},
];

function uiClick(freq=880, duration=.035, gain=.035){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type='triangle'; o.frequency.value=freq;
    g.gain.setValueAtTime(gain,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime+duration);
  }catch{}
}
function tick(kind='soft'){
  uiClick(kind==='major'?520:kind==='edge'?360:980, kind==='major'?.055:.028, kind==='major'?.05:.026);
}

function showToast(msg){
  toast.textContent=msg;
  toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t=setTimeout(()=>toast.classList.remove('show'),1200);
}

function renderLooks(){
  presetRail.innerHTML='';
  looks.forEach(l=>{
    const b=document.createElement('button');
    b.className='preset-chip'+(l.name===activeLook?' active':'');
    b.innerHTML='<strong>'+l.name+'</strong><small>'+l.note+'</small>';
    b.addEventListener('click',()=>{activeLook=l.name; tick('major'); applyLook(); renderLooks(); updateLookDetail();});
    presetRail.appendChild(b);
  });
}

function getLook(){
  return looks.find(l=>l.name===activeLook) || looks[0];
}

function applyLook(){
  const look = getLook();
  document.getElementById('activeLookReadout').textContent=look.name;
  const strength = lookStrength;
  video.style.filter = strength < .02 ? 'none' : look.css;
  document.getElementById('lookValue').textContent=Math.round(strength*100)+'%';
}

function updateLookDetail(){
  const l=getLook();
  const d=document.getElementById('lookDetail');
  d.innerHTML='<h3>'+l.name+'</h3><p>'+l.note+'. Applied live in preview and baked into processed capture in this web prototype.</p><div class="look-swatch" style="--swatch:'+l.swatch+'"></div>';
}

function setClock(){
  const d=new Date();
  document.getElementById('clock').textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
setClock(); setInterval(setClock,30000);

async function startCamera(){
  try{
    if(stream) stream.getTracks().forEach(t=>t.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:facingMode}, width:{ideal:1920}, height:{ideal:1080}},
      audio:false
    });
    video.srcObject=stream;
    await video.play();
    currentTrack=stream.getVideoTracks()[0];
    gate.classList.add('hidden');
    document.getElementById('cameraStateBadge').textContent='LIVE';
    inspectCapabilities();
    applyLook();
    showToast('CAMERA LIVE');
  }catch(err){
    console.error(err);
    showToast('CAMERA ACCESS NEEDED');
    document.getElementById('cameraStateBadge').textContent='NO CAMERA';
  }
}

function inspectCapabilities(){
  if(!currentTrack) return;
  const caps=currentTrack.getCapabilities ? currentTrack.getCapabilities() : {};
  if(caps.zoom){
    zoomSlider.min=caps.zoom.min;
    zoomSlider.max=caps.zoom.max;
    zoomSlider.step=caps.zoom.step || .05;
    zoomSlider.value=currentTrack.getSettings().zoom || caps.zoom.min;
    document.getElementById('zoomMode').textContent='HARDWARE';
  }else{
    zoomSlider.min=1; zoomSlider.max=4; zoomSlider.step=.05; zoomSlider.value=1;
    document.getElementById('zoomMode').textContent='CSS CROP';
  }
  if(caps.iso){
    isoSlider.disabled=false;
    isoSlider.min=caps.iso.min;
    isoSlider.max=caps.iso.max;
    isoSlider.step=caps.iso.step || 1;
    isoSlider.value=currentTrack.getSettings().iso || caps.iso.min;
    document.getElementById('isoCapability').textContent='SENSOR';
    document.getElementById('isoCapability').classList.remove('muted');
    document.getElementById('isoHelp').textContent='Real browser-exposed sensor ISO control.';
    updateIsoReadout();
  }else{
    isoSlider.disabled=true;
    document.getElementById('isoCapability').textContent='UNAVAILABLE';
    document.getElementById('isoValue').textContent='AUTO';
    document.getElementById('isoReadout').textContent='AUTO';
  }
  updateZoomReadout();
}

async function setZoom(v){
  const z=parseFloat(v);
  const caps=currentTrack?.getCapabilities?.() || {};
  if(caps.zoom){
    try{await currentTrack.applyConstraints({advanced:[{zoom:z}]}); video.style.transform='scale(1)';}
    catch(e){console.warn(e)}
  }else{
    video.style.transform='scale('+z+')';
  }
  const rounded=(Math.round(z*10)/10).toFixed(1)+'×';
  document.getElementById('zoomValue').textContent=rounded;
  document.getElementById('zoomReadout').textContent=rounded;
  const step=Math.round(z*10);
  if(step!==lastTickStep){ tick(step%10===0?'major':'soft'); lastTickStep=step; }
}
function updateZoomReadout(){ setZoom(zoomSlider.value); }

async function setIso(v){
  if(!currentTrack || isoSlider.disabled) return;
  const iso=Math.round(parseFloat(v));
  try{
    await currentTrack.applyConstraints({advanced:[{iso}]});
    document.getElementById('isoValue').textContent=iso;
    document.getElementById('isoReadout').textContent=iso;
    tick(iso%100===0?'major':'soft');
  }catch(e){showToast('ISO NOT ACCEPTED')}
}
function updateIsoReadout(){
  const v=currentTrack?.getSettings?.().iso;
  if(v){document.getElementById('isoValue').textContent=v;document.getElementById('isoReadout').textContent=v;}
}

function openPanel(panel){
  [proPanel,lookPanel].forEach(p=>{p.classList.remove('open');p.setAttribute('aria-hidden','true')});
  panel.classList.add('open');panel.setAttribute('aria-hidden','false');tick('major');
}
function closePanel(panel){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');tick('soft')}

function currentCssFilter(){
  return getComputedStyle(video).filter || 'none';
}

async function capture(){
  if(!video.videoWidth){showToast('CAMERA NOT READY');return}
  tick('major');
  const c=document.createElement('canvas');
  c.width=video.videoWidth; c.height=video.videoHeight;
  const ctx=c.getContext('2d');
  const scale=parseFloat((video.style.transform.match(/scale\(([^)]+)\)/)||[])[1]||'1');
  if(scale>1){
    const sw=c.width/scale, sh=c.height/scale;
    const sx=(c.width-sw)/2, sy=(c.height-sh)/2;
    ctx.filter=currentCssFilter();
    ctx.drawImage(video,sx,sy,sw,sh,0,0,c.width,c.height);
  }else{
    ctx.filter=currentCssFilter();
    ctx.drawImage(video,0,0,c.width,c.height);
  }
  c.toBlob(blob=>{
    capturedBlob=blob;
    if(lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl=URL.createObjectURL(blob);
    reviewImage.src=lastObjectUrl;
    reviewPanel.classList.add('open');
    reviewPanel.setAttribute('aria-hidden','false');
    document.getElementById('reviewLook').textContent=activeLook;
    const thumb=document.getElementById('lastShotThumb');
    thumb.outerHTML='<img id="lastShotThumb" src="'+lastObjectUrl+'" alt="Last shot" />';
  },'image/jpeg',.95);
}

async function shareCapture(){
  if(!capturedBlob) return;
  const file=new File([capturedBlob],'void-'+Date.now()+'.jpg',{type:'image/jpeg'});
  if(navigator.share && navigator.canShare?.({files:[file]})){
    try{await navigator.share({files:[file],title:'VOID Camera'});}catch{}
  }else{
    saveCapture();
  }
}
function saveCapture(){
  if(!lastObjectUrl) return;
  const a=document.createElement('a');
  a.href=lastObjectUrl;
  a.download='void-'+Date.now()+'.jpg';
  a.click();
}

startBtn.addEventListener('click',()=>{uiClick(620,.06,.04);startCamera()});
shutterBtn.addEventListener('click',capture);
switchBtn.addEventListener('click',async()=>{facingMode=facingMode==='environment'?'user':'environment';tick('major');await startCamera()});
document.getElementById('proButton').addEventListener('click',()=>openPanel(proPanel));
document.getElementById('lookButton').addEventListener('click',()=>{updateLookDetail();openPanel(lookPanel)});
document.getElementById('closeProButton').addEventListener('click',()=>closePanel(proPanel));
document.getElementById('closeLookButton').addEventListener('click',()=>closePanel(lookPanel));
document.getElementById('reviewCloseButton').addEventListener('click',()=>reviewPanel.classList.remove('open'));
document.getElementById('shareButton').addEventListener('click',shareCapture);
document.getElementById('saveButton').addEventListener('click',saveCapture);
document.getElementById('lastShotButton').addEventListener('click',()=>{if(lastObjectUrl) reviewPanel.classList.add('open')});

function toggleGrid(){
  grid.classList.toggle('hidden');
  document.getElementById('gridButton').classList.toggle('active',!grid.classList.contains('hidden'));
  document.getElementById('gridPanelButton').classList.toggle('active',!grid.classList.contains('hidden'));
  tick('soft');
}
document.getElementById('gridButton').addEventListener('click',toggleGrid);
document.getElementById('gridPanelButton').addEventListener('click',toggleGrid);
document.getElementById('zebraButton').addEventListener('click',e=>{e.currentTarget.classList.toggle('active');document.querySelector('.viewfinder').classList.toggle('zebra-on');tick('soft')});
zoomSlider.addEventListener('input',e=>setZoom(e.target.value));
isoSlider.addEventListener('input',e=>setIso(e.target.value));
lookSlider.addEventListener('input',e=>{lookStrength=parseInt(e.target.value,10)/100;applyLook();tick('soft')});

renderLooks();
updateLookDetail();

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
