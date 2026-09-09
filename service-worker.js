const CACHE_NAME = 'repace-v4-2-engine-v3';
const APP_SHELL = [
  './', './index.html', './styles.css?v=4.0', './data.js?v=4.0', './app.js?v=4.0',
  './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png',
  './icons/icon-512.png', './icons/icon-512-maskable.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n!==CACHE_NAME).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET') return;
  const req=event.request;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(resp=>{
      const copy=resp.clone(); caches.open(CACHE_NAME).then(c=>c.put('./index.html',copy)); return resp;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(req).then(resp=>{
    const copy=resp.clone(); caches.open(CACHE_NAME).then(c=>c.put(req,copy)); return resp;
  }).catch(()=>caches.match(req)));
});
