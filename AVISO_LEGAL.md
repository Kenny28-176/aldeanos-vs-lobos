# Aviso legal, privacidad y créditos

*Última actualización: 10 de octubre de 2026. Este documento es informativo y no constituye asesoría legal.*

## 1. Qué es este proyecto

**Aldeanos vs Lobos** es un proyecto independiente, **gratuito y sin ánimo de lucro**, hecho por aficionados. Es un
narrador automático para juegos de roles ocultos y deducción social (el género de juegos de fiesta conocido como
«Hombre Lobo» o «Mafia»), en los que un grupo debate para descubrir a los impostores.

No tiene publicidad, no cobra ni acepta pagos y no vende datos.

## 2. No es un producto oficial

Este proyecto **no está afiliado, patrocinado ni respaldado** por ningún editor, autor o titular de marcas de juegos de
cartas o de mesa comerciales. **No incluye ni reproduce** sus textos, ilustraciones, logotipos, nombres comerciales ni
material de sus reglamentos.

- Los nombres de los roles son denominaciones genéricas de personajes (Vidente, Cazador…) o nombres propios de este proyecto.
- En general, las reglas y mecánicas de un juego no están protegidas por derechos de autor (sí lo están, en cambio,
  los textos y las ilustraciones concretos). Los textos de la narración y las guías de los roles de este proyecto
  están escritos con palabras propias.
- Las marcas de terceros que pudieran mencionarse pertenecen a sus respectivos propietarios.

## 3. Licencias

| Qué | Licencia |
|---|---|
| Código fuente | [MIT](LICENSE) |
| Textos del juego (narración y guías de los roles) | MIT |
| Efectos de sonido y música | Generados por el código (MIT) |
| Icono de la app (`public/img/icono*`) | Original del proyecto (MIT) |
| Ilustraciones de los roles (`public/img/roles/`) | Ver [`public/img/CREDITOS.md`](public/img/CREDITOS.md) |
| Preact | MIT |
| htm | Apache-2.0 |
| Firebase JS SDK | Apache-2.0 |
| qrcode-generator | MIT |
| Tipografías Cinzel e IM Fell English | SIL Open Font License 1.1 |

Las bibliotecas y tipografías están copiadas dentro del repositorio, en [`public/vendor/`](public/vendor/), junto con
sus licencias y la anotación de su origen y versión.

## 4. Si crees que algo infringe tus derechos

Si eres titular de derechos y crees que algún contenido de este proyecto los infringe, abre un
[issue en el repositorio](https://github.com/Kenny28-176/aldeanos-vs-lobos/issues) indicando **qué contenido es** y **por qué**.
Lo revisaremos y, si procede, lo retiraremos con la mayor rapidez.

## 5. Privacidad

- **No hay cuentas, ni anuncios, ni analítica, ni cookies de seguimiento.**
- Para jugar se guarda en un servidor de **Firebase (Google)** tu **apodo**, tu carta, tu estado y el estado de la
  partida. Se borra cuando el anfitrión descarta la sala y, de forma automática, pasados unos días.
- En tu propio dispositivo se guardan tus preferencias (nombre, voz, sonido, idioma y pantalla), un identificador aleatorio de
  jugador (`localStorage`) y una copia de la web para que cargue más rápido y aguante los cortes de red (service worker).
- La tablet guarda además, solo en su navegador, un **historial de las partidas terminadas** (quién jugó, con qué rol y
  quién ganó). Se puede exportar y borrar desde la propia tablet y no se sube a ningún servidor.
- La web **no carga nada de servidores de terceros** (código, tipografías e imágenes se sirven desde el propio sitio).
  El único servicio externo es Firebase, para sincronizar la partida; además, quien aloja la web (por defecto, GitHub
  Pages) ve tu dirección IP como en cualquier página.
- **No escribas datos personales en tu apodo.** No hay chat: la conversación ocurre en persona.
- Quien aloje su propia copia es el responsable de su servidor y de los datos que guarde.

## 6. Sin garantía

El software se ofrece **«tal cual»**, sin garantías de ningún tipo (ver [LICENSE](LICENSE)).
