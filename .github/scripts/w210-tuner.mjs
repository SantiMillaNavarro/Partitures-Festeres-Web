import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {detectPitchYin,toPitchReading,normalizeReference,medianPitch} from '../../tuner-w210.js';
import {renderTunerMarkup,tunerNeedleCoords} from '../../tuner-ui-w210.js';

const rate=44100;
function sine(frequency,amplitude=.5){
 return Float32Array.from({length:4096},(_,n)=>amplitude*Math.sin(2*Math.PI*n*frequency/rate));
}
assert.equal(detectPitchYin(new Float32Array(4096),rate),null,'El silenci no ha de mostrar una nota falsa');
assert.equal(detectPitchYin(sine(440,.003),rate),null,'So per baix del llindar RMS');
for(const frequency of [65.406,110,220,440,880,1760]){
 const result=detectPitchYin(sine(frequency),rate);
 assert(result,'YIN ha de detectar '+frequency);
 assert(Math.abs(result.frequency-frequency)/frequency<.012,
  'Error de freqüència '+frequency+': '+result.frequency);
 assert(result.confidence>.72);
}
const reading=toPitchReading(442,442,1);
assert.equal(reading.noteName,'La');assert(reading.stable);assert(Math.abs(reading.cents)<.01);
assert.equal(toPitchReading(440,442,1).stable,false);
assert.equal(toPitchReading(440,442,1).noteName,'La');
assert.equal(normalizeReference(490),450);assert.equal(normalizeReference(400),430);
assert.equal(normalizeReference('invalid'),442);
assert.equal(medianPitch([220,440,225]),225);
assert.match(renderTunerMarkup({language:'va'}),/Historial d’afinació/);
assert.match(renderTunerMarkup({language:'es'}),/Historial de afinación/);
assert.equal(tunerNeedleCoords(-60).x,tunerNeedleCoords(-50).x);
assert.equal(tunerNeedleCoords(60).y,tunerNeedleCoords(50).y);

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:780}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.addInitScript(()=>{
  window.__tunerTest={requests:0,stops:0,closes:0,samples:0};
  const track={addEventListener(){},stop(){window.__tunerTest.stops++}};
  const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
   getUserMedia:async constraints=>{
    if(!constraints.audio||constraints.video!==false)throw Error('Àudio exclusiu');
    window.__tunerTest.requests++;return stream;
   }
  }});
  class FakeAudioContext{
   constructor(){this.sampleRate=44100;this.state='running';}
   async resume(){this.state='running';}
   createMediaStreamSource(){return {connect(){},disconnect(){}};}
   createAnalyser(){return {fftSize:4096,smoothingTimeConstant:0,
    getFloatTimeDomainData(out){
     window.__tunerTest.samples++;
     for(let i=0;i<out.length;i++)out[i]=.5*Math.sin(2*Math.PI*440*i/44100);
    }};}
   async close(){window.__tunerTest.closes++;this.state='closed';}
  }
  window.AudioContext=FakeAudioContext;window.webkitAudioContext=FakeAudioContext;
 });
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())
  await page.locator('[data-action="welcome-done"]').click();
 await page.locator('.bottom-nav [data-action="page"][data-value="tools"]').click();
 await page.locator('[data-action="tool-tab"][data-value="tuner"]').click();
 await page.locator('.pf-tuner-panel').waitFor();
 assert.equal(await page.locator('#tuner-reference').inputValue(),'442');
 await page.locator('[data-action="tuner-toggle"]').click();
 await page.waitForFunction(()=>document.getElementById('tuner-note')?.textContent==='La',{timeout:15000});
 assert.equal(await page.locator('[data-action="tuner-toggle"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>window.__tunerTest.requests),1);
 assert.match(await page.locator('#tuner-frequency').innerText(),/440/);
 await page.locator('#tuner-reference').evaluate(el=>{
  el.value='440';el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.waitForFunction(()=>document.getElementById('tuner-reference-output')?.textContent==='440');
 assert.match(await page.locator('#tuner-status').innerText(),/Afinat/);
 await page.locator('[data-action="tuner-clear"]').click();
 assert.equal(await page.locator('#tuner-history-line').getAttribute('d'),'');
 await page.locator('[data-action="tuner-reference-reset"]').click();
 assert.equal(await page.locator('#tuner-reference').inputValue(),'442');
 await page.locator('[data-action="tool-tab"][data-value="metronome"]').click();
 assert.equal(await page.evaluate(()=>window.__tunerTest.stops),1,'Aturar pistes al canviar de ferramenta');
 assert.equal(await page.evaluate(()=>window.__tunerTest.closes),1,'Tancar AudioContext al canviar');
 assert.equal(await page.locator('.pf-metro-panel').count(),1,'El metrònom original continua');
 await page.locator('[data-action="tool-tab"][data-value="tuner"]').click();
 await page.locator('[data-action="tuner-toggle"]').click();
 await page.waitForFunction(()=>document.getElementById('tuner-note')?.textContent==='La');
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>document.querySelector('[data-action="tuner-toggle"]')?.getAttribute('aria-pressed')==='false');
 assert.equal(await page.evaluate(()=>window.__tunerTest.stops),2);
 assert.equal(errors.length,0,'Errors JS navegador: '+JSON.stringify(errors));
 await page.reload();
 await page.locator('.pf-tuner-panel').waitFor({timeout:15000});
 assert.equal(await page.locator('[data-action="tuner-toggle"]').getAttribute('aria-pressed'),'false','Mai autoactivar micròfon');
 assert.equal(await page.locator('#tuner-reference').inputValue(),'442');
 console.log('PASS W2.10: notes YIN, calibratge, worker, història, privadesa i parada automàtica');
 await context.close();
}finally{await browser.close();}
