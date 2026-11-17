import {chromium} from 'playwright';
import assert from 'node:assert/strict';
function makePdf(){
 const v='BT /F1 24 Tf 80 700 Td (PARTITURES FESTERES TEST) Tj ET';
 const objs=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>','<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>','<</Length '+v.length+'>>\nstream\n'+v+'\nendstream','<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 let s='%PDF-1.4\n';const offsets=[];
 objs.forEach((o,i)=>{offsets.push(s.length);s+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});
 const start=s.length;s+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
 for(const n of offsets)s+=String(n).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(objs.length+1)+'>>\nstartxref\n'+start+'\n%%EOF\n','ascii');
}
const b=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,acceptDownloads:true});
 const p=await c.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://127.0.0.1:8765/');
 const welcome=p.locator('[data-action="welcome-done"]');if(await welcome.count())await welcome.click();
 const pdf=makePdf();await p.locator('#import-input').setInputFiles([{name:'ALMUGAVIR.pdf',mimeType:'application/pdf',buffer:pdf},{name:'BISCAINS.pdf',mimeType:'application/pdf',buffer:pdf}]);
 await p.locator('.score-row').first().waitFor();assert.equal(await p.locator('.score-row').count(),2);
 await p.locator('[data-action="favorite"][data-value="ALMUGAVIR.pdf"]').click();
 await p.locator('.bottom-link[data-value="favorites"]').click();assert.equal(await p.locator('.score-row').count(),1);
 await p.locator('.score-row [data-action="open"]').click();await p.locator('.viewer-canvas').waitFor();
 assert.equal(await p.locator('meta[name="theme-color"]').getAttribute('content'),'#ffffff');
 assert.equal(await p.locator('body.reading-pdf').count(),1);
 await p.locator('#viewer-stage').click({position:{x:195,y:425}});await p.locator('[data-action="viewer-close"]').click();
 assert.equal(await p.locator('meta[name="theme-color"]').getAttribute('content'),'#6b1722');
 await p.locator('.bottom-link[data-value="recents"]').click();assert.equal(await p.locator('.score-row').count(),1);
 await p.locator('.bottom-link[data-value="repertoires"]').click();await p.locator('[data-action="rep-create"]').click();
 await p.locator('#rep-name-input').fill('Concert de prova');await p.locator('[data-action="rep-save-name"]').click();
 assert.equal(await p.locator('.rep-head h3').innerText(),'Concert de prova');
 // Buscar desde el propio repertorio, cancelar y luego añadir varias partituras.
 await p.locator('[data-action="rep-add-open"]').click();
 await p.locator('#rep-add-search').fill('Alm');
 assert.equal(await p.locator('.rep-add-result').count(),1);
 await p.locator('.rep-add-result[data-value="ALMUGAVIR.pdf"]').click();
 assert.match(await p.locator('#rep-add-count').innerText(),/1 /);
 await p.locator('[data-action="close-modal"]').click();
 assert.equal(await p.locator('.score-row').count(),0,'Cancelación no modifica el repertorio');
 // Simular el caso de la captura: escribir Alm en la búsqueda del repertorio vacío.
 await p.locator('#search-input').fill('Alm');
 await p.locator('[data-action="rep-add-open"]').click();
 assert.equal(await p.locator('#rep-add-search').inputValue(),'','El selector tiene su propia búsqueda');
 await p.locator('#rep-add-search').fill('ALM');
 await p.locator('.rep-add-result[data-value="ALMUGAVIR.pdf"]').click();
 await p.locator('#rep-add-search').fill('bisc');
 assert.equal(await p.locator('.rep-add-result').count(),1,'Búsqueda en vivo');
 await p.locator('.rep-add-result[data-value="BISCAINS.pdf"]').click();
 assert.match(await p.locator('#rep-add-count').innerText(),/2 /,'Selección persiste entre búsquedas');
 await p.locator('[data-action="rep-add-confirm"]').click();
 await p.locator('.score-row').first().waitFor();
 assert.equal(await p.locator('#search-input').inputValue(),'','La búsqueda anterior se limpia para mostrar el repertorio');
 assert.equal(await p.locator('.score-row').count(),2,'Dos partituras añadidas sin salir del repertorio');
 await p.locator('[data-action="rep-add-open"]').click();
 await p.locator('#rep-add-search').fill('Alm');
 assert.equal(await p.locator('.rep-add-result[data-value="ALMUGAVIR.pdf"]:disabled').count(),1,'Evita duplicados');
 await p.locator('[data-action="close-modal"]').click();
 const order=()=>p.locator('.score-row [data-action="open"]').evaluateAll(a=>a.map(x=>x.dataset.value));
 assert.deepEqual(await order(),['ALMUGAVIR.pdf','BISCAINS.pdf']);
 await p.locator('[data-action="rep-up"][data-value="BISCAINS.pdf"]').click();
 await p.waitForFunction(()=>document.querySelector('.score-row [data-action="open"]')?.dataset.value==='BISCAINS.pdf');
 assert.deepEqual(await order(),['BISCAINS.pdf','ALMUGAVIR.pdf']);
 await p.reload();await p.locator('.rep-head h3').waitFor(); // W2.2.1: conserva el repertori obert
 assert.deepEqual(await order(),['BISCAINS.pdf','ALMUGAVIR.pdf']);
 await p.locator('.bottom-link[data-value="favorites"]').click();assert.equal(await p.locator('.score-row').count(),1);
 await p.locator('.bottom-link[data-value="recents"]').click();assert.equal(await p.locator('.score-row').count(),1);
 await p.locator('.bottom-link[data-value="settings"]').click();await p.locator('[data-action="backup-create"]').click();
 await p.locator('.backup-ready').waitFor({timeout:30000});assert.deepEqual(errs,[]);
 console.log('PASS W1.3A.1 picker: imported PDF, neutral viewer, favorites, recents, repertorios, ordering, persistence, backup');
 await c.close();
}finally{await b.close()}
