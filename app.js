import {openDB, getAllScores, getScore, saveBatch, deleteScore, clearScores, getPref, setPref} from './db.js';
import {BACKUP_MANIFEST, createBackup, inspectBackup, restoreBackup} from './backup.js';

const I = {
  library:'<svg viewBox="0 0 24 24"><path d="M3 6h6l2 2h10v12H3z"/><path d="M3 8V5h6l2 3"/></svg>',
  folder:'<svg viewBox="0 0 24 24"><path d="M3 6h7l2.2 3H21v11H3z"/></svg>',
  file:'<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v6h5M9 12h7M9 16h7"/></svg>',
  book:'<svg viewBox="0 0 24 24"><path d="M4 4c3-1 6-1 8 1 2-2 5-2 8-1v16c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 5v16"/></svg>',
  settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 1.2 1.2-2.3 3.1-1.6-.7-2.2 1-.3 1.7h-4.1L9.7 19l-2-1-1.6.7-2.3-3.1L5 14l-.3-2.5L3 10.4l1.5-3.2L6.2 7l2-1 .4-1.7h4.1l.4 1.7 2.1 1 1.5-.7L20 9.5l-1.3 1.4z"/></svg>',
  upload:'<svg viewBox="0 0 24 24"><path d="M12 17V3m-5 5 5-5 5 5M4 15v5h16v-5"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  next:'<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  home:'<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8v10h-7v-7h-4v7H3z"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 6h16M9 6V3h6v3M7 6l1 15h8l1-15M10 10v7m4-7v7"/></svg>',
  share:'<svg viewBox="0 0 24 24"><path d="M12 16V2m-5 5 5-5 5 5M4 12v9h16v-9"/></svg>',
  info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7v1"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></svg>',
  wifi:'<svg viewBox="0 0 24 24"><path d="M2 9a16 16 0 0 1 20 0M5 13a11 11 0 0 1 14 0M9 17a5 5 0 0 1 6 0"/><circle cx="12" cy="21" r="1"/></svg>',
  save:'<svg viewBox="0 0 24 24"><path d="M5 3h12l4 4v14H3V3h2M7 3v7h9V3M7 21v-8h10v8"/></svg>',
  download:'<svg viewBox="0 0 24 24"><path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/></svg>',
  restore:'<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 1 3 6.7M3 19v-6h6M12 7v5l4 2"/></svg>'
};
const icon = (name) => `<span class="icon" aria-hidden="true">${I[name]||I.file}</span>`;
const L = {
 va: {
  subtitle:'La música de les nostres festes',library:'Biblioteca',index:'Índex',settings:'Ajustos',import:'Importar',importFiles:'Importar PDF o ZIP',
  folderCount:'carpetes',scoreCount:'partitures',search:'Buscar partitures...',all:'Arrel',paper:'Paper',
  emptyTitle:'La teua biblioteca, preparada per a començar',emptyText:'Importa una o diverses partitures en PDF, o un ZIP que continga les carpetes de la biblioteca. Els arxius es guarden en este dispositiu.',
  noResults:'No s’han trobat partitures.',noResultsDesc:'Prova amb una altra cerca o canvia de carpeta.',
  oneFile:'partitura',moreFiles:'partitures',indexSubtitle:'Totes les obres del paper seleccionat, agrupades per carpeta',
  settingsSubtitle:'Preferències i emmagatzematge',language:'Idioma',languageHint:'Es pot canviar en qualsevol moment.',
  storage:'Biblioteca local',localHint:'Les partitures estan guardades en este dispositiu, no al servidor ni a Google Drive.',
  deleteAll:'Esborrar biblioteca',deleteThis:'Esborrar esta partitura',installTitle:'Instal·lar a iPhone / iPad',
  installText:'Obri esta pàgina en Safari, toca Compartir i selecciona «Afegir a la pantalla d’inici». Activa «Obrir com a app».',
  offlineTitle:'Ús sense connexió',offlineText:'Quan hages obert l’aplicació per primera vegada amb Internet, torna-la a obrir sense connexió. Les partitures ja importades es recuperen del dispositiu. iOS pot eliminar dades del navegador si falta espai: guarda sempre una còpia del ZIP.',
  statusOnline:'Connexió disponible',statusOffline:'Sense connexió',disk:'Espai aproximat',dev:'Versió de prova W1.2.1',
  warningTitle:'Confirmar eliminació',warningText:'S’esborraran totes les partitures guardades en este dispositiu. Esta acció no es pot desfer.',
  deleteConfirm:'Sí, esborrar',cancel:'Cancel·lar',back:'Tornar',openExternal:'Obrir en un altre visor',
  viewerHint:'Si el PDF no es mostra correctament, toca «Obrir en un altre visor». La visualització depén de Safari.',
  noPrevious:'Anterior',noNext:'Següent',filePosition:'obra',
  selectLanguage:'Benvingut a Partitures Festeres Web',langHelp:'Tria l’idioma per a començar. Podràs canviar-lo en Ajustos.',
  start:'Començar',saved:'Idioma guardat',added:'partitures importades',updated:'Actualitzades',skipped:'Omeses',
  importing:'Important biblioteca…',preparing:'Preparant arxius…',largeZip:'El ZIP és massa gran per a esta prova (màxim 250 MB).',
  invalidFile:'No s’ha trobat cap PDF vàlid.',error:'No s’ha pogut importar el fitxer.',
  removed:'Partitura eliminada',allRemoved:'Biblioteca esborrada',pdfUnavailable:'No s’ha pogut obrir el PDF.',
  intro:'Prototip per a iPhone, iPad i ordinador · Sense comptes ni sincronització amb Drive',
  offlineReady:'Els PDF importats no ixen del teu dispositiu.',
  paths:'Carpetes de la biblioteca',welcomeQuote:'La música de les nostres festes, ara també al navegador.',
  noPaper:'Arrel completa',indexGroup:'Sense carpeta',emptyIndex:'Encara no hi ha obres a l’índex.',
  rename:'Importa una altra còpia amb la mateixa ruta per a substituir un PDF.',
  notSecure:'Per a instal·lar esta app cal publicar-la amb HTTPS (per exemple, en GitHub Pages).',
  errorStorage:'No s’ha pogut obrir l’emmagatzematge local.',
  restore:'Recuperar còpia',saveZip:'Conserva una còpia del ZIP original fora de l’app.',
  installStatus:'App instal·lable',network:'Estat',about:'Sobre esta versió',
  limitations:'Esta primera versió no inclou encara les anotacions, el sincronisme de Drive, els repertoris ni les ferramentes musicals.',
  help:'Ajuda',openPdf:'Obrir PDF',fileNumber:'Partitura',zipError:'ZIP no vàlid o protegit.',tooBig:'El PDF excedix el límit de prova de 100 MB.',
  browserNote:'No obris l’HTML com a fitxer local: publica’l en HTTPS o usa un servidor local per a les proves.',
  confirmOne:'Vols esborrar esta partitura del dispositiu?',
  backupTitle:'Còpies de seguretat',backupDesc:'Exporta les partitures i les preferències en un ZIP complet, que podràs guardar en Fitxers o en un disc extern.',
  createBackup:'Preparar còpia ZIP',restoreBackup:'Restaurar còpia ZIP',backupPrepared:'Còpia preparada',saveBackup:'Guardar ZIP',shareBackup:'Compartir / Guardar en Fitxers',
  backupTip:'Guardar la còpia fora de l’app és essencial: iOS pot esborrar les dades web si falta espai.',
  backupCreating:'Preparant la còpia de seguretat…',backupRestoring:'Restaurant biblioteca…',backupExported:'La còpia ZIP està preparada. Guarda-la fora de l’aplicació.',
  backupSent:'S’ha sol·licitat la descàrrega del ZIP.',backupShareCancelled:'Compartició cancel·lada',backupNotSaved:'No s’ha pogut compartir. Prova «Guardar ZIP».',
  backupWrongInput:'Este ZIP és una còpia de seguretat. Restaura’l des d’Ajustos, no des d’Importar.',
  restoreChoice:'Com vols restaurar la còpia?',restoreExplain:'La còpia conté {count} partitures ({size}). Es verificarà la integritat de cada PDF abans de fer cap canvi.',
  restoreMerge:'Afegir a la biblioteca',restoreReplace:'Substituir tota la biblioteca',restoreMergeHelp:'Conserva les partitures actuals i incorpora les de la còpia. Si coincidix una ruta, se substituïx eixe PDF. Conserva els ajustos actuals.',
  restoreReplaceHelp:'Esborra les partitures actuals que no estiguen en la còpia i restaura també els ajustos guardats. No es pot desfer; exporta abans una còpia de la biblioteca actual.',
  restoreSuccess:'Biblioteca restaurada correctament',restoreError:'La restauració no s’ha completat. Les partitures originals es conserven.',
  usage:'Ús total aproximat d’este lloc web',quota:'Quota indicada pel navegador',persistentYes:'Persistència del navegador concedida',persistentNo:'Persistència no garantida',
  storageNote:'L’ús i la quota són estimacions del navegador; no representen l’espai lliure total del dispositiu.',backupNoScores:'La biblioteca no conté encara cap PDF.',
  backupLarge:'Per a biblioteques grans, un ZIP únic pot requerir molta memòria en iPhone. Conserva una altra còpia dels PDF originals.',
  restorePending:'Llegint l’arxiu de còpia…',backupVerify:'Verificant PDF i preparant restauració…'
 },
 es: {
  subtitle:'La música de nuestras fiestas',library:'Biblioteca',index:'Índice',settings:'Ajustes',import:'Importar',importFiles:'Importar PDF o ZIP',
  folderCount:'carpetas',scoreCount:'partituras',search:'Buscar partituras...',all:'Raíz',paper:'Papel',
  emptyTitle:'Tu biblioteca, lista para empezar',emptyText:'Importa una o varias partituras en PDF, o un ZIP con las carpetas de la biblioteca. Los archivos se guardan en este dispositivo.',
  noResults:'No se han encontrado partituras.',noResultsDesc:'Prueba otra búsqueda o cambia de carpeta.',
  oneFile:'partitura',moreFiles:'partituras',indexSubtitle:'Todas las obras del papel seleccionado, agrupadas por carpeta',
  settingsSubtitle:'Preferencias y almacenamiento',language:'Idioma',languageHint:'Puedes cambiarlo en cualquier momento.',
  storage:'Biblioteca local',localHint:'Las partituras se guardan en este dispositivo, no en el servidor ni en Google Drive.',
  deleteAll:'Borrar biblioteca',deleteThis:'Eliminar esta partitura',installTitle:'Instalar en iPhone / iPad',
  installText:'Abre esta página en Safari, toca Compartir y elige «Añadir a pantalla de inicio». Activa «Abrir como app».',
  offlineTitle:'Uso sin conexión',offlineText:'Tras abrir la aplicación por primera vez con Internet, vuelve a abrirla sin conexión. Las partituras importadas se recuperan del dispositivo. iOS puede eliminar datos del navegador ante falta de espacio: guarda siempre una copia del ZIP.',
  statusOnline:'Conexión disponible',statusOffline:'Sin conexión',disk:'Espacio aproximado',dev:'Versión de prueba W1.2.1',
  warningTitle:'Confirmar eliminación',warningText:'Se borrarán todas las partituras guardadas en este dispositivo. Esta acción no se puede deshacer.',
  deleteConfirm:'Sí, borrar',cancel:'Cancelar',back:'Volver',openExternal:'Abrir en otro visor',
  viewerHint:'Si el PDF no se muestra correctamente, pulsa «Abrir en otro visor». La visualización depende de Safari.',
  noPrevious:'Anterior',noNext:'Siguiente',filePosition:'obra',
  selectLanguage:'Bienvenido a Partitures Festeres Web',langHelp:'Elige el idioma para empezar. Podrás cambiarlo en Ajustes.',
  start:'Empezar',saved:'Idioma guardado',added:'partituras importadas',updated:'Actualizadas',skipped:'Omitidas',
  importing:'Importando biblioteca…',preparing:'Preparando archivos…',largeZip:'El ZIP es demasiado grande para esta prueba (máximo 250 MB).',
  invalidFile:'No se ha encontrado ningún PDF válido.',error:'No se pudo importar el archivo.',
  removed:'Partitura eliminada',allRemoved:'Biblioteca borrada',pdfUnavailable:'No se pudo abrir el PDF.',
  intro:'Prototipo para iPhone, iPad y ordenador · Sin cuentas ni sincronización con Drive',
  offlineReady:'Los PDF importados no salen de tu dispositivo.',
  paths:'Carpetas de la biblioteca',welcomeQuote:'La música de nuestras fiestas, ahora también en el navegador.',
  noPaper:'Raíz completa',indexGroup:'Sin carpeta',emptyIndex:'Todavía no hay obras en el índice.',
  rename:'Importa otra copia con la misma ruta para sustituir un PDF.',
  notSecure:'Para instalar esta app hay que publicarla con HTTPS (por ejemplo, en GitHub Pages).',
  errorStorage:'No se pudo abrir el almacenamiento local.',
  restore:'Recuperar copia',saveZip:'Conserva una copia del ZIP original fuera de la app.',
  installStatus:'App instalable',network:'Estado',about:'Sobre esta versión',
  limitations:'Esta primera versión aún no incluye anotaciones, sincronización de Drive, repertorios ni herramientas musicales.',
  help:'Ayuda',openPdf:'Abrir PDF',fileNumber:'Partitura',zipError:'ZIP inválido o protegido.',tooBig:'El PDF excede el límite de prueba de 100 MB.',
  browserNote:'No abras el HTML como archivo local: publícalo en HTTPS o usa un servidor local para las pruebas.',
  confirmOne:'¿Quieres borrar esta partitura del dispositivo?',
  backupTitle:'Copias de seguridad',backupDesc:'Exporta las partituras y las preferencias en un ZIP completo, que podrás guardar en Archivos o en un disco externo.',
  createBackup:'Preparar copia ZIP',restoreBackup:'Restaurar copia ZIP',backupPrepared:'Copia preparada',saveBackup:'Guardar ZIP',shareBackup:'Compartir / Guardar en Archivos',
  backupTip:'Guardar la copia fuera de la app es esencial: iOS puede borrar los datos web si falta espacio.',
  backupCreating:'Preparando la copia de seguridad…',backupRestoring:'Restaurando biblioteca…',backupExported:'La copia ZIP está preparada. Guárdala fuera de la aplicación.',
  backupSent:'Se ha solicitado la descarga del ZIP.',backupShareCancelled:'Se ha cancelado el uso compartido',backupNotSaved:'No se pudo compartir. Prueba «Guardar ZIP».',
  backupWrongInput:'Este ZIP es una copia de seguridad. Restáuralo desde Ajustes, no desde Importar.',
  restoreChoice:'¿Cómo quieres restaurar la copia?',restoreExplain:'La copia contiene {count} partituras ({size}). Se verificará la integridad de cada PDF antes de realizar cambios.',
  restoreMerge:'Añadir a la biblioteca',restoreReplace:'Sustituir toda la biblioteca',restoreMergeHelp:'Conserva las partituras actuales e incorpora las de la copia. Si coincide una ruta, se sustituye ese PDF. Conserva los ajustes actuales.',
  restoreReplaceHelp:'Borra las partituras actuales que no estén en la copia y restaura también los ajustes guardados. No se puede deshacer; exporta antes una copia de la biblioteca actual.',
  restoreSuccess:'Biblioteca restaurada correctamente',restoreError:'La restauración no se ha completado. Se conservan las partituras originales.',
  usage:'Uso total aproximado de esta web',quota:'Cuota indicada por el navegador',persistentYes:'Persistencia del navegador concedida',persistentNo:'Persistencia no garantizada',
  storageNote:'El uso y la cuota son estimaciones del navegador; no representan el espacio libre total del dispositivo.',backupNoScores:'La biblioteca todavía no contiene PDF.',
  backupLarge:'Para bibliotecas grandes, un ZIP único puede requerir mucha memoria en iPhone. Conserva otra copia de los PDF originales.',
  restorePending:'Leyendo el archivo de copia…',backupVerify:'Verificando PDF y preparando restauración…'
 }
};
const $ = (q,root=document) => root.querySelector(q);
const esc = value => String(value??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = value => (value??'').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const sort = (a,b) => a.localeCompare(b,'ca',{numeric:true,sensitivity:'base'});
const state={lang:'va',page:'library',paper:'root',cwd:[],scores:[],search:'',view:null,blobUrl:null,modal:null,toastTimer:null,loading:false,online:navigator.onLine,storage:null,backup:null,restore:null};
const tr = key => L[state.lang][key]||key;
const nice = value => value.replace(/\.pdf$/i,'');
const topDir = path => path.split('/')[0];
const parts = path => path.split('/').filter(Boolean);
const bytes = n => n>1048576?(n/1048576).toFixed(1)+' MB': n>1024?(n/1024).toFixed(0)+' KB':n+' B';
const sizeTotal = () => state.scores.reduce((acc,s)=>acc+(s.size||0),0);
const fileList = () => [...state.scores].sort((a,b)=>sort(a.path,b.path));
const paperRoots = () => [...new Set(state.scores.map(s=>topDir(s.path)).filter(name => /^\d{1,2}\s*(?:er|r|n|t|é|º|ª)?$/i.test(name) && state.scores.some(s=>s.path.startsWith(name+'/'))))].sort(sort);
function scopedScores(){return state.paper==='root'?fileList():fileList().filter(s=>s.path.startsWith(state.paper+'/'));}
function currentBase(){return [...(state.paper==='root'?[]:[state.paper]),...state.cwd].join('/');}
function relativePath(path){return state.paper==='root'?path:path.slice(state.paper.length+1);}
function setPage(page){state.page=page;state.search='';state.cwd=[];state.view=null;render();}
function availableFolders(records,prefix='') {
 const folders=new Set();let direct=[];
 for(const s of records){
  const path=s.path;
  if(prefix && !path.startsWith(prefix+'/')) continue;
  const rel=prefix?path.slice(prefix.length+1):path;
  if(rel.includes('/'))folders.add(rel.split('/')[0]);else direct.push(s);
 }
 return {folders:[...folders].sort(sort),direct:direct.sort((a,b)=>sort(a.path,b.path))};
}
function nav(name,page){return `<button class="navlink ${state.page===page?'selected':''}" data-action="page" data-value="${page}">${icon(name)} <span>${esc(tr(page))}</span></button>`;}
function tabsMobile(name,page){return `<button class="bottom-link ${state.page===page?'selected':''}" data-action="page" data-value="${page}">${icon(name)}<span>${esc(tr(page))}</span></button>`;}
function paperBar(){
 const ps=paperRoots(); if(!ps.length)return '';
 return `<div class="paper-row"><span class="paper-label">${esc(tr('paper'))}</span><div class="paper-tabs">${ps.map((p,i)=>`<button class="tab ${state.paper===p?'active':''}" data-action="paper" data-value="${esc(p)}" aria-pressed="${state.paper===p}">${esc(p)}</button>`).join('')}<button class="tab ${state.paper==='root'?'active':''}" data-action="paper" data-value="root" aria-pressed="${state.paper==='root'}">${esc(tr('all'))}</button></div></div>`;
}
function breadcrumbs(){
 const arr=state.cwd;
 const nodes=[{name: state.paper==='root'?tr('all'):state.paper,depth:0},...arr.map((n,i)=>({name:n,depth:i+1}))];
 return `<div class="crumbs">${nodes.map((s,i)=>`<button class="crumb ${i===nodes.length-1?'last':''}" data-action="crumb" data-value="${s.depth}">${esc(s.name)}</button>${i===nodes.length-1?'':icon('next')}`).join('')}</div>`;
}
function searchBox(){return `<div class="search-wrap">${icon('search')}<input id="search-input" class="search" type="search" autocomplete="off" placeholder="${esc(tr('search'))}" value="${esc(state.search)}" /></div>`;}
function heading(page,subtitle){return `<div class="heading"><div><h2>${esc(tr(page))}</h2><p>${esc(subtitle)}</p></div></div>`;}
function empty(title,body,showImport=false){return `<div class="empty"><div class="hero-icon">♫</div><h3>${esc(title)}</h3><p>${esc(body)}</p>${showImport?`<button class="primary" data-action="import">${icon('upload')}${esc(tr('importFiles'))}</button>`:''}</div>`;}
function renderLibrary(){
 const total=state.scores.length;
 if(!total)return heading('library',tr('welcomeQuote'))+empty(tr('emptyTitle'),tr('emptyText'),true);
 const prefix=currentBase();
 let selected=scopedScores();
 const visible=availableFolders(selected,prefix);
 const q=norm(state.search.trim());
 let folders=visible.folders,docs=visible.direct;
 if(q){
  docs=selected.filter(s => norm(s.path).includes(q)).sort((a,b)=>sort(a.path,b.path));folders=[];
 }
 const allInScope=selected.length;
 const folderCount=folders.length;
 const s=`<div class="stats"><span class="stat">${icon('file')}${allInScope} ${esc(tr('scoreCount'))}</span><span class="stat">${icon('folder')}${folderCount} ${esc(tr('folderCount'))}</span></div>`;
 const fs=folders.map(name=>{
  const newPrefix=[prefix,name].filter(Boolean).join('/');
  const count=selected.filter(x=>x.path.startsWith(newPrefix+'/')).length;
  return `<button class="entry" data-action="folder" data-value="${esc(name)}"><span class="entry-ico">${icon('folder')}</span><span class="entry-text"><span class="entry-title">${esc(name)}</span><div class="entry-note">${count} ${esc(tr('scoreCount'))}</div></span></button>`;
 }).join('');
 const ds=docs.map(s=>`<button class="entry" data-action="open" data-value="${esc(s.path)}"><span class="entry-ico pdf">${icon('file')}</span><span class="entry-text"><span class="entry-title">${esc(nice(parts(s.path).at(-1)))}</span><div class="entry-note">${esc(q?relativePath(s.path):bytes(s.size))}</div></span></button>`).join('');
 return heading('library',tr('subtitle'))+paperBar()+breadcrumbs()+`<div class="section-tools">${searchBox()}</div>`+s+(fs||ds?`<div class="cards" style="margin-top:19px">${fs+ds}</div>`:empty(tr('noResults'),tr('noResultsDesc')));
}
function renderIndex(){
 const selected=scopedScores(),q=norm(state.search.trim());
 const records=selected.filter(x=>norm(relativePath(x.path)).includes(q));
 const groups=new Map();
 for(const score of records){const p=relativePath(score.path);const dirs=parts(p).slice(0,-1).join(' / ')||tr('indexGroup');if(!groups.has(dirs))groups.set(dirs,[]);groups.get(dirs).push(score);}
 const ui=[...groups.entries()].sort((a,b)=>sort(a[0],b[0])).map(([group,files])=>`<section class="group"><div class="group-title">${icon('folder')} <span>${esc(group)}</span><small>${files.length}</small></div><div class="list">${files.map(s=>`<button class="list-row" data-action="open" data-value="${esc(s.path)}">${icon('file')}<span class="filetitle">${esc(nice(parts(s.path).at(-1)))}</span><small>${esc(bytes(s.size))}</small></button>`).join('')}</div></section>`).join('');
 return heading('index',tr('indexSubtitle'))+paperBar()+`<div class="section-tools">${searchBox()}<span class="stat">${icon('book')}${selected.length} ${esc(tr('scoreCount'))}</span></div>`+(ui||empty(tr('emptyIndex'),tr('emptyText'),selected.length===0));
}
function renderSettings(){
 return heading('settings',tr('settingsSubtitle'))+`
 <div class="panel"><h3>${icon('settings')} ${esc(tr('language'))}</h3><p>${esc(tr('languageHint'))}</p>
  <div class="line"><span>${esc(tr('language'))}</span><select id="language-select" aria-label="${esc(tr('language'))}"><option value="va" ${state.lang==='va'?'selected':''}>Valencià</option><option value="es" ${state.lang==='es'?'selected':''}>Castellano</option></select></div></div>
 <div class="panel"><h3>${icon('folder')} ${esc(tr('storage'))}</h3><p>${esc(tr('localHint'))}</p>
  <div class="line"><span>${esc(tr('scoreCount'))}</span><strong>${state.scores.length}</strong></div>
  <div class="line"><span>${esc(tr('disk'))}</span><strong>${bytes(sizeTotal())}</strong></div>
  <div class="line"><span>${esc(tr('network'))}</span><strong>${state.online?tr('statusOnline'):tr('statusOffline')}</strong></div>
  ${state.storage?.usage!=null?`<div class="line"><span>${esc(tr('usage'))}</span><strong>${esc(bytes(state.storage.usage))}</strong></div>`:''}
  ${state.storage?.quota!=null?`<div class="line"><span>${esc(tr('quota'))}</span><strong>${esc(bytes(state.storage.quota))}</strong></div>`:''}
  <p class="help">${esc(state.storage?.persisted?tr('persistentYes'):tr('persistentNo'))}. ${esc(tr('storageNote'))}</p>
  <div class="line"><button class="secondary" data-action="import">${icon('upload')}${esc(tr('importFiles'))}</button><button class="secondary" data-action="clear">${icon('trash')}${esc(tr('deleteAll'))}</button></div>
  <p class="help">${esc(tr('saveZip'))}</p></div>
 <div class="panel backup-panel"><h3>${icon('save')} ${esc(tr('backupTitle'))}</h3><p>${esc(tr('backupDesc'))}</p>
  <div class="backup-buttons"><button class="primary" data-action="backup-create" ${state.loading||!state.scores.length?'disabled':''}>${icon('download')}${esc(tr('createBackup'))}</button><button class="secondary" data-action="backup-choose" ${state.loading?'disabled':''}>${icon('restore')}${esc(tr('restoreBackup'))}</button></div>
  ${state.backup?`<div class="backup-ready"><strong>${icon('check')} ${esc(tr('backupPrepared'))}</strong><small>${esc(state.backup.name)} · ${esc(bytes(state.backup.blob.size))}</small><div class="backup-buttons"><button class="primary" data-action="backup-save">${icon('download')}${esc(tr('saveBackup'))}</button>${typeof navigator.share==='function'?`<button class="secondary" data-action="backup-share">${icon('share')}${esc(tr('shareBackup'))}</button>`:''}</div></div>`:''}
  <p class="help">${esc(tr('backupTip'))}</p><p class="help">${esc(tr('backupLarge'))}</p></div>
 <div class="panel"><h3>${icon('share')} ${esc(tr('installTitle'))}</h3><p>${esc(tr('installText'))}</p>
   <p class="help">${esc(tr('offlineText'))}</p>
 </div>
 <div class="panel"><h3>${icon('info')} ${esc(tr('about'))}</h3><p>${esc(tr('limitations'))}</p><p>${esc(tr('intro'))}</p><div class="line"><strong>Partitures Festeres Web — W1.2.1</strong><span>© SMN Systems</span></div></div>`;
}
function renderModal(){if(!state.modal)return '';
 if(state.modal==='welcome')return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><img src="./assets/icon-192.png" alt="Partitures Festeres"/><h2>Benvingut · Bienvenido</h2><p>Tria l’idioma · Elige el idioma</p><label><input type="radio" name="welcome-lang" value="va" ${state.lang==='va'?'checked':''}/> Valencià</label><label><input type="radio" name="welcome-lang" value="es" ${state.lang==='es'?'checked':''}/> Castellano</label><div class="modal-actions"><button class="primary" data-action="welcome-done">Començar · Empezar</button></div></div></div>`;
 if(state.modal==='restore-choice'&&state.restore){const m=state.restore.manifest;return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="restore-title"><div class="modal restore-modal"><h2 id="restore-title">${esc(tr('restoreChoice'))}</h2><p>${esc(tr('restoreExplain').replace('{count}',m.scoreCount).replace('{size}',bytes(m.totalBytes)))}</p><div class="restore-options"><div><strong>${esc(tr('restoreMerge'))}</strong><p>${esc(tr('restoreMergeHelp'))}</p><button class="primary" data-action="restore-merge">${icon('upload')}${esc(tr('restoreMerge'))}</button></div><div class="replace-option"><strong>${esc(tr('restoreReplace'))}</strong><p>${esc(tr('restoreReplaceHelp'))}</p><button class="danger" data-action="restore-replace">${icon('restore')}${esc(tr('restoreReplace'))}</button></div></div><div class="modal-actions"><button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button></div></div></div>`;}
 if(state.modal==='clear')return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><h2>${esc(tr('warningTitle'))}</h2><p>${esc(tr('warningText'))}</p><div class="modal-actions"><button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button><button class="danger" data-action="confirm-clear">${esc(tr('deleteConfirm'))}</button></div></div></div>`;
 if(state.modal==='delete-one')return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><h2>${esc(tr('warningTitle'))}</h2><p>${esc(tr('confirmOne'))}</p><p><strong>${esc(state.view?.path||'')}</strong></p><div class="modal-actions"><button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button><button class="danger" data-action="confirm-delete-one">${esc(tr('deleteConfirm'))}</button></div></div></div>`;
 return '';
}
function renderViewer(){if(!state.view)return '';
 const list=scopedScores();const idx=list.findIndex(s=>s.path===state.view.path);const p=idx>=0?idx:0;
 return `<div class="viewer" role="dialog" aria-label="${esc(tr('openPdf'))}">
 <div class="viewer-top"><button class="quiet" data-action="viewer-close" aria-label="${esc(tr('back'))}">${icon('back')}</button><span class="viewer-title">${esc(nice(parts(state.view.path).at(-1)))}</span><button class="quiet" data-action="delete-one" title="${esc(tr('deleteThis'))}">${icon('trash')}</button><button class="secondary" data-action="viewer-external">${icon('share')}<span class="viewer-extended">${esc(tr('openExternal'))}</span></button></div>
 <iframe class="viewer-frame" title="${esc(state.view.path)}" src="${esc(state.blobUrl)}#view=FitH" allow="fullscreen"></iframe>
 <div class="viewer-fallback">${esc(tr('viewerHint'))}</div>
 <div class="viewer-bottom"><button data-action="viewer-prev" ${p<=0?'disabled':''}>${icon('back')} ${esc(tr('noPrevious'))}</button><span>${p+1} / ${list.length} ${esc(tr('scoreCount'))}</span><button data-action="viewer-next" ${p>=list.length-1?'disabled':''}>${esc(tr('noNext'))} ${icon('next')}</button></div>
 </div>`;
}
function render(){
 document.documentElement.lang = state.lang==='va'?'ca-ES-valencia':'es';
 document.title='Partitures Festeres Web';
 const page=state.page==='index'?renderIndex():state.page==='settings'?renderSettings():renderLibrary();
 $('#app').innerHTML = `<header class="topbar"><div class="brand"><img src="./assets/icon-192.png" alt=""/><div><h1>Partitures Festeres</h1><small>${esc(tr('subtitle'))}</small></div></div><div class="top-actions"><button class="primary" data-action="import">${icon('upload')} ${esc(tr('import'))}</button></div></header>
 <div class="main-layout"><aside class="sidebar"><span class="side-caption">Partitures Festeres Web</span>${nav('library','library')}${nav('book','index')}${nav('settings','settings')}<div class="side-bottom">${esc(tr('dev'))}<p>${esc(tr('offlineReady'))}</p></div></aside><main class="content">${page}</main></div>
 <nav class="bottom-nav" aria-label="Navegació">${tabsMobile('library','library')}${tabsMobile('book','index')}${tabsMobile('settings','settings')}</nav>${renderViewer()}${renderModal()}`;
}
function toast(message,isError=false){$('.toast')?.remove();clearTimeout(state.toastTimer);const div=document.createElement('div');div.className='toast'+(isError?' error':'');div.setAttribute('role','status');div.textContent=message;document.body.append(div);state.toastTimer=setTimeout(()=>div.remove(),5500);}
function progress(show,txt){$('.import-progress')?.remove();if(!show)return;const d=document.createElement('div');d.className='import-progress';d.innerHTML=`<div class="panel" role="status"><div class="spinner"></div><h3>${esc(tr('importing'))}</h3><p id="import-progress-text">${esc(txt||tr('preparing'))}</p></div>`;document.body.append(d);}
function normalizePath(raw){
 let path=String(raw).replace(/\\/g,'/').replace(/^\/+/, '').replace(/\/+/g,'/');
 const p=path.split('/');if(p.some(seg=>seg==='..'||seg==='.'||/[\x00-\x1f]/.test(seg)))return null;
 if(path.startsWith('__MACOSX/')||path.split('/').some(seg=>seg.startsWith('.')))return null;
 if(!/\.pdf$/i.test(path))return null;
 if(path.length>500)return null;
 return path;
}
function stripCommonRoot(paths){
 // Els ZIP d'Android poden contindre una carpeta contenidora «Partitures/».
 if(paths.length===0)return paths;
 const first=paths[0].split('/')[0];
 if(paths.every(p=>p.startsWith(first+'/')) && /^(?:partitures|partituras|sheet.music|biblioteca)$/i.test(first))return paths.map(p=>p.slice(first.length+1));
 return paths;
}
function pdfHeader(blob){return blob.slice(0,1024).arrayBuffer().then(a => new TextDecoder('ascii').decode(a).includes('%PDF-'));}
async function importSelected(files){
 if(!files?.length)return;
 progress(true);
 let added=0,skipped=0,errors=[];
 try{
  for(const input of files){
   if(input.name.toLowerCase().endsWith('.zip')){
    if(input.size>250*1024*1024){errors.push(`${input.name}: ${tr('largeZip')}`);continue;}
    let zip;
    try{zip=await window.JSZip.loadAsync(input,{checkCRC32:false});}
    catch(e){errors.push(`${input.name}: ${tr('zipError')}`);continue;}
    if(zip.file(BACKUP_MANIFEST)){errors.push(`${input.name}: ${tr('backupWrongInput')}`);continue;}
    const entries=Object.values(zip.files).filter(e=>!e.dir && /\.pdf$/i.test(e.name));
    const original=entries.map(e=>normalizePath(e.name));
    const valid=original.map((path,i)=>({entry:entries[i],path})).filter(v=>v.path);
    const normalized=stripCommonRoot(valid.map(v=>v.path));
    for(let start=0;start<valid.length;start+=12){
     const batch=[];
     for(let j=start;j<Math.min(valid.length,start+12);j++){
      const entry=valid[j],path=normalized[j];
      if(!path){skipped++;continue;}
      if(entry.entry._data?.uncompressedSize>100*1024*1024){skipped++;errors.push(`${path}: ${tr('tooBig')}`);continue;}
      try{
       const blob=await entry.entry.async('blob');
       if(blob.size>100*1024*1024||!(await pdfHeader(blob))){skipped++;continue;}
       batch.push({path,blob:new Blob([blob],{type:'application/pdf'}),size:blob.size,added:Date.now()});
      }catch(e){skipped++;errors.push(`${path}: ${e.message}`);}
     }
     if(batch.length){await saveBatch(batch);added+=batch.length;}
     if($('#import-progress-text'))$('#import-progress-text').textContent=`${added} / ${valid.length} ${tr('scoreCount')}`;
     await new Promise(r=>setTimeout(r,0));
    }
   } else if(input.name.toLowerCase().endsWith('.pdf')||input.type==='application/pdf'){
    if(input.size>100*1024*1024){errors.push(`${input.name}: ${tr('tooBig')}`);skipped++;continue;}
    if(!(await pdfHeader(input))){skipped++;continue;}
    const path=normalizePath(input.name);
    if(!path){skipped++;continue;}
    await saveBatch([{path,blob:new Blob([input],{type:'application/pdf'}),size:input.size,added:Date.now()}]);added++;
   }else skipped++;
  }
  state.scores=await getAllScores();
  const papers=paperRoots();
  if(state.paper==='root'&&papers.length)state.paper=papers[0];
  if(state.paper!=='root'&&!papers.includes(state.paper))state.paper=papers[0]||'root';
  state.cwd=[];state.search='';state.page='library';
  await setPref('paper',state.paper);
  render();updateStorageInfo();
  toast(`${added} ${tr('added')}${skipped?` · ${skipped} ${tr('skipped')}`:''}${errors.length?` · ${errors[0]}`:''}`,!!errors.length&&added===0);
 }catch(e){console.error(e);toast(`${tr('error')} ${e?.message||''}`,true);state.scores=await getAllScores().catch(()=>state.scores);render();}
 finally{progress(false);$('#import-input').value='';}
}
async function openPdf(path){
 const record=await getScore(path);
 if(!record?.blob){toast(tr('pdfUnavailable'),true);return;}
 if(state.blobUrl)URL.revokeObjectURL(state.blobUrl);
 state.blobUrl=URL.createObjectURL(record.blob);
 state.view={path};render();
}
function closeViewer(){if(state.blobUrl){URL.revokeObjectURL(state.blobUrl);state.blobUrl=null;}state.view=null;render();}
async function updateStorageInfo() {
  if(!navigator.storage) return;
  try {
    const estimate=await navigator.storage.estimate?.();
    const persisted=await navigator.storage.persisted?.();
    state.storage={usage:Number.isFinite(estimate?.usage)?estimate.usage:null,
      quota:Number.isFinite(estimate?.quota)?estimate.quota:null,persisted:persisted===true};
    if(state.page==='settings'&&!state.modal&&!state.view) render();
  } catch { /* Els navegadors no sempre permeten consultar-ho. */ }
}
function updateProgress(msg){const text=$('#import-progress-text');if(text)text.textContent=msg;}
async function doBackup(){
  if(state.loading) return;
  if(!state.scores.length){toast(tr('backupNoScores'),true);return;}
  state.loading=true;progress(true,tr('backupCreating'));
  try{
    const backup=await createBackup(p=>{
      if(p.phase==='read') updateProgress(`${p.done} / ${p.total} ${tr('scoreCount')}`);
      if(p.phase==='zip') updateProgress(`${tr('backupCreating')} ${Math.round(p.percent||0)} %`);
    });
    if(state.backup?.url) URL.revokeObjectURL(state.backup.url);
    state.backup={blob:backup.blob,name:backup.filename,url:URL.createObjectURL(backup.blob)};
    state.page='settings';render();toast(tr('backupExported'));
  }catch(e){console.error(e);toast(`${tr('error')} ${e.message}`,true);}
  finally{state.loading=false;progress(false);}
}
function saveBackup(){
  if(!state.backup) return;
  const a=document.createElement('a');a.href=state.backup.url;a.download=state.backup.name;
  document.body.append(a);a.click();a.remove();
  toast(tr('backupSent'));
}
async function shareBackup(){
  if(!state.backup || !navigator.share) return;
  const file=new File([state.backup.blob],state.backup.name,{type:'application/zip'});
  try{
    if(navigator.canShare && !navigator.canShare({files:[file]}))throw new Error('El navegador no permet compartir ZIP.');
    await navigator.share({files:[file],title:'Partitures Festeres Web'});
  }catch(e){if(e?.name==='AbortError')toast(tr('backupShareCancelled'));else toast(`${tr('backupNotSaved')} ${e?.message||''}`,true);}
}
async function chooseRestoreFile(file){
  if(!file || state.loading)return;
  state.loading=true;progress(true,tr('restorePending'));
  try{state.restore=await inspectBackup(file);state.modal='restore-choice';render();}
  catch(e){console.error(e);toast(`${tr('error')} ${e.message}`,true);}
  finally{state.loading=false;progress(false);$('#restore-input').value='';}
}
async function doRestore(mode){
  if(state.loading||!state.restore)return;
  state.loading=true;state.modal=null;render();progress(true,tr('backupVerify'));
  try{
    const count=await restoreBackup(state.restore,mode,p=>updateProgress(`${tr('backupVerify')} ${p.done} / ${p.total}`));
    state.restore=null;
    state.scores=await getAllScores();
    if(mode==='replace'){
      const lang=await getPref('lang',state.lang);state.lang=lang==='es'?'es':'va';
      state.paper=await getPref('paper','root');
    }
    const paperList=paperRoots();
    if(state.paper!=='root'&&!paperList.includes(state.paper))state.paper=paperList[0]||'root';
    state.cwd=[];state.page='library';state.search='';closeViewerIfNeeded();render();
    toast(`${tr('restoreSuccess')} · ${count} ${tr('scoreCount')}`);updateStorageInfo();
  }catch(e){console.error(e);state.scores=await getAllScores().catch(()=>state.scores);render();toast(`${tr('restoreError')} ${e?.message||''}`,true);}
  finally{state.loading=false;progress(false);}
}
async function handleClick(el){
 const action=el.dataset.action,val=el.dataset.value;
 switch(action){
  case 'page': closeViewerIfNeeded();setPage(val);break;
  case 'paper':state.paper=val;state.cwd=[];state.search='';await setPref('paper',val);render();break;
  case 'crumb':state.cwd=state.cwd.slice(0,Number(val));state.search='';render();break;
  case 'folder':state.cwd.push(val);state.search='';render();break;
  case 'import':$('#import-input').click();break;
  case 'backup-create':await doBackup();break;
  case 'backup-choose':$('#restore-input').click();break;
  case 'backup-save':saveBackup();break;
  case 'backup-share':await shareBackup();break;
  case 'restore-merge':await doRestore('merge');break;
  case 'restore-replace':await doRestore('replace');break;
  case 'open':await openPdf(val);break;
  case 'viewer-close':closeViewer();break;
  case 'viewer-prev':case 'viewer-next':{
    const a=scopedScores(),i=a.findIndex(s=>s.path===state.view?.path),other=a[i+(action==='viewer-prev'?-1:1)];if(other)await openPdf(other.path);break;
  }
  case 'viewer-external':if(state.blobUrl){const anchor=document.createElement('a');anchor.href=state.blobUrl;anchor.target='_blank';anchor.rel='noopener';anchor.click();}break;
  case 'delete-one':state.modal='delete-one';render();break;
  case 'clear':state.modal='clear';render();break;
  case 'close-modal':state.modal=null;state.restore=null;render();break;
  case 'confirm-delete-one':{
    const path=state.view?.path;if(path)await deleteScore(path);
    state.scores=await getAllScores();state.modal=null;closeViewer();updateStorageInfo();toast(tr('removed'));break;
  }
  case 'confirm-clear':await clearScores();state.scores=[];state.paper='root';state.cwd=[];await setPref('paper','root');state.modal=null;closeViewerIfNeeded();render();updateStorageInfo();toast(tr('allRemoved'));break;
  case 'welcome-done':state.modal=null;await setPref('lang',state.lang);render();break;
 }
}
function closeViewerIfNeeded(){if(state.view){URL.revokeObjectURL(state.blobUrl);state.blobUrl=null;state.view=null;}}
async function init(){
 try{
  await openDB();
  const configured=await getPref('lang');
  state.lang=configured==='es'?'es':'va';
  state.scores=await getAllScores();
  state.paper=await getPref('paper','root');
  const papers=paperRoots();
  if(state.paper!=='root'&&!papers.includes(state.paper))state.paper=papers[0]||'root';
  if(state.paper==='root'&&papers.length&&!(await getPref('paper')))state.paper=papers[0];
  if(configured!=='es'&&configured!=='va')state.modal='welcome';
  render();
  updateStorageInfo();
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
   navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>console.warn('Service worker:',e));
  }
  if(navigator.storage?.persist){ // iOS pot ignorar la petició. No prometem persistència.
   navigator.storage.persist().catch(()=>{});
  }
 }catch(e){console.error(e);$('#app').innerHTML=`<div class="empty"><h3>Partitures Festeres</h3><p>${esc(L.va.errorStorage)}: ${esc(e.message)}</p></div>`;}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){e.preventDefault();handleClick(b).catch(err=>{console.error(err);toast(`${tr('error')} ${err.message}`,true);});}});
