import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {NAVIGATION_KEY,NAVIGATION_VERSION,APP_PAGES,readNavigation,writeNavigation,snapshotNavigation,validateNavigation} from '../../navigation-state.js';

const items=[{path:'1er/Marxes/A.pdf'},{path:'1er/Marxes/ALT.pdf'},{path:'1er/Pasdobles/B.pdf'},{path:'2n/Marxes/C.pdf'}];
const repertoires=[{id:'rep_test123',name:'Actuació',paths:['1er/Marxes/A.pdf']}];
const sample={version:1,page:'library',paper:'1er',cwd:['Marxes'],repertoireId:'rep_test123',view:{path:'1er/Marxes/A.pdf',page:2},scrollY:476};
const valid=validateNavigation(sample,{scores:items,repertoires,paper:'1er'});
assert.deepEqual(valid,{page:sample.page,paper:sample.paper,cwd:sample.cwd,repertoireId:sample.repertoireId,view:sample.view,scrollY:sample.scrollY},'Library, folder, repertoire and PDF page can be restored');
assert.equal(validateNavigation({...sample,cwd:['Pasdobles','Inexistent']},{scores:items,repertoires,paper:'1er'}).cwd.join('/'),'Pasdobles','Keeps existing parent of a removed folder');
assert.deepEqual(validateNavigation(sample,{scores:items,repertoires,paper:'2n'}).cwd,[],'Paper change invalidates previous folder route');
assert.equal(validateNavigation({...sample,view:{path:'1er/Marxes/GONE.pdf',page:9}},{scores:items,repertoires,paper:'1er'}).view,null,'Missing PDF is not reopened');
assert.equal(validateNavigation({...sample,repertoireId:'rep_deleted'},{scores:items,repertoires,paper:'1er'}).repertoireId,null,'Missing repertory is not reopened');
assert.equal(validateNavigation({...sample,page:'evil'},{scores:items,repertoires,paper:'1er'}).page,'library','Unexpected screen falls back safely');
assert.equal(validateNavigation({...sample,view:{path:'1er/Marxes/A.pdf',page:-7}},{scores:items,repertoires,paper:'1er'}).view.page,1,'Invalid PDF page is clamped');
assert.equal(validateNavigation({...sample,version:999},{scores:items,repertoires,paper:'1er'}),null,'Unknown navigation state ignored');
assert.equal(validateNavigation(null,{scores:items,repertoires,paper:'1er'}),null);
assert.equal(snapshotNavigation({page:'index',paper:'root',cwd:[],view:null,repertoireOpen:null}).page,'index');
const fakeStorage={data:'',getItem(){return this.data;},setItem(_,v){this.data=v;}};
assert.equal(writeNavigation(fakeStorage,sample),true);
assert.deepEqual(readNavigation(fakeStorage),sample);
fakeStorage.data='{invalid';
assert.equal(readNavigation(fakeStorage),null,'Invalid storage never blocks startup');
assert.deepEqual(APP_PAGES,['library','repertoires','index','recents','favorites','tools','settings']);
assert.equal(validateNavigation({...sample,page:'tools'},{scores:items,repertoires,paper:'1er'}).page,'tools','Eines returns correctly after reload');
assert.equal(NAVIGATION_VERSION,1);

