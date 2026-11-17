import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {emptyAnnotations,normalizeAnnotations,projectPoint,unprojectPoint} from '../../annotations.js';

for(const rotation of [0,90,180,270]){
 const p=[.24,.71],display=projectPoint(p,rotation),original=unprojectPoint(display,rotation);
 assert.deepEqual(original,p,'Rotation must be reversible '+rotation);
}
assert.deepEqual(normalizeAnnotations(null),emptyAnnotations());
assert.throws(()=>normalizeAnnotations({version:1,pages:{'1':[{tool:'pen',color:'#bad',width:.005,points:[[.3,.3]]}]}}));
assert.throws(()=>normalizeAnnotations({version:1,pages:{'1':[{tool:'pen',color:'#b51f34',width:.005,points:[[1.1,.3]]}]}}));

function pdf(){
 const t='BT /F1 25 Tf 60 710 Td (W21 ANOTACIONS) Tj ET';
 const o=[
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
  '<</Length '+t.length+'>>\nstream\n'+t+'\nendstream',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>'
 ];
 let s='%PDF-1.4\n';const offsets=[];
 for(let i=0;i<o.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n';}
 const pos=s.length;s+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const offset of offsets)s+=String(offset).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+pos+'\n%%EOF\n','ascii');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 // La versió d'Ajustos i la informació sobre anotacions han d'estar actualitzades.
 await page.locator('.bottom-link[data-value="settings"]').click();
 const settingsText=await page.locator('main.content').innerText();
 assert.match(settingsText,/Partitures Festeres Web — W2\\.1/,'Version in settings');
 assert(!settingsText.includes('Les anotacions, Drive'),'Annotations are no longer marked as pending');
 assert(settingsText.includes('llapis i ressaltador'),'W2.1 annotation capabilities displayed in settings');
 await page.locator('.bottom-link[data-value="library"]').click();
 const pdfBytes=pdf();
 await page.locator('#import-input').setInputFiles({name:'ANOTACIONS.pdf',mimeType:'application/pdf',buffer:pdfBytes});
 await page.locator('.score-row').first().waitFor();
 const original=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');const doc=await getScore('ANOTACIONS.pdf');
  return {size:doc.blob.size,bytes:Array.from(new Uint8Array(await doc.blob.arrayBuffer()))};
 });
 assert.equal(original.size,pdfBytes.length);
 const open=async()=>{
  await page.locator('.score-row [data-action="open"]').first().click();
  await page.locator('.viewer-canvas').waitFor({timeout:15000});
  await page.locator('#viewer-stage').click({position:{x:190,y:330}});
  await page.locator('[data-action="viewer-annotate"]').waitFor({state:'visible'});
 };
 await open();
 await page.locator('[data-action="viewer-annotate"]').click();
 await page.locator('.viewer-annotation-toolbar').waitFor();
 assert.equal(await page.locator('.viewer-annotation-layer.annotation-editing').count(),1);
 const draw=async()=>{
  const box=await page.locator('.viewer-annotation-layer').boundingBox();
  assert(box?.width>30&&box?.height>30,'PDF annotation geometry');
  await page.mouse.move(box.x+box.width*.22,box.y+box.height*.25);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.52,box.y+box.height*.48,{steps:14});
  await page.mouse.up();
  await page.waitForFunction(async()=>{
   const {getAnnotations}=await import('./db.js');
   return (await getAnnotations('ANOTACIONS.pdf')).pages['1']?.length>0;
  });
 };
 await draw();
 let first=await page.locator('.annotation-svg path').first().getAttribute('d');
 assert(first?.startsWith('M'));
 assert.equal(await page.locator('.annotation-svg path').count(),1);
 await page.locator('[data-action="annotation-tool"][data-value="highlighter"]').click();
 await page.locator('[data-action="annotation-color"][data-value="#f0cf35"]').click();
 await draw();
 assert.equal(await page.locator('.annotation-svg path').count(),2);
 assert.equal(await page.locator('.annotation-svg path').last().getAttribute('stroke-opacity'),'0.36');
 await page.locator('[data-action="annotation-undo"]').click();
 assert.equal(await page.locator('.annotation-svg path').count(),1);
 await page.locator('[data-action="viewer-annotate"]').last().click();
 // Rotating and zooming must keep the annotation attached to the sheet.
 await page.locator('[data-action="viewer-rotate"]').click();
 await page.waitForFunction(()=>document.querySelector('.annotation-svg path')?.getAttribute('d')?.startsWith('M'));
 const rotated=await page.locator('.annotation-svg path').first().getAttribute('d');
 assert.notEqual(first,rotated,'Coordinates are projected on 90° rotation');
 await page.locator('[data-action="viewer-zoom-in"]').click();
 assert.equal(await page.locator('.annotation-svg path').count(),1);
 await page.locator('[data-action="viewer-page-next"]').click();
 await page.locator('#viewer-page-counter').getByText('2',{exact:false}).waitFor().catch(()=>{});
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 2'));
 assert.equal(await page.locator('.annotation-svg path').count(),0,'Second page has no annotations');
 await page.locator('[data-action="viewer-page-prev"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('1 / 2'));
 assert.equal(await page.locator('.annotation-svg path').count(),1,'First page annotations return');
 await page.locator('[data-action="viewer-close"]').click();
 await open();
 assert.equal(await page.locator('.annotation-svg path').count(),1,'Annotations survive reopening PDF');
 await page.locator('[data-action="viewer-close"]').click();
 // A backup must include the annotation data separately and leave PDF bytes unchanged.
 await page.locator('.bottom-link[data-value="settings"]').click();
 await page.locator('[data-action="backup-create"]').click();
 await page.locator('.backup-ready').waitFor({timeout:25000});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="backup-save"]').click()]);
 const zipBuffer=await readFile(await download.path());
 const stored=await page.evaluate(async(base64)=>{
  const zip=await window.JSZip.loadAsync(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)));
  const manifest=JSON.parse(await zip.file('partitures-festeres-copia.json').async('string'));
  const file=Object.keys(zip.files).find(x=>x.startsWith('anotacions/')&&x.endsWith('.json'));
  return {manifest,annotation:JSON.parse(await zip.file(file).async('string')),file};
 },zipBuffer.toString('base64'));
 assert.equal(stored.manifest.schemaVersion,1,'Old format remains compatible');
 assert.equal(stored.manifest.annotations.length,1);
 assert.equal(stored.annotation.pages['1'].length,1);
 assert(stored.file.startsWith('anotacions/'));
 // Clear and restore to prove round trip without losing the annotation.
 await page.locator('.bottom-link[data-value="library"]').click();
 await open();
 await page.locator('[data-action="viewer-annotate"]').click();
 await page.locator('[data-action="annotation-clear"]').click();
 await page.locator('[data-action="annotation-clear-confirm"]').click();
 assert.equal(await page.locator('.annotation-svg path').count(),0);
 await page.locator('[data-action="viewer-close"]').click();
 await page.locator('.bottom-link[data-value="settings"]').click();
 await page.locator('#restore-input').setInputFiles({name:'anotacions-backup.zip',mimeType:'application/zip',buffer:zipBuffer});
 await page.locator('[data-action="restore-replace"]').waitFor();
 await page.locator('[data-action="restore-replace"]').click();
 await page.locator('.restore-modal').waitFor({state:'detached'});
 await page.locator('.bottom-link[data-value="library"]').click();
 await open();
 assert.equal(await page.locator('.annotation-svg path').count(),1,'Restoring backup brings ink back');
 const restored=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');const s=await getScore('ANOTACIONS.pdf');
  return Array.from(new Uint8Array(await s.blob.arrayBuffer()));
 });
 assert.deepEqual(restored,original.bytes,'Original PDF bytes remain unchanged');
 assert.deepEqual(errors,[],'No runtime JS errors');
 console.log('PASS W2.1: draw, highlight, undo, rotation, zoom, multipage, persistent storage, ZIP backup and restore');
 await ctx.close();
} finally{await browser.close();}
