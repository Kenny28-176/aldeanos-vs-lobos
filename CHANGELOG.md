# Registro de cambios

Aquí se anotan los cambios importantes de **Aldeanos vs Lobos**. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen el
[versionado semántico](https://semver.org/lang/es/).

Cómo se publica una versión: [CONTRIBUTING.md](CONTRIBUTING.md#publicar-una-versión-para-quien-mantiene-el-proyecto)
(`npm run version:preparar -- x.y.z` hace el cambio de este archivo y de `package.json`; la «release» de GitHub sale sola).

## [Sin publicar]

## [0.2.0] - 2026-10-11

### Añadido

- **Inglés.** Toda la interfaz, la narración, las guías de los roles y las páginas informativas (`public/en/`) existen
  también en inglés. La tablet elige el idioma (selector en la portada y en ⚙, o `?lang=en`); los celulares lo siguen
  solos y la voz del narrador cambia con él. Añadir otro idioma son archivos de texto: ver
  [CONTRIBUTING](CONTRIBUTING.md#traducciones).
- **Accesibilidad.** Tamaño del texto (normal, grande, enorme), contraste alto y menos movimiento, que respetan además
  lo que pida el sistema; diálogos, interruptores, avisos y temporizadores con sus roles para lectores de pantalla y
  gestión del foco. Hay pruebas automáticas de contraste (WCAG) y de que ninguna pantalla se desborde.
- **Historial y estadísticas.** La tablet recuerda las partidas terminadas (quién jugó, con qué rol y quién ganó) y
  muestra recuentos, duración media y roles más repetidos. Se guarda solo en ese navegador; se puede exportar y borrar.
- **Uso sin conexión.** Un service worker guarda la web en el dispositivo (carga más rápido y aguanta cortes de red) y,
  si el servidor no responde, un aviso lo explica en lugar de dejar la pantalla en blanco.
- **Integración continua** con GitHub Actions: pruebas del motor, comprobación de la web y partidas completas en Chrome
  contra el emulador de Firebase; **publicación automática** en GitHub Pages con la versión estampada; Dependabot.
- **Reglas de seguridad estrictas** para la base de datos (tipos, tamaños y campos permitidos), probadas con el emulador.
- **Bibliotecas dentro del repositorio** (`public/vendor/`, con sus licencias y una lista de huellas): la web ya no
  carga nada de servidores de terceros.
- Archivos de comunidad: guía para contribuir, código de conducta, política de seguridad y plantillas de issues y PR.
- **Reglas de seguridad publicadas.** `npm run reglas:comprobar` prueba, con una sala inventada que borra enseguida, si tu
  Firebase ya tiene las reglas estrictas, y `npm run reglas:publicar` las publica desde la terminal (guía en
  `docs/ALOJAR_TU_COPIA.md`).
- Guía de mantenimiento (`docs/MANTENIMIENTO.md`) con lo que conviene revisar cada mes.
- **Análisis de seguridad de GitHub (CodeQL)** en cada cambio y una vez por semana, sobre el código del proyecto (no sobre
  las bibliotecas de `public/vendor`).
- **Herramientas de publicación.** `npm run revisar:imagenes` comprueba que las ilustraciones son del formato que dice su
  extensión, miden 512 px como máximo, pesan 120 KB como máximo y tienen sus créditos (la release de GitHub no se publica
  si falla); `npm run version:preparar -- x.y.z` prepara el CHANGELOG y `package.json` de una versión nueva.

### Cambiado

- Los textos del motor y de las pantallas salen de diccionarios (`src/i18n/`) y no del código; al moverlos no cambió ni
  una palabra (se comprobó con una huella de todos los textos del motor en decenas de partidas, antes y después).
- Las pruebas de punta a punta funcionan en cualquier idioma (`IDIOMA=en`) y contra el emulador (`EMULADOR=host:puerto`).
- **Roles con nombre y subtítulo nuevos, a juego con las cartas nuevas** (por ejemplo «El Corruptor» con el subtítulo «The Corruptor • Portador de la Mácula»), en español e inglés: cambian los nombres, las guías, la narración y las crónicas, pero **no los ids** de los roles. El celular muestra el subtítulo bajo el nombre de la carta, y `docs/DISENO.md` tiene un glosario generado desde los datos. Una prueba impide que queden nombres antiguos en los textos y en la documentación. El «modelo» del Niño Salvaje pasa a ser su «mentor» y, en inglés, el Alguacil es siempre «Sheriff».
- **Ilustraciones nuevas** de todos los roles (estilo Tarot, WebP de verdad y de 512 px como máximo): las cartas pesan unos 2,5 MB en total en vez de unos 29 MB, así que cada celular descarga mucho menos en cada partida. Los créditos están en `public/img/CREDITOS.md`.
- Si faltan los textos del idioma elegido (red caída, archivo que falla), la app sigue en español en lugar de quedarse en blanco.
- Una prueba (`tests/textos-fijos.test.js`) impide escribir textos en el código de las pantallas: todo va al diccionario.
- El repositorio se recreó con un historial limpio (un solo commit) y se llama `aldeanos-vs-lobos`; las direcciones de la web y de GitHub cambian en consecuencia.
- Firebase JS SDK 10.12.2 → 13.0.0 (copiado en `public/vendor/`; los cambios de las versiones 11 a 13 no afectan a la base de datos
  en tiempo real). `node tools/vendor.js --solo=firebase` actualiza una sola biblioteca.

### Corregido

- **Un infectado ya puede cazar aunque no quede ningún lobo con carta de lobo.** Si el último lobo «de carta» moría y solo quedaban infectados (por ejemplo una Vidente infectada), no había turno de lobos y nadie podía morir de noche: la partida podía no acabar nunca. Salió en 8 de 6000 partidas simuladas; ahora terminan todas.
- En la crónica, la muerte por la espada del Caballero salía como «oxido», sin acento y sin sentido; ahora dice «contagio de la espada».

## [0.1.0] - 2026-10-09

Primera versión jugable.

### Añadido

- Motor de reglas puro y reproducible (`step(estado, acción)` con azar de semilla), con miles de partidas simuladas en
  las pruebas.
- **28 roles jugables** (más Pirómano y Cuervo en versión simplificada): lobos, aldeanos, ambiguos y solitarios, con
  muertes en cadena, interrupciones y las victorias de todos los bandos.
- La tablet como autoridad y los celulares como mandos, sincronizados con Firebase Realtime Database; si la tablet se
  recarga, la partida continúa.
- Reparto automático de cartas al azar, asistente de mazo (Sencillo, Equilibrado, Avanzado y Al azar), modo ensayo con
  bots, ritmo rápido con «Listo» y debate abreviado.
- Narración por voz, música y efectos generados con código, escena animada de noche y día y revelaciones con carta que
  se voltea.
- Licencia MIT, aviso legal y guía para montar tu propia copia con tu propio servidor gratuito.
