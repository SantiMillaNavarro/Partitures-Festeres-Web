/* W2.15.2 — Selector de partitures sobre el PDF, a l'estil del
 * ScorePickerDialog de PdfViewerScreen.kt (Android v1.11.15).
 * No remunta el canvas ni reinicia PDF.js quan s'escriu la cerca.
 */
import {cleanSearchText} from './search-filters.js';

const esc=text=>String(text??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

export function prepareViewerScoreItems(scores=[],titleFor=score=>score?.metadata?.title||score?.path||''){
 return (Array.isArray(scores)?scores:[]).filter(score=>score?.path).map((score,index)=>{
  const path=String(score.path);
  const fileName=path.split('/').at(-1)||path;
  const title=String(titleFor(score)||fileName);
  const relativePath=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'';
  const terms=cleanSearchText([title,fileName,path,score.metadata?.title,
   score.metadata?.composer].filter(Boolean).join(' '));
  return {path,title,fileName,relativePath,index,terms};
 });
}
export function filterViewerScoreItems(items,search=''){
 const words=cleanSearchText(search).split(/\s+/).filter(Boolean);
 if(!words.length)return items;
 return items.filter(item=>words.every(word=>item.terms.includes(word)));
}

export class ViewerScorePicker{
 constructor({onSelect=async()=>{},onWarning=()=>{},onClose=()=>{}}={}){
  this.onSelect=onSelect;this.onWarning=onWarning;this.onClose=onClose;
  this.root=null;this.items=[];this.currentPath='';this.language='va';
  this.previousFocus=null;this.busy=false;
  this.boundKeydown=e=>this.onKeydown(e);
 }
 get active(){return !!this.root;}
 tr(va,es){return this.language==='es'?es:va;}
 open({scores=[],currentPath='',language='va',sequenceName='',titleFor}={}){
  if(this.root)this.close({restoreFocus:false});
  this.items=prepareViewerScoreItems(scores,titleFor);
  if(!this.items.length)return false;
  this.currentPath=String(currentPath||'');
  this.language=language==='es'?'es':'va';
  this.busy=false;
  this.previousFocus=document.activeElement;
  const root=document.createElement('div');
  root.className='pf-score-picker-backdrop';
  const title=this.tr('Cercar i saltar a una partitura','Buscar y saltar a una partitura');
  root.innerHTML=
   '<section class="pf-score-picker-panel" role="dialog" aria-modal="true" aria-labelledby="pf-score-picker-title">'+
    '<header class="pf-score-picker-header"><div class="pf-score-picker-heading">'+
     '<h2 id="pf-score-picker-title">'+esc(title)+'</h2>'+
     (sequenceName?'<p>'+esc(sequenceName)+'</p>':'')+
    '</div><button type="button" class="pf-score-picker-close" data-picker-action="close" aria-label="'+
     esc(this.tr('Tancar','Cerrar'))+'">×</button></header>'+
    '<div class="pf-score-picker-search"><span aria-hidden="true">⌕</span>'+
     '<label class="pf-score-picker-sr-only" for="pf-score-picker-input">'+esc(this.tr('Buscar partitura','Buscar partitura'))+'</label>'+
     '<input id="pf-score-picker-input" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" '+
      'placeholder="'+esc(this.tr('Nom de la partitura o carpeta','Nombre de partitura o carpeta'))+'">'+
     '<button type="button" data-picker-action="clear" class="pf-score-picker-clear" aria-label="'+
       esc(this.tr('Netejar cerca','Limpiar búsqueda'))+'" hidden>×</button></div>'+
    '<p class="pf-score-picker-count" role="status" aria-live="polite"></p>'+
    '<div class="pf-score-picker-list" role="listbox" aria-label="'+esc(title)+'"></div>'+
   '</section>';
  this.root=root;
  root.addEventListener('click',e=>this.onClick(e));
  root.addEventListener('input',e=>{
   if(e.target?.id==='pf-score-picker-input')this.refresh();
  });
  root.addEventListener('keydown',this.boundKeydown);
  document.body.append(root);
  this.refresh({scrollToCurrent:true});
  root.querySelector('#pf-score-picker-input')?.focus({preventScroll:true});
  return true;
 }
 refresh({scrollToCurrent=false}={}){
  if(!this.root)return;
  const query=this.root.querySelector('#pf-score-picker-input')?.value||'';
  const filtered=filterViewerScoreItems(this.items,query);
  const list=this.root.querySelector('.pf-score-picker-list');
  this.root.querySelector('.pf-score-picker-clear').hidden=!query.length;
  this.root.querySelector('.pf-score-picker-count').textContent=
   this.tr('Partitures: ','Partituras: ')+filtered.length+' / '+this.items.length;
  list.innerHTML=filtered.length?filtered.map(item=>{
   const selected=item.path===this.currentPath;
   return '<button type="button" class="pf-score-picker-item'+(selected?' pf-score-picker-current':'')+
    '" data-picker-action="select" data-picker-path="'+esc(item.path)+'" role="option" aria-selected="'+selected+'">'+
     '<span class="pf-score-picker-index">'+(item.index+1)+'</span>'+
     '<span class="pf-score-picker-details"><strong>'+esc(item.title)+'</strong>'+
      (item.relativePath?'<small>'+esc(item.relativePath)+'</small>':'')+
     '</span>'+(selected?'<span class="pf-score-picker-mark">'+esc(this.tr('Actual','Actual'))+'</span>':'')+
   '</button>';
  }).join(''):'<p class="pf-score-picker-empty">'+
   esc(this.tr('No s’han trobat partitures.','No se han encontrado partituras.'))+'</p>';
  if(scrollToCurrent){
   const selected=list.querySelector('.pf-score-picker-current');
   if(selected){
    // Desplaçament només del llistat, no de la pàgina PDF de darrere.
    list.scrollTop=Math.max(0,selected.offsetTop-list.offsetTop-list.clientHeight/3);
   }
  }else list.scrollTop=0;
 }
 async select(path){
  if(this.busy||!this.root)return;
  const item=this.items.find(item=>item.path===path);
  if(!item)return;
  this.busy=true;
  this.close({restoreFocus:false});
  try{await this.onSelect(item.path);}catch(error){
   this.onWarning(this.tr('No s’ha pogut obrir la partitura: ','No se ha podido abrir la partitura: ')+
    (error?.message||String(error)));
  }finally{this.busy=false;}
 }
 onClick(e){
  if(!this.root)return;
  if(e.target===this.root){this.close();return;}
  const button=e.target.closest('[data-picker-action]');
  if(!button)return;
  e.preventDefault();e.stopPropagation();
  const action=button.dataset.pickerAction;
  if(action==='close'){this.close();return;}
  if(action==='clear'){
   const input=this.root.querySelector('#pf-score-picker-input');
   if(input){input.value='';this.refresh({scrollToCurrent:true});input.focus();}
   return;
  }
  if(action==='select')void this.select(button.dataset.pickerPath);
 }
 onKeydown(e){
  if(!this.root)return;
  // Les tecles de navegació corresponen al diàleg, no al PDF.
  e.stopPropagation();
  if(e.key==='Escape'){e.preventDefault();this.close();return;}
  if(e.key==='Tab'){
   const controls=[...this.root.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled])')].filter(
    el=>el.getClientRects().length>0);
   if(!controls.length)return;
   const first=controls[0],last=controls.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   return;
  }
  const input=this.root.querySelector('#pf-score-picker-input');
  const buttons=[...this.root.querySelectorAll('.pf-score-picker-item')];
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();
   if(!buttons.length)return;
   const index=buttons.indexOf(document.activeElement);
   const next=e.key==='ArrowDown'?Math.min(index+1,buttons.length-1):
    index===-1?buttons.length-1:Math.max(index-1,0);
   buttons[next].focus({preventScroll:true});
   buttons[next].scrollIntoView({block:'nearest'});
  }else if(e.key==='Enter'&&document.activeElement===input&&buttons.length){
   e.preventDefault();void this.select(buttons[0].dataset.pickerPath);
  }
 }
 close({restoreFocus=true}={}){
  if(!this.root)return;
  const root=this.root;this.root=null;
  root.removeEventListener('keydown',this.boundKeydown);
  root.remove();
  this.items=[];
  if(restoreFocus&&this.previousFocus?.isConnected)this.previousFocus.focus({preventScroll:true});
  this.previousFocus=null;
  this.onClose();
 }
}
