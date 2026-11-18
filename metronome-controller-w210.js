/* W2.9 — Cicle de vida del metrònom: es para en eixir d'Eines o amagar l'app. */
import {WebMetronomeEngine,normalizeMetronomeBpm,getMetronomeSignature,DEFAULT_BPM,DEFAULT_SIGNATURE} from './metronome-w29.js';
import {renderMetronomeMarkup} from './metronome-ui-w210.js';
export class MetronomeController{
 constructor({onUpdate=()=>{},onWarning=()=>{}}={}){
  this.bpm=DEFAULT_BPM;this.signature=DEFAULT_SIGNATURE;this.running=false;this.pending=false;
  this.activeIndex=-1;this.engine=null;this.frame=0;this.generation=0;
  this.onUpdate=onUpdate;this.onWarning=onWarning;
 }
 markup(language='va'){
  return renderMetronomeMarkup({bpm:this.bpm,signature:this.signature,
   running:this.running,pending:this.pending,activeIndex:this.activeIndex,language});
 }
 refresh(){
  if(!this.running||!this.engine)return;
  const index=this.engine.currentEventIndex();
  if(index===this.activeIndex)return;
  this.activeIndex=index;
  document.querySelectorAll('[data-metro-event]').forEach(el=>{
   el.classList.toggle('active',Number(el.dataset.metroEvent)===index);
  });
 }
 frameLoop=()=>{
  this.frame=0;
  if(!this.running||document.hidden)return;
  this.refresh();
  this.frame=requestAnimationFrame(this.frameLoop);
 };
 stop({release=false,notify=true}={}){
  this.generation++;
  if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;}
  this.engine?.stop();
  if(release){this.engine?.close();this.engine=null;}
  this.running=false;this.pending=false;this.activeIndex=-1;
  if(notify)this.onUpdate();
 }
 async start(){
  const sequence=++this.generation;
  // Evitar més d'un bucle de visualització durant canvis de compàs o BPM.
  if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;}
  if(!this.engine)this.engine=new WebMetronomeEngine();
  const engine=this.engine;
  this.pending=true;
  try{
   const result=await engine.start(this.bpm,this.signature);
   if(sequence!==this.generation||document.hidden){if(result)engine.stop();return false;}
   this.pending=false;this.running=!!result;this.activeIndex=0;
   this.onUpdate();
   if(result)this.frame=requestAnimationFrame(this.frameLoop);
   return result;
  }catch(err){
   if(sequence!==this.generation)return false;
   engine.stop();this.pending=false;this.running=false;this.activeIndex=-1;
   this.onUpdate();this.onWarning(err?.message||String(err));
   return false;
  }
 }
 updateBpm(value,{commit=false}={}){
  const next=normalizeMetronomeBpm(value);
  this.bpm=next;
  const big=document.querySelector('#metro-big-bpm');if(big)big.textContent=String(next);
  const out=document.querySelector('#metro-range-value');if(out)out.textContent=next+' BPM';
  const slider=document.querySelector('#metro-bpm');
  if(slider&&slider.value!==String(next))slider.value=String(next);
  if(commit&&this.running)this.start();
 }
 async handleAction(action,value){
  switch(action){
   case 'metro-toggle':{
    if(this.running||this.pending)this.stop();
    else await this.start();
    return true;
   }
   case 'metro-minus':this.updateBpm(this.bpm-1,{commit:true});return true;
   case 'metro-plus':this.updateBpm(this.bpm+1,{commit:true});return true;
   case 'metro-signature':{
    const signature=getMetronomeSignature(value);
    this.signature=signature.label;
    if(this.running)this.start();
    else this.onUpdate();
    return true;
   }
   default:return false;
  }
 }
}
