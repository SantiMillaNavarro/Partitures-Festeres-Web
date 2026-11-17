/* W1.3C — Vista de l’Índex: grups i ordenació sense canviar els registres ni els PDF. */
import {scoreDisplayTitle} from './metadata.js';

export const INDEX_GROUP_MODES=Object.freeze(['folder','composer','type','year']);
export const INDEX_SORT_MODES=Object.freeze(['title','composer','year','folder']);
const compare=(a,b)=>String(a).localeCompare(String(b),'ca',{numeric:true,sensitivity:'base'});
const folded=value=>String(value??'').trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const text=value=>typeof value==='string'?value.trim():'';
const relative=(path,paper)=>paper&&paper!=='root'&&path.startsWith(paper+'/')?path.slice(paper.length+1):path;
const filename=score=>scoreDisplayTitle(score)||score.path||'';
const folderOf=(score,paper)=>relative(score.path||'',paper).split('/').slice(0,-1).join(' / ');
const field=(score,key)=>text(score?.metadata?.[key]);
const compareField=(a,b,key)=>{
 const av=field(a,key),bv=field(b,key);
 if(!av&&!bv)return 0;
 if(!av)return 1;
 if(!bv)return -1;
 return compare(av,bv);
};
export function buildIndexGroups(scores=[],{groupBy='folder',sortBy='title',paper='root',unknownLabel='Sense dades',rootFolderLabel='Sense carpeta'}={}){
 const grouping=INDEX_GROUP_MODES.includes(groupBy)?groupBy:'folder';
 const sorting=INDEX_SORT_MODES.includes(sortBy)?sortBy:'title';
 const groups=new Map();
 for(const score of scores){
  if(!score||typeof score.path!=='string')continue;
  const raw=grouping==='folder'?folderOf(score,paper):field(score,grouping);
  const absent=!raw;
  const value=absent?(grouping==='folder'?rootFolderLabel:unknownLabel):raw;
  const key=grouping+':'+(absent?'__missing__':'v:'+folded(raw));
  if(!groups.has(key))groups.set(key,{key,label:value,missing:absent,scores:[]});
  groups.get(key).scores.push(score);
 }
 const sortScores=(a,b)=>{
  let n=0;
  if(sorting==='composer')n=compareField(a,b,'composer');
  else if(sorting==='year')n=compareField(a,b,'year');
  else if(sorting==='folder')n=compare(relative(a.path,paper),relative(b.path,paper));
  else n=compare(filename(a),filename(b));
  return n||compare(filename(a),filename(b))||compare(a.path,b.path);
 };
 return [...groups.values()].sort((a,b)=>
  Number(a.missing)-Number(b.missing)||compare(a.label,b.label)||compare(a.key,b.key)
 ).map(group=>({...group,scores:group.scores.sort(sortScores)}));
}
