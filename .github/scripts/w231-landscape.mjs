import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {clientToViewerPoint,visualViewerDimensions} from '../../viewer-orientation.js';
assert.deepEqual(clientToViewerPoint(200,760,{left:20,top:10,right:410,bottom:854},true),{x:750,y:210});
assert.deepEqual(clientToViewerPoint(200,760,{left:20,top:10,right:410,bottom:854},false),{x:180,y:750});
assert.deepEqual(visualViewerDimensions({width:390,height:844},true),{width:844,height:390});
assert.deepEqual(visualViewerDimensions({width:844,height:390},false),{width:844,height:390});

function pdf(){
 const t='BT /F1 24 Tf 80 690 Td (LANDSCAPE PAGE) Tj ET';
 const objects=[
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
  '<</Length '+t.length+'>>\nstream\n'+t+'\nendstream',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>'
 ];
 let s='%PDF-1.4\n',offsets=[];
 for(let i=0;i<objects.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const start=s.length;s+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const n of offsets)s+=String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(objects.length+1)+'>>\nstartxref\n'+start+'\n%%EOF\n','ascii');
}
const buffer=pdf();
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,
  hasTouch:true,isMobile:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Simulate iOS Safari, where orientation locking is unsupported.
 await page.addInitScript(()=>{
  window.__orientationEvents=[];
  if(screen.orientation){
   try{
    Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async orientation=>{
     window.__orientationEvents.push('lock:'+orientation);
     throw new DOMException('Not supported on iOS','NotSupportedError');
    }});
   }catch{}
  }
 });
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 await page.locator('#import-input').setInputFiles({name:'LANDSCAPE_TEST.pdf',mimeType:'application/pdf',buffer});
 await page.locator('.score-row').waitFor();
 assert.equal(await page.locator('.pf-reading-mode').count(),0,'Library stays in portrait');
 const open=async()=>{
  await page.locator('[data-action="open"][data-value="LANDSCAPE_TEST.pdf"]').click();
  await page.locator('.viewer-canvas').waitFor({timeout:15000});
 };
 const readOrientation=()=>page.evaluate(()=>{
  const root=document.querySelector('.pf-reading-mode'),stage=root?.querySelector('#viewer-stage');
  if(!root)return null;
  const box=root.getBoundingClientRect();
  return {transform:getComputedStyle(root).transform,
   box:{left:box.left,top:box.top,right:box.right,bottom:box.bottom,width:box.width,height:box.height},
   local:{width:Math.round(stage.clientWidth),height:Math.round(stage.clientHeight)}};
 });
 await open();
 let orientation=await readOrientation();
 assert.match(orientation.transform,/matrix\(/,'CSS landscape fallback is activated on portrait touchscreen');
 assert(Math.abs(orientation.box.width-390)<4,'Rotated viewer covers viewport width');
 assert(Math.abs(orientation.box.height-844)<4,'Rotated viewer covers viewport height');
 assert(orientation.local.width>orientation.local.height,'Viewer layout behaves like landscape');
 const localClick=async(x,y)=>{
  const b=await page.locator('#viewer-stage').boundingBox();
  return {x:b.x+b.width*(1-y),y:b.y+b.height*x};
 };
 await page.mouse.click(...Object.values(await localClick(.93,.5)));
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 2'),{timeout:10000});
 assert.match(await page.locator('#viewer-page-counter').innerText(),/2 \/ 2/,'Rotated viewer right edge turns next page');
 await page.mouse.click(...Object.values(await localClick(.07,.5)));
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('1 / 2'));
 assert.match(await page.locator('#viewer-page-counter').innerText(),/1 \/ 2/);
 // Show controls at the center, enable annotations and draw using rotated touch positions.
 await page.mouse.click(...Object.values(await localClick(.5,.5)));
 await page.locator('[data-action="viewer-annotate"]').waitFor({state:'visible'});
 await page.locator('[data-action="viewer-annotate"]').click();
 await page.locator('.w23-annotation-toolbar').waitFor();
 await page.locator('[data-action="annotation-group"][data-value="strokes"]').click();
 await page.locator('[data-action="annotation-tool"][data-value="pen"]').click();
 const layerPoint=async(x,y)=>{
  const b=await page.locator('.viewer-annotation-layer').boundingBox();
  assert(b?.width>40&&b?.height>40);
  return {x:b.x+b.width*(1-y),y:b.y+b.height*x};
 };
 const a=await layerPoint(.19,.25),b=await layerPoint(.39,.32);
 await page.mouse.move(a.x,a.y);await page.mouse.down();
 await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('LANDSCAPE_TEST.pdf')).pages['1']?.length===1;
 });
 const saved=await page.evaluate(async()=>{
  const {getAnnotations}=await import('./db.js');return (await getAnnotations('LANDSCAPE_TEST.pdf')).pages['1'][0];
 });
 const closeEnough=(a,b)=>Math.abs(a-b)<.025;
 assert(saved.points.length>1);
 assert(closeEnough(saved.points[0][0],.19)&&closeEnough(saved.points[0][1],.25),
   'Pen coordinates are corrected despite CSS rotation');
 const last=saved.points.at(-1);
 assert(closeEnough(last[0],.39)&&closeEnough(last[1],.32),
   'Ending point matches physical touch under landscape fallback');
 await page.locator('[data-action="annotation-group"][data-value="edit"]').click();
 await page.locator('[data-action="annotation-tool"][data-value="select"]').click();
 const middle=await layerPoint(.28,.285);
 await page.mouse.click(middle.x,middle.y);
 assert.equal(await page.locator('.annotation-selection').count(),1,'Selection works on rotated viewer');
 await page.locator('[data-action="viewer-annotate"]').last().click();
 const d1=await page.locator('.annotation-stroke').first().getAttribute('d');
 await page.locator('[data-action="viewer-rotate"]').click();
 await page.waitForFunction(()=>document.querySelector('.annotation-stroke')?.getAttribute('d'));
 const d2=await page.locator('.annotation-stroke').first().getAttribute('d');
 assert.notEqual(d1,d2,'Manual PDF rotation remains independent');
 await page.locator('[data-action="viewer-zoom-in"]').click();
 assert.equal(await page.locator('.annotation-stroke').count(),1,'Zoom preserves rotated annotation');

 // Repeated refresh still restores this exact PDF, and uses landscape presentation.
 await page.reload();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 orientation=await readOrientation();
 assert.match(orientation.transform,/matrix\(/,'Landscape view returns after refresh');
 assert.equal(await page.locator('.annotation-stroke').count(),1);
 await page.mouse.click(...Object.values(await localClick(.5,.5)));
 await page.locator('[data-action="viewer-close"]').click();
 assert.equal(await page.locator('.pf-reading-mode').count(),0,'Closing PDF restores normal Library');
 assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),'library');

 // Turning the physical screen to landscape removes the visual rotation and uses full width.
 await page.setViewportSize({width:844,height:390});
 await open();
 orientation=await readOrientation();
 assert.equal(orientation.transform,'none','Native landscape viewer does not receive duplicate CSS rotation');
 assert(orientation.local.width>orientation.local.height);
 await page.mouse.click(...Object.values(await localClick(.5,.5)));
 await page.locator('[data-action="viewer-close"]').click();
 assert.equal(await page.locator('.pf-reading-mode').count(),0);
 assert.deepEqual(errors,[],'No JavaScript errors from rotation / touch');
 console.log('PASS W2.3.1: portrait touchscreen viewer visually landscape, swipe/edge, pen, select, PDF rotate, zoom, refresh, native landscape, library unchanged');
 await ctx.close();
}finally{await browser.close();}
