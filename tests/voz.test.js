// La voz del narrador: elige voces del idioma de la partida, recuerda una por idioma y entiende lo que ya había guardado.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const VOCES = [
  { name: 'Microsoft Helena', lang: 'es-ES', localService: true },
  { name: 'Google español', lang: 'es-ES', localService: false },
  { name: 'Google español de Estados Unidos', lang: 'es-US', localService: false },
  { name: 'Microsoft David', lang: 'en-US', localService: true },
  { name: 'Google US English', lang: 'en-US', localService: false },
  { name: 'Google UK English Female', lang: 'en-GB', localService: false },
];

let guardado;
let dichas;
const preparar = ({ voces = VOCES, antes = null } = {}) => {
  guardado = antes ? { 'lobos:voz': JSON.stringify(antes) } : {};
  dichas = [];
  globalThis.window = globalThis;
  globalThis.localStorage = { getItem: k => guardado[k] ?? null, setItem: (k, v) => { guardado[k] = v; } };
  globalThis.SpeechSynthesisUtterance = class { constructor(texto) { this.text = texto; } };
  globalThis.speechSynthesis = { getVoices: () => voces, addEventListener() {}, cancel() {}, speak: u => dichas.push(u) };
};
const nueva = async opciones => {
  const { crearVoz } = await import('../src/ui/voz.js');
  return crearVoz(opciones);
};

beforeEach(() => preparar());

test('en español elige la voz de Google de es-ES; en inglés, la de en-US', async () => {
  const voz = await nueva();
  assert.equal(voz.nombreVoz, 'Google español (es-ES)');
  voz.usarIdioma('en');
  assert.equal(voz.nombreVoz, 'Google US English (en-US)');
  assert.deepEqual(voz.voces().map(v => v.idioma).sort(), ['en-GB', 'en-US', 'en-US']);
  voz.usarIdioma('es');
  assert.equal(voz.nombreVoz, 'Google español (es-ES)');
});

test('la voz elegida se recuerda por idioma y no se mezcla con la del otro', async () => {
  const voz = await nueva();
  voz.ajustar({ voz: 'Microsoft Helena' });
  voz.usarIdioma('en');
  assert.equal(voz.ajustes.voz, null, 'en inglés todavía no se ha elegido ninguna');
  voz.ajustar({ voz: 'Microsoft David' });
  assert.equal(voz.nombreVoz, 'Microsoft David (en-US)');
  voz.usarIdioma('es');
  assert.equal(voz.ajustes.voz, 'Microsoft Helena');
  assert.equal(voz.nombreVoz, 'Microsoft Helena (es-ES)');
  assert.deepEqual(JSON.parse(guardado['lobos:voz']).voces, { es: 'Microsoft Helena', en: 'Microsoft David' });
});

test('lo que se guardó antes de existir los idiomas (una sola voz) cuenta como la voz en español', async () => {
  preparar({ antes: { voz: 'Microsoft Helena', velocidad: 1.1, tono: 0.9 } });
  const voz = await nueva();
  assert.equal(voz.nombreVoz, 'Microsoft Helena (es-ES)');
  assert.equal(voz.ajustes.velocidad, 1.1);
  voz.usarIdioma('en');
  assert.equal(voz.nombreVoz, 'Google US English (en-US)');
});

test('probar() dice la frase que se le da con la voz y el idioma actuales', async () => {
  const voz = await nueva({ idioma: 'en' });
  voz.probar('Night falls.');
  assert.equal(dichas.at(-1).text, 'Night falls.');
  assert.equal(dichas.at(-1).lang, 'en-US');
  voz.probar('');
  assert.equal(dichas.length, 1, 'sin frase no dice nada');
});

test('en Android los códigos de idioma llevan guion bajo (en_US) y aun así se elige la voz principal', async () => {
  preparar({ voces: [
    { name: 'English UK', lang: 'en_GB', localService: true },
    { name: 'English US', lang: 'en_US', localService: true },
    { name: 'Español México', lang: 'es_MX', localService: true },
    { name: 'Español España', lang: 'es_ES', localService: true },
  ] });
  const voz = await nueva();
  assert.equal(voz.nombreVoz, 'Español España (es_ES)');
  voz.usarIdioma('en');
  assert.equal(voz.nombreVoz, 'English US (en_US)');
  assert.deepEqual(voz.voces().map(v => v.nombre), ['English UK', 'English US']);
});

test('si el dispositivo no tiene voces de ese idioma, usa cualquiera; si no tiene ninguna, no se rompe', async () => {
  preparar({ voces: [{ name: 'Solo español', lang: 'es-MX', localService: true }] });
  const voz = await nueva({ idioma: 'en' });
  assert.deepEqual(voz.voces().map(v => v.nombre), ['Solo español']);
  assert.equal(voz.nombreVoz, null, 'no hay voz del idioma: se habla con la de por defecto');
  preparar({ voces: [] });
  const sin = await nueva();
  assert.equal(sin.nombreVoz, null);
  assert.deepEqual(sin.voces(), []);
});
