// Service worker (sw.js): se ejecuta en un entorno simulado (sin navegador) para comprobar su lógica de caché.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const ORIGEN = 'https://juego.test';
const fuente = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

// Una CacheStorage en memoria con lo justo que usa el service worker.
function crearCaches() {
  const almacenes = new Map();
  const direccion = r => new URL(typeof r === 'string' ? r : r.url, `${ORIGEN}/`).href;
  return {
    almacenes,
    async open(nombre) {
      if (!almacenes.has(nombre)) almacenes.set(nombre, new Map());
      const mapa = almacenes.get(nombre);
      return {
        match: async r => mapa.get(direccion(r))?.clone(),
        put: async (r, respuesta) => { mapa.set(direccion(r), respuesta); },
        add: async r => {
          const respuesta = await entorno.fetch(direccion(r));
          if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
          mapa.set(direccion(r), respuesta);
        },
        keys: async () => [...mapa.keys()].map(u => new Request(u)),
      };
    },
    keys: async () => [...almacenes.keys()],
    delete: async nombre => almacenes.delete(nombre),
  };
}

let entorno;

// Carga sw.js con la versión y la lista de precarga que se quiera, y devuelve sus manejadores de eventos.
function cargar({ version = 'prueba-1', precarga = [], respuestas = {}, cachesPrevios = crearCaches() } = {}) {
  const manejadores = {};
  const llamadas = [];
  entorno = {
    fetch: async peticion => {
      const url = new URL(typeof peticion === 'string' ? peticion : peticion.url, `${ORIGEN}/`);
      llamadas.push(url.pathname);
      const r = respuestas[url.pathname];
      if (r === 'caida') throw new TypeError('Failed to fetch');
      if (typeof r === 'function') return r();
      return new Response(r ?? `contenido de ${url.pathname}`, { status: r === undefined && url.pathname.includes('falta') ? 404 : 200 });
    },
  };
  const yo = {
    location: new URL(`${ORIGEN}/sw.js`),
    addEventListener: (tipo, fn) => { manejadores[tipo] = fn; },
    skipWaiting: async () => { yo.omitido = true; },
    clients: { claim: async () => { yo.reclamado = true; } },
  };
  const contexto = vm.createContext({
    self: yo, caches: cachesPrevios, fetch: entorno.fetch, Request, Response, URL, JSON, Promise, setTimeout, clearTimeout,
  });
  const codigo = fuente
    .replace("'__VERSION__'", `'${version}'`)
    .replace("'__PRECARGA__'", `'${JSON.stringify(precarga)}'`);
  vm.runInContext(codigo, contexto);
  return { manejadores, yo, caches: cachesPrevios, llamadas };
}

// Lanza un evento y espera lo que pidan waitUntil / respondWith.
async function lanzar(manejadores, tipo, extra = {}) {
  const pendientes = [];
  let respuesta;
  const evento = {
    waitUntil: p => pendientes.push(p),
    respondWith: p => { respuesta = p; },
    ...extra,
  };
  manejadores[tipo](evento);
  await Promise.all(pendientes);
  return respuesta === undefined ? undefined : respuesta;
}

const peticion = (ruta, opciones = {}) => ({ request: new Request(`${ORIGEN}${ruta}`, opciones) });

test('al instalarse guarda la precarga (aunque un archivo falle) y se activa enseguida', async () => {
  const sw = cargar({ precarga: ['public/player.html', 'src/ui/player.js', 'public/falta.js'] });
  await lanzar(sw.manejadores, 'install');
  const cache = await sw.caches.open('lobos-prueba-1');
  assert.deepEqual((await cache.keys()).map(r => new URL(r.url).pathname).sort(), ['/public/player.html', '/src/ui/player.js']);
  assert.equal(sw.yo.omitido, true);
});

test('al activarse borra las cachés de versiones anteriores y toma el control', async () => {
  const caches = crearCaches();
  await caches.open('lobos-vieja');
  await caches.open('otra-cosa-ajena');
  const sw = cargar({ version: 'nueva', cachesPrevios: caches });
  await lanzar(sw.manejadores, 'activate');
  assert.deepEqual(await caches.keys(), ['otra-cosa-ajena']);
  assert.equal(sw.yo.reclamado, true);
});

