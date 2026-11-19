import assert from 'node:assert/strict';
import {chromium} from 'playwright';
function makePdf(){
 const o=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 500] /Contents 4 0 R /Resources << >> >>',
  '<< /Length 0 >>\nstream\n\nendstream'];
 let p='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<o.length;i++){offsets.push(Buffer.byteLength(p));p+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n';}
 const at=Buffer.byteLength(p);p+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const n of offsets.slice(1))p+=String(n).padStart(10,'0')+' 00000 n \n';
 p+='trailer\n<< /Size '+(o.length+1)+' /Root 1 0 R >>\nstartxref\n'+at+'\n%%EOF\n';
 return Buffer.from(p);
}
const errors=[],options={headless:true,args:['--no-sandbox']};
if(process.env.PF_CHROMIUM_PATH)options.executablePath=process.env.PF_CHROMIUM_PATH;
const browser=await chromium.launch(options);
try{
 const context=await browser.newContext({viewport:{width:1000,height:800},serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',err=>errors.push(err.message));
 await page.addInitScript(()=>{window.showDirectoryPicker=()=>Promise.resolve(window.__pfRoot);});
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="source-choose"]').waitFor({timeout:16000});
 const welcome=page.locator('[data-action="welcome-done"]');
 if(await welcome.isVisible())await welcome.click();
 const pdf=makePdf();
 await page.evaluate(async bytes=>{
  const origin=await navigator.storage.getDirectory();
  const root=await origin.getDirectoryHandle('Biblioteca-W225',{create:true});
  window.__pfRoot=root;
  const file=await root.getFileHandle('Original.pdf',{create:true});
  const writer=await file.createWritable();await writer.write(new Uint8Array(bytes));await writer.close();
 },Array.from(pdf));
 await page.locator('[data-action="source-choose"]').first().click();
 await page.waitForFunction(()=>document.querySelector('.pf-library-summary .pf-source-info')?.textContent?.includes('1 PDF'),{timeout:15000});
 // Clicar Escanejar no pot canviar a Biblioteca importada.
 const snap=await page.screenshot({type:'png'});
 await page.locator('[data-action="scan-open"]').first().click();
 await page.locator('#scan-name').waitFor({timeout:15000});
 assert.match(await page.locator('.pf-scan-hint').allTextContents().then(a=>a.join(' ')),/carpeta vinculada/);
 await page.locator('#scan-gallery-input').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:snap});
 await page.locator('.pf-scan-page').first().waitFor({timeout:12000});
 await page.locator('#scan-name').fill('Nova Escanejada');
 await page.locator('#scan-new-folder').fill('Concert');
 await page.locator('[data-action="scan-save"]').first().click();
 await page.waitForFunction(()=>document.querySelector('.pf-library-summary .pf-source-info')?.textContent?.includes('2 PDF'),{timeout:24000});
 const scanCheck=await page.evaluate(async()=>{
  const db=await import('./db.js');
  const root=await navigator.storage.getDirectory();
  const library=await root.getDirectoryHandle('Biblioteca-W225');
  const folder=await library.getDirectoryHandle('Concert');
  const file=await (await folder.getFileHandle('Nova Escanejada.pdf')).getFile();
  if(file.size===0||!(await file.slice(0,20).text()).startsWith('%PDF-'))
   throw Error('El PDF escanejat no està guardat a la carpeta vinculada.');
  const imported=await db.getAllScores();
  if(imported.length)throw Error('L’escàner ha duplicat el PDF a la biblioteca importada.');
  return {size:file.size,imported:imported.length};
 });
 // La col·lisió es resol amb un nom nou; mai es trunca/sobreescriu l'original.
 const safe=await page.evaluate(async bytes=>{
  const {writeLinkedPdf,requestLinkedWriteAccess,moveLinkedPdf}=await import('./linked-files-w225.js');
  const root=await navigator.storage.getDirectory();
  const linked=await root.getDirectoryHandle('Biblioteca-W225');
  const pdf=new Blob([new Uint8Array(bytes)],{type:'application/pdf'});
  await requestLinkedWriteAccess(linked);
  const result=await writeLinkedPdf(linked,'Original.pdf',pdf,{knownPaths:['Original.pdf']});
  if(result.path!=='Original (2).pdf')throw Error('No es protegix el nom original.');
  const first=await (await linked.getFileHandle('Original.pdf')).getFile();
  if(first.size!==pdf.size)throw Error('S’ha substituït el PDF original.');
  let denied=false;
  try{await moveLinkedPdf(linked,'Original.pdf','Original (2).pdf',await linked.getFileHandle('Original.pdf'));}
  catch{denied=true;}
  if(!denied)throw Error('Un moviment ha sobreescrit un PDF existent.');
  const old=await (await linked.getFileHandle('Original.pdf')).getFile();
  if(old.size!==pdf.size)throw Error('El PDF original ha desaparegut.');
  return {path:result.path,originalSize:old.size};
 },Array.from(pdf));
 const moved=await page.evaluate(async()=>{
  const {LinkedLocalLibrary}=await import('./linked-library-w222a.js');
  const {moveLinkedScoreData,getPref,setPref,setAnnotations,getAnnotations}=await import('./db.js');
  const root=await navigator.storage.getDirectory();
  const folder=await root.getDirectoryHandle('Biblioteca-W225');
  const old='Concert/Nova Escanejada.pdf',next='Concert/Nova Renomenada.pdf';
  const lib=new LinkedLocalLibrary();
  const restored=await lib.restore();
  if(!restored||!lib.ready)throw Error('No es restaura el handle de Biblioteca.');
  const key='w222a:lib:'+lib.id+':';
  const doc={version:1,pages:{'1':[{tool:'pen',color:'#b51f34',width:.01,points:[[.1,.1],[.3,.3]]}]}};
  await setAnnotations('w222a-linked-'+lib.id+'/'+old,doc,{linkedLibraryId:lib.id});
  await setPref(key+'w13:favorites',[old]);
  await setPref(key+'w13:repertoires',[{id:'rep_test',name:'Concert',paths:[old]}]);
  await setPref('w222a:metadata:'+lib.id,{[old]:{title:'Escanejada'}});
  const file=await folder.getDirectoryHandle('Concert').then(d=>d.getFileHandle('Nova Escanejada.pdf'));
  if(typeof file.move!=='function')return {supported:false};
  await lib.movePdf(old,next,{updateData:(a,b)=>moveLinkedScoreData(lib.id,a,b)});
  const annotation=await getAnnotations('w222a-linked-'+lib.id+'/'+next);
  const favorite=await getPref(key+'w13:favorites');
  const meta=await getPref('w222a:metadata:'+lib.id);
  if(!annotation.pages['1']?.length||favorite[0]!==next||meta[next]?.title!=='Escanejada')
   throw Error('El moviment natiu no ha traslladat les dades locals.');
  const dir=await folder.getDirectoryHandle('Concert');
  const after=await (await dir.getFileHandle('Nova Renomenada.pdf')).getFile();
  if(!after.size)throw Error('El PDF mogut no existix.');
  let oldExists=true;
  try{await dir.getFileHandle('Nova Escanejada.pdf');}
  catch(error){if(error.name==='NotFoundError')oldExists=false;}
  if(oldExists)throw Error('El proveïdor no ha mogut el PDF.');
  return {supported:true,size:after.size,path:next};
 });
 assert.deepEqual(errors,[],errors.join(' | '));
 console.log('PASS W2.25: escàner al directori original, subcarpeta nova, sense duplicació en IndexedDB, noms repetits, protecció de PDF; moviment natiu quan disponible.',scanCheck,safe,moved);
 await context.close();
}finally{await browser.close();}
