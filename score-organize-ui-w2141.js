/* W2.14.1 — Organitzar PDF sense afegir una quarta icona a les files del mòbil. */
import {scanFolderChoices} from './scanner-pdf-w2131.js';
import {scoreFolder,scoreStem,targetScorePath} from './score-organize-w2141.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderOrganizeModal({score,scores=[],language='va',busy=false}={}){
 if(!score?.path)return '';
 const tr=(a,b)=>language==='es'?b:a;
 const folder=scoreFolder(score.path),stem=scoreStem(score.path);
 const folders=scanFolderChoices(scores);
 if(folder&&!folders.includes(folder))folders.push(folder);
 folders.sort((a,b)=>!a?-1:!b?1:a.localeCompare(b,'ca',{numeric:true}));
 const options=folders.map(p=>'<option value="'+esc(p)+'"'+(p===folder?' selected':'')+'>'+
  esc(p||tr('Carpeta arrel','Carpeta raíz'))+'</option>').join('');
 const current=targetScorePath({name:stem,folder});
 return '<div class="modal-backdrop pf-organize-backdrop" role="presentation">'+
 '<section class="modal pf-organize-modal" role="dialog" aria-modal="true" aria-labelledby="organize-title">'+
 '<h2 id="organize-title">'+tr('Moure o renomenar partitura','Mover o renombrar partitura')+'</h2>'+
 '<p class="pf-organize-help">'+tr('Canvia el nom o la carpeta. Es conservaran el PDF, les anotacions, els metadades, els favorits, els recents i els repertoris.',
  'Cambia el nombre o la carpeta. Se conservarán el PDF, las anotaciones, los metadatos, los favoritos, los recientes y los repertorios.')+'</p>'+
 '<p class="pf-organize-source"><strong>'+tr('Origen','Origen')+':</strong> '+esc(score.path)+'</p>'+
 '<div class="pf-organize-fields">'+
  '<label for="organize-name">'+tr('Nom del fitxer','Nombre del archivo')+
   '<input type="text" id="organize-name" maxlength="115" value="'+esc(stem)+'"'+(busy?' disabled':'')+' autocomplete="off" spellcheck="false"></label>'+
  '<label for="organize-folder">'+tr('Carpeta de destinació','Carpeta de destino')+
   '<select id="organize-folder"'+(busy?' disabled':'')+'>'+options+'</select></label>'+
  '<label for="organize-new-folder">'+tr('Crear subcarpeta nova (opcional)','Crear subcarpeta nueva (opcional)')+
   '<input type="text" id="organize-new-folder" maxlength="90" placeholder="'+tr('Nom de la carpeta','Nombre de la carpeta')+'"'+(busy?' disabled':'')+' autocomplete="off"></label>'+
 '</div>'+
 '<p class="pf-organize-destination" id="organize-target-preview" role="status">'+
 tr('Destinació: ','Destino: ')+'<strong>'+esc(current)+'</strong></p>'+
 '<p class="pf-organize-safety">'+
 tr('Si ja hi ha un PDF amb eixe nom a la destinació, no es farà cap canvi. No es reemplaçarà ni s’eliminarà cap partitura.',
    'Si ya existe un PDF con ese nombre en el destino, no se hará ningún cambio. No se reemplazará ni eliminará ninguna partitura.')+
 '</p><div class="modal-actions pf-organize-actions">'+
 '<button type="button" class="secondary" data-action="organize-back"'+(busy?' disabled':'')+'>'+tr('Tornar a metadades','Volver a metadatos')+'</button>'+
 '<button type="button" class="primary" data-action="organize-save"'+(busy?' disabled':'')+'>'+tr('Guardar canvis','Guardar cambios')+'</button>'+
 '</div></section></div>';
}
export function updateOrganizePreview(language='va'){
 const el=document.getElementById('organize-target-preview');
 if(!el)return;
 const tr=(a,b)=>language==='es'?b:a;
 try{
  const path=targetScorePath({
   name:document.getElementById('organize-name')?.value,
   folder:document.getElementById('organize-folder')?.value||'',
   newFolder:document.getElementById('organize-new-folder')?.value||''
  });
  el.textContent=tr('Destinació: ','Destino: ')+path;
  el.classList.remove('pf-organize-invalid');
 }catch(error){
  el.textContent=tr('Comprova el nom o la carpeta.','Revisa el nombre o la carpeta.');
  el.classList.add('pf-organize-invalid');
 }
}
