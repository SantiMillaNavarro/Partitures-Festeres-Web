/* W2.2 — Geometria de formes i selecció en coordenades locals del PDF.
   Funcions pures: els fitxers W2.1 es continuen llegint sense migració. */
import {projectPoint} from './annotations.js';

const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const r4=v=>Math.round(v*10000)/10000;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const THICKNESS_LEVELS=Object.freeze([1,2,3,4,5]);
export function strokeWidth(tool,level=3){
 const i=clamp(Math.round(Number(level)||3),1,5)-1;
 if(tool==='highlighter')return [.016,.028,.042,.062,.085][i];
 if(tool==='pen')return [.0025,.0038,.0055,.008,.012][i];
 return [.002,.0035,.005,.0075,.011][i];
}
export function translatedStroke(stroke,dx,dy){
 const points=stroke.points;
 const x=points.map(p=>p[0]),y=points.map(p=>p[1]);
 dx=clamp(dx,-Math.min(...x),1-Math.max(...x));
 dy=clamp(dy,-Math.min(...y),1-Math.max(...y));
 return {...stroke,points:points.map(p=>[r4(clamp(p[0]+dx,0,1)),r4(clamp(p[1]+dy,0,1))])};
}
export function strokePath(stroke,w,h,rotation=0){
 const p=stroke.points.map(q=>projectPoint(q,rotation)).map(([x,y])=>[x*w,y*h]);
 if(!p.length)return '';
 const fmt=(v)=>v.toFixed(2);
 const P=([x,y])=>fmt(x)+' '+fmt(y);
 // En començar a arrossegar, la forma encara té un sol extrem: dibuixa un punt provisional.
 if(p.length<2)return 'M'+P(p[0])+' l0.01 0.01';
 if(stroke.tool==='rectangle'){
  const [a,b]=p;return 'M'+P(a)+' H'+fmt(b[0])+' V'+fmt(b[1])+' H'+fmt(a[0])+' Z';
 }
 if(stroke.tool==='ellipse'){
  const [a,b]=p,cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,rx=Math.abs(b[0]-a[0])/2,ry=Math.abs(b[1]-a[1])/2;
  return 'M'+P([cx-rx,cy])+' A'+fmt(rx)+' '+fmt(ry)+' 0 1 0 '+P([cx+rx,cy])+' A'+fmt(rx)+' '+fmt(ry)+' 0 1 0 '+P([cx-rx,cy]);
 }
 if(stroke.tool==='arrow'){
  const [a,b]=p,len=dist(a,b);
  if(len<1)return 'M'+P(a)+' l0.01 0.01';
  const ux=(b[0]-a[0])/len,uy=(b[1]-a[1])/len;
  const head=Math.min(24,Math.max(8,len*.19));
  const left=[b[0]-ux*head-uy*head*.43,b[1]-uy*head+ux*head*.43];
  const right=[b[0]-ux*head+uy*head*.43,b[1]-uy*head-ux*head*.43];
  return 'M'+P(a)+' L'+P(b)+' M'+P(left)+' L'+P(b)+' L'+P(right);
 }
 return p.map((q,i)=>(i?'L':'M')+P(q)).join(' ')+(p.length===1?' l0.01 0.01':'');
}
// El text es dibuixa amb un <text> SVG en la pàgina, orientat amb el PDF.
// Les mides són relatives a la part visible de la pàgina, no al zoom del navegador.
export function textBounds(stroke,w,h){
 const size=stroke.fontSize*Math.min(w,h);
 const lines=stroke.text.split('\n');
 const glyphLength=line=>Array.from(line).reduce((n,c)=>n+(/[\u2e80-\uffff]/u.test(c)?1.05:.58),0);
 const width=Math.max(size*.65,...lines.map(line=>glyphLength(line)*size));
 return {width,height:lines.length*size*1.26,fontPx:size,lines};
}
function textDistance(stroke,point,w,h,rotation){
 const anchor=projectPoint(stroke.points[0],rotation),touch=projectPoint(point,rotation);
 const dx=(touch[0]-anchor[0])*w,dy=(touch[1]-anchor[1])*h;
 const rot=((rotation%360)+360)%360;
 const local=rot===90?[dy,-dx]:rot===180?[-dx,-dy]:rot===270?[-dy,dx]:[dx,dy];
 const {width,height}=textBounds(stroke,w,h);
 return Math.hypot(Math.max(0,-local[0],local[0]-width),Math.max(0,-local[1],local[1]-height));
}
function segmentDistance(point,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
 const t=den===0?0:clamp(((point[0]-a[0])*dx+(point[1]-a[1])*dy)/den,0,1);
 return dist(point,[a[0]+t*dx,a[1]+t*dy]);
}
export function strokeDistance(stroke,point,w,h,rotation=0){
 const p=stroke.points.map(q=>projectPoint(q,rotation)).map(([x,y])=>[x*w,y*h]);
 const q=projectPoint(point,rotation);const target=[q[0]*w,q[1]*h];
 if(!p.length)return Infinity;
 if(stroke.tool==='text')return textDistance(stroke,point,w,h,rotation);
 if(p.length===1)return dist(target,p[0]);
 if(stroke.tool==='rectangle'){
  const [a,b]=p,minx=Math.min(a[0],b[0]),maxx=Math.max(a[0],b[0]),miny=Math.min(a[1],b[1]),maxy=Math.max(a[1],b[1]);
  if(target[0]>=minx&&target[0]<=maxx&&target[1]>=miny&&target[1]<=maxy)return 0;
  return Math.hypot(Math.max(minx-target[0],0,target[0]-maxx),Math.max(miny-target[1],0,target[1]-maxy));
 }
 if(stroke.tool==='ellipse'){
  const [a,b]=p,cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,rx=Math.abs(b[0]-a[0])/2,ry=Math.abs(b[1]-a[1])/2;
  if(rx<1||ry<1)return segmentDistance(target,a,b);
  const qx=(target[0]-cx)/rx,qy=(target[1]-cy)/ry;
  if(qx*qx+qy*qy<=1)return 0;
  let best=Infinity;
  let prev=[cx+rx,cy];
  for(let i=1;i<=64;i++){
   const t=i*Math.PI*2/64,next=[cx+rx*Math.cos(t),cy+ry*Math.sin(t)];
   best=Math.min(best,segmentDistance(target,prev,next));prev=next;
  }
  return best;
 }
 let best=Infinity;
 for(let i=1;i<p.length;i++)best=Math.min(best,segmentDistance(target,p[i-1],p[i]));
 return best;
}
export function hitTestStroke(strokes,point,w,h,rotation=0,zoom=1){
 const pxTol=14/Math.max(1,zoom);
 for(let i=strokes.length-1;i>=0;i--){
  const s=strokes[i],tol=pxTol+s.width*Math.min(w,h)/2;
  if(strokeDistance(s,point,w,h,rotation)<=tol)return i;
 }
 return -1;
}
