import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const rootId='folderROOT1234567890',childId='childROLE11234567890',
 fileId='scorePDF123456789012',secondId='extraPDF123456789012';
const clientId='12345678901234567890-testabc123.apps.googleusercontent.com';
function makePdf(){
 const objs=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 500] /Contents 4 0 R /Resources << >> >>',
  '<< /Length 0 >>\nstream\n\nendstream'
 ];
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(let i=0;i<objs.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+objs[i]+'\nendobj\n';}
 const start=Buffer.byteLength(pdf);
 pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
 for(const off of offsets.slice(1))pdf+=String(off).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
 return Buffer.from(pdf,'utf8');
}
const pdf=makePdf();
const options={headless:true,args:['--no-sandbox']};
if(process.env.PF_CHROMIUM_PATH)options.executablePath=process.env.PF_CHROMIUM_PATH;
const browser=await chromium.launch(options),calls=[];
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1100,height:800}});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.google={accounts:{oauth2:{
   initTokenClient:settings=>({
    requestAccessToken(){window.__pfGrantedScope=settings.scope;
      settings.callback({access_token:'pf-temporary-browser-token',expires_in:3600});}
   }),
   revoke:(token,callback)=>{window.__pfRevoked=token;callback?.();}
  }}};
 });
 await page.route('https://www.googleapis.com/drive/v3/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  calls.push({method:request.method(),path,authorization:request.headers()['authorization']||null,q:url.searchParams.get('q')});
  const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(request.method()!=='GET'||request.headers()['authorization']!=='Bearer pf-temporary-browser-token'){
   await route.fulfill({status:401,body:'unauthorized'});return;
  }
  if(path.endsWith('/files/'+rootId)){
   await json({id:rootId,name:'Arxiu Musical',mimeType:'application/vnd.google-apps.folder',trashed:false});return;
  }
  if(path.endsWith('/files/'+fileId)||path.endsWith('/files/'+secondId)){
   await route.fulfill({status:200,contentType:'application/pdf',body:pdf});return;
  }
  if(path.endsWith('/files')){
   const q=url.searchParams.get('q')||'';
   if(q.includes("'"+rootId+"' in parents")){
    if(!url.searchParams.has('pageToken')){
     await json({nextPageToken:'next-page',files:[
       {id:childId,name:'1r',mimeType:'application/vnd.google-apps.folder'},
       {id:secondId,name:'Pasdoble.pdf',mimeType:'application/pdf',size:String(pdf.length),capabilities:{canDownload:false}}
     ]});return;
    }
    await json({files:[{id:'xtraFolder123456789',name:'Buides',mimeType:'application/vnd.google-apps.folder'}]});return;
   }
   if(q.includes("'"+childId+"' in parents")){
    await json({files:[{id:fileId,name:'CIMO.pdf',mimeType:'application/pdf',size:String(pdf.length),capabilities:{canDownload:true}}]});return;
   }
  }
  await route.fulfill({status:404,body:'not found'});
 });
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="drive-open"]').first().waitFor({timeout:20000});
 const welcome=page.locator('[data-action="welcome-done"]');
 if(await welcome.isVisible())await welcome.click();
 await page.locator('[data-action="drive-open"]').first().click();
 await page.locator('#drive-client-id').waitFor({timeout:10000});
 const module=await page.evaluate(async()=>{
  const m=await import('./drive-w221.js');
  const bad=[
   m.parseDriveFolderReference('javascript:alert(1)'),
   m.parseDriveFolderReference('https://notdrive.google.com/drive/folders/12345678901234'),
   m.parseDriveFolderReference('https://drive.google.com/drive/folders/abc?ab=hi'),
  ];
  if(bad.some(Boolean))throw Error('S’accepten URLs perilloses.');
  const parsed=m.parseDriveFolderReference('https://drive.google.com/drive/folders/folderROOT1234567890?resourcekey=resourceKEY1234');
  if(parsed?.id!=='folderROOT1234567890'||parsed.resourceKey!=='resourceKEY1234')
   throw Error('L’enllaç vàlid es parseja incorrectament.');
  const paths=m.availableDrivePath('Drive/Arxiu Musical/1r/CIMO.pdf',[
   'Drive/Arxiu Musical/1r/CIMO.pdf'
  ]);
  if(paths!=='Drive/Arxiu Musical/1r/CIMO (2).pdf')throw Error('Noms de descàrrega no únics.');
  if(m.safeDriveSegment('../Pelicula\\abc')?.includes('/')||m.safeDriveSegment('../Pelicula\\abc')?.includes('\\'))
   throw Error('Ruta remota insegura.');
  return true;
 });
 assert.equal(module,true);
 await page.locator('#drive-client-id').fill(clientId);
 await page.locator('[data-action="drive-save-client"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action="drive-connect"]')?.disabled===false);
 await page.locator('[data-action="drive-connect"]').click();
 await page.waitForFunction(()=>document.querySelector('.pf-drive-status.connected'));
 const scope=await page.evaluate(()=>window.__pfGrantedScope);
 assert.equal(scope,'https://www.googleapis.com/auth/drive.readonly');
 await page.locator('#drive-folder-ref').fill('https://drive.google.com/drive/folders/'+rootId);
 await page.locator('[data-action="drive-open-folder"]').click();
 try {
  await page.locator('[data-action="drive-enter"][data-value="'+childId+'"]').waitFor({timeout:10000});
 } catch(error){
  console.log('W2.21 DEBUG: Google requests',JSON.stringify(calls,null,2));
  console.log('W2.21 DEBUG: modal',await page.locator('.pf-drive-modal').innerText().catch(()=>'(missing)'));
  console.log('W2.21 DEBUG: browser errors',errors);
  throw error;
 }
 assert.equal(await page.locator('[data-action="drive-import"][data-value="'+secondId+'"]').isDisabled(),true,
   'Respectar canDownload false.');
 await page.locator('[data-action="drive-enter"][data-value="'+childId+'"]').click();
 await page.locator('[data-action="drive-import"][data-value="'+fileId+'"]').waitFor({timeout:10000});
 await page.locator('[data-action="drive-import"][data-value="'+fileId+'"]').click();
 await page.waitForFunction(async()=>{
  const {getAllScores}=await import('./db.js');
  const scores=await getAllScores();
  return scores.some(s=>s.path==='Drive/Arxiu Musical/1r/CIMO.pdf');
 },{timeout:12000});
 await page.locator('[data-action="drive-import"][data-value="'+fileId+'"]').click();
 await page.waitForFunction(async()=>{
  const {getAllScores}=await import('./db.js');
  const scores=await getAllScores();
  return scores.some(s=>s.path==='Drive/Arxiu Musical/1r/CIMO (2).pdf');
 },{timeout:12000});
 const result=await page.evaluate(async()=>{
  const {getAllScores,getAllPrefs,getScore}=await import('./db.js');
  const {createBackup,inspectBackup}=await import('./backup.js');
  const records=await getAllScores();
  const first=await getScore('Drive/Arxiu Musical/1r/CIMO.pdf');
  if(!first?.blob||first.blob.size===0)throw Error('El PDF no ha arribat a IndexedDB.');
  const prefs=await getAllPrefs();
  if(prefs.some(p=>JSON.stringify(p.value).includes('pf-temporary-browser-token')))
   throw Error('S’ha guardat el token OAuth en IndexedDB.');
  const zip=await createBackup(),checked=await inspectBackup(zip.blob);
  if(checked.manifest.preferences.some(p=>p.key.startsWith('w221:')))
   throw Error('El ZIP inclou opcions privades de Drive.');
  return {count:records.length,size:first.blob.size,paths:records.map(x=>x.path),zipSize:zip.blob.size};
 });
 assert.equal(result.count,2);
 assert(result.paths.includes('Drive/Arxiu Musical/1r/CIMO.pdf'));
 assert(result.paths.includes('Drive/Arxiu Musical/1r/CIMO (2).pdf'));
 assert(calls.some(c=>c.q?.includes("'"+childId+"' in parents")),'No hi ha navegació real.');
 assert(calls.some(c=>c.q?.includes("'"+rootId+"' in parents")),'No es consulta la carpeta inicial.');
 assert(calls.every(c=>c.method==='GET'),'No ha de modificar Drive.');
 await page.locator('[data-action="drive-disconnect"]').click();
 assert.equal(await page.evaluate(()=>window.__pfRevoked),'pf-temporary-browser-token');
 assert.equal(await page.locator('.pf-drive-status.connected').count(),0);
 await page.locator('[data-action="drive-close"]').last().click();
 await page.locator('[data-action="page"][data-value="library"]').first().click();
 assert.match(await page.locator('.cards').first().innerText(),/Drive/);
 assert.deepEqual(errors,[],'Excepcions web: '+errors.join(';'));
 console.log('PASS W2.21: GIS mock OAuth, Drive readonly GET, paginated listing, folder browsing, blocked download, two distinct PDF imports, token non persistence, zip privacy, revoke, local library.',result);
 await context.close();
}finally{await browser.close();}
