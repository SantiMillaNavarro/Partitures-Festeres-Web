/* Partitures Festeres Web W2.21 — Drive read-only provider.
   No secrets, no saved access tokens, no write endpoints, no background sync.
   Google OAuth pop-up is obtained via GIS only from a direct user click. */
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.readonly';
export const DRIVE_CLIENT_KEY='w221:oauthClientId';
export const DRIVE_FOLDER_KEY='w221:folderRef';
export const DRIVE_FOLDER_MIME='application/vnd.google-apps.folder';
export const DRIVE_MAX_PDF_BYTES=100*1024*1024;
const ID=/^[A-Za-z0-9_-]{10,250}$/;
const CLIENT=/^[0-9]+-[a-z0-9_-]{8,}\.apps\.googleusercontent\.com$/i;
const trim=value=>typeof value==='string'?value.trim():'';
const clampName=value=>trim(value).normalize('NFC').replace(/[\/\\\x00-\x1f\x7f]/g,' ').replace(/^\.+/,'').replace(/\s+/g,' ').trim().slice(0,125);
const natural=(a,b)=>String(a).localeCompare(String(b),'ca',{numeric:true,sensitivity:'base'});
export function validOAuthClientId(id){return CLIENT.test(trim(id));}
export function parseDriveFolderReference(value){
 const raw=trim(value);
 if(!raw)return null;
 if(ID.test(raw))return {id:raw,resourceKey:null};
 let url;
 try{url=new URL(raw);}catch{return null;}
 if(url.protocol!=='https:'||url.hostname!=='drive.google.com')return null;
 const match=/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,250})\/?$/.exec(url.pathname);
 if(!match)return null;
 const key=url.searchParams.get('resourcekey');
 return {id:match[1],resourceKey:key&&ID.test(key)?key:null};
}
export const isPdfDriveFile=file=>file&&file.mimeType!=='application/vnd.google-apps.shortcut'&&
 (file.mimeType==='application/pdf'||/\.pdf$/i.test(file.name||''));
