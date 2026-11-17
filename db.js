import {normalizeScoreMetadata} from './metadata.js';
// Arxius PDF: IndexedDB privada, no s'envien a cap servidor.
const DB_NAME = 'partitures-festeres-web-w1';
const DB_VERSION = 2;
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
export function deleteScore(path) { return run('scores','readwrite',s=>s.delete(path)); }
export function clearScores() { return run('scores','readwrite',s=>s.clear()); }
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
export async function commitStagedBackup(mode, prefs, expectedCount) {
  if (mode !== 'merge' && mode !== 'replace') throw new Error('Mode de restauració desconegut');
  const count = await countStaging();
  if (count !== expectedCount) throw new Error('La còpia preparada no està completa');
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['scores','prefs','staging'], 'readwrite');
    const scores = tx.objectStore('scores');
    const staging = tx.objectStore('staging');
    const preferences = tx.objectStore('prefs');
    if (mode === 'replace') scores.clear();
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
