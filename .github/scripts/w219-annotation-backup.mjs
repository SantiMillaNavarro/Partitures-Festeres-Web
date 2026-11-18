import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const launch={headless:true,args:['--no-sandbox']};
if(process.env.PF_CHROMIUM_PATH)launch.executablePath=process.env.PF_CHROMIUM_PATH;
const browser=await chromium.launch(launch);
try{
 const context=await browser.newContext({viewport:{width:950,height:750}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="welcome-done"]').waitFor({timeout:20000});
 await page.locator('[data-action="welcome-done"]').click();
 assert.match(await page.locator('.side-bottom').innerText(),/W2\.\d+/);
 const result=await page.evaluate(async()=>{
  const {ScoreViewer}=await import('./viewer-w219.js');
  const {normalizeAnnotations}=await import('./annotations.js');
  const {assembleScanPdf}=await import('./scanner-pdf-w2133.js');
  const {getPref,setPref,saveBatch,getScore,setAnnotations,getAnnotations,deleteScore}=await import('./db.js');
  const {createBackup,inspectBackup,restoreBackup}=await import('./backup.js');
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const canvas=document.createElement('canvas');canvas.width=360;canvas.height=550;
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,360,550);
  context.fillStyle='#171717';context.fillText('CIMO',22,50);
  for(let i=0;i<16;i++)context.fillRect(15,i*25+80,330,2);
  const jpeg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
  const image={bytes:new Uint8Array(await jpeg.arrayBuffer()),width:360,height:550};
  const pdf=assembleScanPdf([image,image]);
  const path='Instruments/1r/Marxes/CIMO.pdf';
  await saveBatch([{path,blob:pdf,size:pdf.size,added:Date.now()}]);
  const originalPdf=await getScore(path);
  const doc=normalizeAnnotations({version:1,pages:{'1':[
   {tool:'rectangle',color:'#b51f34',width:.005,points:[[.1,.2],[.5,.6]]},
   {tool:'text',color:'#242424',width:.0055,points:[[.3,.4]],
     text:'Marxa',fontSize:.034,bold:false,underline:false,opacity:1,
     boxWidth:.28,boxHeight:.10}
  ]}});
  const host=document.createElement('div');host.id='w219-test-host';
  host.style.cssText='position:fixed;top:30px;left:10px;width:650px;height:600px;z-index:3000;background:#fff';
  document.body.append(host);
  let latest=null;
  const viewer=new ScoreViewer({host,blob:originalPdf.blob,annotations:doc,
   onAnnotationsChange:next=>{latest=next;return Promise.resolve();},
   onWarning:message=>{throw Error('Warning: '+message);}});
  await viewer.open();
  check(!!viewer.page&&viewer.numPages===2,'El PDF de dos pàgines no s’ha obert.');
  viewer.setAnnotationMode(true);viewer.setAnnotationTool('select');
  viewer.selectedAnnotation=0;
  check(viewer.fillSelectedShape(.35),'El rectangle no admet ompliment.');
  check(viewer.annotationsOnPage()[0].fillOpacity===.35,'No es desa el 35%.');
  const pathNode=viewer.annotationSvg.querySelector('path.annotation-stroke[data-annotation-index="0"]');
  check(pathNode?.getAttribute('fill-opacity')==='0.35','El dibuix SVG no aplica el 35%.');
  check(viewer.undoAnnotation(),'No es pot desfer ompliment.');
  check(viewer.annotationsOnPage()[0].fillOpacity===undefined,'El desfer ha de restaurar forma antiga.');
  check(viewer.redoAnnotation(),'No es pot refer ompliment.');
  check(viewer.annotationsOnPage()[0].fillOpacity===.35,'El refer ha de restaurar el 35%.');
  viewer.selectedAnnotation=0;
  check(viewer.duplicateSelectedAnnotation(),'No es pot duplicar el rectangle.');
  check(viewer.annotationsOnPage().length===3,'Duplicació incorrecta.');
  check(viewer.orderSelectedAnnotation(-1),'No es pot enviar arrere.');
  check(viewer.selectedAnnotation===1,'No es conserva la selecció reordenada.');
  check(viewer.undoAnnotation()&&viewer.redoAnnotation(),'Reordenació sense historial complet.');
  viewer.selectedAnnotation=viewer.annotationsOnPage().findIndex(a=>a.tool==='text');
  const previous=viewer.selectedAnnotationObject().points[0][0];
  check(viewer.nudgeSelectedText(.003,0),'No es pot moure text.');
  check(viewer.selectedAnnotationObject().points[0][0]>previous,'Text sense moviment.');
  check(viewer.copySelectedAnnotation(true),'No es pot tallar.');
  const page1Count=viewer.annotationsOnPage().length;
  check(page1Count===3,'Tallar no ha d’eliminar abans d’apegar.');
  await viewer.turnPage(1);
  check(viewer.pageNumber===2,'No s’ha canviat de pàgina.');
  check(viewer.pasteCopiedAnnotation(),'Tall i apegat entre pàgines no funciona.');
  check(viewer.annotations.pages['1'].length===page1Count-1,'No s’ha tret l’origen.');
  check(viewer.annotations.pages['2'].length===1,'No s’ha afegit al destí.');
  check(viewer.undoAnnotation(),'Desfer tall entre pàgines falla.');
  check(viewer.annotations.pages['1'].length===page1Count,'Desfer no ha restaurat l’origen.');
  check(!viewer.annotations.pages['2']?.length,'Desfer no ha buidat el destí.');
  check(viewer.redoAnnotation(),'Refer tall entre pàgines falla.');
  check(viewer.annotations.pages['1'].length===page1Count-1&&viewer.annotations.pages['2'].length===1,
    'Refer no ha restaurat el trasllat.');
  await viewer.annotationSaveQueue;
  check(!!latest&&latest.version===1,'No s’han notificat les anotacions.');
  const finalDoc=normalizeAnnotations(viewer.annotations);
  viewer.close();host.remove();
  check((await getScore(path)).blob.size===originalPdf.blob.size,'El PDF original s’ha modificat.');
  await setAnnotations(path,finalDoc);
  await setPref('viewer:'+path,{page:2,zoom:1.7,fit:'page',rotation:0,rotationMode:'auto'});
  await setPref('w218:page:'+path,{'1':{cropLeft:.2,contrast:1.4,rotationQuarterTurns:1}});
  await setPref('viewer:Antiga-Eliminada.pdf',{zoom:3});
  const saved=await createBackup();
  const inspected=await inspectBackup(saved.blob);
  const preferences=inspected.manifest.preferences;
  check(preferences.some(p=>p.key==='viewer:'+path),'Falta l’estat lector de subcarpeta.');
  check(!preferences.some(p=>p.key==='viewer:Antiga-Eliminada.pdf'),'Un PDF eliminat no pot invalidar el ZIP.');
  check(preferences.some(p=>p.key==='w218:page:'+path),'Falten ajustos W2.18 de subcarpeta.');
  check(inspected.manifest.annotations.length===1,'La còpia no conserva anotacions.');
  await setPref('w218:page:'+path,{'1':{cropLeft:.02,contrast:1}});
  await restoreBackup(inspected,'replace');
  const restored=await getPref('w218:page:'+path);
  check(restored['1'].cropLeft===.2&&restored['1'].contrast===1.4,'Restaurar ZIP no conserva W2.18.');
  check((await getPref('viewer:'+path)).zoom===1.7,'Restaurar ZIP no conserva zoom.');
  check((await getAnnotations(path)).pages['2'].length===1,'Restaurar ZIP no conserva anotacions.');
  // Fusionar manté les preferències d'obres existents.
  await setPref('w218:page:'+path,{'1':{contrast:1.65}});
  await restoreBackup(inspected,'merge');
  check((await getPref('w218:page:'+path))['1'].contrast===1.65,'Fusionar no ha preservat els ajustos locals.');
  await deleteScore(path);
  check((await getPref('viewer:'+path,null))===null,'Eliminar PDF deixa zoom òrfen.');
  check((await getPref('w218:page:'+path,null))===null,'Eliminar PDF deixa ajustos òrfens.');
  return {pageCount:viewer.numPages,annotations:finalDoc.pages['1'].length+finalDoc.pages['2'].length,
   storedPrefs:preferences.length,bytes:saved.blob.size};
 });
 assert.equal(result.pageCount,2);
 assert(result.storedPrefs>=2,'Preferències insuficients');
 assert.deepEqual(errors,[],'Excepcions web: '+errors.join('\n'));
 console.log('PASS W2.19: redo/undo, fill 35%, duplicate, z-order, text nudge, atomic cross-page cut, ZIP replace and merge in nested folders',result);
 await context.close();
}finally{await browser.close();}
