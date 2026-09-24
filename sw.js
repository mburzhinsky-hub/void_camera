const CACHE='void-camera-ref-20260925-1';
const ASSETS=[
  './',
  './index.html',
  './styles.css?v=20260925-void-ref-1',
  './app.js?v=20260925-void-ref-1',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fresh =
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/styles.css') ||
    url.pathname.endsWith('/app.js');

  if (fresh) {
    event.respondWith(
      fetch(req, {cache:'no-store'})
        .then(res => {
          const copy=res.clone();
          caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
          return res;
        })
        .catch(()=>caches.match(req))
    );
  } else {
    event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
  }
});
