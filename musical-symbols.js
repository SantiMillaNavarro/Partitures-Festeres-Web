/* W2.4 — Segells musicals vectorials locals: cap font extern ni dades al servidor.
   Coordenades de glif: alçada 100; amplària indicada per la definició. */
export const SYMBOL_SIZES=Object.freeze([.035,.05,.07,.09,.12]);
export const SYMBOL_GROUPS=Object.freeze([
 {id:'notes',name:{va:'Figures',es:'Figuras'}},
 {id:'rests',name:{va:'Silencis',es:'Silencios'}},
 {id:'signs',name:{va:'Signes',es:'Signos'}},
 {id:'dynamics',name:{va:'Matisos',es:'Matices'}},
 {id:'tempo',name:{va:'Tempo',es:'Tempo'}}
]);
const head='<ellipse cx="32" cy="75" rx="19" ry="13" transform="rotate(-22 32 75)" fill="currentColor"/>';
const openHead='<ellipse cx="32" cy="75" rx="19" ry="13" transform="rotate(-22 32 75)" fill="none" stroke="currentColor" stroke-width="5"/>';
const stem='<path d="M49 72V10" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none"/>';
const flag='<path d="M49 10 Q91 15 73 51" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round"/>';
const doubleFlag='<path d="M49 31 Q89 39 70 70" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round"/>';
const restFlag='<path d="M50 16L31 79 M48 18Q86 24 71 48 M37 47Q72 50 58 72" stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"/>';
const textGlyph=(text,width,fontsize=65)=>{
 // Static, closed-list literals only, never a user supplied string.
 return {width,svg:'<text x="3" y="78" font-family="Georgia,Times New Roman,serif" font-size="'+fontsize+'" font-style="italic" fill="currentColor">'+text+'</text>'};
};
const spec=(group,va,es,svg,width=100)=>({group,name:{va,es},width,svg});
const SYMBOL_CATALOG={
 quarter:spec('notes','Negra','Negra',head+stem),
 half:spec('notes','Blanca','Blanca',openHead+stem),
 whole:spec('notes','Redona','Redonda','<ellipse cx="39" cy="56" rx="29" ry="18" fill="none" stroke="currentColor" stroke-width="7"/>'),
 eighth:spec('notes','Corxera','Corchea',head+stem+flag),
 sixteenth:spec('notes','Semicorxera','Semicorchea',head+stem+flag+doubleFlag),
 restWhole:spec('rests','Silenci de redona','Silencio de redonda',
  '<path d="M15 35H85 M27 36H73V55H27Z" stroke="currentColor" stroke-width="5" fill="currentColor"/>'),
 restHalf:spec('rests','Silenci de blanca','Silencio de blanca',
  '<path d="M15 56H85 M27 39H73V55H27Z" stroke="currentColor" stroke-width="5" fill="currentColor"/>'),
 restQuarter:spec('rests','Silenci de negra','Silencio de negra',
  '<path d="M53 8L32 33L57 55L34 73L61 91L43 61L62 43L42 25Z" fill="currentColor"/>'),
 restEighth:spec('rests','Silenci de corxera','Silencio de corchea',
  '<path d="M59 20L41 89" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><circle cx="42" cy="23" r="10" fill="currentColor"/><path d="M43 23Q75 22 59 52" fill="none" stroke="currentColor" stroke-width="6"/>'),
 restSixteenth:spec('rests','Silenci de semicorxera','Silencio de semicorchea',restFlag),
 sharp:spec('signs','Sostingut','Sostenido',
  '<path d="M38 9V91 M65 5V87 M16 39L86 27 M16 66L86 54" stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"/>'),
 flat:spec('signs','Bemoll','Bemol',
  '<path d="M32 5V88 M33 52Q87 29 74 68Q65 87 32 88" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>'),
 natural:spec('signs','Becaire','Becuadro',
  '<path d="M31 8V79 M69 23V93 M31 47L69 36 M31 79L69 68" stroke="currentColor" stroke-width="6" fill="none"/>'),
 fermata:spec('signs','Calderó','Calderón',
  '<path d="M15 62Q50 10 85 62" stroke="currentColor" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="50" cy="68" r="8" fill="currentColor"/>'),
 staccato:spec('signs','Picat','Picado','<circle cx="50" cy="50" r="12" fill="currentColor"/>'),
 pp:spec('dynamics','Pianissimo','Pianissimo',textGlyph('pp',117,68).svg,117),
 p:spec('dynamics','Piano','Piano',textGlyph('p',70,75).svg,70),
 mp:spec('dynamics','Mezzo piano','Mezzo piano',textGlyph('mp',151,66).svg,151),
 mf:spec('dynamics','Mezzo forte','Mezzo forte',textGlyph('mf',146,66).svg,146),
 f:spec('dynamics','Forte','Forte',textGlyph('f',66,75).svg,66),
 ff:spec('dynamics','Fortissimo','Fortissimo',textGlyph('ff',95,70).svg,95),
 sfz:spec('dynamics','Sforzando','Sforzando',textGlyph('sfz',149,60).svg,149),
 crescendo:spec('dynamics','Crescendo','Crescendo',
  '<path d="M12 51L169 18 M12 51L169 83" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',182),
 diminuendo:spec('dynamics','Diminuendo','Diminuendo',
  '<path d="M12 18L169 51 M12 83L169 51" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',182),
 rit:spec('tempo','Ritardando (rit.)','Ritardando (rit.)',textGlyph('rit.',117,53).svg,117),
 rall:spec('tempo','Rallentando (rall.)','Rallentando (rall.)',textGlyph('rall.',144,50).svg,144),
 accel:spec('tempo','Accelerando (accel.)','Acelerando (accel.)',textGlyph('accel.',175,46).svg,175),
 aTempo:spec('tempo','A tempo','A tempo',textGlyph('a tempo',196,43).svg,196),
 fine:spec('tempo','Fine','Fine',textGlyph('Fine',132,55).svg,132),
 dc:spec('tempo','Da Capo (D.C.)','Da Capo (D.C.)',textGlyph('D.C.',122,54).svg,122),
 ds:spec('tempo','Dal Segno (D.S.)','Dal Segno (D.S.)',textGlyph('D.S.',122,54).svg,122),
 coda:spec('tempo','Coda','Coda',
  '<circle cx="50" cy="50" r="25" stroke="currentColor" stroke-width="6" fill="none"/><path d="M50 8V92 M8 50H92" stroke="currentColor" stroke-width="6" fill="none"/>',100)
};
export const MUSICAL_SYMBOLS=Object.freeze(Object.fromEntries(
 Object.entries(SYMBOL_CATALOG).map(([id,item])=>[id,Object.freeze(item)])
));
export const MUSICAL_SYMBOL_IDS=Object.freeze(Object.keys(MUSICAL_SYMBOLS));
export const isMusicalSymbol=id=>typeof id==='string'&&Object.hasOwn(MUSICAL_SYMBOLS,id);
export function musicalSymbolBounds(stroke,w,h){
 const symbol=MUSICAL_SYMBOLS[stroke.symbolId];
 if(!symbol)return {width:0,height:0};
 const height=stroke.fontSize*Math.min(w,h);
 return {width:height*symbol.width/100,height};
}
export function musicalSymbolIcon(id){
 const item=MUSICAL_SYMBOLS[id];
 if(!item)return '';
 return '<svg class="musical-symbol-preview" viewBox="0 0 '+item.width+' 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+item.svg+'</svg>';
}
