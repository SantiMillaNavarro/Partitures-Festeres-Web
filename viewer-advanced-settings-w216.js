/* W2.16 — Opcions avançades del visor. Paritat amb Android AppSettings
 * (SettingsStore.kt + SettingsScreen.kt, versió Android 1.11.15).
 * L'API Wake Lock i la brillantor CSS són alternatives web honestes.
 */
export const VIEWER_SETTINGS_KEY='w216:viewerSettings';
export const VIEWER_SETTINGS_DEFAULTS=Object.freeze({
 menuHideSeconds:3,
 showScoreNameOnChange:false,
 rememberZoom:true,
 keepScreenOn:true,
 allowViewerRotation:true,
 sideTapFraction:.22,
 overrideBrightness:false,
 brightnessPercent:80,
});
export const VIEWER_SETTING_FIELDS=Object.freeze(Object.keys(VIEWER_SETTINGS_DEFAULTS));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function normalizeViewerSettings(value={}){
 const d=VIEWER_SETTINGS_DEFAULTS;
 const settings=value&&typeof value==='object'?value:{};
 const int=(k,min,max)=>Number.isFinite(Number(settings[k]))?
   clamp(Math.round(Number(settings[k])),min,max):d[k];
 const flag=k=>typeof settings[k]==='boolean'?settings[k]:d[k];
 const fraction=Number.isFinite(Number(settings.sideTapFraction))?
   clamp(Number(settings.sideTapFraction),.12,.32):d.sideTapFraction;
 return {
  menuHideSeconds:int('menuHideSeconds',1,10),
  showScoreNameOnChange:flag('showScoreNameOnChange'),
  rememberZoom:flag('rememberZoom'),
  keepScreenOn:flag('keepScreenOn'),
  allowViewerRotation:flag('allowViewerRotation'),
  sideTapFraction:Math.round(fraction*1000)/1000,
  overrideBrightness:flag('overrideBrightness'),
  brightnessPercent:int('brightnessPercent',20,100),
 };
}
export function sideTapAction(relativeX,fraction=.22){
 const x=Number(relativeX),safe=clamp(Number(fraction)||.22,.12,.32);
 if(!Number.isFinite(x))return 'menu';
 return x<safe?'previous':x>1-safe?'next':'menu';
}
export function brightnessShadeOpacity(settings){
 const safe=normalizeViewerSettings(settings);
 return safe.overrideBrightness?Math.round((1-safe.brightnessPercent/100)*.80*1000)/1000:0;
}
const text=(va,es,lang)=>lang==='es'?es:va;
export function renderViewerSettings(settings,lang='va'){
 const cfg=normalizeViewerSettings(settings);
 const tr=(va,es)=>text(va,es,lang);
 const toggle=(key,label,help='')=>
  '<label class="pf-vs-toggle" for="pf-vs-'+key+'"><span class="pf-vs-toggle-info"><strong>'+
  label+'</strong>'+(help?'<small>'+help+'</small>':'')+'</span>'+
  '<input type="checkbox" id="pf-vs-'+key+'" data-viewer-setting="'+key+'" '+
  (cfg[key]?'checked':'')+' /></label>';
 const slider=(key,label,min,max,step,suffix,help='')=>
  '<div class="pf-vs-slider"><label for="pf-vs-'+key+'"><strong>'+label+
   '</strong><output id="pf-vs-out-'+key+'">'+
   (key==='sideTapFraction'?Math.round(cfg[key]*100):cfg[key])+suffix+'</output></label>'+
   (help?'<p>'+help+'</p>':'')+
   '<input id="pf-vs-'+key+'" data-viewer-setting="'+key+'" type="range" min="'+min+
   '" max="'+max+'" step="'+step+'" value="'+cfg[key]+'" /></div>';
 return '<section class="panel pf-viewer-settings" aria-labelledby="pf-viewer-settings-heading">'+
  '<div class="pf-vs-heading"><h3 id="pf-viewer-settings-heading">'+
   tr('Ajustos avançats del visor','Ajustes avanzados del visor')+'</h3>'+
   '<p>'+tr('Com en Android: estos controls afecten la lectura, no els PDFs ni les anotacions.',
    'Como en Android: estos controles afectan a la lectura, no a los PDF ni a las anotaciones.')+'</p></div>'+
  slider('menuHideSeconds',tr('Amagar menús després de','Ocultar menús tras'),1,10,1,
   tr(' s',' s'),tr('Temps que resten visibles els controls després de tocar el centre.',
    'Tiempo que permanecen visibles los controles al tocar el centro.'))+
  toggle('showScoreNameOnChange',
   tr('Mostrar el nom de la partitura al canviar','Mostrar nombre de la partitura al cambiar'),
   tr('Mostra el nom durant 1,2 segons en obrir una obra.','Muestra el nombre durante 1,2 segundos al abrir una obra.'))+
  toggle('rememberZoom',tr('Recordar el zoom','Recordar el zoom'),
   tr('Si està desactivat, cada partitura comença al 100 %.','Si está desactivado, cada partitura comienza al 100 %.'))+
  toggle('keepScreenOn',tr('Mantindre la pantalla encesa','Mantener la pantalla encendida'),
   tr('Utilitza la funció Wake Lock si el navegador la permet; no està garantida en tots els dispositius.',
    'Utiliza Wake Lock si el navegador lo permite; no se garantiza en todos los dispositivos.'))+
  toggle('allowViewerRotation',tr('Intentar orientació horitzontal','Intentar orientación horizontal'),
   tr('Activa el bloqueig horitzontal del visor quan el navegador el permet. Desactiva’l per a respectar l’orientació actual.',
    'Activa el bloqueo horizontal del visor cuando lo permite el navegador. Desactívalo para respetar la orientación actual.'))+
  slider('sideTapFraction',tr('Amplària de les zones laterals','Anchura de las zonas laterales'),
    .12,.32,.02,' %',
   tr('Toca a l’esquerra per a retrocedir, a la dreta per a avançar i al centre per a mostrar els controls.',
    'Toca a la izquierda para retroceder, a la derecha para avanzar y en el centro para mostrar los controles.'))+
  '<div class="pf-vs-tap-preview" aria-label="'+tr('Previsualització de zones tàctils','Vista previa de zonas táctiles')+'">'+
  '<span class="pf-vs-tap-left">‹</span><span class="pf-vs-tap-middle">'+
    tr('Menú','Menú')+'</span><span class="pf-vs-tap-right">›</span></div>'+
  toggle('overrideBrightness',tr('Ajustar la llum del visor','Ajustar la luz del visor'),
   tr('La web atenua la imatge, però no pot canviar el brillantor físic de la pantalla.',
    'La web atenúa la imagen, pero no puede cambiar el brillo físico de la pantalla.'))+
  '<div id="pf-vs-brightness-options" '+(!cfg.overrideBrightness?'hidden':'')+'>'+
   slider('brightnessPercent',tr('Llum relativa del visor','Luz relativa del visor'),
    20,100,10,' %')+
   '<div class="pf-vs-brightness-preview" aria-hidden="true">'+
     '<div class="pf-vs-brightness-staves"><i></i><i></i><i></i><i></i><i></i></div>'+
     '<div class="pf-vs-brightness-shade" style="background:rgba(0,0,0,'+
      brightnessShadeOpacity(cfg)+')"></div></div>'+
  '</div>'+
  '<div class="pf-vs-actions"><button type="button" class="secondary" data-action="viewer-settings-reset">'+
  tr('Restablir valors Android','Restablecer valores Android')+'</button>'+
  '<button type="button" class="primary" data-action="viewer-settings-save">'+
  tr('Guardar canvis','Guardar cambios')+'</button></div>'+
  '<p class="pf-vs-status" id="pf-vs-status" role="status" aria-live="polite">'+
  tr('Valors predeterminats equivalents a Android 1.11.15.',
    'Valores predeterminados equivalentes a Android 1.11.15.')+'</p>'+
  '</section>';
}
export function updateViewerSettingsPreview(settings){
 const cfg=normalizeViewerSettings(settings);
 const q=k=>document.getElementById('pf-vs-'+k);
 const out=(k,value)=>{
  const node=document.getElementById('pf-vs-out-'+k);if(node)node.textContent=value;
 };
 out('menuHideSeconds',cfg.menuHideSeconds+' s');
 out('sideTapFraction',Math.round(cfg.sideTapFraction*100)+' %');
 out('brightnessPercent',cfg.brightnessPercent+' %');
 const preview=document.querySelector('.pf-vs-tap-preview');
 if(preview){
  preview.querySelector('.pf-vs-tap-left').style.flexBasis=(cfg.sideTapFraction*100)+'%';
  preview.querySelector('.pf-vs-tap-middle').style.flexBasis=((1-2*cfg.sideTapFraction)*100)+'%';
  preview.querySelector('.pf-vs-tap-right').style.flexBasis=(cfg.sideTapFraction*100)+'%';
 }
 const brightness=document.getElementById('pf-vs-brightness-options');
 if(brightness)brightness.hidden=!cfg.overrideBrightness;
 const shade=document.querySelector('.pf-vs-brightness-shade');
 if(shade)shade.style.background='rgba(0,0,0,'+brightnessShadeOpacity(cfg)+')';
 for(const [key,value] of Object.entries(cfg)){
  const input=q(key);
  if(!input)continue;
  if(input.type==='checkbox')input.checked=value;
  else if(document.activeElement!==input)input.value=value;
 }
}
export class ViewerWakeManager {
 constructor({wakeLock=()=>navigator.wakeLock,visibility=()=>document.visibilityState}={}){
  this.wakeLock=wakeLock;
  this.visibility=visibility;
  this.enabled=false;
  this.sentinel=null;
  this.token=0;
  this.requesting=false;
 }
 async setEnabled(enabled){
  this.enabled=!!enabled;
  this.token++;
  if(!enabled){
   const current=this.sentinel;this.sentinel=null;
   if(current)try{await current.release();}catch{}
   return false;
  }
  return this.acquire(this.token);
 }
 async acquire(token=this.token){
  if(!this.enabled||this.visibility()!=='visible'||this.sentinel||this.requesting)return false;
  const api=this.wakeLock();
  if(!api||typeof api.request!=='function')return false;
  this.requesting=true;
  try{
   const lock=await api.request('screen');
   if(!this.enabled||this.visibility()!=='visible'||token!==this.token){
    try{await lock.release();}catch{}
    return false;
   }
   this.sentinel=lock;
   lock.addEventListener?.('release',()=>{
    if(this.sentinel===lock)this.sentinel=null;
   });
   return true;
  }catch{return false;}
  finally{this.requesting=false;}
 }
 async onVisibilityChange(){
  if(this.visibility()!=='visible'){
   const current=this.sentinel;this.sentinel=null;
   if(current)try{await current.release();}catch{}
   return;
  }
  if(this.enabled)await this.acquire();
 }
}
