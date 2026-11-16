/* Partitures Festeres Web W1.2.2 — recuperació de versions PWA coherents.
   Els PDF privats continuen exclusivament en IndexedDB: mai entren a la CacheStorage. */
const CACHE = 'pfweb-shell-w122-20261116';
const ASSETS = [
 './', './index.html', './styles-w122.css', './app-w122.js',
 './db-w122.js', './backup-w122.js', './manifest.webmanifest',
 './vendor/jszip.min.js', './assets/pergami.png',
 './assets/icon-180.png', './assets/icon-192.png',
 './assets/icon-512.png', './assets/icon-original.png'
];
self.addEventListener('install', e=>e.waitUntil(
 caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(n=>n.startsWith('pfweb-shell-')&&n!==CACHE).map(n=>caches.delete(n)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 const shell=url.pathname.endsWith('/')||/\.(?:html|js|css|webmanifest)$/i.test(url.pathname);
 if(shell){
   // Network first avoids mixed module versions and stays functional offline via precache.
   e.respondWith(fetch(req,{cache:'no-store'}).then(async response=>{
      if(response.ok){const cache=await caches.open(CACHE);await cache.put(req,response.clone());}
      return response;
   }).catch(async()=>{
      const cached=await caches.match(req);
      if(cached)return cached;
      if(req.mode==='navigate'){const index=await caches.match('./index.html');if(index)return index;}
      return Response.error();
   }));
 }else{
   e.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(async response=>{
     if(response.ok){const cache=await caches.open(CACHE);await cache.put(req,response.clone());}
     return response;
   })));
 }
});
