import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {prepareViewerScoreItems,filterViewerScoreItems} from '../../viewer-score-picker-w2152.js';

const scores=[
 {path:'1er/Marxes/Biscains.pdf',metadata:{title:'Biscains d’Onil',composer:'Pere Àngel'}},
 {path:'1er/Pasdobles/CIMO.pdf',metadata:{title:'CIMO'}},
 {path:'2n/Marxes/Moros.pdf',metadata:{title:'Moros Músics'}}
];
const prepared=prepareViewerScoreItems(scores,s=>s.metadata?.title);
assert.equal(prepared[0].index,0);
assert.deepEqual(filterViewerScoreItems(prepared,'BISCAINS Onil').map(x=>x.index),[0]);
assert.deepEqual(filterViewerScoreItems(prepared,'PERE angel').map(x=>x.index),[0]);
assert.deepEqual(filterViewerScoreItems(prepared,'2n Moros').map(x=>x.index),[2]);
assert.deepEqual(filterViewerScoreItems(prepared,'zzzz'),[]);
assert.deepEqual(filterViewerScoreItems(prepared,'').map(x=>x.path),scores.map(x=>x.path));

const options={headless:true,args:['--no-sandbox']};
if(process.env.PF_CHROMIUM_PATH)options.executablePath=process.env.PF_CHROMIUM_PATH;
const browser=await chromium.launch(options);
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();

 const paths=['1er/Marxes/A.pdf','1er/Marxes/B.pdf','1er/Marxes/C.pdf'];
 await page.evaluate(async paths=>{
  const {saveBatch,setPref,setAnnotations}=await import('./db.js');
  const {assembleScanPdf}=await import('./scanner-pdf-w2133.js');
  const c=document.createElement('canvas');c.width=250;c.height=375;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle='#222';ctx.font='bold 22px Georgia';ctx.fillText('Banda de festes',20,45);
  for(let i=0;i<12;i++)ctx.fillRect(15,85+i*21,220,2);
  const jpeg=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.85));
  const image={bytes:new Uint8Array(await jpeg.arrayBuffer()),width:c.width,height:c.height};
  const a=assembleScanPdf([image,image]),b=assembleScanPdf([image,image,image]),d=assembleScanPdf([image]);
  const now=Date.now();
  await saveBatch([
   {path:paths[0],blob:a,size:a.size,added:now,metadata:{title:'Marxa del Bosc'}},
   {path:paths[1],blob:b,size:b.size,added:now+1,metadata:{title:'Biscains d’Onil',composer:'Àngel Mas'}},
   {path:paths[2],blob:d,size:d.size,added:now+2,metadata:{title:'Moros Músics'}}
  ]);
  await setPref('w13:repertoires',[{id:'rep_concert',name:'Concert de Festes',paths}]);
  await setPref('viewer:'+paths[1],{page:3,zoom:1.45});
  await setAnnotations(paths[0],{version:1,pages:{1:[{tool:'pen',color:'#b51f34',
   width:.01,points:[[.1,.2],[.3,.4]]}]}});
 },paths);
 await page.reload();
 await page.locator('.bottom-link[data-value="repertoires"]').click();
 await page.locator('.rep-entry[data-id="rep_concert"]').click();
 await page.locator('[data-action="rep-start"]').click();
 const stage=page.locator('#viewer-stage');
 await page.waitForFunction(path=>document.querySelector('#viewer-stage')?.dataset.path===path&&
   document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 2')&&
   document.querySelector('#viewer-stage canvas')?.width>0,
  paths[0],{timeout:20000});
 await page.evaluate(()=>window.__pickerInitialCanvas=document.querySelector('#viewer-stage canvas'));
 // La barra mòbil permet tocar el recompte per a obrir la cerca.
 const shortcut=page.locator('.pf-viewer-score-picker-shortcut');
 assert.equal(await shortcut.count(),1);
 await shortcut.evaluate(button=>button.click());
 const modal=page.locator('.pf-score-picker-panel');
 await modal.waitFor();
 assert.equal(await page.locator('.pf-score-picker-item').count(),3);
 assert.deepEqual(await page.locator('.pf-score-picker-index').allInnerTexts(),['1','2','3']);
 assert.equal(await page.locator('.pf-score-picker-current').getAttribute('aria-selected'),'true');
 assert.match(await page.locator('.pf-score-picker-current').innerText(),/Marxa del Bosc/);
 assert.equal(await page.evaluate(()=>history.state?.pfwebScorePicker===true),true,
  'Enrere del mòbil tanca només el selector');
 const input=page.locator('#pf-score-picker-input');
 await input.fill('biscains');
 assert.equal(await page.locator('.pf-score-picker-item').count(),1,'Cerca accent-insensible');
 assert.equal(await page.locator('.pf-score-picker-index').innerText(),'2','Índex original conservat');
 assert.match(await page.locator('.pf-score-picker-details strong').innerText(),/Biscains/);
 assert.equal(await page.evaluate(()=>document.querySelector('#viewer-stage canvas')===window.__pickerInitialCanvas),
  true,'Buscar no reconstrueix el canvas PDF');
 await input.fill('MAS');
 assert.equal(await page.locator('.pf-score-picker-item').count(),1,'Cerca per compositor');
 await input.fill('ZZZZ');
 assert.equal(await page.locator('.pf-score-picker-item').count(),0);
 assert.match(await page.locator('.pf-score-picker-empty').innerText(),/No s’han trobat/);
 await page.locator('[data-picker-action="clear"]').click();
 assert.equal(await page.locator('.pf-score-picker-item').count(),3);
 assert.equal(await input.inputValue(),'');
 // Escape restaura el PDF i la pàgina sense perdre les anotacions.
 await input.fill('Onil');
 await page.keyboard.press('Escape');
 await modal.waitFor({state:'detached'});
 assert.equal(await stage.getAttribute('data-path'),paths[0]);
 assert.match(await page.locator('#viewer-page-counter').innerText(),/1 \/ 2/);
 await page.waitForFunction(()=>!history.state?.pfwebScorePicker);
 await shortcut.evaluate(button=>button.click());
 await modal.waitFor();
 await page.goBack();
 await modal.waitFor({state:'detached'});
 assert.equal(await stage.getAttribute('data-path'),paths[0],
  'Enrere de PWA no tanca el visor');
 assert.equal(await page.locator('.viewer').count(),1);
 // Buscar i saltar a una altra obra del repertori: sempre pàgina 1.
 await shortcut.evaluate(button=>button.click());
 await modal.waitFor();
 await page.locator('#pf-score-picker-input').fill('Biscains');
 await page.locator('.pf-score-picker-item').click();
 await modal.waitFor({state:'detached'});
 await page.waitForFunction(path=>document.querySelector('#viewer-stage')?.dataset.path===path &&
  document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 3'),paths[1],
  {timeout:20000});
 assert.match(await page.locator('.pf-performance-progress').innerText(),/Concert de Festes/);
 assert.match(await page.locator('.pf-performance-progress').innerText(),/2 \/ 3/);
 assert.equal(await page.evaluate(async path=>{
   const {getAnnotations}=await import('./db.js');return (await getAnnotations(path)).pages[1]?.length||0;
  },paths[0]),1,'No es perden les anotacions del document anterior');
 // El salt no canvia l'ordre ni desactiva la circularitat.
 const list=await page.evaluate(async()=>{
  const {getPref}=await import('./db.js');return (await getPref('w13:repertoires'))[0].paths;
 });
 assert.deepEqual(list,paths);
 await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(path=>document.querySelector('#viewer-stage')?.dataset.path===path &&
  document.querySelector('#viewer-page-counter')?.textContent?.includes('2 / 2'),paths[0],
  {timeout:20000});
 // El botó del selector marca la partitura actual després del salt.
 await shortcut.evaluate(button=>button.click());
 await modal.waitFor();
 assert.match(await page.locator('.pf-score-picker-current').innerText(),/Marxa del Bosc/);
 await page.locator('[data-picker-action="close"]').click();
 await modal.waitFor({state:'detached'});
 await page.locator('[data-action="viewer-close"]').evaluate(button=>button.click());
 await page.locator('.viewer').waitFor({state:'detached'});
 // Reobrir des de recents: sense sessió d'actuació, però amb selector igual.
 await page.locator('.bottom-link[data-value="recents"]').click();
 await page.locator('.score-row [data-action="open"][data-value="'+paths[1]+'"]').click();
 await page.waitForFunction(path=>document.querySelector('#viewer-stage')?.dataset.path===path,
  paths[1],{timeout:20000});
 await page.locator('.pf-viewer-score-picker-shortcut').evaluate(button=>button.click());
 await modal.waitFor();
 assert((await page.locator('.pf-score-picker-item').count())>=2);
 assert.equal(await page.locator('.pf-score-picker-heading p').count(),0,
  'Sense repertori no es mostra un nom fals d’actuació');
 await page.locator('[data-picker-action="close"]').click();
 await page.locator('[data-action="viewer-close"]').evaluate(button=>button.click());
 assert.equal(errors.length,0,'Excepcions JS: '+errors.join('\n'));
 console.log('PASS W2.15.2: busca accent-insensible, ordinal, focus, Enrere, salt pàgina 1, anotacions, repertori circular i PDF immutable');
 await context.close();
}finally{await browser.close();}
