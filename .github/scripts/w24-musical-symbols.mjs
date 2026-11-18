import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {emptyAnnotations,normalizeAnnotations} from '../../annotations.js';
import {hitTestStroke,translatedStroke} from '../../annotation-geometry.js';
import {MUSICAL_SYMBOLS,SYMBOL_GROUPS,SYMBOL_SIZES,isMusicalSymbol,musicalSymbolBounds,musicalSymbolIcon} from '../../musical-symbols.js';

const base={tool:'symbol',symbolId:'eighth',points:[[.22,.28]],width:.0055,color:'#242424',fontSize:.07,opacity:1};
assert.equal(Object.keys(MUSICAL_SYMBOLS).length,32,'Music stamp catalog covers five musical groups');
assert.deepEqual(SYMBOL_GROUPS.map(g=>g.id),['notes','rests','signs','dynamics','tempo']);
assert.equal(isMusicalSymbol('quarter'),true);
assert.equal(isMusicalSymbol('__proto__'),false);
assert.equal(isMusicalSymbol('<script>'),false);
assert.deepEqual(normalizeAnnotations({version:1,pages:{1:[base]}}).pages['1'][0],base);
const old={tool:'pen',color:'#b51f34',width:.0055,points:[[.3,.3],[.4,.4]]};
assert.deepEqual(normalizeAnnotations({version:1,pages:{1:[old,base]}}).pages['1'][0],old,'Old annotations are not changed');
assert.deepEqual(normalizeAnnotations(null),emptyAnnotations());
for(const invalid of [
 {...base,symbolId:'unknown'}, {...base,symbolId:'<script>alert(1)</script>'},
 {...base,fontSize:0}, {...base,fontSize:.8}, {...base,opacity:0},
 {...base,points:[[.2,.3],[.4,.6]]}, {...base,color:'javascript:alert(1)'}
])assert.throws(()=>normalizeAnnotations({version:1,pages:{1:[invalid]}}),'Reject invalid stamp data');
assert.equal(musicalSymbolBounds(base,400,600).height,.07*400);
assert.equal(hitTestStroke([base],[.23,.3],400,600),0,'Musical stamp is selectable');
assert.equal(hitTestStroke([base],[.05,.8],400,600),-1);
assert.deepEqual(translatedStroke(base,.11,.05).points,[[.33,.33]]);
assert.match(musicalSymbolIcon('eighth'),/viewBox=/);
assert.equal(musicalSymbolIcon('<script>'),'','Only whitelisted SVG can be previewed');

