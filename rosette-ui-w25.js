/* W2.5: Renderitzat del rosetó Android sobre el PDF, sense canviar el motor. */
import {rosetteOptions,rosettePetalPosition,clampRosetteCenter,ROSETTE_ROOT} from './rosette-w25.js';
import {musicalSymbolIcon} from './musical-symbols.js';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderRosetteMarkup({viewer,state,icon,labels,width,height,language='va'}){
 if(!state.annotating||!viewer||viewer.native)return '';
 if(state.rosetteLegacy){
  // Mode de compatibilitat: només s'exposa un botó per a tornar al rosetó.
  // No deixem el nucli flotant damunt de les anotacions ni dupliquem Desfer/Edita.
  const title=language==='va'?'Tornar al rosetó':'Volver al rosetón';
  return '<div class="pf-rosette-dock pf-rosette-legacy-toggle" role="toolbar" aria-label="'+escapeHtml(labels.edit)+'">'+
   '<button type="button" data-action="rosette-legacy" title="'+escapeHtml(title)+
   '" aria-label="'+escapeHtml(title)+'">'+icon('settings')+'<span>'+escapeHtml(title)+'</span></button></div>';
 }
 const expanded=state.rosetteExpanded,level=state.rosetteLevel;
 const center=clampRosetteCenter(state.rosetteX*width,state.rosetteY*height,width,height,expanded);
 const context={annotationTool:viewer.annotationTool,annotationColor:viewer.annotationColor,
  annotationThickness:viewer.annotationThickness,musicalSymbol:viewer.musicalSymbol,
  symbolGroup:state.symbolGroup,symbolPage:state.rosetteSymbolPage,
  musicalSymbolSize:viewer.musicalSymbolSize,fontSize:viewer.textStyle.fontSize,
  bold:viewer.textStyle.bold,underline:viewer.textStyle.underline};
 const selectedRoot=ROSETTE_ROOT.find(o=>o.tool===viewer.annotationTool||
   o.id==='shape'&&['line','rectangle','ellipse','arrow'].includes(viewer.annotationTool));
 const petals=(expanded?rosetteOptions(level,context):[]).map((o,i,arr)=>{
  const p=rosettePetalPosition(i,arr.length,level==='root'),root=level==='root';
  const selected=!!o.active||(root&&(o.tool===viewer.annotationTool||
    o.id==='shape'&&['line','rectangle','ellipse','arrow'].includes(viewer.annotationTool)));
  const image=o.symbol?musicalSymbolIcon(o.symbol):
   o.color?'<span class="pf-rose-swatch" style="background:'+escapeHtml(o.color)+'"></span>':
   o.width?'<span class="pf-rose-width">'+escapeHtml(o.width)+'</span>':
   icon(o.icon||'edit');
  const label=escapeHtml(o[language]);
  const classes='pf-rose-petal'+(root?' root-petal':'')+
   (p.inner?' inner-petal':' outer-petal')+(selected?' selected':'')+
   (o.unavailable?' not-ready':'');
  const style='--px:'+p.x.toFixed(2)+'px;--py:'+p.y.toFixed(2)+
   'px;--angle:'+(p.angle+90).toFixed(1)+'deg';
  return '<button type="button" class="'+classes+'" data-action="rosette-option" data-value="'+escapeHtml(o.id)+
    '" style="'+style+'" title="'+label+'" aria-label="'+label+'" aria-pressed="'+selected+'">'+
    '<svg class="pf-rose-petal-shape" viewBox="0 0 78 82" aria-hidden="true">'+
    '<path class="pf-rose-shadow" d="M39 80 C26 71 13 58 15 38 C17 22 27 11 39 3 C51 11 61 22 63 38 C65 58 52 71 39 80Z"/>'+
    '<path class="pf-rose-gold-tracery" d="M39 67 Q27 46 39 18 Q51 46 39 67Z"/></svg>'+
    '<span class="pf-rose-petal-content">'+image+'<small>'+label+'</small></span></button>';
 }).join('');
 const coreIcon=selectedRoot?.icon||'edit';
 const title=language==='va'?'Arrossega per a moure. Toca per a tornar':'Arrastra para mover. Pulsa para volver';
 const accessible=language==='va'?'Nucli del rosetó. Obrir, tornar o tancar':'Núcleo del rosetón. Abrir, volver o cerrar';
 const core='<button type="button" class="pf-rosette-core" data-action="rosette-core"'+
  ' aria-expanded="'+expanded+'" aria-label="'+escapeHtml(accessible)+'" title="'+escapeHtml(title)+'">'+
  '<svg viewBox="0 0 64 64" class="pf-rose-core-shape" aria-hidden="true">'+
  '<circle cx="32" cy="32" r="30"/><circle cx="32" cy="32" r="25"/>'+
  '<path d="M32 9Q15 30 32 55Q49 30 32 9Z M9 32Q30 15 55 32Q30 49 9 32Z"/></svg>'+
  '<span>'+icon(expanded?(level==='root'?'down':'back'):coreIcon)+'</span></button>';
 const inner='<div class="pf-rosette" data-level="'+escapeHtml(level)+'" data-expanded="'+expanded+
  '" style="left:'+center.x.toFixed(1)+'px;top:'+center.y.toFixed(1)+'px" '+
  'aria-label="'+escapeHtml(language==='va'?'Rosetó d’anotacions':'Rosetón de anotaciones')+'">'+
  petals+core+'</div>';
 const btn=(action,title,ico,disabled=false,cls='',text='')=>
  '<button type="button" data-action="'+action+'" class="'+cls+'" title="'+escapeHtml(title)+'"'+
  ' aria-label="'+escapeHtml(title)+'"'+(disabled?' disabled':'')+'>'+icon(ico)+
  (text?'<span>'+escapeHtml(text)+'</span>':'')+'</button>';
 return inner+'<div class="pf-rosette-dock" role="toolbar" aria-label="'+escapeHtml(labels.edit)+'">'+
  btn('annotation-undo',labels.undo,'restore',!viewer.canUndoAnnotation())+
  btn('annotation-text-edit',labels.editText,'textShape',!viewer.getSelectedText())+
  btn('annotation-delete-selected',labels.deleteSelected,'trash',!viewer.hasSelectedAnnotation())+
  btn('rosette-legacy',labels.advanced,'settings',false,state.rosetteLegacy?'selected':'',labels.advanced)+
  btn('viewer-annotate',labels.done,'check',false,'pf-rose-done',labels.done)+'</div>';
}
