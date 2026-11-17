# Partitures Festeres Web — W2.3.3 · Gir estable i reobertura neta

Esta actualització corregix les transicions de pantalla que, en girar un Android/iPhone amb una partitura oberta, mostraven moments en negre, canvis de grandària bruscos i la pàgina de Biblioteca intermitentment.

## 1. Gir horitzontal estable

- El visor utilitza **una sola estratègia de gir per sessió**: el bloqueig d'orientació nadiu del navegador si està permés, o el gir visual CSS de tota la interfície si no ho està.
- La transformació visual només s'aplica amb la classe `landscape-css-fallback` quan l'API de bloqueig no està disponible, falla o excedix un temps de resposta raonable. No se superposa a un bloqueig nadiu reeixit.
- En els girs successius es deixa estabilitzar el nou grandària del visor uns instants abans de tornar a renderitzar el PDF; es manté la imatge anterior estirada durant eixa transició en lloc de deixar zones buides.
- El zoom, la rotació automàtica del contingut, el botó Girar, les anotacions i els controls tàctils es mantenen independents del gir del dispositiu.

## 2. Sessió nova sense una partitura oberta

- **Recàrrega explícita** (actualitzar o lliscar cap avall): continua obrint la mateixa partitura i pàgina, com en W2.2.1.
- **Nova obertura de la web-app**: recupera la secció on estaves, però no obri el PDF. El visor comença tancat i no es carreguen innecessàriament el document PDF, la seua renderització i els seus controls. Si estaves en Biblioteca o Repertoris, tornes a eixa secció.
- Quan el navegador emet l'esdeveniment `pagehide`, es guarda primer la ubicació de la sessió per si estaves refrescant i **després** es tanquen les tasques de PDF.js, els temporitzadors, els listeners i les URLs temporals. Això no implica eliminar processos del sistema operatiu, que són responsabilitat de l'OS.
- Safari/iOS i alguns navegadors poden suspendre i recuperar la mateixa pàgina en lloc de crear-ne una de nova; l'app no pot distingir sempre de manera fiable un tancament total d'una suspensió breu. El comportament de nova obertura s'aplica quan es crea un nou document de navegació.

## Compatibilitat de les dades

- Cap canvi en les dades IndexedDB ni en el format ZIP; els PDF, les anotacions i les preferències guardades no es modifiquen.
- No cal reimportar les partitures i **no s'han d'esborrar les dades de l'app** per actualitzar.
- Ajustos i identificació de les còpies de seguretat: **W2.3.3**.

## Proves

Nova bateria automàtica Playwright amb sis girs seguits en un navegador tàctil, lectura i canvas estables, bloqueig nadiu simulat, bloqueig no disponible, recàrrega amb PDF recuperat, alliberament dels recursos en `pagehide`, nova navegació sense PDF i conservació de la biblioteca. Es mantenen les regressions de les fases anteriors.

**Pendent de validar en dispositius reals:** el comportament final quan Android o iOS canvien l'orientació, així com la manera concreta de suspendre o tancar completament la web-app en el sistema.
