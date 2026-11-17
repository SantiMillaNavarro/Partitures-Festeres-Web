# Partitures Festeres Web W1.3A.1

Corregix l'ús dels **Repertoris** perquè es puguen incorporar partitures sense eixir de la secció.

- Nou botó **Afegir partitures** dins de cada repertori.
- Selector amb **cerca immediata per nom o ruta de carpeta**, sobre tota la biblioteca, independent del filtre actual.
- Selecció de múltiples obres, fins i tot fent cerques diferents, i confirmació conjunta.
- Les partitures ja incloses es mostren com a afegides i no poden duplicar-se.
- En tancar amb Cancel·lar, no es modifica el repertori.
- La nova incorporació va al final del repertori, conservant l'orde previ.
- Manté PDF.js, el visor W1.2.4, els papers, els PDF en IndexedDB i el sistema de còpies.
- **W1.3A.1** apareix en Ajustos; manté els textos en valencià i castellà.

## Prova ràpida
1. Obrir un repertori amb o sense partitures.
2. Polsar **Afegir partitures**.
3. Escriure una cerca (per exemple, *Alm*), marcar una obra, buscar una altra i marcar-la.
4. Polsar **Afegir seleccionades**.
5. Comprovar que totes apareixen, conservant l'orde de les obres que ja hi havia.
6. Tancar/reobrir l'app i verificar persistència. Repetir amb Cancel·lar.

## Seguretat
És una PR independent; **main no es modificarà fins que l'usuari l'aprove**. No s'altera `db.js`, `backup.js` ni s'esborren PDFs. No desinstal·lar la PWA ni netejar dades del navegador.