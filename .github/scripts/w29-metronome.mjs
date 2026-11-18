import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {METRONOME_SIGNATURES,renderMetronomeBar,metronomeFramesPerEvent,
 metronomeEventIndex,metronomeEvents,normalizeMetronomeBpm,getMetronomeSignature,
 WebMetronomeEngine} from '../../metronome-w29.js';
import {renderMetronomeMarkup} from '../../metronome-ui-w29.js';

assert.deepEqual(METRONOME_SIGNATURES.map(s=>s.label),['2/4','3/4','4/4','6/8','9/8','12/8']);
assert.equal(normalizeMetronomeBpm(39),40);
assert.equal(normalizeMetronomeBpm(245),240);
assert.equal(normalizeMetronomeBpm('foo'),100);
assert.equal(getMetronomeSignature('invalid').label,'4/4');
assert.equal(metronomeFramesPerEvent(100,getMetronomeSignature('4/4'),44100),26460);
assert.equal(metronomeEventIndex(.601,100,getMetronomeSignature('4/4')),1);
assert.equal(metronomeEventIndex(2.402,100,getMetronomeSignature('4/4')),0);
const cmp=getMetronomeSignature('6/8');
assert.equal(cmp.mainBeats,2);assert.equal(cmp.subdivisionsPerBeat,3);
assert.equal(metronomeEvents(cmp),6);
assert.equal(metronomeFramesPerEvent(100,cmp,44100),8820);
for(const s of METRONOME_SIGNATURES){
 const bar=renderMetronomeBar(100,s);
 assert.equal(bar.events,s.mainBeats*s.subdivisionsPerBeat);
 assert.equal(bar.samples.length,bar.events*bar.framesPerEvent);
 assert(bar.samples.every(v=>Number.isFinite(v)&&v>=-1&&v<=1));
 const nonZero=(event)=>Array.from(bar.samples.slice(event*bar.framesPerEvent,event*bar.framesPerEvent+500)).some(v=>Math.abs(v)>.001);
 for(let e=0;e<bar.events;e++)assert(nonZero(e),'Every event has a click');
 const energy=(event)=>{
  const slice=bar.samples.slice(event*bar.framesPerEvent,event*bar.framesPerEvent+Math.round(.043*44100));
  return slice.reduce((sum,v)=>sum+v*v,0);
 };
 assert(energy(0)>energy(1),'First event is always stronger');
 if(bar.events>=3){
  const a=bar.samples.slice(bar.framesPerEvent,bar.framesPerEvent+1500);
  const b=bar.samples.slice(bar.framesPerEvent*2,bar.framesPerEvent*2+1500);
  assert.deepEqual(a,b,'All weak events have the exact same timbre, even in compound meters');
 }
}
assert.match(renderMetronomeMarkup({signature:'12/8',running:true,activeIndex:7,language:'va'}),/data-metro-event="11"/);
assert.match(renderMetronomeMarkup({language:'es'}),/Metrónomo/);

