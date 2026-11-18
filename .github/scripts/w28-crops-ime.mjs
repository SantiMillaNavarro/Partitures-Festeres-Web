import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {cropRectFromGesture,validCropDataUri,MAX_CROP_DATA_LENGTH} from '../../annotation-crops.js';
import {normalizeAnnotations} from '../../annotations.js';
import {objectBounds,hitTestStroke} from '../../annotation-geometry.js';
import {inlineImeShouldCommit,inlineBeforeInputShouldCommit} from '../../inline-text-w28.js';

assert.equal(inlineImeShouldCommit({key:'Enter',shiftKey:false,keyCode:13}),true);
assert.equal(inlineImeShouldCommit({key:'Enter',shiftKey:true,keyCode:13}),false);
assert.equal(inlineImeShouldCommit({key:'Enter',shiftKey:false,keyCode:229}),false);
assert.equal(inlineImeShouldCommit({key:'Enter',shiftKey:false,isComposing:true}),false);
assert.equal(inlineBeforeInputShouldCommit({inputType:'insertLineBreak'}),true);
assert.equal(inlineBeforeInputShouldCommit({inputType:'insertParagraph'},false,true),false);
assert.equal(inlineBeforeInputShouldCommit({inputType:'insertText'}),false);
assert.equal(cropRectFromGesture([.10,.20],[.40,.48],0,600,800).boxWidth,.3);
assert.equal(cropRectFromGesture([.20,.20],[.21,.21],0,600,800),null);
assert.equal(validCropDataUri('data:image/svg+xml;base64,'+'a'.repeat(60)),false);
assert.equal(validCropDataUri('data:image/jpeg;base64,/9j/'+'A'.repeat(MAX_CROP_DATA_LENGTH)),false);

