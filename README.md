# Partitures Festeres Web — W1.3B.1 · Metadades opcionals

Esta versió incorpora un editor de metadades independent dels PDF, amb accés des de Biblioteca, Repertoris, Recents, Favorits i Índex.

## Camps
- Títol
- Compositor / autoria
- Tipus de composició
- Any (quatre xifres)
- Observacions

**Tot és opcional.** No es demana cap dada al pujar PDF. El títol opcional es pot mostrar en les llistes i buscar amb la cerca senzilla, però la ruta i el nom físic del PDF **no canvien**.

## Emmagatzematge
Les metadades es guarden junt amb cada registre PDF d'IndexedDB, sense alterar els bytes del document ni canviar la versió de la base de dades. Quan s'importa de nou un PDF que ja existix amb la mateixa ruta, es conserven les metadades.

El manifest de les còpies ZIP completa inclou les metadades opcionalment a cada arxiu. Les còpies W1.1 sense metadades seguixen admeses:
- **Fusionar** amb una còpia antiga conserva les metadades locals de les obres sense metadades de la còpia.
- **Substituir** recupera el que hi havia en la còpia; si és una còpia antiga, no contindrà metadades.

Manté la biblioteca, el visor W1.2.4, els repertoris, favorits, recents i papers. La cerca avançada amb filtres combinats arribarà en W1.3B.2.

## Proves
CI comprova edició i cancel·lació, any invàlid, cerca per títol, integritat PDF, persistència, importació de PDF repetit, exportació ZIP, restauració nova i compatibilitat amb ZIP antic. També s'executen les proves heretades del visor i repertoris.

**Esta PR no canvia la web pública fins que l'usuari accepte la fusió.** No neteges les dades del navegador ni desinstal·les la PWA.