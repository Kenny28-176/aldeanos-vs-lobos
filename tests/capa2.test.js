// Roles clásicos (capa 2) y sus interacciones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, ok, partida, hasta, enviar } from './fixtures.js';

const empezar = (roles, opciones) => ok(partida(roles, 1, opciones), { type: 'empezar' }).state;
const avanzar = s => ok(s, { type: 'avanzar' }).state;
const vivo = (s, id) => s.players[id].alive;

// --- Vidente ---------------------------------------------------------------

test('Vidente: ve la carta al elegir y no puede cambiar', () => {
  let s = empezar(['lobo', 'vidente', 'aldeano', 'aldeano']);
  s = hasta(s, 'vidente');
  s = enviar(s, 'j2', 'j1');
  const v = engine.viewFor(s, 'j2');
  assert.equal(v.resultado, 'J1 es… Hombre Lobo');
  assert.equal(v.bloqueado, true);
  assert.equal(engine.step(s, { type: 'enviar', id: 'j2', paso: s.current.id, eleccion: 'j3' }).error.codigo, 'bloqueado');
  s = hasta(s, 'debate');
  assert.ok(engine.viewFor(s, 'j2').rol.notas.some(n => n.includes('J1 es Hombre Lobo')));
});

// --- Guardián -------------------------------------------------------------

test('Guardián: salva a la víctima y no repite protegido', () => {
  let s = empezar(['lobo', 'protector', 'aldeano', 'aldeano']);
  s = hasta(s, 'protector');
  s = enviar(s, 'j2', 'j3');
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j3'), true);
  s = hasta(s, 'protector');
  assert.equal(engine.step(s, { type: 'enviar', id: 'j2', paso: s.current.id, eleccion: 'j3' }).error.codigo, 'opcion');
  s = enviar(s, 'j2', 'j2'); // a sí mismo sí
});

// --- Alquimista -----------------------------------------------------------------

