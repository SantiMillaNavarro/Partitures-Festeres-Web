import {chromium, webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
function samplePdf(){
 const page1='BT /F1 30 Tf 58 715 Td (PARTITURES FESTERES - PAGINA 1) Tj ET';
 const page2='BT /F1 30 Tf 58 715 Td (PARTITURES FESTERES - PAGINA 2) Tj ET';
 const o=[
 '<</Type/Catalog/Pages 2 0 R>>',
 '<</Type/Pages/Kids[3 0 R 6 0 R]/Count 2>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>',
 '<</Length '+page1.length+'>>\nstream\n'+page1+'\nendstream',
 '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
 '<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 5 0 R>>>>/Contents 7 0 R>>',
 '<</Length '+page2.length+'>>\nstream\n'+page2+'\nendstream'
 ];
 let out='%PDF-1.4\n',offsets=[];
 for(let i=0;i<o.length;i++){offsets.push(out.length);out+=(i+1)+' 0 obj\n'+o[i]+'\nendobj\n'}
 const x=out.length;out+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n';
 for(const off of offsets)out+=String(off).padStart(10,'0')+' 00000 n \n';
 out+='trailer\n<</Root 1 0 R/Size '+(o.length+1)+'>>\nstartxref\n'+x+'\n%%EOF\n';
 return Buffer.from(out,'ascii');
}
await fs.mkdir('w124-screenshots',{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox']:[]});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
  const welcome=page.locator('[data-action="welcome-done"]');
  if(await welcome.count())await welcome.click();
  await page.locator('#import-input').setInputFiles({name:'PROVA.pdf',mimeType:'application/pdf',buffer:samplePdf()});
  await page.locator('[data-action="open"]').first().waitFor();
  await page.locator('[data-action="open"]').first().click();
  await page.locator('.viewer-canvas').waitFor({timeout:45000});
  await page.waitForFunction(()=>!document.querySelector('#viewer-stage')?.hasAttribute('aria-busy'),null,{timeout:45000});
  const initial=await page.evaluate(()=>{const a=document.querySelector('#viewer-stage').getBoundingClientRect(),b=document.querySelector('.viewer-sheet').getBoundingClientRect(),v=document.querySelector('.viewer');return{stage:[a.width,a.height],sheet:[b.width,b.height],zen:v.classList.contains('zen-mode'),pixels:document.querySelector('.viewer-canvas').width*document.querySelector('.viewer-canvas').height}});
  assert(initial.zen&&initial.pixels>10000&&initial.sheet[0]<=initial.stage[0]+2&&initial.sheet[1]<=initial.stage[1]+2,'portrait auto-fit');
  await page.screenshot({path:'w124-screenshots/'+name+'-portrait.png'});
  await page.locator('#viewer-stage').click({position:{x:190,y:430}});
  await page.waitForFunction(()=>!document.querySelector('.viewer').classList.contains('zen-mode'));
  await page.screenshot({path:'w124-screenshots/'+name+'-controls.png'});
  await page.locator('[data-action="viewer-page-next"]').click();
  await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent?.includes('2 / 2'));
  await page.locator('[data-action="viewer-zoom-in"]').click();
  await page.waitForFunction(()=>document.querySelector('#viewer-zoom-label')?.textContent==='125%');
  await page.locator('[data-action="viewer-rotate"]').click();
  await page.waitForFunction(()=>{const sh=document.querySelector('.viewer-sheet');return !!sh&&parseFloat(sh.style.width)>parseFloat(sh.style.height)});
  await page.locator('[data-action="viewer-close"]').click();
  await page.locator('[data-action="open"]').first().click();
  await page.locator('.viewer-canvas').waitFor();
  await page.waitForFunction(()=>document.querySelector('#viewer-zoom-label')?.textContent==='125%'&&document.querySelector('#viewer-page-counter')?.textContent?.includes('2 / 2'));
  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(600);
  await page.screenshot({path:'w124-screenshots/'+name+'-landscape.png'});
  await page.locator('#viewer-stage').click({position:{x:422,y:195}});
  // Ajustar a página: los dos estados de ajuste son accesibles.
  await page.locator('[data-action="viewer-fit"]').click();
  await page.locator('[data-action="viewer-fit"]').click();
  await page.waitForTimeout(550);
  const landscape=await page.evaluate(()=>{const a=document.querySelector('#viewer-stage').getBoundingClientRect(),b=document.querySelector('.viewer-sheet').getBoundingClientRect();return{stage:[a.width,a.height],sheet:[b.width,b.height]}});
  assert(landscape.sheet[0]<=landscape.stage[0]+2&&landscape.sheet[1]<=landscape.stage[1]+2,'landscape auto-fit');
  const drag=await page.evaluate(()=>{
   const stage=document.querySelector('#viewer-stage'),r=stage.getBoundingClientRect();
   const send=(type,id,x,y)=>stage.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',isPrimary:id===11,clientX:r.left+x,clientY:r.top+y,buttons:type==='pointerup'?0:1}));
   send('pointerdown',11,300,180);send('pointerdown',12,480,180);send('pointermove',11,270,180);send('pointermove',12,510,180);send('pointerup',12,510,180);send('pointerup',11,270,180);
   const sheet=document.querySelector('.viewer-sheet');return {scale:sheet?.style.transform,zoom:document.querySelector('#viewer-zoom-label')?.textContent};
  });
  assert(parseInt(drag.zoom)>=125,'pinch zoom');
  await page.screenshot({path:'w124-screenshots/'+name+'-pinch.png'});
  assert.deepEqual(errors,[],name+': browser JS errors');
  console.log('PASS '+name+' viewport portrait+landscape, page navigation, zoom+pinch, rotation, persistence');
  await ctx.close();
 }finally{await browser.close()}
}
