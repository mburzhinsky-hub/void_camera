const CACHE='void-camera-presets2-20260925-1';
const ASSETS=[
  './',
  './index.html',
  './styles.css?v=20260925-void-presets2-1',
  './sound-engine.js?v=20260925-void-presets2-1',
  './mechanical-dial.js?v=20260925-void-presets2-1',
  './film-engine.js?v=20260925-void-presets2-1',
  './app.js?v=20260925-void-presets2-1',
  './manifest.webmanifest',
  './icon.svg',
  './assets/presets/classic_city.svg',
  './assets/presets/soft_blossom.svg',
  './assets/presets/street_urban.svg',
  './assets/presets/warm_interior.svg',
  './assets/presets/cool_bridge.svg',
  './assets/presets/mono_portrait.svg',
  './assets/presets/portrait_400.svg',
  './assets/presets/daylight_250.svg',
  './assets/presets/tungsten_500.svg',
  './assets/presets/bleach.svg'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const fresh=url.pathname.endsWith('/')||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/styles.css')||url.pathname.endsWith('/app.js');

  if(fresh){
    event.respondWith(
      fetch(req,{cache:'no-store'})
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
          return res;
        })
        .catch(()=>caches.match(req))
    );
  }else{
    event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
  }
});