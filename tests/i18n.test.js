// Idiomas: los diccionarios están completos y coherentes, y una partida entera en inglés no deja textos sin traducir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine/index.js';
import { loadData } from './loadData.js';
import { simular } from './simulate.js';
import { interpolar, traducir, traducirN, elegirIdioma, listaDeNombres, IDIOMAS } from '../src/i18n/traducir.js';

const leer = ruta => JSON.parse(readFileSync(new URL(`../src/${ruta}`, import.meta.url), 'utf8'));
const es = leer('i18n/es.json');
const en = leer('i18n/en.json');
const marcadores = texto => [...texto.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const SOLO_SIMBOLOS = /^[^A-Za-zÁ-úñ]*$/;
// Palabras que se escriben igual en español y en inglés.
const IGUALES_A_PROPOSITO = new Set([
  'ui.paso.debate', 'ui.dur.debate', 'ui.ajuste.texto.normal', 'ui.ajuste.contraste.normal', 'ui.historial.minutos', 'ui.no',
]);

test('traducir: marcadores, base de respaldo y claves desconocidas', () => {
  assert.equal(interpolar('Hola {a} y {b}', { a: 'Ana' }), 'Hola Ana y ');
  assert.equal(traducir({ x: 'uno' }, { x: 'one', y: 'two' }, 'y'), 'two');
  assert.equal(traducir({}, {}, 'clave.rara'), 'clave.rara');
  assert.equal(traducirN({ 'c.uno': '{n} cosa', 'c.otros': '{n} cosas' }, {}, 'c', 1), '1 cosa');
  assert.equal(traducirN({ 'c.uno': '{n} cosa', 'c.otros': '{n} cosas' }, {}, 'c', 0), '0 cosas');
  assert.equal(listaDeNombres(['A', 'B', 'C'], 'y'), 'A, B y C');
  assert.equal(listaDeNombres(['A', 'B'], 'and'), 'A and B');
});

test('el idioma se elige con ?lang=, lo guardado o el del navegador (y si no, español)', () => {
  assert.deepEqual(Object.keys(IDIOMAS), ['es', 'en']);
  assert.equal(elegirIdioma({ navegador: 'en-GB' }), 'en');
  assert.equal(elegirIdioma({ navegador: 'es-AR' }), 'es');
  assert.equal(elegirIdioma({ navegador: 'fr-FR' }), 'es');
  assert.equal(elegirIdioma({ parametro: 'es', guardado: 'en', navegador: 'en' }), 'es');
  assert.equal(elegirIdioma({ guardado: 'en', navegador: 'es' }), 'en');
  assert.equal(elegirIdioma({ parametro: 'zz', guardado: 'xx', navegador: '' }), 'es');
});

test('el diccionario inglés tiene las mismas claves y marcadores que el español', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort(), 'faltan claves en un idioma');
  for (const clave of Object.keys(es)) {
    assert.ok(typeof es[clave] === 'string' && es[clave].length, `${clave}: vacío en español`);
    assert.ok(typeof en[clave] === 'string' && en[clave].length, `${clave}: vacío en inglés`);
    assert.equal(marcadores(en[clave]), marcadores(es[clave]), `${clave}: los {marcadores} no coinciden`);
  }
});

test('el inglés está traducido de verdad: no quedan textos iguales al español ni letras españolas', () => {
  const iguales = Object.keys(es).filter(k => en[k] === es[k] && !SOLO_SIMBOLOS.test(es[k]) && !IGUALES_A_PROPOSITO.has(k));
  assert.deepEqual(iguales, [], 'textos sin traducir');
  for (const [clave, texto] of Object.entries(en)) assert.ok(!/[¿¡áéíóúñÁÉÍÓÚÑ«»]/.test(texto), `${clave}: «${texto}» parece español`);
});

test('roles.en.json cubre todos los roles y solo traduce textos', () => {
  const base = leer('data/roles.json').roles;
  const traducidos = leer('data/roles.en.json').roles;
  assert.deepEqual(Object.keys(traducidos).sort(), Object.keys(base).sort());
  for (const [id, r] of Object.entries(traducidos)) {
    assert.ok(r.nombre && r.guia.resumen && r.guia.cuando && r.guia.accion && r.guia.objetivo, `${id}: faltan textos`);
    assert.equal('nota' in r, 'nota' in base[id], `${id}: la nota`);
    assert.deepEqual(Object.keys(r).filter(k => !['nombre', 'subtitulo', 'guia', 'nota'].includes(k)), [], `${id}: solo se traducen textos`);
    for (const texto of [r.nombre, r.subtitulo, ...Object.values(r.guia)]) if (texto) assert.ok(!/[¿¡áéíóúñÁÉÍÓÚÑ«»]/.test(texto), `${id}: «${texto}» parece español`);
  }
});

