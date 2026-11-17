import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {normalizeAnnotations} from '../../annotations.js';
import {inlineTextBounds,validInlineText} from '../../inline-text-w26.js';
import {rosetteOptions} from '../../rosette-w25.js';
const old={tool:'text',color:'#b51f34',width:.0055,points:[[.18,.2]],
 text:'Text antic',fontSize:.034,bold:false,underline:false,opacity:1};
assert.deepEqual(normalizeAnnotations({version:1,pages:{1:[old]}}).pages['1'][0],old,'Old web text remains unchanged');
const richer={...old,italic:true,alignment:'center',backgroundEnabled:true,borderEnabled:true};
assert.deepEqual(normalizeAnnotations({version:1,pages:{1:[richer]}}).pages['1'][0],richer);
for(const bad of [{italic:'yes'},{alignment:'justify'},{backgroundEnabled:1},{borderEnabled:'true'}]){
 assert.throws(()=>normalizeAnnotations({version:1,pages:{1:[{...richer,...bad}]}}));
}
assert.equal(validInlineText('Hola\nMúsica'),true);
assert.equal(validInlineText('   '),false);
assert.equal(validInlineText('a\nb\nc\nd\ne\nf'),false);
assert.deepEqual(inlineTextBounds({point:[.2,.3],boxWidth:.28,boxHeight:.10,fontSize:.034},600,800),
 {left:120,top:240,width:168.00000000000003,height:80,fontPx:20.400000000000002});
assert(rosetteOptions('text').some(x=>x.id==='text-italic'));
assert(rosetteOptions('text').some(x=>x.id==='open-align'));
assert(rosetteOptions('text-align',{alignment:'center'}).find(x=>x.alignment==='center').active);

