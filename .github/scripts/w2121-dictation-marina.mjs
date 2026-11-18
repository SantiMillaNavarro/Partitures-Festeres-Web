import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {DictationCapture,DICTATION_INSTRUMENTS,writtenMidi,midiLabel,normalizeMarinaMidi,staffPlacement} from '../../dictation-model-w2121.js';
import {dictationStaffSVG,renderDictationMarkup} from '../../dictation-ui-w2121.js';
import {detectPitchYin} from '../../tuner-w210.js';

assert.equal(DICTATION_INSTRUMENTS.length,16);
assert.deepEqual(DICTATION_INSTRUMENTS.filter(x=>x.clef==='bass').map(x=>x.id),['BASSOON','TROMBONE','EUPHONIUM','TUBA']);
for(const [id,expected] of [['CONCERT_TREBLE',69],['CLARINET_BB',71],['ALTO_SAX_EB',78],['TENOR_SAX_BB',83],['BARITONE_SAX_EB',90],['PICCOLO',57]]) {
 assert.equal(writtenMidi(69,id),expected,id);
}
assert.equal(writtenMidi(107,'BARITONE_SAX_EB'),108);
assert.equal(midiLabel(69),'La4');
assert.equal(midiLabel(78),'Fa♯5');
assert.equal(normalizeMarinaMidi(45),69);
assert.equal(staffPlacement(61).accidental,'♯');
assert.equal(staffPlacement(63).accidental,'♭');
const musical=new DictationCapture();
assert.equal(musical.step(69,100),null);
assert.equal(musical.step(69,249),null);
assert.deepEqual(musical.step(69,250),{midi:69,label:'La4'});
assert.equal(musical.step(69,400),null);
assert.equal(musical.step(null,800),null);
assert.equal(musical.step(69,801),null);
assert.deepEqual(musical.step(69,951),{midi:69,label:'La4'});
const marina=new DictationCapture({mode:'marina'});
assert.equal(marina.step(57,100),null);
assert.deepEqual(marina.step(57,170),{midi:69,label:'La4'});
assert.equal(marina.step(57,380),null);
assert.deepEqual(marina.step(57,390),{midi:69,label:'La4'});
assert.equal(marina.step(null,600),null);
assert.equal(marina.step(57,610),null);
assert.deepEqual(marina.step(57,680),{midi:69,label:'La4'});
assert.match(dictationStaffSVG([{midi:60,label:'Do4'}]),/role="img"/);
assert.match(dictationStaffSVG([{midi:60,label:'Do4'}]),/𝄞/);
assert.match(dictationStaffSVG([{midi:43,label:'Sol2'}],{clef:'bass'}),/𝄢/);
assert.match(renderDictationMarkup({language:'va',mode:'marina'}),/Dictat Marina/);
assert.match(renderDictationMarkup({language:'es'}),/Iniciar dictado/);
assert.match(renderDictationMarkup({language:'va'}),/negres/);
const sample=Float32Array.from({length:4096},(_,i)=>.5*Math.sin(2*Math.PI*440*i/44100));
assert(Math.abs(detectPitchYin(sample,44100).frequency-440)<3);

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext({viewport:{width:390,height:800}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.addInitScript(()=>{
  window.__dictationQA={requests:0,stops:0,closes:0,samples:0,hz:440};
  const q=window.__dictationQA;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async c=>{
   if(!c.audio||c.video!==false)throw Error('Exclusivament àudio');
   q.requests++;
   const track={addEventListener(){},stop(){q.stops++}};
   return {getTracks:()=>[track],getAudioTracks:()=>[track]};
  }}});
  class FakeContext{
   constructor(){this.sampleRate=44100;this.state='running';}
   async resume(){this.state='running';}
   createMediaStreamSource(){return {connect(){},disconnect(){}};}
   createAnalyser(){return {fftSize:4096,smoothingTimeConstant:0,getFloatTimeDomainData(out){
    q.samples++;
    for(let i=0;i<out.length;i++)out[i]=.5*Math.sin(2*Math.PI*q.hz*i/44100);
   }};}
   async close(){q.closes++;this.state='closed';}
  }
  window.AudioContext=FakeContext;window.webkitAudioContext=FakeContext;
 });
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())
  await page.locator('[data-action="welcome-done"]').click();
 await page.locator('.bottom-nav [data-action="page"][data-value="tools"]').click();
 await page.locator('[data-action="tool-tab"][data-value="dictation"]').click();
 await page.locator('.pf-dictation-panel').waitFor();
 assert.equal(await page.locator('#dictation-instrument option').count(),16);
 await page.locator('#dictation-instrument').selectOption('ALTO_SAX_EB');
 await page.locator('[data-action="dictation-toggle"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action="dictation-toggle"]')?.getAttribute('aria-pressed')==='true');
 await page.waitForFunction(()=>document.getElementById('dictation-current')?.textContent==='Fa♯5');
 await page.waitForFunction(()=>!!document.querySelector('#dictation-staff svg'));
 assert.match(await page.locator('#dictation-staff svg').getAttribute('aria-label'),/Fa♯5/);
 assert.equal(await page.locator('#dictation-instrument').isDisabled(),true);
 assert.equal(await page.evaluate(()=>window.__dictationQA.requests),1);
 await page.locator('[data-action="dictation-toggle"]').click();
 assert.equal(await page.evaluate(()=>window.__dictationQA.stops),1);
 assert.equal(await page.evaluate(()=>window.__dictationQA.closes),1);
 await page.locator('[data-action="dictation-mode"][data-value="marina"]').click();
 await page.locator('.pf-marina-card').waitFor();
 assert.equal(await page.locator('#dictation-staff svg').count(),0,'Canvi de mode neteja notes');
 await page.locator('.pf-marina-avatar img').evaluate(async img=>{
  if(!img.complete)await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});
  if(img.naturalWidth<50)throw Error('Falta Marina');
 });
 await page.evaluate(()=>window.__dictationQA.hz=220);
 await page.locator('[data-action="dictation-toggle"]').click();
 await page.waitForFunction(()=>document.querySelector('#dictation-staff svg')?.getAttribute('aria-label')?.includes('La4'));
 await page.waitForFunction(()=>document.querySelector('#dictation-staff svg')?.getAttribute('aria-label')?.includes('La4, La4'));
 await page.locator('[data-action="tool-tab"][data-value="tuner"]').click();
 assert.equal(await page.evaluate(()=>window.__dictationQA.stops),2);
 assert.equal(await page.evaluate(()=>window.__dictationQA.closes),2);
 assert.equal(await page.locator('.pf-tuner-panel').count(),1);
 await page.locator('[data-action="tool-tab"][data-value="dictation"]').click();
 assert.equal(await page.locator('[data-action="dictation-toggle"]').getAttribute('aria-pressed'),'false');
 await page.locator('[data-action="dictation-mode"][data-value="musical"]').click();
 assert.equal(await page.locator('#dictation-instrument').inputValue(),'ALTO_SAX_EB');
 await page.reload();
 await page.locator('.pf-metro-panel').waitFor();
 await page.locator('[data-action="tool-tab"][data-value="dictation"]').click();
 assert.equal(await page.locator('#dictation-instrument').inputValue(),'ALTO_SAX_EB');
 assert.equal(await page.locator('[data-action="dictation-toggle"]').getAttribute('aria-pressed'),'false');
 assert.equal(errors.length,0,'Errors JS: '+errors.join(','));
 console.log('PASS W2.12.1: 16 instruments, transposició, YIN, pentagrama, Marina original, micròfon i ciclo de vida');
 await context.close();
}finally{await browser.close();}
