# Partitures Festeres Web — W1.3A

Rama de prueba. La web pública sigue intacta hasta que el usuario apruebe la Pull Request.

## Novedades
- Visor PDF con fondo blanco y barras neutras; evita las franjas granates hasta donde el sistema operativo lo permite.
- Favoritos, recientes (últimas 45 obras) y repertorios: crear, renombrar, borrar, añadir/quitar partituras y ordenarlas con flechas.
- Todos los datos permanecen en IndexedDB local y entran en las copias ZIP mediante las preferencias.
- No se cambian db.js, backup.js ni los PDF existentes. Se conservan los papeles.

## Pruebas
Una prueba automatizada comprueba importación, visualización PDF, tema claro del visor, favoritos, recientes, orden de repertorios, persistencia y preparación de copia ZIP.

## Pendiente
W1.3B incorporará metadatos y búsqueda avanzada. Safari iPhone/iPad necesita validación real de las barras del sistema.

No borrar los datos del navegador ni desinstalar la PWA. Conservar siempre copia ZIP.
