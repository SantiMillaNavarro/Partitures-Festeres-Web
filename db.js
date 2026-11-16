// Arxius PDF: IndexedDB privada, no s'envien a cap servidor.
const DB_NAME = 'partitures-festeres-web-w1';
const DB_VERSION = 1;
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
    req.onsuccess = () => resolve(req.result.map(({path,size,added}) => ({path,size,added})));
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
    for (const item of records) store.put(item);
    tx.oncomplete = () => resolve(records.length);
    tx.onerror = () => reject(tx.error || new Error('No hi ha prou espai per a guardar els PDF'));
    tx.onabort = () => reject(tx.error || new Error('S’ha interromput la importació'));
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
