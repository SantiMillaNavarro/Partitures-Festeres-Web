import {normalizeScoreMetadata} from './metadata.js';
import {emptyAnnotations,normalizeAnnotations} from './annotations.js';
// Arxius PDF: IndexedDB privada, no s'envien a cap servidor.
const DB_NAME = 'partitures-festeres-web-w1';
const DB_VERSION = 3;
let instance;

export function openDB() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB no disponible'));
  if (instance) return instance;
  instance = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('scores')) db.createObjectStore('scores', { keyPath: 'path' });
      if (!db.objectStoreNames.contains('prefs')) db.createObjectStore('prefs', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('staging')) db.createObjectStore('staging', { keyPath: 'path' });
      if (!db.objectStoreNames.contains('annotations')) db.createObjectStore('annotations', {keyPath:'path'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('La base de dades està bloquejada en una altra pestanya'));
  });
  return instance;
}
function run(storeName, mode, handler) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let answer;
    try { answer = handler(store); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(answer?.result);
    tx.onerror = () => reject(tx.error || new Error('Error de desament'));
    tx.onabort = () => reject(tx.error || new Error('Operació cancel·lada'));
  }));
}
export async function getAllScores() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scores', 'readonly');
    const req = tx.objectStore('scores').getAll();
    req.onsuccess = () => resolve(req.result.map(({path,size,added,metadata}) => ({path,size,added,...(metadata?{metadata}:{})})));
    req.onerror = () => reject(req.error);
  });
}
export async function getScore(path) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('scores', 'readonly').objectStore('scores').get(path);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveBatch(records) {
  // Agrupem les escriptures perquè una importació gran no tanque transaccions innecessàries.
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scores', 'readwrite');
    const store = tx.objectStore('scores');
    for(const item of records) {
      if(Object.prototype.hasOwnProperty.call(item,'metadata'))store.put({...item,metadata:normalizeScoreMetadata(item.metadata)});
      else {
        const get=store.get(item.path);
        get.onsuccess=()=>{
          const prior=get.result;
          store.put(prior?.metadata?{...item,metadata:prior.metadata}:item);
        };
        get.onerror=()=>{try{tx.abort();}catch{}};
      }
    }
    tx.oncomplete = () => resolve(records.length);
    tx.onerror = () => reject(tx.error || new Error('No hi ha prou espai per a guardar els PDF'));
    tx.onabort = () => reject(tx.error || new Error('S’ha interromput la importació'));
  });
}
export async function setScoreMetadata(path,fields){
 const metadata=normalizeScoreMetadata(fields);
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('scores','readwrite'),store=tx.objectStore('scores');
  const req=store.get(path);
  req.onsuccess=()=>{
   if(!req.result){tx.abort();return;}
   const updated={...req.result};
   if(Object.keys(metadata).length)updated.metadata=metadata;
   else delete updated.metadata;
   store.put(updated);
  };
  req.onerror=()=>{try{tx.abort();}catch{}};
  tx.oncomplete=()=>resolve(metadata);
  tx.onerror=()=>reject(tx.error||new Error('No s’han pogut guardar les metadades.'));
  tx.onabort=()=>reject(tx.error||new Error('Partitura no disponible. No s’han guardat les metadades.'));
 });
}
export async function deleteScore(path) {
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['scores','annotations'],'readwrite');
  tx.objectStore('scores').delete(path);
  tx.objectStore('annotations').delete(path);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('No s’ha pogut esborrar la partitura'));
  tx.onabort=()=>reject(tx.error||new Error('Eliminació cancel·lada'));
 });
}
export async function clearScores(){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['scores','annotations'],'readwrite');
  tx.objectStore('scores').clear();tx.objectStore('annotations').clear();
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('No s’ha pogut esborrar la biblioteca'));
  tx.onabort=()=>reject(tx.error||new Error('Eliminació cancel·lada'));
 });
}
export async function getAnnotations(path){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const req=db.transaction('annotations','readonly').objectStore('annotations').get(path);
  req.onsuccess=()=>{try{resolve(normalizeAnnotations(req.result?.document));}catch(err){reject(err);}};
  req.onerror=()=>reject(req.error);
 });
}
export async function getAllAnnotations(){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const req=db.transaction('annotations','readonly').objectStore('annotations').getAll();
  req.onsuccess=()=>{try{resolve(req.result.map(r=>({path:r.path,document:normalizeAnnotations(r.document)})));}catch(err){reject(err);}};
  req.onerror=()=>reject(req.error);
 });
}
export async function setAnnotations(path,document){
 const clean=normalizeAnnotations(document);
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['scores','annotations'],'readwrite');
  const req=tx.objectStore('scores').get(path);
  req.onsuccess=()=>{
   if(!req.result){tx.abort();return;}
   if(Object.keys(clean.pages).length)tx.objectStore('annotations').put({path,document:clean});
   else tx.objectStore('annotations').delete(path);
  };
  req.onerror=()=>{try{tx.abort();}catch{}};
  tx.oncomplete=()=>resolve(clean);
  tx.onerror=()=>reject(tx.error||new Error('No s’han pogut guardar les anotacions.'));
  tx.onabort=()=>reject(tx.error||new Error('La partitura no està disponible.'));
 });
}
export async function getPref(key, fallback=null) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const req = db.transaction('prefs','readonly').objectStore('prefs').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
    req.onerror = () => reject(req.error);
  });
}
export function setPref(key,value) { return run('prefs','readwrite',s=>s.put({key,value})); }


