/* Partitures Festeres Web W2.8: visor de partitures en una sola pàgina.
   PDF.js 3.x s'allotja localment; els PDF privats no s'envien a servidors.
   Transformacions visuals contínues, sense esperar un nou render en cada gest.
*/
import {emptyAnnotations,normalizeAnnotations,projectPoint,unprojectPoint,ANNOTATION_COLORS,ANNOTATION_SHAPES} from './annotations.js';
import {strokeWidth,translatedStroke,strokePath,hitTestStroke,textBounds,textBoxFromGesture,STANDARD_TEXT_BOX,wrapTextInBox,objectBounds,rotateScreenPoint,resizedStroke,rotatedStroke} from './annotation-geometry.js';
import {clientToViewerPoint,visualViewerDimensions,isViewerCssRotated} from './viewer-orientation.js';
import {analyzePdfPageOrientation,shouldKeepLegacyManual,supportedRotation} from './score-orientation.js';
import {MUSICAL_SYMBOLS,isMusicalSymbol,SYMBOL_SIZES,musicalSymbolBounds} from './musical-symbols.js';
import {createInlineTextEditor,validInlineText} from './inline-text-w28.js';
import {cropRectFromGesture,captureCropAsJpeg} from './annotation-crops.js';
import {normalizePageAdjustment,normalizePageAdjustments,displayedCropMargins,updatedPageAdjustments} from './page-adjustments-w218.js';
const SVG_NS='http://www.w3.org/2000/svg';
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const nextFrame = () => new Promise(r => requestAnimationFrame(r));
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class ScoreViewer {
  constructor({host, blob, fallbackUrl, initial = {}, onChange = () => {}, onUpdate = () => {},
    onWarning = () => {}, onEdge = () => {}, onToggleControls = () => {}, labels = {}, annotations = null, onAnnotationsChange=()=>{}, onTextPlacement=()=>{}, onDoubleTap=()=>{}, sideTapFraction=()=>.22, pageAdjustments={}, onPageAdjustmentsChange=()=>{}}) {
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
    this.onDoubleTap=onDoubleTap;
    this.sideTapFraction=sideTapFraction;
    this.pageAdjustments=normalizePageAdjustments(pageAdjustments);
    this.onPageAdjustmentsChange=onPageAdjustmentsChange;
    this.annotations=normalizeAnnotations(annotations||emptyAnnotations());
    this.annotationMode=false;
    this.navigationMode=false; // Moure el PDF sense dibuixar amb el rosetó obert.
    this.annotationTool='pen';
    this.annotationColor='#b51f34';
    this.annotationThickness=3;
    this.annotationThicknessByTool={pen:3,highlighter:3,shape:3};
    this.textStyle={fontSize:.034,bold:false,italic:false,underline:false,alignment:'left',backgroundEnabled:false,borderEnabled:false,opacity:1,color:'#b51f34'};
    this.inlineSession=null;
    this.musicalSymbol='quarter';
    this.musicalSymbolSize=.07;
    this.musicalSymbolColor='#242424';
    this.selectedAnnotation=null;
    this.annotationClipboard=null;
    this.annotationClipboardPage=null;
    this.annotationPasteCount=0;
    this.previewAnnotation=null;
    this.textBoxPreview=null;
    this.cropPreview=null;
    this.pendingTextBox=null;
    this.annotationHistory=new Map();
    this.annotationGesture=null;
    this.annotationLayer=null;
    this.annotationSvg=null;
    this.activeAnnotation=null;
    this.annotationPointer=null;
    this.annotationSaveQueue=Promise.resolve();
    this.zoom = clamp(Number(initial.zoom) || 1, 1, 5);
    // Les preferències antigues guardaven rotation:0 també sense gir manual.
    // Només un gir manual real (o un gir antic diferent de zero) invalida l'automàtic.
    this.rotationMode=shouldKeepLegacyManual(initial)?'manual':'auto';
    this.rotation=[0,90,180,270].includes(initial.rotation)?initial.rotation:0;
    const first=Math.max(1,Math.floor(Number(initial.page)||1));
    this.baseRotation=(this.rotation-90*(this.pageAdjustments[String(first)]?.rotationQuarterTurns||0)+360)%360;
    this.autoRotationByLayout=new Map();
    this.autoRotationByPage=new Map();
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
    this.visibleW=0;this.visibleH=0;this.cropOffsetX=0;this.cropOffsetY=0;
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
    this.lastStableHostSize=null;
    this.bounceTimer = 0;
    this.isMoving = false;
    this.onResize = () => {
      // En girar el dispositiu poden arribar moltes notificacions de resize
      // (window, visualViewport i ResizeObserver), fins i tot amb mides
      // provisionals. Un únic render una vegada estabilitzades.
      clearTimeout(this.resizeDelay);
      this.resizeDelay = setTimeout(() => {
        if (this.closed || !this.page || this.native || this.inlineSession) return;
        // El teclat canvia visualViewport; no reajustem el PDF durant l'escriptura.
        const width=Math.round(this.host.clientWidth),height=Math.round(this.host.clientHeight);
        if(width<80||height<80)return;
        if(this.lastStableHostSize&&
           Math.abs(width-this.lastStableHostSize.width)<3&&
           Math.abs(height-this.lastStableHostSize.height)<3)return;
        this.lastStableHostSize={width,height};
        this.computeFit();
        this.applyTransform();
        this.requestRender();
      },280);
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
    window.addEventListener('orientationchange',this.onResize);
  }
  snapshot() { return {zoom:this.zoom, fit:this.fit, rotation:this.rotation, rotationMode:this.rotationMode, page:this.pageNumber}; }
  pageAdjustment(page=this.pageNumber){return normalizePageAdjustment(this.pageAdjustments[String(page)]);}
  getPageAdjustments(){return normalizePageAdjustments(this.pageAdjustments);}
  async setPageAdjustment(value,all=false){
    if(this.closed||!this.page||this.native||this.annotationMode)return false;
    if(this.inlineSession&&!this.finishInlineTextEditor())return false;
    this.cancelAnnotationStroke();this.selectedAnnotation=null;
    const old=this.pageAdjustment(),next=normalizePageAdjustment(value);
    this.pageAdjustments=updatedPageAdjustments(this.pageAdjustments,this.pageNumber,next,this.numPages,all);
    const change=((next.rotationQuarterTurns-old.rotationQuarterTurns+4)%4)*90;
    this.rotation=(this.rotation+change)%360;
    this.panX=0;this.panY=0;
    this.computeFit();this.applyTransform();this.notify(true);
    try{await this.onPageAdjustmentsChange(this.getPageAdjustments());}
    catch(e){this.onWarning(e?.message||'No es poden guardar els ajustos de pàgina.');}
    this.requestRender();
    return true;
  }
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
      if(this.rotationMode==='auto'){
        let detected=this.autoRotationByPage.get(this.pageNumber);
        if(detected===undefined){
          const box=page.getViewport({scale:1,rotation:0});
          const key=`${Math.round(box.width)}:${Math.round(box.height)}:${supportedRotation(page.rotate)}`;
          const result=await analyzePdfPageOrientation(page,{
            fallbackRotation:this.autoRotationByLayout.get(key)??null
          });
          if(this.closed||seq!==this.renderCount)return;
          detected=result.rotation;
          this.autoRotationByPage.set(this.pageNumber,detected);
          this.autoRotationByLayout.set(key,detected);
        }
        this.baseRotation=detected;
      }
      this.rotation=(this.baseRotation+this.pageAdjustment().rotationQuarterTurns*90)%360;
      this.page = page;
      if (reset) { this.panX = 0; this.panY = 0; }
      this.computeFit();
      this.lastStableHostSize={width:Math.round(this.host.clientWidth),height:Math.round(this.host.clientHeight)};
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
    const vw=Math.max(1,this.host.clientWidth),vh=Math.max(1,this.host.clientHeight);
    const m=displayedCropMargins(this.pageAdjustment(),this.rotation);
    const cw=base.width*(1-m.left-m.right),ch=base.height*(1-m.top-m.bottom);
    this.fitScale=this.fit==='width'?vw/Math.max(1,cw):Math.min(vw/Math.max(1,cw),vh/Math.max(1,ch));
    // El PDF i les anotacions mantenen les coordenades de la pàgina original.
    this.pageW=base.width*this.fitScale;this.pageH=base.height*this.fitScale;
    this.visibleW=cw*this.fitScale;this.visibleH=ch*this.fitScale;
    this.cropOffsetX=this.pageW*m.left;this.cropOffsetY=this.pageH*m.top;
    this.clampPan();
  }
  clampPan() {
    const maxX=Math.max(0,(this.visibleW*this.zoom-this.host.clientWidth)/2);
    const maxY=Math.max(0,(this.visibleH*this.zoom-this.host.clientHeight)/2);
    this.panX = clamp(this.panX, -maxX, maxX);
    this.panY = clamp(this.panY, -maxY, maxY);
  }
  applyTransform() {
    this.clampPan();
    if (!this.sheet) return;
    this.sheet.style.width=this.visibleW+'px';
    this.sheet.style.height=this.visibleH+'px';
    // Mantindre la imatge anterior escalada mentre acaba el render nou:
    // evita els grans buits negres que es veien en girar el mòbil.
    if(this.canvas){
      this.canvas.style.width=this.pageW+'px';this.canvas.style.height=this.pageH+'px';
      this.canvas.style.left=-this.cropOffsetX+'px';this.canvas.style.top=-this.cropOffsetY+'px';
      this.canvas.style.filter='contrast('+this.pageAdjustment().contrast+')';
    }
    if(this.annotationLayer){
      this.annotationLayer.style.width=this.pageW+'px';this.annotationLayer.style.height=this.pageH+'px';
      this.annotationLayer.style.left=-this.cropOffsetX+'px';this.annotationLayer.style.top=-this.cropOffsetY+'px';
    }
    this.sheet.style.transform = `translate(-50%, -50%) translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.redrawAnnotations();
    this.inlineSession?.position();
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
    canvas.style.width=this.pageW+'px';canvas.style.height=this.pageH+'px';
    canvas.style.left=-this.cropOffsetX+'px';canvas.style.top=-this.cropOffsetY+'px';
    canvas.style.filter='contrast('+this.pageAdjustment().contrast+')';
    canvas.setAttribute('aria-label', `${this.labels.page || 'Pàgina'} ${this.pageNumber}`);
    const ctx = canvas.getContext('2d', {alpha:false});
    if (!ctx) throw new Error('El navegador no permet renderitzar el PDF');
    const task = page.render({canvasContext:ctx, viewport:pixelViewport});
    this.renderTask = task;
    await task.promise;
    if (this.closed || seq !== this.renderCount) return;
    // Conservar el contenidor evita desconnectar el textarea quan el PDF es redibuixa.
    const sheet = this.sheet?.parentElement===this.host ? this.sheet : document.createElement('div');
    sheet.className = 'viewer-sheet';
    sheet.style.width=this.visibleW+'px';sheet.style.height=this.visibleH+'px';
    if(this.canvas?.parentElement===sheet)this.canvas.replaceWith(canvas);
    else sheet.prepend(canvas);
    const layer = document.createElement('div');
    layer.className = 'viewer-annotation-layer';
    layer.style.width=this.pageW+'px';layer.style.height=this.pageH+'px';
    layer.style.left=-this.cropOffsetX+'px';layer.style.top=-this.cropOffsetY+'px';
    layer.setAttribute('aria-hidden', 'true');
    if(this.annotationLayer?.parentElement===sheet)this.annotationLayer.replaceWith(layer);
    else sheet.insertBefore(layer, sheet.children[1]||null);
    this.attachAnnotationLayer(layer);
    this.sheet = sheet;
    this.canvas = canvas;
    if(sheet.parentElement!==this.host)this.host.replaceChildren(sheet);
    this.inlineSession?.mount(layer);
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
    this.finishInlineTextEditor();
    this.cancelAnnotationStroke();
    this.selectedAnnotation=null;
    this.rotationMode='manual';
    this.baseRotation=(this.baseRotation+90)%360;
    this.rotation=(this.baseRotation+this.pageAdjustment().rotationQuarterTurns*90)%360;
    this.panX = 0;
    this.panY = 0;
    this.computeFit();
    this.applyTransform();
    this.notify(true);
    this.requestRender();
  }
  async useAutomaticRotation(){
    if(this.closed||!this.doc)return;
    this.finishInlineTextEditor();
    this.cancelAnnotationStroke();
    this.selectedAnnotation=null;
    this.rotationMode='auto';
    this.autoRotationByLayout.clear(); // Torna a detectar i no utilitza el gir manual anterior.
    this.autoRotationByPage.clear();
    this.panX=0;this.panY=0;
    await this.loadPage(true);
  }
  async turnPage(direction) {
    if (this.closed || !this.doc) return;
    if(this.inlineSession&&!this.finishInlineTextEditor())return;
    const next = this.pageNumber + direction;
    if (next < 1 || next > this.numPages) { this.onEdge(direction); return; }
    this.cancelAnnotationStroke();
    this.selectedAnnotation=null;
    this.pageNumber = next;
    this.panX = 0;
    this.panY = 0;
    // Actualitzar els controls immediatament, però NO guardar la rotació de
    // l'altra pàgina abans que acabe la detecció de la pàgina nova.
    this.notify(false);
    await this.loadPage(true);
  }
  setAnnotationMode(enabled){
    if(!enabled)this.finishInlineTextEditor();
    this.annotationMode=!!enabled&&!this.native;
    this.navigationMode=false; // Conservem el llapis inicial del visor per compatibilitat; Moure s'activa des del rosetó.
    this.cancelAnnotationStroke();
    if(!this.annotationMode)this.selectedAnnotation=null;
    this.annotationLayer?.classList.toggle('annotation-editing',this.annotationMode&&!this.navigationMode);
    this.lastTap=null;
    this.redrawAnnotations();this.notify();
  }
  setNavigationMode(enabled){
    this.navigationMode=!!enabled&&this.annotationMode;
    this.cancelAnnotationStroke();
    this.annotationLayer?.classList.toggle('annotation-editing',this.annotationMode&&!this.navigationMode);
    this.lastTap=null;
    this.notify();
  }
  toolCategory(tool=this.annotationTool){return tool==='pen'?'pen':tool==='highlighter'?'highlighter':'shape';}
  setAnnotationTool(tool){
    if(!['pen','highlighter',...ANNOTATION_SHAPES,'eraser','select','text','symbol','crop'].includes(tool))return;
    if(this.inlineSession&&tool!==this.annotationTool)this.finishInlineTextEditor();
    this.cancelAnnotationStroke();
    if(this.navigationMode)this.setNavigationMode(false);
    if(tool==='symbol'&&this.annotationTool!=='symbol')this.annotationColor=this.musicalSymbolColor;
    this.annotationTool=tool;
    if(tool!=='select')this.selectedAnnotation=null;
    this.annotationThickness=this.annotationThicknessByTool[this.toolCategory(tool)]||3;
    this.redrawAnnotations();this.notify();
  }
  setAnnotationColor(color){
    if(ANNOTATION_COLORS.includes(color)){
      this.annotationColor=color;
      if(this.annotationTool==='symbol')this.musicalSymbolColor=color;
      this.notify();
    }
  }
  setMusicalSymbol(id){
    if(!isMusicalSymbol(id))return false;
    this.musicalSymbol=id;
    if(this.annotationTool!=='symbol')this.setAnnotationTool('symbol');
    else this.notify();
    return true;
  }
  setMusicalSymbolSize(size){
    const n=Number(size);
    if(!SYMBOL_SIZES.includes(n))return false;
    this.musicalSymbolSize=n;
    this.notify();
    return true;
  }
  addMusicalSymbolAt(point){
    if(!this.annotationMode||!this.page||this.native||!isMusicalSymbol(this.musicalSymbol))return false;
    const stamp={tool:'symbol',symbolId:this.musicalSymbol,points:[point],
      color:this.annotationColor,width:.0055,fontSize:this.musicalSymbolSize,opacity:1};
    return this.commitAnnotationPage([...this.annotationsOnPage(),stamp]);
  }
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
  captureCropAt(rect){
    if(!this.annotationMode||!this.page||!this.canvas||!rect)return false;
    let imageData;
    try{imageData=captureCropAsJpeg(this.canvas,rect);}
    catch(error){this.onWarning(error?.message||'No s’ha pogut guardar el retall.');return false;}
    if(!imageData){this.onWarning('El retall és massa gran. Prova una zona més menuda.');return false;}
    const record={tool:'crop',color:'#242424',width:.0055,points:[rect.point],
      imageData,boxWidth:rect.boxWidth,boxHeight:rect.boxHeight,opacity:1};
    const before=this.annotationsOnPage(),index=before.length;
    if(!this.commitAnnotationPage([...before,record]))return false;
    this.setAnnotationTool('select');
    this.selectedAnnotation=index;this.redrawAnnotations();this.notify();
    return true;
  }
  canPasteAnnotation(){return !!this.annotationClipboard;}
  copySelectedAnnotation(){
    if(!this.annotationMode||!this.hasSelectedAnnotation()||this.inlineSession)return false;
    this.annotationClipboard=structuredClone(this.annotationsOnPage()[this.selectedAnnotation]);
    this.annotationClipboardPage=this.pageNumber;this.annotationPasteCount=0;
    this.notify();return true;
  }
  pasteCopiedAnnotation(){
    if(!this.annotationMode||!this.page||!this.annotationClipboard||this.inlineSession)return false;
    const original=structuredClone(this.annotationClipboard);
    const b=objectBounds(original,Math.max(1,this.pageW),Math.max(1,this.pageH),this.rotation);
    const offset=this.annotationClipboardPage===this.pageNumber?
      [.03*(this.annotationPasteCount+1),.03*(this.annotationPasteCount+1)]:
      [.5-b.cx/Math.max(1,this.pageW),.5-b.cy/Math.max(1,this.pageH)];
    const copy=translatedStroke(original,...offset);
    this.setAnnotationTool('select');
    const list=this.annotationsOnPage();
    if(!this.commitAnnotationPage([...list,copy]))return false;
    this.annotationPasteCount++;
    this.selectedAnnotation=list.length;this.redrawAnnotations();this.notify();
    return true;
  }
  transformSelectedAnnotation({rotation=0,scale=1}={}){
    if(!this.annotationMode||!this.hasSelectedAnnotation()||this.inlineSession)return false;
    const list=this.annotationsOnPage(),index=this.selectedAnnotation,original=list[index];
    let next=scale===1?original:resizedStroke(original,scale,this.pageW,this.pageH,this.rotation);
    if(rotation)next=rotatedStroke(next,rotation);
    if(JSON.stringify(next)===JSON.stringify(original))return false;
    if(!this.commitAnnotationPage(list.map((s,i)=>i===index?next:s)))return false;
    this.selectedAnnotation=index;this.redrawAnnotations();this.notify();return true;
  }
  canUndoAnnotation(){return (this.annotationHistory.get(this.pageNumber)?.length||0)>0||this.hasPageAnnotations();}
  cancelAnnotationStroke(){
    const id=this.annotationPointer,layer=this.annotationLayer;
    this.annotationPointer=null;this.annotationGesture=null;this.activeAnnotation=null;this.previewAnnotation=null;this.textBoxPreview=null;this.cropPreview=null;
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
    const text=typeof draft.text==='string'?draft.text.replace(/\r\n?/g,'\n').trim():'';
    const fontSize=Number(draft.fontSize),opacity=Number(draft.opacity);
    const color=ANNOTATION_COLORS.includes(draft.color)?draft.color:this.annotationColor;
    const value={tool:'text',width:.0055,color,points:[draft.point],
      text,fontSize,bold:!!draft.bold,underline:!!draft.underline,opacity};
    // El format nou és opcional; mantenim l'esquema v1 i els textos antics.
    if(draft.italic!==undefined)value.italic=!!draft.italic;
    if(draft.alignment!==undefined)value.alignment=['left','center','right'].includes(draft.alignment)?draft.alignment:'left';
    if(draft.backgroundEnabled!==undefined)value.backgroundEnabled=!!draft.backgroundEnabled;
    if(draft.borderEnabled!==undefined)value.borderEnabled=!!draft.borderEnabled;
    if(draft.rotationDegrees!==undefined)value.rotationDegrees=Number(draft.rotationDegrees)||0;
    const requestedWidth=Number(draft.boxWidth),requestedHeight=Number(draft.boxHeight);
    const boxed=Number.isFinite(requestedWidth)&&Number.isFinite(requestedHeight)&&
      requestedWidth>=.03&&requestedWidth<=.95&&requestedHeight>=.03&&requestedHeight<=.95;
    if(boxed){
      value.boxWidth=requestedWidth;
      value.boxHeight=requestedHeight;
      const w=Math.max(1,this.pageW),h=Math.max(1,this.pageH),px=fontSize*Math.min(w,h);
      const lines=wrapTextInBox(text,px,requestedWidth*w).length;
      value.boxHeight=Math.min(.95,Math.max(requestedHeight,(lines*px*1.26+px*.15)/h));
    }
    const list=[...this.annotationsOnPage()];
    const idx=draft.index;
    if(idx!=null){
      if(!Number.isInteger(idx)||list[idx]?.tool!=='text')return false;
      value.points=list[idx].points.map(p=>[...p]);
      if(!boxed&&list[idx].boxWidth!=null){value.boxWidth=list[idx].boxWidth;value.boxHeight=list[idx].boxHeight;}
      list[idx]=value;
    }else list.push(value);
    const ok=this.commitAnnotationPage(list);
    if(ok){
      this.discardPendingTextBox();
      this.textStyle={fontSize,bold:value.bold,italic:!!value.italic,underline:value.underline,
        alignment:value.alignment||'left',backgroundEnabled:!!value.backgroundEnabled,borderEnabled:!!value.borderEnabled,opacity,color};
      this.annotationColor=color;
      if(idx!=null){this.selectedAnnotation=idx;this.redrawAnnotations();this.notify();}
    }
    return ok;
  }
  startInlineTextEditor(draft,labels={}){
    if(!this.annotationMode||!this.page||this.native||this.closed)return false;
    if(this.inlineSession)this.finishInlineTextEditor();
    if(this.inlineSession)return false; // No sobreescriure un esborrany invàlid.
    const chosen={...this.textStyle,...draft,point:[...draft.point],
      text:draft.text||'',page:this.pageNumber,
      fontSize:draft.fontSize||this.textStyle.fontSize,
      color:draft.color||this.annotationColor,
      alignment:draft.alignment||this.textStyle.alignment||'left',
      italic:!!draft.italic,backgroundEnabled:!!draft.backgroundEnabled,
      borderEnabled:!!draft.borderEnabled};
    if(chosen.boxWidth==null||chosen.boxHeight==null){
      // Textos antics sense dimensions: continuar editant sense migració prèvia.
      const old=chosen.index!=null?this.annotationsOnPage()[chosen.index]:null;
      const b=old?textBounds(old,Math.max(1,this.pageW),Math.max(1,this.pageH)):null;
      chosen.boxWidth=Math.min(.95,Math.max(.28,(b?.width||0)/Math.max(1,this.pageW)+.03));
      chosen.boxHeight=Math.min(.95,Math.max(.10,(b?.height||0)/Math.max(1,this.pageH)+.03));
    }
    this.inlineSession=createInlineTextEditor(this,chosen,labels);
    this.pendingTextBox=null;this.textBoxPreview=null;
    this.host.closest('.pf-reading-mode')?.classList.add('inline-text-active');
    this.inlineSession.mount(this.annotationLayer||this.sheet);
    this.redrawAnnotations();this.notify();
    return true;
  }
  cancelInlineTextEditor(){
    if(!this.inlineSession)return false;
    const oldIndex=this.inlineSession.draft.index;
    this.inlineSession.destroy();this.inlineSession=null;
    this.host.closest('.pf-reading-mode')?.classList.remove('inline-text-active');
    this.discardPendingTextBox();
    // Com a Android, Text torna a Seleccionar fins i tot quan es cancel·la.
    this.setAnnotationTool('select');
    this.selectedAnnotation=oldIndex==null?null:oldIndex;
    this.redrawAnnotations();this.notify();this.onResize();return true;
  }
  finishInlineTextEditor(){
    const session=this.inlineSession;if(!session)return false;
    const text=session.getValue().trim();
    if(!text){this.cancelInlineTextEditor();return false;}
    if(!validInlineText(text)){
      this.onWarning('El text ha de tindre com a màxim cinc línies.');
      return false;
    }
    const currentPage=this.pageNumber;
    if(session.draft.page!==currentPage){this.cancelInlineTextEditor();return false;}
    const index=session.draft.index;
    const success=this.saveTextAnnotation({...session.draft,text});
    if(!success)return false;
    session.destroy();this.inlineSession=null;
    this.host.closest('.pf-reading-mode')?.classList.remove('inline-text-active');
    this.setAnnotationTool('select');
    this.selectedAnnotation=index==null?this.annotationsOnPage().length-1:index;
    this.redrawAnnotations();this.notify();
    this.onResize();
    return true;
  }
  discardPendingTextBox(){
    this.pendingTextBox=null;
    this.textBoxPreview=null;
    this.redrawAnnotations();
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
    layer.classList.toggle('annotation-editing',this.annotationMode&&!this.navigationMode);
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
    if(this.cropPreview){
      const b=cropRectFromGesture(this.cropPreview.start,this.cropPreview.end,this.rotation,w,h);
      if(b){
        const ghost=document.createElementNS(SVG_NS,'rect');
        ghost.setAttribute('x',String(b.screenX*w));ghost.setAttribute('y',String(b.screenY*h));
        ghost.setAttribute('width',String(b.boxWidth*w));ghost.setAttribute('height',String(b.boxHeight*h));
        ghost.setAttribute('fill','rgba(49,131,202,.18)');
        ghost.setAttribute('stroke','#1976d2');ghost.setAttribute('stroke-width','2');
        ghost.setAttribute('stroke-dasharray','7 4');
        ghost.classList.add('annotation-crop-preview');frag.append(ghost);
      }
    }
    if(this.textBoxPreview||this.pendingTextBox){
      const b=this.textBoxPreview||this.pendingTextBox,p=projectPoint(b.point,this.rotation),ghost=document.createElementNS(SVG_NS,'rect');
      ghost.setAttribute('x',String(p[0]*w));ghost.setAttribute('y',String(p[1]*h));
      ghost.setAttribute('width',String(b.boxWidth*w));ghost.setAttribute('height',String(b.boxHeight*h));
      ghost.setAttribute('fill','rgba(243,203,111,.16)');
      ghost.setAttribute('stroke','#c88125');ghost.setAttribute('stroke-width','2');
      ghost.setAttribute('stroke-dasharray','7 5');
      ghost.classList.add('annotation-text-preview');frag.appendChild(ghost);
    }
    strokes.forEach((stroke,index)=>{
      if(!stroke?.points.length)return;
      if(stroke.tool==='text'&&this.inlineSession&&this.inlineSession.draft.index===index&&this.inlineSession.draft.page===this.pageNumber)return;
      if(stroke.tool==='crop'){
        const p=projectPoint(stroke.points[0],this.rotation);
        const x=p[0]*w,y=p[1]*h,width=stroke.boxWidth*w,height=stroke.boxHeight*h;
        const angle=stroke.rotationDegrees||0;
        const transform=`translate(${x.toFixed(2)} ${y.toFixed(2)})`+(angle?` rotate(${angle} ${width/2} ${height/2})`:'');
        if(index===this.selectedAnnotation&&this.annotationMode&&this.annotationTool==='select'){
          const outline=document.createElementNS(SVG_NS,'rect');
          outline.setAttribute('x','-3');outline.setAttribute('y','-3');
          outline.setAttribute('width',String(width+6));outline.setAttribute('height',String(height+6));
          outline.setAttribute('transform',transform);outline.setAttribute('rx','3');
          outline.setAttribute('fill','none');outline.setAttribute('stroke','#1976d2');
          outline.setAttribute('stroke-width','2');outline.setAttribute('stroke-dasharray','6 4');
          outline.classList.add('annotation-selection');frag.append(outline);
          const handle=document.createElementNS(SVG_NS,'circle');
          handle.setAttribute('cx',String(width));handle.setAttribute('cy',String(height));handle.setAttribute('r','8');
          handle.setAttribute('fill','#1976d2');handle.setAttribute('stroke','#fff');
          handle.setAttribute('stroke-width','2');handle.setAttribute('transform',transform);
          handle.classList.add('annotation-crop-resize-handle');frag.append(handle);
        }
        const image=document.createElementNS(SVG_NS,'image');
        image.classList.add('annotation-stroke','annotation-crop');
        image.dataset.annotationIndex=String(index);
        image.setAttribute('href',stroke.imageData);
        image.setAttribute('x','0');image.setAttribute('y','0');
        image.setAttribute('width',String(width));image.setAttribute('height',String(height));
        image.setAttribute('preserveAspectRatio','none');
        image.setAttribute('transform',transform);
        image.setAttribute('opacity',String(stroke.opacity));
        frag.append(image);return;
      }
      if(stroke.tool==='symbol'){
        const def=MUSICAL_SYMBOLS[stroke.symbolId];
        if(!def)return;
        const pos=projectPoint(stroke.points[0],this.rotation);
        const x=pos[0]*w,y=pos[1]*h;
        const bounds=musicalSymbolBounds(stroke,w,h);
        const r=stroke.rotationDegrees||0;
        const transform=`translate(${x.toFixed(2)} ${y.toFixed(2)})`+(r?` rotate(${r} ${bounds.width/2} ${bounds.height/2})`:'');
        if(index===this.selectedAnnotation&&this.annotationMode&&this.annotationTool==='select'){
          const outline=document.createElementNS(SVG_NS,'rect');
          outline.setAttribute('x','-4');outline.setAttribute('y','-4');
          outline.setAttribute('width',String(bounds.width+8));
          outline.setAttribute('height',String(bounds.height+8));
          outline.setAttribute('transform',transform);
          outline.setAttribute('rx','3');
          outline.setAttribute('fill','none');
          outline.setAttribute('stroke','#d17c13');
          outline.setAttribute('stroke-width','2');
          outline.setAttribute('stroke-dasharray','6 4');
          outline.classList.add('annotation-selection');
          frag.appendChild(outline);
        }
        const stamp=document.createElementNS(SVG_NS,'g');
        stamp.classList.add('annotation-stroke','annotation-symbol');
        stamp.dataset.annotationIndex=String(index);
        stamp.dataset.symbolId=stroke.symbolId;
        stamp.setAttribute('transform',transform+` scale(${bounds.height/100})`);
        stamp.setAttribute('color',stroke.color);
        stamp.setAttribute('opacity',String(stroke.opacity));
        // Exclusivament glifs SVG predefinits del nostre catàleg, no dades usuari.
        stamp.innerHTML=def.svg;
        frag.appendChild(stamp);
        return;
      }
      if(stroke.tool==='text'){
        const pos=projectPoint(stroke.points[0],this.rotation);
        const x=pos[0]*w,y=pos[1]*h;
        const {width,height,fontPx,lines}=textBounds(stroke,w,h);
        const r=stroke.rotationDegrees||0;
        const transform=`translate(${x.toFixed(2)} ${y.toFixed(2)})`+(r?` rotate(${r} ${width/2} ${height/2})`:'');
        if(index===this.selectedAnnotation&&this.annotationMode&&this.annotationTool==='select'){
          const outline=document.createElementNS(SVG_NS,'rect');
          outline.setAttribute('x','-3');outline.setAttribute('y','-3');
          outline.setAttribute('width',String(width+6));outline.setAttribute('height',String(height+6));
          outline.setAttribute('transform',transform);outline.setAttribute('rx','3');
          outline.setAttribute('fill','none');outline.setAttribute('stroke','#d17c13');
          outline.setAttribute('stroke-width','2');outline.setAttribute('stroke-dasharray','6 4');
          outline.classList.add('annotation-selection');frag.appendChild(outline);
          if(stroke.boxWidth!=null){
            const handle=document.createElementNS(SVG_NS,'circle');
            handle.setAttribute('cx',String(width));handle.setAttribute('cy',String(height));
            handle.setAttribute('r','8');
            handle.setAttribute('fill','#c88125');handle.setAttribute('stroke','#fff');
            handle.setAttribute('stroke-width','2');handle.setAttribute('transform',transform);
            handle.classList.add('annotation-text-resize-handle');frag.appendChild(handle);
          }
        }
        const node=document.createElementNS(SVG_NS,'text');
        node.classList.add('annotation-stroke','annotation-text');
        node.dataset.annotationIndex=String(index);
        node.setAttribute('transform',transform);
        node.setAttribute('fill',stroke.color);
        node.setAttribute('font-size',String(fontPx));
        node.setAttribute('font-family','Arial, Helvetica, sans-serif');
        node.setAttribute('font-weight',stroke.bold?'700':'400');
        node.setAttribute('font-style',stroke.italic?'italic':'normal');
        node.setAttribute('text-anchor',stroke.alignment==='center'?'middle':stroke.alignment==='right'?'end':'start');
        node.setAttribute('text-decoration',stroke.underline?'underline':'none');
        node.setAttribute('opacity',String(stroke.opacity));
        node.setAttribute('dominant-baseline','hanging');
        if(stroke.boxWidth!=null){
          const clipId='pfw-text-clip-'+this.pageNumber+'-'+index;
          const clip=document.createElementNS(SVG_NS,'clipPath');
          clip.setAttribute('id',clipId);
          const limit=document.createElementNS(SVG_NS,'rect');
          limit.setAttribute('x','0');limit.setAttribute('y','0');
          limit.setAttribute('width',String(width));limit.setAttribute('height',String(height));
          clip.appendChild(limit);frag.appendChild(clip);
          node.setAttribute('clip-path','url(#'+clipId+')');
        }
        if(stroke.boxWidth!=null&&(stroke.backgroundEnabled||stroke.borderEnabled)){
          const bg=document.createElementNS(SVG_NS,'rect');
          bg.setAttribute('width',String(width));bg.setAttribute('height',String(height));
          bg.setAttribute('transform',transform);
          bg.setAttribute('fill',stroke.backgroundEnabled?'#fff':'none');
          if(stroke.borderEnabled){bg.setAttribute('stroke',stroke.color);bg.setAttribute('stroke-width','1.5');}
          frag.appendChild(bg);
        }
        lines.forEach((line,n)=>{
          const tspan=document.createElementNS(SVG_NS,'tspan');
          const alignedX=stroke.boxWidth!=null?stroke.alignment==='center'?width/2:stroke.alignment==='right'?width-2:2:0;
          tspan.setAttribute('x',String(alignedX));
          tspan.setAttribute('dy',n?String(fontPx*1.26):'0');
          tspan.textContent=line;
          node.appendChild(tspan);
        });
        frag.appendChild(node);
        return;
      }
      const d=strokePath(stroke,w,h,this.rotation);
      const rotated=stroke.rotationDegrees ? objectBounds(stroke,w,h,this.rotation) : null;
      const addPath=(color,width,attrs={})=>{
        const path=document.createElementNS(SVG_NS,'path');
        path.setAttribute('d',d);path.setAttribute('fill','none');
        if(rotated)path.setAttribute('transform',`rotate(${stroke.rotationDegrees} ${rotated.cx} ${rotated.cy})`);
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
    const rotated=isViewerCssRotated(this.host.closest('.pf-reading-mode'));
    const local=clientToViewerPoint(e.clientX,e.clientY,r,rotated);
    const size=visualViewerDimensions(r,rotated);
    const display=[clamp(local.x/size.width,0,1),clamp(local.y/size.height,0,1)];
    return unprojectPoint(display,this.rotation).map(v=>Math.round(clamp(v,0,1)*10000)/10000);
  }
  annotationPointerDown(e){
    if(!this.annotationMode||!this.page)return;
    e.preventDefault();e.stopPropagation();
    // Un únic quadre cada vegada: mentre el teclat està actiu, tocar el PDF
    // no ha d'iniciar una altra col·locació ni substituir el text en curs.
    if(this.inlineSession)return;
    if(this.annotationPointer!==null||(e.pointerType==='mouse'&&e.button!==0))return;
    const point=this.annotationPoint(e);if(!point)return;
    if(this.annotationTool==='crop'){
      this.cropPreview={start:point,end:point};
      this.annotationGesture={kind:'crop',start:point};
      this.annotationPointer=e.pointerId;
      try{this.annotationLayer.setPointerCapture(e.pointerId);}catch{}
      this.redrawAnnotations();return;
    }
    if(this.annotationTool==='text'){
      this.textBoxPreview=textBoxFromGesture(point,point,this.rotation,this.pageW,this.pageH);
      this.annotationGesture={kind:'text-box',start:point};
      this.annotationPointer=e.pointerId;
      try{this.annotationLayer.setPointerCapture(e.pointerId);}catch{}
      this.redrawAnnotations();
      return;
    }
    if(this.annotationTool==='symbol'){
      this.addMusicalSymbolAt(point);return;
    }
    if(this.annotationTool==='eraser'){
      this.eraseAt(point);return;
    }
    if(this.annotationTool==='select'){
      const index=hitTestStroke(this.annotationsOnPage(),point,this.pageW,this.pageH,this.rotation,this.zoom);
      this.selectedAnnotation=index<0?null:index;
      this.previewAnnotation=null;
      if(index<0){this.redrawAnnotations();this.notify();return;}
      const original=this.annotationsOnPage()[index];
      const bounds=original.tool==='text'&&original.boxWidth!=null?
        textBounds(original,this.pageW,this.pageH):null;
      const corner=bounds?projectPoint(original.points[0],this.rotation):null;
      const touch=projectPoint(point,this.rotation);
      const obj=['text','crop'].includes(original.tool)&&original.boxWidth!=null?objectBounds(original,this.pageW,this.pageH,this.rotation):null;
      const resizePoint=obj?rotateScreenPoint([obj.left+obj.width,obj.top+obj.height],obj.cx,obj.cy,original.rotationDegrees||0):null;
      const isResize=!!(resizePoint&&Math.hypot(touch[0]*this.pageW-resizePoint[0],
        touch[1]*this.pageH-resizePoint[1])<=19);
      this.annotationGesture={kind:isResize?'resize-text':'move',start:point,original};
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
    }else if(g.kind==='resize-text'){
      const point=this.annotationPoint(e);
      if(point){
        const raw=projectPoint(point,this.rotation),obj=objectBounds(g.original,this.pageW,this.pageH,this.rotation);
        const unrotated=rotateScreenPoint([raw[0]*this.pageW,raw[1]*this.pageH],obj.cx,obj.cy,-(g.original.rotationDegrees||0));
        const target=[unrotated[0]/this.pageW,unrotated[1]/this.pageH],anchor=projectPoint(g.original.points[0],this.rotation);
        this.previewAnnotation={...g.original,boxWidth:Math.max(.03,Math.min(.95,Math.abs(target[0]-anchor[0]))),
          boxHeight:Math.max(.03,Math.min(.95,Math.abs(target[1]-anchor[1])))};
      }
    }else if(g.kind==='crop'){
      const pt=this.annotationPoint(e);
      if(pt)this.cropPreview={start:g.start,end:pt};
    }else if(g.kind==='text-box'){
      const pt=this.annotationPoint(e);
      if(pt)this.textBoxPreview=textBoxFromGesture(g.start,pt,this.rotation,this.pageW,this.pageH);
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
    const box=this.textBoxPreview,cropPreview=this.cropPreview;
    this.annotationPointer=null;this.annotationGesture=null;this.activeAnnotation=null;this.previewAnnotation=null;this.textBoxPreview=null;this.cropPreview=null;
    if(!cancel&&g?.kind==='crop'){
      const end=this.annotationPoint(e)||cropPreview?.end||g.start;
      const rect=cropRectFromGesture(g.start,end,this.rotation,this.pageW,this.pageH);
      this.redrawAnnotations();
      if(rect)this.captureCropAt(rect);
    }else if(!cancel&&g?.kind==='text-box'){
      const point=this.annotationPoint(e);
      const shape=point?textBoxFromGesture(g.start,point,this.rotation,this.pageW,this.pageH):box;
      this.redrawAnnotations();
      if(shape){
        this.pendingTextBox=shape;
        this.redrawAnnotations();
        this.onTextPlacement(shape.point,{boxWidth:shape.boxWidth,boxHeight:shape.boxHeight});
      }
    }else if(!cancel&&(g?.kind==='move'||g?.kind==='resize-text')&&this.hasSelectedAnnotation()&&preview){
      if(JSON.stringify(preview)!==JSON.stringify(g.original)){
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
    const bounds=this.host.getBoundingClientRect();
    const rotated=isViewerCssRotated(this.host.closest('.pf-reading-mode'));
    return clientToViewerPoint(e.clientX,e.clientY,bounds,rotated);
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
      const allowX=this.visibleW*this.zoom>this.host.clientWidth+1;
      const allowY=this.visibleH*this.zoom>this.host.clientHeight+1;
      if (allowX || allowY) {
        this.panX = g.initialPanX + (allowX ? dx : 0);
        this.panY = g.initialPanY + (allowY ? dy : 0);
        this.applyTransform();
      }
    }
  }
  getSideTapFraction(){
    const value=Number(typeof this.sideTapFraction==='function'?this.sideTapFraction():this.sideTapFraction);
    return Number.isFinite(value)?Math.min(.32,Math.max(.12,value)):.22;
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
      this.zoom <= 1.01 && this.visibleW <= this.host.clientWidth + 1) {
      this.turnPage(dx < 0 ? 1 : -1);
      return;
    }
    if (maxDrift > 11) return;
    const at = Date.now();
    if (this.lastTap && this.lastTap.point.x / this.host.clientWidth >= this.getSideTapFraction() && this.lastTap.point.x / this.host.clientWidth <= 1-this.getSideTapFraction() && end.x / this.host.clientWidth >= this.getSideTapFraction() && end.x / this.host.clientWidth <= 1-this.getSideTapFraction() && at - this.lastTap.time < 320 && length(end, this.lastTap.point) < 45) {
      this.lastTap = null;
      // Gest únic: no fer zoom i activar el rosetó alhora.
      e.preventDefault?.();
      this.onDoubleTap(end);
      return;
    }
    this.lastTap = {time:at,point:end};
    const ratio = end.x / Math.max(1, this.host.clientWidth);
    const fraction=this.getSideTapFraction();
    if (ratio < fraction) this.turnPage(-1);
    else if (ratio > 1-fraction) this.turnPage(1);
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
    this.finishInlineTextEditor();
    this.cancelAnnotationStroke();
    this.closed = true;
    clearTimeout(this.resizeDelay);
    clearTimeout(this.renderDelay);
    clearTimeout(this.wheelDone);
    clearTimeout(this.bounceTimer);
    window.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange',this.onResize);
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