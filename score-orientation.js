/* W2.3.2 — Orientació del CONTINGUT del PDF, independent de l'orientació física
   del visor. PDFs privats: anàlisi local amb PDF.js, sense servidor ni OCR extern. */
export const RIGHT_ANGLE_ROTATIONS=Object.freeze([0,90,180,270]);
export const normalizeRotation=value=>((Number(value)||0)%360+360)%360;
export const supportedRotation=value=>RIGHT_ANGLE_ROTATIONS.includes(normalizeRotation(value))?normalizeRotation(value):0;

export function viewportOrientation(page,rotation){
 const {width,height}=page.getViewport({scale:1,rotation});
 return width>=height?'landscape':'portrait';
}
export function scoreReadableTextRotation(page,textContent){
 const items=Array.isArray(textContent?.items)?textContent.items:[];
 const candidates=RIGHT_ANGLE_ROTATIONS.map(rotation=>({
  rotation,transform:page.getViewport({scale:1,rotation}).transform,score:0
 }));
 let weight=0,count=0;
 for(const item of items){
  const str=String(item?.str||'');
  const chars=str.match(/\p{L}/gu);
  if(!chars||chars.length<2||!Array.isArray(item.transform)||item.transform.length<4)continue;
  const [tx,ty]=item.transform;
  const len=Math.hypot(tx,ty);
  if(!Number.isFinite(len)||len<.0001)continue;
  const w=Math.min(24,chars.length)*(str.length>=5?1.25:1);
  weight+=w;count++;
  for(const candidate of candidates){
   const [a,b,c,d]=candidate.transform;
   const dx=a*tx+c*ty,dy=b*tx+d*ty;
   // La línia de text ha d'avançar cap a la dreta, no de costat ni invertida.
   candidate.score+=w*dx/Math.max(.000001,Math.hypot(dx,dy));
  }
 }
 if(weight<3||count===0)return null;
 candidates.sort((a,b)=>b.score-a.score);
 const native=supportedRotation(page.rotate);
 const [best,second]=candidates;
 // Desempat: els PDF amb metadades de /Rotate deuen conservar-les.
 const equal=Math.abs(best.score-second.score)<.04*weight;
 if(equal){const tied=candidates.filter(c=>Math.abs(c.score-best.score)<.04*weight);
   const match=tied.find(c=>c.rotation===native);if(match)return match.rotation;}
 return best.rotation;
}
function accumulateRuns(width,height,data,horizontal){
 let score=0,longest=0,found=0;
 const lines=horizontal?height:width,across=horizontal?width:height;
 const minLen=Math.max(22,Math.round(across*.2));
 const read=(outer,inner)=>{
  const x=horizontal?inner:outer,y=horizontal?outer:inner,i=(y*width+x)*4;
  return data[i]<195&&data[i+1]<195&&data[i+2]<195&&data[i+3]>=155;
 };
 for(let outer=0;outer<lines;outer+=2){
  let start=-1;
  for(let inner=0;inner<=across;inner++){
   const ink=inner<across&&read(outer,inner);
   if(ink&&start<0)start=inner;
   if(!ink&&start>=0){
    const run=inner-start;start=-1;
    if(run>=minLen){score+=run*run/across;longest=Math.max(longest,run);found++;}
   }
  }
 }
 return {score,longest,found};
}
export function analyzeStaffDirection({width,height,data}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<80||height<80||
    !data||data.length<width*height*4)return {axis:'unknown',confidence:0};
 const horiz=accumulateRuns(width,height,data,true);
 const vert=accumulateRuns(width,height,data,false);
 const sum=horiz.score+vert.score;
 if(sum<8)return {axis:'unknown',confidence:0,horiz,vert};
 const dominance=(horiz.score-vert.score)/sum;
 const axis=dominance>.22?'horizontal':dominance<-.22?'vertical':'unknown';
 return {axis,confidence:Math.abs(dominance),horiz,vert};
}
export function selectRotationByStaffs(page,analysis){
 const native=supportedRotation(page.rotate);
 if(analysis?.axis==='unknown')return null;
 const candidate=analysis.axis==='horizontal'?[0,180]:[90,270];
 // Quan /Rotate és una de les opcions que deixa els pentagrames horitzontals, es respecta.
 // En escanejos sense /Rotate, el sentit de gir majoritari és 270° (vegeu Arcum).
 return candidate.includes(native)?native:
   analysis.axis==='horizontal'?0:270;
}
export async function analyzePdfPageOrientation(page,{maxDimension=700}={}){
 // Text real del PDF (títols i autoria) permet decidir també entre 90°/270°
 // i identificar pàgines amb contingut cap per avall.
 try{
  const text=await page.getTextContent({includeMarkedContent:false,disableCombineTextItems:false});
  const result=scoreReadableTextRotation(page,text);
  if(result!==null)return {rotation:result,source:'text'};
 }catch(e){console.warn('Orientació: lectura de text no disponible',e);}
 // Per a escanejos sense capa de text, detectar la direcció dels pentagrames
 // mitjançant un render menut en memòria; no s'aplica OCR ni s'envia cap PDF.
 const base=page.getViewport({scale:1,rotation:0});
 const scale=Math.min(1.5,Math.max(.15,maxDimension/Math.max(base.width,base.height)));
 const viewport=page.getViewport({scale,rotation:0});
 const width=Math.max(1,Math.round(viewport.width)),height=Math.max(1,Math.round(viewport.height));
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)return {rotation:supportedRotation(page.rotate),source:'native'};
 try{
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  await page.render({canvasContext:ctx,viewport,background:'#ffffff'}).promise;
  const analysis=analyzeStaffDirection(ctx.getImageData(0,0,width,height));
  const rotation=selectRotationByStaffs(page,analysis);
  if(rotation!==null)return {rotation,source:'staff'};
 }catch(e){console.warn('Orientació: anàlisi visual no disponible',e);}
 finally{canvas.width=0;canvas.height=0;}
 return {rotation:supportedRotation(page.rotate),source:'native'};
}
export function shouldKeepLegacyManual(initial){
 if(!initial||typeof initial!=='object')return false;
 if(initial.rotationMode==='manual')return true;
 if(initial.rotationMode==='auto')return false;
 // W2.3.1 guardava "rotation:0" en cada obertura sense gir manual.
 // No deixar que això impedisca corregir la biblioteca antiga automàticament.
 return RIGHT_ANGLE_ROTATIONS.includes(initial.rotation)&&initial.rotation!==0;
}
