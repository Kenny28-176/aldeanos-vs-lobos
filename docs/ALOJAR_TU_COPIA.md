# Montar tu propia copia de Aldeanos vs Lobos

Esta guía te lleva, paso a paso, a tener **tu propia versión del juego** funcionando con **tu propio servidor gratuito**.
No necesitas saber programar, ni tarjeta de crédito, ni instalar nada en tu ordenador.

- ⏱️ **Tiempo:** unos 10–15 minutos.
- 💶 **Coste:** 0 €. Usas el plan gratuito de Firebase (Spark), que **no pide tarjeta**: si algún día se agotara la cuota, el servicio simplemente se pausa; nunca te cobran.
- 🧰 **Necesitas:** una cuenta de [GitHub](https://github.com) y una cuenta de Google.

> **¿Por qué hace falta un servidor?** Para que la tablet y los celulares se hablen en tiempo real el juego usa una pequeña base de datos de Firebase. Los jugadores **no configuran nada**: solo lo hace quien aloja el juego, y una sola vez.

---

## Paso 1 · Haz un fork del repositorio

1. Entra en <https://github.com/Kenny28-176/aldeanos-vs-lobos>.
2. Pulsa **Fork** (arriba a la derecha) y confirma. Se crea una copia en tu cuenta.
   Si quieres, cámbiale el nombre (por ejemplo `mis-lobos`): será parte de la dirección de tu web.

## Paso 2 · Crea tu proyecto de Firebase

1. Entra en la [consola de Firebase](https://console.firebase.google.com) con tu cuenta de Google y pulsa **Crear un proyecto**.
2. Ponle un nombre (por ejemplo `mis-lobos`). Desactiva Google Analytics (no hace falta) y pulsa **Crear proyecto**.
3. En el menú de la izquierda abre **Compilación → Realtime Database** y pulsa **Crear base de datos**.
   - **Ubicación:** elige la más cercana a ti. Ojo: la dirección de tu base de datos depende de la región (la copiarás en el paso 3).
   - **Reglas de seguridad:** elige **Empezar en modo bloqueado** (en el paso 4 pegarás las reglas buenas).
4. Pulsa el engranaje ⚙ junto a «Descripción general del proyecto» → **Configuración del proyecto** → pestaña **General**.
   Baja hasta **Tus apps** y pulsa el icono web **`</>`**.
   - Ponle cualquier apodo a la app y **no** marques «Firebase Hosting».
   - Pulsa **Registrar app**: te mostrará un bloque de código con `const firebaseConfig = { … }`. **Déjalo abierto o cópialo.**
5. Comprueba que ese bloque incluye **`databaseURL`**. Si no aparece, cópiala de la pestaña **Datos** de Realtime Database (es la dirección que se ve arriba, algo como `https://tu-proyecto-default-rtdb.firebaseio.com`).

## Paso 3 · Pega tu configuración en el código

1. En tu fork de GitHub abre el archivo [`src/net/firebaseConfig.js`](../src/net/firebaseConfig.js) y pulsa el lápiz ✏️ (editar).
2. Sustituye los valores por los de tu bloque `firebaseConfig`. Debe quedar así (con **tus** datos):

   ```js
   export const firebaseConfig = {
     apiKey: '…',
     authDomain: 'tu-proyecto.firebaseapp.com',
     databaseURL: 'https://tu-proyecto-default-rtdb.firebaseio.com',
     projectId: 'tu-proyecto',
     storageBucket: 'tu-proyecto.firebasestorage.app',
     messagingSenderId: '…',
     appId: '…',
   };
   ```

3. Pulsa **Commit changes**.

> La `apiKey` de una app web **no es un secreto** (cualquiera que abra tu web puede verla). Lo que protege tus datos son las reglas del paso siguiente y la restricción del paso 6.

## Paso 4 · Publica las reglas de la base de datos

1. En la consola de Firebase: **Realtime Database → pestaña Reglas**.
2. Borra lo que haya y pega el contenido del archivo [`database.rules.json`](../database.rules.json) de tu fork.
3. Pulsa **Publicar**.

Sin este paso, o bien la base de datos rechaza todo («modo bloqueado»), o bien queda abierta de par en par («modo de prueba», que además caduca a los 30 días).

**Cómo saber si ya están publicadas.** Desde la raíz del proyecto, con Node.js instalado, ejecuta `npm run reglas:comprobar`. Prueba en tu
base de datos (con una sala inventada, `IOIO`, que borra enseguida) que acepta lo que escribe el juego y rechaza lo que no lo es, y te
dice si tienes las reglas estrictas, unas antiguas o abiertas, o si no puede saberlo.

**Alternativa desde la terminal** (cómoda si cambias las reglas más adelante): `npx firebase-tools@15 login` abre el navegador para que
entres con tu cuenta de Google; después `npm run reglas:publicar -- --project TU-ID-DE-PROYECTO` las publica (el identificador sale en
la consola de Firebase, en **Configuración del proyecto**).

## Paso 5 · Activa GitHub Pages

1. En tu fork, abre la pestaña **Actions** y, si te lo pide, pulsa **«I understand my workflows, go ahead and enable them»**
   (GitHub desactiva las automatizaciones de los forks hasta que lo confirmes).
2. Ve a **Settings → Pages**. En **Build and deployment**, elige **Source: GitHub Actions**.
3. Lanza la publicación: en **Actions → Publicar la web → Run workflow** (después se publicará sola cada vez que cambies algo).
   Antes de publicar, la automatización ejecuta las pruebas del proyecto y revisa que la web no dependa de servidores externos.
4. En uno o dos minutos aparecerá la dirección de tu web (la verás en la ejecución y en Settings → Pages):
   `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`. Esa es la que compartirás con tus amigos.

> **Alternativa sin automatización:** en **Source** puedes elegir **Deploy from a branch** (rama `main`, carpeta `/ (root)`).
> Funciona igual, pero publica también carpetas que la web no necesita (pruebas, herramientas…) y no ejecuta las pruebas antes.

## Paso 6 · Restringe la clave de API (recomendado)

Son 3 minutos y evita que otros usen tu clave para cosas que no son este juego.

1. Abre <https://console.cloud.google.com/apis/credentials> y elige tu proyecto en el selector de arriba.
2. Entra en la clave **«Browser key (auto created by Firebase)»** (o «Clave de API del navegador»).
3. **Restricciones de aplicaciones → Sitios web**. Añade, uno por línea:
   - `https://TU-USUARIO.github.io/*`
   - `http://localhost:8080/*` (solo si vas a probar en tu ordenador; el puerto va **explícito**, no admite `:*`)
4. **Restricciones de API → Restringir clave**, y marca solo: *Firebase Installations API*, *Identity Toolkit API*, *Token Service API* y *Firebase Realtime Database API* (esta última, si aparece).
5. **Guardar.** Puede tardar unos 5 minutos en aplicarse.

## Paso 7 · Pruébalo

1. En la tablet, abre tu dirección de Pages → **Soy el narrador** → **Crear sala nueva**.
2. En un celular, escanea el QR (o abre la web, **Soy jugador** y escribe el código de 4 letras).
3. Añade algún **🤖 bot de ensayo**, pulsa **✨ Sugerir mazo** y **Empezar la partida**. Si ves la carta en el celular, ¡ya está!

---

## Vigilar la cuota

Entra de vez en cuando en la consola de Firebase → **Realtime Database → pestaña Uso**. Fíjate en tres números:

| Qué | Límite gratuito | Qué significa |
|---|---|---|
| Conexiones simultáneas | 100 | Cada celular y cada tablet con la web abierta cuenta como una. |
| Almacenamiento | 1 GB | Una sala ocupa unas decenas de KB; se borra al descartarla. |
| Descargas al mes | 10 GB | Lo que reciben los dispositivos al jugar. |

Si te acercas a un límite, o simplemente quieres ver qué hay guardado, usa la herramienta de mantenimiento (necesita Node.js):

```bash
node tools/limpiar-salas.js            # lista las salas, su edad y su tamaño (no borra nada)
node tools/limpiar-salas.js --borrar   # borra las de más de 2 días y los restos sin partida
```

Si el límite se supera, el juego mostrará **«El servidor no responde»** hasta que se renueve la cuota (Firebase no cobra en el
plan gratuito). Si tu web se hace popular, lo más sano es que cada grupo monte su propia copia.

## Cuota gratuita y seguridad

- **Plan Spark (gratis, sin tarjeta):** 1 GB almacenado, 10 GB/mes de descarga y 100 conexiones simultáneas. Una partida entre amigos consume muy poco (del orden de unos pocos MB), así que da para cientos de partidas al mes.
- **Si se supera la cuota**, Firebase **no cobra**: la base de datos se pausa hasta que se renueve el periodo.
- **Nunca cambies tu proyecto al plan Blaze** (de pago) si no quieres riesgo de cobros. Si algún día lo haces, activa antes alertas y un límite de presupuesto.
- **Limpieza:** al pulsar **Descartar sala** la tablet borra todos los datos de la partida, y las salas con más de 2 días se borran solas. Desde la consola de Firebase puedes borrar el nodo `rooms` cuando quieras.
- **Nivel de seguridad:** el juego está pensado para grupos de amigos. Las reglas dejan leer y escribir en una sala a quien conozca su código de 4 letras; no guardes nada sensible y no escribas datos personales en los apodos.
- **Tus datos son tuyos:** quien aloja su propia copia es el responsable de su servidor y de lo que guarde (ver [aviso legal y privacidad](../AVISO_LEGAL.md)).

## Problemas habituales

| Síntoma | Qué mirar |
|---|---|
| La web de GitHub Pages da «404» | Pages tarda 1–2 minutos en activarse. Comprueba que elegiste la rama `main` y la carpeta `/ (root)`. |
| Los celulares se quedan en «Conectando con la sala…» | El código está mal escrito, o `databaseURL` no es la de tu base de datos (cambia según la región). |
| «Permission denied» en la consola del navegador | No has publicado las reglas (paso 4), o se han quedado en «modo bloqueado». |
| La consola dice que la clave de API no es válida / está restringida | Revisa el paso 6: añade tu dirección de Pages a los sitios web permitidos (y espera unos minutos). |
| La tablet no habla | Toca la pantalla una vez (el navegador exige un gesto del usuario), sube el volumen y revisa que haya una voz en español instalada (ajustes del sistema → texto a voz). |
| La pantalla se apaga | La app pide mantenerla encendida, pero solo funciona con **https** (GitHub Pages ya lo es). En una red local con `http` no funciona. |

## Probar sin tocar tu base de datos real (emulador)

Si vas a modificar el juego, puedes ejecutar las pruebas completas contra el **emulador de Firebase**, que simula la base de
datos en tu ordenador con las mismas reglas de seguridad. Necesitas Java 21 o superior y Chrome:

```bash
npm run e2e:emulador     # reglas de seguridad + una partida completa con 6 celulares + ensayo con bots
```

Para abrir la web contra el emulador a mano: `npm run emulador` en una terminal, `npm run serve` en otra y abre
`http://localhost:8080/public/narrator.html?emulador=127.0.0.1:9000` (solo se admiten direcciones locales).

## Probar en tu ordenador

```bash
npm run serve        # http://localhost:8080/public/
```

Los celulares de tu misma wifi pueden abrir la dirección de red que muestra el servidor (por ejemplo `http://192.168.1.20:8080/public/`). Recuerda añadirla a los sitios web permitidos del paso 6 si restringiste la clave.

## Actualizar tu copia cuando el proyecto original mejore

En tu fork de GitHub pulsa **Sync fork → Update branch**. Tu archivo `src/net/firebaseConfig.js` sigue siendo tuyo; si el original lo cambiara alguna vez, conserva tu versión al resolver el conflicto.
