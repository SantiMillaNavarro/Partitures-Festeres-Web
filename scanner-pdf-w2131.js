/* W2.13.1 — Escàner web. PDF de fotos, en local, sense biblioteques externes.
   Android usa Google ML Kit; la web usa captura del sistema + Canvas + PDF 1.4.
   Màxim 30 pàgines, miniatures acotades, descodificació d'una pàgina per vegada.
*/
export const SCAN_PAGE_LIMIT=30;
export const SCAN_FILE_LIMIT=24*1024*1024;
export const SCAN_TOTAL_LIMIT=180*1024*1024;
export const SCAN_PDF_LIMIT=100*1024*1024;
export const SCAN_MAX_PIXELS=4_000_000;
export const SCAN_MAX_EDGE=2400;
export const SCAN_FILTERS=Object.freeze(['original','enhanced','gray','bw']);
const encoder=new TextEncoder();
export function normalizeScanName(raw){
 let name=String(raw??'').trim().replace(/\.pdf$/i,'').trim();
 if(!name||name.length>115||/[\/\\\x00-\x1f\x7f<>:"|?*]/.test(name)||
    name==='.'||name==='..'||/^\.+$/.test(name))
  throw new Error('Nom de partitura no vàlid.');
 return name+'.pdf';
}
export function scanFolderChoices(scores){
 const all=new Set(['']);
 for(const s of scores||[]){
  const p=String(s?.path||'').split('/');
  p.pop();let at='';
  for(const part of p){
   if(!part||part==='.'||part==='..')continue;
   at=at?at+'/'+part:part;all.add(at);
  }
 }
 return [...all].sort((a,b)=>a===''?-1:b===''?1:a.localeCompare(b,'ca',{numeric:true}));
}
export function uniqueScanPath(path,existing){
 const keys=new Set(existing||[]);
 if(!keys.has(path))return path;
 const stem=path.slice(0,-4);
 for(let n=2;n<=9999;n++){
  const proposed=stem+' ('+n+').pdf';
  if(!keys.has(proposed))return proposed;
 }
 throw new Error('Ja existixen massa partitures amb el mateix nom.');
}
function validRotation(n){return Number.isInteger(n)&&n%90===0?((n%360)+360)%360:0;}
export function applyScanFilter(ctx,filter){
 ctx.filter=filter==='enhanced'?'contrast(1.16) brightness(1.04)':
            filter==='gray'?'grayscale(1) contrast(1.12)':
            filter==='bw'?'grayscale(1) contrast(2.25) brightness(1.12)':'none';
}
function jpegBlob(canvas){
 return new Promise((resolve,reject)=>{
  try{
   canvas.toBlob(blob=>blob&&blob.type==='image/jpeg'?resolve(blob):
     reject(new Error('No s’ha pogut convertir una pàgina a JPEG.')),'image/jpeg',0.85);
  }catch(e){reject(e);}
 });
}
async function decodeImage(file){
 if(!file||file.size===0)throw new Error('Imatge buida.');
 if(file.size>SCAN_FILE_LIMIT)throw new Error('La imatge supera el límit de 24 MB.');
 let bitmap=null,objectUrl=null,image=null;
 if(typeof createImageBitmap==='function'){
  try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{}
 }
 if(bitmap)return {width:bitmap.width,height:bitmap.height,draw:(ctx,w,h)=>ctx.drawImage(bitmap,0,0,w,h),close:()=>bitmap.close?.()};
 try{
  objectUrl=URL.createObjectURL(file);
  image=new Image();
  image.decoding='async';
  image.src=objectUrl;
  if(image.decode)await image.decode();
  else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Format d’imatge no compatible.'));});
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('No s’ha pogut llegir la imatge.');
  return {width:image.naturalWidth,height:image.naturalHeight,draw:(ctx,w,h)=>ctx.drawImage(image,0,0,w,h),
    close:()=>{image.src='';URL.revokeObjectURL(objectUrl);}};
 }catch(e){if(objectUrl)URL.revokeObjectURL(objectUrl);throw e;}
}
export async function scanImageAsJpeg(page){
 if(!SCAN_FILTERS.includes(page?.filter))throw new Error('Filtre desconegut.');
 const source=await decodeImage(page.file);
 try{
  const rotation=validRotation(page.rotation);
  const isSideways=rotation===90||rotation===270;
  const rw=isSideways?source.height:source.width;
  const rh=isSideways?source.width:source.height;
  if(!rw||!rh||rw>20000||rh>20000)throw new Error('Dimensions d’imatge no compatibles.');
  const scale=Math.min(1,SCAN_MAX_EDGE/Math.max(rw,rh),Math.sqrt(SCAN_MAX_PIXELS/(rw*rh)));
  const width=Math.max(1,Math.round(rw*scale)),height=Math.max(1,Math.round(rh*scale));
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('No hi ha Canvas 2D disponible.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  const sw=Math.max(1,Math.round(source.width*scale));
  const sh=Math.max(1,Math.round(source.height*scale));
  ctx.save();ctx.translate(width/2,height/2);ctx.rotate(rotation*Math.PI/180);
  applyScanFilter(ctx,page.filter);
  source.draw(ctx,sw,sh); // Fixem l'origen abans de dibuixar.
  ctx.restore();
  // drawImage ha de partir del centre, no de (0,0).
  const data=await jpegBlob(canvas);
  canvas.width=0;canvas.height=0;
  return {bytes:new Uint8Array(await data.arrayBuffer()),width,height};
 }finally{source.close();}
}
/* Una foto convertida en JPEG ocupa una pàgina A4 orientada com la imatge,
   amb marge de 12 punts, però sense retallar cap partitura. */
export function pdfPageLayout(width,height){
 const landscape=width>height, pw=landscape?841.89:595.28, ph=landscape?595.28:841.89;
 const margin=12;
 const ratio=Math.min((pw-2*margin)/width,(ph-2*margin)/height);
 return {width:pw,height:ph,x:(pw-width*ratio)/2,y:(ph-height*ratio)/2,
  drawWidth:width*ratio,drawHeight:height*ratio};
}
function pdfText(n){return encoder.encode(String(n));}
export function assembleScanPdf(images){
 if(!Array.isArray(images)||!images.length||images.length>SCAN_PAGE_LIMIT)
  throw new RangeError('Nombre de pàgines no vàlid.');
 const chunks=[];let byteLength=0;
 const push=(piece)=>{const bytes=typeof piece==='string'?pdfText(piece):piece;chunks.push(bytes);byteLength+=bytes.length;};
 const objects=[], pageIds=[];
 for(let i=0;i<images.length;i++)pageIds.push(3+i*3);
 objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
 objects[2]='<< /Type /Pages /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] /Count '+images.length+' >>';
 for(let i=0;i<images.length;i++){
  const image=images[i],id=pageIds[i],imageId=id+1,contentId=id+2;
  if(!(image.bytes instanceof Uint8Array)||image.bytes.length<20||
     !Number.isSafeInteger(image.width)||!Number.isSafeInteger(image.height)||
     image.width<1||image.height<1)throw new Error('Pàgina d’imatge invàlida.');
  const layout=pdfPageLayout(image.width,image.height);
  const num=v=>Number(v).toFixed(3);
  objects[id]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+num(layout.width)+' '+num(layout.height)+'] /Resources << /XObject << /Img'+i+' '+imageId+' 0 R >> >> /Contents '+contentId+' 0 R >>';
  objects[imageId]=[
    '<< /Type /XObject /Subtype /Image /Width '+image.width+' /Height '+image.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+image.bytes.length+' >>\nstream\n',
    image.bytes,
    '\nendstream'
  ];
  const cmds='q\n'+num(layout.drawWidth)+' 0 0 '+num(layout.drawHeight)+' '+num(layout.x)+' '+num(layout.y)+' cm\n/Img'+i+' Do\nQ\n';
  const cmdByte=pdfText(cmds);
  objects[contentId]=['<< /Length '+cmdByte.length+' >>\nstream\n',cmdByte,'endstream'];
 }
 push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
 const offsets=[0];
 for(let id=1;id<objects.length;id++){
  offsets[id]=byteLength;push(id+' 0 obj\n');
  const pieces=Array.isArray(objects[id])?objects[id]:[objects[id]];
  for(const part of pieces)push(part);
  push('\nendobj\n');
 }
 const startxref=byteLength;
 push('xref\n0 '+objects.length+'\n0000000000 65535 f \n');
 for(let id=1;id<objects.length;id++)push(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
 push('trailer\n<< /Root 1 0 R /Size '+objects.length+' >>\nstartxref\n'+startxref+'\n%%EOF\n');
 if(byteLength>SCAN_PDF_LIMIT)throw new Error('El PDF supera el límit de 100 MB.');
 return new Blob(chunks,{type:'application/pdf'});
}
export async function generateScannedPdf(pages,{onProgress=()=>{}}={}){
 if(!Array.isArray(pages)||!pages.length||pages.length>SCAN_PAGE_LIMIT)
  throw new RangeError('Afig entre 1 i 30 pàgines.');
 const processed=[];
 for(let i=0;i<pages.length;i++){
  processed.push(await scanImageAsJpeg(pages[i]));
  onProgress(i+1,pages.length);
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 return assembleScanPdf(processed);
}
