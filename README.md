# Partitures Festeres Web — W2.2 · Ferramentes d'anotació avançades

Esta fase amplia el sistema d'anotacions W2.1 i manté les seues partitures, preferències, anotacions i còpies ZIP.

## Novetats del visor

- **Llapis i ressaltador:** ara tenen cinc nivells de grossor independents; els traços antics mantenen el seu grossor.
- **Goma:** toca un traç per a esborrar només eixe element, sense afectar la resta.
- **Formes geomètriques:** línia recta, rectangle, cercle/el·lipse i fletxa, arrossegant des de l'inici fins al final.
- **Seleccionar:** toca una anotació i arrossega-la a una altra posició; la selecció es mostra amb un contorn ressaltat. Es pot esborrar amb el botó **Esborrar seleccionada**.
- **Desfer:** recupera els últims canvis de la pàgina, inclòs el moviment i l'esborrat, en una sessió d'edició; continua permetent llevar l'últim traç després de reobrir.
- **Mòbils:** les ferramentes estan en una fila amb desplaçament horitzontal; els colors, el grossor i les accions es mostren baix.
- **Navegació:** en mode Anotar es dibuixa o edita; fes **Acabar** per a recuperar els gestos normals de zoom i navegació.

## Dades i compatibilitat

- El PDF original no es modifica. Tots els elements d'anotació utilitzen coordenades de pàgina independents del zoom i de la rotació.
- Es conserva el format d'anotacions `version:1` de W2.1, ampliat amb quatre tipus de forma opcionals. No hi ha migració de la biblioteca ni d'anotacions antigues.
- Les anotacions es guarden automàticament en IndexedDB local. Les còpies ZIP mantenen el format existent, incorporen els nous tipus d'anotació i permeten recuperar-los.
- Sense sincronització entre dispositius en esta fase. Conserva una còpia ZIP fora de l'app.

## Proves

Les proves automàtiques cobrixen retrocompatibilitat de les anotacions, geometria, selecció, moviment limitat a la pàgina, grossors, goma, historial de desfer, rotació, zoom, multipàgina, persistència, integritat dels PDF i còpia/restauració ZIP. A més, es passen les comprovacions de les fases prèvies.

La implementació es prepara en una branca independent i **no apareixerà en la web pública fins a fusionar el PR**. Abans d'emprar-la en actuacions, prova-la en l'iPhone/iPad i amb els PDF que utilitzes normalment.

**No esborres la informació del navegador ni desinstal·les l'app sense guardar abans una còpia ZIP.**
