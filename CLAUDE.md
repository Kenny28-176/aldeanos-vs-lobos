# Aldeanos vs Lobos — guía para desarrollar (y para asistentes de IA)

> Idioma base de la app, de los textos y de los comentarios: **español**. La app existe también en **inglés** (es una
> traducción: el español es la referencia y el respaldo).

## Qué es

Un **narrador automático** para juegos de roles ocultos y deducción social («encuentra al impostor»): una **tablet en
el centro de la mesa** habla y lleva todas las reglas, y **cada jugador usa su celular** para ver su carta y actuar en
secreto. Todo funciona en el navegador, sin instalar nada. Proyecto **libre (MIT), gratuito y sin ánimo de lucro**.

## Reglas de contenido (importante)

- **Todo el contenido debe ser original o tener una licencia compatible.** No añadas textos, imágenes, logotipos,
  nombres comerciales ni material escaneado de juegos o libros de terceros, ni cites páginas de reglamentos.
- Las frases del narrador (`src/data/narration.es.json`) y las guías de los roles (`src/data/roles.json`) se escriben
  **con palabras propias**.
- Las imágenes de `public/img/` deben ser propias o con licencia que permita redistribuirlas, y su origen se anota en
  `public/img/CREDITOS.md`. Pesan como máximo 512 px (`python tools/optimizarImagenes.py`).
- El nombre del proyecto es **«Aldeanos vs Lobos»** (en inglés, **«Villagers vs Wolves»**). No uses nombres de marcas de terceros en títulos, textos de la
  interfaz, documentación ni nombres de archivos.
- Nada de claves privadas ni datos personales en el repositorio. La `apiKey` web de Firebase es pública por diseño;
  lo que protege la base de datos son las **reglas** (`database.rules.json`) y las restricciones de la clave.

## Arquitectura

| Tema | Decisión |
|---|---|
| Dispositivo central | **Tablet** (Chrome). Ejecuta el motor (la «autoridad»), la voz y la música. Ligera, sin build. |
| Jugadores | Su celular (Android/iPhone), en el navegador: abren un enlace + código de sala. |
| Sincronización | **Firebase Realtime Database** (plan gratuito). Los celulares nunca calculan reglas. |
| Stack | JS modular (módulos ES) sin paso de compilación; pantallas con **Preact + htm** por CDN. |
| Voz y sonido | `speechSynthesis` en la tablet; efectos y música generados con Web Audio (sin archivos). |
| Persistencia | El estado completo de la partida vive en Firebase: si la tablet se recarga, continúa. |
| Idiomas | Ningún texto visible va escrito en el código: salen de diccionarios planos `src/i18n/{es,en}.json` (`ui.*` para las pantallas, `motor.*` para el motor), de `narration.<idioma>.json` (frases del narrador) y de `roles.<idioma>.json` (nombre y guía de cada rol; solo lo que cambia). El idioma de la sala es el de la tablet (`public.idioma`) y los celulares lo siguen. |

Reglas de oro:

- La **tablet es la autoridad**: lee `actions`, resuelve y escribe `views/{id}` y `public`. Un celular solo escucha
  **su** vista y la pública. Es un juego entre amigos: no se blinda contra quien abra las herramientas de desarrollo,
  pero la interfaz nunca debe mostrar nada ajeno.
- El motor es **puro**: `step(estado, acción) → { estado, eventos }`, con azar de semilla. Se prueba sin red.
- Los roles viven en **datos** (`roles.json`, `nightOrder.json`), no en `if`s dispersos: añadir un rol debe costar poco.

## Mapa del código

```
index.html, public/      portada y páginas: index, narrator, player, como-jugar, acerca (+ en/ las inglesas); estilos.css; img/; audio/
src/data/                roles.json, nightOrder.json, narration.es.json, roles.en.json, narration.en.json, mezclar.js (+ load.js)
src/i18n/                traducir.js (t, tn, plurales), idioma.js (idioma actual en el navegador), es.json, en.json
src/engine/              motor: game.js (máquina de estados), steps.js (cada paso), resolveNight.js, deaths.js,
                         victory.js, views.js (qué ve cada pantalla), mazo.js (asistente de mazo), bots.js, circle.js
src/net/                 sala.js (Firebase), tablet.js (controlador: relojes, voz, bots), firebaseConfig.js (tu servidor)
src/ui/                  narrator.js (tablet), player.js (celular), comun.js, cartas.js, escena.js, efectos.js, audio.js…
tests/                   pruebas del motor y simulador de partidas (node:test, sin dependencias)
tools/                   serve.js (servidor local), e2e*.js (Chrome sin cabeza), cdp.js, generarIconos.py…
docs/                    DISENO.md (reglas tal como las implementa el motor), ALOJAR_TU_COPIA.md
```

## Cómo se trabaja

```
npm test                       # pruebas del motor (incluye miles de partidas simuladas)
node tests/simulate.js 7 12    # una partida simulada narrada (semilla 7, 12 jugadores)
node tools/serve.js            # servidor local en http://localhost:8080/public/
node tools/e2e.js              # partida completa en Chrome con varios celulares (servidor en marcha)
```

- Después de tocar el motor o los textos: `npm test` (incluye las pruebas de idiomas: mismas claves y marcadores en `es` y
  `en`, y una partida entera en inglés sin claves sueltas). Después de tocar pantallas: una partida de `tools/e2e.js` y
  mirar las capturas (y `IDIOMA=en node tools/e2e-ensayo.js` si tocaste textos).
- **Cómo añadir un rol:** (1) entrada en `src/data/roles.json` (nombre, subtítulo, bando, copias, guía con palabras propias; ver el glosario de `docs/DISENO.md`);
  (2) uno o varios pasos en `src/engine/steps.js` y su sitio en `src/data/nightOrder.json`; (3) si causa o
  reacciona a muertes, `deaths.js`; si cambia quién gana, `victory.js`; (4) frases en `narration.es.json` y `narration.en.json`, nombre y guía en `roles.en.json`, y los textos de pantalla que
  añada en `src/i18n/es.json` y `en.json`;
  (5) una imagen propia en `public/img/roles/<id>.webp`; (6) pruebas en `tests/`. El simulador mezcla todos los
  roles implementados: sirve de red de seguridad.
- Imágenes: `npm run revisar:imagenes` comprueba que son del formato que dice su extensión, miden 512 px como máximo, pesan
  120 KB como máximo y tienen sus créditos; la release de GitHub no se publica si falla. Versiones: `npm run version:preparar -- x.y.z`.
- Los pasos nocturnos no deben delatar información por su duración ni por el sonido de los celulares.
- Antes de subir cambios: `npm test` en verde. Commits pequeños y con mensaje claro, en español.
