import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {ScoreViewer} from '../../viewer-w261.js';
import {validInlineText} from '../../inline-text-w261.js';

assert.equal(validInlineText('Música festera'),true);
const events=[];
const mock=Object.create(ScoreViewer.prototype);
mock.host={clientWidth:900,clientHeight:600,setPointerCapture(){}};
mock.pointers=new Map();mock.gesture=null;mock.lastTap=null;mock.zoom=1;
mock.pageW=880;mock.pageH=580;mock.native=false;mock.closed=false;mock.page={};
mock.localPoint=e=>({x:e.x,y:e.y});
mock.onToggleControls=()=>events.push('controls');
mock.onDoubleTap=()=>events.push('rosette');
mock.focusZoom=()=>events.push('zoom');
mock.turnPage=()=>events.push('page');
const evt=(type,x,y)=>({type,x,y,pointerId:1,pointerType:'mouse',button:0,preventDefault(){}});
mock.pointerDown(evt('pointerdown',450,320));mock.pointerUp(evt('pointerup',450,320));
mock.pointerDown(evt('pointerdown',454,323));mock.pointerUp(evt('pointerup',454,323));
assert.deepEqual(events,['controls','rosette'],'Double tap must open rosette and never zoom');

function pdf(){
 const t='BT /F1 24 Tf 60 690 Td (PARTITURES FESTERES W261) Tj ET';
 const o=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
 '<</Length '+t.length+'>>\nstream\n'+t+'\nendstream',
 '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>'];
 let s='%PDF-1.4\n';const pos=[];
 for(let i=0;i<o.length;i++){pos.push(s.length);s+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n';}
 const begin=s.length;s+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const p of pos)s+=String(p).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+begin+'\n%%EOF\n','ascii');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1100,height:760},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 await page.locator('#import-input').setInputFiles({name:'GESTOS_W261.pdf',mimeType:'application/pdf',buffer:pdf()});
 await page.locator('[data-action="open"][data-value="GESTOS_W261.pdf"]').waitFor();
 await page.locator('[data-action="open"][data-value="GESTOS_W261.pdf"]').click();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 const prior=await page.locator('#viewer-zoom-label').textContent();
 await page.locator('#viewer-stage').dblclick({position:{x:440,y:320}});
 await page.locator('.pf-rosette-dock [data-action="rosette-pan"]').waitFor();
 assert.equal(await page.locator('#viewer-zoom-label').textContent(),prior,'Double click must not zoom');
 assert.equal(await page.locator('[data-action="rosette-pan"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.viewer-annotation-layer').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 // Pan with the rosette open. Use enough zoom for the sheet to exceed the viewport.
 for(let i=0;i<5;i++)await page.locator('[data-action="viewer-zoom-in"]').click();
 const before=await page.locator('.viewer-sheet').evaluate(el=>el.style.transform);
 const b=await page.locator('#viewer-stage').boundingBox();
 await page.mouse.move(b.x+170,b.y+485);await page.mouse.down();
 await page.mouse.move(b.x+240,b.y+420,{steps:12});await page.mouse.up();
 const after=await page.locator('.viewer-sheet').evaluate(el=>el.style.transform);
 assert.notEqual(before,after,'The score must pan with rosette open');
 // Choosing Text restores annotation capture. Refit to see the page again.
 await page.locator('[data-action="viewer-fit"]').click();
 await page.locator('[data-action="rosette-option"][data-value="text"]').click();
 assert.equal(await page.locator('[data-action="rosette-pan"]').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('.viewer-annotation-layer').evaluate(el=>getComputedStyle(el).pointerEvents),'auto');
 const layer=await page.locator('.viewer-annotation-layer').boundingBox();
 await page.mouse.click(layer.x+layer.width*.17,layer.y+layer.height*.20);
 await page.locator('.pf-inline-input').waitFor();
 assert.equal(await page.locator('.pf-inline-input').evaluate(el=>document.activeElement===el),true,'Textarea focused directly');
 await page.locator('.pf-inline-input').fill('Text sense salts de teclat');
 await page.locator('.pf-inline-input').evaluate(el=>el.dataset.stableW261='ok');
 await page.setViewportSize({width:1100,height:600});
 await page.waitForTimeout(500);
 assert.equal(await page.locator('.pf-inline-input').evaluate(el=>el.dataset.stableW261),'ok');
 assert.equal(await page.locator('.pf-inline-input').evaluate(el=>document.activeElement===el),true,'Keep focus during keyboard-like viewport resize');
 await page.locator('.pf-inline-input').press('End');
 await page.keyboard.type(' estable');
 assert.equal(await page.locator('.pf-inline-input').inputValue(),'Text sense salts de teclat estable');
 await page.locator('[data-inline="save"]').click();
 await page.locator('.pf-inline-text-editor').waitFor({state:'detached'});
 await page.waitForFunction(async()=>{const {getAnnotations}=await import('./db.js');return (await getAnnotations('GESTOS_W261.pdf')).pages['1']?.some(a=>a.text==='Text sense salts de teclat estable');});
 assert.deepEqual(errors,[]);
 console.log('PASS W2.6.1: double click without zoom, pan mode, text selection and stable keyboard focus');
 await context.close();
}finally{await browser.close();}
