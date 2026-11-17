import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
function samplePdf(){
 const t='BT /F1 30 Tf 60 710 Td (PARTITURES FESTERES METADATA) Tj ET';
 const objects=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
 '<</Length '+t.length+'>>\nstream\n'+t+'\nendstream',
 '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 let pdf='%PDF-1.4\n';const offsets=[];
 objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});
 const n=pdf.length;pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const off of offsets)pdf+=String(off).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(pdf+'trailer\n<</Root 1 0 R/Size '+(objects.length+1)+'>>\nstartxref\n'+n+'\n%%EOF\n','ascii');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,deviceScaleFactor:2});
 const p=await context.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await p.locator('[data-action="welcome-done"]').count())await p.locator('[data-action="welcome-done"]').click();
 const pdf=samplePdf(),fingerprint=createHash('sha256').update(pdf).digest('hex');
 await p.locator('#import-input').setInputFiles([
  {name:'ALMUGAVIR.pdf',mimeType:'application/pdf',buffer:pdf},
  {name:'BISCAINS.pdf',mimeType:'application/pdf',buffer:pdf}
 ]);
 await p.locator('.score-row').first().waitFor();
 assert.equal(await p.locator('.score-row').count(),2);
 // Backup created before metadata: identical compatible structure to W1.1.
 await p.locator('.bottom-link[data-value="settings"]').click();
 await p.locator('[data-action="backup-create"]').click();
 await p.locator('.backup-ready').waitFor({timeout:30000});
 let [dl]=await Promise.all([p.waitForEvent('download'),p.locator('[data-action="backup-save"]').click()]);
 const legacy=await readFile(await dl.path());
 await p.locator('.bottom-link[data-value="library"]').click();
 // Optional editor, cancel without saving.
 await p.locator('[data-action="meta-open"][data-value="ALMUGAVIR.pdf"]').click();
 assert.equal(await p.locator('#meta-title').inputValue(),'');
 await p.locator('#meta-title').fill('No desar');
 await p.locator('[data-action="close-modal"]').click();
 await p.locator('[data-action="meta-open"][data-value="ALMUGAVIR.pdf"]').click();
 assert.equal(await p.locator('#meta-title').inputValue(),'');
 await p.locator('#meta-title').fill('ALMUGAVIR de concert');
 await p.locator('#meta-composer').fill('Pere Pérez');
 await p.locator('#meta-type').fill('Marxa mora');
 await p.locator('#meta-year').fill('19');
 await p.locator('[data-action="meta-save"]').click();
 assert.equal(await p.locator('#meta-year').inputValue(),'19','Invalid year must not save');
 await p.locator('#meta-year').fill('1998');
 await p.locator('#meta-notes').fill('Entrada festera\nRepetició final');
 await p.locator('[data-action="meta-save"]').click();
 await p.locator('.metadata-modal').waitFor({state:'detached'});
 assert.equal(await p.locator('.score-row [data-action="open"][data-value="ALMUGAVIR.pdf"] .entry-title').textContent(),'ALMUGAVIR de concert');
 // The original PDF remains byte-identical after updating metadata.
 const storedSha=await p.evaluate(async()=>{
  const m=await import('./db.js');const item=await m.getScore('ALMUGAVIR.pdf');
  const bytes=await crypto.subtle.digest('SHA-256',await item.blob.arrayBuffer());
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
 });
 assert.equal(storedSha,fingerprint,'PDF bytes must not be modified');
 await p.locator('#search-input').fill('de concert');
 assert.equal(await p.locator('.score-row').count(),1,'Basic search finds custom title');
 await p.locator('#search-input').fill('');
 // Importing the same PDF path must preserve associated metadata.
 await p.locator('#import-input').setInputFiles({name:'ALMUGAVIR.pdf',mimeType:'application/pdf',buffer:pdf});
 await p.locator('.score-row').first().waitFor();
 await p.locator('[data-action="meta-open"][data-value="ALMUGAVIR.pdf"]').click();
 assert.equal(await p.locator('#meta-composer').inputValue(),'Pere Pérez');
 await p.locator('[data-action="close-modal"]').click();
 await p.reload();
 await p.locator('[data-action="meta-open"][data-value="ALMUGAVIR.pdf"]').click();
 assert.equal(await p.locator('#meta-notes').inputValue(),'Entrada festera\nRepetició final');
 await p.locator('[data-action="close-modal"]').click();
 // Ensure all metadata are exported in the complete ZIP.
 await p.locator('.bottom-link[data-value="settings"]').click();
 await p.locator('[data-action="backup-create"]').click();
 await p.locator('.backup-ready').waitFor({timeout:30000});
 [dl]=await Promise.all([p.waitForEvent('download'),p.locator('[data-action="backup-save"]').click()]);
 const latest=await readFile(await dl.path());
 const contents=await p.evaluate(async binary=>{
  const zip=await window.JSZip.loadAsync(new Uint8Array(binary));
  return JSON.parse(await zip.file('partitures-festeres-copia.json').async('string'));
 },Array.from(latest));
 const info=contents.files.find(x=>x.path==='ALMUGAVIR.pdf');
 assert.deepEqual(info.metadata,{title:'ALMUGAVIR de concert',composer:'Pere Pérez',type:'Marxa mora',year:'1998',notes:'Entrada festera\nRepetició final'});
 assert.equal(contents.schemaVersion,1,'Legacy-compatible backup schema');
 // Change metadata then restore current copy and validate restoration.
 await p.locator('.bottom-link[data-value="library"]').click();
 await p.locator('[data-action="meta-open"][data-value="ALMUGAVIR.pdf"]').click();
 await p.locator('#meta-title').fill('TEMPORAL');
 await p.locator('[data-action="meta-save"]').click();
 await p.locator('#restore-input').setInputFiles({name:'new.zip',mimeType:'application/zip',buffer:latest});
 await p.waitForTimeout(1500);
 console.log('RESTORE DIAG',await p.evaluate(()=>({modal:document.querySelector('.modal')?.textContent?.slice(0,550),toast:document.querySelector('.toast')?.textContent?.slice(0,550),lang:document.documentElement.lang,restoreInput:document.querySelector('#restore-input')?.value})));
 await p.locator('[data-action="restore-replace"]').click();
 await p.waitForFunction(()=>document.querySelector('[data-action="meta-open"][data-value="ALMUGAVIR.pdf"]')!==null,{timeout:30000});
 await p.locator('[data-action="meta-open"][data-value="ALMUGAVIR.pdf"]').click();
 assert.equal(await p.locator('#meta-title').inputValue(),'ALMUGAVIR de concert');
 await p.locator('[data-action="close-modal"]').click();
 // Merging a legacy W1.1 backup with no metadata must not erase local metadata.
 await p.locator('#restore-input').setInputFiles({name:'legacy.zip',mimeType:'application/zip',buffer:legacy});
 await p.locator('[data-action="restore-merge"]').click();
 await p.locator('[data-action="meta-open"][data-value="ALMUGAVIR.pdf"]').click();
 assert.equal(await p.locator('#meta-composer').inputValue(),'Pere Pérez','Legacy merge keeps metadata');
 await p.locator('[data-action="close-modal"]').click();
 // Full replacement with a legacy W1.1 backup has no metadata, as expected.
 await p.locator('#restore-input').setInputFiles({name:'legacy.zip',mimeType:'application/zip',buffer:legacy});
 await p.locator('[data-action="restore-replace"]').click();
 await p.locator('[data-action="meta-open"][data-value="ALMUGAVIR.pdf"]').click();
 assert.equal(await p.locator('#meta-title').inputValue(),'','Legacy replacement must open with blank fields');
 await p.locator('[data-action="close-modal"]').click();
 assert.deepEqual(errors,[],'No browser script errors');
 console.log('PASS W1.3B.1: optional editor, cancel, year validation, title search, PDF unchanged, reimport, reload, ZIP export, new restore and W1.1 merge/replace');
 await context.close();
}finally{await browser.close()}
