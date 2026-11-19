import assert from 'node:assert/strict';
import {chromium} from 'playwright';

function makePdf(){
 const objs=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 500] /Contents 4 0 R /Resources << >> >>',
  '<< /Length 0 >>\nstream\n\nendstream'
 ];
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<objs.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+objs[i]+'\nendobj\n';}
 const start=Buffer.byteLength(pdf);
 pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
 for(const off of offsets.slice(1))pdf+=String(off).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
 return Buffer.from(pdf,'utf8');
}
const pdf=makePdf(),errors=[];
const options={headless:true,args:['--no-sandbox']};
if(process.env.PF_CHROMIUM_PATH)options.executablePath=process.env.PF_CHROMIUM_PATH;
const browser=await chromium.launch(options);
try{
 const context=await browser.newContext({viewport:{width:1100,height:800},serviceWorkers:'block'});
 const page=await context.newPage();
 const cdp=await context.newCDPSession(page);
 await cdp.send('Debugger.enable');
 await cdp.send('Runtime.enable');
 cdp.on('Runtime.exceptionThrown',event=>{
  const e=event.exceptionDetails;
  console.log('W222A RUNTIME EXCEPTION',JSON.stringify({
   url:e.url,line:e.lineNumber,column:e.columnNumber,
   text:e.text,description:e.exception?.description
  }));
 });
 cdp.on('Debugger.scriptFailedToParse',item=>{
  console.log('W222A SCRIPT PARSE',JSON.stringify({
   url:item.url,message:item.errorMessage,line:item.startLine,column:item.startColumn,
   details:item.exceptionDetails,
   failedAt:{startLine:item.startLine,endLine:item.endLine,startColumn:item.startColumn,endColumn:item.endColumn}

  }));
 });
 // CI headless Chrome may hide the native picker. Emulate only the
 // user-triggered picker; the returned OPFS handle is genuine and clonable.
 await page.addInitScript(()=>{
  window.showDirectoryPicker=()=>Promise.resolve(window.__w222folder);
  window.__directoryReadCount=0;
  const proto=globalThis.FileSystemDirectoryHandle?.prototype;
  if(proto?.entries){
   const original=proto.entries;
   proto.entries=function(...args){
    window.__directoryReadCount++;
    return original.apply(this,args);
   };
  }
 });
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',msg=>{if(msg.type()==='error')console.log('W222A CONSOLE:',msg.text());});
 page.on('response',res=>{if(res.status()>=400)console.log('W222A HTTP:',res.status(),res.url());});
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 try{await page.locator('[data-action="source-choose"]').waitFor({timeout:16000});}
 catch(error){
  console.log('W222A INITIAL DEBUG',JSON.stringify({
   body:(await page.locator('body').innerText()).slice(0,1800),
   errors,
   state:await page.evaluate(()=>({secure:window.isSecureContext,picker:typeof window.showDirectoryPicker,html:document.getElementById('app')?.innerHTML.slice(0,1200)}))
  },null,2));
  throw error;
 }
 const welcome=page.locator('[data-action="welcome-done"]');
 if(await welcome.count())await welcome.click();
 await page.locator('#import-input').setInputFiles({name:'CIMO.pdf',mimeType:'application/pdf',buffer:pdf});
 await page.waitForFunction(async()=> (await (await import('./db.js')).getAllScores()).length===1);
 const bootstrap=await page.evaluate(async(pdfArray)=>{
  const raw=new Uint8Array(pdfArray);
  const create=async(dir,name)=>{
   const file=await dir.getFileHandle(name,{create:true});
   const stream=await file.createWritable();await stream.write(raw);await stream.close();
  };
  const opfs=await navigator.storage.getDirectory();
  const root=await opfs.getDirectoryHandle('W222A-Partitures',{create:true});
  const first=await root.getDirectoryHandle('1r',{create:true});
  const second=await root.getDirectoryHandle('2n',{create:true});
  const march=await first.getDirectoryHandle('Marxes',{create:true});
  await first.getDirectoryHandle('Buides',{create:true});
  await create(march,'CIMO.pdf');
  await create(second,'Dianes.PDF');
  window.showDirectoryPicker=()=>Promise.resolve(root);
  window.__w222folder=root;
  if(typeof FileSystemDirectoryHandle.prototype.queryPermission!=='function'){
   FileSystemDirectoryHandle.prototype.queryPermission=async()=> 'granted';
  }
  if(typeof FileSystemDirectoryHandle.prototype.requestPermission!=='function'){
   FileSystemDirectoryHandle.prototype.requestPermission=async()=> 'granted';
  }
  return {support:typeof window.showDirectoryPicker,root:root.name};
 },Array.from(pdf));
 assert.equal(bootstrap.support,'function');
 // Android SAF regression: a selected directory may be readable even if
 // permission APIs are absent or return 'prompt'. Never report 0 PDFs.
 const permissionScenarios=await page.evaluate(async()=>{
  const {LinkedLocalLibrary}=await import('./linked-library-w222a.js');
  const {renderSourceControls}=await import('./library-source-ui-w223.js');
  const dir=window.__w222folder;
  const create=overrides=>{
   const linked=new LinkedLocalLibrary();
   linked.id='test-android';linked.name='Partitures';
   linked.handle={kind:'directory',name:'Partitures',entries:()=>dir.entries(),...overrides};
   linked.status='permission';
   return linked;
  };
  const noApi=create({});
  if(!(await noApi.scan({ask:false}))||noApi.scores.length!==2)throw Error('Android sense queryPermission: bloqueig incorrecte.');
  const prompt=create({queryPermission:async()=> 'prompt',requestPermission:async()=> 'prompt'});
  if(!(await prompt.scan({ask:false}))||prompt.scores.length!==2)throw Error('Permís prompt però carpeta llegible.');
  if(!(await prompt.scan({ask:true}))||prompt.scores.length!==2)throw Error('Reautorització prompt però carpeta llegible.');
  const denied=create({requestPermission:async()=> 'denied'});
  if(await denied.scan({ask:true})||denied.status!=='permission')throw Error('Denegació explícita ignorada.');
  const unreadable=create({entries:async function*(){throw new DOMException('Blocked','NotAllowedError')}});
  if(await unreadable.scan({ask:false})||unreadable.status!=='permission')throw Error('Error d’accés no identificat.');
  const notReadyUI=renderSourceControls({linked:unreadable,mode:'linked',lang:'va',supported:true});
  if(notReadyUI.includes('0 PDF')||notReadyUI.includes('data-action="source-authorize"'))
   throw Error('El visor mostra 0 PDF falsos o oferix un botó inoperant.');
  const same=new LinkedLocalLibrary();
  await same.save(dir);const id=same.id;await same.save(dir);
  if(same.id!==id)throw Error('Tornar a triar la mateixa carpeta esborra la identitat dels repertoris.');
  await same.forget();
  return {noApi:noApi.scores.length,prompt:prompt.scores.length,denied:denied.status,unreadable:unreadable.status};
 });
 assert.equal(permissionScenarios.noApi,2);
 await page.locator('[data-action="source-choose"]').first().click();
 await page.waitForFunction(()=>document.querySelector('.pf-library-summary .pf-source-info')?.textContent?.includes('2 PDF'));
 await page.waitForFunction(()=>document.querySelector('.pf-source-info')?.textContent?.includes('2 PDF'));
 console.log('W222A folder state',JSON.stringify(await page.evaluate(()=>({
  folders:[...document.querySelectorAll('[data-action="folder"]')].map(e=>({value:e.dataset.value,text:e.textContent?.trim().slice(0,90)})),
  body:document.querySelector('.content')?.innerText.slice(0,1350),
  crumbs:[...document.querySelectorAll('.crumb')].map(e=>e.textContent)
 })),null,2));
 assert.equal(await page.locator('[data-action="folder"][data-value="1r"]').count(),1);
 assert.equal(await page.locator('[data-action="folder"][data-value="2n"]').count(),1);
 await page.locator('[data-action="folder"][data-value="1r"]').click();
 assert.equal(await page.locator('[data-action="folder"][data-value="Buides"]').count(),1);
 await page.locator('[data-action="folder"][data-value="Marxes"]').click();
 await page.locator('[data-action="favorite"]').first().click();
 await page.waitForFunction(async()=>{
  const {getAllPrefs}=await import('./db.js');
  const prefs=await getAllPrefs();
  return prefs.some(p=>p.key.startsWith('w222a:lib:')&&p.key.endsWith(':w13:favorites')&&p.value.includes('1r/Marxes/CIMO.pdf'));
 });
 await page.locator('[data-action="meta-open"]').first().click();
 await page.locator('#meta-composer').fill('Ramón García i Soler');
 await page.locator('[data-action="meta-save"]').click();
 await page.waitForFunction(async()=>{
  const {getAllPrefs}=await import('./db.js');
  return (await getAllPrefs()).some(p=>p.key.startsWith('w222a:metadata:')&&p.value?.['1r/Marxes/CIMO.pdf']?.composer==='Ramón García i Soler');
 });
 const linkedPrefs=await page.evaluate(async()=>{
  const db=await import('./db.js');
  const scores=await db.getAllScores();
  const prefs=await db.getAllPrefs();
  if(scores.length!==1||scores[0].path!=='CIMO.pdf')throw Error('Els PDF vinculats s’han copiat a IndexedDB.');
  const folderKeys=prefs.filter(p=>p.key.startsWith('w222a:'));
  if(folderKeys.some(p=>p.value?.kind==='directory'))throw Error('Handle de carpeta en prefs normals.');
  return {dbScores:scores.length,scopedPrefs:folderKeys.length};
 });
 assert.equal(linkedPrefs.dbScores,1);
 // Directly opening the source PDF must be possible.
 await page.locator('[data-action="open"][data-value="1r/Marxes/CIMO.pdf"]').first().click();
 await page.locator('#viewer-stage').waitFor({timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#viewer-stage')?.dataset?.path==='1r/Marxes/CIMO.pdf');
 // Close viewer through its own button, preserving browser back history.
 const close=page.locator('[data-action="viewer-close"],[data-action="close-viewer"]').first();
 if(await close.count())await page.evaluate(()=>document.querySelector('[data-action="viewer-close"],[data-action="close-viewer"]')?.click());
 else await page.goBack({waitUntil:'domcontentloaded'});
 await page.locator('[data-action="source-manage"]').first().click();
 await page.locator('[data-action="source-imported"]').first().waitFor({timeout:12000});
 await page.locator('[data-action="source-imported"]').first().click();
 await page.waitForFunction(()=>document.querySelector('.pf-library-summary strong')?.textContent?.includes('Biblioteca importada'));
 assert.equal(await page.locator('[data-action="open"][data-value="CIMO.pdf"]').count(),1);
 assert.equal(await page.locator('[data-action="open"][data-value="1r/Marxes/CIMO.pdf"]').count(),0);
 await page.locator('[data-action="source-manage"]').first().click();
 await page.locator('[data-action="source-linked"]').first().click();
 await page.waitForFunction(()=>document.querySelector('.pf-library-summary .pf-source-info')?.textContent?.includes('2 PDF'));
 const add=await page.evaluate(async(pdfArray)=>{
  const root=window.__w222folder;
  const first=await root.getDirectoryHandle('1r');
  const march=await first.getDirectoryHandle('Marxes');
  const file=await march.getFileHandle('NOVA.pdf',{create:true});
  const stream=await file.createWritable();
  await stream.write(new Uint8Array(pdfArray));await stream.close();
  return (await file.getFile()).size;
 },Array.from(pdf));
 assert(add>0);
 await page.locator('[data-action="source-manage"]').first().click();
 await page.locator('[data-action="source-refresh"]').first().click();
 await page.waitForFunction(()=>document.querySelector('#pf-source-config .pf-source-info')?.textContent?.includes('3 PDF'),{timeout:15000});
 // W2.22A.4: una única preparació de les còpies offline ha d'evitar
 // qualsevol petició de permís posterior, també per a PDF no oberts abans.
 await page.locator('.pf-library-advanced summary').first().click();
 await page.locator('[data-action="source-cache"]').first().click();
 await page.waitForFunction(()=>
  document.querySelector('.pf-source-offline')?.textContent?.includes('3/3')&&
  !document.querySelector('[data-action="source-cache-stop"]'),
 {timeout:15000});
 const offlineSnapshot=await page.evaluate(async()=>{
  const {LinkedLocalLibrary}=await import('./linked-library-w222a.js');
  const library=new LinkedLocalLibrary();
  if(!(await library.restore()))throw Error('La carpeta vinculada no s’ha recuperat.');
  if(library.offlineCount!==3)throw Error('No s’han guardat les tres còpies locals.');
  library.handle={name:'Permís revocat',kind:'directory',
   async *entries(){throw new DOMException('Permission expired','NotAllowedError');}};
  library.files.clear();
  const record=await library.getScore('2n/Dianes.PDF');
  if(!record?.blob?.size||!record.offline)throw Error('No s’obri el PDF després de revocar el permís.');
  return {count:library.offlineCount,size:record.blob.size};
 });
 assert.equal(offlineSnapshot.count,3);
 // Guardem l'índex però MAI el blob dins de l'índex; ara les
 // còpies offline sí estan en un magatzem separat d'IndexedDB.
 const cached=await page.evaluate(async()=>{
  const {LinkedLocalLibrary}=await import('./linked-library-w222a.js');
  const restored=new LinkedLocalLibrary();
  if(!(await restored.restore()))throw Error('No s’ha conservat la carpeta.');
  if(restored.status!=='cached'||restored.scores.length!==3)
   throw Error('No s’ha guardat l’índex lleuger.');
  if(restored.files.size&&restored.files.size!==3)
   throw Error('No s’han conservat les referències directes de forma íntegra.');
  const read=await restored.getScore('1r/Marxes/CIMO.pdf');
  if(!read?.blob?.size)throw Error('L’índex persistit no permet obrir un PDF individual.');
  if(restored.files.size!==1&&restored.files.size!==3)
   throw Error('La consulta ha invalidat les referències als PDF.');
  return {scores:restored.scores.length,folders:restored.folders.length,bytes:read.blob.size};
 });
 assert.equal(cached.scores,3);
 // Emula un proveïdor Android/SAF que retorna un NotAllowedError
 // quan es crida getFileHandle(), però els handles enumerats sí funcionen.
 const androidFiles=await page.evaluate(async()=>{
  const {LinkedLocalLibrary}=await import('./linked-library-w222a.js');
  const wrap=real=>({
   name:real.name,kind:'directory',
   async getDirectoryHandle(){throw new DOMException('No direct traversal','NotAllowedError');},
   async getFileHandle(){throw new DOMException('No direct filename','NotAllowedError');},
   async *entries(){
    for await(const [name,item] of real.entries())
     yield [name,item.kind==='directory'?wrap(item):item];
   }
  });
  const lib=new LinkedLocalLibrary();
  lib.id='fake-saf';lib.name='Partitures';
  lib.status='cached';lib.handle=wrap(window.__w222folder);
  lib.scores=[{path:'1r/Marxes/CIMO.pdf',size:0,added:0}];
  const first=await lib.getScore('1r/Marxes/CIMO.pdf');
  if(!first?.blob?.size)throw Error('El proveïdor Android no permet obrir el PDF via entries.');
  lib.files.set('1r/Marxes/CIMO.pdf',{
   kind:'file',async getFile(){throw new DOMException('Stale handle','NotAllowedError');}
  });
  const second=await lib.getScore('1r/Marxes/CIMO.pdf');
  if(!second?.blob?.size)throw Error('No es recupera un handle antic via entries.');
  const denied=new LinkedLocalLibrary();
  denied.id='fake-denied';denied.name='Partitures';denied.status='cached';
  denied.scores=[{path:'1r/Marxes/CIMO.pdf',size:0,added:0}];
  denied.handle={kind:'directory',name:'Partitures',
   async *entries(){throw new DOMException('Blocked','NotAllowedError');}};
  let message='';
  try{await denied.getScore('1r/Marxes/CIMO.pdf');}
  catch(error){message=error.message;}
  if(!message.includes('Chrome')||message.includes('importar'))
   throw Error('No hi ha diagnòstic clar del PDF bloquejat.');
  return {first:first.blob.size,second:second.blob.size,message};
 });
 assert(androidFiles.first>0&&androidFiles.second>0);
 await page.locator('[data-action="page"][data-value="library"]').first().click();
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('.pf-library-summary .pf-source-info')?.textContent?.includes('3 PDF'),{timeout:15000});
 // Després del render, la comprovació pot enumerar carpetes en segon pla.
 // La restauració del catàleg no ha de necessitar autorització manual.

 await page.locator('[data-action="folder"][data-value="1r"]').waitFor({timeout:10000});
 await page.locator('[data-action="folder"][data-value="1r"]').click();
 await page.locator('[data-action="folder"][data-value="Marxes"]').click();
 await page.locator('[data-action="open"][data-value="1r/Marxes/CIMO.pdf"]').waitFor();
 assert.equal(await page.locator('[data-action="favorite"].active').count(),1);
 await page.locator('[data-action="meta-open"]').first().click();
 assert.equal(await page.locator('#meta-composer').inputValue(),'Ramón García i Soler');
 await page.locator('[data-action="close-modal"]').first().click();
 // Forgetting the pointer must never remove source files.
 await page.locator('[data-action="source-manage"]').first().click();
 await page.locator('[data-action="source-forget"]').first().click();
 const originalExists=await page.evaluate(async()=>{
  const dir=await (await (await navigator.storage.getDirectory()).getDirectoryHandle('W222A-Partitures')).getDirectoryHandle('1r');
  const march=await dir.getDirectoryHandle('Marxes');
  return (await (await march.getFileHandle('CIMO.pdf')).getFile()).size>0;
 });
 assert.equal(originalExists,true);
 await page.waitForFunction(()=>document.querySelector('[data-action="source-linked"]')===null,{timeout:10000});
 assert.deepEqual(errors,[],'Errors de navegador: '+errors.join(' | '));
 console.log('PASS W2.22A: linked folders, stored lightweight index, ZERO directory enumerations at startup, lazy single-file read after reload, isolated preferences, refresh, originals untouched.',{...linkedPrefs,cached});
 await context.close();
}finally{await browser.close();}
