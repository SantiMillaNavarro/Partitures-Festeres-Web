import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {normalizeAnnotations,projectPoint,unprojectPoint} from '../../annotations.js';
import {objectBounds,rotateScreenPoint,rotatedStroke,resizedStroke,hitTestStroke} from '../../annotation-geometry.js';
import {ScoreViewer} from '../../viewer-w27.js';

const text={tool:'text',color:'#b51f34',width:.0055,points:[[.2,.3]],
 text:'Prova',fontSize:.034,bold:false,underline:false,opacity:1,
 boxWidth:.28,boxHeight:.10};
const original={version:1,pages:{1:[text]}};
assert.deepEqual(normalizeAnnotations(original),original,'Legacy annotation is unchanged');
const rotated=rotatedStroke(text,15);
assert.equal(rotated.rotationDegrees,15);
assert.equal(normalizeAnnotations({version:1,pages:{1:[rotated]}}).pages['1'][0].rotationDegrees,15);
assert.equal(resizedStroke(text,1.12,600,800,0).boxWidth>.28,true);
const center=objectBounds(rotated,600,800),inside=rotateScreenPoint(
 [center.left+center.width*.5,center.top+center.height*.5],center.cx,center.cy,15);
assert.equal(hitTestStroke([rotated],unprojectPoint([inside[0]/600,inside[1]/800]),600,800,0),0);
assert.throws(()=>normalizeAnnotations({version:1,pages:{1:[{...text,rotationDegrees:'15'}]}}));
assert.throws(()=>normalizeAnnotations({version:1,pages:{1:[{...text,rotationDegrees:360}]}}));
const mock=Object.create(ScoreViewer.prototype);
mock.annotationMode=true;mock.page={};mock.pageW=600;mock.pageH=800;mock.rotation=0;
mock.annotationHistory=new Map();mock.annotations=normalizeAnnotations(original);
mock.selectedAnnotation=0;mock.annotationClipboard=null;mock.annotationClipboardPage=null;mock.annotationPasteCount=0;
mock.pageNumber=1;mock.inlineSession=null;mock.cancelAnnotationStroke=()=>{};mock.redrawAnnotations=()=>{};
mock.notify=()=>{};mock.setAnnotationTool=()=>{};
mock.onAnnotationsChange=()=>{};mock.onWarning=m=>{throw Error(m)};
mock.commitAnnotationPage=function(next){
 this.annotations=normalizeAnnotations({version:1,pages:{...this.annotations.pages,[String(this.pageNumber)]:next}});
 return true;
};
assert.equal(mock.copySelectedAnnotation(),true);
assert.equal(mock.transformSelectedAnnotation({rotation:15}),true);
assert.equal(mock.annotationsOnPage()[0].rotationDegrees,15);
assert.equal(mock.pasteCopiedAnnotation(),true);
assert.equal(mock.annotationsOnPage().length,2);
mock.pageNumber=2;mock.selectedAnnotation=null;
assert.equal(mock.pasteCopiedAnnotation(),true,'Copied object can be pasted on another page');
assert.equal(mock.annotationsOnPage().length,1);
assert.equal(mock.annotationsOnPage()[0].text,'Prova');

function pdf(){
 const t='BT /F1 24 Tf 60 690 Td (PARTITURES FESTERES W27) Tj ET';
 const o=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
 '<</Length '+t.length+'>>\nstream\n'+t+'\nendstream',
 '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>'];
 let s='%PDF-1.4\n';const offsets=[];
 for(let i=0;i<o.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n';}
 const start=s.length;s+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const n of offsets)s+=String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+start+'\n%%EOF\n','ascii');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1080,height:750},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 const data=pdf();
 await page.locator('#import-input').setInputFiles({name:'OBJECTES_W27.pdf',mimeType:'application/pdf',buffer:data});
 await page.locator('[data-action="open"][data-value="OBJECTES_W27.pdf"]').waitFor();
 await page.locator('[data-action="open"][data-value="OBJECTES_W27.pdf"]').click();
 await page.locator('.viewer-canvas').waitFor({timeout:16000});
 await page.locator('#viewer-stage').click({position:{x:470,y:330}});
 await page.locator('.viewer-annotate-btn').click();
 await page.locator('[data-action="rosette-option"][data-value="text"]').click();
 const layer=page.locator('.viewer-annotation-layer');
 const at=async(x,y)=>{const b=await layer.boundingBox();return {x:b.x+b.width*x,y:b.y+b.height*y}};
 const tap=async(x,y)=>{const p=await at(x,y);await page.mouse.click(p.x,p.y)};
 await tap(.18,.22);
 await page.locator('.pf-inline-input').waitFor();
 await page.locator('.pf-inline-input').fill('Quadre únic');
 await page.locator('[data-inline="save"]').click();
 await page.locator('.pf-inline-input').waitFor({state:'detached'});
 assert.equal(await layer.evaluate(el=>getComputedStyle(el).pointerEvents),'auto');
 await tap(.72,.72);
 assert.equal(await page.locator('.pf-inline-input').count(),0,'No more text after saving');
 const records=()=>page.evaluate(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('OBJECTES_W27.pdf')).pages;
 });
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('OBJECTES_W27.pdf')).pages['1']?.length===1;
 });
 await page.locator('.pf-rosette-core').click(); // text -> root
 await page.locator('[data-action="rosette-option"][data-value="text"]').click();
 await tap(.72,.72);
 await page.locator('.pf-inline-input').waitFor();
 await page.locator('[data-inline="cancel"]').click();
 await page.locator('.pf-inline-input').waitFor({state:'detached'});
 await tap(.55,.72);
 assert.equal(await page.locator('.pf-inline-input').count(),0,'No more text after cancelling');
 assert.equal((await records())['1'].length,1,'No ghost text boxes');
 await tap(.20,.23);
 await page.locator('[data-action="object-toggle"]').click();
 await page.locator('.pf-object-actions').waitFor();
 assert.equal(await page.locator('[data-action="object-copy"]').isDisabled(),false);
 await page.locator('[data-action="object-rotate-right"]').click();
 await page.locator('[data-action="object-size-up"]').click();
 assert.equal((await records())['1'][0].rotationDegrees,15);
 assert((await records())['1'][0].boxWidth>.28);
 await page.locator('[data-action="object-copy"]').click();
 assert.equal(await page.locator('[data-action="object-paste"]').isDisabled(),false);
 await page.locator('#viewer-next-page').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 2'));
 await page.locator('[data-action="object-paste"]').click();
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('OBJECTES_W27.pdf')).pages['2']?.length===1;
 });
 assert.equal((await records())['2'][0].text,'Quadre únic');
 assert.equal((await records())['2'][0].rotationDegrees,15);
 const bytes=await page.evaluate(async()=>{
  const {getScore}=await import('./db.js');
  const doc=await getScore('OBJECTES_W27.pdf');
  return Array.from(new Uint8Array(await doc.blob.arrayBuffer()));
 });
 assert.deepEqual(bytes,Array.from(data),'PDF untouched');
 assert.deepEqual(errors,[],'Browser has no exceptions');
 console.log('PASS W2.7: single-use text, cancel, selected-object rotate/resize, copy/paste across pages, persisted annotations and PDF integrity');
 await context.close();
}finally{await browser.close();}
