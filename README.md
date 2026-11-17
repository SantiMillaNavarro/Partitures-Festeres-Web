# Partitures Festeres Web — W2.2.1 · Recuperar la pantalla després de recarregar

Esta actualització millora la continuïtat de la navegació: **en actualitzar la web-app (també amb el gest de recarregar), es reprén l'últim lloc consultat en comptes de tornar sempre a Biblioteca**.

## Què recorda l'aplicació

- La secció activa: **Biblioteca, Repertoris, Índex, Recents, Favorits o Ajustos**.
- La carpeta de Biblioteca on estaves i el paper seleccionat (1er, 2n, etc.).
- El repertori concret que estaves consultant.
- Si tenies una partitura oberta, torna a obrir el mateix PDF en **la mateixa pàgina**, amb el zoom i la rotació que ja es guardaven.
- La posició de desplaçament vertical de la pantalla, quan és possible.

La recuperació valida que les carpetes, els repertoris i els PDF existisquen encara; si se n'ha eliminat algun, es recupera una pantalla vàlida sense quedar bloquejat. **No recupera els diàlegs temporals ni entra directament en mode d'edició d'anotacions**, per a evitar tocs accidentals.

## Dades, privadesa i compatibilitat

La ubicació es guarda exclusivament en l'emmagatzematge local del navegador. **No guarda els PDF ni les anotacions en localStorage**. Els fitxers continuen en IndexedDB i les còpies ZIP continuen sent compatibles. Les preferències de paper, zoom i rotació mantenen el funcionament anterior.

Si el navegador impedix guardar esta dada local, l'app continuarà funcionant però pot no recordar la pantalla. No s'esborra cap partitura ni anotació durant una actualització.

## Organització futura i coherència amb Android

L'**app Android és la referència de comportament, estructura i organització de les ferramentes**. Les fases següents aproparan gradualment la distribució dels menús i el sistema d'anotacions de la web a Android, amb les adaptacions necessàries per al navegador i les pantalles tàctils. Esta fase únicament millora la continuïtat de la navegació i no reorganitza encara els controls.

## Proves

- Proves de navegació segura: carpetes inexistents, papers diferents, repertoris i PDF eliminats.
- Playwright en navegador: recuperació de totes les seccions, carpeta, desplaçament, repertori obert i **mateix PDF/pàgina**, sense perdre partituras.
- Regressions de Biblioteca, Repertoris, Índex, busca, anotacions i visor PDF.

La correcció s'ha preparat en una branca separada. La versió pública no canvia fins que es fusione el PR.

**Recorda conservar còpies ZIP de les partitures abans d'esborrar dades del navegador o desinstal·lar l'app.**
