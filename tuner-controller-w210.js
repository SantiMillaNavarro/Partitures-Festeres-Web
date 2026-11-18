/* W2.10 — Captura local del micròfon i cicle de vida de l'afinador web.
   Sol·licita el permís sols amb un toc explícit. No emmagatzema cap mostra d'àudio.
*/
import {detectPitchYin,toPitchReading,medianPitch,normalizeReference} from './tuner-w210.js';
import {renderTunerMarkup,tunerNeedleCoords} from './tuner-ui-w210.js';

export class TunerController{
 constructor({onUpdate=()=>{},onWarning=()=>{},onReferenceSave=()=>{}}={}){
  this.reference=442;this.running=false;this.pending=false;this.reading=null;
  this.history=[];this.recent=[];this.generation=0;this.busy=false;
  this.stream=null;this.audio=null;this.source=null;this.analyser=null;
  this.worker=null;this.frame=0;this.lastAnalysis=0;
  this.onUpdate=onUpdate;this.onWarning=onWarning;this.onReferenceSave=onReferenceSave;
  this.language='va';
 }
 markup(language='va'){
  this.language=language;
  return renderTunerMarkup({reference:this.reference,running:this.running,pending:this.pending,language});
 }
 async start(){
  if(this.running||this.pending)return;
  this.stop({notify:false});
  const token=++this.generation;
  this.pending=true;this.onUpdate();
  let stream=null,context=null;
  try{
   if(!navigator.mediaDevices?.getUserMedia)
    throw new Error('El navegador no té accés al micròfon. Obri la web amb HTTPS.');
   stream=await navigator.mediaDevices.getUserMedia({audio:{
    echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1
   },video:false});
   if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}
   const Ctor=globalThis.AudioContext||globalThis.webkitAudioContext;
   if(!Ctor)throw new Error('Este navegador no admet Web Audio.');
   context=new Ctor();
   if(context.state!=='running')await context.resume();
   if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());context.close().catch(()=>{});return false;}
   const source=context.createMediaStreamSource(stream);
   const analyser=context.createAnalyser();
   analyser.fftSize=4096;
   analyser.smoothingTimeConstant=0;
   source.connect(analyser); // No connectem la captura a l'altaveu: evita acoblament.
   this.stream=stream;this.audio=context;this.source=source;this.analyser=analyser;
   this.worker=this.createWorker(token);
   stream.getAudioTracks().forEach(track=>{
    track.addEventListener('ended',()=>{
     if(token===this.generation){
      this.stop();
      this.onWarning(this.language==='es'?'Se ha desconectado el micrófono.':'S’ha desconnectat el micròfon.');
     }
    },{once:true});
   });
   this.pending=false;this.running=true;this.lastAnalysis=0;this.busy=false;
   this.onUpdate();this.frame=requestAnimationFrame(this.tick);
   return true;
  }catch(err){
   if(token!==this.generation)return false;
   if(stream&&!this.stream)stream.getTracks().forEach(t=>t.stop());
   if(context&&!this.audio)try{await context.close();}catch{}
   const msg=err?.name==='NotAllowedError'||err?.name==='PermissionDeniedError'
    ?(this.language==='es'?'Permiso de micrófono denegado.':'Permís del micròfon denegat.')
    :err?.name==='NotFoundError'?(this.language==='es'?'No se ha encontrado ningún micrófono.':'No s’ha trobat cap micròfon.')
    :(err?.message||String(err));
   this.stop();this.onWarning(msg);return false;
  }
 }
 createWorker(token){
  if(typeof Worker==='undefined')return null;
  try{
   const worker=new Worker(new URL('./tuner-worker-w210.js',import.meta.url),{type:'module'});
   worker.onmessage=event=>{
    if(token!==this.generation)return;
    this.busy=false;
    this.handleDetection(event.data?.result||null);
   };
   worker.onerror=()=>{
    if(token!==this.generation)return;
    worker.terminate();
    if(this.worker===worker)this.worker=null;
    this.busy=false; // Continuem amb una ruta de càlcul local sense Worker.
   };
   return worker;
  }catch{return null;}
 }
 tick=(now)=>{
  this.frame=0;
  if(!this.running||document.hidden||!this.analyser)return;
  if(now-this.lastAnalysis>=110&&!this.busy){
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
  if(result&&Number.isFinite(result.frequency)){
   this.recent.push(result.frequency);if(this.recent.length>3)this.recent.shift();
   const frequency=medianPitch(this.recent);
   this.reading=toPitchReading(frequency,this.reference,result.confidence);
   if(this.reading){
    this.history.push({cents:Math.max(-50,Math.min(50,this.reading.cents)),noteName:this.reading.noteName});
    if(this.history.length>280)this.history.splice(0,this.history.length-280);
   }
  }else{this.reading=null;this.recent.length=0;}
  this.updateDom();
 }
 updateDom(){
  const el=id=>document.getElementById(id),reading=this.reading;
  const va=this.language!=='es';
  if(el('tuner-note'))el('tuner-note').textContent=reading?.noteName||'—';
  if(el('tuner-frequency'))el('tuner-frequency').textContent=reading?reading.frequencyHz.toFixed(2)+' Hz':
   (this.running?(va?'Escoltant…':'Escuchando…'):(va?'Esperant una nota…':'Esperando una nota…'));
  const status=el('tuner-status');
  if(status){
   const cents=reading?Math.round(reading.cents):0;
   const prefix=cents>0?'+':'';
   status.textContent=reading?prefix+cents+' cents · '+(reading.stable?(va?'Afinat':'Afinado'):
    reading.cents<0?(va?'Baix':'Bajo'):(va?'Alt':'Alto')):(va?'Zona afinada: ±5 cents':'Zona afinada: ±5 cents');
   status.classList.toggle('in-tune',!!reading?.stable);
  }
  const needle=document.querySelector('[data-tuner-needle]');
  if(needle){
   const p=tunerNeedleCoords(reading?.cents||0);
   needle.setAttribute('x2',p.x);needle.setAttribute('y2',p.y);
   needle.setAttribute('stroke',reading?.stable?'#367d54':'#751c2c');
  }
  if(el('tuner-reference-output'))el('tuner-reference-output').textContent=String(this.reference);
  const history=el('tuner-history-line');
  if(history){
   const visible=this.history.slice(-220),points=[];
   visible.forEach((point,i)=>{
    const x=8+i/(Math.max(1,visible.length-1))*534;
    const y=80-point.cents/50*70;
    points.push((i===0||point.noteName!==visible[i-1].noteName?'M':'L')+x.toFixed(2)+' '+y.toFixed(2));
   });
   history.setAttribute('d',points.join(' '));
  }
 }
 setReference(value,{save=false}={}){
  this.reference=normalizeReference(value);
  const input=document.getElementById('tuner-reference');
  if(input)input.value=String(this.reference);
  if(this.reading)this.reading=toPitchReading(this.reading.frequencyHz,this.reference,this.reading.confidence);
  this.updateDom();
  if(save)this.onReferenceSave(this.reference);
 }
 clearHistory(){this.history=[];this.updateDom();}
 stop({notify=true}={}){
  this.generation++;
  if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;}
  this.running=false;this.pending=false;this.busy=false;
  this.reading=null;this.recent=[];
  this.worker?.terminate();this.worker=null;
  try{this.source?.disconnect();}catch{}this.source=null;this.analyser=null;
  const tracks=this.stream?.getTracks()||[];this.stream=null;
  tracks.forEach(t=>{try{t.stop();}catch{}});
  const context=this.audio;this.audio=null;
  if(context)try{const closing=context.close();closing?.catch?.(()=>{});}catch{}
  if(notify)this.onUpdate();
 }
 async handleAction(action){
  if(action==='tuner-toggle'){if(this.running||this.pending)this.stop();else await this.start();return true;}
  if(action==='tuner-clear'){this.clearHistory();return true;}
  if(action==='tuner-reference-reset'){this.setReference(442,{save:true});return true;}
  return false;
 }
}
