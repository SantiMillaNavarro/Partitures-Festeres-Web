import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {buildIndexGroups} from '../../index-groups.js';

// Pure checks: title/path order, accent folding, missing data last, and paper-relative folders.
const sample=[
 {path:'1er/Mores/Z.pdf',metadata:{title:'Zeta',composer:'Ramón García',type:'Marxa mora',year:'2003'}},
 {path:'1er/Mores/A.pdf',metadata:{title:'Àlfa',composer:'Ramon Garcia',type:'Marxa mora',year:'1994'}},
 {path:'1er/Cristianes/B.pdf',metadata:{composer:'Miguel Mas',type:'Marxa cristiana',year:'2006'}},
 {path:'1er/Mores/S.pdf'}
];
assert.deepEqual(buildIndexGroups(sample,{groupBy:'composer'}).map(g=>[g.label,g.scores.length]),[['Miguel Mas',1],['Ramón García',2],['Sense dades',1]]);
assert.deepEqual(buildIndexGroups(sample,{groupBy:'folder',paper:'1er'}).map(g=>g.label),['Cristianes','Mores']);
assert.deepEqual(buildIndexGroups(sample,{groupBy:'type',sortBy:'year'}).find(g=>g.label==='Marxa mora').scores.map(s=>s.metadata.year),['1994','2003']);
assert.deepEqual(buildIndexGroups(sample,{groupBy:'year'}).map(g=>g.label),['1994','2003','2006','Sense dades']);
assert.deepEqual(buildIndexGroups([{path:'1er/ROOT.pdf'}],{paper:'1er'}).map(g=>g.label),['Sense carpeta']);

function makePdf(){
 const t='BT /F1 25 Tf 60 710 Td (PARTITURES FESTERES INDEX W13C) Tj ET';
 const o=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>','<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>','<</Length '+t.length+'>>\nstream\n'+t+'\nendstream','<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 let s='%PDF-1.4\n',offsets=[];
 for(let i=0;i<o.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n';}
 const pos=s.length;s+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const x of offsets)s+=String(x).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+pos+'\n%%EOF\n','ascii');
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 const paths=['1er/Marxes mores/ALMUGAVIR.pdf','1er/Marxes mores/MOROS MUSICS.pdf','1er/Marxes cristianes/BISCAINS.pdf','1er/Marxes mores/SENSE DADES.pdf','2n/Pasdobles/CIMO.pdf'];
 const zip=await page.evaluate(async ({paths,pdfBase64})=>{
  const zip=new window.JSZip();
  for(const path of paths)zip.file(path,pdfBase64,{base64:true});
  return zip.generateAsync({type:'base64'});
 },{paths,pdfBase64:makePdf().toString('base64')});
 await page.locator('#import-input').setInputFiles({name:'partitures.zip',mimeType:'application/zip',buffer:Buffer.from(zip,'base64')});
 await page.waitForFunction(()=>document.querySelector('.stats')?.textContent.includes('4'),{timeout:15000});
 await page.locator('.bottom-link[data-value="index"]').click();
 assert.equal(await page.locator('#index-group-by').inputValue(),'folder');
 assert.equal(await page.locator('.index-group').count(),2);
 assert.equal(await page.locator('.index-score-row').count(),4);
 const edit=async(path,metadata)=>{
  await page.locator('[data-action="meta-open"][data-value="'+path+'"]').click();
  for(const [key,value] of Object.entries(metadata))await page.locator('#meta-'+key).fill(value);
  await page.locator('[data-action="meta-save"]').click();
  await page.locator('.metadata-modal').waitFor({state:'detached'});
 };
 await edit(paths[0],{title:'Almugàvir',composer:'Ramón García',type:'Marxa mora',year:'1994'});
 await edit(paths[1],{composer:'Ramon Garcia',type:'Marxa mora',year:'2003'});
 await edit(paths[2],{composer:'Miguel Ángel Mas',type:'Marxa cristiana',year:'2006'});
 await page.selectOption('#index-group-by','composer');
 assert.equal(await page.locator('.index-group').count(),3,'Accent variants group together');
 assert.deepEqual(await page.locator('.index-group-toggle > span:not(.icon)').allTextContents(),['Miguel Ángel Mas','Ramón García','Sense dades']);
 assert.deepEqual(await page.locator('.index-group').nth(1).locator('.index-score-row').count(),2);
 // Group folding is visual only, leaving the catalog untouched.
 await page.locator('.index-group-toggle').nth(1).click();
 assert.equal(await page.locator('.index-group-toggle').nth(1).getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('.index-group').nth(1).locator('.index-group-items').isVisible(),false);
 await page.locator('[data-action="index-expand-all"]').click();
 assert.equal(await page.locator('.index-score-row:visible').count(),4);
 await page.locator('[data-action="index-collapse-all"]').click();
 assert.equal(await page.locator('.index-score-row:visible').count(),0);
 await page.locator('[data-action="index-expand-all"]').click();
 await page.selectOption('#index-group-by','type');
 await page.selectOption('#index-sort-by','year');
 assert.deepEqual(await page.locator('.index-group').filter({has:page.locator('.index-group-toggle span:text-is("Marxa mora")')}).locator('[data-action="open"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.value)),[paths[0],paths[1]]);
 // Both ordinary and advanced searches still filter Index groups.
 await page.locator('#search-input').fill('ALMUGAVIR');
 assert.equal(await page.locator('.index-group').count(),1);
 assert.equal(await page.locator('.index-score-row').count(),1);
 await page.locator('#search-input').fill('');
 await page.locator('[data-action="advanced-toggle"]').click();
 await page.locator('#adv-type').fill('mora');
 assert.equal(await page.locator('.index-score-row').count(),2);
 await page.locator('[data-action="advanced-clear"]').click();
 assert.equal(await page.locator('.index-score-row').count(),4);
 await page.selectOption('#index-group-by','year');
 assert.equal(await page.locator('.index-group').count(),4);
 // Paper switch retains grouping preference, but scopes results correctly.
 await page.locator('[data-action="paper"][data-value="2n"]').click();
 await page.locator('[data-action="paper"][data-value="2n"].active').waitFor();
 assert.equal(await page.locator('.index-score-row').count(),1);
 await page.locator('[data-action="paper"][data-value="root"]').click();
 await page.locator('[data-action="paper"][data-value="root"].active').waitFor();
 assert.equal(await page.locator('.index-score-row').count(),5);
 await page.reload();
 assert.equal(await page.locator('#index-group-by').count(),0,'Page restarts at Library');
 await page.locator('.bottom-link[data-value="index"]').click();
 assert.equal(await page.locator('#index-group-by').inputValue(),'year','Grouping preference survives reload');
 assert.equal(await page.locator('#index-sort-by').inputValue(),'year','Sorting preference survives reload');
 assert.equal(await page.locator('.index-score-row').count(),5,'No score lost');
 await page.locator('[data-action="meta-open"][data-value="'+paths[0]+'"]').click();
 assert.equal(await page.locator('#meta-composer').inputValue(),'Ramón García','Metadata stays unchanged');
 await page.locator('[data-action="close-modal"]').click();
 assert.deepEqual(errors,[], 'No browser JavaScript errors');
 console.log('PASS W1.3C: folders, accented composers, types, years, unknown metadata, sorting, folding, filters, papers, and persisted preferences');
 await ctx.close();
}finally{await browser.close();}
