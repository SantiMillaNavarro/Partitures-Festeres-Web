import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {normalizeScanName,scanFolderChoices,uniqueScanPath,pdfPageLayout,
 SCAN_PAGE_LIMIT,SCAN_FILE_LIMIT,SCAN_TOTAL_LIMIT,SCAN_FILTERS,SCAN_PDF_LIMIT} from '../../scanner-pdf-w2131.js';
import {renderScannerMarkup} from '../../scanner-ui-w2131.js';

assert.equal(SCAN_PAGE_LIMIT,30);
assert.equal(SCAN_FILE_LIMIT,24*1024*1024);
assert.equal(SCAN_TOTAL_LIMIT,180*1024*1024);
assert.equal(SCAN_PDF_LIMIT,100*1024*1024);
assert.deepEqual(SCAN_FILTERS,['original','enhanced','gray','bw']);
assert.equal(normalizeScanName('  Pasdoble CIMO.pdf  '),'Pasdoble CIMO.pdf');
assert.equal(normalizeScanName(' Marxa Mora '),'Marxa Mora.pdf');
for(const invalid of ['','  ','../invasor','a/b','a\\b','a:123','.','..','x'.repeat(120)])
 assert.throws(()=>normalizeScanName(invalid),Error);
assert.deepEqual(scanFolderChoices([{path:'1er/Marxes/obra.pdf'},{path:'1er/Pasdobles/obra.pdf'},
 {path:'2n/Marxes/obra.pdf'},{path:'root.pdf'}]),['','1er','1er/Marxes','1er/Pasdobles','2n','2n/Marxes']);
