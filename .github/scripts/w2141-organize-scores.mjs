import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {targetScorePath,scoreFolder,scoreStem,validFileStem,validFolderSegment,
 replaceReferencePath,moveCollectionReferences} from '../../score-organize-w2141.js';
import {renderOrganizeModal} from '../../score-organize-ui-w2141.js';

assert.equal(targetScorePath({name:'  Marxa CIMO.pdf  ',folder:'1er/Marxes'}),'1er/Marxes/Marxa CIMO.pdf');
assert.equal(targetScorePath({name:'Marxa CIMO',folder:'1er',newFolder:'Cristianes'}),'1er/Cristianes/Marxa CIMO.pdf');
assert.equal(targetScorePath({name:'A'}),'A.pdf');
assert.equal(scoreStem('1er/Marxes/Obra.pdf'),'Obra');
assert.equal(scoreFolder('1er/Marxes/Obra.pdf'),'1er/Marxes');
for(const name of ['', '   ', '../fuga','a/b','a\\b','a:b','..','x'.repeat(120)])assert.throws(()=>validFileStem(name));
for(const name of ['', '../b','a/b','.', '....','a\\b'])assert.throws(()=>validFolderSegment(name));
assert.deepEqual(replaceReferencePath(['old','other','old'],'old','new'),['new','other']);
assert.deepEqual(moveCollectionReferences({
 favorites:['old','alt'],recents:['other','old'],repertoires:[{id:'rep_x',name:'Festes',paths:['old','other']}]
},'old','new'),{
 favorites:['new','alt'],recents:['other','new'],repertoires:[{id:'rep_x',name:'Festes',paths:['new','other']}]
});
const html=renderOrganizeModal({score:{path:'Carpeta/Obra.pdf'},scores:[{path:'Carpeta/Obra.pdf'}],language:'va'});
assert.match(html,/Moure o renomenar partitura/);
assert.match(html,/Crear subcarpeta nova/);
assert.match(renderOrganizeModal({score:{path:'Obra.pdf'},language:'es'}),/Mover o renombrar partitura/);

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:820}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.stack||error.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();
 const initial=await page.evaluate(async()=>{
  const {saveBatch,setAnnotations,setPref}=await import('./db.js');
  const original=new TextEncoder().encode('%PDF-1.4\n/OriginalContent 123 test\n');
  const other=new TextEncoder().encode('%PDF-1.4\n/AnotherContent different\n');
  const stamp=Date.now();
  await saveBatch([
   {path:'1er/Pasdobles/Original.pdf',blob:new Blob([original],{type:'application/pdf'}),size:original.length,added:stamp,metadata:{title:'Pasdoble del poble',composer:'Pere Fester',year:'2024'}},
   {path:'1er/Marxes/Existent.pdf',blob:new Blob([other],{type:'application/pdf'}),size:other.length,added:stamp},
   {path:'1er/Pasdobles/Colisio.pdf',blob:new Blob([other],{type:'application/pdf'}),size:other.length,added:stamp}
  ]);
  await setAnnotations('1er/Pasdobles/Original.pdf',{
   version:1,pages:{1:[{tool:'pen',color:'#b51f34',width:.009,points:[[.1,.2],[.3,.4]]}]}
  });
  await setPref('viewer:1er/Pasdobles/Original.pdf',{page:4,zoom:1.7,fit:'width'});
  await setPref('w13:favorites',['1er/Pasdobles/Original.pdf']);
  await setPref('w13:recents',['1er/Pasdobles/Original.pdf']);
  await setPref('w13:repertoires',[{id:'rep_test',name:'Assaig',paths:['1er/Pasdobles/Original.pdf']}]);
  return true;
 });
 assert.equal(initial,true);
 await page.reload();
 const allTab=page.locator('[data-action="paper"][data-value="root"]');
 if(await allTab.count())await allTab.click();
 await page.locator('[data-action="folder"][data-value="1er"]').click();
 await page.locator('[data-action="folder"][data-value="Pasdobles"]').click();
 await page.locator('.score-row [data-action="meta-open"][data-value="1er/Pasdobles/Original.pdf"]').click();
 await page.locator('#metadata-dialog-title').waitFor();
 assert.match(await page.locator('#meta-composer').inputValue(),/Pere Fester/);
 assert.equal(await page.locator('[data-action="organize-open"]').count(),1);
 await page.locator('[data-action="organize-open"]').click();
 await page.locator('#organize-title').waitFor();
 assert.equal(await page.locator('#organize-name').inputValue(),'Original');
 await page.locator('#organize-name').fill('Nova Obra');
 await page.locator('#organize-folder').selectOption('1er/Marxes');
 await page.locator('#organize-new-folder').fill('2026');
 assert.match(await page.locator('#organize-target-preview').innerText(),/1er\/Marxes\/2026\/Nova Obra.pdf/);
 await page.locator('[data-action="organize-save"]').click();
 await page.locator('.modal-backdrop').waitFor({state:'detached',timeout:20000});
 await page.locator('.score-row [data-action="open"][data-value="1er/Marxes/2026/Nova Obra.pdf"]').waitFor();
 const verify=await page.evaluate(async()=>{
  const {getScore,getAnnotations,getPref}=await import('./db.js');
  const old=await getScore('1er/Pasdobles/Original.pdf');
  const next=await getScore('1er/Marxes/2026/Nova Obra.pdf');
  const notesOld=await getAnnotations('1er/Pasdobles/Original.pdf');
  const notesNew=await getAnnotations('1er/Marxes/2026/Nova Obra.pdf');
  const bytes=new TextDecoder().decode(await next.blob.arrayBuffer());
  return {old:!!old,next:!!next,bytes,meta:next.metadata,notesOld,notesNew,
   viewOld:await getPref('viewer:1er/Pasdobles/Original.pdf'),
   viewNew:await getPref('viewer:1er/Marxes/2026/Nova Obra.pdf'),
   favorites:await getPref('w13:favorites'),
   recents:await getPref('w13:recents'),
   repertoires:await getPref('w13:repertoires')};
 });
 assert.equal(verify.old,false,'No existeix el PDF antic després de migrar');
 assert.equal(verify.next,true,'Existeix el PDF al destí');
 assert.match(verify.bytes,/OriginalContent 123/,'Blob del PDF idèntic');
 assert.equal(verify.meta.composer,'Pere Fester');
 assert.equal(verify.meta.title,'Pasdoble del poble');
 assert.equal(verify.notesOld.pages['1'],undefined);
 assert.equal(verify.notesNew.pages['1'].length,1,'Les anotacions es mantenen al destí');
 assert.equal(verify.viewOld,null);
 assert.equal(verify.viewNew.page,4,'Pàgina de lectura conservada');
 assert.deepEqual(verify.favorites,['1er/Marxes/2026/Nova Obra.pdf']);
 assert.deepEqual(verify.recents,['1er/Marxes/2026/Nova Obra.pdf']);
 assert.deepEqual(verify.repertoires[0].paths,['1er/Marxes/2026/Nova Obra.pdf']);
 // La transacció impedeix sobreescriure un altre document encara que es força el trasllat per codi.
 const collision=await page.evaluate(async()=>{
  const {getScore,moveScoreSafely,getAnnotations}=await import('./db.js');
  const source='1er/Pasdobles/Colisio.pdf',target='1er/Marxes/2026/Nova Obra.pdf';
  const before=new TextDecoder().decode(await (await getScore(target)).blob.arrayBuffer());
  let message='';
  try{await moveScoreSafely(source,target);}catch(e){message=e.message;}
  const after=new TextDecoder().decode(await (await getScore(target)).blob.arrayBuffer());
  return {message,before,after,original:!!(await getScore(source)),annotations:(await getAnnotations(target)).pages};
 });
 assert.match(collision.message,/Ja existix/);
 assert.equal(collision.before,collision.after);
 assert.equal(collision.original,true);
 assert(collision.annotations['1']?.length===1);
 // Un canvi només de nom també ha de conservar les anotacions i els repertoris.
 const rename=await page.evaluate(async()=>{
  const {moveScoreSafely,getScore,getAnnotations,getPref}=await import('./db.js');
  const original='1er/Marxes/2026/Nova Obra.pdf';
  const next='1er/Marxes/2026/Nova Obra revisada.pdf';
  await moveScoreSafely(original,next);
  return {exists:!!(await getScore(next)),old:!!(await getScore(original)),
   notes:(await getAnnotations(next)).pages['1']?.length,
   favorites:await getPref('w13:favorites'),viewer:await getPref('viewer:'+next)};
 });
 assert.equal(rename.exists,true);assert.equal(rename.old,false);
 assert.equal(rename.notes,1);
 assert.deepEqual(rename.favorites,['1er/Marxes/2026/Nova Obra revisada.pdf']);
 assert.equal(rename.viewer.page,4);
 assert.equal(errors.length,0,'Errors JavaScript: '+errors.join('\n'));
 console.log('PASS W2.14.1: reanomenar, moure, carpeta nova, PDF, anotacions, metadades, favorits, recents, repertoris i col·lisions');
 await context.close();
}finally{await browser.close();}
