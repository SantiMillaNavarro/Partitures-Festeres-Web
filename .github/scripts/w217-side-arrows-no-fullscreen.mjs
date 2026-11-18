import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const options={headless:true,args:['--no-sandbox']};
if(process.env.PF_CHROMIUM_PATH)options.executablePath=process.env.PF_CHROMIUM_PATH;
const browser=await chromium.launch(options);
try{
 const context=await browser.newContext({
  viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1
 });
 await context.addInitScript(()=>{
  window.__fullScreenAttempts=0;window.__orientationLockAttempts=0;
  Object.defineProperty(Element.prototype,'requestFullscreen',{
   configurable:true,value:function(){window.__fullScreenAttempts++;return Promise.reject(new Error('Fullscreen disabled by test'));}
  });
  try{
   if(screen.orientation)Object.defineProperty(screen.orientation,'lock',{
    configurable:true,value:()=>{
      window.__orientationLockAttempts++;
      return Promise.reject(new DOMException('Requires fullscreen','SecurityError'));
    }
   });
  }catch{}
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:18000});
 await page.locator('[data-action="welcome-done"]').click();
 await page.evaluate(async()=>{
  const {saveBatch,setPref}=await import('./db.js');
  const {assembleScanPdf}=await import('./scanner-pdf-w2133.js');
  const c=document.createElement('canvas');c.width=430;c.height=620;
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,430,620);
  ctx.fillStyle='#111';ctx.font='bold 26px Georgia';ctx.fillText('Marxa Cristiana',26,65);
  for(let i=0;i<20;i++)ctx.fillRect(35,90+i*23,360,2);
  const jpg=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.83));
  const image={bytes:new Uint8Array(await jpg.arrayBuffer()),width:430,height:620};
  const a=assembleScanPdf([image,image]),b=assembleScanPdf([image]);
  await saveBatch([
   {path:'A.pdf',blob:a,size:a.size,added:Date.now()},
   {path:'B.pdf',blob:b,size:b.size,added:Date.now()+1}
  ]);
  await setPref('w13:repertoires',[{id:'rep_concert',name:'Concert Fester',paths:['A.pdf','B.pdf']}]);
 });
 await page.reload();
 await page.locator('.bottom-link[data-value="library"]').click();
 await page.locator('.score-row [data-action="open"][data-value="A.pdf"]').click();
 const viewer=page.locator('.pf-reading-mode');
 const previous=page.locator('[data-action="viewer-edge-prev"]');
 const next=page.locator('[data-action="viewer-edge-next"]');
 const counter=page.locator('#viewer-page-counter');
 await page.waitForFunction(()=>{
  const canvas=document.querySelector('#viewer-stage canvas');
  return canvas?.width>0&&document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 2');
 },null,{timeout:20000});
 await page.waitForFunction(()=>document.querySelector('.pf-reading-mode')?.classList.contains('landscape-css-fallback'),
  null,{timeout:7000});
 const fullScreen=await page.evaluate(()=>({
  fullScreenAttempts:window.__fullScreenAttempts,
  orientationLockAttempts:window.__orientationLockAttempts,
  isFullScreen:!!document.fullscreenElement
 }));
 assert.equal(fullScreen.fullScreenAttempts,0,'Mai s’ha de sol·licitar pantalla completa en obrir PDF');
 assert.equal(fullScreen.isFullScreen,false);
 assert(fullScreen.orientationLockAttempts>=1,'Intentar rotació sense requerir fullscreen');
 assert.equal(await previous.count(),1);
 assert.equal(await next.count(),1);
 assert.equal(await previous.isDisabled(),true,'No es retrocedeix abans de la primera pàgina');
 assert.equal(await next.isEnabled(),true);
 assert(await next.isVisible(),'Fletxa a mode Zen');
 assert((await next.getAttribute('aria-label')).length>3,'Fletxa accessible');
 assert.equal(await next.evaluate(el=>getComputedStyle(el).pointerEvents),'auto');
 await next.click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent?.includes('2 / 2'),
  null,{timeout:20000});
 assert.equal(await previous.isEnabled(),true);
 assert.equal(await next.isDisabled(),false,'Hi ha encara una segona partitura disponible des de Biblioteca');
 await previous.click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 2'),null,{timeout:20000});
 // En editar anotacions, les fletxes no poden rebre tocs sobre el PDF.
 await page.locator('.viewer-annotate-btn').evaluate(button=>button.click());
 await page.waitForFunction(()=>document.querySelector('.pf-reading-mode')?.classList.contains('annotation-mode'));
 assert.equal(await next.isVisible(),false,'Fletxes ocultes durant anotacions');
 await page.locator('.viewer-annotate-btn').evaluate(button=>button.click());
 await page.waitForFunction(()=>!document.querySelector('.pf-reading-mode')?.classList.contains('annotation-mode'));
 assert(await next.isVisible(),'Fletxes tornen després d’anotar');
 await page.locator('[data-action="viewer-close"]').evaluate(button=>button.click());
 await viewer.waitFor({state:'detached'});
 await page.waitForFunction(()=>!history.state?.pfwebViewer,null,{timeout:7000});
 await page.reload(); // La sessió de lectura ja ha eixit de l'historial.
 // El retorn circular d'Actuació també ha de funcionar amb les fletxes laterals.
 await page.locator('.bottom-link[data-value="repertoires"]').click();
 await page.locator('.rep-entry[data-id="rep_concert"]').click();
 await page.locator('[data-action="rep-start"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-stage canvas')?.width>0&&
  document.querySelector('#viewer-stage')?.dataset.path==='A.pdf',null,{timeout:20000});
 await next.click();
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent?.includes('2 / 2'),null,{timeout:20000});
 await next.click();
 await page.waitForFunction(()=>document.querySelector('#viewer-stage')?.dataset.path==='B.pdf'&&
  document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 1'),null,{timeout:20000});
 assert.equal(await next.isEnabled(),true,'Última obra: volta circular encara disponible');
 await next.click();
 await page.waitForFunction(()=>document.querySelector('#viewer-stage')?.dataset.path==='A.pdf'&&
  document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 2'),null,{timeout:20000});
 assert.equal(await previous.isDisabled(),true,'Actuació no retrocedix circularment');
 assert.equal(await page.evaluate(()=>window.__fullScreenAttempts),0,'Cap pantalla completa durant actuació');
 assert.deepEqual(errors,[],'Errors JavaScript '+errors.join('\n'));
 console.log('PASS W2.17: sense fullscreen del navegador, indicadors horitzontal/vertical, Zen, anotacions i actuació circular');
 await context.close();
}finally{await browser.close();}
