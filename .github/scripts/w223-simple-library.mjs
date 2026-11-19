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
const pdf=makePdf(),errors=[],options={headless:true,args:['--no-sandbox']};
if(process.env.PF_CHROMIUM_PATH)options.executablePath=process.env.PF_CHROMIUM_PATH;
const browser=await chromium.launch(options);
try{
 const context=await browser.newContext({viewport:{width:1000,height:800},serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',err=>errors.push(err.message));
 await page.addInitScript(()=>{
  window.showDirectoryPicker=()=>Promise.resolve(window.__pfRoot);
 });
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="source-choose"]').waitFor({timeout:14000});
 const welcome=page.locator('[data-action="welcome-done"]');
 if(await welcome.isVisible())await welcome.click();
 await page.evaluate(async bytes=>{
  const opfs=await navigator.storage.getDirectory();
  const folder=await opfs.getDirectoryHandle('pf-w223-auto',{create:true});
  window.__pfRoot=folder;
  const create=async name=>{
   const h=await folder.getFileHandle(name,{create:true});
   const w=await h.createWritable();await w.write(new Uint8Array(bytes));await w.close();
  };
  await create('Primera.pdf');
 },Array.from(pdf));
 await page.locator('[data-action="source-choose"]').first().click();
 await page.waitForFunction(()=>document.querySelector('.pf-library-summary .pf-source-info')?.textContent?.includes('1 PDF'),{timeout:12000});
 assert.equal(await page.locator('#pf-source-config').count(),0,'No s’han ocultat les opcions tècniques.');
 assert.equal(await page.locator('.pf-source-offline').count(),0,'Les còpies offline no han de dominar Biblioteca.');
 await page.locator('[data-action="source-manage"]').first().click();
 const autoon=page.locator('[data-action="source-auto-toggle"]');
 assert.equal(await autoon.getAttribute('aria-pressed'),'true','Comprovació automàtica desactivada per defecte.');
 assert.equal(await page.locator('.pf-library-advanced').getAttribute('open'),null,'Opcions avançades obertes per defecte.');
 await page.locator('[data-action="page"][data-value="library"]').first().click();
 // Simular un nou PDF en la mateixa carpeta des del gestor de fitxers.
 await page.evaluate(async bytes=>{
  const folder=await (await navigator.storage.getDirectory()).getDirectoryHandle('pf-w223-auto');
  const h=await folder.getFileHandle('Segona.pdf',{create:true});
  const w=await h.createWritable();await w.write(new Uint8Array(bytes));await w.close();
 },Array.from(pdf));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('.pf-library-summary .pf-source-info')?.textContent?.includes('2 PDF'),{timeout:16000});
 // El control de seguretat comprova permisos i no fa una nova crida requestPermission.
 const safe=await page.evaluate(async()=>{
  const {LinkedLocalLibrary}=await import('./linked-library-w222a.js');
  const lib=new LinkedLocalLibrary();
  lib.id='permission-check';lib.name='Partitures';lib.status='cached';
  lib.scores=[{path:'Primera.pdf',size:0,added:0}];
  lib.folders=['1r'];
  let requested=0,enumerated=0;
  lib.handle={
   kind:'directory',name:'Partitures',
   queryPermission:async()=> 'prompt',
   requestPermission:async()=>{requested++;throw Error('No es poden demanar permisos en segon pla.');},
   async *entries(){enumerated++;throw new DOMException('blocked','NotAllowedError');}
  };
  const outcome=await lib.checkForChanges();
  if(!outcome.unavailable||lib.scores.length!==1||lib.folders[0]!=='1r'||requested!==0||enumerated!==1)
   throw Error('La comprovació ha de provar la lectura sense demanar permís ni perdre l’índex.');
  // Android pot respondre "prompt" però permetre llegir entries(): cal
  // detectar els canvis sense obligar a autoritzar ni a copiar fitxers.
  lib.handle={kind:'directory',name:'Partitures',
   queryPermission:async()=> 'prompt',
   requestPermission:async()=>{requested++;throw Error('Unexpected requestPermission');},
   async *entries(){
    enumerated++;
    yield ['1r',{kind:'directory',name:'1r',async *entries(){}}];
    yield ['Nova.pdf',{kind:'file',name:'Nova.pdf'}];
   }};
  const readable=await lib.checkForChanges();
  if(!readable.changed||lib.scores[0]?.path!=='Nova.pdf'||requested!==0)
   throw Error('No es detecta una carpeta llegible amb permís prompt.');
  const {renderSourceControls}=await import('./library-source-ui-w223.js');
  lib.checkState='unavailable';
  const userAction=renderSourceControls({linked:lib,mode:'linked',lang:'va',supported:true});
  if(!userAction.includes('data-action="source-authorize"')||!userAction.includes('Activar biblioteca'))
   throw Error('No s’ofereix reautorització visible des de Biblioteca.');
  // Sense API de permisos, un gestor que denega entries() tampoc pot
  // eliminar els resultats guardats prèviament.
  lib.handle={kind:'directory',name:'Partitures',
   async *entries(){throw new DOMException('No access','NotAllowedError');}};
  const denied=await lib.checkForChanges();
  if(!denied.unavailable||lib.scores.length!==1||lib.folders.length!==1)
   throw Error('Els fitxers s’han esborrat per un permís temporal.');
  return {requested,enumerated,index:lib.scores.length};
 });
 assert.equal(safe.index,1);
 // La lectura directa d'un PDF no ha de copiar-lo en segon pla.
 const lazyRead=await page.evaluate(async bytes=>{
  const {LinkedLocalLibrary}=await import('./linked-library-w222a.js');
  const file=new Blob([new Uint8Array(bytes)],{type:'application/pdf'});
  const lib=new LinkedLocalLibrary();
  lib.id='w223b-no-implicit-copy';lib.name='Directa';lib.status='ready';
  lib.scores=[{path:'Directa.pdf',size:0,added:0}];
  lib.files.set('Directa.pdf',{kind:'file',getFile:async()=>file});
  lib.handle={kind:'directory',name:'Directa'};
  const score=await lib.getScore('Directa.pdf');
  if(!score||score.offline||score.blob.size!==file.size)throw Error('No se llig el PDF original.');
  await new Promise(resolve=>setTimeout(resolve,150));
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('partitures-festeres-linked-w222a',2);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const saved=await new Promise((resolve,reject)=>{
   const req=db.transaction('cachedPdfs','readonly').objectStore('cachedPdfs')
    .get(lib.id+'\\u0000Directa.pdf');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  db.close();
  if(saved)throw Error('Obrir o generar miniatura ha copiat un PDF sense consentiment.');
  return {original:score.blob.size,copied:!!saved};
 },Array.from(pdf));
 assert.equal(lazyRead.copied,false);
 // L'usuari pot apagar l'actualització automàtica en Ajustos.
 await page.locator('[data-action="source-manage"]').first().click();
 await page.locator('[data-action="source-auto-toggle"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action="source-auto-toggle"]')?.getAttribute('aria-pressed')==='false');
 await page.locator('[data-action="page"][data-value="library"]').first().click();
 await page.evaluate(async bytes=>{
  const folder=await (await navigator.storage.getDirectory()).getDirectoryHandle('pf-w223-auto');
  const h=await folder.getFileHandle('Tercera.pdf',{create:true});
  const w=await h.createWritable();await w.write(new Uint8Array(bytes));await w.close();
 },Array.from(pdf));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('.pf-library-summary .pf-source-info')?.textContent?.includes('2 PDF'),{timeout:14000});
 await page.waitForTimeout(1200);
 assert.match(await page.locator('.pf-library-summary .pf-source-info').innerText(),/2 PDF/);
 await page.locator('[data-action="source-manage"]').first().click();
 await page.locator('[data-action="source-refresh"]').first().click();
 await page.waitForFunction(()=>document.querySelector('#pf-source-config .pf-source-info')?.textContent?.includes('3 PDF'),{timeout:15000});
 await page.locator('[data-action="source-auto-toggle"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action="source-auto-toggle"]')?.getAttribute('aria-pressed')==='true');
 assert.deepEqual(errors,[],errors.join(' | '));
 console.log('PASS W2.23B: startup auto-read with prompt where readable, one-tap authorization UI, no implicit PDF copies, index retained, toggle and manual refresh.',safe,lazyRead);
 await context.close();
}finally{await browser.close();}
