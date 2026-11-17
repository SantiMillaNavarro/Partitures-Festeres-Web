/* W2.3.1 — Visor horitzontal: transforma coordenades de pantalla a coordenades
   locals de la interfície. El PDF no es gira ni modifica en disc. */
export function clientToViewerPoint(clientX,clientY,rect,cssRotated=false){
 if(cssRotated)return {x:clientY-rect.top,y:rect.right-clientX};
 return {x:clientX-rect.left,y:clientY-rect.top};
}
export function visualViewerDimensions(rect,cssRotated=false){
 return {width:cssRotated?rect.height:rect.width,height:cssRotated?rect.width:rect.height};
}
export function isViewerCssRotated(viewerRoot){
 if(!viewerRoot)return false;
 const transform=getComputedStyle(viewerRoot).transform;
 if(!transform||transform==='none')return false;
 // La transformació només es posa al visor en pantalles tàctils verticals.
 // No confondre-la amb la rotació voluntària de 90° de la pàgina PDF.
 const match=transform.match(/^matrix\(([^)]+)\)$/);
 if(!match)return false;
 const values=match[1].split(',').map(Number);
 return values.length===6&&Math.abs(values[1])>.85&&Math.abs(values[2])>.85;
}
