// Service worker: carga más rápida y resistencia a los cortes de red. Nunca guarda partidas (de eso se encarga Firebase).
//
// Estrategia:
//  - «Red primero» para las páginas, el código y los datos: siempre se usa la versión más nueva si hay conexión, así nadie se
//    queda con código viejo (la tablet y los celulares deben ejecutar la misma versión). Si no hay red, o tarda más de 4 s
//    y hay copia, se usa la copia.
//  - «Caché primero» para lo que no cambia (imágenes, audio, tipografías y bibliotecas).
//
// Si alguna vez diera problemas: abre la web con ?sinsw al final de la dirección (borra lo guardado y se desactiva).
//
// La compilación (tools/construir-sitio.js) sustituye __VERSION__ y __PRECARGA__; en desarrollo se quedan tal cual.
const VERSION = '__VERSION__';
const PRECARGA = '__PRECARGA__'; // JSON con la lista de archivos de la «carcasa» de la app

const CACHE = `lobos-${VERSION}`;
const ESTATICO = /\/(img|audio|vendor)\/|\.(woff2?|webp|png|jpe?g|svg|mp3)$/i;
const ESPERA_RED = 4000;

const lista = (() => { try { return JSON.parse(PRECARGA); } catch { return []; } })();

// La clave de la caché ignora la parte «?sala=ABCD…» para no guardar una copia de cada sala.
const clave = url => new Request(url.origin + url.pathname);

self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Un archivo que falle no debe impedir la instalación.
    await Promise.all(lista.map(ruta => cache.add(ruta).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    for (const nombre of await caches.keys()) {
      if (nombre.startsWith('lobos-') && nombre !== CACHE) await caches.delete(nombre);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', evento => {
  const peticion = evento.request;
  if (peticion.method !== 'GET' || peticion.headers.has('range')) return; // el audio por trozos lo gestiona el navegador
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return; // Firebase y cualquier otro servidor: sin tocar
  if (/\/(version\.json|sw\.js)$/.test(url.pathname)) return; // siempre de la red
  evento.respondWith(ESTATICO.test(url.pathname) ? cachePrimero(peticion, url) : redPrimero(peticion, url));
});

async function cachePrimero(peticion, url) {
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(clave(url));
  if (guardado) return guardado;
  const respuesta = await fetch(peticion);
  if (respuesta.ok) cache.put(clave(url), respuesta.clone());
  return respuesta;
}

async function redPrimero(peticion, url) {
  const cache = await caches.open(CACHE);
  const red = fetch(peticion).then(respuesta => {
    if (respuesta.ok) cache.put(clave(url), respuesta.clone());
    return respuesta;
  });
  const guardado = await cache.match(clave(url));
  if (!guardado) return red; // sin copia, no queda más que esperar a la red
  red.catch(() => {}); // si pierde la carrera, que no quede como error sin atender
  const agotado = new Promise(resolver => setTimeout(() => resolver(guardado), ESPERA_RED));
  return Promise.race([red.catch(() => guardado), agotado]);
}
