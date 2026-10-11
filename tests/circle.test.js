import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCircle, walk, neighbors } from '../src/engine/circle.js';

const ids = ['a', 'b', 'c', 'd'];

test('círculo válido', () => {
  const r = buildCircle({ a: 'b', b: 'c', c: 'd', d: 'a' }, ids);
  assert.equal(r.ok, true);
  assert.deepEqual(r.order, ['a', 'b', 'c', 'd']);
});

test('falta una respuesta', () => {
  const r = buildCircle({ a: 'b', b: 'c', c: 'd' }, ids);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errores[0], { tipo: 'sin_respuesta', ids: ['d'] });
});

test('alguien se elige a sí mismo', () => {
  const r = buildCircle({ a: 'a', b: 'c', c: 'd', d: 'b' }, ids);
  assert.ok(r.errores.some(e => e.tipo === 'a_si_mismo'));
});

test('dos eligen a la misma persona', () => {
  const r = buildCircle({ a: 'b', b: 'c', c: 'b', d: 'a' }, ids);
  const e = r.errores.find(e => e.tipo === 'repetido');
  assert.equal(e.elegido, 'b');
  assert.deepEqual(e.ids, ['a', 'c']);
});

test('dos círculos separados', () => {
  const r = buildCircle({ a: 'b', b: 'a', c: 'd', d: 'c' }, ids);
  assert.equal(r.ok, false);
  assert.equal(r.errores[0].tipo, 'circulo_partido');
  assert.deepEqual(r.errores[0].ids, ['c', 'd']);
});

test('vecinos saltan a los muertos', () => {
  const order = ['a', 'b', 'c', 'd'];
  const players = { a: { alive: true }, b: { alive: false }, c: { alive: true }, d: { alive: true } };
  assert.deepEqual(neighbors(order, players, 'a'), { izquierda: 'd', derecha: 'c' });
  assert.deepEqual(neighbors(order, players, 'c'), { izquierda: 'a', derecha: 'd' });
});

test('walk con condición da la vuelta al círculo', () => {
  const order = ['a', 'b', 'c', 'd'];
  const players = { a: { alive: true, lobo: false }, b: { alive: true, lobo: true }, c: { alive: true }, d: { alive: true } };
  assert.equal(walk(order, players, 'c', 'izquierda', p => p.lobo), 'b');
  assert.equal(walk(order, players, 'c', 'derecha', p => p.lobo), 'b');
  assert.equal(walk(order, players, 'b', 'derecha', p => p.lobo), null);
});
