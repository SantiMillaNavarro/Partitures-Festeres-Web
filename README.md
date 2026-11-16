# Partitures Festeres Web W1.2.2 — Recuperació del visor

La W1.2.2 recupera el visor natiu de W1.1. Les versions W1.2 i W1.2.1 poden deixar mescles de fitxers en la memòria cau. Per evitar-ho, aquesta versió utilitza noms de fitxer únics i una estratègia de xarxa primer, memòria cau després, per al codi.

## Publicació

1. Descomprimeix el ZIP.
2. Puja **tot el contingut** a l'arrel del repositori GitHub Pages (`main`), incloses les noves versions `app-w122.js`, `backup-w122.js`, `db-w122.js`, `styles-w122.css`.
3. Confirma el canvi (Commit changes) i espera a la publicació.
4. Torna a obrir la URL habitual amb connexió i actualitza la pàgina. Si la PWA ja estava oberta, tanca-la del tot i torna-la a obrir.
5. Comprova que en Ajustos figure «W1.2.2». Si encara es mostra una versió antiga, torna a carregar la pàgina abans de provar el visor.

## Important: no perdre partitures

**No desinstal·les la PWA, no esborres dades del lloc ni IndexedDB.** Aquesta actualització només canvia els fitxers públics del programa; no modifica la base de dades privada de partitures, les còpies ni les preferències.

Si el PDF no es veu en el visor integrat, el botó visible «Obrir en un altre visor» permet sol·licitar l'obertura nativa del PDF en una pestanya. Les capacitats del visor PDF natiu depenen del navegador i de si el sistema permet obrir la URL `blob:`.

## Limitacions

Aquesta fase és una **recuperació**, no un visor PDF avançat. No inclou el zoom persistent ni la rotació manual de W1.2, que es van retirar. No s'ha validat en Safari iOS real.
