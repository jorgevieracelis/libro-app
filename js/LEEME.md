# Carpeta js/ — código de la app

`index.html` carga estos archivos **en este orden** (comparten las mismas variables; no son módulos independientes):

1. `datos.js` — constantes, utilidades, modelo de datos, cálculos básicos y fusión de cambios de la pareja
2. `guardado.js` — estado, conexión y guardado en Firestore
3. `consejos.js` — cálculos en pantalla y consejos del mes
4. `vistas.js` — filas editables y vistas principales
5. `compras-calendario.js` — compras del súper, versículo del día y calendario
6. `plan.js` — presupuesto, deudas, metas, repetidos, vista anual y reportes
7. `respaldo.js` — respaldo e importación, ahorro en dólares y papelera
8. `ventanas-acceso.js` — novedades (`APP_VERSION`, `NOVEDADES`), ventanas, instalación, ingreso y registro
9. `bienvenida.js` — bienvenida de 3 pantallas y estados vacíos (`estadoVacio`)
9b. `seguridad.js` — bloqueo por claves erróneas, verificación de correo, borrar cuenta y bloqueo de la app
10. `arranque.js` — arranque de Firebase y de la app

Si agregas o quitas un archivo: actualiza las etiquetas `<script>` de `index.html`, la lista `SHELL` de `service-worker.js` y sube `CACHE_NAME`.
Para cada mejora: sube `APP_VERSION`/`NOVEDADES` (en `ventanas-acceso.js`) y `CACHE_NAME`.
