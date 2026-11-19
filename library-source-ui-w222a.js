/* W2.22A — controls coherents per a les fonts de Biblioteca. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderSourceControls({linked,mode='imported',lang='va',supported=true,compact=false}={}){
 const es=lang==='es',active=mode==='linked',exists=linked?.exists,ready=linked?.ready;
 const title=es?'Origen de la biblioteca':'Origen de la biblioteca';
 const imported=es?'Biblioteca importada':'Biblioteca importada';
 const local=es?'Carpeta vinculada':'Carpeta vinculada';
 const select=es?'Vincular carpeta':'Vincular carpeta';
 const replace=es?'Cambiar carpeta':'Canviar carpeta';
 const refresh=es?'Actualizar biblioteca':'Actualitzar biblioteca';
 const grant=es?'Autorizar lectura':'Autoritzar lectura';
 const unlink=es?'Desvincular':'Desvincular';
 const status=active&&exists
  ?ready?(es?'Leyendo los PDF originales sin copiarlos':'Llegint els PDF originals sense copiar-los')
   :linked.status==='scanning'?(es?'Leyendo carpetas…':'Llegint carpetes…')
   :linked.status==='error'?(es?'No se ha podido leer la carpeta':'No s’ha pogut llegir la carpeta')
    :!linked.handle?.requestPermission
     ?(es?'Pulsa Cambiar carpeta para volver a seleccionarla':'Prem Canviar carpeta per a tornar a seleccionar-la')
     :(es?'Es necesario recuperar el permiso de lectura':'Cal recuperar el permís de lectura')
  :es?'Los archivos importados siguen guardados aquí':'Els arxius importats continuen guardats ací';
 const controls='<div class="pf-source-switch" role="group" aria-label="'+title+'">'+
  '<button type="button" class="pf-source-choice '+(!active?'active':'')+'" data-action="source-imported" aria-pressed="'+(!active)+'">'+imported+'</button>'+
  (exists?'<button type="button" class="pf-source-choice '+(active?'active':'')+'" data-action="source-linked" aria-pressed="'+active+'">'+local+'</button>':'')+'</div>';
 const choose=supported?
   '<button type="button" class="secondary" data-action="source-choose">'+(exists?replace:select)+'</button>':
   '<button type="button" class="secondary" data-action="source-fallback">'+(es?'Importar una carpeta (copia)':'Importar una carpeta (còpia)')+'</button>';
 const canRequest=exists&&typeof linked.handle?.requestPermission==='function';
 const operations=(exists&&active&&(ready||canRequest)?'<button type="button" class="secondary" data-action="'+(ready?'source-refresh':'source-authorize')+'">'+(ready?refresh:grant)+'</button>':'')+
  (exists?'<button type="button" class="quiet pf-source-unlink" data-action="source-forget">'+unlink+'</button>':'');
 const message=active&&exists?(es?'Carpeta: ':'Carpeta: ')+linked.name+
  (ready?' · '+linked.scores.length+' PDF'+(linked.unreadable?' · '+linked.unreadable+' '+(es?'sin acceso':'sense accés'):'')
   :es?' · lectura pendiente':' · lectura pendent'):'';
 return '<section class="pf-source-panel '+(compact?'pf-source-compact':'')+'" aria-label="'+title+'">'+
  '<div class="pf-source-header"><strong>📂 '+title+'</strong><small>'+(active&&exists?esc(linked.name):imported)+'</small></div>'+
  controls+'<div class="pf-source-actions">'+choose+operations+'</div>'+
  (message?'<div class="pf-source-info">'+esc(message)+'</div>':'')+
  '<p class="pf-source-status" role="status">'+esc(linked?.error&&active?linked.error:status)+'</p>'+
  (!supported?'<p class="help">'+(es?'Tu navegador no ofrece vinculación permanente; el botón de importar crea una copia. Prueba Chrome o Edge recientes.':'El navegador no oferix vinculació permanent; importar una carpeta crea una còpia. Prova Chrome o Edge recents.')+'</p>':'')+
  (active?'<p class="help">'+(es?'Solo lectura: tus PDF originales no se modifican. Las anotaciones y los repertorios se guardan en este navegador. Para añadir o mover archivos, usa el gestor de archivos y pulsa Actualizar.':'Només lectura: els PDF originals no es modifiquen. Les anotacions i els repertoris es guarden en este navegador. Per afegir o moure fitxers, usa el gestor d’arxius i prem Actualitzar.')+'</p>':'')+
  '</section>';
}
