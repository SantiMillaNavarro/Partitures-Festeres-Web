import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {thumbnailSize,renderFirstPageThumbnail,PdfThumbnailController} from '../../pdf-thumbnails-w2143.js';

assert.equal(thumbnailSize(900,1600).width<=280,true);
assert.equal(thumbnailSize(900,1600).height<=420,true);
assert.equal(typeof PdfThumbnailController.prototype.pause,'function');
assert.equal(typeof PdfThumbnailController.prototype.resume,'function');

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();

 // Un PDF real amb la primera pàgina prou complexa per a exercitar PDF.js.
 const n=await page.evaluate(async()=>{
  const {saveBatch,setPref}=await import('./db.js');
  const {assembleScanPdf}=await import('./scanner-pdf-w2133.js');
  const c=document.createElement('canvas');
  c.width=580;c.height=780;const ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,580,780);
  ctx.fillStyle='#131313';ctx.font='bold 35px serif';ctx.fillText('Pasdoble CIMO',50,80);
  for(let i=0;i<35;i++)ctx.fillRect(50,100+i*18,480,2);
  const jpeg=await new Promise(r=>c.toBlob(r,'image/jpeg',.8));
  const image={bytes:new Uint8Array(await jpeg.arrayBuffer()),width:580,height:780};
  const pdf=assembleScanPdf([image,image,image]);
  const now=Date.now();
  await saveBatch([
   {path:'CIMO.pdf',blob:pdf,size:pdf.size,added:now},
   {path:'Alt.pdf',blob:pdf,size:pdf.size,added:now+1}
  ]);
  await setPref('w2142:thumbnailsEnabled',false);
  return pdf.size;
 });
 assert(n>3000);

 await page.reload();
 await page.locator('.bottom-nav [data-action="page"][data-value="settings"]').click();
 // Forcem una miniatura artificialment bloquejada, simulant un PDF pesat.
 // Al visor el getDocument és diferent (data, no blob:url) i ha de tindre prioritat.
 await page.evaluate(async()=>{
  const {PdfThumbnailController}=await import('./pdf-thumbnails-w2143.js');
  const proto=PdfThumbnailController.prototype;
  const pause=proto.pause,resume=proto.resume;
  window.__perf={thumbStarts:0,thumbStops:0,viewerStarts:0,pauses:0,resumes:0,firstBlocked:true};
  proto.pause=function(){window.__perf.pauses++;return pause.call(this);};
  proto.resume=function(){window.__perf.resumes++;return resume.call(this);};
  const original=window.pdfjsLib.getDocument.bind(window.pdfjsLib);
  window.pdfjsLib.getDocument=function(options){
   const perf=window.__perf;
   if(options?.url?.startsWith('blob:')){
    perf.thumbStarts++;
    if(perf.firstBlocked){
     perf.firstBlocked=false;
     let reject,closed=false;
     const promise=new Promise((resolve,r)=>{reject=r;});
     return {promise,destroy:async()=>{
      if(!closed){closed=true;perf.thumbStops++;reject(new Error('Càrrega de miniatura cancel·lada'));}
     }};
    }
   }else if(options?.data)perf.viewerStarts++;
   return original(options);
  };
 });
 await page.locator('#thumbnail-enabled').check();
 await page.locator('.bottom-nav [data-action="page"][data-value="library"]').click();
 await page.waitForFunction(()=>window.__perf.thumbStarts>0,null,{timeout:20000});
 const begins=Date.now();
 await page.locator('.score-row [data-action="open"][data-value="CIMO.pdf"]').click();
 await page.waitForFunction(()=>{
   const v=document.querySelector('#viewer-stage canvas');
   return !!v&&v.width>0&&v.height>0&&!!document.querySelector('#viewer-page-counter')?.textContent?.includes(' / 3');
 },null,{timeout:20000});
 const elapsed=Date.now()-begins;
 const inViewer=await page.evaluate(()=>({...window.__perf}));
 assert(inViewer.pauses>=1,'El visor ha de suspendre miniatures abans de llegir el PDF');
 assert(inViewer.thumbStops>=1,'La miniatura anterior ha de rebre destroy()');
 assert(inViewer.viewerStarts>=1,'El visor PDF.js ha pogut obrir-se amb una miniatura bloquejada');
 assert(elapsed<7000,'La miniatura no ha de frenar el visor: '+elapsed+' ms');
 await page.waitForTimeout(700);
 const during=await page.evaluate(()=>window.__perf.thumbStarts);
 assert.equal(during,inViewer.thumbStarts,'Cap miniatura nova mentre el visor està actiu');
 await page.locator('[data-action="viewer-close"]').click();
 await page.locator('.viewer').waitFor({state:'detached',timeout:20000});
 await page.waitForFunction(()=>document.querySelector('[data-pf-thumb="CIMO.pdf"] img')?.naturalWidth>0,null,{timeout:20000});
 const after=await page.evaluate(()=>({...window.__perf}));
 assert(after.resumes>=1,'Es reprenen miniatures quan tanquem el PDF');
 assert(after.thumbStarts>during,'Es regenera una miniatura cancel·lada en tornar');
 // Test de navegació ràpida: la suspensió no ha de deixar falles permanents.
 await page.locator('[data-action="open"][data-value="Alt.pdf"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-stage canvas')?.width>0,null,{timeout:20000});
 await page.locator('[data-action="viewer-close"]').click();
 assert.equal(errors.length,0,'Errors JavaScript: '+errors.join('\n'));
 console.log('PASS W2.14.3: cancel·lació de miniatura en curs, PDF prioritari, restauració de miniatures, documents reals; '+elapsed+' ms');
 await context.close();
}finally{await browser.close();}