function pdf(){
 const t='BT /F1 24 Tf 60 690 Td (PARTITURES FESTERES W26) Tj ET';
 const o=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
 '<</Length '+t.length+'>>\nstream\n'+t+'\nendstream',
 '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>'];
 let s='%PDF-1.4\n';const positions=[];
 for(let i=0;i<o.length;i++){positions.push(s.length);s+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n';}
 const begin=s.length;s+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const v of positions)s+=String(v).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+begin+'\n%%EOF\n','ascii');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1080,height:750},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 const source=pdf();
 await page.locator('#import-input').setInputFiles({name:'TEXT_W26.pdf',mimeType:'application/pdf',buffer:source});
 await page.locator('[data-action="open"][data-value="TEXT_W26.pdf"]').waitFor();
 await page.locator('[data-action="open"][data-value="TEXT_W26.pdf"]').click();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 await page.locator('#viewer-stage').click({position:{x:450,y:320}});
 await page.locator('.viewer-annotate-btn').click();
 await page.locator('.pf-rosette .pf-rose-petal').first().waitFor();
 const selectTool=async(id)=>page.locator('[data-action="rosette-option"][data-value="'+id+'"]').click();
 await selectTool('text');
 assert.equal(await page.locator('.pf-rosette').getAttribute('data-level'),'text');
 assert.equal(await page.locator('[data-action="rosette-option"][data-value="text-italic"]').count(),1);
 await selectTool('text-italic');
 await selectTool('open-align');
 await selectTool('align:center');
 assert.equal(await page.locator('.pf-rosette').getAttribute('data-level'),'text');
 const layer=page.locator('.viewer-annotation-layer');
 const at=async(x,y)=>{
  const b=await layer.boundingBox();
  assert(b?.width>50&&b?.height>50,'Annotation layer exists');
  return {x:b.x+b.width*x,y:b.y+b.height*y};
 };
 const tap=async(x,y)=>{const p=await at(x,y);await page.mouse.click(p.x,p.y);};
 const drag=async(x,y,X,Y)=>{
  const a=await at(x,y),b=await at(X,Y);
  await page.mouse.move(a.x,a.y);await page.mouse.down();
  await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();
 };
 const records=()=>page.evaluate(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('TEXT_W26.pdf')).pages['1']||[];
 });
 await tap(.18,.18);
 await page.locator('.pf-inline-text-editor').waitFor();
 assert.equal(await page.locator('.annotation-text-modal').count(),0,'No old blocking modal');
 assert.equal(await page.locator('.pf-inline-input').count(),1);
 assert.equal(await page.locator('.pf-inline-input').evaluate(el=>document.activeElement===el),true,'Keyboard field receives focus');
 await page.locator('.pf-inline-input').fill('Text directe\nsobre partitura');
 await page.locator('[data-inline="italic"]').click();
 await page.locator('[data-inline="bold"]').click();
 await page.locator('[data-inline="align:right"]').click();
 await page.locator('[data-inline-size]').selectOption('0.044');
 await page.locator('[data-inline-color]').selectOption('#1b58a7');
 await page.locator('[data-inline="background"]').click();
 await page.locator('[data-inline="border"]').click();
 assert.equal(await page.locator('.pf-inline-input').evaluate(el=>getComputedStyle(el).fontStyle),'normal','Italic can be toggled off');
 // Zoom triggers PDF re-render; the live editor and draft must survive.
 await page.locator('[data-action="viewer-zoom-in"]').click();
 await page.waitForTimeout(450);
 assert.equal(await page.locator('.pf-inline-input').inputValue(),'Text directe\nsobre partitura');
 assert.equal(await page.locator('.pf-inline-text-editor').count(),1);
 await page.locator('[data-inline="save"]').click();
 await page.locator('.pf-inline-text-editor').waitFor({state:'detached'});
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('TEXT_W26.pdf')).pages['1']?.length===1;
 });
 let saved=await records(),one=saved[0];
 assert.equal(one.text,'Text directe\nsobre partitura');
 assert.equal(one.boxWidth,.28);assert(one.boxHeight>=.10);
 assert.equal(one.bold,true);assert.equal(one.italic,false);assert.equal(one.alignment,'right');
 assert.equal(one.fontSize,.044);assert.equal(one.color,'#1b58a7');
 assert.equal(one.backgroundEnabled,true);assert.equal(one.borderEnabled,true);
 assert.equal(await page.locator('.annotation-text').count(),1);
 assert.equal(await page.locator('.annotation-text').getAttribute('font-style'),'normal');
 assert.equal(await page.locator('.annotation-text').getAttribute('text-anchor'),'end');
 // Select text and edit in place. Undo/old data are unchanged.
 await tap(.20,.22);
 await page.locator('.pf-rosette-dock [data-action="annotation-text-edit"]').click();
 await page.locator('.pf-inline-input').waitFor();
 assert.match(await page.locator('.pf-inline-input').inputValue(),/Text directe/);
 await page.locator('.pf-inline-input').fill('Text modificat amb cursiva');
 await page.locator('[data-inline="italic"]').click();
 await page.locator('[data-inline="underline"]').click();
 await page.locator('[data-inline="save"]').click();
 saved=await records();
 assert.equal(saved[0].text,'Text modificat amb cursiva');
 assert.equal(saved[0].italic,true);assert.equal(saved[0].underline,true);
 // Touch to create a second box; cancel must not create an annotation.
 await selectTool('text');
 await tap(.55,.62);
 await page.locator('.pf-inline-input').waitFor();
 await page.locator('.pf-inline-input').fill('No guardar');
 await page.locator('[data-inline="cancel"]').click();
 assert.equal((await records()).length,1);
 // Drawing a new box by drag keeps its dimensions; switching page commits automatically.
 await drag(.22,.56,.55,.70);
 await page.locator('.pf-inline-input').waitFor();
 await page.locator('.pf-inline-input').fill('Canvi de pàgina des del quadre');
 await page.locator('#viewer-next-page').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 2'));
 saved=await records();
 assert.equal(saved.length,2);
 assert.equal(saved[1].text,'Canvi de pàgina des del quadre');
 assert(saved[1].boxWidth>.25&&saved[1].boxWidth<.4);
 assert.equal(await page.locator('.pf-inline-text-editor').count(),0);
 await page.locator('#viewer-prev-page').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('1 / 2'));
 assert.equal(await page.locator('.annotation-text').count(),2);
 // Legacy editor exists only on explicit compatibility toggle.
 await page.locator('[data-action="rosette-legacy"]').click();
 await page.locator('.w23-annotation-toolbar').waitFor();
 await page.locator('[data-action="annotation-group"][data-value="edit"]').click();
 await page.locator('[data-action="annotation-tool"][data-value="text"]').click();
 await tap(.67,.24);
 await page.locator('.annotation-text-modal').waitFor();
 await page.locator('[data-action="annotation-text-cancel"]').click();
 assert.equal((await records()).length,2);
 await page.locator('[data-action="viewer-annotate"]').last().click();
 await page.reload();await page.locator('.viewer-canvas').waitFor({timeout:15000});
 assert.equal(await page.locator('.annotation-text').count(),2);
 const bytes=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');
  const record=await getScore('TEXT_W26.pdf');
  return Array.from(new Uint8Array(await record.blob.arrayBuffer()));
 });
 assert.deepEqual(bytes,Array.from(source),'PDF content unchanged');
 assert.deepEqual(errors,[],'No browser errors');
 console.log('PASS W2.6: Android-style inline text editor, keyboard, formatting, zoom, cancel, selection, page-turn commit, legacy mode and PDF bytes');
 await context.close();
}finally{await browser.close();}
