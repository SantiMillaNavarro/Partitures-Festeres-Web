import {openDB, getAllScores, getScore, saveBatch, setScoreMetadata, deleteScore, clearScores, getPref, setPref, getAnnotations, setAnnotations, moveScoreSafely, moveLinkedScoreData} from './db.js';
import {normalizeScoreMetadata, scoreDisplayTitle, hasScoreMetadata} from './metadata.js';
import {BACKUP_MANIFEST, createBackup, inspectBackup, restoreBackup} from './backup.js';
import {createLinkedDataBackup,inspectLinkedDataBackup,linkedBackupMatch,restoreLinkedDataBackup} from './linked-backup-w224.js';
import {ScoreViewer} from './viewer-w219.js';
import {DriveBrowser} from './drive-ui-w221.js';
import {availableDrivePath} from './drive-w221.js';
import {LinkedLocalLibrary,linkSupported,validateLinkedPath} from './linked-library-w222a.js';
import {renderSourceControls} from './library-source-ui-w223.js';
import {PAPER_ROLE_KEY,defaultPaperRoles,normalizePaperRoles,allFolderPaths,paperAssignments,roleKey,roleNumber,paperLabel,activePaperBase,resolvePaper,assignPaper,addPaperRole,removePaperRole,migrateOldPapers,scopedPaperScores,paperRelativePath,findRole} from './paper-roles-w220.js';
import {renderPaperSetup,renderPaperHelp,renderPaperRemove,renderPaperFolderChoices} from './paper-role-ui-w220.js';
import {PageRepairDialog} from './page-repair-ui-w218.js';
import {PAGE_ADJUSTMENT_KEY,normalizePageAdjustments} from './page-adjustments-w218.js';
import {VIEWER_SETTINGS_KEY,VIEWER_SETTINGS_DEFAULTS,normalizeViewerSettings,renderViewerSettings,updateViewerSettingsPreview,brightnessShadeOpacity,ViewerWakeManager} from './viewer-advanced-settings-w216.js';
import {ANNOTATION_COLORS,TEXT_SIZES,TEXT_OPACITIES} from './annotations.js';
import {MUSICAL_SYMBOLS,SYMBOL_GROUPS,SYMBOL_SIZES,isMusicalSymbol,musicalSymbolIcon} from './musical-symbols.js';
import {blankAdvancedFilters,countAdvancedFilters,matchesScoreSearch} from './search-filters.js';
import {INDEX_GROUP_MODES,INDEX_SORT_MODES,buildIndexGroups} from './index-groups.js';
import {readNavigation,writeNavigation,validateNavigation,snapshotNavigation} from './navigation-state.js';
import {rosetteOptions,rosetteParent,rosettePetalPosition,clampRosetteCenter,ROSETTE_ROOT} from './rosette-w219.js';
import {clientToViewerPoint,isViewerCssRotated} from './viewer-orientation.js';
import {renderRosetteMarkup} from './rosette-ui-w219.js';
import {MetronomeController} from './metronome-controller-w210.js';
import {TunerController} from './tuner-controller-w210.js';
import {ReferenceToneController} from './reference-tone-controller-w211.js';
import {DictationController} from './dictation-controller-w2122.js';
import {ScannerController} from './scanner-controller-w2133.js';
import {ScanCropEditor} from './scanner-crop-editor-w2133.js';
import {DocumentCamera} from './scanner-camera-w2132.js';
import {uniqueScanPath} from './scanner-pdf-w2131.js';
import {PdfThumbnailController} from './pdf-thumbnails-w2143.js';
import {targetScorePath,scoreFolder} from './score-organize-w2141.js';
import {renderOrganizeModal,updateOrganizePreview} from './score-organize-ui-w2141.js';
import {duplicatedRepertoire,buildPerformanceSession,performanceStep,performancePosition} from './repertoire-performance-w2151.js';
import {ViewerScorePicker} from './viewer-score-picker-w2152.js';

// Font única de la versió visible tant en Ajustos com al peu de la navegació.
const APP_VERSION='W2.25';

