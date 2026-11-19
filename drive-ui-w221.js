/* Partitures Festeres Web W2.21 — optional Drive connection UI.
   The remote library remains read-only; imported PDFs become local, independent copies. */
import {
 DRIVE_CLIENT_KEY,DRIVE_FOLDER_KEY,DRIVE_FOLDER_MIME,DRIVE_MAX_PDF_BYTES,
 validOAuthClientId,parseDriveFolderReference,isPdfDriveFile,DriveReadOnly,
 localDrivePath,availableDrivePath
} from './drive-w221.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compare=(a,b)=>String(a).localeCompare(String(b),'ca',{numeric:true,sensitivity:'base'});
const bytes=n=>Number(n)>1024*1024?(Number(n)/1048576).toFixed(1)+' MB':Number(n)>1024?Math.ceil(Number(n)/1024)+' KB':'';
const labels={
 va:{
  title:'Google Drive · consulta segura',subtitle:'Connexió opcional de només lectura: no esborra, renomena ni canvia cap fitxer de Drive.',
  oauth:'Identificador de client OAuth 2.0 (web)',save:'Guardar identificador',
  oauthHelp:'És un identificador públic, no una contrasenya. Cal crear-lo a Google Cloud i autoritzar l’origen web que apareix davall.',
  origin:'Origen JavaScript que has d’autoritzar a Google Cloud',
  folder:'Enllaç o identificador de la carpeta de Google Drive',
  folderHelp:'Pots copiar l’enllaç de Compartir > Copiar enllaç o el seu identificador. La carpeta ha d’estar disponible per al compte autoritzat.',
  start:'Preparant Google…',ready:'Google preparat',noInternet:'Cal connexió a Internet',connect:'Connectar amb Google',disconnect:'Desconnectar i revocar accés',
  open:'Obrir carpeta',back:'Tornar',close:'Tancar',import:'Baixar',busy:'Consultant…',
  connected:'Sessió de lectura activa',disconnected:'No connectat',pdf:'PDF',
  empty:'Esta carpeta no conté PDF ni subcarpetes.',noFolder:'Tria i obri una carpeta de Drive per a vore’n els continguts.',
  loaded:'Descarregada a Biblioteca',warning:'Els PDF baixats són còpies locals. Els canvis de Drive i les anotacions no se sincronitzen encara.',
  scope:'Google demanarà autorització per a llegir els fitxers del teu Drive (permís drive.readonly). Google pot requerir una verificació del projecte OAuth.',
  guide:'Com configurar l’accés',guideText:'En Google Cloud: activa Google Drive API; configura la pantalla de consentiment OAuth; crea un Client ID de tipus Aplicació web i afegix l’origen JavaScript indicat. Si el projecte està en mode prova, afig el teu compte com a usuari de prova. Copia ací el Client ID, mai el secret.',
  move:'Selecciona la carpeta',source:'Carpeta',offline:'Disponible en Biblioteca sense Internet després de baixar-la.',
  notSaved:'No hi ha un Client ID configurat.',change:'Canviar carpeta'
 },
 es:{
  title:'Google Drive · consulta segura',subtitle:'Conexión opcional de solo lectura: no borra, renombra ni modifica archivos de Drive.',
  oauth:'Identificador de cliente OAuth 2.0 (web)',save:'Guardar identificador',
  oauthHelp:'Es un identificador público, no una contraseña. Debes crearlo en Google Cloud y autorizar el origen web indicado abajo.',
  origin:'Origen JavaScript que debes autorizar en Google Cloud',
  folder:'Enlace o identificador de la carpeta de Google Drive',
  folderHelp:'Copia el enlace de Compartir > Copiar enlace o su identificador. La carpeta debe ser accesible para la cuenta autorizada.',
  start:'Preparando Google…',ready:'Google preparado',noInternet:'Necesita conexión a Internet',connect:'Conectar con Google',disconnect:'Desconectar y revocar acceso',
  open:'Abrir carpeta',back:'Atrás',close:'Cerrar',import:'Descargar',busy:'Consultando…',
  connected:'Sesión de lectura activa',disconnected:'No conectado',pdf:'PDF',
  empty:'Esta carpeta no contiene PDF ni subcarpetas.',noFolder:'Selecciona y abre una carpeta de Drive para ver su contenido.',
  loaded:'Descargada a Biblioteca',warning:'Los PDF descargados son copias locales. Los cambios de Drive y las anotaciones todavía no se sincronizan.',
  scope:'Google solicitará autorización para leer los archivos de tu Drive (permiso drive.readonly). Google puede exigir verificación del proyecto OAuth.',
  guide:'Cómo configurar el acceso',guideText:'En Google Cloud: activa Google Drive API; configura la pantalla de consentimiento OAuth; crea un Client ID de tipo Aplicación web y añade el origen JavaScript indicado. Si el proyecto está en pruebas, añade tu cuenta como usuario de prueba. Copia aquí el Client ID, nunca el secreto.',
  move:'Seleccionar carpeta',source:'Carpeta',offline:'Disponible en Biblioteca sin Internet tras descargarla.',
  notSaved:'No hay Client ID configurado.',change:'Cambiar carpeta'
 }
};
export class DriveBrowser{
 constructor({getPref,setPref,getAllScores,saveBatch,onChange=()=>{},onImported=()=>{},client=null}){
  this.getPref=getPref;this.setPref=setPref;this.getAllScores=getAllScores;this.saveBatch=saveBatch;
  this.onChange=onChange;this.onImported=onImported;this.reader=client||new DriveReadOnly();
  this.clientDraft='';this.folderDraft='';this.savedFolder='';
  this.identity='idle';this.busy=false;this.message='';this.root=null;this.stack=[];this.entries=[];
  this.didLoad=false;this.result=null;
 }
 get authorized(){return this.reader.authorized;}
 update(input,value){
  if(input==='drive-client-id')this.clientDraft=String(value||'').trim();
  if(input==='drive-folder-ref')this.folderDraft=String(value||'').trim();
 }
 notify(){this.onChange();}
 async loadPrefs(){
  if(this.didLoad)return;
  this.clientDraft=String(await this.getPref(DRIVE_CLIENT_KEY,'')||'');
  this.savedFolder=String(await this.getPref(DRIVE_FOLDER_KEY,'')||'');
  this.folderDraft=this.savedFolder;
  if(validOAuthClientId(this.clientDraft))this.reader.setClientId(this.clientDraft);
  this.didLoad=true;this.notify();
 }
 async open(){
  await this.loadPrefs();
  if(this.identity==='ready')return;
  this.identity='loading';this.notify();
  try{await this.reader.prepareIdentity();this.identity='ready';this.message='';}
  catch(error){this.identity='error';this.message=error.message;}
  this.notify();
 }
 async action(action,value){
  if(this.busy)return;
  if(action==='drive-disconnect'){
   this.reader.disconnect();this.root=null;this.stack=[];this.entries=[];this.message='';
   this.notify();return;
  }
  if(action==='drive-save-client'){
   const id=this.clientDraft.trim();
   if(!validOAuthClientId(id))throw Error('Identificador OAuth incorrecte. Ha d’acabar en .apps.googleusercontent.com.');
   const old=this.reader.clientId;this.reader.setClientId(id);
   await this.setPref(DRIVE_CLIENT_KEY,id);
   if(id!==old){this.root=null;this.stack=[];this.entries=[];}
   this.message='Identificador OAuth guardat.';this.notify();return;
  }
  if(action==='drive-connect'){
   // Request popup before updating DOM or awaiting any operation.
   const request=this.reader.connect();
   this.busy=true;this.notify();
   try{
    await request;this.message='Compte de Google connectat per a lectura.';
   }catch(err){this.message=err.message;throw err;}
   finally{this.busy=false;this.notify();}
   return;
  }
  this.busy=true;this.message='';this.notify();
  try{
   if(action==='drive-open-folder'){
    const ref=parseDriveFolderReference(this.folderDraft);
    if(!ref)throw Error('L’enllaç de la carpeta no és vàlid.');
    const root=await this.reader.folder(ref.id,ref.resourceKey);
    const entries=await this.reader.children(root.id,{resourceKey:root.resourceKey});
    this.root=root;this.stack=[root];this.entries=entries;
    this.savedFolder=this.folderDraft;
    await this.setPref(DRIVE_FOLDER_KEY,this.savedFolder);
   }else if(action==='drive-enter'){
    const folder=this.entries.find(e=>e.id===value&&e.mimeType===DRIVE_FOLDER_MIME);
    if(!folder)throw Error('La carpeta ja no està disponible.');
    if(this.stack.length>=25)throw Error('Massa carpetes imbricades.');
    const entries=await this.reader.children(folder.id,{resourceKey:folder.resourceKey||null});
    this.stack=[...this.stack,{id:folder.id,name:folder.name,resourceKey:folder.resourceKey||null}];
    this.entries=entries;
   }else if(action==='drive-back'){
    if(this.stack.length<=1)return;
    const next=this.stack.slice(0,-1),prev=next.at(-1);
    this.entries=await this.reader.children(prev.id,{resourceKey:prev.resourceKey});
    this.stack=next;
   }else if(action==='drive-import'){
    const file=this.entries.find(e=>e.id===value&&isPdfDriveFile(e));
    if(!file||!this.root)throw Error('La partitura de Drive no està disponible.');
    const existing=await this.getAllScores();
    const path=availableDrivePath(localDrivePath(this.root.name,
      this.stack.slice(1).map(s=>s.name),file.name),existing.map(s=>s.path));
    // Copy to local IndexedDB only after a complete validated download.
    const blob=await this.reader.pdf(file);
    // Re-check in case another import completed while downloading.
    const actual=availableDrivePath(path,(await this.getAllScores()).map(s=>s.path));
    await this.saveBatch([{path:actual,blob,size:blob.size,added:Date.now()}]);
    this.result=actual;
    this.message='Partitura baixada: '+actual;
    await this.onImported(actual);
   }
  }catch(error){this.message=error?.message||String(error);throw error;}
  finally{this.busy=false;this.notify();}
 }
 render(lang='va',origin=''){
  const t=labels[lang==='es'?'es':'va'],busy=this.busy;
  const ready=this.identity==='ready';
  const enabled=this.authorized&&!busy;
  const originText=esc(origin);
  const connectButton='<button type="button" class="primary" data-action="drive-connect" '+(ready&&validOAuthClientId(this.reader.clientId)&&!busy?'':'disabled')+'>'+esc(this.authorized?t.connected:t.connect)+'</button>';
  const session=enabled?'<span class="pf-drive-status connected">'+esc(t.connected)+'</span>':
    '<span class="pf-drive-status">'+esc(t.disconnected)+'</span>';
  const rows=this.entries.map(entry=>{
   const folder=entry.mimeType===DRIVE_FOLDER_MIME;
   const disabled=busy||(!folder&&entry.capabilities?.canDownload===false);
   return '<div class="pf-drive-entry"><span class="pf-drive-entry-icon">'+(folder?'📁':'📄')+'</span>'+
    '<span class="pf-drive-entry-title">'+esc(entry.name)+
    (folder?'':'<small>'+t.pdf+' '+bytes(entry.size)+'</small>')+'</span>'+
    '<button type="button" class="secondary" data-action="'+(folder?'drive-enter':'drive-import')+
    '" data-value="'+esc(entry.id)+'" '+(disabled?'disabled':'')+'>'+
    esc(folder?t.move:t.import)+'</button></div>';
  }).join('');
  const crumbs=this.stack.map((folder,i)=>'<span'+(i===this.stack.length-1?' class="current"':'')+'>'+
    esc(folder.name)+'</span>').join(' / ');
  return '<div class="modal-backdrop pf-drive-overlay"><section class="modal pf-drive-modal" role="dialog" aria-modal="true" aria-labelledby="pf-drive-title">'+
   '<div class="pf-drive-header"><h2 id="pf-drive-title">'+esc(t.title)+'</h2>'+
   '<button class="quiet" type="button" data-action="drive-close" aria-label="'+esc(t.close)+'">×</button></div>'+
   '<p class="help">'+esc(t.subtitle)+'</p><details class="pf-drive-help"><summary>'+esc(t.guide)+'</summary>'+
   '<p>'+esc(t.guideText)+'</p><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></details>'+
   '<label for="drive-client-id">'+esc(t.oauth)+'</label>'+
   '<input type="text" id="drive-client-id" value="'+esc(this.clientDraft)+'" autocomplete="off" spellcheck="false" placeholder="1234-xxx.apps.googleusercontent.com" />'+
   '<p class="help">'+esc(t.oauthHelp)+'</p><p class="pf-drive-origin">'+esc(t.origin)+': <code>'+originText+'</code></p>'+
   '<div class="pf-drive-controls"><button type="button" class="secondary" data-action="drive-save-client" '+(busy?'disabled':'')+'>'+esc(t.save)+'</button>'+
   connectButton+session+(this.authorized?'<button type="button" class="quiet" data-action="drive-disconnect">'+esc(t.disconnect)+'</button>':'')+'</div>'+
   '<p class="help">'+esc(t.scope)+'</p>'+
   '<div class="pf-drive-divider"></div>'+
   '<label for="drive-folder-ref">'+esc(t.folder)+'</label>'+
   '<input type="text" id="drive-folder-ref" value="'+esc(this.folderDraft)+'" autocomplete="off" spellcheck="false" placeholder="https://drive.google.com/drive/folders/..." />'+
   '<p class="help">'+esc(t.folderHelp)+'</p>'+
   '<div class="pf-drive-controls"><button type="button" class="primary" data-action="drive-open-folder" '+(enabled?'':'disabled')+'>'+esc(t.open)+'</button>'+
   (this.stack.length>1?'<button type="button" class="secondary" data-action="drive-back" '+(enabled?'':'disabled')+'>'+esc(t.back)+'</button>':'')+'</div>'+
   (this.root?'<p class="pf-drive-breadcrumb">'+crumbs+'</p><div class="pf-drive-entries">'+(rows||'<p class="help">'+esc(t.empty)+'</p>')+'</div>':
     '<p class="help">'+esc(t.noFolder)+'</p>')+
   '<p class="pf-drive-message" role="status">'+esc(this.message||(busy?t.busy:this.identity==='loading'?t.start:this.identity==='ready'?t.ready:this.identity==='error'?t.noInternet:''))+'</p>'+
   (this.result?'<p class="pf-drive-import-ok">✓ '+esc(t.loaded)+': '+esc(this.result)+'</p>':'')+
   '<p class="help pf-drive-warning">'+esc(t.warning)+' '+esc(t.offline)+'</p>'+
   '<div class="modal-actions"><button type="button" class="primary" data-action="drive-close">'+esc(t.close)+'</button></div>'+
   '</section></div>';
 }
}
