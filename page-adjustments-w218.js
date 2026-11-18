/* Partitures Festeres Web W2.18 · PDF adjustments model (non-destructive). */
export const PAGE_ADJUSTMENT_KEY='w218:page:';
export const DEFAULT_PAGE_ADJUSTMENT=Object.freeze({
 rotationQuarterTurns:0,cropLeft:0,cropTop:0,cropRight:0,cropBottom:0,contrast:1
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function normalizePageAdjustment(input={}){
 const v=input&&typeof input==='object'?input:{};
 const num=(key,def,lo,hi)=>Number.isFinite(Number(v[key]))?clamp(Number(v[key]),lo,hi):def;
 return {
  rotationQuarterTurns:((Math.trunc(num('rotationQuarterTurns',0,-10000,10000))%4)+4)%4,
  cropLeft:num('cropLeft',0,0,.35),cropTop:num('cropTop',0,0,.35),
  cropRight:num('cropRight',0,0,.35),cropBottom:num('cropBottom',0,0,.35),
  contrast:num('contrast',1,.65,1.7)
 };
}
export function isDefaultAdjustment(value){
 const a=normalizePageAdjustment(value);
 return a.rotationQuarterTurns===0&&a.cropLeft===0&&a.cropTop===0&&
  a.cropRight===0&&a.cropBottom===0&&Math.abs(a.contrast-1)<.0001;
}
export function normalizePageAdjustments(value={}){
 if(!value||typeof value!=='object')return {};
 const out={};
 for(const [key,v] of Object.entries(value)){
  const n=Number(key);
  if(!Number.isSafeInteger(n)||n<1||n>10000)continue;
  const a=normalizePageAdjustment(v);
  if(!isDefaultAdjustment(a))out[String(n)]=a;
 }
 return out;
}
export function quarterTurns(rotation){
 return ((Math.round(Number(rotation||0)/90)%4)+4)%4;
}
// Mapeig idèntic al model PdfPageAdjustmentStore d'Android.
export function displayedCropMargins(value,rotation=0){
 const a=normalizePageAdjustment(value),q=quarterTurns(rotation);
 if(q===1)return {left:a.cropBottom,top:a.cropLeft,right:a.cropTop,bottom:a.cropRight};
 if(q===2)return {left:a.cropRight,top:a.cropBottom,right:a.cropLeft,bottom:a.cropTop};
 if(q===3)return {left:a.cropTop,top:a.cropRight,right:a.cropBottom,bottom:a.cropLeft};
 return {left:a.cropLeft,top:a.cropTop,right:a.cropRight,bottom:a.cropBottom};
}
export function originalCropMargins(m,rotation=0){
 const q=quarterTurns(rotation);
 if(q===1)return {cropLeft:m.top,cropTop:m.right,cropRight:m.bottom,cropBottom:m.left};
 if(q===2)return {cropLeft:m.right,cropTop:m.bottom,cropRight:m.left,cropBottom:m.top};
 if(q===3)return {cropLeft:m.bottom,cropTop:m.left,cropRight:m.top,cropBottom:m.right};
 return {cropLeft:m.left,cropTop:m.top,cropRight:m.right,cropBottom:m.bottom};
}
export function updatedPageAdjustments(value,page,adjustment,count=0,all=false){
 const out={...normalizePageAdjustments(value)},v=normalizePageAdjustment(adjustment);
 const assign=n=>{if(isDefaultAdjustment(v))delete out[String(n)];else out[String(n)]=v;};
 if(all){for(let i=1;i<=Math.max(0,Math.min(10000,count));i++)assign(i);}
 else if(Number.isInteger(page)&&page>=1)assign(page);
 return out;
}
