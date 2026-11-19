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
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="source-choose"]').waitFor({timeout:16000});
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
 await page.locator('[data-action="source-choose"]').first().click();
 await page.locator('.pf-source-choice.active[data-action="source-linked"]').waitFor({timeout:15000});
 await page.waitForFunction(()=>document.querySelector('.pf-source-info')?.textContent?.includes('2 PDF'));
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
 if(await close.count())await close.click();else await page.goBack({waitUntil:'domcontentloaded'});
 await page.locator('[data-action="source-imported"]').first().waitFor({timeout:12000});
 await page.locator('[data-action="source-imported"]').first().click();
 await page.waitForFunction(()=>document.querySelector('.pf-source-choice.active')?.dataset.action==='source-imported');
 assert.equal(await page.locator('[data-action="open"][data-value="CIMO.pdf"]').count(),1);
 assert.equal(await page.locator('[data-action="open"][data-value="1r/Marxes/CIMO.pdf"]').count(),0);
 await page.locator('[data-action="source-linked"]').first().click();
 await page.waitForFunction(()=>document.querySelector('.pf-source-choice.active')?.dataset.action==='source-linked');
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
 await page.locator('[data-action="source-refresh"]').first().click();
 await page.waitForFunction(()=>document.querySelector('.pf-source-info')?.textContent?.includes('3 PDF'),{timeout:15000});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-action="source-linked"]').first().waitFor({timeout:15000});
 const authorize=page.locator('[data-action="source-authorize"]');
 if(await authorize.count())await authorize.first().click();
 await page.locator('[data-action="folder"][data-value="1r"]').waitFor({timeout:10000});
 await page.locator('[data-action="folder"][data-value="1r"]').click();
 await page.locator('[data-action="folder"][data-value="Marxes"]').click();
 await page.locator('[data-action="open"][data-value="1r/Marxes/CIMO.pdf"]').waitFor();
 assert.equal(await page.locator('[data-action="favorite"].active').count(),1);
 await page.locator('[data-action="meta-open"]').first().click();
 assert.equal(await page.locator('#meta-composer').inputValue(),'Ramón García i Soler');
 await page.locator('[data-action="close-modal"]').first().click();
 // Forgetting the pointer must never remove source files.
 await page.locator('[data-action="source-forget"]').first().click();
 const originalExists=await page.evaluate(async()=>{
  const dir=await (await (await navigator.storage.getDirectory()).getDirectoryHandle('W222A-Partitures')).getDirectoryHandle('1r');
  const march=await dir.getDirectoryHandle('Marxes');
  return (await (await march.getFileHandle('CIMO.pdf')).getFile()).size>0;
 });
 assert.equal(originalExists,true);
 assert.equal(await page.locator('[data-action="source-linked"]').count(),0);
 assert.deepEqual(errors,[],'Errors de navegador: '+errors.join(' | '));
 console.log('PASS W2.22A local library: live OPFS handles, recursive folders incl empty, no PDF imports, isolated favorites and metadata, native viewer, source switching, refresh external changes, reload persistence, forget leaves source intact.',linkedPrefs);
 await context.close();
}finally{await browser.close();}
