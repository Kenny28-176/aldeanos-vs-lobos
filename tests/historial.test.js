// Historial de partidas: resumen, ganadores, lista acotada y estadísticas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, partida, ok } from './fixtures.js';
import { simular } from './simulate.js';
import { ganadoresDe, huella, resumirPartida, agregarPartida, estadisticas, MAX_PARTIDAS } from '../src/engine/historial.js';
import { esLobo } from '../src/engine/helpers.js';
import { leerHistorial, guardarPartida, borrarHistorial } from '../src/net/historial-local.js';

const ctx = engine.ctx;
const partidaSimulada = (seed, jugadores = 9) => simular({ seed, jugadores, reparto: true }).state;

test('el resumen de una partida es serializable y recoge a todos los jugadores', () => {
  const s = partidaSimulada(3);
  const r = resumirPartida(ctx, s, { fecha: '2026-10-11T00:00:00.000Z', duracionMin: 42 });
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
  assert.equal(r.ganador, s.winner);
  assert.equal(r.jugadores.length, s.ids.length);
  assert.equal(r.duracionMin, 42);
  assert.equal(r.noches, s.noche);
  for (const j of r.jugadores) assert.ok(j.nombre && ctx.roles[j.rol], 'jugador sin nombre o rol');
});

test('ganan los que corresponden según el resultado', () => {
  const vistos = new Set();
  for (let seed = 1; seed <= 150; seed++) {
    const s = partidaSimulada(seed, 6 + (seed % 12));
    const ganadores = ganadoresDe(ctx, s);
    vistos.add(s.winner);
    if (s.winner === 'aldea') {
      assert.ok(ganadores.length > 0);
      for (const id of ganadores) assert.ok(!esLobo(ctx, s.players[id]), `seed ${seed}: un lobo gana con la aldea`);
    }
    if (s.winner === 'lobos') {
      for (const id of ganadores) assert.ok(esLobo(ctx, s.players[id]), `seed ${seed}: un no lobo gana con los lobos`);
    }
    if (s.winner === 'nadie') assert.deepEqual(ganadores, []);
    // Nunca ganan jugadores repetidos ni desconocidos.
    assert.equal(new Set(ganadores).size, ganadores.length);
    for (const id of ganadores) assert.ok(s.ids.includes(id));
  }
  assert.ok(vistos.has('aldea') && vistos.has('lobos'), `solo se vieron: ${[...vistos]}`);
});

test('la huella es estable, y distinta para partidas distintas', () => {
  const a = partidaSimulada(5);
  assert.equal(huella(a), huella(structuredClone(a)));
  assert.notEqual(huella(a), huella(partidaSimulada(6)));
});

test('la lista no repite partidas, pone la más reciente primero y respeta el máximo', () => {
  const r1 = resumirPartida(ctx, partidaSimulada(1), { fecha: 'a' });
  const r2 = resumirPartida(ctx, partidaSimulada(2), { fecha: 'b' });
  let lista = agregarPartida([], r1);
  lista = agregarPartida(lista, r2);
  assert.deepEqual(lista.map(p => p.fecha), ['b', 'a']);
  assert.equal(agregarPartida(lista, r1), lista, 'una partida repetida no se vuelve a guardar');
  let larga = [];
  for (let i = 0; i < 12; i++) larga = agregarPartida(larga, { ...r1, huella: `h${i}`, fecha: String(i) }, 10);
  assert.equal(larga.length, 10);
  assert.equal(larga[0].fecha, '11');
  assert.equal(MAX_PARTIDAS, 100);
});

test('las estadísticas suman bien', () => {
  let lista = [];
  for (let seed = 1; seed <= 25; seed++) lista = agregarPartida(lista, resumirPartida(ctx, partidaSimulada(seed, 8), { duracionMin: 30 }));
  const e = estadisticas(lista);
  assert.equal(e.partidas, lista.length);
  assert.equal(Object.values(e.porGanador).reduce((a, b) => a + b, 0), lista.length);
  assert.equal(e.jugadoresMedios, 8);
  assert.equal(e.duracionMediaMin, 30);
  assert.equal(e.roles.reduce((a, r) => a + r.veces, 0), lista.length * 8);
  for (const r of e.roles) assert.ok(r.victorias <= r.veces);
  for (const j of e.jugadores) assert.ok(j.victorias <= j.partidas);
  // Ordenados de más a menos veces / victorias.
  for (let i = 1; i < e.roles.length; i++) assert.ok(e.roles[i - 1].veces >= e.roles[i].veces);
  for (let i = 1; i < e.jugadores.length; i++) assert.ok(e.jugadores[i - 1].victorias >= e.jugadores[i].victorias);
});

test('las estadísticas de una lista vacía no fallan', () => {
  const e = estadisticas([]);
  assert.equal(e.partidas, 0);
  assert.equal(e.duracionMediaMin, null);
  assert.deepEqual(e.roles, []);
});

test('una partida abortada se anota como tal y no cuenta en las estadísticas', () => {
  let s = partida(['lobo', 'aldeano', 'aldeano', 'vidente'], 5);
  s = ok(s, { type: 'empezar' }).state;
  s = ok(s, { type: 'abortar' }).state;
  assert.equal(s.phase, 'fin');
  const r = resumirPartida(ctx, s);
  assert.equal(r.abortada, true);
  const e = estadisticas([r, resumirPartida(ctx, partidaSimulada(8))]);
  assert.equal(e.partidas, 1);
  assert.equal(e.abortadas, 1);
});

test('dos partidas con los mismos roles y el mismo resultado no se confunden (cuenta el estado del azar)', () => {
  const a = partidaSimulada(21, 4);
  const b = structuredClone(a);
  b.rng += 1;
  assert.notEqual(huella(a), huella(b));
});

test('el historial local se guarda en el navegador, sin repetir, y soporta datos corruptos', () => {
  const memoria = {};
  const previo = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: k => memoria[k] ?? null, setItem: (k, v) => { memoria[k] = v; }, removeItem: k => { delete memoria[k]; } },
  });
  try {
    assert.deepEqual(leerHistorial(), []);
    const r1 = resumirPartida(ctx, partidaSimulada(1));
    const r2 = resumirPartida(ctx, partidaSimulada(2));
    guardarPartida(r1);
    guardarPartida(r2);
    assert.equal(guardarPartida(r1).length, 2, 'repetir una partida no la duplica');
    assert.deepEqual(leerHistorial().map(p => p.huella), [r2.huella, r1.huella]);
    memoria['lobos:historial'] = '{esto no es json';
    assert.deepEqual(leerHistorial(), []);
    memoria['lobos:historial'] = '{"no":"una lista"}';
    assert.deepEqual(leerHistorial(), []);
    guardarPartida(r1);
    borrarHistorial();
    assert.deepEqual(leerHistorial(), []);
  } finally {
    if (previo) Object.defineProperty(globalThis, 'localStorage', previo); else delete globalThis.localStorage;
  }
});
