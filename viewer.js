/* Partitures Festeres Web W1.2 — visor de partitures.
   PDF.js 4.10.38 legacy (Apache-2.0) s'obté de jsDelivr UNA VEGADA i es desa
   a CacheStorage; cap PDF privat s'envia al CDN. Si no està disponible,
   l'usuari pot continuar amb el visor natiu del navegador. */
const PDFJS_VERSION = '4.10.38';
const PDFJS_ROOT = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build/`;
const LIB_URL = PDFJS_ROOT + 'pdf.min.mjs';
const WORKER_URL = PDFJS_ROOT + 'pdf.worker.min.mjs';
const VENDOR_CACHE = 'pfweb-vendor-pdfjs-w12';
let enginePromise = null;
let workerBlobUrl = null;
let moduleBlobUrl = null;

async function getVendor(url) {
  if (!('caches' in window)) throw new Error('La memòria cau del visor no està disponible');
  const cache = await caches.open(VENDOR_CACHE);
  let response = await cache.match(url);
  if (!response) {
    if (!navigator.onLine) throw new Error('Cal preparar el visor una vegada amb connexió');
    response = await fetch(url, {mode:'cors', cache:'no-cache'});
    if (!response.ok || response.type === 'opaque') throw new Error(`No es pot descarregar PDF.js (${response.status})`);
    await cache.put(url, response.clone());
  }
  return await response.text();
}

export async function pdfEngineCached() {
  if (enginePromise && workerBlobUrl) return true;
  if (!('caches' in window)) return false;
  try {
    const cache = await caches.open(VENDOR_CACHE);
    return !!(await cache.match(LIB_URL) && await cache.match(WORKER_URL));
  } catch { return false; }
}

// Un únic intent compartit: dos PDFs oberts alhora no descarreguen el motor dues vegades.
export function preparePdfEngine() {
  if (!enginePromise) enginePromise = (async () => {
    // S'han de desar tots dos components abans de declarar el visor preparat.
    const [source, workerSource] = await Promise.all([getVendor(LIB_URL),getVendor(WORKER_URL)]);
    moduleBlobUrl = URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    const engine=await import(moduleBlobUrl);
    if (!engine?.getDocument) throw new Error('PDF.js no està disponible');
    // URL blob same-origin: evita dependència del CDN quan l'usuari està offline.
    if (!workerBlobUrl) workerBlobUrl=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
    engine.GlobalWorkerOptions.workerSrc=workerBlobUrl;
    return engine;
  })().catch(error => {enginePromise=null;throw error;});
  return enginePromise;
}

const clamp=(number,min,max)=>Math.max(min,Math.min(max,number));
const defer=()=>new Promise(resolve=>requestAnimationFrame(resolve));

export class ScoreViewer {
  constructor({host,blob,fallbackUrl,initial={},onChange=()=>{},onUpdate=()=>{},onWarning=()=>{},labels={}}){
    this.host=host;this.blob=blob;this.fallbackUrl=fallbackUrl;this.onChange=onChange;this.onUpdate=onUpdate;this.onWarning=onWarning;this.labels=labels;
    this.zoom=clamp(Number(initial.zoom)||1,.5,3);
    this.fit=initial.fit==='page'?'page':'width';
    this.rotation=[0,90,180,270].includes(initial.rotation)?initial.rotation:0;
    this.pageNumber=Math.max(1,Math.floor(Number(initial.page)||1));
    this.numPages=0;this.document=null;this.loadingTask=null;this.renderTask=null;this.closed=false;
    this.native=false;this.renderCount=0;this.resizeTimer=null;this.touchStart=null;
    this.handleResize=()=>{clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>this.draw(false),160);};
    this.handleTouchStart=e=>{if(e.touches.length===1)this.touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};};
    this.handleTouchEnd=e=>{
      if(!this.touchStart||e.changedTouches.length!==1||this.native)return;
      const dx=e.changedTouches[0].clientX-this.touchStart.x,dy=e.changedTouches[0].clientY-this.touchStart.y;
      const stage=this.host;this.touchStart=null;
      // No interferim amb la navegació quan s'ha ampliat i cal moure la partitura.
      if(this.zoom>1.03||!stage||stage.scrollWidth>stage.clientWidth+12)return;
      if(Math.abs(dx)>75 && Math.abs(dx)>Math.abs(dy)*1.75)this.turnPage(dx<0?1:-1);
    };
    if(this.host){this.host.addEventListener('touchstart',this.handleTouchStart,{passive:true});this.host.addEventListener('touchend',this.handleTouchEnd,{passive:true});}
    window.addEventListener('resize',this.handleResize);
  }
  snapshot(){return {zoom:this.zoom,fit:this.fit,rotation:this.rotation,page:this.pageNumber};}
  notify(save=false){this.onUpdate(this);if(save&&!this.closed)this.onChange(this.snapshot());}
  say(value){if(this.host){const elem=this.host.querySelector('.viewer-message');if(elem)elem.textContent=value;}}
  async open(){
    if(this.closed)return;
    this.say(this.labels.loading||'Carregant partitura…');
    try{
      const engine=await preparePdfEngine();
      if(this.closed)return;
      const data=new Uint8Array(await this.blob.arrayBuffer());
      if(this.closed)return;
      this.loadingTask=engine.getDocument({data,disableAutoFetch:true,isEvalSupported:false});
      this.document=await this.loadingTask.promise;
      if(this.closed)return;
      this.numPages=this.document.numPages;
      this.pageNumber=clamp(this.pageNumber,1,this.numPages);
      this.notify();
      await defer();await this.draw(true);
    }catch(error){
      if(!this.closed){console.warn('Visor PDF.js:',error);this.showNative();this.onWarning(this.labels.fallback||'El visor avançat no està preparat; s’ha obert el visor del navegador.');}
    }
  }
  showNative(){
    if(!this.host||this.closed)return;
    this.native=true;this.numPages=0;
    const frame=document.createElement('iframe');frame.className='viewer-native-frame';frame.title=this.labels.native||'Visor PDF';
    frame.src=this.fallbackUrl+'#view=FitH';
    this.host.replaceChildren(frame);
    this.notify();
  }
  async draw(resetScroll=false){
    if(this.closed||this.native||!this.document||!this.host)return;
    const seq=++this.renderCount;
    if(this.renderTask){try{this.renderTask.cancel();}catch{}}
    const host=this.host;
    try {
      const page=await this.document.getPage(this.pageNumber);
      if(this.closed||seq!==this.renderCount)return;
      const unit=page.getViewport({scale:1,rotation:this.rotation});
      const width=Math.max(120,host.clientWidth-20);
      const height=Math.max(100,host.clientHeight-20);
      const fitScale=this.fit==='page'?Math.min(width/unit.width,height/unit.height):width/unit.width;
      const viewport=page.getViewport({scale:fitScale*this.zoom,rotation:this.rotation});
      // Evitem textures excessivament grans en iOS (canvas màxim aprox. 7 MP).
      const pixelRatio=Math.max(.5,Math.min(window.devicePixelRatio||1,2,Math.sqrt(7_000_000/(viewport.width*viewport.height))));
      const canvas=document.createElement('canvas');canvas.className='viewer-canvas';canvas.setAttribute('aria-label',`${this.labels.page||'Pàgina'} ${this.pageNumber}`);
      canvas.width=Math.max(1,Math.floor(viewport.width*pixelRatio));
      canvas.height=Math.max(1,Math.floor(viewport.height*pixelRatio));
      canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
      const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas no disponible');
      const slot=document.createElement('div');slot.className='viewer-sheet';slot.style.width=viewport.width+'px';slot.style.height=viewport.height+'px';
      slot.append(canvas);
      // Superfície reservada per a les anotacions de la futura W2.
      const annotations=document.createElement('div');annotations.className='viewer-annotation-layer';annotations.setAttribute('aria-hidden','true');slot.append(annotations);
      host.replaceChildren(slot);
      this.renderTask=page.render({canvasContext:ctx,viewport,transform:[pixelRatio,0,0,pixelRatio,0,0]});
      await this.renderTask.promise;
      if(this.closed||seq!==this.renderCount)return;
      this.renderTask=null;
      if(resetScroll){host.scrollTop=0;host.scrollLeft=0;}
      this.notify();
    }catch(error){
      if(error?.name==='RenderingCancelledException'||seq!==this.renderCount||this.closed)return;
      console.warn('Error PDF.js:',error);this.showNative();this.onWarning(this.labels.fallback||'S’ha obert el visor alternatiu.');
    }
  }
  async turnPage(delta){
    if(this.native||!this.numPages)return;
    const next=clamp(this.pageNumber+delta,1,this.numPages);
    if(next===this.pageNumber)return;
    this.pageNumber=next;this.notify(true);await this.draw(true);
  }
  async setZoom(factor){
    if(this.native)return;
    this.zoom=clamp(Math.round(factor*100)/100,.5,3);this.notify(true);await this.draw(false);
  }
  async setFit(fit){
    if(this.native)return;
    this.fit=fit==='page'?'page':'width';this.zoom=1;this.notify(true);await this.draw(true);
  }
  async rotate(){
    if(this.native)return;
    this.rotation=(this.rotation+90)%360;this.notify(true);await this.draw(true);
  }
  close(){
    this.closed=true;this.renderCount++;
    clearTimeout(this.resizeTimer);
    window.removeEventListener('resize',this.handleResize);
    if(this.host){this.host.removeEventListener('touchstart',this.handleTouchStart);this.host.removeEventListener('touchend',this.handleTouchEnd);}
    try{this.renderTask?.cancel();}catch{}
    try{this.loadingTask?.destroy();}catch{}
    try{this.document?.destroy();}catch{}
  }
}
