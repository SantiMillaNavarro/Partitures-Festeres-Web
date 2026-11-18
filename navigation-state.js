/* W2.2.1 — Recordar l'últim lloc de lectura sense guardar PDF, textos o anotacions.
   Estat menut en localStorage; les dades de la biblioteca continuen en IndexedDB. */
export const NAVIGATION_KEY='pfweb:location:v1';
export const NAVIGATION_VERSION=1;
export const APP_PAGES=Object.freeze(['library','repertoires','index','recents','favorites','tools','settings']);
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const cleanPath=x=>typeof x==='string'&&x.length>0&&x.length<=500&&!x.startsWith('/')&&
 !x.includes('\\')&&!/[\x00-\x1f]/.test(x)&&x.split('/').every(seg=>seg.length>0&&seg!=='.'&&seg!=='..');
const cleanFolder=x=>typeof x==='string'&&x.length>0&&x.length<=150&&!x.includes('/')&&!x.includes('\\')&&!/[\x00-\x1f]/.test(x)&&x!=='.'&&x!=='..';
const goodPage=n=>Number.isInteger(n)&&n>0&&n<=10000?n:1;
const goodScroll=n=>Number.isFinite(n)&&n>=0?Math.min(Math.round(n),2000000):0;

export function snapshotNavigation(state,scrollY=0){
 const view=state.view?.path;
 return {version:NAVIGATION_VERSION,
  page:APP_PAGES.includes(state.page)?state.page:'library',
  paper:typeof state.paper==='string'?state.paper:'root',
  cwd:Array.isArray(state.cwd)?state.cwd.filter(cleanFolder).slice(0,15):[],
  repertoireId:typeof state.repertoireOpen==='string'?state.repertoireOpen:null,
  view:cleanPath(view)&&/\.pdf$/i.test(view)?{path:view,page:goodPage(state.view.page)}:null,
  scrollY:goodScroll(scrollY)};
}
export function validateNavigation(raw,{scores=[],repertoires=[],paper='root'}={}){
 if(!isRecord(raw)||raw.version!==NAVIGATION_VERSION)return null;
 const knownPaths=new Set(scores.map(s=>s.path));
 const page=APP_PAGES.includes(raw.page)?raw.page:'library';
 const repertoireId=typeof raw.repertoireId==='string'&&repertoires.some(r=>r.id===raw.repertoireId)?raw.repertoireId:null;
 const cwd=[];
 if(page==='library'&&raw.paper===paper&&Array.isArray(raw.cwd)){
  for(const folder of raw.cwd.slice(0,15)){
   if(!cleanFolder(folder))break;
   const prefix=[...(paper==='root'?[]:[paper]),...cwd,folder].join('/')+'/';
   if(!scores.some(s=>s.path.startsWith(prefix)))break;
   cwd.push(folder);
  }
 }
 let view=null;
 if(isRecord(raw.view)&&cleanPath(raw.view.path)&&/\.pdf$/i.test(raw.view.path)&&knownPaths.has(raw.view.path))
   view={path:raw.view.path,page:goodPage(raw.view.page)};
 return {page,paper,cwd,repertoireId,view,scrollY:goodScroll(raw.scrollY)};
}
export function readNavigation(storage){
 try{
  const raw=storage?.getItem(NAVIGATION_KEY);
  if(!raw||raw.length>3000)return null;
  return JSON.parse(raw);
 }catch{return null;}
}
export function writeNavigation(storage,location){
 try{storage?.setItem(NAVIGATION_KEY,JSON.stringify(location));return true;}catch{return false;}
}
