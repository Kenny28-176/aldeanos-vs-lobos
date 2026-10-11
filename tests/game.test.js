import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, ok, partida, hasta, enviar } from './fixtures.js';

const ROLES5 = ['lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano'];

// --- Sala y mazo -------------------------------------------------------

test('no deja empezar si el mazo no cuadra con los jugadores', () => {
  let s = partida(['lobo', 'aldeano', 'aldeano']);
  s = ok(s, { type: 'unirse', id: 'j4', nombre: 'Cuarto' }).state;
  const r = engine.step(s, { type: 'empezar' });
  assert.equal(r.error.codigo, 'no_listo');
  assert.match(r.error.mensaje, /3 cartas y hay 4 jugadores/);
});

test('nombres repetidos no se aceptan', () => {
  let s = engine.newGame();
  s = ok(s, { type: 'unirse', id: 'x', nombre: 'Ana' }).state;
  assert.equal(engine.step(s, { type: 'unirse', id: 'y', nombre: 'ana' }).error.codigo, 'nombre_repetido');
});

test('asignar: rol fuera del mazo y cantidad excedida', () => {
  let s = engine.newGame();
  for (const id of ['a', 'b', 'c']) s = ok(s, { type: 'unirse', id, nombre: id }).state;
  s = ok(s, { type: 'configurar', mazo: { lobo: 1, aldeano: 2 } }).state;
  assert.equal(engine.step(s, { type: 'asignar', id: 'a', rol: 'vidente' }).error.codigo, 'no_en_mazo');
  s = ok(s, { type: 'asignar', id: 'a', rol: 'lobo' }).state;
  assert.equal(engine.step(s, { type: 'asignar', id: 'b', rol: 'lobo' }).error.codigo, 'excedido');
  assert.equal(engine.step(s, { type: 'asignar', id: 'zz', rol: 'lobo' }).error.codigo, 'jugador');
});

test('los celulares ya no registran su carta: la app la reparte', () => {
  assert.equal(engine.step(engine.newGame(), { type: 'registrar', id: 'a', rol: 'lobo' }).error.codigo, 'accion_desconocida');
});

test('no se pueden poner en el mazo roles sin implementar', () => {
  const s = engine.newGame();
  assert.equal(engine.step(s, { type: 'configurar', mazo: { inventado: 1 } }).error.codigo, 'rol');
});

test('el círculo solo se pide si hay roles que miran a sus vecinos', () => {
  const s = partida(ROLES5);
  assert.equal(engine.necesitaCirculo(s), false);
  assert.equal(engine.viewFor(s, 'j1').preguntarDerecha, false);
});

// --- Noche ---------------------------------------------------------------

test('la noche 1 empieza con anochecer y luego lobos', () => {
  let s = ok(partida(ROLES5), { type: 'empezar' }).state;
  assert.equal(s.phase, 'noche');
  assert.equal(s.current.tipo, 'anochecer');
  s = ok(s, { type: 'avanzar' }).state;
  assert.equal(s.current.tipo, 'lobos');
  assert.deepEqual(s.current.actores, ['j1']);
});

test('los lobos con unanimidad devoran a su víctima', () => {
  let s = ok(partida(['lobo', 'lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano']), { type: 'empezar' }).state;
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = enviar(s, 'j2', 'j3');
  const ev = [];
  s = hasta(s, 'debate', ev);
  assert.equal(s.players.j3.alive, false);
  const muerte = ev.find(e => e.tipo === 'muerte');
  assert.equal(muerte.causa, 'devorado');
  assert.equal(muerte.rol, 'aldeano');
});

test('los lobos sin acuerdo no matan a nadie', () => {
  let s = ok(partida(['lobo', 'lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano']), { type: 'empezar' }).state;
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = enviar(s, 'j2', 'j4');
  s = hasta(s, 'debate');
  assert.equal(s.ids.every(id => s.players[id].alive), true);
});