// La importació d'una còpia completa es prepara en una zona temporal, sense tocar la biblioteca.
export function clearStaging() { return run('staging', 'readwrite', s => s.clear()); }
export async function stageBatch(records) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('staging', 'readwrite');
    const store = tx.objectStore('staging');
    for (const item of records) store.put(item);
    tx.oncomplete = () => resolve(records.length);
    tx.onerror = () => reject(tx.error || new Error('No hi ha espai suficient per a preparar la còpia'));
    tx.onabort = () => reject(tx.error || new Error('Preparació de la còpia interrompuda'));
  });
}
export async function getAllPrefs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('prefs','readonly').objectStore('prefs').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function countStaging() {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const req = db.transaction('staging', 'readonly').objectStore('staging').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
// Esborrar o fusionar els arxius és una ÚNICA transacció, junt amb les preferències.
// Davant un error (inclòs falta d'espai), la biblioteca original no es modifica a mitges.
export async function commitStagedBackup(mode, prefs, expectedCount, annotationRecords=[]) {
  if (mode !== 'merge' && mode !== 'replace') throw new Error('Mode de restauració desconegut');
  const count = await countStaging();
  if (count !== expectedCount) throw new Error('La còpia preparada no està completa');
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['scores','prefs','staging','annotations'], 'readwrite');
    const scores = tx.objectStore('scores');
    const staging = tx.objectStore('staging');
    const preferences = tx.objectStore('prefs');
    const annotations = tx.objectStore('annotations');
    if (mode === 'replace') {scores.clear();annotations.clear();}
    for(const record of annotationRecords)annotations.put({path:record.path,document:normalizeAnnotations(record.document)});
    let copied=0;
    const cursor = staging.openCursor();
    cursor.onsuccess = () => {
      const current=cursor.result;
      if (current) {
        scores.put(current.value);
        copied++;
        current.continue();
      } else {
        if (copied !== expectedCount) { tx.abort(); return; }
        if (mode === 'replace') {
          preferences.clear();
          for (const pref of prefs) preferences.put(pref);
        }
        staging.clear();
      }
    };
    cursor.onerror = () => { try{tx.abort();}catch{} };
    tx.oncomplete = () => resolve(copied);
    tx.onerror = () => reject(tx.error || new Error('No s’ha pogut restaurar la biblioteca'));
    tx.onabort = () => reject(tx.error || new Error('Restauració interrompuda. La biblioteca original està intacta.'));
  });
}


