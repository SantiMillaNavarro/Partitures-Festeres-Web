import assert from 'node:assert/strict';
import {chromium} from 'playwright';

function pdf(content='RETORN AL MENU'){
 const body='BT /F1 24 Tf 65 680 Td ('+content+') Tj ET';
 const o=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
  '<</Length '+body.length+'>>\nstream\n'+body+'\nendstream',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 let out='%PDF-1.4\n',ofs=[];
 for(let i=0;i<o.length;i++){ofs.push(out.length);out+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n';}
 const begin=out.length;out+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const n of ofs)out+=String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(out+'trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+begin+'\n%%EOF\n');
}

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await context.addInitScript(()=>{
  window.__androidNavigation={events:[],fullscreen:false,gestureBackCount:0};
  Object.defineProperty(document,'fullscreenElement',{configurable:true,
   get:()=>window.__androidNavigation.fullscreen?document.documentElement:null});
  Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:()=>{
   window.__androidNavigation.events.push('enterFullscreen');
   window.__androidNavigation.fullscreen=true;
   document.dispatchEvent(new Event('fullscreenchange'));
   return Promise.resolve();
  }});
  Object.defineProperty(document,'exitFullscreen',{configurable:true,value:()=>{
   window.__androidNavigation.events.push('exitFullscreen');
   window.__androidNavigation.fullscreen=false;
   document.dispatchEvent(new Event('fullscreenchange'));
   return Promise.resolve();
  }});
  if(screen.orientation)try{
   Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async()=>{}});
   Object.defineProperty(screen.orientation,'unlock',{configurable:true,value:()=>{}});
  }catch{}
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 const original=pdf();
 const zip=await page.evaluate(async base64=>{
  const a=new window.JSZip();
  a.file('ALFA.pdf',base64,{base64:true});
  a.file('BETA.pdf',base64,{base64:true});
  return a.generateAsync({type:'base64'});
 },original.toString('base64'));
 await page.locator('#import-input').setInputFiles({name:'partitures.zip',mimeType:'application/zip',buffer:Buffer.from(zip,'base64')});
 await page.locator('[data-action="open"][data-value="ALFA.pdf"]').waitFor({timeout:15000});
 const currentPath=()=>page.locator('#viewer-stage').getAttribute('data-path');
 const open=async path=>{
  await page.locator('[data-action="open"][data-value="'+path+'"]').click();
  await page.locator('.viewer-canvas').waitFor({timeout:15000});
  assert.equal(await currentPath(),path);
  await page.waitForFunction(()=>history.state?.pfwebViewer===true);
 };
 const back=async()=>{
  await page.evaluate(()=>history.back()); // same history path as Android system Back
  await page.locator('.pf-reading-mode').waitFor({state:'detached',timeout:10000});
  await page.waitForFunction(()=>history.state?.pfwebViewer===false);
 };
 assert.equal(await page.evaluate(()=>history.state?.pfwebViewer),false,'At least one menu entry exists');

 // 1. System Back in browser history returns to the precise previous menu.
 await open('ALFA.pdf');
 const initialHistory=await page.evaluate(()=>history.length);
 await back();
 assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),'library');
 assert.equal(await page.locator('[data-action="open"]').count(),2,'Library remains intact');
 assert.equal(await page.evaluate(()=>window.__androidNavigation.fullscreen),false,'Exit viewer releases native fullscreen');

 // 2. Opening from Recents preserves the current section.
 await page.locator('.bottom-link[data-value="recents"]').click();
 await page.locator('[data-action="open"][data-value="ALFA.pdf"]').waitFor();
 await open('ALFA.pdf');
 await back();
 assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),'recents','Back returns to Recents');

 // 3. Opening another score while in the viewer must not add another back entry.
 await page.locator('.bottom-link[data-value="library"]').click();
 await open('ALFA.pdf');
 const lengthBefore=await page.evaluate(()=>history.length);
 await page.locator('#viewer-stage').click({position:{x:190,y:340}});
 await page.locator('[data-action="viewer-next"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-stage')?.getAttribute('data-path')==='BETA.pdf');
 assert.equal(await page.evaluate(()=>history.length),lengthBefore,'Changing score does not stack dozens of Back steps');
 await back();
 assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),'library');

 // 4. La W2.17 no entra en fullscreen per evitar el cartell de Chrome.
 // Enrere d'Android continua eixint del visor una sola vegada.
 await open('ALFA.pdf');
 assert.equal(await page.evaluate(()=>window.__androidNavigation.fullscreen),false,
  'La PWA ja no demana fullscreen');
 assert.equal(await page.evaluate(()=>window.__androidNavigation.events.includes('enterFullscreen')),false);
 const previousLength=await page.evaluate(()=>history.length);
 await back();
 assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),'library');
 assert.equal(await page.evaluate(()=>history.length),previousLength);
 assert.equal(await page.locator('main.content').count(),1,'Un Enrere no abandona la PWA');

 // 5. Visible back arrow uses the SAME navigation history, and is not a page exit.
 await open('ALFA.pdf');
 await page.locator('#viewer-stage').click({position:{x:190,y:330}});
 await page.locator('[data-action="viewer-close"]').click();
 await page.waitForFunction(()=>history.state?.pfwebViewer===false);
 assert.equal(await page.locator('.pf-reading-mode').count(),0);
 assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),'library');

 // 6. Reload remains inside the PDF; Back after reload still returns to the menu.
 await open('BETA.pdf');
 await page.reload();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 assert.equal(await currentPath(),'BETA.pdf');
 assert.equal(await page.evaluate(()=>history.state?.pfwebViewer),true);
 await back();
 assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),'library');

 // 7. A genuinely new navigation does not reopen a score or create a stale PDF history entry.
 await page.goto('http://127.0.0.1:8765/?new-session=1',{waitUntil:'domcontentloaded'});
 await page.locator('.bottom-link.selected[data-value="library"]').waitFor();
 assert.equal(await page.locator('.pf-reading-mode').count(),0);
 assert.equal(await page.evaluate(()=>history.state?.pfwebViewer),false);

 const originalAfter=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');
  return Array.from(new Uint8Array(await (await getScore('ALFA.pdf')).blob.arrayBuffer()));
 });
 assert.deepEqual(originalAfter,Array.from(original),'Back must not delete or change scores');
 assert.deepEqual(errors,[],'No runtime errors');
 console.log('PASS W2.3.5: system Back sense fullscreen, back arrow, next-score, reload and clean session');
 await context.close();
}finally{await browser.close();}
