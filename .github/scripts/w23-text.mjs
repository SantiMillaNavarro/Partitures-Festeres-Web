import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {emptyAnnotations,normalizeAnnotations,projectPoint,TEXT_SIZES,TEXT_OPACITIES} from '../../annotations.js';
import {textBounds,hitTestStroke,translatedStroke} from '../../annotation-geometry.js';

const textRecord={tool:'text',color:'#1b58a7',width:.0055,points:[[.25,.3]],text:'D.C. al Fine\nTornada',
 fontSize:.044,bold:true,underline:true,opacity:.5};
assert.deepEqual(normalizeAnnotations({version:1,pages:{'1':[textRecord]}}).pages['1'][0],textRecord,'W2.3 text schema V1');
assert.deepEqual(normalizeAnnotations(null),emptyAnnotations(),'Older empty documents remain valid');
assert.equal(textBounds(textRecord,400,600).lines.length,2);
assert.equal(hitTestStroke([textRecord],[.27,.32],400,600),0,'Text can be selected inside glyph box');
assert.equal(hitTestStroke([textRecord],[.05,.80],400,600),-1,'Outside text does not select');
assert.equal(hitTestStroke([textRecord],projectPoint([.27,.32],90),600,400,270),-1,'Incorrect frame is not accidentally hit');
assert.deepEqual(translatedStroke(textRecord,.10,.05).points,[[.35,.35]],'Text can move without altering styles');
for(const x of [
 {...textRecord,text:''},{...textRecord,fontSize:.3},{...textRecord,text:'a\nb\nc\nd\ne\nf'},
 {...textRecord,opacity:0},{...textRecord,bold:1},{...textRecord,points:[[0,0],[1,1]]},
 {...textRecord,color:'<script>'}
])assert.throws(()=>normalizeAnnotations({version:1,pages:{1:[x]}}),'Reject invalid text document');
assert.deepEqual(TEXT_SIZES,[.018,.026,.034,.044,.06,.08,.1]);
assert.deepEqual(TEXT_OPACITIES,[.25,.5,.75,1]);

