/* W2.12.1 — Pentagrama vectorial i panell Dictat Musical/Marina.
 * Correspondències de notes, clau, línies addicionals i negres segons Android.
 */
import {DICTATION_INSTRUMENTS,getDictationInstrument,staffPlacement} from './dictation-model-w2121.js';
import {dictationPageCount} from './dictation-export-w2122.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const navy='#1c3a57';
export function dictationStaffSVG(notes,{clef='treble',perRow=10,language='va'}={}){
 const va=language!=='es',list=Array.isArray(notes)?notes:[];
 if(!list.length)return '<div class="pf-dictation-empty">'+(va?'Encara no hi ha notes. Prem «Començar dictat» i toca l’instrument.':'Todavía no hay notas. Pulsa «Iniciar dictado» y toca el instrumento.')+'</div>';
 const count=Math.max(4,Math.min(10,Math.round(perRow)||10));
 const width=980,left=92,right=24,step=19,half=step/2,rowHeight=155,baseY=100;
 const rows=Math.ceil(list.length/count),height=rows*rowHeight;
 const bottomIndex=clef==='bass'?-10:2;
 let shapes='',textNodes='';
 for(let row=0;row<rows;row++){
  const top=row*rowHeight,bottom=top+baseY;
  for(let n=0;n<5;n++){
   const y=bottom-step*n;
   shapes+='<line x1="'+left+'" y1="'+y+'" x2="'+(width-right)+'" y2="'+y+'" stroke="'+navy+'" stroke-width="1.65"/>';
  }
  const glyph=clef==='bass'?'𝄢':'𝄞';
  textNodes+='<text x="40" y="'+(bottom+18)+'" font-family="Noto Music, Bravura, Segoe UI Symbol, serif" font-size="65" text-anchor="middle" fill="'+navy+'">'+glyph+'</text>';
  for(let local=0;local<count;local++){
   const note=list[row*count+local];if(!note)break;
   const x=left+(width-left-right)*(local+.5)/count;
   const {index,accidental}=staffPlacement(note.midi),y=bottom-(index-bottomIndex)*half;
   const topIndex=bottomIndex+8;
   if(index<=bottomIndex-2){for(let idx=bottomIndex-2;idx>=index;idx-=2){
    const ly=bottom-(idx-bottomIndex)*half;
    shapes+='<line x1="'+(x-16)+'" x2="'+(x+16)+'" y1="'+ly+'" y2="'+ly+'" stroke="'+navy+'" stroke-width="1.5"/>';
   }}
   if(index>=topIndex+2){for(let idx=topIndex+2;idx<=index;idx+=2){
    const ly=bottom-(idx-bottomIndex)*half;
    shapes+='<line x1="'+(x-16)+'" x2="'+(x+16)+'" y1="'+ly+'" y2="'+ly+'" stroke="'+navy+'" stroke-width="1.5"/>';
   }}
   // Negra: cap ovalat inclinat i pal cap amunt o avall.
   shapes+='<ellipse cx="'+x+'" cy="'+y+'" rx="9.5" ry="6.3" transform="rotate(-13 '+x+' '+y+')" fill="'+navy+'"/>';
   const stemUp=index<bottomIndex+4;
   if(stemUp)shapes+='<path d="M '+(x+8.5)+' '+y+' V '+(y-36)+'" stroke="'+navy+'" stroke-width="2.5" stroke-linecap="round"/>';
   else shapes+='<path d="M '+(x-8.5)+' '+y+' V '+(y+36)+'" stroke="'+navy+'" stroke-width="2.5" stroke-linecap="round"/>';
   if(accidental)textNodes+='<text x="'+(x-21)+'" y="'+(y+7)+'" font-size="23" text-anchor="middle" fill="'+navy+'">'+accidental+'</text>';
  }
 }
 const description=(va?'Pentagrama amb ':'Pentagrama con ')+list.length+(va?' notes: ':' notas: ')+list.map(n=>n.label).join(', ');
 return '<svg class="pf-dictation-staff-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(description)+'" xmlns="http://www.w3.org/2000/svg">'+shapes+textNodes+'</svg>';
}
export function renderDictationMarkup({mode='musical',instrumentId='CONCERT_TREBLE',running=false,pending=false,notes=[],reading=null,language='va',perRow=10,reference=442,exporting=false,exportProgress=0}={}){
 const va=language!=='es',marina=mode==='marina',tr=(a,b)=>va?a:b;
 const inst=getDictationInstrument(instrumentId),clef=marina?'treble':inst.clef;
 const title=marina?'Dictat Marina':'Dictat Musical';
 const status=running?tr(marina?'Escoltant… parla, canta o improvisa.':'Escoltant… toca notes clares i sostingudes.',
  marina?'Escuchando… habla, canta o improvisa.':'Escuchando… toca notas claras y sostenidas.')
  :(notes.length+' '+tr(notes.length===1?'nota':'notes',notes.length===1?'nota':'notas'));
 const select=DICTATION_INSTRUMENTS.map(x=>'<option value="'+x.id+'"'+(x.id===inst.id?' selected':'')+'>'+esc(va?x.va:x.es)+'</option>').join('');
 const switchLabel=marina?'Dictat Musical':'Dictat Marina';
 const pageCount=dictationPageCount(notes.length);
 const exportControls=!running&&!pending&&notes.length?
  '<div class="pf-dictation-export" role="group" aria-label="'+tr('Exportar el dictat','Exportar el dictado')+'">'+
   '<div class="pf-dictation-export-actions">'+
    '<button type="button" class="pf-dictation-save" data-action="dictation-save-image"'+(exporting?' disabled':'')+'>'+
     tr('Guardar imatge','Guardar imagen')+'</button>'+
    '<button type="button" class="pf-dictation-share" data-action="dictation-share"'+(exporting?' disabled':'')+'>'+
     '<span aria-hidden="true">↗</span> '+tr('Compartir','Compartir')+'</button>'+
   '</div>'+
   '<p id="dictation-export-status" role="status" class="pf-dictation-export-status">'+
    (exporting?tr('Preparant imatges…','Preparando imágenes…')+
      (exportProgress?' '+exportProgress+'/'+pageCount:''):
      (pageCount>1?tr('El dictat es dividirà en ','El dictado se dividirá en ')+
       pageCount+tr(' imatges PNG (60 notes com a màxim per imatge). En guardar-les es descarregarà un ZIP.',
       ' imágenes PNG (60 notas como máximo por imagen). Al guardarlas se descargará un ZIP.') :
       tr('Es guardarà una imatge PNG de la partitura.','Se guardará una imagen PNG de la partitura.')))+
   '</p></div>':'';

 return '<section class="pf-dictation-panel" aria-label="'+title+'">'+
 '<div class="pf-dictation-top"><div><h2>'+title+'</h2><p id="dictation-status" role="status">'+esc(status)+'</p></div>'+
 '<div id="dictation-current" class="pf-dictation-current" aria-label="'+tr('Nota detectada','Nota detectada')+'">'+esc(reading?.label||'—')+'</div></div>'+
 '<div class="pf-dictation-mode-line"><button type="button" class="pf-dictation-switch" data-action="dictation-mode" data-value="'+(marina?'musical':'marina')+'">'+
 (marina?'♫ ':'★ ')+switchLabel+'</button>'+
 (marina?'<small>'+tr('Mode de veu divertida','Modo divertido de voz')+'</small>':'')+'</div>'+
 (marina?'<div class="pf-marina-card"><div class="pf-marina-avatar" aria-hidden="true"><img src="./assets/marina-mascot.webp" alt="" decoding="async" loading="lazy"></div>'+
 '<div><strong>'+tr('Hola! Parla’m un poc i et convertiré la veu en una pluja de notes.','¡Hola! Háblame un poco y convertiré tu voz en una lluvia de notas.')+'</strong>'+
 '<p>'+tr('Detecta les alçades de la veu quasi en temps real i les escriu sobre el pentagrama perquè després pugues guardar-les o compartir-les.',
 'Detecta las alturas de la voz casi en tiempo real y las escribe en el pentagrama para que después puedas guardarlas o compartirlas.')+'</p></div></div>':
 '<label class="pf-dictation-select-label" for="dictation-instrument">'+tr('Instrument','Instrumento')+'</label>'+
 '<select id="dictation-instrument" class="pf-dictation-select"'+(running||pending||exporting?' disabled':'')+'>'+select+'</select>'+
 '<p class="pf-dictation-hint">'+tr('El dictat escriu la nota tal com la llig l’instrument seleccionat.','El dictado escribe la nota como la lee el instrumento seleccionado.')+'</p>'+
 (notes.length?'<p class="pf-dictation-hint pf-dictation-warning">'+tr('Canviar d’instrument neteja el dictat actual.','Cambiar de instrumento borra el dictado actual.')+'</p>':''))+
 '<p class="pf-dictation-note">'+tr(marina?'Mode lúdic: plasma amb rapidesa la veu en el pentagrama. No és un dictat rigorós; és una “melodia parlada”.':
 'Primera versió: transcriu l’altura de les notes; el ritme es representa amb negres.',
 marina?'Modo lúdico: plasma rápidamente la voz en el pentagrama. No es un dictado riguroso; es una «melodía hablada».':
 'Primera versión: transcribe la altura de las notas; el ritmo se representa con negras.')+'</p>'+
 '<div id="dictation-staff" class="pf-dictation-score" aria-live="off">'+
 (notes.length?dictationStaffSVG(notes,{clef,perRow,language}):
 '<div class="pf-dictation-empty">'+tr(marina?'Encara no hi ha notes. Activa Dictat Marina i parla, canta o diu qualsevol cosa.':
 'Encara no hi ha notes. Prem «Començar dictat» i toca l’instrument.',
 marina?'Todavía no hay notas. Activa Dictat Marina y habla, canta o di cualquier cosa.':
 'Todavía no hay notas. Pulsa «Iniciar dictado» y toca el instrumento.')+'</div>')+
 '</div>'+exportControls+'<div class="pf-dictation-footer"><button type="button" class="pf-dictation-toggle'+(running?' running':'')+'" data-action="dictation-toggle" aria-pressed="'+running+'"'+(pending||exporting?' disabled':'')+'>'+
 (running?'■ '+tr('Acabar dictat','Detener dictado'):pending?tr('Activant micròfon…','Activando micrófono…'):'● '+tr('Començar dictat','Iniciar dictado'))+'</button>'+
 '<button type="button" class="pf-dictation-clear" data-action="dictation-clear"'+(running||pending||exporting||!notes.length?' disabled':'')+'>'+tr('Netejar','Limpiar')+'</button></div>'+
 '<p class="pf-dictation-privacy">'+tr('El micròfon només s’activa quan comences. L’àudio es processa al dispositiu i no es guarda ni s’envia.',
 'El micrófono solo se activa cuando empiezas. El audio se procesa en tu dispositivo y no se guarda ni se envía.')+
 ' '+tr('La4 de referència','La4 de referencia')+': '+reference+' Hz.</p>'+
 '</section>';
}