function pdf(){
 const t='BT /F1 24 Tf 60 690 Td (RETALL FESTER W28) Tj ET';
 const o=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
 '<</Length '+t.length+'>>\nstream\n'+t+'\nendstream',
 '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>'];
 let s='%PDF-1.4\n';const offsets=[];
 for(let i=0;i<o.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n';}
 const start=s.length;s+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const n of offsets)s+=String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+start+'\n%%EOF\n','ascii');
}
const source=pdf();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext({viewport:{width:1080,height:750},deviceScaleFactor:1,acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 await page.locator('#import-input').setInputFiles({name:'RETALL_W28.pdf',mimeType:'application/pdf',buffer:source});
 await page.locator('[data-action="open"][data-value="RETALL_W28.pdf"]').waitFor();
 await page.locator('[data-action="open"][data-value="RETALL_W28.pdf"]').click();
 await page.locator('.viewer-canvas').waitFor({timeout:16000});
 await page.locator('#viewer-stage').click({position:{x:470,y:330}});
 await page.locator('.viewer-annotate-btn').click();
 await page.locator('[data-action="rosette-option"][data-value="crop"]').click();
 const layer=page.locator('.viewer-annotation-layer');
 const at=async(x,y)=>{const b=await layer.boundingBox();return {x:b.x+b.width*x,y:b.y+b.height*y}};
 const tap=async(x,y)=>{const p=await at(x,y);await page.mouse.click(p.x,p.y)};
 const drag=async(x,y,X,Y)=>{
   const p=await at(x,y),q=await at(X,Y);
   await page.mouse.move(p.x,p.y);await page.mouse.down();
   await page.mouse.move(q.x,q.y,{steps:15});await page.mouse.up();
 };
 const read=async()=>page.evaluate(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('RETALL_W28.pdf')).pages;
 });
 await drag(.20,.22,.48,.46);
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('RETALL_W28.pdf')).pages['1']?.some(s=>s.tool==='crop');
 },null,{timeout:12000});
 let rows=await read();
 assert.equal(rows['1'].length,1);
 assert.equal(rows['1'][0].tool,'crop');
 assert(validCropDataUri(rows['1'][0].imageData));
 assert(rows['1'][0].boxWidth>.2&&rows['1'][0].boxHeight>.2);
 assert.equal(await page.locator('.annotation-crop').count(),1);
 const clone=structuredClone(rows['1'][0]);
 assert.deepEqual(normalizeAnnotations({version:1,pages:{1:[clone]}}).pages['1'][0],clone);
 assert.throws(()=>normalizeAnnotations({version:1,pages:{1:[{...clone,imageData:'javascript:alert(1)'}]}}));
 assert.throws(()=>normalizeAnnotations({version:1,pages:{1:[{...clone,imageData:'data:image/svg+xml;base64,AAA'}]}}));
 const b=objectBounds(clone,600,800);
 assert(b.width>100&&b.height>100);
 assert.equal(hitTestStroke([clone],[.30,.32],600,800,0),0);
 await page.locator('[data-action="object-toggle"]').click();
 await page.locator('[data-action="object-copy"]').click();
 await page.locator('#viewer-next-page').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 2'));
 await page.locator('[data-action="object-paste"]').click();
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('RETALL_W28.pdf')).pages['2']?.some(s=>s.tool==='crop');
 });
 assert.equal(await page.locator('.annotation-crop').count(),1);
 await page.locator('[data-action="object-rotate-right"]').click();
 await page.locator('[data-action="object-size-down"]').click();
 rows=await read();
 assert.equal(rows['2'][0].rotationDegrees,15);
 assert(rows['2'][0].boxWidth<clone.boxWidth);
 await page.locator('[data-action="annotation-undo"]').click();
 rows=await read();assert.equal(rows['2'][0].boxWidth,clone.boxWidth);
 // Text IME: Return should accept, not add a second line.
 const chooseText=async()=>{
  const rosette=page.locator('.pf-rosette');
  for(let attempt=0;attempt<6;attempt++){
   if(await page.locator('[data-action="rosette-option"][data-value="text"]').count())break;
   if(!(await rosette.count())){
    await page.locator('.viewer-annotate-btn').click();continue;
   }
   await page.locator('.pf-rosette-core').click();
  }
  const button=page.locator('[data-action="rosette-option"][data-value="text"]');
  if(!(await button.count())){
   console.log('W28 ROSETTE DIAGNOSTIC',await page.evaluate(()=>({
    rose:document.querySelector('.pf-rosette')?.outerHTML?.slice(0,300),
    legacy:!!document.querySelector('.w23-annotation-toolbar'),
    mode:document.querySelector('.pf-reading-mode')?.className
   })));
  }
  await button.click();
 };
 await chooseText();
 await tap(.68,.70);
 await page.locator('.pf-inline-input').waitFor({timeout:8000});
 assert.equal(await page.locator('.pf-inline-input').getAttribute('enterkeyhint'),'done');
 await page.locator('.pf-inline-input').fill('Fet des del teclat');
 await page.locator('.pf-inline-input').press('Enter');
 await page.locator('.pf-inline-input').waitFor({state:'detached'});
 rows=await read();
 assert.equal(rows['2'].find(s=>s.tool==='text')?.text,'Fet des del teclat');
 assert.equal(await page.locator('.annotation-text').count(),1);
 // Multilínia explícita: Shift+Enter i el botó ↵ preserven salts de línia.
 await chooseText();
 await tap(.62,.52);
 await page.locator('.pf-inline-input').waitFor();
 await page.locator('.pf-inline-input').fill('Primera');
 await page.locator('.pf-inline-input').press('Shift+Enter');
 await page.locator('.pf-inline-input').type('Segona');
 assert.equal(await page.locator('.pf-inline-input').inputValue(),'Primera\nSegona');
 await page.locator('[data-inline="newline"]').click();
 await page.locator('.pf-inline-input').type('Tercera');
 assert.equal(await page.locator('.pf-inline-input').inputValue(),'Primera\nSegona\nTercera');
 await page.locator('.pf-inline-input').press('Enter');
 await page.locator('.pf-inline-input').waitFor({state:'detached'});
 rows=await read();
 assert.equal(rows['2'].filter(s=>s.tool==='text').length,2);
 assert.equal(rows['2'].find(s=>s.tool==='text'&&s.text.includes('Primera'))?.text,'Primera\nSegona\nTercera');
 // Persistència després de recarregar i integritat del PDF base.
 await page.reload();
 await page.locator('.viewer-canvas').waitFor({timeout:16000});
 assert.equal(await page.locator('.annotation-crop').count(),1);
 rows=await read();assert.equal(rows['1'][0].tool,'crop');assert.equal(rows['2'][0].tool,'crop');
 const bytes=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');
  return Array.from(new Uint8Array(await (await getScore('RETALL_W28.pdf')).blob.arrayBuffer()));
 });
 assert.deepEqual(bytes,Array.from(source),'PDF original is unchanged');
 assert.deepEqual(errors,[],'No page errors');
 console.log('PASS W2.8: Retall capturable/seleccionable/copiar/apegar/girar/escalar/desfer, IME Fet i salts explícits, persistència i PDF intacte');
 await context.close();
} finally {await browser.close();}
