# Partitures Festeres Web — W2.15.2 · Cercar i saltar dins del visor

Continuació de W2.15.1 amb el **selector de partitures del visor** equivalent a `ScorePickerDialog` de `PdfViewerScreen.kt` (Android v1.11.15), consultat directament.

## Funcionament

- Amb una partitura oberta, mostra els controls del visor i prem **Cercar i saltar** (icona de lupa en pantalles amples; **indicador de posició del repertori** tàctil en pantalla mòbil). El selector no obliga a eixir del PDF o anar a Repertoris.
- S'obri un diàleg amb totes les obres de la **seqüència activa**, el seu **número original**, el nom de la partitura, el camí de carpeta quan existix, i un indicador **Actual** per a la partitura que sona.
- **Busca instantània** per nom, fitxer, carpeta i compositor; ignora accents, majúscules i permet diverses paraules. El número original **no canvia** després de filtrar; tens botó per **netejar la cerca** i missatge quan no hi ha coincidències.
- Tocar una obra tanca el selector i obri **la seua primera pàgina**, igual que Android; si està en mode Actuació, **continua la mateixa sessió i el mateix ordre circular**. El PDF anterior conserva les anotacions i les preferències.
- En Biblioteca, Favorits i Recents, el selector utilitza la seqüència de partitures disponible, però **no activa un repertori circular** si no s'està actuant.
- El selector es pot tancar amb **×, Escape, tocant fora o amb Enrere d'Android/PWA**. Enrere tanca només el diàleg, no el visor. Les fletxes i el teclat dins del diàleg no passen les pàgines del PDF que hi ha darrere.
- Els textos són **valencià / castellà**, amb botons accessibles i indicador d'element actual.
- La llista és **lleugera, sense miniatures ni descodificar PDF**. Es filtra dins d'un component independent afegit al `body`, sense `render()` de l'aplicació: **el canvas del visor i PDF.js no es remunten quan s'escriu una cerca**. Es manté la prioritat de càrrega W2.14.3.
- Per a protegir l'edició, el botó es desactiva mentre es fan anotacions. En acabar d'editar, torna a estar disponible.

## Proves

El workflow `W2.15.2 Selector de partitures dins del visor` comprova amb **tres PDFs reals**, inclosa una obra amb tres pàgines: cerca accent-insensible i per compositor, números originals, ressaltat Actual, canvas intacte en escriure, tancament amb Escape i botó Enrere, salt a la primera pàgina d'una altra obra, persistència d'anotacions, continuïtat del repertori, i comportament normal fora d'Actuació. També s'executen les regressions anteriors.

---

# Partitures Festeres Web — W2.15.1 · Duplicar repertoris i mode Actuació

La web incorpora dos comportaments que la versió Android 1.11.15 ja tenia. S'han llegit directament **`PartituresFesteresApp.kt`, `RepertoiresScreen.kt` i `PdfViewerActivity.kt`** per a reproduir-los fidelment.

## 1. Duplicar repertoris

En **Repertoris**, utilitza el botó de duplicació de la llista (al costat del nom), o obri un repertori i prem **Duplicar**. La còpia:
- Rep un **identificador nou** i manté exactament el mateix **ordre de PDFs**, sense copiar físicament els documents (les anotacions continuen associades a cada partitura, no es dupliquen).
- Es crea amb **«(còpia)»**, **«(còpia 2)»**, etc., com en Android; es comproven col·lisions sense distingir majúscules i es respecta la longitud màxima del nom.
- Passa a ser el repertori seleccionat. Canviar-ne l'ordre, el nom o les entrades **no modifica l'original**.
- Es desa en IndexedDB amb les preferències de repertoris existents, per tant no canvia el format de les còpies ZIP.

## 2. Mode Actuació: avanç circular

Dins d'un repertori, el botó **Iniciar actuació** comença per la **primera pàgina de la primera partitura disponible**, encara que tingues una pàgina de lectura guardada. També pots tocar una partitura concreta per començar per ella, sempre en pàgina 1.

- Entre les pàgines de la mateixa obra funciona la navegació normal del visor.
- Quan s'arriba al final d'una partitura, anar cap avant obri la **primera pàgina de la següent obra**.
- En finalitzar l'**última** obra, anar cap avant torna a la **primera pàgina de la primera obra** i es pot repetir el repertori sense eixir del visor.
- Retrocedir des de la primera pàgina d'una obra obri l'**última pàgina de la partitura anterior**.
- **No es fa volta circular cap arrere** en la primera obra: així funciona Android.
- El visor mostra un indicador **Actuació · [repertori]** amb el número d'obra actual. El botó de següent obra roman disponible en l'última posició; el de retrocés continua desactivat en la primera posició.
- S'utilitza una **instantània de l'ordre del repertori** en començar, ometent PDFs desapareguts. En tancar el visor acaba eixa sessió. Un PDF obert des de Biblioteca, Favorits o Recents **no** activa el bucle.

