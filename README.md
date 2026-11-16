# Partitures Festeres Web — Fase W1.0 (prototipo)

**Versión web independiente de Partitures Festeres (Android 1.11.15).**
Primera prueba para iPhone, iPad y navegadores de escritorio.

**Importante: no es el APK convertido.** Es una aplicación web nueva, hecha en HTML/CSS/JavaScript, con los recursos visuales originales de Partitures Festeres. La aplicación Android no se modifica.

## Qué incluye esta primera versión

- Instalación desde Safari en la pantalla de inicio como aplicación web.
- Interfaz en valenciano (predeterminado) y castellano; elección inicial de idioma.
- Importación de uno o varios PDF sueltos o de un archivo ZIP con carpetas y PDF.
- Navegación por carpetas reales, con acceso a la raíz.
- Reconocimiento de carpetas como `1er`, `2n`, `3r`… para seleccionar el papel cuando existan en la raíz del ZIP.
- Índice de todas las obras, agrupadas por carpetas; búsqueda por nombres o rutas.
- Apertura de PDF y navegación anterior/siguiente entre obras. La representación del PDF depende del visor integrado en Safari o en el navegador; se ofrece una alternativa para abrirlo externamente.
- Guardado local de los PDF mediante IndexedDB; aplicación sin conexión mediante Service Worker tras completar la primera instalación.
- Eliminación local individual o de toda la biblioteca, siempre con confirmación.
- Recursos originales: icono del saxofón y fondo de pergamino.

## Lo que AÚN NO incluye

- Sincronización directa con Google Drive ni archivos `.pfa` compartidos.
- Anotaciones, escáner, metrónomo, afinador, favoritos o repertorios.
- Visor PDF propio con giro y zoom persistente; durante W1 se usa el del navegador.
- Garantías de persistencia equivalentes a una aplicación nativa. iOS puede borrar datos web ante falta de espacio o por decisiones del sistema.

## Publicar en GitHub Pages (sin compilación)

1. Crea un **repositorio público independiente**, por ejemplo `partitures-festeres-web`, desde GitHub o GitHub Desktop.
2. Extrae este ZIP en tu ordenador.
3. Copia **el contenido interior** de la carpeta `PartituresFesteres_Web_W1/` a la **raíz del repositorio**: `index.html`, `app.js`, `db.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `assets/`, `vendor/` y este `README.md`.
4. Publica los cambios en la rama `main` (commit y push).
5. Abre el repositorio en GitHub → **Settings → Pages**. En **Build and deployment**, selecciona **Deploy from a branch**, rama `main`, carpeta `/(root)`, y guarda.
6. Abre la dirección HTTPS que muestre Pages, normalmente `https://TU_USUARIO.github.io/partitures-festeres-web/`.
7. No necesitas `npm`, Android Studio, APK ni AAB. El sitio debe publicarse por HTTPS para disponer de Service Worker e instalación web.

El código se ha escrito con rutas relativas (`./`); funciona en la subcarpeta de GitHub Pages sin cambiar ninguna dirección del proyecto.

**Privacidad:** GitHub Pages hará públicos estos archivos de código y diseño. **No subas los PDF reales de ningún músico al repositorio**. Los PDF se importan después, desde cada dispositivo, y se guardan en su almacenamiento local.

## Instalar en el iPhone / iPad

1. Abre la dirección de GitHub Pages en **Safari**, con conexión a Internet.
2. Toca **Compartir → Añadir a pantalla de inicio** y deja activado **Abrir como app**.
3. Abre el icono **Partitures Festeres** instalado, elige idioma y **importa los PDF o un ZIP desde allí**.
4. Prueba la navegación y abre varios PDF. A continuación, cierra la app, activa el modo avión, vuelve a abrirla e intenta leer las mismas partituras.
5. Conserva el ZIP original como copia de seguridad fuera de la aplicación. Repite la importación si iOS llega a vaciar los datos locales.

**Importante para iOS:** el almacén de una web abierta en Safari y el de la misma web instalada en la pantalla de inicio pueden ser independientes. Por ello, **instala la app antes de importar la biblioteca**, y realiza las importaciones dentro de la app instalada.

## Cómo preparar un ZIP de partituras

Ejemplo:

```
Partitures/
├── 1er/
│   ├── Pasdobles/
│   │   └── Obra 1.pdf
│   └── Marxes cristianes/
│       └── Obra 2.pdf
└── 2n/
    └── Pasdobles/
        └── Obra 1 (segon).pdf
```

La carpeta contenedora llamada `Partitures/` se omite automáticamente; las carpetas interiores se conservan. También se pueden importar ZIP sin carpetas `1er` y `2n`, o PDF sueltos.

Límites conservadores **para este prototipo**: ZIP de hasta 250 MB, PDF individual de hasta 100 MB. Los ZIP demasiado grandes pueden requerir dividirse en varios archivos; se pueden importar sucesivamente. Un PDF importado de nuevo en la misma ruta sustituye al anterior.

## Test en un ordenador antes de publicar

No abras `index.html` con doble clic: la importación puede funcionar, pero Service Worker, módulos JavaScript y algunas funciones de IndexedDB no se comportan igual bajo `file://`.

Si tienes Python:

```
cd PartituresFesteres_Web_W1
python -m http.server 8000
```

Abre `http://localhost:8000` en tu navegador. En el iPhone se necesita GitHub Pages u otro alojamiento HTTPS.

## Comprobaciones de esta entrega

- Sintaxis JavaScript comprobada para `app.js`, `db.js` y `sw.js`.
- Prueba de interfaz en Chromium con almacenamiento simulado: inicio, elección de idioma, importación de un ZIP con `1er/2n`, navegación por carpetas, apertura del visor, índice, cambio de papel y ajustes (sin errores JS detectados).
- Comprobación de recursos locales incluidos en el proyecto y manifiesto PWA.

**Pendiente:** probar IndexedDB y Service Worker en un sitio HTTPS real e investigar la visualización del PDF en Safari iOS/iPadOS. No está todavía validada la experiencia offline en un iPhone real.

## Licencias y autoría

Los recursos visuales se recuperaron del proyecto Android aportado por el autor de Partitures Festeres. El código del prototipo es nuevo.
Se distribuye JSZip 3.10.1 para importar los archivos ZIP, con su licencia conservada en `vendor/LICENCIA_JSZIP.txt`. JSZip se distribuye bajo MIT/GPL (se utiliza conforme a la licencia MIT).

© SMN Systems. Fase W1.0, noviembre de 2026.