document.addEventListener('input',e=>{
 if(e.target.id==='search-input'){
  const focus=e.target,sel=focus.selectionStart;state.search=focus.value;
  render();const newInput=$('#search-input');newInput?.focus();try{newInput?.setSelectionRange(sel,sel);}catch{}
 }
});
document.addEventListener('change',e=>{
 if(e.target.id==='import-input')importSelected([...e.target.files]);
 if(e.target.id==='restore-input')chooseRestoreFile(e.target.files?.[0]);
 if(e.target.name==='welcome-lang'){state.lang=e.target.value;render();}
 if(e.target.id==='language-select'){state.lang=e.target.value;setPref('lang',state.lang).then(()=>{render();toast(tr('saved'));});}
});
window.addEventListener('online',()=>{state.online=true;if(state.page==='settings'&&!state.view)render();});
window.addEventListener('pagehide',()=>{if(state.backup?.url)URL.revokeObjectURL(state.backup.url);});
window.addEventListener('offline',()=>{state.online=false;if(state.page==='settings'&&!state.view)render();});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&state.modal&&state.modal!=='welcome'){state.modal=null;render();}
 else if(e.key==='Escape'&&state.view)closeViewer();
 else if(e.key==='ArrowRight'&&state.view){const a=scopedScores(),idx=a.findIndex(s=>s.path===state.view.path);if(a[idx+1])openPdf(a[idx+1].path);}
 else if(e.key==='ArrowLeft'&&state.view){const a=scopedScores(),idx=a.findIndex(s=>s.path===state.view.path);if(a[idx-1])openPdf(a[idx-1].path);}
});
init();