S'han conservat la prioritat de càrrega del visor de W2.14.3, anotacions, zoom, rotació, retorn d'Android, Favorits, Recents i ZIP.

## Validació

La prova nova **W2.15.1 Repertoris i Actuacio circular** comprova amb PDFs reals: duplicació amb noms sense col·lisions, independència del repertori original, ordre guardat després de recarregar, inici en pàgina 1, pas a última pàgina en retrocedir, volta cap avant d'última obra a primera, i navegació normal fora del repertori. A més s'executen totes les regressions anteriors.

---

# Partitures Festeres Web — W2.14.3 · Visor PDF prioritari

Correcció de rendiment després de la W2.14.2: una miniatura PDF podia continuar renderitzant-se en segon pla **mentre el visor obria una altra partitura**. Encara que la cua de miniatures s'aturava en abandonar Biblioteca, el procés actiu no es cancel·lava, competint pels recursos de PDF.js. Esta fase elimina la competència sense desactivar les miniatures de manera permanent.

## Canvis

- **Prioritat absoluta al visor:** `openPdf()` suspén les miniatures **sincrònicament abans de llegir IndexedDB** i abans de construir `ScoreViewer`.
- **Cancel·lació activa:** el controlador de miniatures fa servir `AbortController` i, si s'està renderitzant, cancel·la `PDFRenderTask` i interromp la càrrega PDF.js de la miniatura.
- **Descart de cua:** en entrar al visor es cancel·len les peticions pendents, les observacions d'IntersectionObserver i les iniciacions diferides, sense esborrar les miniatures ja cachejades.
- **Generació durant la inactivitat:** noves miniatures s'inicien amb `requestIdleCallback` si existeix, i amb una pausa curta alternativa si no. Mai no impedeix prémer una partitura immediatament.
- **Reactivació en tornar:** en tancar el visor es reprenen els observadors i les miniatures que encara falten. Les cancel·lacions voluntàries no es marquen com a PDF corruptes i no bloquegen la generació futura.
- Es manté la caché LRU de 36 miniatures / 6 MiB de W2.14.2, sense modificar el format ni la qualitat dels PDFs i sense canvis en anotacions, índex, metadades o còpies de seguretat.
- La preferència **Ajustos → Miniatures de partitures** continua disponible.

## Validació

El workflow nou **W2.14.3 Prioritat del visor PDF** simula una miniatura que es queda bloquejada indefinidament, obri un PDF real de tres pàgines i comprova que la miniatura es cancel·la, que no es creen noves miniatures durant la lectura, i que es reprenen en tornar a Biblioteca. També s'executen les regressions de les 33 funcions anteriors, inclosa la W2.14.2.

**Nota de rigor:** el problema de competència està confirmat en el codi, però no es pot mesurar la mateixa latència en cada mòbil des de GitHub Actions. Cal validar la velocitat real en el dispositiu de l'usuari, amb una biblioteca representativa.

---

# Partitures Festeres Web — W2.14.2 · Miniatures dels PDF

Després d'organitzar les partitures, recuperem una funció visual important de l'app Android: **la previsualització de la primera pàgina en cada partitura**, en lloc de mostrar només la mateixa icona.

## Referència Android i implementació web

Basat en el codi real **`PdfThumbnailRepository.kt`** d'Android v1.11.15, inspeccionat directament. Android usa `PdfRenderer`, un `LruCache` de memòria, una miniatura per primera pàgina, un màxim de píxels i la rotació guardada del visor. La web aplica els mateixos principis amb **PDF.js local, Canvas i una caché LRU limitada**.

- Les miniatures apareixen en **Biblioteca**, **Repertoris** (dins de la llista de partitures), **Recents**, **Favorits** i **Índex**.
- Primer full del PDF original, sense enregistrar còpies de pàgines en IndexedDB ni modificar documents o anotacions.
- **Càrrega mandrosa:** només es renderitzen les miniatures que estan pròximes a entrar en pantalla (`IntersectionObserver`, marge de 300px). Els PDF es processen **un a un**, evitant que una Biblioteca amb centenars de partitures faça renderitzacions simultànies.
- Miniatures màximes **280 × 420 px**, límit de **170.000 píxels**, i JPEG comprimit. Caché en memòria limitada a **36 entrades / 6 MiB**. S'allibera el PDF.js `PDFDocumentProxy` després de cada miniatura i la URL temporal de la font sempre es revoca.
- Es respecta el **gir manual guardat del visor PDF** de la partitura, amb rotació original automàtica del mateix PDF si no s'ha fixat cap gir.
- Els PDF corruptes, protegits o amb renderització fallida **conserven la icona PDF original**, sense error visible ni bloquejar la resta de la pantalla.
- En **Ajustos → Miniatures de partitures**, es poden **activar/desactivar**. La preferència és persistent entre sessions i el comportament original amb icones continua disponible.
- Després d'un trasllat / canvi de nom, l'antic camí s'invalida en la caché i es genera la nova miniatura quan corresponga. Els canvis de mida i data d'importació també invaliden les miniatures antigues.
- Disseny de pergamí compacte: no es creen nous botons a les files ni desapareixen funcions de metadades, Favorits o repertoris.
- El motor és **100% local i offline**; reutilitza el PDF.js i el worker ja inclosos a la PWA, sense nous CDN o servidors.

