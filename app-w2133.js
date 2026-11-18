import {openDB, getAllScores, getScore, saveBatch, setScoreMetadata, deleteScore, clearScores, getPref, setPref, getAnnotations, setAnnotations} from './db.js';
import {normalizeScoreMetadata, scoreDisplayTitle, hasScoreMetadata} from './metadata.js';
import {BACKUP_MANIFEST, createBackup, inspectBackup, restoreBackup} from './backup.js';
import {ScoreViewer} from './viewer-w28.js';
import {ANNOTATION_COLORS,TEXT_SIZES,TEXT_OPACITIES} from './annotations.js';
import {MUSICAL_SYMBOLS,SYMBOL_GROUPS,SYMBOL_SIZES,isMusicalSymbol,musicalSymbolIcon} from './musical-symbols.js';
import {blankAdvancedFilters,countAdvancedFilters,matchesScoreSearch} from './search-filters.js';
import {INDEX_GROUP_MODES,INDEX_SORT_MODES,buildIndexGroups} from './index-groups.js';
import {readNavigation,writeNavigation,validateNavigation,snapshotNavigation} from './navigation-state.js';
import {rosetteOptions,rosetteParent,rosettePetalPosition,clampRosetteCenter,ROSETTE_ROOT} from './rosette-w28.js';
import {clientToViewerPoint,isViewerCssRotated} from './viewer-orientation.js';
import {renderRosetteMarkup} from './rosette-ui-w28.js';
import {MetronomeController} from './metronome-controller-w210.js';
import {TunerController} from './tuner-controller-w210.js';
import {ReferenceToneController} from './reference-tone-controller-w211.js';
import {DictationController} from './dictation-controller-w2122.js';
import {ScannerController} from './scanner-controller-w2133.js';
import {ScanCropEditor} from './scanner-crop-editor-w2133.js';
import {DocumentCamera} from './scanner-camera-w2132.js';
import {uniqueScanPath} from './scanner-pdf-w2131.js';

// Font única de la versió visible tant en Ajustos com al peu de la navegació.
const APP_VERSION='W2.13.3';