test('no toca lo que no es suyo: otros servidores, escrituras, audio por trozos y version.json', () => {
  const sw = cargar();
  const ignorados = [
    { request: new Request('https://otro.test/x.js') },
    { request: new Request(`${ORIGEN}/api`, { method: 'POST', body: 'x' }) },
    { request: new Request(`${ORIGEN}/public/audio/a.mp3`, { headers: { range: 'bytes=0-10' } }) },
    peticion('/version.json'),
    peticion('/sw.js'),
  ];
  for (const e of ignorados) {
    let respondio = false;
    sw.manejadores.fetch({ ...e, respondWith: () => { respondio = true; } });
    assert.equal(respondio, false, e.request.url);
  }
});

test('las imágenes se sirven de la caché si ya están (sin volver a pedirlas)', async () => {
  const sw = cargar();
  const primera = await (await lanzar(sw.manejadores, 'fetch', peticion('/public/img/roles/lobo.webp?v=1'))).text();
  assert.equal(primera, 'contenido de /public/img/roles/lobo.webp');
  const llamadasAntes = sw.llamadas.length;
  const segunda = await (await lanzar(sw.manejadores, 'fetch', peticion('/public/img/roles/lobo.webp?v=2'))).text();
  assert.equal(segunda, primera);
  assert.equal(sw.llamadas.length, llamadasAntes, 'la segunda vez no debe ir a la red');
});

test('el código va «red primero»: con conexión se usa lo nuevo y se guarda', async () => {
  let version = 1;
  const sw = cargar({ respuestas: { '/src/ui/player.js': () => new Response(`versión ${version}`) } });
  assert.equal(await (await lanzar(sw.manejadores, 'fetch', peticion('/src/ui/player.js'))).text(), 'versión 1');
  version = 2;
  assert.equal(await (await lanzar(sw.manejadores, 'fetch', peticion('/src/ui/player.js'))).text(), 'versión 2');
});

test('sin conexión se usa la copia guardada, también para otra sala de la misma página', async () => {
  const respuestas = { '/public/player.html': 'página' };
  const sw = cargar({ respuestas });
  assert.equal(await (await lanzar(sw.manejadores, 'fetch', peticion('/public/player.html?sala=ABCD'))).text(), 'página');
  respuestas['/public/player.html'] = 'caida';
  assert.equal(await (await lanzar(sw.manejadores, 'fetch', peticion('/public/player.html?sala=WXYZ'))).text(), 'página');
  const cache = await sw.caches.open('lobos-prueba-1');
  assert.deepEqual((await cache.keys()).map(r => r.url), [`${ORIGEN}/public/player.html`], 'una sola copia, sin «?sala=»');
});

test('sin conexión y sin copia, el fallo llega a la página', async () => {
  const sw = cargar({ respuestas: { '/src/ui/nuevo.js': 'caida' } });
  await assert.rejects(lanzar(sw.manejadores, 'fetch', peticion('/src/ui/nuevo.js')), /Failed to fetch/);
});

test('una respuesta con error no se guarda en la caché', async () => {
  const sw = cargar({ respuestas: { '/src/ui/falta.js': () => new Response('no', { status: 404 }) } });
  const respuesta = await lanzar(sw.manejadores, 'fetch', peticion('/src/ui/falta.js'));
  assert.equal((await respuesta).status, 404);
  const cache = await sw.caches.open('lobos-prueba-1');
  assert.deepEqual(await cache.keys(), []);
});

test('si la red tarda demasiado y hay copia, se usa la copia', async () => {
  let lenta = false;
  const sw = cargar({ respuestas: { '/public/estilos.css': () => (lenta ? new Promise(() => {}) : new Response('css guardado')) } });
  assert.equal(await (await lanzar(sw.manejadores, 'fetch', peticion('/public/estilos.css'))).text(), 'css guardado');
  lenta = true;
  const antes = Date.now();
  assert.equal(await (await lanzar(sw.manejadores, 'fetch', peticion('/public/estilos.css'))).text(), 'css guardado');
  assert.ok(Date.now() - antes >= 3500 && Date.now() - antes < 6000, 'espera unos 4 s antes de rendirse');
});
