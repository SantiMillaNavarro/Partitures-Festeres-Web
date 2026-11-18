/* W2.13.3 — Punts de retall no destructius: TL, TR, BR, BL normalitzats.
 * La geometria és independent del zoom, la rotació del PDF i del dispositiu.
 */
export const DEFAULT_CROP=Object.freeze([{x:.04,y:.04},{x:.96,y:.04},{x:.96,y:.96},{x:.04,y:.96}]);
export const FULL_CROP=Object.freeze([{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]);
export const cloneCrop=points=>points?.map(p=>({x:p.x,y:p.y}))||null;
export function cropArea(points){
 if(!Array.isArray(points)||points.length!==4)return 0;
 let value=0;
 for(let i=0;i<4;i++){
  const a=points[i],b=points[(i+1)%4];
  if(!a||!b||!Number.isFinite(a.x)||!Number.isFinite(a.y)||!Number.isFinite(b.x)||!Number.isFinite(b.y))return 0;
  value+=a.x*b.y-a.y*b.x;
 }
 return value/2;
}
export function validCrop(points){
 if(!Array.isArray(points)||points.length!==4)return false;
 if(!points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))return false;
 if(cropArea(points)<.045)return false;
 for(let i=0;i<4;i++){
  const a=points[i],b=points[(i+1)%4],c=points[(i+2)%4];
  if(Math.hypot(a.x-b.x,a.y-b.y)<.11)return false;
  if((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)<.002)return false;
 }
 return true;
}
export function movedCrop(points,index,position){
 if(!validCrop(points)||!Number.isInteger(index)||index<0||index>=4)return null;
 if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.y))return null;
 const result=cloneCrop(points);
 result[index]={x:Math.max(0,Math.min(1,position.x)),y:Math.max(0,Math.min(1,position.y))};
 return validCrop(result)?result:null;
}
export function cropPointsAttr(points,scale=1000){
 if(!validCrop(points))return '';
 return points.map(p=>(p.x*scale).toFixed(2)+','+(p.y*scale).toFixed(2)).join(' ');
}
