/* W2.11 — Control de Nota de referència: una nota contínua, aturada segura.
   Pantalla i freqüència com ReferenceTonePanel Android v1.11.15. */
import {ReferenceToneEngine,REFERENCE_DEFAULT_PITCH_CLASS,REFERENCE_DEFAULT_OCTAVE,REFERENCE_SHORTCUTS,referenceFrequency,validReferenceSelection} from './reference-tone-w211.js';
import {renderReferenceToneMarkup} from './reference-tone-ui-w211.js';
import {normalizeReference} from './tuner-w210.js';

export class ReferenceToneController{
 constructor({onUpdate=()=>{},onWarning=()=>{},AudioContextClass=null}={}){
  this.pitchClass=REFERENCE_DEFAULT_PITCH_CLASS;
  this.octave=REFERENCE_DEFAULT_OCTAVE;
  this.referenceA4=442;
  this.running=false;this.pending=false;this.generation=0;
  this.engine=new ReferenceToneEngine({AudioContextClass});
  this.onUpdate=onUpdate;this.onWarning=onWarning;
 }
 get frequency(){return referenceFrequency(this.pitchClass,this.octave,this.referenceA4);}
 markup(language='va'){
  return renderReferenceToneMarkup({pitchClass:this.pitchClass,octave:this.octave,referenceA4:this.referenceA4,
   running:this.running,pending:this.pending,language});
 }
 setReference(value){
  this.referenceA4=normalizeReference(value);
  if(this.running)this.engine.setFrequency(this.frequency);
  this.onUpdate();
 }
 select(pitchClass,octave){
  if(!validReferenceSelection(pitchClass,octave))return false;
  this.pitchClass=pitchClass;this.octave=octave;
  if(this.running)this.engine.setFrequency(this.frequency);
  this.onUpdate();return true;
 }
 async start(){
  if(this.running||this.pending)return false;
  const generation=++this.generation;
  this.pending=true;this.onUpdate();
  try{
   const started=await this.engine.start(this.frequency);
   if(generation!==this.generation||document.hidden){
    if(started)this.engine.stop();
    return false;
   }
   this.pending=false;this.running=!!started;
   if(started)this.engine.setFrequency(this.frequency);
   this.onUpdate();
   return !!started;
  }catch(err){
   if(generation!==this.generation)return false;
   this.pending=false;this.running=false;this.engine.stop();
   this.onUpdate();this.onWarning(err?.message||String(err));
   return false;
  }
 }
 stop({notify=true}={}){
  this.generation++;this.pending=false;this.running=false;this.engine.stop();
  if(notify)this.onUpdate();
 }
 async handleAction(action,value){
  switch(action){
   case 'reference-toggle':if(this.running||this.pending)this.stop();else await this.start();return true;
   case 'reference-note':{
    if(typeof value!=='string'||!/^\d{1,2}$/.test(value))return false;
    return this.select(Number(value),this.octave);
   }
   case 'reference-octave':{
    if(typeof value!=='string'||!/^\d$/.test(value))return false;
    return this.select(this.pitchClass,Number(value));
   }
   case 'reference-shortcut':{
    const choice=REFERENCE_SHORTCUTS.find(item=>item.label===value);
    return choice?this.select(choice.pitchClass,choice.octave):false;
   }
   default:return false;
  }
 }
}
