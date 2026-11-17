/* W2.7 — Editor local directament damunt de la partitura, com BasicTextField d'Android. */
import {projectPoint} from './annotations.js';
import {TEXT_SIZES,ANNOTATION_COLORS} from './annotations.js';
import {STANDARD_TEXT_BOX} from './annotation-geometry.js';
export const INLINE_TEXT_MAX_CHARS=240;
export const INLINE_TEXT_MAX_LINES=5;
export const validInlineText=s=>typeof s==='string'&&!!s.trim()&&s.length<=280&&s.split('\n').length<=5;
export function inlineTextBounds(draft,w,h,rotation=0){
 const [x,y]=projectPoint(draft.point,rotation);
 const width=Math.min(w,Math.max(80,(draft.boxWidth||STANDARD_TEXT_BOX.width)*w));
 const height=Math.min(h,Math.max(44,(draft.boxHeight||STANDARD_TEXT_BOX.height)*h));
 return {left:Math.max(0,Math.min(w-width,x*w)),top:Math.max(0,Math.min(h-height,y*h)),width,height,
  fontPx:Math.max(14,Number(draft.fontSize||.034)*Math.min(w,h))};
}
export function createInlineTextEditor(viewer,draft,labels={}){
 let active=true,composing=false,focusOnMount=true;
 const tr=(va,es)=>labels.lang==='es'?es:va;
 const root=document.createElement('div');root.className='pf-inline-text-editor';
 root.dataset.inlineEditor='true';root.dataset.page=String(viewer.pageNumber);
 root.dataset.index=draft.index==null?'new':String(draft.index);
 root.setAttribute('role','group');root.setAttribute('aria-label',tr('Edició directa del text','Edición directa del texto'));
 const bar=document.createElement('div');bar.className='pf-inline-controls';bar.setAttribute('role','toolbar');
 bar.setAttribute('aria-label',tr('Format del text','Formato del texto'));
 const btn=(action,caption,title)=>{
  const b=document.createElement('button');b.type='button';b.dataset.inline=action;
  b.textContent=caption;b.title=title;b.setAttribute('aria-label',title);bar.append(b);return b;
 };
 const divider=()=>{const s=document.createElement('span');s.className='pf-inline-divider';bar.append(s);};
 btn('bold','B',tr('Negreta','Negrita'));btn('italic','I',tr('Cursiva','Cursiva'));
 btn('underline','U',tr('Subratllat','Subrayado'));divider();
 btn('align:left','≡',tr('Esquerra','Izquierda'));
 btn('align:center','☷',tr('Centre','Centro'));
 btn('align:right','≣',tr('Dreta','Derecha'));
 const picker=(prop,choices,label,aria)=>{
  const wrap=document.createElement('label');wrap.className='pf-inline-picker';
  const span=document.createElement('span');span.textContent=label;wrap.append(span);
  const select=document.createElement('select');select.dataset[prop]='true';select.setAttribute('aria-label',aria);
  for(const [value,name] of choices){const o=document.createElement('option');o.value=String(value);o.textContent=name;select.append(o);}
  wrap.append(select);bar.append(wrap);return select;
 };
 const size=picker('inlineSize',TEXT_SIZES.map(n=>[n,Math.round(n*1000)/10+'%']),'Aa',tr('Grandària','Tamaño'));
 const color=picker('inlineColor',ANNOTATION_COLORS.map(c=>[c,c]),'Color',tr('Color del text','Color del texto'));
 btn('background','▧',tr('Fons blanc','Fondo blanco'));
 btn('border','▣',tr('Marc','Borde'));divider();
 btn('cancel','×',tr('Cancel·lar','Cancelar')).className='pf-inline-cancel';
 btn('save','✓',tr('Guardar text','Guardar texto')).className='pf-inline-save';
 const textarea=document.createElement('textarea');textarea.className='pf-inline-input';
 textarea.dataset.inlineInput='true';textarea.rows=5;textarea.maxLength=Math.max(INLINE_TEXT_MAX_CHARS,draft.text?.length||0);
 textarea.setAttribute('enterkeyhint','done');textarea.spellcheck=false;textarea.setAttribute('autocapitalize','sentences');
 textarea.placeholder=tr('Escriu ací…','Escribe aquí…');
 textarea.setAttribute('aria-label',tr('Text sobre la partitura','Texto sobre la partitura'));
 textarea.value=draft.text||'';
 const status=document.createElement('span');status.className='pf-inline-status';status.setAttribute('aria-live','polite');
 root.append(bar,textarea,status);
 const originalLength=textarea.value.length;
 const limit=()=>{
  const input=textarea.value.replace(/\r\n?/g,'\n');
  const restricted=input.slice(0,Math.max(INLINE_TEXT_MAX_CHARS,originalLength)).split('\n').slice(0,5).join('\n');
  if(input!==restricted)status.textContent=tr('Màxim 240 caràcters i 5 línies.','Máximo 240 caracteres y 5 líneas.');
  textarea.value=restricted;draft.text=restricted;
 };
 textarea.addEventListener('compositionstart',()=>{composing=true;});
 textarea.addEventListener('compositionend',()=>{composing=false;limit();});
 textarea.addEventListener('input',()=>{if(!composing){limit();if(validInlineText(textarea.value))status.textContent='';}});
 textarea.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();viewer.cancelInlineTextEditor();}
  else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopPropagation();viewer.finishInlineTextEditor();}
  else e.stopPropagation();
 });
 for(const type of ['pointerdown','pointermove','pointerup','click'])root.addEventListener(type,e=>e.stopPropagation());
 bar.addEventListener('click',e=>{
  const button=e.target.closest('[data-inline]');if(!button||!active)return;
  const action=button.dataset.inline;
  if(action==='save'){
   if(!validInlineText(textarea.value)){status.textContent=tr('Escriu un text vàlid.','Escribe un texto válido.');return;}
   viewer.finishInlineTextEditor();return;
  }
  if(action==='cancel'){viewer.cancelInlineTextEditor();return;}
  if(action.startsWith('align:'))draft.alignment=action.slice(6);
  else if(['bold','italic','underline','background','border'].includes(action)){
   const key=action==='background'?'backgroundEnabled':action==='border'?'borderEnabled':action;
   draft[key]=!draft[key];
  }
  update();textarea.focus({preventScroll:true});
 });
 size.addEventListener('change',()=>{draft.fontSize=Number(size.value);update();textarea.focus({preventScroll:true});});
 color.addEventListener('change',()=>{draft.color=color.value;update();textarea.focus({preventScroll:true});});
 function position(){
  if(!active||!viewer.pageW||!viewer.pageH)return;
  const b=inlineTextBounds(draft,viewer.pageW,viewer.pageH,viewer.rotation);
  root.style.left=b.left+'px';root.style.top=b.top+'px';
  root.style.width=b.width+'px';root.style.height=b.height+'px';
  root.style.setProperty('--inline-font',b.fontPx+'px');
  root.classList.toggle('near-top',b.top<62);
 }
 function update(){
  if(!active)return;
  textarea.style.color=draft.color;textarea.style.fontSize='var(--inline-font)';
  textarea.style.fontWeight=draft.bold?'700':'400';textarea.style.fontStyle=draft.italic?'italic':'normal';
  textarea.style.textDecoration=draft.underline?'underline':'none';
  textarea.style.textAlign=['left','center','right'].includes(draft.alignment)?draft.alignment:'left';
  textarea.classList.toggle('background-on',!!draft.backgroundEnabled);
  textarea.classList.toggle('border-on',!!draft.borderEnabled);
  for(const b of bar.querySelectorAll('[data-inline]')){
   const value=b.dataset.inline,k=value==='background'?'backgroundEnabled':value==='border'?'borderEnabled':value;
   const selected=value.startsWith('align:')?draft.alignment===value.slice(6):!!draft[k];
   b.classList.toggle('selected',selected);
   if(!['save','cancel'].includes(value))b.setAttribute('aria-pressed',String(selected));
  }
  size.value=String(draft.fontSize);color.value=draft.color;position();
 }
 function mount(sheet){
  if(!active||!sheet)return;
  if(root.parentElement!==sheet)sheet.append(root);
  position();
  if(focusOnMount){
   focusOnMount=false;
   // En iOS/Android el focus síncron dins del gest evita perdre el teclat.
   textarea.focus({preventScroll:true});
   try{textarea.setSelectionRange(textarea.value.length,textarea.value.length);}catch{}
  }
 }
 function destroy(){active=false;root.remove();}
 update();
 return {root,textarea,draft,mount,position,update,destroy,
  getValue:()=>textarea.value.replace(/\r\n?/g,'\n'),isActive:()=>active};
}
