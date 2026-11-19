# Versión completa (pago único, por hogar) — diseño y pasos para activarla

**Estado: estructura preparada y APAGADA** (`PREMIUM_ACTIVO=false` en `js/premium.js`). Con el interruptor apagado la app se comporta exactamente como siempre: nada se bloquea y no se ve ningún candado.

## Decisiones de Jorge (2026-11-19)
- **Una sola app** en Google Play, gratis al empezar; la versión completa se desbloquea con un **pago único (vitalicio)**.
- **Se compra por hogar**, no por cuenta de Google: una persona paga y los dos miembros del hogar quedan desbloqueados.
- **Precio:** oferta de lanzamiento **USD 4,99 durante 1 año** (para atraer usuarios y ganar reputación); al cumplirse el año pasa al precio final **USD 9,99**. Se decidió el 2026-11-19 (antes eran 6 meses). Usar los precios regionales de Play (precio por país ajustado al poder adquisitivo). El cambio de precio se hace en Play Console (los que ya compraron no se ven afectados). **Anotar un recordatorio con la fecha exacta: día de publicación + 12 meses.**
- **Gratis siempre:** Resumen, Libro, Compras, Calendario, videos de ayuda, Opciones, el respaldo/exportación y eliminar la cuenta.
- **De pago:** Año, Comparativas, Evolución de precios (incluidas las etiquetas ▲▼ al escribir), Metas y deudas (incluye gastos recurrentes), Tarjeta y fondos, y en Herramientas: Buscador, Ahorro en dólares, Comercios recordados, las 3 calculadoras e Importar gastos.
- **Por decidir:** si el botón ＋ de comprobantes y tickets (lectura por foto) queda gratis o de pago. Hoy queda gratis.

## Cómo está armado
- `js/premium.js`: `puedeUsar(clave)`, `hogarEsCompleto()`, la pantalla de bloqueo (`renderBloqueo`), las placas con candado de Herramientas y los textos. Lo que se bloquea se configura con `PREMIUM_FUNCIONES`, `PREMIUM_PAGINAS` y `PREMIUM_TARJETAS_HERR` (cambiar un elemento de esas listas basta para mover una función de gratis a pago).
- Enganches: `showTab()` (`js/plan.js`) muestra la pantalla de bloqueo en lugar de las pestañas de pago; el menú Más y las pestañas de escritorio muestran 🔒; `buildHerramientas()` cambia las tarjetas de pago por placas; `prPintarDelta()` oculta las etiquetas ▲▼.
- **El dato de la compra vive en el documento del hogar:** `hogares/{id}.premium = { activo: true, desde: 'AAAA-MM-DD', producto: 'libro_completo_hogar' }`. Lo leen los dos miembros porque ambos pueden leer el hogar; no está cifrado (no es información privada del libro).
- **Seguridad:** `firestore.rules` solo deja a un miembro unirse, salirse o guardar el bloque `e2e` del hogar. Un usuario **no puede** escribir `premium` desde la app; solo un servidor con permisos de administrador (Cloud Function) lo puede marcar.

## Cómo probarlo sin activarlo para todos
En el teléfono o navegador, `localStorage.setItem('lfh.premiumModo','gratis')` (simula un hogar sin compra), `'completa'` (simula uno que compró) o `'real'` (usa lo que diga el hogar); y `localStorage.removeItem('lfh.premiumModo')` para volver a lo normal. Después, recargar. Pruebas: `tests/calculos.test.js` (bloque «Versión completa») y `libro-app-shots\t_premium.js`.

## Lo que falta para cobrar (en este orden)
1. **Cuenta de Play** (USD 25), perfil de pagos del comerciante (confirmar que el país de Jorge puede recibir pagos de Google Play) y la prueba cerrada (12 testers, 14 días).
2. **Empaquetar la app** como TWA (PWABuilder/Bubblewrap) y publicarla **gratis** (una app publicada como gratis no puede pasar a pagada).
3. **Producto en Play Console:** producto único, no consumible, `libro_completo_hogar`, USD 4,99 con precios regionales.
4. **Compra dentro de la app:** Play Billing desde el TWA con la *Digital Goods API* (`getDigitalGoodsService('https://play.google.com/billing')` + Payment Request). Reemplaza `premiumDesbloquear()` (hoy solo avisa que no está disponible) y muestra el precio local en `premiumPrecio()`.
5. **Servidor de verificación:** Firebase **Cloud Function** (requiere plan Blaze) que recibe el token de compra, lo verifica con la *Google Play Developer API*, confirma la compra (acknowledge) y escribe `premium` en el hogar con Admin SDK. También debe quitarlo si hay reembolso. `premiumRestaurar()` ya relee el hogar para reflejarlo.
6. **Activar:** `PREMIUM_ACTIVO=true`, subir `APP_VERSION`/`NOVEDADES`, regenerar la guía y la ficha de Play (decir «pago único, sin mensualidades, sin publicidad, vale para todo el hogar»), actualizar la política de privacidad y el formulario de seguridad de datos, y agregar «Restaurar compra» si hace falta.
7. Probar con una cuenta de prueba de licencia de Play antes de abrir al público.

## Advertencias
- Mientras no exista el servidor de verificación, ocultar pantallas **no es una protección real**: la app es una página pública (GitHub Pages) y el código es visible. Es aceptable para empezar, pero no es seguridad.
- Si el servidor (Firebase) algún día cuesta más de lo que entra, hay que revisarlo: el pago único no cubre costos recurrentes de un uso muy grande.
