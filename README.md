# Partitures Festeres Web — W1.3C · Índex organitzat

Esta fase amplia l’**Índex** de la biblioteca local amb controls opcionals, sense alterar les partitures ni la resta de funcions.

## Novetats

- **Agrupar per** carpeta (com fins ara), compositor/autoria, tipus de composició o any.
- **Ordenar obres per** títol, compositor, any o carpeta/ruta, amb criteris estables en cas d’empat.
- Plegar/desplegar cada grup, o tots alhora, per a consultar biblioteques grans amb més comoditat.
- Cada grup mostra el nombre d’obres; el resum indica quantes obres coincidixen amb la busca i quants grups hi ha.
- Els compositors i tipus escrits amb accents o majúscules diferents s’agrupen conjuntament. Les obres sense metadades apareixen en **Sense dades** i les de l’arrel en **Sense carpeta**.
- El paper triat (1er, 2n, etc.) continua delimitant l’Índex; la busca normal i avançada continua funcionant dins de totes les agrupacions.
- Es recorden l’agrupació i l’ordenació triades en les preferències locals d’este dispositiu.

## Seguretat i compatibilitat

Les metadades continuen sent opcionals. No hi ha migració de dades ni modificacions dels PDF, de la biblioteca, dels repertoris, del visor, de l'IndexedDB de partitures o del format de les còpies ZIP. L’Índex només consulta i presenta la informació local.

La implementació es prova en una branca separada; **la web pública no canvia fins a fusionar el PR amb main**.

## Proves

La nova prova Playwright verifica carpetes i papers, compositors amb accents, tipus, anys, obres sense metadades, ordenació, grups plegables, busca normal i avançada i persistència de preferències. Les proves de fases anteriors continuen executant-se en els PR.

No esborres les dades del navegador ni desinstal·les l’aplicació web sense guardar primer una còpia ZIP.