class FakeContext{
 static stats={starts:0,stops:0,resumes:0,closed:0,lastLength:0};
 constructor(){this.sampleRate=44100;this.state='suspended';this.destination={};this.t=0;}
 get currentTime(){return this.t;}
 async resume(){this.state='running';FakeContext.stats.resumes++;}
 createBuffer(channels,length,rate){
  assert.equal(channels,1);assert.equal(rate,this.sampleRate);
  FakeContext.stats.lastLength=length;const a=new Float32Array(length);
  return {getChannelData:()=>a};
 }
 createBufferSource(){
  return {buffer:null,loop:false,connect(){},disconnect(){},
   start(){assert(this.loop);FakeContext.stats.starts++;},
   stop(){FakeContext.stats.stops++;}};
 }
 async close(){FakeContext.stats.closed++;this.state='closed';}
}
const mocked=new WebMetronomeEngine({AudioContextClass:FakeContext});
assert.equal(await mocked.start(100,'6/8'),true);
assert.equal(FakeContext.stats.lastLength,6*8820);
mocked.context.t=.19;assert.equal(mocked.currentEventIndex(),0);
mocked.context.t=.21;assert.equal(mocked.currentEventIndex(),1);
mocked.context.t=1.19;assert.equal(mocked.currentEventIndex(),5);
mocked.context.t=1.21;assert.equal(mocked.currentEventIndex(),0);
await mocked.start(120,'3/4');
assert.equal(FakeContext.stats.starts,2);
assert.equal(FakeContext.stats.stops,1);
mocked.close();
assert.equal(FakeContext.stats.stops,2);

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:780}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.addInitScript(()=>{
  const counts={starts:0,stops:0,resumes:0,closes:0,events:[]};
  window.__metroTest=counts;
  class FakeWebAudio{
   constructor(){this.sampleRate=44100;this.state='suspended';this.born=performance.now();this.destination={};}
   get currentTime(){return (performance.now()-this.born)/1000;}
   async resume(){this.state='running';counts.resumes++;}
   createBuffer(channels,length,rate){
    const samples=new Float32Array(length);counts.events.push({channels,length,rate});
    return {getChannelData:()=>samples};
   }
   createBufferSource(){
    return {buffer:null,loop:false,connect(){},disconnect(){},
     start(){if(!this.loop)throw Error('Audio source must loop');counts.starts++;},
     stop(){counts.stops++;}};
   }
   async close(){counts.closes++;this.state='closed';}
  }
  window.AudioContext=FakeWebAudio;
  window.webkitAudioContext=FakeWebAudio;
 });
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())await page.locator('[data-action="welcome-done"]').click();
 const nav=page.locator('.bottom-nav [data-action="page"]');
 assert.equal(await nav.count(),7,'Seven main sections as in Android');
 await nav.filter({has:page.locator('[data-value="tools"]')}).count(); // no-op; selector below is exact
 await page.locator('.bottom-nav [data-action="page"][data-value="tools"]').click();
 await page.locator('.pf-metro-panel').waitFor();
 assert.equal(await page.locator('.pf-metro-signature').count(),6);
 assert.equal(await page.locator('#metro-bpm').inputValue(),'100');
 assert.match(await page.locator('#metro-big-bpm').innerText(),/100/);
 assert.equal(await page.locator('.pf-metro-dot').count(),4);
 await page.locator('[data-action="metro-toggle"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action="metro-toggle"]')?.getAttribute('aria-pressed')==='true');
 assert.equal(await page.evaluate(()=>window.__metroTest.starts),1);
 await page.locator('[data-action="metro-plus"]').click();
 await page.waitForFunction(()=>window.__metroTest.starts===2);
 assert.equal(await page.locator('#metro-bpm').inputValue(),'101');
 await page.locator('[data-action="metro-signature"][data-value="9/8"]').click();
 await page.waitForFunction(()=>window.__metroTest.starts===3);
 assert.equal(await page.locator('.pf-metro-dot').count(),9);
 assert.equal(await page.locator('.pf-metro-beat-group').count(),3);
 const sig=await page.locator('[data-action="metro-signature"][data-value="9/8"]').getAttribute('aria-pressed');
 assert.equal(sig,'true');
 await page.locator('#metro-bpm').fill('180');
 await page.locator('#metro-bpm').dispatchEvent('change');
 await page.waitForFunction(()=>window.__metroTest.starts>=4);
 assert.equal(await page.locator('#metro-bpm').inputValue(),'180');
 const starts=await page.evaluate(()=>window.__metroTest.starts);
 await page.locator('[data-action="metro-toggle"]').click();
 assert.equal(await page.locator('[data-action="metro-toggle"]').getAttribute('aria-pressed'),'false');
 assert((await page.evaluate(()=>window.__metroTest.stops))>=starts);
 await page.locator('[data-action="metro-toggle"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action="metro-toggle"]')?.getAttribute('aria-pressed')==='true');
 await page.locator('.bottom-nav [data-action="page"][data-value="library"]').click();
 assert.equal(await page.locator('.pf-metro-panel').count(),0);
 assert.equal((await page.evaluate(()=>window.__metroTest.closes)),1,'Leaving Eines frees the audio context');
 await page.locator('.bottom-nav [data-action="page"][data-value="tools"]').click();
 await page.locator('.pf-metro-panel').waitFor();
 assert.equal(await page.locator('[data-action="metro-toggle"]').getAttribute('aria-pressed'),'false');
 await page.reload();
 await page.locator('.pf-metro-panel').waitFor();
 assert.equal(await page.locator('.pf-metro-dot').count(),9,'Navigation to Eines is restored without autoplay');
 assert.equal(await page.locator('[data-action="metro-toggle"]').getAttribute('aria-pressed'),'false');
 await page.locator('[data-action="metro-toggle"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action="metro-toggle"]')?.getAttribute('aria-pressed')==='true');
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>document.querySelector('[data-action="metro-toggle"]')?.getAttribute('aria-pressed')==='false');
 assert.equal(errors.length,0,'Browser errors: '+JSON.stringify(errors));
 console.log('PASS W2.9: Android beats, two click types, BPM slider/buttons, six meters, responsive tools tab, autoplay prevention and lifecycle stop');
 await context.close();
}finally{await browser.close();}
