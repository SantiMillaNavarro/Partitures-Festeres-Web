import assert from 'node:assert/strict';
import {chromium} from 'playwright';

function pdf(){
 const body='BT /F1 24 Tf 70 680 Td (ORIENTATION TEST PDF) Tj ET';
 const objects=[
 '<</Type/Catalog/Pages 2 0 R>>',
 '<</Type/Pages/Kids[3 0 R]/Count 1>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
 '<</Length '+body.length+'>>\nstream\n'+body+'\nendstream',
 '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'
 ];
 let s='%PDF-1.4\n',off=[];
 for(let i=0;i<objects.length;i++){off.push(s.length);s+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const start=s.length;s+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const n of off)s+=String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(objects.length+1)+'>>\nstartxref\n'+start+'\n%%EOF\n');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const url='http://127.0.0.1:8765/';
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
 // iOS / navegador sense bloqueig: CSS fallback, una sola font d'orientació.
 await context.addInitScript(()=>{
  window.__locks=[];
  if(screen.orientation)try{
   Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async orientation=>{
    window.__locks.push(orientation);throw new DOMException('Not supported','NotSupportedError');
   }});
  }catch{}
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 await page.locator('#import-input').setInputFiles({name:'ROTATION.pdf',mimeType:'application/pdf',buffer:pdf()});
 await page.locator('[data-action="open"][data-value="ROTATION.pdf"]').waitFor({timeout:15000});
 await page.locator('[data-action="open"][data-value="ROTATION.pdf"]').click();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 await page.waitForFunction(()=>document.querySelector('.pf-reading-mode')?.classList.contains('landscape-css-fallback'));
 const dimensions=()=>page.evaluate(()=>{
  const viewer=document.querySelector('.pf-reading-mode'),stage=document.querySelector('#viewer-stage'),
   canvas=document.querySelector('.viewer-canvas');
  return {width:Math.round(stage.clientWidth),height:Math.round(stage.clientHeight),
   cssFallback:viewer.classList.contains('landscape-css-fallback'),
   transform:getComputedStyle(viewer).transform,canvasW:canvas?.clientWidth,canvasH:canvas?.clientHeight};
 });
 let portrait=await dimensions();
 assert.match(portrait.transform,/matrix\(/);
 assert(portrait.width>portrait.height,'Portrait screen uses full landscape viewport');
 assert(portrait.canvasW>0);
 // Simulate rapid back-and-forth physical rotations.
 for(const [w,h] of [[844,390],[420,820],[820,420],[390,844],[844,390],[390,844]]){
  await page.setViewportSize({width:w,height:h});
  assert.equal(await page.locator('.pf-reading-mode').count(),1,'Rotating does not close viewer');
  const orient=await dimensions();
  assert.equal(orient.cssFallback,true);
  if(w>h){
   assert.equal(orient.transform,'none','Native landscape never applies duplicate rotation');
  }else assert.match(orient.transform,/matrix\(/,'Portrait fallback rotates viewer');
 }
 await page.waitForTimeout(750);
 const settled=await dimensions();
 assert.equal(await page.locator('.viewer-canvas').count(),1,'One readable canvas survives repeated rotations');
 assert(settled.canvasW>80&&settled.canvasH>80);
 assert.equal(await page.locator('#viewer-stage').getAttribute('data-path'),'ROTATION.pdf');
 assert.deepEqual(errors,[],'No errors on repeated orientation change');
 // A pull-to-refresh / browser reload keeps current PDF and page.
 await page.evaluate(async()=>{
  const {ScoreViewer}=await import('./viewer-w241.js');
  const original=ScoreViewer.prototype.close;
  ScoreViewer.prototype.close=function(...args){sessionStorage.setItem('w233:viewerClosed','true');return original.apply(this,args);};
 });
 await page.reload();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('w233:viewerClosed')),'true',
  'pagehide cancels the previous PDF engine, timers and event listeners before reload');
 assert.equal(await page.locator('#viewer-stage').getAttribute('data-path'),'ROTATION.pdf',
  'Explicit reload preserves currently viewed score');
 // A new app navigation is not a reload. It reuses the library, but not the PDF engine.
 await page.goto(url+'?new-launch=1',{waitUntil:'domcontentloaded'});
 await page.locator('.bottom-link.selected[data-value="library"]').waitFor({timeout:15000});
 assert.equal(await page.locator('.pf-reading-mode').count(),0,'Fresh launch does not reopen PDF');
 assert.equal(await page.locator('.score-row').count(),1,'Original scores are retained');
 assert.equal(await page.locator('main.content').count(),1);
 assert.deepEqual(errors,[]);
 console.log('PASS W2.3.3: CSS fallback, rapid orientation flips, refresh retains PDF, pagehide stops renderer, cold launch opens library');
 await context.close();

 // Android/Chrome standalone allowing native lock must never also rotate by CSS.
 const nativeContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
 await nativeContext.addInitScript(()=>{
  window.__nativeLockCalls=[];
  if(screen.orientation)try{
   Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async orientation=>{
    window.__nativeLockCalls.push(orientation);return undefined;
   }});
  }catch{}
 });
 const nativePage=await nativeContext.newPage();
 const nativeErrors=[];
 nativePage.on('pageerror',e=>nativeErrors.push(e.message));
 await nativePage.goto(url);
 if(await nativePage.locator('[data-action="welcome-done"]').count())await nativePage.locator('[data-action="welcome-done"]').click();
 await nativePage.locator('#import-input').setInputFiles({name:'NATIVE.pdf',mimeType:'application/pdf',buffer:pdf()});
 await nativePage.locator('[data-action="open"][data-value="NATIVE.pdf"]').waitFor();
 await nativePage.locator('[data-action="open"][data-value="NATIVE.pdf"]').click();
 await nativePage.locator('.viewer-canvas').waitFor({timeout:15000});
 await nativePage.waitForFunction(()=>window.__nativeLockCalls?.includes('landscape-primary'));
 assert.equal(await nativePage.locator('.pf-reading-mode.landscape-css-fallback').count(),0);
 const transform=await nativePage.locator('.pf-reading-mode').evaluate(n=>getComputedStyle(n).transform);
 assert.equal(transform,'none','A successful native orientation lock is never combined with CSS rotation');
 assert.deepEqual(nativeErrors,[]);
 await nativeContext.close();
 console.log('PASS W2.3.3: native-lock-supported viewer does not double-rotate');
}finally{await browser.close();}
