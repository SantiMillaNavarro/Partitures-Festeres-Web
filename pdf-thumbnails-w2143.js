/* W2.14.2 — Miniatures locals i progressives de la primera pàgina PDF.
 * Fidels a PdfThumbnailRepository.kt: primer full, rotació del visor,
 * limitació de píxels, LRU en memòria, sense cap xarxa externa.
 * Mai guarda miniatures dins del PDF ni a IndexedDB.
 */
export const THUMB_MAX_WIDTH=280;
export const THUMB_MAX_HEIGHT=420;
export const THUMB_MAX_PIXELS=170_000;
export const THUMB_CACHE_ENTRIES=36;
export const THUMB_CACHE_BYTES=6*1024*1024;
export const THUMB_MAX_ACTIVE=1;
const isQuarterTurn=n=>Number.isInteger(n)&&n>=0&&n<360&&n%90===0;
export function thumbnailRotation(pref){
 // Quan el visor utilitza gir manual, la miniatura hereta la seua orientació.
 // En mode automàtic PDF.js respecta la rotació original del document.
 return pref?.rotationMode==='manual'&&isQuarterTurn(pref.rotation)?pref.rotation:null;
}
export function thumbnailSize(width,height,{
 maxWidth=THUMB_MAX_WIDTH,maxHeight=THUMB_MAX_HEIGHT,maxPixels=THUMB_MAX_PIXELS
}={}){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Dimensions PDF invàlides.');
 const scale=Math.min(1,maxWidth/width,maxHeight/height,Math.sqrt(maxPixels/(width*height)));
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),scale};
}
export function thumbnailKey(path,size,added){
 return String(path)+'|'+String(size??'')+'|'+String(added??'');
}
function imageBlob(canvas){
 return new Promise((resolve,reject)=>{
  try{
   canvas.toBlob(blob=>blob?.size?resolve(blob):reject(new Error('No es pot crear la miniatura.')),'image/jpeg',.78);
  }catch(error){reject(error);}
 });
}
function abortError(){
  const error=new Error('Miniatura cancel·lada per prioritzar el visor.');
  error.name='AbortError';return error;
}
function checkAbort(signal){if(signal?.aborted)throw abortError();}
export async function renderFirstPageThumbnail(blob,rotation=null,{signal}={}){
 checkAbort(signal);
 if(!blob||!Number.isFinite(blob.size)||!blob.size)throw new Error('PDF buit.');
 const pdf=window.pdfjsLib;
 if(!pdf?.getDocument)throw new Error('Motor PDF.js no disponible.');
 pdf.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.js',import.meta.url).href;
 let sourceUrl=null,task=null,documentPdf=null,canvas=null,renderTask=null;
 const onAbort=()=>{
  try{renderTask?.cancel();}catch{}
  if(!documentPdf&&task){try{Promise.resolve(task.destroy()).catch(()=>{});}catch{}}
 };
 signal?.addEventListener('abort',onAbort,{once:true});
 try{
  // PDF.js pot llegir el Blob amb URL local sense carregar-ne tots els bytes a JS.
  // Evita multiplicar el consum de memòria quan els PDF tenen moltes pàgines.
  sourceUrl=URL.createObjectURL(blob);
  task=pdf.getDocument({url:sourceUrl,isEvalSupported:false,disableAutoFetch:true});
  documentPdf=await task.promise;
  checkAbort(signal);
  if(!documentPdf.numPages)throw new Error('PDF sense pàgines.');
  const page=await documentPdf.getPage(1);
  checkAbort(signal);
  const base=page.getViewport({scale:1,...(rotation!==null?{rotation}:{})});
  const pixels=thumbnailSize(base.width,base.height);
  const viewport=page.getViewport({scale:pixels.scale,...(rotation!==null?{rotation}:{})});
  canvas=document.createElement('canvas');
  canvas.width=pixels.width;canvas.height=pixels.height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('No hi ha Canvas disponible.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  renderTask=page.render({canvasContext:ctx,viewport,background:'rgb(255,255,255)'});
  await renderTask.promise;
  checkAbort(signal);
  const jpeg=await imageBlob(canvas);
  checkAbort(signal);
  return jpeg;
 }finally{
  signal?.removeEventListener('abort',onAbort);
  if(canvas){canvas.width=0;canvas.height=0;}
  try{if(documentPdf)await documentPdf.destroy();else if(task)await task.destroy();}catch{}
  if(sourceUrl)URL.revokeObjectURL(sourceUrl);
 }
}
export class PdfThumbnailController{
 constructor({readScore,readPref,maxEntries=THUMB_CACHE_ENTRIES,maxBytes=THUMB_CACHE_BYTES}={}){
  this.readScore=readScore;this.readPref=readPref;
  this.maxEntries=maxEntries;this.maxBytes=maxBytes;
  this.cache=new Map();this.cacheBytes=0;
  this.failures=new Set();this.queued=new Set();this.inflight=new Set();
  this.controllers=new Map();this.paused=false;this.pendingIdle=null;this.renderRoot=null;this.desiredEnabled=false;
  this.queue=[];this.active=0;this.nodes=new Map();this.observer=null;
  this.enabled=true;this.epoch=0;this.scores=new Map();
  this.stats={created:0,failed:0};
 }
 invalidate(path){
  for(const [key,entry] of [...this.cache]){
   if(entry.path===path){URL.revokeObjectURL(entry.url);this.cache.delete(key);this.cacheBytes-=entry.size;}
  }
  for(const key of [...this.failures])if(key.startsWith(path+'|'))this.failures.delete(key);
 }
 reconcile(scores=[]){
  const next=new Map(scores.map(s=>[s.path,thumbnailKey(s.path,s.size,s.added)]));
  for(const [path,signature] of this.scores)if(next.get(path)!==signature)this.invalidate(path);
  this.scores=next;
 }
 clear(){
  this.pause();
  this.observer?.disconnect();this.observer=null;this.queue=[];this.queued.clear();this.nodes.clear();
  for(const entry of this.cache.values())URL.revokeObjectURL(entry.url);
  this.cache.clear();this.cacheBytes=0;this.failures.clear();
 }
 cancelPending(){
  this.observer?.disconnect();this.observer=null;
  this.queue=[];this.queued.clear();
  if(this.pendingIdle){
   const {kind,id}=this.pendingIdle;this.pendingIdle=null;
   if(kind==='idle'&&typeof cancelIdleCallback==='function')cancelIdleCallback(id);
   else if(kind==='timer')clearTimeout(id);
  }
  for(const controller of this.controllers.values())controller.abort();
 }
 pause(){
  // Cridat SÍNCRONAMENT abans de començar a llegir el PDF del visor.
  this.paused=true;this.enabled=false;this.cancelPending();
 }
 resume(){
  this.paused=false;
  if(this.renderRoot&&this.desiredEnabled)this.mount(this.renderRoot,{enabled:true});
 }
 schedule(){
  if(!this.enabled||this.paused||this.pendingIdle)return;
  const run=()=>{
   this.pendingIdle=null;
   if(this.enabled&&!this.paused)void this.pump();
  };
  if(typeof requestIdleCallback==='function'){
   this.pendingIdle={kind:'idle',id:requestIdleCallback(run,{timeout:1300})};
  }else{
   this.pendingIdle={kind:'timer',id:setTimeout(run,110)};
  }
 }
 mount(root,{enabled=true}={}){
  this.epoch++;
  this.renderRoot=root;this.desiredEnabled=!!enabled;
  this.observer?.disconnect();this.observer=null;
  this.nodes=new Map();
  this.enabled=!!enabled&&!this.paused;
  if(!this.enabled||!root){this.cancelPending();return;}
  this.queue=this.queue.filter(item=>this.scores.get(item.path)===item.key);
  this.queued=new Set(this.queue.map(i=>i.key));
  const elements=[...root.querySelectorAll('[data-pf-thumb]')];
  for(const el of elements){
   const path=el.dataset.pfThumb,size=Number(el.dataset.thumbSize),added=Number(el.dataset.thumbAdded);
   if(!this.scores.has(path))continue;
   const key=thumbnailKey(path,size,added);
   if(!this.nodes.has(key))this.nodes.set(key,new Set());
   this.nodes.get(key).add(el);
   const cached=this.cache.get(key);
   if(cached){this.useCached(key);this.insertImage(el,cached.url);}
   else if(this.failures.has(key))el.classList.add('pf-thumb-failed');
   else if(typeof IntersectionObserver==='undefined')this.request({path,key});
  }
  if(typeof IntersectionObserver==='undefined')return;
  this.observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(!entry.isIntersecting)continue;
    this.observer?.unobserve(entry.target);
    const el=entry.target;
    const path=el.dataset.pfThumb,key=thumbnailKey(path,Number(el.dataset.thumbSize),Number(el.dataset.thumbAdded));
    this.request({path,key});
   }
  },{root:null,rootMargin:'300px 0px',threshold:.01});
  for(const el of elements){
   const path=el.dataset.pfThumb;
   const key=thumbnailKey(path,Number(el.dataset.thumbSize),Number(el.dataset.thumbAdded));
   if(!this.cache.has(key)&&!this.failures.has(key))this.observer.observe(el);
  }
 }
 request({path,key}){
  if(!this.enabled||!this.scores.has(path)||this.scores.get(path)!==key)return;
  const cached=this.cache.get(key);
  if(cached){this.fillNodes(key,cached.url);return;}
  if(this.failures.has(key)||this.queued.has(key)||this.inflight.has(key))return;
  this.queued.add(key);this.queue.push({path,key});this.schedule();
 }
 async pump(){
  if(this.active>=THUMB_MAX_ACTIVE)return;
  while(this.active<THUMB_MAX_ACTIVE&&this.queue.length){
   const item=this.queue.shift();
   if(!item)break;
   // Eliminar encàrrecs antics quan es mou/esborra un PDF o es tanca la vista.
   if(!this.enabled||this.scores.get(item.path)!==item.key){
    this.queued.delete(item.key);continue;
   }
   this.active++;this.inflight.add(item.key);
   const controller=new AbortController();
   this.controllers.set(item.key,controller);
   void this.process(item,controller.signal).finally(()=>{
    this.active--;this.inflight.delete(item.key);this.controllers.delete(item.key);
    // Si s'ha reobert una llista durant la cancel·lació, esta entrada pot
    // necessitar una petició nova perquè la petició anterior s'ha descartat.
    if(this.enabled&&!this.paused&&this.nodes.has(item.key)&&
       !this.cache.has(item.key)&&!this.failures.has(item.key)&&
       this.scores.get(item.path)===item.key)this.request(item);
    if(this.enabled&&!this.paused&&this.queue.length)this.schedule();
   });
  }
 }
 async process({path,key},signal){
  try{
   checkAbort(signal);
   const score=await this.readScore(path);
   checkAbort(signal);
   if(!score?.blob)throw new Error('PDF no disponible.');
   const settings=await this.readPref('viewer:'+path,{});
   checkAbort(signal);
   const preview=await renderFirstPageThumbnail(score.blob,thumbnailRotation(settings),{signal});
   if(signal.aborted||!this.enabled||this.scores.get(path)!==key)return;
   const url=URL.createObjectURL(preview);
   const prior=this.cache.get(key);
   if(prior){URL.revokeObjectURL(prior.url);this.cacheBytes-=prior.size;this.cache.delete(key);}
   this.cache.set(key,{path,url,size:preview.size});
   this.cacheBytes+=preview.size;this.stats.created++;
   this.trim();
   this.fillNodes(key,url);
  }catch(error){
   if(signal?.aborted||error?.name==='AbortError'||!this.enabled)return;
   if(this.scores.get(path)===key){
    this.failures.add(key);this.stats.failed++;
    for(const node of this.nodes.get(key)||[])if(node.isConnected)node.classList.add('pf-thumb-failed');
   }
  }finally{this.queued.delete(key);}
 }
 useCached(key){
  const entry=this.cache.get(key);if(!entry)return;
  this.cache.delete(key);this.cache.set(key,entry);
 }
 trim(){
  while(this.cache.size>this.maxEntries||this.cacheBytes>this.maxBytes){
   const key=this.cache.keys().next().value;
   if(!key)break;
   const entry=this.cache.get(key);
   URL.revokeObjectURL(entry.url);
   this.cacheBytes-=entry.size;this.cache.delete(key);
  }
 }
 fillNodes(key,url){
  if(!this.enabled)return;
  for(const el of this.nodes.get(key)||[]){
   if(el.isConnected)this.insertImage(el,url);
  }
 }
 insertImage(el,url){
  if(el.querySelector('img')?.getAttribute('src')===url)return;
  const image=document.createElement('img');
  image.className='pf-thumb-image';image.alt='';
  image.decoding='async';image.loading='lazy';image.src=url;
  image.onerror=()=>{
   if(image.isConnected){el.classList.add('pf-thumb-failed');image.remove();}
  };
  el.replaceChildren(image);
  el.classList.add('pf-thumb-ready');
  el.classList.remove('pf-thumb-failed');
 }
}
