import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {shouldKeepLegacyManual,analyzeStaffDirection,selectRotationByStaffs} from '../../score-orientation.js';
assert.equal(shouldKeepLegacyManual({rotation:0}),false);
assert.equal(shouldKeepLegacyManual({rotation:90}),true);
assert.equal(shouldKeepLegacyManual({rotation:270,rotationMode:'auto'}),false);
assert.equal(shouldKeepLegacyManual({rotation:0,rotationMode:'manual'}),true);
assert.equal(selectRotationByStaffs({rotate:0},{axis:'vertical'}),270);
assert.equal(selectRotationByStaffs({rotate:90},{axis:'vertical'}),90);
assert.equal(selectRotationByStaffs({rotate:180},{axis:'horizontal'}),180);
const pixels=(vertical)=>{
 const width=180,height=240,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(let j=0;j<5;j++)for(let a=12;a<(vertical?height-12:width-12);a++){
  const x=vertical?20+j*19:a,y=vertical?a:20+j*19,i=(y*width+x)*4;
  data[i]=data[i+1]=data[i+2]=0;
 }
 return {width,height,data};
};
assert.equal(analyzeStaffDirection(pixels(true)).axis,'vertical');
assert.equal(analyzeStaffDirection(pixels(false)).axis,'horizontal');

