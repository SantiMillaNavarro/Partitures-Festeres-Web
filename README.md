# Partitures Festeres Web — W2.3.1 · Visor horitzontal per defecte

El visor de PDF es presenta per defecte **en horitzontal**, com en l'app Android. La resta de seccions (Biblioteca, Repertoris, Índex, Recents, Favorits, Ajustos) conserven l'orientació normal del dispositiu.

## Com funciona

- **Navegadors que ho permeten:** en obrir un PDF s'intenta bloquejar l'orientació de pantalla a `landscape` amb l'API oficial, i s'allibera el bloqueig en tancar el PDF.
- **Safari en iPhone/iPad:** iOS no permet el bloqueig d'orientació amb JavaScript. Quan la pantalla del dispositiu està en vertical, el visor complet (partitura i controls) es presenta girat 90° i ocupa tota la superfície. Gira físicament el dispositiu per llegir la partitura amb normalitat. Si el dispositiu ja està en horitzontal, es veu directament sense una rotació addicional.
- **Només en dispositius tàctils:** una finestra d'ordinador estreta no s'ha de girar artificialment.
- **Rotació manual del PDF:** el botó existent de girar la pàgina continua funcionant de manera independent de l'orientació del visor. Si un PDF està guardat amb les pàgines girades, es pot corregir amb eixe botó.
- **Gestos i anotacions:** les coordenades dels tocs es convertixen a les coordenades locals del visor per tal de conservar el pas de pàgina, el zoom, els dibuixos, les formes i el text en les posicions correctes.
- **Recarregar:** la recuperació de l'última partitura i pàgina continua activa, i el visor tornarà a presentar-se horitzontal.
- **Tancar:** l'app torna a la secció anterior sense forçar la Biblioteca a posar-se en horitzontal.

L'orientació preferida *no* es declara globalment en el manifest perquè això forçaria també la Biblioteca i els menús. El bloqueig només s'intenta quan es consulta una partitura.

## Compatibilitat i dades

No es canvien els PDF, les dades d'anotacions, els repertoris ni el format de la còpia ZIP. La versió d'Ajustos i l'etiqueta de còpia passen a **W2.3.1**.

## Proves

Comprovacions automàtiques en navegador amb pantalla mòbil tàctil vertical i horitzontal, transformació visual del visor, pulsació en els costats per a canviar de pàgina, traços i selecció amb coordenades correctes, zoom, rotació manual, recàrrega i retorn a Biblioteca. També passen les proves de regressió de totes les fases anteriors.

**Nota:** les proves automàtiques són sobre Chromium amb dispositiu tàctil simulat. Cal validar el comportament real en Safari instal·lat com a web-app d'iPhone/iPad, especialment amb el bloqueig de rotació d'iOS activat i desactivat. No esborres dades del navegador sense una còpia ZIP de la biblioteca.
