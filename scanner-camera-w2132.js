/* W2.13.2 — Càmera contínua amb detecció, captura automàtica i alternativa manual.
 * No s'executa ni se sol·licita permís fins que l'usuari prem Escanejar.
 * El vídeo i les fotos es processen en local i no s'envien enlloc.
 */
import {detectDocument,stableDocument,flattenDocument} from './scanner-detection-w2132.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toJpeg(canvas){
 return new Promise((resolve,reject)=>{
  try{canvas.toBlob(blob=>blob?.type==='image/jpeg'?resolve(blob):
    reject(new Error('No s’ha pogut crear una foto JPEG.')),'image/jpeg',.89);}
  catch(e){reject(e);}
 });
}
export class DocumentCamera{
 constructor({onCapture=()=>{},onWarning=()=>{},onClose=()=>{}}={}){
  this.onCapture=onCapture;this.onWarning=onWarning;this.onClose=onClose;
  this.stream=null;this.video=null;this.dialog=null;this.frame=0;
  this.generation=0;this.auto=true;this.armed=true;this.processing=false;
  this.history=[];this.current=null;this.missing=0;this.lastAnalysis=0;
  this.count=0;this.language='va';this.active=false;
  this.handleKey=e=>{if(e.key==='Escape'&&this.active){e.preventDefault();this.close();}};
  this.handleVisibility=()=>{if(document.hidden&&this.active)this.close();};
  this.handlePageHide=()=>{if(this.active)this.close();};
 }
 get tr(){return (va,es)=>this.language==='es'?es:va;}
 get labels(){
  const t=this.tr;
  return {
   title:t('Escàner automàtic','Escáner automático'),
   hint:t('Enquadra una fulla sobre un fons contrastat. Es capturarà quan la imatge estiga estable.','Encuadra una hoja sobre un fondo contrastado. Se capturará cuando la imagen esté estable.'),
   searching:t('Buscant les vores de la fulla…','Buscando los bordes de la hoja…'),
   stable:t('Fulla detectada · mantín el mòbil quiet','Hoja detectada · mantén el móvil quieto'),
   saved:t('Pàgina afegida! Retira la fulla per a la següent.','¡Página añadida! Retira la hoja para la siguiente.'),
   saving:t('Retallant i corregint perspectiva…','Recortando y corrigiendo perspectiva…'),
   manual:t('Capturar ara','Capturar ahora'),
   next:t('Preparar següent fulla','Preparar siguiente hoja'),
   auto:t('Captura automàtica','Captura automática'),
   close:t('Acabar','Terminar'),
   count:t('Pàgines capturades','Páginas capturadas'),
  };
 }
 createDialog(){
  const l=this.labels;
  const dialog=document.createElement('section');
  dialog.className='pf-document-camera';dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',l.title);
  dialog.innerHTML=
   '<div class="pf-camera-shell"><div class="pf-camera-top"><div><h2>'+esc(l.title)+'</h2><p>'+esc(l.hint)+'</p></div>'+
    '<button type="button" class="pf-camera-close" data-camera-action="close">'+esc(l.close)+'</button></div>'+
   '<div class="pf-camera-stage"><video autoplay playsinline muted></video>'+
    '<svg class="pf-camera-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+
    '<polygon class="pf-camera-outline" points="" fill="rgba(37,112,68,.08)" stroke="#6bea9b" stroke-width="1.25" vector-effect="non-scaling-stroke"/>'+
    '</svg><span class="pf-camera-target" aria-hidden="true"></span></div>'+
   '<p class="pf-camera-status" role="status">'+esc(l.searching)+'</p>'+
   '<div class="pf-camera-controls"><label class="pf-camera-auto"><input type="checkbox" id="pf-camera-auto" checked>'+
    esc(l.auto)+'</label><button type="button" class="pf-camera-next" data-camera-action="next">'+esc(l.next)+'</button>'+
    '<button type="button" class="pf-camera-shoot" data-camera-action="shoot">'+esc(l.manual)+'</button></div>'+
   '<p class="pf-camera-counter">'+esc(l.count)+': <strong id="pf-camera-count">0</strong> / 30</p></div>';
  dialog.addEventListener('click',e=>{
   const button=e.target.closest('[data-camera-action]');
   if(!button)return;
   if(button.dataset.cameraAction==='close')this.close();
   if(button.dataset.cameraAction==='next'){
    this.armed=true;this.history=[];this.missing=0;this.setStatus(this.labels.searching);
   }
   if(button.dataset.cameraAction==='shoot')this.capture(false);
  });
  dialog.addEventListener('change',e=>{
   if(e.target.id==='pf-camera-auto'){this.auto=e.target.checked;this.history=[];this.armed=true;}
  });
  document.body.append(dialog);this.dialog=dialog;
  this.video=dialog.querySelector('video');
  return dialog;
 }
 setStatus(message){
  const node=this.dialog?.querySelector('.pf-camera-status');
  if(node&&node.textContent!==message)node.textContent=message;
 }
 setOutline(result,w,h){
  const svg=this.dialog?.querySelector('svg.pf-camera-guides');
  const polygon=svg?.querySelector('polygon');
  if(!svg||!polygon)return;
  svg.setAttribute('viewBox','0 0 '+w+' '+h);
  polygon.setAttribute('points',result?.points.map(p=>(p.x*w).toFixed(1)+','+(p.y*h).toFixed(1)).join(' ')||'');
  this.dialog.classList.toggle('pf-camera-detected',!!result);
 }
 async open({language='va',existing=0}={}){
  if(this.active)return true;
  if(!navigator.mediaDevices?.getUserMedia){
   this.onWarning(language==='es'?'Este navegador no admite cámara en directo. Utiliza «Foto del sistema» o la galería.':
    'Este navegador no admet càmera en directe. Utilitza «Foto del sistema» o la galeria.');
   return false;
  }
  this.language=language;this.count=existing;this.auto=true;this.armed=true;
  this.history=[];this.processing=false;this.current=null;this.missing=0;this.lastAnalysis=0;
  this.active=true;const token=++this.generation;
  this.createDialog();
  document.addEventListener('keydown',this.handleKey,true);
  document.addEventListener('visibilitychange',this.handleVisibility);
  window.addEventListener('pagehide',this.handlePageHide);
  const counter=this.dialog.querySelector('#pf-camera-count');
  counter.textContent=String(existing);
  this.dialog.querySelector('.pf-camera-shoot').disabled=existing>=30;
  this.dialog.querySelector('.pf-camera-next').disabled=existing>=30;
  this.dialog.querySelector('#pf-camera-auto').disabled=existing>=30;
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{
    facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}
   }});
   if(!this.active||token!==this.generation){
    stream.getTracks().forEach(track=>track.stop());return false;
   }
   this.stream=stream;
   this.video.srcObject=stream;
   await this.video.play();
   if(!this.active||token!==this.generation)return false;
   this.dialog.querySelector('.pf-camera-shoot').focus({preventScroll:true});
   this.frame=requestAnimationFrame(this.tick);
   return true;
  }catch(error){
   if(token!==this.generation)return false;
   const detail=error?.name==='NotAllowedError'?
    this.tr('Permís de càmera denegat. Usa «Foto del sistema» o Afegir fotos.',
            'Permiso de cámara denegado. Usa «Foto del sistema» o Añadir fotos.'):
    this.tr('No es pot obrir la càmera. Usa «Foto del sistema» o Afegir fotos.',
            'No se puede abrir la cámara. Usa «Foto del sistema» o Añadir fotos.');
   this.onWarning(detail);
   this.close();return false;
  }
 }
 tick=(now)=>{
  this.frame=0;
  if(!this.active||!this.video)return;
  if(!this.processing&&this.video.readyState>=2&&now-this.lastAnalysis>=240){
   this.lastAnalysis=now;
   try{
    const video=this.video,w=video.videoWidth,h=video.videoHeight;
    if(w&&h){
     const scale=Math.min(1,260/Math.max(w,h));
     const cw=Math.max(40,Math.round(w*scale)),ch=Math.max(40,Math.round(h*scale));
     if(!this.preview){this.preview=document.createElement('canvas');}
     const canvas=this.preview;canvas.width=cw;canvas.height=ch;
     const ctx=canvas.getContext('2d',{willReadFrequently:true});
     ctx.drawImage(video,0,0,cw,ch);
     const result=detectDocument(ctx.getImageData(0,0,cw,ch));
     this.current=result;this.setOutline(result,cw,ch);
     this.history.push(result);if(this.history.length>5)this.history.shift();
     if(!result){
      this.missing++;
      if(this.missing>=3&&this.count<30)this.armed=true;
      if(this.count>=30)this.setStatus(this.tr('S’ha arribat al límit de 30 pàgines.','Se ha llegado al límite de 30 páginas.'));
      else if(this.armed)this.setStatus(this.labels.searching);
     }else{
      this.missing=0;
      const stable=stableDocument(this.history,{required:4});
      if(this.count>=30)this.setStatus(this.tr('S’ha arribat al límit de 30 pàgines.','Se ha llegado al límite de 30 páginas.'));
      else if(!this.armed)this.setStatus(this.labels.saved);
      else if(stable){
       this.setStatus(this.labels.stable);
       if(this.auto)this.capture(true,stable);
      }else this.setStatus(this.labels.stable);
     }
    }
   }catch(error){
    // Error ocasional del vídeo: mantindre la captura manual disponible.
    this.current=null;this.history=[];this.setOutline(null,100,100);
   }
  }
  if(this.active)this.frame=requestAnimationFrame(this.tick);
 };
 async capture(automatic=false,detected=this.current){
  if(!this.active||this.processing||this.count>=30||!this.video||this.video.readyState<2)return false;
  if(automatic&&!this.armed)return false;
  this.processing=true;this.armed=false;this.history=[];this.setStatus(this.labels.saving);
  const token=this.generation;
  const shoot=this.dialog?.querySelector('.pf-camera-shoot');
  if(shoot)shoot.disabled=true;
  let frame=null,corrected=null;
  try{
   const w=this.video.videoWidth,h=this.video.videoHeight;
   const scale=Math.min(1,2200/Math.max(w,h),Math.sqrt(3500000/(w*h)));
   frame=document.createElement('canvas');frame.width=Math.round(w*scale);frame.height=Math.round(h*scale);
   const ctx=frame.getContext('2d',{willReadFrequently:true});
   if(!ctx)throw new Error('Canvas 2D no disponible');
   ctx.drawImage(this.video,0,0,frame.width,frame.height);
   // Si el contorn és insuficient, la captura manual conserva tota la foto.
   corrected=detected?.confidence>=.55?flattenDocument(frame,detected.points):frame;
   const blob=await toJpeg(corrected);
   if(!this.active||token!==this.generation)return false;
   const filename='Fulla_'+String(this.count+1).padStart(2,'0')+'.jpg';
   const file=new File([blob],filename,{type:'image/jpeg'});
   const result=await this.onCapture(file);
   if(!this.active||token!==this.generation)return false;
   if(result===false)throw new Error('No es pot incorporar esta pàgina.');
   this.count++;this.dialog.querySelector('#pf-camera-count').textContent=String(this.count);
   if(this.count>=30){
    this.dialog.querySelector('#pf-camera-auto').disabled=true;
    this.dialog.querySelector('.pf-camera-next').disabled=true;
   }
   this.setStatus(this.count>=30?
    this.tr('Ja tens 30 pàgines. Prem Acabar.','Ya tienes 30 páginas. Pulsa Terminar.'):
    this.labels.saved);
   return true;
  }catch(error){
   this.armed=true;this.onWarning(this.tr('No s’ha pogut capturar la fulla: ','No se ha podido capturar la hoja: ')+(error.message||String(error)));
   return false;
  }finally{
   // Alliberem la memòria de les dos superfícies grans.
   if(corrected&&corrected!==frame){corrected.width=0;corrected.height=0;}
   if(frame){frame.width=0;frame.height=0;}
   this.processing=false;
   if(this.active&&shoot)shoot.disabled=this.count>=30;
  }
 }
 close(){
  if(!this.active)return;
  this.active=false;this.generation++;
  if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;
  const video=this.video;this.video=null;
  if(video){try{video.pause();video.srcObject=null;}catch{}}
  const stream=this.stream;this.stream=null;
  for(const track of stream?.getTracks()||[])try{track.stop();}catch{}
  if(this.dialog){this.dialog.remove();this.dialog=null;}
  if(this.preview){this.preview.width=0;this.preview.height=0;this.preview=null;}
  document.removeEventListener('keydown',this.handleKey,true);
  document.removeEventListener('visibilitychange',this.handleVisibility);
  window.removeEventListener('pagehide',this.handlePageHide);
  this.processing=false;this.current=null;this.history=[];
  this.onClose();
 }
}
