/* W2.11 — Nota de referència. Referència: ReferenceToneEngine.kt (Android 1.11.15).
   Escala cromàtica, octaves 2–6, La4 = referència d'afinació compartida.
   Web Audio utilitza una ona periòdica amb els tres harmònics d'Android:
   0,82 fonamental + 0,13 segon + 0,05 tercer; amplitud total 0,34. */
export const REFERENCE_NOTE_NAMES=Object.freeze(['Do','Do♯/Re♭','Re','Mi♭','Mi','Fa','Fa♯/Sol♭','Sol','La♭','La','Sib','Si']);
export const REFERENCE_MIN_OCTAVE=2;
export const REFERENCE_MAX_OCTAVE=6;
export const REFERENCE_SHORTCUTS=Object.freeze([
 Object.freeze({label:'La4',pitchClass:9,octave:4}),
 Object.freeze({label:'Sib3',pitchClass:10,octave:3}),
 Object.freeze({label:'Sib4',pitchClass:10,octave:4}),
]);
export const REFERENCE_DEFAULT_PITCH_CLASS=9;
export const REFERENCE_DEFAULT_OCTAVE=4;
export const REFERENCE_DEFAULT_A4=442;
export function validReferenceSelection(pitchClass,octave){
 return Number.isInteger(pitchClass)&&pitchClass>=0&&pitchClass<12&&
        Number.isInteger(octave)&&octave>=REFERENCE_MIN_OCTAVE&&octave<=REFERENCE_MAX_OCTAVE;
}
export function referenceFrequency(pitchClass=9,octave=4,referenceA4=442){
 if(!validReferenceSelection(pitchClass,octave))throw new RangeError('Nota o octava no vàlida');
 const calibration=Number(referenceA4);
 if(!Number.isInteger(calibration)||calibration<430||calibration>450)throw new RangeError('Referència fora del rang 430–450 Hz');
 return calibration*Math.pow(2,(((octave+1)*12+pitchClass)-69)/12);
}
export function referenceLabel(pitchClass=9,octave=4){
 if(!validReferenceSelection(pitchClass,octave))throw new RangeError('Nota o octava no vàlida');
 return REFERENCE_NOTE_NAMES[pitchClass]+octave;
}
export class ReferenceToneEngine{
 constructor({AudioContextClass=null}={}){
  this.AudioContextClass=AudioContextClass;
  this.context=null;this.oscillator=null;this.gain=null;
  this.running=false;this.frequency=0;this.token=0;
 }
 async start(frequencyHz){
  this.stop();
  const token=this.token;
  if(!Number.isFinite(frequencyHz)||frequencyHz<40||frequencyHz>5000)throw new RangeError('Freqüència no vàlida');
  const Ctor=this.AudioContextClass||globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Ctor)throw new Error('Este navegador no permet reproduir el to amb Web Audio.');
  const context=new Ctor();
  this.context=context;
  try{
   if(context.state!=='running')await context.resume();
   if(token!==this.token){try{await context.close();}catch{}return false;}
   if(context.state==='closed')throw new Error('L’eixida d’àudio no està disponible.');
   const real=new Float32Array(4),imag=new Float32Array([0,.82,.13,.05]);
   const periodic=context.createPeriodicWave(real,imag,{disableNormalization:true});
   const gain=context.createGain();
   const oscillator=context.createOscillator();
   oscillator.setPeriodicWave(periodic);
   oscillator.frequency.setValueAtTime(frequencyHz,context.currentTime);
   oscillator.connect(gain);gain.connect(context.destination);
   gain.gain.setValueAtTime(0,context.currentTime);
   gain.gain.linearRampToValueAtTime(.34,context.currentTime+.018);
   if(token!==this.token){
    try{oscillator.disconnect();gain.disconnect();await context.close();}catch{}
    return false;
   }
   oscillator.start();
   this.oscillator=oscillator;this.gain=gain;this.running=true;this.frequency=frequencyHz;
   return true;
  }catch(e){
   if(token===this.token)this.stop();
   else try{await context.close();}catch{}
   throw e;
  }
 }
 setFrequency(frequencyHz){
  if(!Number.isFinite(frequencyHz)||frequencyHz<40||frequencyHz>5000)return false;
  this.frequency=frequencyHz;
  if(this.running&&this.context&&this.oscillator){
   const t=this.context.currentTime;
   try{
    this.oscillator.frequency.cancelScheduledValues(t);
    this.oscillator.frequency.setTargetAtTime(frequencyHz,t,.012);
   }catch{
    try{this.oscillator.frequency.setValueAtTime(frequencyHz,t);}catch{return false;}
   }
  }
  return true;
 }
 stop(){
  this.token++;this.running=false;this.frequency=0;
  const osc=this.oscillator,gain=this.gain,context=this.context;
  this.oscillator=null;this.gain=null;this.context=null;
  if(osc){
   try{
    const t=context?.currentTime??0;
    if(gain?.gain){gain.gain.cancelScheduledValues(t);gain.gain.setTargetAtTime(0,t,.005);}
    osc.stop(t+.025);
   }catch{try{osc.stop();}catch{}}
   try{osc.disconnect();}catch{}
  }
  try{gain?.disconnect();}catch{}
  if(context)try{context.close()?.catch?.(()=>{});}catch{}
 }
}