## Validació

El workflow **W2.14.2 Miniatures primera pagina PDF** prova PDFs reals generats al navegador, orientació original i gir manual, límits de memòria/píxels, fallback davant d'un PDF corrupte, miniatures en cinc seccions, canvi persistent d'Ajustos i integritat dels PDFs en IndexedDB. Es mantenen les regressions de les fases anteriors.

---

# Partitures Festeres Web — W2.14.1 · Organitzar partitures

Fase de gestió de fitxers basada en la semàntica de `replacePdfReferences` d'Android v1.11.15: **moure o renomenar no crea un altre PDF ni fa perdre les dades de l'obra.**

## Com s'utilitza

Des de Biblioteca, Favorits, Recents o Repertoris, prem el **llapis de metadades** d'una partitura. Al final del quadre trobaràs **Moure o renomenar fitxer PDF**. Es pot modificar el nom, triar una carpeta existent (inclosa l'arrel) o crear una **nova subcarpeta** dins de la carpeta triada. Es mostra la ruta resultant abans de guardar. En mòbil no s'ha afegit cap quart botó per fila, perquè ja hi havia poc espai per als títols de les obres.

En guardar, la Biblioteca obri la ubicació final de la partitura, amb les seues carpetes reals creades segons els fitxers. Els noms de carpeta es respecten, i les carpetes buides no es representen perquè la Biblioteca web continua derivant l'arbre de la ruta dels PDFs.

## Conservació de dades i seguretat

- La funció `moveScoreSafely` de `db.js` trasllada el mateix **Blob PDF** i les metadades, a més d'**anotacions**, **pàgina/zoom/ajusts de lectura**, **Favorits**, **Recents** i referències de tots els **Repertoris**.
- El trasllat es fa dins d'**una sola transacció IndexedDB** sobre `scores`, `annotations` i `prefs`, sense estats intermedis. Si qualsevol pas falla, es reverteix automàticament tot el canvi.
- No se sobreescriu **mai** un PDF existent, unes anotacions preexistents o unes preferències de lector preexistents en el camí de destinació. En cas de conflicte s'informa a l'usuari, que pot triar un altre nom.
- S'apliquen controls de nom i carpeta per a impedir rutes amb `..`, barres dins de noms, caràcters de control i fitxers sense nom.
- Les còpies ZIP ja preparades s'invaliden després d'un trasllat correcte. Les dades continuen disponibles offline i incloses en la pròxima còpia de seguretat.
- La nova carpeta és una subcarpeta **real en l'estructura virtual del web**: es materialitza en moure-hi la partitura, sense modificar cap carpeta de Google Drive ni cap arxiu Android.

**Nota:** si estaves editant metadades quan polses Organitzar, guarda eixos canvis de metadades abans d'obrir el moviment de fitxer.

## Validació

La nova prova `W2.14.1 Organitzar partituras` comprova PDF idèntic, anotacions, metadades, Favorits, Recents, Repertoris, preferències del visor, subcarpeta nova i col·lisions sense destrucció de dades, més la resta de workflows anteriors.

---

# Partitures Festeres Web — W2.13.3 · Retall manual i perspectiva

Esta fase respon a la comprovació real del mòbil: la detecció automàtica de fulles no és consistent en totes les condicions. **El retall manual de quatre cantonades és la ruta fiable**, independentment de l'eficàcia de la detecció.

## Flux d'escaneig

1. En **Escanejar**, fes una foto (escàner automàtic / Capturar ara / Foto del sistema) o tria fotografies de la galeria.
2. Cada miniatura conté un botó **✂ Retallar fulla**. S'obri un editor a pantalla completa amb la fotografia original i **quatre cercles verds numerats**.
3. **Arrossega les quatre cantonades** fins als extrems del paper. Els punts també funcionen amb teclat (fletxes, Majúscules per a passos més grans). Pots prémer **Detectar vores** per a rebre una proposta opcional, però no s'aplica sense confirmació i no depén d'eixa detecció.
4. **Previsualitzar** mostra la pàgina real corregida mitjançant una homografia. **Tornar als punts** permet continuar l'ajust. **Aplicar retall** confirma, **Cancel·lar** conserva l'estat anterior, **Restablir punts** posa el marc complet i **Sense retall** retorna a la fotografia completa.
5. La miniatura mostra el **resultat del retall**, i passa a **✓ Ajustar retall** per a poder reobrir l'editor. Després pots girar, triar els filtres existents, reordenar les pàgines i guardar el PDF.

