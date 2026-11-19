/* W2.25 — Escriptura explícita sobre carpetes reals (no IndexedDB).
 * Mai sobrescriure un PDF existent. Els permisos d'escriptura només
 * es demanen com a conseqüència directa d'un clic de l'usuari.
 */
import {validateLinkedPath,validLocalPart} from './linked-library-w222a.js';
import {uniqueScanPath} from './scanner-pdf-w2131.js';

const MAX_PDF=100*1024*1024;
const exists=error=>error?.name!=='NotFoundError';
export function requestLinkedWriteAccess(root){
 if(!root||root.kind!=='directory')
  throw Error('Cal triar una carpeta vinculada abans de guardar.');
 // Cridar requestPermission de manera síncrona des de l'esdeveniment de clic.
 let requested;
 try{
  requested=typeof root.requestPermission==='function'?
   root.requestPermission({mode:'readwrite'}):
   typeof root.queryPermission==='function'?root.queryPermission({mode:'readwrite'}):'unsupported';
 }catch(error){
  if(error?.name==='NotAllowedError'||error?.name==='SecurityError')throw error;
  // Proveïdors SAF poden ometre la interfície de permisos i sí exposar la
  // capacitat d'escriure: ho verificarem sobre el fitxer nou, mai un existent.
  requested='unsupported';
 }
 return Promise.resolve(requested).then(result=>{
  if(result==='denied')throw Error('Chrome no ha concedit permís d’escriptura. No s’ha guardat cap PDF.');
  return result;
 });
}
const checkParts=path=>{
 if(typeof path!=='string'||path.length>500||
  (path!==''&&!path.split('/').every(validLocalPart)))throw Error('Ruta de carpeta no vàlida.');
 return path?path.split('/'):[];
};
async function existingEntry(dir,name,kind){
 if(typeof dir.entries==='function'){
  for await(const [n,item] of dir.entries())if(n===name&&item?.kind===kind)return item;
 }else if(typeof dir.values==='function'){
  for await(const item of dir.values())if(item?.name===name&&item?.kind===kind)return item;
 }
 return null;
}
export async function resolveWriteDirectory(root,path,{createLast=false}={}){
 if(root?.kind!=='directory')throw Error('La carpeta vinculada no està disponible.');
 const segments=checkParts(path);
 let dir=root;
 let createdFolder=null;
 for(let i=0;i<segments.length;i++){
  const name=segments[i],canCreate=createLast&&i===segments.length-1;
  let child=null;
  if(!canCreate&&typeof dir.getDirectoryHandle==='function'){
   try{child=await dir.getDirectoryHandle(name);}
   catch(error){if(error?.name==='NotAllowedError'||error?.name==='SecurityError')throw error;}
  }
  if(!child&&!canCreate)child=await existingEntry(dir,name,'directory');
  if(!child&&canCreate){
   if(typeof dir.getDirectoryHandle!=='function')throw Error('El navegador no permet crear subcarpetes ací.');
   const already=await existingEntry(dir,name,'directory');
   child=await dir.getDirectoryHandle(name,{create:true});
   if(!already)createdFolder={parent:dir,name};
  }
  if(!child?.kind||child.kind!=='directory')
   throw Error('No s’ha trobat la carpeta de destinació: '+name);
  dir=child;
 }
 return {dir,createdFolder};
}
async function containsFile(dir,name){
 if(typeof dir.getFileHandle==='function'){
  try{await dir.getFileHandle(name);return true;}
  catch(error){if(error?.name!=='NotFoundError')throw error;}
 }
 return !!(await existingEntry(dir,name,'file'));
}
async function ensurePdf(blob){
 if(!(blob instanceof Blob)||blob.size<=0||blob.size>MAX_PDF)
  throw Error('PDF buit o més gran de 100 MB.');
 const head=await blob.slice(0,1024).text();
 if(!head.includes('%PDF-'))throw Error('El document no és un PDF vàlid.');
}
export async function writeLinkedPdf(root,path,blob,{knownPaths=[],createLastFolder=false}={}){
 if(!validateLinkedPath(path))throw Error('Nom de PDF no vàlid.');
 await ensurePdf(blob);
 const parts=path.split('/'),folder=parts.slice(0,-1).join('/'),requested=parts.at(-1);
 const {dir,createdFolder}=await resolveWriteDirectory(root,folder,{createLast:createLastFolder});
 if(typeof dir.getFileHandle!=='function')
  throw Error('El navegador no permet guardar nous PDF en esta carpeta.');
 const known=new Set(knownPaths);
 let createdName=null,createdHandle=null,completed=false;
 try{
  for(let i=0;i<1000;i++){
   const candidate=uniqueScanPath(path,known);
   if(!validateLinkedPath(candidate))throw Error('El nom final de la partitura és massa llarg.');
   const name=candidate.split('/').at(-1);
   if(await containsFile(dir,name)){known.add(candidate);continue;}
   // La comprovació es repetix sobre el directori real, no sols sobre l'índex:
   // si s'ha afegit un PDF extern no el substituirem amb un escaneig.
   createdHandle=await dir.getFileHandle(name,{create:true});
   createdName=name;
   if(typeof createdHandle.createWritable!=='function')
    throw Error('Este proveïdor d’arxius no permet guardar PDFs directament.');
   const writable=await createdHandle.createWritable();
   try{await writable.write(blob);await writable.close();}
   catch(error){await writable.abort?.().catch(()=>{});throw error;}
   completed=true;
   return {path:candidate,size:blob.size,handle:createdHandle,createdFolder:!!createdFolder};
  }
  throw Error('No es pot trobar un nom lliure per al PDF.');
 }catch(error){
  if(!completed&&createdName&&typeof dir.removeEntry==='function'){
   try{await dir.removeEntry(createdName);}catch(cleanup){
    throw Error('No s’ha pogut acabar el desament; revisa si hi ha un PDF incomplet anomenat '+
     createdName+' abans de tornar-ho a provar. '+error.message);
   }
  }
  throw error;
 }finally{
  // Només desfem una carpeta acabada de crear quan cap PDF ha quedat dins.
  if(!completed&&createdFolder&&typeof createdFolder.parent.removeEntry==='function')
   try{await createdFolder.parent.removeEntry(createdFolder.name);}catch{}
 }
}
export async function moveLinkedPdf(root,oldPath,newPath,sourceHandle,{createLastFolder=false}={}){
 if(!validateLinkedPath(oldPath)||!validateLinkedPath(newPath)||oldPath===newPath)
  throw Error('Cal triar una altra ruta vàlida.');
 if(!sourceHandle||typeof sourceHandle.move!=='function')
  throw Error('Chrome no permet moure directament este PDF. Utilitza el gestor d’arxius del dispositiu i actualitza la Biblioteca.');
 const folder=newPath.split('/').slice(0,-1).join('/'),name=newPath.split('/').at(-1);
 const {dir,createdFolder}=await resolveWriteDirectory(root,folder,{createLast:createLastFolder});
 try{
  if(await containsFile(dir,name))throw Error('Ja existix un PDF amb eixe nom en la carpeta de destinació.');
  // Usar només l'operació nativa del proveïdor. No fem còpia + eliminació:
  // si Android/Drive no suporta el moviment, l'original queda intacte.
  await sourceHandle.move(dir,name);
  return {path:newPath,handle:sourceHandle};
 }catch(error){
  if(createdFolder&&typeof createdFolder.parent.removeEntry==='function')
   try{await createdFolder.parent.removeEntry(createdFolder.name);}catch{}
  throw error;
 }
}
