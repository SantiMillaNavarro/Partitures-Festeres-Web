import assert from 'node:assert/strict';
import {chromium} from 'playwright';
function makePdf(){
 const text='BT /F1 25 Tf 65 680 Td (PARTITURA BLOQUEJADA) Tj ET';
 const o=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
 '<</Length '+text.length+'>>\nstream\n'+text+'\nendstream',
 '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 let out='%PDF-1.4\n',ofs=[];
 for(let i=0;i<o.length;i++){ofs.push(out.length);out+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n';}
 const begin=out.length;out+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const n of ofs)out+=String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(out+'trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+begin+'\n%%EOF\n','ascii');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
  window.__lockTest={events:[],fullscreen:false};
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>window.__lockTest.fullscreen?document.documentElement:null});
  Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:()=>{
   window.__lockTest.events.push('fullscreen-request');
   window.__lockTest.fullscreen=true;
   return Promise.resolve();
  }});
  Object.defineProperty(document,'exitFullscreen',{configurable:true,value:()=>{
   window.__lockTest.events.push('fullscreen-exit');
   window.__lockTest.fullscreen=false;
   return Promise.resolve();
  }});
  Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async orientation=>{
   window.__lockTest.events.push('orientation:'+orientation);
   if(!document.fullscreenElement)throw new DOMException('fullscreen required','SecurityError');
   if(orientation!=='landscape-primary')throw new Error('Expected stable landscape-primary lock');
  }});
  Object.defineProperty(screen.orientation,'unlock',{configurable:true,value:()=>{
   window.__lockTest.events.push('orientation-unlock');
  }});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 assert.deepEqual(await page.evaluate(()=>window.__lockTest.events),[],'No orientation lock while viewing Library');
 await page.locator('#import-input').setInputFiles({name:'BLOCK.pdf',mimeType:'application/pdf',buffer:makePdf()});
 await page.locator('[data-action="open"][data-value="BLOCK.pdf"]').waitFor();
 await page.locator('[data-action="open"][data-value="BLOCK.pdf"]').click();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 await page.waitForFunction(()=>window.__lockTest.events.some(x=>x.startsWith('orientation:')));
 const events=await page.evaluate(()=>window.__lockTest.events);
 assert.deepEqual(events.slice(0,2),['fullscreen-request','orientation:landscape-primary'],
  'Fullscreen requested in the opening click and the exact landscape-primary is locked');
 assert.equal(await page.locator('.pf-reading-mode.landscape-css-fallback').count(),0,
  'Native lock and CSS orientation never overlap');
 assert.equal(await page.locator('.pf-reading-mode').evaluate(n=>getComputedStyle(n).transform),'none',
  'No visual rotation needed when native lock succeeds');
 // A desktop-style resize cannot force an additional CSS rotation while the native lock holds.
 for(const [w,h] of [[844,390],[390,844],[844,390]]){
  await page.setViewportSize({width:w,height:h});
  assert.equal(await page.locator('.pf-reading-mode.landscape-css-fallback').count(),0);
  assert.equal(await page.locator('.viewer-canvas').count(),1);
 }
 await page.locator('#viewer-stage').click({position:{x:200,y:320}});
 await page.locator('[data-action="viewer-close"]').click();
 await page.waitForFunction(()=>window.__lockTest.events.includes('fullscreen-exit'));
 const after=await page.evaluate(()=>window.__lockTest.events);
 assert(after.indexOf('orientation-unlock')<after.indexOf('fullscreen-exit'));
 assert.equal(await page.evaluate(()=>window.__lockTest.fullscreen),false,'Fullscreen exits when closing PDF');
 assert.equal(await page.locator('.pf-reading-mode').count(),0);
 assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),'library');
 assert.deepEqual(errors,[]);
 console.log('PASS W2.3.4: only the PDF viewer requests fullscreen and primary-landscape orientation, then releases both');
 await context.close();
}finally{await browser.close();}
