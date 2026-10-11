import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearControlador } from '../src/net/tablet.js';
import { engine, partida } from './fixtures.js';
import { createEngine } from '../src/engine/index.js';
import { loadData } from './loadData.js';

// Firebase y reloj falsos.
function montar({ roles = ['lobo', 'aldeano', 'aldeano', 'aldeano'], hablando = () => false } = {}) {
  const escrituras = [];
  const reloj = { t: 1_000_000 };
  const io = { escribir: (sala, c) => escrituras.push(c), ahora: () => reloj.t };
  const narrado = [];
  const ctl = crearControlador({
    engine, sala: 'TEST', io, state: partida(roles), hablando,
    alNarrar: frases => narrado.push(...frases.map(f => f.texto)),
  });
  const pasar = ms => { reloj.t += ms; ctl.tick(); };
  return { ctl, io, reloj, escrituras, narrado, pasar };
}

test('los celulares no pueden empezar ni avanzar la partida', () => {
  const { ctl } = montar();
  ctl.desdeJugador({ type: 'empezar' });
  assert.equal(ctl.state.phase, 'sala');
});

test('un error de un jugador le llega como aviso', () => {
  const { ctl, escrituras } = montar();
  ctl.desdeJugador({ type: 'unirse', id: 'j2', nombre: 'J3' }); // J3 ya existe
  const aviso = escrituras.at(-1)['avisos/j2'];
  assert.match(aviso.texto, /Ya hay alguien llamado J3/);
});

test('el paso de los lobos dura su tiempo fijo aunque ya hayan votado', () => {
  const { ctl, pasar } = montar();
  ctl.aplicar({ type: 'empezar' });
  pasar(100);
  pasar(5000); // anochecer termina cuando calla la voz
  assert.equal(ctl.state.current.tipo, 'lobos');
  ctl.desdeJugador({ type: 'enviar', id: 'j1', paso: ctl.state.current.id, eleccion: 'j2' });
  pasar(10_000);
  assert.equal(ctl.state.current.tipo, 'lobos');
  pasar(ctl.state.current.duracion * 1000);
  assert.equal(ctl.state.current.tipo, 'amanecer');
  assert.equal(ctl.state.players.j2.alive, false);
});

test('el paso espera a que la voz termine', () => {
  let habla = true;
  const { ctl, pasar } = montar({ hablando: () => habla });
  ctl.aplicar({ type: 'empezar' });
  pasar(60_000);
  assert.equal(ctl.state.current.tipo, 'anochecer');
  habla = false;
  pasar(100);
  pasar(3000);
  assert.equal(ctl.state.current.tipo, 'lobos');
});

test('la votación se cierra 3 s después de que todos voten', () => {
  const { ctl, pasar } = montar();
  ctl.aplicar({ type: 'empezar' });
  while (ctl.state.current.tipo !== 'votacion') ctl.avanzar();
  const paso = ctl.state.current.id;
  for (const [id, a] of [['j1', 'j2'], ['j2', 'j1'], ['j3', 'j1'], ['j4', 'j1']]) {
    ctl.desdeJugador({ type: 'enviar', id, paso, eleccion: a });
  }
  pasar(100);
  assert.equal(ctl.state.current.tipo, 'votacion');
  pasar(3000);
  assert.equal(ctl.state.phase, 'fin'); // linchado el único lobo
  assert.equal(ctl.state.winner, 'aldea');
});

test('pausa, más tiempo y deshacer', () => {
  const { ctl, pasar } = montar();
  ctl.aplicar({ type: 'empezar' });
  ctl.avanzar(); // lobos
  ctl.pausar();
  pasar(10 * 60_000);
  assert.equal(ctl.state.current.tipo, 'lobos');
  ctl.masTiempo(30);
  ctl.reanudar();
  assert.equal(ctl.reloj.fin - ctl.reloj.inicio > 0, true);
  ctl.avanzar(); // amanecer
  assert.equal(ctl.state.current.tipo, 'amanecer');
  assert.equal(ctl.deshacer(), true);
  assert.equal(ctl.state.current.tipo, 'lobos');
});

test('solo se escribe lo que cambia', () => {
  const { ctl, escrituras } = montar();
  ctl.publicar();
  const n = escrituras.length;
  ctl.publicar();
  assert.equal(escrituras.length, n);
  ctl.desdeJugador({ type: 'derecha', id: 'j1', derechaId: 'j3' });
  const ultima = escrituras.at(-1);
  assert.ok(ultima['views/j1']);
  assert.equal(ultima['views/j2'], undefined);
});