function pdf(){
 const t='BT /F1 28 Tf 60 710 Td (CONTINUAR LECTURA W221) Tj ET';
 const objects=[
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
  '<</Length '+t.length+'>>\nstream\n'+t+'\nendstream',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>'
 ];
 let s='%PDF-1.4\n';const offsets=[];
 for(let i=0;i<objects.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const start=s.length;s+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const o of offsets)s+=String(o).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(objects.length+1)+'>>\nstartxref\n'+start+'\n%%EOF\n','ascii');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 const scorePaths=['1er/Marxes/A.pdf',...Array.from({length:15},(_,i)=>'1er/Marxes/M'+String(i).padStart(2,'0')+'.pdf'),'1er/Pasdobles/B.pdf','2n/Marxes/C.pdf'];
 const zip=await page.evaluate(async({paths,base64})=>{
  const archive=new window.JSZip();
  for(const name of paths)archive.file(name,base64,{base64:true});
  return archive.generateAsync({type:'base64'});
 },{paths:scorePaths,base64:pdf().toString('base64')});
 await page.locator('#import-input').setInputFiles({name:'festeres.zip',mimeType:'application/zip',buffer:Buffer.from(zip,'base64')});
 await page.locator('[data-action="folder"][data-value="Marxes"]').waitFor({timeout:15000});
 await page.locator('[data-action="folder"][data-value="Marxes"]').click();
 assert.match(await page.locator('.crumb.last').innerText(),/Marxes/);
 assert.equal(await page.locator('.score-row').count(),16);

 // The folder, paper and scroll position survive pull-to-refresh / page.reload.
 await page.evaluate(()=>window.scrollTo(0,320));
 await page.waitForTimeout(250);
 const scrollBefore=await page.evaluate(()=>window.scrollY);
 assert(scrollBefore>100,'Long repertoire permits scrolling');
 const savedBefore=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),NAVIGATION_KEY);
 assert.equal(savedBefore.page,'library');
 assert.deepEqual(savedBefore.cwd,['Marxes']);
 await page.reload();
 await page.locator('.crumb.last').waitFor();
 assert.match(await page.locator('.crumb.last').innerText(),/Marxes/,'Restores current folder');
 assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),'library');
 assert.equal(await page.locator('.score-row').count(),16);
 await page.waitForFunction(y=>window.scrollY>=y-5,scrollBefore,{timeout:5000});
 
 // Reopen exactly the same score and original PDF page after refresh.
 const path='1er/Marxes/A.pdf';
 await page.locator('[data-action="open"][data-value="'+path+'"]').click();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 await page.locator('#viewer-stage').click({position:{x:193,y:360}});
 await page.locator('[data-action="viewer-page-next"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 2'));
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.view?.page===2,NAVIGATION_KEY);
 await page.reload();
 await page.locator('.viewer-canvas').waitFor({timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent.includes('2 / 2'));
 assert.equal(await page.locator('#viewer-stage').getAttribute('data-path'),path,'Same PDF is reopened');
 assert.equal(await page.locator('body.reading-pdf').count(),1,'Restored viewer remains in reading mode');
 await page.locator('#viewer-stage').click({position:{x:193,y:350}});
 await page.locator('[data-action="viewer-close"]').click();
 assert.match(await page.locator('.crumb.last').innerText(),/Marxes/,'Closing restored PDF returns to original folder');

 // A particular repertoire remains open, rather than returning to the repertoire list.
 await page.locator('.bottom-link[data-value="repertoires"]').click();
 await page.locator('[data-action="rep-create"]').click();
 await page.locator('#rep-name-input').fill('Concert de les Festes');
 await page.locator('[data-action="rep-save-name"]').click();
 await page.locator('.rep-head h3').waitFor();
 await page.reload();
 assert.equal(await page.locator('.rep-head h3').innerText(),'Concert de les Festes','Opened repertoire is restored');
 assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),'repertoires');

 // Every main application section persists, independently of temporary search/annotation modes.
 for(const tab of ['index','favorites','recents','settings']){
  await page.locator('.bottom-link[data-value="'+tab+'"]').click();
  await page.locator('.bottom-link.selected[data-value="'+tab+'"]').waitFor();
  await page.reload();
  await page.locator('.bottom-link.selected[data-value="'+tab+'"]').waitFor({timeout:15000});
  assert.equal(await page.locator('.bottom-link.selected').getAttribute('data-value'),tab,tab+' remains active');
 }
 assert.match(await page.locator('main.content').innerText(),/W2\.16/,'Updated version appears in Ajustos');

 // If a score was removed while the app was not in use, the old view is not reopened.
 await page.locator('.bottom-link[data-value="library"]').click();
 await page.locator('[data-action="folder"][data-value="Marxes"]').click();
 await page.locator('[data-action="open"][data-value="'+path+'"]').click();
 await page.locator('.viewer-canvas').waitFor();
 await page.evaluate(async()=>{const {deleteScore}=await import('./db.js');await deleteScore('1er/Marxes/A.pdf');});
 await page.reload();
 await page.locator('.bottom-link.selected[data-value="library"]').waitFor({timeout:15000});
 assert.equal(await page.locator('#viewer-stage').count(),0,'Removed PDF cannot trap user in a viewer');
 assert.equal(await page.locator('.score-row').count(),15,'Other PDFs remain intact');
 assert.deepEqual(errors,[],'No JavaScript errors');
 console.log('PASS W2.2.1: valid navigation recovery, folder, scroll, same PDF/page, repertoire, all sections, stale-score fallback');
 await ctx.close();
}finally{await browser.close();}