export function safeDriveSegment(value){
 const segment=clampName(value);
 return !segment||segment==='.'||segment==='..'?'Sense nom':segment;
}
export function localDrivePath(root,folders,file){
 let filename=safeDriveSegment(file).replace(/\.pdf$/i,'');
 if(!filename||filename==='Sense nom')filename='Partitura';
 const components=['Drive',safeDriveSegment(root),...folders.map(safeDriveSegment),filename+'.pdf'];
 const joined=components.join('/');
 if(joined.length>480)throw Error('La ruta de la partitura és massa llarga.');
 return joined;
}
export function availableDrivePath(path,known){
 const exists=new Set(known);
 if(!exists.has(path))return path;
 const base=path.replace(/\.pdf$/i,'');
 for(let n=2;n<=9999;n++){
  const candidate=base+' ('+n+').pdf';
  if(candidate.length<=500&&!exists.has(candidate))return candidate;
 }
 throw Error('No es pot trobar un nom lliure per a esta partitura.');
}
function friendlyStatus(status){
 if(status===401)return 'La sessió de Google ha caducat. Torna a connectar.';
 if(status===403)return 'Google Drive no ha autoritzat esta operació o el fitxer està restringit.';
 if(status===404)return 'La carpeta o la partitura no està disponible en Google Drive.';
 if(status===429||status===503)return 'Google Drive ha limitat temporalment les peticions. Prova-ho més tard.';
 return 'No s’ha pogut completar la consulta a Google Drive ('+status+').';
}
function assertId(id){if(!ID.test(trim(id)))throw Error('Identificador de Drive no vàlid.');return id;}
export class DriveReadOnly{
 constructor({fetchImpl=fetch,globalObject=typeof window!=='undefined'?window:null}={}){
  this.fetchImpl=fetchImpl;this.global=globalObject;
  this.clientId='';this.token=null;this.expiresAt=0;this.busyAuth=false;
 }
 get authorized(){return !!this.token&&Date.now()<this.expiresAt;}
 setClientId(id){if(id&&!validOAuthClientId(id))throw Error('Identificador OAuth no vàlid.');
  if(this.clientId!==id){this.token=null;this.expiresAt=0;}this.clientId=id;
 }
 // Only for explicit, on-demand load. Never called as part of app startup.
 prepareIdentity(){
  const g=this.global;
  if(!g)throw Error('Este navegador no disposa d’accés a Google.');
  if(g.google?.accounts?.oauth2?.initTokenClient)return Promise.resolve(true);
  if(this._identityPromise)return this._identityPromise;
  this._identityPromise=new Promise((resolve,reject)=>{
   if(!g.document)throw Error('No hi ha cap document web.');
   const script=g.document.createElement('script');
   script.src='https://accounts.google.com/gsi/client';
   script.async=true;script.defer=true;
   script.onload=()=>{
    if(g.google?.accounts?.oauth2?.initTokenClient)resolve(true);
    else reject(Error('Google Identity Services no està disponible.'));
   };
   script.onerror=()=>reject(Error('No es pot carregar l’autorització de Google. Comprova la connexió.'));
   g.document.head.append(script);
  }).catch(error=>{this._identityPromise=null;throw error;});
  return this._identityPromise;
 }
 // Called only inside the actual click handler, without awaiting network calls
 // before requestAccessToken; otherwise browsers can block the OAuth pop-up.
 connect(){
  if(!this.clientId)throw Error('Configura abans l’identificador OAuth.');
  const oauth=this.global?.google?.accounts?.oauth2;
  if(!oauth?.initTokenClient)throw Error('Prepara primer l’accés a Google.');
  if(this.busyAuth)throw Error('Ja hi ha una sol·licitud de connexió oberta.');
  this.busyAuth=true;
  return new Promise((resolve,reject)=>{
   const fail=err=>{this.busyAuth=false;reject(Error(err?.message||'La connexió amb Google s’ha cancel·lat.'));};
   try{
    const client=oauth.initTokenClient({
     client_id:this.clientId,scope:DRIVE_SCOPE,
     callback:response=>{
      if(!response?.access_token||response.error){
       fail(Error(response?.error_description||response?.error||'Google no ha concedit accés.'));return;
      }
      this.token=response.access_token;
      this.expiresAt=Date.now()+Math.max(0,Number(response.expires_in)||3600)*1000-30_000;
      this.busyAuth=false;resolve(true);
     },
     error_callback:error=>fail(Error(error?.message||error?.type||'Error en l’accés a Google.'))
    });
    client.requestAccessToken();
   }catch(error){fail(error);}
  });
 }
 disconnect(){
  const token=this.token;
  this.token=null;this.expiresAt=0;
  const revoke=this.global?.google?.accounts?.oauth2?.revoke;
  if(token&&typeof revoke==='function')try{revoke(token,()=>{});}catch{}
 }
 async request(path,{query={},resourceKey=null,media=false}={}){
  if(!this.authorized){this.token=null;throw Error('Connecta’t a Google Drive per a continuar.');}
  if(!this.global?.navigator?.onLine&&this.global?.navigator?.onLine!==undefined)
   throw Error('Sense connexió a Internet. Les partitures ja baixades continuen accessibles en Biblioteca.');
  const url=new URL('https://www.googleapis.com/drive/v3/'+path);
  for(const [key,value] of Object.entries(query))if(value!==null&&value!==undefined)url.searchParams.set(key,String(value));
  const headers={Authorization:'Bearer '+this.token};
  if(resourceKey)headers['X-Goog-Drive-Resource-Keys']=resourceKey;
  let response;
  try{response=await this.fetchImpl(url.toString(),{method:'GET',headers,cache:'no-store',credentials:'omit'});}
  catch(error){throw Error('No s’ha pogut contactar amb Google Drive. Comprova Internet.');}
  if(!response.ok){
   if(response.status===401){this.token=null;this.expiresAt=0;}
   throw Error(friendlyStatus(response.status));
  }
  if(!media)return response.json();
  const headerLength=Number(response.headers.get('content-length')||0);
  if(headerLength>DRIVE_MAX_PDF_BYTES)throw Error('El PDF supera el límit de 100 MB.');
  if(response.body?.getReader){
   const reader=response.body.getReader(),chunks=[];let length=0;
   try{
    while(true){
     const {done,value}=await reader.read();if(done)break;
     length+=value.byteLength;
     if(length>DRIVE_MAX_PDF_BYTES){await reader.cancel();throw Error('El PDF supera el límit de 100 MB.');}
     chunks.push(value);
    }
   }finally{try{reader.releaseLock();}catch{}}
   return new Blob(chunks,{type:'application/pdf'});
  }
  const blob=await response.blob();
  if(blob.size>DRIVE_MAX_PDF_BYTES)throw Error('El PDF supera el límit de 100 MB.');
  return blob;
 }
 async metadata(id,resourceKey=null){
  assertId(id);
  const data=await this.request('files/'+encodeURIComponent(id),{
   query:{fields:'id,name,mimeType,trashed,size,capabilities/canDownload,resourceKey',
    supportsAllDrives:'true'},
   resourceKey:resourceKey?id+'/'+resourceKey:null
  });
  if(!data?.id||data.trashed)throw Error('El document seleccionat ja no està disponible.');
  return data;
 }
 async folder(id,resourceKey=null){
  const meta=await this.metadata(id,resourceKey);
  if(meta.mimeType!==DRIVE_FOLDER_MIME)throw Error('L’enllaç no correspon a una carpeta de Google Drive.');
  return {id:meta.id,name:meta.name,resourceKey:meta.resourceKey||resourceKey||null};
 }
 async children(folder,{resourceKey=null,limit=5000}={}){
  assertId(folder);
  const files=[],visited=new Set();let next=null;
  do{
   const query={
    q:"'"+folder+"' in parents and trashed = false",
    pageSize:500,fields:'nextPageToken,files(id,name,mimeType,size,modifiedTime,capabilities/canDownload,resourceKey,trashed)',
    supportsAllDrives:'true',includeItemsFromAllDrives:'true'
   };
   if(next)query.pageToken=next;
   const data=await this.request('files',{
    query,resourceKey:resourceKey?folder+'/'+resourceKey:null
   });
   if(!Array.isArray(data?.files))throw Error('Resposta inesperada de Google Drive.');
   for(const item of data.files){
    if(!item?.id||!ID.test(item.id)||item.trashed||item.mimeType!==DRIVE_FOLDER_MIME&&!isPdfDriveFile(item))continue;
    files.push(item);
    if(files.length>limit)throw Error('La carpeta conté massa elements. Tria una subcarpeta més menuda.');
   }
   next=data.nextPageToken||null;
   if(next){if(visited.has(next))throw Error('Google Drive ha tornat una paginació repetida.');visited.add(next);}
  }while(next);
  files.sort((a,b)=>Number(b.mimeType===DRIVE_FOLDER_MIME)-Number(a.mimeType===DRIVE_FOLDER_MIME)||natural(a.name,b.name));
  return files;
 }
 async pdf(item){
  if(!isPdfDriveFile(item)||!ID.test(item.id))throw Error('El fitxer seleccionat no és una partitura PDF.');
  if(item.capabilities?.canDownload===false)throw Error('Google Drive no permet descarregar esta partitura.');
  if(Number(item.size)>DRIVE_MAX_PDF_BYTES)throw Error('El PDF supera el límit de 100 MB.');
  const blob=await this.request('files/'+encodeURIComponent(item.id),{
   query:{alt:'media',supportsAllDrives:'true'},
   resourceKey:item.resourceKey?item.id+'/'+item.resourceKey:null,media:true
  });
  if(!blob.size)throw Error('El PDF de Drive és buit.');
  const preview=new TextDecoder('latin1').decode(await blob.slice(0,1024).arrayBuffer());
  if(!preview.includes('%PDF-'))throw Error('El fitxer rebut de Drive no és un PDF vàlid.');
  return blob;
 }
}
