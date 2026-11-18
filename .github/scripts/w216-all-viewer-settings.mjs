import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {VIEWER_SETTINGS_DEFAULTS,normalizeViewerSettings,sideTapAction,
 brightnessShadeOpacity,renderViewerSettings,ViewerWakeManager}
 from '../../viewer-advanced-settings-w216.js';

assert.deepEqual(normalizeViewerSettings(),VIEWER_SETTINGS_DEFAULTS);
assert.equal(normalizeViewerSettings({menuHideSeconds:99,sideTapFraction:.9,brightnessPercent:-10}).menuHideSeconds,10);
assert.equal(normalizeViewerSettings({sideTapFraction:.9}).sideTapFraction,.32);
assert.equal(normalizeViewerSettings({brightnessPercent:1}).brightnessPercent,20);
assert.equal(sideTapAction(.15,.22),'previous');
assert.equal(sideTapAction(.75,.32),'next');
assert.equal(sideTapAction(.5,.32),'menu');
assert.equal(brightnessShadeOpacity({overrideBrightness:true,brightnessPercent:40}),.48);
assert.equal(brightnessShadeOpacity(VIEWER_SETTINGS_DEFAULTS),0);
assert.match(renderViewerSettings(VIEWER_SETTINGS_DEFAULTS,'va'),/Ajustos avançats del visor/);
assert.match(renderViewerSettings(VIEWER_SETTINGS_DEFAULTS,'es'),/Ajustes avanzados del visor/);

let visible='visible',releases=0,requests=0;
const wake=new ViewerWakeManager({
 visibility:()=>visible,
 wakeLock:()=>({request:async()=>{requests++;return {release:async()=>{releases++;},addEventListener:()=>{}};}})
});
await wake.setEnabled(true);
assert.equal(requests,1);
visible='hidden';
await wake.onVisibilityChange();
assert.equal(releases,1);
visible='visible';
await wake.onVisibilityChange();
assert.equal(requests,2);
await wake.setEnabled(false);
assert.equal(releases,2);
await wake.setEnabled(true);
await wake.setEnabled(false);
assert.equal(releases,3,'Wake Lock es restaura i s’allibera al tancar');

