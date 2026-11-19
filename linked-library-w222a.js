/* W2.22A — Biblioteca real vinculada a una carpeta local.
   Lectura directa i de només lectura; mai escriu, mou o esborra PDFs.
   Les referències FileSystemDirectoryHandle es guarden en IndexedDB,
   no el contingut dels documents. Permisos sempre controlats per l'usuari. */
const LINK_DB='partitures-festeres-linked-w222a',LINK_KEY='active',MAX_PDFS=10000,MAX_FOLDERS=4000,MAX_DEPTH=30;
const CACHE_LIMIT_BYTES=100*1024*1024;
const cacheKey=(libraryId,path)=>libraryId+'\u0000'+path;
let dbPromise;
function openLinkDB(){
 if(dbPromise)return dbPromise;
 if(!globalThis.indexedDB)return Promise.reject(Error('IndexedDB no disponible.'));
 dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(LINK_DB,2);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('roots'))db.createObjectStore('roots',{keyPath:'key'});
   if(!db.objectStoreNames.contains('cachedPdfs')){
    const store=db.createObjectStore('cachedPdfs',{keyPath:'key'});
    store.createIndex('libraryId','libraryId',{unique:false});
   }
  };
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
export async function scanLinkedDirectory(root,{maxFiles=MAX_PDFS,maxFolders=MAX_FOLDERS,maxDepth=MAX_DEPTH,previousScores=[]}={}){
 if(!root||root.kind!=='directory'||(typeof root.entries!=='function'&&typeof root.values!=='function'))
  throw Error('El navegador no permet examinar esta carpeta. Torna a triar-la o utilitza la importació de carpeta.');
 const records=[],folders=[],fileHandles=new Map(),visited=new Set();
 const oldByPath=new Map(previousScores.map(record=>[record.path,record]));
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
    // No cridar getFile() per a cada PDF: en Android/SAF és molt lent.
    // S'obté el PDF real només en obrir-lo o generar la seua miniatura.
    const previous=oldByPath.get(path);
    records.push({path,size:previous?.size||0,added:previous?.added||0});
    fileHandles.set(path,handle);
   }
  }
 }
 const count={files:0,folders:0,unreadable:0};
 visited.add(root);await visit(root,[],0);
 records.sort((a,b)=>natural(a.path,b.path));
 folders.sort(natural);
 return {scores:records,folders,files:fileHandles,unreadable:count.unreadable};
}
// El catàleg és una instantània lleugera: només noms, rutes i carpetes.
// Mai serialitzem Blob, File o FileSystemFileHandle dins de l'índex.
function validIndex(index){
 if(index?.version!==1||!Array.isArray(index.scores)||!Array.isArray(index.folders)||
    index.scores.length>MAX_PDFS||index.folders.length>MAX_FOLDERS)return null;
 const scores=[];
 for(const item of index.scores){
  if(!validateLinkedPath(item?.path))return null;
  scores.push({path:item.path,size:Number.isFinite(item.size)&&item.size>=0?item.size:0,
   added:Number.isFinite(item.added)&&item.added>=0?item.added:0});
 }
 const folders=[];
 for(const path of index.folders){
  if(typeof path!=='string'||path.length>500||!path.split('/').every(validLocalPart))return null;
  folders.push(path);
 }
 return {scores,folders,unreadable:Number.isFinite(index.unreadable)?index.unreadable:0,
  scannedAt:Number.isFinite(index.scannedAt)?index.scannedAt:0};
}

