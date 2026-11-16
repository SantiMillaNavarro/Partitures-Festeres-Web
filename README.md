# Partitures Festeres Web — W1.2

**Fase W1.2: visor avançat de partitures** · 16 de noviembre de 2026.

La aplicación sigue siendo una **PWA para iPhone, iPad, Mac y otros navegadores**, y conserva la biblioteca, las copias de seguridad y la gestión del almacenamiento de W1.1. **No modifica Partitures Festeres Android**.

## Novedades de esta versión

- Visor de una sola página PDF, con fondo sin márgenes superfluos y controles adaptados a pantallas pequeñas.
- Navegación **página anterior/siguiente** dentro de cada partitura, independiente de los botones **obra anterior/siguiente**.
- **Zoom** de 50 % a 300 % respecto al ajuste base, **ajustar a anchura** y **ajustar página completa**.
- **Rotación manual de 90°**, sin obligar al dispositivo a girar. Adaptación a cambios de orientación y tamaño de ventana.
- **Recuerda por cada partitura** el zoom, la orientación, el modo de ajuste y la última página consultada. Estas preferencias se guardan en la base existente y se incluyen en las copias ZIP de W1.1.
- **Modo sin barras** para aprovechar la pantalla y recuperar los controles fácilmente.
- Gestos horizontales para cambiar de página cuando el documento no está ampliado horizontalmente, evitando interferir con su desplazamiento.
- Superficie de visualización reservada para incorporar anotaciones en una fase posterior.
- Alternativa de emergencia: si el visor avanzado falla, se abre el visor PDF original del navegador. También se conserva «Abrir en otro visor».
- Panel «Visor de partitures» dentro de Ajustes para comprobar/preparar los recursos del visor.

## Una preparación inicial necesaria para el visor avanzado

La biblioteca y los PDF privados **continúan guardándose en IndexedDB**, sin enviarse a ningún servidor. Para representar las páginas con precisión, el visor usa la biblioteca de código abierto **Mozilla PDF.js 4.10.38, compilación legacy**, bajo licencia Apache-2.0. Es una versión posterior a la corrección de CVE-2024-4367, y adicionalmente se configura `isEvalSupported: false`.

**Importante:** por ahora no incluimos los archivos grandes de PDF.js en el ZIP del proyecto. La **primera vez que se prepara el visor con conexión**, la web descarga dos archivos JavaScript **de versión fija** desde `cdn.jsdelivr.net` y los guarda en CacheStorage del dispositivo. La biblioteca puede después reutilizarlos sin red, **si Safari conserva ese almacenamiento**. La carga de estos recursos no sube ninguna partitura al CDN, aunque al descargar la biblioteca se establece una conexión con dicho proveedor de archivos. Esto es una **limitación del prototipo W1.2**, que conviene eliminar incorporando PDF.js localmente en una futura revisión.

Si la conexión inicial falla, el visor avanzado se sustituye por el PDF nativo del navegador; no se borran ni modifican partituras. Para preparar el visor con Internet disponible: **Ajustos → Visor de partitures → Preparar visor sense connexió**. Cuando confirme que está preparado, abre una partitura y prueba el modo avión.

El soporte de PDF.js en Safari depende de la versión de iOS, las fuentes del PDF y la memoria disponible. La **apertura real, el zoom y el comportamiento sin conexión en iPhone/iPad todavía están pendientes de validación**. En una biblioteca extensa, el visor representa una sola página cada vez para limitar el uso de memoria.

## Publicar la actualización en GitHub Pages

Repositorio actual: `https://github.com/SantiMillaNavarro/Partitures-Festeres-Web`

