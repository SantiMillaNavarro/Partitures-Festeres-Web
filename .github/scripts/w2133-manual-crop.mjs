import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {validCrop,cropArea,DEFAULT_CROP,FULL_CROP,movedCrop,cloneCrop,cropPointsAttr} from '../../scanner-crop-geometry-w2133.js';
import {perspectiveMatrix,projectPoint} from '../../scanner-detection-w2132.js';

assert(validCrop(DEFAULT_CROP));
assert(validCrop(FULL_CROP));
assert(cropArea(DEFAULT_CROP)>.80);
assert.equal(validCrop(null),false);
assert.equal(validCrop([{x:0,y:0},{x:1,y:1},{x:1,y:0},{x:0,y:1}]),false,'Retall auto-intersectat rebutjat');
assert.equal(validCrop([{x:0,y:0},{x:0,y:0},{x:1,y:1},{x:0,y:1}]),false,'Punts junts rebutjats');
assert.equal(validCrop([{x:-1,y:0},...DEFAULT_CROP.slice(1)]),false,'Punts fora rebutjats');
assert.equal(movedCrop(DEFAULT_CROP,1,{x:-1,y:1}),null);
const newPoints=movedCrop(DEFAULT_CROP,0,{x:.18,y:.14});
assert(newPoints&&validCrop(newPoints));
assert.equal(DEFAULT_CROP[0].x,.04,'No canviar la geometria original');
assert(cloneCrop(newPoints)!==newPoints);
assert.equal(cropPointsAttr(newPoints).split(' ').length,4);
const matrix=perspectiveMatrix(DEFAULT_CROP);
assert(Number.isFinite(projectPoint(matrix,.25,.75).x));

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())
  await page.locator('[data-action="welcome-done"]').click();
 await page.locator('header [data-action="scan-open"]').click();
 await page.locator('.pf-scan-screen').waitFor();
 await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=420;c.height=620;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#202020';ctx.fillRect(0,0,420,620);
  ctx.beginPath();ctx.moveTo(85,50);ctx.lineTo(345,72);
  ctx.lineTo(352,555);ctx.lineTo(78,560);ctx.closePath();
  ctx.fillStyle='#f5f2e6';ctx.fill();
  ctx.fillStyle='#242424';
  for(let i=0;i<20;i++)ctx.fillRect(124,112+i*19,164,2);
  const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));
  const file=new File([blob],'pagina-projectiva.png',{type:'image/png'});
  window.__cropSource=file;
  const dt=new DataTransfer();dt.items.add(file);
  const input=document.getElementById('scan-gallery-input');
  input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('.pf-scan-page').first().waitFor();
 assert.equal(await page.locator('.pf-scan-page').count(),1);
 assert.equal(await page.locator('[data-action="scan-crop"]').count(),1);
 await page.locator('[data-action="scan-crop"]').click();
 await page.locator('.pf-crop-backdrop').waitFor();
 assert.equal(await page.locator('.pf-crop-handle').count(),4);
 const initial=await page.locator('.pf-crop-polygon polygon').getAttribute('points');
 await page.locator('[data-crop-action="preview"]').click();
 await page.waitForFunction(()=>!!document.querySelector('.pf-crop-result')?.naturalWidth);
 assert.equal(await page.locator('.pf-crop-original').isHidden(),true);
 await page.locator('[data-crop-action="preview"]').click();
 assert.equal(await page.locator('.pf-crop-original').isVisible(),true);
 await page.locator('[data-crop-action="cancel"]').click();
 assert.equal(await page.locator('.pf-crop-backdrop').count(),0);
 assert.equal(await page.locator('.pf-scan-crop-done').count(),0,'Cancel·lar no aplica retall');

 await page.locator('[data-action="scan-crop"]').click();
 const photo=page.locator('.pf-crop-photo');
 const r=await photo.boundingBox();
 assert(r?.width>100&&r?.height>100,'Fotografia visible');
 const drag=async(i,x,y)=>{
  const handle=page.locator('.pf-crop-handle[data-corner="'+i+'"]');
  const b=await handle.boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  await page.mouse.down();
  await page.mouse.move(r.x+x*r.width,r.y+y*r.height,{steps:8});
  await page.mouse.up();
 };
 await drag(0,.20,.09);
 await drag(1,.82,.12);
 await drag(2,.84,.90);
 await drag(3,.19,.90);
 const adjusted=await page.locator('.pf-crop-polygon polygon').getAttribute('points');
 assert.notEqual(adjusted,initial,'Els quatre punts es poden arrossegar');
 assert(adjusted.split(' ').length===4);
 await page.locator('[data-crop-action="preview"]').click();
 await page.waitForFunction(()=>!!document.querySelector('.pf-crop-result')?.naturalWidth);
 const result=await page.locator('.pf-crop-result').evaluate(image=>({
  width:image.naturalWidth,height:image.naturalHeight,
  visible:image.getClientRects().length>0
 }));
 assert(result.width>150&&result.height>200&&result.visible,'La previsualització és una foto retallada');
 await page.locator('[data-crop-action="apply"]').click();
 await page.locator('.pf-crop-backdrop').waitFor({state:'detached'});
 assert.equal(await page.locator('.pf-scan-crop-done').count(),1,'Retall aplicat');
 assert.match(await page.locator('.pf-scan-page img').getAttribute('src'),/^blob:/);
 const savedPreview=await page.locator('.pf-scan-page img').getAttribute('src');

 await page.locator('[data-action="scan-crop"]').click();
 await page.locator('.pf-crop-backdrop').waitFor();
 assert.equal(await page.locator('.pf-crop-polygon polygon').getAttribute('points'),adjusted,'Es recuperen les cantonades');
 await page.locator('[data-crop-action="remove"]').click();
 assert.equal(await page.locator('.pf-scan-crop-done').count(),0,'Sense retall recupera la foto completa');
 assert.notEqual(await page.locator('.pf-scan-page img').getAttribute('src'),savedPreview);
 await page.locator('[data-action="scan-crop"]').click();
 await page.locator('.pf-crop-backdrop').waitFor();
 // Retall de la fulla i rotació de 90°, amb filtres aplicats després de redreçar.
 await drag(0,.20,.09);
 await drag(1,.82,.12);
 await drag(2,.84,.90);
 await drag(3,.19,.90);
 await page.locator('[data-crop-action="apply"]').click();
 await page.locator('.pf-crop-backdrop').waitFor({state:'detached'});
 await page.locator('[data-action="scan-rotate"]').first().click();
 await page.locator('[data-scan-filter]').first().selectOption('gray');
 const jpeg=await page.evaluate(async()=>{
  const mod=await import('./scanner-pdf-w2133.js');
  const quad=[{x:.2,y:.09},{x:.82,y:.12},{x:.84,y:.9},{x:.19,y:.9}];
  const output=await mod.scanImageAsJpeg({file:window.__cropSource,crop:quad,rotation:90,filter:'gray'});
  const blob=new Blob([output.bytes],{type:'image/jpeg'});
  const bitmap=await createImageBitmap(blob);
  const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;
  const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);
  const p=ctx.getImageData(bitmap.width/2|0,bitmap.height/2|0,1,1).data;
  bitmap.close();
  return {width:output.width,height:output.height,bytes:output.bytes.length,pixel:[...p]};
 });
 assert(jpeg.width>jpeg.height,'El gir de 90° s’aplica després del retall');
 assert(jpeg.bytes>1800,'JPEG de la fulla corregida');
 assert(Math.abs(jpeg.pixel[0]-jpeg.pixel[1])<5,'El filtre grises es conserva després del retall');
 await page.locator('#scan-name').fill('Prova recort 4 punts');
 await page.locator('[data-action="scan-save"]').click();
 await page.locator('.score-row [data-action="open"][data-value="Prova recort 4 punts.pdf"]').waitFor({timeout:30000});
 const stored=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');
  const rec=await getScore('Prova recort 4 punts.pdf');
  const bytes=new Uint8Array(await rec.blob.arrayBuffer());
  const doc=await globalThis.pdfjsLib.getDocument({data:bytes}).promise;
  const first=await doc.getPage(1);const result={
   pages:doc.numPages,landscape:first.view[2]>first.view[3],size:rec.size
  };
  await doc.destroy();
  return result;
 });
 assert.equal(stored.pages,1);
 assert.equal(stored.landscape,true);
 assert(stored.size>1000);
 assert.equal(errors.length,0,'Excepcions JS: '+JSON.stringify(errors));
 console.log('PASS W2.13.3: 4 punts tàctils, cancel·lar, aplicar, restaurar, retall projectiu, gir+filtre i PDF');
 await context.close();
}finally{await browser.close();}
