/* W2.12.1 — Model fidel a DictationMarinaPanel.kt de l'app Android 1.11.15.
 * Dicta altures, NO ritmes. Totes les notes s'escriuen com negres.
 * La transposició s'aplica al so real abans de dibuixar, incloent octaves.
 */
export const DICTATION_NOTES=Object.freeze(['Do','Do♯','Re','Mi♭','Mi','Fa','Fa♯','Sol','La♭','La','Si♭','Si']);
export const DICTATION_INSTRUMENTS=Object.freeze([
 {id:'CONCERT_TREBLE',va:'So real / Do · clau de sol',es:'Sonido real / Do · clave de sol',offset:0,clef:'treble'},
 {id:'PICCOLO',va:'Flautí · Do',es:'Flautín · Do',offset:-12,clef:'treble'},
 {id:'FLUTE',va:'Flauta · Do',es:'Flauta · Do',offset:0,clef:'treble'},
 {id:'OBOE',va:'Oboè · Do',es:'Oboe · Do',offset:0,clef:'treble'},
 {id:'CLARINET_BB',va:'Clarinet · Sib',es:'Clarinete · Sib',offset:2,clef:'treble'},
 {id:'BASS_CLARINET_BB',va:'Clarinet baix · Sib',es:'Clarinete bajo · Sib',offset:14,clef:'treble'},
 {id:'SOPRANO_SAX_BB',va:'Saxo soprano · Sib',es:'Saxo soprano · Sib',offset:2,clef:'treble'},
 {id:'ALTO_SAX_EB',va:'Saxo alt · Mib',es:'Saxo alto · Mib',offset:9,clef:'treble'},
 {id:'TENOR_SAX_BB',va:'Saxo tenor · Sib',es:'Saxo tenor · Sib',offset:14,clef:'treble'},
 {id:'BARITONE_SAX_EB',va:'Saxo baríton · Mib',es:'Saxo barítono · Mib',offset:21,clef:'treble'},
 {id:'TRUMPET_BB',va:'Trompeta · Sib',es:'Trompeta · Sib',offset:2,clef:'treble'},
 {id:'HORN_F',va:'Trompa · Fa',es:'Trompa · Fa',offset:7,clef:'treble'},
 {id:'BASSOON',va:'Fagot · Do',es:'Fagot · Do',offset:0,clef:'bass'},
 {id:'TROMBONE',va:'Trombó · Do',es:'Trombón · Do',offset:0,clef:'bass'},
 {id:'EUPHONIUM',va:'Bombardí · Do (clau de fa)',es:'Bombardino · Do (clave de fa)',offset:0,clef:'bass'},
 {id:'TUBA',va:'Tuba · Do',es:'Tuba · Do',offset:0,clef:'bass'},
].map(item=>Object.freeze(item)));
export const DICTATION_DEFAULT_INSTRUMENT='CONCERT_TREBLE';
export function getDictationInstrument(id){
 return DICTATION_INSTRUMENTS.find(x=>x.id===id)||DICTATION_INSTRUMENTS[0];
}
export function midiLabel(midi){
 const n=Math.round(Number(midi));
 if(!Number.isFinite(n))return '—';
 return DICTATION_NOTES[((n%12)+12)%12]+(Math.floor(n/12)-1);
}
export function normalizeMarinaMidi(midi){
 let adapted=Math.round(Number(midi));
 if(!Number.isFinite(adapted))return 60;
 while(adapted<60)adapted+=12;
 while(adapted>83)adapted-=12;
 return Math.max(60,Math.min(83,adapted));
}
export function writtenMidi(rawMidi,instrumentId=DICTATION_DEFAULT_INSTRUMENT,marina=false){
 const n=Math.max(24,Math.min(108,Math.round(Number(rawMidi))));
 if(!Number.isFinite(n))return 60;
 if(marina)return normalizeMarinaMidi(n);
 const instrument=getDictationInstrument(instrumentId);
 return Math.max(24,Math.min(108,n+instrument.offset));
}
export function staffPlacement(midi){
 const n=Math.round(Number(midi)),pc=((n%12)+12)%12,octave=Math.floor(n/12)-1;
 // Igual que Android: Do# i Fa# amb sostingut; Mib, Lab i Sib amb bemoll.
 const map=[
  [0,null],[0,'♯'],[1,null],[2,'♭'],[2,null],[3,null],
  [3,'♯'],[4,null],[5,'♭'],[5,null],[6,'♭'],[6,null]
 ];
 return {index:(octave-4)*7+map[pc][0],accidental:map[pc][1]};
}
/** La mateixa màquina d'estats temporal que DictationMarinaPanel.kt.
 * `step` rep l'altura MIDI mesurada (o null) i l'instant monotònic en ms.
 * Retorna la nota escrita acceptada o null; no detecta compassos ni durades.
 */
export class DictationCapture{
 constructor({mode='musical',instrument=DICTATION_DEFAULT_INSTRUMENT}={}){
  this.mode=mode==='marina'?'marina':'musical';
  this.instrument=getDictationInstrument(instrument).id;
  this.reset();
 }
 reset(){
  this.candidateMidi=null;this.candidateSince=0;
  this.lastAcceptedMidi=null;this.lastAcceptedAt=0;this.lastSignalAt=0;
 }
 step(rawMidi,now){
  if(!Number.isFinite(now)||now<0)return null;
  const marina=this.mode==='marina';
  if(rawMidi==null||!Number.isFinite(rawMidi)){
   if(now-this.lastSignalAt>(marina?180:320)){
    this.candidateMidi=null;this.lastAcceptedMidi=null;
   }
   return null;
  }
  this.lastSignalAt=now;
  const midi=writtenMidi(rawMidi,this.instrument,marina);
  if(this.candidateMidi!==midi){this.candidateMidi=midi;this.candidateSince=now;return null;}
  const stableMs=marina?70:150;
  if(now-this.candidateSince<stableMs)return null;
  if(marina){
   if(this.lastAcceptedMidi!==midi||now-this.lastAcceptedAt>=220){
    this.lastAcceptedMidi=midi;this.lastAcceptedAt=now;this.candidateSince=now;
    return {midi,label:midiLabel(midi)};
   }
  }else if(this.lastAcceptedMidi!==midi){
   this.lastAcceptedMidi=midi;this.lastAcceptedAt=now;
   return {midi,label:midiLabel(midi)};
  }
  return null;
 }
}
