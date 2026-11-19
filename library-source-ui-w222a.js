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
  ?ready?(linked.cached
    ?(es?'Índice guardado: acceso inmediato sin volver a leer toda la carpeta':'Índex guardat: accés immediat sense tornar a llegir tota la carpeta')
    :(es?'Leyendo los PDF originales sin copiarlos':'Llegint els PDF originals sense copiar-los'))
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
 const lastUpdated=active&&linked.lastScannedAt&&ready
   ?(es?' · Última actualización: ':' · Última actualització: ')+
     new Date(linked.lastScannedAt).toLocaleString(es?'es-ES':'ca-ES',{dateStyle:'short',timeStyle:'short'})
   :'';
 const offlineInfo=active&&exists&&ready
  ?'<div class="pf-source-offline"><strong>☁ '+(es?'Uso sin conexión':'Ús sense connexió')+'</strong>'+
    '<p>'+(es?'Partituras preparadas: ':'Partitures preparades: ')+
    linked.offlineCount+' / '+linked.scores.length+
    (linked.offlineCount>=linked.scores.length&&linked.scores.length?' ✓':'')+'</p>'+
    (linked.offlineBusy
     ?'<button type="button" class="secondary" data-action="source-cache-stop">'+(es?'Detener descarga':'Parar descàrrega')+'</button>'+
      (linked.offlineProgress?'<p role="status">'+linked.offlineProgress+'</p>':'')
     :'<div class="pf-source-offline-actions">'+
      (linked.uncachedCount?
       '<button type="button" class="primary" data-action="source-cache">'+(es?'Preparar partituras sin conexión':'Preparar partitures sense connexió')+'</button>':'')+
      (linked.offlineCount?
       '<button type="button" class="secondary" data-action="source-cache-update">'+(es?'Actualizar copias':'Actualitzar còpies')+'</button>'+
       '<button type="button" class="quiet" data-action="source-cache-clear">'+(es?'Eliminar copias locales':'Eliminar còpies locals')+'</button>':'')+
      '</div>')+
    '<p class="help">'+(es?'Las copias se guardan en este navegador; los PDF originales no se modifican. Puedes abrirlos sin permiso de la carpeta después de prepararlos. Los cambios de los originales requieren actualizar las copias.':'Les còpies es guarden en este navegador; els PDF originals no es modifiquen. Podràs obrir-los sense permís de carpeta després de preparar-los. Els canvis dels originals requerixen actualitzar les còpies.')+'</p>'+
   '</div>':'';
 const message=active&&exists?(es?'Carpeta: ':'Carpeta: ')+linked.name+
  (ready?' · '+linked.scores.length+' PDF'+(linked.unreadable?' · '+linked.unreadable+' '+(es?'sin acceso':'sense accés'):'')+lastUpdated
   :es?' · lectura pendiente':' · lectura pendent'):'';
 return '<section class="pf-source-panel '+(compact?'pf-source-compact':'')+'" aria-label="'+title+'">'+
  '<div class="pf-source-header"><strong>📂 '+title+'</strong><small>'+(active&&exists?esc(linked.name):imported)+'</small></div>'+
  controls+'<div class="pf-source-actions">'+choose+operations+'</div>'+
  (message?'<div class="pf-source-info">'+esc(message)+'</div>':'')+
  offlineInfo+
  '<p class="pf-source-status" role="status">'+esc(linked?.error&&active?linked.error:status)+'</p>'+
  (!supported?'<p class="help">'+(es?'Tu navegador no ofrece vinculación permanente; el botón de importar crea una copia. Prueba Chrome o Edge recientes.':'El navegador no oferix vinculació permanent; importar una carpeta crea una còpia. Prova Chrome o Edge recents.')+'</p>':'')+
  (active?'<p class="help">'+(es?'Solo lectura: tus PDF originales no se modifican. Las anotaciones y los repertorios se guardan en este navegador. Para añadir o mover archivos, usa el gestor de archivos y pulsa Actualizar.':'Només lectura: els PDF originals no es modifiquen. Les anotacions i els repertoris es guarden en este navegador. Per afegir o moure fitxers, usa el gestor d’arxius i prem Actualitzar.')+'</p>':'')+
  '</section>';
}
