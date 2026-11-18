/* W2.18 — Editor gràfic dels ajustos individuals de pàgina, sense PDF nou. */
import {DEFAULT_PAGE_ADJUSTMENT,normalizePageAdjustment,
 displayedCropMargins,originalCropMargins} from './page-adjustments-w218.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class PageRepairDialog {
 constructor({viewer,language='va',onClose=()=>{},onApplied=()=>{}}){
  this.viewer=viewer;this.language=language;this.onClose=onClose;this.onApplied=onApplied;
  this.draft=viewer.pageAdjustment();this.root=null;this.task=null;this.drag=null;this.busy=false;
  this.keyDown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.close();}};
 }
 tr(va,es){return this.language==='es'?es:va;}
 rotation(){
  const v=this.viewer;
  return (v.rotation+90*(this.draft.rotationQuarterTurns-v.pageAdjustment().rotationQuarterTurns)+720)%360;
 }
 edge(key,label){
  const m=displayedCropMargins(this.draft,this.rotation());
  return '<label class="pf-repair-range"><span>'+label+
   ' <output data-output-edge="'+key+'">'+Math.round(m[key]*100)+'%</output></span>'+
   '<input data-repair-edge="'+key+'" type="range" min="0" max="35" step="1" value="'+
   Math.round(m[key]*100)+'" aria-label="'+label+'"></label>';
 }
 markup(){
  const t=(va,es)=>this.tr(va,es),a=this.draft;
  return '<section class="pf-repair-dialog" role="dialog" aria-modal="true" aria-label="'+t('Ajustar pàgina','Ajustar página')+'">'+
   '<header class="pf-repair-header"><div><h2>'+t('Ajustar pàgina','Ajustar página')+'</h2><small>'+
   t('Pàgina ','Página ')+this.viewer.pageNumber+' / '+this.viewer.numPages+
   '</small></div><button type="button" data-repair-action="cancel" class="pf-repair-close" aria-label="'+t('Tancar','Cerrar')+'">×</button></header>'+
   '<p class="pf-repair-help">'+t('Els canvis són visuals; el PDF i les anotacions no es modifiquen.','Los cambios son visuales; el PDF y las anotaciones no se modifican.')+'</p>'+
   '<div class="pf-repair-rotation"><strong>'+t('Rotació','Rotación')+'</strong>'+
   '<button type="button" data-repair-action="left">↶ −90°</button>'+
   '<button type="button" data-repair-action="right">+90° ↷</button>'+
   '<output data-repair-angle>'+a.rotationQuarterTurns*90+'°</output></div>'+
   '<div class="pf-repair-preview"><div class="pf-repair-image" data-repair-image>'+
   '<canvas data-repair-canvas></canvas>'+
   '<div class="pf-repair-crop" data-repair-handle="move">'+
   ['tl','tr','bl','br','l','r','t','b'].map(h=>
    '<span class="pf-repair-handle pf-repair-'+h+'" data-repair-handle="'+h+'" aria-hidden="true"></span>').join('')+
   '</div></div></div>'+
   '<p class="pf-repair-help">'+t('Arrossega les vores i cantonades del retall o usa els controls.','Arrastra los bordes y esquinas del recorte o usa los controles.')+'</p>'+
   '<div class="pf-repair-ranges">'+
   this.edge('left',t('Esquerra','Izquierda'))+this.edge('top',t('Dalt','Arriba'))+
   this.edge('right',t('Dreta','Derecha'))+this.edge('bottom',t('Baix','Abajo'))+
   '</div><label class="pf-repair-contrast"><span><strong>'+t('Contrast','Contraste')+
   '</strong><output data-repair-contrast-output>'+Math.round(a.contrast*100)+'%</output></span>'+
   '<input type="range" data-repair-contrast min="70" max="160" step="5" value="'+Math.round(a.contrast*100)+'"></label>'+
   '<div class="pf-repair-actions">'+
   '<button type="button" class="secondary" data-repair-action="reset">'+t('Restablir retall i contrast','Restablecer recorte y contraste')+'</button>'+
   '<button type="button" class="secondary" data-repair-action="cancel">'+t('Cancel·lar','Cancelar')+'</button>'+
   '<button type="button" class="primary" data-repair-action="page">'+t('Aplicar a la pàgina','Aplicar a la página')+'</button>'+
   '<button type="button" class="primary pf-repair-all" data-repair-action="all">'+t('Aplicar a tot el PDF','Aplicar a todo el PDF')+'</button></div>'+
   '</section>';
 }
 open(){
  if(this.root||this.viewer.closed||!this.viewer.page||this.viewer.annotationMode)return false;
  const root=document.createElement('div');root.className='pf-repair-backdrop';
  root.innerHTML=this.markup();
  root.addEventListener('click',e=>{
   e.stopPropagation();
   const button=e.target.closest('[data-repair-action]');
   if(button){this.action(button.dataset.repairAction);return;}
   if(e.target===root)this.close();
  });
  root.addEventListener('input',e=>this.onInput(e));
  root.addEventListener('pointerdown',e=>this.pointerDown(e));
  root.addEventListener('pointermove',e=>this.pointerMove(e));
  root.addEventListener('pointerup',e=>this.pointerUp(e));
  root.addEventListener('pointercancel',e=>this.pointerUp(e));
  for(const name of ['pointerdown','pointermove','pointerup','wheel'])
   root.addEventListener(name,e=>e.stopPropagation());
  this.root=root;document.body.append(root);
  document.addEventListener('keydown',this.keyDown,true);
  root.querySelector('.pf-repair-close')?.focus({preventScroll:true});
  this.paint();
  return true;
 }
 close(){
  if(!this.root)return;
  this.task?.cancel();this.task=null;this.drag=null;
  document.removeEventListener('keydown',this.keyDown,true);
  this.root.remove();this.root=null;this.onClose();
 }
 update(){
  if(!this.root)return;
  const m=displayedCropMargins(this.draft,this.rotation());
  const crop=this.root.querySelector('.pf-repair-crop');
  if(crop){
   crop.style.left=m.left*100+'%';crop.style.top=m.top*100+'%';
   crop.style.width=(1-m.left-m.right)*100+'%';
   crop.style.height=(1-m.top-m.bottom)*100+'%';
  }
  for(const edge of ['left','top','right','bottom']){
   const range=this.root.querySelector('[data-repair-edge="'+edge+'"]');
   const output=this.root.querySelector('[data-output-edge="'+edge+'"]');
   if(range)range.value=String(Math.round(m[edge]*100));
   if(output)output.textContent=Math.round(m[edge]*100)+'%';
  }
  const contrast=this.root.querySelector('[data-repair-contrast]');
  const output=this.root.querySelector('[data-repair-contrast-output]');
  if(contrast)contrast.value=String(Math.round(this.draft.contrast*100));
  if(output)output.textContent=Math.round(this.draft.contrast*100)+'%';
  const c=this.root.querySelector('[data-repair-canvas]');
  if(c)c.style.filter='contrast('+this.draft.contrast+')';
  const angle=this.root.querySelector('[data-repair-angle]');
  if(angle)angle.textContent=this.draft.rotationQuarterTurns*90+'°';
 }
 async paint(){
  if(!this.root||!this.viewer.page)return;
  this.task?.cancel();
  const canvas=this.root.querySelector('[data-repair-canvas]');
  const image=this.root.querySelector('[data-repair-image]');
  if(!canvas||!image)return;
  const viewport=this.viewer.page.getViewport({rotation:this.rotation(),scale:1});
  const maxW=Math.min(490,Math.max(180,window.innerWidth-75));
  const maxH=Math.min(310,Math.max(110,window.innerHeight*.37));
  const scale=Math.min(maxW/viewport.width,maxH/viewport.height,1.8);
  const fit=this.viewer.page.getViewport({rotation:this.rotation(),scale});
  canvas.width=Math.max(1,Math.floor(fit.width));canvas.height=Math.max(1,Math.floor(fit.height));
  canvas.style.width=canvas.width+'px';canvas.style.height=canvas.height+'px';
  image.style.width=canvas.width+'px';image.style.height=canvas.height+'px';
  this.update();
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)return;
  const task=this.viewer.page.render({canvasContext:ctx,viewport:fit});
  this.task=task;
  try{await task.promise;}catch(error){
   if(error?.name!=='RenderingCancelledException')console.warn('Vista prèvia d’ajust:',error);
  }
  if(this.task===task)this.task=null;
 }
 onInput(e){
  if(!this.root||this.busy)return;
  if(e.target?.hasAttribute('data-repair-contrast')){
   this.draft=normalizePageAdjustment({...this.draft,contrast:Number(e.target.value)/100});
   this.update();return;
  }
  const edge=e.target?.dataset?.repairEdge;
  if(!edge)return;
  const m=displayedCropMargins(this.draft,this.rotation());
  m[edge]=clamp(Number(e.target.value)/100,0,.35);
  this.draft=normalizePageAdjustment({...this.draft,...originalCropMargins(m,this.rotation())});
  this.update();
 }
 pointerDown(e){
  const handle=e.target.closest?.('[data-repair-handle]');
  if(!handle||!this.root||this.busy)return;
  const img=this.root.querySelector('[data-repair-image]');if(!img)return;
  const rect=img.getBoundingClientRect();
  this.drag={id:e.pointerId,kind:handle.dataset.repairHandle,
   x:e.clientX,y:e.clientY,w:Math.max(1,rect.width),h:Math.max(1,rect.height),
   margins:displayedCropMargins(this.draft,this.rotation()),rotation:this.rotation()};
  try{handle.setPointerCapture(e.pointerId);}catch{}
  e.preventDefault();
 }
 pointerMove(e){
  const d=this.drag;if(!d||d.id!==e.pointerId||!this.root)return;
  const m={...d.margins},dx=(e.clientX-d.x)/d.w,dy=(e.clientY-d.y)/d.h;
  const limit=n=>clamp(n,0,.35);
  if(d.kind==='move'){
   // Traslladar el rectangle sense reduir-ne l'amplària útil.
   const minDx=Math.max(-m.left,m.right-.35);
   const maxDx=Math.min(.35-m.left,m.right);
   const minDy=Math.max(-m.top,m.bottom-.35);
   const maxDy=Math.min(.35-m.top,m.bottom);
   const sx=clamp(dx,minDx,maxDx),sy=clamp(dy,minDy,maxDy);
   m.left=limit(m.left+sx);m.right=limit(m.right-sx);
   m.top=limit(m.top+sy);m.bottom=limit(m.bottom-sy);
  }else{
   if(d.kind.includes('l'))m.left=limit(m.left+dx);
   if(d.kind.includes('r'))m.right=limit(m.right-dx);
   if(d.kind.includes('t'))m.top=limit(m.top+dy);
   if(d.kind.includes('b'))m.bottom=limit(m.bottom-dy);
  }
  this.draft=normalizePageAdjustment({...this.draft,...originalCropMargins(m,d.rotation)});
  this.update();e.preventDefault();
 }
 pointerUp(e){if(this.drag?.id===e.pointerId)this.drag=null;}
 async action(name){
  if(!this.root||this.busy)return;
  if(name==='cancel'){this.close();return;}
  if(name==='left'||name==='right'){
   this.draft=normalizePageAdjustment({...this.draft,
    rotationQuarterTurns:this.draft.rotationQuarterTurns+(name==='left'?-1:1)});
   await this.paint();return;
  }
  if(name==='reset'){
   this.draft=normalizePageAdjustment({...DEFAULT_PAGE_ADJUSTMENT,
    rotationQuarterTurns:this.draft.rotationQuarterTurns});
   this.update();return;
  }
  if(name!=='page'&&name!=='all')return;
  this.busy=true;
  try{
   const ok=await this.viewer.setPageAdjustment(this.draft,name==='all');
   if(ok){this.close();this.onApplied(name==='all');}
  }finally{this.busy=false;}
 }
}
