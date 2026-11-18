import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {REFERENCE_NOTE_NAMES,REFERENCE_SHORTCUTS,referenceLabel,referenceFrequency,
 validReferenceSelection,ReferenceToneEngine} from '../../reference-tone-w211.js';
import {renderReferenceToneMarkup} from '../../reference-tone-ui-w211.js';
import {ReferenceToneController} from '../../reference-tone-controller-w211.js';

assert.equal(REFERENCE_NOTE_NAMES.length,12);
assert.deepEqual(REFERENCE_SHORTCUTS.map(n=>n.label),['La4','Sib3','Sib4']);
assert.equal(referenceLabel(9,4),'La4');
assert.equal(referenceLabel(10,3),'Sib3');
assert.equal(referenceFrequency(9,4,442),442);
assert.equal(referenceFrequency(9,3,442),221);
assert.equal(referenceFrequency(9,5,442),884);
assert(Math.abs(referenceFrequency(0,4,440)-261.62556)<.02);
assert.equal(validReferenceSelection(11,6),true);
assert.equal(validReferenceSelection(12,6),false);
assert.equal(validReferenceSelection(0,7),false);
assert.throws(()=>referenceFrequency(12,4,442),RangeError);
assert.throws(()=>referenceFrequency(9,4,700),RangeError);
assert.match(renderReferenceToneMarkup({language:'va'}),/Referència d’afinació/);
assert.match(renderReferenceToneMarkup({language:'es'}),/Referencia de afinación/);

