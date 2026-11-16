# Partitures Festeres Web — W1.2.1 (estabilización del visor)

**16 de noviembre de 2026.** Revisión correctiva tras las pruebas reales de la W1.2.

## Cambio principal

- Recuperado el visor PDF de la W1.1, que ya había funcionado para el usuario en Mac. Esta revisión **retira el visor experimental PDF.js W1.2** que podía fallar y dejar desactivados el zoom y los botones del visor.
- No hay botón «Preparar visor sense connexió». No se descarga ningún motor externo ni se requiere preparar archivos para abrir un PDF.
- Se conserva el visor PDF nativo del navegador con sus capacidades habituales de zoom y desplazamiento, y la navegación a la partitura anterior/siguiente.
- **Limitación explícita:** todavía NO incluye los controles avanzados propios de zoom persistente, giro manual de 90º y navegación individual entre páginas que pretendíamos ofrecer en la W1.2. Las capacidades de zoom y rotación dependen del visor de cada navegador. Son tareas pendientes para una implementación fiable y probada de la fase W1.2.
- `db.js`, `backup.js`, el formato de copia ZIP, los PDF en IndexedDB, la importación, las carpetas, los papeles y el Índex son idénticos a W1.1. Las preferencias de prueba que pudiera haber guardado W1.2 no se borran.
- No modifica la aplicación Android ni publica bibliotecas privadas.

## Instalación en GitHub Pages

1. **Antes de tocar nada**, exporta tu copia de seguridad ZIP en Ajustos (aunque no debería alterarse ningún dato local).
2. Descomprime el ZIP W1.2.1 y sube **su contenido**, no el ZIP, a `SantiMillaNavarro/Partitures-Festeres-Web` en rama `main`, raíz.
3. Reemplaza `app.js`, `styles.css`, `sw.js`, `README.md` y conserva el resto de archivos y carpetas del ZIP.
4. GitHub Pages seguirá sirviendo la misma URL. `viewer.js` de W1.2 puede permanecer en el repositorio sin efectos: esta versión no lo importa. Si quieres limpiar el repositorio, puedes eliminar ese archivo en otro commit; no es necesario para la corrección.
5. Tras el despliegue de Pages, cierra/reabre la aplicación y verifica que en Ajustos aparece **W1.2.1**. Mantén tus datos del sitio y no desinstales la PWA.
6. Abre varias partituras y verifica que recuperas el comportamiento anterior. No se requiere preparar el visor.

## Verificación del paquete

- `app.js` pasa comprobación sintáctica de Node.js.
- `sw.js` actualiza la versión de caché y evita recuperar la W1.2 antigua desde el service worker.
- `db.js` y `backup.js` tienen exactamente el mismo hash SHA-256 que los de la W1.1 validada.
- Se comprueba que `index.html`, `sw.js` y `app.js` no cargan `viewer.js`, ni PDF.js, ni recursos de terceros para representar PDF.

**La W1.2.1 prioriza estabilidad sobre funcionalidades avanzadas:** no afirmamos que el visor nativo permita todas las funciones de la aplicación Android. La adaptación final a Safari en iPhone queda por verificar en dispositivo real.
