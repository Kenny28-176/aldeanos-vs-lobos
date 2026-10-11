import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simular } from './simulate.js';
import { engine } from './fixtures.js';
import { esLobo } from '../src/engine/helpers.js';

// Comprueba que el final de una partida es coherente con las reglas.
function comprobar(s, etiqueta) {
  assert.equal(s.phase, 'fin', etiqueta);
  const p = id => s.players[id];
  const hay = rol => s.ids.some(id => p(id).role === rol);
  const vivos = s.ids.filter(id => p(id).alive);
  const lobosVivos = vivos.filter(id => esLobo(engine.ctx, p(id)));
  const g = s.winner;
  if (g === 'aldea') assert.equal(lobosVivos.length, 0, `${etiqueta}: gana la aldea con lobos vivos`);
  if (g === 'lobos') {
    assert.equal(lobosVivos.length, vivos.length, `${etiqueta}: ganan los lobos con aldeanos vivos`);
    assert.ok(!vivos.some(id => p(id).role === 'albino'), `${etiqueta}: ganan los lobos con el Albino vivo`);
  }
  if (g === 'nadie') assert.equal(vivos.length, 0, etiqueta);
  if (g === 'enamorados') {
    assert.equal(vivos.length, 2, etiqueta);
    assert.equal(p(vivos[0]).flags.enamorado, vivos[1], etiqueta);
  }
  if (g === 'albino') assert.deepEqual(vivos.map(id => p(id).role), ['albino'], etiqueta);
  if (g === 'flautista') {
    const f = vivos.find(id => p(id).role === 'flautista');
    assert.ok(f, `${etiqueta}: gana el Flautista muerto`);
    assert.ok(vivos.every(id => id === f || p(id).flags.hechizado), `${etiqueta}: gana el Flautista sin hechizar a todos`);
  }
  if (g === 'sectario') {
    const sec = vivos.find(id => p(id).role === 'sectario');
    assert.ok(sec, `${etiqueta}: gana el Sectario muerto`);
    assert.ok(vivos.every(id => s.grupos[id] === s.grupos[sec]), `${etiqueta}: el otro grupo sigue vivo`);
  }
  if (g === 'angel') {
    const angel = s.ids.find(id => p(id).role === 'angel');
    assert.ok(angel && !p(angel).alive, `${etiqueta}: gana el Ángel sin morir`);
  }
  // Solo el Lobo Lunar devora lobos.
  if (!hay('albino')) {
    assert.ok(!s.cementerio.some(m => m.causa === 'devorado' && esLobo(engine.ctx, p(m.id))), `${etiqueta}: un lobo devorado sin Albino`);
  }
  // Nadie muere dos veces y los muertos son exactamente los del cementerio.
  assert.equal(new Set(s.cementerio.map(m => m.id)).size, s.cementerio.length, etiqueta);
  assert.equal(s.cementerio.length, s.ids.length - vivos.length, etiqueta);
  // Sin Bufón ni Doncella (que pueden tener otra poción de muerte), un solo veneno.
  if (!hay('comediante') && !hay('sirvienta') && !s.cronica.some(c => c.texto.includes(engine.ctx.roles.sirvienta.nombre))) {
    assert.ok(s.cementerio.filter(m => m.causa === 'envenenado').length <= 1, `${etiqueta}: dos venenos`);
  }
}

test('300 partidas solo con lobos y aldeanos terminan bien', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const { state } = simular({ seed, jugadores: 4 + (seed % 10), especiales: false });
    comprobar(state, `semilla ${seed}`);
  }
});

test('800 partidas con todos los roles al azar terminan bien (ritmo rápido)', () => {
  const ganadores = {};
  for (let seed = 1; seed <= 800; seed++) {
    const { state } = simular({ seed, jugadores: 5 + (seed % 14) });
    comprobar(state, `semilla ${seed}`);
    ganadores[state.winner] = (ganadores[state.winner] ?? 0) + 1;
  }
  // Deben salir varios desenlaces distintos.
  assert.ok(ganadores.aldea > 0 && ganadores.lobos > 0, JSON.stringify(ganadores));
});

test('200 partidas con todos los roles en ritmo clásico terminan bien', () => {
  for (let seed = 1001; seed <= 1200; seed++) {
    const { state } = simular({ seed, jugadores: 5 + (seed % 14), ritmo: 'clasico' });
    comprobar(state, `semilla ${seed}`);
  }
});

test('300 partidas con reparto al azar (con y sin cartas de más en el mazo) terminan bien', () => {
  for (let seed = 2001; seed <= 2300; seed++) {
    const { state } = simular({ seed, jugadores: 4 + (seed % 12), reparto: true, extra: seed % 4 });
    comprobar(state, `semilla ${seed}`);
    // Con el reparto, los jugadores empiezan sin carta y todos acaban teniendo una.
    assert.ok(state.ids.every(id => state.players[id].role), `semilla ${seed}`);
  }
});

test('la misma semilla da la misma partida', () => {
  assert.deepEqual(simular({ seed: 42 }).log, simular({ seed: 42 }).log);
});
