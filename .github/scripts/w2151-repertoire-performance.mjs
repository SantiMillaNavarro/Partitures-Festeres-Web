import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {nextRepertoireCopyName,duplicatedRepertoire,buildPerformanceSession,performanceStep,performancePosition}
 from '../../repertoire-performance-w2151.js';

// Mateixa semàntica de duplicació i sessions que PartituresFesteresApp.kt i PdfViewerActivity.kt.
assert.equal(nextRepertoireCopyName('Concert',[]),'Concert (còpia)');
assert.equal(nextRepertoireCopyName('Concert',['concert (CÒPIA)']),'Concert (còpia 2)');
assert.equal(nextRepertoireCopyName('Concert',['Concert (còpia)','Concert (còpia 2)']),'Concert (còpia 3)');
assert.equal(nextRepertoireCopyName('C'.repeat(59),[]).length,60);
assert.throws(()=>nextRepertoireCopyName(''));
const original={id:'rep_old',name:'Assaig',paths:['A.pdf','B.pdf']};
const copy=duplicatedRepertoire(original,[original],{id:'rep_new'});
assert.deepEqual(copy,{id:'rep_new',name:'Assaig (còpia)',paths:['A.pdf','B.pdf']});
copy.paths.reverse();
assert.deepEqual(original.paths,['A.pdf','B.pdf'],'La còpia no reordena el repertori original');
const session=buildPerformanceSession(original,new Set(['A.pdf','B.pdf']),'B.pdf');
assert.deepEqual(session.paths,['A.pdf','B.pdf']);
assert.deepEqual(performancePosition(session,'B.pdf'),{index:1,total:2});
assert.deepEqual(performanceStep(session,'B.pdf',1),{path:'A.pdf',start:'first',wrapped:true});
assert.deepEqual(performanceStep(session,'B.pdf',-1),{path:'A.pdf',start:'last',wrapped:false});
assert.equal(performanceStep(session,'A.pdf',-1),null,'No es retrocedeix circularment');
assert.equal(buildPerformanceSession(original,new Set(['X.pdf'])),null);
assert.equal(buildPerformanceSession(original,new Set(['B.pdf']),'A.pdf').current,'B.pdf');

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();
 // Dos documents reals amb 2 i 3 pàgines: proves de límits i de pàgina anterior.
 await page.evaluate(async()=>{
  const {saveBatch,setPref}=await import('./db.js');
  const {assembleScanPdf}=await import('./scanner-pdf-w2133.js');
  const c=document.createElement('canvas');c.width=260;c.height=365;
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,260,365);
  ctx.fillStyle='#111';ctx.font='20px serif';ctx.fillText('Partitura Fester',20,45);
  for(let i=0;i<8;i++)ctx.fillRect(30,80+i*26,195,2);
  const jpeg=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.85));
  const image={bytes:new Uint8Array(await jpeg.arrayBuffer()),width:260,height:365};
  const a=assembleScanPdf([image,image]),b=assembleScanPdf([image,image,image]);
  const date=Date.now();
  await saveBatch([{path:'A.pdf',size:a.size,blob:a,added:date},{path:'B.pdf',size:b.size,blob:b,added:date+1}]);
  await setPref('viewer:A.pdf',{page:2,zoom:1.5});
  await setPref('w13:repertoires',[{id:'rep_concert',name:'Concert de Festes',paths:['A.pdf','B.pdf']}]);
 });
 await page.reload();
 await page.locator('.bottom-link[data-value="repertoires"]').click();
 await page.locator('.rep-entry[data-id="rep_concert"]').click();
 assert.equal(await page.locator('.rep-head h3').innerText(),'Concert de Festes');
 const originalOrder=await page.evaluate(async()=>{
  const {getPref}=await import('./db.js');
  return (await getPref('w13:repertoires'))[0].paths;
 });
 assert.deepEqual(originalOrder,['A.pdf','B.pdf']);
 // Duplicar dins del repertori, després tornar i duplicar des de la llista.
 await page.locator('.rep-head [data-action="rep-duplicate"]').click();
 assert.equal(await page.locator('.rep-head h3').innerText(),'Concert de Festes (còpia)');
 const copyOrder=await page.evaluate(async()=>{
  const {getPref}=await import('./db.js');
  return await getPref('w13:repertoires');
 });
 assert.equal(copyOrder.length,2);
 assert.deepEqual(copyOrder[0].paths,['A.pdf','B.pdf']);
 assert.deepEqual(copyOrder[1].paths,['A.pdf','B.pdf']);
 assert.notEqual(copyOrder[0].id,copyOrder[1].id);
 await page.locator('.rep-head [data-action="rep-duplicate"]').click();
 assert.equal(await page.locator('.rep-head h3').innerText(),'Concert de Festes (còpia) (còpia)');
 await page.locator('[data-action="rep-back"]').click();
 await page.locator('.pf-rep-choice [data-action="rep-duplicate"][data-id="rep_concert"]').click();
 assert.equal(await page.locator('.rep-head h3').innerText(),'Concert de Festes (còpia 2)');
 const copyId=await page.locator('.rep-head [data-action="rep-start"]').getAttribute('data-id');
 assert(copyId.startsWith('rep_'));
 await page.locator('[data-action="rep-up"][data-value="B.pdf"]').click();
 const afterReorder=await page.evaluate(async()=>{
  const {getPref}=await import('./db.js');
  return await getPref('w13:repertoires');
 });
 assert.deepEqual(afterReorder.find(x=>x.id==='rep_concert').paths,['A.pdf','B.pdf'],'Original immòbil');
 assert.deepEqual(afterReorder.find(x=>x.id===copyId).paths,['B.pdf','A.pdf'],'Còpia independent');
 await page.reload();
 assert.equal(await page.locator('.rep-head h3').innerText(),'Concert de Festes (còpia 2)');
 // Iniciar des del repertori ORIGINAL (A,B) i comprovar primera pàgina sempre.
 await page.locator('[data-action="rep-back"]').click();
 await page.locator('.rep-entry[data-id="rep_concert"]').click();
 await page.locator('.rep-head [data-action="rep-start"]').click();
 const stage=page.locator('#viewer-stage');
 await stage.waitFor({timeout:20000});
 const counter=page.locator('#viewer-page-counter');
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 2'),null,{timeout:20000});
 assert.match(await page.locator('.pf-performance-progress').innerText(),/Concert de Festes/);
 const press=async(expectedFile,expectedPage)=>{
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(([file,pages])=>{
   const stage=document.querySelector('#viewer-stage');
   const info=document.querySelector('#viewer-page-counter')?.textContent;
   return stage?.dataset.path===file&&info?.includes(pages)&&!!stage.querySelector('canvas');
  },[expectedFile,expectedPage],{timeout:20000});
 };
 await press('A.pdf','2 / 2');
 await press('B.pdf','1 / 3');
 await press('B.pdf','2 / 3');
 await press('B.pdf','3 / 3');
 assert.equal(await page.locator('[data-action="viewer-next"]').isEnabled(),true,
  'En l’última obra del repertori, Següent no es desactiva');
 await press('A.pdf','1 / 2');
 assert.equal(await page.locator('[data-action="viewer-prev"]').isDisabled(),true,
  'No hi ha volta circular cap arrere');
 await page.keyboard.press('ArrowLeft');
 await page.waitForTimeout(200);
 assert.equal(await stage.getAttribute('data-path'),'A.pdf');
 assert.match(await counter.innerText(),/1 \/ 2/);
 // Tornar endavant i després anar enrere des de la primera pàgina de B;
 // Android obri l’última pàgina de la partitura A.
 await press('A.pdf','2 / 2');
 await press('B.pdf','1 / 3');
 await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(()=>{
  const stage=document.querySelector('#viewer-stage');
  return stage?.dataset.path==='A.pdf'&&document.querySelector('#viewer-page-counter')?.textContent?.includes('2 / 2');
 },null,{timeout:20000});
 await page.locator('[data-action="viewer-close"]').evaluate(button=>button.click());
 await page.locator('.viewer').waitFor({state:'detached',timeout:20000});
 // Començar tocant directament la segona obra també entra en mode actuació.
 await page.locator('.score-row [data-action="open"][data-value="B.pdf"]').click();
 await page.waitForFunction(()=>{
  return document.querySelector('#viewer-stage')?.dataset.path==='B.pdf'&&
   document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 3');
 },null,{timeout:20000});
 assert.match(await page.locator('.pf-performance-progress').innerText(),/Concert de Festes/);
 await page.locator('[data-action="viewer-close"]').evaluate(button=>button.click());
 await page.locator('.viewer').waitFor({state:'detached',timeout:20000});
 // La biblioteca normal continua sense avance circular.
 await page.locator('.bottom-link[data-value="library"]').click();
 await page.locator('[data-action="open"][data-value="B.pdf"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-stage')?.dataset.path==='B.pdf',null,{timeout:20000});
 assert.equal(await page.locator('[data-action="viewer-next"]').isDisabled(),true,
  'En Biblioteca no s’activa el bucle de repertori');
 await page.locator('[data-action="viewer-close"]').evaluate(button=>button.click());
 assert.equal(errors.length,0,'Errors de navegació: '+JSON.stringify(errors));
 console.log('PASS W2.15.1: còpies úniques, ordenació independent, inici en pàgina 1, avanç circular i retrocés a última pàgina; PDFs reals');
 await context.close();
}finally{await browser.close();}
