/* W2.13.2 — Reconeixement de fulla en el navegador, sense OpenCV/CDN ni xarxa.
 * Detector conservador de paper contrastat contra una superfície uniforme.
 * Si no hi ha un contorn fiable, no inventa cantonades ni captura sol.
 * Coordenades normalitzades; conversió perspectivada només en captures fiables.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function median(a){if(!a.length)return 0;const sorted=a.sort((x,y)=>x-y);return sorted[Math.floor(sorted.length/2)];}
function area(q){return Math.abs(q.reduce((v,p,i)=>v+p.x*q[(i+1)%4].y-p.y*q[(i+1)%4].x,0))/2;}
export function detectDocument(image,{minimumContrast=21,minimumArea=.18}={}){
 const {width:w,height:h,data}=image||{};
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<40||h<40||!data||data.length<w*h*4)return null;
 const luma=new Uint8Array(w*h);
 let p=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=p*4;luma[p++]=(data[i]*77+data[i+1]*150+data[i+2]*29)>>8;
 }
 const bg=[],center=[],step=Math.max(2,Math.floor(Math.min(w,h)/45));
 for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
  const v=luma[y*w+x];
  if(x<w*.095||x>w*.905||y<h*.09||y>h*.91)bg.push(v);
  if(x>w*.32&&x<w*.68&&y>h*.32&&y<h*.68)center.push(v);
 }
 const background=median(bg),inside=median(center),contrast=inside-background;
 if(Math.abs(contrast)<minimumContrast)return null;
 const bright=contrast>0,threshold=(inside+background)/2;
 const mask=new Uint8Array(w*h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x;
  // Majorità de 5 píxels per a ignorar text / pols / soroll de vídeo.
  let votes=0;
  for(const j of [i,i-1,i+1,i-w,i+w])if(bright?luma[j]>threshold:luma[j]<threshold)votes++;
  if(votes>=3)mask[i]=1;
 }
 // Explorem els components connexos i preferim el més gran que cobrisca el centre.
 const visited=new Uint8Array(mask.length),queue=new Int32Array(mask.length);
 let best=null;
 for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){
  const start=y*w+x;if(!mask[start]||visited[start])continue;
  visited[start]=1;let head=0,tail=1;queue[0]=start;
  let count=0,minX=w,maxX=0,minY=h,maxY=0,containsCenter=false;
  let tl={score:Infinity,x:0,y:0},tr={score:-Infinity,x:0,y:0};
  let br={score:-Infinity,x:0,y:0},bl={score:Infinity,x:0,y:0};
  while(head<tail){
   const pos=queue[head++],xx=pos%w,yy=(pos-xx)/w;
   count++;minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);
   minY=Math.min(minY,yy);maxY=Math.max(maxY,yy);
   if(Math.abs(xx-w/2)<w*.09&&Math.abs(yy-h/2)<h*.09)containsCenter=true;
   const sum=xx+yy,diff=xx-yy;
   if(sum<tl.score)tl={score:sum,x:xx,y:yy};
   if(sum>br.score)br={score:sum,x:xx,y:yy};
   if(diff>tr.score)tr={score:diff,x:xx,y:yy};
   if(diff<bl.score)bl={score:diff,x:xx,y:yy};
   for(const next of [pos-1,pos+1,pos-w,pos+w]){
    if(next<0||next>=mask.length||visited[next]||!mask[next])continue;
    // No travessar l'extrem dret cap a l'esquerra de la següent fila.
    if(Math.abs((next%w)-xx)>1)continue;
    mask[next]=1;visited[next]=1;queue[tail++]=next;
   }
  }
  if(!containsCenter||count<w*h*minimumArea||count>w*h*.92)continue;
  if(minX<Math.ceil(w*.025)||maxX>w*.975||minY<h*.025||maxY>h*.975)continue;
  const points=[tl,tr,br,bl].map(a=>({x:a.x/w,y:a.y/h}));
  const a=area(points),bbox=((maxX-minX)*(maxY-minY))/(w*h);
  const ratio=a?count/(a*w*h):0;
  const widths=(dist(points[0],points[1])+dist(points[3],points[2]))/2;
  const heights=(dist(points[0],points[3])+dist(points[1],points[2]))/2;
  if(a<minimumArea||a>.9||bbox<minimumArea||ratio<.62||ratio>1.38||
    Math.min(widths,heights)<.21||Math.max(widths,heights)/Math.min(widths,heights)>3.5)continue;
  const confidence=clamp(.42+Math.min(Math.abs(contrast)/110,.25)+(.3-Math.abs(1-ratio)*.2),0,1);
  if(!best||a>best.area)best={points,confidence,area:a,contrast:Math.abs(contrast)};
 }
 return best;
}
export function quadrilateralDistance(a,b){
 if(!a||!b)return Infinity;
 return Math.max(...a.points.map((p,i)=>dist(p,b.points[i])));
}
export function stableDocument(history,{maxMovement=.024,required=4}={}){
 if(!Array.isArray(history)||history.length<required)return null;
 const last=history.at(-1);
 if(!last||last.confidence<.55)return null;
 for(const item of history.slice(-required)){
  if(!item||quadrilateralDistance(last,item)>maxMovement)return null;
 }
 return last;
}
export function documentImageDimensions(points,width,height,{maxEdge=2200,maxPixels=3500000}={}){
 if(!Array.isArray(points)||points.length!==4)throw new Error('S’esperaven quatre cantonades.');
 const q=points.map(p=>({x:p.x*width,y:p.y*height}));
 const rawWidth=Math.max(dist(q[0],q[1]),dist(q[3],q[2]));
 const rawHeight=Math.max(dist(q[0],q[3]),dist(q[1],q[2]));
 if(rawWidth<25||rawHeight<25)throw new Error('Fulla massa menuda.');
 const scale=Math.min(1,maxEdge/Math.max(rawWidth,rawHeight),Math.sqrt(maxPixels/(rawWidth*rawHeight)));
 return {width:Math.max(1,Math.round(rawWidth*scale)),height:Math.max(1,Math.round(rawHeight*scale))};
}
function gaussianSolve(matrix){
 const m=matrix.map(row=>[...row]);const n=m.length;
 for(let col=0;col<n;col++){
  let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(m[row][col])>Math.abs(m[pivot][col]))pivot=row;
  if(Math.abs(m[pivot][col])<1e-10)throw new Error('Perspectiva no vàlida.');
  [m[col],m[pivot]]=[m[pivot],m[col]];
  const div=m[col][col];for(let k=col;k<=n;k++)m[col][k]/=div;
  for(let row=0;row<n;row++){
   if(row===col)continue;const f=m[row][col];
   for(let k=col;k<=n;k++)m[row][k]-=f*m[col][k];
  }
 }
 return m.map(row=>row[n]);
}
export function perspectiveMatrix(points){
 if(!Array.isArray(points)||points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))
  throw new Error('Cantonades invàlides.');
 const vertices=[[0,0],[1,0],[1,1],[0,1]];
 const m=[];
 for(let i=0;i<4;i++){
  const [u,v]=vertices[i],{x,y}=points[i];
  m.push([u,v,1,0,0,0,-u*x,-v*x,x]);
  m.push([0,0,0,u,v,1,-u*y,-v*y,y]);
 }
 return gaussianSolve(m);
}
/** Projecció inversa del rectangle pla a la fotografia original. */
export function projectPoint(matrix,u,v){
 const [a,b,c,d,e,f,g,h]=matrix;
 const den=g*u+h*v+1;
 return {x:(a*u+b*v+c)/den,y:(d*u+e*v+f)/den};
}
/** Rectificació real de perspectiva, en local. No es guarda la imatge original. */
export function flattenDocument(sourceCanvas,points,{maxEdge=2200}={}){
 const width=sourceCanvas.width,height=sourceCanvas.height;
 if(!width||!height)throw new Error('La càmera no ha produït cap imatge.');
 const outSize=documentImageDimensions(points,width,height,{maxEdge});
 const canvas=document.createElement('canvas');canvas.width=outSize.width;canvas.height=outSize.height;
 const inCtx=sourceCanvas.getContext('2d',{willReadFrequently:true}),outCtx=canvas.getContext('2d');
 if(!inCtx||!outCtx)throw new Error('Canvas 2D no disponible.');
 const inData=inCtx.getImageData(0,0,width,height).data;
 const output=outCtx.createImageData(outSize.width,outSize.height),dst=output.data;
 const matrix=perspectiveMatrix(points.map(p=>({x:p.x*(width-1),y:p.y*(height-1)})));
 for(let y=0;y<outSize.height;y++){
  const v=y/Math.max(1,outSize.height-1);
  for(let x=0;x<outSize.width;x++){
   const u=x/Math.max(1,outSize.width-1);
   const mapped=projectPoint(matrix,u,v);
   const sx=Math.round(mapped.x),sy=Math.round(mapped.y),o=(y*outSize.width+x)*4;
   if(sx>=0&&sy>=0&&sx<width&&sy<height){
    const i=(sy*width+sx)*4;
    dst[o]=inData[i];dst[o+1]=inData[i+1];dst[o+2]=inData[i+2];dst[o+3]=255;
   }else{dst[o]=255;dst[o+1]=255;dst[o+2]=255;dst[o+3]=255;}
  }
 }
 outCtx.putImageData(output,0,0);
 return canvas;
}
