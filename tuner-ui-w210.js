/* W2.10 — Afinador basat en TunerPanel, TunerGauge i PitchHistoryChart d'Android. */
import {normalizeReference} from './tuner-w210.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const radians=a=>a*Math.PI/180;
const pt=(angle,radius,cx=230,cy=213)=>[cx+Math.cos(radians(angle))*radius,cy+Math.sin(radians(angle))*radius];
const arc=(from,to,radius)=>{
 const [x1,y1]=pt(from,radius),[x2,y2]=pt(to,radius);
 return 'M '+x1.toFixed(2)+' '+y1.toFixed(2)+' A '+radius+' '+radius+' 0 '+(to-from>180?1:0)+' 1 '+x2.toFixed(2)+' '+y2.toFixed(2);
};
const marks=Array.from({length:21},(_,i)=>{
 const cents=-50+i*5,angle=270+cents/50*65,major=cents%10===0;
 const [x1,y1]=pt(angle,major?141:152),[x2,y2]=pt(angle,165);
 return '<line x1="'+x1.toFixed(2)+'" y1="'+y1.toFixed(2)+'" x2="'+x2.toFixed(2)+'" y2="'+y2.toFixed(2)+'" stroke="'+(cents===0?'#367d54':'#ac8850')+'" stroke-width="'+(cents===0?4:major?2.4:1.2)+'"/>';
}).join('');
export function tunerNeedleCoords(cents=0){
 const angle=270+Math.min(50,Math.max(-50,Number(cents)||0))/50*65;
 const [x,y]=pt(angle,139);
 return {x:x.toFixed(2),y:y.toFixed(2)};
}
export function renderTunerMarkup({reference=442,running=false,pending=false,language='va'}={}){
 const va=language!=='es',t=(ca,es)=>va?ca:es,referenceHz=normalizeReference(reference);
 const needle=tunerNeedleCoords(0);
 return '<section class="pf-tuner-panel" aria-label="'+t('Afinador cromàtic','Afinador cromático')+'">'+
  '<div class="pf-tuner-main">'+
   '<strong class="pf-tuner-note" id="tuner-note" aria-live="off">—</strong>'+
   '<p class="pf-tuner-frequency" id="tuner-frequency">'+t('Esperant una nota…','Esperando una nota…')+'</p>'+
   '<svg id="tuner-gauge" class="pf-tuner-gauge" viewBox="0 0 460 235" role="img" aria-label="'+t('Desviació en cents de menys cinquanta a més cinquanta','Desviación en cents de menos cincuenta a más cincuenta')+'">'+
    '<path d="'+arc(205,335,165)+'" fill="none" stroke="#d8c298" stroke-width="10"/>'+
    '<path d="'+arc(257,283,165)+'" fill="none" stroke="#bda36a" stroke-opacity=".55" stroke-width="21"/>'+
    '<path d="'+arc(263.5,276.5,165)+'" fill="none" stroke="#3a8054" stroke-opacity=".88" stroke-width="23"/>'+
    marks+
    '<line data-tuner-needle x1="230" y1="213" x2="'+needle.x+'" y2="'+needle.y+'" stroke="#751c2c" stroke-width="7" stroke-linecap="round"/>'+
    '<circle cx="230" cy="213" r="12" fill="#ad8850"/><circle cx="230" cy="213" r="5" fill="#741c2c"/>'+
   '</svg>'+
   '<div class="pf-tuner-labels"><span>−50</span><span>−25</span><span>0</span><span>+25</span><span>+50</span></div>'+
   '<p class="pf-tuner-status" id="tuner-status" role="status" aria-live="polite">'+t('Zona afinada: ±5 cents','Zona afinada: ±5 cents')+'</p>'+
   '<button type="button" data-action="tuner-toggle" class="pf-tuner-toggle'+(running?' running':'')+'" aria-pressed="'+running+'">'+
    '<span aria-hidden="true">'+(running?'■':'🎙')+'</span> '+t(running?'Parar':pending?'Activant…':'Iniciar',running?'Parar':pending?'Activando…':'Iniciar')+'</button>'+
   '<p class="pf-tuner-help" id="tuner-permission">'+t('Autoritza el micròfon quan el navegador ho demane.','Autoriza el micrófono cuando el navegador lo solicite.')+'</p>'+
  '</div>'+
  '<div class="pf-tuner-side">'+
   '<div class="pf-tuner-history-heading"><div><h3>'+t('Historial d’afinació','Historial de afinación')+'</h3>'+
    '<p>'+t('Desviació de la nota en cents','Desviación de la nota en cents')+'</p></div>'+
    '<button type="button" data-action="tuner-clear">'+t('Netejar','Limpiar')+'</button></div>'+
   '<svg class="pf-tuner-history" viewBox="0 0 550 160" preserveAspectRatio="none" role="img" aria-label="'+t('Gràfica de desviació de les últimes notes','Gráfica de desviación de las últimas notas')+'">'+
    '<rect x="8" y="72.6" width="534" height="14.8" fill="#3e8053" opacity=".15"/>'+
    '<path d="M8 80H542" stroke="#3e8053" stroke-width="1.6"/>'+
    '<path d="M8 10H542 M8 45H542 M8 115H542 M8 150H542" fill="none" stroke="#bca77b" stroke-opacity=".35"/>'+
    '<path id="tuner-history-line" d="" fill="none" stroke="#741c2c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+
   '</svg>'+
   '<label class="pf-tuner-reference-label" for="tuner-reference">'+t('Referència: La','Referencia: La')+' <output id="tuner-reference-output">'+referenceHz+'</output> Hz</label>'+
   '<input id="tuner-reference" type="range" min="430" max="450" step="1" value="'+referenceHz+'" aria-label="'+t('Freqüència de referència del La','Frecuencia de referencia de La')+'"/>'+
   '<div class="pf-tuner-reference-footer"><span>430 Hz</span><button type="button" data-action="tuner-reference-reset">'+t('Restablir 442','Restablecer 442')+'</button><span>450 Hz</span></div>'+
   '<p class="pf-tuner-privacy">'+t('El so s’analitza només en este dispositiu i no es guarda ni s’envia. El micròfon es desconnecta en eixir d’Eines o quan l’app passa a segon pla.','El sonido se analiza solo en este dispositivo; no se guarda ni se envía. El micrófono se desconecta al salir de Herramientas o al pasar a segundo plano.')+'</p>'+
  '</div>'+
 '</section>';
}
