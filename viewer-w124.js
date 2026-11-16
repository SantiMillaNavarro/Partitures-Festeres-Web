/* Partitures Festeres Web W1.2.4: visor de partitures en una sola pàgina.
   PDF.js 3.x s'allotja localment; els PDF privats no s'envien a servidors.
   Transformacions visuals contínues, sense esperar un nou render en cada gest.
*/
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const nextFrame = () => new Promise(r => requestAnimationFrame(r));
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class ScoreViewer {
  constructor({host, blob, fallbackUrl, initial = {}, onChange = () => {}, onUpdate = () => {},
    onWarning = () => {}, onEdge = () => {}, onToggleControls = () => {}, labels = {}}) {
    this.host = host;
    this.blob = blob;
    this.fallbackUrl = fallbackUrl;
    this.labels = labels;
    this.onChange = onChange;
    this.onUpdate = onUpdate;
    this.onWarning = onWarning;
    this.onEdge = onEdge;
    this.onToggleControls = onToggleControls;
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
    this.pageNumber = next;
    this.panX = 0;
    this.panY = 0;
    this.notify(true);
    await this.loadPage(true);
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