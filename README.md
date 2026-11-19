# Fase W2.23A — Biblioteca senzilla amb comprovació automàtica de canvis

**Objectiu:** recuperar l'experiència immediata d'Android i eliminar la necessitat de gestionar permisos, descàrregues i sincronització des de la pantalla principal.

## Com funciona
- **Biblioteca** mostra una barra compacta amb el nom de la carpeta i el nombre de PDF. Les opcions de vinculació, ús sense connexió i gestió de còpies es mouen a **Ajustos → Biblioteca**. Els botons de papers i el visor continuen com abans.
- La comprovació de carpetes locals està **activada per defecte** i és configurable a Ajustos. En obrir la web es presenta primer el **catàleg guardat**; després, sense bloquejar la pantalla, es revisen els noms de subcarpetes i PDF per detectar novetats. També es pot intentar en tornar a la pestanya després d'un temps, amb un interval mínim de 60 segons entre intents.
- **No es descarreguen PDF ni es llig el contingut de cada fitxer durant la comprovació**: només s'enumeren les entrades de la carpeta. No es reemplacen ni es fan còpies massives automàticament. Les còpies offline existents i els imports previs continuen accessibles.
- Si el navegador denega un permís o retorna \`prompt\`, la comprovació en segon pla **no mostra diàlegs de permisos ni esborra l'índex**. L'usuari veu les obres ja guardades i pot obrir les que disposen de còpia local; si cal accedir a un original denegat, la PWA no pot saltar les restriccions de Chrome.
- Quan es detecten canvis, s'actualitza el catàleg i les col·leccions; es respecta la biblioteca en ús i no es reinicia la navegació al paper 1r ni a l'arrel.
- **Ajustos → Biblioteca** conté un interruptor «Comprovar els canvis automàticament en obrir», una actualització manual opcional, la selecció de carpeta i opcions avançades plegades per defecte per a preparar o eliminar còpies locals.
- **Drive**: les consultes de W2.21 continuen sent opcionals i de només lectura, però **encara no s'integren com a biblioteca directa amb sincronització automàtica**. La sessió OAuth actual és temporal i necessita un compte i Client ID configurats. No s'anuncia cap sincronització automàtica de Drive que no existisca.

## Limitacions
- Chrome Android pot deixar de donar accés a l'original quan es tanca l'app. Les còpies locals preparades en W2.22A.4 el fan accessible encara que el permís caduque. Una comprovació d'índex no renova permisos: no pot substituir el ContentResolver SAF de l'aplicació Android nativa.
- La comprovació de novetats enumera les carpetes. Amb centenars de fitxers pot costar temps de processament, però es realitza després de mostrar la Biblioteca i sense consultar bytes de PDF; no es força en obrir cada partitura.
- Les anotacions vinculades continuen sent locals; les còpies offline no es compartixen automàticament amb altres dispositius.
- La UI manté la Biblioteca importada com a alternativa per a navegadors sense suport de carpetes.

## Proves
Les proves de W2.23A comproven que un PDF nou apareix després de reobrir la web **sense prémer Actualitzar**, que la pantalla inicial no mostra els controls tècnics, que les restriccions de permisos no provoquen sol·licituds automàtiques ni pèrdua de dades, que es pot desactivar la comprovació i que l'actualització manual continua funcionant.
Les proves de regressió W2.18–W2.22A també es continuen executant.

**Següent fase:** integrar Drive com a font real de Biblioteca amb OAuth i lectura de PDF sota demanda, i després simplificar la sincronització Android sense sacrificar l'accés offline.

---

## W2.22A.4 — Còpies de lectura offline per a Chrome Android (19-11-2026)

Per què: Chrome Android pot perdre permisos temporals dels `FileSystemFileHandle` en tancar la PWA. El catàleg persistit no concedeix permís per a llegir el PDF original. L'API web **no pot** utilitzar `takePersistableUriPermission()` d'Android.

Solució:
- Una vegada oberta la carpeta, prem **Preparar partitures sense connexió**. La web guarda, amb el consentiment de l'usuari, una **còpia de cada PDF** en una base de dades separada de la Biblioteca importada, organitzada per identificador de la carpeta i ruta. El document original no es modifica.
- Després de preparar les còpies, les partitures es poden obrir immediatament després de reiniciar, fins i tot si Chrome ha retirat el permís de la carpeta o no hi ha connexió. El catàleg es continua recuperant immediatament des d'IndexedDB.
- En obrir per primera vegada una partitura encara no preparada, la web intenta conservar automàticament eixa còpia. Això no paralitza el visor ni duplica documents a la Biblioteca importada.
- La preparació és progressiva, d'una partitura a cada torn, amb un comptador **N / total**, errors parcials i botó **Parar descàrrega**. Es poden completar només les pendents o **Actualitzar còpies** per tornar a descarregar-les després de canvis en els originals.
- Limitació individual de 100 MB per PDF i comprovació d'espai lliure quan el navegador ho permet. Si queda poc espai, el procés finalitza sense esborrar les còpies ja disponibles. El navegador continua podent esborrar dades privades per quota o neteja de dades; no és una còpia de seguretat externa.
- **Eliminar còpies locals** elimina només la caché local de PDFs del dispositiu actual; els originals, les anotacions i els repertoris es mantenen. **Desvincular** també elimina les còpies locals de la carpeta desvinculada per no abandonar documents ocults al navegador.
- **Actualitzar biblioteca** reindexa noms i carpetes; no substitueix automàticament els PDFs de la caché. Quan hi haja modificacions en els PDFs, s'ha de prémer **Actualitzar còpies**.
- La configuració de Drive i els imports existents no canvien. En un navegador diferent, les còpies s'han de preparar una vegada en eixe navegador.

Proves automàtiques addicionals: una carpeta de prova amb PDF d'OPFS; preparació de tots els fitxers; reobertura quan la carpeta retorna `NotAllowedError`; comprovació que la lectura es fa des de la caché; regressions del visor i la biblioteca importada.

**Nota:** no podem prometre permisos SAF persistents dins de Chrome, però esta solució evita haver de renovar-los una vegada preparades les còpies.

## W2.22A.3 — Recuperació de PDF individuals en Android (2026-11-19)

- S'investiga el cas Android en què l'índex guardat mostra tots els PDF, però una partitura concreta dona un error d'accés tot i que altres s'obrin.
- El navegador pot concedir accés a la **carpeta** sense garantir que totes les referències a documents individuals es comporten igual. Les biblioteques web no poden fer `takePersistableUriPermission` com l'aplicació Android nativa, que utilitza `ActivityResultContracts.OpenDocumentTree` i el proveïdor SAF del sistema.
- **Guardem els handles individuals** que ja retorna l'enumeració de la carpeta dins IndexedDB, només com a referències; no en guardem ni copiem els PDF. Si Chrome rebutja clonar-les, es conserva el catàleg lleuger de W2.22A.2 igualment.
- Si `getDirectoryHandle()` o `getFileHandle()` fallen amb alguns proveïdors d'Android, provem la cerca mitjançant `entries()` només en la branca del fitxer que s'està obrint.
- Si un handle ha caducat i `getFile()` falla, fem una única segona prova amb el handle retornat per l'enumeració de la carpeta. No es torna a reindexar la biblioteca completa.
- Si el proveïdor realment denega el PDF, el visor informa de la **limitació de Chrome amb eixe fitxer** en lloc de mostrar el missatge genèric i incorrecte «No s'ha pogut importar el fitxer». «Actualitzar biblioteca» no es presenta com a renovació de permisos dels PDF.
- Si falla la lectura, recuperem els controls de navegació i l'estat del visor.
- Proves de regressió amb un proveïdor Android simulat que permet `entries()` però denega `getFileHandle()` i `getDirectoryHandle()`, handles caducats, i error d'accés real.

### Límit tècnic
Un navegador web està separat del ContentResolver natiu i no pot conservar exactament els mateixos permisos URI persistents que la versió APK d'Android. Si el proveïdor de documents denega la lectura real del fitxer des de Chrome, la web no el pot obrir sense que l'usuari li facilite eixe document per una altra via (per exemple, importació puntual o biblioteca Drive via API). Esta fase reforça la compatibilitat sense enganyar l'usuari ni copiar la biblioteca a la força.

## W2.22A.2 — Índex persistent i biblioteca ràpida (2026-11-19)

- En escollir una carpeta, el primer recorregut en guarda a **IndexedDB un índex lleuger** amb noms, rutes, subcarpetes i data de l'última lectura, juntament amb la referència autoritzada a la carpeta original.
- En tancar, recarregar o tornar a obrir la web, es mostra **immediatament l'últim catàleg**. No es tornen a escanejar els centenars de PDF a cada inici. Si l'usuari ja tenia una carpeta vinculada sense índex guardat, es generarà una sola vegada en iniciar la versió actualitzada.
- Si s'obri un PDF o es necessita una miniatura després de reobrir, se'n resol **només el fitxer seleccionat** mitjançant el seu camí: els PDF originals continuen fora d'IndexedDB.
- **Actualitzar biblioteca** continua sent una operació explícita, que rellegeix l'estructura i detecta fitxers nous, moguts o eliminats. Ara no s'executa `getFile()` per a cada PDF durant la indexació; només es llegeixen les entrades del directori.
- L'índex és una instantània, no una sincronització contínua. Si s'afig o es renomena una partitura fora de la web, prem **Actualitzar biblioteca** perquè aparega el canvi. Si un permís caduca, pot caldre tornar a autoritzar-lo; això no elimina el catàleg guardat.
- La pantalla distingeix **Índex guardat** del primer escaneig i mostra l'hora de l'última actualització.
- La prova automatitzada verifica que després de recarregar hi ha **0 enumeracions de carpetes** a l'inici, que un PDF es pot llegir a demanda, que la biblioteca importada manté les seues dades i que la carpeta original queda intacta.

## W2.22A.1 — Correcció de permisos per a Chrome Android (2026-11-19)

- El lector ja no exigeix que `queryPermission()` retorne exactament `granted` abans d'intentar llegir la carpeta. Si la carpeta és llegible, també funciona amb estats `prompt` o amb API de permisos incompleta (Android/SAF).
- Es respecta una denegació explícita i es distingeixen errors reals d'accés dels errors d'altre tipus, amb indicacions per a tornar a seleccionar la carpeta.
- Quan encara no hi ha lectura autoritzada, la UI indica **lectura pendent** en lloc de mostrar falsament **0 PDF**, i no presenta botons de permisos inexistents.
- Si es torna a vincular exactament la mateixa carpeta (quan `isSameEntry` està disponible), es conserva la identitat de la biblioteca i les dades locals associades.
- El recorregut accepta `entries()` o `values()` segons el navegador.
- La prova E2E W2.22A inclou un cas d'Android sense mètodes de permisos, un cas `prompt` però llegible, un cas de denegació, un cas NotAllowedError i la verificació que no aparega `0 PDF` sense lectura.

# Fase W2.22A — Biblioteca local vinculada (sense importar PDFs)

La web recupera el model de la biblioteca Android: es tria la **carpeta real** de partitures i l'aplicació en llig directament els fitxers i les subcarpetes. Es basa en la File System Access API quan el navegador ho permet.

## Funcionament
- En Biblioteca apareix **Origen de la biblioteca**: Biblioteca importada / Carpeta vinculada. La carpeta local real es tria amb **Vincular carpeta** i el selector nadiu del navegador (Chrome/Edge compatibles).
- **No es copien els PDF** al magatzem intern de la web quan es vincula la carpeta. Es guarda a IndexedDB una referència a la carpeta i s'indexen només les rutes, mides i dates. Quan s'obri una partitura o es genera una miniatura, es llig directament el File original.
- Navegació, Índex, cerca, papers, favorits, repertoris, recents i lector PDF funcionen dins de la carpeta vinculada. Les subcarpetes reals, fins i tot les buides, apareixen a Biblioteca.
- **Actualitzar biblioteca** torna a llegir les carpetes i detecta PDF afegits, moguts, renomenats o retirats. No hi ha monitorització automàtica de carpetes en esta fase.
- Els **metadades, favorits, repertoris i configuració de papers** de cada origen s'emmagatzemen per separat. Les anotacions i els ajustos del visor s'associen al PDF i a la font vinculada, sense canviar el PDF original.
- La referència a la carpeta es conserva entre sessions on el navegador permeta serialitzar handles. Si el permís ha caducat, apareix **Autoritzar lectura**. No es demana mai permís d'escriptura. Desvincular la carpeta no elimina cap arxiu original.
- **Biblioteca importada** preserva tots els PDF, el visor i els repertoris previs. La funció Drive de W2.21 continua sent una importació a esta biblioteca, de forma independent, fins a W2.22B.
- En navegadors sense showDirectoryPicker, **Importar una carpeta (còpia)** fa una importació puntual dels PDF preservant subcarpetes. No és una carpeta enllaçada.

## Limitacions i proteccions
- No escriu, mou, renomena ni elimina PDF originals. Els botons que podrien afectar l'origen es desactiven en mode vinculat. L'escàner passa a la biblioteca importada, evitant guardar un arxiu a un lloc inesperat.
- Les còpies ZIP exporten **només la Biblioteca importada** (els PDF originals enllaçats no es dupliquen en les còpies). La configuració local de les carpetes i les referències es mantenen fora del ZIP.
- La vinculació depén del navegador, del sistema operatiu i dels permisos. Firefox i Safari no oferixen este selector. Chrome per a Android el va incorporar en versions recents, però alguns proveïdors de documents poden no exposar carpetes al selector.
- Les anotacions de la carpeta vinculada s'emmagatzemen **en el navegador actual**, no en els PDF originals ni en Drive. Una exportació específica de les anotacions vinculades queda pendent. Si es borren les dades del navegador, estos canvis locals es poden perdre: no és una còpia de seguretat.
- Si un PDF és renomenat o mogut, el seu camí canvia i les anotacions anteriors no es traslladen automàticament; es tractarà en una altra fase.
- Màxim de 10.000 PDF, 4.000 carpetes i 30 nivells per evitar bloquejos.

## Com provar
1. Des de Chrome o Edge, obri **Biblioteca → Vincular carpeta** i selecciona la teua carpeta de partitures.
2. Comprova l'estructura i obri un PDF; assegura't que els PDF de la carpeta **no** s'han duplicat a la biblioteca importada.
3. Afig un PDF a la carpeta externa i prem **Actualitzar biblioteca**.
4. Marca una obra com a favorita i canvia de Biblioteca vinculada a Biblioteca importada i viceversa.
5. Recarrega la web; si demana permís, prem **Autoritzar lectura**, i comprova que els PDF continuen estant en la carpeta original.

**Pròxim pas: W2.22B — biblioteques Google Drive com a origen real**, amb la mateixa interfície, navegació i lectura sota demanda.

---

# Partitures Festeres Web — Fase W2.21 · Primera connexió Google Drive (només lectura)

W2.21 prepara la connexió opcional de Google Drive a una biblioteca web **local** (IndexedDB), sense servidor de Partitures Festeres ni autorització d'escriptura a Drive.

## Què funciona en W2.21
- En **Biblioteca**, **Índex** i **Ajustos** hi ha un accés «Drive» que obri el nou explorador.
- Des del diàleg, configura un **Client ID OAuth 2.0 de tipus Aplicació web** i connecta el compte de Google mitjançant el flux de token de Google Identity Services (GIS), en una finestra de consentiment. Només es demana el permís **drive.readonly**.
- Admet enganxar l'ID de la carpeta o un enllaç https://drive.google.com/drive/folders/... inclòs el paràmetre resourcekey quan existeix.
- Consulta els continguts de cada carpeta **només quan l'usuari la visita**. La navegació admet subcarpetes i fitxers PDF. Es tracten totes les pàgines de resultats de files.list fins al límit de 5.000 elements.
- Es pot **baixar una partitura PDF concreta** de Drive a IndexedDB, accessible després sense Internet. La còpia local apareix en Drive/<nom carpeta>/<subcarpetes>/<fitxer.pdf>.
- Els fitxers es comproven: només PDF, cap fitxer buit, límit de 100 MB, verificació de capçalera i nom de ruta segur. Si el destí ja existeix, es crea un nom nou amb (2), (3), etc.; no se sobreescriu el PDF existent ni les seues anotacions.
- El token d'accés només roman en memòria RAM de la pestanya; no s'escriu en IndexedDB, localStorage, arxius, log, ZIP ni GitHub. En tancar/actualitzar la pestanya, el token desapareix. «Desconnectar» a més demana la revocació al servei de Google.
- El Client ID i l'últim enllaç de carpeta es guarden localment per comoditat, però **s'exclouen de les còpies ZIP**. No introduïsques mai un client secret en esta pàgina.

## Configuració OAuth imprescindible (no és una credencial inclosa en el codi)
1. Accedix a [Google Cloud Console](https://console.cloud.google.com/apis/credentials) i selecciona o crea un projecte.
2. Activa **Google Drive API** al projecte. Configura la **Pantalla de consentiment OAuth**. Si el projecte està en fase de prova, dona accés al teu compte com a usuari de prova.
3. Crea un **ID de client OAuth** de tipus **Aplicació web** i incorpora com a **Origen JavaScript autoritzat** l'origen exacte que mostra l'explorador de Partitures Festeres (normalment https://santimillanavarro.github.io en GitHub Pages). No cal publicar cap client secret ni introduir-lo a la web.
4. Guarda el **Client ID** públic en el diàleg Drive de Partitures Festeres Web, connecta i accepta el permís de lectura.
5. Copia l'enllaç d'una carpeta de Drive, enganxa'l i prem **Obrir carpeta**. Navega i usa **Baixar** per a importar una partitura.

**Important:** el permís drive.readonly és un scope OAuth restringit. Google pot exigir verificació de l'aplicació (i en producció altres controls de compliment). Un projecte en mode prova amb comptes autoritzats pot funcionar per a les proves inicials; la publicació general dependrà dels requisits de Google. No es pot connectar automàticament a Drive sense configurar un Client ID vàlid.

## Què NO fa encara
- No sincronitza els canvis de Drive amb els PDF locals; cada descàrrega és una còpia independent.
- No descarrega carpetes completes ni actualitza automàticament les partitures.
- No sincronitza les anotacions de la versió Android, els arxius personals PFA ni els repertoris.
- No escriu, mou, renomena, reemplaça ni esborra fitxers en Drive.
- No revalida les credencials automàticament: en recarregar l'app cal connectar de nou, encara que la biblioteca importada és sempre accessible sense connexió.

## Seguretat i proves
S'han afegit proves amb una implementació simulada de Google (GIS OAuth i Drive REST), sense credencials ni accés a dades reals. Cobrixen la connexió, navegació, paginació, importació repetida sense sobreescriptura, restriccions de ruta, revocació i exclusió de credencials en les còpies ZIP.

**Pròxima fase W2.22:** importació segura d'una carpeta completa, comparació de canvis i descàrrega per a ús sense connexió, mantenint-se en mode lectura fins a consolidar la sincronització.

---

# Partitures Festeres Web — W2.20 · Papers virtuals i carpetes configurables

## Referència Android 1.11.15
Implementació inspirada en PaperRoleStore.kt, PaperRoleNavigation.kt i PaperRoleControls de PartituresFesteresApp.kt. El paper és un accés virtual a una **ruta de carpeta** de la biblioteca; no mou, crea ni suprimix cap PDF.

## Novetats
- **Configurar papers** (engranatge al costat del selector a Biblioteca i Índex; també des d'Ajustos). Es poden assignar els papers 1r i 2n a qualsevol carpeta **existent** de la biblioteca, incloent-ne de niades com Instruments/Saxo Alt/1r.
- **Afegir paper** crea 3r, 4t, 5é i els següents. Es poden eliminar només els papers addicionals. La confirmació explica que no es modifica cap carpeta ni partitura.
- **Cerca de carpeta** dins del modal, amb els noms reals i ruta completa. Una carpeta assignada a un altre paper es mostra com a ocupada; al reassignar-la, es desvincula del paper anterior (mateix principi d'Android).
- **Arrel** permet vore totes les obres de la biblioteca. Un paper seleccionat mostra directament els seus PDFs/subcarpetes internes; no obliga a tornar a entrar per les carpetes pare.
- La Biblioteca, l'Índex, Recents, Favorits, la navegació per breadcrumbs, l'escàner i la reorganització tenen en compte l'arrel virtual. Els repertoris mantenen les seues rutes originals i no canvien de contingut.
- Les assignacions i el paper actiu es desen a IndexedDB. S'inclouen en els ZIP complets (Ajustos).
- **Migració W2.19**: els antics accessos per carpetes numerades a la primera capa es convertixen en papers 1r, 2n, 3r, 4t, etc. La migració conserva la selecció antiga quan siga possible i no renombra ni mou arxius.

## Diferències de plataforma
Android utilitza URIs reals del Storage Access Framework; la web, de moment, utilitza les rutes dels PDFs importats en la seua base IndexedDB. **No s'ha implementat encara la connexió directa a carpetes del dispositiu ni a Google Drive**. Les carpetes buides, sense cap PDF importat, no són seleccionables. Si una carpeta vinculada desapareix del contingut, apareix un avís al configurador, però l'assignació es conserva per a futures reimportacions.

## Proves manuals
1. Importa un ZIP amb rutes Instruments/Saxo/1r/Marxes, Instruments/Saxo/2n/Pasdobles i Instruments/Trompeta/3r/Mores.
2. Al selector de Biblioteca, toca l'engranatge i assigna 1r a Instruments/Saxo/1r; comprova que Biblioteca mostra Marxes directament, sense carpetes Instruments ni Saxo.
3. Afig 3r, assigna Instruments/Trompeta/3r, selecciona 3r i després Arrel.
4. Reassigna una carpeta d'un paper a un altre: ha de desaparèixer la vinculació antiga, sense tocar els PDF.
5. Esborra 3r amb confirmació: el paper desapareix però les obres continuen visibles en Arrel.
6. Recarrega l'app i comprova que les assignacions persistixen. Fes una còpia ZIP; restaura en mode Substituir per a recuperar-les.

**Pròxima fase:** W2.21 · preparació del connector opcional Google Drive i estratègia d'accés segur i local sense connexió.

---

# Partitures Festeres Web — W2.19 · Edició avançada i còpies ZIP segures

Esta fase recupera ferramentes d'Android 1.11.15 (PdfViewerScreen.kt) sense alterar el PDF original.

## Desfer i Refer

- **Desfer** i **Refer** disponibles en rosetó i en anotacions clàssiques.
- Historial de 24 passos per pàgina mentre el PDF roman obert. Després de desfer, un canvi nou inicia una altra branca.
- En ordinador també funcionen Ctrl/Cmd+Z i Ctrl/Cmd+Shift+Z o Ctrl/Cmd+Y, sense interferir amb el teclat del text.
- Els trasllats entre pàgines es registren de manera atòmica; desfer comprova que l'origen no ha sigut modificat després.

## Objectes

- En Anotar → Objectes: **Duplicar**, **Tallar**, **Portar avant**, **Enviar arrere**, **Copiar** i **Apegar**.
- Tallar espera l'apegat abans de suprimir l'objecte original; així es pot cancel·lar sense perdre'l.
- Portar avant i Enviar arrere modifica l'ordre de superposició un pas.
- El quadre de text seleccionat admet desplaçament fi amb ↑ ↓ ← → de 0,3 % del full.
- Els rectangles i les el·lipses tenen cinc opcions d'ompliment: **0, 15, 35, 60 i 100 %**; apareixen al rosetó, Objectes i al panell clàssic.
- Les anotacions antigues continuen llegint-se sense cap migració i sense ompliment.

## Còpies de seguretat

- Exporta preferències de visor i ajustos individuals W2.18 de les obres, també amb carpetes reals en la ruta (per exemple Instruments/1r/Marxes/Obra.pdf).
- Si els ajustos no caben en el manifest, l'exportació s'atura amb un error explícit; no es crea un ZIP incomplet.
- En substituir la biblioteca, la restauració recupera els PDFs, les anotacions i les preferències. En afegir, incorpora les preferències dels PDF nous i respecta les existents.
- Conserva SHA-256 de verificació i compatibilitat amb ZIP d'etapes anteriors.

**Prova manual:** crea dos objectes, desfés i refés; selecciona un text i usa les fletxes; dibuixa un rectangle al 35 %; duplica i ordena. Després fes una còpia ZIP amb obres en subcarpetes, restaura-la i comprova anotacions, zoom i retall de pàgina.

**Pròxima fase:** W2.20, configuració completa de papers i biblioteques reals d'Android.

---

# Partitures Festeres Web — W2.18 · Ajustos individuals de pàgina

L'app Android 1.11.15 guarda per pàgina un **gir**, un **retall visual** i el **contrast** sense alterar el fitxer PDF. W2.18 incorpora estes opcions al visor web amb el mateix principi no destructiu.

- En obrir una partitura, mostra els controls i toca **Ajustar pàgina** (icona de marc en el menú superior).
- La previsualització del full permet girar **90° a dreta o esquerra**, moure el marc i ajustar els marges arrossegant els huit punts o amb els quatre controls de 0–35 %. El contrast és de **70–160 %**.
- **Aplicar a la pàgina** afecta només el full actual; **Aplicar a tot el PDF** propaga estos mateixos ajustos a tots els fulls. **Restablir retall i contrast** conserva el gir configurat. **Cancel·lar** no guarda els canvis.
- El PDF original i les anotacions existents no es modifiquen: el retall amaga només la part exterior; el canvas PDF i la capa SVG d'anotacions es desplacen amb les mateixes coordenades.
- Cada partitura guarda els seus propis ajustos per número de pàgina en IndexedDB. Es recuperen després de reobrir el visor i funcionen sense connexió. Renomenar o moure el PDF trasllada també estes preferències en la mateixa transacció; eliminar-lo neteja els seus ajustos.
- L'editor s'inhabilita mentre s'anota per protegir textos i gestos. Es conserven els huit ajustos de W2.16 i les fletxes laterals de W2.17.

**Prova:** obri un PDF de dos fulls, retalla i puja el contrast del primer, passa al segon, torna al primer i reobri la partitura. Després prova el gir i «Aplicar a tot el PDF» i comprova que les anotacions mantenen la posició.

**Pròximes fases:** paritat de les opcions Android restants, prioritzant estabilitat i compatibilitat de navegadors.

---

# Partitures Festeres Web — W2.17 · Fletxes laterals i visor sense avís de pantalla completa

Canvis sol·licitats després de provar **W2.16** en Android amb una captura on Chrome mostra una notificació sobre com eixir de **pantalla completa** per damunt de la partitura. Eixe avís és del navegador, no del PDF. Per eliminar-lo deixem de demanar `requestFullscreen()` en entrar al lector.

## Visor sense avís

- La PWA **ja no sol·licita pantalla completa** en obrir PDFs. Així Chrome no mostra l'avís sobre com eixir-ne.
- Conservem l'intent de `screen.orientation.lock('landscape-primary')` quan està activa l'opció d'horitzontal. Si Chrome el rebutja perquè necessitaria fullscreen, s'activa la **rotació CSS alternativa** que ja teníem, sense avís.
- L'opció d'orientació de W2.16 continua vigent; si es desactiva, respecta la posició actual. En ordinador, el lector s'adapta a la finestra.
- No es força cap doble rotació i l'orientació del navegador es desbloqueja quan es tanca la partitura.

## Fletxes discretes als laterals

- Sempre que es llig una partitura, es mostren dues **fletxes ‹ ›** als laterals. També són visibles en mode net **Zen**, amb baixa opacitat.
- Les fletxes canvien de pàgina i, en arribar als extrems, respecten la navegació entre obres i el **mode Actuació circular**. No hi ha retorn circular cap arrere.
- Quan no es pot retrocedir o avançar, la fletxa corresponent queda deshabilitada.
- El símbol és menut, però la superfície tàctil és còmoda (42×76 px; 36×66 px en mòbil). Funciona en **vertical i horitzontal** i en rotació visual alternativa.
- En entrar a **anotacions**, desapareixen completament: no tapen el rosetó, figures, text o gestos. Tornen al tancar l'edició.
- Mantenim les zones de toc configurables de W2.16, el zoom i la selecció de repertoris. Els botons tenen noms accessibles en valencià i castellà.

## Proves i seguretat

Sense canvis de PDF, anotacions, repertoris o còpies ZIP. El test **W2.17 Fletxes i visor sense pantalla completa** simula el rebuig d'orientació en Android, verifica que no es crida `requestFullscreen()` i comprova, amb PDFs reals, fletxes, límits, mode Zen, anotacions i retorn circular. Continua tota la CI anterior.

**Següent fase:** els ajustos individuals de pàgina d'Android (retall visual, contrast i rotació). Requerixen mantindre sincronitzada la geometria del PDF i de les anotacions per evitar desplaçaments; per seguretat es desenvolupen com a fase dedicada, conservant els arxius originals.

---

# Partitures Festeres Web — W2.16 · TOTS els ajustos avançats del visor d'Android

Fase completa, sense subdivisió. Revisió directa del codi original **Android 1.11.15**: `data/SettingsStore.kt`, `ui/SettingsScreen.kt`, `ui/PdfViewerScreen.kt` i `ui/PdfViewerActivity.kt`. Les huit opcions de configuració del visor trobades s'han reproduït en un únic panell **Ajustos → Ajustos avançats del visor**, en valencià i castellà. No s'han afegit opcions suposades d'Android ni s'han alterat els PDFs.

## Les huit opcions i els valors originals

| Android `AppSettings` | Web W2.16 | Valor inicial | Comportament |
| --- | --- | --- | --- |
| `menuHideSeconds` | Amagar menús després de | **3 s**, de 1 a 10 | Desapareix el menú del visor després del temps triat |
| `showScoreNameOnChange` | Mostrar el nom al canviar | **No** | Cartell temporal durant **1,2 s** en obrir una partitura |
| `rememberZoom` | Recordar el zoom | **Sí** | Si es desactiva, s'obri cada PDF al 100 %; preservem el zoom guardat anterior per si es torna a activar |
| `keepScreenOn` | Mantindre la pantalla encesa | **Sí** | `navigator.wakeLock.request('screen')` si el navegador ho permet; s'allibera al tancar el visor o amagar la pestanya |
| `allowViewerRotation` | Intentar orientació horitzontal | **Sí** | Conserva l'intent de bloqueig horitzontal que ja tenia la PWA; desactivat, respecta l'orientació física actual |
| `sideTapFraction` | Amplària zones laterals | **22 %**, de 12 a 32 % | Zones esquerra/dreta per a pàgina anterior/següent, centre per als controls; doble toc central respecta la mateixa franja |
| `overrideBrightness` | Ajustar la llum del visor | **No** | La web usa un filtre visual d'atenuació, **no** pot canviar el brillantor físic del dispositiu |
| `brightnessPercent` | Llum relativa del visor | **80 %**, de 20 a 100 % | Atenuació configurada (no bloqueja tocs ni tapa els botons), i vista prèvia abans de guardar |

**Nota sobre la rotació Android:** la font 1.11.15 conserva el camp `allowViewerRotation` a Ajustos i a `SettingsStore`, però `PdfViewerActivity.kt` evita expressament forçar l'orientació des d'Android 16. La web li dona un comportament útil i explícit: habilitar o no l'intent de bloqueig horitzontal. El botó de gir manual de les pàgines continua disponible.

## Com usar-lo

Entra en **Ajustos → Ajustos avançats del visor** i modifica les opcions. Les barres mostren immediatament el número i una previsualització de les zones tàctils, o la simulació de llum. Prem **Guardar canvis** per a desar les huit preferències juntes a IndexedDB. **Restablir valors Android** torna als valors inicials, sense desar-los fins a confirmar.

Les preferències només afecten el visor; ni les anotacions ni les partitures són modificades. Es mantenen la navegació circular de W2.15.1, la cerca dins del visor de W2.15.2, el redibuix estable, el rosetó i el teclat Android per a quadres de text.

**Limitacions web:** Screen Wake Lock pot no estar disponible o ser denegada quan el navegador no està en primer pla; l'app continua funcionant sense bloqueig. La brillantor és només visual i pot reduir la llum percebuda, però no pot pujar el nivell físic del dispositiu. El bloqueig d'orientació depén del navegador. No es promet una equivalència impossible amb les APIs natives.

## Proves

Workflow nou **W2.16 Ajustos complets del visor**: verifica els valors Android, límits dels controls, persistència entre recàrregues, temporitzador de menús, banner temporal, zoom no recordat i restaurat després, zones tàctils 32 %, bloqueig de pantalla simulat i alliberament, orientació amb bloqueig desactivat, atenuació visual i restauració per defecte. Prova amb un PDF local real de tres pàgines i conserva les proves de regressió anteriors.

---

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