## Seguretat i fidelitat

- La fotografia original **no es modifica ni s'esborra** en retallar. Es conserven els punts normalitzats; en generar PDF s'aplica la **correcció projectiva sobre la fotografia original abans del gir i dels filtres**. La qualitat del PDF no depén de la miniatura de l'editor.
- No s'utilitzen serveis remots, SDKs de pagament ni xarxa. Els JPEG temporals de previsualització i els `blob:` es netegen en substituir-los, en cancel·lar i en eixir de l'escàner.
- Es rebutgen polígons auto-intersectats, capgirats, massa menuts o amb punts fora de la imatge, per a evitar PDFs corruptes i consum descontrolat de memòria.
- El sistema d'exportació continua sense sobreescriure PDFs o anotacions: carpeta, repertori, múltiples fulls, 30 pàgines i còpies ZIP es mantenen.
- El detector automàtic de W2.13.2 continua disponible, però és **opcional**. Si no reconeix el full, captura'l manualment i retalla'l després; és el flux recomanat.

## Proves

El workflow `W2.13.3 Retall manual amb perspectiva` comprova els quatre punts, la geometria, els gestos tàctils emulats, Previsualitzar, Cancel·lar, Aplicar, recuperar un retall, Sense retall, gir posterior, filtres, JPEG projectiu i PDF real amb PDF.js. S'executen també les 30 comprovacions anteriors.

---

# Partitures Festeres Web — W2.13.2 · Escàner automàtic de fulles i capçalera vertical

Subfase que respon a les proves reals de **W2.13.1** en mòbil. Dos canvis independents, sense alterar la biblioteca ni les anotacions:

## 1. Capçalera sense solapaments (mòbils i tauletes estretes)

En pantalles de fins a **850 px CSS**, el logotip i **Partitures Festeres** es mostren en una primera fila, i els botons **Escanejar** i **Importar** en una segona fila de dues columnes. Els títols tenen amplària acotada, i els botons mai es superposen a la marca. Escriptori i el visor PDF mantenen els seus components habituals.

## 2. Escàner amb càmera i detecció de fulles

Android v1.11.15 delega en **Google ML Kit Document Scanner**, usant `GmsDocumentScannerOptions.SCANNER_MODE_FULL`. Aquest SDK no és un component web; la PWA usa **getUserMedia + Canvas i detecció geomètrica local sense dependències externes**.

- **Escàner automàtic** obri una previsualització de càmera real (amb permís explícit); traça un polígon **verd** quan detecta una fulla contrastada amb el fons.
- El detector comprova la diferència de brillantor centre/vora, la component rectangular, la convexitat i la mida mínima. Captura **automàticament després de quatre deteccions estables consecutives** (aproximadament 1 segon), amb llindar conservador per reduir falsos positius.
- La fotografia queda retallada amb les **quatre cantonades detectades** i corregida mitjançant una **homografia projectiva**. El resultat es convertix a **JPEG**, i entra com una pàgina més de l'escàner anterior. Un botó **Capturar ara** continua sempre disponible.
- Evita les duplicacions d'una fulla estàtica: cal **retirar la fulla uns instants** o prémer **Preparar següent fulla** abans d'una altra auto-captura. Màxim **30 pàgines**.
- **Captura automàtica** es pot desactivar amb una casella. **Acabar** torna a la pantalla de previsualització, on es pot reordenar, girar, filtrar i guardar en PDF a la Biblioteca o a un Repertori.
- **Foto del sistema** conserva el selector de càmera natiu de W2.13.1: és l'alternativa als navegadors sense `getUserMedia` o quan es denega el permís. **Afegir fotos** segueix disponible.
- Càmera i dades de vídeo **només al dispositiu**; sense enviaments, ni llibreries de tercers, ni streaming de xarxa. S'allibera la càmera i s'aturen totes les pistes en tancar, ocultar la pàgina o eixir d'Afegir.
- Qualitat: els fulls blancs sobre una taula fosca o de color contrastat es reconeixen millor. Superfícies de color semblant, ombres, reflexos o papers arrugats poden impedir la detecció; no prometem la precisió de ML Kit. La captura manual continua operativa i, si no es detecten cantonades fiables, guarda la foto sencera.
- Els fitxers de reconeixement i perspectiva s'inclouen en el **caché de PWA**, per a funcionar sense connexió.

## Proves

