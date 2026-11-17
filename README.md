# Partitures Festeres Web — W2.3.4 · Bloqueig horitzontal fix del visor

Esta fase respon a una petició sobre el comportament d'Android: **en obrir una partitura, el visor ha d'entrar en horitzontal i romandre fix**, sense reaccionar als sensors de gir mentre es consulta el PDF. En tancar-lo, la resta de l'app ha de recuperar la seua orientació habitual.

## Comportament per plataforma

- **Android / navegadors compatibles:** el visor prova d'entrar en pantalla completa en el mateix gest d'obrir la partitura (quan és necessari per al navegador) i després sol·licita `screen.orientation.lock('landscape-primary')`. El valor `landscape-primary` impedix, si el navegador accepta el bloqueig, tant els canvis a vertical com els girs 180° cap a l'altra posició horitzontal. En eixir del PDF, s'allibera el bloqueig i la pantalla completa sol·licitada.
- **Safari en iPhone i iPad:** no admet este bloqueig nadiu. El visor manté la presentació horitzontal visual de W2.3.3, però **no és possible garantir que el sistema iOS deixe de girar**; eixa limitació no es pot eliminar únicament amb HTML/JavaScript.
- **Navegador que rebutja pantalla completa o bloqueig:** continua funcionant la presentació horitzontal CSS sense destruir les partitures ni fer canvis a la Biblioteca.
- **Biblioteca, Repertoris, Índex i Ajustos:** continuen amb orientació lliure. No s'afegix `"orientation":"landscape"` al manifest global per a no forçar tota l'aplicació a horitzontal.

El bloqueig només depén del navegador, de les polítiques de pantalla completa i del sistema operatiu. Per això és important provar-ho en Chrome Android instal·lat com a PWA i no confondre'l amb una pestanya ordinària de navegador.

## Conservació de la feina feta

- Continua l'orientació **automàtica del contingut PDF** de W2.3.2, independent del bloqueig de la pantalla.
- Es mantenen el zoom, el botó de gir manual del PDF, els gestos, les anotacions, l'última pantalla de Biblioteca o Repertoris i el tancament net del visor.
- No es modifiquen PDFs, anotacions, IndexedDB ni format ZIP. La versió visible a Ajustos i a les còpies és **W2.3.4**.

## Verificació

Les proves automàtiques incorporen un navegador que exigix pantalla completa per a autoritzar `landscape-primary`, comproven l'ordre de la petició, la inexistència de gir CSS simultani i l'alliberament del bloqueig i pantalla completa en tancar el visor. Es mantenen els tests de les fases anteriors.

**Validació real pendent:** confirmar en el dispositiu Android que el navegador concedix el bloqueig. Safari d'iOS només disposa del mode de presentació horitzontal simulat, sense capacitat de bloqueig físic.
