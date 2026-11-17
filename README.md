# Partitures Festeres Web — W2.3 · Text i agrupació d'eines d'anotació

La fase W2.3 continua l'adaptació del sistema d'anotacions d'Android a iPhone, iPad i ordinador, **sense modificar els arxius PDF** ni perdre les anotacions de W2.1/W2.2.

## Novetats

- **Text sobre la partitura:** toca **Anotar → Text i edició → Text**, marca el lloc del PDF i introduïx el text.
- **Edició de text:** permet fins a cinc línies, mida, color, negreta, subratllat i opacitat. S'utilitza un quadre d'edició amb botons Guardar i Cancel·lar.
- **Seleccionar i moure:** amb **Text i edició → Seleccionar** toca el text per a moure'l. Usa **Editar text** per a canviar-lo, o la goma per a esborrar-lo.
- **Desfer:** recupera la creació, els canvis de format i el moviment o l'esborrat del text (dins de la sessió).
- **Organització per grups:** tres controls inicials de tipus pètal, **Traços**, **Formes** i **Text i edició**, amb ferramentes contextuals. És el primer pas cap al rosetó i l'organització de l'app Android, que continua sent la referència principal. No és encara el rosetó complet.
- **Multiplataforma:** les anotacions de text es dibuixen sobre el PDF com SVG, guarden posicions relatives i acompanyen el zoom i la rotació.

## Compatibilitat i seguretat

- Conserva el format de document d'anotacions `version:1` i les anotacions de les fases anteriors; els nous objectes incorporen `tool:'text'`, opcions tipogràfiques i una coordenada d'ancoratge.
- Els PDF continuen sense modificacions i totes les anotacions seguixen guardant-se únicament en IndexedDB local. Les còpies ZIP les inclouen i es poden restaurar.
- El text s'insereix amb `textContent` en SVG, no com HTML executable; s'apliquen controls de llargària i format.
- La web continua recordant l'última pantalla, carpeta, repertori i PDF/pàgina després d'una recàrrega, com en W2.2.1. Per seguretat, no es recupera automàticament el mode d'edició després d'una recàrrega.
- **No hi ha sincronització amb Drive** ni entre dispositius en esta fase; mantín una còpia ZIP externa.

## Proves de verificació

Les proves automàtiques inclouen els tests previs de biblioteca, repertoires, Índex, visor i anotacions. La nova prova comprova text multilínia, color, grandària, negreta, subratllat, opacitat, seleccionar, moure, editar, desfer, eliminar, rotació, zoom, persistència i recuperació completa de ZIP sense alterar els bytes del PDF.

**Abans d'utilitzar-lo en una actuació, prova les noves ferramentes en el dispositiu real. No esborres les dades del navegador ni desinstal·les l'app sense una còpia.**

La fase s'entrega com a PR independent: no modifica la versió pública fins a fusionar-la.
