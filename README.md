# Partitures Festeres Web — W2.3.2 · Orientació automàtica de les partitures

Esta fase corregix un problema detectat en proves reals amb partitures com **Arcum**: en W2.3.1 el *visor* es presentava horitzontalment, però la *pàgina del PDF* continuava apareixent de costat o del revés. Les partitures importades amb contingut girat no han de requerir una correcció manual cada vegada.

## Com orienta el PDF

1. En obrir una obra, es consulta la primera pàgina sol·licitada i les dades del PDF.
2. Si el document conté text vectorial llegible, el visor analitza la direcció de les seues línies (títol, autoria, etc.) per decidir automàticament la rotació correcta entre 0°, 90°, 180° i 270°. No sols detecta la forma vertical o horitzontal de la pàgina, també el **sentit** del text per a evitar partituras cap per avall.
3. Si no hi ha capa de text, el visor analitza localment una versió de baixa resolució de la pàgina i detecta la direcció principal dels pentagrames. Les partitures que tenen els pentagrames verticals es posen automàticament horitzontals, respectant /Rotate si indica una de les orientacions correctes. En escanejos sense informació de sentit, s'utilitza 270° per defecte; alguns escanejos excepcionals poden requerir un únic gir manual.
4. En passar a una altra pàgina, l'anàlisi de text es repetix. Quan la pàgina no conté text i manté el mateix format, es reutilitza l'orientació detectada en la resta de l'obra, evitant retards.
5. La Biblioteca, Repertoris i els altres menús conserven el funcionament anterior: només afecta el contingut del visor PDF.

## Respecta les preferències existents

- **L'orientació automàtica és la predeterminada** per a cada obra, també per a aquelles que W2.3.1 havia guardat a 0° sense que el músic haguera girat la pàgina.
- **Girar 90°** continua disponible. En tocar-lo, la rotació de l'obra passa a ser una preferència manual i queda guardada. Les preferències antigues de 90°, 180° i 270° es respecten com a ajustos manuals.
- **AUTO**: botó menut en el visor que torna a activar la detecció automàtica després d'haver girat una partitura.
- Ni el PDF ni les anotacions existents es modifiquen. Les coordenades d'anotacions es mantenen relatives a la pàgina original, independentment del gir.
- Les preferències continuen guardant-se en IndexedDB i s'inclouen en les còpies ZIP. El format de les còpies no canvia.
- Sense enviaments de PDF a cap servei extern: l'anàlisi utilitza el PDF.js local.

## Proves

Les comprovacions de navegació i de totes les fases W1/W2 existents es mantenen. W2.3.2 incorpora proves de contingut girat, text normal, pentagrames escanejats sense text, pàgines de diferents orientacions, persistència, restauració de la manera automàtica després d'una recàrrega, respecte als girs manuals antics i integritat dels PDF.

**Limitació:** en alguns PDF escanejats que no tenen text recuperable ni informació del sentit «dalt/baix», detectar automàticament si la partitura està exactament cap per avall és intrínsecament ambigu; en eixos casos es pot aplicar el gir manual una vegada per obra. La resta de la biblioteca no necessita una correcció obra per obra.

Versió visible en Ajustos i en còpies ZIP: **W2.3.2**. Pendent de validació en Safari real de l'iPhone/iPad després de fusionar el PR.

**No esborres les dades del navegador sense conservar una còpia ZIP externa.**
