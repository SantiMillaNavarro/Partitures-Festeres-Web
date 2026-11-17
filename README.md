# Partitures Festeres Web — W2.1 · Primeres anotacions

La fase W2 inicia les anotacions sobre les partitures en el visor d'iPhone, iPad i ordinador, sense modificar els arxius PDF originals.

## Què es pot fer
- Toca **Anotar** al visor per a activar l'edició; toca **Acabar** per a tornar a navegar normalment.
- Traça línies amb el **Llapis** o usa el **Ressaltador** semitransparent. Tria un color de la paleta.
- **Desfer** l'últim traç o **Esborrar** els traços de la pàgina actual després de confirmar. Les altres pàgines no canvien.
- Els traços estan vinculats a una **partitura i pàgina**; es mantenen al canviar de pàgina, ampliar, girar o tornar a obrir el PDF.
- Els tocs durant el mode Anotar dibuixen; per a fer gestos de zoom o canvi de pàgina, finalitza l'edició. Els botons del visor continuen disponibles.

## Dades locals i còpies de seguretat
- Les anotacions es guarden en una taula local nova d'IndexedDB (actualització no destructiva de v2 a v3). No van a GitHub, Drive ni als PDF originals.
- El ZIP de còpia inclou cada document d'anotacions en un arxiu JSON verificat mitjançant SHA-256. El manifest manté `schemaVersion:1` amb el camp opcional `annotations` per a conservar compatibilitat amb les còpies antigues.
- Restaurar una còpia moderna recupera les anotacions; substituir amb una còpia antiga sense anotacions no les pot recuperar. Fusionar una còpia antiga conserva les anotacions locals.
- Esborrar una partitura elimina també les seues anotacions locals; buidar la biblioteca també les elimina. **Guarda una còpia ZIP fora de l'app**, especialment en iOS.
- L'emmagatzematge i la sincronització entre dispositius encara no estan disponibles en W2.1; estos passos arribaran en fases posteriors.

## Com provar
Importa un PDF de diverses pàgines, anota amb el llapis i el ressaltador, comprova que els traços no es desplacen amb la rotació o el zoom i que persisteixen en reobrir-lo. Crea una còpia ZIP, elimina un traç i restaura la còpia. Fes la prova en iPhone/iPad i en navegador d'escriptori, especialment amb Apple Pencil si en tens.

## Desplegament
La fase es prepara en una branca separada amb PR. La web pública no canvia fins que autoritzes la fusió. Les proves de Chromium i les proves de regressió de fases anteriors s'executen al PR.

**No esborres les dades del navegador ni desinstal·les l'app sense guardar abans una còpia.**