1. Descomprime el ZIP **PartituresFesteres_Web_W1_2_VISOR_AVANZADO.zip**.
2. En el repositorio de GitHub, sobre la rama `main`, sube a la **raíz** todo el contenido descomprimido, **reemplazando** los archivos antiguos (especialmente `app.js`, `styles.css`, `sw.js` y `README.md`) e **incluyendo `viewer.js` como archivo nuevo**.
3. Conserva `db.js`, `backup.js`, la carpeta `assets/`, `vendor/` y los demás archivos tal y como vienen en el ZIP. No subas PDF privados ni ZIP de bibliotecas de músicos.
4. Confirma los cambios con «Commit changes». GitHub Pages sigue configurado en `main / (root)`. No es necesario compilar ni cambiar la URL.
5. Abre `https://santimillanavarro.github.io/partitures-festeres-web/` y comprueba en **Ajustos** que se indica **W1.2**.
6. Si aún ves W1.1, cierra y vuelve a abrir la web/PWA con Internet; puede que sea necesario recargarla para que el nuevo *service worker* asuma el control. **No desinstales la app ni borres los datos del sitio**.

La base IndexedDB y su versión de esquema **no cambian** de W1.1 a W1.2. Las partituras que habías importado deben mantenerse disponibles en el mismo navegador y contexto de instalación.

## Prueba sugerida en Mac antes de probar en iPhone

1. Abre una partitura que contenga **dos o más páginas**. Comprueba que el contador indica «Pàgina 1 / N» y que los botones de navegación cambian de página.
2. Cambia el zoom, gira 90°, pasa a otra página, cierra el visor y vuelve a abrir **la misma partitura**. Debe recordar los ajustes.
3. Utiliza «ajustar página completa» y «ajustar a anchura». Comprueba que no muestra dos páginas juntas.
4. Pulsa el botón de ocultar controles y comprueba que puedes recuperarlos.
5. Abre otra partitura mediante los botones «Anterior / Següent» inferiores. Su zoom debe ser independiente.
6. En Ajustes, prepara el visor sin conexión; después prueba una partitura con Internet desconectado, **sin borrar las cachés del navegador**.
7. Repite una exportación ZIP W1.1 y, si es posible, revisa que la copia sigue conteniendo los PDF. **No pruebes «sustituir biblioteca» sin guardar previamente una copia fuera de la aplicación**.

## Prueba prioritaria en iPhone o iPad

Instala primero la PWA desde Safari, impórtale algunas partituras y abre una de varias páginas **con Internet**. Prueba zoom, giro, página siguiente, modo sin barras y cambio de orientación. A continuación, cierra la app, activa el modo avión y vuelve a abrir la misma partitura. Si falla, anota si aparece el visor alternativo y el mensaje exacto. Repite la prueba en iPad horizontal si está disponible.

## Verificación realizada en el entorno de desarrollo

- `node --check` de `app.js`, `viewer.js`, `db.js`, `backup.js` y `sw.js`.
- Pruebas unitarias del controlador del visor **con páginas y canvas simulados**: dibujado de una página, avance hasta el límite, zoom, rotación, ajuste, persistencia y cierre.
- Comparación SHA-256: `db.js` y `backup.js` son **idénticos** a los de W1.1.
- Revisión de que `sw.js` almacena el nuevo `viewer.js` y se actualiza a la caché de W1.2; PDF.js usa su propia caché.
- **No fue posible ejecutar la interfaz completa en el navegador automatizado de este entorno ni descargar los scripts reales de PDF.js**. Por ello, **no afirmamos que esté validado en Safari/iOS**; la prueba del dispositivo será decisiva.

## Limitaciones pendientes

No incluye aún repertorios, anotaciones compartidas `.pfa`, metadatos avanzados, afinador, metrónomo, escáner ni conexión a Drive. Las copias de W1.1 incluyen las preferencias de visualización, pero siguen sin ser compatibles con las copias de la app Android. El navegador puede eliminar IndexedDB o CacheStorage cuando necesite espacio; guarda siempre una copia ZIP externa.

La incorporación definitiva de PDF.js dentro del propio repositorio —sin CDN de primera ejecución— y las pruebas reales en Safari serán prioridades antes de una publicación general para músicos.

**Licencias:** recursos originales de Partitures Festeres, © SMN Systems. JSZip 3.10.1 incluido en `vendor/` con su licencia. Mozilla PDF.js 4.10.38 (Apache-2.0) se descarga bajo demanda desde un tercero; documentación: https://mozilla.github.io/pdf.js/ .