// Les còpies de lectura es desen separades de la Biblioteca importada, per
// evitar duplicitats de noms i protegir les anotacions i repertoris existents.
async function cachedPdf(libraryId,path){
 const db=await openLinkDB();
 return new Promise((resolve,reject)=>{
  const request=db.transaction('cachedPdfs','readonly').objectStore('cachedPdfs')
   .get(cacheKey(libraryId,path));
  request.onsuccess=()=>resolve(request.result?.blob||null);
  request.onerror=()=>reject(request.error);
 });
}
async function saveCachedPdf(libraryId,path,blob){
 if(!libraryId||!validateLinkedPath(path)||!blob||!blob.size||blob.size>CACHE_LIMIT_BYTES)
  throw Error('La partitura no es pot guardar sense connexió (màxim 100 MB per PDF).');
 const db=await openLinkDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('cachedPdfs','readwrite');
  tx.objectStore('cachedPdfs').put({key:cacheKey(libraryId,path),libraryId,path,blob,savedAt:Date.now()});
  tx.oncomplete=()=>resolve(blob.size);
  tx.onerror=()=>reject(tx.error||Error('No hi ha prou espai per a guardar la còpia local.'));
  tx.onabort=()=>reject(tx.error||Error('No s’ha pogut guardar la còpia local.'));
 });
}
async function cachedPdfPaths(libraryId){
 const db=await openLinkDB();
 return new Promise((resolve,reject)=>{
  const req=db.transaction('cachedPdfs','readonly').objectStore('cachedPdfs').index('libraryId').getAllKeys(libraryId);
  req.onsuccess=()=>resolve(new Set(req.result.map(key=>String(key).slice(libraryId.length+1))));
  req.onerror=()=>reject(req.error);
 });
}
async function deleteLibraryCache(libraryId){
 if(!libraryId)return;
 const db=await openLinkDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('cachedPdfs','readwrite');
  const cursor=tx.objectStore('cachedPdfs').index('libraryId').openKeyCursor(libraryId);
  cursor.onsuccess=()=>{
   const row=cursor.result;
   if(row){tx.objectStore('cachedPdfs').delete(row.primaryKey);row.continue();}
  };
  cursor.onerror=()=>{try{tx.abort();}catch{}};
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||Error('No s’han pogut eliminar les còpies.'));
 });
}
export function isQuotaError(error){
 return error?.name==='QuotaExceededError'||/quota|espai|space|disk/i.test(error?.message||'');
}

