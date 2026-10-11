// Errores de red con mensajes comprensibles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorServidor, MENSAJES_SERVIDOR, conTiempo } from '../src/net/errores.js';

test('una operación que sale bien devuelve su resultado', async () => {
  assert.equal(await conTiempo(async () => 42), 42);
});

test('un fallo cualquiera se convierte en «no se pudo conectar»', async () => {
  await assert.rejects(conTiempo(async () => { throw new Error('Client is offline'); }), e => {
    assert.ok(e instanceof ErrorServidor);
    assert.equal(e.motivo, 'red');
    assert.equal(e.message, MENSAJES_SERVIDOR.red);
    return true;
  });
});

test('un rechazo de las reglas se explica aparte', async () => {
  for (const error of [Object.assign(new Error('x'), { code: 'PERMISSION_DENIED' }), new Error('Permission denied')]) {
    await assert.rejects(conTiempo(async () => { throw error; }), e => e.motivo === 'permisos' && /reglas/.test(e.message));
  }
});

test('si el servidor no contesta a tiempo, se corta', async () => {
  const antes = Date.now();
  await assert.rejects(conTiempo(() => new Promise(() => {}), 60), e => e instanceof ErrorServidor && e.motivo === 'red');
  assert.ok(Date.now() - antes < 1000);
});

test('una operación síncrona que lanza también se captura', async () => {
  await assert.rejects(conTiempo(() => { throw new Error('boom'); }), ErrorServidor);
});
