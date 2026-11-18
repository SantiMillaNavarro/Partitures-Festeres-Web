/* W2.10 — Afinador cromàtic: port directe del càlcul YIN de TunerEngine.kt v1.11.15.
   Funcions pures, sense micròfon ni xarxa: es poden executar en un Web Worker. */
export const TUNER_MIN_HZ=55,TUNER_MAX_HZ=1800,TUNER_REFERENCE_MIN=430,TUNER_REFERENCE_MAX=450;
export const TUNER_REFERENCE_DEFAULT=442,TUNER_IN_TUNE_CENTS=5;
export const NOTE_NAMES=Object.freeze(['Do','Do♯','Re','Mi♭','Mi','Fa','Fa♯','Sol','La♭','La','Si♭','Si']);
export function normalizeReference(value){
 const n=Number(value);
 return Number.isFinite(n)?Math.max(430,Math.min(450,Math.round(n))):442;
}
/** @returns {{frequency:number,confidence:number}|null} */
export function detectPitchYin(samples,sampleRate=44100){
 const n=Math.min(samples?.length??0,4096);
 if(n<2048||!Number.isFinite(sampleRate)||sampleRate<=0)return null;
 let mean=0;
 for(let i=0;i<n;i++)mean+=samples[i];
 mean/=n;
 const data=new Float64Array(n);let energy=0;
 for(let i=0;i<n;i++){const v=samples[i]-mean;data[i]=v;energy+=v*v;}
 if(Math.sqrt(energy/n)<0.008)return null;
 const minTau=Math.max(2,Math.floor(sampleRate/TUNER_MAX_HZ));
 const maxTau=Math.min(Math.floor(n/2),Math.floor(sampleRate/TUNER_MIN_HZ));
 if(maxTau<=minTau+2)return null;
 const diff=new Float64Array(maxTau+1);
 for(let tau=1;tau<=maxTau;tau++){
  let sum=0;
  for(let i=0,limit=n-tau;i<limit;i++){const d=data[i]-data[i+tau];sum+=d*d;}
  diff[tau]=sum;
 }
 const cmndf=new Float64Array(maxTau+1);cmndf[0]=1;
 let running=0;
 for(let tau=1;tau<=maxTau;tau++){
  running+=diff[tau];cmndf[tau]=running<=1e-12?1:diff[tau]*tau/running;
 }
 let candidate=-1;
 for(let tau=minTau;tau<=maxTau;tau++){
  if(cmndf[tau]<.15){
   while(tau+1<=maxTau&&cmndf[tau+1]<cmndf[tau])tau++;
   candidate=tau;break;
  }
 }
 if(candidate<0){
  let bestTau=minTau,best=cmndf[minTau];
  for(let tau=minTau+1;tau<=maxTau;tau++)if(cmndf[tau]<best){best=cmndf[tau];bestTau=tau;}
  if(best>.20)return null;
  candidate=bestTau;
 }
 let refined=candidate;
 if(candidate>1&&candidate<maxTau){
  const left=cmndf[candidate-1],center=cmndf[candidate],right=cmndf[candidate+1];
  const den=2*(2*center-right-left);
  if(Math.abs(den)>1e-12)refined+=(right-left)/den;
 }
 const frequency=sampleRate/refined,confidence=Math.min(1,Math.max(0,1-cmndf[candidate]));
 if(!Number.isFinite(frequency)||frequency<TUNER_MIN_HZ||frequency>TUNER_MAX_HZ||confidence<.72)return null;
 return {frequency,confidence};
}
export function toPitchReading(frequency,reference=442,confidence=1){
 if(!Number.isFinite(frequency)||frequency<=0)return null;
 const midi=69+12*Math.log2(frequency/normalizeReference(reference));
 const nearest=Math.round(midi);
 const cents=(midi-nearest)*100;
 return {frequencyHz:frequency,midi,cents,confidence,
  noteName:NOTE_NAMES[((nearest%12)+12)%12],
  stable:Math.abs(cents)<=TUNER_IN_TUNE_CENTS};
}
export function medianPitch(recent){
 if(!recent.length)return null;
 const values=[...recent].sort((a,b)=>a-b);
 return values[Math.floor(values.length/2)];
}
