import {getAllScores, getScore, getAllPrefs, clearStaging, stageBatch, commitStagedBackup} from './db.js';
import {normalizeScoreMetadata} from './metadata.js';

// Format obert (ZIP), sense servidor ni autoritzacions externes.
export const BACKUP_MANIFEST = 'partitures-festeres-copia.json';
export const BACKUP_KIND = 'partitures-festeres-web-backup';
const PREFIX = 'biblioteca/';
const MAX_PDF_BYTES = 100*1024*1024; // límit de cada PDF heretat de W1.0
const MAX_FILES = 20000;
const MAX_MANIFEST_BYTES = 5*1024*1024;

const validPath = path => typeof path === 'string' && path.length>0 && path.length <= 500 &&
  !path.startsWith('/') && !path.includes('\\') && /\.pdf$/i.test(path) &&
  path.split('/').every(seg=>seg && seg!=='.' && seg!=='..' && !seg.startsWith('.') && !/[\x00-\x1f]/.test(seg));

const hex = buffer => [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sha256(blob) {
  if (!crypto?.subtle) throw new Error('La verificació criptogràfica necessita HTTPS');
  return hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
}
async function isPdf(blob) {
  const bytes=await blob.slice(0,1024).arrayBuffer();
  return new TextDecoder('ascii').decode(bytes).includes('%PDF-');
}
function safePrefs(prefs) {
  return prefs.filter(p=>p && typeof p.key==='string' && p.key.length <= 100 && /^[A-Za-z0-9_.:-]+$/.test(p.key) &&
    JSON.stringify(p.value)?.length <= 100000 && p.value !== undefined).map(({key,value})=>({key,value}));
}
function assertManifest(m, zip) {
  if (!m || m.kind!==BACKUP_KIND || m.schemaVersion!==1 || !Array.isArray(m.files))
    throw new Error('Este ZIP no és una còpia compatible de Partitures Festeres Web.');
  if (m.files.length>MAX_FILES || m.files.length!==m.scoreCount) throw new Error('El recompte de fitxers de la còpia no és vàlid.');
  const seen = new Set(); let total=0;
  for (const f of m.files) {
    if (!f || !validPath(f.path) || !Number.isSafeInteger(f.size) || f.size<=0 || f.size>MAX_PDF_BYTES ||
      typeof f.sha256!=='string' || !/^[a-f0-9]{64}$/.test(f.sha256) ||
      !Number.isSafeInteger(f.added) || f.added<0 || seen.has(f.path) || !zip.file(PREFIX+f.path) ||
      (Number.isSafeInteger(zip.file(PREFIX+f.path)._data?.uncompressedSize) && zip.file(PREFIX+f.path)._data.uncompressedSize !== f.size))
      throw new Error('La còpia conté dades o rutes de PDF no vàlides.');
    if(f.metadata!==undefined){
      try{normalizeScoreMetadata(f.metadata);}
      catch{throw new Error('La còpia conté metadades de partitura no vàlides.');}
    }
    seen.add(f.path); total+=f.size;
  }
  if (total!==m.totalBytes || !Number.isSafeInteger(total)) throw new Error('La grandària declarada de la còpia no coincidix.');
  if (!Array.isArray(m.preferences) || m.preferences.length>100 || safePrefs(m.preferences).length!==m.preferences.length)
    throw new Error('Les preferències de la còpia no són vàlides.');
  if (new Set(m.preferences.map(x=>x.key)).size!==m.preferences.length)
    throw new Error('La còpia conté preferències repetides.');
  return m;
}

export async function createBackup(onProgress=()=>{}) {
  if (!window.JSZip) throw new Error('No s’ha carregat el lector ZIP.');
  const zip=new window.JSZip();
  const scores=(await getAllScores()).sort((a,b)=>a.path.localeCompare(b.path));
  if (scores.length>MAX_FILES) throw new Error('Hi ha massa partitures en esta biblioteca.');
  const preferences=safePrefs(await getAllPrefs());
  const files=[]; let totalBytes=0;
  for (let i=0;i<scores.length;i++) {
    const s=scores[i];
    if (!validPath(s.path)) throw new Error(`Ruta no vàlida: ${s.path}`);
    const record=await getScore(s.path);
    if (!record?.blob || !(record.blob instanceof Blob) || !record.blob.size || record.blob.size>MAX_PDF_BYTES || !(await isPdf(record.blob)))
      throw new Error(`Partitura danyada: ${s.path}`);
    const size=record.blob.size;
    files.push({path:s.path,size,added:Number.isSafeInteger(record.added)&&record.added>=0?record.added:Date.now(),sha256:await sha256(record.blob),...(record.metadata?{metadata:normalizeScoreMetadata(record.metadata)}:{})});
    totalBytes+=size;
    zip.file(PREFIX+s.path,record.blob,{compression:'STORE',binary:true});
    onProgress({phase:'read',done:i+1,total:scores.length});
  }
  const manifest={kind:BACKUP_KIND,schemaVersion:1,appVersion:'W1.3B.1',createdAt:new Date().toISOString(),scoreCount:files.length,totalBytes,files,preferences};
  zip.file(BACKUP_MANIFEST,JSON.stringify(manifest,null,2));
  zip.file('LLEGIU-ME.txt',`PARTITURES FESTERES WEB - COPIA DE SEGURETAT\nData: ${manifest.createdAt}\nPartitures: ${files.length}\nRestaura esta copia des d'Ajustos > Restaurar copia en Partitures Festeres Web.\nNo es necessari publicar este ZIP en GitHub.\n`);
  const blob=await zip.generateAsync({type:'blob',compression:'STORE',streamFiles:true}, meta=>onProgress({phase:'zip',percent:meta.percent}));
  const time=new Date().toISOString().slice(0,19).replace(/[T:]/g,'-');
  return {blob,filename:`PartituresFesteres_Copia_${time}.zip`,count:files.length,totalBytes};
}

export async function inspectBackup(input) {
  if (!window.JSZip) throw new Error('No s’ha carregat el lector ZIP.');
  if (!input || input.size===0) throw new Error('Selecciona un ZIP de còpia de seguretat.');
  const zip=await window.JSZip.loadAsync(input,{checkCRC32:false});
  const entry=zip.file(BACKUP_MANIFEST);
  if (!entry) throw new Error('Este ZIP no és una còpia completa de Partitures Festeres Web.');
  if (entry._data?.uncompressedSize>MAX_MANIFEST_BYTES) throw new Error('Manifest de còpia massa gran.');
  const text=await entry.async('string');
  if (text.length>MAX_MANIFEST_BYTES) throw new Error('Manifest de còpia massa gran.');
  let manifest;
  try { manifest=JSON.parse(text); } catch {throw new Error('Manifest de la còpia danyat.');}
  return {zip,manifest:assertManifest(manifest,zip)};
}

export async function restoreBackup(prepared,mode,onProgress=()=>{}) {
  if (!prepared?.zip || !prepared.manifest) throw new Error('No hi ha una còpia preparada.');
  const {zip,manifest}=prepared;
  assertManifest(manifest,zip);
  await clearStaging();
  let success=false;
  try {
    let batch=[];
    // En fusionar una còpia antiga, conservar les metadades locals si el ZIP no en du.
    const previous=mode==='merge'?new Map((await getAllScores()).map(s=>[s.path,s.metadata])):null;
    for (let i=0;i<manifest.files.length;i++) {
      const meta=manifest.files[i];
      const pdf=await zip.file(PREFIX+meta.path).async('blob');
      if (pdf.size!==meta.size || !(await isPdf(pdf)) || (await sha256(pdf))!==meta.sha256)
        throw new Error(`PDF danyat o modificat: ${meta.path}`);
      const fields=meta.metadata!==undefined?normalizeScoreMetadata(meta.metadata):
        (previous?.get(meta.path)?normalizeScoreMetadata(previous.get(meta.path)):{});
      batch.push({path:meta.path,blob:new Blob([pdf],{type:'application/pdf'}),size:pdf.size,added:meta.added,...(Object.keys(fields).length?{metadata:fields}:{})});
      if(batch.length>=8){await stageBatch(batch);batch=[];}
      onProgress({done:i+1,total:manifest.files.length,phase:'restore'});
    }
    if(batch.length) await stageBatch(batch);
    const copied=await commitStagedBackup(mode,manifest.preferences,manifest.files.length);
    success=true;
    return copied;
  } finally {
    // Si falla la lectura, els PDF de la biblioteca original no han sigut modificats.
    if(!success) await clearStaging().catch(()=>{});
  }
}
