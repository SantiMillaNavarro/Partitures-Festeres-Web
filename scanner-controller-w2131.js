/* W2.13.1 — Estat d'escaneig i cicle de vida, fotos locals -> PDF.
   La captura de la càmera s'activa sempre des de l'acció de l'usuari.
   No es connecta cap flux permanent ni es puja cap fotografia.
*/
import {generateScannedPdf,normalizeScanName,uniqueScanPath,
 SCAN_PAGE_LIMIT,SCAN_FILE_LIMIT,SCAN_TOTAL_LIMIT,SCAN_FILTERS} from './scanner-pdf-w2131.js';
import {renderScannerMarkup} from './scanner-ui-w2131.js';
export class ScannerController{
 constructor({onUpdate=()=>{},onWarning=()=>{},onSaved=async()=>{}}={}){
  this.onUpdate=onUpdate;this.onWarning=onWarning;this.onSaved=onSaved;
  this.sequence=0;this.pages=[];this.name='Nova partitura';this.folder='';
  this.addToRepertoire=false;this.repertoireId='';this.busy=false;this.progress=0;this.error='';
  this.language='va';this.scores=[];this.repertoires=[];
 }
 open({folder='',repertoires=[]}={}){
  this.clear({notify:false});
  this.name='Nova partitura';this.folder=folder;this.error='';
  this.repertoireId=repertoires?.[0]?.id||'';this.addToRepertoire=false;
  this.onUpdate();
 }
 markup({scores=[],repertoires=[],language='va'}={}){
  this.language=language;this.scores=scores;this.repertoires=repertoires;
  if(!repertoires.some(r=>r.id===this.repertoireId))this.repertoireId=repertoires[0]?.id||'';
  return renderScannerMarkup({pages:this.pages,name:this.name,folder:this.folder,
   addToRep:this.addToRepertoire,repId:this.repertoireId,
   busy:this.busy,progress:this.progress,error:this.error,
   scores,repertoires,language});
 }
 clear({notify=true}={}){
  if(this.busy)return false;
  for(const page of this.pages)try{URL.revokeObjectURL(page.url);}catch{}
  this.pages=[];this.error='';this.progress=0;
  if(notify)this.onUpdate();return true;
 }
 cancel(){return this.clear({notify:false});}
 addImages(files){
  if(this.busy)return 0;
  const selected=Array.from(files||[]);
  let count=0,total=this.pages.reduce((sum,p)=>sum+p.file.size,0),warnings=[];
  for(const file of selected){
   if(this.pages.length>=SCAN_PAGE_LIMIT){warnings.push('El màxim és de 30 pàgines.');break;}
   if(!file||(!(file.type||'').startsWith('image/')&&!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name||''))){
    warnings.push('Selecciona fotografies, no PDF, en l’escàner.');continue;
   }
   if(!file.size||file.size>SCAN_FILE_LIMIT){warnings.push('Una foto està buida o supera 24 MB.');continue;}
   if(total+file.size>SCAN_TOTAL_LIMIT){warnings.push('El total d’imatges supera 180 MB.');break;}
   const url=URL.createObjectURL(file);
   this.pages.push({id:String(++this.sequence),file,url,rotation:0,filter:'original'});
   total+=file.size;count++;
  }
  if(warnings.length){
   this.error=(this.language==='es'?
    'Se han omitido imágenes no compatibles, demasiadas páginas o archivos demasiado grandes.':
    'S’han omés imatges no compatibles, massa pàgines o fitxers massa grans.');
   this.onWarning(this.error);
  }else this.error='';
  if(count||warnings.length)this.onUpdate();
  return count;
 }
 indexOf(id){return this.pages.findIndex(p=>p.id===String(id));}
 setFilter(id,value){
  if(this.busy||!SCAN_FILTERS.includes(value))return false;
  const i=this.indexOf(id);if(i<0)return false;
  this.pages[i].filter=value;this.onUpdate();return true;
 }
 reorder(id,move){
  if(this.busy)return false;
  const index=this.indexOf(id),next=index+move;
  if(index<0||next<0||next>=this.pages.length)return false;
  [this.pages[index],this.pages[next]]=[this.pages[next],this.pages[index]];
  this.onUpdate();return true;
 }
 rotate(id){
  if(this.busy)return false;
  const i=this.indexOf(id);if(i<0)return false;
  this.pages[i].rotation=(this.pages[i].rotation+90)%360;
  this.onUpdate();return true;
 }
 remove(id){
  if(this.busy)return false;
  const i=this.indexOf(id);if(i<0)return false;
  const [page]=this.pages.splice(i,1);
  try{URL.revokeObjectURL(page.url);}catch{}
  this.onUpdate();return true;
 }
 updateField(id,value){
  if(this.busy)return;
  if(id==='scan-name')this.name=value;
  else if(id==='scan-folder')this.folder=value;
  else if(id==='scan-to-rep'){this.addToRepertoire=!!value;this.onUpdate();}
  else if(id==='scan-rep')this.repertoireId=value;
 }
 async save(){
  if(this.busy||!this.pages.length)return false;
  let name;
  try{name=normalizeScanName(this.name);}
  catch(err){
   this.error=this.language==='es'?'Introduce un nombre válido (sin barras ni caracteres especiales).':
    'Introduïx un nom vàlid (sense barres ni caràcters especials).';
   this.onUpdate();return false;
  }
  const folder=this.folder||'';
  if(folder&&(!folder.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!/[\\\x00-\x1f]/.test(p))||
    !this.scores.some(s=>s.path.startsWith(folder+'/')))){
   this.error=this.language==='es'?'La carpeta seleccionada ya no está disponible.':
    'La carpeta seleccionada ja no està disponible.';
   this.onUpdate();return false;
  }
  const basePath=[folder,name].filter(Boolean).join('/');
  const path=uniqueScanPath(basePath,new Set(this.scores.map(s=>s.path)));
  if(this.addToRepertoire&&!this.repertoires.some(r=>r.id===this.repertoireId)){
   this.error=this.language==='es'?'Selecciona un repertorio válido.':'Selecciona un repertori vàlid.';
   this.onUpdate();return false;
  }
  const snapshot=this.pages.map(({file,rotation,filter})=>({file,rotation,filter}));
  const repId=this.addToRepertoire?this.repertoireId:null;
  this.busy=true;this.progress=0;this.error='';this.onUpdate();
  let success=false;
  try{
   const pdf=await generateScannedPdf(snapshot,{onProgress:(count)=>{
    this.progress=count;
    const el=document.getElementById('scan-progress');
    if(el)el.textContent=(this.language==='es'?'Procesando ':'Processant ')+count+'/'+snapshot.length;
   }});
   // Les dades de la biblioteca només s'escriuen després que tot el PDF és vàlid.
   const pdfStart=new Uint8Array(await pdf.slice(0,5).arrayBuffer());
   if(String.fromCharCode(...pdfStart)!=='%PDF-')throw new Error('El PDF no té una capçalera vàlida.');
   await this.onSaved({path,blob:pdf,repertoireId:repId,pageCount:snapshot.length});
   success=true;
   this.busy=false;
   this.clear({notify:false});
   return true;
  }catch(err){
   const prefix=this.language==='es'?'No se ha podido guardar la partitura: ':
    'No s’ha pogut guardar la partitura: ';
   this.error=prefix+(err?.message||String(err));
   this.onWarning(this.error);return false;
  }finally{
   this.busy=false;this.progress=0;
   if(!success)this.onUpdate();
  }
 }
 async handleAction(action,id){
  switch(action){
   case 'scan-up':return this.reorder(id,-1);
   case 'scan-down':return this.reorder(id,1);
   case 'scan-rotate':return this.rotate(id);
   case 'scan-remove':return this.remove(id);
   case 'scan-clear':return this.clear();
   case 'scan-save':return await this.save();
  }
  return false;
 }
}
