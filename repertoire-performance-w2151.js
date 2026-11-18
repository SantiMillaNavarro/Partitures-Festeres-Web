/* W2.15.1 — Equivalents web de duplicateRepertoire i ViewerSession Android.
 * Android: " (còpia)", " (còpia 2)", ...; iniciar actuació en la primera
 * pàgina; final de l'últim PDF -> principi del primer; mai tornar cap a arrere
 * de la primera obra a l'última.
 */
export function nextRepertoireCopyName(original,allNames=[],maxLength=60){
 const source=String(original??'').trim();
 if(!source)throw new Error('Repertori sense nom.');
 const existing=new Set(allNames.map(x=>String(x).trim().toLocaleLowerCase('ca')));
 for(let i=1;i<=10000;i++){
  const suffix=i===1?' (còpia)':' (còpia '+i+')';
  const candidate=source.slice(0,Math.max(1,maxLength-suffix.length)).trimEnd()+suffix;
  if(!existing.has(candidate.toLocaleLowerCase('ca')))return candidate;
 }
 throw new Error('No s’ha pogut generar el nom de la còpia.');
}
export function duplicatedRepertoire(source,all,{id}={}){
 if(!source?.id||!Array.isArray(source.paths)||!id||id===source.id)throw new Error('Repertori no vàlid.');
 if(all.some(rep=>rep.id===id))throw new Error('Identificador de repertori repetit.');
 return {id,name:nextRepertoireCopyName(source.name,all.map(rep=>rep.name)),
  paths:[...source.paths]};
}
export function buildPerformanceSession(rep,availableScores,startPath=null){
 if(!rep?.id||!Array.isArray(rep.paths))return null;
 const available=availableScores instanceof Set?availableScores:new Set(availableScores||[]);
 const paths=rep.paths.filter(path=>available.has(path));
 if(!paths.length)return null;
 // En Android, si l'índex sol·licitat no existeix, triem el següent
 // disponible o, si no n'hi ha, el primer.
 const wanted=typeof startPath==='string'?rep.paths.indexOf(startPath):0;
 const startIndex=wanted>=0?wanted:0;
 const selected=rep.paths.slice(startIndex).find(path=>available.has(path))||paths[0];
 return {id:rep.id,name:rep.name,paths:[...paths],current:selected};
}
export function performancePosition(session,path){
 if(!session?.paths?.length)return null;
 const index=session.paths.indexOf(path);
 return index<0?null:{index,total:session.paths.length};
}
export function performanceStep(session,path,direction){
 if(!session?.paths?.length||(direction!==1&&direction!==-1))return null;
 const index=session.paths.indexOf(path);
 if(index<0)return null;
 if(direction<0){
  return index>0?{path:session.paths[index-1],start:'last',wrapped:false}:null;
 }
 const next=(index+1)%session.paths.length;
 return {path:session.paths[next],start:'first',wrapped:next===0};
}
