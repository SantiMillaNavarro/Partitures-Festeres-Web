# Partitures Festeres Web — W2.4 · Símbols musicals en les anotacions

Esta fase continua l'acostament del sistema d'anotacions a l'app Android, mantenint **la mateixa experiència de lectura horitzontal i navegació per gestos** de W2.3.5.

## Novetats W2.4

- **Quart grup de ferramentes, «Símbols»** al selector tipus rosetó, al costat de «Traços», «Formes» i «Text i edició». És una ampliació progressiva, no encara el rosetó definitiu d'Android.
- **32 signes musicals vectorials** organitzats en cinc apartats:
  - **Figures:** negra, blanca, redona, corxera, semicorxera.
  - **Silencis:** redona, blanca, negra, corxera, semicorxera.
  - **Signes:** sostingut, bemoll, becaire, calderó i picat.
  - **Matisos:** pp, p, mp, mf, f, ff, sfz, crescendo i diminuendo.
  - **Tempo:** rit., rall., accel., a tempo, Fine, D.C., D.S. i coda.
- **Ús ràpid:** Anotar → Símbols → Triar símbol; tria una categoria i toca el símbol que vols. El selector es tanca i pots estampar-lo tantes vegades com siga necessari en qualsevol punt de la partitura.
- **Grandària i color** configurables abans de posar-lo; el format es manté en eixa sessió del visor.
- **Seleccionar, moure, esborrar i desfer:** utilitza les ferramentes d'edició de W2.2 i W2.3 per a treballar amb els símbols com amb la resta d'anotacions. La goma també pot llevar un signe concret.
- **Orientació, zoom i pàgines:** la posició de cada signe es guarda en coordenades relatives a la pàgina PDF original, de manera que acompanya el zoom i la rotació automàtica o manual del PDF.

## Compatibilitat i protecció de dades

- El model d'anotacions **manté `version:1`** i permet els registres antics (`pen`, `highlighter`, formes i `text`) sense migracions; afig l'objecte `tool:'symbol'` amb identificador validat, posició, mida, color i opacitat.
- S'utilitzen gràfics SVG predefinits localment, **sense descarregar tipografies ni dependre de serveis de tercers**, i sense interpretar HTML aportat per fitxers d'anotacions.
- **El PDF original no es modifica.** L'anotació continua guardada en IndexedDB i s'inclou en les còpies ZIP habituals. Les còpies prèvies seguixen sent compatibles.
- La Biblioteca, Repertoris, Índex, Recents i Favorits conserven els seus arxius i funcionalitats; el comportament de tornar amb gestos Android continua actiu.
- Sense sincronització amb Drive en esta fase. Fes còpies ZIP regularment i guarda-les fora del navegador.
- Versió d'Ajustos i etiqueta de còpies: **W2.4**.

## Verificacions

La nova prova Chromium comprova validació de dades, els cinc grups de símbols, col·locació, color, mida, selecció, moviment, goma, desfer, zoom, gir manual, canvi de pàgina, recàrrega, exportació i restauració de ZIP i preservació dels bytes del PDF.

Les regressions anteriors continuen revisant els traços, formes, text, orientació fixa en Android, navegació amb gest «Enrere», biblioteca, repertoris i cerca.

**Prova en dispositiu real:** en el mòbil o tauleta, posa un signe `mf` i una corxera, mou-los i gira la pàgina; verifica que els controls del nou quart grup resulten còmodes amb els dits i que el visor no perde superfície de lectura.

## Fases següents

Seguir acostant l'estructura de menús i el rosetó a Android i incorporar retalls, copiar/enganxar entre pàgines i eines més especialitzades. Estos elements **encara no formen part de W2.4**.
