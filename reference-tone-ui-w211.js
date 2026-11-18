/* W2.11 — Presentació del panell Nota de referència, basada en ToolsScreen.kt.
   Selecció cromàtica i octaves reals (Android), no botons decoratius. */
import {REFERENCE_NOTE_NAMES,REFERENCE_SHORTCUTS,referenceLabel,referenceFrequency} from './reference-tone-w211.js';
export function renderReferenceToneMarkup({pitchClass=9,octave=4,referenceA4=442,running=false,pending=false,language='va'}={}){
 const va=language!=='es',tr=(ca,es)=>va?ca:es;
 const note=referenceLabel(pitchClass,octave),frequency=referenceFrequency(pitchClass,octave,referenceA4);
 const choices=REFERENCE_NOTE_NAMES.map((name,index)=>
  '<button type="button" class="pf-reference-choice'+(index===pitchClass?' active':'')+'" data-action="reference-note" data-value="'+index+'" aria-pressed="'+(index===pitchClass)+'" aria-label="'+name+'">'+name+'</button>').join('');
 const octaves=[2,3,4,5,6].map(n=>
  '<button type="button" class="pf-reference-choice pf-reference-octave-choice'+(n===octave?' active':'')+'" data-action="reference-octave" data-value="'+n+'" aria-pressed="'+(n===octave)+'">'+n+'</button>').join('');
 const shortcuts=REFERENCE_SHORTCUTS.map(item=>
  '<button type="button" class="pf-reference-shortcut'+(item.pitchClass===pitchClass&&item.octave===octave?' active':'')+'" data-action="reference-shortcut" data-value="'+item.label+'">'+item.label+'</button>').join('');
 return '<section class="pf-reference-panel" aria-label="'+tr('Nota de referència','Nota de referencia')+'">'+
 '<div class="pf-reference-display"><div class="pf-reference-note-symbol" aria-hidden="true">♫</div>'+
 '<strong id="reference-note-label" class="pf-reference-name">'+note+'</strong>'+
 '<p id="reference-frequency" class="pf-reference-frequency">'+frequency.toFixed(2)+' Hz</p>'+
 '<button type="button" class="pf-reference-toggle'+(running?' running':'')+'" data-action="reference-toggle" aria-pressed="'+running+'"'+(pending?' disabled':'')+'>'+
 '<span aria-hidden="true">'+(running?'■':'▶')+'</span> '+tr(running?'Parar nota':pending?'Activant…':'Fer sonar',running?'Parar nota':pending?'Activando…':'Reproducir')+'</button>'+
 '<p class="pf-reference-caption">'+tr('Referència d’afinació','Referencia de afinación')+': La4 = <strong id="reference-a4">'+referenceA4+'</strong> Hz</p>'+
 '<p class="pf-reference-info">'+tr('El so es genera en este dispositiu i continua fins que el pares.','El sonido se genera en este dispositivo y continúa hasta que lo detengas.')+'</p></div>'+
 '<div class="pf-reference-controls">'+
 '<h3>'+tr('Nota','Nota')+'</h3><div class="pf-reference-grid" role="group" aria-label="'+tr('Selecciona la nota','Selecciona la nota')+'">'+choices+'</div>'+
 '<h3>'+tr('Octava','Octava')+'</h3><div class="pf-reference-octaves" role="group" aria-label="'+tr('Selecciona l’octava','Selecciona la octava')+'">'+octaves+'</div>'+
 '<h3>'+tr('Accés ràpid','Acceso rápido')+'</h3><div class="pf-reference-shortcuts" role="group" aria-label="'+tr('Notes d’accés ràpid','Notas de acceso rápido')+'">'+shortcuts+'</div>'+
 '</div></section>';
}