Workflow nou **W2.13.2 Deteccio automatica i capcalera**: verificació de límits de títol/botons amb mides 320, 360, 390, 430, 620, 768 i 830 px; imatges sintètiques amb i sense fulla; 4 cantonades, homografia i JPEG; càmera simulada, captura automàtica, prevenció de duplicats, captura manual i finalització sense deixar pistes actives. Es mantenen les regressions existents (W2.13.1 i anteriors).

**Millora futura:** un editor de cantonades ajustables manualment per quan el reconeixement no detecte una fulla.

---

# Partitures Festeres Web — W2.13.1 · Afegir / Escàner multipàgina

La fase **W2.13.1** estrena en la web el flux de treball d'**Afegir partitures**. S'ha revisat directament el codi d'Android v1.11.15 (`AddContentScreen.kt`, `ScanImportPolicy.kt` i `ScannerPreviewDecoder.kt`). Android fa servir **Google ML Kit Document Scanner**, que no està disponible com a component integrable en el navegador; en web fem servir el selector nadiu de càmera/galeria i un motor local de generació PDF.

## Eines disponibles

- Botó **Escanejar** en la capçalera, sense ocultar ni substituir el botó existent **Importar**. Eixir amb **Tornar a la biblioteca**.
- **Escanejar pàgina:** obri la càmera del dispositiu mitjançant `<input type="file" accept="image/*" capture="environment">` quan el navegador ho admet. En escriptori pot aparéixer un selector d'imatges. Es poden capturar múltiples fulls, un a un, sense deixar la pantalla d'Afegir.
- **Afegir fotos:** selecció múltiple de fotos ja existents. Permet afegir **fins a 30 pàgines**, seguint el límit de l'Android original.
- Miniatures numerades; botons **↑**/**↓** per a reordenar, **↻** per a girar cada full 90°, **×** per a eliminar la pàgina individual, i **Netejar totes**.
- Filtre independent en cada pàgina: **Original**, **Millorar**, **Grisos** o **Blanc i negre**. Les previsualitzacions mostren el mateix filtre triat.
- Camps **Nom**, **Guardar en** (carpetes dinàmiques reals de la biblioteca, inclosa l'arrel), i **Afegir a un repertori** (opcional). Importar PDF des d'Afegir continua obrint el selector anterior.
- **Guardar partitura PDF** genera un PDF d'imatges multipàgina llegible per PDF.js i el desa a **IndexedDB**, on apareix immediatament en Biblioteca, Repertoris (quan seleccionat), Recents en obrir-lo, i dins de les còpies ZIP.
- Els noms repetits es guarden amb sufix **(2)**, **(3)**, etc. **Mai se substituïx automàticament un PDF ni se'n borren les anotacions.**
- Procés **local, sense servidors**. La càmera del navegador funciona per capturar fitxers, i no s'obri cap flux de vídeo permanent.

## Memòria i validacions

- Pàgines originals de fins a 24 MiB, selecció total fins a 180 MiB, PDF final fins a 100 MiB; es rebutgen fitxers buits i formats no reconeguts.
- Les fotos es redimensionen fins a un màxim de 2400 píxels per costat i 4 milions de píxels totals abans de desar-les en JPEG, amb una sola descodificació activa al generador PDF.
- Cada pàgina s'ajusta dins d'una pàgina **A4 vertical o horitzontal** segons el gir/orientació, preservant la imatge sencera (sense retall).
- Es comprova la capçalera real `%PDF-` abans d'escriure en la biblioteca. El PDF només entra a IndexedDB quan totes les pàgines s'han processat correctament.
- Les miniatures temporals `blob:` es revoquen en eliminar les pàgines o eixir de l'escàner.

## Diferències amb Android i següent subfase

**W2.13.1 no té la detecció automàtica de vores ni la correcció de perspectiva d'ML Kit.** Els controls de foto/gir/filtre es fan amb funcions estables del navegador. La pròxima **W2.13.2** desenvoluparà **retall i correcció manual de perspectiva** adaptats a la web.

A més, la captura de càmera i el tipus de selector nadiu depenen del navegador: `capture="environment"` és una preferència, no una garantia. No es crea cap núvol o biblioteca Drive nou ni s'alteren PDF o anotacions existents.

La CI `W2.13.1 Escaner multipagina i PDF` valida formats, filtres, seguretat de rutes, 30 pàgines, foto/càmera sintètica, PDF.js de múltiples fulls, gir, creació en carpeta, associació amb repertori i duplicats. També s'executen totes les regressions de les 28 funcions prèvies.

---

# Partitures Festeres Web — W2.12.2 · Guardar i compartir dictats

La fase W2.12.2 completa l'exportació de **Dictat Musical** i **Dictat Marina** en Eines, prenent literalment de `DictationExportPolicy.kt` i `renderScoreBitmap` en `DictationMarinaPanel.kt` del projecte Android v1.11.15.

## Guardar imatge i Compartir

Després d'acabar un dictat amb notes, apareixen els botons **Guardar imatge** i **Compartir**. Estan ocults mentre el micròfon escolta, com a Android, i es desactiven durant l'exportació.

- Cada PNG es dibuixa a **1600 px d'amplària**, amb **10 notes per pentagrama**, **240 px per fila** i **200 px de marges verticals**, fons de pergamí (RGB 250/242/226), títol i subtítol amb el nom de l'instrument si escau, clau de sol/fa, alteracions, línies addicionals i notes negres.
- Política de l'Android: **60 notes per imatge màxim**, sense perdre notes. Una partitura de 61 notes genera exactament **dos PNG**.
- **Guardar imatge**: una imatge es descarrega directament com a **PNG**. Quan hi ha múltiples imatges, es descarrega un **ZIP** amb tots els PNG, perquè els navegadors bloquegen sovint les descàrregues múltiples i no poden guardar-los automàticament en un àlbum de fotos.
- **Compartir**: utilitza **Web Share amb fitxers PNG**, un fitxer si és un sol pentagrama o múltiples fitxers si el dictat ocupa diverses imatges. Si el navegador o el dispositiu no ho admet, guarda els arxius com a PNG o ZIP i mostra el missatge corresponent. Una cancel·lació voluntària de l'usuari no provoca una descàrrega.
- Els fitxers es generen i romanen **localment al navegador**; no hi ha servidor, pujada de dades ni enregistrament d'àudio.
- La preparació d'imatges evita el bitmap únic il·limitat que podria esgotar la memòria d'una tauleta. Es recicla el canvas de cada pàgina una vegada s'ha obtingut el PNG.
- Els documents PDF importats, les anotacions, els repertoris, les dades IndexedDB i les ferramentes anteriors no es modifiquen.

## Diferències inevitables entre Android i web

Android pot enviar imatges a la galeria del sistema (**Pictures/Partitures Festeres**) amb MediaStore. La web no té accés directe a la galeria ni pot garantir el destí final de la descàrrega. Les imatges van a les **Descàrregues** del navegador o al gestor del sistema; en mòbil, pot aparéixer el quadre de compartir o de guardar en Fitxers.

## Validació

Workflow nou `W2.12.2 Exportar i compartir Dictat`, amb proves dels límits 60/61, dimensions 1600×1640, color del fons, signatura real PNG, títol Marina/Musical, ZIP, simulació del menú Compartir i aturada segura del micròfon. També s'executen les proves de les 27 funcions preexistents.

---

# Partitures Festeres Web — W2.12.1 · Dictat Musical i Marina

Primera subfase de **Dictat Musical**, traslladada directament de `DictationMarinaPanel.kt`, `TunerEngine.kt` i `DictationExportPolicy.kt` d'Android v1.11.15.

## Ja disponible

- En **Eines** ara hi ha quatre pestanyes: **Metrònom**, **Afinador**, **Nota de referència** i **Dictat Musical**.
- **Dictat Musical:** micròfon sota pulsació explícita, reconeixement d'altures amb el mateix algorisme **YIN** de l'afinador, captura de notes estables després de 150 ms i nova nota només si canvia l'altura o hi ha silenci (320 ms).
- **Transposició instrumental Android:** els mateixos **16 instruments**, incloent clarinets i trompetes en Sib, saxos en Sib/Mib, trompa en Fa, flautí, i clau de fa en fagot/trombó/bombardí/tuba. Canviar l'instrument neteja el dictat, i l'instrument triat es guarda en les preferències locals.
- **Mode Dictat Marina:** inclou la **il·lustració original de Marina** adaptada a WebP lleuger, reconeixement de la veu més ràpid (70 ms), repetició de notes cada 220 ms i adaptació de les octaves de veu al pentagrama de sol (Do4–Si5), exactament com en Android.
- Pentagrama SVG continu amb **clau de sol o fa**, línies addicionals, sostinguts, bemolls, i les notes dibuixades com a **negres**; 6, 8 o 10 notes per pentagrama segons la grandària de la pantalla. No es força el scroll en incorporar notes.
- **Començar dictat / Acabar dictat / Netejar**. La transcripció es conserva mentre es canvia a una altra ferramenta i es torna, fins que la neteges o canvies el mode o instrument.
- **Privacitat:** no s'emmagatzema ni puja l'àudio. Micròfon desactivat en canviar de pestanya, eixir d'Eines, ocultar l'app o tancar. Sense permís previ no s'activa cap captura. Es compartix la referència de La4 de l'afinador.
- L'aplicació continua funcional sense connexió una vegada la PWA s'ha preparat. Cap modificació de PDF, anotacions, repertoris, índex o còpies de seguretat.

## Limitacions deliberades (com Android)

Esta primera versió reconeix **altures, no duracions ni figures rítmiques reals**: totes les notes es dibuixen com negres. **Dictat Marina** és una funció creativa de veu, no un sistema rigorós de reconeixement de parla.

L'exportació d'imatges i la funció **Compartir** es duran a terme en **W2.12.2**, prenent com a referència la política d'Android (màxim **60 notes per imatge**). En W2.12.1 el dictat només es conserva a la pantalla de la sessió actual; no es guarda automàticament entre recàrregues.

## Proves

El workflow `W2.12.1 Dictat Musical i Marina` comprova transposició, cadència de captura, detecció YIN amb àudio sintètic, pentagrama, fitxer original de Marina, permisos del micròfon, parades automàtiques i persistència de l'instrument. També han de passar totes les regressions anteriors abans de fusionar a main.

---

# Partitures Festeres Web — W2.11 · Nota de referència

La fase W2.11 porta a la web el panell **Nota de referència** d'Android v1.11.15, contrastat directament amb `ToolsScreen.kt` i `ReferenceToneEngine.kt`.

## En Eines

- Les tres pestanyes reals **Metrònom**, **Afinador** i **Nota de referència** comparteixen el disseny musical d'Android.
- **12 notes** cromàtiques amb els noms visibles d'Android (incloent **Do♯/Re♭**, **Fa♯/Sol♭** i **Sib**).
- **Octaves 2–6** i accessos directes **La4, Sib3, Sib4**. La selecció inicial és La4.
- La freqüència es calcula en temperament igual a partir de **La4 = 442 Hz**, compartit amb el calibratge de l'afinador (430–450 Hz). El canvi de calibratge en Afinador també canvia automàticament el to de referència.
- La síntesi local `PeriodicWave` amb Web Audio combina exactament els pesos d'harmònics d'Android `0,82`, `0,13` i `0,05` i una amplitud nominal `0,34`. No s'empren fitxers externs ni serveis en línia.
- **Fer sonar / Parar nota**. Es pot canviar la nota o l'octava en plena reproducció, sense reiniciar l'oscil·lador.
- S'atura en canviar de ferramenta, eixir d'Eines, passar a segon pla, recarregar o tancar. No hi ha reproducció automàtica.
- Disseny adaptable a mòbil, tauleta i orientació horitzontal.

## Compatibilitat i seguretat

Es conserven completament el metrònom de W2.9 i l'afinador YIN de W2.10, així com biblioteca, repertoris, visor, PDF, anotacions, metadades i còpies ZIP. El Web Audio no modifica partitures ni emmagatzema so. El caché PWA actualitzat permet síntesi sense connexió després de la instal·lació inicial; les dades privades continuen en IndexedDB.

La reproducció depén del permís d'àudio del navegador, dels altaveus i del volum del sistema. En dispositius reals cal provar el canvi entre notes i confirmar que l'àudio es para en canviar d'eina o ocultar la pantalla.

**Pròxima ferramenta pendent:** Dictat Musical i Marina, a desenvolupar en fases específiques després de provar aquesta.

---

# Partitures Festeres Web — W2.10 · Afinador cromàtic d'Android

La fase **W2.10** incorpora en **Eines → Afinador** el panell cromàtic de la versió Android v1.11.15. El **Metrònom** de W2.9 continua complet i es tria amb les pestanyes pròpies d'Eines.

## Afinador cromàtic

- **Iniciar/Parar**, amb permís del micròfon demanat sols en tocar Iniciar.
- Detecció cromàtica **YIN/CMNDF**, interpolació parabòlica i filtres d'energia/confiança com a `TunerEngine.kt`; rang de 55 a 1800 Hz. Execució en **Web Worker** quan el navegador ho admet, per a preservar la fluïdesa del visor; ruta compatible alternativa si falla.
- Mostra la **nota (Do, Do♯, Re, Mi♭, …)**, la freqüència i desviació en **cents**.
- Indicador semicircular **−50 a +50 cents**, amb zona verda **±5 cents** i zona d'aproximació ±10.
- **Historial** amb neteja, que separa els traços quan canvia la nota.
- **La de referència** de **430 a 450 Hz**, inici **442 Hz**, restabliment a 442 i preferència guardada en la mateixa base IndexedDB (per als ZIP de seguretat).
- Captura local Web Audio: **no s'envia ni es desa àudio**. Es desconnecta el micròfon en canviar d'eina, eixir d'Eines, passar a segon pla o tancar.
- Disponible amb connexió o sense després de la primera instal·lació PWA (fitxers de càlcul i worker inclosos en el Service Worker). **Els permisos del micròfon requereixen HTTPS o localhost**.
- El comportament real del permís i la qualitat del to depenen del navegador, el micròfon i les millores automàtiques d'àudio del sistema. És important provar amb un instrument sostingut en un dispositiu real.

## Seguretat i regressions

No es modifica la biblioteca, cap PDF, el visor, els repertoris, les anotacions, els ZIP ni el motor del metrònom. El canvi de caché actualitza fitxers públics però no esborra IndexedDB. L'afinador no comença automàticament després de recarregar. Hi ha proves de YIN sintètic, controls, històric, referència, cancel·lació del micròfon i retorn al metrònom.

**Pendent per a altres fases:** to de referència i Dictat Musical. No es mostren com a ferramentes funcionals fins que estiguen implementats.

---

# Partitures Festeres Web — W2.9 · Eines: metrònom fidel a Android

Aquesta fase estrena una secció **Eines** a la navegació (tauleta i mòbil) amb el **Metrònom**. S'ha pres com a referència directa `ToolsScreen.kt` i `MetronomeEngine.kt` d'Android v1.11.15.

## Metrònom (W2.9)

- **Sis compassos:** 2/4, 3/4, 4/4, 6/8, 9/8 i 12/8. Per defecte, **100 BPM i 4/4**, igual que Android.
- Tempo de **40 a 240 BPM**, control lliscant i botons ±1.
- El BPM indica sempre el **pols principal**. En 6/8, 9/8 i 12/8 cada pols té tres subdivisions audibles.
- Hi ha exactament **dos sons**, el primer clic més fort i tots els altres idèntics. No alterna timbres entre grups.
- Àudio generat mitjançant una mostra de **compàs sencer en bucle Web Audio**, per a evitar la deriva de `setInterval` en els clics. Els punts visuals es calculen segons el rellotge real del motor d'àudio.
- En canviar el tempo o el compàs mentre sona, el motor reconstrueix el bucle amb els nous valors.
- El metrònom **s'atura en abandonar Eines, tancar la pestanya o ocultar la PWA**, per a no deixar àudio reproduint-se accidentalment.
- En Android, el motor utilitza `AudioTrack.MODE_STATIC`; en web, `AudioBufferSourceNode.loop` és l'equivalent aplicable. L'àudio només s'inicia per una acció explícita.
- **Pròximes fases:** afinador, to de referència i Dictat Musical; no es presenten com a funcionalitats ja implementades.

## Compatibilitat

- S'han mantingut la biblioteca, els repertoris, l'índex, els PDF, les anotacions W2.1–W2.8 i els ZIP de seguretat.
- L'índex de navegació admet la nova pàgina `tools`. El caché de la PWA es renova; IndexedDB i els PDF locals **no s'esborren**.
- En navegadors sense Web Audio la pàgina indica l'error i no afirma que el metrònom està en marxa.
- La precisió auditiu-temporal depén del dispositiu, el navegador i la latència de l'eixida d'àudio; cal comprovar-la també amb un dispositiu físic.

---

## Històric W2.8 — Retalls de partitura i teclat «Fet»

La fase **W2.8** incorpora dues millores vinculades al visor de la versió Android v1.11.15.

## Teclat Android

- Quan l'editor de text rep **Enter/Fet** del teclat, **guarda i tanca** el quadre (també amb el mètode `beforeinput` d'alguns teclats virtuals).
- Per a escriure diversos paràgrafs, utilitza el nou botó **↵** de la barra de text o **Majúscules+Enter** en un teclat físic.
- Quan la composició de text/accents d'un teclat IME encara està activa, no tanquem l'editor accidentalment.
- El navegador controla la icona exacta de la tecla del teclat virtual: `enterkeyhint="done"` sol·licita «Fet», però no tots els teclats mostren la mateixa icona.

## Retalls

- Amb **Retall** en el rosetó pots arrossegar un rectangle damunt del PDF i convertir-lo en un **fragment d'imatge JPEG local**, fidel a la pàgina que es veu.
- El retall queda seleccionat automàticament. Pots **moure'l, redimensionar-lo, girar-lo, copiar-lo, apegar-lo en una altra pàgina i desfer** des del menú **Objectes**.
- Les imatges es comprimeixen a una mida limitada i es validen abans de guardar. Els retalls grans poden ser rebutjats amb avís en lloc de sobreescriure o corrompre les anotacions.
- El PDF original no canvia. Les imatges dels retalls viatgen dins del document d'anotacions i s'inclouen en les còpies ZIP de la biblioteca.
- **Limitació conscient:** el pressupost d'anotacions per partitura continua limitat a 512 KiB. El nombre de retalls per partitura depén de la compressió i la mida de cada retall; no és un editor fotogràfic sense límits.
- Les anotacions d'anys anteriors continuen sent compatibles i es guarden en `version: 1` com a registre addicional opcional.

## Proves

CI comprova l'edició de text amb IME/Fet, Shift+Enter, nou salt de línia, captura i persistència de retall, selecció, moviment/transformació, còpia entre pàgines, desfés i bytes del PDF intactes.

---

## Històric W2.7 — Editor d'objectes i text d'un sol ús

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
