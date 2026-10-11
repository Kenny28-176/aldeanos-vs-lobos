# 🐺 Aldeanos vs Lobos

[![CI](https://github.com/Kenny28-176/aldeanos-vs-lobos/actions/workflows/ci.yml/badge.svg)](https://github.com/Kenny28-176/aldeanos-vs-lobos/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Kenny28-176/aldeanos-vs-lobos/actions/workflows/codeql.yml/badge.svg)](https://github.com/Kenny28-176/aldeanos-vs-lobos/actions/workflows/codeql.yml)

**Un narrador automático para juegos de roles ocultos** (el tipo de juego de «encuentra al impostor»): una **tablet en el centro de la mesa** cuenta la historia, lleva el tiempo y aplica las reglas, y **cada jugador usa su celular** para ver su carta secreta y hacer sus acciones en silencio.

Nadie tiene que hacer de narrador, así que **todos juegan**. No hay que instalar nada: funciona en el navegador, en Android y en iPhone.

> Proyecto **libre, gratuito y sin ánimo de lucro** bajo licencia [MIT](LICENSE). No está afiliado a ningún editor de juegos ni incluye material de ninguno. Lee el [aviso legal](AVISO_LEGAL.md).

> 🌐 **English:** the app is available in Spanish and English. Read this README in English: [README.en.md](README.en.md).

**▶ Probarlo:** <https://kenny28-176.github.io/aldeanos-vs-lobos/> (lee antes [Servidor y límites](#servidor-y-límites)). In English: <https://kenny28-176.github.io/aldeanos-vs-lobos/public/en/index.html>.

---

## Índice

- [El juego en un minuto](#el-juego-en-un-minuto)
- [Qué necesitas](#qué-necesitas)
- [Cómo se juega una partida](#cómo-se-juega-una-partida)
- [Idiomas, accesibilidad y sin conexión](#idiomas-accesibilidad-y-sin-conexión)
- [Roles](#roles)
- [Servidor y límites](#servidor-y-límites)
- [Montar tu propia copia](#montar-tu-propia-copia)
- [Desarrollo](#desarrollo)
- [Preguntas frecuentes](#preguntas-frecuentes)
- [Estado y hoja de ruta](#estado-y-hoja-de-ruta)
- [Contribuir](#contribuir)
- [Licencia, créditos y aviso legal](#licencia-créditos-y-aviso-legal)

---

## El juego en un minuto

En la aldea viven aldeanos… pero entre ellos se esconden unos **lobos** disfrazados. Los lobos saben quiénes son; los aldeanos no.

- **De noche**, todos cierran los ojos. Los lobos eligen en secreto a una víctima, y otros roles usan sus poderes (investigar, proteger, curar, envenenar…).
- **De día**, la aldea descubre quién ha caído, debate en voz alta y **vota a quién eliminar**.
- Los **aldeanos** ganan si eliminan a todos los lobos; los **lobos** ganan si acaban con los aldeanos. Hay además roles con objetivos propios (enamorados, un flautista, un ángel…).

Mentir, fingir y desconfiar forman parte del juego. Enseñar la pantalla, no.

## Qué necesitas

| | |
|---|---|
| 🌕 **Una tablet o portátil** | En el centro de la mesa. Es el narrador: habla, lleva el tiempo y las reglas. Mejor con Chrome y el volumen alto. |
| 📱 **Un celular por jugador** | Android o iPhone, con cualquier navegador moderno. Ahí ves tu carta y haces tus acciones. |
| 📶 **Internet** | En todos los dispositivos (wifi o datos). Si falla el wifi, sirve compartir datos desde un celular. |
| 👥 **De 3 a 42 jugadores** | Funciona muy bien entre 4 y 20. Para la primera partida, 6–10 con el mazo «Sencillo». |

No hacen falta cartas físicas: la app reparte una carta secreta al azar a cada jugador.

## Cómo se juega una partida

1. **Tablet:** abre la web, pulsa **Soy el narrador** y **Crear sala nueva**. Aparece un código de 4 letras y un QR.
2. **Celulares:** cada jugador escanea el QR (o abre la web, pulsa **Soy jugador** y escribe el código) y pone su nombre.
3. **Tablet — el mazo:** pulsa **✨ Sugerir mazo** y la app propone uno equilibrado según cuántos sois (niveles *Sencillo*, *Equilibrado*, *Avanzado* o *Al azar*), o monta el tuyo carta a carta. Revisa los tiempos.
4. **Empezar la partida.** Cada celular recibe una **carta secreta al azar**: tócala para verla (que nadie mire), lee qué tienes que hacer y pulsa **Listo**.
5. **Noche:** la tablet anuncia que cae la noche y llama a los roles uno por uno. Cuando te toca, tu celular se ilumina; si no, ves una pantalla oscura «Noche…» (hazlo igual de serio estés despierto o no: nadie debe poder deducir quién actúa).
6. **Día:** la tablet cuenta quién ha muerto (y revela su carta), hay debate y se vota en los celulares. Los votos se revelan todos a la vez. Y vuelve la noche, hasta que gane un bando.

Detalles que ayudan a que la partida fluya:

- **✓ Listo** en cada acción: en cuanto todos los que actúan lo pulsan, el paso termina sin esperar al reloj. En el debate, si el 75 % de los vivos pulsa **Pasar a la votación**, se vota ya. En la votación se puede **abstener**.
- **Ver mi carta** (en el celular) muestra tu carta, tu guía y lo que sabes en secreto; se oculta con un toque. **📖** muestra las cartas que hay en el mazo.
- **⚙** en la tablet: pausar, dar +30 s, saltar un paso, deshacer, repetir la última frase, elegir la voz, el sonido, el idioma y la pantalla (texto grande, contraste alto…).
- **Los celulares nunca suenan ni vibran de noche** (delataría a quien está despierto).
- Si la tablet se recarga o se queda sin batería, la partida **continúa donde estaba** (el estado se guarda en el servidor).
- **Modo ensayo:** en la sala, **🤖 Añadir bot** crea jugadores falsos que deciden solos, para probar el flujo sin gente.

La guía para quien nunca ha jugado está en la propia app: [`public/como-jugar.html`](public/como-jugar.html).

## Idiomas, accesibilidad y sin conexión

- **Idiomas:** español e inglés. La tablet elige el idioma (selector en la portada y en ⚙, o `?lang=en` en el enlace) y los
  celulares lo siguen solos; la voz del narrador cambia con él. Añadir otro idioma son archivos de texto: mira
  [`CONTRIBUTING.md`](CONTRIBUTING.md#traducciones).
- **Accesibilidad:** en ⚙ (tablet) y en el celular puedes elegir el **tamaño del texto** (normal, grande, enorme), el
  **contraste alto** y **menos movimiento**; la app respeta además lo que pida tu sistema. Los botones, avisos y
  temporizadores están etiquetados para lectores de pantalla y se pueden usar con el teclado.
- **Historial y estadísticas:** la tablet recuerda las partidas terminadas (quién jugó, con qué rol y quién ganó) en
  **📜 Historial**, con recuentos, duración media y roles más repetidos. Se guarda solo en ese navegador; se puede
  exportar (JSON) y borrar.
- **Sin conexión:** la web se guarda en el dispositivo (service worker): abre más rápido y aguanta cortes de red, y si el
  servidor no responde, un aviso lo explica en vez de dejar la pantalla en blanco. Para **jugar** sigue haciendo falta
  conexión con el servidor.

## Roles

Cada partida usa solo las cartas que elija el anfitrión. Hay **28 roles jugables**:

| Bando | Roles |
|---|---|
| 🐺 **Lobos** | Hombre Lobo · El Lobo Feroz (ataca dos veces) · El Corruptor (convierte a una víctima) |
| 🏘️ **Aldea** | El Aldeano · El Aldeano de la Verdad (carta pública) · La Vidente · La Alquimista · El Cazador · El Arquero del Amor · La Espía Silenciosa · El Guardián · El Anciano Sabio · El Chivo Expiatorio · El Inocente del Pueblo · Los Susurros · La Hermandad · El Zorro · La Domadora · El Juez · El Caballero de las Espadas |
| 🎭 **Ambiguos** (pueden cambiar de bando) | La Doncella Leal · El Bufón de las Mil Caras · El Niño Salvaje · La Doble Naturaleza |
| 🌙 **Solitarios** (objetivo propio) | El Flautista de las Sombras · El Ángel Celestial · El Cultista · El Lobo Lunar |
| 🏚️ **Modo Pueblo** (en preparación) | El Portador del Fuego y El Heraldo del Cuervo, en versión simplificada: necesitan los edificios del modo Pueblo, que aún no está |

Qué hace cada uno está resumido en la guía que ve el jugador en su celular ([`src/data/roles.json`](src/data/roles.json)); los nombres y subtítulos de las cartas, en el [glosario](docs/DISENO.md#los-roles-y-sus-nombres), y las decisiones de reglas, en [`docs/DISENO.md`](docs/DISENO.md).

## Servidor y límites

Para sincronizar la tablet con los celulares en tiempo real, el juego usa una pequeña base de datos de **Firebase Realtime Database** (Google). Solo guarda los apodos, las cartas y el estado de la partida, y se borra al descartar la sala. Más detalles en el [aviso legal y de privacidad](AVISO_LEGAL.md#5-privacidad).

La **instancia pública** del enlace de arriba funciona con el proyecto gratuito de su autor:

- Está pensada para **grupos de amigos** y es de uso «a mejor esfuerzo»: puede pausarse si se agota la cuota gratuita o si se abusa de ella, y no ofrece garantías.
- Si la usas mucho, o quieres que nunca dependa de nadie más, **monta tu propia copia** (abajo): es gratis, no pide tarjeta y lleva unos 10–15 minutos.

## Montar tu propia copia

Puedes tener tu propia versión, con tu propio servidor gratuito, sin depender de nadie:

1. **Haz un fork** de este repositorio.
2. Crea un **proyecto de Firebase** gratuito (plan Spark, sin tarjeta) con una **Realtime Database**.
3. Pega tu configuración en [`src/net/firebaseConfig.js`](src/net/firebaseConfig.js) y publica las reglas de [`database.rules.json`](database.rules.json).
4. Activa **GitHub Pages** en tu fork.
5. (Recomendado) Restringe la clave de API a tu dominio.

La guía completa, con capturas de los menús y qué hacer si algo falla, está en **[`docs/ALOJAR_TU_COPIA.md`](docs/ALOJAR_TU_COPIA.md)**.

## Desarrollo

No hay paso de compilación: son módulos ES nativos y [Preact](https://preactjs.com/) + [htm](https://github.com/developit/htm) por CDN. Necesitas **Node.js 22 o superior** (para las pruebas y el servidor local; el navegador de las pruebas de punta a punta es Chrome).

```bash
git clone https://github.com/Kenny28-176/aldeanos-vs-lobos.git
cd aldeanos-vs-lobos

npm test                      # pruebas del motor (incluye cientos de partidas simuladas)
node tests/simulate.js 7 12   # una partida simulada y narrada (semilla 7, 12 jugadores)
npm run serve                 # servidor local en http://localhost:8080/public/
npm run e2e:emulador          # reglas de seguridad + partidas completas en Chrome contra el EMULADOR de Firebase
node tools/e2e.js             # partida completa en Chrome con 1 tablet + 6 celulares (con el servidor en marcha)
node tools/e2e-ensayo.js      # lo mismo con 6 bots y 2 humanos con piloto automático
IDIOMA=en node tools/e2e-ensayo.js   # esa partida en inglés (falla si queda algo en español en pantalla)
npm run sitio                 # revisa la web y la prepara en _sitio/, tal como la publica GitHub Pages
npm run vendor                # actualiza las bibliotecas copiadas en public/vendor/
npm run revisar:imagenes      # comprueba las imágenes: formato real, 512 px como máximo y créditos (bloquea la release)
```

`npm run e2e:emulador` no toca ninguna base de datos real (necesita Java 21 o superior). Los scripts `tools/e2e*.js` sueltos usan por defecto **tu** Firebase (el de `src/net/firebaseConfig.js`) y borran la sala al terminar; con `EMULADOR=127.0.0.1:9000` (y el emulador en marcha: `npm run emulador`) usan el emulador. Si tu Chrome no está en la ruta habitual de Windows, indica dónde está con `CHROME=/ruta/a/chrome`; para probar tu web ya publicada, usa `BASE=https://TU-USUARIO.github.io/TU-REPO/public/ node tools/e2e.js`.

### Integración continua, publicación y versiones

- Cada push y cada pull request ejecutan en **GitHub Actions** las pruebas del motor, la comprobación de la web (sin
  dependencias externas, todos los archivos existen) y partidas completas contra el emulador de Firebase.
- Lo que llega a `main` y pasa las pruebas se **publica solo en GitHub Pages**, con la versión estampada en `version.json`.
- Los cambios de cada versión se anotan en el [`CHANGELOG.md`](CHANGELOG.md). Al subir una etiqueta (`v0.2.0`), una
  Action crea la «release» de GitHub con esas notas.

### Estructura

```
src/engine/   El motor: reglas puras, sin red ni pantalla. step(estado, acción) → { state, events, error }
src/net/      Firebase y el controlador de la tablet (la tablet es la autoridad; los celulares no calculan reglas)
src/ui/       Pantallas: narrator.js (tablet), player.js (celular), escena, efectos, audio, voz, ajustes de pantalla
src/i18n/     Textos de la interfaz y del motor en cada idioma (es.json, en.json) y las funciones para traducirlos
src/data/     Roles, orden de llamada de la noche y frases del narrador (datos, no código; una versión por idioma)
public/       Las páginas (index, narrator, player, cómo se juega, acerca de; en public/en/ las inglesas), imágenes y vendor/
tests/        Pruebas del motor, del reparto, del asistente de mazo, de los idiomas, de la web y del simulador de partidas
tools/        Servidor local, mando a distancia de Chrome (cdp.js), pruebas de punta a punta y herramientas de la web
docs/         Decisiones de diseño y guía para alojar tu copia
.github/      Integración continua, publicación en Pages, plantillas de issues y de pull requests
```

### Ideas para entender el código

- El **estado de la partida es JSON plano** y el motor es una función pura con un generador de azar con semilla: cualquier partida se puede reproducir y probar sin red.
- La **tablet** lee las acciones de los celulares, resuelve las reglas y escribe lo que debe ver cada uno (`views/{id}`) y lo público (`public`). Cada celular solo escucha lo suyo.
- Los **roles viven en datos** (`src/data/roles.json`) y sus pasos de noche/día en `src/engine/steps.js`. Para **añadir un rol**: define su ficha y su guía en `roles.json`, su paso en `steps.js` (y su sitio en `nightOrder.json` si actúa de noche), y escribe sus pruebas en `tests/`.
- Las muertes en cadena (enamorados, Cazador, Alguacil, Anciano…) pasan siempre por [`src/engine/deaths.js`](src/engine/deaths.js).
- Las reglas ambiguas y los criterios elegidos están en [`docs/DISENO.md`](docs/DISENO.md): si cambias uno, cambia también su prueba.

## Preguntas frecuentes

**¿Hace falta tener un juego de cartas físico?** No. La app reparte las cartas y las muestra en cada celular.

**¿Y si alguien no tiene celular?** Cada jugador necesita uno (el anfitrión también juega con el suyo). Un celular puede prestarse sin problema, pero no se comparte entre dos jugadores a la vez.

**¿Se puede hacer trampa mirando el celular de otro?** Claro que se puede mirar por encima del hombro, igual que con cartas de verdad: por eso hay un botón para ocultar la carta. El proyecto está pensado para jugar entre amigos y no se blinda contra quien abra las herramientas del navegador.

**¿Funciona sin internet?** Para jugar hace falta conexión con el servidor (aunque sea un punto de acceso compartido desde un celular). La web sí se guarda en el dispositivo: abre más rápido y aguanta cortes breves, y si el servidor no responde la app lo avisa. Una versión sin servidor es una de las ideas pendientes.

**¿Qué pasa si se cae la tablet?** Al volver a abrir la web y entrar en la misma sala, la partida continúa donde estaba.

**¿Se puede cambiar la voz del narrador?** Sí: la tablet usa las voces del idioma de la partida que tenga instaladas el dispositivo y en ⚙ puedes elegir la voz, la velocidad y el tono. Los efectos y la música también se pueden bajar o apagar.

**¿En qué idiomas está?** En español y en inglés. El idioma de la sala es el de la tablet y los celulares lo siguen; la voz del narrador usa las voces que el dispositivo tenga para ese idioma.

## Estado y hoja de ruta

✅ **Hecho**
- Partida completa con los **28 roles jugables**, muertes en cadena, victorias de todos los bandos, y miles de partidas simuladas en las pruebas.
- Reparto automático de cartas, asistente de mazo, modo ensayo con bots, ritmo rápido con «Listo» y debate abreviado.
- Narración por voz, música y efectos generados con código, escena animada de noche y día, revelaciones con carta que se voltea.
- Funciona en Android e iPhone (sin instalar nada), con pantalla siempre encendida.
- **Ilustraciones y nombres nuevos** para todos los roles (estilo Tarot, ligeras para el celular: unos 2,5 MB en total; ver [`public/img/CREDITOS.md`](public/img/CREDITOS.md)).
- **Español e inglés**, accesibilidad (texto grande, contraste alto, menos movimiento), historial de partidas y uso
  parcial sin conexión (la web se guarda en el dispositivo).
- Integración continua, publicación automática, reglas de seguridad estrictas y todas las bibliotecas dentro del
  repositorio (la web no carga nada de terceros).

🚧 **En marcha**
- **Modo Pueblo** (edificios, con El Portador del Fuego y El Heraldo del Cuervo completos).

💡 **Ideas**
- Modo sin servidor (conexión directa entre dispositivos), para jugar sin internet.
- Más idiomas (cada uno son unos archivos de texto) y revisar los existentes con hablantes nativos.
- Más accesibilidad: lectores de pantalla en toda la partida y paletas para daltonismo.

Los puntos de «En marcha» e «Ideas» tienen su issue en GitHub, por si quieres ayudar: [issues con la etiqueta *help wanted*](https://github.com/Kenny28-176/aldeanos-vs-lobos/labels/help%20wanted).

## Contribuir

¡Las ayudas son bienvenidas! Abre un **issue** para proponer ideas o avisar de un fallo, o un **pull request** si ya tienes el cambio hecho. Antes de enviarlo, ejecuta `npm test`.

- Quien cuida el proyecto tiene una lista de revisiones en [`docs/MANTENIMIENTO.md`](docs/MANTENIMIENTO.md).
- Aporta solo **material propio o con licencia compatible** (MIT, CC0, CC-BY…). **No copies** textos, imágenes ni nombres comerciales de juegos de terceros.
- El español es el idioma base y el inglés una traducción: si cambias un texto, cambia también su traducción (las pruebas avisan de lo que falte). Las nuevas frases de narración deben escribirse con palabras propias.
- Especialmente útiles: pruebas de reglas ambiguas, revisar las traducciones y alojar tu copia para decirnos qué se puede explicar mejor.

## Licencia, créditos y aviso legal

- **Código y textos del juego:** licencia [MIT](LICENSE).
- **Ilustraciones:** consulta [`public/img/CREDITOS.md`](public/img/CREDITOS.md) (autoría, licencia y fecha de cada grupo de imágenes).
- **Bibliotecas:** Preact (MIT), htm (Apache-2.0), Firebase JS SDK (Apache-2.0), qrcode-generator (MIT). Tipografías Cinzel e IM Fell English (SIL OFL). Todo está copiado en [`public/vendor/`](public/vendor/) con sus licencias, así que la web no depende de ningún CDN.
- Es un proyecto **independiente, sin ánimo de lucro y sin afiliación** con ningún editor o titular de marcas de juegos comerciales. Si crees que algún contenido infringe tus derechos, abre un [issue](https://github.com/Kenny28-176/aldeanos-vs-lobos/issues) y lo revisaremos con la mayor rapidez.

Todo el detalle (licencias, privacidad, retirada de contenidos) está en [`AVISO_LEGAL.md`](AVISO_LEGAL.md).
