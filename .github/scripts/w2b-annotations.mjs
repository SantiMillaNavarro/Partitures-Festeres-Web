import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {normalizeAnnotations,emptyAnnotations,ANNOTATION_SHAPES} from '../../annotations.js';
import {strokeWidth,translatedStroke,strokePath,hitTestStroke} from '../../annotation-geometry.js';

const base={tool:'pen',color:'#b51f34',width:.0055,points:[[.2,.3],[.5,.7]]};
assert.deepEqual(normalizeAnnotations({version:1,pages:{1:[base]}}).pages['1'][0],base,'Old W2.1 strokes remain valid');
assert.deepEqual(normalizeAnnotations(null),emptyAnnotations());
for(const tool of ANNOTATION_SHAPES){
 const shape={...base,tool};
 assert.deepEqual(normalizeAnnotations({version:1,pages:{1:[shape]}}).pages['1'][0],shape);
 assert(strokePath(shape,400,500).startsWith('M'));
 assert(strokePath({...shape,points:[shape.points[0]]},400,500).startsWith('M'),'Incomplete shape preview must not crash');
 assert(strokePath(shape,500,400,90).startsWith('M'));
 assert.throws(()=>normalizeAnnotations({version:1,pages:{1:[{...shape,points:[[.5,.5]]}]}}));
}
assert(strokeWidth('pen',5)>strokeWidth('pen',1));
assert(strokeWidth('highlighter',5)>strokeWidth('highlighter',1));
assert(strokeWidth('rectangle',5)>strokeWidth('rectangle',1));
const rect={...base,tool:'rectangle',points:[[.2,.2],[.5,.5]]};
assert.equal(hitTestStroke([rect],[.3,.3],400,600),0,'Tap inside rectangle selects it');
assert.equal(hitTestStroke([rect],[.9,.9],400,600),-1,'Tap far away does not select');
assert.equal(hitTestStroke([rect,rect],[.3,.3],400,600),1,'Topmost stroke wins');
const translated=translatedStroke(rect,.12,-.08);
assert.deepEqual(translated.points,[[.32,.12],[.62,.42]]);
assert.deepEqual(rect.points,[[.2,.2],[.5,.5]],'Moving never mutates source');
assert.deepEqual(translatedStroke(rect,50,-50).points,[[.7,0],[1,.3]],'Movement is bounded within page');