assert.equal(uniqueScanPath('Marxes/Obra.pdf',new Set(['Marxes/Obra.pdf'])),'Marxes/Obra (2).pdf');
assert.equal(uniqueScanPath('Obra.pdf',new Set(['Obra.pdf','Obra (2).pdf'])),'Obra (3).pdf');
assert.equal(uniqueScanPath('Nova.pdf',new Set(['Alt.pdf'])),'Nova.pdf');
assert(pdfPageLayout(1800,1200).width>pdfPageLayout(1200,1800).width);
assert(pdfPageLayout(800,1200).height>pdfPageLayout(1200,800).height);
assert.match(renderScannerMarkup({language:'va'}),/Escanejar pàgina/);
assert.match(renderScannerMarkup({language:'es'}),/Escanear página/);
assert.match(renderScannerMarkup({language:'va',pages:[{id:'1',file:{name:'foto.jpg'},url:'blob:x',rotation:0,filter:'bw'}]}),/Blanc i negre/);

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:790}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 // Esperar explícitament la primera instal·lació: el modal apareix
 // després d'IndexedDB i pot tardar més que domcontentloaded.
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();
 assert.equal(await page.locator('header [data-action="scan-open"]').count(),1);
 await page.locator('.bottom-nav [data-action="page"][data-value="repertoires"]').click();
 await page.locator('[data-action="rep-create"]').click();
 await page.locator('#rep-name-input').fill('Festa de prova');
 await page.locator('[data-action="rep-save-name"]').click();
 await page.locator('.rep-head h3').waitFor();
 // Injectem un PDF preexistent per comprovar la carpeta i la seguretat de conflictes.
 const prepared=await page.evaluate(async()=>{
  const {saveBatch}=await import('./db.js');
  const bytes=new TextEncoder().encode('%PDF-1.4\n%prova\n');
  const b=new Blob([bytes],{type:'application/pdf'});
  await saveBatch([{path:'1er/Pasdobles/Original.pdf',blob:b,size:b.size,added:Date.now()}]);
  return true;
 });
 assert.equal(prepared,true);
 await page.reload();
 await page.locator('header [data-action="scan-open"]').click();
 await page.locator('.pf-scan-screen').waitFor();
 assert.equal(await page.locator('.pf-scan-page').count(),0);
 assert.equal(await page.locator('#scan-folder option').count(),3);
 // Captura/galeria simulada amb fotografies PNG reals creades al navegador.
 await page.evaluate(async()=>{
  const make=async(color,name)=>{
   const c=document.createElement('canvas');c.width=120;c.height=180;
   const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,120,180);
   x.fillStyle=color;x.fillRect(7,8,106,162);
   const blob=await new Promise(r=>c.toBlob(r,'image/png'));
   return new File([blob],name,{type:'image/png'});
  };
  const input=document.getElementById('scan-gallery-input'),dt=new DataTransfer();
  dt.items.add(await make('#a00','pàgina-1.png'));
  dt.items.add(await make('#00a','pàgina-2.png'));
  input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('.pf-scan-page').nth(1).waitFor();
 assert.equal(await page.locator('.pf-scan-page').count(),2);
 assert.equal(await page.locator('button[data-action="scan-up"]').first().isDisabled(),true);
 await page.locator('.pf-scan-page').nth(1).locator('[data-action="scan-up"]').click();
 assert.match(await page.locator('.pf-scan-page-caption small').first().innerText(),/pàgina-2/);
 await page.locator('.pf-scan-page').first().locator('[data-action="scan-rotate"]').click();
 assert.match(await page.locator('.pf-scan-page img').first().getAttribute('style'),/rotate\(90deg\)/);
 await page.locator('.pf-scan-page select[data-scan-filter]').first().selectOption('bw');
 assert.match(await page.locator('.pf-scan-page img').first().getAttribute('style'),/grayscale/);
 await page.locator('#scan-name').fill('Marxa del CIMO');
 await page.locator('#scan-folder').selectOption('1er/Pasdobles');
 await page.locator('#scan-to-rep').check();
 await page.locator('#scan-rep').selectOption({label:'Festa de prova'});
 await page.locator('[data-action="scan-save"]').click();
 await page.locator('.score-row [data-action="open"][data-value="1er/Pasdobles/Marxa del CIMO.pdf"]').waitFor({timeout:30000});
 const info=await page.evaluate(async()=>{
  const {getScore,getPref}=await import('./db.js');
  const rec=await getScore('1er/Pasdobles/Marxa del CIMO.pdf');
  const pdf=await globalThis.pdfjsLib.getDocument({data:new Uint8Array(await rec.blob.arrayBuffer())}).promise;
  const first=await pdf.getPage(1),second=await pdf.getPage(2);
  const widths=[first.view[2],second.view[2]],heights=[first.view[3],second.view[3]];
  await pdf.destroy();
  const reps=await getPref('w13:repertoires',[]);
  return {size:rec.size,images:2,widths,heights,rep:reps.find(r=>r.name==='Festa de prova')?.paths||[]};
 });
 assert(info.size>1000,'PDF real, no buit');
 assert(info.widths[0]>info.heights[0],'Gir de 90° fa pàgina horitzontal');
 assert(info.widths[1]<info.heights[1],'Pàgina vertical');
 assert(info.rep.includes('1er/Pasdobles/Marxa del CIMO.pdf'),'L’escaneig ha entrat al repertori triat');
 await page.locator('header [data-action="scan-open"]').click();
 // La segona captura amb el mateix nom no pot substituir ni afectar les anotacions de l'original.
 await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=96;c.height=128;
  const x=c.getContext('2d');x.fillStyle='black';x.fillRect(0,0,96,128);
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));
  const i=document.getElementById('scan-camera-input'),dt=new DataTransfer();
  dt.items.add(new File([blob],'captura.png',{type:'image/png'}));
  i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('.pf-scan-page').first().waitFor();
 assert.equal(await page.locator('.pf-scan-page').count(),1);
 await page.locator('#scan-name').fill('Marxa del CIMO');
 await page.locator('#scan-folder').selectOption('1er/Pasdobles');
 await page.locator('[data-action="scan-save"]').click();
 await page.locator('.score-row [data-action="open"][data-value="1er/Pasdobles/Marxa del CIMO (2).pdf"]').waitFor({timeout:30000});
 const both=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');
  return Promise.all(['1er/Pasdobles/Marxa del CIMO.pdf','1er/Pasdobles/Marxa del CIMO (2).pdf'].map(async p=>(await getScore(p))?.blob?.size));
 });
 assert.equal(both.length,2);assert(both[0]>1000&&both[1]>1000);
 // Prova motor PDF de 3 imatges i límit de 30; cap arxiu es puja a la xarxa.
 const direct=await page.evaluate(async()=>{
  const mod=await import('./scanner-pdf-w2131.js');
  const c=document.createElement('canvas');c.width=220;c.height=130;
  const ctx=c.getContext('2d');ctx.fillStyle='#eaf';ctx.fillRect(0,0,220,130);
  const b=await new Promise(r=>c.toBlob(r,'image/png'));
  const file=new File([b],'tercera.png',{type:'image/png'});
  const pages=Array.from({length:3},(_,i)=>({file,filter:['original','enhanced','gray'][i],rotation:i*90}));
  const pdf=await mod.generateScannedPdf(pages);
  const doc=await globalThis.pdfjsLib.getDocument({data:new Uint8Array(await pdf.arrayBuffer())}).promise;
  const count=doc.numPages;await doc.destroy();
  let rejected=false;
  try{await mod.generateScannedPdf(Array.from({length:31},()=>pages[0]));}catch{rejected=true;}
  return {count,rejected,size:pdf.size};
 });
 assert.equal(direct.count,3);
 assert.equal(direct.rejected,true);
 assert(direct.size>1500);
 await page.locator('header [data-action="scan-open"]').click();
 await page.locator('.pf-scan-screen').waitFor();
 await page.locator('[data-action="scan-close"]').click();
 assert.equal(await page.locator('.pf-scan-screen').count(),0);
 assert.equal(errors.length,0,'Errors JavaScript: '+JSON.stringify(errors));
 console.log('PASS W2.13.1: camera/galeria, 30 pàgines, gir, filtres, PDF real, carpeta, repertori i duplicats segurs');
 await context.close();
}finally{await browser.close();}
