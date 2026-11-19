/* W2.23A — Una biblioteca senzilla amb opcions tècniques als Ajustos.
   Contingut en valencià per defecte; es conserva el canvi a castellà. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderSourceControls({linked,mode='imported',lang='va',supported=true,compact=false,autoEnabled=true}={}){
 const es=lang==='es',active=mode==='linked',exists=!!linked?.exists,ready=!!linked?.ready;
 const imported=es?'Biblioteca importada':'Biblioteca importada';
 const local=es?'Carpeta del dispositiu':'Carpeta del dispositiu';
 const refresh=es?'Actualizar ahora':'Actualitzar ara';
 const choose=supported?(exists?(es?'Cambiar carpeta':'Canviar carpeta'):(es?'Elegir carpeta':'Triar carpeta')):
  (es?'Importar carpeta como copia':'Importar carpeta com a còpia');
 const folderName=active&&exists?linked.name:imported;
 const total=active&&ready?linked.scores.length:null;
 const known=linked?.lastScannedAt?new Date(linked.lastScannedAt).toLocaleString(es?'es-ES':'ca-ES',{dateStyle:'short',timeStyle:'short'}):null;
 const checked=linked?.lastAutoCheckedAt?new Date(linked.lastAutoCheckedAt).toLocaleTimeString(es?'es-ES':'ca-ES',{hour:'2-digit',minute:'2-digit'}):null;
 const waiting=active&&linked.checkBusy;
 const unavailable=active&&linked.checkState==='unavailable';
 const recover=active&&exists&&(unavailable||!ready);
 const canRequest=typeof linked?.handle?.requestPermission==='function';
 const recoverAction=canRequest?'source-authorize':supported?'source-choose':'source-fallback';
 const recoverLabel=canRequest?(es?'Activar biblioteca':'Activar biblioteca'):(es?'Volver a elegir carpeta':'Tornar a triar carpeta');
 const recoverButton=recover?'<button class="secondary pf-library-activate" type="button" data-action="'+recoverAction+'">'+recoverLabel+'</button>':'';
 const status=waiting?(es?'Comprobando cambios…':'Comprovant canvis…')
  :unavailable?(es?'Autoriza la carpeta para leer los PDF originales':'Autoritza la carpeta per a llegir els PDF originals')
  :active&&linked.offlineBusy?(linked.offlineProgress|| (es?'Preparando copias…':'Preparant còpies…'))
  :active&&!ready?(es?'Necesita permiso para consultar la carpeta':'Cal permís per a consultar la carpeta')
  :checked&&active?(es?'Comprobada a las ':'Comprovada a les ')+checked:'';
 if(!compact){
  return '<section class="pf-library-summary" aria-label="'+(es?'Origen de biblioteca':'Origen de biblioteca')+'">'+
   '<span class="pf-library-source-symbol" aria-hidden="true">'+(active?'📁':'📚')+'</span>'+
   '<div class="pf-library-summary-text"><strong>'+esc(folderName)+'</strong>'+
    '<small class="pf-source-info">'+(active
     ?(ready?total+' PDF · '+(es?'Biblioteca vinculada':'Biblioteca vinculada'):
       (es?'Acceso pendiente a la carpeta':'Accés pendent a la carpeta'))
     :(es?'Partituras guardadas en la aplicación':'Partitures guardades en l’aplicació'))+'</small>'+
    (status?'<small class="pf-library-check '+(unavailable?'warn':'')+'" role="status">'+esc(status)+'</small>':'')+
   '</div>'+
   (!exists?'<button class="secondary" type="button" data-action="'+(supported?'source-choose':'source-fallback')+'">'+esc(choose)+'</button>':'')+
   recoverButton+
   (!active?'<button class="quiet pf-drive-quick" type="button" data-action="drive-open" title="'+(es?'Importar desde Drive':'Importar des de Drive')+'">Drive</button>':'')+
   '<button class="quiet pf-library-manage" type="button" data-action="source-manage" title="'+(es?'Gestionar biblioteca':'Gestionar biblioteca')+'">'+
    (es?'Gestionar':'Gestionar')+'</button>'+
   '</section>';
 }
 const operations=recoverButton+(exists&&active?'<button type="button" class="secondary" data-action="source-refresh">'+refresh+'</button>':'')+
  '<button type="button" class="secondary" data-action="'+(supported?'source-choose':'source-fallback')+'">'+esc(choose)+'</button>'+
  (exists?'<button type="button" class="quiet pf-source-unlink" data-action="source-forget">'+(es?'Desvincular':'Desvincular')+'</button>':'');
 const count=active&&exists?linked.offlineCount+'/'+linked.scores.length:'';
 const canCache=active&&exists&&ready;
 const offline=canCache?'<div class="pf-source-offline">'+
   '<strong>'+(es?'Partituras disponibles sin conexión':'Partitures disponibles sense connexió')+'</strong>'+
   '<p>'+count+' PDF</p>'+
   (linked.offlineBusy?
    '<button type="button" class="secondary" data-action="source-cache-stop">'+(es?'Detener':'Parar')+'</button>'+
    '<p role="status">'+esc(linked.offlineProgress||'')+'</p>':
    '<div class="pf-source-offline-actions">'+
    (linked.uncachedCount?'<button type="button" class="secondary" data-action="source-cache">'+
      (es?'Preparar las pendientes':'Preparar les pendents')+'</button>':'')+
    (linked.offlineCount?'<button type="button" class="secondary" data-action="source-cache-update">'+
      (es?'Actualizar copias':'Actualitzar còpies')+'</button>'+
      '<button type="button" class="quiet" data-action="source-cache-clear">'+(es?'Eliminar copias':'Eliminar còpies')+'</button>':'')+
    '</div>')+
   '<p class="help">'+(es?'Son opcionales: los PDF se leen directamente de su carpeta cuando está autorizada. Las copias solo sirven si quieres usarlos sin permiso o conexión y ocupan almacenamiento extra.':'Són opcionals: els PDF es lligen directament de la carpeta quan està autoritzada. Les còpies només servixen si els vols utilitzar sense permís o connexió i ocupen espai addicional.')+'</p>'+
   '</div>':'';
 const sourceTabs='<div class="pf-source-switch" role="group" aria-label="'+(es?'Origen de biblioteca':'Origen de biblioteca')+'">'+
  '<button type="button" class="pf-source-choice '+(!active?'active':'')+'" data-action="source-imported" aria-pressed="'+(!active)+'">'+imported+'</button>'+
  (exists?'<button type="button" class="pf-source-choice '+(active?'active':'')+'" data-action="source-linked" aria-pressed="'+active+'">'+local+'</button>':'')+'</div>';
 const autolabel=es?'Comprobar los cambios automáticamente al abrir':'Comprovar els canvis automàticament en obrir';
 return '<section class="pf-source-panel pf-source-compact" id="pf-source-config" aria-label="'+(es?'Origen de biblioteca':'Origen de biblioteca')+'">'+
  '<div class="pf-source-header"><strong>📂 '+(es?'Biblioteca':'Biblioteca')+'</strong><small>'+esc(folderName)+'</small></div>'+
  '<p class="help">'+(es?'La biblioteca comprueba los cambios al abrir. Si Chrome retira el permiso, pulsa Activar biblioteca: no es necesario copiar los PDF.':'La biblioteca comprova els canvis en obrir. Si Chrome retira el permís, prem Activar biblioteca: no cal copiar els PDF.')+'</p>'+
  sourceTabs+'<div class="pf-source-actions">'+operations+'</div>'+
  (active?'<div class="pf-source-info">'+esc(linked.name)+' · '+linked.scores.length+' PDF'+
    (known?' · '+(es?'Última actualización: ':'Última actualització: ')+esc(known):'')+'</div>':'')+
  '<button type="button" class="pf-auto-sync-switch" data-action="source-auto-toggle" aria-pressed="'+!!autoEnabled+'">'+
  '<span class="pf-auto-sync-check" aria-hidden="true">'+(autoEnabled?'✓':'')+'</span>'+autolabel+'</button>'+
  (status?'<p class="pf-source-status" role="status">'+esc(status)+'</p>':'')+
  (active&&!ready?'<p class="help">'+(es?'Chrome puede necesitar que vuelvas a elegir la carpeta si retiró el permiso. Las copias preparadas permanecen disponibles.':'Chrome pot necessitar que tornes a triar la carpeta si ha retirat el permís. Les còpies preparades continuen disponibles.')+'</p>':'')+
  '<details class="pf-library-advanced" '+(linked?.offlineBusy?'open':'')+'>'+
   '<summary>'+(es?'Opciones avanzadas · sin conexión y almacenamiento':'Opcions avançades · sense connexió i emmagatzematge')+'</summary>'+
   (offline||'<p class="help">'+(es?'Selecciona una carpeta vinculada para preparar copias locales.':'Tria una carpeta vinculada per a preparar còpies locals.')+'</p>')+
   '<p class="help">'+(es?'Los ajustes de Drive se encuentran más abajo. La comprobación automática de Drive necesitará una sesión autorizada de Google y se integrará en una fase posterior.':'Els ajustos de Drive estan més avall. La comprovació automàtica de Drive requerix una sessió de Google autoritzada i s’integrarà en una fase posterior.')+'</p>'+
  '</details></section>';
}