test('si un lobo no vota, no hay víctima', () => {
  let s = ok(partida(['lobo', 'lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano']), { type: 'empezar' }).state;
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = hasta(s, 'debate');
  assert.equal(s.players.j3.alive, true);
});

test('un lobo no puede elegir a otro lobo ni un aldeano votar en el turno de lobos', () => {
  let s = ok(partida(['lobo', 'lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano']), { type: 'empezar' }).state;
  s = hasta(s, 'lobos');
  assert.equal(engine.step(s, { type: 'enviar', id: 'j1', paso: s.current.id, eleccion: 'j2' }).error.codigo, 'opcion');
  assert.equal(engine.step(s, { type: 'enviar', id: 'j3', paso: s.current.id, eleccion: 'j4' }).error.codigo, 'no_te_toca');
});

test('una elección para un paso ya cerrado se ignora', () => {
  let s = ok(partida(ROLES5), { type: 'empezar' }).state;
  s = hasta(s, 'lobos');
  const viejo = s.current.id;
  s = ok(s, { type: 'avanzar' }).state;
  assert.equal(engine.step(s, { type: 'enviar', id: 'j1', paso: viejo, eleccion: 'j2' }).error.codigo, 'paso_viejo');
  assert.equal(engine.step(s, { type: 'avanzar', paso: viejo }).error.codigo, 'paso_viejo');
});

// --- Día -------------------------------------------------------------------

test('votación: el más votado es linchado y se revela su rol', () => {
  let s = ok(partida(ROLES5), { type: 'empezar' }).state;
  s = hasta(s, 'votacion');
  s = enviar(s, 'j2', 'j1');
  s = enviar(s, 'j3', 'j1');
  s = enviar(s, 'j1', 'j2');
  const r = ok(s, { type: 'avanzar' });
  assert.equal(r.state.players.j1.alive, false);
  // Si alguien gana, se pasa directo al final (la pantalla final muestra la votación).
  assert.equal(r.state.phase, 'fin');
  assert.equal(r.state.winner, 'aldea');
  assert.equal(engine.publicView(r.state).votacion.linchado, 'J1');
  const frases = engine.narrate(r.events, l => l[0]).map(f => f.texto);
  assert.ok(frases.includes('J1 era… ¡Hombre Lobo!'));
  assert.ok(frases.some(f => f.startsWith('¡La aldea ha ganado!')));
});

test('votación: empate → nadie es linchado', () => {
  let s = ok(partida(ROLES5), { type: 'empezar' }).state;
  s = hasta(s, 'votacion');
  s = enviar(s, 'j1', 'j2');
  s = enviar(s, 'j2', 'j1');
  const r = ok(s, { type: 'avanzar' });
  assert.equal(r.state.ultimaVotacion.motivo, 'empate');
  assert.ok(r.state.ids.every(id => r.state.players[id].alive));
  assert.equal(r.state.current.tipo, 'resultado');
});

test('votación: no se puede votar a uno mismo; se puede cambiar el voto', () => {
  let s = ok(partida(ROLES5), { type: 'empezar' }).state;
  s = hasta(s, 'votacion');
  assert.equal(engine.step(s, { type: 'enviar', id: 'j2', paso: s.current.id, eleccion: 'j2' }).error.codigo, 'opcion');
  s = enviar(s, 'j2', 'j3');
  s = enviar(s, 'j2', 'j4');
  assert.equal(s.inputs.j2, 'j4');
});

test('todosListos solo cuando votaron todos los vivos', () => {
  let s = ok(partida(['lobo', 'aldeano', 'aldeano']), { type: 'empezar' }).state;
  s = hasta(s, 'votacion');
  s = enviar(s, 'j1', 'j2');
  s = enviar(s, 'j2', 'j1');
  assert.equal(engine.todosListos(s), false);
  s = enviar(s, 'j3', 'j1');
  assert.equal(engine.todosListos(s), true);
});

