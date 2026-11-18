/* W2.13.3 — Editor de cantonades tàctil per a fotos d'escàner.
 * Ajust lliure, vista prèvia del redreçament i Aplicar/Cancel·lar sense
 * alterar el JPEG original fins al moment de generar el PDF.
 */
import {detectDocument,flattenDocument} from './scanner-detection-w2132.js';
import {cloneCrop,DEFAULT_CROP,FULL_CROP,cropPointsAttr,movedCrop,validCrop} from './scanner-crop-geometry-w2133.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bounded=(n,a,b)=>Math.max(a,Math.min(b,n));
function createJpeg(canvas){
 return new Promise((resolve,reject)=>{
  try{canvas.toBlob(b=>b?.size&&b.type==='image/jpeg'?resolve(b):
   reject(new Error('No s’ha pogut preparar la previsualització.')),'image/jpeg',.84);}
  catch(err){reject(err);}
 });
}
export class ScanCropEditor{
 constructor({onApply=()=>{},onRemove=()=>{},onWarning=()=>{}}={}){
  this.onApply=onApply;this.onRemove=onRemove;this.onWarning=onWarning;
  this.dialog=null;this.photo=null;this.points=null;this.drag=null;
  this.previewUrl=null;this.page=null;this.previewMode=false;
  this.busy=false;this.language='va';this.originalOverflow='';
  this.handleKey=e=>{if(e.key==='Escape'&&this.dialog){e.preventDefault();this.close();}};
  this.handleResize=()=>this.measure();
 }
 tr(va,es){return this.language==='es'?es:va;}
 async open(page,{language='va'}={}){
  if(this.dialog||!page?.file||!page?.url)return false;
  this.page=page;this.language=language;this.points=cloneCrop(page.crop||DEFAULT_CROP);
  this.previewMode=false;this.busy=false;
  const caption=[
   this.tr('Dalt esquerra','Arriba izquierda'),this.tr('Dalt dreta','Arriba derecha'),
   this.tr('Baix dreta','Abajo derecha'),this.tr('Baix esquerra','Abajo izquierda')
  ];
  const overlay=caption.map((label,i)=>
   '<button class="pf-crop-handle" type="button" data-corner="'+i+'"'+
   ' aria-label="'+esc(label)+'" title="'+esc(label)+'">'+(i+1)+'</button>').join('');
  const div=document.createElement('div');div.className='pf-crop-backdrop';
  div.setAttribute('role','dialog');div.setAttribute('aria-modal','true');
  div.setAttribute('aria-label',this.tr('Retallar fulla','Recortar hoja'));
  div.innerHTML=
   '<section class="pf-crop-panel"><div class="pf-crop-header"><div><h2>'+
   this.tr('Retallar i redreçar','Recortar y enderezar')+'</h2><p>'+
   this.tr('Arrossega els quatre punts fins a les cantonades del paper.','Arrastra los cuatro puntos hasta las esquinas del papel.')+
   '</p></div><button class="pf-crop-cancel" data-crop-action="cancel" type="button">'+
   this.tr('Cancel·lar','Cancelar')+'</button></div>'+
   '<div class="pf-crop-scroller"><div class="pf-crop-photo">'+
   '<img class="pf-crop-original" alt="'+this.tr('Fotografia original','Fotografía original')+'" draggable="false">'+
   '<img class="pf-crop-result" alt="'+this.tr('Previsualització corregida','Previsualización corregida')+'" draggable="false" hidden>'+
   '<svg class="pf-crop-polygon" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">'+
   '<polygon points="" /></svg>'+overlay+'</div></div>'+
   '<p class="pf-crop-instruction" role="status">'+
   this.tr('Mou cada cercle per a ajustar les cantonades. Després prem Previsualitzar.','Mueve cada círculo para ajustar las esquinas. Después pulsa Previsualizar.')+
   '</p><div class="pf-crop-actions">'+
   '<button type="button" data-crop-action="detect">'+this.tr('Detectar vores','Detectar bordes')+'</button>'+
   '<button type="button" data-crop-action="reset">'+this.tr('Restablir punts','Restablecer puntos')+'</button>'+
   '<button type="button" data-crop-action="preview">'+this.tr('Previsualitzar','Previsualizar')+'</button>'+
   '<button type="button" data-crop-action="remove">'+this.tr('Sense retall','Sin recorte')+'</button>'+
   '<button type="button" class="pf-crop-apply" data-crop-action="apply">'+this.tr('Aplicar retall','Aplicar recorte')+'</button>'+
   '</div></section>';
  this.dialog=div;document.body.append(div);
  this.originalOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  document.addEventListener('keydown',this.handleKey,true);
  window.addEventListener('resize',this.handleResize);
  const image=div.querySelector('.pf-crop-original');
  image.src=page.url;
  this.photo=div.querySelector('.pf-crop-photo');
  div.addEventListener('pointerdown',e=>this.onPointerDown(e));
  div.addEventListener('pointermove',e=>this.onPointerMove(e));
  div.addEventListener('pointerup',e=>this.onPointerUp(e));
  div.addEventListener('pointercancel',e=>this.onPointerUp(e));
  div.addEventListener('keydown',e=>this.onCornerKey(e));
  div.addEventListener('click',e=>this.onClick(e));
  try{
   if(image.decode)await image.decode();
   else if(!image.complete)await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
   if(!this.dialog)return false;
   if(!image.naturalWidth||!image.naturalHeight)throw new Error('Imatge no compatible.');
   this.sourceWidth=image.naturalWidth;this.sourceHeight=image.naturalHeight;
   this.measure();this.refresh();
   div.querySelector('[data-crop-action="preview"]').focus({preventScroll:true});
   return true;
  }catch(err){this.onWarning(this.tr('No es pot obrir la fotografia: ','No se puede abrir la foto: ')+err.message);this.close();return false;}
 }
 measure(){
  if(!this.dialog||!this.photo||!this.sourceWidth||!this.sourceHeight)return;
  const vw=Math.max(200,window.innerWidth-55);
  const vh=Math.max(180,window.innerHeight*.59);
  const scale=Math.min(vw/this.sourceWidth,vh/this.sourceHeight,3);
  this.photo.style.width=Math.round(this.sourceWidth*scale)+'px';
  this.photo.style.height=Math.round(this.sourceHeight*scale)+'px';
 }
 refresh(){
  if(!this.dialog)return;
  this.dialog.querySelector('.pf-crop-polygon polygon').setAttribute('points',cropPointsAttr(this.points));
  for(const node of this.dialog.querySelectorAll('[data-corner]')){
   const pt=this.points[Number(node.dataset.corner)];
   node.style.left=(100*pt.x)+'%';node.style.top=(100*pt.y)+'%';
  }
  this.dialog.classList.toggle('pf-crop-show-preview',this.previewMode);
  this.dialog.querySelector('[data-crop-action="preview"]').textContent=this.previewMode?
   this.tr('Tornar als punts','Volver a los puntos'):this.tr('Previsualitzar','Previsualizar');
  for(const node of this.dialog.querySelectorAll('[data-crop-action]'))node.disabled=this.busy;
 }
 status(message){
  const status=this.dialog?.querySelector('.pf-crop-instruction');
  if(status)status.textContent=message;
 }
 togglePreview(show){
  if(!this.dialog)return;
  this.previewMode=show;this.refresh();
 }
 onPointerDown(event){
  const button=event.target.closest?.('[data-corner]');
  if(!button||this.busy||this.previewMode)return;
  this.drag={index:Number(button.dataset.corner),id:event.pointerId};
  try{button.setPointerCapture(event.pointerId);}catch{}
  event.preventDefault();
 }
 onPointerMove(event){
  const drag=this.drag;
  if(!drag||drag.id!==event.pointerId||!this.photo||this.busy)return;
  const box=this.photo.getBoundingClientRect();
  const point={x:bounded((event.clientX-box.left)/box.width,0,1),
    y:bounded((event.clientY-box.top)/box.height,0,1)};
  const moved=movedCrop(this.points,drag.index,point);
  if(moved){this.points=moved;this.refresh();}
  event.preventDefault();
 }
 onPointerUp(event){if(this.drag?.id===event.pointerId)this.drag=null;}
 onCornerKey(event){
  const el=event.target.closest?.('[data-corner]');
  if(!el||this.busy||this.previewMode)return;
  const delta=event.shiftKey?.025:.008;
  const vector={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]}[event.key];
  if(!vector)return;
  const index=Number(el.dataset.corner),p=this.points[index];
  const moved=movedCrop(this.points,index,{x:p.x+vector[0],y:p.y+vector[1]});
  if(moved){this.points=moved;this.refresh();}
  event.preventDefault();
 }
 async sourceCanvas(maxEdge=1250){
  const img=this.dialog?.querySelector('.pf-crop-original');
  if(!img?.naturalWidth)throw new Error('Imatge no disponible.');
  const w=img.naturalWidth,h=img.naturalHeight;
  const scale=Math.min(1,maxEdge/Math.max(w,h),Math.sqrt(1600000/(w*h)));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return canvas;
 }
 async makePreview(){
  let source=null,flat=null;
  try{
   source=await this.sourceCanvas(1180);
   flat=flattenDocument(source,this.points,{maxEdge:900});
   return await createJpeg(flat);
  }finally{
   if(source){source.width=0;source.height=0;}
   if(flat){flat.width=0;flat.height=0;}
  }
 }
 async onClick(event){
  const button=event.target.closest?.('[data-crop-action]');
  if(!button||this.busy)return;
  const action=button.dataset.cropAction;
  if(action==='cancel'){this.close();return;}
  if(action==='reset'){
   this.points=cloneCrop(FULL_CROP);this.togglePreview(false);
   this.status(this.tr('Quatre punts als marges de la fotografia.','Cuatro puntos en los bordes de la fotografía.'));
   return;
  }
  if(action==='remove'){
   this.onRemove(this.page.id);this.close();return;
  }
  if(action==='detect'){
   this.busy=true;this.refresh();
   let source=null;
   try{
    source=await this.sourceCanvas(330);
    const ctx=source.getContext('2d',{willReadFrequently:true});
    const found=detectDocument(ctx.getImageData(0,0,source.width,source.height));
    if(found&&validCrop(found.points)){
     this.points=cloneCrop(found.points);this.togglePreview(false);
     this.status(this.tr('Vores proposades. Pots ajustar-les amb els punts.','Bordes propuestos. Puedes ajustarlos con los puntos.'));
    }else this.status(this.tr('No s’han detectat vores fiables. Ajusta els punts manualment.','No se han detectado bordes fiables. Ajusta los puntos manualmente.'));
   }catch(err){this.onWarning(err.message);}
   finally{if(source){source.width=0;source.height=0;}this.busy=false;this.refresh();}
   return;
  }
  if(action==='preview'&&this.previewMode){this.togglePreview(false);return;}
  if(action!=='preview'&&action!=='apply')return;
  if(!validCrop(this.points)){this.status(this.tr('Ajusta quatre cantonades vàlides.','Ajusta cuatro esquinas válidas.'));return;}
  this.busy=true;this.refresh();
  try{
   const blob=await this.makePreview();
   if(!this.dialog)return;
   if(action==='preview'){
    if(this.previewUrl)URL.revokeObjectURL(this.previewUrl);
    this.previewUrl=URL.createObjectURL(blob);
    this.dialog.querySelector('.pf-crop-result').src=this.previewUrl;
    this.togglePreview(true);
    this.status(this.tr('Previsualització del full redreçat. Prem Aplicar si és correcta.',
     'Previsualización de la hoja enderezada. Pulsa Aplicar si es correcta.'));
   }else{
    await this.onApply(this.page.id,cloneCrop(this.points),blob);
    this.close();return;
   }
  }catch(err){
   this.status(this.tr('No s’ha pogut retallar la foto.','No se ha podido recortar la foto.'));
   this.onWarning((this.language==='es'?'Error al recortar: ':'Error en retallar: ')+(err.message||String(err)));
  }finally{
   this.busy=false;this.refresh();
  }
 }
 close(){
  if(!this.dialog)return;
  const el=this.dialog;this.dialog=null;
  this.drag=null;
  if(this.previewUrl)URL.revokeObjectURL(this.previewUrl);
  this.previewUrl=null;
  el.remove();
  document.body.style.overflow=this.originalOverflow;
  document.removeEventListener('keydown',this.handleKey,true);
  window.removeEventListener('resize',this.handleResize);
  this.photo=null;this.page=null;this.sourceWidth=0;this.sourceHeight=0;
 }
}
