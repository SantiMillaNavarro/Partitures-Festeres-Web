# Partitures Festeres Web — W1.1

**Fase W1.1: Gestión de biblioteca y copias de seguridad.** 16 de noviembre de 2026.

Aplicación PWA para iPhone, iPad, Mac y otros navegadores. Continúa el proyecto W1.0; **no modifica la aplicación Android**.

## Novedades de W1.1

- **Copia de seguridad completa de los datos disponibles en esta versión web:** todas las partituras PDF importadas, su organización en carpetas, rutas y fechas de incorporación, y las preferencias guardadas (por ejemplo, idioma y papel seleccionado). Se genera **un ZIP** con un manifiesto JSON y huellas SHA-256 de los PDF.
- **Restauración desde Ajustos > Còpies de seguretat:** el usuario puede **añadir/fusionar** sin borrar los demás PDF, o **sustituir** toda la biblioteca y recuperar las preferencias de la copia. Ambas opciones muestran sus consecuencias antes de proceder.
- **Protección contra copias dañadas:** se comprueban rutas, tamaño, cabecera PDF y SHA-256 antes de aplicar los cambios. La restauración prepara temporalmente todos los archivos y solo confirma los cambios mediante una única transacción de IndexedDB. Si falla esa transacción, la biblioteca anterior no se sustituye parcialmente.
- **Información de almacenamiento** en Ajustos: número y tamaño de los PDF, uso estimado de almacenamiento del origen y cuota indicada por el navegador (si están disponibles), con una advertencia explícita sobre la persistencia.
- **Opciones específicas para iPhone/iPad:** se prepara el ZIP y, desde un segundo toque, se ofrece «Guardar ZIP» o el diálogo de compartir/«Guardar en Archivos» cuando el navegador lo admite.
- Interfaz en **valenciano y castellano** y actualización del caché PWA para cargar los nuevos archivos.

**Alcance de la copia:** W1.1 aún no dispone de repertorios, anotaciones, metadatos avanzados o sincronización con Drive. Por tanto, el ZIP no puede incluir esos datos inexistentes. **No es un formato de copia de la app Android**. La compatibilidad con `.pfa` queda para fases posteriores.

## Actualizar la aplicación web que ya está publicada

Repositorio existente: `partitures-festeres-web`.

1. Descomprime el archivo ZIP del proyecto W1.1 en tu ordenador.
2. En GitHub, abre **tu repositorio actual**. No crees uno nuevo.
3. Sube a la **raíz** (rama `main`) **todos los archivos y carpetas del interior** del proyecto descomprimido, sustituyendo sus versiones anteriores: `index.html`, `app.js`, `db.js`, `backup.js` (nuevo), `styles.css`, `sw.js`, `manifest.webmanifest`, `assets/`, `vendor/` y este `README.md`.
4. Confirma los cambios (*Commit changes*). Conserva GitHub Pages en **Settings → Pages → Deploy from a branch → main → /(root)**.
5. Abre la URL habitual: https://santimillanavarro.github.io/partitures-festeres-web/ . No hay que cambiar la dirección de los usuarios ni reinstalar la app.
6. Si todavía ves W1.0, cierra y vuelve a abrir la PWA con Internet para permitir que se actualice su *service worker*. A veces hará falta volver a cargar la página. **No borres los datos del sitio ni desinstales la PWA.**

La base IndexedDB se actualiza internamente de esquema 1 a 2; se **conservan las partituras y ajustes que ya haya guardados** en ese mismo navegador, dispositivo, dirección web y contexto de instalación. Si está abierta en varias pestañas, cierra las demás antes de actualizar.

**No subas partituras ni ZIP de usuarios a GitHub.** El repositorio solo debe contener el código y los recursos públicos de la aplicación.

## Uso de la copia de seguridad

### Exportar

1. Abre Partitures Festeres Web → **Ajustos** → **Còpies de seguretat**.
2. Pulsa **Preparar còpia ZIP**. Espera a que aparezca **Còpia preparada**.
3. Pulsa **Guardar ZIP**. En iPhone, también puedes utilizar **Compartir / Guardar en Fitxers** si aparece; en el menú del sistema elige «Guardar en Archivos» y una carpeta fuera de la aplicación.
4. **Comprueba en Archivos/Finder que el ZIP existe.** Preparar una copia dentro de la app NO implica que se haya guardado fuera.

