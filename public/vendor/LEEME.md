# Bibliotecas de terceros

Estos archivos **no son código del proyecto**: son copias, sin modificar (salvo lo indicado), de las bibliotecas que usa
la app. Se guardan aquí para que el juego no dependa de ningún CDN y para no enviar la dirección IP de los jugadores a
servicios externos. Cada biblioteca conserva su licencia, que está junto a sus archivos.

| Biblioteca | Versión | Licencia |
|---|---|---|
| Firebase JS SDK (app + realtime database) | 13.0.0 | Apache-2.0 |
| htm + Preact (versión «standalone») | 3.1.1 | Apache-2.0 (htm) y MIT (Preact) |
| qrcode-generator | 1.4.4 | MIT |
| Cinzel e IM Fell English (Google Fonts) | v26 / v14 | SIL OFL 1.1 |

- `vendor.json` anota de dónde sale cada archivo y su huella SHA-256 (`tests/vendor.test.js` la comprueba).
- Cambio respecto al original: en `firebase-database.js` la importación de `firebase-app.js` apunta al archivo local.
- **Para actualizar:** cambia la versión en `tools/vendor.js`, ejecuta `node tools/vendor.js`, prueba (`npm test` y
  `node tools/e2e.js`) y sube el resultado. `node tools/vendor.js --comprobar` avisa de versiones nuevas.
