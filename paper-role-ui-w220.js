/* W2.20 — Modal de papers amb cerca de carpeta i ajuda.
   Cap acció sobre els PDF, només els accessos de paper. */
import {paperLabel} from './paper-roles-w220.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lower=s=>String(s??'').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function renderPaperFolderChoices(folders,config,editingRole,query='',lang='va'){
 const filtered=folders.filter(path=>lower(path).includes(lower(query))).slice(0,150);
 const assigned=new Map(config.roles.filter(r=>r.path).map(r=>[r.path,r.id]));
 if(!filtered.length)return '<p class="pf-paper-no-results">'+(lang==='es'?'No hay carpetas con ese nombre.':'No hi ha carpetes amb eixe nom.')+'</p>';
 return filtered.map(path=>{
  const owner=assigned.get(path);
  const note=owner&&owner!==editingRole?
    '<small>'+(lang==='es'?'Asignada a ':'Assignada a ')+esc(paperLabel(owner,lang))+'</small>':'';
  return '<button type="button" class="pf-paper-folder-choice" data-action="paper-set-folder" data-value="'+esc(path)+'" title="'+esc(path)+'"><span>📁 '+esc(path)+'</span>'+note+'</button>';
 }).join('');
}
export function renderPaperSetup({config,folders,editingRole=null,folderSearch='',language='va',active='root'}){
 const es=language==='es';
 const rows=config.roles.map(role=>{
  const good=!!role.path&&folders.includes(role.path),missing=!!role.path&&!good;
  const name=paperLabel(role.id,language);
  return '<div class="pf-paper-role-row">'+
   '<span class="pf-paper-role-name">'+esc(name)+'</span>'+
   '<span class="pf-paper-role-path'+(missing?' missing':'')+'">'+
     (role.path?esc(role.path)+(missing?' ⚠':''):(es?'Sin asignar':'Sense assignar'))+'</span>'+
   '<button type="button" class="secondary" data-action="paper-choose" data-value="'+role.id+'">'+
     (es?'Elegir':'Triar')+'</button>'+
   (role.id>2?'<button type="button" class="quiet pf-paper-remove" title="'+(es?'Eliminar papel':'Eliminar paper')+
     '" aria-label="'+(es?'Eliminar papel':'Eliminar paper')+' '+esc(name)+
     '" data-action="paper-remove-ask" data-value="'+role.id+'">×</button>':'')+
   '</div>';
 }).join('');
 const editing=config.roles.find(item=>item.id===editingRole);
 const options=editing?'<div class="pf-paper-selector">'+
  '<label for="paper-folder-search">'+(es?'Buscar carpeta para ':'Buscar carpeta per a ')+esc(paperLabel(editing.id,language))+'</label>'+
  '<input id="paper-folder-search" type="search" value="'+esc(folderSearch)+
    '" placeholder="'+(es?'Nombre o ruta de carpeta':'Nom o ruta de carpeta')+'" autocomplete="off" />'+
  '<div id="paper-folder-choices" class="pf-paper-folder-choices">'+
   renderPaperFolderChoices(folders,config,editing.id,folderSearch,language)+'</div>'+
  (editing.path?'<button type="button" class="secondary" data-action="paper-unassign" data-value="'+editing.id+'">'+
    (es?'Quitar asignación':'Llevar assignació')+'</button>':'')+
  '<button type="button" class="quiet" data-action="paper-cancel-choose">'+
    (es?'Volver a los papeles':'Tornar als papers')+'</button></div>':'';
 return '<div class="modal-backdrop" role="presentation"><section class="modal pf-paper-modal" role="dialog" aria-modal="true" aria-labelledby="paper-title">'+
  '<h2 id="paper-title">'+(es?'Configurar papeles':'Configurar papers')+'</h2>'+
  '<p class="help">'+(es?
    'Asigna cada papel a una carpeta de tu biblioteca. Se abrirá directamente como raíz, sin mostrar sus carpetas superiores. No se mueve ni se modifica ningún PDF.':
    'Assigna cada paper a una carpeta de la biblioteca. S’obrirà directament com a arrel, sense mostrar les carpetes superiors. No es mou ni es modifica cap PDF.')+'</p>'+
  '<button type="button" class="pf-paper-help" data-action="paper-help">ⓘ '+(es?'Cómo funcionan los papeles':'Com funcionen els papers')+'</button>'+
  '<div class="pf-paper-role-list">'+rows+'</div>'+
  '<button type="button" class="secondary pf-paper-add" data-action="paper-add">+ '+(es?'Añadir papel':'Afegir paper')+'</button>'+
  options+
  '<div class="modal-actions"><button type="button" class="primary" data-action="paper-close">'+(es?'Cerrar':'Tancar')+'</button></div>'+
  '</section></div>';
}
export function renderPaperHelp(language='va'){
 const es=language==='es';
 return '<div class="modal-backdrop"><section class="modal pf-paper-modal" role="dialog" aria-modal="true" aria-labelledby="paper-help-title">'+
  '<h2 id="paper-help-title">'+(es?'Ayuda para configurar los papeles':'Ajuda per a configurar els papers')+'</h2>'+
  '<p>'+(es?'Los papeles son accesos directos virtuales a carpetas reales de tu biblioteca.':'Els papers són accessos directes virtuals a carpetes de la biblioteca.')+'</p>'+
  '<p>'+(es?
   'Elige una carpeta por papel, aunque esté dentro de otras carpetas. Al seleccionar el papel solo se muestra su contenido. La opción Raíz enseña toda la biblioteca.':
   'Tria una carpeta per paper, encara que estiga dins d’altres carpetes. En seleccionar el paper només es mostra el seu contingut. L’opció Arrel mostra tota la biblioteca.')+'</p>'+
  '<p>'+(es?
   'Si asignas una carpeta que ya utilizaba otro papel, se libera la asignación anterior. Añadir o eliminar papeles nunca crea, mueve ni borra partituras.':
   'Si assignes una carpeta que ja utilitzava un altre paper, es lleva l’assignació anterior. Afegir o eliminar papers mai crea, mou ni esborra partitures.')+'</p>'+
  '<p>'+(es?
   'En la web, las carpetas disponibles se deducen de las rutas de los PDF importados. Las carpetas vacías no aparecen. Las asignaciones se guardan en este navegador y pueden viajar en una copia ZIP.':
   'En la web, les carpetes disponibles es deduïxen de les rutes dels PDF importats. Les carpetes buides no apareixen. Les assignacions es guarden en este navegador i es poden incloure en una còpia ZIP.')+'</p>'+
  '<div class="modal-actions"><button type="button" class="primary" data-action="paper-help-close">'+(es?'Volver':'Tornar')+'</button></div></section></div>';
}
export function renderPaperRemove(role,language='va'){
 const es=language==='es',name=paperLabel(role,language);
 return '<div class="modal-backdrop"><section class="modal pf-paper-modal" role="alertdialog" aria-modal="true" aria-labelledby="paper-remove-title">'+
  '<h2 id="paper-remove-title">'+(es?'Eliminar papel ':'Eliminar paper ')+esc(name)+'?</h2>'+
  '<p>'+(es?'Solo se elimina el acceso directo. Las carpetas y las partituras se conservan.':'Només s’elimina l’accés directe. Les carpetes i les partitures es conserven.')+'</p>'+
  '<div class="modal-actions"><button type="button" class="secondary" data-action="paper-remove-cancel">'+(es?'Cancelar':'Cancel·lar')+'</button>'+
  '<button type="button" class="danger" data-action="paper-remove-confirm" data-value="'+role+'">'+(es?'Eliminar':'Eliminar')+'</button></div></section></div>';
}
