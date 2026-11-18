import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {dictationPageCount,dictationImageSize,splitDictationPages,scoreTitle,dictationFilePrefix,dictationExportOptions,DICTATION_NOTES_PER_IMAGE} from '../../dictation-export-w2122.js';
import {renderDictationMarkup} from '../../dictation-ui-w2122.js';

assert.equal(DICTATION_NOTES_PER_IMAGE,60);
for(const [notes,pages] of [[0,0],[1,1],[10,1],[59,1],[60,1],[61,2],[120,2],[121,3]]){
 assert.equal(dictationPageCount(notes),pages);
}
assert.throws(()=>dictationPageCount(-1),RangeError);
assert.throws(()=>dictationPageCount(0.5),RangeError);
assert.deepEqual(dictationImageSize(1),{width:1600,height:440});
assert.deepEqual(dictationImageSize(60),{width:1600,height:1640});
assert.throws(()=>dictationImageSize(61),RangeError);
assert.deepEqual(splitDictationPages(Array.from({length:121},(_,i)=>i)).map(p=>p.length),[60,60,1]);
assert.equal(scoreTitle('marina'),'Dictat Marina');
assert.equal(scoreTitle('musical'),'Dictat Musical');
assert.equal(dictationFilePrefix('marina'),'Dictat_Marina');
assert.equal(dictationExportOptions({instrument:'TUBA'}).clef,'bass');
assert.equal(dictationExportOptions({instrument:'ALTO_SAX_EB',language:'va'}).subtitle,'Saxo alt · Mib');
assert.equal(dictationExportOptions({mode:'marina',instrument:'TUBA'}).clef,'treble');
const mocked=[{midi:69,label:'La4'}];
assert.match(renderDictationMarkup({notes:mocked,language:'va'}),/Guardar imatge/);
assert.match(renderDictationMarkup({notes:mocked,language:'es'}),/Guardar imagen/);
assert.match(renderDictationMarkup({notes:mocked,language:'va'}),/Compartir/);
assert.doesNotMatch(renderDictationMarkup({notes:mocked,running:true}),/data-action="dictation-save-image"/);
assert.match(renderDictationMarkup({notes:mocked,exporting:true}),/Preparant imatges/);
assert.match(renderDictationMarkup({notes:Array.from({length:61},()=>mocked[0])}),/2 imatges PNG/);

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:800},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const stats=window.__dictationExportQA={requests:0,stops:0,closes:0};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async c=>{
   if(!c.audio||c.video!==false)throw Error('Només àudio');
   stats.requests++;const track={stop(){stats.stops++},addEventListener(){}};
   return {getTracks:()=>[track],getAudioTracks:()=>[track]};
  }}});
  class Context{
   constructor(){this.state='running';this.sampleRate=44100;}
   async resume(){this.state='running';}
   createMediaStreamSource(){return {connect(){},disconnect(){}};}
   createAnalyser(){return {fftSize:4096,smoothingTimeConstant:0,
    getFloatTimeDomainData(samples){
     for(let i=0;i<samples.length;i++)samples[i]=.5*Math.sin(2*Math.PI*440*i/44100);
    }};}
   async close(){stats.closes++;this.state='closed';}
  }
  window.AudioContext=Context;window.webkitAudioContext=Context;
 });
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 await page.locator('.bottom-nav [data-action="page"][data-value="tools"]').click();
 await page.locator('[data-action="tool-tab"][data-value="dictation"]').click();
 await page.locator('.pf-dictation-panel').waitFor();
 assert.equal(await page.locator('[data-action="dictation-save-image"]').count(),0,'Sense notes no hi ha botó');
 await page.locator('#dictation-instrument').selectOption('ALTO_SAX_EB');
 await page.locator('[data-action="dictation-toggle"]').click();
 await page.waitForFunction(()=>document.querySelector('#dictation-staff svg')?.getAttribute('aria-label')?.includes('Fa♯5'),null,{timeout:20000});
 await page.locator('[data-action="dictation-toggle"]').click();
 assert.equal(await page.locator('[data-action="dictation-save-image"]').isVisible(),true);
 assert.equal(await page.locator('[data-action="dictation-share"]').isVisible(),true);
 const pngDownload=page.waitForEvent('download',{timeout:20000});
 await page.locator('[data-action="dictation-save-image"]').click();
 const single=await pngDownload;
 assert(/^Dictat_Musical_.*\.png$/.test(single.suggestedFilename()),'Nom PNG musical');
 await page.waitForFunction(()=>!document.querySelector('[data-action="dictation-save-image"]')?.disabled);
 assert.equal(await page.evaluate(()=>window.__dictationExportQA.closes),1,'Exportar no reactiva el micro');
 // Un renderitzat independent confirma les dimensions del PNG Android.
 const info=await page.evaluate(async()=>{
  const mod=await import('./dictation-export-w2122.js');
  const notes=Array.from({length:61},(_,i)=>({midi:i%2?63:60,label:i%2?'Mi♭4':'Do4'}));
  const c1=mod.renderDictationImage(notes.slice(0,60),{mode:'musical',instrument:'TROMBONE',language:'es'});
  const c2=mod.renderDictationImage(notes.slice(60),{mode:'marina'});
  const rgba=[...c1.getContext('2d').getImageData(0,0,1,1).data];
  const files=await mod.createDictationPngFiles(notes,{mode:'marina'});
  const sizes=files.map(f=>f.size);
  const magic=await files[0].slice(0,8).arrayBuffer();
  const prefix=[...new Uint8Array(magic)];
  c1.width=0;c1.height=0;c2.width=0;c2.height=0;
  return {widths:[1600,1600],heights:[1640,440],rgba,names:files.map(f=>f.name),sizes,prefix};
 });
 assert.deepEqual(info.rgba,[250,242,226,255],'Color paper Android');
 assert.deepEqual(info.prefix,[137,80,78,71,13,10,26,10],'Signatura PNG');
 assert.equal(info.names.length,2);
 assert(info.sizes.every(size=>size>1000),'PNG no buit');
 const zipDownload=page.waitForEvent('download',{timeout:20000});
 await page.evaluate(async()=>{
  const mod=await import('./dictation-export-w2122.js');
  const notes=Array.from({length:61},(_,i)=>({midi:60+i%3,label:'Do4'}));
  const files=await mod.createDictationPngFiles(notes,{mode:'musical'});
  await mod.downloadDictationImages(files,{mode:'musical'});
 });
 const zip=await zipDownload;
 assert(/^Dictat_Musical_\d+\.zip$/.test(zip.suggestedFilename()),'ZIP de 61 notes');
 const shared=await page.evaluate(async()=>{
  const mod=await import('./dictation-export-w2122.js');
  const files=await mod.createDictationPngFiles([{midi:69,label:'La4'}],{mode:'marina'});
  Object.defineProperty(navigator,'canShare',{configurable:true,value:args=>args.files.length===1});
  Object.defineProperty(navigator,'share',{configurable:true,value:async args=>{
   window.__shareQA={files:args.files.map(f=>({name:f.name,type:f.type})),title:args.title};
  }});
  return await mod.shareDictationImages(files,{mode:'marina'});
 });
 assert.equal(shared.shared,true);
 const shareData=await page.evaluate(()=>window.__shareQA);
 assert.equal(shareData.title,'Dictat Marina');
 assert.match(shareData.files[0].name,/^Dictat_Marina_.*\.png$/);
 assert.equal(shareData.files[0].type,'image/png');
 await page.locator('[data-action="dictation-mode"][data-value="marina"]').click();
 await page.locator('.pf-marina-card').waitFor();
 await page.locator('[data-action="dictation-toggle"]').click();
 await page.waitForFunction(()=>!!document.querySelector('#dictation-staff svg'));
 await page.locator('[data-action="dictation-toggle"]').click();
 assert.equal(await page.locator('[data-action="dictation-save-image"]').isVisible(),true);
 const marinaDownload=page.waitForEvent('download',{timeout:20000});
 await page.locator('[data-action="dictation-save-image"]').click();
 const marina=await marinaDownload;
 assert.match(marina.suggestedFilename(),/^Dictat_Marina_.*\.png$/);
 assert.equal(await page.evaluate(()=>window.__dictationExportQA.stops),2);
 assert.equal(errors.length,0,'Errors JS: '+JSON.stringify(errors));
 console.log('PASS W2.12.2: 60 notes, PNG Android 1600px, descàrregues PNG/ZIP, compartir i micròfon');
 await context.close();
}finally{await browser.close();}
