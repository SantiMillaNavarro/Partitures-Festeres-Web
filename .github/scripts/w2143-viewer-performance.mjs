import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {thumbnailSize,PdfThumbnailController} from '../../pdf-thumbnails-w2143.js';

const bounds=thumbnailSize(900,1600);
assert(bounds.width<=280&&bounds.height<=420,'Miniatures limitades en píxels');
assert.equal(typeof PdfThumbnailController.prototype.pause,'function');
assert.equal(typeof PdfThumbnailController.prototype.resume,'function');

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();
 const pdfSize=await page.evaluate(async()=>{
  const {saveBatch,setPref}=await import('./db.js');
  const {assembleScanPdf}=await import('./scanner-pdf-w2133.js');
  const c=document.createElement('canvas');c.width=520;c.height=740;
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,520,740);
  ctx.fillStyle='#222';ctx.font='bold 30px serif';ctx.fillText('CIMO — Pasdoble',50,80);
  for(let i=0;i<29;i++)ctx.fillRect(45,110+i*19,425,2);
  const blob=await new Promise(done=>c.toBlob(done,'image/jpeg',.83));
  const image={bytes:new Uint8Array(await blob.arrayBuffer()),width:520,height:740};
  const pdf=assembleScanPdf([image,image,image]),now=Date.now();
  await saveBatch([{path:'CIMO.pdf',blob:pdf,size:pdf.size,added:now},
                   {path:'Alt.pdf',blob:pdf,size:pdf.size,added:now+1}]);
  await setPref('w2142:thumbnailsEnabled',true);
  return pdf.size;
 });
 assert(pdfSize>1500);
 await page.reload();
 await page.locator('.score-row [data-action="open"][data-value="CIMO.pdf"]').waitFor({timeout:20000});
 // Les miniatures poden estar en memòria. Per això el bloqueig de la miniatura
 // es prova directament en el motor amb una tasca PDF.js artificial pendent.
 // Després es comprova la integració real del visor per separat.
 const standalone=await page.evaluate(async()=>{
  const mod=await import('./pdf-thumbnails-w2143.js');
  const perf=window.__perf={pause:0,resume:0,thumbStarted:0};
  const proto=mod.PdfThumbnailController.prototype;
  const pause=proto.pause,resume=proto.resume,process=proto.process;
  proto.pause=function(){perf.pause++;return pause.call(this);};
  proto.resume=function(){perf.resume++;return resume.call(this);};
  proto.process=function(...args){perf.thumbStarted++;return process.apply(this,args);};
  const realPdf=window.pdfjsLib;
  let destroyed=0,started=0,reason='';
  try{
   const fake={
    GlobalWorkerOptions:{workerSrc:''},
    getDocument(options){
     started++;
     let reject=null,stopped=false;
     const promise=new Promise((_,r)=>{reject=r;});
     return {promise,destroy:async()=>{
      if(!stopped){stopped=true;destroyed++;reject(new Error('Cancelled by test'));}
     }};
    }
   };
   window.pdfjsLib=fake;
   const controller=new AbortController();
   const work=mod.renderFirstPageThumbnail(
    new Blob(['%PDF-1.4'],{type:'application/pdf'}),null,{signal:controller.signal}
   );
   await Promise.resolve();
   controller.abort();
   try{await work;}catch(error){reason=error?.message||error?.name||'';}
  }finally{window.pdfjsLib=realPdf;}
  return {started,destroyed,reason,restored:window.pdfjsLib===realPdf};
 });
 assert.equal(standalone.started,1,'La prova ha iniciat PDF.js de la miniatura');
 assert.equal(standalone.destroyed,1,'AbortController ha destruït la càrrega bloquejada');
 assert(standalone.reason,'La tasca pendent finalitza cancel·lada');
 assert.equal(standalone.restored,true);

 // Obrir una partitura real abans o durant la generació d'una miniatura
 // ha de suspendre el controlador i prioritzar PDF.js del visor.
 const began=Date.now();
 await page.locator('.score-row [data-action="open"][data-value="CIMO.pdf"]').click();
 await page.waitForFunction(()=>{
  const canvas=document.querySelector('#viewer-stage canvas');
  return canvas?.width>0&&canvas?.height>0&&
   document.querySelector('#viewer-page-counter')?.textContent?.includes(' / 3');
 },null,{timeout:20000});
 const elapsed=Date.now()-began;
 const during=await page.evaluate(()=>({...window.__perf}));
 assert(during.pause>0,'Obrir el visor pausa el controlador de miniatures');
 assert(elapsed<12000,'El PDF real no ha de quedar bloquejat per la caché de miniatures');
 await page.waitForTimeout(600);
 assert.equal((await page.evaluate(()=>window.__perf.thumbStarted)),during.thumbStarted,
  'No es comencen miniatures mentre el visor està actiu');
 await page.locator('[data-action="viewer-close"]').evaluate(button=>button.click());
 await page.locator('.viewer').waitFor({state:'detached',timeout:20000});
 assert((await page.evaluate(()=>window.__perf.resume))>0,'Tornar a la llista reprén les miniatures');
 await page.waitForFunction(()=>document.querySelector('[data-pf-thumb="CIMO.pdf"] img')?.naturalWidth>0,
  null,{timeout:25000});
 await page.locator('.score-row [data-action="open"][data-value="Alt.pdf"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-stage canvas')?.width>0,
  null,{timeout:20000});
 await page.locator('[data-action="viewer-close"]').evaluate(button=>button.click());
 assert.deepEqual(errors,[],'Errors JavaScript: '+errors.join('\n'));
 console.log('PASS W2.14.3: AbortController PDF.js realista, visor prioritari, miniatures suspeses i represes; '+elapsed+' ms');
 await context.close();
}finally{await browser.close();}