test('tras el día vuelve la noche 2', () => {
  let s = ok(partida(ROLES5), { type: 'empezar' }).state;
  s = hasta(s, 'resultado');
  s = ok(s, { type: 'avanzar' }).state;
  assert.equal(s.current.tipo, 'anochecer');
  assert.equal(s.noche, 2);
});

// --- Victoria --------------------------------------------------------------

test('los lobos ganan cuando solo quedan lobos', () => {
  let s = ok(partida(['lobo', 'aldeano', 'aldeano']), { type: 'empezar' }).state;
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'votacion');
  s = enviar(s, 'j1', 'j3');
  const r = ok(s, { type: 'avanzar' }); // linchan a j3
  assert.equal(r.state.winner, 'lobos');
  assert.equal(r.state.phase, 'fin');
});

test('la victoria se detecta al amanecer, sin debate', () => {
  let s = ok(partida(['lobo', 'aldeano']), { type: 'unirse', id: 'j3', nombre: 'J3' }).state;
  s = ok(s, { type: 'configurar', mazo: { lobo: 1, aldeano: 2 } }).state;
  s = ok(s, { type: 'asignar', id: 'j3', rol: 'aldeano' }).state;
  s = ok(s, { type: 'empezar' }).state;
  // Día 1: linchan a un aldeano (j2)
  s = hasta(s, 'votacion');
  s = enviar(s, 'j1', 'j2');
  s = enviar(s, 'j3', 'j2');
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = hasta(s, 'amanecer');
  const r = ok(s, { type: 'avanzar' });
  assert.equal(r.state.winner, 'lobos');
  assert.equal(r.state.phase, 'fin');
});

// --- Vistas: nadie ve lo que no debe ---------------------------------------

test('vistas de noche: el aldeano ve "noche", el lobo ve sus opciones', () => {
  let s = ok(partida(['lobo', 'lobo', 'aldeano', 'aldeano', 'aldeano']), { type: 'empezar' }).state;
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  const aldeano = engine.viewFor(s, 'j3');
  assert.equal(aldeano.pantalla, 'noche');
  assert.equal(aldeano.rol.companeros, undefined);
  const lobo = engine.viewFor(s, 'j2');
  assert.equal(lobo.pantalla, 'accion');
  assert.deepEqual(lobo.companeros, [{ id: 'j1', nombre: 'J1', eligio: 'j3' }]);
  assert.deepEqual(lobo.opciones.map(o => o.id), ['j3', 'j4', 'j5']);
  const pub = engine.publicView(s);
  assert.equal(pub.paso.tipo, 'noche');
  assert.equal(JSON.stringify(pub).includes('lobo'), false);
});

test('vista pública de la sala no revela roles', () => {
  const s = partida(ROLES5);
  const pub = JSON.stringify(engine.publicView(s));
  assert.equal(pub.includes('Hombre Lobo'), false);
  assert.equal(pub.includes('"lobo"'), false);
});

test('el estado es serializable a JSON (Firebase)', () => {
  let s = ok(partida(ROLES5), { type: 'empezar' }).state;
  s = hasta(s, 'votacion');
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('revancha: mismos jugadores, sin cartas, de vuelta en la sala', () => {
  let s = ok(partida(ROLES5), { type: 'empezar' }).state;
  s = hasta(s, 'votacion');
  s = enviar(s, 'j2', 'j1');
  s = ok(s, { type: 'avanzar' }).state;
  assert.equal(s.phase, 'fin');
  s = ok(s, { type: 'revancha' }).state;
  assert.equal(s.phase, 'sala');
  assert.deepEqual(s.ids, ['j1', 'j2', 'j3', 'j4', 'j5']);
  assert.equal(s.players.j1.alive, true);
  assert.equal(s.players.j1.role, null);
  assert.equal(s.players.j1.rightId, 'j2');
  assert.deepEqual(s.config.mazo, { lobo: 1, aldeano: 4 });
  assert.equal(s.cementerio.length, 0);
});
