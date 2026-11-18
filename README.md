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
