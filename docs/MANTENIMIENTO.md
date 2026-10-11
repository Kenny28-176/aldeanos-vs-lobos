# Mantenimiento (para quien cuida el proyecto)

Lo que conviene revisar de vez en cuando para que el proyecto siga sano, gratis y seguro. Casi todo se hace con un comando.

## Cada mes (unos 10 minutos)

| Qué | Cómo |
|---|---|
| **Acciones de GitHub** | Dependabot abre pull requests titulados «CI: …». Si la integración continua sale en verde, se fusionan. |
| **Bibliotecas copiadas** (Firebase, htm, qrcode, tipografías) | `node tools/vendor.js --comprobar` dice si hay versiones nuevas y si los archivos siguen siendo los de `vendor.json`. Para actualizar una: cambia su versión en `tools/vendor.js`, ejecuta `node tools/vendor.js --solo=firebase`, abre un pull request y espera a que la CI salga en verde. Si es Firebase, prueba además una partida contra tu base de datos. |
| **Avisos de seguridad** | En GitHub, pestaña **Security**: alertas de Dependabot y de CodeQL (que analiza el código cada semana y en cada cambio). |
| **Reglas de Firebase** | `npm run reglas:comprobar` debe decir que las reglas estrictas están publicadas. Si no, mira el paso 4 de [`ALOJAR_TU_COPIA.md`](ALOJAR_TU_COPIA.md#paso-4--publica-las-reglas-de-la-base-de-datos). |
| **Uso de Firebase** | Consola de Firebase → **Realtime Database → pestaña Uso**: almacenamiento (1 GB), descargas (10 GB al mes) y conexiones simultáneas (100). Más detalles en [Vigilar la cuota](ALOJAR_TU_COPIA.md#vigilar-la-cuota). |
| **Salas viejas** | La app borra sola las de más de 2 días cada vez que una tablet crea una sala. `node tools/limpiar-salas.js` las muestra (y con `--borrar` las limpia a mano). |

## Antes de publicar una versión

Sigue [«Publicar una versión»](../CONTRIBUTING.md#publicar-una-versión-para-quien-mantiene-el-proyecto): `npm run revisar:imagenes`,
`npm run version:preparar -- x.y.z`, commit y etiqueta. La publicación se bloquea sola si las imágenes no cumplen las reglas.

## Peso de la web (las imágenes)

Cada celular descarga las cartas del mazo de la partida. Con las ilustraciones sin optimizar (unos 1 MB cada una, 1024 px) son
**8-10 MB por celular y partida**; optimizadas a 512 px (`python tools/optimizarImagenes.py --aplicar`) son unos 0,5 MB. GitHub Pages
admite un sitio de hasta 1 GB y unos 100 GB de tráfico al mes: con imágenes pesadas, unas cuantas cientos de partidas al mes bastarían
para acercarse al límite, y a los jugadores con datos móviles se les va el plan. Guarda siempre los originales en alta resolución
**fuera** del repositorio.

## Si algo falla

- **«El servidor no responde»** en las pantallas: casi siempre es la cuota de Firebase (se renueva sola) o la conexión del
  dispositivo. Mira la pestaña Uso y, si hace falta, el [estado de Firebase](https://status.firebase.google.com/).
- **La web no se actualiza** tras publicar: el navegador guarda una copia (service worker). Abre la web con `?sinsw` una vez: la
  desactiva, borra la copia y recarga.
- **La publicación falla:** pestaña **Actions** → «Publicar la web»; el registro dice qué comprobación no pasó (pruebas, archivos
  que faltan o una dependencia externa).
- **Alguien escribe basura en la base de datos:** publica las reglas estrictas (`npm run reglas:comprobar` te dice si lo están) y,
  si hace falta, restringe la clave de API a tu dominio (Google Cloud → APIs y servicios → Credenciales).
