import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {normalizeAnnotations} from '../../annotations.js';
import {hitTestStroke,textBoxFromGesture,textBounds,wrapTextInBox,STANDARD_TEXT_BOX} from '../../annotation-geometry.js';
import {musicalSymbolBounds} from '../../musical-symbols.js';

const legacy={tool:'text',color:'#b51f34',width:.0055,points:[[.2,.2]],
 text:'Antic',fontSize:.034,bold:false,underline:false,opacity:1};
assert.deepEqual(normalizeAnnotations({version:1,pages:{1:[legacy]}}).pages['1'][0],legacy,'Legacy text remains unchanged');
assert.throws(()=>normalizeAnnotations({version:1,pages:{1:[{...legacy,boxWidth:.25}]}}));
assert.throws(()=>normalizeAnnotations({version:1,pages:{1:[{...legacy,boxWidth:2,boxHeight:.15}]}}));
const boxed={...legacy,boxWidth:.38,boxHeight:.15};
assert.equal(normalizeAnnotations({version:1,pages:{1:[boxed]}}).pages['1'][0].boxWidth,.38);
assert.equal(textBounds(boxed,600,800).width,228);
assert.equal(hitTestStroke([boxed],[.5,.28],600,800),0);
assert.deepEqual(textBoxFromGesture([.2,.3],[.2,.3],0,600,800),
 {point:[.2,.3],boxWidth:STANDARD_TEXT_BOX.width,boxHeight:STANDARD_TEXT_BOX.height,drawn:false});
const drag90=textBoxFromGesture([.3,.8],[.6,.4],90,600,800);
assert.equal(drag90.drawn,true);
assert(drag90.boxWidth>=.35&&drag90.boxHeight>=.25);
assert(wrapTextInBox('Paràgraf amb moltes paraules',20,100).length>1);
const sym={tool:'symbol',symbolId:'quarter',color:'#b51f34',width:.0055,points:[[.2,.2]],fontSize:.07,opacity:1};
assert.equal(hitTestStroke([sym],[.17,.23],600,800,270),0,
 'Note can be selected in upright displayed rectangle on rotated PDF');
assert(musicalSymbolBounds(sym,600,800).height>0);

