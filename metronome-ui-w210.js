/* W2.10 — Metrònom a Eines, presentació compacta basada en ToolsScreen.kt. */
import {METRONOME_SIGNATURES,getMetronomeSignature,METRONOME_MIN_BPM,METRONOME_MAX_BPM} from './metronome-w29.js';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function renderMetronomeMarkup({bpm=100,signature='4/4',running=false,activeIndex=0,pending=false,language='va'}={}){
 const va=language!=='es',s=getMetronomeSignature(signature),value=escapeHtml(bpm);
 const str=(cat,es)=>va?cat:es;
 const signatureChoices=METRONOME_SIGNATURES.map(item=>
  '<button type="button" class="pf-metro-signature'+(item.label===s.label?' active':'')+'" data-action="metro-signature" data-value="'+item.label+'" aria-pressed="'+(item.label===s.label)+'">'+item.label+'</button>'
 ).join('');
 const events=Array.from({length:s.mainBeats},(_,beat)=>
  '<div class="pf-metro-beat-group" role="presentation">'+
   Array.from({length:s.subdivisionsPerBeat},(_,sub)=>{
    const index=beat*s.subdivisionsPerBeat+sub;
    return '<span class="pf-metro-dot'+(index===0?' downbeat':'')+(sub===0?' group-start':'')+(running&&index===activeIndex?' active':'')+'" data-metro-event="'+index+'" aria-hidden="true"></span>';
   }).join('')+'</div>'
 ).join('');
 return '<section class="pf-tools-screen" aria-labelledby="metro-title">'+
  
  '<div class="pf-metro-panel">'+
   '<div class="pf-metro-display">'+
    '<div class="pf-metro-dial" aria-label="'+str('Velocitat del metrònom','Velocidad del metrónomo')+'">'+
     '<div class="pf-metro-note" aria-hidden="true">♫</div><div class="pf-metro-number" id="metro-big-bpm">'+value+'</div>'+
     '<div class="pf-metro-dial-caption">BPM · <span id="metro-dial-signature">'+s.label+'</span></div>'+
    '</div>'+
    '<div class="pf-metro-pulses" role="group" aria-label="'+str('Polsos del compàs','Pulsos del compás')+'">'+events+'</div>'+
    '<button type="button" class="pf-metro-play'+(running?' playing':'')+'" data-action="metro-toggle" aria-pressed="'+running+'"'+(pending?' disabled':'')+'>'+
     '<span aria-hidden="true">'+(running?'■':'▶')+'</span><span>'+str(running?'Parar':'Iniciar',running?'Parar':'Iniciar')+'</span>'+
    '</button>'+
    '<span class="pf-metro-status" id="metro-status" role="status" aria-live="polite">'+str(running?'Metrònom en marxa':'Metrònom parat',running?'Metrónomo en marcha':'Metrónomo parado')+'</span>'+
   '</div>'+
   '<div class="pf-metro-controls">'+
    '<h3 id="metro-title">'+str('Metrònom','Metrónomo')+'</h3>'+
    '<label class="pf-metro-range-label" for="metro-bpm">'+str('Tempo','Tempo')+' <output id="metro-range-value" for="metro-bpm">'+value+' BPM</output></label>'+
    '<input id="metro-bpm" type="range" min="'+METRONOME_MIN_BPM+'" max="'+METRONOME_MAX_BPM+'" step="1" value="'+value+'" aria-label="'+str('Tempo en BPM','Tempo en BPM')+'"/>'+
    '<div class="pf-metro-adjust">'+
      '<button type="button" data-action="metro-minus" aria-label="'+str('Reduir el tempo en un BPM','Reducir el tempo en un BPM')+'">−</button>'+
      '<span>'+METRONOME_MIN_BPM+'–'+METRONOME_MAX_BPM+' BPM</span>'+
      '<button type="button" data-action="metro-plus" aria-label="'+str('Augmentar el tempo en un BPM','Aumentar el tempo en un BPM')+'">+</button>'+
    '</div>'+
    '<h4>'+str('Compàs','Compás')+'</h4>'+
    '<div class="pf-metro-signatures" role="group" aria-label="'+str('Tria el compàs','Elige el compás')+'">'+signatureChoices+'</div>'+
    '<p class="pf-metro-explanation">'+(s.subdivisionsPerBeat===3?
      str('Cada pols principal es divideix en tres corxeres.','Cada pulso principal se divide en tres corcheas.'):
      str('El BPM correspon a cada temps principal.','El BPM corresponde a cada tiempo principal.'))+'</p>'+
    '<p class="pf-metro-sounds">'+str('Dos sons: primer pols accentuat i un mateix clic per a la resta.','Dos sonidos: primer pulso acentuado y un mismo clic para el resto.')+'</p>'+
   '</div></div>'+
   '<p class="pf-tools-coming">'+str('Pròximament: Dictat Musical.','Próximamente: Dictado Musical.')+'</p>'+
  '</section>';
}