function pdf(){
 const t='BT /F1 24 Tf 80 690 Td (W22 TEST) Tj ET';
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
const buffer=pdf();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();
 await page.locator('.bottom-link[data-value="settings"]').click();
 const settings=await page.locator('main.content').innerText();
 assert.match(settings,/Partitures Festeres Web — W2\.15\.1/,'The version is updated in Ajustos');
 await page.locator('.bottom-link[data-value="library"]').click();
 await page.locator('#import-input').setInputFiles({name:'W22.pdf',mimeType:'application/pdf',buffer});
 await page.locator('.score-row').waitFor();
 const open=async()=>{
  await page.locator('.score-row [data-action="open"]').first().click();
  await page.locator('.viewer-canvas').waitFor({timeout:15000});
  await page.locator('#viewer-stage').click({position:{x:190,y:350}});
  await page.locator('[data-action="viewer-annotate"]').first().waitFor({state:'visible'});
 };
 const data=async()=>page.evaluate(async()=>{const {getAnnotations}=await import('./db.js');return await getAnnotations('W22.pdf');});
 const points=async()=>((await data()).pages['1']||[]);
 await open();
 await page.locator('[data-action="viewer-annotate"]').first().click();
 await page.locator('[data-action="rosette-legacy"]').click();
 await page.locator('.w22-annotation-toolbar').waitFor();
 const selectTool=async tool=>{
  const group=['pen','highlighter'].includes(tool)?'strokes':
     ['line','rectangle','ellipse','arrow'].includes(tool)?'shapes':'edit';
  await page.locator('[data-action="annotation-group"][data-value="'+group+'"]').click();
  await page.locator('[data-action="annotation-tool"][data-value="'+tool+'"]').click();
 };
 const xy=async(x,y)=>{
  const b=await page.locator('.viewer-annotation-layer').boundingBox();
  assert(b&&b.width>60&&b.height>60);
  return {x:b.x+x*b.width,y:b.y+y*b.height};
 };
 const drag=async(x1,y1,x2,y2)=>{
  const a=await xy(x1,y1),b=await xy(x2,y2);
  await page.mouse.move(a.x,a.y);await page.mouse.down();
  await page.mouse.move(b.x,b.y,{steps:14});await page.mouse.up();
 };
 const tap=async(x,y)=>{const a=await xy(x,y);await page.mouse.click(a.x,a.y);};
 await selectTool('pen');
 await page.locator('#annotation-width').selectOption('5');
 await drag(.08,.15,.20,.23);
 await page.waitForFunction(async()=>{const {getAnnotations}=await import('./db.js');return (await getAnnotations('W22.pdf')).pages['1']?.length===1;});
 assert.equal((await points())[0].width,strokeWidth('pen',5),'Llapis respects thickness');
 await selectTool('rectangle');await drag(.16,.30,.34,.44);
 await selectTool('ellipse');await drag(.58,.27,.82,.42);
 await selectTool('line');await drag(.14,.62,.43,.72);
 await selectTool('arrow');await drag(.55,.61,.80,.75);
 await selectTool('highlighter');await page.locator('#annotation-width').selectOption('1');
 await drag(.15,.50,.42,.54);
 assert.equal(await page.locator('.annotation-stroke').count(),6,'All tools render in the same SVG layer');
 await page.waitForFunction(async()=>{const {getAnnotations}=await import('./db.js');return (await getAnnotations('W22.pdf')).pages['1']?.length===6;});
 const before=await points();
 assert.deepEqual(before.map(s=>s.tool),['pen','rectangle','ellipse','line','arrow','highlighter']);
 assert.equal(before.at(-1).width,strokeWidth('highlighter',1));
 await selectTool('select');
 await tap(.25,.36);
 assert.equal(await page.locator('.annotation-selection').count(),1,'Selected annotation shows visual outline');
 assert.equal(await page.locator('[data-action="annotation-delete-selected"]').isEnabled(),true);
 await drag(.25,.36,.31,.42);
 const moved=await points();
 assert.notDeepEqual(moved[1].points,before[1].points,'Drag moves selection');
 assert.deepEqual(moved[0].points,before[0].points,'Other ink is unchanged');
 await page.locator('[data-action="annotation-undo"]').click();
 await page.waitForFunction(async(original)=>{
  const {getAnnotations}=await import('./db.js');const p=(await getAnnotations('W22.pdf')).pages['1'][1].points;
  return JSON.stringify(p)===JSON.stringify(original);
 },before[1].points);
 await tap(.25,.36);
 await page.locator('[data-action="annotation-delete-selected"]').click();
 assert.equal(await page.locator('.annotation-stroke').count(),5,'Only selected object is removed');
 await page.locator('[data-action="annotation-undo"]').click();
 assert.equal(await page.locator('.annotation-stroke').count(),6,'Undo recovers deleted object');
 await selectTool('eraser');
 await tap(.77,.73);
 assert.equal(await page.locator('.annotation-stroke').count(),5,'Eraser affects one shape');
 await page.locator('[data-action="annotation-undo"]').click();
 assert.equal(await page.locator('.annotation-stroke').count(),6,'Undo recovers erased shape');
 await page.locator('[data-action="viewer-annotate"]').last().click();
 const oldPath=await page.locator('.annotation-stroke').nth(1).getAttribute('d');
 await page.locator('[data-action="viewer-rotate"]').click();
 await page.waitForFunction(()=>document.querySelector('.annotation-stroke')?.getAttribute('d'));
 assert.equal(await page.locator('.annotation-stroke').count(),6);
 const rotatedPath=await page.locator('.annotation-stroke').nth(1).getAttribute('d');
 assert.notEqual(oldPath,rotatedPath,'Geometry projects correctly on rotation');
 await page.locator('[data-action="viewer-zoom-in"]').click();
 assert.equal(await page.locator('.annotation-stroke').count(),6);
 await page.locator('[data-action="viewer-page-next"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 2'));
 assert.equal(await page.locator('.annotation-stroke').count(),0,'Second PDF page has no shapes');
 await page.locator('[data-action="viewer-page-prev"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('1 / 2'));
 assert.equal(await page.locator('.annotation-stroke').count(),6,'Returning to first page preserves shapes');
 await page.locator('[data-action="viewer-close"]').click();
 await open();
 assert.equal(await page.locator('.annotation-stroke').count(),6,'Annotations persist after reopening');
 await page.locator('[data-action="viewer-close"]').click();
 await page.locator('.bottom-link[data-value="settings"]').click();
 await page.locator('[data-action="backup-create"]').click();
 await page.locator('.backup-ready').waitFor({timeout:25000});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="backup-save"]').click()]);
 const zipBuffer=await readFile(await download.path());
 const exported=await page.evaluate(async(base64)=>{
  const zip=await window.JSZip.loadAsync(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)));
  const manifest=JSON.parse(await zip.file('partitures-festeres-copia.json').async('string'));
  const item=Object.keys(zip.files).find(n=>n.startsWith('anotacions/')&&n.endsWith('.json'));
  return {manifest,ann:JSON.parse(await zip.file(item).async('string'))};
 },zipBuffer.toString('base64'));
 assert.equal(exported.manifest.schemaVersion,1,'Backup remains W2.1 compatible');
 assert.equal(exported.ann.pages['1'].length,6,'Backup contains all shapes and strokes');
 await page.locator('#restore-input').setInputFiles({name:'W22_backup.zip',mimeType:'application/zip',buffer:zipBuffer});
 await page.locator('[data-action="restore-replace"]').waitFor();
 await page.locator('[data-action="restore-replace"]').click();
 await page.locator('.restore-modal').waitFor({state:'detached'});
 await page.locator('.bottom-link[data-value="library"]').click();await open();
 assert.equal(await page.locator('.annotation-stroke').count(),6,'Restored shapes remain visible');
 const pdfUnchanged=await page.evaluate(async()=>{const {getScore}=await import('./db.js');return Array.from(new Uint8Array(await (await getScore('W22.pdf')).blob.arrayBuffer()));});
 assert.deepEqual(pdfUnchanged,Array.from(buffer),'PDF data is untouched');
 assert.deepEqual(errors,[],'No JS runtime errors');
 console.log('PASS W2.2: old annotation compatibility, widths, four shapes, selection, movement, eraser, undo, rotation, zoom, pages, ZIP restore');
 await context.close();
} finally{await browser.close();}