test('el reloj del paso arranca cuando la voz termina de anunciarlo', () => {
  let habla = false;
  const { ctl, pasar } = montar({ hablando: () => habla });
  ctl.aplicar({ type: 'empezar' });
  pasar(100);
  pasar(3000); // termina el anochecer → abre lobos
  assert.equal(ctl.state.current.tipo, 'lobos');
  habla = true; // la voz dice "Hombres Lobo, despertad…"
  pasar(8000);
  assert.equal(ctl.reloj.arrancado, false);
  habla = false;
  pasar(100);
  assert.equal(ctl.reloj.arrancado, true);
  assert.equal(ctl.reloj.fin - ctl.reloj.inicio, ctl.state.current.duracion * 1000);
  pasar(ctl.state.current.duracion * 1000 - 500);
  assert.equal(ctl.state.current.tipo, 'lobos'); // los 8 s de voz no se descuentan
});

test('ritmo rápido: si todos están listos de noche, el paso acaba (pero nunca antes de 5 s)', () => {
  const { ctl, pasar } = montar();
  ctl.aplicar({ type: 'empezar' });
  pasar(100);
  pasar(3000);
  assert.equal(ctl.state.current.tipo, 'lobos');
  pasar(100); // arranca el reloj del paso
  const paso = ctl.state.current.id;
  ctl.desdeJugador({ type: 'enviar', id: 'j1', paso, eleccion: 'j2' });
  ctl.desdeJugador({ type: 'listo', id: 'j1', paso });
  pasar(2000);
  assert.equal(ctl.state.current.tipo, 'lobos'); // aún no han pasado 5 s
  pasar(3000);
  pasar(1600);
  assert.equal(ctl.state.current.tipo, 'amanecer');
});

test('el debate se salta cuando el 75 % pide votar', () => {
  const { ctl, pasar } = montar({ roles: ['lobo', 'aldeano', 'aldeano', 'aldeano'] });
  ctl.aplicar({ type: 'empezar' });
  while (ctl.state.current.tipo !== 'debate') ctl.avanzar();
  pasar(100);
  const paso = ctl.state.current.id;
  for (const id of ['j1', 'j2']) ctl.desdeJugador({ type: 'listo', id, paso });
  pasar(5000);
  assert.equal(ctl.state.current.tipo, 'debate'); // 2 de 4 no basta (hacen falta 3)
  ctl.desdeJugador({ type: 'listo', id: 'j3', paso });
  pasar(100);
  pasar(1600);
  assert.equal(ctl.state.current.tipo, 'votacion');
});

test('votación: abstenerse cuenta como listo', () => {
  const { ctl, pasar } = montar({ roles: ['lobo', 'aldeano', 'aldeano', 'aldeano'] });
  ctl.aplicar({ type: 'empezar' });
  while (ctl.state.current.tipo !== 'votacion') ctl.avanzar();
  pasar(100);
  const paso = ctl.state.current.id;
  ctl.desdeJugador({ type: 'enviar', id: 'j2', paso, eleccion: 'j1' });
  ctl.desdeJugador({ type: 'enviar', id: 'j3', paso, eleccion: 'j1' });
  ctl.desdeJugador({ type: 'listo', id: 'j1', paso }); // se abstiene
  pasar(1600);
  assert.equal(ctl.state.current.tipo, 'votacion'); // falta j4
  ctl.desdeJugador({ type: 'listo', id: 'j4', paso });
  pasar(100);
  pasar(1600);
  assert.equal(ctl.state.phase, 'fin');
  assert.equal(ctl.state.winner, 'aldea');
});

test('modo ensayo: los bots juegan solos hasta el final', () => {
  const { ctl, pasar } = montar({ roles: ['lobo', 'aldeano', 'aldeano', 'aldeano'] });
  // Convertimos a todos en bots.
  for (const id of ctl.state.ids) ctl.state.players[id].bot = true;
  ctl.aplicar({ type: 'empezar' });
  for (let i = 0; i < 4000 && ctl.state.phase !== 'fin'; i++) pasar(500);
  assert.equal(ctl.state.phase, 'fin');
});

test('la vista pública lleva el idioma de la tablet y, al cambiarlo, se vuelve a publicar todo traducido', () => {
  const motor = createEngine(loadData('es'));
  const escrituras = [];
  const ctl = crearControlador({ engine: motor, sala: 'TEST', io: { escribir: (sala, c) => escrituras.push(c), ahora: () => 1_000_000 }, state: partida(['lobo', 'aldeano', 'aldeano', 'aldeano']) });
  const ultima = clave => escrituras.findLast(c => clave in c)[clave];

  ctl.publicar(true);
  assert.equal(ultima('public').idioma, 'es');
  assert.match(JSON.stringify(ultima('views/j1')), /Hombre Lobo/);

  motor.usarDatos(loadData('en')); // la tablet cambia de idioma (así lo hace narrator.js)
  ctl.publicar(true);
  assert.equal(ultima('public').idioma, 'en', 'los celulares se enteran del idioma de la sala');
  assert.match(JSON.stringify(ultima('views/j1')), /Werewolf/);
  assert.doesNotMatch(JSON.stringify(ultima('views/j1')), /Hombre Lobo/, 'su carta ya no sale en español');
});
