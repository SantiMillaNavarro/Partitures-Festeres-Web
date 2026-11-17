# Partitures Festeres Web — W2.3.5 · Gest «Enrere» al visor PDF

Esta correcció apropa la navegació del lector de partitures a l'app Android: **quan una partitura està oberta en mode horitzontal, el gest del sistema «Enrere» ha de tornar al menú que havies consultat, no tancar tota l'aplicació.**

## Funcionament

- Obrir un PDF des de **Biblioteca, Repertoris, Índex, Recents o Favorits** crea una entrada d'historial del navegador per a eixa sessió de lectura, sense canviar la URL ni enviar dades a internet.
- En tocar **Enrere** (gest natiu del mòbil o botó Atrás del navegador), es tanca el visor, es desbloqueja l'orientació horitzontal i es torna **a la mateixa secció, carpeta o repertori** des d'on s'ha obert.
- El botó de tornada del visor i la tecla **Escape** reutilitzen la mateixa entrada d'historial. No s'acumulen passos de tornada si canvies de PDF dins de la mateixa sessió de lectura.
- En alguns mòbils Android, el primer gest del sistema pot consumir-se únicament en eixir de pantalla completa. Ara es detecta `fullscreenchange` i, si el navegador no ha navegat encara, es tanca la partitura i es torna al menú **sense generar un doble pas enrere**.
- Una **recàrrega explícita** de la web seguix restaurant la mateixa partitura i pàgina; el gest «Enrere» continua tornant a la secció anterior fins i tot després de refrescar.
- Una **obertura nova** de l'app continua sense recuperar automàticament el PDF (com en W2.3.3).

## Compatibilitat

L'historial és propi del navegador i només afecta a la navegació de la pantalla. No modifica els arxius, les anotacions, els repertoris ni els ajustos persistents. No cal reimportar cap PDF ni netejar les dades del navegador.

El suport de gestos del sistema varia segons Android, Chrome i el mode d'instal·lació de la PWA. En Safari iPad/iPhone també s'utilitza l'entrada d'historial quan el navegador notifica el retrocés, sense prometre interceptar gestos reservats pel sistema.

La versió d'Ajustos i còpies ZIP és **W2.3.5**.

## Proves

Prova nova en Chromium tàctil per a: tornada mitjançant historial, recuperació de Biblioteca i Recents, canvi entre partituras sense acumular passos d'historial, sortida de fullscreen sense `popstate`, fletxa del visor, recàrrega amb PDF obert i inici net de l'app. Se sumen els tests existents per a orientació, anotacions, cercador, Index, Repertoris i integritat de PDF/ZIP.

**Prova final en mòbil Android:** obri una partitura, fes el gest **Enrere** i verifica que torna al menú. Repetix-lo després de passar a una altra partitura i amb l'app en pantalla completa.
