/* W2.24 — Còpia portable de les DADES de la carpeta vinculada.
 * Mai no copia, obri, puja ni modifica PDF; cap identificador d'IndexedDB
 * ni permís FileSystemHandle queda dins de l'arxiu.
 */
import {getAllPrefs,getAllAnnotations,commitLinkedDataBackup} from './db.js';
import {validateLinkedPath} from './linked-library-w222a.js';
import {normalizeScoreMetadata} from './metadata.js';
import {normalizeAnnotations,MAX_ANNOTATION_BYTES} from './annotations.js';
import {normalizePageAdjustments} from './page-adjustments-w218.js';
import {normalizePaperRoles} from './paper-roles-w220.js';
import {INDEX_GROUP_MODES,INDEX_SORT_MODES} from './index-groups.js';

export const LINKED_BACKUP_KIND='partitures-festeres-linked-data';
export const LINKED_BACKUP_ENTRY='partitures-festeres-dades-vinculades.json';
const MAX_JSON_BYTES=64*1024*1024;
const MAX_ZIP_BYTES=70*1024*1024;
const MAX_PATHS=10000;
const MAX_VIEWER_BYTES=128*1024;
const KEY_NAMES=['w13:favorites','w13:recents','w13:repertoires','w220:paperRoles','paper','w13c:indexGroupBy','w13c:indexSortBy'];
const prefKey=(id,key)=>'w222a:lib:'+id+':'+key;
const viewKey=(id,key,path)=>'w222a:'+id+':'+key+path;
const annoKey=(id,path)=>'w222a-linked-'+id+'/'+path;
const metadataKey=id=>'w222a:metadata:'+id;
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const uniq=a=>[...new Set(a)];
const utf8Bytes=s=>new TextEncoder().encode(s).byteLength;
const jsonSize=v=>utf8Bytes(JSON.stringify(v));
const validLibrary=l=>l&&typeof l.id==='string'&&/^folder-[A-Za-z0-9-]{1,110}$/.test(l.id)&&
 typeof l.name==='string'&&Array.isArray(l.scores);