test('narration.en.json tiene la misma forma y los mismos marcadores que narration.es.json', () => {
  const comparar = (a, b, ruta) => {
    assert.equal(Array.isArray(a), Array.isArray(b), ruta);
    if (typeof a === 'string') {
      assert.equal(typeof b, 'string', ruta);
      assert.equal(marcadores(b), marcadores(a), `${ruta}: marcadores`);
      assert.ok(!/[¿¡áéíóúñÁÉÍÓÚÑ«»]/.test(b), `${ruta}: «${b}» parece español`);
    } else if (Array.isArray(a)) {
      assert.equal(b.length, a.length, `${ruta}: número de variantes`);
      a.forEach((x, i) => comparar(x, b[i], `${ruta}[${i}]`));
    } else {
      assert.deepEqual(Object.keys(b).sort(), Object.keys(a).sort(), ruta);
      for (const k of Object.keys(a)) if (k !== '_nota') comparar(a[k], b[k], `${ruta}.${k}`);
    }
  };
  comparar(leer('data/narration.es.json'), leer('data/narration.en.json'), 'narración');
});

test('si a un idioma le falta una clave, el motor usa el español (y nunca enseña la clave)', () => {
  const datos = loadData('en');
  const incompleto = { ...datos, textos: { ...datos.textos } };
  delete incompleto.textos['motor.error.ya_empezo'];
  const motor = createEngine(incompleto);
  assert.equal(motor.ctx.t('motor.error.ya_empezo'), es['motor.error.ya_empezo']);
  assert.equal(motor.ctx.t('motor.error.paso_viejo'), en['motor.error.paso_viejo']);
});

// Recoge todos los textos que el motor entrega a las pantallas durante una partida.
function recolectar(valor, salida) {
  if (typeof valor === 'string') salida.add(valor);
  else if (Array.isArray(valor)) valor.forEach(v => recolectar(v, salida));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach(v => recolectar(v, salida));
}

test('una partida entera en inglés (cientos de pasos) no deja claves ni palabras en español', () => {
  const motor = createEngine(loadData('en'));
  const textos = new Set();
  const nombres = new Set();
  const paso = motor.step;
  motor.step = (s, accion) => {
    const r = paso(s, accion);
    if (r.error) recolectar(r.error.mensaje, textos);
    if (r.events?.length) recolectar(motor.narrate(r.events, l => l[0]).map(f => f.texto), textos);
    if (r.state) {
      for (const id of r.state.ids) { nombres.add(r.state.players[id].name); recolectar(motor.viewFor(r.state, id), textos); }
      recolectar(motor.publicView(r.state), textos);
      recolectar(r.state.cronica?.map(c => c.texto), textos);
      recolectar(motor.problemasParaEmpezar(r.state), textos);
    }
    return r;
  };
  for (let semilla = 1; semilla <= 40; semilla++) {
    simular({ seed: semilla, jugadores: 4 + (semilla % 14), reparto: true, extra: semilla % 3, motor });
  }
  assert.ok(textos.size > 500, `solo se recogieron ${textos.size} textos`);
  const quitarNombres = t => [...nombres].reduce((acc, n) => acc.replaceAll(n, ''), t);
  const mal = [];
  for (const texto of textos) {
    const limpio = quitarNombres(texto);
    if (/\b(motor|ui)\.[a-z_]+(\.[a-z_]+)*\b/.test(limpio)) mal.push(`clave sin traducir: ${texto}`);
    else if (/[¿¡áéíóúñÁÉÍÓÚÑ«»]/.test(limpio)) mal.push(`texto en español: ${texto}`);
  }
  assert.deepEqual(mal.slice(0, 10), []);
});

test('las partidas en inglés terminan igual de bien que en español', () => {
  const motor = createEngine(loadData('en'));
  for (let semilla = 200; semilla < 260; semilla++) {
    const { state } = simular({ seed: semilla, jugadores: 5 + (semilla % 12), reparto: true, motor });
    assert.equal(state.phase, 'fin', `semilla ${semilla}`);
  }
});
