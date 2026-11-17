# Partitures Festeres Web — W2.5 · Rosetó ornamental d'Android

Esta fase és el primer pas per a reconstruir la interfície web a partir del projecte font **Android v1.11.15** i, concretament, de `QuickAnnotationRosette` a `PdfViewerScreen.kt`. L'objectiu és igualar el comportament real de l'app sense trencar la biblioteca, les anotacions ni l'estabilitat del visor.

## Novetats W2.5

- En entrar a **Anotar**, apareix un rosetó de **huit pètals, en dues corones**, amb el granat, blau fosc, or i el motiu ogival ornamental d'Android.
- Les eines principals segueixen l'ordre d'Android: **Seleccionar, Llapis, Ressaltador, Text, Formes, Símbols, Retall i Goma**.
- El **centre del rosetó** obri la flor si està tancada; si està oberta, retrocedix al menú anterior; a l'arrel, la tanca. El centre es pot **arrossegar amb el dit** i queda limitat a l'àrea visible. Les coordenades de moviment tenen en compte el gir visual d'iOS.
- També es pot mostrar el rosetó amb un **doble toc al centre de la partitura** quan el visor no està en mode d'anotació.
- El submenú de **Llapis i Ressaltador** permet triar color i grossor; el de **Text**, color, grandària, negreta i subratllat; el de **Formes**, tipus, color i grossor; i el de **Símbols**, famílies, segells, color i grandària.
- En les opcions de símbols, els pètals es paginen quan una família conté molts elements, seguint el mecanisme de la versió Android.
- Els controls de **Desfer, Editar text, Eliminar seleccionada i Acabar** continuen accessibles des d'una barra compacta.
- La barra anterior de W2.4.1 no desapareix: **«Més opcions»** la desplega si encara necessites utilitzar controls detallats no incorporats al rosetó.

## Diferències deliberades respecte a Android

- **Retall** ocupa el pètal original, però encara no modifica el PDF ni executa un retall. Informa explícitament que la ferramenta s'implementarà en W2.8.
- Android té sis famílies de símbols, però W2.5 conserva les cinc que estan disponibles a la web; les articulacions i els reguladors especialitzats s'ampliaran en W2.7.
- Els menús de text encara no inclouen cursiva i alineació exactes de la versió Android; s'afegiran amb l'editor integrat en W2.6.
- El rosetó web utilitza el catàleg de colors, grossors i figures *ja validats* a la web, sense crear configuracions que l'emmagatzematge actual no suportaria.

## Estabilitat

Els mecanismes de PDF, IndexedDB, anotacions, repertoris, biblioteca, orientació horitzontal, gest «Enrere» i el format ZIP es mantenen. No hi ha migracions de dades, canvis en les rutes PDF, ni eliminacions. **No cal reimportar fitxers ni esborrar les dades de l'app.**

Ajustos i còpies ZIP indiquen **W2.5**. La caché offline inclou els nous mòduls del rosetó.

## Proves

- Nova prova Playwright: huit pètals i dues corones, navegació de submenús, canvi de color/grossor, categories musicals, pètal Retall pendent, inserció de matisos sobre PDF, centre mòbil, tecla Escape i barra de compatibilitat.
- Les proves anteriors continuen cobrint llapis, formes, text, símbols, zoom, gir, anotacions, còpies ZIP, repertoris, navegació Android i recuperació després d'actualitzar.

**Validació en dispositiu real:** comprova que els pètals es poden tocar amb comoditat, que el centre es desplaça sense crear traços i que «Més opcions» permet continuar treballant mentre completem la paritat d'Android.
