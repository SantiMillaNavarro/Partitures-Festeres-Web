/* W2.5 — Rosetó inspirat directament en QuickAnnotationRosette de PdfViewerScreen.kt.
   Només navega i configura les ferramentes web existents; no altera el model de dades. */
import {ANNOTATION_COLORS,TEXT_SIZES} from './annotations.js';
import {MUSICAL_SYMBOLS,SYMBOL_GROUPS,SYMBOL_SIZES} from './musical-symbols.js';

export const ROSETTE_ROOT=Object.freeze([
 {id:'select',tool:'select',icon:'move',va:'Seleccionar',es:'Seleccionar'},
 {id:'pencil',tool:'pen',icon:'edit',va:'Llapis',es:'Lápiz',level:'pencil'},
 {id:'highlighter',tool:'highlighter',icon:'edit',va:'Ressaltador',es:'Resaltador',level:'highlighter'},
 {id:'text',tool:'text',icon:'textShape',va:'Text',es:'Texto',level:'text'},
 {id:'shape',tool:'rectangle',icon:'rectShape',va:'Formes',es:'Formas',level:'shape'},
 {id:'symbols',tool:'symbol',icon:'musicSymbol',va:'Símbols',es:'Símbolos',level:'symbols'},
 {id:'crop',icon:'fit',va:'Retall',es:'Recorte',unavailable:true},
 {id:'eraser',tool:'eraser',icon:'erase',va:'Goma',es:'Goma'}
]);
const option=(id,va,es,icon,extra={})=>({id,va,es,icon,...extra});
const back=(to)=>option('back','Tornar','Volver','back',{back:to});
const colorChoices=()=>[
 ...ANNOTATION_COLORS.map((color,i)=>option('color:'+color,color,color,'', {color})),
 back(null)
];
const widthChoices=()=>[
 ...[1,2,3,4,5].map(n=>option('thickness:'+n,String(n),String(n),'lineShape',{width:n})),
 back(null)
];
const colorNames={pencil:'pencil',highlighter:'highlighter',shape:'shape',text:'text',symbols:'symbols'};
export const ROSETTE_FAMILIES=Object.freeze(['pencil','highlighter','text','shape','symbols']);
export function rosetteParent(level){
 if(!level||level==='root')return null;
 if(level==='symbol-picker')return 'symbols';
 if(level==='shape-type')return 'shape';
 for(const family of ROSETTE_FAMILIES){
  if(level===family)return 'root';
  if(level.startsWith(family+'-'))return family;
 }
 return 'root';
}
export function rosetteOptions(level,ctx={}){
 const base=level||'root';
 if(base==='root')return ROSETTE_ROOT.map(o=>({...o}));
 if(base==='pencil'||base==='highlighter')return [
  option('open-color','Color','Color','edit',{level:base+'-color'}),
  option('open-width','Grossor','Grosor','lineShape',{level:base+'-width'}),
  back('root')
 ];
 if(base==='text')return [
  option('open-color','Color','Color','edit',{level:'text-color'}),
  option('open-size','Grandària','Tamaño','textShape',{level:'text-size'}),
  option('text-bold','Negreta','Negrita','textShape',{toggle:'bold',active:!!ctx.bold}),
  option('text-underline','Subratllat','Subrayado','textShape',{toggle:'underline',active:!!ctx.underline}),
  back('root')
 ];
 if(base==='shape')return [
  option('open-type','Forma','Forma','rectShape',{level:'shape-type'}),
  option('open-color','Color','Color','edit',{level:'shape-color'}),
  option('open-width','Grossor','Grosor','lineShape',{level:'shape-width'}),
  back('root')
 ];
 if(base==='shape-type')return [
  option('shape:line','Línia','Línea','lineShape',{tool:'line'}),
  option('shape:rectangle','Rectangle','Rectángulo','rectShape',{tool:'rectangle'}),
  option('shape:ellipse','El·lipse','Elipse','ellipseShape',{tool:'ellipse'}),
  option('shape:arrow','Fletxa','Flecha','arrowShape',{tool:'arrow'}),
  back('shape')
 ];
 if(base==='symbols')return [
  ...SYMBOL_GROUPS.map(g=>option('category:'+g.id,g.name.va,g.name.es,'musicSymbol',{category:g.id})),
  option('open-color','Color','Color','edit',{level:'symbols-color'}),
  option('open-size','Grandària','Tamaño','textShape',{level:'symbols-size'}),
  back('root')
 ];
 if(base==='symbol-picker'){
  const items=Object.entries(MUSICAL_SYMBOLS).filter(([,symbol])=>symbol.group===(ctx.symbolGroup||'notes'));
  const page=Math.max(0,Math.min(ctx.symbolPage||0,Math.max(0,Math.ceil(items.length/6)-1)));
  const options=items.slice(page*6,page*6+6).map(([id,spec])=>
   option('symbol:'+id,spec.name.va,spec.name.es,'musicSymbol',{symbol:id,active:ctx.musicalSymbol===id}));
  if(page>0)options.push(option('previous','Anterior','Anterior','back',{page:page-1}));
  if(page<Math.ceil(items.length/6)-1)options.push(option('next','Següent','Siguiente','next',{page:page+1}));
  options.push(back('symbols'));
  return options;
 }
 if(base.endsWith('-color'))return colorChoices().map(o=>
  o.id==='back'?back(rosetteParent(base)):{...o,active:ctx.annotationColor===o.color});
 if(base.endsWith('-width'))return widthChoices().map(o=>
  o.id==='back'?back(rosetteParent(base)):{...o,active:ctx.annotationThickness===o.width});
 if(base==='text-size')return [
  ...TEXT_SIZES.map(size=>option('text-size:'+size,Math.round(size*1000)/10+'%',Math.round(size*1000)/10+'%','textShape',{textSize:size,active:ctx.fontSize===size})),
  back('text')
 ];
 if(base==='symbols-size')return [
  ...SYMBOL_SIZES.map(size=>option('symbol-size:'+size,Math.round(size*1000)/10+'%',Math.round(size*1000)/10+'%','musicSymbol',{symbolSize:size,active:ctx.musicalSymbolSize===size})),
  back('symbols')
 ];
 return [back('root')];
}
export function rosettePetalPosition(index,count,root=false){
 if(root&&count===8){
  const angle=index<4?-90+index*90:-45+(index-4)*90;
  const r=index<4?56:99;
  return {x:Math.cos(angle*Math.PI/180)*r,y:Math.sin(angle*Math.PI/180)*r,
    angle,inner:index<4};
 }
 const angle=-90+index*360/Math.max(1,count),r=91;
 return {x:Math.cos(angle*Math.PI/180)*r,y:Math.sin(angle*Math.PI/180)*r,angle,inner:false};
}
export function clampRosetteCenter(x,y,width,height,expanded=true){
 const margin=expanded?142:35;
 const clamp=(n,lo,hi)=>hi>=lo?Math.max(lo,Math.min(hi,n)):(lo+hi)/2;
 return {x:clamp(x,margin,width-margin),y:clamp(y,margin,height-margin)};
}
