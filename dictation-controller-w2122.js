/* W2.12.1 — Micròfon i transcripció local d'altures musicals.
 * Compartim l'algorisme YIN i el Worker de l'afinador; mai reproduïm ni enviem l'àudio.
 * El control temporal replica DictationMarinaPanel.kt d'Android 1.11.15.
 */
import {detectPitchYin,toPitchReading,medianPitch,normalizeReference} from './tuner-w210.js';
import {DictationCapture,DICTATION_DEFAULT_INSTRUMENT,getDictationInstrument,midiLabel,writtenMidi} from './dictation-model-w2121.js';
import {renderDictationMarkup,dictationStaffSVG} from './dictation-ui-w2122.js';
import {createDictationPngFiles,downloadDictationImages,shareDictationImages,dictationPageCount} from './dictation-export-w2122.js';
export class DictationController{
 constructor({onUpdate=()=>{},onWarning=()=>{},onFeedback=()=>{},onInstrumentSave=()=>{}}={}){
  this.mode='musical';this.instrument=DICTATION_DEFAULT_INSTRUMENT;
  this.capture=new DictationCapture({mode:this.mode,instrument:this.instrument});
  this.reference=442;this.notes=[];this.reading=null;this.recent=[];
  this.running=false;this.pending=false;this.generation=0;this.busy=false;
  this.stream=null;this.audio=null;this.source=null;this.analyser=null;this.worker=null;this.frame=0;this.lastAnalysis=0;
  this.exporting=false;this.exportProgress=0;
  this.language='va';this.onUpdate=onUpdate;this.onWarning=onWarning;this.onFeedback=onFeedback;this.onInstrumentSave=onInstrumentSave;
 }
 get perRow(){
  if(typeof window==='undefined')return 10;
  return window.innerWidth<=600?6:window.innerWidth<=1060?8:10;
 }
 markup(language='va'){
  this.language=language;
  return renderDictationMarkup({mode:this.mode,instrumentId:this.instrument,running:this.running,pending:this.pending,
   notes:this.notes,reading:this.reading,reference:this.reference,language,perRow:this.perRow,
   exporting:this.exporting,exportProgress:this.exportProgress});
 }
 setReference(value){this.reference=normalizeReference(value);}
 setInstrument(id,{clear=true,save=true,notify=true}={}){
  if(this.exporting)return false;
  const next=getDictationInstrument(id).id;
  if(next===this.instrument)return false;
  this.stop({notify:false});
  this.instrument=next;
  this.capture.instrument=next;this.capture.reset();
  if(clear)this.notes=[];
  this.reading=null;
  if(save)this.onInstrumentSave(next);
  if(notify)this.onUpdate();
  return true;
 }
 setMode(mode){
  if(this.exporting)return false;
  if(mode!=='musical'&&mode!=='marina'||mode===this.mode)return false;
  this.stop({notify:false});
  this.mode=mode;this.notes=[];this.reading=null;
  this.capture.mode=mode;this.capture.reset();
  this.onUpdate();return true;
 }
 clear(){
  if(this.exporting)return false;
  if(this.running||this.pending)return false;
  this.notes=[];this.reading=null;this.capture.reset();
  this.onUpdate();return true;
 }
 async start(){
  if(this.exporting)return false;
  if(this.running||this.pending)return false;
  this.stop({notify:false});
  const token=++this.generation;
  this.pending=true;this.capture.reset();this.recent=[];this.reading=null;
  this.onUpdate();
  let stream=null,context=null;
  try{
   if(!navigator.mediaDevices?.getUserMedia)
    throw new Error(this.language==='es'?'El navegador no tiene acceso al micrófono. Abre la web con HTTPS.':'El navegador no té accés al micròfon. Obri la web amb HTTPS.');
   stream=await navigator.mediaDevices.getUserMedia({audio:{
    echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1
   },video:false});
   if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}
   const Ctor=globalThis.AudioContext||globalThis.webkitAudioContext;
   if(!Ctor)throw new Error('Este navegador no admet Web Audio.');
   context=new Ctor();
   if(context.state!=='running')await context.resume();
   if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());context.close().catch(()=>{});return false;}
   const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();
   analyser.fftSize=4096;analyser.smoothingTimeConstant=0;
   source.connect(analyser); // Prohibit connectar l'entrada a destination: sense acoblament.
   this.stream=stream;this.audio=context;this.source=source;this.analyser=analyser;
   this.worker=this.createWorker(token);
   stream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{
    if(token===this.generation){
     this.stop();this.onWarning(this.language==='es'?'Se ha desconectado el micrófono.':'S’ha desconnectat el micròfon.');
    }
   },{once:true}));
   this.pending=false;this.running=true;this.lastAnalysis=0;this.busy=false;
   this.onUpdate();
   this.frame=requestAnimationFrame(this.tick);
   return true;
  }catch(err){
   if(token!==this.generation)return false;
   if(stream&&!this.stream)stream.getTracks().forEach(t=>t.stop());
   if(context&&!this.audio)try{await context.close();}catch{}
   const msg=err?.name==='NotAllowedError'||err?.name==='PermissionDeniedError'?
    (this.language==='es'?'Permiso de micrófono denegado.':'Permís del micròfon denegat.'):
    err?.name==='NotFoundError'?(this.language==='es'?'No se ha encontrado ningún micrófono.':'No s’ha trobat cap micròfon.'):
    err?.message||String(err);
   this.stop();this.onWarning(msg);return false;
  }
 }
 createWorker(token){
  if(typeof Worker==='undefined')return null;
  try{
   const worker=new Worker(new URL('./tuner-worker-w210.js',import.meta.url),{type:'module'});
   worker.onmessage=e=>{
    if(token!==this.generation)return;
    this.busy=false;
    this.handleDetection(e.data?.result||null);
   };
   worker.onerror=()=>{
    if(token!==this.generation)return;
    worker.terminate();if(this.worker===worker)this.worker=null;
    this.busy=false;
   };
   return worker;
  }catch{return null;}
 }
 tick=(now)=>{
  this.frame=0;
  if(!this.running||document.hidden||!this.analyser)return;
  if(now-this.lastAnalysis>=85&&!this.busy){
   this.lastAnalysis=now;this.busy=true;
   const samples=new Float32Array(4096);
   try{
    this.analyser.getFloatTimeDomainData(samples);
    const token=this.generation,sampleRate=this.audio.sampleRate;
    if(this.worker)this.worker.postMessage({generation:token,samples,sampleRate},[samples.buffer]);
    else setTimeout(()=>{
     if(token!==this.generation)return;
     let result=null;try{result=detectPitchYin(samples,sampleRate);}catch{}
     this.busy=false;this.handleDetection(result);
    },0);
   }catch{this.busy=false;this.handleDetection(null);}
  }
  this.frame=requestAnimationFrame(this.tick);
 };
 handleDetection(result){
  if(!this.running)return;
  const now=performance.now();
  if(result&&Number.isFinite(result.frequency)){
   this.recent.push(result.frequency);if(this.recent.length>3)this.recent.shift();
   const frequency=medianPitch(this.recent);
   const reading=toPitchReading(frequency,this.reference,result.confidence);
   this.reading=reading?{...reading,label:midiLabel(writtenMidi(reading.midi,this.instrument,this.mode==='marina'))}:null;
  }else{
   this.reading=null;this.recent.length=0;
  }
  const accepted=this.capture.step(this.reading?.midi??null,now);
  if(accepted)this.notes.push(accepted);
  this.updateDom(!!accepted);
 }
 updateDom(notesChanged=false){
  const status=document.getElementById('dictation-status'),label=document.getElementById('dictation-current');
  if(label)label.textContent=this.reading?.label||'—';
  if(status){
   const va=this.language!=='es';
   status.textContent=this.running?(this.mode==='marina'?
    (va?'Escoltant… parla, canta o improvisa.':'Escuchando… habla, canta o improvisa.'):
    (va?'Escoltant… toca notes clares i sostingudes.':'Escuchando… toca notas claras y sostenidas.')):
    this.notes.length+' '+(va?(this.notes.length===1?'nota':'notes'):(this.notes.length===1?'nota':'notas'));
  }
  if(!notesChanged)return;
  const container=document.getElementById('dictation-staff');
  if(container){
   const clef=this.mode==='marina'?'treble':getDictationInstrument(this.instrument).clef;
   // No es força cap scroll quan s'afigen notes: la tauleta conserva la posició.
   container.innerHTML=dictationStaffSVG(this.notes,{clef,perRow:this.perRow,language:this.language});
  }
  const clear=document.querySelector('[data-action="dictation-clear"]');
  if(clear)clear.disabled=this.running||!this.notes.length;
  if(this.mode!=='marina'&&this.notes.length===1){
   // L'avís de neteja en canviar l'instrument apareix quan ja hi ha notes.
   const select=document.getElementById('dictation-instrument');
   if(select&&!document.getElementById('dictation-change-warning')){
    const info=document.createElement('p');
    info.id='dictation-change-warning';info.className='pf-dictation-hint pf-dictation-warning';
    info.textContent=this.language==='es'?'Cambiar de instrumento borra el dictado actual.':'Canviar d’instrument neteja el dictat actual.';
    select.insertAdjacentElement('afterend',info);
   }
  }
 }
 stop({notify=true}={}){
  this.generation++;
  if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;}
  this.running=false;this.pending=false;this.busy=false;
  this.reading=null;this.recent=[];this.capture.reset();
  this.worker?.terminate();this.worker=null;
  try{this.source?.disconnect();}catch{}this.source=null;this.analyser=null;
  const tracks=this.stream?.getTracks()||[];this.stream=null;
  tracks.forEach(t=>{try{t.stop();}catch{}});
  const context=this.audio;this.audio=null;
  if(context)try{context.close()?.catch?.(()=>{});}catch{}
  if(notify)this.onUpdate();
 }
 updateExportDom(){
  const controls=document.querySelectorAll('[data-action="dictation-save-image"],[data-action="dictation-share"]');
  controls.forEach(button=>button.disabled=this.exporting);
  const status=document.getElementById('dictation-export-status');
  if(status){
   const count=dictationPageCount(this.notes.length),va=this.language!=='es';
   status.textContent=this.exporting?
    (va?'Preparant imatges… ':'Preparando imágenes… ')+
     (this.exportProgress?this.exportProgress+'/'+count:''):
    count>1?
     (va?'El dictat es dividirà en ':'El dictado se dividirá en ')+count+
      (va?' imatges PNG (60 notes com a màxim per imatge). En guardar-les es descarregarà un ZIP.':
          ' imágenes PNG (60 notas como máximo por imagen). Al guardarlas se descargará un ZIP.'):
     (va?'Es guardarà una imatge PNG de la partitura.':'Se guardará una imagen PNG de la partitura.');
  }
 }
 async exportImages(action){
  if(this.exporting||this.running||this.pending||!this.notes.length)return false;
  const mode=this.mode,instrument=this.instrument,language=this.language;
  // Fixa una còpia: ni el worker ni la vista podran modificar les imatges a mitja exportació.
  const snapshot=this.notes.map(({midi,label})=>({midi,label}));
  this.exporting=true;this.exportProgress=0;
  this.updateExportDom();
  try{
   const files=await createDictationPngFiles(snapshot,{
    mode,instrument,language,onProgress:(done)=>{this.exportProgress=done;this.updateExportDom();}
   });
   const outcome=action==='dictation-share'?
    await shareDictationImages(files,{mode}):
    await downloadDictationImages(files,{mode});
   const va=language!=='es';
   if(outcome.kind==='cancel')return false;
   if(outcome.shared){
    this.onFeedback(va?'Compartició sol·licitada.':'Se ha solicitado compartir.');
   }else if(outcome.kind==='zip'){
    this.onFeedback((va?'Descàrrega del ZIP de ':'Descarga del ZIP de ')+files.length+
     (va?' imatges iniciada.':' imágenes iniciada.'));
   }else if(outcome.kind==='png'){
    this.onFeedback(va?'Descàrrega de la imatge PNG iniciada.':'Descarga de la imagen PNG iniciada.');
   }
   if(outcome.fallback)this.onFeedback(va?
    'Este navegador no pot compartir directament les imatges. S’ha iniciat la descàrrega.':
    'Este navegador no puede compartir directamente las imágenes. Se ha iniciado la descarga.');
   return true;
  }catch(error){
   this.onWarning((language==='es'?'No se ha podido exportar el dictado: ':
    'No s’ha pogut exportar el dictat: ')+(error?.message||String(error)));
   return false;
  }finally{
   this.exporting=false;this.exportProgress=0;this.updateExportDom();
  }
 }
 async handleAction(action,value){
  if(action==='dictation-save-image'||action==='dictation-share')return await this.exportImages(action);
  if(action==='dictation-toggle'){
   if(this.running||this.pending)this.stop();else await this.start();
   return true;
  }
  if(action==='dictation-mode')return this.setMode(value);
  if(action==='dictation-clear')return this.clear();
  return false;
 }
}