const I = {
  library:'<svg viewBox="0 0 24 24"><path d="M3 6h6l2 2h10v12H3z"/><path d="M3 8V5h6l2 3"/></svg>',
  folder:'<svg viewBox="0 0 24 24"><path d="M3 6h7l2.2 3H21v11H3z"/></svg>',
  file:'<svg viewBox="0 0 24 24"><path d="M6 2h8l5 5v15H6z"/><path d="M14 2v6h5M9 12h7M9 16h7"/></svg>',
  book:'<svg viewBox="0 0 24 24"><path d="M4 4c3-1 6-1 8 1 2-2 5-2 8-1v16c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 5v16"/></svg>',
  settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 1.2 1.2-2.3 3.1-1.6-.7-2.2 1-.3 1.7h-4.1L9.7 19l-2-1-1.6.7-2.3-3.1L5 14l-.3-2.5L3 10.4l1.5-3.2L6.2 7l2-1 .4-1.7h4.1l.4 1.7 2.1 1 1.5-.7L20 9.5l-1.3 1.4z"/></svg>',
  upload:'<svg viewBox="0 0 24 24"><path d="M12 17V3m-5 5 5-5 5 5M4 15v5h16v-5"/></svg>',
  camera:'<svg viewBox="0 0 24 24"><path d="M4 7h4l2-2h4l2 2h4v12H4z"/><circle cx="12" cy="13" r="3"/></svg>',
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
  restore:'<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 1 3 6.7M3 19v-6h6M12 7v5l4 2"/></svg>',
  zoomin:'<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M6 10h8M10 6v8"/></svg>',
  zoomout:'<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M6 10h8"/></svg>',
  rotate:'<svg viewBox="0 0 24 24"><path d="M4 11a8 8 0 1 1 2 6M4 4v7h7M8 13h8v5H8z"/></svg>',
  expand:'<svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>',
  fit:'<svg viewBox="0 0 24 24"><path d="M3 7V3h4M17 3h4v4M3 17v4h4M21 17v4h-4M7 12h10"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M13 6l5 5M4 20l4.5-1L20 7.5 16.5 4 5 15.5 4 20zM4 20h16"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="m12 2 3.1 6.4 7 1-5.05 4.95 1.2 7L12 18l-6.25 3.35 1.2-7L1.9 9.4l7-1z"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>',
  list:'<svg viewBox="0 0 24 24"><path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg>',
  up:'<svg viewBox="0 0 24 24"><path d="m5 15 7-7 7 7"/></svg>',
  down:'<svg viewBox="0 0 24 24"><path d="m5 9 7 7 7-7"/></svg>',
  erase:'<svg viewBox="0 0 24 24"><path d="m4 15 9-10 7 6-9 10H7zM9 21h12"/></svg>',
  move:'<svg viewBox="0 0 24 24"><path d="M12 2v20M2 12h20m-13-7 3-3 3 3m-6 14 3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/></svg>',
  lineShape:'<svg viewBox="0 0 24 24"><path d="M4 20 20 4"/></svg>',
  rectShape:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" fill="none"/></svg>',
  ellipseShape:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="7" fill="none"/></svg>',
  arrowShape:'<svg viewBox="0 0 24 24"><path d="m4 20 16-16M10 4h10v10"/></svg>',
  textShape:'<svg viewBox="0 0 24 24"><path d="M4 6h16M12 6v14M8 20h8M4 6v4m16-4v4"/></svg>',
  musicSymbol:'<svg viewBox="0 0 24 24"><ellipse cx="7" cy="18" rx="4" ry="3"/><path d="M11 18V3l9-2v14"/><ellipse cx="16" cy="16" rx="4" ry="3"/></svg>'
};
const icon = (name) => `<span class="icon" aria-hidden="true">${I[name]||I.file}</span>`;
const L = {
 va: {
  subtitle:'La música de les nostres festes',library:'Biblioteca',index:'Índex',tools:'Eines',toolsSubtitle:'Metrònom, afinador, nota de referència i Dictat Musical per als teus assajos',settings:'Ajustos',import:'Importar',importFiles:'Importar PDF o ZIP',
  folderCount:'carpetes',scoreCount:'partitures',search:'Buscar partitures...',all:'Arrel',paper:'Paper',
  emptyTitle:'La teua biblioteca, preparada per a començar',emptyText:'Importa una o diverses partitures en PDF, o un ZIP que continga les carpetes de la biblioteca. Els arxius es guarden en este dispositiu.',
  noResults:'No s’han trobat partitures.',noResultsDesc:'Prova amb una altra cerca o canvia de carpeta.',
  oneFile:'partitura',moreFiles:'partitures',indexSubtitle:'Totes les obres del paper seleccionat, organitzades com preferisques',
  settingsSubtitle:'Preferències i emmagatzematge',language:'Idioma',languageHint:'Es pot canviar en qualsevol moment.',
  storage:'Biblioteca local',localHint:'Les partitures estan guardades en este dispositiu, no al servidor ni a Google Drive.',
  deleteAll:'Esborrar biblioteca',deleteThis:'Esborrar esta partitura',installTitle:'Instal·lar a iPhone / iPad',
  installText:'Obri esta pàgina en Safari, toca Compartir i selecciona «Afegir a la pantalla d’inici». Activa «Obrir com a app».',
  offlineTitle:'Ús sense connexió',offlineText:'Quan hages obert l’aplicació per primera vegada amb Internet, torna-la a obrir sense connexió. Les partitures ja importades es recuperen del dispositiu. iOS pot eliminar dades del navegador si falta espai: guarda sempre una còpia del ZIP.',
  statusOnline:'Connexió disponible',statusOffline:'Sense connexió',disk:'Espai aproximat',dev:'Versió de prova',
  warningTitle:'Confirmar eliminació',warningText:'S’esborraran totes les partitures guardades en este dispositiu. Esta acció no es pot desfer.',
  deleteConfirm:'Sí, esborrar',cancel:'Cancel·lar',back:'Tornar',openExternal:'Obrir en un altre visor',
  viewerHint:'Si el PDF no es mostra correctament, toca «Obrir en un altre visor». El visor mostra les pàgines directament, sense dependre del navegador.',
  noPrevious:'Anterior',noNext:'Següent',filePosition:'obra',
  selectLanguage:'Benvingut a Partitures Festeres Web',langHelp:'Tria l’idioma per a començar. Podràs canviar-lo en Ajustos.',
  start:'Començar',saved:'Idioma guardat',added:'partitures importades',updated:'Actualitzades',skipped:'Omeses',
  importing:'Important biblioteca…',preparing:'Preparant arxius…',largeZip:'El ZIP és massa gran per a esta prova (màxim 250 MB).',
  invalidFile:'No s’ha trobat cap PDF vàlid.',error:'No s’ha pogut importar el fitxer.',
  removed:'Partitura eliminada',allRemoved:'Biblioteca esborrada',pdfUnavailable:'No s’ha pogut obrir el PDF.',
  intro:'Prototip per a iPhone, iPad i ordinador · Sense comptes ni sincronització amb Drive',
  offlineReady:'Els PDF importats no ixen del teu dispositiu.',
  paths:'Carpetes de la biblioteca',welcomeQuote:'La música de les nostres festes, ara també al navegador.',
  noPaper:'Arrel completa',indexGroup:'Sense carpeta',emptyIndex:'Encara no hi ha obres a l’índex.',indexUnknown:'Sense dades',indexArrange:'Organització de l’índex',indexGroupBy:'Agrupar per',indexSortBy:'Ordenar obres per',indexByFolder:'Carpeta',indexByComposer:'Compositor',indexByType:'Tipus de composició',indexByYear:'Any',indexSortTitle:'Títol',indexSortFolder:'Carpeta / ruta',indexExpandAll:'Desplegar tots',indexCollapseAll:'Plegar tots',indexGroupsCount:'grups',indexShown:'obres mostrades',annotationEdit:'Anotar',annotationDone:'Acabar',annotationPen:'Llapis',annotationHighlight:'Ressaltador',annotationColor:'Color',annotationUndo:'Desfer últim traç',annotationClear:'Esborrar anotacions de la pàgina',annotationClearTitle:'Esborrar anotacions',annotationClearAsk:'Vols esborrar tots els traços d’esta pàgina? Les altres pàgines i el PDF no es modificaran.',annotationHelp:'Tria una ferramenta. La goma esborra un traç tocant-lo; Seleccionar permet arrossegar-lo. Per a ampliar amb gestos, acaba les anotacions.',annotationThickness:'Grossor',annotationThin:'Fi',annotationThick:'Gruixut',annotationEraser:'Goma',annotationSelect:'Seleccionar',annotationDeleteSelected:'Esborrar seleccionada',annotationLine:'Línia',annotationRectangle:'Rectangle',annotationEllipse:'Cercle o el·lipse',annotationArrow:'Fletxa',
   annotationGroupStrokes:'Traços',annotationGroupShapes:'Formes',annotationGroupEdit:'Text i edició',annotationGroupMusic:'Símbols',
    annotationSymbolTool:'Símbol actual',annotationChooseSymbol:'Triar símbol',annotationSymbolSize:'Grandària',
    annotationSymbolPicker:'Símbols musicals',annotationSymbolHint:'Tria un símbol i toca la partitura per a posar-lo. Usa Seleccionar per a moure’l.',
    annotationSymbolHelp:'Els símbols es poden moure, esborrar i desfer sense modificar el PDF.',
   annotationText:'Text',annotationTextNew:'Afegir text',annotationTextEdit:'Editar text',
   annotationTextHint:'Toca o arrossega per a crear un quadre i escriu directament sobre la partitura. Tria el format i toca ✓ per a guardar. «Més opcions» conserva el diàleg anterior.',
   annotationTextValue:'Text de l’anotació',annotationFontSize:'Grandària',annotationBold:'Negreta',
   annotationUnderline:'Subratllat',annotationOpacity:'Opacitat',annotationTextColor:'Color del text',
   annotationSaveText:'Guardar text',annotationTextError:'Escriu entre 1 i 280 caràcters, en un màxim de 5 línies.',
   annotationTextSelectHelp:'Selecciona un text i toca Editar text per a modificar-lo.',
   
  rename:'Importa una altra còpia amb la mateixa ruta per a substituir un PDF.',
  notSecure:'Per a instal·lar esta app cal publicar-la amb HTTPS (per exemple, en GitHub Pages).',
  errorStorage:'No s’ha pogut obrir l’emmagatzematge local.',
  restore:'Recuperar còpia',saveZip:'Conserva una còpia del ZIP original fora de l’app.',
  installStatus:'App instal·lable',network:'Estat',about:'Sobre esta versió',
  limitations:'Esta versió inclou un visor horitzontal, anotacions amb llapis, formes, text i símbols musicals (figures, silencis, signes, matisos i tempo). La sincronització amb Drive continua pendent. El metrònom, l’afinador cromàtic, la nota de referència i Dictat Musical (amb Marina) estan disponibles en Eines.',
  help:'Ajuda',openPdf:'Obrir PDF',fileNumber:'Partitura',zipError:'ZIP no vàlid o protegit.',tooBig:'El PDF excedix el límit de prova de 100 MB.',
  browserNote:'No obris l’HTML com a fitxer local: publica’l en HTTPS o usa un servidor local per a les proves.',
  confirmOne:'Vols esborrar esta partitura del dispositiu?',
  backupTitle:'Còpies de seguretat',backupDesc:'Exporta les partitures, les preferències i les anotacions en un ZIP complet, que podràs guardar en Fitxers o en un disc extern.',
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
  restorePending:'Llegint l’arxiu de còpia…',backupVerify:'Verificant PDF i preparant restauració…',
  favorites:'Favorits',recents:'Recents',repertoires:'Repertoris',createRepertoire:'Crear repertori',renameRepertoire:'Canviar nom',removeRepertoire:'Esborrar repertori',repertoireName:'Nom del repertori',repertoireEmpty:'Este repertori encara no conté partitures.',repertoireNoItems:'Encara no tens repertoris. Crea’n un per a cada actuació.',repertoireRemoveConfirm:'Vols esborrar este repertori? Les partitures originals es conserven.',repertoireExists:'Ja hi ha un repertori amb este nom.',repertoireInvalid:'Escriu un nom entre 1 i 60 caràcters.',repertoireSaved:'Repertori guardat',repertoireRemoved:'Repertori eliminat',addToRepertoire:'Afegir a repertori',removeFromRepertoire:'Traure del repertori',repertoireAdded:'Partitura afegida al repertori',repertoireRemovedScore:'Partitura retirada del repertori',moveUp:'Pujar',moveDown:'Baixar',addFavorite:'Afegir a favorits',removeFavorite:'Traure de favorits',emptyFavorites:'Encara no hi ha partitures favorites.',emptyRecents:'Encara no has consultat partitures.',repertoireSubtitle:'Organitza les actuacions amb els botons de pujar i baixar.',favoritesSubtitle:'Les teues partitures preferides',recentsSubtitle:'Últimes obres consultades',chooseRepertoire:'Tria el repertori',repertoireAll:'Tots els repertoris',repAddOpen:'Afegir partitures',repAddTitle:'Afegir partitures al repertori',repAddHelp:'Busca per títol o carpeta i selecciona diverses obres sense eixir del repertori.',repAddPlaceholder:'Buscar en tota la biblioteca...',repAddSelected:'seleccionades',repAddConfirm:'Afegir seleccionades',repAddAlready:'Ja està en el repertori',repAddNoResults:'No s’han trobat partitures amb esta cerca.',repAddResultCount:'resultats',repAddLimit:'Mostrant els primers 120. Escriu més lletres per a afinar la cerca.',repAddSuccess:'partitures afegides al repertori',metadataEdit:'Editar metadades',metadataTitle:'Metadades de la partitura',metadataHelp:'Tots els camps són opcionals. La informació es guarda sense modificar el PDF original.',metadataFilename:'Nom original del fitxer',metadataFieldTitle:'Títol',metadataFieldComposer:'Compositor / autoria',metadataFieldType:'Tipus de composició',metadataFieldYear:'Any',metadataFieldNotes:'Observacions',metadataYearHint:'Any de quatre xifres (opcional)',metadataSave:'Guardar metadades',metadataSaved:'Metadades guardades',metadataYearError:'L’any ha de tindre quatre xifres o quedar buit.',advancedSearch:'Busca avançada',advancedHelp:'Combina els filtres amb la busca habitual. Només s’aplicaran els camps que ompligues.',advancedComposer:'Compositor',advancedType:'Tipus de composició',advancedYearFrom:'Any des de',advancedYearTo:'Any fins a',advancedYearHint:'AAAA',advancedClear:'Netejar filtres',advancedNoResults:'No hi ha obres que coincidisquen amb estos filtres.',advancedActive:'filtres actius',
  viewerStageHint:'Toca el centre per a vore els controls · toca els costats per a passar pàgina',viewerLoading:'Carregant partitura…',viewerPage:'Pàgina',viewerFitWidth:'Ajustar a l’amplària',viewerFitPage:'Ajustar pàgina completa',viewerRotate:'Girar 90°',viewerAutoRotate:'Orientació automàtica del contingut',viewerZoomIn:'Ampliar',viewerZoomOut:'Reduir',viewerZen:'Ocultar controls',viewerShowControls:'Mostrar controls',viewerPrevPage:'Pàgina anterior',viewerNextPage:'Pàgina següent',viewerPages:'Pàgines',viewerFallback:'No s’ha pogut representar el PDF. Pots obrir-lo amb una altra aplicació.',
  viewerPrepare:'Preparar visor sense connexió',viewerPrepared:'Visor avançat preparat per a treballar sense connexió',viewerNeedPrepare:'El visor avançat necessita una preparació amb Internet. Les partitures continuen guardades localment.',viewerInfo:'El visor orienta automàticament les partitures en obrir-les i permet ampliar, girar manualment i canviar de pàgina sense connexió.',viewerReadyToast:'Visor preparat per a usar sense connexió',viewerEngineTitle:'Visor de partitures',viewerPercent:'Ampliació',viewerShow:'Mostrar visor original',viewerTouch:'En zoom normal, llisca horitzontalment per a canviar de pàgina.'
 },
 es: {
  subtitle:'La música de nuestras fiestas',library:'Biblioteca',index:'Índice',tools:'Herramientas',toolsSubtitle:'Metrónomo, afinador, nota de referencia y Dictado Musical para tus ensayos',settings:'Ajustes',import:'Importar',importFiles:'Importar PDF o ZIP',
  folderCount:'carpetas',scoreCount:'partituras',search:'Buscar partituras...',all:'Raíz',paper:'Papel',
  emptyTitle:'Tu biblioteca, lista para empezar',emptyText:'Importa una o varias partituras en PDF, o un ZIP con las carpetas de la biblioteca. Los archivos se guardan en este dispositivo.',
  noResults:'No se han encontrado partituras.',noResultsDesc:'Prueba otra búsqueda o cambia de carpeta.',
  oneFile:'partitura',moreFiles:'partituras',indexSubtitle:'Todas las obras del papel seleccionado, organizadas como prefieras',
  settingsSubtitle:'Preferencias y almacenamiento',language:'Idioma',languageHint:'Puedes cambiarlo en cualquier momento.',
  storage:'Biblioteca local',localHint:'Las partituras se guardan en este dispositivo, no en el servidor ni en Google Drive.',
  deleteAll:'Borrar biblioteca',deleteThis:'Eliminar esta partitura',installTitle:'Instalar en iPhone / iPad',
  installText:'Abre esta página en Safari, toca Compartir y elige «Añadir a pantalla de inicio». Activa «Abrir como app».',
  offlineTitle:'Uso sin conexión',offlineText:'Tras abrir la aplicación por primera vez con Internet, vuelve a abrirla sin conexión. Las partituras importadas se recuperan del dispositivo. iOS puede eliminar datos del navegador ante falta de espacio: guarda siempre una copia del ZIP.',
  statusOnline:'Conexión disponible',statusOffline:'Sin conexión',disk:'Espacio aproximado',dev:'Versión de prueba',
  warningTitle:'Confirmar eliminación',warningText:'Se borrarán todas las partituras guardadas en este dispositivo. Esta acción no se puede deshacer.',
  deleteConfirm:'Sí, borrar',cancel:'Cancelar',back:'Volver',openExternal:'Abrir en otro visor',
  viewerHint:'Si el PDF no se muestra correctamente, pulsa «Abrir en otro visor». El visor muestra las páginas directamente, sin depender del navegador.',
  noPrevious:'Anterior',noNext:'Siguiente',filePosition:'obra',
  selectLanguage:'Bienvenido a Partitures Festeres Web',langHelp:'Elige el idioma para empezar. Podrás cambiarlo en Ajustes.',
  start:'Empezar',saved:'Idioma guardado',added:'partituras importadas',updated:'Actualizadas',skipped:'Omitidas',
  importing:'Importando biblioteca…',preparing:'Preparando archivos…',largeZip:'El ZIP es demasiado grande para esta prueba (máximo 250 MB).',
  invalidFile:'No se ha encontrado ningún PDF válido.',error:'No se pudo importar el archivo.',
  removed:'Partitura eliminada',allRemoved:'Biblioteca borrada',pdfUnavailable:'No se pudo abrir el PDF.',
  intro:'Prototipo para iPhone, iPad y ordenador · Sin cuentas ni sincronización con Drive',
  offlineReady:'Los PDF importados no salen de tu dispositivo.',
  paths:'Carpetas de la biblioteca',welcomeQuote:'La música de nuestras fiestas, ahora también en el navegador.',
  noPaper:'Raíz completa',indexGroup:'Sin carpeta',emptyIndex:'Todavía no hay obras en el índice.',indexUnknown:'Sin datos',indexArrange:'Organización del índice',indexGroupBy:'Agrupar por',indexSortBy:'Ordenar obras por',indexByFolder:'Carpeta',indexByComposer:'Compositor',indexByType:'Tipo de composición',indexByYear:'Año',indexSortTitle:'Título',indexSortFolder:'Carpeta / ruta',indexExpandAll:'Desplegar todos',indexCollapseAll:'Plegar todos',indexGroupsCount:'grupos',indexShown:'obras mostradas',annotationEdit:'Anotar',annotationDone:'Terminar',annotationPen:'Lápiz',annotationHighlight:'Resaltador',annotationColor:'Color',annotationUndo:'Deshacer último trazo',annotationClear:'Borrar anotaciones de la página',annotationClearTitle:'Borrar anotaciones',annotationClearAsk:'¿Quieres borrar todos los trazos de esta página? Las otras páginas y el PDF no se modificarán.',annotationHelp:'Elige una herramienta. La goma borra un trazo al tocarlo; Seleccionar permite arrastrarlo. Para ampliar con gestos, termina las anotaciones.',annotationThickness:'Grosor',annotationThin:'Fino',annotationThick:'Grueso',annotationEraser:'Goma',annotationSelect:'Seleccionar',annotationDeleteSelected:'Borrar seleccionada',annotationLine:'Línea',annotationRectangle:'Rectángulo',annotationEllipse:'Círculo o elipse',annotationArrow:'Flecha',
   annotationGroupStrokes:'Trazos',annotationGroupShapes:'Formas',annotationGroupEdit:'Texto y edición',annotationGroupMusic:'Símbolos',
    annotationSymbolTool:'Símbolo actual',annotationChooseSymbol:'Elegir símbolo',annotationSymbolSize:'Tamaño',
    annotationSymbolPicker:'Símbolos musicales',annotationSymbolHint:'Elige un símbolo y toca la partitura para colocarlo. Usa Seleccionar para moverlo.',
    annotationSymbolHelp:'Los símbolos pueden moverse, borrarse y deshacerse sin modificar el PDF.',
   annotationText:'Texto',annotationTextNew:'Añadir texto',annotationTextEdit:'Editar texto',
   annotationTextHint:'Toca o arrastra para crear un cuadro y escribe directamente sobre la partitura. Elige el formato y pulsa ✓ para guardar. «Más opciones» conserva el diálogo anterior.',
   annotationTextValue:'Texto de la anotación',annotationFontSize:'Tamaño',annotationBold:'Negrita',
   annotationUnderline:'Subrayado',annotationOpacity:'Opacidad',annotationTextColor:'Color del texto',
   annotationSaveText:'Guardar texto',annotationTextError:'Escribe entre 1 y 280 caracteres, en un máximo de 5 líneas.',
   annotationTextSelectHelp:'Selecciona un texto y pulsa Editar texto para modificarlo.',
   
  rename:'Importa otra copia con la misma ruta para sustituir un PDF.',
  notSecure:'Para instalar esta app hay que publicarla con HTTPS (por ejemplo, en GitHub Pages).',
  errorStorage:'No se pudo abrir el almacenamiento local.',
  restore:'Recuperar copia',saveZip:'Conserva una copia del ZIP original fuera de la app.',
  installStatus:'App instalable',network:'Estado',about:'Sobre esta versión',
  limitations:'Esta versión incluye visor horizontal y anotaciones con lápiz, formas, texto y símbolos musicales (figuras, silencios, signos, matices y tempo). La sincronización con Drive sigue pendiente. El metrónomo, el afinador cromático, la nota de referencia y Dictado Musical (con Marina) están disponibles en Herramientas.',
  help:'Ayuda',openPdf:'Abrir PDF',fileNumber:'Partitura',zipError:'ZIP inválido o protegido.',tooBig:'El PDF excede el límite de prueba de 100 MB.',
  browserNote:'No abras el HTML como archivo local: publícalo en HTTPS o usa un servidor local para las pruebas.',
  confirmOne:'¿Quieres borrar esta partitura del dispositivo?',
  backupTitle:'Copias de seguridad',backupDesc:'Exporta las partituras, las preferencias y las anotaciones en un ZIP completo, que podrás guardar en Archivos o en un disco externo.',
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
  restorePending:'Leyendo el archivo de copia…',backupVerify:'Verificando PDF y preparando la restauración…',
  favorites:'Favoritos',recents:'Recientes',repertoires:'Repertorios',createRepertoire:'Crear repertorio',renameRepertoire:'Cambiar nombre',removeRepertoire:'Eliminar repertorio',repertoireName:'Nombre del repertorio',repertoireEmpty:'Este repertorio todavía no tiene partituras.',repertoireNoItems:'Todavía no tienes repertorios. Crea uno para cada actuación.',repertoireRemoveConfirm:'¿Quieres eliminar este repertorio? Las partituras originales se conservan.',repertoireExists:'Ya existe un repertorio con este nombre.',repertoireInvalid:'Escribe un nombre entre 1 y 60 caracteres.',repertoireSaved:'Repertorio guardado',repertoireRemoved:'Repertorio eliminado',addToRepertoire:'Añadir a repertorio',removeFromRepertoire:'Quitar del repertorio',repertoireAdded:'Partitura añadida al repertorio',repertoireRemovedScore:'Partitura quitada del repertorio',moveUp:'Subir',moveDown:'Bajar',addFavorite:'Añadir a favoritos',removeFavorite:'Quitar de favoritos',emptyFavorites:'Todavía no hay partituras favoritas.',emptyRecents:'Todavía no has consultado partituras.',repertoireSubtitle:'Organiza las actuaciones con los botones de subir y bajar.',favoritesSubtitle:'Tus partituras preferidas',recentsSubtitle:'Últimas obras consultadas',chooseRepertoire:'Elige el repertorio',repertoireAll:'Todos los repertorios',repAddOpen:'Añadir partituras',repAddTitle:'Añadir partituras al repertorio',repAddHelp:'Busca por título o carpeta y selecciona varias obras sin salir del repertorio.',repAddPlaceholder:'Buscar en toda la biblioteca...',repAddSelected:'seleccionadas',repAddConfirm:'Añadir seleccionadas',repAddAlready:'Ya está en el repertorio',repAddNoResults:'No se encontraron partituras con esta búsqueda.',repAddResultCount:'resultados',repAddLimit:'Mostrando los primeros 120. Escribe más letras para afinar la búsqueda.',repAddSuccess:'partituras añadidas al repertorio',metadataEdit:'Editar metadatos',metadataTitle:'Metadatos de la partitura',metadataHelp:'Todos los campos son opcionales. La información se guarda sin modificar el PDF original.',metadataFilename:'Nombre original del archivo',metadataFieldTitle:'Título',metadataFieldComposer:'Compositor / autoría',metadataFieldType:'Tipo de composición',metadataFieldYear:'Año',metadataFieldNotes:'Observaciones',metadataYearHint:'Año de cuatro cifras (opcional)',metadataSave:'Guardar metadatos',metadataSaved:'Metadatos guardados',metadataYearError:'El año debe tener cuatro cifras o quedar vacío.',advancedSearch:'Búsqueda avanzada',advancedHelp:'Combina los filtros con la búsqueda habitual. Solo se aplicarán los campos que rellenes.',advancedComposer:'Compositor',advancedType:'Tipo de composición',advancedYearFrom:'Año desde',advancedYearTo:'Año hasta',advancedYearHint:'AAAA',advancedClear:'Limpiar filtros',advancedNoResults:'No hay obras que coincidan con estos filtros.',advancedActive:'filtros activos',
  viewerStageHint:'Toca el centro para ver los controles · toca los lados para pasar página',viewerLoading:'Cargando partitura…',viewerPage:'Página',viewerFitWidth:'Ajustar a anchura',viewerFitPage:'Ajustar página completa',viewerRotate:'Girar 90°',viewerAutoRotate:'Orientación automática del contenido',viewerZoomIn:'Ampliar',viewerZoomOut:'Reducir',viewerZen:'Ocultar controles',viewerShowControls:'Mostrar controles',viewerPrevPage:'Página anterior',viewerNextPage:'Página siguiente',viewerPages:'Páginas',viewerFallback:'No se ha podido visualizar el PDF. Puedes abrirlo con otra aplicación.',
  viewerPrepare:'Preparar visor sin conexión',viewerPrepared:'Visor avanzado preparado para funcionar sin conexión',viewerNeedPrepare:'El visor avanzado necesita una preparación con Internet. Las partituras siguen guardadas localmente.',viewerInfo:'El visor orienta automáticamente las partituras al abrirlas y permite ampliar, girar manualmente y cambiar de página sin conexión.',viewerReadyToast:'Visor preparado para usar sin conexión',viewerEngineTitle:'Visor de partituras',viewerPercent:'Ampliación',viewerShow:'Mostrar visor original',viewerTouch:'Con zoom normal, desliza horizontalmente para cambiar de página.'
 }
};
const $ = (q,root=document) => root.querySelector(q);
const esc = value => String(value??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = value => (value??'').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const sort = (a,b) => a.localeCompare(b,'ca',{numeric:true,sensitivity:'base'});
const scoreSearch = s => norm(s.path+' '+(s.metadata?.title||''));
const state={lang:'va',page:'library',paper:'root',cwd:[],scores:[],search:'',view:null,blobUrl:null,modal:null,toastTimer:null,loading:false,online:navigator.onLine,storage:null,backup:null,restore:null,zen:false,favorites:[],recents:[],repertoires:[],repertoireOpen:null,modalRepId:null,pickerPath:null,repAddSearch:'',repAddChosen:[],metaPath:null,annotating:false,advanced:blankAdvancedFilters(),advancedOpen:false,indexGroupBy:'folder',indexSortBy:'title',indexCollapsed:new Set(),annotationGroup:'strokes',symbolGroup:'notes',textDraft:null,rosetteExpanded:false,rosetteLevel:'root',rosetteLegacy:false,rosetteX:.5,rosetteY:.56,rosetteSymbolPage:0,objectMenuOpen:false,toolTab:'metronome'};
let scoreViewer=null;
const metronome=new MetronomeController({
 onUpdate:()=>{if(state.page==='tools'&&state.toolTab==='metronome'&&!state.view)render();},
 onWarning:message=>toast((state.lang==='es'?'No se puede reproducir el metrónomo. ':'No es pot reproduir el metrònom. ')+message,true)
});
const tuner=new TunerController({
 onUpdate:()=>{if(state.page==='tools'&&state.toolTab==='tuner'&&!state.view)render();},
 onWarning:message=>toast(message,true),
 onReferenceSave:hz=>{referenceTone.setReference(hz);dictation.setReference(hz);setPref('tunerReferenceHz',hz).catch(err=>console.warn('Referència afinador:',err));}
});
const referenceTone=new ReferenceToneController({
 onUpdate:()=>{if(state.page==='tools'&&state.toolTab==='reference'&&!state.view)render();},
 onWarning:message=>toast((state.lang==='es'?'No se puede reproducir la nota. ':'No es pot reproduir la nota. ')+message,true)
});
const dictation=new DictationController({
 onUpdate:()=>{if(state.page==='tools'&&state.toolTab==='dictation'&&!state.view)render();},
 onWarning:message=>toast(message,true),
 onFeedback:message=>toast(message),
 onInstrumentSave:id=>setPref('dictationInstrument',id).catch(err=>console.warn('Instrument dictat:',err))
});
const scanner=new ScannerController({
 onUpdate:()=>{if(state.page==='add'&&!state.view)render();},
 onWarning:message=>toast(message,true),
 onSaved:async({path,blob,repertoireId,pageCount})=>{
  // Última comprovació contra l'IndexedDB real, per a no sobreescriure un PDF
  // que haja aparegut mentre processàvem les fotografies.
  const existing=await getAllScores();
  const unique=uniqueScanPath(path,new Set(existing.map(s=>s.path)));
  await saveBatch([{path:unique,blob,size:blob.size,added:Date.now()}]);
  if(repertoireId){
   const rep=state.repertoires.find(r=>r.id===repertoireId);
   if(rep&&!rep.paths.includes(unique)){
    rep.paths.push(unique);
    try{await setPref('w13:repertoires',state.repertoires);}
    catch(err){console.warn('Repertori escàner:',err);toast(
     state.lang==='es'?'La partitura está guardada, pero no se ha añadido al repertorio.':
     'La partitura està guardada, però no s’ha afegit al repertori.',true);}
   }
  }
  if(state.backup?.url)URL.revokeObjectURL(state.backup.url);
  state.backup=null;
  state.scores=await getAllScores();
  state.search='';state.advanced=blankAdvancedFilters();state.advancedOpen=false;
  const folder=unique.includes('/')?unique.slice(0,unique.lastIndexOf('/')):'';
  if(state.paper!=='root'&&!(folder===state.paper||folder.startsWith(state.paper+'/'))){
   state.paper='root';await setPref('paper','root');
  }
  state.cwd=folder?(state.paper==='root'?folder:folder===state.paper?'':folder.slice(state.paper.length+1))
   .split('/').filter(Boolean):[];
  state.page='library';render();updateStorageInfo();
  toast((state.lang==='es'?'Partitura guardada: ':'Partitura guardada: ')+unique+
   ' · '+pageCount+(state.lang==='es'?' páginas':' pàgines'));
 }
});
const documentCamera=new DocumentCamera({
 onCapture:file=>scanner.addImages([file])===1,
 onWarning:message=>toast(message,true)
});
const cropEditor=new ScanCropEditor({
 onApply:(id,points,blob)=>{
  if(!scanner.setCrop(id,points,blob))throw new Error(
   state.lang==='es'?'No se ha podido guardar el recorte.':'No s’ha pogut guardar el retall.');
 },
 onRemove:id=>scanner.removeCrop(id),
 onWarning:message=>toast(message,true)
});
window.addEventListener('pagehide',()=>cropEditor.close());
let viewerRequest=0;
let viewerPendingOpen=false;
const VIEWER_HISTORY_KEY='pfwebViewer';
let fullscreenExitTimer=0;
function viewerHistoryState(open){
 const prior=history.state&&typeof history.state==='object'&&!Array.isArray(history.state)?history.state:{};
 return {...prior,[VIEWER_HISTORY_KEY]:open};
}
function hasViewerHistory(){return history.state?.[VIEWER_HISTORY_KEY]===true;}
function prepareViewerHistory(restoreViewer){
 try{
  if(restoreViewer&&hasViewerHistory())return;
  history.replaceState(viewerHistoryState(false),'',location.href);
  if(restoreViewer)history.pushState(viewerHistoryState(true),'',location.href);
 }catch(err){console.warn('Historial del visor:',err);}
}
function ensureViewerHistory(){
 if(hasViewerHistory())return;
 try{
  history.replaceState(viewerHistoryState(false),'',location.href);
  history.pushState(viewerHistoryState(true),'',location.href);
 }catch(err){console.warn('No s’ha pogut crear el retorn al menú:',err);}
}

// Les preferències del visor han d'arribar a IndexedDB en el mateix ordre que
// els canvis de pàgina/rotació; una operació antiga no pot sobreescriure la nova.
let viewerPreferencesQueue=Promise.resolve();
function persistViewerSnapshot(path,value){
  const saved=viewerPreferencesQueue.catch(()=>{}).then(()=>setPref('viewer:'+path,value));
  viewerPreferencesQueue=saved;
  return saved;
}
// Només intentem bloquejar el gir mentre es llig un PDF. Safari iOS no permet
// screen.orientation.lock(): el visor té un suport horitzontal visual per CSS.
let viewerOrientationToken=0,viewerOrientationLocked=false,viewerCssFallback=false;
let landscapeAttemptTimer=0,viewerFullscreenOwned=false;
function setViewerCssFallback(active){
 const enabled=!!active;
 if(viewerCssFallback===enabled)return;
 viewerCssFallback=enabled;
 document.querySelector('.pf-reading-mode')?.classList.toggle('landscape-css-fallback',enabled);
}
function requestViewerLandscape(){
 const token=++viewerOrientationToken;
 clearTimeout(landscapeAttemptTimer);
 viewerOrientationLocked=false;
 setViewerCssFallback(false);
 // Només mòbils i tauletes tàctils han d'intentar bloqueig o fullscreen.
 // En ordinador, fullscreen impediria redimensionar la finestra del visor.
 if(!window.matchMedia?.('(pointer:coarse)').matches)return;
 const orientation=screen.orientation;
 if(!orientation||typeof orientation.lock!=='function'){
  setViewerCssFallback(true);
  return;
 }
 const fullscreenTarget=document.documentElement;
 let ready=Promise.resolve();
 // Chrome Android pot requerir fullscreen per a screen.orientation.lock.
 // Cal iniciar la petició en el mateix gest de l'usuari, abans dels awaits de
 // llegir el PDF. La PWA en mode standalone conserva la Biblioteca vertical.
 if(!document.fullscreenElement&&typeof fullscreenTarget.requestFullscreen==='function'){
  try{
   const pending=fullscreenTarget.requestFullscreen({navigationUI:'hide'});
   ready=Promise.resolve(pending).then(()=>{
    if(token!==viewerOrientationToken){
     if(document.fullscreenElement===fullscreenTarget)document.exitFullscreen?.().catch(()=>{});
     return false;
    }
    viewerFullscreenOwned=document.fullscreenElement===fullscreenTarget;
    return true;
   }).catch(()=>false);
  }catch{ready=Promise.resolve(false);}
 }
 // Un timeout evita deixar el visor buit si el navegador mai resol la petició.
 landscapeAttemptTimer=setTimeout(()=>{
  if(token===viewerOrientationToken&&!viewerOrientationLocked)setViewerCssFallback(true);
 },1500);
 ready.then(()=>{
  if(token!==viewerOrientationToken)return;
  let attempt;
  try{attempt=orientation.lock('landscape-primary');}
  catch{clearTimeout(landscapeAttemptTimer);setViewerCssFallback(true);return;}
  Promise.resolve(attempt).then(()=>{
   if(token!==viewerOrientationToken){
    try{orientation.unlock?.();}catch{}
    return;
   }
   clearTimeout(landscapeAttemptTimer);
   viewerOrientationLocked=true;
   setViewerCssFallback(false);
  }).catch(()=>{
   if(token!==viewerOrientationToken)return;
   clearTimeout(landscapeAttemptTimer);
   setViewerCssFallback(true);
   // Si falla el bloqueig, no cal mantindre el fullscreen sol·licitat per l'app.
   if(viewerFullscreenOwned&&document.fullscreenElement===fullscreenTarget){
    viewerFullscreenOwned=false;
    document.exitFullscreen?.().catch(()=>{});
   }
  });
 }).catch(()=>{
  if(token===viewerOrientationToken){clearTimeout(landscapeAttemptTimer);setViewerCssFallback(true);}
 });
}
function releaseViewerLandscape(){
 viewerOrientationToken++;
 clearTimeout(landscapeAttemptTimer);
 const locked=viewerOrientationLocked;
 viewerOrientationLocked=false;
 setViewerCssFallback(false);
 if(locked)try{screen.orientation?.unlock?.();}catch{}
 if(viewerFullscreenOwned){
  viewerFullscreenOwned=false;
  if(document.fullscreenElement===document.documentElement)
   document.exitFullscreen?.().catch(()=>{});
 }
}

let navigationReady=false;
let lastContentScrollY=0;
const navigationStorage=(()=>{try{return window.localStorage;}catch{return null;}})();
function rememberNavigation(){
 if(!navigationReady)return;
 // No guardem PDF ni anotacions en localStorage, només la ubicació de la pantalla.
 writeNavigation(navigationStorage,snapshotNavigation(state,lastContentScrollY));
}
function rememberScroll(){
 if(state.view)return;
 lastContentScrollY=window.scrollY||0;
 rememberNavigation();
}

// Les còpies i restauracions esperen sempre les escriptures d'anotacions pendents.
let annotationSaveQueue=Promise.resolve();
function savePdfAnnotations(path,document){
 const write=annotationSaveQueue.catch(()=>{}).then(()=>setAnnotations(path,document));
 annotationSaveQueue=write;
 return write;
}
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
function relativePath(path){return state.paper==='root'||!path.startsWith(state.paper+'/')?path:path.slice(state.paper.length+1);}

function clearAdvancedSearch(){state.advanced=blankAdvancedFilters();state.advancedOpen=false;}
function matchListScore(score){return matchesScoreSearch(score,state.search,state.advanced);}
function advancedFilterOptions(key){
 const seen=new Set(),values=[];
 for(const score of state.scores){
  const raw=score.metadata?.[key];
  if(typeof raw!=='string'||!raw.trim())continue;
  const value=raw.trim(),normalized=norm(value);
  if(!seen.has(normalized)){seen.add(normalized);values.push(value);}
 }
 return values.sort(sort).slice(0,100);
}
function setPage(page){if(state.page==='add'&&page!=='add'&&scanner.busy){toast(state.lang==='es'?'Se está guardando el PDF.':'S’està guardant el PDF.');return;}if(state.page==='tools'&&page!=='tools'){metronome.stop({release:true,notify:false});tuner.stop({notify:false});referenceTone.stop({notify:false});dictation.stop({notify:false});}if(state.page==='add'&&page!=='add'){cropEditor.close();documentCamera.close();scanner.cancel();}state.page=page;state.search='';clearAdvancedSearch();state.cwd=[];state.view=null;render();}
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

const scorePaths=()=>new Set(state.scores.map(s=>s.path));
function keepExisting(list){
 const valid=scorePaths();
 return Array.isArray(list)?[...new Set(list.filter(p=>typeof p==='string'&&valid.has(p)))].slice(0,15000):[];
}
function cleanRepertoires(items){
 if(!Array.isArray(items))return [];
 const seen=new Set(),out=[];
 for(const item of items.slice(0,500)){
  if(!item||typeof item.id!=='string'||!/^rep_[a-zA-Z0-9_-]{1,45}$/.test(item.id)||seen.has(item.id)||typeof item.name!=='string')continue;
  const name=item.name.trim().slice(0,60);if(!name)continue;
  seen.add(item.id);out.push({id:item.id,name,paths:keepExisting(item.paths)});
 }
 return out;
}
async function reloadCollections(){
 state.favorites=keepExisting(await getPref('w13:favorites',[]));
 state.recents=keepExisting(await getPref('w13:recents',[])).slice(0,45);
 state.repertoires=cleanRepertoires(await getPref('w13:repertoires',[]));
 if(state.repertoireOpen&&!state.repertoires.some(r=>r.id===state.repertoireOpen))state.repertoireOpen=null;
}
async function persistCollections(){
 await Promise.all([setPref('w13:favorites',state.favorites),setPref('w13:recents',state.recents),setPref('w13:repertoires',state.repertoires)]);
}
const findRepertoire=id=>state.repertoires.find(r=>r.id===id);
const paperMatches=path=>state.paper==='root'||path.startsWith(state.paper+'/');
function currentCollectionScores(){
 const records=new Map(state.scores.map(s=>[s.path,s]));
 const collection=state.page==='favorites'?state.favorites:state.page==='recents'?state.recents:
  state.page==='repertoires'&&state.repertoireOpen?(findRepertoire(state.repertoireOpen)?.paths||[]):null;
 if(collection)return collection.filter(p=>records.has(p)&&(state.page==='repertoires'||paperMatches(p))).map(p=>records.get(p));
 return scopedScores();
}
function htmlScoreRow(score,{note='',repertoireId=null,reorder=0,count=0}={}){
 const favorite=state.favorites.includes(score.path),label=tr(favorite?'removeFavorite':'addFavorite');
 const title=scoreDisplayTitle(score),original=nice(parts(score.path).at(-1));
 const extra=[score.metadata?.title?original:(note||bytes(score.size)),score.metadata?.composer,score.metadata?.type,score.metadata?.year].filter(Boolean).join(' · ');
 return `<div class="score-row">
  ${repertoireId!==null?`<span class="repertoire-order"><button data-action="rep-up" data-id="${esc(repertoireId)}" data-value="${esc(score.path)}" title="${esc(tr('moveUp'))}" aria-label="${esc(tr('moveUp'))}" ${reorder===0?'disabled':''}>${icon('up')}</button><button data-action="rep-down" data-id="${esc(repertoireId)}" data-value="${esc(score.path)}" title="${esc(tr('moveDown'))}" aria-label="${esc(tr('moveDown'))}" ${reorder===count-1?'disabled':''}>${icon('down')}</button></span>`:''}
  <button class="entry" data-action="open" data-value="${esc(score.path)}"><span class="entry-ico pdf">${icon('file')}</span><span class="entry-text"><span class="entry-title">${esc(title)}</span><span class="entry-note">${esc(extra)}</span></span></button>
  <button class="score-tool score-metadata ${hasScoreMetadata(score)?'has-metadata':''}" data-action="meta-open" data-value="${esc(score.path)}" title="${esc(tr('metadataEdit'))}" aria-label="${esc(tr('metadataEdit'))}">${icon('edit')}</button>
  <button class="score-tool ${favorite?'active':''}" data-action="favorite" data-value="${esc(score.path)}" aria-pressed="${favorite}" title="${esc(label)}" aria-label="${esc(label)}">${icon('star')}</button>
  <button class="score-tool" data-action="${repertoireId!==null?'rep-remove-score':'rep-pick'}" data-id="${esc(repertoireId||'')}" data-value="${esc(score.path)}" title="${esc(tr(repertoireId!==null?'removeFromRepertoire':'addToRepertoire'))}" aria-label="${esc(tr(repertoireId!==null?'removeFromRepertoire':'addToRepertoire'))}">${icon(repertoireId!==null?'trash':'plus')}</button>
 </div>`;
}
function renderCollectionPage(page){
 const all=currentCollectionScores(),q=norm(state.search.trim()),shown=all.filter(matchListScore);
 return heading(page,tr(page==='favorites'?'favoritesSubtitle':'recentsSubtitle'))+paperBar()+
  `<div class="section-tools">${searchBox()}<span class="stat">${icon('file')}${all.length} ${esc(tr('scoreCount'))}</span></div>`+
  (shown.length?`<div class="cards score-list">${shown.map(s=>htmlScoreRow(s,{note:relativePath(s.path)})).join('')}</div>`:empty(tr(q?'noResults':page==='favorites'?'emptyFavorites':'emptyRecents'),tr('noResultsDesc')));
}

function repAddResultsData(){
 const rep=findRepertoire(state.repertoireOpen);
 const q=norm(state.repAddSearch.trim());
 const matches=fileList().filter(s=>scoreSearch(s).includes(q));
 return {rep,matches,shown:matches.slice(0,120)};
}
function renderRepAddResults(){
 const {rep,matches,shown}=repAddResultsData();
 if(!rep)return '';
 if(!matches.length)return `<p class="rep-add-empty">${esc(tr('repAddNoResults'))}</p>`;
 const existing=new Set(rep.paths),picked=new Set(state.repAddChosen);
 const rows=shown.map(s=>{
  const present=existing.has(s.path),selected=picked.has(s.path);
  return `<button type="button" class="rep-add-result ${selected?'selected':''} ${present?'already':''}" data-action="rep-add-toggle" data-value="${esc(s.path)}" aria-pressed="${selected}" ${present?'disabled':''}>
   <span class="rep-add-result-icon">${icon(present||selected?'check':'plus')}</span>
   <span class="rep-add-result-label"><strong>${esc(scoreDisplayTitle(s))}</strong><small>${esc(s.path)}</small></span>
   ${present?`<span class="rep-add-existing">${esc(tr('repAddAlready'))}</span>`:''}
  </button>`;
 }).join('');
 return rows+(matches.length>120?`<p class="rep-add-limit">${esc(tr('repAddLimit'))}</p>`:'');
}
function syncRepAddDialog(){
 const results=$('#rep-add-results'),count=$('#rep-add-count'),submit=$('#rep-add-confirm'),found=$('#rep-add-found');
 if(!results)return;
 const scroll=results.scrollTop;
 results.innerHTML=renderRepAddResults();
 results.scrollTop=scroll;
 if(count)count.textContent=`${state.repAddChosen.length} ${tr('repAddSelected')}`;
 if(submit){submit.disabled=state.repAddChosen.length===0;submit.textContent=`${tr('repAddConfirm')} (${state.repAddChosen.length})`;}
 const data=repAddResultsData();
 if(found)found.textContent=`${data.matches.length} ${tr('repAddResultCount')}`;
}

function renderRepertoires(){
 const current=findRepertoire(state.repertoireOpen);
 let block=`<div class="rep-actions"><button class="primary" data-action="rep-create">${icon('plus')}${esc(tr('createRepertoire'))}</button>${current?`<button class="secondary" data-action="rep-back">${icon('back')}${esc(tr('repertoireAll'))}</button>`:''}</div>`;
 if(current){
  const scores=new Map(state.scores.map(s=>[s.path,s])),all=current.paths.filter(p=>scores.has(p)),q=norm(state.search.trim()),visible=all.filter(p=>matchListScore(scores.get(p)));
  block+=`<div class="panel rep-head"><h3>${esc(current.name)}</h3><div class="rep-actions"><button class="primary" data-action="rep-add-open">${icon('plus')}${esc(tr('repAddOpen'))}</button><button class="secondary" data-action="rep-rename" data-id="${esc(current.id)}">${esc(tr('renameRepertoire'))}</button><button class="secondary" data-action="rep-delete" data-id="${esc(current.id)}">${icon('trash')}${esc(tr('removeRepertoire'))}</button></div></div>`;
  block+=`<div class="section-tools">${searchBox()}<span class="stat">${all.length} ${esc(tr('scoreCount'))}</span></div>`;
  block+=visible.length?`<div class="cards score-list">${visible.map(p=>htmlScoreRow(scores.get(p),{note:relativePath(p),repertoireId:current.id,reorder:all.indexOf(p),count:all.length})).join('')}</div>`:empty(tr(q?'noResults':'repertoireEmpty'),tr('repertoireSubtitle'));
 }else if(!state.repertoires.length)block+=empty(tr('repertoireNoItems'),tr('repertoireSubtitle'));
 else block+=`<div class="cards rep-list">${state.repertoires.map(r=>`<button class="entry rep-entry" data-action="rep-open" data-id="${esc(r.id)}"><span class="entry-ico">${icon('list')}</span><span class="entry-text"><span class="entry-title">${esc(r.name)}</span><span class="entry-note">${r.paths.length} ${esc(tr('scoreCount'))}</span></span>${icon('next')}</button>`).join('')}</div>`;
 return heading('repertoires',tr('repertoireSubtitle'))+block;
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
function searchBox(){
 const count=countAdvancedFilters(state.advanced),open=state.advancedOpen,fields=state.advanced;
 const options=key=>advancedFilterOptions(key).map(value=>`<option value="${esc(value)}"></option>`).join('');
 return `<div class="advanced-search-block">
  <div class="advanced-search-top">
   <div class="search-wrap">${icon('search')}<input id="search-input" class="search" type="search" autocomplete="off" placeholder="${esc(tr('search'))}" value="${esc(state.search)}" /></div>
   <button class="advanced-search-toggle ${count?'active':''}" type="button" data-action="advanced-toggle" aria-expanded="${open}" aria-controls="advanced-search-panel">${icon('search')}${esc(tr('advancedSearch'))}${count?`<span class="advanced-search-count">${count}</span>`:''}</button>
  </div>
  ${open?`<section class="advanced-search-panel" id="advanced-search-panel" aria-label="${esc(tr('advancedSearch'))}">
   <p class="advanced-search-hint">${esc(tr('advancedHelp'))}</p>
   <div class="advanced-search-grid">
    <label for="adv-composer">${esc(tr('advancedComposer'))}<input id="adv-composer" data-adv-field="composer" type="text" list="adv-composer-options" autocomplete="off" value="${esc(fields.composer)}" /></label>
    <label for="adv-type">${esc(tr('advancedType'))}<input id="adv-type" data-adv-field="type" type="text" list="adv-type-options" autocomplete="off" value="${esc(fields.type)}" /></label>
    <label for="adv-year-from">${esc(tr('advancedYearFrom'))}<input id="adv-year-from" data-adv-field="yearFrom" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="${esc(tr('advancedYearHint'))}" value="${esc(fields.yearFrom)}" /></label>
    <label for="adv-year-to">${esc(tr('advancedYearTo'))}<input id="adv-year-to" data-adv-field="yearTo" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="${esc(tr('advancedYearHint'))}" value="${esc(fields.yearTo)}" /></label>
   </div>
   <datalist id="adv-composer-options">${options('composer')}</datalist><datalist id="adv-type-options">${options('type')}</datalist>
   <div class="advanced-search-actions"><span aria-live="polite">${count} ${esc(tr('advancedActive'))}</span><button class="secondary" type="button" data-action="advanced-clear">${esc(tr('advancedClear'))}</button></div>
  </section>`:''}
 </div>`;
}
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
 if(q||countAdvancedFilters(state.advanced)){
  docs=selected.filter(matchListScore).sort((a,b)=>sort(a.path,b.path));folders=[];
 }
 const allInScope=selected.length;
 const folderCount=folders.length;
 const s=`<div class="stats"><span class="stat">${icon('file')}${allInScope} ${esc(tr('scoreCount'))}</span><span class="stat">${icon('folder')}${folderCount} ${esc(tr('folderCount'))}</span></div>`;
 const fs=folders.map(name=>{
  const newPrefix=[prefix,name].filter(Boolean).join('/');
  const count=selected.filter(x=>x.path.startsWith(newPrefix+'/')).length;
  return `<button class="entry" data-action="folder" data-value="${esc(name)}"><span class="entry-ico">${icon('folder')}</span><span class="entry-text"><span class="entry-title">${esc(name)}</span><div class="entry-note">${count} ${esc(tr('scoreCount'))}</div></span></button>`;
 }).join('');
 const ds=docs.map(s=>htmlScoreRow(s,{note:q?relativePath(s.path):''})).join('');
 return heading('library',tr('subtitle'))+paperBar()+breadcrumbs()+`<div class="section-tools">${searchBox()}</div>`+s+(fs||ds?`<div class="cards ${ds?'score-list':''}" style="margin-top:19px">${fs+ds}</div>`:empty(tr('noResults'),tr('noResultsDesc')));
}
function indexViewGroups(scores){
 return buildIndexGroups(scores,{groupBy:state.indexGroupBy,sortBy:state.indexSortBy,paper:state.paper,unknownLabel:tr('indexUnknown'),rootFolderLabel:tr('indexGroup')});
}
function renderIndex(){
 const selected=scopedScores(),records=selected.filter(matchListScore),groups=indexViewGroups(records);
 const groupChoices=[['folder','indexByFolder'],['composer','indexByComposer'],['type','indexByType'],['year','indexByYear']];
 const sortChoices=[['title','indexSortTitle'],['composer','indexByComposer'],['year','indexByYear'],['folder','indexSortFolder']];
 const opts=(items,value)=>items.map(([key,label])=>`<option value="${key}" ${value===key?'selected':''}>${esc(tr(label))}</option>`).join('');
 const controls=`<section class="index-view-options" aria-label="${esc(tr('indexArrange'))}">
  <label for="index-group-by">${esc(tr('indexGroupBy'))}<select id="index-group-by">${opts(groupChoices,state.indexGroupBy)}</select></label>
  <label for="index-sort-by">${esc(tr('indexSortBy'))}<select id="index-sort-by">${opts(sortChoices,state.indexSortBy)}</select></label>
  <div class="index-view-buttons">
   <button type="button" class="secondary" data-action="index-expand-all">${esc(tr('indexExpandAll'))}</button>
   <button type="button" class="secondary" data-action="index-collapse-all">${esc(tr('indexCollapseAll'))}</button>
  </div>
 </section>`;
 const groupIcon=state.indexGroupBy==='folder'?'folder':state.indexGroupBy==='year'?'clock':state.indexGroupBy==='type'?'list':'book';
 const ui=groups.map((group,i)=>{
  const collapsed=state.indexCollapsed.has(group.key),regionId='index-group-items-'+i;
  const entries=group.scores.map(score=>{
   const info=[score.metadata?.composer,score.metadata?.type,score.metadata?.year].filter(Boolean).join(' · ')||bytes(score.size);
   return `<div class="index-score-row"><button class="list-row" data-action="open" data-value="${esc(score.path)}">${icon('file')}<span class="filetitle">${esc(scoreDisplayTitle(score))}</span><small>${esc(info)}</small></button><button class="score-tool score-metadata ${hasScoreMetadata(score)?'has-metadata':''}" data-action="meta-open" data-value="${esc(score.path)}" title="${esc(tr('metadataEdit'))}" aria-label="${esc(tr('metadataEdit'))}">${icon('edit')}</button></div>`;
  }).join('');
  return `<section class="group index-group" data-index-key="${esc(group.key)}">
   <button class="group-title index-group-toggle" type="button" data-action="index-group-toggle" data-value="${esc(group.key)}" aria-expanded="${!collapsed}" aria-controls="${regionId}">
    ${icon(groupIcon)}<span>${esc(group.label)}</span><small>${group.scores.length}</small>${icon(collapsed?'down':'up')}
   </button>
   <div class="list index-group-items" id="${regionId}" ${collapsed?'hidden':''}>${entries}</div>
  </section>`;
 }).join('');
 return heading('index',tr('indexSubtitle'))+paperBar()+
  `<div class="section-tools">${searchBox()}<span class="stat">${icon('book')}${selected.length} ${esc(tr('scoreCount'))}</span></div>`+
  controls+`<p class="index-results" role="status">${records.length} ${esc(tr('indexShown'))} · ${groups.length} ${esc(tr('indexGroupsCount'))}</p>`+
  (ui||empty(selected.length?tr('noResults'):tr('emptyIndex'),selected.length?tr('advancedNoResults'):tr('emptyText'),selected.length===0));
}
function renderTools(){
 const va=state.lang!=='es';
 const tab=(id,label)=>'<button type="button" class="pf-tools-tab'+(state.toolTab===id?' active':'')+'" role="tab" aria-selected="'+(state.toolTab===id)+'" data-action="tool-tab" data-value="'+id+'">'+label+'</button>';
 return heading('tools',tr('toolsSubtitle'))+
  '<div class="pf-tools-screen"><div class="pf-tools-tabbar" role="tablist" aria-label="'+(va?'Ferramentes musicals':'Herramientas musicales')+'">'+
  tab('metronome',va?'Metrònom':'Metrónomo')+tab('tuner',va?'Afinador':'Afinador')+tab('reference',va?'Nota de referència':'Nota de referencia')+tab('dictation',va?'Dictat Musical':'Dictado Musical')+'</div>'+
  (state.toolTab==='tuner'?tuner.markup(state.lang):state.toolTab==='reference'?referenceTone.markup(state.lang):state.toolTab==='dictation'?dictation.markup(state.lang):metronome.markup(state.lang))+'</div>';
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
 <div class="panel"><h3>${icon('info')} ${esc(tr('about'))}</h3><p>${esc(tr('limitations'))}</p><p>${esc(tr('intro'))}</p><div class="line"><strong>Partitures Festeres Web — ${esc(APP_VERSION)}</strong><span>© SMN Systems</span></div></div>`;
}
function renderModal(){if(!state.modal)return '';
 if(state.modal==='welcome')return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><img src="./assets/icon-192.png" alt="Partitures Festeres"/><h2>Benvingut · Bienvenido</h2><p>Tria l’idioma · Elige el idioma</p><label><input type="radio" name="welcome-lang" value="va" ${state.lang==='va'?'checked':''}/> Valencià</label><label><input type="radio" name="welcome-lang" value="es" ${state.lang==='es'?'checked':''}/> Castellano</label><div class="modal-actions"><button class="primary" data-action="welcome-done">Començar · Empezar</button></div></div></div>`;
 if(state.modal==='restore-choice'&&state.restore){const m=state.restore.manifest;return `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="restore-title"><div class="modal restore-modal"><h2 id="restore-title">${esc(tr('restoreChoice'))}</h2><p>${esc(tr('restoreExplain').replace('{count}',m.scoreCount).replace('{size}',bytes(m.totalBytes)))}</p><div class="restore-options"><div><strong>${esc(tr('restoreMerge'))}</strong><p>${esc(tr('restoreMergeHelp'))}</p><button class="primary" data-action="restore-merge">${icon('upload')}${esc(tr('restoreMerge'))}</button></div><div class="replace-option"><strong>${esc(tr('restoreReplace'))}</strong><p>${esc(tr('restoreReplaceHelp'))}</p><button class="danger" data-action="restore-replace">${icon('restore')}${esc(tr('restoreReplace'))}</button></div></div><div class="modal-actions"><button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button></div></div></div>`;}


 if(state.modal==='metadata-edit'){
   const score=state.scores.find(s=>s.path===state.metaPath);
   if(!score)return '';
   const m=score.metadata||{};
   return `<div class="modal-backdrop metadata-backdrop">
     <section class="modal metadata-modal" role="dialog" aria-modal="true" aria-labelledby="metadata-dialog-title">
       <h2 id="metadata-dialog-title">${esc(tr('metadataTitle'))}</h2>
       <p class="metadata-help">${esc(tr('metadataHelp'))}</p>
       <p class="metadata-source"><strong>${esc(tr('metadataFilename'))}:</strong> ${esc(score.path)}</p>
       <div class="metadata-fields">
        <label for="meta-title">${esc(tr('metadataFieldTitle'))}<input id="meta-title" type="text" maxlength="140" autocomplete="off" value="${esc(m.title||'')}" /></label>
        <label for="meta-composer">${esc(tr('metadataFieldComposer'))}<input id="meta-composer" type="text" maxlength="140" autocomplete="off" value="${esc(m.composer||'')}" /></label>
        <label for="meta-type">${esc(tr('metadataFieldType'))}<input id="meta-type" type="text" maxlength="80" autocomplete="off" value="${esc(m.type||'')}" /></label>
        <label for="meta-year">${esc(tr('metadataFieldYear'))}<input id="meta-year" type="text" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="${esc(tr('metadataYearHint'))}" autocomplete="off" value="${esc(m.year||'')}" /></label>
        <label for="meta-notes">${esc(tr('metadataFieldNotes'))}<textarea id="meta-notes" rows="4" maxlength="1200">${esc(m.notes||'')}</textarea></label>
       </div>
       <div class="modal-actions metadata-footer">
        <button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button>
        <button class="primary" data-action="meta-save">${icon('check')}${esc(tr('metadataSave'))}</button>
       </div>
     </section>
   </div>`;
 }
 if(state.modal==='rep-name'){
  const r=findRepertoire(state.modalRepId);
  return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><h2>${esc(tr(r?'renameRepertoire':'createRepertoire'))}</h2><label class="rep-name-label">${esc(tr('repertoireName'))}<input id="rep-name-input" type="text" autocomplete="off" maxlength="60" value="${esc(r?.name||'')}" /></label>
  <div class="modal-actions"><button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button><button class="primary" data-action="rep-save-name">${icon('check')}${esc(tr('repertoireSaved'))}</button></div></div></div>`;
 }
 if(state.modal==='rep-delete-confirm'){
  const r=findRepertoire(state.modalRepId);
  return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><h2>${esc(tr('removeRepertoire'))}</h2><p>${esc(r?.name||'')}</p><p>${esc(tr('repertoireRemoveConfirm'))}</p><div class="modal-actions"><button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button><button class="danger" data-action="rep-confirm-delete">${esc(tr('deleteConfirm'))}</button></div></div></div>`;
 }

 if(state.modal==='rep-add-scores'){
  const current=findRepertoire(state.repertoireOpen);
  if(!current)return '';
  return `<div class="modal-backdrop rep-add-backdrop" role="presentation">
   <section class="modal rep-add-modal" role="dialog" aria-modal="true" aria-labelledby="rep-add-title">
    <h2 id="rep-add-title">${esc(tr('repAddTitle'))}</h2>
    <p class="rep-add-target">${esc(current.name)}</p>
    <p class="rep-add-help">${esc(tr('repAddHelp'))}</p>
    <div class="rep-add-search-wrap">
      ${icon('search')}
      <input id="rep-add-search" type="search" autocomplete="off" spellcheck="false" value="${esc(state.repAddSearch)}" placeholder="${esc(tr('repAddPlaceholder'))}" aria-label="${esc(tr('repAddPlaceholder'))}"/>
    </div>
    <div class="rep-add-meta"><span id="rep-add-found">${repAddResultsData().matches.length} ${esc(tr('repAddResultCount'))}</span><strong id="rep-add-count">${state.repAddChosen.length} ${esc(tr('repAddSelected'))}</strong></div>
    <div id="rep-add-results" class="rep-add-results">${renderRepAddResults()}</div>
    <div class="modal-actions rep-add-footer">
      <button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button>
      <button class="primary" id="rep-add-confirm" data-action="rep-add-confirm" ${state.repAddChosen.length?'':'disabled'}>${esc(tr('repAddConfirm'))} (${state.repAddChosen.length})</button>
    </div>
   </section>
  </div>`;
 }
 if(state.modal==='rep-picker'){
  return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><h2>${esc(tr('chooseRepertoire'))}</h2><p>${esc(nice(parts(state.pickerPath||'').at(-1)||''))}</p>
  <div class="rep-picker-list">${state.repertoires.map(r=>`<button class="secondary" data-action="rep-choose" data-id="${esc(r.id)}">${icon('list')}${esc(r.name)}</button>`).join('')}</div>
  <div class="modal-actions"><button class="secondary" data-action="rep-create">${icon('plus')}${esc(tr('createRepertoire'))}</button><button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button></div></div></div>`;
 }
 if(state.modal==='clear')return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><h2>${esc(tr('warningTitle'))}</h2><p>${esc(tr('warningText'))}</p><div class="modal-actions"><button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button><button class="danger" data-action="confirm-clear">${esc(tr('deleteConfirm'))}</button></div></div></div>`;
 if(state.modal==='annotation-symbols'&&state.annotating&&scoreViewer){
   const groups=SYMBOL_GROUPS.map(g=>`<button class="symbol-category ${state.symbolGroup===g.id?'selected':''}" data-action="annotation-symbol-group" data-value="${g.id}" aria-pressed="${state.symbolGroup===g.id}">${esc(g.name[state.lang])}</button>`).join('');
   const choices=Object.entries(MUSICAL_SYMBOLS).filter(([id,spec])=>spec.group===state.symbolGroup).map(([id,spec])=>`<button class="musical-stamp-choice ${scoreViewer?.musicalSymbol===id?'selected':''}" data-action="annotation-symbol-pick" data-value="${id}" title="${esc(spec.name[state.lang])}" aria-label="${esc(spec.name[state.lang])}" aria-pressed="${scoreViewer?.musicalSymbol===id}">${musicalSymbolIcon(id)}<span>${esc(spec.name[state.lang])}</span></button>`).join('');
   return `<div class="modal-backdrop annotation-symbol-backdrop" role="presentation">
    <section class="modal annotation-symbol-modal" role="dialog" aria-modal="true" aria-labelledby="annotation-symbol-title">
     <h2 id="annotation-symbol-title">${esc(tr('annotationSymbolPicker'))}</h2>
     <div class="musical-symbol-categories" role="group" aria-label="${esc(tr('annotationSymbolPicker'))}">${groups}</div>
     <div class="musical-symbol-grid">${choices}</div>
     <p class="annotation-symbol-help">${esc(tr('annotationSymbolHelp'))}</p>
     <div class="modal-actions"><button class="secondary" data-action="annotation-symbol-cancel">${esc(tr('cancel'))}</button></div>
    </section>
   </div>`;
  }
  if(state.modal==='annotation-text'&&state.textDraft){
   const d=state.textDraft,editing=d.index!=null;
   const optSize=TEXT_SIZES.map(n=>`<option value="${n}" ${d.fontSize===n?'selected':''}>${Math.round(n*1000)/10}%</option>`).join('');
   const optOpacity=TEXT_OPACITIES.map(n=>`<option value="${n}" ${d.opacity===n?'selected':''}>${Math.round(n*100)}%</option>`).join('');
   const colors=ANNOTATION_COLORS.map(c=>`<label class="annotation-text-color" title="${c}"><input type="radio" name="annotation-text-color" value="${c}" ${d.color===c?'checked':''} aria-label="${esc(tr('annotationTextColor'))} ${c}"/><span style="--swatch:${c}"></span></label>`).join('');
   return `<div class="modal-backdrop annotation-text-backdrop" role="dialog" aria-modal="true" aria-labelledby="annotation-text-title">
    <div class="modal annotation-text-modal"><h2 id="annotation-text-title">${esc(tr(editing?'annotationTextEdit':'annotationTextNew'))}</h2>
    <p>${esc(tr('annotationTextHint'))}</p>
    <label class="annotation-text-main">${esc(tr('annotationTextValue'))}
     <textarea id="annotation-text-value" rows="3" maxlength="280" spellcheck="false" placeholder="${esc(tr('annotationTextValue'))}">${esc(d.text||'')}</textarea></label>
    <div class="annotation-text-grid">
     <label>${esc(tr('annotationFontSize'))}<select id="annotation-font-size">${optSize}</select></label>
     <label>${esc(tr('annotationOpacity'))}<select id="annotation-text-opacity">${optOpacity}</select></label>
     <label class="annotation-text-toggle"><input id="annotation-text-bold" type="checkbox" ${d.bold?'checked':''}/>${esc(tr('annotationBold'))}</label>
     <label class="annotation-text-toggle"><input id="annotation-text-underline" type="checkbox" ${d.underline?'checked':''}/>${esc(tr('annotationUnderline'))}</label>
    </div>
    <fieldset class="annotation-text-colors"><legend>${esc(tr('annotationTextColor'))}</legend>${colors}</fieldset>
    <div class="modal-actions"><button class="secondary" data-action="annotation-text-cancel">${esc(tr('cancel'))}</button>
     <button class="primary" data-action="annotation-text-save">${esc(tr('annotationSaveText'))}</button></div>
    </div>
   </div>`;
  }
 if(state.modal==='annotation-clear')return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><h2>${esc(tr('annotationClearTitle'))}</h2><p>${esc(tr('annotationClearAsk'))}</p><div class="modal-actions"><button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button><button class="danger" data-action="annotation-clear-confirm">${esc(tr('deleteConfirm'))}</button></div></div></div>`;
 if(state.modal==='delete-one')return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><h2>${esc(tr('warningTitle'))}</h2><p>${esc(tr('confirmOne'))}</p><p><strong>${esc(state.view?.path||'')}</strong></p><div class="modal-actions"><button class="secondary" data-action="close-modal">${esc(tr('cancel'))}</button><button class="danger" data-action="confirm-delete-one">${esc(tr('deleteConfirm'))}</button></div></div></div>`;
 return '';
}
const ANNOTATION_GROUP_TOOLS={
 strokes:[['pen','annotationPen','edit'],['highlighter','annotationHighlight','edit']],
 shapes:[['line','annotationLine','lineShape'],['rectangle','annotationRectangle','rectShape'],
         ['ellipse','annotationEllipse','ellipseShape'],['arrow','annotationArrow','arrowShape']],
 edit:[['text','annotationText','textShape'],['select','annotationSelect','move'],['eraser','annotationEraser','erase']],
 symbols:[['symbol','annotationSymbolTool','musicSymbol']]
};
function renderRosette(v){
 if(!state.annotating)return '';
 const previous=$('.pf-reading-mode');
 const rotated=viewerCssFallback&&window.innerHeight>window.innerWidth;
 const width=previous?.clientWidth||(rotated?window.innerHeight:window.innerWidth);
 const height=previous?.clientHeight||(rotated?window.innerWidth:window.innerHeight);
 return renderRosetteMarkup({
  viewer:v,state,icon,
  width,height,language:state.lang==='es'?'es':'va',
  labels:{
   edit:tr('annotationEdit'),undo:tr('annotationUndo'),
   editText:tr('annotationTextEdit'),deleteSelected:tr('annotationDeleteSelected'),
   done:tr('annotationDone'),
   advanced:state.lang==='va'?'Més opcions':'Más opciones'
  }
 });
}

function renderAnnotationToolbar(v){
 if(!state.annotating||!state.rosetteLegacy)return '';
 const groupLabels=[['strokes','annotationGroupStrokes','edit'],['shapes','annotationGroupShapes','rectShape'],['edit','annotationGroupEdit','textShape'],['symbols','annotationGroupMusic','musicSymbol']];
 const tabs=groupLabels.map(([id,label,ico])=>`<button class="annotation-petal ${state.annotationGroup===id?'selected':''}" data-action="annotation-group" data-value="${id}" aria-pressed="${state.annotationGroup===id}">${icon(ico)}${esc(tr(label))}</button>`).join('');
 const tools=ANNOTATION_GROUP_TOOLS[state.annotationGroup]||ANNOTATION_GROUP_TOOLS.strokes;
 const buttons=state.annotationGroup==='symbols'
    ?`<button data-action="annotation-symbol-picker" class="annotation-tool annotation-symbol-picker-trigger selected" title="${esc(tr('annotationChooseSymbol'))}" aria-label="${esc(tr('annotationChooseSymbol'))}">${musicalSymbolIcon(v?.musicalSymbol||'quarter')}<span>${esc(MUSICAL_SYMBOLS[v?.musicalSymbol||'quarter']?.name[state.lang]||tr('annotationChooseSymbol'))}</span>${icon('down')}</button>`
    :tools.map(([id,label,ico])=>`<button data-action="annotation-tool" data-value="${id}" class="annotation-tool ${v?.annotationTool===id?'selected':''}" aria-pressed="${v?.annotationTool===id}" title="${esc(tr(label))}">${icon(ico)}<span>${esc(tr(label))}</span></button>`).join('');
 const drawing=['pen','highlighter','line','rectangle','ellipse','arrow'].includes(v?.annotationTool);
 const symbolic=v?.annotationTool==='symbol';
 const colorable=drawing||symbolic;
 const colors=ANNOTATION_COLORS.map(color=>`<button class="annotation-swatch ${v?.annotationColor===color?'selected':''}" data-action="annotation-color" data-value="${color}" style="--swatch:${color}" title="${esc(tr('annotationColor'))}" aria-label="${esc(tr('annotationColor'))} ${color}" aria-pressed="${v?.annotationColor===color}" ${colorable?'':'disabled'}></button>`).join('');
 const sizes=[1,2,3,4,5].map(n=>`<option value="${n}" ${v?.annotationThickness===n?'selected':''}>${n}</option>`).join('');
 const stampSizes=SYMBOL_SIZES.map(n=>`<option value="${n}" ${v?.musicalSymbolSize===n?'selected':''}>${Math.round(n*1000)/10}%</option>`).join('');
 return `<div class="viewer-annotation-toolbar w22-annotation-toolbar w23-annotation-toolbar" role="toolbar" aria-label="${esc(tr('annotationEdit'))}">
   <div class="annotation-rosette" role="group" aria-label="${esc(tr('annotationEdit'))}">${tabs}</div>
   <div class="annotation-tool-scroll" aria-label="${esc(tr('annotationEdit'))}">${buttons}</div>
   <div class="annotation-settings-row">
     ${drawing?`<label class="annotation-width-label">${esc(tr('annotationThickness'))}<select id="annotation-width" aria-label="${esc(tr('annotationThickness'))}">${sizes}</select></label>`:''}
     ${symbolic?`<label class="annotation-width-label">${esc(tr('annotationSymbolSize'))}<select id="annotation-symbol-size" aria-label="${esc(tr('annotationSymbolSize'))}">${stampSizes}</select></label>`:''}
     ${colorable?`<span class="annotation-colors" aria-label="${esc(tr('annotationColor'))}">${colors}</span>`:''}
     <div class="annotation-edit-actions">
       <button data-action="annotation-undo" title="${esc(tr('annotationUndo'))}" aria-label="${esc(tr('annotationUndo'))}">${icon('back')}</button>
       <button data-action="annotation-text-edit" title="${esc(tr('annotationTextEdit'))}" aria-label="${esc(tr('annotationTextEdit'))}" ${v?.getSelectedText()?'':'disabled'}>${icon('textShape')}</button>
       <button data-action="annotation-delete-selected" title="${esc(tr('annotationDeleteSelected'))}" aria-label="${esc(tr('annotationDeleteSelected'))}" ${v?.hasSelectedAnnotation()?'':'disabled'}>${icon('trash')}</button>
       <button data-action="annotation-clear" title="${esc(tr('annotationClear'))}" aria-label="${esc(tr('annotationClear'))}">${icon('trash')}</button>
       <button data-action="viewer-annotate" class="annotation-done">${esc(tr('annotationDone'))}</button>
     </div>
   </div>
   <small>${esc(v?.annotationTool==='text'?tr('annotationTextHint'):v?.annotationTool==='symbol'?tr('annotationSymbolHint'):v?.annotationTool==='select'?tr('annotationTextSelectHelp'):tr('annotationHelp'))}</small>
 </div>`;
}
function renderViewer(){if(!state.view)return '';
 const list=currentCollectionScores(),idx=list.findIndex(s=>s.path===state.view.path),p=idx>=0?idx:0;
 const v=scoreViewer, page=v?.pageNumber||1, total=v?.numPages||'…', native=!!v?.native;
 return `<div class="viewer w12-viewer pf-reading-mode ${viewerCssFallback?'landscape-css-fallback':''} ${state.zen?'zen-mode':''} ${state.annotating?'annotation-mode':''}" role="dialog" aria-label="${esc(tr('openPdf'))}">
   <div id="viewer-stage" class="viewer-stage" data-path="${esc(state.view.path)}" tabindex="0" aria-label="${esc(tr('viewerStageHint'))}"><p class="viewer-message">${esc(tr('viewerLoading'))}</p></div>
   <div class="viewer-top"><button class="quiet" data-action="viewer-close" aria-label="${esc(tr('back'))}">${icon('back')}</button><span class="viewer-title">${esc(scoreDisplayTitle(state.scores.find(s=>s.path===state.view.path)))}</span><button class="quiet viewer-favorite ${state.favorites.includes(state.view.path)?'active':''}" data-action="favorite" data-value="${esc(state.view.path)}" aria-pressed="${state.favorites.includes(state.view.path)}" title="${esc(tr(state.favorites.includes(state.view.path)?'removeFavorite':'addFavorite'))}" aria-label="${esc(tr(state.favorites.includes(state.view.path)?'removeFavorite':'addFavorite'))}">${icon('star')}</button><button class="quiet viewer-annotate-btn ${state.annotating?'active':''}" data-action="viewer-annotate" aria-pressed="${state.annotating}" title="${esc(tr(state.annotating?'annotationDone':'annotationEdit'))}" aria-label="${esc(tr(state.annotating?'annotationDone':'annotationEdit'))}" ${native?'disabled':''}>${icon('edit')}</button><button class="quiet" data-action="viewer-rotate" title="${esc(tr('viewerRotate'))}" aria-label="${esc(tr('viewerRotate'))}">${icon('rotate')}</button><button class="quiet viewer-auto-rotate" data-action="viewer-auto-rotate" aria-label="${esc(tr('viewerAutoRotate'))}" title="${esc(tr('viewerAutoRotate'))}" aria-pressed="${v?.rotationMode==='auto'}">AUTO</button><button class="quiet" id="viewer-fit-button" data-action="viewer-fit" title="${esc(tr('viewerFitPage'))}" aria-label="${esc(tr('viewerFitPage'))}">${icon('fit')}</button><button class="quiet" data-action="viewer-external" title="${esc(tr('openExternal'))}" aria-label="${esc(tr('openExternal'))}">${icon('share')}</button></div>
   <div class="viewer-toolbar"><button class="quiet" id="viewer-prev-page" data-action="viewer-page-prev" aria-label="${esc(tr('viewerPrevPage'))}" ${native?'disabled':''}>${icon('back')}</button><span class="viewer-page-counter" id="viewer-page-counter">${esc(tr('viewerPage'))} ${page} / ${total}</span><button class="quiet" id="viewer-next-page" data-action="viewer-page-next" aria-label="${esc(tr('viewerNextPage'))}" ${native?'disabled':''}>${icon('next')}</button><span class="viewer-toolbar-divider"></span><button class="quiet" data-action="viewer-zoom-out" aria-label="${esc(tr('viewerZoomOut'))}" ${native?'disabled':''}>${icon('zoomout')}</button><span id="viewer-zoom-label" class="viewer-zoom-label">${Math.round((v?.zoom||1)*100)}%</span><button class="quiet" data-action="viewer-zoom-in" aria-label="${esc(tr('viewerZoomIn'))}" ${native?'disabled':''}>${icon('zoomin')}</button><button class="quiet" data-action="viewer-zen" aria-label="${esc(tr('viewerZen'))}">${icon('expand')}</button></div>
   ${renderRosette(v)}${renderAnnotationToolbar(v)}
   <div class="viewer-bottom"><button data-action="viewer-prev" ${p<=0?'disabled':''}>${icon('back')} ${esc(tr('noPrevious'))}</button><span>${p+1} / ${list.length} ${esc(tr('scoreCount'))}</span><button data-action="viewer-next" ${p>=list.length-1?'disabled':''}>${esc(tr('noNext'))} ${icon('next')}</button></div>
   <div class="viewer-intro">${esc(nice(parts(state.view.path).at(-1)))}<small>${esc(tr('viewerStageHint'))}</small></div>
  </div>`;
}
let rosetteIgnoreClickUntil=0;
let viewerMenuTimer = 0;
function showViewerMenu(show){
 const view=$('.pf-reading-mode'); if(!view)return;
 view.querySelector('.viewer-intro')?.classList.add('hidden-intro');
 state.zen=!show;
 view.classList.toggle('zen-mode',state.zen);
 clearTimeout(viewerMenuTimer);
 if(show&&!state.annotating) viewerMenuTimer=setTimeout(()=>{if(state.view)showViewerMenu(false);},6500);
}
function openAdjacentScore(direction){
 const a=currentCollectionScores(),i=a.findIndex(s=>s.path===state.view?.path);
 const other=a[i+direction];
 if(other) openPdf(other.path).catch(e=>{console.error(e);toast(`${tr('error')} ${e.message}`,true);});
}
function syncViewerControls(){
 if(!state.view||!scoreViewer)return;
 const v=scoreViewer,prev=$('#viewer-prev-page'),next=$('#viewer-next-page');
 if(prev)prev.disabled=v.native||v.pageNumber<=1;
 if(next)next.disabled=v.native||v.pageNumber>=v.numPages;
 const info=$('#viewer-page-counter');if(info)info.textContent=v.native?tr('viewerShow'):`${tr('viewerPage')} ${v.pageNumber} / ${v.numPages||'…'}`;
 const zoom=$('#viewer-zoom-label');if(zoom)zoom.textContent=Math.round(v.zoom*100)+'%';
 const fit=$('#viewer-fit-button');if(fit)fit.title=v.fit==='page'?tr('viewerFitWidth'):tr('viewerFitPage');
 const auto=$('[data-action="viewer-auto-rotate"]');if(auto)auto.setAttribute('aria-pressed',String(v.rotationMode==='auto'));
 const annotate=$('[data-action="viewer-annotate"]');if(annotate)annotate.disabled=v.native||!v.page;
 const undo=$('[data-action="annotation-undo"]');if(undo)undo.disabled=!v.canUndoAnnotation();
 const selectedDelete=$('[data-action="annotation-delete-selected"]');if(selectedDelete)selectedDelete.disabled=!v.hasSelectedAnnotation();
 const editText=$('[data-action="annotation-text-edit"]');if(editText)editText.disabled=!v.getSelectedText();
 const clearAnn=$('[data-action="annotation-clear"]');if(clearAnn)clearAnn.disabled=!v.hasPageAnnotations();
 for(const action of ['object-copy','object-rotate-left','object-rotate-right','object-reset-rotation','object-size-down','object-size-up']){
  document.querySelectorAll('[data-action="'+action+'"]').forEach(b=>{b.disabled=!v.hasSelectedAnnotation();});
 }
 document.querySelectorAll('[data-action="object-paste"]').forEach(b=>{b.disabled=!v.canPasteAnnotation();});
 for(const act of ['viewer-zoom-out','viewer-zoom-in','viewer-fit','viewer-rotate']){
  const btn=$(`[data-action="${act}"]`);if(btn)btn.disabled=v.native;
 }
}

function render(){
 // En mostrar un diàleg, conservem el canvas i el PDF ja desxifrat.
 const oldStage=$('#viewer-stage');
 const oldPath=oldStage?.dataset.path;
 if(scoreViewer?.inlineSession&&oldStage&&state.view?.path===oldPath){
  // Un reinsert del node enfocat pot tancar el teclat: no reconstruir l'app.
  syncViewerControls();return;
 }
 document.documentElement.lang = state.lang==='va'?'ca-ES-valencia':'es';
 document.title='Partitures Festeres Web';
 const page=state.page==='add'?scanner.markup({scores:state.scores,repertoires:state.repertoires,language:state.lang}):state.page==='index'?renderIndex():state.page==='tools'?renderTools():state.page==='settings'?renderSettings():state.page==='favorites'||state.page==='recents'?renderCollectionPage(state.page):state.page==='repertoires'?renderRepertoires():renderLibrary();
 $('#app').innerHTML = `<header class="topbar"><div class="brand"><img src="./assets/icon-192.png" alt=""/><div><h1>Partitures Festeres</h1><small>${esc(tr('subtitle'))}</small></div></div><div class="top-actions"><button type="button" class="pf-topbar-scan" data-action="scan-open">${icon('camera')} ${state.lang==='es'?'Escanear':'Escanejar'}</button><button class="primary" data-action="import">${icon('upload')} ${esc(tr('import'))}</button></div></header>
 <div class="main-layout"><aside class="sidebar"><span class="side-caption">Partitures Festeres Web</span>${nav('library','library')}${nav('list','repertoires')}${nav('book','index')}${nav('clock','recents')}${nav('star','favorites')}${nav('musicSymbol','tools')}${nav('settings','settings')}<div class="side-bottom">${esc(tr('dev'))} ${esc(APP_VERSION)}<p>${esc(tr('offlineReady'))}</p></div></aside><main class="content">${page}</main></div>
 <nav class="bottom-nav" aria-label="Navegació">${tabsMobile('library','library')}${tabsMobile('list','repertoires')}${tabsMobile('book','index')}${tabsMobile('clock','recents')}${tabsMobile('star','favorites')}${tabsMobile('musicSymbol','tools')}${tabsMobile('settings','settings')}</nav>${renderViewer()}${renderModal()}`;
 if(oldStage && state.view?.path===oldPath && scoreViewer){
  $('#viewer-stage')?.replaceWith(oldStage);
 }
 syncViewerControls();
 if(state.page==='tools'&&state.toolTab==='tuner'&&!state.view)tuner.updateDom();
 rememberNavigation();
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
async function openPdf(path,requestedPage=null){
 clearTimeout(viewerMenuTimer);
 $('.toast')?.remove();clearTimeout(state.toastTimer);
 const request=++viewerRequest;
 if(!state.view&&!viewerPendingOpen){
  viewerPendingOpen=true;
  ensureViewerHistory(); // L'entrada anterior sempre és el menú de procedència.
  requestViewerLandscape();
 }
 const record=await getScore(path);
 if(request!==viewerRequest)return;
 if(!record?.blob){
  if(!state.view){viewerPendingOpen=false;releaseViewerLandscape();if(hasViewerHistory())history.back();}
  toast(tr('pdfUnavailable'),true);return;
 }
  state.recents=[path,...state.recents.filter(p=>p!==path)].slice(0,45);
  setPref('w13:recents',state.recents).catch(e=>console.warn('Recents:',e));
 closeViewerIfNeeded(true);
 state.blobUrl=URL.createObjectURL(record.blob);
 state.view={path,page:1};viewerPendingOpen=false;state.zen=true;state.annotating=false;state.objectMenuOpen=false;state.annotationGroup='strokes';setReadingColors(true);
 await viewerPreferencesQueue.catch(()=>{});
 if(request!==viewerRequest)return;
 const saved=await getPref('viewer:'+path,{});
 const pageToOpen=Number.isInteger(requestedPage)&&requestedPage>0?requestedPage:saved?.page;
 state.view.page=Number.isInteger(pageToOpen)&&pageToOpen>0?pageToOpen:1;
 const annotations=await getAnnotations(path);
 if(request!==viewerRequest){closeViewerIfNeeded();return;}
 render();
 const host=$('#viewer-stage');
 scoreViewer=new ScoreViewer({
  host,blob:record.blob,fallbackUrl:state.blobUrl,initial:{...saved,page:state.view.page},annotations,
   onDoubleTap:point=>{
      if(!state.view||state.modal||scoreViewer?.inlineSession)return;
      if(!state.annotating){state.annotating=true;scoreViewer.setAnnotationMode(true);}
      state.rosetteLegacy=false;
      state.rosetteLevel='root';
      state.rosetteExpanded=!state.rosetteExpanded;
      if(state.rosetteExpanded){
        scoreViewer.setNavigationMode(true);
        const width=Math.max(1,scoreViewer.host.clientWidth),height=Math.max(1,scoreViewer.host.clientHeight);
        const center=clampRosetteCenter(point.x,point.y,width,height,true);
        state.rosetteX=center.x/width;state.rosetteY=center.y/height;
      }
      state.zen=false;clearTimeout(viewerMenuTimer);render();
    },
   onTextPlacement:(point,box)=>{
     if(!state.view||!scoreViewer?.annotationMode||state.modal)return;
     const draft={path:state.view.path,page:scoreViewer.pageNumber,index:null,point,text:'',
       ...(box||{}),
       ...scoreViewer.textStyle,color:scoreViewer.annotationColor};
     if(state.rosetteLegacy){
       state.textDraft=draft;state.modal='annotation-text';render();$('#annotation-text-value')?.focus();
     }else scoreViewer.startInlineTextEditor(draft,{lang:state.lang});
   },
   onAnnotationsChange:document=>{
    if(state.backup?.url)URL.revokeObjectURL(state.backup.url);
    state.backup=null;
    return savePdfAnnotations(path,document);
   },
  labels:{loading:tr('viewerLoading'),page:tr('viewerPage'),fallback:tr('viewerFallback'),native:tr('openPdf'),external:tr('openExternal')},
  onChange:value=>{
    if(state.view?.path===path)state.view.page=value.page;
    rememberNavigation();
    return persistViewerSnapshot(path,value).catch(e=>console.warn('Desament del visor:',e));
   },
  onUpdate:()=>syncViewerControls(),
  onWarning:message=>toast(message,true),
  onEdge:direction=>openAdjacentScore(direction),
  onToggleControls:()=>showViewerMenu(state.zen)
 });
 await scoreViewer.open();
 setTimeout(()=>$('.viewer-intro')?.classList.add('hidden-intro'),2200);
}
function setReadingColors(reading){
 document.documentElement.classList.toggle('reading-pdf',reading);
 document.body.classList.toggle('reading-pdf',reading);
 const theme=document.querySelector('meta[name="theme-color"]');
 if(theme)theme.content=reading?'#ffffff':'#6b1722';
}
function closeViewer(consumeHistory=true){
 const wasReading=!!state.view||viewerPendingOpen;
 viewerRequest++;
 viewerPendingOpen=false;
 clearTimeout(viewerMenuTimer);
 clearTimeout(fullscreenExitTimer);
 closeViewerIfNeeded();
 render();
 if(lastContentScrollY>0)requestAnimationFrame(()=>window.scrollTo(0,lastContentScrollY));
 // Tornar, Escape i el gest Android compartixen la mateixa ruta de tancament.
 // Des de popstate no tornem a fer history.back() per a no eixir de l'app.
 if(consumeHistory&&wasReading&&hasViewerHistory())history.back();
}

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
    await annotationSaveQueue;
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
    await annotationSaveQueue;
    const count=await restoreBackup(state.restore,mode,p=>updateProgress(`${tr('backupVerify')} ${p.done} / ${p.total}`));
    state.restore=null;
    state.scores=await getAllScores();
    await reloadCollections();
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
function applyRosetteOption(id){
 if(!state.annotating||!scoreViewer||state.modal)return;
 const v=scoreViewer,level=state.rosetteLevel;
 const ctx={annotationTool:v.annotationTool,annotationColor:v.annotationColor,
  annotationThickness:v.annotationThickness,musicalSymbol:v.musicalSymbol,
  musicalSymbolSize:v.musicalSymbolSize,symbolGroup:state.symbolGroup,
  symbolPage:state.rosetteSymbolPage,fontSize:v.textStyle.fontSize,
  bold:v.textStyle.bold,italic:v.textStyle.italic,underline:v.textStyle.underline,
  alignment:v.textStyle.alignment||'left'};
 const option=rosetteOptions(level,ctx).find(o=>o.id===id);
 if(!option)return;
 // En triar Text o Retall, el panell Objectes es tanca i no tapa el PDF.
 if(option.tool&&option.tool!=='select')state.objectMenuOpen=false;
 if(option.unavailable){
  toast(state.lang==='va'?'El retall avançat arribarà en una pròxima fase.':'El recorte avanzado llegará en una próxima fase.');
  return;
 }
 if(option.back){state.rosetteLevel=option.back;}
 else if(option.id==='back'){state.rosetteLevel=rosetteParent(level)||'root';}
 else if(option.category){
  state.symbolGroup=option.category;
  state.rosetteSymbolPage=0;
  state.rosetteLevel='symbol-picker';
  v.setAnnotationTool('symbol');
 }else if(option.page!==undefined){state.rosetteSymbolPage=option.page;}
 else if(option.level){
  if(option.tool)v.setAnnotationTool(option.tool);
  state.rosetteLevel=option.level;
 }else if(option.symbol){
  v.setMusicalSymbol(option.symbol);
  state.rosetteLevel='symbols';
 }else if(option.color){
  v.setAnnotationColor(option.color);
  if(level.startsWith('text-'))v.textStyle={...v.textStyle,color:option.color};
  state.rosetteLevel=rosetteParent(level)||'root';
 }else if(option.alignment){
  v.textStyle={...v.textStyle,alignment:option.alignment};
  state.rosetteLevel='text';
 }else if(option.width){
  v.setAnnotationThickness(option.width);
  state.rosetteLevel=rosetteParent(level)||'root';
 }else if(option.textSize){
  v.textStyle={...v.textStyle,fontSize:option.textSize};
  state.rosetteLevel='text';
 }else if(option.symbolSize){
  v.setMusicalSymbolSize(option.symbolSize);
  state.rosetteLevel='symbols';
 }else if(option.toggle){
  v.textStyle={...v.textStyle,[option.toggle]:!v.textStyle[option.toggle]};
 }else if(option.tool){
  v.setAnnotationTool(option.tool);
  if(level==='shape-type')state.rosetteLevel='shape';
 }
 render();
}

async function handleClick(el){
 const action=el.dataset.action,val=el.dataset.value;
 switch(action){
  case 'scan-open':{
   if(state.view||viewerPendingOpen||state.page==='add'||scanner.busy)break;
   const folder=state.page==='library'?currentBase():state.paper==='root'?'':state.paper;
   setPage('add');scanner.open({folder,repertoires:state.repertoires});break;
  }
  case 'scan-close':if(!scanner.busy)setPage('library');break;
  case 'scan-crop':
   if(state.page==='add'&&!state.view&&!scanner.busy&&!documentCamera.active)
    await cropEditor.open(scanner.getPage(val),{language:state.lang});
   break;
  case 'scan-camera':
   if(state.page==='add'&&!scanner.busy&&scanner.pages.length<30)
    await documentCamera.open({language:state.lang,existing:scanner.pages.length});
   break;
  case 'scan-camera-file':
   if(state.page==='add'&&!scanner.busy)$('#scan-camera-input')?.click();
   break;
  case 'scan-gallery':if(state.page==='add'&&!scanner.busy)$('#scan-gallery-input')?.click();break;
  case 'scan-import':if(state.page==='add'&&!scanner.busy)$('#import-input')?.click();break;
  case 'scan-up':
  case 'scan-down':
  case 'scan-rotate':
  case 'scan-remove':
  case 'scan-clear':
  case 'scan-save':
   if(state.page==='add'&&!state.view)await scanner.handleAction(action,val);
   break;
  case 'tool-tab':
   if(state.page==='tools'&&!state.view&&['metronome','tuner','reference','dictation'].includes(val)&&val!==state.toolTab){
    metronome.stop({release:true,notify:false});tuner.stop({notify:false});referenceTone.stop({notify:false});dictation.stop({notify:false});
    state.toolTab=val;render();
   }
   break;
  case 'dictation-toggle':
  case 'dictation-mode':
  case 'dictation-clear':
  case 'dictation-save-image':
  case 'dictation-share':
   if(state.page==='tools'&&state.toolTab==='dictation'&&!state.view)await dictation.handleAction(action,val);
   break;
  case 'reference-toggle':
  case 'reference-note':
  case 'reference-octave':
  case 'reference-shortcut':
   if(state.page==='tools'&&state.toolTab==='reference'&&!state.view)await referenceTone.handleAction(action,val);
   break;
  case 'tuner-toggle':
  case 'tuner-clear':
  case 'tuner-reference-reset':
   if(state.page==='tools'&&state.toolTab==='tuner'&&!state.view)await tuner.handleAction(action);
   break;
  case 'metro-toggle':
  case 'metro-plus':
  case 'metro-minus':
  case 'metro-signature':
   if(state.page==='tools'&&state.toolTab==='metronome'&&!state.view)await metronome.handleAction(action,val);
   break;
  case 'rosette-core':{
   if(Date.now()<rosetteIgnoreClickUntil)break;
   if(!state.annotating)break;
   if(!state.rosetteExpanded){state.rosetteExpanded=true;state.rosetteLevel='root';}
   else {const parent=rosetteParent(state.rosetteLevel);
    if(parent)state.rosetteLevel=parent;else state.rosetteExpanded=false;}
   render();break;
  }
  case 'rosette-option':applyRosetteOption(val);break;
  case 'rosette-pan':{
    if(!state.annotating||!scoreViewer)break;
    scoreViewer.setNavigationMode(!scoreViewer.navigationMode);
    render();break;
  }
  case 'object-toggle':{
    if(!state.annotating||!scoreViewer)break;
    state.objectMenuOpen=!state.objectMenuOpen;
    if(state.objectMenuOpen)scoreViewer.setAnnotationTool('select');
    render();break;
  }
  case 'object-copy':scoreViewer?.copySelectedAnnotation();syncViewerControls();break;
  case 'object-paste':scoreViewer?.pasteCopiedAnnotation();syncViewerControls();break;
  case 'object-rotate-left':scoreViewer?.transformSelectedAnnotation({rotation:-15});break;
  case 'object-rotate-right':scoreViewer?.transformSelectedAnnotation({rotation:15});break;
  case 'object-reset-rotation':{
    if(scoreViewer?.hasSelectedAnnotation()){
      const selected=scoreViewer.annotationsOnPage()[scoreViewer.selectedAnnotation];
      scoreViewer.transformSelectedAnnotation({rotation:-(selected.rotationDegrees||0)});
    }
    break;
  }
  case 'object-size-down':scoreViewer?.transformSelectedAnnotation({scale:1/1.12});break;
  case 'object-size-up':scoreViewer?.transformSelectedAnnotation({scale:1.12});break;
  case 'rosette-legacy':{
   if(!state.annotating)break;
   state.rosetteLegacy=!state.rosetteLegacy;
   if(state.rosetteLegacy)state.rosetteExpanded=false;
   render();break;
  }
  case 'advanced-toggle':state.advancedOpen=!state.advancedOpen;render();break;
  case 'advanced-clear':state.advanced=blankAdvancedFilters();render();break;
  case 'index-group-toggle':if(state.indexCollapsed.has(val))state.indexCollapsed.delete(val);else state.indexCollapsed.add(val);render();break;
  case 'index-expand-all':state.indexCollapsed.clear();render();break;
  case 'index-collapse-all':state.indexCollapsed=new Set(indexViewGroups(scopedScores().filter(matchListScore)).map(g=>g.key));render();break;
  case 'page':if(state.view||viewerPendingOpen)closeViewer();else closeViewerIfNeeded();setPage(val);break;
  case 'paper':state.paper=val;state.cwd=[];state.search='';state.indexCollapsed.clear();await setPref('paper',val);render();break;
  case 'crumb':state.cwd=state.cwd.slice(0,Number(val));state.search='';render();break;
  case 'folder':state.cwd.push(val);state.search='';render();break;
  case 'import':if(!(state.page==='add'&&scanner.busy))$('#import-input').click();break;
  case 'backup-create':await doBackup();break;
  case 'backup-choose':$('#restore-input').click();break;
  case 'backup-save':saveBackup();break;
  case 'backup-share':await shareBackup();break;
  case 'restore-merge':await doRestore('merge');break;
  case 'restore-replace':await doRestore('replace');break;


  case 'meta-open':{
    if(!scorePaths().has(val))break;
    state.metaPath=val;state.modal='metadata-edit';
    render();$('#meta-title')?.focus();break;
  }
  case 'meta-save':{
    if(state.modal!=='metadata-edit'||!scorePaths().has(state.metaPath))break;
    const field=id=>$('#'+id)?.value??'';
    const year=field('meta-year').trim();
    if(year&&!/^\d{4}$/.test(year)){toast(tr('metadataYearError'),true);$('#meta-year')?.focus();break;}
    const data=normalizeScoreMetadata({
      title:field('meta-title'),composer:field('meta-composer'),type:field('meta-type'),
      year,notes:field('meta-notes')
    });
    await setScoreMetadata(state.metaPath,data);
    state.scores=await getAllScores();
    // Una còpia ZIP preparada abans del canvi ja no està actualitzada.
    if(state.backup?.url)URL.revokeObjectURL(state.backup.url);
    state.backup=null;state.metaPath=null;state.modal=null;
    render();toast(tr('metadataSaved'));break;
  }
  case 'favorite':{
   if(!scorePaths().has(val))break;
   state.favorites=state.favorites.includes(val)?state.favorites.filter(p=>p!==val):[...state.favorites,val];
   await setPref('w13:favorites',state.favorites);render();break;
  }
  case 'rep-create':state.modal='rep-name';state.modalRepId=null;render();$('#rep-name-input')?.focus();break;
  case 'rep-back':state.repertoireOpen=null;state.search='';clearAdvancedSearch();render();break;
  case 'rep-open':state.repertoireOpen=el.dataset.id;state.search='';clearAdvancedSearch();render();break;
  case 'rep-rename':state.modalRepId=el.dataset.id;state.modal='rep-name';render();$('#rep-name-input')?.focus();break;
  case 'rep-delete':state.modalRepId=el.dataset.id;state.modal='rep-delete-confirm';render();break;
  case 'rep-save-name':{
   const name=($('#rep-name-input')?.value||'').trim().replace(/\s+/g,' ');
   if(!name||name.length>60){toast(tr('repertoireInvalid'),true);break;}
   if(state.repertoires.some(r=>r.name.toLocaleLowerCase()===name.toLocaleLowerCase()&&r.id!==state.modalRepId)){toast(tr('repertoireExists'),true);break;}
   const r=findRepertoire(state.modalRepId);
   if(r)r.name=name;
   else {
    const uid=typeof crypto.randomUUID==='function'?crypto.randomUUID().replace(/-/g,'').slice(0,24):Date.now().toString(36)+Math.random().toString(36).slice(2);
    const id='rep_'+uid,created={id,name,paths:[]};
    if(state.pickerPath&&scorePaths().has(state.pickerPath))created.paths.push(state.pickerPath);
    state.repertoires.push(created);state.repertoireOpen=id;
   }
   await setPref('w13:repertoires',state.repertoires);
   state.modal=null;state.modalRepId=null;state.pickerPath=null;render();toast(tr('repertoireSaved'));break;
  }
  case 'rep-confirm-delete':{
   state.repertoires=state.repertoires.filter(r=>r.id!==state.modalRepId);
   if(state.repertoireOpen===state.modalRepId)state.repertoireOpen=null;
   state.modalRepId=null;state.modal=null;await setPref('w13:repertoires',state.repertoires);render();toast(tr('repertoireRemoved'));break;
  }
  case 'rep-pick':{
   if(!scorePaths().has(val))break;
   state.pickerPath=val;
   if(state.repertoires.length===1){
    const r=state.repertoires[0];
    if(!r.paths.includes(val)){r.paths.push(val);await setPref('w13:repertoires',state.repertoires);toast(tr('repertoireAdded'));}
    state.pickerPath=null;render();break;
   }
   state.modal=state.repertoires.length?'rep-picker':'rep-name';state.modalRepId=null;
   render();if(state.modal==='rep-name')$('#rep-name-input')?.focus();break;
  }
  case 'rep-choose':{
   const r=findRepertoire(el.dataset.id),path=state.pickerPath;
   if(r&&scorePaths().has(path)&&!r.paths.includes(path)){r.paths.push(path);await setPref('w13:repertoires',state.repertoires);toast(tr('repertoireAdded'));}
   state.pickerPath=null;state.modal=null;render();break;
  }

  case 'rep-add-open':{
    if(!findRepertoire(state.repertoireOpen))break;
    state.repAddSearch='';state.repAddChosen=[];state.modal='rep-add-scores';
    render();$('#rep-add-search')?.focus();break;
  }
  case 'rep-add-toggle':{
    if(state.modal!=='rep-add-scores'||!scorePaths().has(val))break;
    const current=findRepertoire(state.repertoireOpen);
    if(!current||current.paths.includes(val))break;
    state.repAddChosen=state.repAddChosen.includes(val)?state.repAddChosen.filter(p=>p!==val):[...state.repAddChosen,val];
    syncRepAddDialog();break;
  }
  case 'rep-add-confirm':{
    const current=findRepertoire(state.repertoireOpen);
    if(!current||state.modal!=='rep-add-scores')break;
    const known=scorePaths(),existing=new Set(current.paths);
    const newPaths=state.repAddChosen.filter(p=>known.has(p)&&!existing.has(p));
    if(!newPaths.length)break;
    current.paths.push(...newPaths);
    await setPref('w13:repertoires',state.repertoires);
    state.modal=null;state.repAddSearch='';state.repAddChosen=[];
    state.search='';render();toast(`${newPaths.length} ${tr('repAddSuccess')}`);break;
  }
  case 'rep-remove-score':{
   const r=findRepertoire(el.dataset.id);if(!r)break;
   r.paths=r.paths.filter(p=>p!==val);await setPref('w13:repertoires',state.repertoires);render();toast(tr('repertoireRemovedScore'));break;
  }
  case 'rep-up':case 'rep-down':{
   const r=findRepertoire(el.dataset.id);if(!r)break;
   const i=r.paths.indexOf(val),j=i+(action==='rep-up'?-1:1);
   if(i<0||j<0||j>=r.paths.length)break;
   [r.paths[i],r.paths[j]]=[r.paths[j],r.paths[i]];
   await setPref('w13:repertoires',state.repertoires);render();break;
  }
  case 'open':await openPdf(val);break;
  case 'viewer-annotate':{
    if(!scoreViewer||scoreViewer.native||!scoreViewer.page)break;
    state.annotating=!state.annotating;
    scoreViewer.setAnnotationMode(state.annotating);
    if(state.annotating){state.rosetteExpanded=true;state.rosetteLevel='root';state.rosetteLegacy=false;}
    else {state.rosetteExpanded=false;state.rosetteLegacy=false;state.objectMenuOpen=false;}
    clearTimeout(viewerMenuTimer);state.zen=false;render();break;
   }
   case 'annotation-group':if(scoreViewer?.annotationMode&&ANNOTATION_GROUP_TOOLS[val]){
     state.annotationGroup=val;
     const tools=ANNOTATION_GROUP_TOOLS[val];
     if(!tools.some(([id])=>id===scoreViewer.annotationTool))scoreViewer.setAnnotationTool(tools[0][0]);
     render();
   }break;
   case 'annotation-tool':if(scoreViewer?.annotationMode){scoreViewer.setAnnotationTool(val);render();}break;
   case 'annotation-symbol-picker':{
     if(!scoreViewer?.annotationMode)break;
     state.symbolGroup=MUSICAL_SYMBOLS[scoreViewer.musicalSymbol]?.group||'notes';
     state.modal='annotation-symbols';render();break;
   }
   case 'annotation-symbol-group':{
     if(state.modal!=='annotation-symbols'||!SYMBOL_GROUPS.some(g=>g.id===val))break;
     state.symbolGroup=val;render();break;
   }
   case 'annotation-symbol-pick':{
     if(state.modal!=='annotation-symbols'||!scoreViewer?.annotationMode||!isMusicalSymbol(val))break;
     scoreViewer.setMusicalSymbol(val);
     state.modal=null;render();break;
   }
   case 'annotation-symbol-cancel':state.modal=null;render();break;
   case 'annotation-text-edit':{
     const item=scoreViewer?.getSelectedText();
     if(!item||!state.view)break;
     const draft={path:state.view.path,page:scoreViewer.pageNumber,index:item.index,
       point:item.points[0],text:item.text,fontSize:item.fontSize,color:item.color,
       boxWidth:item.boxWidth,boxHeight:item.boxHeight,
       bold:item.bold,italic:!!item.italic,underline:item.underline,
       alignment:item.alignment||'left',backgroundEnabled:!!item.backgroundEnabled,
       borderEnabled:!!item.borderEnabled,opacity:item.opacity};
     if(state.rosetteLegacy){
       state.textDraft=draft;state.modal='annotation-text';render();$('#annotation-text-value')?.focus();
     }else scoreViewer.startInlineTextEditor(draft,{lang:state.lang});
     break;
   }
   case 'annotation-text-cancel':
     scoreViewer?.discardPendingTextBox();
     scoreViewer?.setAnnotationTool('select'); // Text només una vegada.
     state.textDraft=null;state.modal=null;render();break;
   case 'annotation-text-save':{
     const d=state.textDraft;
     if(!d||state.modal!=='annotation-text'||!scoreViewer?.annotationMode||
        d.path!==state.view?.path||d.page!==scoreViewer.pageNumber)break;
     const text=($('#annotation-text-value')?.value||'').replace(/\r\n?/g,'\n').trim();
     if(!text||text.length>280||text.split('\n').length>5){toast(tr('annotationTextError'),true);break;}
     const color=document.querySelector('input[name="annotation-text-color"]:checked')?.value||d.color;
     const done=scoreViewer.saveTextAnnotation({...d,text,
       fontSize:Number($('#annotation-font-size')?.value),
       opacity:Number($('#annotation-text-opacity')?.value),
       color,bold:!!$('#annotation-text-bold')?.checked,
       italic:d.italic,alignment:d.alignment,backgroundEnabled:d.backgroundEnabled,borderEnabled:d.borderEnabled,
       underline:!!$('#annotation-text-underline')?.checked});
     if(done){
       scoreViewer.setAnnotationTool('select');
       scoreViewer.selectedAnnotation=d.index??scoreViewer.annotationsOnPage().length-1;
       scoreViewer.redrawAnnotations();state.textDraft=null;state.modal=null;render();
     }
     break;
   }
   case 'annotation-color':if(scoreViewer?.annotationMode){scoreViewer.setAnnotationColor(val);render();}break;
   case 'annotation-delete-selected':if(scoreViewer?.annotationMode){scoreViewer.deleteSelectedAnnotation();syncViewerControls();}break;
   case 'annotation-undo':scoreViewer?.undoAnnotation();syncViewerControls();break;
   case 'annotation-clear':if(scoreViewer?.hasPageAnnotations()){state.modal='annotation-clear';render();}break;
   case 'annotation-clear-confirm':if(state.modal==='annotation-clear'){scoreViewer?.clearPageAnnotations();state.modal=null;render();}break;
   case 'viewer-close':closeViewer();break;
  case 'viewer-page-prev':await scoreViewer?.turnPage(-1);break;
  case 'viewer-page-next':await scoreViewer?.turnPage(1);break;
  case 'viewer-zoom-in':if(scoreViewer)await scoreViewer.setZoom(scoreViewer.zoom*1.25);break;
  case 'viewer-zoom-out':if(scoreViewer)await scoreViewer.setZoom(scoreViewer.zoom/1.25);break;
  case 'viewer-fit':if(scoreViewer)await scoreViewer.setFit(scoreViewer.fit==='page'?'width':'page');break;
  case 'viewer-rotate':await scoreViewer?.rotate();break;
   case 'viewer-auto-rotate':await scoreViewer?.useAutomaticRotation();break;
  case 'viewer-zen':showViewerMenu(state.annotating?true:state.zen);break;
  case 'viewer-prev':case 'viewer-next':{
    const a=currentCollectionScores(),i=a.findIndex(s=>s.path===state.view?.path),other=a[i+(action==='viewer-prev'?-1:1)];if(other)await openPdf(other.path);break;
  }
  case 'viewer-external':if(state.blobUrl){const anchor=document.createElement('a');anchor.href=state.blobUrl;anchor.target='_blank';anchor.rel='noopener';anchor.click();}break;
  case 'delete-one':state.modal='delete-one';render();break;
  case 'clear':state.modal='clear';render();break;
  case 'close-modal':
    if(state.modal==='annotation-text')scoreViewer?.setAnnotationTool('select');
    scoreViewer?.discardPendingTextBox();state.modal=null;state.textDraft=null;state.metaPath=null;state.modalRepId=null;state.pickerPath=null;state.repAddSearch='';state.repAddChosen=[];state.restore=null;render();break;
  case 'confirm-delete-one':{
    const path=state.view?.path;if(path)await deleteScore(path);
    state.scores=await getAllScores();await reloadCollections();await persistCollections();state.modal=null;closeViewer();updateStorageInfo();toast(tr('removed'));break;
  }
  case 'confirm-clear':await clearScores();state.scores=[];state.favorites=[];state.recents=[];state.repertoires=[];state.repertoireOpen=null;await persistCollections();state.paper='root';state.cwd=[];await setPref('paper','root');state.modal=null;if(state.view)closeViewer();else closeViewerIfNeeded();render();updateStorageInfo();toast(tr('allRemoved'));break;
  case 'welcome-done':state.modal=null;await setPref('lang',state.lang);render();break;
 }
}
function closeViewerIfNeeded(keepLandscape=false){
 if(!keepLandscape)releaseViewerLandscape();
 setReadingColors(false);
 scoreViewer?.close();scoreViewer=null;
 state.annotating=false;state.rosetteExpanded=false;state.rosetteLegacy=false;
 if(state.modal==='annotation-text'||state.modal==='annotation-symbols')state.modal=null;
 state.textDraft=null;
 if(state.blobUrl){URL.revokeObjectURL(state.blobUrl);state.blobUrl=null;}
 state.view=null;state.zen=false;
}
async function init(){
 try{
  await openDB();
  const configured=await getPref('lang');
   tuner.setReference(await getPref('tunerReferenceHz',442));
   referenceTone.setReference(tuner.reference);
   dictation.setReference(tuner.reference);
   dictation.setInstrument(await getPref('dictationInstrument','CONCERT_TREBLE'),{clear:false,save:false,notify:false});
  state.lang=configured==='es'?'es':'va';
  state.scores=await getAllScores();
   await reloadCollections();
  state.paper=await getPref('paper','root');
  const savedGroup=await getPref('w13c:indexGroupBy','folder'),savedSort=await getPref('w13c:indexSortBy','title');
  state.indexGroupBy=INDEX_GROUP_MODES.includes(savedGroup)?savedGroup:'folder';
  state.indexSortBy=INDEX_SORT_MODES.includes(savedSort)?savedSort:'title';
  const papers=paperRoots();
  if(state.paper!=='root'&&!papers.includes(state.paper))state.paper=papers[0]||'root';
  if(state.paper==='root'&&papers.length&&!(await getPref('paper')))state.paper=papers[0];
  const savedLocation=validateNavigation(readNavigation(navigationStorage),{
   scores:state.scores,repertoires:state.repertoires,paper:state.paper
  });
  if(savedLocation){
   state.page=savedLocation.page;
   state.cwd=savedLocation.cwd;
   state.repertoireOpen=savedLocation.repertoireId;
   lastContentScrollY=savedLocation.scrollY;
  }
  if(configured!=='es'&&configured!=='va')state.modal='welcome';
  const isExplicitReload=performance.getEntriesByType?.('navigation')?.[0]?.type==='reload';
  const willRestore=!!(isExplicitReload&&savedLocation?.view&&!state.modal);
  prepareViewerHistory(willRestore);
  render();
  navigationReady=true;
  // Actualitzar amb el navegador conserva la partitura. Una nova obertura
  // de l'app no reobri el PDF ni manté el lector en segon pla.
  if(willRestore){
   try{await openPdf(savedLocation.view.path,savedLocation.view.page);}
   catch(err){
    console.warn('No s’ha pogut recuperar el visor anterior:',err);
    closeViewerIfNeeded();render();
   }
  }else if(lastContentScrollY>0){
   const y=lastContentScrollY;
   requestAnimationFrame(()=>{if(!state.view)window.scrollTo(0,y);});
  }
  updateStorageInfo();
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
   navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>console.warn('Service worker:',e));
  }
  if(navigator.storage?.persist){ // iOS pot ignorar la petició. No prometem persistència.
   navigator.storage.persist().catch(()=>{});
  }
 }catch(e){console.error(e);$('#app').innerHTML=`<div class="empty"><h3>Partitures Festeres</h3><p>${esc(L.va.errorStorage)}: ${esc(e.message)}</p></div>`;}
}
document.addEventListener('keydown',e=>{
 if(!state.view||!scoreViewer||state.modal||e.target?.matches('input,textarea,select,[contenteditable]'))return;
 let used=true;
 switch(e.key){
  case 'Escape':
   if(state.annotating&&state.rosetteExpanded){
    const parent=rosetteParent(state.rosetteLevel);
    if(parent)state.rosetteLevel=parent;
    else state.rosetteExpanded=false;
    render();
   }else closeViewer();break;
  case 'ArrowRight':case 'PageDown': scoreViewer.turnPage(1);break;
  case 'ArrowLeft':case 'PageUp': scoreViewer.turnPage(-1);break;
  case '+':case '=': scoreViewer.setZoom(scoreViewer.zoom*1.25);break;
  case '-': scoreViewer.setZoom(scoreViewer.zoom/1.25);break;
  case '0': scoreViewer.setZoom(1);break;
  case 'r':case 'R': scoreViewer.rotate();break;
  case 'f':case 'F': scoreViewer.setFit(scoreViewer.fit==='page'?'width':'page');break;
  case ' ': showViewerMenu(state.zen);break;
  default: used=false;
 }
 if(used)e.preventDefault();
});
let rosetteDragging=null;
document.addEventListener('pointerdown',e=>{
 const core=e.target.closest?.('.pf-rosette-core');
 const root=core?.closest('.pf-reading-mode');
 if(!core||!root||!state.annotating)return;
 const mapped=clientToViewerPoint(e.clientX,e.clientY,root.getBoundingClientRect(),isViewerCssRotated(root));
 const width=root.clientWidth,height=root.clientHeight;
 rosetteDragging={id:e.pointerId,core,root,width,height,
  pointer:mapped,start:{x:state.rosetteX*width,y:state.rosetteY*height},moved:false};
 try{core.setPointerCapture(e.pointerId);}catch{}
 e.stopPropagation();
});
document.addEventListener('pointermove',e=>{
 const g=rosetteDragging;
 if(!g||g.id!==e.pointerId)return;
 const point=clientToViewerPoint(e.clientX,e.clientY,g.root.getBoundingClientRect(),isViewerCssRotated(g.root));
 const dx=point.x-g.pointer.x,dy=point.y-g.pointer.y;
 if(Math.hypot(dx,dy)>7)g.moved=true;
 if(!g.moved)return;
 const c=clampRosetteCenter(g.start.x+dx,g.start.y+dy,g.width,g.height,state.rosetteExpanded);
 const node=g.core.closest('.pf-rosette');
 if(node){node.style.left=c.x+'px';node.style.top=c.y+'px';}
 e.preventDefault();
});
function endRosetteDrag(e){
 const g=rosetteDragging;
 if(!g||g.id!==e.pointerId)return;
 rosetteDragging=null;
 if(!g.moved)return;
 const point=clientToViewerPoint(e.clientX,e.clientY,g.root.getBoundingClientRect(),isViewerCssRotated(g.root));
 const c=clampRosetteCenter(g.start.x+point.x-g.pointer.x,g.start.y+point.y-g.pointer.y,
  g.width,g.height,state.rosetteExpanded);
 state.rosetteX=c.x/g.width;state.rosetteY=c.y/g.height;
 rosetteIgnoreClickUntil=Date.now()+400;
 render();
}
document.addEventListener('pointerup',endRosetteDrag);
document.addEventListener('pointercancel',e=>{if(rosetteDragging?.id===e.pointerId)rosetteDragging=null;});
document.addEventListener('dblclick',e=>{
 // El doble toc correspon exclusivament a ScoreViewer.pointerUp.
 if(e.target.closest?.('#viewer-stage')&&!e.target.closest?.('.pf-inline-text-editor'))e.preventDefault();
});

document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){e.preventDefault();handleClick(b).catch(err=>{console.error(err);toast(`${tr('error')} ${err.message}`,true);});}});
document.addEventListener('input',e=>{
 if(e.target?.dataset?.advField){
   const key=e.target.dataset.advField;
   if(!['composer','type','yearFrom','yearTo'].includes(key))return;
   const source=e.target,position=source.selectionStart;
   state.advanced[key]=key==='yearFrom'||key==='yearTo'?source.value.replace(/\D/g,'').slice(0,4):source.value;
   render();const target=$('[data-adv-field="'+key+'"]');
   target?.focus();try{target?.setSelectionRange(position,position);}catch{}
   return;
 }
 if(state.page==='add'&&e.target.id==='scan-name'){scanner.updateField('scan-name',e.target.value);return;}
 if(e.target.id==='rep-add-search'){state.repAddSearch=e.target.value;const results=$('#rep-add-results');if(results)results.scrollTop=0;syncRepAddDialog();return;}
 if(e.target.id==='search-input'){
  const focus=e.target,sel=focus.selectionStart;state.search=focus.value;
  render();const newInput=$('#search-input');newInput?.focus();try{newInput?.setSelectionRange(sel,sel);}catch{}
 }
});
document.addEventListener('input',e=>{
 if(e.target.id==='metro-bpm'&&state.page==='tools'&&state.toolTab==='metronome'&&!state.view)metronome.updateBpm(e.target.value,{commit:false});
  if(e.target.id==='tuner-reference'&&state.page==='tools'&&state.toolTab==='tuner'&&!state.view)tuner.setReference(e.target.value);
});
document.addEventListener('change',e=>{
 if(state.page==='add'){
  if(e.target.id==='scan-camera-input'||e.target.id==='scan-gallery-input'){
   scanner.addImages(e.target.files);e.target.value='';return;
  }
  if(e.target.dataset?.scanFilter){
   scanner.setFilter(e.target.dataset.scanFilter,e.target.value);return;
  }
  if(['scan-folder','scan-rep'].includes(e.target.id)){
   scanner.updateField(e.target.id,e.target.value);return;
  }
  if(e.target.id==='scan-to-rep'){scanner.updateField('scan-to-rep',e.target.checked);return;}
 }
 if(e.target.id==='metro-bpm'&&state.page==='tools'&&state.toolTab==='metronome'&&!state.view)metronome.updateBpm(e.target.value,{commit:true});
  if(e.target.id==='tuner-reference'&&state.page==='tools'&&state.toolTab==='tuner'&&!state.view)tuner.setReference(e.target.value,{save:true});
   if(e.target.id==='dictation-instrument'&&state.page==='tools'&&state.toolTab==='dictation'&&!state.view)dictation.setInstrument(e.target.value);
 if(e.target.id==='index-group-by'&&INDEX_GROUP_MODES.includes(e.target.value)){
  state.indexGroupBy=e.target.value;state.indexCollapsed.clear();
  setPref('w13c:indexGroupBy',state.indexGroupBy).catch(err=>console.warn(err));render();
 }
 if(e.target.id==='index-sort-by'&&INDEX_SORT_MODES.includes(e.target.value)){
  state.indexSortBy=e.target.value;
  setPref('w13c:indexSortBy',state.indexSortBy).catch(err=>console.warn(err));render();
 }
 if(e.target.id==='annotation-width'&&scoreViewer?.annotationMode){scoreViewer.setAnnotationThickness(e.target.value);render();}
 if(e.target.id==='annotation-symbol-size'&&scoreViewer?.annotationMode){scoreViewer.setMusicalSymbolSize(e.target.value);render();}
  if(e.target.id==='import-input')importSelected([...e.target.files]);
 if(e.target.id==='restore-input')chooseRestoreFile(e.target.files?.[0]);
 if(e.target.name==='welcome-lang'){state.lang=e.target.value;render();}
 if(e.target.id==='language-select'){state.lang=e.target.value;setPref('lang',state.lang).then(()=>{render();toast(tr('saved'));});}
});
window.addEventListener('online',()=>{state.online=true;if(state.page==='settings'&&!state.view)render();});
// En Android, Enrere des de fullscreen pot eixir només de pantalla completa
// sense emetre popstate. Tornem al menú i consumim només l'entrada del PDF.
// Si també hi ha popstate, el comprovem abans de navegar per a no retrocedir dues vegades.
document.addEventListener('fullscreenchange',()=>{
 if(document.fullscreenElement||!viewerFullscreenOwned||!(state.view||viewerPendingOpen))return;
 // El teclat virtual pot traure el navegador de fullscreen: no tanquem el PDF.
 if(scoreViewer?.inlineSession){viewerFullscreenOwned=false;return;}
 viewerFullscreenOwned=false;
 clearTimeout(fullscreenExitTimer);
 fullscreenExitTimer=setTimeout(()=>{
  if(state.view||viewerPendingOpen){
   if(hasViewerHistory())closeViewer();
   else closeViewer(false);
  }
 },140);
});
window.addEventListener('popstate',()=>{
 if(!hasViewerHistory()&&(state.view||viewerPendingOpen))closeViewer(false);
});
window.addEventListener('pagehide',()=>{
   metronome.stop({release:true,notify:false});
   tuner.stop({notify:false});
   referenceTone.stop({notify:false});
   dictation.stop({notify:false});
  // Guardar ubicació abans de destruir el visor. Funciona amb la recàrrega.
  if(state.view?.path&&scoreViewer)state.view.page=scoreViewer.pageNumber;
  if(!state.view)lastContentScrollY=window.scrollY||0;
  rememberNavigation();
  closeViewerIfNeeded(); // cancel·la renders, PDF.js, listeners, workers i URLs.
  clearTimeout(viewerMenuTimer);
  if(state.backup?.url){URL.revokeObjectURL(state.backup.url);state.backup=null;}
 });
 window.addEventListener('pageshow',event=>{
  // Torna de la memòria cache del navegador sense tornar a executar init().
  if(event.persisted&&!state.view)render();
 });
 let scrollTimer=0;
 window.addEventListener('scroll',()=>{
  if(state.view)return;
  clearTimeout(scrollTimer);
  scrollTimer=setTimeout(rememberScroll,120);
 },{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(metronome.running||metronome.pending)metronome.stop();if(tuner.running||tuner.pending)tuner.stop();if(referenceTone.running||referenceTone.pending)referenceTone.stop();if(dictation.running||dictation.pending)dictation.stop();}});
window.addEventListener('offline',()=>{state.online=false;if(state.page==='settings'&&!state.view)render();});
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented)return; // Evita una segona navegació o eixida del visor.
 if(e.key==='Escape'&&state.modal&&state.modal!=='welcome'){scoreViewer?.discardPendingTextBox();state.modal=null;state.textDraft=null;render();}
 else if(e.key==='Escape'&&state.view)closeViewer();
 else if(e.key==='ArrowRight'&&state.view){scoreViewer?.turnPage(1);}
 else if(e.key==='ArrowLeft'&&state.view){scoreViewer?.turnPage(-1);}
 else if(e.key==='+'&&state.view){scoreViewer?.setZoom(scoreViewer.zoom+.2);}
 else if(e.key==='-'&&state.view){scoreViewer?.setZoom(scoreViewer.zoom-.2);}
});
init();