/* W2.13.1 — Estructura d'Afegir i previsualització de pàgines escanejades.
   Contrastat amb AddContentScreen.kt i ScanImportPolicy.kt d'Android 1.11.15.
*/
import {scanFolderChoices,SCAN_PAGE_LIMIT,SCAN_FILTERS,uniqueScanPath,normalizeScanName} from './scanner-pdf-w2131.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function scanCopy(language='va'){
 const va=language!=='es';
 return (v,e)=>va?v:e;
}
export function renderScannerMarkup({pages=[],name='Nova partitura',folder='',repertoires=[],addToRep=false,repId='',busy=false,progress=0,error='',language='va',scores=[]}={}){
 const tr=scanCopy(language),hasPages=pages.length>0;
 const folders=scanFolderChoices(scores);
 if(folder&&!folders.includes(folder))folders.push(folder);
 const choices=folders.map(value=>'<option value="'+esc(value)+'"'+(value===folder?' selected':'')+'>'+esc(value||tr('Carpeta arrel','Carpeta raíz'))+'</option>').join('');
 const repertories=repertoires.map(r=>'<option value="'+esc(r.id)+'"'+(r.id===repId?' selected':'')+'>'+esc(r.name)+'</option>').join('');
 const pathConflict=(()=>{
  try{
   const path=[folder,normalizeScanName(name)].filter(Boolean).join('/');
   if(!(scores||[]).some(s=>s.path===path))return '';
   return uniqueScanPath(path,new Set(scores.map(s=>s.path)));
  }catch{return '';}
 })();
 const filterName=filter=>({
  original:tr('Original','Original'),enhanced:tr('Millorar','Mejorar'),
  gray:tr('Grisos','Grises'),bw:tr('Blanc i negre','Blanco y negro')
 })[filter]||filter;
 const pagesHTML=pages.map((page,i)=>{
  const css=page.filter==='enhanced'?'contrast(1.16) brightness(1.04)':page.filter==='gray'?'grayscale(1) contrast(1.12)':page.filter==='bw'?'grayscale(1) contrast(2.25) brightness(1.12)':'none';
  return '<article class="pf-scan-page" data-scan-page="'+page.id+'">'+
   '<div class="pf-scan-image"><img src="'+esc(page.previewUrl||page.url)+'" alt="'+tr('Pàgina','Página')+' '+(i+1)+'" style="transform:rotate('+page.rotation+'deg);filter:'+css+'" loading="lazy"></div>'+
   '<div class="pf-scan-page-caption"><strong>'+tr('Pàgina','Página')+' '+(i+1)+'</strong><small>'+esc(page.file.name)+'</small></div>'+
   '<div class="pf-scan-page-controls" role="group" aria-label="'+tr('Opcions de la pàgina','Opciones de página')+' '+(i+1)+'">'+
     '<button type="button" data-action="scan-up" data-value="'+page.id+'" aria-label="'+tr('Pujar pàgina','Subir página')+'" title="'+tr('Pujar','Subir')+'"'+(busy||i===0?' disabled':'')+'>↑</button>'+
     '<button type="button" data-action="scan-down" data-value="'+page.id+'" aria-label="'+tr('Baixar pàgina','Bajar página')+'" title="'+tr('Baixar','Bajar')+'"'+(busy||i===pages.length-1?' disabled':'')+'>↓</button>'+
     '<button type="button" data-action="scan-rotate" data-value="'+page.id+'" aria-label="'+tr('Girar la pàgina 90 graus','Girar la página 90 grados')+'" title="'+tr('Girar 90°','Girar 90°')+'"'+(busy?' disabled':'')+'>↻</button>'+
     '<button type="button" data-action="scan-remove" data-value="'+page.id+'" aria-label="'+tr('Eliminar pàgina','Eliminar página')+'" title="'+tr('Eliminar','Eliminar')+'"'+(busy?' disabled':'')+'>×</button>'+
   '</div><div class="pf-scan-crop-line"><button type="button" class="pf-scan-crop-button'+(page.crop?' pf-scan-crop-done':'')+'" data-action="scan-crop" data-value="'+page.id+'"'+(busy?' disabled':'')+'>'+
     (page.crop?'✓ ':'✂ ')+(page.crop?tr('Ajustar retall','Ajustar recorte'):tr('Retallar fulla','Recortar hoja'))+
     '</button></div><label class="pf-scan-filter-label" for="scan-filter-'+page.id+'">'+tr('Filtre','Filtro')+
    '<select id="scan-filter-'+page.id+'" data-scan-filter="'+page.id+'"'+(busy?' disabled':'')+'>'+
     SCAN_FILTERS.map(filter=>'<option value="'+filter+'"'+(page.filter===filter?' selected':'')+'>'+esc(filterName(filter))+'</option>').join('')+
    '</select></label></article>';
 }).join('');
 return '<section class="pf-scan-screen" aria-label="'+tr('Afegir partitures','Añadir partituras')+'">'+
  '<div class="pf-scan-header"><div><h2>'+tr('Afegir partitures','Añadir partituras')+'</h2><p>'+
   tr('Escaneja amb la càmera o tria fotografies per a crear un PDF multipàgina.','Escanea con la cámara o elige fotografías para crear un PDF multipágina.')+
  '</p></div><button type="button" class="pf-scan-close" data-action="scan-close"'+(busy?' disabled':'')+'>'+tr('Tornar a la biblioteca','Volver a la biblioteca')+'</button></div>'+
  '<div class="pf-scan-actionbar" role="group" aria-label="'+tr('Origen de les partitures','Origen de las partituras')+'">'+
   '<button class="pf-scan-camera" type="button" data-action="scan-camera"'+(busy||pages.length>=SCAN_PAGE_LIMIT?' disabled':'')+'>▣ '+tr('Escàner automàtic','Escáner automático')+'</button>'+
   '<button class="pf-scan-gallery" type="button" data-action="scan-gallery"'+(busy||pages.length>=SCAN_PAGE_LIMIT?' disabled':'')+'>▤ '+tr('Afegir fotos','Añadir fotos')+'</button>'+
   '<button class="pf-scan-system" type="button" data-action="scan-camera-file"'+(busy||pages.length>=SCAN_PAGE_LIMIT?' disabled':'')+'>▣ '+tr('Foto del sistema','Foto del sistema')+'</button>'+
   '<button class="pf-scan-import" type="button" data-action="scan-import"'+(busy?' disabled':'')+'>↓ '+tr('Importar PDF','Importar PDF')+'</button>'+
  '</div><p class="pf-scan-browser-hint">'+
   tr('L’escàner detecta la fulla i la captura automàticament quan està quieta. Si no reconeix les vores, pots capturar-la manualment o utilitzar «Foto del sistema». Tot es processa en el dispositiu.',
      'El escáner detecta la hoja y la captura automáticamente cuando está quieta. Si no reconoce los bordes, puedes capturarla manualmente o usar «Foto del sistema». Todo se procesa en el dispositivo.')+
   '</p>'+
  '<div class="pf-scan-workspace"><section class="pf-scan-preview" aria-label="'+tr('Pàgines capturades','Páginas capturadas')+'">'+
   '<div class="pf-scan-panel-head"><h3>'+tr('Pàgines capturades','Páginas capturadas')+' · '+pages.length+'/'+SCAN_PAGE_LIMIT+'</h3>'+
   (hasPages?'<button type="button" class="pf-scan-clear" data-action="scan-clear"'+(busy?' disabled':'')+'>'+tr('Netejar totes','Limpiar todas')+'</button>':'')+'</div>'+
   (hasPages?'<div class="pf-scan-page-grid">'+pagesHTML+'</div>':
    '<div class="pf-scan-empty"><div aria-hidden="true">▤</div><strong>'+tr('Encara no hi ha pàgines','Todavía no hay páginas')+'</strong><p>'+
    tr('Captura una pàgina amb la càmera o importa diverses fotografies.',
       'Captura una página con la cámara o importa varias fotografías.')+'</p></div>')+
  '</section><section class="pf-scan-fields" aria-label="'+tr('Dades de la partitura','Datos de la partitura')+'"><h3>'+
   tr('Dades de la partitura','Datos de la partitura')+'</h3>'+
   '<label for="scan-name">'+tr('Nom','Nombre')+'</label><input id="scan-name" type="text" maxlength="119" autocomplete="off" value="'+esc(name)+'"'+(busy?' disabled':'')+'>'+
   '<label for="scan-folder">'+tr('Guardar en','Guardar en')+'</label><select id="scan-folder"'+(busy?' disabled':'')+'>'+choices+'</select>'+
   (repertoires.length?
    '<label class="pf-scan-rep-check"><input id="scan-to-rep" type="checkbox"'+(addToRep?' checked':'')+(busy?' disabled':'')+'> '+tr('Afegir a un repertori','Añadir a un repertorio')+'</label>'+
    (addToRep?'<label for="scan-rep">'+tr('Repertori','Repertorio')+'</label><select id="scan-rep"'+(busy?' disabled':'')+'>'+repertories+'</select>':''):
    '')+
   (pathConflict?'<p class="pf-scan-duplicate">'+tr('Ja hi ha una partitura amb eixe nom. Es guardarà com a: ','Ya existe una partitura con ese nombre. Se guardará como: ')+
    '<strong>'+esc(pathConflict.split('/').at(-1))+'</strong></p>':'')+
   '<p class="pf-scan-hint">'+tr('Es conservarà el PDF original de les altres partitures; els noms repetits es guarden com a còpies noves.',
    'Se conservará el PDF original de las demás partituras; los nombres repetidos se guardan como copias nuevas.')+'</p>'+
   '<button type="button" class="pf-scan-save" data-action="scan-save"'+(!hasPages||busy?' disabled':'')+'>'+
    (busy?tr('Creant PDF…','Creando PDF…'):tr('Guardar partitura PDF','Guardar partitura PDF'))+'</button>'+
   (busy?'<p id="scan-progress" class="pf-scan-progress" role="status">'+tr('Processant','Procesando')+' '+progress+'/'+pages.length+'</p>':'')+
   (error?'<p class="pf-scan-error" role="alert">'+esc(error)+'</p>':'')+
   '<p class="pf-scan-hint">'+tr('El PDF es desa a la Biblioteca local i s’inclourà en les còpies de seguretat ZIP.',
    'El PDF se guarda en la Biblioteca local y se incluirá en las copias de seguridad ZIP.')+'</p>'+
  '</section></div>'+
  '<p class="pf-scan-limit">'+tr('Fins a 30 pàgines. Pots retallar cadascuna, ajustar les quatre cantonades i previsualitzar la perspectiva abans de guardar el PDF.',
   'Hasta 30 páginas. Puedes recortar cada una, ajustar las cuatro esquinas y previsualizar la perspectiva antes de guardar el PDF.')+'</p>'+
  '</section>';
}
