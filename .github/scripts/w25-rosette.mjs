import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {ROSETTE_ROOT,rosetteParent,rosetteOptions,rosettePetalPosition,clampRosetteCenter} from '../../rosette-w25.js';

assert.equal(ROSETTE_ROOT.length,8,'Eight original Android root petals');
assert.deepEqual(ROSETTE_ROOT.map(x=>x.id),
 ['select','pencil','highlighter','text','shape','symbols','crop','eraser']);
assert.equal(rosetteParent('pencil-color'),'pencil');
assert.equal(rosetteParent('symbol-picker'),'symbols');
assert.equal(rosetteParent('root'),null);
assert.equal(rosetteOptions('root').length,8);
assert.equal(rosetteOptions('pencil').length,3);
assert.equal(rosetteOptions('symbols').length,8);
assert.equal(rosetteOptions('symbol-picker',{symbolGroup:'dynamics',symbolPage:0}).length,8);
assert.equal(rosetteOptions('symbol-picker',{symbolGroup:'dynamics',symbolPage:1}).length,5);
assert.equal(rosettePetalPosition(0,8,true).inner,true);
assert.equal(rosettePetalPosition(4,8,true).inner,false);
assert.notEqual(rosettePetalPosition(0,8,true).y,rosettePetalPosition(4,8,true).y);
assert.deepEqual(clampRosetteCenter(0,0,900,450,true),{x:142,y:142});
const makePdf=()=>{
 const text='BT /F1 24 Tf 90 650 Td (ROSERO PARTITURES FESTERES) Tj ET';
 const o=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
 '<</Length '+text.length+'>>\nstream\n'+text+'\nendstream',
 '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 let s='%PDF-1.4\n';const offsets=[];
 for(let i=0;i<o.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n';}
 const start=s.length;s+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const n of offsets)s+=String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+start+'\n%%EOF\n','ascii');
};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1080,height:750},deviceScaleFactor:1,acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>{console.error('W25 BROWSER PAGE ERROR',error.stack||error.message);errors.push(error.message);});
 page.on('console',message=>{if(message.type()==='error')console.error('W25 CONSOLE ERROR',message.text());});
 page.on('requestfailed',request=>console.error('W25 REQUEST FAILED',request.url(),request.failure()?.errorText));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(250);
 console.log('W25 INITIAL APP',JSON.stringify((await page.locator('#app').innerText()).slice(0,350)));
 console.log('W25 MODULE DIAG',JSON.stringify(await page.evaluate(async()=>{const out=[];for(const f of ['./rosette-w25.js','./rosette-ui-w25.js','./app-w25.js']){try{await import(f);out.push({file:f,result:'ok'});}catch(e){out.push({file:f,result:e.stack||String(e)});}}return out;})));
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 await page.locator('#import-input').setInputFiles({name:'ROSETTE25.pdf',mimeType:'application/pdf',buffer:makePdf()});
 await page.locator('[data-action="open"][data-value="ROSETTE25.pdf"]').waitFor();
 await page.locator('[data-action="open"][data-value="ROSETTE25.pdf"]').click();
 await page.locator('.viewer-canvas').waitFor({timeout:16000});
 await page.locator('#viewer-stage').click({position:{x:450,y:320}});
 await page.locator('.viewer-annotate-btn').click();
 await page.locator('.pf-rosette').waitFor();
 assert.equal(await page.locator('.pf-rosette[data-level="root"] .pf-rose-petal').count(),8);
 assert.equal(await page.locator('.w23-annotation-toolbar').count(),0,'Legacy toolbar is initially collapsed');
 assert.equal(await page.locator('.pf-rosette-core').getAttribute('aria-expanded'),'true');
 const pick=async value=>page.locator('[data-action="rosette-option"][data-value="'+value+'"]').click();
 const level=()=>page.locator('.pf-rosette').getAttribute('data-level');
 await pick('pencil');
 assert.equal(await level(),'pencil','Pen petal opens its radial submenu');
 await pick('open-color');
 assert.equal(await level(),'pencil-color');
 await pick('color:#1b58a7');
 assert.equal(await level(),'pencil','Color returns to the pen submenu');
 await pick('open-width');
 await pick('thickness:5');
 assert.equal(await level(),'pencil');
 await page.locator('.pf-rosette-core').click();
 assert.equal(await level(),'root','Center returns to Android root');
 await pick('shape');
 assert.equal(await level(),'shape');
 await pick('open-type');
 assert.equal(await level(),'shape-type');
 await pick('shape:ellipse');
 assert.equal(await level(),'shape','Ellipse tool selected without opening legacy toolbar');
 await page.locator('.pf-rosette-core').click();
 assert.equal(await level(),'root');
 await pick('crop');
 assert.match(await page.locator('.toast').innerText(),/retall|recorte/i,'Unsupported crop is transparently explained');
 assert.equal(await level(),'root','Crop does not enable a broken tool');

 await pick('symbols');
 assert.equal(await level(),'symbols');
 await pick('category:dynamics');
 assert.equal(await level(),'symbol-picker');
 assert.equal(await page.locator('.pf-rosette .pf-rose-petal').count(),8);
 await pick('next');
 assert.equal(await page.locator('.pf-rosette .pf-rose-petal').count(),5);
 await pick('previous');
 await pick('symbol:mf');
 assert.equal(await level(),'symbols');
 // Center back navigates levels, then collapses flower but stays in annotation mode.
 await page.locator('.pf-rosette-core').click();
 assert.equal(await level(),'root');
 await page.locator('.pf-rosette-core').click();
 assert.equal(await page.locator('.pf-rosette').getAttribute('data-expanded'),'false');
 assert.equal(await page.locator('.pf-rosette .pf-rose-petal').count(),0);
 const b=await page.locator('.viewer-annotation-layer').boundingBox();
 assert(b?.width>100&&b?.height>100);
 await page.mouse.click(b.x+b.width*.72,b.y+b.height*.78);
 await page.waitForFunction(async()=>{
  const {getAnnotations}=await import('./db.js');
  return (await getAnnotations('ROSETTE25.pdf')).pages['1']?.some(x=>x.tool==='symbol'&&x.symbolId==='mf');
 },null,{timeout:12000});
 assert.equal(await page.locator('.annotation-symbol[data-symbol-id="mf"]').count(),1);
 await page.locator('.pf-rosette-core').click();
 assert.equal(await level(),'root');
 // Draggable center keeps the rosette on screen without rotating the PDF.
 const core=page.locator('.pf-rosette-core');
 const box=await core.boundingBox();
 const x=box.x+box.width/2,y=box.y+box.height/2;
 const original=await page.locator('.pf-rosette').getAttribute('style');
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x+95,y+24,{steps:14});await page.mouse.up();
 const moved=await page.locator('.pf-rosette').getAttribute('style');
 assert.notEqual(moved,original,'The center can be dragged to another location');
 assert.equal(await page.locator('.pf-rosette').getAttribute('data-expanded'),'true','Dragging must not accidentally click the center');
 // An escape key returns to previous level / collapses instead of closing the whole viewer.
 await pick('highlighter');
 await page.keyboard.press('Escape');
 assert.equal(await level(),'root');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.pf-rosette').getAttribute('data-expanded'),'false');
 assert.equal(await page.locator('.pf-reading-mode').count(),1);
 // The previous controls remain accessible for functions not yet rebuilt in the radial menu.
 await page.locator('[data-action="rosette-legacy"]').click();
 await page.locator('.w23-annotation-toolbar').waitFor();
 await page.locator('[data-action="annotation-group"][data-value="edit"]').click();
 await page.locator('[data-action="annotation-tool"][data-value="select"]').click();
 await page.locator('[data-action="rosette-legacy"]').click();
 assert.equal(await page.locator('.w23-annotation-toolbar').count(),0);
 await page.locator('.pf-rosette-dock .pf-rose-done').click();
 assert.equal(await page.locator('.pf-rosette').count(),0);
 assert.equal(await page.locator('.pf-reading-mode').count(),1);
 await page.reload();
 await page.locator('.viewer-canvas').waitFor({timeout:16000});
 assert.equal(await page.locator('.annotation-symbol[data-symbol-id="mf"]').count(),1,'Musical annotations persist');
 assert.deepEqual(errors,[],'No JavaScript errors');
 console.log('PASS W2.5: Android eight-petal rosette, radial submenus, color/width, symbols, center navigation, drag, Escape, legacy controls, score integrity');
 await context.close();
}finally{await browser.close();}
