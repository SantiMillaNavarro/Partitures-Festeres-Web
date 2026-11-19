/* W2.22A — Biblioteca real vinculada a una carpeta local.
   Lectura directa i de només lectura; mai escriu, mou o esborra PDFs.
   Les referències FileSystemDirectoryHandle es guarden en IndexedDB,
   no el contingut dels documents. Permisos sempre controlats per l'usuari. */
const LINK_DB='partitures-festeres-linked-w222a',LINK_KEY='active',MAX_PDFS=10000,MAX_FOLDERS=4000,MAX_DEPTH=30;
let dbPromise;
function openLinkDB(){
 if(dbPromise)return dbPromise;
 if(!globalThis.indexedDB)return Promise.reject(Error('IndexedDB no disponible.'));
 dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(LINK_DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('roots'))req.result.createObjectStore('roots',{keyPath:'key'});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('No es pot obrir la biblioteca vinculada.'));
  req.onblocked=()=>reject(Error('Tanca les altres pestanyes de Partitures Festeres.'));
 }).catch(error=>{dbPromise=null;throw error;});
 return dbPromise;
}
async function inRootStore(mode,callback){
 const db=await openLinkDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('roots',mode),req=callback(tx.objectStore('roots'));
  let value;
  if(req){req.onsuccess=()=>{value=req.result;};req.onerror=()=>{try{tx.abort();}catch{}};}
  tx.oncomplete=()=>resolve(value);
  tx.onerror=()=>reject(tx.error||Error('No s’han pogut guardar les dades de la carpeta.'));
  tx.onabort=()=>reject(tx.error||Error('Operació de carpeta cancel·lada.'));
 });
}
export const linkSupported=()=>typeof window!=='undefined'&&window.isSecureContext&&typeof window.showDirectoryPicker==='function';
export const validLocalPart=part=>typeof part==='string'&&part.length>0&&part.length<=180&&part!=='.'&&part!=='..'&&!/[\/\\\u0000-\u001f\u007f]/.test(part);
const natural=(a,b)=>String(a).localeCompare(String(b),'ca',{numeric:true,sensitivity:'base'});
export function validateLinkedPath(path){
 return typeof path==='string'&&path.length<=500&&/\.pdf$/i.test(path)&&
 path.split('/').every(validLocalPart)&&/\.pdf$/i.test(path);
}
export async function scanLinkedDirectory(root,{maxFiles=MAX_PDFS,maxFolders=MAX_FOLDERS,maxDepth=MAX_DEPTH}={}){
 if(!root||root.kind!=='directory'||(typeof root.entries!=='function'&&typeof root.values!=='function'))
  throw Error('El navegador no permet examinar esta carpeta. Torna a triar-la o utilitza la importació de carpeta.');
 const records=[],folders=[],fileHandles=new Map(),visited=new Set();
 async function visit(directory,segments,depth){
  if(depth>maxDepth)throw Error('Hi ha massa nivells de subcarpetes.');
  const entries=[];
  if(typeof directory.entries==='function'){
   for await(const entry of directory.entries())entries.push(entry);
  }else if(typeof directory.values==='function'){
   for await(const handle of directory.values())entries.push([handle.name,handle]);
  }else throw Error('No es poden llegir les subcarpetes d’este proveïdor.');
  entries.sort((a,b)=>natural(a[0],b[0]));
  for(const [name,handle] of entries){
   if(!validLocalPart(name)||!handle||!['file','directory'].includes(handle.kind))continue;
   const path=[...segments,name].join('/');
   if(path.length>500)continue;
   if(handle.kind==='directory'){
    if(visited.has(handle))continue;
    if(++count.folders>maxFolders)throw Error('La carpeta té massa subcarpetes; selecciona una arrel més concreta.');
    folders.push(path);visited.add(handle);
    await visit(handle,[...segments,name],depth+1);
   }else if(/\.pdf$/i.test(name)&&validateLinkedPath(path)){
    if(++count.files>maxFiles)throw Error('La carpeta té massa PDF; selecciona una arrel més concreta.');
    try{
     // getFile() obté únicament les metadades i un File handle:
     // no es copia el contingut complet a la base de dades.
     const file=await handle.getFile();
     if(!file||!Number.isFinite(file.size))continue;
     records.push({path,size:file.size,added:file.lastModified||0});
     fileHandles.set(path,handle);
    }catch(error){
     // Un document inaccesible no ha de descartar tota la biblioteca.
     count.unreadable++;
    }
   }
  }
 }
 const count={files:0,folders:0,unreadable:0};
 visited.add(root);await visit(root,[],0);
 records.sort((a,b)=>natural(a.path,b.path));
 folders.sort(natural);
 return {scores:records,folders,files:fileHandles,unreadable:count.unreadable};
}
export class LinkedLocalLibrary{
 constructor(){
  this.id=null;this.name='';this.handle=null;
  this.scores=[];this.folders=[];this.files=new Map();this.unreadable=0;
  this.status='none';this.error='';
 }
 get exists(){return !!this.handle&&!!this.id;}
 get ready(){return this.status==='ready';}
 async restore(){
  const saved=await inRootStore('readonly',store=>store.get(LINK_KEY));
  if(saved?.id&&saved?.handle?.kind==='directory'){
   this.id=saved.id;this.name=saved.name||saved.handle.name||'Biblioteca';
   this.handle=saved.handle;this.status='permission';this.error='';
   return true;
  }
  return false;
 }
 async save(handle){
  if(!handle||handle.kind!=='directory')throw Error('La selecció no és una carpeta.');
  const old={id:this.id,name:this.name,handle:this.handle,status:this.status,scores:this.scores,folders:this.folders,files:this.files};
  // En tornar a seleccionar la mateixa carpeta, conservem la identitat i
  // per tant també els favorits, anotacions i repertoris associats.
  let sameEntry=false;
  if(old.handle&&typeof old.handle.isSameEntry==='function'){
   try{sameEntry=await old.handle.isSameEntry(handle);}
   catch{/* La identitat no es pot assegurar. */}
  }
  this.id=sameEntry&&old.id?old.id:'folder-'+(typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
  this.name=handle.name||'Biblioteca';this.handle=handle;this.status='permission';
  this.scores=[];this.folders=[];this.files=new Map();
  try{await inRootStore('readwrite',store=>store.put({key:LINK_KEY,id:this.id,name:this.name,handle}));}
  catch(error){
   Object.assign(this,old);
   throw Error('No es pot recordar esta carpeta. '+error.message);
  }
  return this.id;
 }
 // IMPORTANT: showDirectoryPicker must be executed synchronously in the
 // click handler before the first await, otherwise user activation is lost.
 choose(){
  if(!linkSupported())throw Error('Este navegador no permet vincular carpetes locals. Prova Chrome o Edge actualitzat, o importa una carpeta.');
  return window.showDirectoryPicker({id:'partitures-festeres',mode:'read'}).then(async handle=>{
   await this.save(handle);
   return this.scan({ask:false});
  });
 }
 scan({ask=false}={}){
  if(!this.exists)return Promise.reject(Error('Selecciona una carpeta abans de continuar.'));
  // En Android/SAF, el selector pot funcionar encara que queryPermission()
  // o requestPermission() no estiguen implementats. La prova fiable és
  // enumerar la carpeta real, no exigir una resposta 'granted'.
  // requestPermission() s'ha d'invocar síncronament des del clic de l'usuari.
  let permission;
  try{
   if(ask&&typeof this.handle.requestPermission==='function')
    permission=this.handle.requestPermission({mode:'read'});
   else if(typeof this.handle.queryPermission==='function')
    permission=this.handle.queryPermission({mode:'read'});
   else permission='unsupported';
  }catch(error){
   console.warn('API de permisos no disponible:',error);
   permission='unsupported';
  }
  this.status='scanning';this.error='';
  return Promise.resolve(permission).catch(error=>{
   console.warn('API de permisos no disponible:',error);
   return 'unsupported';
  }).then(async status=>{
   // La denegació explícita d'un requeriment de permís és definitiva.
   if(ask&&status==='denied'){
    this.status='permission';this.scores=[];this.folders=[];this.files=new Map();
    this.error='El navegador no ha concedit l’accés. Torna a seleccionar la carpeta.';
    return false;
   }
   // Els estats 'prompt' i 'unsupported' no són sempre fiables en Android:
   // provem només la lectura d'entries(), mai l'escriptura.
   try{
    const listing=await scanLinkedDirectory(this.handle);
    this.scores=listing.scores;this.folders=listing.folders;this.files=listing.files;
    this.unreadable=listing.unreadable;this.status='ready';this.error='';
    return true;
   }catch(error){
    this.scores=[];this.folders=[];this.files=new Map();
    if(error?.name==='NotAllowedError'||error?.name==='SecurityError'){
     this.status='permission';
     this.error=typeof this.handle.requestPermission==='function'
      ?'El navegador ha bloquejat la lectura. Prem Autoritzar lectura o torna a seleccionar la carpeta.'
      :'No es pot llegir esta carpeta. Prem Canviar carpeta i selecciona-la de nou.';
     return false;
    }
    this.status='error';
    this.error=error?.message||String(error);
    throw error;
   }
  });
 }
 async getScore(path){
  if(!this.ready)throw Error('La carpeta no està autoritzada. Torna a donar permís des de Biblioteca.');
  if(!validateLinkedPath(path))return null;
  const handle=this.files.get(path);if(!handle)return null;
  try{
   const file=await handle.getFile();
   return {path,size:file.size,added:file.lastModified||0,blob:file};
  }catch(error){
   throw Error('No es pot llegir '+path+'. Actualitza la biblioteca o revisa els permisos.');
  }
 }
 async forget(){
  await inRootStore('readwrite',store=>store.delete(LINK_KEY));
  this.id=null;this.name='';this.handle=null;this.scores=[];this.folders=[];
  this.files=new Map();this.status='none';this.error='';
 }
}