export class LinkedLocalLibrary{
 constructor(){
  this.id=null;this.name='';this.handle=null;
  this.scores=[];this.folders=[];this.files=new Map();this.unreadable=0;
  this.status='none';this.error='';this.lastScannedAt=0;
  this.cachedPaths=new Set();this.offlineBusy=false;this.offlineProgress=null;this.offlineCancelled=false;
  this.checkBusy=false;this.checkState='idle';this.checkError='';this.lastAutoCheckedAt=0;
 }
 get exists(){return !!this.handle&&!!this.id;}
 get ready(){return this.status==='ready'||this.status==='cached';}
 get cached(){return this.status==='cached';}
 get offlineCount(){return this.cachedPaths.size;}
 get uncachedCount(){return this.scores.filter(item=>!this.cachedPaths.has(item.path)).length;}
 async refreshCachedPaths(){
  this.cachedPaths=await cachedPdfPaths(this.id);
  return this.cachedPaths;
 }
 cancelOffline(){this.offlineCancelled=true;}
 async restore(){
  const saved=await inRootStore('readonly',store=>store.get(LINK_KEY));
  if(saved?.id&&saved?.handle?.kind==='directory'){
   this.id=saved.id;this.name=saved.name||saved.handle.name||'Biblioteca';
   this.handle=saved.handle;this.status='permission';this.error='';
   try{await this.refreshCachedPaths();}catch(error){console.warn('Còpies locals:',error);}
   const cached=validIndex(saved.index);
   if(cached){
    this.scores=cached.scores;this.folders=cached.folders;this.unreadable=cached.unreadable;
    this.lastScannedAt=cached.scannedAt;this.status='cached';
    // En Android, reconstruir un FileSystemFileHandle a partir de la ruta
    // pot fallar tot i que el handle retornat per entries() siga llegible.
    // Conservem els handles originals sempre que el navegador permeta
    // clonar-los a IndexedDB: només són referències, NO contingut de PDF.
    const known=new Set(cached.scores.map(item=>item.path));
    if(Array.isArray(saved.fileHandles))
     this.files=new Map(saved.fileHandles.filter(entry=>Array.isArray(entry)&&
      known.has(entry[0])&&entry[1]?.kind==='file').slice(0,MAX_PDFS));
   }
   return true;
  }
  return false;
 }
 async save(handle){
  if(!handle||handle.kind!=='directory')throw Error('La selecció no és una carpeta.');
  const old={id:this.id,name:this.name,handle:this.handle,status:this.status,scores:this.scores,folders:this.folders,files:this.files,
   unreadable:this.unreadable,lastScannedAt:this.lastScannedAt};
  // En tornar a seleccionar la mateixa carpeta, conservem la identitat i
  // per tant també els favorits, anotacions i repertoris associats.
  let sameEntry=false;
  if(old.handle&&typeof old.handle.isSameEntry==='function'){
   try{sameEntry=await old.handle.isSameEntry(handle);}
   catch{/* La identitat no es pot assegurar. */}
  }
  this.id=sameEntry&&old.id?old.id:'folder-'+(typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
  this.name=handle.name||'Biblioteca';this.handle=handle;this.status=sameEntry&&old.lastScannedAt?'cached':'permission';
  this.scores=sameEntry?old.scores:[];this.folders=sameEntry?old.folders:[];
  this.unreadable=sameEntry?old.unreadable:0;this.lastScannedAt=sameEntry?old.lastScannedAt:0;
  this.files=sameEntry?old.files:new Map();
  this.cachedPaths=sameEntry?this.cachedPaths:new Set();
  const index=this.lastScannedAt?this.snapshot():null;
  try{
   await this.persistIndex({handle,index});
  }
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
  const hadIndex=this.lastScannedAt>0;
  const preserveOrReset=()=>{
   if(hadIndex){this.status='cached';return;}
   this.status='permission';this.scores=[];this.folders=[];this.files=new Map();
  };
  this.status='scanning';this.error='';
  return Promise.resolve(permission).catch(error=>{
   console.warn('API de permisos no disponible:',error);
   return 'unsupported';
  }).then(async status=>{
   // La denegació explícita d'un requeriment de permís és definitiva.
   if(ask&&status==='denied'){
    preserveOrReset();
    this.error='El navegador no ha concedit l’accés. Torna a seleccionar la carpeta.';
    return false;
   }
   // Els estats 'prompt' i 'unsupported' no són sempre fiables en Android:
   // provem només la lectura d'entries(), mai l'escriptura.
   try{
    const listing=await scanLinkedDirectory(this.handle,{previousScores:this.scores});
    this.scores=listing.scores;this.folders=listing.folders;this.files=listing.files;
    this.unreadable=listing.unreadable;this.status='ready';this.error='';
    this.lastScannedAt=Date.now();
    // Guardem una vegada per escaneig. El pròxim inici no torna a recórrer
    // centenars de PDF. Un error de quota no invalida la sessió actual.
    try{
     await this.persistIndex();
    }catch(error){
     console.warn('No s’ha pogut guardar l’índex de la carpeta:',error);
     this.error='No s’ha pogut guardar l’índex per a la pròxima obertura.';
    }
    return true;
   }catch(error){
    preserveOrReset();
    if(error?.name==='NotAllowedError'||error?.name==='SecurityError'){
     this.error=typeof this.handle.requestPermission==='function'
      ?'El navegador ha bloquejat la lectura. Prem Autoritzar lectura o torna a seleccionar la carpeta.'
      :'No es pot llegir esta carpeta. Prem Canviar carpeta i selecciona-la de nou.';
     return false;
    }
    this.status=hadIndex?'cached':'error';
    this.error=error?.message||String(error);
    throw error;
   }
  });
 }
 // Comprovació oportunista sense demanar permisos nous ni alterar la vista.
 // Si falla, conservem el catàleg, els repertoris i totes les còpies locals.
 async checkForChanges(){
  if(!this.exists||!this.ready||this.checkBusy||this.offlineBusy)
   return {skipped:true,changed:false};
  this.checkBusy=true;this.checkState='checking';this.checkError='';
  const id=this.id;
  try{
   if(typeof this.handle.queryPermission==='function'){
    let permission='unknown';
    try{permission=await this.handle.queryPermission({mode:'read'});}
    catch(error){console.warn('Comprovació de permisos no disponible:',error);}
    // Mai mostrem un diàleg de permisos durant una comprovació automàtica.
    if(permission==='prompt'||permission==='denied'){
     this.checkState='unavailable';
     this.checkError='Chrome necessita una autorització per a revisar els canvis.';
     return {changed:false,unavailable:true};
    }
   }
   const beforeScores=this.scores, beforeFolders=this.folders;
   const scanned=await scanLinkedDirectory(this.handle,{previousScores:beforeScores});
   if(this.id!==id)return {skipped:true,changed:false};
   const changed=scanned.scores.length!==beforeScores.length||
    scanned.folders.length!==beforeFolders.length||
    scanned.scores.some((item,i)=>item.path!==beforeScores[i]?.path)||
    scanned.folders.some((path,i)=>path!==beforeFolders[i]);
   this.files=scanned.files;
   this.lastAutoCheckedAt=Date.now();
   if(changed){
    this.scores=scanned.scores;this.folders=scanned.folders;
    this.unreadable=scanned.unreadable;
    this.lastScannedAt=this.lastAutoCheckedAt;
    this.status='ready';
    try{await this.persistIndex();}
    catch(error){console.warn('No s’ha guardat l’índex automàtic:',error);}
   }
   this.checkState='ok';this.checkError='';
   return {changed,added:changed?scanned.scores.length-beforeScores.length:0};
  }catch(error){
   this.checkState='unavailable';
   this.checkError=error?.message||String(error);
   // Important: mai buidem les 235 partitures per un permís caducat.
   return {changed:false,unavailable:true};
  }finally{
   this.checkBusy=false;
  }
 }
 snapshot(){
  return {version:1,scores:this.scores.map(({path,size,added})=>({path,size,added})),
   folders:[...this.folders],unreadable:this.unreadable,scannedAt:this.lastScannedAt};
 }
 async persistIndex({handle=this.handle,index=this.snapshot()}={}){
  const base={key:LINK_KEY,id:this.id,name:this.name,handle,index};
  // En Chrome Chromium es poden clonar FileSystemFileHandle a IndexedDB.
  // Guardar-los permet reobrir PDFs encara que la reconstrucció amb
  // getFileHandle() falle en proveïdors de documents d'Android.
  if(this.files.size&&this.files.size<=2500){
   try{
    await inRootStore('readwrite',store=>store.put({...base,fileHandles:[...this.files]}));
    return;
   }catch(error){
    console.warn('No es poden conservar els handles individuals:',error);
   }
  }
  // Pla B: només índex + arrel. No perdem l'índex perquè un proveïdor
  // no permeta serialitzar els handles de fitxers.
  await inRootStore('readwrite',store=>store.put(base));
 }
 async fileHandleFor(path,{forceEnumeration=false}={}){
  if(!forceEnumeration&&this.files.has(path))return this.files.get(path);
  // Alguns proveïdors d'Android permeten entries() però fallen quan
  // Chrome invoca getDirectoryHandle()/getFileHandle(). En eixe cas
  // busquem el nom enumerant NOMÉS la branca demanada.
  let directory=this.handle;
  const parts=path.split('/');
  const find=async(dir,name,kind)=>{
   const iterator=typeof dir.entries==='function'?dir.entries():
    typeof dir.values==='function'?dir.values():null;
   if(!iterator)throw Error('Este proveïdor no permet explorar els arxius.');
   for await(const entry of iterator){
    const item=Array.isArray(entry)?entry[1]:entry;
    if(item?.name===name&&item.kind===kind)return item;
   }
   throw Object.assign(new Error('No s’ha trobat: '+name),{name:'NotFoundError'});
  };
  for(const name of parts.slice(0,-1)){
   let child=null,primaryError=null;
   if(!forceEnumeration&&typeof directory.getDirectoryHandle==='function'){
    try{child=await directory.getDirectoryHandle(name);}
    catch(error){primaryError=error;}
   }
   if(!child){
    try{child=await find(directory,name,'directory');}
    catch(error){throw primaryError&&error?.name==='NotFoundError'?primaryError:error;}
   }
   directory=child;
  }
  const name=parts.at(-1);
  let handle=null,primaryError=null;
  if(!forceEnumeration&&typeof directory.getFileHandle==='function'){
   try{handle=await directory.getFileHandle(name);}
   catch(error){primaryError=error;}
  }
  if(!handle){
   try{handle=await find(directory,name,'file');}
   catch(error){throw primaryError&&error?.name==='NotFoundError'?primaryError:error;}
  }
  this.files.set(path,handle);
  return handle;
 }
 async prepareOffline({onProgress=()=>{},refresh=false}={}){
  if(!this.ready)throw Error('Cal llegir la carpeta original abans de preparar les còpies.');
  if(this.offlineBusy)throw Error('Ja hi ha una descàrrega de la biblioteca en marxa.');
  this.offlineBusy=true;this.offlineCancelled=false;
  let saved=0,skipped=0,failed=0,lastError='',bytes=0;
  const items=[...this.scores];
  try{
   await this.refreshCachedPaths();
   for(let i=0;i<items.length;i++){
    if(this.offlineCancelled)break;
    const item=items[i],path=item.path;
    if(!refresh&&this.cachedPaths.has(path)){skipped++;continue;}
    try{
     // Cada consulta és individual i no es conserva tot el conjunt en RAM.
     const handle=await this.fileHandleFor(path);
     let blob;
     try{blob=await handle.getFile();}
     catch(error){
      const fresh=await this.fileHandleFor(path,{forceEnumeration:true});
      blob=await fresh.getFile();
     }
     if(!blob.size||blob.size>CACHE_LIMIT_BYTES)
      throw Error('PDF buit o massa gran (màxim 100 MB).');
     const header=await blob.slice(0,1024).text();
     if(!header.includes('%PDF-'))throw Error('El document no és un PDF vàlid.');
     const estimate=typeof navigator!=='undefined'&&navigator.storage?.estimate
      ?await navigator.storage.estimate().catch(()=>null):null;
     if(estimate?.quota&&estimate.usage+blob.size>estimate.quota*.96)
      throw Object.assign(Error('Queda poc espai lliure per a les còpies.'),{name:'QuotaExceededError'});
     await saveCachedPdf(this.id,path,blob);
     this.cachedPaths.add(path);saved++;bytes+=blob.size;
    }catch(error){
     failed++;lastError=error.message||String(error);
     if(isQuotaError(error)){onProgress({done:i+1,total:items.length,saved,skipped,failed,bytes,lastError});break;}
    }
    if(i%3===0||i===items.length-1){
     onProgress({done:i+1,total:items.length,saved,skipped,failed,bytes,lastError});
     // Cedir un torn al navegador perquè el progrés es pinte en Android.
     await new Promise(resolve=>setTimeout(resolve,0));
    }
   }
   return {saved,skipped,failed,bytes,cancelled:this.offlineCancelled,lastError,
    available:this.offlineCount,total:items.length};
  }finally{
   this.offlineBusy=false;this.offlineCancelled=false;this.offlineProgress=null;
  }
 }
 async clearOffline(){
  if(this.offlineBusy)throw Error('Para abans la descàrrega de les còpies.');
  await deleteLibraryCache(this.id);
  this.cachedPaths.clear();
 }
 async getScore(path){
  if(!this.ready)throw Error('No s’ha pogut llegir la biblioteca vinculada.');
  if(!validateLinkedPath(path)||!this.scores.some(item=>item.path===path))return null;
  let firstError=null;
  // Primer usem la còpia local si ja existeix: això evita que un permís
  // temporal de Chrome bloquege el PDF després de tancar l'aplicació.
  let offline=null;
  try{offline=await cachedPdf(this.id,path);}catch(error){console.warn('Còpia del PDF:',error);}
  if(offline?.size)return {path,size:offline.size,added:0,blob:offline,offline:true};
  try{
   const handle=await this.fileHandleFor(path);
   try{
    const file=await handle.getFile();
    // Guardar automàticament només un PDF que l'usuari obri permet que
    // continue funcionant després d'eixir, fins i tot si Chrome perd
    // l'autorització del proveïdor. No retarda el visor.
    void saveCachedPdf(this.id,path,file).then(()=>this.cachedPaths.add(path))
     .catch(error=>console.warn('Còpia local no disponible:',error));
    return {path,size:file.size,added:file.lastModified||0,blob:file};
   }catch(error){firstError=error;this.files.delete(path);}
   // Una referència serialitzada o retornada per getFileHandle() pot ser
   // caducada. Recorrem la branca mitjançant entries() i ho provem
   // amb el handle original del proveïdor una única vegada més.
   const fresh=await this.fileHandleFor(path,{forceEnumeration:true});
   const file=await fresh.getFile();
   void saveCachedPdf(this.id,path,file).then(()=>this.cachedPaths.add(path))
    .catch(error=>console.warn('Còpia local no disponible:',error));
   return {path,size:file.size,added:file.lastModified||0,blob:file};
  }catch(error){
   console.warn('No es pot obrir un PDF vinculat:',{path,firstError,error});
   const denied=[error,firstError].some(e=>['NotAllowedError','SecurityError'].includes(e?.name));
   const missing=[error,firstError].some(e=>e?.name==='NotFoundError');
   if(denied)throw new Error('Chrome no permet llegir esta partitura concreta. Actualitzar la llista no renova el permís del PDF. Prova Canviar carpeta i torna a seleccionar la mateixa carpeta; si continua fallant, el proveïdor de fitxers no permet l’accés web.');
   if(missing)throw new Error('La partitura no es troba en la carpeta original. Si s’ha mogut o canviat de nom, prem Actualitzar biblioteca.');
   throw new Error('El proveïdor d’arxius no ha pogut obrir este PDF ('+(error?.name||'error')+'). La resta de la biblioteca es conserva.');
  }
 }
 async forget(){
  if(this.offlineBusy)throw Error('Para primer la descàrrega de còpies.');
  await deleteLibraryCache(this.id);
  await inRootStore('readwrite',store=>store.delete(LINK_KEY));
  this.id=null;this.name='';this.handle=null;this.scores=[];this.folders=[];
  this.files=new Map();this.status='none';this.error='';this.lastScannedAt=0;
 }
}
