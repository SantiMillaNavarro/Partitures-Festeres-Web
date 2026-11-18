import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {DEFAULT_PAGE_ADJUSTMENT,normalizePageAdjustment,normalizePageAdjustments,
 displayedCropMargins,originalCropMargins,updatedPageAdjustments} from '../../page-adjustments-w218.js';

assert.deepEqual(normalizePageAdjustment(),DEFAULT_PAGE_ADJUSTMENT);
assert.equal(normalizePageAdjustment({rotationQuarterTurns:-1}).rotationQuarterTurns,3);
assert.equal(normalizePageAdjustment({cropLeft:.8}).cropLeft,.35);
assert.equal(normalizePageAdjustment({contrast:9}).contrast,1.7);
for(const rotation of [0,90,180,270]){
 const original={cropLeft:.1,cropTop:.2,cropRight:.3,cropBottom:.15,contrast:1.2};
 const mapped=displayedCropMargins(original,rotation);
 const back=originalCropMargins(mapped,rotation);
 for(const key of ['cropLeft','cropTop','cropRight','cropBottom'])assert.equal(back[key],original[key]);
}
assert.deepEqual(normalizePageAdjustments({'1':DEFAULT_PAGE_ADJUSTMENT,'2':{cropLeft:.1}}),{'2':normalizePageAdjustment({cropLeft:.1})});
assert.equal(Object.keys(updatedPageAdjustments({},1,{contrast:1.2},2,true)).length,2);

const opts={headless:true,args:['--no-sandbox']};
if(process.env.PF_CHROMIUM_PATH)opts.executablePath=process.env.PF_CHROMIUM_PATH;
const browser=await chromium.launch(opts);
try{
 const context=await browser.newContext({viewport:{width:430,height:900},hasTouch:true,isMobile:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();
 await page.evaluate(async()=>{
  const {saveBatch}=await import('./db.js');
  const {assembleScanPdf}=await import('./scanner-pdf-w2133.js');
  const c=document.createElement('canvas');c.width=500;c.height=690;
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,500,690);
  ctx.fillStyle='#222';ctx.font='bold 26px serif';ctx.fillText('Partitura de prova',20,65);
  for(let i=0;i<21;i++)ctx.fillRect(25,90+i*22,450,2);
  const jpg=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.9));
  const image={bytes:new Uint8Array(await jpg.arrayBuffer()),width:500,height:690};
  const pdf=assembleScanPdf([image,image]);
  await saveBatch([{path:'W218-Prova.pdf',blob:pdf,size:pdf.size,added:Date.now()}]);
 });
 await page.reload();
 await page.locator('.bottom-link[data-value="library"]').click();
 await page.locator('[data-action="open"][data-value="W218-Prova.pdf"]').click();
 const canvas=page.locator('#viewer-stage .viewer-canvas');
 await canvas.waitFor({timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 2'),null,{timeout:20000});
 const openDialog=async()=>page.locator('[data-action="viewer-repair-open"]').evaluate(el=>el.click());
 await openDialog();
 const dialog=page.locator('.pf-repair-dialog');
 await dialog.waitFor({timeout:6000});
 const change=async(selector,value)=>page.locator(selector).evaluate((el,val)=>{
  el.value=String(val);el.dispatchEvent(new Event('input',{bubbles:true}));
 },value);
 await change('[data-repair-edge="left"]','20');
 await change('[data-repair-contrast]','140');
 assert.equal(await page.locator('[data-output-edge="left"]').innerText(),'20%');
 await page.locator('[data-repair-action="page"]').click();
 await dialog.waitFor({state:'detached'});
 const prefs=await page.evaluate(async()=>{const {getPref}=await import('./db.js');return getPref('w218:page:W218-Prova.pdf');});
 assert.equal(prefs['1'].cropLeft,.2);
 assert.equal(prefs['1'].contrast,1.4);
 assert(!prefs['2']);
 await page.waitForFunction(()=>{
  const c=document.querySelector('.viewer-canvas'),s=document.querySelector('.viewer-sheet'),a=document.querySelector('.viewer-annotation-layer');
  return c&&s&&a&&c.clientWidth>s.clientWidth&&c.style.left===a.style.left&&c.style.filter.includes('1.4');
 },null,{timeout:12000});
 await page.locator('[data-action="viewer-page-next"]').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent?.includes('2 / 2'),null,{timeout:12000});
 await page.waitForFunction(()=>document.querySelector('.viewer-canvas')?.style.filter==='contrast(1)',null,{timeout:12000});
 await page.locator('[data-action="viewer-page-prev"]').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 2'),null,{timeout:12000});
 await openDialog();
 await page.locator('[data-repair-action="right"]').click();
 await page.locator('[data-repair-action="all"]').click();
 await dialog.waitFor({state:'detached'});
 await page.waitForFunction(async()=>{
  const {getPref}=await import('./db.js');const map=await getPref('w218:page:W218-Prova.pdf');
  return map?.['2']?.contrast===1.4&&map?.['2']?.cropLeft===.2&&map?.['1']?.rotationQuarterTurns===1;
 },null,{timeout:12000});
 await page.locator('[data-action="viewer-close"]').evaluate(el=>el.click());
 await page.locator('.pf-reading-mode').waitFor({state:'detached'});
 await page.locator('[data-action="open"][data-value="W218-Prova.pdf"]').click();
 await canvas.waitFor({timeout:20000});
 await page.waitForFunction(()=>document.querySelector('.viewer-canvas')?.style.filter==='contrast(1.4)',null,{timeout:20000});
 assert.deepEqual(errors,[],'Excepcions JS: '+errors.join('\n'));
 console.log('PASS W2.18: model de marge i rotació, retall gràfic, persistència per full, tot el PDF i visor reobert');
 await context.close();
}finally{await browser.close();}
