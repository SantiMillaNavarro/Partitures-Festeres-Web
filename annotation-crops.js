/* W2.8 — Retalls d'una regió del PDF com a imatge local.
   Coord. normals: independents del zoom. No s'altera l'arxiu PDF. */
import {projectPoint,unprojectPoint} from './annotations.js';
export const MAX_CROP_DATA_LENGTH=120000; // JPEG base64; pressupost per retall
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const r4=n=>Math.round(n*10000)/10000;
export const validCropDataUri=data=>
 typeof data==='string'&&data.length>=40&&data.length<=MAX_CROP_DATA_LENGTH&&
 /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(data);

export function cropRectFromGesture(start,end,rotation=0,w=600,h=800){
 if(!Array.isArray(start)||!Array.isArray(end)||w<1||h<1)return null;
 const a=projectPoint(start,rotation),b=projectPoint(end,rotation);
 const x=clamp(Math.min(a[0],b[0]),0,1),y=clamp(Math.min(a[1],b[1]),0,1);
 const width=clamp(Math.max(a[0],b[0])-x,0,1-x),height=clamp(Math.max(a[1],b[1])-y,0,1-y);
 if(width*w<15||height*h<15)return null;
 return {point:unprojectPoint([r4(x),r4(y)],rotation).map(r4),
  boxWidth:r4(width),boxHeight:r4(height),screenX:r4(x),screenY:r4(y)};
}
export function captureCropAsJpeg(source,rect){
 if(!source||!rect||!source.width||!source.height)return null;
 const x=clamp(rect.screenX,0,1),y=clamp(rect.screenY,0,1);
 const w=clamp(rect.boxWidth,0,1-x),h=clamp(rect.boxHeight,0,1-y);
 if(w<=0||h<=0)return null;
 const sw=w*source.width,sh=h*source.height;
 const scale=Math.min(1,640/sw,640/sh,Math.sqrt(260000/(sw*sh)));
 if(!Number.isFinite(scale)||scale<=0)return null;
 const dst=document.createElement('canvas');
 for(const fraction of [1,.8,.64]){
  dst.width=Math.max(8,Math.round(sw*scale*fraction));
  dst.height=Math.max(8,Math.round(sh*scale*fraction));
  const ctx=dst.getContext('2d',{alpha:false});
  if(!ctx)return null;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,dst.width,dst.height);
  ctx.drawImage(source,x*source.width,y*source.height,sw,sh,0,0,dst.width,dst.height);
  for(const quality of [.82,.65,.48]){
   const data=dst.toDataURL('image/jpeg',quality);
   if(validCropDataUri(data))return data;
  }
 }
 return null; // No persistir mai un retall truncat o invàlid.
}
