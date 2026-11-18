/* W2.20 — Papers virtuals basats en carpetes, com PaperRoleStore.kt d'Android.
   Les assignacions no mouen ni canvien els PDF. Els IDs són estables. */
export const PAPER_ROLE_KEY='w220:paperRoles';
export const ROOT_PAPER='root';
export const PAPER_ROLES_VERSION=1;
const MAX_ROLE=999;
const safePath=path=>typeof path==='string'&&path.length>0&&path.length<=500&&!path.startsWith('/')&&
 !path.includes('\\')&&path.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/[\x00-\x1f]/.test(p));
const safeRole=role=>Number.isInteger(role)&&role>=1&&role<=MAX_ROLE;
const compare=(a,b)=>a.localeCompare(b,'ca',{numeric:true,sensitivity:'base'});
export const roleKey=id=>'role:'+id;
export const roleNumber=key=>typeof key==='string'&&/^role:([1-9]\d{0,2})$/.test(key)?Number(key.slice(5)):null;
export function paperLabel(id,language='va'){
 const endings={1:'1r',2:'2n',3:'3r',4:'4t'};
 return endings[id]||String(id)+(language==='es'?'º':'é');
}
export function allFolderPaths(scores=[]){
 const folders=new Set();
 for(const item of scores){
  const path=typeof item==='string'?item:item?.path;
  if(!safePath(path)||!path.toLowerCase().endsWith('.pdf'))continue;
  const segments=path.split('/');
  for(let i=1;i<segments.length;i++)folders.add(segments.slice(0,i).join('/'));
 }
 return [...folders].sort((a,b)=>a.split('/').length-b.split('/').length||compare(a,b));
}
export const defaultPaperRoles=()=>({version:PAPER_ROLES_VERSION,roles:[{id:1,path:null},{id:2,path:null}]});
export function normalizePaperRoles(raw){
 const defaults=defaultPaperRoles();
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==PAPER_ROLES_VERSION||!Array.isArray(raw.roles))
  return defaults;
 const seen=new Set(),paths=new Set(),roles=[];
 for(const item of raw.roles.slice(0,MAX_ROLE)){
  const id=Number(item?.id);
  if(!safeRole(id)||seen.has(id))continue;
  seen.add(id);
  const path=safePath(item?.path)?item.path:null;
  const unique=path&&!paths.has(path)?path:null;
  if(unique)paths.add(unique);
  roles.push({id,path:unique});
 }
 for(const id of [1,2])if(!seen.has(id))roles.push({id,path:null});
 roles.sort((a,b)=>a.id-b.id);
 return {version:PAPER_ROLES_VERSION,roles};
}
export function paperAssignments(config){
 return normalizePaperRoles(config).roles.filter(role=>!!role.path);
}
export function findRole(config,key){const n=roleNumber(key);return n===null?null:normalizePaperRoles(config).roles.find(r=>r.id===n)||null;}
export function activePaperBase(config,active,availableFolders=null){
 if(active===ROOT_PAPER)return '';
 const role=findRole(config,active);
 if(!role?.path)return '';
 if(availableFolders&&!new Set(availableFolders).has(role.path))return '';
 return role.path;
}
export function resolvePaper(config,preferred,folders=[]){
 if(preferred===ROOT_PAPER)return ROOT_PAPER;
 const assigned=paperAssignments(config).filter(item=>folders.includes(item.path));
 const requested=findRole(config,preferred);
 if(requested?.path&&folders.includes(requested.path))return preferred;
 return assigned.length?roleKey(assigned[0].id):ROOT_PAPER;
}
export function assignPaper(config,id,path){
 const roles=normalizePaperRoles(config).roles;
 if(!roles.some(r=>r.id===id))throw Error('Paper inexistent.');
 if(path!==null&&!safePath(path))throw Error('Ruta de carpeta no vàlida.');
 return {version:PAPER_ROLES_VERSION,roles:roles.map(role=>({
  id:role.id,path:role.id===id?path:(path&&role.path===path?null:role.path)
 }))};
}
export function addPaperRole(config){
 const roles=normalizePaperRoles(config).roles;
 const id=Math.max(2,...roles.map(r=>r.id))+1;
 if(id>MAX_ROLE)throw Error('No es poden afegir més papers.');
 return {id,config:{version:PAPER_ROLES_VERSION,roles:[...roles,{id,path:null}]}};
}
export function removePaperRole(config,id){
 if(!safeRole(id)||id<3)throw Error('Els papers 1r i 2n no es poden eliminar.');
 return {version:PAPER_ROLES_VERSION,roles:normalizePaperRoles(config).roles.filter(r=>r.id!==id)};
}
function legacyFolderRole(name){
 const folder=name.trim().toLowerCase();
 if(/^(?:primer|primera)$/.test(folder))return 1;
 if(/^(?:segon|segona|segundo)$/.test(folder))return 2;
 const match=/^(\d{1,2})\s*(?:er|r|n|t|é|º|ª)?$/i.exec(folder);
 const role=match?Number(match[1]):null;
 return role>=1&&role<=99?role:null;
}
export function migrateOldPapers(scores,preferred='root'){
 const folders=allFolderPaths(scores);
 const config=defaultPaperRoles();
 // Migració W2.19: només els noms antics de primer nivell s'autoassignen.
 const candidates=folders.filter(p=>!p.includes('/'));
 let result=config;
 for(const path of candidates){
  const id=legacyFolderRole(path);
  if(id){
   while(!result.roles.some(r=>r.id===id)){
    result=addPaperRole(result).config;
   }
   if(!result.roles.find(r=>r.id===id).path)result=assignPaper(result,id,path);
  }
 }
 const oldSelected=candidates.find(path=>path===preferred);
 const active=oldSelected&&result.roles.some(role=>role.path===oldSelected)?
   roleKey(result.roles.find(role=>role.path===oldSelected).id):
   preferred==='root'?'root':resolvePaper(result,null,folders);
 return {config:result,active};
}
export function scopedPaperScores(scores,config,active){
 const base=activePaperBase(config,active);
 if(active!=='root'&&!base)return [];
 return active==='root'?[...scores]:scores.filter(score=>score.path.startsWith(base+'/'));
}
export function paperRelativePath(path,config,active){
 const base=activePaperBase(config,active);
 return base&&path.startsWith(base+'/')?path.slice(base.length+1):path;
}