La copia debe conservarse en Archivos, iCloud Drive (opcional), un ordenador o un disco externo. **Nunca la publiques en un repositorio público de GitHub.**

### Restaurar

1. En **Ajustos → Còpies de seguretat**, elige **Restaurar còpia ZIP**.
2. Selecciona el ZIP generado por W1.1 y lee el recuento de PDF.
3. Selecciona una opción:
   - **Afegir a la biblioteca**: añade los PDF, sustituye solo los que tienen la misma ruta y **conserva** los demás PDF y los ajustes actuales.
   - **Substituir tota la biblioteca**: **elimina** los PDF que no existen en la copia y restaura los PDF y las preferencias de esa copia. Antes de hacerlo, exporta una copia de la biblioteca actual.
4. Espera a que finalice la comprobación de integridad. No cierres la aplicación durante este proceso.
5. Abre varios PDF y comprueba los papeles, el índice y el recuento de obras.

**Importante:** las copias W1.1 se restauran desde «Restaurar copia ZIP». El botón habitual «Importar PDF o ZIP» está pensado para bibliotecas ordinarias y no debe emplearse para este formato especial.

## Datos, límites y cautelas

- Las partituras y las copias **no se envían a nuestros servidores**; las bibliotecas se guardan en IndexedDB del propio dispositivo.
- IndexedDB es almacenamiento privado del navegador, y el sistema puede borrarlo en ciertas circunstancias. La copia externa es imprescindible.
- **Safari, Chrome y la PWA instalada pueden tener almacenes diferentes**. Instala primero la aplicación en iPhone y después importa o restaura desde la app instalada.
- El formato ZIP W1.1 guarda los PDF sin compresión adicional (muchos PDF ya están comprimidos) para reducir el trabajo de CPU. En bibliotecas muy grandes, crear o restaurar un único ZIP puede exigir **mucha memoria y espacio temporal**, especialmente en iPhone. La primera prueba en iPhone debe hacerse con una biblioteca pequeña. Si una biblioteca grande no puede exportarse en ese dispositivo, conserva los PDF originales y evita borrar nada.
- La restauración temporal puede necesitar espacio adicional del dispositivo para almacenar su contenido antes de aplicarlo.
- En esta fase se mantiene el límite **100 MB por PDF** heredado de W1.0. Para importar un ZIP de biblioteca convencional se mantiene el límite de **250 MB por archivo ZIP**; las copias W1.1 tienen un flujo de restauración independiente.
- La cuota mostrada por `navigator.storage.estimate()` es **estimada** y puede incluir otros datos del mismo origen; no corresponde al espacio libre total del iPhone.
- Es conveniente probar el modo avión tras el primer uso con Internet, pero **el comportamiento offline y la gestión de archivos en Safari iOS deben verificarse en un dispositivo real**.

## Resumen de pruebas realizadas para W1.1

- Sintaxis de `app.js`, `backup.js`, `db.js` y `sw.js` comprobada.
- Prueba automatizada de la interfaz y la lógica en Chromium **con una base de datos simulada**: ZIP de demostración → importación → exportación → comprobación del archivo ZIP → eliminación → restauración → fusión sin duplicados.
- Pruebas de rechazo de un PDF dañado, conservación de datos anteriores al producirse ese error, y distinción entre «Afegir» y «Substituir» y sus preferencias.
- Revisión estática de la migración IndexedDB (v1→v2) y de la lista de recursos del *service worker*.
- **Pendiente:** prueba completa con IndexedDB real, instalación PWA, descargas o compartición, y bibliotecas grandes en **Safari/iOS reales**. Las pruebas simuladas no sustituyen esas validaciones.

## Componentes y autoría

Código HTML, CSS y JavaScript propio. JSZip 3.10.1 incluido en `vendor/`, con su licencia original en `vendor/LICENCIA_JSZIP.txt`. Recursos visuales originales de Partitures Festeres Android, aportados por su autor. © SMN Systems.
