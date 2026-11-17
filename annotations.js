/* W2.3 — Anotacions de text i traços; manté schemaVersion 1 i compatibilitat W2.1/2.2. */
export const ANNOTATION_VERSION=1;
export const ANNOTATION_SHAPES=Object.freeze(['line','rectangle','ellipse','arrow']);
export const ANNOTATION_TOOLS=Object.freeze(['pen','highlighter',...ANNOTATION_SHAPES,'text']);
export const TEXT_SIZES=Object.freeze([.018,.026,.034,.044,.06,.08,.1]);
export const TEXT_OPACITIES=Object.freeze([.25,.5,.75,1]);
export const ANNOTATION_COLORS=Object.freeze(['#242424','#b51f34','#1b58a7','#21824f','#f0cf35','#f28b30']);
export const MAX_ANNOTATION_BYTES=512*1024;
const MAX_PAGES=500;
const MAX_STROKES=1500;
const MAX_POINTS=1600;
const MAX_TOTAL_POINTS=24000;
const isPlain=o=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
const between=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const clean=number=>Math.round(number*10000)/10000;

export function emptyAnnotations(){return {version:ANNOTATION_VERSION,pages:{}};}
export function normalizeAnnotations(input){
 if(input==null)return emptyAnnotations();
 if(!isPlain(input)||input.version!==ANNOTATION_VERSION||!isPlain(input.pages))throw new Error('Format d’anotacions desconegut.');
 const pages=Object.create(null),keys=Object.keys(input.pages);
 if(keys.length>MAX_PAGES)throw new Error('Massa pàgines amb anotacions.');
 let strokes=0,points=0;
 for(const key of keys){
  if(!/^[1-9]\d{0,4}$/.test(key)||Number(key)>10000)throw new Error('Pàgina d’anotació no vàlida.');
  const list=input.pages[key];
  if(!Array.isArray(list)||list.length>MAX_STROKES)throw new Error('Massa traços en una pàgina.');
  const out=[];
  for(const stroke of list){
   if(!isPlain(stroke)||!ANNOTATION_TOOLS.includes(stroke.tool)||!ANNOTATION_COLORS.includes(stroke.color)||
      !between(stroke.width,.001,.12)||!Array.isArray(stroke.points)||stroke.points.length<1||stroke.points.length>MAX_POINTS||
      (ANNOTATION_SHAPES.includes(stroke.tool)&&stroke.points.length!==2)||
      (stroke.tool==='text'&&stroke.points.length!==1))
     throw new Error('Traç d’anotació no vàlid.');
   const coords=stroke.points.map(point=>{
    if(!Array.isArray(point)||point.length!==2||!between(point[0],0,1)||!between(point[1],0,1))
     throw new Error('Coordenades d’anotació no vàlides.');
    return [clean(point[0]),clean(point[1])];
   });
   if(stroke.tool==='text'){
    if(typeof stroke.text!=='string'||stroke.text.length<1||stroke.text.length>280||
       !stroke.text.trim()||stroke.text.split('\\n').length>5||
       /[\\x00-\\x08\\x0b-\\x1f\\x7f]/.test(stroke.text)||
       !between(stroke.fontSize,.012,.12)||typeof stroke.bold!=='boolean'||
       typeof stroke.underline!=='boolean'||!between(stroke.opacity,.2,1))
      throw new Error('Text d’anotació no vàlid.');
    out.push({tool:'text',color:stroke.color,width:stroke.width,points:coords,
      text:stroke.text,fontSize:stroke.fontSize,bold:stroke.bold,
      underline:stroke.underline,opacity:stroke.opacity});
   }else out.push({tool:stroke.tool,color:stroke.color,width:stroke.width,points:coords});
   points+=coords.length;strokes++;
  }
  if(out.length)pages[key]=out;
 }
 if(strokes>MAX_STROKES||points>MAX_TOTAL_POINTS)throw new Error('Massa anotacions en la partitura.');
 const doc={version:ANNOTATION_VERSION,pages:{...pages}};
 if(JSON.stringify(doc).length>MAX_ANNOTATION_BYTES)throw new Error('Les anotacions excedixen l’espai admés per partitura.');
 return doc;
}
export function projectPoint(point,rotation=0){
 const [x,y]=point;
 switch(rotation){case 90:return [1-y,x];case 180:return [1-x,1-y];case 270:return [y,1-x];default:return [x,y];}
}
export function unprojectPoint(point,rotation=0){
 const [x,y]=point;
 switch(rotation){case 90:return [y,1-x];case 180:return [1-x,1-y];case 270:return [1-y,x];default:return [x,y];}
}
