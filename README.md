# Partitures Festeres Web — W2.4.1 · Símbols alineats i quadres de text

Actualització correctiva de W2.4 arran de proves reals en Android amb partitures girades automàticament. Els símbols musicals havien aparegut de costat: el visor ja havia girat la pàgina PDF, però els segells SVG rebien un **segon gir** independent de 90°/270°.

## Canvis

- **Símbols musicals:** es dibuixen en la direcció visual de la partitura sense aplicar el segon gir. Les figures, silencis, signes, matisos i indicacions de tempo es mantenen llegibles quan el PDF és obert en horitzontal amb rotació automàtica o manual. La zona per seleccionar-los també seguix el dibuix real. No es modifiquen les anotacions que ja s'havien guardat.
- **Text amb quadre propi:** la ferramenta **Text** permet **tocar per crear un quadre estàndard** o **arrossegar sobre la partitura per definir-ne l'amplària i altura**. Durant el gest es mostra el rectangle provisional; en soltar s'obri el diàleg de text i format i el quadre provisional es manté visible darrere.
- **Format i extensió del quadre:** el text escriu línies dins l'amplària definida i passa a la línia següent si cal. L'altura augmenta quan és necessari per contindre les línies (fins al límit de la pàgina). L'usuari pot canviar font, grandària, color, negreta, subratllat i opacitat amb el diàleg ja existent.
- **Moure i redimensionar:** tria **Text i edició → Seleccionar**, toca el quadre i mou-lo. Per canviar-ne la mida, arrossega el punt de la seua cantonada inferior dreta. Els canvis admeten **Desfer** i la goma, igual que els altres traços.
- **Cancel·lar:** si tanques el diàleg o prems Escape, un quadre nou no es guarda; el PDF i les anotacions anteriors queden intactes.

## Compatibilitat

- Les anotacions mantenen el format `version:1`. Els quadres nous utilitzen dos camps opcionals, `boxWidth` i `boxHeight`, en coordenades relatives. Els textos de W2.3 i anteriors **sense dimensions** continuen llegint-se sense modificació.
- Els PDF originals mai es modifiquen. Es mantenen el zoom, la rotació del PDF, el bloqueig horitzontal i els gestos Android de tornar al menú.
- Les còpies ZIP continuen contenint les anotacions; no cal importar de nou res ni netejar les dades de l'app.
- La versió d'Ajustos i el manifest ZIP és **W2.4.1**.

## Proves

Una nova prova Chromium cobreix la direcció d'una negra a 270°, la col·locació de quadres amb un toc i amb arrossegament, les dimensions guardades, el redimensionament, selecció, editar, Desfer, cancel·lar, zoom, canvi de rotació i persistència. Les regressions de W2.1 a W2.4 continuen verificant la compatibilitat dels altres traços i les còpies ZIP.

**Nota sobre paritat amb Android:** el quadre ja naix sobre la partitura, però la introducció del text i els ajustos tipogràfics mantenen en W2.4.1 el diàleg del visor web. Quan es dispose del projecte font d'Android, es podrà afinar el comportament exacte del teclat, la barra de format i la interacció directa amb el quadre.

La fase està en una branca i PR independents; no altera la web publicada fins que es fusiona. **No esborres dades del navegador sense una còpia ZIP externa.**
