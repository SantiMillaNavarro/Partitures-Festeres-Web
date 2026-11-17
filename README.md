# Partitures Festeres Web — W2.7 · Editor d'objectes i text d'un sol ús

La fase **W2.6** s'ha desenvolupat prenent com a model directe el codi Android **v1.11.15**, sobretot la funció `startInlineTextEditor`, el component `InlineAnnotationTextEditor` i `finishInlineTextEditor` de `PdfViewerScreen.kt`, i el model `AnnotationText` de `AnnotationStore.kt`.

## Novetats W2.7

- Des del rosetó, activa **Objectes** després de tocar una anotació amb **Seleccionar**. Pots **Copiar, Apegar, girar ±15°, restablir el gir i ampliar/reduir** l'objecte triat.
- **Apegar** funciona també en una altra pàgina de la mateixa partitura, sense canviar el PDF original. Les modificacions tenen historial per a **Desfer**.
- El format d'anotacions manté `version:1`; `rotationDegrees` és opcional. Les anotacions sense este camp conserven exactament l'aspecte i els valors anteriors.
- A l'editor nou i al diàleg antic, **Cancel·lar** deixa d'activar permanentment la ferramenta Text.
- Les proves noves validen la persistència, el gir, el canvi de mida, el portapapers intern, el focus i la creació d'un únic quadre. Android v1.11.15 continua sent la referència, prioritzant estabilitat de la web.

## Com funciona

- Des de **Anotar → Text** del rosetó, toca la partitura per a crear un **quadre de text estàndard (28% d'amplària × 10% d'altura)**, o arrossega el dit per a dibuixar un quadre de la grandària que necessites. Els textos creats abans conserven les seues dimensions.
- **S'escriu directament damunt de la partitura**: apareix un camp de text amb vora blava, cursor real i focus al teclat. No cal obrir el diàleg clàssic.
- La barra de format a tocar del quadre permet **negreta, cursiva, subratllat, alineació esquerra/centre/dreta, grandària, color, fons blanc i marc**.
- **Guardar (✓)** confirma el text; **Cancel·lar (×)** conserva intacta l'anotació original si es tractava d'una edició. `Control/Command + Enter` també guarda; `Escape` cancel·la.
- El camp permet **cinc línies**, seguint Android, i un màxim ordinari de **240 caràcters**. Els textos antics més llargs es poden reobrir sense truncar-los automàticament.
- Després de guardar **o cancel·lar**, la ferramenta passa a **Seleccionar**, com a Android: el quadre es pot moure o redimensionar. Durant l'edició, tocar fora no crea un segon quadre ni substituïx el text en curs.
- Si canvia la pàgina o es tanca el visor amb un esborrany vàlid, s'intenta confirmar-lo **abans** de destruir la pàgina, seguint la protecció Android davant de la pèrdua del text.
- El camp està integrat en la capa del PDF; acompanya el **zoom, el gir, la mida de pantalla** i, quan és possible, conserva el focus encara que el visor renderitze la pàgina de nou.
- En Chrome/Android, si obrir el teclat virtual trau el navegador de fullscreen, **el visor no es tanca** per eixe canvi de fullscreen.

## Rosetó i compatibilitat

- El submenú **Text** del rosetó incorpora també **Cursiva** i **Alineació**, com Android, a més de negreta i subratllat.
- **«Més opcions» conserva l'editor modal anterior** com a alternativa. Això permet comparar els dos mètodes abans de retirar el sistema antic.
- El format d'anotacions continua en **`version:1`**; `italic`, `alignment`, `backgroundEnabled` i `borderEnabled` són camps **opcionals**, validados abans de guardar o restaurar. Les anotacions de W2.1–W2.5 continuen sent compatibles.
- No s'escriu mai el text dins dels bytes originals del PDF. El contingut s'emmagatzema en IndexedDB i es conserva en les còpies ZIP de la biblioteca.
- El visor horitzontal, la rotació automàtica, el gest Android «Enrere», els repertoris, el rosetó i totes les eines no textuals continuen intactes.
- **Ajustos i manifest ZIP:** W2.7. La memòria caché de la PWA es renova sense netejar IndexedDB.

## Limitacions respecte a Android

El teclat virtual, la seua tecla «Fet» i el comportament exacte del fullscreen depenen del navegador i el sistema. El botó visible **✓** permet guardar de manera equivalent. El **gir individual, la còpia, l'apegada i la redimensió** de textos, símbols i traços estan disponibles en W2.7, mitjançant **Objectes** al rosetó. El retall avançat de regions del PDF queda per a una fase posterior; no es simula una ferramenta no disponible.

## Proves

La nova bateria automatitzada comprova editor sobre la pàgina, focus, format, zoom durant l'edició, desfer/cancel·lar, canvi de pàgina amb text en edició, regressió de modal antic, recuperació després de refrescar i integritat exacta dels bytes PDF. La resta de proves de W2.1–W2.5 continuen executant-se en CI.

**Validació real recomanada:** crear un quadre amb un toc i un altre arrossegant; escriure amb el teclat físic/virtual; canviar alineació i cursiva; prémer ✓, seleccionar, moure i ampliar la partitura. Comprovar també que el gest «Enrere» manté el funcionament de W2.3.5.

No és necessari eliminar dades ni reimportar partitures; abans de canvis importants convé guardar una còpia ZIP fora del navegador.