function makePdf(){
 const t='BT /F1 22 Tf 70 680 Td (SAXO ALT PARTITURA W241) Tj ET';
 const objs=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
  '<</Length '+t.length+'>>\nstream\n'+t+'\nendstream',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 let s='%PDF-1.4\n';const offsets=[];
 for(let i=0;i<objs.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+objs[i]+'\nendobj\n';}
 const start=s.length;s+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
 for(const n of offsets)s+=String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(objs.length+1)+'>>\nstartxref\n'+start+'\n%%EOF\n','ascii');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 await page.locator('.bottom-link[data-value="settings"]').click();
 assert.match(await page.locator('main.content').innerText(),/Partitures Festeres Web — W2\.4\.1/);
 await page.locator('.bottom-link[data-value="library"]').click();
 const original=makePdf();
 await page.locator('#import-input').setInputFiles({name:'QUADRES_W241.pdf',mimeType:'application/pdf',buffer:original});
 await page.locator('[data-action="open"][data-value="QUADRES_W241.pdf"]').waitFor();
 // Simulate exactly the rotated PDF situation shown by the user.
 await page.evaluate(async()=>{const {setPref}=await import('./db.js');
  await setPref('viewer:QUADRES_W241.pdf',{rotation:270,rotationMode:'manual',zoom:1,fit:'page',page:1});
 });
 await page.locator('[data-action="open"][data-value="QUADRES_W241.pdf"]').click();
 await page.locator('.viewer-canvas').waitFor({timeout:16000});
 await page.locator('#viewer-stage').click({position:{x:190,y:330}});
 await page.locator('[data-action="viewer-annotate"]').click();
 await page.locator('.w23-annotation-toolbar').waitFor();
 const records=()=>page.evaluate(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('QUADRES_W241.pdf')).pages['1']||[];
 });
 const point=async(x,y)=>{
  const b=await page.locator('.viewer-annotation-layer').boundingBox();
  assert(b?.width>40&&b?.height>40);return {x:b.x+b.width*x,y:b.y+b.height*y};
 };
 const tap=async(x,y)=>{const p=await point(x,y);await page.mouse.click(p.x,p.y);};
 const drag=async(x,y,xx,yy)=>{
  const a=await point(x,y),b=await point(xx,yy);
  await page.mouse.move(a.x,a.y);await page.mouse.down();
  await page.mouse.move(b.x,b.y,{steps:15});await page.mouse.up();
 };
 const editText=async text=>{
  await page.locator('.annotation-text-modal').waitFor();
  await page.locator('#annotation-text-value').fill(text);
  await page.locator('[data-action="annotation-text-save"]').click();
  await page.locator('.annotation-text-modal').waitFor({state:'detached'});
 };
 const tool=async name=>{
  const group=['pen','highlighter'].includes(name)?'strokes':
    ['line','rectangle','ellipse','arrow'].includes(name)?'shapes':'edit';
  await page.locator('[data-action="annotation-group"][data-value="'+group+'"]').click();
  await page.locator('[data-action="annotation-tool"][data-value="'+name+'"]').click();
 };
 await page.locator('[data-action="annotation-group"][data-value="symbols"]').click();
 await page.locator('[data-action="annotation-symbol-picker"]').click();
 await page.locator('[data-action="annotation-symbol-pick"][data-value="quarter"]').click();
 await tap(.24,.22);
 await page.waitForFunction(async()=>{const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('QUADRES_W241.pdf')).pages['1']?.length===1;
 });
 const symbol=page.locator('.annotation-symbol').first();
 const attribute=await symbol.getAttribute('transform');
 assert.match(attribute,/translate\(/);
 assert(!attribute.includes('rotate('),'No extra quarter-note rotation over an already rotated score');
 await tool('select');
 await tap(.26,.25);
 assert.equal(await page.locator('.annotation-selection').count(),1,'Rotated score symbol remains selectable');
 await tool('text');
 // A touch creates standard sized text box, visible as a preview while editing.
 await tap(.34,.24);
 await page.locator('.annotation-text-modal').waitFor();
 assert.equal(await page.locator('.annotation-text-preview').count(),1,'Standard box is visible behind editor');
 await page.locator('#annotation-text-value').fill('Sense guardar');
 await page.locator('[data-action="annotation-text-cancel"]').click();
 assert.equal(await page.locator('.annotation-text-preview').count(),0,'Cancel discards unsaved box');
 assert.equal((await records()).length,1,'Cancel does not create annotation');
 await tap(.34,.24);
 await editText('D.C. al Fine');
 let list=await records();
 assert.equal(list.length,2);
 assert.equal(list[1].tool,'text');
 assert.equal(list[1].boxWidth,.38);
 assert(list[1].boxHeight>=.15);
 assert.equal(await page.locator('.annotation-text').count(),1);
 assert.equal(await page.locator('.annotation-text').first().evaluate(el=>el.getAttribute('transform').includes('rotate(')),false,
  'Text is aligned with the same visible direction as musical symbols');
 // Draw a custom size by dragging a rectangle instead of tapping.
 await drag(.23,.57,.51,.73);
 await page.locator('.annotation-text-modal').waitFor();
 await editText('Text dins del quadre que ocupa més d’una línia');
 list=await records();
 assert.equal(list.length,3);
 assert(list[2].boxWidth>.22&&list[2].boxWidth<.33,'Dragged box stores a custom width');
 assert(list[2].boxHeight>=.15,'Dragged box preserves or increases its specified height');
 assert.equal(await page.locator('.annotation-text').count(),2);
 await tool('select');
 await tap(.27,.61);
 assert.equal(await page.locator('.annotation-text-resize-handle').count(),1,'Selected text box gets resize handle');
 const before=list[2].boxWidth;
 const handle=await page.locator('.annotation-text-resize-handle').boundingBox();
 assert(handle?.width>4);
 const a={x:handle.x+handle.width/2,y:handle.y+handle.height/2};
 await page.mouse.move(a.x,a.y);await page.mouse.down();
 await page.mouse.move(a.x+80,a.y+27,{steps:14});await page.mouse.up();
 await page.waitForFunction(async previous=>{
  const {getAnnotations}=await import('./db.js');
  const a=(await getAnnotations('QUADRES_W241.pdf')).pages['1'];
  return Math.abs(a[2].boxWidth-previous)>.01;
 },before);
 assert.notEqual((await records())[2].boxWidth,before,'Resize handle changes box dimensions');
 await page.locator('[data-action="annotation-undo"]').click();
 assert.equal((await records())[2].boxWidth,before,'Undo restores previous size');
 await tap(.27,.61); // Desfer deselecciona; torna a seleccionar per a editar.
 assert.equal(await page.locator('[data-action="annotation-text-edit"]').isEnabled(),true);
 await page.locator('[data-action="annotation-text-edit"]').click();
 await page.locator('.annotation-text-modal').waitFor();
 assert.match(await page.locator('#annotation-text-value').inputValue(),/Text dins del quadre/);
 await page.locator('#annotation-text-value').fill('Texto editado');
 await page.locator('[data-action="annotation-text-save"]').click();
 assert.equal((await records())[2].text,'Texto editado');
 await page.locator('[data-action="viewer-annotate"]').last().click();
 await page.locator('[data-action="viewer-rotate"]').click();
 assert.equal(await page.locator('.annotation-symbol').count(),1);
 assert.equal(await page.locator('.annotation-text').count(),2);
 const svgRotate=await page.locator('.annotation-symbol').getAttribute('transform');
 assert(!svgRotate.includes('rotate('));
 await page.locator('[data-action="viewer-zoom-in"]').click();
 await page.reload();
 await page.locator('.viewer-canvas').waitFor({timeout:16000});
 assert.equal(await page.locator('.annotation-symbol').count(),1);
 assert.equal(await page.locator('.annotation-text').count(),2);
 const result=await records();
 assert.equal(result.length,3);
 assert.deepEqual(errors,[]);
 console.log('PASS W2.4.1: rotated score symbols upright, tap/draw text boxes, selection, resize, cancel, edit, undo, PDF rotation and reload');
 await ctx.close();
}finally{await browser.close();}