function pdf(){
 const content='BT /F1 25 Tf 70 680 Td (PARTITURA MUSICAL W24) Tj ET';
 const objs=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
  '<</Length '+content.length+'>>\nstream\n'+content+'\nendstream',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>'];
 let s='%PDF-1.4\n';const offsets=[];
 for(let i=0;i<objs.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+objs[i]+'\nendobj\n';}
 const start=s.length;s+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
 for(const n of offsets)s+=String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(objs.length+1)+'>>\nstartxref\n'+start+'\n%%EOF\n','ascii');
}
const originalPdf=pdf();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 await page.locator('.bottom-link[data-value="settings"]').click();
 assert.match(await page.locator('main.content').innerText(),/Partitures Festeres Web — W2\.12\.1/);
 await page.locator('.bottom-link[data-value="library"]').click();
 await page.locator('#import-input').setInputFiles({name:'MUSIC_W24.pdf',mimeType:'application/pdf',buffer:originalPdf});
 await page.locator('[data-action="open"][data-value="MUSIC_W24.pdf"]').waitFor();
 const saved=async()=>page.evaluate(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('MUSIC_W24.pdf')).pages['1']||[];
 });
 const stageClick=async()=>page.locator('#viewer-stage').click({position:{x:310,y:230}});
 const layerPoint=async(x,y)=>{
  const r=await page.locator('.viewer-annotation-layer').boundingBox();
  assert(r?.width>50&&r?.height>50,'PDF overlay is mounted');
  return {x:r.x+r.width*x,y:r.y+r.height*y};
 };
 const tap=async(x,y)=>{const p=await layerPoint(x,y);await page.mouse.click(p.x,p.y);};
 const drag=async(x,y,x2,y2)=>{
  const a=await layerPoint(x,y),b=await layerPoint(x2,y2);
  await page.mouse.move(a.x,a.y);
  await page.mouse.down();
  await page.mouse.move(b.x,b.y,{steps:12});
  await page.mouse.up();
 };
 const select=async id=>{
  await page.locator('[data-action="annotation-group"][data-value="symbols"]').click();
  await page.locator('[data-action="annotation-symbol-picker"]').click();
  await page.locator('.annotation-symbol-modal').waitFor();
  const group=MUSICAL_SYMBOLS[id].group;
  await page.locator('[data-action="annotation-symbol-group"][data-value="'+group+'"]').click();
  await page.locator('[data-action="annotation-symbol-pick"][data-value="'+id+'"]').click();
  await page.locator('.annotation-symbol-modal').waitFor({state:'detached'});
 };
 await page.locator('[data-action="open"][data-value="MUSIC_W24.pdf"]').click();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 await stageClick();
 await page.locator('[data-action="viewer-annotate"]').first().click();
 await page.locator('[data-action="rosette-legacy"]').click();
 await page.locator('.w23-annotation-toolbar').waitFor();
 assert.equal(await page.locator('.annotation-rosette .annotation-petal').count(),4,'Four annotation rosette groups');
 await select('eighth');
 await page.locator('#annotation-symbol-size').selectOption('0.09');
 await page.locator('[data-action="annotation-color"][data-value="#1b58a7"]').click();
 await tap(.22,.28);
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('MUSIC_W24.pdf')).pages['1']?.length===1;
 });
 let records=await saved();
 assert.equal(records[0].tool,'symbol');
 assert.equal(records[0].symbolId,'eighth');
 assert.equal(records[0].color,'#1b58a7');
 assert.equal(records[0].fontSize,.09);
 assert.equal(await page.locator('.annotation-symbol').count(),1,'Vector symbol is drawn on PDF');
 assert.equal(await page.locator('.annotation-symbol[data-symbol-id="eighth"] ellipse').count(),1);
 // All five categories, placed on the same PDF without changing original bytes.
 const placements=[
  ['restEighth',.42,.28],['sharp',.55,.28],
  ['mf',.27,.55],['rit',.55,.55]
 ];
 for(const [id,x,y] of placements){
  await select(id);
  await tap(x,y);
 }
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('MUSIC_W24.pdf')).pages['1']?.length===5;
 });
 records=await saved();
 assert.deepEqual(records.map(r=>r.symbolId),['eighth','restEighth','sharp','mf','rit']);
 assert.equal(await page.locator('.annotation-symbol').count(),5);
 // Selection, move, undo, erase and undo again.
 await page.locator('[data-action="annotation-group"][data-value="edit"]').click();
 await page.locator('[data-action="annotation-tool"][data-value="select"]').click();
 await tap(.235,.295);
 assert.equal(await page.locator('.annotation-selection').count(),1,'Symbols show selection outline');
 const before=(await saved())[0].points[0];
 await drag(.235,.295,.32,.36);
 await page.waitForFunction(async before=>{
  const {getAnnotations}=await import('./db.js');
  const p=(await getAnnotations('MUSIC_W24.pdf')).pages['1']?.[0]?.points?.[0];
  return p&&JSON.stringify(p)!==JSON.stringify(before);
 },before);
 assert.notDeepEqual((await saved())[0].points[0],before,'Moving a symbol updates its position');
 await page.locator('[data-action="annotation-undo"]').click();
 assert.deepEqual((await saved())[0].points[0],before,'Undo restores the symbol position');
 await page.locator('[data-action="annotation-tool"][data-value="eraser"]').click();
 await tap(.235,.295);
 assert.equal(await page.locator('.annotation-symbol').count(),4,'Eraser removes precisely one musical stamp');
 await page.locator('[data-action="annotation-undo"]').click();
 assert.equal(await page.locator('.annotation-symbol').count(),5,'Undo restores erased symbol');
 await page.locator('[data-action="viewer-annotate"]').last().click();
 await page.locator('[data-action="viewer-rotate"]').click();
 assert.equal(await page.locator('.annotation-symbol').count(),5,'Symbols survive a manual PDF rotation');
 assert.equal(await page.locator('.annotation-symbol').first().evaluate(el=>el.getAttribute('transform').includes('rotate(')),false,'Noteheads remain upright after PDF viewport rotation');
 await page.locator('[data-action="viewer-zoom-in"]').click();
 assert.equal(await page.locator('.annotation-symbol').count(),5,'Symbols survive zoom');
 await page.locator('[data-action="viewer-page-next"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 2'));
 assert.equal(await page.locator('.annotation-symbol').count(),0,'Symbols remain on their own page');
 await page.locator('[data-action="viewer-page-prev"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('1 / 2'));
 assert.equal(await page.locator('.annotation-symbol').count(),5);
 await page.reload();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 assert.equal(await page.locator('.annotation-symbol').count(),5,'Musical stamps persist across reload');
 await stageClick();
 await page.locator('[data-action="viewer-close"]').click();
 // Roundtrip through existing ZIP export and import.
 await page.locator('.bottom-link[data-value="settings"]').click();
 await page.locator('[data-action="backup-create"]').click();
 await page.locator('.backup-ready').waitFor({timeout:25000});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="backup-save"]').click()]);
 const exported=await readFile(await download.path());
 const parsed=await page.evaluate(async base64=>{
  const zip=await window.JSZip.loadAsync(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)));
  const path=Object.keys(zip.files).find(p=>p.startsWith('anotacions/')&&p.endsWith('.json'));
  const annotations=JSON.parse(await zip.file(path).async('string'));
  const manifest=JSON.parse(await zip.file('partitures-festeres-copia.json').async('string'));
  return {manifest,annotations};
 },exported.toString('base64'));
 assert.equal(parsed.manifest.schemaVersion,1,'ZIP schema unchanged');
 assert.equal(parsed.annotations.pages['1'].length,5);
 assert.deepEqual(parsed.annotations.pages['1'].map(a=>a.symbolId),['eighth','restEighth','sharp','mf','rit']);
 await page.locator('#restore-input').setInputFiles({name:'w24-backup.zip',mimeType:'application/zip',buffer:exported});
 await page.locator('[data-action="restore-replace"]').waitFor();
 await page.locator('[data-action="restore-replace"]').click();
 await page.locator('.restore-modal').waitFor({state:'detached'});
 await page.locator('.bottom-link[data-value="library"]').click();
 await page.locator('[data-action="open"][data-value="MUSIC_W24.pdf"]').click();
 await page.locator('.viewer-canvas').waitFor();
 assert.equal(await page.locator('.annotation-symbol').count(),5,'ZIP restore preserves symbols');
 const bytes=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');
  return Array.from(new Uint8Array(await (await getScore('MUSIC_W24.pdf')).blob.arrayBuffer()));
 });
 assert.deepEqual(bytes,Array.from(originalPdf),'Original PDF bytes are unchanged');
 assert.deepEqual(errors,[],'No JS errors');
 console.log('PASS W2.4: music catalog, validation, stamps, five categories, select, move, undo, eraser, rotation, zoom, reload and ZIP roundtrip');
 await context.close();
}finally{await browser.close();}