test('Alquimista: cura a la víctima, envenena a otro y cada poción es de un solo uso', () => {
  let s = empezar(['lobo', 'bruja', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = hasta(s, 'bruja');
  assert.deepEqual(engine.viewFor(s, 'j2').victima, { id: 'j3', nombre: 'J3' });
  s = enviar(s, 'j2', { curar: true, veneno: 'j4' });
  const ev = [];
  s = hasta(s, 'debate', ev);
  assert.equal(vivo(s, 'j3'), true);
  assert.equal(vivo(s, 'j4'), false);
  // De cara al público, una muerte nocturna no dice si fue veneno.
  assert.equal(engine.publicView(s).muertos[0].causa, 'noche');
  assert.ok(engine.narrate(ev, l => l[0]).some(f => f.texto === 'J4 no ha sobrevivido a la noche.'));
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = hasta(s, 'bruja');
  const v = engine.viewFor(s, 'j2');
  assert.equal(v.pocionVida, false);
  assert.equal(engine.step(s, { type: 'enviar', id: 'j2', paso: s.current.id, eleccion: { curar: true } }).error.codigo, 'opcion');
});

test('Alquimista: puede curarse a sí misma', () => {
  let s = empezar(['lobo', 'bruja', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'bruja');
  s = enviar(s, 'j2', { curar: true, veneno: null });
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j2'), true);
});

// --- Espía Silenciosa ------------------------------------------------------------

test('Espía: al espiar ve a un lobo', () => {
  let s = empezar(['lobo', 'nina', 'aldeano', 'aldeano'], { riesgoNina: 0 });
  s = hasta(s, 'lobos');
  assert.ok(s.current.actores.includes('j2'));
  s = enviar(s, 'j2', 'espiar');
  assert.equal(engine.viewFor(s, 'j2').resultado, 'Has visto a J1: ¡es un Hombre Lobo!');
  // Los lobos no la ven como compañera.
  assert.deepEqual(engine.viewFor(s, 'j1').companeros, []);
  s = enviar(s, 'j1', 'j3');
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j2'), true);
  assert.equal(vivo(s, 'j3'), false);
});

test('Espía descubierta: muere en lugar de la víctima y el Guardián no la salva', () => {
  let s = empezar(['lobo', 'nina', 'protector', 'aldeano', 'aldeano'], { riesgoNina: 1 });
  s = hasta(s, 'protector');
  s = enviar(s, 'j3', 'j2');
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j4');
  s = enviar(s, 'j2', 'espiar');
  assert.equal(engine.viewFor(s, 'j2').descubierta, true);
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j2'), false);
  assert.equal(vivo(s, 'j4'), true);
});

// --- Arquero del Amor y enamorados -----------------------------------------------------

test('Enamorados: si uno muere, el otro muere de pena', () => {
  let s = empezar(['lobo', 'cupido', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'cupido');
  assert.equal(engine.step(s, { type: 'enviar', id: 'j2', paso: s.current.id, eleccion: ['j3', 'j3'] }).error.codigo, 'opcion');
  s = enviar(s, 'j2', ['j3', 'j4']);
  s = hasta(s, 'enamorados');
  assert.deepEqual(s.current.actores, ['j3', 'j4']);
  assert.match(engine.viewFor(s, 'j3').texto, /J4/);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  const ev = [];
  s = hasta(s, 'debate', ev);
  assert.equal(vivo(s, 'j4'), false);
  assert.ok(engine.narrate(ev, l => l[0]).some(f => f.texto === 'J4 muere de pena: no puede vivir sin J3.'));
});

test('Enamorados mixtos (lobo + aldeano): no pueden votarse y ganan si quedan solos', () => {
  let s = empezar(['lobo', 'cupido', 'aldeano', 'aldeano']);
  s = hasta(s, 'cupido');
  s = enviar(s, 'j2', ['j1', 'j3']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'votacion');
  assert.ok(!engine.viewFor(s, 'j1').opciones.some(o => o.id === 'j3'));
  s = enviar(s, 'j1', 'j4');
  s = enviar(s, 'j3', 'j4');
  s = avanzar(s);
  assert.equal(s.winner, 'enamorados');
  assert.equal(s.phase, 'fin');
});

// --- Cazador -------------------------------------------------------------------

test('Cazador devorado: dispara al amanecer y su disparo decide la victoria', () => {
  let s = empezar(['lobo', 'cazador', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'cazador');
  assert.deepEqual(s.current.actores, ['j2']);
  assert.equal(engine.viewFor(s, 'j2').pantalla, 'accion'); // muerto, pero actúa
  s = enviar(s, 'j2', 'j1');
  const r = ok(s, { type: 'avanzar' });
  assert.equal(r.state.players.j1.alive, false);
  assert.equal(r.state.winner, 'aldea');
});

test('Cazador linchado: dispara después de ver el resultado; la partida sigue', () => {
  let s = empezar(['lobo', 'lobo', 'cazador', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'votacion');
  for (const id of ['j1', 'j2', 'j4']) s = enviar(s, id, 'j3');
  s = avanzar(s);
  assert.equal(s.current.tipo, 'resultado');
  s = avanzar(s);
  assert.equal(s.current.tipo, 'cazador');
  s = enviar(s, 'j3', 'j1');
  s = avanzar(s);
  assert.equal(vivo(s, 'j1'), false);
  assert.equal(s.current.tipo, 'anochecer');
});

test('Cazador que no dispara a tiempo: no hay disparo', () => {
  let s = empezar(['lobo', 'cazador', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'cazador');
  const r = ok(s, { type: 'avanzar' });
  assert.equal(r.state.ids.filter(id => !r.state.players[id].alive).length, 1);
  assert.ok(engine.narrate(r.events, l => l[0]).some(f => f.texto.includes('no ha llegado a disparar')));
});

// --- Anciano -------------------------------------------------------------------

test('Anciano: sobrevive al primer ataque y muere al segundo', () => {
  let s = empezar(['lobo', 'anciano', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j2'), true);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j2'), false);
  assert.equal(s.aldeaSinPoderes, false); // lo mataron los lobos: no hay castigo
});

test('Anciano linchado: los aldeanos pierden sus poderes', () => {
  let s = empezar(['lobo', 'anciano', 'vidente', 'aldeano', 'aldeano']);
  s = hasta(s, 'votacion');
  for (const id of ['j1', 'j3', 'j4']) s = enviar(s, id, 'j2');
  s = hasta(s, 'lobos'); // Se salta el paso de vidente porque perdió sus poderes
  assert.equal(s.aldeaSinPoderes, true);
  assert.ok(engine.viewFor(s, 'j3').rol.notas.some(n => n.includes('perdido tus poderes')));
});

// --- Inocente del Pueblo ---------------------------------------------------------

test('Inocente del Pueblo: linchado se le indulta, pierde el voto; la segunda vez muere', () => {
  let s = empezar(['lobo', 'tonto', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'votacion');
  for (const id of ['j1', 'j3', 'j4']) s = enviar(s, id, 'j2');
  s = avanzar(s);
  assert.equal(vivo(s, 'j2'), true);
  assert.equal(s.players.j2.canVote, false);
  const j2 = engine.publicView(s).jugadores.find(j => j.id === 'j2');
  assert.equal(j2.rolPublico, 'El Inocente del Pueblo');
  assert.equal(engine.publicView(s).votacion.indultado, true);
  s = hasta(s, 'votacion');
  assert.ok(!s.current.actores.includes('j2'));
  for (const id of ['j1', 'j3', 'j4']) s = enviar(s, id, 'j2');
  s = avanzar(s);
  assert.equal(vivo(s, 'j2'), false);
});

// --- Chivo Expiatorio ------------------------------------------------------------

test('Chivo Expiatorio: paga el empate y elige quién vota la próxima vez', () => {
  let s = empezar(['lobo', 'cabeza_turco', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'votacion');
  s = enviar(s, 'j1', 'j3');
  s = enviar(s, 'j3', 'j1');
  s = avanzar(s);
  assert.equal(vivo(s, 'j2'), false);
  assert.equal(s.ultimaVotacion.motivo, 'chivo');
  s = avanzar(s); // resultado → chivo
  assert.equal(s.current.tipo, 'chivo');
  s = enviar(s, 'j2', ['j3', 'j4']);
  s = hasta(s, 'votacion');
  assert.deepEqual(s.current.actores, ['j3', 'j4']);
  s = avanzar(s);
  s = hasta(s, 'votacion');
  assert.equal(s.current.actores.length, 4); // solo duraba una votación
});

// --- Alguacil -------------------------------------------------------------------

test('Alguacil: se elige la 1.ª mañana y su voto vale doble', () => {
  let s = empezar(['lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano'], { alguacil: true });
  s = hasta(s, 'alguacil');
  for (const id of ['j1', 'j2', 'j3']) s = enviar(s, id, 'j2');
  s = enviar(s, 'j4', 'j3');
  s = hasta(s, 'votacion');
  assert.equal(s.alguacil, 'j2');
  assert.equal(engine.publicView(s).alguacil, 'J2');
  s = enviar(s, 'j2', 'j1'); // 2 votos
  s = enviar(s, 'j1', 'j3');
  s = enviar(s, 'j4', 'j3'); // 2 votos → empate, nadie
  s = avanzar(s);
  assert.equal(s.ultimaVotacion.conteo.j1, 2);
  assert.equal(s.ultimaVotacion.motivo, 'empate');
  // No se vuelve a elegir al día siguiente.
  s = hasta(s, 'debate');
  assert.ok(!s.queue.includes('alguacil'));
});

test('Alguacil muerto: designa sucesor (o se elige al azar si no lo hace)', () => {
  let s = empezar(['lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano'], { alguacil: true });
  s = hasta(s, 'alguacil');
  s = enviar(s, 'j2', 'j2');
  s = hasta(s, 'votacion');
  for (const id of ['j1', 'j3', 'j4']) s = enviar(s, id, 'j2');
  s = avanzar(s);
  s = avanzar(s); // resultado → sucesor
  assert.equal(s.current.tipo, 'sucesor');
  assert.equal(engine.viewFor(s, 'j2').pantalla, 'accion');
  s = enviar(s, 'j2', 'j4');
  s = avanzar(s);
  assert.equal(s.alguacil, 'j4');
});

test('Inocente del Pueblo Alguacil indultado: el cargo se pierde para siempre', () => {
  let s = empezar(['lobo', 'tonto', 'aldeano', 'aldeano', 'aldeano'], { alguacil: true });
  s = hasta(s, 'alguacil');
  s = enviar(s, 'j2', 'j2');
  s = hasta(s, 'votacion');
  for (const id of ['j1', 'j3', 'j4']) s = enviar(s, id, 'j2');
  s = avanzar(s);
  assert.equal(s.alguacil, null);
  assert.equal(s.alguacilPerdido, true);
  s = avanzar(s);
  assert.equal(s.current.tipo, 'anochecer'); // sin sucesor
});

// --- Hermanas, Aldeano de la Verdad -----------------------------------------------------

test('Los Susurros se reconocen la primera noche', () => {
  let s = empezar(['lobo', 'dos_hermanas', 'dos_hermanas', 'aldeano']);
  s = hasta(s, 'dos_hermanas');
  assert.deepEqual(s.current.actores, ['j2', 'j3']);
  const v = engine.viewFor(s, 'j2');
  assert.equal(v.accion, 'info');
  assert.match(v.texto, /J3/);
  s = hasta(s, 'debate');
  s = hasta(s, 'anochecer');
  s = avanzar(s);
  assert.notEqual(s.current.tipo, 'dos_hermanas'); // solo la 1.ª noche
});

test('Aldeano de la Verdad: su carta es pública desde el inicio', () => {
  const s = empezar(['lobo', 'aldeano_aldeano', 'aldeano']);
  const pub = engine.publicView(s);
  assert.equal(pub.jugadores.find(j => j.id === 'j2').rolPublico, 'El Aldeano de la Verdad');
  assert.equal(pub.jugadores.find(j => j.id === 'j1').rolPublico, undefined);
});

// --- Anti-deducción ---------------------------------------------------------------

test('Si un rol está muerto, su paso se salta (ya no hay anti-deducción)', () => {
  let s = empezar(['lobo', 'vidente', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2'); // j2 (vidente) muere
  s = hasta(s, 'anochecer'); // Esto será la segunda noche
  s = avanzar(s);
  // Al avanzar anochecer, el paso de vidente debería ser saltado porque j2 está muerto
  assert.equal(s.current.tipo, 'lobos'); // El siguiente paso en la lista para esta configuración es lobos
});
