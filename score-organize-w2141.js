/* W2.14.1 — Regles de trasllat de PDF: sense sobreescriure ni perdre anotacions.
 * A Android replacePdfReferences(...) conserva la identitat del PDF quan es mou.
 * L'equivalent web migra claus d'IndexedDB, favorits, recents i repertoris.
 */
export function validFileStem(name){
 const value=String(name??'').trim().replace(/\.pdf$/i,'').trim();
 if(!value||value.length>115||value==='.'||value==='..'||/^\.+$/.test(value)||
    /[\/\\\x00-\x1f\x7f<>:"|?*]/.test(value))
  throw new Error('Nom de partitura no vàlid.');
 return value;
}
export function validFolderSegment(name){
 const value=String(name??'').trim();
 if(!value||value.length>90||value==='.'||value==='..'||/^\.+$/.test(value)||
    /[\/\\\x00-\x1f\x7f<>:"|?*]/.test(value))
  throw new Error('Nom de carpeta no vàlid.');
 return value;
}
export function validFolderPath(path){
 const value=String(path??'');
 if(!value)return '';
 if(value.length>500||value.startsWith('/')||value.endsWith('/'))throw new Error('Ruta de carpeta no vàlida.');
 return value.split('/').map(validFolderSegment).join('/');
}
export function scoreFolder(path){
 const i=String(path??'').lastIndexOf('/');
 return i<0?'':path.slice(0,i);
}
export function scoreStem(path){
 const base=String(path??'').split('/').at(-1)||'';
 return base.replace(/\.pdf$/i,'');
}
export function targetScorePath({name,folder='',newFolder=''}={}){
 const stem=validFileStem(name),parent=validFolderPath(folder),child=String(newFolder??'').trim();
 const destination=[parent,child?validFolderSegment(child):''].filter(Boolean).join('/');
 const path=[destination,stem+'.pdf'].filter(Boolean).join('/');
 if(path.length>600)throw new Error('Ruta de partitura massa llarga.');
 return path;
}
export function replaceReferencePath(list,oldPath,newPath){
 if(!Array.isArray(list))return list;
 const seen=new Set(),result=[];
 for(const value of list){
  const item=value===oldPath?newPath:value;
  if(typeof item==='string'&&!seen.has(item)){seen.add(item);result.push(item);}
 }
 return result;
}
export function moveCollectionReferences({favorites=[],recents=[],repertoires=[]}={},oldPath,newPath){
 return {
  favorites:replaceReferencePath(favorites,oldPath,newPath),
  recents:replaceReferencePath(recents,oldPath,newPath),
  repertoires:Array.isArray(repertoires)?repertoires.map(r=>({
   ...r,paths:replaceReferencePath(r.paths,oldPath,newPath)
  })):[]
 };
}
