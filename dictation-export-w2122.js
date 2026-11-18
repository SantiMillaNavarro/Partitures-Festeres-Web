/* W2.12.2 — PNG del dictat. Port fidel de DictationExportPolicy.kt
   i renderScoreBitmap() de DictationMarinaPanel.kt (Android 1.11.15).
   IMPORTANT: 60 notes / PNG; 1600px, 10 notes per pentagrama i files de 240px.
   Cap àudio, PDF, biblioteca ni xarxa estan involucrats en l'exportació. */
import {getDictationInstrument,staffPlacement} from './dictation-model-w2121.js';

export const DICTATION_NOTES_PER_IMAGE=60;
export const DICTATION_IMAGE_WIDTH=1600;
export const DICTATION_NOTES_PER_STAFF=10;
export const DICTATION_ROW_HEIGHT=240;
export const DICTATION_IMAGE_MARGIN=200;
export function dictationPageCount(noteCount){
 if(!Number.isSafeInteger(noteCount)||noteCount<0)throw new RangeError('Nombre de notes no vàlid');
 return noteCount===0?0:Math.ceil(noteCount/DICTATION_NOTES_PER_IMAGE);
}
export function dictationImageSize(noteCount){
 if(!Number.isSafeInteger(noteCount)||noteCount<1||noteCount>DICTATION_NOTES_PER_IMAGE)
  throw new RangeError('Cada imatge ha de tindre entre 1 i 60 notes');
 return {width:DICTATION_IMAGE_WIDTH,height:DICTATION_IMAGE_MARGIN+
  Math.ceil(noteCount/DICTATION_NOTES_PER_STAFF)*DICTATION_ROW_HEIGHT};
}
export function splitDictationPages(notes){
 if(!Array.isArray(notes))throw new TypeError('El dictat no és una llista');
 const pages=[];
 for(let i=0;i<notes.length;i+=DICTATION_NOTES_PER_IMAGE)
  pages.push(notes.slice(i,i+DICTATION_NOTES_PER_IMAGE));
 return pages;
}
export function scoreTitle(mode){return mode==='marina'?'Dictat Marina':'Dictat Musical';}
export function dictationFilePrefix(mode){return mode==='marina'?'Dictat_Marina':'Dictat_Musical';}
export function dictationExportOptions({mode='musical',instrument='CONCERT_TREBLE',language='va'}={}){
 const marina=mode==='marina',value=getDictationInstrument(instrument);
 return {mode:marina?'marina':'musical',clef:marina?'treble':value.clef,
  subtitle:marina?'':value[language==='es'?'es':'va']};
}
function line(ctx,x1,y1,x2,y2){
 ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
}
export function renderDictationImage(notes,options={}){
 const pages=Array.isArray(notes)?notes:null;
 if(!pages||!pages.length||pages.length>DICTATION_NOTES_PER_IMAGE)
  throw new RangeError('Es poden dibuixar entre 1 i 60 notes per imatge');
 const opts=dictationExportOptions(options);
 const {width,height}=dictationImageSize(pages.length);
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('No es pot dibuixar la imatge del dictat');
 ctx.fillStyle='#faf2e2';ctx.fillRect(0,0,width,height);
 ctx.fillStyle='#7b2830';ctx.font='bold 54px Arial, sans-serif';
 ctx.textBaseline='alphabetic';
 ctx.fillText(scoreTitle(opts.mode),70,78);
 if(opts.subtitle){ctx.font='30px Arial, sans-serif';ctx.fillStyle='#564f46';ctx.fillText(opts.subtitle,72,116);}
 ctx.lineWidth=3;ctx.strokeStyle='#1c3a57';ctx.fillStyle='#1c3a57';
 const left=170,right=1530,staffGap=28,halfGap=14,slot=(right-left)/DICTATION_NOTES_PER_STAFF;
 const bottomIndex=opts.clef==='bass'?-10:2;
 const count=Math.ceil(pages.length/DICTATION_NOTES_PER_STAFF);
 for(let row=0;row<count;row++){
  const bottom=120+row*DICTATION_ROW_HEIGHT+150;
  for(let n=0;n<5;n++)line(ctx,left,bottom-n*staffGap,right,bottom-n*staffGap);
  ctx.font='92px "Noto Music", "Segoe UI Symbol", "Apple Symbols", serif';
  ctx.textAlign='center';ctx.fillText(opts.clef==='bass'?'𝄢':'𝄞',92,bottom+34);
  const first=row*DICTATION_NOTES_PER_STAFF,last=Math.min(pages.length,first+DICTATION_NOTES_PER_STAFF);
  for(let index=first;index<last;index++){
   const note=pages[index],midi=Number(note?.midi);
   if(!Number.isFinite(midi)||midi<0||midi>127)throw new RangeError('Nota MIDI no vàlida');
   const x=left+slot*((index-first)+.5);
   const placement=staffPlacement(midi);
   const y=bottom-(placement.index-bottomIndex)*halfGap;
   if(placement.index<=bottomIndex-2){
    for(let idx=bottomIndex-2;idx>=placement.index;idx-=2){
     const ly=bottom-(idx-bottomIndex)*halfGap;
     line(ctx,x-22,ly,x+22,ly);
    }
   }
   if(placement.index>=bottomIndex+10){
    for(let idx=bottomIndex+10;idx<=placement.index;idx+=2){
     const ly=bottom-(idx-bottomIndex)*halfGap;
     line(ctx,x-22,ly,x+22,ly);
    }
   }
   ctx.save();ctx.translate(x,y);ctx.rotate(-16*Math.PI/180);
   ctx.beginPath();ctx.ellipse(0,0,13,9,0,0,2*Math.PI);ctx.fill();ctx.restore();
   const stemUp=placement.index<bottomIndex+4;
   if(stemUp)line(ctx,x+12,y,x+12,y-55);
   else line(ctx,x-12,y,x-12,y+55);
   if(placement.accidental){
    ctx.font='38px "Noto Music", "Segoe UI Symbol", "Apple Symbols", serif';
    ctx.textAlign='center';ctx.fillText(placement.accidental,x-31,y+12);
   }
  }
 }
 return canvas;
}
export function canvasToPngBlob(canvas){
 return new Promise((resolve,reject)=>{
  if(!canvas?.toBlob)return reject(new Error('Este navegador no pot crear imatges PNG.'));
  try{canvas.toBlob(blob=>blob?.type==='image/png'?resolve(blob):
   reject(new Error('No s’ha pogut generar la imatge PNG.')),'image/png');}
  catch(error){reject(error);}
 });
}
export async function createDictationPngFiles(notes,{mode='musical',instrument='CONCERT_TREBLE',language='va',onProgress=()=>{}}={}){
 const pages=splitDictationPages(notes);
 if(!pages.length)throw new Error('No hi ha notes per a exportar');
 const prefix=dictationFilePrefix(mode),stamp=Date.now(),suffix=Math.random().toString(36).slice(2,8);
 const files=[];
 for(let i=0;i<pages.length;i++){
  const canvas=renderDictationImage(pages[i],{mode,instrument,language});
  let blob=null;
  try{blob=await canvasToPngBlob(canvas);}
  finally{canvas.width=0;canvas.height=0;}
  const basename=prefix+'_'+stamp+'_'+suffix;
  const name=basename+(pages.length===1?'':('_'+String(i+1).padStart(2,'0')))+'.png';
  files.push(new File([blob],name,{type:'image/png',lastModified:stamp}));
  onProgress(i+1,pages.length);
 }
 return files;
}
function downloadBlob(blob,name){
 const href=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=href;a.download=name;
 a.style.display='none';document.body.append(a);a.click();a.remove();
 // iOS/Safari poden necessitar mantindre l'object URL en vida durant la descàrrega.
 setTimeout(()=>URL.revokeObjectURL(href),60000);
}
export async function downloadDictationImages(files,{mode='musical'}={}){
 if(!files?.length)throw new Error('No hi ha imatges per a guardar');
 if(files.length===1){
  downloadBlob(files[0],files[0].name);return {kind:'png',count:1};
 }
 if(!globalThis.JSZip)throw new Error('No està disponible el generador ZIP');
 const archive=new globalThis.JSZip();
 for(const file of files)archive.file(file.name,file);
 const zip=await archive.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
 const filename=dictationFilePrefix(mode)+'_'+Date.now()+'.zip';
 downloadBlob(zip,filename);
 return {kind:'zip',count:files.length};
}
export async function shareDictationImages(files,{mode='musical'}={}){
 if(!files?.length)throw new Error('No hi ha imatges per a compartir');
 // Web Share pot no acceptar múltiples imatges o no existir en escriptori:
 // en eixe cas oferim una descàrrega única (ZIP si hi ha diverses pàgines).
 if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function'||!navigator.canShare({files})){
  const saved=await downloadDictationImages(files,{mode});
  return {...saved,shared:false,fallback:true};
 }
 try{
  await navigator.share({title:scoreTitle(mode),files});
  return {kind:'share',count:files.length,shared:true,fallback:false};
 }catch(error){
  if(error?.name==='AbortError')return {kind:'cancel',count:0,shared:false,fallback:false};
  if(error?.name==='NotAllowedError'||error?.name==='TypeError'||error?.name==='NotSupportedError'){
   const saved=await downloadDictationImages(files,{mode});
   return {...saved,shared:false,fallback:true};
  }
  throw error;
 }
}