const stats={starts:0,stops:0,closes:0,resumes:0,frequencies:[],harmonics:[],volumes:[]};
class Param{
 setValueAtTime(value){this.value=value;stats.frequencies.push(value);}
 linearRampToValueAtTime(v){stats.volumes.push(v);}
 cancelScheduledValues(){}
 setTargetAtTime(value){this.value=value;stats.frequencies.push(value);}
}
class FakeAudioContext{
 constructor(){this.state='suspended';this.currentTime=0;this.destination={};}
 async resume(){this.state='running';stats.resumes++;}
 createPeriodicWave(real,imag,opts){stats.harmonics.push([...imag]);assert.equal(opts.disableNormalization,true);return {};}
 createGain(){return {gain:new Param(),connect(){},disconnect(){}};}
 createOscillator(){return {frequency:new Param(),setPeriodicWave(){},connect(){},disconnect(){},
  start(){stats.starts++;},stop(){stats.stops++;}};}
 async close(){this.state='closed';stats.closes++;}
}
const engine=new ReferenceToneEngine({AudioContextClass:FakeAudioContext});
assert.equal(await engine.start(442),true);
assert.equal(engine.running,true);
assert.deepEqual(stats.harmonics[0],[0,.82,.13,.05]); // Pes dels tres harmònics d'Android.
assert(stats.volumes.includes(.34));
assert.equal(engine.setFrequency(440),true);
assert.equal(stats.starts,1,'Canviar de nota no reinicia el motor');
assert.equal(stats.frequencies.at(-1),440);
engine.stop();
assert.equal(stats.stops,1);
assert.equal(stats.closes,1);
assert.equal(engine.running,false);

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:780}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.addInitScript(()=>{
  window.__referenceTest={starts:0,stops:0,closes:0,resumes:0,freq:[],harmonics:[],amplitudes:[]};
  const stats=window.__referenceTest;
  class Param{
   setValueAtTime(v){this.value=v;stats.freq.push(v);}
   linearRampToValueAtTime(v){stats.amplitudes.push(v);}
   cancelScheduledValues(){}
   setTargetAtTime(v){this.value=v;stats.freq.push(v);}
  }
  class Context{
   constructor(){this.sampleRate=44100;this.state='suspended';this.currentTime=0;this.destination={};}
   async resume(){this.state='running';stats.resumes++;}
   createPeriodicWave(real,imag,options){stats.harmonics.push({data:[...imag],normalize:options.disableNormalization});return {};}
   createGain(){return {gain:new Param(),connect(){},disconnect(){}};}
   createOscillator(){return {frequency:new Param(),setPeriodicWave(){},connect(){},disconnect(){},
    start(){stats.starts++;},stop(){stats.stops++;}};}
   async close(){stats.closes++;this.state='closed';}
  }
  window.AudioContext=Context;window.webkitAudioContext=Context;
 });
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 await page.locator('.bottom-nav [data-action="page"][data-value="tools"]').click();
 await page.locator('[data-action="tool-tab"][data-value="reference"]').click();
 await page.locator('.pf-reference-panel').waitFor();
 assert.equal(await page.locator('[data-action="reference-note"]').count(),12);
 assert.equal(await page.locator('[data-action="reference-octave"]').count(),5);
 assert.equal(await page.locator('[data-action="reference-shortcut"]').count(),3);
 assert.equal(await page.locator('#reference-note-label').innerText(),'La4');
 assert.equal(await page.locator('#reference-frequency').innerText(),'442.00 Hz');
 assert.equal(await page.locator('[data-action="reference-toggle"]').getAttribute('aria-pressed'),'false');
 await page.locator('[data-action="reference-toggle"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action="reference-toggle"]')?.getAttribute('aria-pressed')==='true');
 assert.equal(await page.evaluate(()=>window.__referenceTest.starts),1);
 await page.locator('[data-action="reference-octave"][data-value="3"]').click();
 assert.equal(await page.locator('#reference-note-label').innerText(),'La3');
 assert.equal(await page.locator('#reference-frequency').innerText(),'221.00 Hz');
 await page.locator('[data-action="reference-shortcut"][data-value="Sib3"]').click();
 assert.equal(await page.locator('#reference-note-label').innerText(),'Sib3');
 assert.equal(await page.locator('[data-action="reference-toggle"]').getAttribute('aria-pressed'),'true');
 const before=await page.evaluate(()=>window.__referenceTest);
 assert.equal(before.starts,1,'Canviar de nota no provoca una segona font');
 assert(before.freq.length>=3,'La freqüència de l’oscil·lador sí que canvia');
 await page.locator('[data-action="tool-tab"][data-value="tuner"]').click();
 assert.equal(await page.evaluate(()=>window.__referenceTest.stops),1,'Tab afinador atura el to');
 assert.equal(await page.evaluate(()=>window.__referenceTest.closes),1,'Tab afinador allibera l’àudio');
 await page.locator('#tuner-reference').evaluate(el=>{
   el.value='440';el.dispatchEvent(new Event('input',{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('[data-action="tool-tab"][data-value="reference"]').click();
 assert.equal(await page.locator('#reference-a4').innerText(),'440');
 await page.locator('[data-action="reference-shortcut"][data-value="La4"]').click();
 assert.equal(await page.locator('#reference-frequency').innerText(),'440.00 Hz');
 await page.locator('[data-action="reference-toggle"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action="reference-toggle"]')?.getAttribute('aria-pressed')==='true');
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>document.querySelector('[data-action="reference-toggle"]')?.getAttribute('aria-pressed')==='false');
 assert.equal(await page.evaluate(()=>window.__referenceTest.stops),2,'Ocultar app para to');
 await page.reload();
 await page.locator('.pf-metro-panel').waitFor();
 await page.locator('[data-action="tool-tab"][data-value="reference"]').click();
 assert.equal(await page.locator('#reference-a4').innerText(),'440','L’afinació es recupera d’IndexedDB');
 assert.equal(await page.locator('[data-action="reference-toggle"]').getAttribute('aria-pressed'),'false','No reproduir automàticament');
 assert.equal(errors.length,0,'Errors JS: '+JSON.stringify(errors));
 console.log('PASS W2.11: harmònics Android, selecció 12×5, accessos, calibratge, navegació, PWA i parada');
 await context.close();
}finally{await browser.close();}