function checkedPaths(paths){
 if(!Array.isArray(paths)||paths.length>MAX_PATHS||paths.some(p=>!validateLinkedPath(p))||
 new Set(paths).size!==paths.length)throw Error('La còpia conté rutes de partitures incorrectes.');
 return paths;
}
function safeViewer(v){
 if(!isObject(v)||jsonSize(v)>MAX_VIEWER_BYTES)
  throw Error('La còpia conté preferències del visor no vàlides.');
 return JSON.parse(JSON.stringify(v));
}
function pathList(value,known,max=MAX_PATHS){
 if(!Array.isArray(value)||value.length>max||value.some(p=>typeof p!=='string'||!known.has(p)))
  throw Error('La còpia conté referències a partitures no vàlides.');
 return uniq(value);
}
function repertoires(value,known){
 if(!Array.isArray(value)||value.length>500)throw Error('La còpia conté repertoris no vàlids.');
 const ids=new Set();
 return value.map(item=>{
  if(!isObject(item)||typeof item.id!=='string'||!/^rep_[A-Za-z0-9_-]{1,45}$/.test(item.id)||
   ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.trim().length>60)
   throw Error('Un repertori de la còpia no és vàlid.');
  ids.add(item.id);
  return {id:item.id,name:item.name.trim(),paths:pathList(item.paths,known)};
 });
}
function normalCollections(input,known){
 if(!isObject(input))throw Error('La còpia no conté les col·leccions.');
 if(typeof input.paper!=='string'||(input.paper!=='root'&&!/^role:[1-9]\d{0,2}$/.test(input.paper)))
  throw Error('Paper actiu de la còpia no vàlid.');
 if(!INDEX_GROUP_MODES.includes(input.groupBy)||!INDEX_SORT_MODES.includes(input.sortBy))
  throw Error('Preferències d’índex de la còpia no vàlides.');
 if(!isObject(input.paperRoles)||input.paperRoles.version!==1||!Array.isArray(input.paperRoles.roles))
  throw Error('Configuració de papers no vàlida.');
 return {
  favorites:pathList(input.favorites,known),
  recents:pathList(input.recents,known,45).slice(0,45),
  repertoires:repertoires(input.repertoires,known),
  paperRoles:normalizePaperRoles(input.paperRoles),
  paper:input.paper,
  groupBy:input.groupBy,sortBy:input.sortBy
 };
}
function normalizeArchive(raw){
 if(!isObject(raw)||raw.kind!==LINKED_BACKUP_KIND||raw.schemaVersion!==1||
 typeof raw.libraryName!=='string'||raw.libraryName.length>180||
 typeof raw.createdAt!=='string'||!Number.isFinite(Date.parse(raw.createdAt)))
  throw Error('Este arxiu no és una còpia de dades de Biblioteca vinculada compatible.');
 const paths=checkedPaths(raw.paths),known=new Set(paths);
 if(!Array.isArray(raw.records)||raw.records.length>paths.length)
  throw Error('Llistat de dades de partitures no vàlid.');
 const used=new Set();
 const records=raw.records.map(record=>{
  if(!isObject(record)||!known.has(record.path)||used.has(record.path))
   throw Error('La còpia conté partitures repetides o inexistents.');
  used.add(record.path);
  const out={path:record.path};
  if(Object.hasOwn(record,'metadata'))out.metadata=normalizeScoreMetadata(record.metadata);
  if(Object.hasOwn(record,'annotations')){
   if(jsonSize(record.annotations)>MAX_ANNOTATION_BYTES)throw Error('Anotacions massa grans en la còpia.');
   out.annotations=normalizeAnnotations(record.annotations);
  }
  if(Object.hasOwn(record,'viewer'))out.viewer=safeViewer(record.viewer);
  if(Object.hasOwn(record,'pageAdjustments')){
   if(!isObject(record.pageAdjustments)||jsonSize(record.pageAdjustments)>MAX_VIEWER_BYTES)
    throw Error('Ajustos de pàgina de la còpia no vàlids.');
   out.pageAdjustments=normalizePageAdjustments(record.pageAdjustments);
  }
  return out;
 });
 return {
  kind:LINKED_BACKUP_KIND,schemaVersion:1,libraryName:raw.libraryName,
  createdAt:raw.createdAt,paths,records,
  collections:normalCollections(raw.collections,known)
 };
}
function safeFolderName(name){
 return String(name||'Biblioteca').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,48)||'Biblioteca';
}
export async function createLinkedDataBackup(library,onProgress=()=>{}){
 if(!validLibrary(library))throw Error('Cal vincular una carpeta abans de crear la còpia.');
 if(!window.JSZip)throw Error('No s’ha carregat el lector ZIP.');
 const paths=checkedPaths(library.scores.map(s=>s.path)).slice().sort(),known=new Set(paths);
 const prefs=new Map((await getAllPrefs()).map(p=>[p.key,p.value]));
 const linkedMetadata=prefs.get(metadataKey(library.id))||{};
 if(!isObject(linkedMetadata))throw Error('Les metadades vinculades estan danyades.');
 const annotationRecords=new Map((await getAllAnnotations())
  .filter(row=>row.path.startsWith('w222a-linked-'+library.id+'/'))
  .map(row=>[row.path.slice(('w222a-linked-'+library.id+'/').length),row.document]));
 const records=[];
 for(let i=0;i<paths.length;i++){
  const path=paths[i],record={path};
  if(Object.hasOwn(linkedMetadata,path))record.metadata=linkedMetadata[path];
  if(annotationRecords.has(path))record.annotations=annotationRecords.get(path);
  const view=prefs.get(viewKey(library.id,'viewer:',path));
  const page=prefs.get(viewKey(library.id,'w218:page:',path));
  if(view!==undefined)record.viewer=view;
  if(page!==undefined)record.pageAdjustments=page;
  if(Object.keys(record).length>1)records.push(record);
  if(i%150===0||i===paths.length-1)onProgress({phase:'read',done:i+1,total:paths.length});
 }
 const pref=name=>prefs.get(prefKey(library.id,name));
 const payload=normalizeArchive({
  kind:LINKED_BACKUP_KIND,schemaVersion:1,
  libraryName:library.name,createdAt:new Date().toISOString(),
  paths,records,
  collections:{
   favorites:(pref('w13:favorites')||[]).filter(p=>known.has(p)),
   recents:(pref('w13:recents')||[]).filter(p=>known.has(p)),
   repertoires:(pref('w13:repertoires')||[]).map(r=>({...r,paths:(r.paths||[]).filter(p=>known.has(p))})),
   paperRoles:pref('w220:paperRoles')||{version:1,roles:[{id:1,path:null},{id:2,path:null}]},
   paper:pref('paper')||'root',
   groupBy:pref('w13c:indexGroupBy')||'folder',
   sortBy:pref('w13c:indexSortBy')||'title'
  }
 });
 const json=JSON.stringify(payload);
 if(utf8Bytes(json)>MAX_JSON_BYTES)
  throw Error('Hi ha massa dades d’anotacions per a crear un únic ZIP.');
 const zip=new window.JSZip();
 zip.file(LINKED_BACKUP_ENTRY,json,{compression:'DEFLATE'});
 zip.file('LLEGIU-ME.txt',
  'PARTITURES FESTERES WEB — DADES DE BIBLIOTECA VINCULADA\n'+
  'Carpeta: '+payload.libraryName+'\nPartitures referenciades: '+paths.length+'\n'+
  'IMPORTANT: NO INCLOU CAP PDF. Conserveu la carpeta original amb les partitures.\n'+
  'Per a restaurar-la, vinculeu la carpeta de PDF a la web i importeu este ZIP des d’Ajustos.\n');
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},
  meta=>onProgress({phase:'zip',percent:meta.percent}));
 const time=new Date().toISOString().slice(0,19).replace(/[T:]/g,'-');
 return {blob,filename:'PartituresFesteres_Dades_'+safeFolderName(library.name)+'_'+time+'.zip',
  count:paths.length,annotationCount:payload.records.filter(r=>r.annotations).length};
}
export async function inspectLinkedDataBackup(input){
 if(!window.JSZip||!input?.size||input.size>MAX_ZIP_BYTES)
  throw Error('Tria un ZIP vàlid de dades de biblioteca vinculada.');
 const zip=await window.JSZip.loadAsync(input,{checkCRC32:true});
 const entry=zip.file(LINKED_BACKUP_ENTRY);
 if(!entry||entry._data?.uncompressedSize>MAX_JSON_BYTES)
  throw Error('Este ZIP no conté una còpia de dades vinculades vàlida.');
 const json=await entry.async('string');
 if(utf8Bytes(json)>MAX_JSON_BYTES)throw Error('Les dades de la còpia són massa grans.');
 let data;
 try{data=JSON.parse(json);}catch{throw Error('El ZIP conté dades JSON corruptes.');}
 return {manifest:normalizeArchive(data)};
}
export function linkedBackupMatch(prepared,library){
 if(!validLibrary(library)||!prepared?.manifest)throw Error('Biblioteca vinculada no disponible.');
 const known=new Set(library.scores.map(s=>s.path));
 const paths=prepared.manifest.paths.filter(p=>known.has(p));
 return {matched:paths.length,missing:prepared.manifest.paths.length-paths.length,
  libraryChanged:prepared.manifest.libraryName!==library.name};
}
const union=(a,b)=>uniq([...a,...b]);
export async function restoreLinkedDataBackup(prepared,library,mode){
 if(!validLibrary(library)||!prepared?.manifest||!['merge','replace'].includes(mode))
  throw Error('No es pot restaurar la còpia de dades.');
 const data=normalizeArchive(prepared.manifest);
 const valid=new Set(library.scores.map(s=>s.path)),backupPaths=new Set(data.paths);
 const matched=new Set(data.paths.filter(path=>valid.has(path)));
 if(!matched.size)throw Error('No hi ha cap PDF amb el mateix camí en la carpeta vinculada. No s’ha modificat res.');
 const oldPrefs=new Map((await getAllPrefs()).map(p=>[p.key,p.value]));
 const existingAnnotations=new Set((await getAllAnnotations()).map(a=>a.path));
 const prefPuts=[],prefDeletes=[],annotationPuts=[],annotationDeletes=[];
 const put=(key,value)=>prefPuts.push({key,value});
 const oldMeta=oldPrefs.get(metadataKey(library.id));
 const nextMeta={...(isObject(oldMeta)?oldMeta:{})};
 const dataByPath=new Map(data.records.map(r=>[r.path,r]));
 for(const path of matched){
  const record=dataByPath.get(path);
  const ann=annoKey(library.id,path);
  const view=viewKey(library.id,'viewer:',path),page=viewKey(library.id,'w218:page:',path);
  if(mode==='replace'){
   delete nextMeta[path];
   if(record?.metadata&&Object.keys(record.metadata).length)nextMeta[path]=record.metadata;
   if(record?.annotations&&Object.keys(record.annotations.pages).length)annotationPuts.push({path:ann,document:record.annotations});
   else annotationDeletes.push(ann);
   if(record?.viewer)put(view,record.viewer);else prefDeletes.push(view);
   if(record?.pageAdjustments)put(page,record.pageAdjustments);else prefDeletes.push(page);
  }else{
   if(!nextMeta[path]&&record?.metadata)nextMeta[path]=record.metadata;
   if(!existingAnnotations.has(ann)&&record?.annotations&&Object.keys(record.annotations.pages).length)
    annotationPuts.push({path:ann,document:record.annotations});
   if(!oldPrefs.has(view)&&record?.viewer)put(view,record.viewer);
   if(!oldPrefs.has(page)&&record?.pageAdjustments)put(page,record.pageAdjustments);
  }
 }
 put(metadataKey(library.id),nextMeta);
 const pc=data.collections;
 const filtered=a=>a.filter(path=>matched.has(path));
 const remaining=a=>Array.isArray(a)?a.filter(path=>valid.has(path)&&!matched.has(path)):[];
 const current=(key,def)=>oldPrefs.get(prefKey(library.id,key))??def;
 const collection=(key,arr)=>{
  if(mode==='merge')put(prefKey(library.id,key),union(
   Array.isArray(current(key,[]))?current(key,[]).filter(p=>valid.has(p)):[],filtered(arr)));
  else put(prefKey(library.id,key),union(remaining(current(key,[])),filtered(arr)));
 };
 collection('w13:favorites',pc.favorites);
 const recent=mode==='replace'?union(remaining(current('w13:recents',[])),filtered(pc.recents)):
  union(current('w13:recents',[]).filter(p=>valid.has(p)),filtered(pc.recents));
 put(prefKey(library.id,'w13:recents'),recent.slice(0,45));
 const oldReps=current('w13:repertoires',[]);
 const existing=new Map((Array.isArray(oldReps)?oldReps:[]).filter(r=>r&&typeof r.id==='string')
  .map(r=>[r.id,{...r,paths:Array.isArray(r.paths)?r.paths.filter(p=>valid.has(p)):[]}]));
 if(mode==='replace'){
  for(const [id,r] of existing)existing.set(id,{...r,paths:r.paths.filter(p=>!matched.has(p))});
 }
 for(const rep of pc.repertoires){
  const paths=filtered(rep.paths),old=existing.get(rep.id);
  if(old)existing.set(rep.id,{id:rep.id,name:mode==='merge'?old.name:rep.name,
   paths:union(old.paths,paths)});
  else existing.set(rep.id,{id:rep.id,name:rep.name,paths});
 }
 put(prefKey(library.id,'w13:repertoires'),[...existing.values()].slice(0,500));
 const currentRoles=current('w220:paperRoles',null);
 const configured=normalizePaperRoles(currentRoles);
 const custom=configured.roles.some(r=>r.path!==null||r.id>2);
 if(mode==='replace'||!custom)put(prefKey(library.id,'w220:paperRoles'),pc.paperRoles);
 const currentPaper=current('paper','root');
 if(mode==='replace'||currentPaper==='root')put(prefKey(library.id,'paper'),pc.paper);
 for(const [key,val] of [['w13c:indexGroupBy',pc.groupBy],['w13c:indexSortBy',pc.sortBy]])
  if(mode==='replace'||!oldPrefs.has(prefKey(library.id,key)))put(prefKey(library.id,key),val);
 await commitLinkedDataBackup({libraryId:library.id,prefPuts,prefDeletes,annotationPuts,annotationDeletes});
 return {matched:matched.size,missing:backupPaths.size-matched.size,
  annotations:annotationPuts.length,mode};
}