function makePdf(){
 const t='BT /F1 25 Tf 60 700 Td (W23 TEXT ANNOTATIONS) Tj ET';
 const objects=[
  '<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
  '<</Length '+t.length+'>>\nstream\n'+t+'\nendstream',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>'
 ];
 let s='%PDF-1.4\n';const offsets=[];
 for(let i=0;i<objects.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const start=s.length;s+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const offset of offsets)s+=String(offset).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(objects.length+1)+'>>\nstartxref\n'+start+'\n%%EOF\n','ascii');
}
const pdf=makePdf();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 await page.locator('.bottom-link[data-value="settings"]').click();
 assert.match(await page.locator('main.content').innerText(),/Partitures Festeres Web — W2\.11/);
 await page.locator('.bottom-link[data-value="library"]').click();
 await page.locator('#import-input').setInputFiles({name:'TEXT_W23.pdf',mimeType:'application/pdf',buffer:pdf});
 await page.locator('.score-row').first().waitFor();
 const records=async()=>page.evaluate(async()=>{
  const {getAnnotations}=await import('./db.js');return (await getAnnotations('TEXT_W23.pdf')).pages['1']||[];
 });
 const open=async()=>{
  await page.locator('.score-row [data-action="open"]').first().click();
  await page.locator('.viewer-canvas').waitFor({timeout:15000});
  await page.locator('#viewer-stage').click({position:{x:190,y:330}});
  await page.locator('[data-action="viewer-annotate"]').first().waitFor({state:'visible'});
 };
 const relative=async(x,y)=>{
  const b=await page.locator('.viewer-annotation-layer').boundingBox();
  assert(b?.width>50&&b?.height>50);
  return {x:b.x+b.width*x,y:b.y+b.height*y};
 };
 const tap=async(x,y)=>{const p=await relative(x,y);await page.mouse.click(p.x,p.y);};
 const drag=async(x,y,x2,y2)=>{
  const a=await relative(x,y),b=await relative(x2,y2);
  await page.mouse.move(a.x,a.y);await page.mouse.down();
  await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();
 };
 const tool=async name=>{
  const group=['pen','highlighter'].includes(name)?'strokes':
   ['line','rectangle','ellipse','arrow'].includes(name)?'shapes':'edit';
  await page.locator('[data-action="annotation-group"][data-value="'+group+'"]').click();
  await page.locator('[data-action="annotation-tool"][data-value="'+name+'"]').click();
 };
 await open();await page.locator('[data-action="viewer-annotate"]').first().click();
 await page.locator('[data-action="rosette-legacy"]').click();
 await page.locator('.w23-annotation-toolbar').waitFor();
 assert.equal(await page.locator('.annotation-rosette .annotation-petal').count(),4,'Grouped annotation control');
 await tool('text');
 await tap(.23,.24);
 await page.locator('.annotation-text-modal').waitFor();
 await page.locator('#annotation-text-value').fill('Sense guardar');
 await page.keyboard.press('Escape');
 await page.locator('.annotation-text-modal').waitFor({state:'detached'});
 assert.equal(await page.locator('.viewer-canvas').count(),1,'Escape cancels text without closing the PDF');
 assert.equal((await records()).length,0,'Cancelled text is not persisted');
 await tap(.23,.24);
 await page.locator('.annotation-text-modal').waitFor();
 assert.equal(await page.locator('#annotation-text-value').inputValue(),'');
 await page.locator('#annotation-text-value').fill('D.C. al Fine\nTornada');
 await page.locator('#annotation-font-size').selectOption('0.06');
 await page.locator('#annotation-text-opacity').selectOption('0.5');
 await page.locator('#annotation-text-bold').check();
 await page.locator('#annotation-text-underline').check();
 await page.locator('input[name="annotation-text-color"][value="#1b58a7"]').check();
 await page.locator('[data-action="annotation-text-save"]').click();
 await page.locator('.annotation-text-modal').waitFor({state:'detached'});
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');return (await getAnnotations('TEXT_W23.pdf')).pages['1']?.length===1;
 });
 let recordsAfter=await records();
 assert.equal(recordsAfter[0].tool,'text');
 assert.equal(recordsAfter[0].text,'D.C. al Fine\nTornada');
 assert.equal(recordsAfter[0].fontSize,.06);
 assert.equal(recordsAfter[0].opacity,.5);
 assert.equal(recordsAfter[0].bold,true);
 assert.equal(recordsAfter[0].underline,true);
 assert.equal(recordsAfter[0].color,'#1b58a7');
 assert((await page.locator('.annotation-text tspan').count())>=2,'SVG text box wraps its two original lines if needed');
 assert.equal(await page.locator('.annotation-text').getAttribute('font-weight'),'700');
 assert.equal(await page.locator('.annotation-text').getAttribute('text-decoration'),'underline');
 assert.equal(await page.locator('.annotation-text').getAttribute('opacity'),'0.5');
 await tool('select');
 await tap(.25,.25);
 assert.equal(await page.locator('.annotation-selection').count(),1,'Selecting text shows its bounds');
 assert.equal(await page.locator('[data-action="annotation-text-edit"]').isEnabled(),true);
 const initialPoint=(await records())[0].points[0];
 await drag(.25,.25,.37,.31);
 await page.waitForFunction(async(initial)=>{
  const {getAnnotations}=await import('./db.js');const p=(await getAnnotations('TEXT_W23.pdf')).pages['1']?.[0]?.points?.[0];
  return p&&JSON.stringify(p)!==JSON.stringify(initial);
 },initialPoint);
 recordsAfter=await records();
 assert.notDeepEqual(recordsAfter[0].points[0],initialPoint,'Selection movement is saved');
 const movedPos=recordsAfter[0].points[0];
 await page.locator('[data-action="annotation-text-edit"]').click();
 await page.locator('.annotation-text-modal').waitFor();
 assert.equal(await page.locator('#annotation-text-value').inputValue(),'D.C. al Fine\nTornada');
 await page.locator('#annotation-text-value').fill('D.S. al Coda');
 await page.locator('#annotation-font-size').selectOption('0.044');
 await page.locator('#annotation-text-opacity').selectOption('0.75');
 await page.locator('#annotation-text-bold').uncheck();
 await page.locator('input[name="annotation-text-color"][value="#21824f"]').check();
 await page.locator('[data-action="annotation-text-save"]').click();
 await page.locator('.annotation-text-modal').waitFor({state:'detached'});
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');return (await getAnnotations('TEXT_W23.pdf')).pages['1']?.[0]?.text==='D.S. al Coda';
 });
 recordsAfter=await records();
 assert.deepEqual(recordsAfter[0].points[0],movedPos,'Editing text leaves its moved location untouched');
 assert.equal(recordsAfter[0].color,'#21824f');
 assert.equal(recordsAfter[0].bold,false);
 assert.equal(recordsAfter[0].opacity,.75);
 await page.locator('[data-action="annotation-undo"]').click();
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');return (await getAnnotations('TEXT_W23.pdf')).pages['1']?.[0]?.text==='D.C. al Fine\nTornada';
 });
 assert.deepEqual((await records())[0].points[0],movedPos,'Undo text edit keeps placement');
 await tool('text');
 await tap(.15,.52);
 await page.locator('#annotation-text-value').fill('<script>alert(1)</script>');
 await page.locator('[data-action="annotation-text-save"]').click();
 await page.locator('.annotation-text-modal').waitFor({state:'detached'});
 assert.equal(await page.locator('.annotation-text').count(),2);
 assert.equal(await page.locator('.annotation-text').nth(1).textContent(),'<script>alert(1)</script>','Untrusted text is displayed literally');
 assert.equal(await page.locator('svg script').count(),0,'Text cannot inject script into the SVG');
 await tool('select');
 await tap(.17,.53);
 assert.equal(await page.locator('.annotation-selection').count(),1,'Second text can be selected');
 await page.locator('[data-action="annotation-delete-selected"]').click();
 assert.equal(await page.locator('.annotation-text').count(),1,'Text can be deleted individually');
 await page.locator('[data-action="annotation-undo"]').click();
 assert.equal(await page.locator('.annotation-text').count(),2,'Undo recovers deleted text');
 await page.locator('[data-action="viewer-annotate"]').last().click();
 await page.locator('[data-action="viewer-rotate"]').click();
 await page.waitForFunction(()=>{const t=document.querySelector('.annotation-text');return t&&t.getAttribute('transform')?.startsWith('translate(')&&!t.getAttribute('transform')?.includes('rotate(');});
 await page.locator('[data-action="viewer-zoom-in"]').click();
 assert.equal(await page.locator('.annotation-text').count(),2,'Rotation and zoom preserve text');
 await page.locator('[data-action="viewer-page-next"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 2'));
 assert.equal(await page.locator('.annotation-text').count(),0,'Page 2 remains unannotated');
 await page.locator('[data-action="viewer-page-prev"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('1 / 2'));
 assert.equal(await page.locator('.annotation-text').count(),2);
 await page.reload();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 assert.equal(await page.locator('.annotation-text').count(),2,'Text persists after refresh, with viewer restored');
 await page.locator('#viewer-stage').click({position:{x:190,y:330}});
 await page.locator('[data-action="viewer-close"]').click();
 await page.locator('.bottom-link[data-value="settings"]').click();
 await page.locator('[data-action="backup-create"]').click();
 await page.locator('.backup-ready').waitFor({timeout:25000});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="backup-save"]').click()]);
 const zipBuffer=await readFile(await download.path());
 const exported=await page.evaluate(async base64=>{
  const zip=await window.JSZip.loadAsync(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)));
  const manifest=JSON.parse(await zip.file('partitures-festeres-copia.json').async('string'));
  const path=Object.keys(zip.files).find(x=>x.startsWith('anotacions/')&&x.endsWith('.json'));
  return {manifest,annotations:JSON.parse(await zip.file(path).async('string'))};
 },zipBuffer.toString('base64'));
 assert.equal(exported.manifest.schemaVersion,1,'ZIP stays compatible with W2.1');
 assert.equal(exported.annotations.pages['1'].length,2);
 assert.equal(exported.annotations.pages['1'][1].text,'<script>alert(1)</script>');
 await page.locator('#restore-input').setInputFiles({name:'text-annotations.zip',mimeType:'application/zip',buffer:zipBuffer});
 await page.locator('[data-action="restore-replace"]').waitFor();
 await page.locator('[data-action="restore-replace"]').click();
 await page.locator('.restore-modal').waitFor({state:'detached'});
 await page.locator('.bottom-link[data-value="library"]').click();
 await open();
 assert.equal(await page.locator('.annotation-text').count(),2,'ZIP restore preserves text');
 const originalPdf=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');return Array.from(new Uint8Array(await (await getScore('TEXT_W23.pdf')).blob.arrayBuffer()));
 });
 assert.deepEqual(originalPdf,Array.from(pdf),'Underlying PDF remains byte-identical');
 assert.deepEqual(errors,[],'No JavaScript errors or unsafe text execution');
 console.log('PASS W2.3: text formatting, editing, hit-testing, movement, deletion, undo, rotation, zoom, reload and ZIP roundtrip');
 await context.close();
}finally{await browser.close();}
