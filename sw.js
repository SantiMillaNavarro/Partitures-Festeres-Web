/* Partitures Festeres Web W1.2.3: public assets cached only. Private PDF in IndexedDB */
const CACHE='pfweb-shell-w28-retalls-ime-20261118';
const ASSETS=['./','./index.html','./app-w28.js','./viewer-w28.js','./styles-w28.css','./db.js','./backup.js','./metadata.js','./search-filters.js','./index-groups.js','./annotations.js','./annotation-geometry.js','./annotation-crops.js','./inline-text-w28.js','./rosette-w28.js','./rosette-ui-w28.js','./musical-symbols.js','./viewer-orientation.js','./score-orientation.js','./navigation-state.js','./manifest.webmanifest','./vendor/jszip.min.js','./vendor/pdf.js','./vendor/pdf.worker.js','./assets/pergami.png','./assets/icon-180.png','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-original.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('pfweb-shell-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 const isShell=req.mode==='navigate'||/\.(?:html|js|css|webmanifest)$/i.test(url.pathname)||url.pathname.endsWith('/');
 if(isShell)e.respondWith(fetch(req,{cache:'no-store'}).then(async r=>{if(r.ok){const c=await caches.open(CACHE);await c.put(req,r.clone())}return r}).catch(async()=>{let hit=await caches.match(req);if(hit)return hit;if(req.mode==='navigate')return await caches.match('./index.html')||Response.error();return Response.error()}));
 else e.respondWith(caches.match(req).then(r=>r||fetch(req).then(async response=>{if(response.ok){const c=await caches.open(CACHE);await c.put(req,response.clone());}return response;})));
});