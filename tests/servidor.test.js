// Elección del servidor (producción o emulador local) y limpieza de salas viejas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizarEmulador, resolverServidor } from '../src/net/servidor.js';
import { firebaseConfig } from '../src/net/firebaseConfig.js';
import { planLimpieza } from '../src/net/limpieza.js';

test('el emulador solo admite direcciones locales o de red privada', () => {
  assert.deepEqual(analizarEmulador('127.0.0.1:9000'), { host: '127.0.0.1', puerto: 9000 });
  assert.deepEqual(analizarEmulador('localhost'), { host: 'localhost', puerto: 9000 });
  assert.deepEqual(analizarEmulador('192.168.1.20:9100'), { host: '192.168.1.20', puerto: 9100 });
  assert.deepEqual(analizarEmulador('10.0.0.5:9000'), { host: '10.0.0.5', puerto: 9000 });
  assert.deepEqual(analizarEmulador('172.16.4.4:9000'), { host: '172.16.4.4', puerto: 9000 });
  for (const malo of [null, '', 'servidor-ajeno.com:9000', '8.8.8.8:9000', '172.32.0.1:9000', '127.0.0.1:abc', 'a:1:2', 'localhost:1']) {
    assert.equal(analizarEmulador(malo), null, String(malo));
  }
});

test('sin emulador se usa el proyecto real y las rutas REST salen bien', () => {
  const s = resolverServidor(null);
  assert.equal(s.emulador, null);
  assert.equal(s.config, firebaseConfig);
  const base = firebaseConfig.databaseURL.replace(/\/+$/, '');
  assert.equal(s.urlRest('/rooms/ABCD/meta'), `${base}/rooms/ABCD/meta.json`);
  assert.equal(s.urlRest('rooms/ABCD/'), `${base}/rooms/ABCD.json`);
  assert.equal(s.urlRest('/rooms?shallow=true'), `${base}/rooms.json?shallow=true`);
  assert.equal(s.urlRest('/'), `${base}/.json`);
  assert.equal(s.conservar('https://x.es/player.html?sala=ABCD'), 'https://x.es/player.html?sala=ABCD');
});

test('con emulador se usa su dirección, el espacio de nombres y una configuración de pruebas', () => {
  const s = resolverServidor('127.0.0.1:9000');
  assert.deepEqual(s.emulador, { host: '127.0.0.1', puerto: 9000 });
  assert.equal(s.config.projectId, 'demo-lobos');
  assert.notEqual(s.config.databaseURL, firebaseConfig.databaseURL);
  assert.equal(s.urlRest('/rooms/ABCD'), 'http://127.0.0.1:9000/rooms/ABCD.json?ns=demo-lobos-default-rtdb');
  assert.equal(s.urlRest('/rooms?shallow=true'), 'http://127.0.0.1:9000/rooms.json?ns=demo-lobos-default-rtdb&shallow=true');
  const enlace = new URL(s.conservar('http://localhost:8080/public/player.html?sala=ABCD'));
  assert.equal(enlace.searchParams.get('sala'), 'ABCD');
  assert.equal(enlace.searchParams.get('emulador'), '127.0.0.1:9000');
});

test('una dirección de emulador no válida se ignora (y se usa el servidor real)', () => {
  const s = resolverServidor('servidor-ajeno.com:9000');
  assert.equal(s.emulador, null);
  assert.equal(s.config, firebaseConfig);
});

const DIA = 86_400_000;

test('limpieza: se borran las salas viejas y los restos, y se marcan las que no tienen fecha', () => {
  const ahora = 10 * DIA;
  const plan = planLimpieza({
    NUEVA: { claves: ['state', 'meta'], creada: ahora - DIA },
    VIEJA: { claves: ['state', 'meta'], creada: ahora - 3 * DIA },
    JUSTA: { claves: ['state', 'meta'], creada: ahora - 2 * DIA },
    ANTIGUA: { claves: ['state', 'public'], creada: null },
    RESTOS: { claves: ['presencia'], creada: null },
    VACIA: { claves: [] },
  }, ahora, 2);
  assert.deepEqual(plan.borrar.sort(), ['RESTOS', 'VACIA', 'VIEJA']);
  assert.deepEqual(plan.marcar, ['ANTIGUA']);
});

test('limpieza: sin salas no hay nada que hacer', () => {
  assert.deepEqual(planLimpieza({}, 123), { borrar: [], marcar: [] });
});
