import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {thumbnailSize,thumbnailRotation,thumbnailKey,
 THUMB_MAX_PIXELS,THUMB_MAX_WIDTH,THUMB_MAX_HEIGHT,THUMB_CACHE_ENTRIES} from '../../pdf-thumbnails-w2142.js';
assert.deepEqual(thumbnailRotation({rotationMode:'manual',rotation:90}),90);
assert.deepEqual(thumbnailRotation({rotationMode:'auto',rotation:90}),null);
assert.deepEqual(thumbnailRotation({rotationMode:'manual',rotation:45}),null);
assert.equal(thumbnailKey('a.pdf',100,123),'a.pdf|100|123');
for(const [w,h] of [[400,1200],[2400,100],[120,120],[900000,900],[240,400]]){
 const bounds=thumbnailSize(w,h);
 assert(bounds.width*bounds.height<=THUMB_MAX_PIXELS);
 assert(bounds.width<=THUMB_MAX_WIDTH&&bounds.height<=THUMB_MAX_HEIGHT);
 assert(bounds.width>0&&bounds.height>0);
}
assert.throws(()=>thumbnailSize(0,23));
assert(THUMB_CACHE_ENTRIES<=48,'La caché en memòria ha de ser finita');

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();
 const added=await page.evaluate(async()=>{
  const {saveBatch,setPref,getAllScores}=await import('./db.js');
  const {assembleScanPdf}=await import('./scanner-pdf-w2133.js');
  const jpeg=async(w,h,label)=>{
   const c=document.createElement('canvas');c.width=w;c.height=h;
   const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
   ctx.fillStyle='#141414';ctx.fillRect(w*.07,h*.11,w*.86,h*.025);
   ctx.font='17px Georgia';ctx.fillText(label,8,45);
   const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.8));
   const pdf=assembleScanPdf([{bytes:new Uint8Array(await blob.arrayBuffer()),width:w,height:h}]);
   c.width=0;c.height=0;return pdf;
  };
  const portrait=await jpeg(160,270,'Marxa Mora'),landscape=await jpeg(270,160,'Pasdoble');
  const now=Date.now();
  await saveBatch([
   {path:'Musiques/Marxa Mora.pdf',size:portrait.size,blob:portrait,added:now},
   {path:'Musiques/Pasdoble.pdf',size:landscape.size,blob:landscape,added:now+1},
   {path:'Musiques/Fitxer trencat.pdf',size:12,blob:new Blob(['Not a PDF'],{type:'application/pdf'}),added:now+2}
  ]);
  await setPref('viewer:Musiques/Marxa Mora.pdf',{page:1,rotationMode:'manual',rotation:90});
  await setPref('w13:favorites',['Musiques/Marxa Mora.pdf']);
  await setPref('w13:recents',['Musiques/Pasdoble.pdf']);
  await setPref('w13:repertoires',[{id:'rep_test',name:'Prova de banda',
    paths:['Musiques/Marxa Mora.pdf','Musiques/Pasdoble.pdf']}]);
  return (await getAllScores()).length;
 });
 assert.equal(added,3);
 await page.reload();
 await page.locator('.bottom-nav [data-action="page"][data-value="library"]').click();
 await page.locator('[data-action="folder"][data-value="Musiques"]').click();
 const thumb=path=>page.locator('.pf-thumb-frame[data-pf-thumb="'+path+'"]');
 const good=thumb('Musiques/Marxa Mora.pdf');
 const other=thumb('Musiques/Pasdoble.pdf');
 const broken=thumb('Musiques/Fitxer trencat.pdf');
 await good.waitFor();
 await page.waitForFunction(()=>{
  const el=document.querySelector('[data-pf-thumb="Musiques/Marxa Mora.pdf"] img');
  return el?.complete&&el.naturalWidth>0;
 },null,{timeout:30000});
 await page.waitForFunction(()=>{
  const el=document.querySelector('[data-pf-thumb="Musiques/Pasdoble.pdf"] img');
  return el?.complete&&el.naturalWidth>0;
 },null,{timeout:30000});
 const info=await page.evaluate(()=>{
  const read=path=>{
   const x=document.querySelector('[data-pf-thumb="'+path+'"] img');
   return {width:x?.naturalWidth||0,height:x?.naturalHeight||0,
    url:x?.currentSrc||''};
  };
  return {portrait:read('Musiques/Marxa Mora.pdf'),landscape:read('Musiques/Pasdoble.pdf')};
 });
 assert(info.portrait.width>info.portrait.height,'La rotació manual del visor es reflectix en Biblioteca');
 assert(info.landscape.width>info.landscape.height,'El PDF horitzontal manté l’orientació');
 assert(info.portrait.width*info.portrait.height<=THUMB_MAX_PIXELS);
 assert(info.landscape.width*info.landscape.height<=THUMB_MAX_PIXELS);
 assert(info.portrait.url.startsWith('blob:'),'Miniatures privades com a object URL');
 await page.waitForFunction(()=>{
  const el=document.querySelector('[data-pf-thumb="Musiques/Fitxer trencat.pdf"]');
  return el?.classList.contains('pf-thumb-failed');
 },null,{timeout:30000});
 assert.equal(await broken.locator('svg').count(),1,'PDF corrupte: icona original');
 assert.equal(await broken.locator('img').count(),0,'PDF corrupte: no imatge trencada');
 // L'índex i les col·leccions reutilitzen les miniatures, sense renderització nova.
 await page.locator('.bottom-nav [data-action="page"][data-value="index"]').click();
 await page.locator('.pf-index-thumb[data-pf-thumb="Musiques/Marxa Mora.pdf"] img').waitFor();
 await page.locator('.bottom-nav [data-action="page"][data-value="favorites"]').click();
 await page.locator('.pf-thumb-frame[data-pf-thumb="Musiques/Marxa Mora.pdf"] img').waitFor();
 await page.locator('.bottom-nav [data-action="page"][data-value="recents"]').click();
 await page.locator('.pf-thumb-frame[data-pf-thumb="Musiques/Pasdoble.pdf"] img').waitFor();
 await page.locator('.bottom-nav [data-action="page"][data-value="repertoires"]').click();
 await page.locator('[data-action="rep-open"]').click();
 await page.locator('.pf-thumb-frame[data-pf-thumb="Musiques/Marxa Mora.pdf"] img').waitFor();
 // L'usuari pot desactivar miniatures a Ajustos, inclosa la persistència.
 await page.locator('.bottom-nav [data-action="page"][data-value="settings"]').click();
 const toggle=page.locator('#thumbnail-enabled');
 assert.equal(await toggle.isChecked(),true);
 await toggle.uncheck();
 assert.equal(await page.evaluate(async()=>{
  const {getPref}=await import('./db.js');
  return getPref('w2142:thumbnailsEnabled');
 }),false);
 await page.reload();
 await page.locator('.bottom-nav [data-action="page"][data-value="settings"]').click();
 assert.equal(await page.locator('#thumbnail-enabled').isChecked(),false);
 await page.locator('.bottom-nav [data-action="page"][data-value="favorites"]').click();
 const fallback=page.locator('.pf-thumb-frame[data-pf-thumb="Musiques/Marxa Mora.pdf"]');
 await fallback.waitFor();
 assert.equal(await fallback.locator('img').count(),0,'Desactivar miniatures recupera icona PDF');
 await page.locator('.bottom-nav [data-action="page"][data-value="settings"]').click();
 await page.locator('#thumbnail-enabled').check();
 await page.locator('.bottom-nav [data-action="page"][data-value="favorites"]').click();
 await page.locator('.pf-thumb-frame[data-pf-thumb="Musiques/Marxa Mora.pdf"] img').waitFor({timeout:30000});
 assert.equal(await page.evaluate(async()=>{
  const {getAllScores}=await import('./db.js');
  return (await getAllScores()).length;
 }),3,'Les miniatures no modifiquen els PDF');
 assert.equal(errors.length,0,'Errors JS: '+JSON.stringify(errors));
 console.log('PASS W2.14.2: imatge PDF real, rotació, límit píxels, fallback corruptes, Índex/Repertoris/Favorits/Recents i Ajuts');
 await context.close();
}finally{await browser.close();}
