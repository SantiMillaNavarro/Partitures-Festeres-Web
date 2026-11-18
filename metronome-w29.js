/* W2.9 — Metrònom web basat en MetronomeEngine.kt d'Android v1.11.15.
   El so és una mostra de compàs en bucle, sense temporitzadors JS per als clics.
   Únicament dos timbres: primer temps fort, resta dèbil (incloses subdivisions).
*/
export const METRONOME_SIGNATURES=Object.freeze([
 Object.freeze({label:'2/4',mainBeats:2,subdivisionsPerBeat:1}),
 Object.freeze({label:'3/4',mainBeats:3,subdivisionsPerBeat:1}),
 Object.freeze({label:'4/4',mainBeats:4,subdivisionsPerBeat:1}),
 Object.freeze({label:'6/8',mainBeats:2,subdivisionsPerBeat:3}),
 Object.freeze({label:'9/8',mainBeats:3,subdivisionsPerBeat:3}),
 Object.freeze({label:'12/8',mainBeats:4,subdivisionsPerBeat:3})
]);
export const METRONOME_MIN_BPM=40;
export const METRONOME_MAX_BPM=240;
export const DEFAULT_BPM=100;
export const DEFAULT_SIGNATURE='4/4';
export const normalizeMetronomeBpm=value=>{
 const n=Number(value);
 return Number.isFinite(n)?Math.min(METRONOME_MAX_BPM,Math.max(METRONOME_MIN_BPM,Math.round(n))):DEFAULT_BPM;
};
export const getMetronomeSignature=value=>
 METRONOME_SIGNATURES.find(s=>s.label===value)||METRONOME_SIGNATURES[2];
export const metronomeEvents=signature=>
 signature.mainBeats*signature.subdivisionsPerBeat;
export const metronomeFramesPerEvent=(bpm,signature,sampleRate=44100)=>
 Math.max(1,Math.round(Number(sampleRate)*60/(normalizeMetronomeBpm(bpm)*signature.subdivisionsPerBeat)));
export const metronomeEventIndex=(elapsedSeconds,bpm,signature)=>
 Math.max(0,Math.floor(Math.max(0,elapsedSeconds)*normalizeMetronomeBpm(bpm)*signature.subdivisionsPerBeat/60+1e-9))%metronomeEvents(signature);

function mechanicalClick(strong,sampleRate){
 const duration=strong?.058:.043;
 const length=Math.round(sampleRate*duration);
 const frequency=strong?1520:1820;
 const volume=strong?.88:.53;
 const noiseSeed=strong?0x13579BDF:0x02468ACE;
 let noiseState=noiseSeed|0;
 const out=new Float32Array(length);
 for(let i=0;i<length;i++){
  const t=i/sampleRate;
  const envelope=Math.exp(-t*(strong?82:94));
  const attack=Math.min(1,i/14);
  noiseState=(Math.imul(noiseState,1664525)+1013904223)|0;
  const noise=(((noiseState>>>9)&0x7fffff)/4194303.5)-1;
  const body=Math.sin(2*Math.PI*frequency*t);
  const upper=.38*Math.sin(2*Math.PI*(frequency*1.8)*t+.35);
  const transient=i<68?noise*(1-i/68)*.28:0;
  const impulse=i<5?(1-i/5)*.5:0;
  const sample=(body+upper+transient+impulse)*envelope*attack*volume;
  out[i]=Math.max(-1,Math.min(1,sample));
 }
 return out;
}
export function renderMetronomeBar(bpm,signature=DEFAULT_SIGNATURE,sampleRate=44100){
 const sig=typeof signature==='string'?getMetronomeSignature(signature):signature;
 const interval=metronomeFramesPerEvent(bpm,sig,sampleRate);
 const events=metronomeEvents(sig);
 const out=new Float32Array(interval*events);
 const strong=mechanicalClick(true,sampleRate),weak=mechanicalClick(false,sampleRate);
 for(let event=0;event<events;event++){
  const click=event===0?strong:weak,offset=event*interval;
  const count=Math.min(click.length,out.length-offset);
  for(let i=0;i<count;i++)out[offset+i]=Math.max(-1,Math.min(1,out[offset+i]+click[i]));
 }
 return {samples:out,framesPerEvent:interval,events,signature:sig,bpm:normalizeMetronomeBpm(bpm)};
}

export class WebMetronomeEngine{
 constructor({AudioContextClass=null}={}){
  this.AudioContextClass=AudioContextClass;
  this.context=null;this.source=null;this.running=false;
  this.startTime=0;this.signature=getMetronomeSignature(DEFAULT_SIGNATURE);
  this.bpm=DEFAULT_BPM;this.framesPerEvent=1;this.generation=0;
 }
 async start(bpm,signature=DEFAULT_SIGNATURE){
  this.stop();
  const token=this.generation;
  const sig=getMetronomeSignature(typeof signature==='string'?signature:signature.label);
  const ctor=this.AudioContextClass||globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!ctor)throw new Error('Este navegador no permet reproduir àudio Web Audio.');
  if(!this.context)this.context=new ctor();
  const ctx=this.context;
  if(ctx.state==='closed')throw new Error('El dispositiu d’àudio ja no està disponible.');
  if(ctx.state!=='running')await ctx.resume();
  if(token!==this.generation)return false; // Un canvi de pantalla ha cancel·lat l'inici.
  const bar=renderMetronomeBar(bpm,sig,ctx.sampleRate);
  const buffer=ctx.createBuffer(1,bar.samples.length,ctx.sampleRate);
  buffer.getChannelData(0).set(bar.samples);
  const source=ctx.createBufferSource();
  source.buffer=buffer;source.loop=true;
  source.connect(ctx.destination);
  try{source.start();}
  catch(err){source.disconnect();throw err;}
  if(token!==this.generation){try{source.stop();}catch{}source.disconnect();return false;}
  this.source=source;this.startTime=ctx.currentTime;this.signature=sig;
  this.bpm=bar.bpm;this.framesPerEvent=bar.framesPerEvent;this.running=true;
  return true;
 }
 stop(){
  ++this.generation;
  const source=this.source;this.source=null;this.running=false;this.startTime=0;
  if(source){try{source.stop();}catch{}try{source.disconnect();}catch{}}
 }
 currentEventIndex(){
  if(!this.running||!this.context)return 0;
  const framesElapsed=Math.max(0,(this.context.currentTime-this.startTime)*this.context.sampleRate);
  return Math.floor(framesElapsed/this.framesPerEvent)%metronomeEvents(this.signature);
 }
 close(){
  this.stop();
  const ctx=this.context;this.context=null;
  try{const closing=ctx?.close();closing?.catch?.(()=>{});}catch{}
 }
}
