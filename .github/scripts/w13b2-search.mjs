import {chromium} from 'playwright';
import assert from 'node:assert/strict';
function pdf(){
 const t='BT /F1 25 Tf 60 710 Td (PARTITURES FESTERES W13B2) Tj ET';
 const o=['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>','<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>','<</Length '+t.length+'>>\nstream\n'+t+'\nendstream','<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
 let s='%PDF-1.4\n',offsets=[];
 for(let i=0;i<o.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n'}
 const pos=s.length;s+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const x of offsets)s+=String(x).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(s+'trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+pos+'\n%%EOF\n','ascii');
}
const b=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 const data=pdf();
 const files=['ALMUGAVIR.pdf','BISCAINS.pdf','MOROS MUSICS.pdf','SENSE DADES.pdf'];
 await page.locator('#import-input').setInputFiles(files.map(name=>({name,mimeType:'application/pdf',buffer:data})));
 await page.locator('.score-row').first().waitFor();
 assert.equal(await page.locator('.score-row').count(),4);
 const edit=async(name,m)=>{
  await page.locator('[data-action="meta-open"][data-value="'+name+'"]').click();
  for(const [key,value] of Object.entries(m))await page.locator('#meta-'+key).fill(value);
  await page.locator('[data-action="meta-save"]').click();
  await page.locator('.metadata-modal').waitFor({state:'detached'});
 };
 await edit('ALMUGAVIR.pdf',{title:'Almugàvir de festa',composer:'Ramón García',type:'Marxa mora',year:'1994'});
 await edit('BISCAINS.pdf',{composer:'Miguel Ángel Mas',type:'Marxa cristiana',year:'2006'});
 await edit('MOROS MUSICS.pdf',{composer:'Ramon Garcia',type:'Marxa mora',year:'2003'});
 assert.equal(await page.locator('[data-action="advanced-toggle"]').getAttribute('aria-expanded'),'false','Advanced search must be collapsed by default');
 // Preserve the original quick search.
 await page.locator('#search-input').fill('almugavir');
 assert.equal(await page.locator('.score-row').count(),1,'Quick search remains functional');
 await page.locator('#search-input').fill('');
 await page.locator('[data-action="advanced-toggle"]').click();
 assert.equal(await page.locator('[data-action="advanced-toggle"]').getAttribute('aria-expanded'),'true');
 // Case and accent-insensitive metadata matching, untagged scores excluded.
 await page.locator('#adv-composer').fill('RAMON');
 assert.equal(await page.locator('.score-row').count(),2,'Composer accents are normalized');
 await page.locator('#adv-type').fill('mora');
 assert.equal(await page.locator('.score-row').count(),2,'Composition type combines with composer');
 await page.locator('#adv-year-from').fill('2000');
 assert.equal(await page.locator('.score-row').count(),1,'From year restricts results');
 assert.equal(await page.locator('.score-row [data-action="open"]').first().getAttribute('data-value'),'MOROS MUSICS.pdf');
 await page.locator('#adv-year-to').fill('2005');
 assert.equal(await page.locator('.score-row').count(),1,'To year inclusive');
 // Combining ordinary search and advanced conditions.
 await page.locator('#search-input').fill('ALM');
 assert.equal(await page.locator('.score-row').count(),0);
 await page.locator('#search-input').fill('moro');
 assert.equal(await page.locator('.score-row').count(),1);
 await page.locator('#search-input').fill('');
 assert.equal(await page.locator('.score-row').count(),1);
 await page.locator('[data-action="advanced-toggle"]').click();
 assert.equal(await page.locator('.score-row').count(),1,'Hidden panel retains active filter');
 assert.match(await page.locator('[data-action="advanced-toggle"]').innerText(),/4/);
 await page.locator('[data-action="advanced-toggle"]').click();
 assert.equal(await page.locator('#adv-composer').inputValue(),'RAMON');
 await page.locator('[data-action="advanced-clear"]').click();
 assert.equal(await page.locator('.score-row').count(),4,'Clear filters restores full library');
 // Precise year search using inclusive bounds.
 await page.locator('#adv-year-from').fill('1994');
 await page.locator('#adv-year-to').fill('1994');
 assert.equal(await page.locator('.score-row').count(),1);
 assert.equal(await page.locator('.score-row [data-action="open"]').first().getAttribute('data-value'),'ALMUGAVIR.pdf');
 await page.locator('[data-action="advanced-clear"]').click();
 // Other sections: favorites, repertoire and grouped index.
 await page.locator('[data-action="favorite"][data-value="ALMUGAVIR.pdf"]').click();
 await page.locator('[data-action="favorite"][data-value="BISCAINS.pdf"]').click();
 await page.locator('.bottom-link[data-value="favorites"]').click();
 assert.equal(await page.locator('.score-row').count(),2);
 await page.locator('[data-action="advanced-toggle"]').click();
 await page.locator('#adv-type').fill('cristiana');
 assert.equal(await page.locator('.score-row').count(),1);
 assert.equal(await page.locator('.score-row [data-action="open"]').first().getAttribute('data-value'),'BISCAINS.pdf');
 await page.locator('.bottom-link[data-value="repertoires"]').click();
 await page.locator('[data-action="rep-create"]').click();
 await page.locator('#rep-name-input').fill('Prova de cercador');
 await page.locator('[data-action="rep-save-name"]').click();
 await page.locator('.bottom-link[data-value="library"]').click();
 for(const name of ['ALMUGAVIR.pdf','MOROS MUSICS.pdf'])await page.locator('[data-action="rep-pick"][data-value="'+name+'"]').click();
 await page.locator('.bottom-link[data-value="repertoires"]').click();
 assert.equal(await page.locator('.score-row').count(),2);
 await page.locator('[data-action="advanced-toggle"]').click();
 await page.locator('#adv-year-from').fill('2000');
 assert.equal(await page.locator('.score-row').count(),1);
 await page.locator('[data-action="rep-add-open"]').click();
 await page.locator('#rep-add-search').fill('BISC');
 assert.equal(await page.locator('.rep-add-result').count(),1,'Repertoire picker fast search is unchanged');
 await page.locator('[data-action="close-modal"]').click();
 await page.locator('.bottom-link[data-value="index"]').click();
 assert.equal(await page.locator('.advanced-search-panel').count(),0,'Changing section clears and closes advanced filters');
 await page.locator('[data-action="advanced-toggle"]').click();
 await page.locator('#adv-composer').fill('miguel');
 assert.equal(await page.locator('.index-score-row').count(),1,'Advanced filters work in grouped Index');
 // No persisted filters, data and metadata are untouched.
 await page.reload();
 assert.equal(await page.locator('.advanced-search-panel').count(),0);
 await page.locator('.bottom-link[data-value="library"]').click();
 assert.equal(await page.locator('.score-row').count(),4);
 await page.locator('[data-action="meta-open"][data-value="ALMUGAVIR.pdf"]').click();
 assert.equal(await page.locator('#meta-composer').inputValue(),'Ramón García');
 await page.locator('[data-action="close-modal"]').click();
 assert.deepEqual(errors,[],'No browser JS errors');
 console.log('PASS W1.3B.2: quick search, advanced filters, composers and types, year ranges, combined queries, section scoping, repertories and metadata persistence');
 await ctx.close();
}finally{await b.close()}
