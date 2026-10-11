// El idioma en el navegador: se carga el diccionario, se recuerda lo elegido y, si faltan los textos del idioma pedido,
// se sigue en español en lugar de romper la pantalla.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = ruta => JSON.parse(readFileSync(new URL(`../src/i18n/${ruta}`, import.meta.url), 'utf8'));
let guardado;
let caidos;

beforeEach(() => {
  guardado = {};
  caidos = new Set();
  globalThis.localStorage = { getItem: k => guardado[k] ?? null, setItem: (k, v) => { guardado[k] = v; } };
  globalThis.fetch = async url => {
    const archivo = String(url).split('/').pop();
    if (caidos.has(archivo)) throw new TypeError('Failed to fetch');
    return { json: async () => leer(archivo) };
  };
});

// Node define `navigator` solo para leer: se sustituye y se restaura al terminar.
const navegadorOriginal = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const conNavegador = idioma => Object.defineProperty(globalThis, 'navigator', { value: { language: idioma }, configurable: true, writable: true });

// El módulo guarda el idioma actual: cada prueba lo importa de nuevo.
const cargar = () => import(`../src/i18n/idioma.js?${Math.random()}`);

test('usarIdioma carga el diccionario, lo recuerda solo si se pide y avisa a quien escucha', async () => {
  const { usarIdioma, idiomaActual, t, alCambiarIdioma } = await cargar();
  const avisos = [];
  alCambiarIdioma(c => avisos.push(c));
  await usarIdioma('en');
  assert.equal(idiomaActual(), 'en');
  assert.equal(t('ui.boton.cerrar'), leer('en.json')['ui.boton.cerrar']);
  assert.equal(guardado['lobos:idioma'], undefined, 'sin { guardar: true } no se recuerda');
  await usarIdioma('es', { guardar: true });
  assert.equal(guardado['lobos:idioma'], 'es');
  assert.deepEqual(avisos, ['en', 'es']);
});

test('si faltan los textos del idioma pedido se sigue en español y no se recuerda esa elección', async () => {
  const { usarIdioma, idiomaActual, t } = await cargar();
  caidos.add('en.json');
  assert.equal(await usarIdioma('en', { guardar: true }), 'es');
  assert.equal(idiomaActual(), 'es');
  assert.equal(t('ui.boton.cerrar'), leer('es.json')['ui.boton.cerrar']);
  assert.equal(guardado['lobos:idioma'], undefined, 'no se queda guardado un idioma que no se pudo cargar');
});

test('iniciarIdioma elige ?lang=, lo guardado o el navegador, y lo que se pide con ?lang= se recuerda', async () => {
  globalThis.location = { search: '?lang=en' };
  conNavegador('es-ES');
  const { iniciarIdioma, idiomaActual } = await cargar();
  assert.equal(await iniciarIdioma(), 'en');
  assert.equal(idiomaActual(), 'en');
  assert.equal(guardado['lobos:idioma'], 'en');

  globalThis.location = { search: '' };
  guardado = { 'lobos:idioma': 'es' };
  conNavegador('en-US');
  const otro = await cargar();
  assert.equal(await otro.iniciarIdioma(), 'es', 'lo guardado gana al idioma del navegador');

  guardado = {};
  const tercero = await cargar();
  assert.equal(await tercero.iniciarIdioma(), 'en', 'sin nada guardado, el del navegador');
  assert.equal(guardado['lobos:idioma'], undefined, 'y eso no cuenta como una elección');
  delete globalThis.location;
  if (navegadorOriginal) Object.defineProperty(globalThis, 'navigator', navegadorOriginal);
  else delete globalThis.navigator;
});
