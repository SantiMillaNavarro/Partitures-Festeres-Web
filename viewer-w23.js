/* Partitures Festeres Web W1.2.4: visor de partitures en una sola pàgina.
   PDF.js 3.x s'allotja localment; els PDF privats no s'envien a servidors.
   Transformacions visuals contínues, sense esperar un nou render en cada gest.
*/
import {emptyAnnotations,normalizeAnnotations,projectPoint,unprojectPoint,ANNOTATION_COLORS,ANNOTATION_SHAPES} from './annotations.js';
import {strokeWidth,translatedStroke,strokePath,hitTestStroke,textBounds} from './annotation-geometry.js';
const SVG_NS='http://www.w3.org/2000/svg';
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const nextFrame = () => new Promise(r => requestAnimationFrame(r));
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class ScoreViewer {
  constructor({host, blob, fallbackUrl, initial = {}, onChange = () => {}, onUpdate = () => {},
    onWarning = () => {}, onEdge = () => {}, onToggleControls = () => {}, labels = {}, annotations = null, onAnnotationsChange=()=>{}, onTextPlacement=()=>{}}) {
    this.host = host;
    this.blob = blob;
    this.fallbackUrl = fallbackUrl;
    this.labels = labels;
    this.onChange = onChange;
    this.onUpdate = onUpdate;
    this.onWarning = onWarning;
    this.onEdge = onEdge;
    this.onToggleControls = onToggleControls;
    this.onAnnotationsChange=onAnnotationsChange;
    this.onTextPlacement=onTextPlacement;
    this.annotations=normalizeAnnotations(annotations||emptyAnnotations());
    this.annotationMode=false;
    this.annotationTool='pen';
    this.annotationColor='#b51f34';
    this.annotationThickness=3;
    this.annotationThicknessByTool={pen:3,highlighter:3,shape:3};
    this.textStyle={fontSize:.034,bold:false,underline:false,opacity:1,color:'#b51f34'};
    this.selectedAnnotation=null;
    this.previewAnnotation=null;
    this.annotationHistory=new Map();
    this.annotationGesture=null;
    this.annotationLayer=null;
    this.annotationSvg=null;
    this.activeAnnotation=null;
    this.annotationPointer=null;
    this.annotationSaveQueue=Promise.resolve();
    this.zoom = clamp(Number(initial.zoom) || 1, 1, 5);
    this.rotation = [0, 90, 180, 270].includes(initial.rotation) ? initial.rotation : 0;
    this.fit = initial.fit === 'width' ? 'width' : 'page';
    this.pageNumber = Math.max(1, Math.floor(Number(initial.page) || 1));
    this.numPages = 0;
    this.closed = false;
    this.native = false;
    this.renderCount = 0;
    this.panX = 0;
    this.panY = 0;
    this.pageW = 0;
    this.pageH = 0;
    this.fitScale = 1;
    this.doc = null;
    this.page = null;
    this.sheet = null;
    this.canvas = null;
    this.pdfTask = null;
    this.renderTask = null;
    this.pageCache = new Map();
    this.pointers = new Map();
    this.gesture = null;
    this.lastTap = null;
    this.renderDelay = 0;
    this.resizeDelay = 0;
    this.bounceTimer = 0;
    this.isMoving = false;
    this.onResize = () => {
      clearTimeout(this.resizeDelay);
      this.resizeDelay = setTimeout(() => {
        if (this.closed || !this.page || this.native) return;
        this.computeFit();
        this.applyTransform();
        this.requestRender();
      }, 90);
    };
    this.onPointerDown = e => this.pointerDown(e);
    this.onPointerMove = e => this.pointerMove(e);
    this.onPointerUp = e => this.pointerUp(e);
    this.onWheel = e => this.wheel(e);
    this.onContextMenu = e => e.preventDefault();
    host.addEventListener('pointerdown', this.onPointerDown);
    host.addEventListener('pointermove', this.onPointerMove);
    host.addEventListener('pointerup', this.onPointerUp);
    host.addEventListener('pointercancel', this.onPointerUp);
    host.addEventListener('lostpointercapture', this.onPointerUp);
    host.addEventListener('wheel', this.onWheel, {passive:false});
    host.addEventListener('contextmenu', this.onContextMenu);
    this.observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.onResize) : null;
    this.observer?.observe(host);
    window.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
  }
  snapshot() { return {zoom:this.zoom, fit:this.fit, rotation:this.rotation, page:this.pageNumber}; }
  notify(save = false) {
    if (this.closed) return;
    this.onUpdate(this);
    if (save) this.onChange(this.snapshot());
  }
  async open() {
    try {
      const pdf = window.pdfjsLib;
      if (!pdf?.getDocument) throw new Error('No es troba el motor PDF.js local');
      pdf.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.js', import.meta.url).href;
      const bytes = new Uint8Array(await this.blob.arrayBuffer());
      if (this.closed) return;
      this.pdfTask = pdf.getDocument({data:bytes, isEvalSupported:false});
      this.doc = await this.pdfTask.promise;
      if (this.closed) return;
      this.numPages = this.doc.numPages;
      this.pageNumber = clamp(this.pageNumber, 1, this.numPages);
      await nextFrame();
      await this.loadPage(true);
    } catch (error) {
      if (!this.closed) this.fail(error);
    }
  }
  async getPage(number) {
    const existing = this.pageCache.get(number);
    if (existing) return existing;
    const p = this.doc.getPage(number);
    this.pageCache.set(number, p);
    if (this.pageCache.size > 4) {
      const old = [...this.pageCache.keys()].find(k => Math.abs(k - number) > 1);
      if (old != null) this.pageCache.delete(old);
    }
    return p;
  }
  async loadPage(reset = false) {
    if (this.closed || !this.doc) return;
    const seq = ++this.renderCount;
    this.renderTask?.cancel();
    this.host.setAttribute('aria-busy', 'true');
    try {
      const page = await this.getPage(this.pageNumber);
      if (this.closed || seq !== this.renderCount) return;
      this.page = page;
      if (reset) { this.panX = 0; this.panY = 0; }
      this.computeFit();
      this.applyTransform();
      await this.renderPage(seq);
      if (this.closed || seq !== this.renderCount) return;
      this.host.removeAttribute('aria-busy');
      this.notify(true);
      // Se solicita la lectura de la página siguiente, sin renderizarla ni consumir memoria de canvas.
      if (this.pageNumber < this.numPages) setTimeout(() => {
        if (!this.closed && this.pageNumber + 1 <= this.numPages) this.getPage(this.pageNumber + 1).catch(() => {});
      }, 200);
    } catch (error) {
      if (this.closed || seq !== this.renderCount || error?.name === 'RenderingCancelledException') return;
      this.fail(error);
    }
  }
  computeFit() {
    if (!this.page) return;
    const base = this.page.getViewport({scale:1, rotation:this.rotation});
    const vw = Math.max(1, this.host.clientWidth);
    const vh = Math.max(1, this.host.clientHeight);
    this.fitScale = this.fit === 'width' ? vw / base.width : Math.min(vw / base.width, vh / base.height);
    this.pageW = base.width * this.fitScale;
    this.pageH = base.height * this.fitScale;
    this.clampPan();
  }
  clampPan() {
    const maxX = Math.max(0, (this.pageW * this.zoom - this.host.clientWidth) / 2);
    const maxY = Math.max(0, (this.pageH * this.zoom - this.host.clientHeight) / 2);
    this.panX = clamp(this.panX, -maxX, maxX);
    this.panY = clamp(this.panY, -maxY, maxY);
  }
  applyTransform() {
    this.clampPan();
    if (!this.sheet) return;
    this.sheet.style.width = this.pageW + 'px';
    this.sheet.style.height = this.pageH + 'px';
    this.sheet.style.transform = `translate(-50%, -50%) translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.redrawAnnotations();
  }
  async renderPage(seq) {
    const page = this.page;
    if (!page || this.closed) return;
    const fit = this.fitScale;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const maxPixels = Math.min(12e6, (this.host.clientWidth < 850 ? 6.5e6 : 12e6));
    const desired = Math.max(1, this.zoom) * dpr;
    const quality = Math.min(desired, Math.sqrt(maxPixels / Math.max(1, this.pageW * this.pageH)));
    const pixelViewport = page.getViewport({scale:fit * quality, rotation:this.rotation});
    // El viewport es usa a escala 1 en canvas CSS. La resolució interna augmenta amb el zoom.
    const canvas = document.createElement('canvas');
    canvas.className = 'viewer-canvas';
    canvas.width = Math.max(1, Math.floor(pixelViewport.width));
    canvas.height = Math.max(1, Math.floor(pixelViewport.height));
    canvas.style.width = this.pageW + 'px';
    canvas.style.height = this.pageH + 'px';
    canvas.setAttribute('aria-label', `${this.labels.page || 'Pàgina'} ${this.pageNumber}`);
    const ctx = canvas.getContext('2d', {alpha:false});
    if (!ctx) throw new Error('El navegador no permet renderitzar el PDF');
    const task = page.render({canvasContext:ctx, viewport:pixelViewport});
    this.renderTask = task;
    await task.promise;
    if (this.closed || seq !== this.renderCount) return;
    const sheet = document.createElement('div');
    sheet.className = 'viewer-sheet';
    sheet.style.width = this.pageW + 'px';
    sheet.style.height = this.pageH + 'px';
    sheet.append(canvas);
    const layer = document.createElement('div');
    layer.className = 'viewer-annotation-layer';
    layer.setAttribute('aria-hidden', 'true');
    sheet.append(layer);
    this.attachAnnotationLayer(layer);
    this.sheet = sheet;
    this.canvas = canvas;
    this.host.replaceChildren(sheet);
    this.applyTransform();
    this.renderTask = null;
  }
  requestRender() {
    if (this.closed || !this.page || this.native) return;
    clearTimeout(this.renderDelay);
    this.renderDelay = setTimeout(() => {
      const seq = ++this.renderCount;
      this.renderTask?.cancel();
      this.renderPage(seq).catch(error => {
        if (!this.closed && seq === this.renderCount && error?.name !== 'RenderingCancelledException') {
          console.warn('PDF render:', error);
          // Si ja hi ha un canvas, el mantenim visible i no destruïm la pàgina.
          if (!this.sheet) this.fail(error);
        }
      });
    }, 140);
  }
  focusZoom(next, x = this.host.clientWidth / 2, y = this.host.clientHeight / 2, save = false) {
    if (this.closed || !this.page) return;
    const old = this.zoom;
    const z = clamp(next, 1, 5);
    const fx = x - this.host.clientWidth / 2;
    const fy = y - this.host.clientHeight / 2;
    this.panX = fx - (fx - this.panX) * (z / old);
    this.panY = fy - (fy - this.panY) * (z / old);
    this.zoom = z;
    this.applyTransform();
    this.notify(save);
    this.requestRender();
  }
  async setZoom(z) { this.focusZoom(z, this.host.clientWidth / 2, this.host.clientHeight / 2, true); }
  async setFit(fit) {
    this.cancelAnnotationStroke();
    this.fit = fit === 'width' ? 'width' : 'page';
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.computeFit();
    this.applyTransform();
    this.notify(true);
    this.requestRender();
  }
  async rotate() {
    this.cancelAnnotationStroke();
    this.selectedAnnotation=null;
    this.rotation = (this.rotation + 90) % 360;
    this.panX = 0;
    this.panY = 0;
    this.computeFit();
    this.applyTransform();
    this.notify(true);
    this.requestRender();
  }
  async turnPage(direction) {
    if (this.closed || !this.doc) return;
    const next = this.pageNumber + direction;
    if (next < 1 || next > this.numPages) { this.onEdge(direction); return; }
    this.cancelAnnotationStroke();
    this.selectedAnnotation=null;
    this.pageNumber = next;
    this.panX = 0;
    this.panY = 0;
    this.notify(true);
    await this.loadPage(true);
  }
  setAnnotationMode(enabled){
    this.annotationMode=!!enabled&&!this.native;
    this.cancelAnnotationStroke();
    if(!this.annotationMode)this.selectedAnnotation=null;
    this.annotationLayer?.classList.toggle('annotation-editing',this.annotationMode);
    this.redrawAnnotations();this.notify();
  }
  toolCategory(tool=this.annotationTool){return tool==='pen'?'pen':tool==='highlighter'?'highlighter':'shape';}
  setAnnotationTool(tool){
    if(!['pen','highlighter',...ANNOTATION_SHAPES,'eraser','select','text'].includes(tool))return;
    this.cancelAnnotationStroke();
    this.annotationTool=tool;
    if(tool!=='select')this.selectedAnnotation=null;
    this.annotationThickness=this.annotationThicknessByTool[this.toolCategory(tool)]||3;
    this.redrawAnnotations();this.notify();
  }
  setAnnotationColor(color){if(ANNOTATION_COLORS.includes(color)){this.annotationColor=color;this.notify();}}
  setAnnotationThickness(level){
    const n=Number(level);
    if(!Number.isInteger(n)||n<1||n>5)return;
    this.annotationThickness=n;
    this.annotationThicknessByTool[this.toolCategory()]=n;
    this.notify();
  }
  annotationsOnPage(){return this.annotations.pages[String(this.pageNumber)]||[];}
  hasPageAnnotations(){return this.annotationsOnPage().length>0;}
  hasSelectedAnnotation(){return this.selectedAnnotation!=null&&this.selectedAnnotation>=0&&this.selectedAnnotation<this.annotationsOnPage().length;}
  canUndoAnnotation(){return (this.annotationHistory.get(this.pageNumber)?.length||0)>0||this.hasPageAnnotations();}
  cancelAnnotationStroke(){
    const id=this.annotationPointer,layer=this.annotationLayer;
    this.annotationPointer=null;this.annotationGesture=null;this.activeAnnotation=null;this.previewAnnotation=null;
    if(id!=null&&layer?.hasPointerCapture?.(id))try{layer.releasePointerCapture(id);}catch{}
    this.redrawAnnotations();
  }
  saveAnnotationDocument(){
    let snapshot;
    try{snapshot=normalizeAnnotations(this.annotations);}
    catch(e){this.onWarning(e.message);return false;}
    this.annotations=snapshot;
    this.annotationSaveQueue=this.annotationSaveQueue.catch(()=>{}).then(()=>this.onAnnotationsChange(snapshot)).catch(e=>this.onWarning(e?.message||String(e)));
    this.notify();
    return true;
  }
  // Substitució atòmica: si el model nou excedix els límits, no es perd l'estat anterior.
  commitAnnotationPage(next,remember=true){
    const key=String(this.pageNumber),before=this.annotationsOnPage();
    const draft={version:this.annotations.version,pages:{...this.annotations.pages}};
    if(next.length)draft.pages[key]=next;else delete draft.pages[key];
    let clean;
    try{clean=normalizeAnnotations(draft);}
    catch(e){this.onWarning(e.message);return false;}
    if(remember){
      const history=this.annotationHistory.get(this.pageNumber)||[];
      history.push(before.map(s=>({...s,points:s.points.map(p=>[...p])})));
      if(history.length>20)history.shift();
      this.annotationHistory.set(this.pageNumber,history);
    }
    this.annotations=clean;
    this.redrawAnnotations();
    this.saveAnnotationDocument();
    return true;
  }
  undoAnnotation(){
    if(!this.page)return false;
    const hist=this.annotationHistory.get(this.pageNumber);
    if(hist?.length){
      const prev=hist[hist.length-1];
      if(!this.commitAnnotationPage(prev,false))return false;
      hist.pop();this.selectedAnnotation=null;this.redrawAnnotations();this.notify();
      return true;
    }
    // Compatible amb W2.1: en tornar a obrir, Desfer elimina l'últim traç.
    const before=this.annotationsOnPage();
    if(!before.length)return false;
    this.selectedAnnotation=null;
    return this.commitAnnotationPage(before.slice(0,-1));
  }
  clearPageAnnotations(){
    if(!this.page||!this.hasPageAnnotations())return false;
    this.cancelAnnotationStroke();
    this.selectedAnnotation=null;
    return this.commitAnnotationPage([]);
  }
  getSelectedText(){
    const selected=this.hasSelectedAnnotation()?this.annotationsOnPage()[this.selectedAnnotation]:null;
    return selected?.tool==='text'?{...selected,index:this.selectedAnnotation}:null;
  }
  saveTextAnnotation(draft){
    if(!this.annotationMode||!this.page||this.native)return false;
    const text=typeof draft.text==='string'?draft.text.replace(/\\r\\n?/g,'\\n').trim():'';
    const fontSize=Number(draft.fontSize),opacity=Number(draft.opacity);
    const color=ANNOTATION_COLORS.includes(draft.color)?draft.color:this.annotationColor;
    const value={tool:'text',width:.0055,color,points:[draft.point],
      text,fontSize,bold:!!draft.bold,underline:!!draft.underline,opacity};
    const list=[...this.annotationsOnPage()];
    const idx=draft.index;
    if(idx!=null){
      if(!Number.isInteger(idx)||list[idx]?.tool!=='text')return false;
      value.points=list[idx].points.map(p=>[...p]);
      list[idx]=value;
    }else list.push(value);
    const ok=this.commitAnnotationPage(list);
    if(ok){
      this.textStyle={fontSize,bold:value.bold,underline:value.underline,opacity,color};
      this.annotationColor=color;
      if(idx!=null){this.selectedAnnotation=idx;this.redrawAnnotations();this.notify();}
    }
    return ok;
  }
  deleteSelectedAnnotation(){
    if(!this.hasSelectedAnnotation())return false;
    const index=this.selectedAnnotation,strokes=this.annotationsOnPage();
    this.selectedAnnotation=null;this.cancelAnnotationStroke();
    return this.commitAnnotationPage(strokes.filter((_,i)=>i!==index));
  }
  eraseAt(point){
    const strokes=this.annotationsOnPage();
    const index=hitTestStroke(strokes,point,this.pageW,this.pageH,this.rotation,this.zoom);
    if(index<0)return false;
    this.selectedAnnotation=null;
    return this.commitAnnotationPage(strokes.filter((_,i)=>i!==index));
  }
  attachAnnotationLayer(layer){
    this.annotationLayer=layer;
    layer.classList.toggle('annotation-editing',this.annotationMode);
    const svg=document.createElementNS(SVG_NS,'svg');
    svg.classList.add('annotation-svg');
    svg.setAttribute('aria-hidden','true');
    layer.appendChild(svg);
    this.annotationSvg=svg;
    layer.addEventListener('pointerdown',e=>this.annotationPointerDown(e));
    layer.addEventListener('pointermove',e=>this.annotationPointerMove(e));
    layer.addEventListener('pointerup',e=>this.annotationPointerUp(e));
    layer.addEventListener('pointercancel',e=>this.annotationPointerUp(e,true));
    layer.addEventListener('lostpointercapture',e=>this.annotationPointerUp(e,true));
    this.redrawAnnotations();
  }
  redrawAnnotations(){
    const svg=this.annotationSvg;
    if(!svg||!this.page||this.closed)return;
    const w=Math.max(1,this.pageW),h=Math.max(1,this.pageH);
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio','none');
    const base=this.annotationsOnPage(),frag=document.createDocumentFragment();
    const strokes=[...base];
    if(this.previewAnnotation!=null&&this.hasSelectedAnnotation())strokes[this.selectedAnnotation]=this.previewAnnotation;
    if(this.activeAnnotation)strokes.push(this.activeAnnotation);
    strokes.forEach((stroke,index)=>{
      if(!stroke?.points.length)return;
      if(stroke.tool==='text'){
        const pos=projectPoint(stroke.points[0],this.rotation);
        const x=pos[0]*w,y=pos[1]*h;
        const {width,height,fontPx,lines}=textBounds(stroke,w,h);
        const transform=`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${this.rotation})`;
        if(index===this.selectedAnnotation&&this.annotationMode&&this.annotationTool==='select'){
          const outline=document.createElementNS(SVG_NS,'rect');
          outline.setAttribute('x','-3');outline.setAttribute('y','-3');
          outline.setAttribute('width',String(width+6));outline.setAttribute('height',String(height+6));
          outline.setAttribute('transform',transform);outline.setAttribute('rx','3');
          outline.setAttribute('fill','none');outline.setAttribute('stroke','#d17c13');
          outline.setAttribute('stroke-width','2');outline.setAttribute('stroke-dasharray','6 4');
          outline.classList.add('annotation-selection');frag.appendChild(outline);
        }
        const node=document.createElementNS(SVG_NS,'text');
        node.classList.add('annotation-stroke','annotation-text');
        node.dataset.annotationIndex=String(index);
        node.setAttribute('transform',transform);
        node.setAttribute('fill',stroke.color);
        node.setAttribute('font-size',String(fontPx));
        node.setAttribute('font-family','Arial, Helvetica, sans-serif');
        node.setAttribute('font-weight',stroke.bold?'700':'400');
        node.setAttribute('text-decoration',stroke.underline?'underline':'none');
        node.setAttribute('opacity',String(stroke.opacity));
        node.setAttribute('dominant-baseline','hanging');
        lines.forEach((line,n)=>{
          const tspan=document.createElementNS(SVG_NS,'tspan');
          tspan.setAttribute('x','0');
          tspan.setAttribute('dy',n?String(fontPx*1.26):'0');
          tspan.textContent=line;
          node.appendChild(tspan);
        });
        frag.appendChild(node);
        return;
      }
      const d=strokePath(stroke,w,h,this.rotation);
      const addPath=(color,width,attrs={})=>{
        const path=document.createElementNS(SVG_NS,'path');
        path.setAttribute('d',d);path.setAttribute('fill','none');
        path.setAttribute('stroke',color);path.setAttribute('stroke-width',String(width));
        path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');
        for(const [key,val] of Object.entries(attrs))path.setAttribute(key,val);
        frag.appendChild(path);
        return path;
      };
      if(index===this.selectedAnnotation&&this.annotationMode&&this.annotationTool==='select')
        addPath('#d17c13',stroke.width*Math.min(w,h)+7,{'stroke-opacity':'.7','stroke-dasharray':'7 5',class:'annotation-selection'});
      const path=addPath(stroke.color,stroke.width*Math.min(w,h));
      path.classList.add('annotation-stroke');
      path.dataset.annotationIndex=String(index);
      if(stroke.tool==='highlighter')path.setAttribute('stroke-opacity','0.36');
    });
    svg.replaceChildren(frag);
  }
  annotationPoint(e){
    const r=this.annotationLayer?.getBoundingClientRect();
    if(!r||!r.width||!r.height)return null;
    const display=[clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1)];
    return unprojectPoint(display,this.rotation).map(v=>Math.round(clamp(v,0,1)*10000)/10000);
  }
  annotationPointerDown(e){
    if(!this.annotationMode||!this.page)return;
    e.preventDefault();e.stopPropagation();
    if(this.annotationPointer!==null||(e.pointerType==='mouse'&&e.button!==0))return;
    const point=this.annotationPoint(e);if(!point)return;
    if(this.annotationTool==='text'){
      this.onTextPlacement(point);return;
    }
    if(this.annotationTool==='eraser'){
      this.eraseAt(point);return;
    }
    if(this.annotationTool==='select'){
      const index=hitTestStroke(this.annotationsOnPage(),point,this.pageW,this.pageH,this.rotation,this.zoom);
      this.selectedAnnotation=index<0?null:index;
      this.previewAnnotation=null;
      if(index<0){this.redrawAnnotations();this.notify();return;}
      this.annotationGesture={kind:'move',start:point,original:this.annotationsOnPage()[index]};
    }else{
      const stroke={tool:this.annotationTool,color:this.annotationColor,
        width:strokeWidth(this.annotationTool,this.annotationThickness),points:[point]};
      this.activeAnnotation=stroke;
      this.annotationGesture={kind:ANNOTATION_SHAPES.includes(this.annotationTool)?'shape':'ink',start:point};
    }
    this.annotationPointer=e.pointerId;
    try{this.annotationLayer.setPointerCapture(e.pointerId);}catch{}
    this.redrawAnnotations();
    this.notify();
  }
  annotationPointerMove(e){
    if(!this.annotationMode)return;
    e.preventDefault();e.stopPropagation();
    if(this.annotationPointer!==e.pointerId||!this.annotationGesture)return;
    const g=this.annotationGesture;
    if(g.kind==='move'){
      const point=this.annotationPoint(e);
      if(point)this.previewAnnotation=translatedStroke(g.original,point[0]-g.start[0],point[1]-g.start[1]);
    }else if(g.kind==='shape'){
      const pt=this.annotationPoint(e);
      if(pt)this.activeAnnotation.points=[g.start,pt];
    }else if(g.kind==='ink'){
      const events=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():[e];
      for(const ev of events.length?events:[e]){
        const pt=this.annotationPoint(ev),list=this.activeAnnotation.points;
        if(!pt)continue;
        const last=list[list.length-1];
        if(Math.hypot(pt[0]-last[0],pt[1]-last[1])>=.0015&&list.length<1600)list.push(pt);
      }
    }
    this.redrawAnnotations();
  }
  annotationPointerUp(e,cancel=false){
    if(!this.annotationMode)return;
    e.preventDefault();e.stopPropagation();
    if(this.annotationPointer!==e.pointerId)return;
    const g=this.annotationGesture,stroke=this.activeAnnotation,preview=this.previewAnnotation;
    this.annotationPointer=null;this.annotationGesture=null;this.activeAnnotation=null;this.previewAnnotation=null;
    if(!cancel&&g?.kind==='move'&&this.hasSelectedAnnotation()&&preview){
      if(JSON.stringify(preview.points)!==JSON.stringify(g.original.points)){
        const next=[...this.annotationsOnPage()];next[this.selectedAnnotation]=preview;
        this.commitAnnotationPage(next);
      }
    }else if(!cancel&&stroke?.points?.length){
      const valid=g.kind!=='shape'||(stroke.points.length===2&&
        Math.hypot(stroke.points[0][0]-stroke.points[1][0],stroke.points[0][1]-stroke.points[1][1])>.003);
      if(valid)this.commitAnnotationPage([...this.annotationsOnPage(),stroke]);
    }
    this.redrawAnnotations();this.notify();
  }
  localPoint(e) {
    const bounds = this.host.getBoundingClientRect();
    return {x:e.clientX - bounds.left, y:e.clientY - bounds.top};
  }
  pointerDown(e) {
    if (this.closed || this.native || !this.page) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);
    try { this.host.setPointerCapture(e.pointerId); } catch {}
    if (this.pointers.size === 1) {
      this.gesture = {type:'one', start:p, last:p, initialPanX:this.panX, initialPanY:this.panY, moved:false, time:Date.now()};
    } else if (this.pointers.size === 2) {
      const [a,b] = [...this.pointers.values()];
      const mid = {x:(a.x+b.x)/2, y:(a.y+b.y)/2};
      this.gesture = {type:'pinch', startDistance:Math.max(10, length(a,b)), startMid:mid,
        zoom:this.zoom, panX:this.panX, panY:this.panY};
    }
  }
  pointerMove(e) {
    if (!this.pointers.has(e.pointerId) || !this.gesture) return;
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);
    const g = this.gesture;
    if (g.type === 'pinch' && this.pointers.size >= 2) {
      const [a,b] = [...this.pointers.values()];
      const mid = {x:(a.x+b.x)/2, y:(a.y+b.y)/2};
      const z = clamp(g.zoom * length(a,b) / g.startDistance, 1, 5);
      const factor = z / g.zoom;
      const cx = this.host.clientWidth / 2, cy = this.host.clientHeight / 2;
      this.zoom = z;
      this.panX = (mid.x-cx) - ((g.startMid.x-cx) - g.panX) * factor;
      this.panY = (mid.y-cy) - ((g.startMid.y-cy) - g.panY) * factor;
      this.applyTransform();
      this.notify(false);
      this.isMoving = true;
    } else if (g.type === 'one') {
      const dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (Math.hypot(dx, dy) > 8) g.moved = true;
      const allowX = this.pageW * this.zoom > this.host.clientWidth + 1;
      const allowY = this.pageH * this.zoom > this.host.clientHeight + 1;
      if (allowX || allowY) {
        this.panX = g.initialPanX + (allowX ? dx : 0);
        this.panY = g.initialPanY + (allowY ? dy : 0);
        this.applyTransform();
      }
    }
  }
  pointerUp(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const end = this.localPoint(e);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size > 0) {
      if (this.gesture?.type === 'pinch') this.gesture = {type:'pinch-end'};
      return;
    }
    const g = this.gesture;
    this.gesture = null;
    if (!g) return;
    if (g.type === 'pinch' || g.type === 'pinch-end') {
      this.notify(true);
      this.requestRender();
      this.isMoving = false;
      return;
    }
    if (e.type === 'pointercancel') return;
    const dx = end.x - g.start.x, dy = end.y - g.start.y;
    const duration = Date.now() - g.time;
    const maxDrift = Math.hypot(dx, dy);
    if (maxDrift > 65 && Math.abs(dx) > Math.abs(dy) * 1.6 && duration < 650 &&
      this.zoom <= 1.01 && this.pageW <= this.host.clientWidth + 1) {
      this.turnPage(dx < 0 ? 1 : -1);
      return;
    }
    if (maxDrift > 11) return;
    const at = Date.now();
    if (this.lastTap && this.lastTap.point.x / this.host.clientWidth >= .18 && this.lastTap.point.x / this.host.clientWidth <= .82 && end.x / this.host.clientWidth >= .18 && end.x / this.host.clientWidth <= .82 && at - this.lastTap.time < 320 && length(end, this.lastTap.point) < 45) {
      this.lastTap = null;
      this.focusZoom(this.zoom > 1.4 ? 1 : 2, end.x, end.y, true);
      return;
    }
    this.lastTap = {time:at,point:end};
    const ratio = end.x / Math.max(1, this.host.clientWidth);
    if (ratio < 0.18) this.turnPage(-1);
    else if (ratio > 0.82) this.turnPage(1);
    else this.onToggleControls();
  }
  wheel(e) {
    if (!this.page) return;
    e.preventDefault();
    const loc = this.localPoint(e);
    if (e.ctrlKey || e.metaKey) {
      this.focusZoom(this.zoom * Math.exp(-e.deltaY / 280), loc.x, loc.y, false);
      clearTimeout(this.wheelDone);
      this.wheelDone = setTimeout(() => this.notify(true), 250);
    } else if (this.pageH * this.zoom > this.host.clientHeight || this.pageW * this.zoom > this.host.clientWidth) {
      this.panY -= e.deltaY;
      this.panX -= e.deltaX;
      this.applyTransform();
    } else if (Math.abs(e.deltaY) > 45) {
      // El pas de pàgina es fa amb toc lateral o les tecles, no amb cada moviment del ratolí.
    }
  }
  fail(error) {
    this.native = true;
    console.error('[Partitures Festeres] Error PDF:', error);
    const div = document.createElement('div');
    div.className = 'viewer-message viewer-message-error';
    div.textContent = (this.labels.fallback || 'No es pot mostrar esta partitura') + ' ';
    const a = document.createElement('a');
    a.href = this.fallbackUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'viewer-fallback-link';
    a.textContent = this.labels.external || 'Obrir PDF';
    div.append(a);
    this.host.replaceChildren(div);
    this.onWarning(this.labels.fallback || String(error));
    this.notify();
  }
  close() {
    this.cancelAnnotationStroke();
    this.closed = true;
    clearTimeout(this.resizeDelay);
    clearTimeout(this.renderDelay);
    clearTimeout(this.wheelDone);
    clearTimeout(this.bounceTimer);
    window.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
    this.host.removeEventListener('pointerdown', this.onPointerDown);
    this.host.removeEventListener('pointermove', this.onPointerMove);
    this.host.removeEventListener('pointerup', this.onPointerUp);
    this.host.removeEventListener('pointercancel', this.onPointerUp);
    this.host.removeEventListener('lostpointercapture', this.onPointerUp);
    this.host.removeEventListener('wheel', this.onWheel);
    this.host.removeEventListener('contextmenu', this.onContextMenu);
    this.renderTask?.cancel();
    this.pdfTask?.destroy();
    this.doc?.destroy();
    this.pageCache.clear();
  }
}