// Asistente de mazo: propone mazos válidos, equilibrados y jugables para cualquier número de jugadores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine } from './fixtures.js';
import { simular } from './simulate.js';
import { sugerirMazo, numeroDeLobos, maxJugadores, NIVELES } from '../src/engine/mazo.js';
import { rngNext } from '../src/engine/rng.js';

const ctx = engine.ctx;
const NIVELES_TODOS = [...Object.keys(NIVELES), 'azar'];
const generador = semilla => () => { const r = rngNext(semilla); semilla = r.seed; return r.value; };
const suma = m => Object.values(m).reduce((a, b) => a + b, 0);

function comprobar(mazo, n, etiqueta) {
  assert.equal(suma(mazo), n, `${etiqueta}: ${suma(mazo)} cartas para ${n} jugadores`);
  for (const [rol, k] of Object.entries(mazo)) {
    const def = ctx.roles[rol];
    assert.ok(def, `${etiqueta}: rol desconocido ${rol}`);
    assert.ok(def.implementado && !def.requierePueblo, `${etiqueta}: ${rol} no se debe proponer`);
    assert.ok(Number.isInteger(k) && k >= 1 && k <= def.copias, `${etiqueta}: ${rol} ×${k}`);
    if (def.grupo) assert.equal(k, def.copias, `${etiqueta}: ${rol} partido`);
  }
  assert.ok(Object.keys(mazo).some(r => ctx.roles[r].bando === 'lobos'), `${etiqueta}: sin ningún lobo`);
}

test('todos los niveles dan mazos válidos de 3 a 42 jugadores', () => {
  for (let n = 3; n <= maxJugadores(ctx); n++) {
    for (const nivel of NIVELES_TODOS) {
      for (let semilla = 1; semilla <= 12; semilla++) {
        const { mazo } = sugerirMazo(ctx, n, nivel, generador(semilla * 97 + n));
        comprobar(mazo, n, `${nivel} n=${n} semilla=${semilla}`);
      }
    }
  }
});

test('los lobos son aproximadamente uno de cada cuatro jugadores', () => {
  assert.deepEqual([3, 4, 6, 7, 10, 11, 14, 15, 30].map(numeroDeLobos), [1, 1, 1, 2, 2, 3, 3, 4, 4]);
  for (const n of [8, 12, 16]) {
    const { mazo } = sugerirMazo(ctx, n, 'equilibrado', generador(3));
    const lobos = Object.entries(mazo).filter(([r]) => ctx.roles[r].bando === 'lobos').reduce((a, [, k]) => a + k, 0);
    assert.equal(lobos, numeroDeLobos(n));
  }
});

test('el nivel sencillo no pide sentarse en círculo y siempre lleva Vidente', () => {
  for (let n = 4; n <= 30; n++) {
    for (let semilla = 1; semilla <= 10; semilla++) {
      const { mazo } = sugerirMazo(ctx, n, 'sencillo', generador(n * 7 + semilla));
      for (const rol of Object.keys(mazo)) assert.ok(!ctx.roles[rol].usaVecinos, `n=${n}: ${rol} necesita asientos`);
      assert.ok(mazo.vidente, `n=${n}: sin Vidente`);
    }
  }
});

test('con el máximo de jugadores el mazo son todas las cartas utilizables', () => {
  const n = maxJugadores(ctx);
  const { mazo } = sugerirMazo(ctx, n, 'azar', generador(1));
  for (const [id, r] of Object.entries(ctx.roles)) {
    if (!r.implementado || r.requierePueblo) assert.ok(!mazo[id]);
    else assert.equal(mazo[id], r.copias, id);
  }
});

test('con pocos jugadores no aparecen roles sin sentido', () => {
  for (const nivel of NIVELES_TODOS) {
    for (let semilla = 1; semilla <= 40; semilla++) {
      const { mazo } = sugerirMazo(ctx, 5, nivel, generador(semilla));
      for (const rol of ['sectario', 'albino', 'infecto', 'lobo_feroz', 'flautista', 'dos_hermanas', 'tres_hermanos']) {
        assert.ok(!mazo[rol], `5 jugadores, ${nivel}: no debería haber ${rol}`);
      }
    }
  }
});

test('el asistente es reproducible con la misma semilla y varía con otras', () => {
  const a = sugerirMazo(ctx, 12, 'avanzado', generador(5)).mazo;
  const b = sugerirMazo(ctx, 12, 'avanzado', generador(5)).mazo;
  assert.deepEqual(a, b);
  const distintos = new Set();
  for (let semilla = 1; semilla <= 30; semilla++) distintos.add(JSON.stringify(sugerirMazo(ctx, 12, 'avanzado', generador(semilla)).mazo));
  assert.ok(distintos.size > 15, `solo ${distintos.size} mazos distintos`);
});

test('fuera de rango: pocos jugadores se tratan como 3 y muchos como el máximo', () => {
  assert.equal(suma(sugerirMazo(ctx, 1).mazo), 3);
  assert.equal(suma(sugerirMazo(ctx, 500).mazo), maxJugadores(ctx));
});

test('el motor acepta cada mazo propuesto y la partida se puede jugar hasta el final', () => {
  for (let n = 3; n <= 24; n++) {
    for (const nivel of NIVELES_TODOS) {
      const { mazo } = sugerirMazo(ctx, n, nivel, generador(n * 31 + nivel.length));
      const { state } = simular({ seed: n * 1000 + nivel.length, mazo, reparto: true });
      assert.equal(state.phase, 'fin', `${nivel} n=${n}`);
      assert.equal(state.ids.length, n);
    }
  }
});
