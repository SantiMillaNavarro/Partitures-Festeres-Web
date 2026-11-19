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
 const context=await browser.newContext({viewport:{width:1100,height:800},serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',err=>errors.push(err.message));
 await page.addInitScript(()=>{window.showDirectoryPicker=()=>Promise.resolve(window.__pfRoot);});
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="source-choose"]').waitFor({timeout:16000});
 const welcome=page.locator('[data-action="welcome-done"]');
 if(await welcome.isVisible())await welcome.click();
 const pdf=makePdf();
 await page.evaluate(async bytes=>{
  const dir=await navigator.storage.getDirectory();
  const root=await dir.getDirectoryHandle('Biblioteca-W224',{create:true});
  window.__pfRoot=root;
  for(const name of ['Primera.pdf','Segona.pdf']){
   const file=await root.getFileHandle(name,{create:true});
   const writer=await file.createWritable();await writer.write(new Uint8Array(bytes));await writer.close();
  }
 },Array.from(pdf));
 await page.locator('[data-action="source-choose"]').first().click();
 await page.waitForFunction(()=>document.querySelector('.pf-library-summary .pf-source-info')?.textContent?.includes('2 PDF'),{timeout:15000});
 const saved=await page.evaluate(async bytes=>{
  const db=await import('./db.js');
  const linked=await import('./linked-backup-w224.js');
  const rootdb=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('partitures-festeres-linked-w222a',2);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const root=await new Promise((resolve,reject)=>{
   const req=rootdb.transaction('roots','readonly').objectStore('roots').get('active');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });rootdb.close();
  if(!root?.id||root.index.scores.length!==2)throw Error('Carpeta vinculada no disponible.');
  const id=root.id,library={id,name:root.name,scores:root.index.scores};
  const anno={version:1,pages:{'1':[{tool:'pen',color:'#b51f34',width:.01,points:[[.1,.1],[.2,.2]]}]}};
  const key=(k)=>'w222a:lib:'+id+':'+k;
  await db.saveBatch([{path:'Importada.pdf',blob:new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),
   size:bytes.length,added:Date.now()}]);
  await db.setAnnotations('w222a-linked-'+id+'/Primera.pdf',anno,{linkedLibraryId:id});
  await db.setPref('w222a:metadata:'+id,{'Primera.pdf':{title:'CIMO',composer:'Prova'}});
  await db.setPref('w222a:'+id+':viewer:Primera.pdf',{zoom:1.25,fit:'width'});
  await db.setPref('w222a:'+id+':w218:page:Primera.pdf',{'1':{rotationQuarterTurns:1}});
  await db.setPref(key('w13:favorites'),['Primera.pdf']);
  await db.setPref(key('w13:recents'),['Primera.pdf']);
  await db.setPref(key('w13:repertoires'),[{id:'rep_prova',name:'Concert',paths:['Primera.pdf']}]);
  await db.setPref(key('w220:paperRoles'),{version:1,roles:[{id:1,path:null},{id:2,path:null}]});
  const backup=await linked.createLinkedDataBackup(library);
  const parsed=await linked.inspectLinkedDataBackup(backup.blob);
  const check=linked.linkedBackupMatch(parsed,library);
  if(check.matched!==2||parsed.manifest.records.length!==1)throw Error('Còpia incompleta.');
  const zip=await window.JSZip.loadAsync(backup.blob);
  if(Object.keys(zip.files).some(x=>x.toLowerCase().endsWith('.pdf')))
   throw Error('S’han copiat PDF originals dins del ZIP.');
  await db.setAnnotations('w222a-linked-'+id+'/Primera.pdf',{version:1,pages:{}},{linkedLibraryId:id});
  await db.setPref(key('w13:favorites'),[]);
  await db.setPref('w222a:metadata:'+id,{});
  const merged=await linked.restoreLinkedDataBackup(parsed,library,'merge');
  const reanno=await db.getAnnotations('w222a-linked-'+id+'/Primera.pdf');
  const fav=await db.getPref(key('w13:favorites'));
  const meta=await db.getPref('w222a:metadata:'+id);
  if(merged.annotations!==1||!reanno.pages['1']?.length||fav[0]!=='Primera.pdf'||
   meta['Primera.pdf'].title!=='CIMO')throw Error('La restauració fusionada no ha recuperat les dades.');
  // El merge conserva la nova anotació mentre replace restaura la del ZIP.
  const newer={version:1,pages:{'1':[{tool:'pen',color:'#21824f',width:.01,points:[[.3,.3],[.4,.4]]}]}};
  await db.setAnnotations('w222a-linked-'+id+'/Primera.pdf',newer,{linkedLibraryId:id});
  await linked.restoreLinkedDataBackup(parsed,library,'merge');
  const keep=await db.getAnnotations('w222a-linked-'+id+'/Primera.pdf');
  if(keep.pages['1'][0].color!=='#21824f')throw Error('Merge ha sobreescrit anotacions actuals.');
  await linked.restoreLinkedDataBackup(parsed,library,'replace');
  const replaced=await db.getAnnotations('w222a-linked-'+id+'/Primera.pdf');
  if(replaced.pages['1'][0].color!=='#b51f34')throw Error('Replace no ha restaurat les anotacions.');
  const imported=await db.getScore('Importada.pdf');
  if(!imported?.blob||imported.blob.size!==bytes.length)throw Error('La biblioteca importada ha sigut alterada.');
  let rejected=false;
  try{await linked.restoreLinkedDataBackup(parsed,{id,name:root.name,scores:[{path:'Altra.pdf'}]},'replace');}
  catch{rejected=true;}
  if(!rejected)throw Error('La còpia aliena s’ha restaurat sense coincidències.');
  return {id,backupBytes:backup.blob.size,zipBytes:Array.from(new Uint8Array(await backup.blob.arrayBuffer()))};
 },Array.from(pdf));
 // Provar que el flux és visible al menú real, no sols a l'API.
 await page.locator('[data-action="source-manage"]').first().click();
 await page.locator('[data-action="backup-create"]').first().click();
 await page.locator('.backup-ready').waitFor({timeout:15000});
 assert.match(await page.locator('.backup-ready').innerText(),/PartituresFesteres_Dades_/);
 await page.locator('#restore-input').setInputFiles({
  name:'dades-vinculades.zip',mimeType:'application/zip',buffer:Buffer.from(saved.zipBytes)
 });
 await page.locator('[data-action="linked-restore-merge"]').waitFor({timeout:15000});
 assert.match(await page.locator('.restore-modal').innerText(),/2 \/ 2/);
 await page.locator('[data-action="linked-restore-merge"]').click();
 await page.waitForFunction(()=>document.body.textContent?.includes('Dades restaurades: 2'),{timeout:15000});
 assert.deepEqual(errors,[],errors.join(' | '));
 console.log('PASS W2.24: ZIP sense PDF, anotacions vinculades reals, merge/replace, rutes diferents, biblioteca importada intacta, UI d’exportació i restauració.',{zipBytes:saved.backupBytes});
 await context.close();
}finally{await browser.close();}