const opts={headless:true,args:['--no-sandbox']};
if(process.env.PF_CHROMIUM_PATH)opts.executablePath=process.env.PF_CHROMIUM_PATH;
const browser=await chromium.launch(opts);
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>{
  window.__wakeMock={requests:0,releases:0};
  Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{
   request:async()=>{
    window.__wakeMock.requests++;
    const sentinel={
     released:false,
     async release(){
      if(!this.released){this.released=true;window.__wakeMock.releases++;}
     },
     addEventListener(){}
    };
    return sentinel;
   }
  }});
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();
 await page.evaluate(async()=>{
  const {saveBatch,setPref}=await import('./db.js');
  const {assembleScanPdf}=await import('./scanner-pdf-w2133.js');
  const c=document.createElement('canvas');c.width=300;c.height=455;
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,300,455);
  ctx.fillStyle='#222';ctx.font='25px serif';ctx.fillText('Pasdoble CIMO',17,41);
  for(let i=0;i<17;i++)ctx.fillRect(24,65+i*20,252,2);
  const jpg=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));
  const single={bytes:new Uint8Array(await jpg.arrayBuffer()),width:c.width,height:c.height};
  const pdf=assembleScanPdf([single,single,single]);
  await saveBatch([{path:'CIMO.pdf',blob:pdf,size:pdf.size,added:Date.now()}]);
  await setPref('viewer:CIMO.pdf',{page:2,zoom:2,fit:'page',rotationMode:'auto',rotation:0});
 });
 await page.locator('.bottom-link[data-value="settings"]').click();
 await page.locator('.pf-viewer-settings').waitFor();
 assert.equal(await page.locator('[data-viewer-setting]').count(),8);
 assert.equal(await page.locator('#pf-vs-menuHideSeconds').inputValue(),'3');
 assert.equal(await page.locator('#pf-vs-sideTapFraction').inputValue(),'0.22');
 assert.equal(await page.locator('#pf-vs-overrideBrightness').isChecked(),false);
 assert.equal(await page.locator('#pf-vs-brightness-options').isHidden(),true);
 const range=async(name,value)=>{
  await page.locator('#pf-vs-'+name).evaluate((element,val)=>{
    element.value=String(val);element.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
 };
 await range('menuHideSeconds',1);
 await range('sideTapFraction',.32);
 assert.equal(await page.locator('#pf-vs-out-sideTapFraction').innerText(),'32 %');
 assert.equal(await page.locator('.pf-vs-tap-left').evaluate(el=>el.style.flexBasis),'32%');
 await page.locator('#pf-vs-showScoreNameOnChange').check();
 await page.locator('#pf-vs-rememberZoom').uncheck();
 await page.locator('#pf-vs-keepScreenOn').uncheck();
 await page.locator('#pf-vs-allowViewerRotation').uncheck();
 await page.locator('#pf-vs-overrideBrightness').check();
 assert.equal(await page.locator('#pf-vs-brightness-options').isVisible(),true);
 await range('brightnessPercent',40);
 assert.match(await page.locator('.pf-vs-brightness-shade').getAttribute('style'),/0\.48/);
 await page.locator('[data-action="viewer-settings-save"]').click();
 await page.waitForFunction(async()=>{
  const {getPref}=await import('./db.js');
  return (await getPref('w216:viewerSettings'))?.brightnessPercent===40;
 });
 const prefs=await page.evaluate(async()=>{const {getPref}=await import('./db.js');return getPref('w216:viewerSettings');});
 assert.deepEqual(prefs,{
  menuHideSeconds:1,showScoreNameOnChange:true,rememberZoom:false,keepScreenOn:false,
  allowViewerRotation:false,sideTapFraction:.32,overrideBrightness:true,brightnessPercent:40
 });
 await page.reload();
 await page.locator('.bottom-link[data-value="settings"]').click();
 assert.equal(await page.locator('#pf-vs-menuHideSeconds').inputValue(),'1');
 assert.equal(await page.locator('#pf-vs-keepScreenOn').isChecked(),false);
 assert.equal(await page.locator('#pf-vs-brightnessPercent').inputValue(),'40');
 await page.locator('.bottom-link[data-value="library"]').click();
 await page.locator('[data-action="open"][data-value="CIMO.pdf"]').click();
 await page.locator('.viewer-intro:not(.hidden-intro)').waitFor({timeout:15000});
 await page.waitForFunction(()=>{
  const c=document.querySelector('#viewer-stage canvas');
  return c?.width>0&&document.querySelector('#viewer-page-counter')?.textContent?.includes('2 / 3');
 },null,{timeout:20000});
 assert.equal(await page.locator('#viewer-zoom-label').innerText(),'100%');
 assert.equal(await page.evaluate(()=>window.__wakeMock.requests),0,
  'Sense bloqueig quan Mantindre la pantalla encesa és inactiu');
 assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false,
  'Amb orientació lliure no se sol·licita pantalla completa');
 assert.match(await page.locator('.pf-viewer-light-shade').getAttribute('style'),/0\.48/);
 await page.locator('.viewer-intro.hidden-intro').waitFor({timeout:10000});
 const stage=page.locator('#viewer-stage');
 const point=async x=>{
  const rect=await stage.boundingBox();
  await page.mouse.click(rect.x+rect.width*x,rect.y+rect.height*.49);
 };
 await point(.25);
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent?.includes('1 / 3'));
 await point(.78);
 await page.waitForFunction(()=>document.querySelector('#viewer-page-counter')?.textContent?.includes('2 / 3'));
 await point(.5);
 await page.waitForFunction(()=>!document.querySelector('.viewer')?.classList.contains('zen-mode'));
 await page.waitForFunction(()=>document.querySelector('.viewer')?.classList.contains('zen-mode'),
  null,{timeout:4500});
 assert.equal(await page.evaluate(async()=>{
  const {getPref}=await import('./db.js');return (await getPref('viewer:CIMO.pdf')).zoom;
 }),2,'El zoom guardat prèviament no s’esborra quan es desactiva Recordar');
 await page.locator('[data-action="viewer-close"]').evaluate(el=>el.click());
 await page.locator('.viewer').waitFor({state:'detached'});
 await page.locator('.bottom-link[data-value="settings"]').click();
 await page.locator('#pf-vs-rememberZoom').check();
 await page.locator('#pf-vs-keepScreenOn').check();
 await page.locator('#pf-vs-showScoreNameOnChange').uncheck();
 await page.locator('#pf-vs-overrideBrightness').uncheck();
 await range('menuHideSeconds',10);
 await range('sideTapFraction',.12);
 await page.locator('[data-action="viewer-settings-save"]').click();
 await page.locator('.bottom-link[data-value="library"]').click();
 await page.locator('[data-action="open"][data-value="CIMO.pdf"]').click();
 await page.waitForFunction(()=>document.querySelector('#viewer-stage canvas')?.width>0,
  null,{timeout:20000});
 assert.equal(await page.locator('#viewer-zoom-label').innerText(),'200%');
 assert.equal(await page.locator('.viewer-intro.hidden-intro').count(),1);
 assert.match(await page.locator('.pf-viewer-light-shade').getAttribute('style'),/0\)/);
 await page.waitForFunction(()=>window.__wakeMock.requests>=1,null,{timeout:7000});
 await page.locator('[data-action="viewer-close"]').evaluate(el=>el.click());
 await page.waitForFunction(()=>window.__wakeMock.releases>=1,null,{timeout:7000});
 // Restablir els valors Android i persistir-los també després de reiniciar.
 await page.locator('.bottom-link[data-value="settings"]').click();
 await page.locator('[data-action="viewer-settings-reset"]').click();
 assert.equal(await page.locator('#pf-vs-menuHideSeconds').inputValue(),'3');
 assert.equal(await page.locator('#pf-vs-sideTapFraction').inputValue(),'0.22');
 assert.equal(await page.locator('#pf-vs-keepScreenOn').isChecked(),true);
 await page.locator('[data-action="viewer-settings-save"]').click();
 assert.deepEqual(await page.evaluate(async()=>{const {getPref}=await import('./db.js');return getPref('w216:viewerSettings');}),
  VIEWER_SETTINGS_DEFAULTS);
 assert.equal(errors.length,0,'Excepcions JavaScript: '+errors.join('\n'));
 console.log('PASS W2.16: huit ajustos, rangs, guardat/reinici, zoom, menús, zones 32%, Wake Lock, orientació, nom, llum visual i restauració');
 await context.close();
}finally{await browser.close();}
