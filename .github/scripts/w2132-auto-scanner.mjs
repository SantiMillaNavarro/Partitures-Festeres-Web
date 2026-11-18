import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {detectDocument,stableDocument,quadrilateralDistance,documentImageDimensions,
 perspectiveMatrix,projectPoint,flattenDocument} from '../../scanner-detection-w2132.js';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.stack||error.message));
 await page.addInitScript(()=>{
  const q=window.__cameraQA={opens:0,stops:0,flat:false,stream:null};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
   getUserMedia:async constraints=>{
    if(constraints.audio!==false||!constraints.video)throw Error('La càmera no necessita àudio');
    q.opens++;
    const canvas=document.createElement('canvas');canvas.width=300;canvas.height=420;
    const ctx=canvas.getContext('2d');
    const draw=()=>{
     ctx.fillStyle='#2b241e';ctx.fillRect(0,0,300,420);
     if(!q.flat){
      ctx.beginPath();ctx.moveTo(44,46);ctx.lineTo(248,60);
      ctx.lineTo(254,354);ctx.lineTo(42,344);ctx.closePath();
      ctx.fillStyle='#f9f9ec';ctx.fill();
      ctx.fillStyle='#171717';
      for(let n=0;n<16;n++)ctx.fillRect(90,105+n*11,120,1);
     }
    };
    draw();q.timer=setInterval(draw,75);
    const stream=canvas.captureStream(15);
    const track=stream.getVideoTracks()[0];
    const stop=track.stop.bind(track);
    track.stop=()=>{q.stops++;clearInterval(q.timer);stop();};
    q.stream=stream;return stream;
   }
  }});
 });
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 if(await page.locator('[data-action="welcome-done"]').count())
  await page.locator('[data-action="welcome-done"]').click();
 // El solapament de la captura en posició vertical queda prohibit.
 for(const width of [320,360,390,430,620,768,830]){
  await page.setViewportSize({width,height:800});
  const rect=await page.evaluate(()=>{
   const title=document.querySelector('.brand h1').getBoundingClientRect();
   const scan=document.querySelector('.topbar [data-action="scan-open"]').getBoundingClientRect();
   const importButton=document.querySelector('.topbar [data-action="import"]').getBoundingClientRect();
   return {title:{top:title.top,bottom:title.bottom,right:title.right},
    scan:{top:scan.top,bottom:scan.bottom,right:scan.right},
    importButton:{top:importButton.top,right:importButton.right}};
  });
  assert(rect.title.bottom<=rect.scan.top+2,'SOLAPAMENT título/Escanejar en '+width+'px: '+JSON.stringify(rect));
  assert(rect.importButton.right<=width+1,'Botó Importar ix de pantalla en '+width);
  assert(rect.scan.right<=width+1,'Botó Escanejar ix de pantalla en '+width);
 }
 await page.setViewportSize({width:390,height:844});
 const detection=await page.evaluate(async()=>{
  const api=await import('./scanner-detection-w2132.js');
  const c=document.createElement('canvas');c.width=260;c.height=340;
  const x=c.getContext('2d');
  x.fillStyle='#30302e';x.fillRect(0,0,c.width,c.height);
  x.fillStyle='#f9f8eb';x.beginPath();x.moveTo(36,40);x.lineTo(218,52);
  x.lineTo(224,285);x.lineTo(30,293);x.closePath();x.fill();
  x.fillStyle='#333';for(let i=0;i<11;i++)x.fillRect(69,75+i*13,105,1);
  const found=api.detectDocument(x.getImageData(0,0,c.width,c.height));
  const corners=found?.points;
  const flat=api.flattenDocument(c,corners,{maxEdge:600});
  const sample=[...flat.getContext('2d').getImageData(flat.width/2|0,flat.height/2|0,1,1).data];
  const bytes=await new Promise(resolve=>flat.toBlob(blob=>resolve(blob.size),'image/jpeg'));
  const blank=document.createElement('canvas');blank.width=260;blank.height=340;
  const bx=blank.getContext('2d');bx.fillStyle='#eeeeee';bx.fillRect(0,0,260,340);
  const none=api.detectDocument(bx.getImageData(0,0,260,340));
  flat.width=0;flat.height=0;
  return {found,corners,sample,bytes,none};
 });
 assert(detection.found,'Detectar paper sobre fons fosc');
 assert(detection.found.confidence>.55,'Confiança insuficient');
 for(const [i,x,y] of [[0,.14,.12],[1,.84,.15],[2,.86,.84],[3,.12,.86]]){
  assert(Math.abs(detection.corners[i].x-x)<.075,'Cantonada x '+i+': '+JSON.stringify(detection.corners));
  assert(Math.abs(detection.corners[i].y-y)<.075,'Cantonada y '+i);
 }
 assert(detection.sample[0]>180,'El centre del document rectificat és clar');
 assert(detection.bytes>500,'El JPEG corregit no és buit');
 assert.equal(detection.none,null,'No inventar cap fulla sobre fons uniforme');
 assert.equal(stableDocument([detection.found,detection.found,detection.found,detection.found])?.confidence,
  detection.found.confidence);
 assert.equal(quadrilateralDistance(detection.found,detection.found),0);
 const pts=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
 const matrix=perspectiveMatrix(pts);
 assert(Math.abs(projectPoint(matrix,.2,.6).x-.2)<.0001);
 assert(Math.abs(projectPoint(matrix,.2,.6).y-.6)<.0001);
 assert.deepEqual(documentImageDimensions(pts,400,800),{width:400,height:800});

 await page.locator('header [data-action="scan-open"]').click();
 await page.locator('.pf-scan-screen').waitFor();
 assert.equal(await page.locator('[data-action="scan-camera-file"]').count(),1,'Alternativa nativa disponible');
 await page.locator('[data-action="scan-camera"]').click();
 await page.locator('.pf-document-camera').waitFor();
 assert.equal(await page.evaluate(()=>window.__cameraQA.opens),1);
 const camera=page.locator('.pf-document-camera');
 assert.equal(await camera.locator('#pf-camera-auto').isChecked(),true);
 // La càmera detecta, estabilitza i captura una vegada, no cada fotograma.
 await page.waitForFunction(()=>document.querySelector('#pf-camera-count')?.textContent==='1',null,{timeout:20000});
 assert.equal(await camera.locator('polygon.pf-camera-outline').getAttribute('points')==='',false);
 await page.waitForTimeout(1300);
 assert.equal(await camera.locator('#pf-camera-count').innerText(),'1','No duplicar la fulla quieta');
 assert.equal(await page.locator('.pf-scan-page').count(),1);
 // Es pot rearmar manualment sense haver de canviar de pantalla.
 await camera.locator('[data-camera-action="next"]').click();
 await page.waitForFunction(()=>document.querySelector('#pf-camera-count')?.textContent==='2',null,{timeout:20000});
 await camera.locator('[data-camera-action="close"]').click();
 assert.equal(await page.locator('.pf-document-camera').count(),0);
 assert.equal(await page.locator('.pf-scan-page').count(),2);
 assert.equal(await page.evaluate(()=>window.__cameraQA.stops),1,'Parar càmera al tancar');
 await page.locator('[data-action="scan-camera"]').click();
 await page.locator('.pf-document-camera').waitFor();
 await page.locator('#pf-camera-auto').uncheck();
 await page.waitForTimeout(400);
 const previous=await camera.locator('#pf-camera-count').innerText();
 await camera.locator('[data-camera-action="shoot"]').click();
 await page.waitForFunction(n=>Number(document.querySelector('#pf-camera-count')?.textContent)>n,
  Number(previous),{timeout:20000});
 assert.equal(await page.locator('.pf-scan-page').count(),3);
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>!document.querySelector('.pf-document-camera'));
 assert.equal(await page.evaluate(()=>window.__cameraQA.stops),2,'Parar càmera en segon pla');
 assert.equal(errors.length,0,'Errors JS: '+JSON.stringify(errors));
 console.log('PASS W2.13.2: títol mòbil sense solapament, contorns, perspectiva, auto-captura, botó manual i privacitat');
 await context.close();
}finally{await browser.close();}
