import test from 'node:test';
import assert from 'node:assert/strict';
import { partida, ok, enviar, hasta } from './fixtures.js';

const empezar = (roles, opciones) => ok(partida(roles, 1, opciones), { type: 'empezar' }).state;
const avanzar = (s) => ok(s, { type: 'avanzar' }).state;
const vivo = (s, id) => s.players[id].alive;

test('Portador del Fuego: salva a la víctima y quema al lobo más cercano a la derecha', () => {
  // j1: lobo, j2: piromano, j3: aldeano, j4: aldeano, j5: aldeano
  let s = empezar(['lobo', 'piromano', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'piromano');
  s = enviar(s, 'j2', 'j3'); // Portador del Fuego quema a j3
  s = avanzar(s);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3'); // Lobo ataca a j3
  s = avanzar(s); // cierra lobos, abre amanecer
  s = avanzar(s); // cierra amanecer (donde j1 muere) y chequea victoria
  
  assert.equal(s.phase, 'fin');
  assert.equal(vivo(s, 'j1'), false);
  assert.equal(s.winner, 'aldea');
});

test('Cuervo: maldice a un jugador y este empieza con 2 votos en contra', () => {
  let s = empezar(['lobo', 'cuervo', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = avanzar(s); // muere j3
  s = hasta(s, 'cuervo');
  s = enviar(s, 'j2', 'j4'); // Cuervo maldice a j4
  s = avanzar(s);
  s = hasta(s, 'votacion');
  
  // Todos votan a j5, pero j4 recibe 2 votos iniciales.
  // Vivos: j1, j2, j4, j5. (4 vivos)
  // j1 y j2 votan a j5 (2 votos)
  // j4 vota a j1 (1 voto)
  // j5 vota a j4 (1 voto)
  s = enviar(s, 'j1', 'j5');
  s = enviar(s, 'j2', 'j5');
  s = enviar(s, 'j4', 'j1');
  s = enviar(s, 'j5', 'j4');
  s = avanzar(s);
  
  // Votos reales:
  // j5 tiene 2 votos.
  // j1 tiene 1 voto.
  // j4 tiene 1 + 2 (maldición) = 3 votos.
  // j4 debería ser linchado.
  assert.equal(s.ultimaVotacion.linchado, 'j4');
});