function pdf(pages){
 const objects=['','<</Type/Catalog/Pages 2 0 R>>','',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'],kids=[];
 for(const page of pages){
  const p=objects.length,c=p+1;kids.push(p+' 0 R');
  objects.push('<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 3 0 R>>>>/Contents '+c+' 0 R'+(page.rotate===undefined?'':'/Rotate '+page.rotate)+'>>');
  objects.push('<</Length '+page.content.length+'>>\nstream\n'+page.content+'\nendstream');
 }
 objects[2]='<</Type/Pages/Kids['+kids.join(' ')+']/Count '+pages.length+'>>';
 let s='%PDF-1.4\n';const offsets=[];
 for(let i=1;i<objects.length;i++){offsets.push(s.length);s+=i+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const start=s.length;s+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
 for(const x of offsets)s+=String(x).padStart(10,'0')+' 00000 n \n';
 s+='trailer\n<</Root 1 0 R/Size '+objects.length+'>>\nstartxref\n'+start+'\n%%EOF\n';
 return Buffer.from(s,'ascii');
}
const vertical=Array.from({length:6},(_,i)=>(100+i*30)+' 680 m '+(100+i*30)+' 180 l S').join('\n');
const sideways=pdf([
 {content:'BT /F1 24 Tf 0 -1 1 0 130 700 Tm (Arcum marcha cristiana Oscar Chafer) Tj ET'},
 {content:vertical},
 {content:'BT /F1 30 Tf 1 0 0 1 80 700 Tm (Obra vertical correcta) Tj ET'}
]);
const scan=pdf([{content:vertical},{content:vertical}]);
const upright=pdf([{content:'BT /F1 30 Tf 1 0 0 1 80 700 Tm (Partitura vertical) Tj ET'}]);
const native=pdf([{rotate:90,content:'BT /F1 30 Tf 1 0 0 1 80 700 Tm (Partitura orientada) Tj ET'}]);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 const add=async(name,buffer)=>{
  await page.locator('#import-input').setInputFiles({name,mimeType:'application/pdf',buffer});
  await page.locator('[data-action="open"][data-value="'+name+'"]').waitFor({timeout:15000});
 };
 const pref=async name=>page.evaluate(async n=>{
  const {getPref}=await import('./db.js');return getPref('viewer:'+n,null);
 },name);
 const savePref=async(name,value)=>page.evaluate(async v=>{
  const {setPref}=await import('./db.js');return setPref('viewer:'+v.name,v.value);
 },{name,value});
 const open=async name=>{
  await page.locator('[data-action="open"][data-value="'+name+'"]').click();
  await page.locator('.viewer-canvas').waitFor({timeout:20000});
  await page.waitForFunction(()=>document.querySelector('#viewer-stage')?.getAttribute('aria-busy')!=='true');
  await page.locator('#viewer-stage').click({position:{x:190,y:350}});
 };
 const close=async()=>page.locator('[data-action="viewer-close"]').click();
 const dims=()=>page.locator('.viewer-canvas').evaluate(n=>({width:n.clientWidth,height:n.clientHeight}));

 await add('ARCUM.pdf',sideways);
 await savePref('ARCUM.pdf',{zoom:1,fit:'page',rotation:0,page:1});
 const inferred=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');
  const {scoreReadableTextRotation}=await import('./score-orientation.js');
  const blob=(await getScore('ARCUM.pdf')).blob;
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.js';
  const doc=await window.pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false}).promise;
  const a=await doc.getPage(1),b=await doc.getPage(3);
  const result=[scoreReadableTextRotation(a,await a.getTextContent()),scoreReadableTextRotation(b,await b.getTextContent())];
  await doc.destroy();return result;
 });
 assert.deepEqual(inferred,[270,0],'PDF text direction must decide correct 270° vs 90°');

 await open('ARCUM.pdf');
 assert.equal((await pref('ARCUM.pdf')).rotation,270,'Legacy auto-saved 0° must now orient');
 assert.equal((await pref('ARCUM.pdf')).rotationMode,'auto');
 assert((await dims()).width>(await dims()).height,'Page becomes landscape');
 await page.locator('[data-action="viewer-page-next"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 3'));
 assert.equal((await pref('ARCUM.pdf')).rotation,270,'Page without text reuses the first page orientation');
 await page.locator('[data-action="viewer-page-next"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('3 / 3'));
 assert.equal((await pref('ARCUM.pdf')).rotation,0,'Portrait text content stays upright within mixed document');
 assert((await dims()).height>(await dims()).width);
 await page.locator('[data-action="viewer-rotate"]').click();
 assert.equal((await pref('ARCUM.pdf')).rotationMode,'manual');
 assert.equal((await pref('ARCUM.pdf')).rotation,90);
 await close();
 await open('ARCUM.pdf');
 assert.equal((await pref('ARCUM.pdf')).rotationMode,'manual','Manual override survives reopening');
 assert.equal((await pref('ARCUM.pdf')).rotation,90);
 await page.locator('[data-action="viewer-auto-rotate"]').click();
 await page.waitForFunction(async()=>{
  const {getPref}=await import('./db.js');return (await getPref('viewer:ARCUM.pdf'))?.rotationMode==='auto';
 });
 assert.equal((await pref('ARCUM.pdf')).rotation,0);
 await page.locator('[data-action="viewer-page-prev"]').click();
 await page.locator('[data-action="viewer-page-prev"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('1 / 3'));
 assert.equal((await pref('ARCUM.pdf')).rotation,270);
 await page.reload();
 await page.locator('.viewer-canvas').waitFor({timeout:20000});
 await page.waitForFunction(async()=>{
  const {getPref}=await import('./db.js');const p=await getPref('viewer:ARCUM.pdf');
  return p?.rotationMode==='auto'&&p?.rotation===270;
 });
 await page.locator('#viewer-stage').click({position:{x:190,y:350}});
 await close();

 await add('SCAN.pdf',scan);
 await open('SCAN.pdf');
 assert.equal((await pref('SCAN.pdf')).rotation,270,'Music staff vector lines detected without OCR');
 assert((await dims()).width>(await dims()).height);
 await close();

 await add('UPRIGHT.pdf',upright);
 await open('UPRIGHT.pdf');
 assert.equal((await pref('UPRIGHT.pdf')).rotation,0,'Correct portrait PDF unchanged');
 await close();

 await add('NATIVE.pdf',native);
 await open('NATIVE.pdf');
 assert.equal((await pref('NATIVE.pdf')).rotation,0,'Embedded /Rotate does not override readable text direction');
 await close();

 await add('OLD_MANUAL.pdf',sideways);
 await savePref('OLD_MANUAL.pdf',{rotation:90,page:1});
 await open('OLD_MANUAL.pdf');
 assert.equal((await pref('OLD_MANUAL.pdf')).rotationMode,'manual','Pre-existing explicit rotations are preserved');
 assert.equal((await pref('OLD_MANUAL.pdf')).rotation,90);
 await close();

 const bytes=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');const b=(await getScore('ARCUM.pdf')).blob;
  return Array.from(new Uint8Array(await b.arrayBuffer()));
 });
 assert.deepEqual(bytes,Array.from(sideways),'Original PDF bytes never change');
 assert.deepEqual(errors,[],'No runtime JS error');
 console.log('PASS W2.3.2: text, staff, mixed pages, legacy pref, manual override, reset to auto, refresh and original PDF');
 await context.close();
}finally{await browser.close();}
