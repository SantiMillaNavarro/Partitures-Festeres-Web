# Partitures Festeres Web W1.2.4 — Experiència de lectura

Versió de prova. La web pública **no canvia fins que es fusione esta proposta**.

## Canvis
- Visor blanc a pantalla completa, sense barres fixes que lleven espai a la partitura.
- Encaix inicial de la pàgina a tota l'àrea útil, tant en vertical com en horitzontal.
- Un toc central mostra/amaga els controls. Un toc als laterals passa la pàgina.
- Zoom immediat amb dos dits centrat en el punt del gest, arrossegament i doble toc central.
- Zoom, pàgina, gir i preferència d'ajust recordats per obra.
- Al canviar l'orientació, encaix recalculat automàticament.
- PDF.js local i millora de la nitidesa després del gest, amb límit de memòria de canvas.
- Controls compactes superposats: gir 90°, ajust de pàgina/amplària, avanç i retrocés de pàgines/obres.
- Els PDF es queden en IndexedDB; no es toquen db.js ni backup.js.

## Proves
La PR executa proves en Chromium i WebKit: PDF real de dues pàgines, zoom, gir, canvi de pàgina, persistència i vista vertical/horitzontal. Linux WebKit és una aproximació, no una certificació d'iPhone real.

## Instal·lació
Quan la PR passe les proves i s'accepte, fusiona-la a main. **No esborres mai les dades del navegador ni la PWA:** això podria eliminar les partitures locals. Conserva sempre la teua còpia ZIP.

## Límits
Aquesta fase només perfecciona la lectura; encara no incorpora anotacions, metadades avançades, Drive ni el visor natiu d'Android. L'ús real en un iPhone/iPad continua pendent de validació.