/* W2.14.1 — Trasllat/renomenat ATÒMIC dins d'una transacció IndexedDB.
 * Es preserva el mateix Blob, les metadades, anotacions, estat de visor,
 * favorits, recents i repertoris. Cap PDF existent es pot sobreescriure.
 */
export async function moveScoreSafely(oldPath,newPath){
 const {targetScorePath,scoreFolder,moveCollectionReferences}=await import('./score-organize-w2141.js');
 if(typeof oldPath!=='string'||!oldPath||!oldPath.toLowerCase().endsWith('.pdf'))
  throw new Error('La partitura original no té una ruta vàlida.');
 const expected=targetScorePath({name:newPath.split('/').at(-1),folder:scoreFolder(newPath)});
 if(expected!==newPath)throw new Error('La ruta de destinació no és vàlida.');
 if(oldPath===newPath)return {changed:false,path:oldPath};
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['scores','annotations','prefs'],'readwrite');
  const scores=tx.objectStore('scores');
  const annotations=tx.objectStore('annotations');
  const prefs=tx.objectStore('prefs');
  const reads={
   source:scores.get(oldPath),
   destination:scores.get(newPath),
   sourceAnnotations:annotations.get(oldPath),
   destinationAnnotations:annotations.get(newPath),
   oldViewer:prefs.get('viewer:'+oldPath),
   newViewer:prefs.get('viewer:'+newPath),
   favorites:prefs.get('w13:favorites'),
   recents:prefs.get('w13:recents'),
   repertoires:prefs.get('w13:repertoires')
  };
  let pending=Object.keys(reads).length,problem=null;
  const fail=message=>{
   problem=message instanceof Error?message:new Error(message);
   try{tx.abort();}catch{}
  };
  const finish=()=>{
   const old=reads.source.result;
   if(!old?.blob)return fail('La partitura original no està disponible.');
   if(reads.destination.result)return fail('Ja existix una partitura amb este nom en la carpeta de destinació.');
   if(reads.destinationAnnotations.result)return fail('La destinació conté anotacions anteriors. Per seguretat no es reescriu.');
   if(reads.newViewer.result)return fail('La destinació té un estat de lectura anterior. Tria un altre nom.');
   scores.put({...old,path:newPath});
   scores.delete(oldPath);
   if(reads.sourceAnnotations.result){
    annotations.put({...reads.sourceAnnotations.result,path:newPath});
    annotations.delete(oldPath);
   }
   if(reads.oldViewer.result){
    prefs.put({key:'viewer:'+newPath,value:reads.oldViewer.result.value});
    prefs.delete('viewer:'+oldPath);
   }
   const updated=moveCollectionReferences({
    favorites:reads.favorites.result?.value||[],
    recents:reads.recents.result?.value||[],
    repertoires:reads.repertoires.result?.value||[]
   },oldPath,newPath);
   for(const [key,value] of Object.entries(updated)){
    const storeKey=key==='repertoires'?'w13:repertoires':key==='favorites'?'w13:favorites':'w13:recents';
    prefs.put({key:storeKey,value});
   }
  };
  for(const req of Object.values(reads)){
   req.onsuccess=()=>{
    if(--pending===0)try{finish();}catch(error){fail(error);}
   };
   req.onerror=()=>{problem=req.error||new Error('No s’han pogut llegir les dades.');try{tx.abort();}catch{}};
  }
  tx.oncomplete=()=>resolve({changed:true,path:newPath});
  tx.onerror=()=>reject(problem||tx.error||new Error('No s’ha pogut traslladar la partitura.'));
  tx.onabort=()=>reject(problem||tx.error||new Error('Trasllat cancel·lat: les dades anteriors estan intactes.'));
 });
}
