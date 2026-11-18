import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const options={headless:true,args:['--no-sandbox']};
if(process.env.PF_CHROMIUM_PATH)options.executablePath=process.env.PF_CHROMIUM_PATH;
const browser=await chromium.launch(options);
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1100,height:830}});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="paper-setup"]').first().waitFor({timeout:20000});
 const welcome=page.locator('[data-action="welcome-done"]');
 if(await welcome.isVisible())await welcome.click();
 const status=await page.evaluate(async()=>{
  const m=await import('./paper-roles-w220.js');
  const {saveBatch}=await import('./db.js');
  const {assembleScanPdf}=await import('./scanner-pdf-w2133.js');
  const assertLocal=(condition,msg)=>{if(!condition)throw Error(msg);};
  const m0=m.migrateOldPapers([
    '1r/Pasdobles/A.pdf','2n/Marxes/B.pdf','3r/Mores/C.pdf'
  ],'2n');
  assertLocal(m0.active==='role:2','No s’ha migrat la selecció antiga de 2n.');
  assertLocal(m0.config.roles.find(x=>x.id===3)?.path==='3r','No es migra 3r.');
  const m1=m.assignPaper(m0.config,3,'2n');
  assertLocal(m1.roles.find(x=>x.id===2)?.path===null,'Assignació duplicada no s’allibera.');
  assertLocal(m1.roles.find(x=>x.id===3)?.path==='2n','Assignació duplicada incorrecta.');
  const m2=m.removePaperRole(m1,3);
  assertLocal(m2.roles.length===2,'Eliminar 3r no ha mantingut 1r i 2n.');
  assertLocal(m.allFolderPaths([
    {path:'Saxo Alt/1r/Marxes/A.pdf'},{path:'Saxo Alt/1r/Pasdobles/B.pdf'}
  ]).includes('Saxo Alt/1r'),'No es detecten carpetes niades.');
  const cv=document.createElement('canvas');cv.width=280;cv.height=400;
  const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,280,400);
  cx.fillStyle='#181818';cx.fillText('Festa',12,26);
  const imageBlob=await new Promise(done=>cv.toBlob(done,'image/jpeg',.75));
  const bytes=new Uint8Array(await imageBlob.arrayBuffer());
  const pdf=assembleScanPdf([{bytes,width:280,height:400}]);
  const paths=[
   'Saxo Alt/1r/Marxes/A.pdf',
   'Saxo Alt/2n/Pasdobles/B.pdf',
   'Trompeta/3r/Mores/C.pdf',
   'Trompeta/4t/Festes/D.pdf'
  ];
  await saveBatch(paths.map(path=>({path,blob:pdf,size:pdf.size,added:Date.now()})));
  return {paths};
 });
 assert.equal(status.paths.length,4);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-action="paper-setup"]').first().waitFor({timeout:20000});
 assert.match(await page.locator('body').innerText(),/W2\.20/);
 await page.locator('[data-action="paper-setup"]').first().click();
 await page.locator('[data-action="paper-help"]').click();
 assert.match(await page.locator('#paper-help-title').innerText(),/Ajuda/);
 await page.locator('[data-action="paper-help-close"]').click();
 await page.locator('[data-action="paper-choose"][data-value="1"]').click();
 await page.locator('#paper-folder-search').fill('Saxo Alt/1r');
 assert(await page.locator('[data-action="paper-set-folder"][data-value="Saxo Alt/1r"]').count()>0,'Falta la carpeta niada.');
 await page.locator('[data-action="paper-set-folder"][data-value="Saxo Alt/1r"]').click();
 await page.locator('[data-action="paper-close"]').click();
 assert.match(await page.locator('.crumbs').innerText(),/1r/);
 assert(!/Saxo Alt/.test(await page.locator('.crumbs').innerText()),'Mostra una carpeta superior al paper.');
 assert.match(await page.locator('.cards').first().innerText(),/Marxes/);
 assert(!/Pasdobles/.test(await page.locator('.cards').first().innerText()),'El paper inclou PDF d’un altre paper.');
 await page.locator('[data-action="page"][data-value="index"]').first().click();
 assert.match(await page.locator('.index-group').first().innerText(),/Marxes/);
 assert(!/Saxo Alt/.test(await page.locator('.index-group').first().innerText()),'Índex no respecta arrel virtual.');
 await page.locator('[data-action="page"][data-value="library"]').first().click();
 await page.locator('[data-action="paper-setup"]').first().click();
 await page.locator('[data-action="paper-add"]').click();
 assert(await page.locator('[data-action="paper-choose"][data-value="3"]').count()===1,'No es crea 3r.');
 await page.locator('#paper-folder-search').fill('Trompeta/3r');
 await page.locator('[data-action="paper-set-folder"][data-value="Trompeta/3r"]').click();
 await page.locator('[data-action="paper-close"]').click();
 assert(await page.locator('[data-action="paper"][data-value="role:3"]').count()===1,'3r no apareix al selector.');
 assert.match(await page.locator('.cards').first().innerText(),/Mores/);
 await page.locator('[data-action="paper-setup"]').first().click();
 await page.locator('[data-action="paper-choose"][data-value="2"]').click();
 await page.locator('#paper-folder-search').fill('Saxo Alt/1r');
 await page.locator('[data-action="paper-set-folder"][data-value="Saxo Alt/1r"]').click();
 await page.locator('[data-action="paper-close"]').click();
 assert.equal(await page.locator('[data-action="paper"][data-value="role:1"]').count(),0,
   'Reassignar no elimina el vincle anterior.');
 assert.equal(await page.locator('[data-action="paper"][data-value="role:2"]').count(),1,
   'Reassignar no activa el paper nou.');
 await page.locator('[data-action="paper-setup"]').first().click();
 await page.locator('[data-action="paper-remove-ask"][data-value="3"]').click();
 assert.match(await page.locator('#paper-remove-title').innerText(),/3r/);
 await page.locator('[data-action="paper-remove-confirm"][data-value="3"]').click();
 await page.locator('[data-action="paper-close"]').click();
 assert.equal(await page.locator('[data-action="paper"][data-value="role:3"]').count(),0,
   'El 3r no ha desaparegut del selector.');
 const dbChecks=await page.evaluate(async()=>{
  const {getAllScores,getPref}=await import('./db.js');
  const {createBackup,inspectBackup,restoreBackup}=await import('./backup.js');
  const before=await getAllScores();
  const config=await getPref('w220:paperRoles');
  const active=await getPref('paper');
  const backup=await createBackup();
  const checked=await inspectBackup(backup.blob);
  const paperPref=checked.manifest.preferences.find(p=>p.key==='w220:paperRoles');
  const activePref=checked.manifest.preferences.find(p=>p.key==='paper');
  if(!paperPref||!activePref)throw Error('ZIP no conserva papers.');
  await restoreBackup(checked,'replace');
  const restored=await getPref('w220:paperRoles');
  if(JSON.stringify(restored)!==JSON.stringify(config))throw Error('Restauració no conserva assignacions.');
  return {
   count:before.length,
   active,activeAfter:await getPref('paper'),
   roles:config.roles,restoredRoles:restored.roles,
   files:checked.manifest.files.length,
   zipSize:backup.blob.size
  };
 });
 assert.equal(dbChecks.count,4,'Eliminar un paper ha eliminat PDF.');
 assert.equal(dbChecks.files,4,'La còpia ha perdut PDF.');
 assert.equal(dbChecks.active,'role:2');
 assert.equal(dbChecks.activeAfter,'role:2');
 assert.equal(dbChecks.roles.find(r=>r.id===1).path,null);
 assert.equal(dbChecks.roles.find(r=>r.id===2).path,'Saxo Alt/1r');
 assert.equal(dbChecks.roles.find(r=>r.id===3),undefined);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-action="paper-setup"]').first().waitFor({timeout:20000});
 assert.equal(await page.locator('[data-action="paper"][data-value="role:2"]').first().getAttribute('aria-pressed'),'true',
   'No es restaura el paper actiu al recarregar.');
 await page.locator('[data-action="paper"][data-value="root"]').first().click();
 assert(await page.locator('.cards').first().innerText().then(s=>s.includes('Saxo Alt')),
   'Arrel real no mostra les carpetes superiors.');
 assert.deepEqual(errors,[],'Excepcions JavaScript: '+errors.join('\n'));
 console.log('PASS W2.20: migration 1r-3r, nested virtual roots, Index, dynamic role, folder search, duplicate reassign, safe removal, ZIP restore, persistence.',dbChecks);
 await context.close();
}finally{await browser.close();}