const I = {
  copy:'<svg viewBox="0 0 24 24"><rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 16H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"/></svg>',
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
  repair:'<svg viewBox="0 0 24 24"><path d="M3 3v18h18M7 2v5H2M22 17h-5v5M7 7h10v10H7z"/></svg>',
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
const state={source:'imported',autoCheck:true,lang:'va',page:'library',paper:'root',paperConfig:defaultPaperRoles(),paperMigrationPending:false,paperEditRole:null,paperFolderSearch:'',paperRemoveRole:null,cwd:[],scores:[],search:'',view:null,blobUrl:null,modal:null,toastTimer:null,loading:false,online:navigator.onLine,storage:null,backup:null,restore:null,restoreTargetId:null,zen:false,favorites:[],recents:[],repertoires:[],repertoireOpen:null,performance:null,modalRepId:null,pickerPath:null,repAddSearch:'',repAddChosen:[],metaPath:null,organizePath:null,organizeBusy:false,thumbnailEnabled:true,viewerSettings:normalizeViewerSettings(),viewerSettingsDraft:null,annotating:false,advanced:blankAdvancedFilters(),advancedOpen:false,indexGroupBy:'folder',indexSortBy:'title',indexCollapsed:new Set(),annotationGroup:'strokes',symbolGroup:'notes',textDraft:null,rosetteExpanded:false,rosetteLevel:'root',rosetteLegacy:false,rosetteX:.5,rosetteY:.56,rosetteSymbolPage:0,objectMenuOpen:false,toolTab:'metronome'};
const linkedLocal=new LinkedLocalLibrary();
const linkedMode=()=>state.source==='linked'&&linkedLocal.exists;
const libPrefKey=key=>linkedMode()?'w222a:lib:'+linkedLocal.id+':'+key:key;
const getLibraryPref=(key,defaultValue)=>getPref(libPrefKey(key),defaultValue);
const setLibraryPref=(key,value)=>setPref(libPrefKey(key),value);
const scoreDataPath=path=>linkedMode()?'w222a-linked-'+linkedLocal.id+'/'+path:path;
const readActiveScore=path=>linkedMode()?linkedLocal.getScore(path):getScore(path);
const readActiveViewerPref=(key,defaultValue)=>getPref(linkedMode()?'w222a:'+linkedLocal.id+':'+key:key,defaultValue);
const writeActiveViewerPref=(key,value)=>setPref(linkedMode()?'w222a:'+linkedLocal.id+':'+key:key,value);
async function activeScoreIndex(){
 if(!linkedMode())return getAllScores();
 const metadata=await getPref('w222a:metadata:'+linkedLocal.id,{});
 return linkedLocal.scores.map(s=>({...s,...(metadata?.[s.path]?{metadata:normalizeScoreMetadata(metadata[s.path])}:{})}));
}
async function updateLinkedMetadata(path,metadata){
 const key='w222a:metadata:'+linkedLocal.id;
 const saved=await getPref(key,{});
 const next={...(saved&&typeof saved==='object'?saved:{})};
 if(Object.keys(metadata).length)next[path]=metadata;else delete next[path];
 await setPref(key,next);
}
async function activateLibrarySource(source,{save=true}={}){
 if(source==='linked'&&!linkedLocal.exists)throw Error('Cal seleccionar una carpeta abans.');
 if(state.view||viewerPendingOpen)throw Error('Tanca primer el visor PDF.');
 await annotationSaveQueue.catch(()=>{});
 await pageAdjustmentsQueue.catch(()=>{});
 await viewerPreferencesQueue.catch(()=>{});
 if(state.backup?.url)URL.revokeObjectURL(state.backup.url);
 state.backup=null;
 pdfThumbnails.clear();state.source=source;
 if(save)await setPref('w222a:source',source);
 state.scores=await activeScoreIndex();
 state.paper='root';state.cwd=[];state.search='';clearAdvancedSearch();
 state.indexCollapsed.clear();state.repertoireOpen=null;state.performance=null;
 await reloadCollections();
 await loadPaperConfig();
 const group=await getLibraryPref('w13c:indexGroupBy','folder');
 const order=await getLibraryPref('w13c:indexSortBy','title');
 state.indexGroupBy=INDEX_GROUP_MODES.includes(group)?group:'folder';
 state.indexSortBy=INDEX_SORT_MODES.includes(order)?order:'title';
 state.page='library';
 pdfThumbnails.resume();
 render();updateStorageInfo();
}
// W2.23A: actualització oportunista en obrir o tornar a la web.
const AUTOMATIC_CHECK_GAP_MS=60_000;
let lastCheckStartedAt=0,autoCheckTimer=null,autoCheckBusy=false;
function scheduleAutoCheck(){
 if(!state.autoCheck||!linkedMode()||!linkedLocal.ready||linkedLocal.offlineBusy||document.hidden)return;
 if(autoCheckBusy||autoCheckTimer||Date.now()-lastCheckStartedAt<AUTOMATIC_CHECK_GAP_MS)return;
 lastCheckStartedAt=Date.now();
 autoCheckTimer=setTimeout(()=>{
  autoCheckTimer=null;
  void checkLibraryInBackground();
 },500);
}
async function checkLibraryInBackground(){
 if(autoCheckBusy||!state.autoCheck||!linkedMode()||linkedLocal.offlineBusy||document.hidden)return;
 autoCheckBusy=true;
 try{
  const libraryId=linkedLocal.id;
  const result=await linkedLocal.checkForChanges();
  if(result?.changed&&linkedMode()&&linkedLocal.id===libraryId){
   state.scores=await activeScoreIndex();
   // Preservar preferències en cas de permís denegat: checkForChanges
   // mai retorna "changed" quan no pot llegir la carpeta.
   await reloadCollections();
   validPaperSelection();
   if(!state.view&&!state.modal){
    const y=window.scrollY||0;
    render();
    if(y)window.scrollTo(0,y);
   }
  }else if(result?.unavailable&&linkedMode()&&linkedLocal.id===libraryId&&
    (state.page==='library'||state.page==='settings')&&!state.view&&!state.modal){
   // El navegador pot exigir un clic per renovar la lectura. Oferim eixe
   // clic des de Biblioteca, sense enviar l'usuari a Ajustos ni copiar PDF.
   const y=window.scrollY||0;
   render();
   if(y)window.scrollTo(0,y);
  }else if(state.page==='settings'&&!state.view&&!state.modal){
   render();
  }
 }catch(error){
  // No tallar mai l'ús de les partitures per una comprovació automàtica.
  console.warn('Comprovació automàtica de Biblioteca:',error);
 }finally{
  autoCheckBusy=false;
  // Sense canvis, no reconstruir la pantalla: evita salts de scroll i
  // miniatures reiniciades durant la navegació.
 }
}
let scoreViewer=null;
let pageRepairDialog=null;
let pageAdjustmentsQueue=Promise.resolve();
const pdfThumbnails=new PdfThumbnailController({readScore:readActiveScore,readPref:readActiveViewerPref});
const driveBrowser=new DriveBrowser({
 getPref,setPref,getAllScores,saveBatch,
 onChange:()=>{if(state.modal==='drive-browser')render();},
 onImported:async path=>{
  if(state.backup?.url)URL.revokeObjectURL(state.backup.url);
  state.backup=null;
  if(state.source==='imported'){
   state.scores=await activeScoreIndex();
   await autoMigratePaperAfterImport();
   await reloadCollections();
  }
  updateStorageInfo();
  toast((state.lang==='es'?'PDF descargado: ':'PDF baixat: ')+path);
 }
});
const viewerWakeLock=new ViewerWakeManager();
const viewerScorePicker=new ViewerScorePicker({
 onSelect:async path=>{
  if(!state.view||!viewerScoreRecords().some(score=>score.path===path))
   throw new Error(state.lang==='es'?'Partitura no disponible.':'Partitura no disponible.');
  await openPdf(path,1); // Android: saltar sempre a la primera pàgina.
 },
 onWarning:message=>toast(message,true)
});
window.addEventListener('pagehide',()=>viewerScorePicker.close({restoreFocus:false,historyBack:false}));
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
 onSaved:async({path,blob,repertoireId,pageCount,newFolder=false})=>{
  // Última comprovació contra l'IndexedDB real, per a no sobreescriure un PDF
  // que haja aparegut mentre processàvem les fotografies.
  let unique;
  if(linkedMode())unique=await linkedLocal.addPdf(path,blob,{newFolder});
  else{
   const existing=await getAllScores();
   unique=uniqueScanPath(path,new Set(existing.map(s=>s.path)));
   await saveBatch([{path:unique,blob,size:blob.size,added:Date.now()}]);
  }
  if(repertoireId){
   const rep=state.repertoires.find(r=>r.id===repertoireId);
   if(rep&&!rep.paths.includes(unique)){
    rep.paths.push(unique);
    try{await setLibraryPref('w13:repertoires',state.repertoires);}
    catch(err){console.warn('Repertori escàner:',err);toast(
     state.lang==='es'?'La partitura está guardada, pero no se ha añadido al repertorio.':
     'La partitura està guardada, però no s’ha afegit al repertori.',true);}
   }
  }
  if(state.backup?.url)URL.revokeObjectURL(state.backup.url);
  state.backup=null;
  state.scores=await activeScoreIndex();
  state.search='';state.advanced=blankAdvancedFilters();state.advancedOpen=false;
  const folder=unique.includes('/')?unique.slice(0,unique.lastIndexOf('/')):'';
  await autoMigratePaperAfterImport();
  setPaperCwdForFolder(folder);
  await setLibraryPref('paper',state.paper);
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
  const saved=viewerPreferencesQueue.catch(()=>{}).then(()=>writeActiveViewerPref('viewer:'+path,value));
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
 // W2.17: No sol·licitar mai requestFullscreen() en obrir una partitura.
 // Chrome/Android mostra un avís del navegador que tapa la partitura.
 // Provem el bloqueig natiu directament i, si requerix pantalla completa,
 // utilitzem la rotació CSS existent, sense cap avís ni canvi de pantalla.
 if(!state.viewerSettings.allowViewerRotation)return;
 if(!window.matchMedia?.('(pointer:coarse)').matches)return;
 const orientation=screen.orientation;
 if(!orientation||typeof orientation.lock!=='function'){
  setViewerCssFallback(true);return;
 }
 let attempt;
 try{attempt=orientation.lock('landscape-primary');}
 catch{if(token===viewerOrientationToken)setViewerCssFallback(true);return;}
 Promise.resolve(attempt).then(()=>{
  if(token!==viewerOrientationToken){
   try{orientation.unlock?.();}catch{}
   return;
  }
  viewerOrientationLocked=true;
  setViewerCssFallback(false);
 }).catch(()=>{
  if(token===viewerOrientationToken)setViewerCssFallback(true);
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
 const linkedLibraryId=linkedMode()?linkedLocal.id:null;
 const write=annotationSaveQueue.catch(()=>{}).then(()=>setAnnotations(path,document,{linkedLibraryId}));
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
function paperFolders(){
 const set=new Set(allFolderPaths(state.scores));
 if(linkedMode()&&linkedLocal.ready)for(const f of linkedLocal.folders)set.add(f);
 return [...set].sort((a,b)=>a.split('/').length-b.split('/').length||sort(a,b));
}
function selectedPaperBase(){return activePaperBase(state.paperConfig,state.paper);}
function validPaperSelection(){state.paper=resolvePaper(state.paperConfig,state.paper,paperFolders());}
async function storePaperConfig(){
 state.paperConfig=normalizePaperRoles(state.paperConfig);
 state.paperMigrationPending=false;
 await setLibraryPref(PAPER_ROLE_KEY,state.paperConfig);
}
async function loadPaperConfig(){
 const saved=await getLibraryPref(PAPER_ROLE_KEY,null);
 const old=await getLibraryPref('paper','root');
 if(linkedMode()&&!linkedLocal.ready){
  state.paperConfig=normalizePaperRoles(saved);
  state.paper='root';return;
 }
 if(saved){
  state.paperConfig=normalizePaperRoles(saved);
  state.paperMigrationPending=false;
  state.paper=resolvePaper(state.paperConfig,old||'root',paperFolders());
 }else{
  const migrated=migrateOldPapers(state.scores,old);
  state.paperConfig=migrated.config;
  state.paper=resolvePaper(state.paperConfig,migrated.active,paperFolders());
  state.paperMigrationPending=!state.scores.length;
  if(state.scores.length)await storePaperConfig();
 }
 await setLibraryPref('paper',state.paper);
}
async function autoMigratePaperAfterImport(){
 if(state.paperMigrationPending){
  const migrated=migrateOldPapers(state.scores,state.paper);
  state.paperConfig=migrated.config;
  state.paper=resolvePaper(state.paperConfig,migrated.active,paperFolders());
  await storePaperConfig();
 }else validPaperSelection();
 await setLibraryPref('paper',state.paper);
}
function scopedScores(){return scopedPaperScores(fileList(),state.paperConfig,state.paper);}
function currentBase(){return [selectedPaperBase(),...state.cwd].filter(Boolean).join('/');}
function relativePath(path){return paperRelativePath(path,state.paperConfig,state.paper);}
function setPaperCwdForFolder(folder){
 const base=selectedPaperBase();
 if(state.paper!=='root'&&!(folder===base||folder.startsWith(base+'/'))){
  state.paper='root';state.cwd=folder?folder.split('/').filter(Boolean):[];
 }else{
  const relative=base?(folder===base?'':folder.slice(base.length+1)):folder;
  state.cwd=relative?relative.split('/').filter(Boolean):[];
 }
}

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
function setPage(page){if(state.page==='add'&&page!=='add'&&scanner.busy){toast(state.lang==='es'?'Se está guardando el PDF.':'S’està guardant el PDF.');return;}if(state.page==='tools'&&page!=='tools'){metronome.stop({release:true,notify:false});tuner.stop({notify:false});referenceTone.stop({notify:false});dictation.stop({notify:false});}if(state.page==='add'&&page!=='add'){cropEditor.close();documentCamera.close();scanner.cancel();}state.page=page;state.search='';clearAdvancedSearch();state.cwd=[];state.view=null;pdfThumbnails.resume();render();}
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
 if(linkedMode()&&!linkedLocal.ready){
  state.favorites=[];state.recents=[];state.repertoires=[];return;
 }
 state.favorites=keepExisting(await getLibraryPref('w13:favorites',[]));
 state.recents=keepExisting(await getLibraryPref('w13:recents',[])).slice(0,45);
 state.repertoires=cleanRepertoires(await getLibraryPref('w13:repertoires',[]));
 if(state.repertoireOpen&&!state.repertoires.some(r=>r.id===state.repertoireOpen))state.repertoireOpen=null;
}
async function persistCollections(){
 await Promise.all([setLibraryPref('w13:favorites',state.favorites),setLibraryPref('w13:recents',state.recents),setLibraryPref('w13:repertoires',state.repertoires)]);
}
const findRepertoire=id=>state.repertoires.find(r=>r.id===id);
const paperMatches=path=>state.paper==='root'||path.startsWith(selectedPaperBase()+'/');
function currentCollectionScores(){
 const records=new Map(state.scores.map(s=>[s.path,s]));
 const collection=state.page==='favorites'?state.favorites:state.page==='recents'?state.recents:
  state.page==='repertoires'&&state.repertoireOpen?(findRepertoire(state.repertoireOpen)?.paths||[]):null;
 if(collection)return collection.filter(p=>records.has(p)&&(state.page==='repertoires'||paperMatches(p))).map(p=>records.get(p));
 return scopedScores();
}
function viewerScoreRecords(){
 if(state.performance){
  const byPath=new Map(state.scores.map(score=>[score.path,score]));
  return state.performance.paths.map(path=>byPath.get(path)).filter(Boolean);
 }
 return currentCollectionScores();
}
async function startPerformance(repertoireId,startPath=null){
 const rep=findRepertoire(repertoireId);
 const session=buildPerformanceSession(rep,scorePaths(),startPath);
 if(!session){toast(state.lang==='es'?'El repertorio no contiene partituras disponibles.':'El repertori no conté partitures disponibles.',true);return;}
 state.performance=session;
 try{await openPdf(session.current,1);}
 catch(error){state.performance=null;throw error;}
}
async function changeViewerScore(direction){
 if(!state.view)return;
 if(state.performance){
  const step=performanceStep(state.performance,state.view.path,direction);
  if(step)await openPdf(step.path,step.start==='last'?Number.MAX_SAFE_INTEGER:1);
  return;
 }
 const records=currentCollectionScores();
 const index=records.findIndex(score=>score.path===state.view.path);
 const target=records[index+direction];
 if(index>=0&&target)await openPdf(target.path,direction<0?Number.MAX_SAFE_INTEGER:1);
}
function thumbnailMarkup(score,variant='row'){
  const klass=variant==='index'?'pf-index-thumb':'entry-ico pdf pf-thumb-frame';
  const size=Number.isFinite(score.size)?score.size:0;
  const added=Number.isFinite(score.added)?score.added:0;
  return `<span class="${klass}" data-pf-thumb="${esc(score.path)}" data-thumb-size="${size}" data-thumb-added="${added}" aria-hidden="true">${icon('file')}</span>`;
}
function htmlScoreRow(score,{note='',repertoireId=null,reorder=0,count=0}={}){
 const favorite=state.favorites.includes(score.path),label=tr(favorite?'removeFavorite':'addFavorite');
 const title=scoreDisplayTitle(score),original=nice(parts(score.path).at(-1));
 const extra=[score.metadata?.title?original:(note||bytes(score.size)),score.metadata?.composer,score.metadata?.type,score.metadata?.year].filter(Boolean).join(' · ');
 return `<div class="score-row">
  ${repertoireId!==null?`<span class="repertoire-order"><button data-action="rep-up" data-id="${esc(repertoireId)}" data-value="${esc(score.path)}" title="${esc(tr('moveUp'))}" aria-label="${esc(tr('moveUp'))}" ${reorder===0?'disabled':''}>${icon('up')}</button><button data-action="rep-down" data-id="${esc(repertoireId)}" data-value="${esc(score.path)}" title="${esc(tr('moveDown'))}" aria-label="${esc(tr('moveDown'))}" ${reorder===count-1?'disabled':''}>${icon('down')}</button></span>`:''}
  <button class="entry" data-action="open" data-value="${esc(score.path)}"><span class="pf-thumbnail-anchor">${thumbnailMarkup(score)}</span><span class="entry-text"><span class="entry-title">${esc(title)}</span><span class="entry-note">${esc(extra)}</span></span></button>
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
  block+=`<div class="panel rep-head"><h3>${esc(current.name)}</h3><div class="rep-actions"><button class="primary" data-action="rep-start" data-id="${esc(current.id)}" ${all.length?'':'disabled'}>${icon('next')}${state.lang==='es'?'Iniciar actuación':'Iniciar actuació'}</button><button class="primary" data-action="rep-add-open">${icon('plus')}${esc(tr('repAddOpen'))}</button><button class="secondary" data-action="rep-rename" data-id="${esc(current.id)}">${esc(tr('renameRepertoire'))}</button><button class="secondary" data-action="rep-duplicate" data-id="${esc(current.id)}">${icon('copy')}${state.lang==='es'?'Duplicar':'Duplicar'}</button><button class="secondary" data-action="rep-delete" data-id="${esc(current.id)}">${icon('trash')}${esc(tr('removeRepertoire'))}</button></div></div>`;
  block+=`<div class="section-tools">${searchBox()}<span class="stat">${all.length} ${esc(tr('scoreCount'))}</span></div>`;
  block+=visible.length?`<div class="cards score-list">${visible.map(p=>htmlScoreRow(scores.get(p),{note:relativePath(p),repertoireId:current.id,reorder:all.indexOf(p),count:all.length})).join('')}</div>`:empty(tr(q?'noResults':'repertoireEmpty'),tr('repertoireSubtitle'));
 }else if(!state.repertoires.length)block+=empty(tr('repertoireNoItems'),tr('repertoireSubtitle'));
 else block+=`<div class="cards rep-list">${state.repertoires.map(r=>`<div class="pf-rep-choice"><button class="entry rep-entry" data-action="rep-open" data-id="${esc(r.id)}"><span class="entry-ico">${icon('list')}</span><span class="entry-text"><span class="entry-title">${esc(r.name)}</span><span class="entry-note">${r.paths.length} ${esc(tr('scoreCount'))}</span></span>${icon('next')}</button><button type="button" class="pf-rep-duplicate" data-action="rep-duplicate" data-id="${esc(r.id)}" title="${state.lang==='es'?'Duplicar repertorio':'Duplicar repertori'}" aria-label="${state.lang==='es'?'Duplicar repertorio':'Duplicar repertori'}: ${esc(r.name)}">${icon('copy')}</button></div>`).join('')}</div>`;
 return heading('repertoires',tr('repertoireSubtitle'))+block;
}

function nav(name,page){return `<button class="navlink ${state.page===page?'selected':''}" data-action="page" data-value="${page}">${icon(name)} <span>${esc(tr(page))}</span></button>`;}
function tabsMobile(name,page){return `<button class="bottom-link ${state.page===page?'selected':''}" data-action="page" data-value="${page}">${icon(name)}<span>${esc(tr(page))}</span></button>`;}
function sourceBar(compact=false){
 return renderSourceControls({linked:linkedLocal,mode:state.source,lang:state.lang,
   supported:linkSupported(),compact,autoEnabled:state.autoCheck,android:/Android/i.test(navigator.userAgent)});
}
function paperBar(){
 const folders=paperFolders();
 const assigned=paperAssignments(state.paperConfig).filter(r=>folders.includes(r.path));
 const tabs=assigned.map(role=>{
  const key=roleKey(role.id),selected=state.paper===key;
  return '<button type="button" class="tab '+(selected?'active':'')+'" data-action="paper" data-value="'+key+
   '" aria-pressed="'+selected+'" title="'+esc(role.path)+'">'+esc(paperLabel(role.id,state.lang))+'</button>';
 }).join('');
 return '<div class="paper-row pf-paper-row"><span class="paper-label">'+esc(tr('paper'))+'</span>'+
 '<div class="paper-tabs">'+tabs+'<button type="button" class="tab '+(state.paper==='root'?'active':'')+
 '" data-action="paper" data-value="root" aria-pressed="'+(state.paper==='root')+'">'+esc(tr('all'))+'</button></div>'+
 '<button type="button" class="secondary pf-paper-setup-button" data-action="paper-setup" title="'+
 (state.lang==='es'?'Configurar papeles':'Configurar papers')+'" aria-label="'+
 (state.lang==='es'?'Configurar papeles':'Configurar papers')+'">'+icon('settings')+'</button></div>';
}
function breadcrumbs(){
 const arr=state.cwd;
 const nodes=[{name: state.paper==='root'?tr('all'):paperLabel(roleNumber(state.paper)||1,state.lang),depth:0},...arr.map((n,i)=>({name:n,depth:i+1}))];
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
 if(linkedMode()&&!linkedLocal.ready)return heading('library',tr('welcomeQuote'))+sourceBar()+paperBar()+
  empty(state.lang==='es'?'Falta permiso para leer la carpeta':'Falta permís per a llegir la carpeta',
   state.lang==='es'?'Pulsa Autorizar lectura para acceder a tus partituras originales.':'Prem Autoritzar lectura per a accedir a les partitures originals.');
 if(!total&&!(linkedMode()&&linkedLocal.folders.length))
  return heading('library',tr('welcomeQuote'))+sourceBar()+paperBar()+
   empty(tr('emptyTitle'),linkedMode()?state.lang==='es'?'La carpeta vinculada aún no contiene PDF. Pulsa Actualizar cuando añadas partituras.':'La carpeta vinculada encara no conté PDF. Prem Actualitzar quan afegisques partitures.':tr('emptyText'),!linkedMode());
 const prefix=currentBase();
 let selected=scopedScores();
 const visible=availableFolders(selected,prefix);
 if(linkedMode()&&linkedLocal.ready){
  const names=new Set(visible.folders);
  for(const path of linkedLocal.folders){
   if(prefix&&!path.startsWith(prefix+'/'))continue;
   const remainder=prefix?path.slice(prefix.length+1):path;
   if(remainder)names.add(remainder.split('/')[0]);
  }
  visible.folders=[...names].sort(sort);
 }
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
 return heading('library',tr('subtitle'))+sourceBar()+paperBar()+breadcrumbs()+`<div class="section-tools">${searchBox()}</div>`+s+(fs||ds?`<div class="cards ${ds?'score-list':''}" style="margin-top:19px">${fs+ds}</div>`:empty(tr('noResults'),tr('noResultsDesc')));
}
function indexViewGroups(scores){
 return buildIndexGroups(scores,{groupBy:state.indexGroupBy,sortBy:state.indexSortBy,paper:selectedPaperBase()||'root',unknownLabel:tr('indexUnknown'),rootFolderLabel:tr('indexGroup')});
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
   return `<div class="index-score-row"><button class="list-row" data-action="open" data-value="${esc(score.path)}">${thumbnailMarkup(score,'index')}<span class="filetitle">${esc(scoreDisplayTitle(score))}</span><small>${esc(info)}</small></button><button class="score-tool score-metadata ${hasScoreMetadata(score)?'has-metadata':''}" data-action="meta-open" data-value="${esc(score.path)}" title="${esc(tr('metadataEdit'))}" aria-label="${esc(tr('metadataEdit'))}">${icon('edit')}</button></div>`;
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
 return heading('settings',tr('settingsSubtitle'))+sourceBar(true)+`
 <div class="panel pf-paper-settings"><h3>${icon('folder')} ${state.lang==='es'?'Configuración de papeles':'Configuració de papers'}</h3><p class="help">${state.lang==='es'?'Asigna cualquier carpeta a cada papel. No se modifican las partituras.':'Assigna qualsevol carpeta a cada paper. No es modifiquen les partitures.'}</p>${paperBar()}</div>
 <div class="panel pf-drive-settings"><h3>☁ Google Drive</h3>
  <p class="help">${state.lang==='es'?'Explora carpetas de Google Drive en modo solo lectura y descarga PDF a la biblioteca local. No se modifican los archivos remotos.':'Explora carpetes de Google Drive en mode de només lectura i baixa PDF a la biblioteca local. No es modifiquen els arxius remots.'}</p>
  <button type="button" class="primary" data-action="drive-open">${state.lang==='es'?'Conectar o explorar Drive':'Connectar o explorar Drive'}</button>
  <p class="help">${state.lang==='es'?'Requiere autorización OAuth de Google, conexión a Internet y un Client ID web. Las partituras ya descargadas siguen disponibles sin conexión.':'Requerix autorització OAuth de Google, connexió a Internet i un Client ID web. Les partitures ja baixades continuen disponibles sense connexió.'}</p>
 </div>
 ${renderViewerSettings(state.viewerSettingsDraft||state.viewerSettings,state.lang)}
 <div class="panel"><h3>${icon('settings')} ${esc(tr('language'))}</h3><p>${esc(tr('languageHint'))}</p>
  <div class="line"><span>${esc(tr('language'))}</span><select id="language-select" aria-label="${esc(tr('language'))}"><option value="va" ${state.lang==='va'?'selected':''}>Valencià</option><option value="es" ${state.lang==='es'?'selected':''}>Castellano</option></select></div></div>
 <div class="panel pf-thumb-settings">
  <h3>${icon('file')} ${state.lang==='es'?'Miniaturas de partituras':'Miniatures de partitures'}</h3>
  <label class="pf-thumb-preference" for="thumbnail-enabled">
   <input id="thumbnail-enabled" type="checkbox" ${state.thumbnailEnabled?'checked':''} />
   <span>${state.lang==='es'?'Mostrar la primera página en Biblioteca, Repertorios, Recientes, Favoritos e Índice':'Mostrar la primera pàgina en Biblioteca, Repertoris, Recents, Favorits i Índex'}</span>
  </label>
  <p class="help">${state.lang==='es'?'Se cargan solo al aparecer en pantalla, de una en una y con memoria limitada. Se mantiene el icono PDF si no es posible generar la miniatura.':'Es carreguen només quan apareixen en pantalla, una a una i amb memòria limitada. Si no es pot crear una miniatura, es conserva la icona PDF.'}</p>
 </div>
 <div class="panel"><h3>${icon('folder')} ${esc(tr('storage'))}</h3><p>${esc(tr('localHint'))}</p>
   ${linkedMode()?'<p class="help">'+(state.lang==='es'?'Los PDF de la carpeta vinculada no ocupan el almacenamiento privado de la web.':'Els PDF de la carpeta vinculada no ocupen l’emmagatzematge privat de la web.')+'</p>':''}
  <div class="line"><span>${esc(tr('scoreCount'))}</span><strong>${state.scores.length}</strong></div>
  <div class="line"><span>${esc(tr('disk'))}</span><strong>${linkedMode()?'—':bytes(sizeTotal())}</strong></div>
  <div class="line"><span>${esc(tr('network'))}</span><strong>${state.online?tr('statusOnline'):tr('statusOffline')}</strong></div>
  ${state.storage?.usage!=null?`<div class="line"><span>${esc(tr('usage'))}</span><strong>${esc(bytes(state.storage.usage))}</strong></div>`:''}
  ${state.storage?.quota!=null?`<div class="line"><span>${esc(tr('quota'))}</span><strong>${esc(bytes(state.storage.quota))}</strong></div>`:''}
  <p class="help">${esc(state.storage?.persisted?tr('persistentYes'):tr('persistentNo'))}. ${esc(tr('storageNote'))}</p>
  <div class="line"><button class="secondary" data-action="import" ${linkedMode()?'disabled':''}>${icon('upload')}${esc(tr('importFiles'))}</button><button class="secondary" data-action="clear" ${linkedMode()?'disabled':''}>${icon('trash')}${esc(tr('deleteAll'))}</button></div>
  <p class="help">${esc(tr('saveZip'))}</p></div>
 <div class="panel backup-panel"><h3>${icon('save')} ${linkedMode()?(state.lang==='es'?'Copia de datos de la biblioteca vinculada':'Còpia de dades de la biblioteca vinculada'):esc(tr('backupTitle'))}</h3><p>${linkedMode()?(state.lang==='es'?'Guarda anotaciones, repertorios, favoritos, metadatos y ajustes. No incluye partituras PDF ni permisos de acceso a carpetas.':'Guarda anotacions, repertoris, favorits, metadades i ajustos. No inclou partitures PDF ni permisos d’accés a carpetes.'):esc(tr('backupDesc'))}</p>
  <div class="backup-buttons"><button class="primary" data-action="backup-create" ${state.loading||(!state.scores.length&&!linkedMode())?'disabled':''}>${icon('download')}${esc(tr('createBackup'))}</button><button class="secondary" data-action="backup-choose" ${state.loading?'disabled':''}>${icon('restore')}${esc(tr('restoreBackup'))}</button></div>
  ${state.backup?`<div class="backup-ready"><strong>${icon('check')} ${esc(tr('backupPrepared'))}</strong><small>${esc(state.backup.name)} · ${esc(bytes(state.backup.blob.size))}</small><div class="backup-buttons"><button class="primary" data-action="backup-save">${icon('download')}${esc(tr('saveBackup'))}</button>${typeof navigator.share==='function'?`<button class="secondary" data-action="backup-share">${icon('share')}${esc(tr('shareBackup'))}</button>`:''}</div></div>`:''}
  ${linkedMode()?'<p class="help">'+(state.lang==='es'?'Para restaurar estos datos, selecciona la carpeta original con sus PDF antes de importar el ZIP. Se comparan las rutas y se muestra una confirmación. Los archivos originales nunca se modifican.':'Per a restaurar estes dades, tria la carpeta original amb els PDF abans d’importar el ZIP. Es comparen les rutes i es mostra una confirmació. Els arxius originals no es modifiquen mai.')+'</p>':''}
  ${linkedMode()?'':'<p class="help">'+esc(tr('backupTip'))+'</p><p class="help">'+esc(tr('backupLarge'))+'</p>'}</div>
 <div class="panel"><h3>${icon('share')} ${esc(tr('installTitle'))}</h3><p>${esc(tr('installText'))}</p>
   <p class="help">${esc(tr('offlineText'))}</p>
 </div>
 <div class="panel"><h3>${icon('info')} ${esc(tr('about'))}</h3><p>${esc(tr('limitations'))}</p><p>${esc(tr('intro'))}</p><div class="line"><strong>Partitures Festeres Web — ${esc(APP_VERSION)}</strong><span>© SMN Systems</span></div></div>`;
}
function renderModal(){if(!state.modal)return '';
 if(state.modal==='drive-browser')return driveBrowser.render(state.lang,location.origin);
 if(state.modal==='paper-setup')return renderPaperSetup({config:state.paperConfig,folders:paperFolders(),editingRole:state.paperEditRole,folderSearch:state.paperFolderSearch,language:state.lang,active:state.paper});
 if(state.modal==='paper-help')return renderPaperHelp(state.lang);
 if(state.modal==='paper-remove')return renderPaperRemove(state.paperRemoveRole,state.lang);
 if(state.modal==='score-organize'){
  const score=state.scores.find(s=>s.path===state.organizePath);
  return renderOrganizeModal({score,scores:state.scores,language:state.lang,busy:state.organizeBusy,linked:linkedMode()});
 }
 if(state.modal==='welcome')return `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal"><img src="./assets/icon-192.png" alt="Partitures Festeres"/><h2>Benvingut · Bienvenido</h2><p>Tria l’idioma · Elige el idioma</p><label><input type="radio" name="welcome-lang" value="va" ${state.lang==='va'?'checked':''}/> Valencià</label><label><input type="radio" name="welcome-lang" value="es" ${state.lang==='es'?'checked':''}/> Castellano</label><div class="modal-actions"><button class="primary" data-action="welcome-done">Començar · Empezar</button></div></div></div>`;
 if(state.modal==='restore-linked-choice'&&state.restore&&linkedMode()){
  const m=state.restore.manifest,info=linkedBackupMatch(state.restore,linkedLocal),es=state.lang==='es';
  const incompatible=info.matched===0;
  return '<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="restore-linked-title"><div class="modal restore-modal">'+
   '<h2 id="restore-linked-title">'+(es?'Restaurar datos de biblioteca':'Restaurar dades de biblioteca')+'</h2>'+
   '<p><strong>'+esc(m.libraryName)+'</strong> · '+esc(new Date(m.createdAt).toLocaleDateString(es?'es-ES':'ca-ES'))+'</p>'+
   '<p>'+(es?'Partituras que coinciden por carpeta y nombre: ':'Partitures que coincidixen per carpeta i nom: ')+
     '<strong>'+info.matched+' / '+m.paths.length+'</strong></p>'+
   (info.missing?'<p class="help">'+info.missing+(es?' no se han encontrado y se omitirán.':' no s’han trobat i s’ometran.')+'</p>':'')+
   (info.libraryChanged?'<p class="help pf-linked-backup-warning">'+(es?'La carpeta actual tiene otro nombre. Comprueba que corresponde a la copia antes de continuar.':'La carpeta actual té un altre nom. Comprova que correspon a la còpia abans de continuar.')+'</p>':'')+
   '<p class="help">'+(es?'Los PDF originales no se modificarán.':'Els PDF originals no es modificaran.')+'</p>'+
   (incompatible?'<p class="help">'+(es?'No hay partituras coincidentes: no es puede restaurar esta copia.':'No hi ha partitures coincidents: no es pot restaurar esta còpia.')+'</p>':
    '<div class="restore-options"><div><strong>'+(es?'Fusionar datos':'Fusionar dades')+'</strong>'+
    '<p>'+(es?'Conserva las anotaciones y ajustes existentes y recupera los que falten.':'Conserva les anotacions i ajustos existents i recupera els que falten.')+'</p>'+
    '<button class="primary" type="button" data-action="linked-restore-merge">'+(es?'Fusionar':'Fusionar')+'</button></div>'+
    '<div class="replace-option"><strong>'+(es?'Sustituir datos':'Substituir dades')+'</strong>'+
    '<p>'+(es?'Sustituye anotaciones y ajustes de partituras coincidentes. Conserva todos los PDF.':'Substituïx les anotacions i ajustos de partitures coincidents. Conserva tots els PDF.')+'</p>'+
    '<button class="danger" type="button" data-action="linked-restore-replace">'+(es?'Sustituir':'Substituir')+'</button></div></div>')+
   '<div class="modal-actions"><button class="secondary" data-action="close-modal">'+esc(tr('cancel'))+'</button></div></div></div>';
 }
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
       <div class="pf-meta-organize-block">
        <button type="button" class="secondary pf-meta-organize-button" data-action="organize-open">
         ${icon('folder')} ${state.lang==='es'?'Mover o renombrar archivo PDF':'Moure o renomenar fitxer PDF'}
        </button>
        <small>${state.lang==='es'?'Guarda primero los cambios de metadatos que quieras conservar.':'Guarda primer els canvis de metadades que vulgues conservar.'}</small>
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
     ${['rectangle','ellipse'].includes(v?.annotationTool)?`<label class="annotation-width-label">${state.lang==='va'?'Ompliment':'Relleno'}<select id="annotation-shape-fill" aria-label="${state.lang==='va'?'Ompliment':'Relleno'}">${[0,.15,.35,.60,1].map(x=>`<option value="${x}" ${x===v.shapeFillOpacity?'selected':''}>${Math.round(x*100)}%</option>`).join('')}</select></label>`:''}
     ${colorable?`<span class="annotation-colors" aria-label="${esc(tr('annotationColor'))}">${colors}</span>`:''}
     <div class="annotation-edit-actions">
       <button data-action="annotation-undo" title="${esc(tr('annotationUndo'))}" aria-label="${esc(tr('annotationUndo'))}">${icon('back')}</button>
       <button data-action="annotation-redo" title="${state.lang==='va'?'Refer':'Rehacer'}" aria-label="${state.lang==='va'?'Refer':'Rehacer'}">${icon('next')}</button>
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
 const list=viewerScoreRecords(),idx=list.findIndex(s=>s.path===state.view.path),p=idx>=0?idx:0;
 const performance=state.performance&&performancePosition(state.performance,state.view.path);
 const v=scoreViewer, page=v?.pageNumber||1, total=v?.numPages||'…', native=!!v?.native;
 return `<div class="viewer w12-viewer pf-reading-mode ${viewerCssFallback?'landscape-css-fallback':''} ${state.zen?'zen-mode':''} ${state.annotating?'annotation-mode':''}" role="dialog" aria-label="${esc(tr('openPdf'))}">
   <div id="viewer-stage" class="viewer-stage" data-path="${esc(state.view.path)}" tabindex="0" aria-label="${esc(tr('viewerStageHint'))}"><p class="viewer-message">${esc(tr('viewerLoading'))}</p></div>
   <button type="button" class="pf-viewer-edge-nav pf-viewer-edge-prev" data-action="viewer-edge-prev" aria-label="${esc(tr('viewerPrevPage'))}" title="${esc(tr('viewerPrevPage'))}" disabled><span aria-hidden="true">‹</span></button>
   <button type="button" class="pf-viewer-edge-nav pf-viewer-edge-next" data-action="viewer-edge-next" aria-label="${esc(tr('viewerNextPage'))}" title="${esc(tr('viewerNextPage'))}" disabled><span aria-hidden="true">›</span></button>
   <div class="pf-viewer-light-shade" aria-hidden="true" style="background:rgba(0,0,0,${brightnessShadeOpacity(state.viewerSettings)})"></div>
   <div class="viewer-top"><button class="quiet" data-action="viewer-close" aria-label="${esc(tr('back'))}">${icon('back')}</button><span class="viewer-title">${esc(scoreDisplayTitle(state.scores.find(s=>s.path===state.view.path)))}</span><button type="button" class="quiet pf-viewer-score-picker-open" data-action="viewer-score-picker" aria-label="${state.lang==='es'?'Buscar y saltar a otra partitura':'Cercar i saltar a una altra partitura'}" title="${state.lang==='es'?'Buscar y saltar a otra partitura':'Cercar i saltar a una altra partitura'}" ${state.annotating?'disabled':''}>${icon('search')}</button><button class="quiet viewer-favorite ${state.favorites.includes(state.view.path)?'active':''}" data-action="favorite" data-value="${esc(state.view.path)}" aria-pressed="${state.favorites.includes(state.view.path)}" title="${esc(tr(state.favorites.includes(state.view.path)?'removeFavorite':'addFavorite'))}" aria-label="${esc(tr(state.favorites.includes(state.view.path)?'removeFavorite':'addFavorite'))}">${icon('star')}</button><button class="quiet viewer-annotate-btn ${state.annotating?'active':''}" data-action="viewer-annotate" aria-pressed="${state.annotating}" title="${esc(tr(state.annotating?'annotationDone':'annotationEdit'))}" aria-label="${esc(tr(state.annotating?'annotationDone':'annotationEdit'))}" ${native?'disabled':''}>${icon('edit')}</button><button class="quiet" data-action="viewer-repair-open" title="${state.lang==='es'?'Ajustar página (recorte, contraste y giro)':'Ajustar pàgina (retall, contrast i gir)'}" aria-label="${state.lang==='es'?'Ajustar página':'Ajustar pàgina'}" ${native||state.annotating?'disabled':''}>${icon('repair')}</button><button class="quiet" data-action="viewer-rotate" title="${esc(tr('viewerRotate'))}" aria-label="${esc(tr('viewerRotate'))}">${icon('rotate')}</button><button class="quiet viewer-auto-rotate" data-action="viewer-auto-rotate" aria-label="${esc(tr('viewerAutoRotate'))}" title="${esc(tr('viewerAutoRotate'))}" aria-pressed="${v?.rotationMode==='auto'}">AUTO</button><button class="quiet" id="viewer-fit-button" data-action="viewer-fit" title="${esc(tr('viewerFitPage'))}" aria-label="${esc(tr('viewerFitPage'))}">${icon('fit')}</button><button class="quiet" data-action="viewer-external" title="${esc(tr('openExternal'))}" aria-label="${esc(tr('openExternal'))}">${icon('share')}</button></div>
   <div class="viewer-toolbar"><button class="quiet" id="viewer-prev-page" data-action="viewer-page-prev" aria-label="${esc(tr('viewerPrevPage'))}" ${native?'disabled':''}>${icon('back')}</button><span class="viewer-page-counter" id="viewer-page-counter">${esc(tr('viewerPage'))} ${page} / ${total}</span><button class="quiet" id="viewer-next-page" data-action="viewer-page-next" aria-label="${esc(tr('viewerNextPage'))}" ${native?'disabled':''}>${icon('next')}</button><span class="viewer-toolbar-divider"></span><button class="quiet" data-action="viewer-zoom-out" aria-label="${esc(tr('viewerZoomOut'))}" ${native?'disabled':''}>${icon('zoomout')}</button><span id="viewer-zoom-label" class="viewer-zoom-label">${Math.round((v?.zoom||1)*100)}%</span><button class="quiet" data-action="viewer-zoom-in" aria-label="${esc(tr('viewerZoomIn'))}" ${native?'disabled':''}>${icon('zoomin')}</button><button class="quiet" data-action="viewer-zen" aria-label="${esc(tr('viewerZen'))}">${icon('expand')}</button></div>
   ${renderRosette(v)}${renderAnnotationToolbar(v)}
   <div class="viewer-bottom"><button data-action="viewer-prev" ${p<=0?'disabled':''}>${icon('back')} ${esc(tr('noPrevious'))}</button><button type="button" class="pf-performance-progress pf-viewer-score-picker-shortcut" data-action="viewer-score-picker" aria-label="${state.lang==='es'?'Buscar y saltar a otra partitura':'Cercar i saltar a una altra partitura'}" title="${state.lang==='es'?'Buscar y saltar a otra partitura':'Cercar i saltar a una altra partitura'}" ${state.annotating?'disabled':''}>${performance?`<strong>${state.lang==='es'?'Actuación':'Actuació'} · ${esc(state.performance.name)}</strong> · `:''}${p+1} / ${list.length} ${esc(tr('scoreCount'))}</button><button data-action="viewer-next" ${!performance&&p>=list.length-1?'disabled':''} title="${performance&&p===list.length-1?(state.lang==='es'?'Volver al inicio del repertorio':'Tornar a l’inici del repertori'):''}">${performance&&p===list.length-1?(state.lang==='es'?'Inicio':'Inici'):esc(tr('noNext'))} ${icon('next')}</button></div>
   <div class="viewer-intro ${state.viewerSettings.showScoreNameOnChange?'':'hidden-intro'}">${esc(nice(parts(state.view.path).at(-1)))}<small>${esc(tr('viewerStageHint'))}</small></div>
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
 if(show&&!state.annotating) viewerMenuTimer=setTimeout(()=>{if(state.view)showViewerMenu(false);},state.viewerSettings.menuHideSeconds*1000);
}
function openAdjacentScore(direction){
 changeViewerScore(direction).catch(e=>{console.error(e);toast(`${tr('error')} ${e.message}`,true);});
}
function syncViewerControls(){
 if(!state.view||!scoreViewer)return;
 const v=scoreViewer,prev=$('#viewer-prev-page'),next=$('#viewer-next-page');
 const sidePrev=$('[data-action="viewer-edge-prev"]'),sideNext=$('[data-action="viewer-edge-next"]');
 const records=viewerScoreRecords(),idx=records.findIndex(score=>score.path===state.view.path);
 if(sidePrev)sidePrev.disabled=v.native||!v.page||!(v.pageNumber>1||idx>0)||state.annotating;
 if(sideNext)sideNext.disabled=v.native||!v.page||!(v.pageNumber<v.numPages||idx>=0&&(idx<records.length-1||!!state.performance))||state.annotating;
 if(prev)prev.disabled=v.native||v.pageNumber<=1;
 if(next)next.disabled=v.native||v.pageNumber>=v.numPages;
 const info=$('#viewer-page-counter');if(info)info.textContent=v.native?tr('viewerShow'):`${tr('viewerPage')} ${v.pageNumber} / ${v.numPages||'…'}`;
 const zoom=$('#viewer-zoom-label');if(zoom)zoom.textContent=Math.round(v.zoom*100)+'%';
 const fit=$('#viewer-fit-button');if(fit)fit.title=v.fit==='page'?tr('viewerFitWidth'):tr('viewerFitPage');
 const auto=$('[data-action="viewer-auto-rotate"]');if(auto)auto.setAttribute('aria-pressed',String(v.rotationMode==='auto'));
 const annotate=$('[data-action="viewer-annotate"]');if(annotate)annotate.disabled=v.native||!v.page;
 document.querySelectorAll('[data-action="annotation-undo"]').forEach(b=>{b.disabled=!v.canUndoAnnotation();});
 document.querySelectorAll('[data-action="annotation-redo"]').forEach(b=>{b.disabled=!v.canRedoAnnotation();});
 const selectedDelete=$('[data-action="annotation-delete-selected"]');if(selectedDelete)selectedDelete.disabled=!v.hasSelectedAnnotation();
 const editText=$('[data-action="annotation-text-edit"]');if(editText)editText.disabled=!v.getSelectedText();
 const clearAnn=$('[data-action="annotation-clear"]');if(clearAnn)clearAnn.disabled=!v.hasPageAnnotations();
 for(const action of ['object-copy','object-cut','object-duplicate','object-rotate-left','object-rotate-right','object-reset-rotation','object-size-down','object-size-up']){
  document.querySelectorAll('[data-action="'+action+'"]').forEach(b=>{b.disabled=!v.hasSelectedAnnotation();});
 }
 document.querySelectorAll('[data-action="object-paste"]').forEach(b=>{b.disabled=!v.canPasteAnnotation();});
 for(const [action,dir] of [['object-backward',-1],['object-forward',1]])
  document.querySelectorAll('[data-action="'+action+'"]').forEach(b=>{b.disabled=!v.canMoveSelectedAnnotation(dir);});
 document.querySelectorAll('.pf-object-nudge').forEach(b=>{b.hidden=v.selectedAnnotationObject()?.tool!=='text';});
 document.querySelectorAll('.pf-object-fill').forEach(b=>{
  b.hidden=!v.selectedCanFill();
  const fill=Number(b.dataset.action.slice('object-fill-'.length))/100;
  b.classList.toggle('selected',v.selectedCanFill()&&(v.selectedAnnotationObject()?.fillOpacity??0)===fill);
 });
 for(const act of ['viewer-zoom-out','viewer-zoom-in','viewer-fit','viewer-rotate','viewer-repair-open']){
  const btn=$(`[data-action="${act}"]`);if(btn)btn.disabled=v.native||(act==='viewer-repair-open'&&state.annotating);
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
 const page=state.page==='add'?scanner.markup({scores:state.scores,folders:linkedMode()?linkedLocal.folders:[],linked:linkedMode(),repertoires:state.repertoires,language:state.lang}):state.page==='index'?renderIndex():state.page==='tools'?renderTools():state.page==='settings'?renderSettings():state.page==='favorites'||state.page==='recents'?renderCollectionPage(state.page):state.page==='repertoires'?renderRepertoires():renderLibrary();
 $('#app').innerHTML = `<header class="topbar"><div class="brand"><img src="./assets/icon-192.png" alt=""/><div><h1>Partitures Festeres</h1><small>${esc(tr('subtitle'))}</small></div></div><div class="top-actions"><button type="button" class="pf-topbar-scan" data-action="scan-open">${icon('camera')} ${state.lang==='es'?'Escanear':'Escanejar'}</button><button class="primary" data-action="import">${icon('upload')} ${esc(tr('import'))}</button></div></header>
 <div class="main-layout"><aside class="sidebar"><span class="side-caption">Partitures Festeres Web</span>${nav('library','library')}${nav('list','repertoires')}${nav('book','index')}${nav('clock','recents')}${nav('star','favorites')}${nav('musicSymbol','tools')}${nav('settings','settings')}<div class="side-bottom">${esc(tr('dev'))} ${esc(APP_VERSION)}<p>${esc(tr('offlineReady'))}</p></div></aside><main class="content">${page}</main></div>
 <nav class="bottom-nav" aria-label="Navegació">${tabsMobile('library','library')}${tabsMobile('list','repertoires')}${tabsMobile('book','index')}${tabsMobile('clock','recents')}${tabsMobile('star','favorites')}${tabsMobile('musicSymbol','tools')}${tabsMobile('settings','settings')}</nav>${renderViewer()}${renderModal()}`;
 if(oldStage && state.view?.path===oldPath && scoreViewer){
  $('#viewer-stage')?.replaceWith(oldStage);
 }
 syncViewerControls();
 pdfThumbnails.reconcile(state.scores);
 pdfThumbnails.mount($('#app'),{enabled:state.thumbnailEnabled&&!state.view&&
  ['library','repertoires','favorites','recents','index'].includes(state.page)});
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
  state.scores=await activeScoreIndex();
  await autoMigratePaperAfterImport();
  state.cwd=[];state.search='';state.page='library';
  render();updateStorageInfo();
  toast(`${added} ${tr('added')}${skipped?` · ${skipped} ${tr('skipped')}`:''}${errors.length?` · ${errors[0]}`:''}`,!!errors.length&&added===0);
 }catch(e){console.error(e);toast(`${tr('error')} ${e?.message||''}`,true);state.scores=await getAllScores().catch(()=>state.scores);render();}
 finally{progress(false);$('#import-input').value='';}
}
async function importFolderSnapshot(files){
 if(!files?.length)return;
 if(linkedMode())await activateLibrarySource('imported');
 state.loading=true;progress(true);
 let imported=0,skipped=0;
 try{
  const known=new Set((await getAllScores()).map(s=>s.path));
  const batch=[];
  for(const file of files){
   if(!/\.pdf$/i.test(file.name)||file.size>100*1024*1024||!file.size){skipped++;continue;}
   const raw=String(file.webkitRelativePath||file.name);
   const segments=raw.split('/');
   // webkitdirectory inclou la carpeta seleccionada en el primer segment.
   const path=normalizePath(segments.length>1?segments.slice(1).join('/'):raw);
   if(!path||!(await pdfHeader(file))){skipped++;continue;}
   const unique=availableDrivePath(path,known);
   known.add(unique);
   batch.push({path:unique,blob:file,size:file.size,added:Date.now()});
   if(batch.length>=18){await saveBatch(batch.splice(0));}
   imported++;
  }
  if(batch.length)await saveBatch(batch);
  state.scores=await activeScoreIndex();
  await autoMigratePaperAfterImport();
  state.cwd=[];state.search='';state.page='library';render();updateStorageInfo();
  toast(imported+' '+tr('added')+(skipped?' · '+skipped+' '+tr('skipped'):''));
 }finally{state.loading=false;progress(false);}
}
async function openPdf(path,requestedPage=null){
 if(viewerScorePicker.active)viewerScorePicker.close({restoreFocus:false});
 // Prioritat de lectura: aturar miniatures ABANS de llegir la partitura.
 pdfThumbnails.pause();
 clearTimeout(viewerMenuTimer);
 $('.toast')?.remove();clearTimeout(state.toastTimer);
 const request=++viewerRequest;
 if(!state.view&&!viewerPendingOpen){
  viewerPendingOpen=true;
  ensureViewerHistory(); // L'entrada anterior sempre és el menú de procedència.
  requestViewerLandscape();
 }
 let record;
 try{record=await readActiveScore(path);}
 catch(error){
  if(request===viewerRequest){
   if(!state.view){
    viewerPendingOpen=false;releaseViewerLandscape();
    if(hasViewerHistory())history.back();
   }
   pdfThumbnails.resume();
  }
  throw error;
 }
 if(request!==viewerRequest)return;
 if(!record?.blob){
  if(!state.view){viewerPendingOpen=false;releaseViewerLandscape();if(hasViewerHistory())history.back();}
  pdfThumbnails.resume();
  toast(tr('pdfUnavailable'),true);return;
 }
  state.recents=[path,...state.recents.filter(p=>p!==path)].slice(0,45);
  setLibraryPref('w13:recents',state.recents).catch(e=>console.warn('Recents:',e));
 closeViewerIfNeeded(true);
 state.blobUrl=URL.createObjectURL(record.blob);
 state.view={path,page:1};viewerPendingOpen=false;state.zen=true;state.annotating=false;state.objectMenuOpen=false;state.annotationGroup='strokes';setReadingColors(true);
 await viewerPreferencesQueue.catch(()=>{});
 if(request!==viewerRequest)return;
 const saved=await readActiveViewerPref('viewer:'+path,{});
 const effectiveViewerState=state.viewerSettings.rememberZoom?saved:{...saved,zoom:1};
 const pageToOpen=Number.isInteger(requestedPage)&&requestedPage>0?requestedPage:saved?.page;
 state.view.page=Number.isInteger(pageToOpen)&&pageToOpen>0?pageToOpen:1;
 const annotations=await getAnnotations(scoreDataPath(path));
 await pageAdjustmentsQueue.catch(()=>{});
 const pageAdjustments=normalizePageAdjustments(await readActiveViewerPref(PAGE_ADJUSTMENT_KEY+path,{}));
 if(request!==viewerRequest){closeViewerIfNeeded();return;}
 render();
 const host=$('#viewer-stage');
 scoreViewer=new ScoreViewer({
  host,blob:record.blob,fallbackUrl:state.blobUrl,initial:{...effectiveViewerState,page:state.view.page},annotations,pageAdjustments,
  onPageAdjustmentsChange:updates=>{const snapshot=normalizePageAdjustments(updates);pageAdjustmentsQueue=pageAdjustmentsQueue.catch(()=>{}).then(()=>writeActiveViewerPref(PAGE_ADJUSTMENT_KEY+path,snapshot));return pageAdjustmentsQueue;},
   sideTapFraction:()=>state.viewerSettings.sideTapFraction,
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
    return savePdfAnnotations(scoreDataPath(path),document);
   },
  labels:{loading:tr('viewerLoading'),page:tr('viewerPage'),fallback:tr('viewerFallback'),native:tr('openPdf'),external:tr('openExternal')},
  onChange:value=>{
    if(state.view?.path===path)state.view.page=value.page;
    rememberNavigation();
    const snapshot=state.viewerSettings.rememberZoom?value:{...value,zoom:saved?.zoom??1};
    return persistViewerSnapshot(path,snapshot).catch(e=>console.warn('Desament del visor:',e));
   },
  onUpdate:()=>syncViewerControls(),
  onWarning:message=>toast(message,true),
  onEdge:direction=>openAdjacentScore(direction),
  onToggleControls:()=>showViewerMenu(state.zen)
 });
 await scoreViewer.open();
 void viewerWakeLock.setEnabled(state.viewerSettings.keepScreenOn);
 if(state.viewerSettings.showScoreNameOnChange)
  setTimeout(()=>{if(state.view?.path===path)document.querySelector('.viewer-intro')?.classList.add('hidden-intro');},1200);
}
function setReadingColors(reading){
 document.documentElement.classList.toggle('reading-pdf',reading);
 document.body.classList.toggle('reading-pdf',reading);
 const theme=document.querySelector('meta[name="theme-color"]');
 if(theme)theme.content=reading?'#ffffff':'#6b1722';
}
function closeViewer(consumeHistory=true){
 void viewerWakeLock.setEnabled(false);
 viewerScorePicker.close({restoreFocus:false,historyBack:false});
 const wasReading=!!state.view||viewerPendingOpen;
 viewerRequest++;
 viewerPendingOpen=false;
 clearTimeout(viewerMenuTimer);
 clearTimeout(fullscreenExitTimer);
 closeViewerIfNeeded();
 state.performance=null;
 pdfThumbnails.resume();
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
  if(state.loading)return;
  if(!state.scores.length&&!linkedMode()){toast(tr('backupNoScores'),true);return;}
  state.loading=true;progress(true,tr('backupCreating'));
  try{
    await annotationSaveQueue;
    const onProgress=p=>{
      if(p.phase==='read')updateProgress(p.done+' / '+p.total+' '+tr('scoreCount'));
      if(p.phase==='zip')updateProgress(tr('backupCreating')+' '+Math.round(p.percent||0)+' %');
    };
    const backup=linkedMode()?await createLinkedDataBackup(linkedLocal,onProgress):await createBackup(onProgress);
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
  try{
    state.restore=linkedMode()?await inspectLinkedDataBackup(file):await inspectBackup(file);
    state.restoreTargetId=linkedMode()?linkedLocal.id:null;
    state.modal=linkedMode()?'restore-linked-choice':'restore-choice';render();
   }
  catch(e){console.error(e);toast(`${tr('error')} ${e.message}`,true);}
  finally{state.loading=false;progress(false);$('#restore-input').value='';}
}
async function doRestore(mode){
  if(linkedMode()){toast(state.lang==='es'?'Cambia a Biblioteca importada para restaurar una copia ZIP.':'Canvia a Biblioteca importada per a restaurar una còpia ZIP.',true);return;}
  if(state.loading||!state.restore)return;
  state.loading=true;state.modal=null;render();progress(true,tr('backupVerify'));
  try{
    await annotationSaveQueue;
    const count=await restoreBackup(state.restore,mode,p=>updateProgress(`${tr('backupVerify')} ${p.done} / ${p.total}`));
    state.restore=null;
    state.scores=await activeScoreIndex();
    await reloadCollections();
    if(mode==='replace'){
      const lang=await getPref('lang',state.lang);state.lang=lang==='es'?'es':'va';
      await loadPaperConfig();
    }
    await loadPaperConfig();
    state.cwd=[];state.page='library';state.search='';closeViewerIfNeeded();render();
    toast(`${tr('restoreSuccess')} · ${count} ${tr('scoreCount')}`);updateStorageInfo();
  }catch(e){console.error(e);state.scores=await getAllScores().catch(()=>state.scores);render();toast(`${tr('restoreError')} ${e?.message||''}`,true);}
  finally{state.loading=false;progress(false);}
}
async function doRestoreLinked(mode){
 if(state.loading||!state.restore||!linkedMode()||state.restoreTargetId!==linkedLocal.id)return;
 state.loading=true;state.modal=null;render();progress(true,tr('backupVerify'));
 try{
  await annotationSaveQueue;await pageAdjustmentsQueue;await viewerPreferencesQueue;
  const restored=await restoreLinkedDataBackup(state.restore,linkedLocal,mode);
  state.restore=null;state.restoreTargetId=null;
  state.scores=await activeScoreIndex();
  await reloadCollections();await loadPaperConfig();validPaperSelection();
  state.cwd=[];state.page='library';state.search='';
  pdfThumbnails.clear();render();
  toast((state.lang==='es'?'Datos restaurados: ':'Dades restaurades: ')+restored.matched+
   ' PDF'+(restored.missing?' · '+restored.missing+
    (state.lang==='es'?' sin coincidencia':' sense coincidència'):''));
 }catch(error){
  console.error(error);render();
  toast((state.lang==='es'?'No se han restaurado los datos. ':'No s’han restaurat les dades. ')+
   (error?.message||''),true);
 }finally{state.loading=false;progress(false);}
}
function applyRosetteOption(id){
 if(!state.annotating||!scoreViewer||state.modal)return;
 const v=scoreViewer,level=state.rosetteLevel;
 const ctx={shapeFillOpacity:v.shapeFillOpacity,annotationTool:v.annotationTool,annotationColor:v.annotationColor,
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
 }else if(option.fill!==undefined){
  v.setShapeFillOpacity(option.fill);state.rosetteLevel='shape';
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
   const folder=state.page==='library'?currentBase():selectedPaperBase();
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
   if(state.page==='add'&&!state.view)await scanner.handleAction(action,val);
   break;
  case 'scan-save':{
   if(state.page!=='add'||state.view||scanner.busy||!scanner.pages.length)break;
   if(linkedMode()){
    // Demanar permís d’escriptura en ESTE clic, abans de qualsevol await.
    let authorization;
    try{authorization=linkedLocal.requestWriteAccess();}
    catch(error){toast(error.message,true);break;}
    try{await authorization;}
    catch(error){toast(error.message,true);break;}
   }
   await scanner.handleAction(action,val);
   break;
  }
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
  case 'object-cut':
   if(scoreViewer?.copySelectedAnnotation(true))
    toast(state.lang==='va'?'Objecte preparat per tallar: apega’l per a moure’l.':'Objeto preparado para cortar: pégalo para moverlo.');
   syncViewerControls();break;
  case 'object-duplicate':scoreViewer?.duplicateSelectedAnnotation();syncViewerControls();break;
  case 'object-forward':scoreViewer?.orderSelectedAnnotation(1);syncViewerControls();break;
  case 'object-backward':scoreViewer?.orderSelectedAnnotation(-1);syncViewerControls();break;
  case 'object-nudge-left':scoreViewer?.nudgeSelectedText(-.003,0);break;
  case 'object-nudge-right':scoreViewer?.nudgeSelectedText(.003,0);break;
  case 'object-nudge-up':scoreViewer?.nudgeSelectedText(0,-.003);break;
  case 'object-nudge-down':scoreViewer?.nudgeSelectedText(0,.003);break;
  case 'object-paste':scoreViewer?.pasteCopiedAnnotation();syncViewerControls();break;
  case 'object-fill-0':case 'object-fill-15':case 'object-fill-35':case 'object-fill-60':case 'object-fill-100':
   scoreViewer?.fillSelectedShape(Number(action.slice('object-fill-'.length))/100);syncViewerControls();break;
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
  case 'paper':{
   const target=val==='root'?null:findRole(state.paperConfig,val);
   const allowed=val==='root'||!!target?.path&&paperFolders().includes(target.path);
   if(!allowed){toast(state.lang==='es'?'Carpeta del papel no disponible.':'Carpeta del paper no disponible.',true);break;}
   state.paper=val;state.cwd=[];state.search='';clearAdvancedSearch();state.indexCollapsed.clear();
   await setLibraryPref('paper',val);render();break;
  }
  case 'source-manage':
   if(state.view||viewerPendingOpen)break;
   setPage('settings');break;
  case 'source-auto-toggle':
   state.autoCheck=!state.autoCheck;
   await setPref('w223:autoCheck',state.autoCheck);
   if(!state.autoCheck&&autoCheckTimer){clearTimeout(autoCheckTimer);autoCheckTimer=null;}
   render();
   if(state.autoCheck){lastCheckStartedAt=0;scheduleAutoCheck();}
   break;
  case 'source-imported':
   if(linkedLocal.offlineBusy){toast(state.lang==='es'?'Detén primero la preparación de las partituras.':'Para primer la preparació de les partitures.',true);break;}
   if(state.source!=='imported')await activateLibrarySource('imported');
   break;
  case 'source-linked':
   if(!linkedLocal.exists)break;
   if(!linkedLocal.ready)await linkedLocal.scan({ask:false});
   await activateLibrarySource('linked');
   lastCheckStartedAt=0;scheduleAutoCheck();
   break;
  case 'source-choose':{
   if(state.view||viewerPendingOpen||state.loading||linkedLocal.offlineBusy)break;
   let selected;
   try{
    // La crida directa manté l'activació de l'usuari per al diàleg nadiu.
    selected=linkedLocal.choose();
   }catch(error){toast(error.message,true);break;}
   state.loading=true;
   try{
    const granted=await selected;
    await activateLibrarySource('linked');
    if(!granted)toast(state.lang==='es'?'Pulsa Autorizar lectura para dar permiso a esta carpeta.':'Prem Autoritzar lectura per a donar permís a esta carpeta.');
   }catch(error){
    if(error?.name!=='AbortError')toast(error?.message||String(error),true);
   }finally{state.loading=false;render();}
   break;
  }
  case 'source-refresh':case 'source-authorize':{
   if(!linkedLocal.exists||state.view||viewerPendingOpen||linkedLocal.offlineBusy)break;
   // requestPermission() s'ha d'invocar en el mateix clic.
   const scan=linkedLocal.scan({ask:action==='source-authorize'||linkedLocal.cached});
   state.loading=true;
   try{
    const granted=await scan;
    if(!linkedMode())await activateLibrarySource('linked');
    else{
     state.scores=await activeScoreIndex();
     await reloadCollections();
     validPaperSelection();
     render();
    }
    if(!granted)toast(state.lang==='es'?'No se ha concedido acceso a la carpeta.':'No s’ha concedit accés a la carpeta.',true);
    else toast(state.lang==='es'?'Biblioteca actualizada.':'Biblioteca actualitzada.');
   }catch(error){toast(error?.message||String(error),true);render();}
   finally{state.loading=false;}
   break;
  }
  case 'source-forget':{
   if(!linkedLocal.exists||linkedLocal.offlineBusy)break;
   if(linkedMode())await activateLibrarySource('imported');
   await linkedLocal.forget();render();
   toast(state.lang==='es'?'Carpeta desvinculada. Los archivos originales no se han modificado.':'Carpeta desvinculada. Els arxius originals no s’han modificat.');
   break;
  }
  case 'source-cache':case 'source-cache-update':{
   if(!linkedMode()||!linkedLocal.ready||linkedLocal.offlineBusy||state.view)break;
   // L'usuari sol·licita explícitament còpies locals per a alliberar-se
   // dels permisos de carpeta d'Android que caduquen en tancar Chrome.
   pdfThumbnails.pause();
   linkedLocal.offlineProgress=state.lang==='es'?'Preparando partituras…':'Preparant partitures…';
   render();
   try{
    const refresh=action==='source-cache-update';
    const result=await linkedLocal.prepareOffline({refresh,onProgress:progress=>{
     linkedLocal.offlineProgress=(state.lang==='es'?'Preparadas: ':'Preparades: ')+progress.done+'/'+progress.total+
      ' · '+(state.lang==='es'?'nuevas: ':'noves: ')+progress.saved+
      (progress.failed?' · '+progress.failed+' '+(state.lang==='es'?'errores':'errors'):'');
     if(state.page==='library'||state.page==='settings')render();
    }});
    const message=(state.lang==='es'?'Partituras disponibles sin conexión: ':'Partitures disponibles sense connexió: ')+
      result.available+'/'+result.total+
      (result.failed?' · '+result.failed+' '+(state.lang==='es'?'no se han podido guardar':'no s’han pogut guardar'):'');
    toast(message,!!result.failed&&!result.saved);
    if(result.failed&&result.lastError)
     console.warn('Còpies no disponibles:',result.lastError);
   }catch(error){toast(error?.message||String(error),true);}
   finally{
    linkedLocal.offlineProgress=null;
    pdfThumbnails.resume();
    render();updateStorageInfo();
   }
   break;
  }
  case 'source-cache-stop':
   linkedLocal.cancelOffline();
   linkedLocal.offlineProgress=state.lang==='es'?'Deteniendo después del PDF actual…':'Parant després del PDF actual…';
   render();break;
  case 'source-cache-clear':{
   if(!linkedMode()||linkedLocal.offlineBusy)break;
   const confirmed=window.confirm(state.lang==='es'
    ?'¿Eliminar las copias sin conexión? Los PDF originales y las anotaciones no se modificarán.'
    :'Vols eliminar les còpies sense connexió? Els PDF originals i les anotacions no es modificaran.');
   if(!confirmed)break;
   try{await linkedLocal.clearOffline();render();
    toast(state.lang==='es'?'Copias locales eliminadas.':'Còpies locals eliminades.');}
   catch(error){toast(error?.message||String(error),true);}
   break;
  }
  case 'source-fallback':$('#source-folder-input')?.click();break;
  case 'drive-open':{
   if(state.view||viewerPendingOpen)break;
   state.modal='drive-browser';render();
   await driveBrowser.open();break;
  }
  case 'drive-close':state.modal=null;render();break;
  case 'drive-save-client':case 'drive-connect':case 'drive-disconnect':
  case 'drive-open-folder':case 'drive-enter':case 'drive-back':case 'drive-import':{
   if(state.modal!=='drive-browser')break;
   try{await driveBrowser.action(action,val);}
   catch(error){toast(error?.message||String(error),true);}
   break;
  }
  case 'paper-setup':
   state.paperEditRole=null;state.paperFolderSearch='';state.modal='paper-setup';render();break;
  case 'paper-close':
   state.paperEditRole=null;state.paperFolderSearch='';state.modal=null;render();break;
  case 'paper-help':state.modal='paper-help';render();break;
  case 'paper-help-close':state.modal='paper-setup';render();break;
  case 'paper-choose':{
   const id=Number(val);
   if(!state.paperConfig.roles.some(r=>r.id===id))break;
   state.paperEditRole=id;state.paperFolderSearch='';render();break;
  }
  case 'paper-cancel-choose':state.paperEditRole=null;state.paperFolderSearch='';render();break;
  case 'paper-add':{
   const added=addPaperRole(state.paperConfig);
   state.paperConfig=added.config;
   state.paperEditRole=added.id;state.paperFolderSearch='';
   await storePaperConfig();render();break;
  }
  case 'paper-set-folder':{
   const role=state.paperEditRole,path=String(val||'');
   if(!state.paperConfig.roles.some(r=>r.id===role)||!paperFolders().includes(path)){
    toast(state.lang==='es'?'Carpeta no disponible.':'Carpeta no disponible.',true);break;
   }
   state.paperConfig=assignPaper(state.paperConfig,role,path);
   state.paper=roleKey(role);state.paperEditRole=null;state.paperFolderSearch='';
   state.cwd=[];state.search='';clearAdvancedSearch();state.indexCollapsed.clear();
   state.page='library';
   await storePaperConfig();await setLibraryPref('paper',state.paper);render();break;
  }
  case 'paper-unassign':{
   const role=Number(val);
   if(!state.paperConfig.roles.some(r=>r.id===role))break;
   state.paperConfig=assignPaper(state.paperConfig,role,null);
   state.paper=resolvePaper(state.paperConfig,state.paper,paperFolders());
   state.cwd=[];state.paperEditRole=null;state.paperFolderSearch='';
   await storePaperConfig();await setLibraryPref('paper',state.paper);render();break;
  }
  case 'paper-remove-ask':{
   const role=Number(val);if(role<3||!state.paperConfig.roles.some(r=>r.id===role))break;
   state.paperRemoveRole=role;state.modal='paper-remove';render();break;
  }
  case 'paper-remove-cancel':state.paperRemoveRole=null;state.modal='paper-setup';render();break;
  case 'paper-remove-confirm':{
   const role=state.paperRemoveRole;
   if(role>=3&&state.paperConfig.roles.some(r=>r.id===role)){
    state.paperConfig=removePaperRole(state.paperConfig,role);
    state.paper=resolvePaper(state.paperConfig,state.paper,paperFolders());
    if(state.paperEditRole===role)state.paperEditRole=null;
    state.cwd=[];state.indexCollapsed.clear();
    await storePaperConfig();await setLibraryPref('paper',state.paper);
   }
   state.paperRemoveRole=null;state.modal='paper-setup';render();break;
  }
  case 'crumb':state.cwd=state.cwd.slice(0,Number(val));state.search='';render();break;
  case 'folder':state.cwd.push(val);state.search='';render();break;
  case 'import':
   if(linkedMode()){toast(state.lang==='es'?'Para crear partituras directamente en esta carpeta, utiliza Escanear. Para añadir archivos existentes, usa el gestor de archivos y actualiza la biblioteca.':'Per a crear partitures directament en esta carpeta, utilitza Escanejar. Per a afegir arxius existents, usa el gestor d’arxius i actualitza la biblioteca.');break;}
   if(!(state.page==='add'&&scanner.busy))$('#import-input').click();break;
  case 'backup-create':await doBackup();break;
  case 'backup-choose':$('#restore-input').click();break;
  case 'backup-save':saveBackup();break;
  case 'backup-share':await shareBackup();break;
  case 'restore-merge':await doRestore('merge');break;
  case 'restore-replace':await doRestore('replace');break;
  case 'linked-restore-merge':await doRestoreLinked('merge');break;
  case 'linked-restore-replace':await doRestoreLinked('replace');break;


  case 'organize-open':{
    if(state.modal!=='metadata-edit'||!scorePaths().has(state.metaPath))break;
    state.organizePath=state.metaPath;state.organizeBusy=false;state.modal='score-organize';
    render();$('#organize-name')?.focus();break;
  }
  case 'organize-back':{
    if(state.modal!=='score-organize'||state.organizeBusy)break;
    state.modal='metadata-edit';state.organizePath=null;render();break;
  }
  case 'organize-save':{
    if(state.modal!=='score-organize'||state.organizeBusy||!scorePaths().has(state.organizePath))break;
    const original=state.organizePath;
    let destination;
    try{
      destination=targetScorePath({
        name:$('#organize-name')?.value||'',
        folder:$('#organize-folder')?.value||'',
        newFolder:$('#organize-new-folder')?.value||''
      });
    }catch(error){toast(error.message,true);break;}
    if(destination===original){
      toast(state.lang==='es'?'No hay cambios en la partitura.':'No hi ha canvis en la partitura.');
      state.modal='metadata-edit';state.organizePath=null;render();break;
    }
    state.organizeBusy=true;el.disabled=true;
    try{
      await moveScoreSafely(original,destination);
      pdfThumbnails.invalidate(original);
      state.scores=await activeScoreIndex();
      await reloadCollections();
      if(state.backup?.url)URL.revokeObjectURL(state.backup.url);
      state.backup=null;
      state.pickerPath=state.pickerPath===original?destination:state.pickerPath;
      state.repAddChosen=state.repAddChosen.map(p=>p===original?destination:p);
      const folder=scoreFolder(destination);
      setPaperCwdForFolder(folder);
      await setLibraryPref('paper',state.paper);
      state.search='';clearAdvancedSearch();
      state.indexCollapsed.clear();
      state.modal=null;state.metaPath=null;state.organizePath=null;
      state.page='library';
      toast((state.lang==='es'?'Partitura organizada: ':'Partitura organitzada: ')+destination);
    }catch(error){
      toast((state.lang==='es'?'No se ha podido mover la partitura: ':'No s’ha pogut moure la partitura: ')+(error?.message||String(error)),true);
    }finally{
      state.organizeBusy=false;render();updateStorageInfo();
    }
    break;
  }
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
    if(linkedMode())await updateLinkedMetadata(state.metaPath,data);
    else await setScoreMetadata(state.metaPath,data);
    state.scores=await activeScoreIndex();
    // Una còpia ZIP preparada abans del canvi ja no està actualitzada.
    if(state.backup?.url)URL.revokeObjectURL(state.backup.url);
    state.backup=null;state.metaPath=null;state.modal=null;
    render();toast(tr('metadataSaved'));break;
  }
  case 'favorite':{
   if(!scorePaths().has(val))break;
   state.favorites=state.favorites.includes(val)?state.favorites.filter(p=>p!==val):[...state.favorites,val];
   await setLibraryPref('w13:favorites',state.favorites);render();break;
  }
  case 'rep-create':state.modal='rep-name';state.modalRepId=null;render();$('#rep-name-input')?.focus();break;
  case 'rep-back':state.repertoireOpen=null;state.search='';clearAdvancedSearch();render();break;
  case 'rep-open':state.repertoireOpen=el.dataset.id;state.search='';clearAdvancedSearch();render();break;
  case 'rep-duplicate':{
    const source=findRepertoire(el.dataset.id);
    if(!source)break;
    const uid=typeof crypto.randomUUID==='function'?crypto.randomUUID().replace(/-/g,'').slice(0,24):Date.now().toString(36)+Math.random().toString(36).slice(2);
    const copy=duplicatedRepertoire(source,state.repertoires,{id:'rep_'+uid});
    state.repertoires=[...state.repertoires,copy];
    await setLibraryPref('w13:repertoires',state.repertoires);
    state.repertoireOpen=copy.id;state.search='';clearAdvancedSearch();
    render();toast(state.lang==='es'?'Repertorio duplicado: '+copy.name:'Repertori duplicat: '+copy.name);
    break;
  }
  case 'rep-start':await startPerformance(el.dataset.id);break;
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
   await setLibraryPref('w13:repertoires',state.repertoires);
   state.modal=null;state.modalRepId=null;state.pickerPath=null;render();toast(tr('repertoireSaved'));break;
  }
  case 'rep-confirm-delete':{
   state.repertoires=state.repertoires.filter(r=>r.id!==state.modalRepId);
   if(state.repertoireOpen===state.modalRepId)state.repertoireOpen=null;
   state.modalRepId=null;state.modal=null;await setLibraryPref('w13:repertoires',state.repertoires);render();toast(tr('repertoireRemoved'));break;
  }
  case 'rep-pick':{
   if(!scorePaths().has(val))break;
   state.pickerPath=val;
   if(state.repertoires.length===1){
    const r=state.repertoires[0];
    if(!r.paths.includes(val)){r.paths.push(val);await setLibraryPref('w13:repertoires',state.repertoires);toast(tr('repertoireAdded'));}
    state.pickerPath=null;render();break;
   }
   state.modal=state.repertoires.length?'rep-picker':'rep-name';state.modalRepId=null;
   render();if(state.modal==='rep-name')$('#rep-name-input')?.focus();break;
  }
  case 'rep-choose':{
   const r=findRepertoire(el.dataset.id),path=state.pickerPath;
   if(r&&scorePaths().has(path)&&!r.paths.includes(path)){r.paths.push(path);await setLibraryPref('w13:repertoires',state.repertoires);toast(tr('repertoireAdded'));}
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
    await setLibraryPref('w13:repertoires',state.repertoires);
    state.modal=null;state.repAddSearch='';state.repAddChosen=[];
    state.search='';render();toast(`${newPaths.length} ${tr('repAddSuccess')}`);break;
  }
  case 'rep-remove-score':{
   const r=findRepertoire(el.dataset.id);if(!r)break;
   r.paths=r.paths.filter(p=>p!==val);await setLibraryPref('w13:repertoires',state.repertoires);render();toast(tr('repertoireRemovedScore'));break;
  }
  case 'rep-up':case 'rep-down':{
   const r=findRepertoire(el.dataset.id);if(!r)break;
   const i=r.paths.indexOf(val),j=i+(action==='rep-up'?-1:1);
   if(i<0||j<0||j>=r.paths.length)break;
   [r.paths[i],r.paths[j]]=[r.paths[j],r.paths[i]];
   await setLibraryPref('w13:repertoires',state.repertoires);render();break;
  }
  case 'open':{
    if(state.page==='repertoires'&&state.repertoireOpen){
      await startPerformance(state.repertoireOpen,val);
    }else{
      state.performance=null;
      await openPdf(val);
    }
    break;
  }
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
   case 'annotation-redo':scoreViewer?.redoAnnotation();syncViewerControls();break;
   case 'annotation-clear':if(scoreViewer?.hasPageAnnotations()){state.modal='annotation-clear';render();}break;
   case 'annotation-clear-confirm':if(state.modal==='annotation-clear'){scoreViewer?.clearPageAnnotations();state.modal=null;render();}break;
   case 'viewer-close':closeViewer();break;
  case 'viewer-page-prev':await scoreViewer?.turnPage(-1);break;
  case 'viewer-page-next':await scoreViewer?.turnPage(1);break;
  case 'viewer-zoom-in':if(scoreViewer)await scoreViewer.setZoom(scoreViewer.zoom*1.25);break;
  case 'viewer-zoom-out':if(scoreViewer)await scoreViewer.setZoom(scoreViewer.zoom/1.25);break;
  case 'viewer-fit':if(scoreViewer)await scoreViewer.setFit(scoreViewer.fit==='page'?'width':'page');break;
  case 'viewer-repair-open':{
   if(!scoreViewer?.page||scoreViewer.native||state.annotating||scoreViewer.inlineSession)break;
   pageRepairDialog?.close();
   pageRepairDialog=new PageRepairDialog({
     viewer:scoreViewer,language:state.lang,
     onClose:()=>{pageRepairDialog=null;},
     onApplied:all=>toast(state.lang==='es'?(all?'Ajustes aplicados a todo el PDF.':'Página ajustada.'):(all?'Ajustos aplicats a tot el PDF.':'Pàgina ajustada.'))
   });
   pageRepairDialog.open();
   break;
  }
  case 'viewer-rotate':await scoreViewer?.rotate();if(state.view)pdfThumbnails.invalidate(state.view.path);break;
   case 'viewer-auto-rotate':await scoreViewer?.useAutomaticRotation();if(state.view)pdfThumbnails.invalidate(state.view.path);break;
  case 'viewer-settings-reset':{
    if(state.page!=='settings'||state.view)break;
    state.viewerSettingsDraft=normalizeViewerSettings(VIEWER_SETTINGS_DEFAULTS);
    render();updateViewerSettingsPreview(state.viewerSettingsDraft);
    break;
  }
  case 'viewer-settings-save':{
    if(state.page!=='settings'||state.view)break;
    const settings=normalizeViewerSettings(state.viewerSettingsDraft||state.viewerSettings);
    await setPref(VIEWER_SETTINGS_KEY,settings);
    state.viewerSettings=settings;state.viewerSettingsDraft=null;
    render();toast(state.lang==='es'?'Ajustes del visor guardados.':'Ajustos del visor guardats.');
    break;
  }
  case 'viewer-score-picker':{
    if(!state.view||!scoreViewer||state.modal||state.annotating||scoreViewer.inlineSession)break;
    const scores=viewerScoreRecords();
    viewerScorePicker.open({
      scores,currentPath:state.view.path,language:state.lang,
      sequenceName:state.performance?.name||'',titleFor:scoreDisplayTitle
    });
    break;
  }
  case 'viewer-edge-prev':case 'viewer-edge-next':{
    if(!state.view||!scoreViewer||scoreViewer.native||state.annotating||state.modal||scoreViewer.inlineSession)break;
    await scoreViewer.turnPage(action==='viewer-edge-prev'?-1:1);
    break;
  }
  case 'viewer-zen':showViewerMenu(state.annotating?true:state.zen);break;
  case 'viewer-prev':case 'viewer-next':await changeViewerScore(action==='viewer-prev'?-1:1);break;
  case 'viewer-external':if(state.blobUrl){const anchor=document.createElement('a');anchor.href=state.blobUrl;anchor.target='_blank';anchor.rel='noopener';anchor.click();}break;
  case 'delete-one':
   if(linkedMode()){toast(state.lang==='es'?'Los PDF vinculados solo se pueden borrar desde el gestor de archivos original.':'Els PDF vinculats només es poden esborrar des del gestor d’arxius original.',true);break;}
   state.modal='delete-one';render();break;
  case 'clear':
   if(linkedMode()){toast(state.lang==='es'?'La carpeta vinculada no puede borrarse desde aquí.':'La carpeta vinculada no es pot esborrar des d’ací.',true);break;}
   state.modal='clear';render();break;
  case 'close-modal':
    if(state.modal==='annotation-text')scoreViewer?.setAnnotationTool('select');
    scoreViewer?.discardPendingTextBox();state.modal=null;state.textDraft=null;state.metaPath=null;state.organizePath=null;state.modalRepId=null;state.pickerPath=null;state.repAddSearch='';state.repAddChosen=[];state.restore=null;state.restoreTargetId=null;render();break;
  case 'confirm-delete-one':{
    if(linkedMode())break;
    const path=state.view?.path;if(path)await deleteScore(path);
    state.scores=await activeScoreIndex();await reloadCollections();await persistCollections();validPaperSelection();await setLibraryPref('paper',state.paper);state.cwd=[];state.modal=null;closeViewer();updateStorageInfo();toast(tr('removed'));break;
  }
  case 'confirm-clear':if(linkedMode())break;await clearScores();state.scores=[];state.favorites=[];state.recents=[];state.repertoires=[];state.repertoireOpen=null;await persistCollections();state.paper='root';state.cwd=[];await setLibraryPref('paper','root');state.modal=null;if(state.view)closeViewer();else closeViewerIfNeeded();render();updateStorageInfo();toast(tr('allRemoved'));break;
  case 'welcome-done':state.modal=null;await setPref('lang',state.lang);render();break;
 }
}
function closeViewerIfNeeded(keepLandscape=false){
 pageRepairDialog?.close();pageRepairDialog=null;
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
  state.autoCheck=(await getPref('w223:autoCheck',true))!==false;
  state.thumbnailEnabled=(await getPref('w2142:thumbnailsEnabled',true))!==false;
  state.viewerSettings=normalizeViewerSettings(await getPref(VIEWER_SETTINGS_KEY,VIEWER_SETTINGS_DEFAULTS));
  try{await linkedLocal.restore();}catch(error){console.warn('Carpeta vinculada:',error);}
  const requestedSource=await getPref('w222a:source','imported');
  state.source=requestedSource==='linked'&&linkedLocal.exists?'linked':'imported';
  if(linkedMode()&&!linkedLocal.cached){
   // Primer ús (sense índex guardat): només ara escanegem la carpeta.
   // En les següents obertures carreguem el catàleg persistit
   // immediatament i no tornem a visitar tots els PDF.
   try{await linkedLocal.scan({ask:false});}
   catch(error){console.warn('Índex de carpeta vinculada:',error);}
  }
  state.scores=await activeScoreIndex();
  await reloadCollections();
  await loadPaperConfig();
  const savedGroup=await getLibraryPref('w13c:indexGroupBy','folder'),savedSort=await getLibraryPref('w13c:indexSortBy','title');
  state.indexGroupBy=INDEX_GROUP_MODES.includes(savedGroup)?savedGroup:'folder';
  state.indexSortBy=INDEX_SORT_MODES.includes(savedSort)?savedSort:'title';
  validPaperSelection();
  const savedLocation=validateNavigation(readNavigation(navigationStorage),{
   scores:state.scores,repertoires:state.repertoires,paper:state.paper,paperBase:selectedPaperBase()
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
  // El catàleg ja és visible: comprovem de seguida l'origen, sense
  // llegir els PDF. Si Chrome revoca el permís, mostrem Activar biblioteca.
  scheduleAutoCheck();
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
document.addEventListener('keydown',e=>{
 if(!state.view||!state.annotating||!scoreViewer||scoreViewer.inlineSession||state.modal)return;
 if(e.target?.closest?.('input,textarea,select,[contenteditable]'))return;
 if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
 if(e.key.toLowerCase()==='z'){
  if(e.shiftKey)scoreViewer.redoAnnotation();else scoreViewer.undoAnnotation();
  e.preventDefault();e.stopPropagation();syncViewerControls();
 }else if(e.key.toLowerCase()==='y'){
  scoreViewer.redoAnnotation();e.preventDefault();e.stopPropagation();syncViewerControls();
 }
});
document.addEventListener('dblclick',e=>{
 // El doble toc correspon exclusivament a ScoreViewer.pointerUp.
 if(e.target.closest?.('#viewer-stage')&&!e.target.closest?.('.pf-inline-text-editor'))e.preventDefault();
});

document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){e.preventDefault();handleClick(b).catch(err=>{
 console.error(err);
 // Error del navegador llegint una partitura: no és una importació.
 const isOpen=['open','viewer-next-score','viewer-prev-score'].includes(b.dataset.action);
 // Si la lectura individual ha fallat per permís, mostrar immediatament
 // l'opció d'activació al costat del nom de la carpeta.
 if(isOpen&&linkedMode()&&!state.view&&linkedLocal.checkState==='unavailable')render();
 toast(isOpen?err.message:`${tr('error')} ${err.message}`,true);
});}});
document.addEventListener('input',e=>{
 if(state.modal==='drive-browser'&&['drive-client-id','drive-folder-ref'].includes(e.target?.id)){
  driveBrowser.update(e.target.id,e.target.value);return;
 }
 if(state.modal==='paper-setup'&&e.target?.id==='paper-folder-search'){
  state.paperFolderSearch=e.target.value;
  const choices=$('#paper-folder-choices');
  if(choices)choices.innerHTML=renderPaperFolderChoices(paperFolders(),state.paperConfig,state.paperEditRole,state.paperFolderSearch,state.lang);
  return;
 }
 if(e.target?.dataset?.viewerSetting){
   const key=e.target.dataset.viewerSetting;
   if(!Object.hasOwn(VIEWER_SETTINGS_DEFAULTS,key))return;
   const draft=state.viewerSettingsDraft||normalizeViewerSettings(state.viewerSettings);
   const raw=e.target.type==='checkbox'?e.target.checked:Number(e.target.value);
   state.viewerSettingsDraft=normalizeViewerSettings({...draft,[key]:raw});
   updateViewerSettingsPreview(state.viewerSettingsDraft);
   const message=document.getElementById('pf-vs-status');
   if(message)message.textContent=state.lang==='es'?'Cambios pendientes: pulsa Guardar cambios.':'Canvis pendents: prem Guardar canvis.';
   return;
 }
 if(state.modal==='score-organize'&&['organize-name','organize-folder','organize-new-folder'].includes(e.target?.id)){
  updateOrganizePreview(state.lang);return;
 }
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
 if(e.target?.id==='source-folder-input'){
  const files=[...e.target.files];e.target.value='';
  importFolderSnapshot(files).catch(error=>{console.error(error);toast(error?.message||String(error),true);});
  return;
 }
 if(e.target.id==='thumbnail-enabled'){
  state.thumbnailEnabled=!!e.target.checked;
  setPref('w2142:thumbnailsEnabled',state.thumbnailEnabled).catch(error=>console.warn('Miniatures:',error));
  render();return;
 }
 if(state.modal==='score-organize'&&e.target?.id==='organize-folder'){
  updateOrganizePreview(state.lang);return;
 }
 if(state.page==='add'){
  if(e.target.id==='scan-camera-input'||e.target.id==='scan-gallery-input'){
   scanner.addImages(e.target.files);e.target.value='';return;
  }
  if(e.target.dataset?.scanFilter){
   scanner.setFilter(e.target.dataset.scanFilter,e.target.value);return;
  }
  if(['scan-folder','scan-new-folder','scan-rep'].includes(e.target.id)){
   scanner.updateField(e.target.id,e.target.value);return;
  }
  if(e.target.id==='scan-to-rep'){scanner.updateField('scan-to-rep',e.target.checked);return;}
 }
 if(e.target.id==='metro-bpm'&&state.page==='tools'&&state.toolTab==='metronome'&&!state.view)metronome.updateBpm(e.target.value,{commit:true});
  if(e.target.id==='tuner-reference'&&state.page==='tools'&&state.toolTab==='tuner'&&!state.view)tuner.setReference(e.target.value,{save:true});
   if(e.target.id==='dictation-instrument'&&state.page==='tools'&&state.toolTab==='dictation'&&!state.view)dictation.setInstrument(e.target.value);
 if(e.target.id==='index-group-by'&&INDEX_GROUP_MODES.includes(e.target.value)){
  state.indexGroupBy=e.target.value;state.indexCollapsed.clear();
  setLibraryPref('w13c:indexGroupBy',state.indexGroupBy).catch(err=>console.warn(err));render();
 }
 if(e.target.id==='index-sort-by'&&INDEX_SORT_MODES.includes(e.target.value)){
  state.indexSortBy=e.target.value;
  setLibraryPref('w13c:indexSortBy',state.indexSortBy).catch(err=>console.warn(err));render();
 }
 if(e.target.id==='annotation-width'&&scoreViewer?.annotationMode){scoreViewer.setAnnotationThickness(e.target.value);render();}
 if(e.target.id==='annotation-shape-fill'&&scoreViewer?.annotationMode){scoreViewer.setShapeFillOpacity(e.target.value);render();}
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
document.addEventListener('visibilitychange',()=>{void viewerWakeLock.onVisibilityChange();});
window.addEventListener('pagehide',()=>{
   driveBrowser.reader.token=null;driveBrowser.reader.expiresAt=0;
   void viewerWakeLock.setEnabled(false);
   pdfThumbnails.pause();
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
  if(event.persisted)scheduleAutoCheck();
 });
 let scrollTimer=0;
 window.addEventListener('scroll',()=>{
  if(state.view)return;
  clearTimeout(scrollTimer);
  scrollTimer=setTimeout(rememberScroll,120);
 },{passive:true});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
  if(metronome.running||metronome.pending)metronome.stop();
  if(tuner.running||tuner.pending)tuner.stop();
  if(referenceTone.running||referenceTone.pending)referenceTone.stop();
  if(dictation.running||dictation.pending)dictation.stop();
 }else scheduleAutoCheck();
});
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