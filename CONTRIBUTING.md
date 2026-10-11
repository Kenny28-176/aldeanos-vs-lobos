# Cómo contribuir a Aldeanos vs Lobos

¡Gracias por querer ayudar! Este es un proyecto **libre, gratuito y hecho por aficionados**. Cualquier ayuda cuenta:
avisar de un fallo, mejorar un texto, probar reglas dudosas, dibujar una ilustración o añadir un rol.

Al participar aceptas el [código de conducta](CODE_OF_CONDUCT.md) y que tu aportación se publique bajo la
[licencia MIT](LICENSE) del proyecto.

## Antes de empezar: el contenido tiene que ser original

Es la regla más importante del proyecto (y la que lo mantiene a salvo de problemas legales):

- **No copies** textos, imágenes, logotipos, nombres comerciales ni reglamentos de juegos de terceros. Las frases del
  narrador y las guías de los roles se escriben **con palabras propias**.
- Las **imágenes** deben ser propias o tener una licencia que permita redistribuirlas (CC0, CC BY…). Anota su origen en
  [`public/img/CREDITOS.md`](public/img/CREDITOS.md). Pesan como máximo 512 px (`python tools/optimizarImagenes.py`).
- No uses nombres de marcas de terceros en la interfaz, los textos, la documentación ni los nombres de archivo.
- El texto base del juego, los comentarios y los mensajes de commit van **en español**. Las traducciones (hoy, el
  inglés) viven en archivos propios: mira [Traducciones](#traducciones).

Si ves algo que no cumple esto, abre un issue con la plantilla «Derechos de autor o marcas».

## Preparar el entorno

Necesitas [Node.js](https://nodejs.org) **22 o superior**. No hay dependencias que instalar ni paso de compilación.

```bash
git clone https://github.com/Kenny28-176/aldeanos-vs-lobos.git
cd aldeanos-vs-lobos
npm test                 # pruebas del motor (incluye cientos de partidas simuladas)
npm run serve            # web local en http://localhost:8080/public/
```

Para probar partidas completas en Chrome sin tocar ninguna base de datos real, usa el **emulador de Firebase**
(necesita Java 21 o superior y Chrome):

```bash
npm run e2e:emulador     # reglas de seguridad + partida completa + ensayo con bots
```

Más comandos (simulador, pruebas contra tu propio Firebase, copia de bibliotecas…) en el [README](README.md#desarrollo).

## Cómo está organizado el código

- `src/engine/`: el **motor**, con reglas puras y sin red ni pantalla. `step(estado, acción) → { state, events, error }`.
- `src/net/`: Firebase y el controlador de la tablet, que es la **autoridad** de la partida.
- `src/ui/`: las pantallas de la tablet (`narrator.js`) y del celular (`player.js`).
- `src/data/`: los **datos**: roles, orden de llamada de la noche y frases del narrador (una versión por idioma).
- `src/i18n/`: los **textos de la interfaz y del motor** en cada idioma (`es.json`, `en.json`) y las funciones para traducirlos.
- `tests/`: pruebas del motor, del simulador de partidas y de la web.
- `docs/DISENO.md`: las reglas **tal como las implementa el motor** y los criterios elegidos en los casos dudosos.

Reglas de oro: los celulares nunca calculan reglas; el motor es una función pura con azar de semilla; los roles viven
en datos, no en `if`s dispersos.

## Añadir un rol

1. **Ficha** en [`src/data/roles.json`](src/data/roles.json): nombre, subtítulo (el de la carta), bando, cuántas copias, y una guía con palabras
   propias (resumen, cuándo actúa, qué hace, objetivo).
2. **Pasos** en [`src/engine/steps.js`](src/engine/steps.js) (qué ve y qué elige el jugador) y su sitio en
   [`src/data/nightOrder.json`](src/data/nightOrder.json) si actúa de noche.
3. Si causa o reacciona a **muertes**, `src/engine/deaths.js`; si cambia **quién gana**, `src/engine/victory.js`.
4. **Frases** del narrador en `src/data/narration.es.json` y su traducción en `narration.en.json`; el nombre y la guía en
   inglés, en `src/data/roles.en.json`; y los textos que el rol añada a las pantallas (`motor.*`), en `src/i18n/es.json` y
   `src/i18n/en.json`.
5. Una **imagen** propia en `public/img/roles/<id>.webp` (y su crédito en `CREDITOS.md`).
6. **Pruebas** en `tests/` para sus reglas. El simulador mezcla todos los roles implementados y sirve de red de seguridad.

Cuenta también el efecto que tiene en los demás: los pasos de noche no deben delatar información por su duración ni por
el sonido de los celulares.

## Traducciones

Los textos están separados del código para poder traducirlos. El español es la **base**: si a un idioma le falta un
texto, se usa el español (y nunca se enseña la clave).

| Qué | Dónde |
|---|---|
| Interfaz y mensajes del motor | `src/i18n/<idioma>.json` (claves `ui.*` y `motor.*`, con `{marcadores}` y plurales `.uno` / `.otros`) |
| Frases del narrador | `src/data/narration.<idioma>.json` (la misma forma que la española) |
| Nombre y guía de cada rol | `src/data/roles.<idioma>.json` (solo los textos; lo demás se hereda de `roles.json`) |
| Páginas informativas | `public/<idioma>/index.html`, `como-jugar.html` y `acerca.html` |

Para **añadir un idioma**: copia los archivos del inglés, tradúcelos (con palabras propias, como el resto del contenido),
añade el código en `IDIOMAS` de `src/i18n/traducir.js` y ejecuta `npm test`. `tests/i18n.test.js` comprueba que no
falte ninguna clave, que los `{marcadores}` coincidan, que no queden textos sin traducir y que una partida entera
salga sin claves sueltas (según el idioma, tendrás que ajustar la comprobación de «letras del español»). El idioma de
la sala es el de la tablet: los celulares lo siguen solos.

Una prueba (`tests/textos-fijos.test.js`) falla si escribes un texto, o un `title`/`aria-label`, directamente en las plantillas de
`src/ui/`: todo va al diccionario.

Para probar la interfaz a mano, abre la web con `?lang=en`; las pruebas de punta a punta aceptan `IDIOMA=en`
(`IDIOMA=en node tools/e2e-ensayo.js`) y fallan si queda algún texto en español en pantalla.

## Estilo del código

- JavaScript moderno con módulos ES, **sin dependencias nuevas** ni paso de compilación (la interfaz usa Preact + htm).
- Nombres y comentarios en español; comentarios que expliquen el **porqué**, no lo que ya dice el código.
- Funciones pequeñas y puras en el motor; la red y la pantalla, en `net/` y `ui/`.
- Las bibliotecas de terceros viven en `public/vendor/` y se actualizan con `node tools/vendor.js` (no se editan a mano).

## Enviar un cambio

1. Haz un **fork** y crea una rama con un nombre descriptivo.
2. Haz commits pequeños, con mensajes claros **en español**.
3. Antes de enviar: `npm test` en verde. Si tocaste pantallas, una partida de `npm run e2e` (o `npm run e2e:emulador`)
   y mira las capturas.
4. Abre el **pull request** y rellena la plantilla. La integración continua ejecuta las pruebas y una partida completa
   contra el emulador de Firebase.

## Publicar una versión (para quien mantiene el proyecto)

Las versiones se anotan en el [CHANGELOG](CHANGELOG.md) y se publican con una etiqueta: GitHub crea la «release» solo.

1. **Imágenes:** `npm run revisar:imagenes`. La publicación se **bloquea** si alguna imagen es en realidad un JPEG con
   extensión `.webp`, mide más de 512 px o pesa más de 120 KB, o si faltan sus créditos en
   [`public/img/CREDITOS.md`](public/img/CREDITOS.md) (sin huecos «completar»). Para reducirlas:
   `python tools/optimizarImagenes.py --aplicar`; guarda antes los originales **fuera** del repositorio.
2. `npm run version:preparar -- 0.2.0` pasa lo de «Sin publicar» a la sección `[0.2.0]`, deja otra «Sin publicar» vacía y
   sube la versión de `package.json`. No toca git.
3. Revisa el cambio con `git diff`, comprueba que `npm test` sale en verde y haz el commit
   solo de esos dos archivos: `git add CHANGELOG.md package.json && git commit -m "Versión 0.2.0"`.
4. Crea y sube la etiqueta: `git tag v0.2.0 && git push origin main v0.2.0`. La Action «Publicar versión» comprueba que la
   etiqueta coincide con `package.json`, revisa las imágenes, pasa las pruebas y crea la release con las notas del CHANGELOG.

## Avisar de un fallo o proponer una idea

Abre un [issue](https://github.com/Kenny28-176/aldeanos-vs-lobos/issues/new/choose) con la plantilla que corresponda (puedes
escribir en español o en inglés). Para un fallo, cuenta qué ocurrió, qué esperabas, cuántos jugadores erais, qué roles
había y qué dispositivos usabais.

Los fallos de **seguridad** se comunican en privado: ver [SECURITY.md](SECURITY.md).

Si cuidas el proyecto, tienes una lista de lo que revisar cada mes en [`docs/MANTENIMIENTO.md`](docs/MANTENIMIENTO.md).

## Qué ayuda más ahora

- **Revisar las traducciones** (en inglés lo ideal es un hablante nativo) y añadir idiomas nuevos.
- El **modo Pueblo** (edificios), con El Portador del Fuego y El Heraldo del Cuervo completos.
- **Pruebas de reglas ambiguas**, y partidas reales con muchos jugadores para afinar los tiempos.
- **Accesibilidad** (lectores de pantalla, daltonismo) y mejoras de la interfaz en móviles pequeños.
- **Traducciones** a más idiomas, y revisar las existentes con ojos de hablante nativo.
