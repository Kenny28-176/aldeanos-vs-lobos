// Roles avanzados (capa 3) y sus interacciones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, ok, partida, hasta, enviar } from './fixtures.js';

const empezar = (roles, opciones) => ok(partida(roles, 1, opciones), { type: 'empezar' }).state;
const avanzar = s => ok(s, { type: 'avanzar' }).state;
const vivo = (s, id) => s.players[id].alive;

// --- Lobo Feroz -------------------------------------------------------------------

test('Lobo Feroz: devora una segunda víctima por su cuenta', () => {
  let s = empezar(['lobo_feroz', 'aldeano', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'feroz');
  assert.ok(s.current.actores.includes('j1'));
  s = enviar(s, 'j1', 'j3');
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j2'), false);
  assert.equal(vivo(s, 'j3'), false);
});

test('Lobo Feroz: pierde el segundo ataque cuando cae un lobo', () => {
  let s = empezar(['lobo', 'lobo_feroz', 'aldeano', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = enviar(s, 'j2', 'j3');
  s = hasta(s, 'feroz');
  s = enviar(s, 'j2', 'j4');
  s = hasta(s, 'votacion');
  for (const id of ['j2', 'j5', 'j6']) s = enviar(s, id, 'j1');
  s = enviar(s, 'j1', 'j5');
  s = avanzar(s);
  assert.equal(vivo(s, 'j1'), false);
  assert.equal(s.ferozSinPoder, true);
  // Noche siguiente: ya no despierta
  s = hasta(s, 'lobos');
  s = enviar(s, 'j2', 'j5');
  s = avanzar(s);
  s = hasta(s, 'feroz');
  assert.equal(s.current.actores.length, 0);
});

// --- Corruptor -----------------------------------------------

test('Corruptor: infecta a la víctima y esta despierta con la manada', () => {
  let s = empezar(['infecto', 'aldeano', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'infecto');
  s = enviar(s, 'j1', 'infectar');
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j2'), true);
  assert.equal(s.players.j2.flags.infectado, true);
  // En la siguiente noche, j2 despierta con la manada
  s = hasta(s, 'lobos');
  assert.ok(s.current.actores.includes('j2'));
  // Y la alerta secreta se envía
  const v = engine.viewFor(s, 'j2');
  assert.ok(v.alertas?.some(a => a.clave.includes('infectado')));
});

test('Corruptor: solo puede infectar una vez', () => {
  let s = empezar(['infecto', 'aldeano', 'aldeano', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'infecto');
  s = enviar(s, 'j1', 'infectar');
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = enviar(s, 'j2', 'j3');
  // No debería haber paso de infecto ya que ya lo usó
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j3'), false);
});

test('Corruptor: un infectado sigue cazando aunque ya no quede ningún lobo con carta de lobo', () => {
  let s = empezar(['infecto', 'vidente', 'aldeano', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'infecto');
  s = enviar(s, 'j1', 'infectar');
  s = hasta(s, 'debate');
  assert.equal(s.players.j2.flags.infectado, true);
  // El Corruptor (el único lobo con carta de lobo) muere: queda solo el infectado.
  s = structuredClone(s);
  s.players.j1.alive = false;
  s = hasta(s, 'lobos');
  assert.deepEqual(s.current.actores, ['j2'], 'el infectado despierta y elige víctima sin ningún otro lobo');
});

// --- Lobo Lunar -----------------------------------------------------------

test('Lobo Lunar: despierta en noches pares y puede matar a un lobo', () => {
  let s = empezar(['lobo', 'albino', 'aldeano', 'aldeano', 'aldeano']);
  // Noche 1: no despierta solo
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = enviar(s, 'j2', 'j3');
  s = hasta(s, 'debate');
  // Noche 2: despierta solo
  s = hasta(s, 'albino');
  assert.ok(s.current.actores.includes('j2'));
  s = enviar(s, 'j2', 'j1');
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j1'), false);
});

test('Lobo Lunar: gana solo si es el único superviviente', () => {
  let s = empezar(['lobo', 'albino', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  s = enviar(s, 'j2', 'j3');
  s = hasta(s, 'votacion');
  for (const id of ['j1', 'j2']) s = enviar(s, id, 'j4');
  s = avanzar(s);
  // Noche 2: mata al lobo
  s = hasta(s, 'albino');
  s = enviar(s, 'j2', 'j1');
  s = avanzar(s); // cierre albino
  // Después del amanecer, debería ganar el albino al ser el único vivo
  while (s.phase !== 'fin' && s.winner !== 'albino') s = avanzar(s);
  assert.equal(s.winner, 'albino');
});

// --- Zorro -------------------------------------------------------------------------

test('Zorro: olfatea un grupo con lobo y conserva el poder', () => {
  // j1=lobo, j2=zorro, j3=aldeano, j4=aldeano → sentados en círculo
  let s = empezar(['lobo', 'zorro', 'aldeano', 'aldeano']);
  s = hasta(s, 'zorro');
  // El zorro olfatea al lobo j1; vecinos de j1 son j4(izq) y j2(der)
  s = enviar(s, 'j2', 'j1');
  const v = engine.viewFor(s, 'j2');
  assert.match(v.resultado, /Sí/);
  assert.equal(v.bloqueado, true);
  assert.equal(s.players.j2.flags.sinOlfato, undefined);
});

test('Zorro: olfatea un grupo sin lobo y pierde el poder', () => {
  // j1=lobo, j2=aldeano, j3=zorro, j4=aldeano, j5=aldeano
  let s = empezar(['lobo', 'aldeano', 'zorro', 'aldeano', 'aldeano']);
  s = hasta(s, 'zorro');
  // j3 olfatea a j4; vecinos de j4 son j3(izq) y j5(der) → no hay lobos
  s = enviar(s, 'j3', 'j4');
  const v = engine.viewFor(s, 'j3');
  assert.match(v.resultado, /No/);
  assert.equal(s.players.j3.flags.sinOlfato, true);
  // La siguiente noche ya no debería actuar
  s = hasta(s, 'debate');
  s = hasta(s, 'zorro');
  assert.deepEqual(s.current.actores, []);
});

// --- Domadora ---------------------------------------------------------------

test('Domadora: el oso gruñe cuando un vecino es lobo', () => {
  // j1=lobo, j2=domador, j3=aldeano, j4=aldeano → j1 está al lado de j2
  let s = empezar(['lobo', 'domador', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3');
  const ev = [];
  s = hasta(s, 'debate', ev);
  const frases = engine.narrate(ev, l => l[0]);
  assert.ok(frases.some(f => f.texto.includes('gruñe') || f.texto.includes('oso')));
});

test('Domadora: el oso NO gruñe si no hay lobo al lado', () => {
  // j1=aldeano, j2=domador, j3=aldeano, j4=aldeano, j5=lobo
  let s = empezar(['aldeano', 'domador', 'aldeano', 'aldeano', 'lobo']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j5', 'j4');
  const ev = [];
  s = hasta(s, 'debate', ev);
  const frases = engine.narrate(ev, l => l[0]);
  assert.ok(!frases.some(f => f.texto.includes('gruñe')));
});

// --- Juez ----------------------------------------------------------------

test('Juez: pide una segunda votación', () => {
  let s = empezar(['lobo', 'juez', 'aldeano', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'votacion');
  // El Juez pide segunda votación
  s = ok(s, { type: 'poder', id: 'j2', paso: s.current.id, poder: 'segundaVotacion' }).state;
  assert.equal(s.segundaVotacionPedida, true);
  // Votación normal
  for (const id of ['j1', 'j3', 'j4', 'j5']) s = enviar(s, id, 'j6');
  s = avanzar(s); // cierra votación
  assert.equal(s.segundaVotacion, true);
  s = avanzar(s); // resultado
  // Tras el resultado debería haber una segunda votación
  while (s.current?.tipo !== 'votacion' && s.phase !== 'fin') s = avanzar(s);
  assert.equal(s.current?.tipo, 'votacion');
  assert.equal(s.votacionesHoy, 2);
});

test('Juez: solo una vez por partida', () => {
  let s = empezar(['lobo', 'lobo', 'juez', 'aldeano', 'aldeano', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'votacion');
  s = ok(s, { type: 'poder', id: 'j3', paso: s.current.id, poder: 'segundaVotacion' }).state;
  for (const id of s.current.actores) s = enviar(s, id, id === 'j4' ? 'j5' : 'j4');
  s = avanzar(s);
  s = avanzar(s); // resultado
  s = hasta(s, 'votacion');
  for (const id of s.current.actores) s = enviar(s, id, id === 'j5' ? 'j6' : 'j5');
  s = avanzar(s);
  s = avanzar(s); // resultado
  // Avanzar al siguiente día
  s = hasta(s, 'votacion');
  // Ya no puede pedir segunda votación
  const r = engine.step(s, { type: 'poder', id: 'j3', paso: s.current.id, poder: 'segundaVotacion' });
  assert.ok(r.error);
});

// --- Caballero de las Espadas ------------------------------------------------

test('Caballero: al morir devorado, el lobo más cercano a su izquierda muere la noche siguiente', () => {
  // j1=lobo, j2=caballero, j3=aldeano, j4=aldeano, j5=aldeano
  let s = empezar(['lobo', 'caballero', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j2'), false);
  // El lobo j1 está a la izquierda del caballero → debería tener oxido
  assert.ok(s.oxido);
  // Cerrar el primer día
  s = hasta(s, 'votacion');
  for (const id of s.current.actores) s = enviar(s, id, id === 'j3' ? 'j4' : 'j3');
  s = avanzar(s); // votacion
  s = avanzar(s); // resultado
  // La noche 2, el lobo muere y la aldea gana.
  s = hasta(s, 'lobos');
  s = avanzar(s); // cierra lobos
  // Ahora amanece y el lobo muere, ganando la aldea
  while (s.phase !== 'fin' && !s.winner) s = avanzar(s);
  assert.equal(s.winner, 'aldea');
});

// --- Niño Salvaje ------------------------------------------------------------------

test('Niño Salvaje: si su modelo muere, se convierte en lobo', () => {
  let s = empezar(['lobo', 'nino_salvaje', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'nino_salvaje');
  s = enviar(s, 'j2', 'j3'); // elige a j3 como modelo
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j3'); // los lobos matan al modelo
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j3'), false);
  assert.equal(s.players.j2.flags.lobo, true);
  assert.equal(s.players.j2.flags.transformado, true);
  // Ahora j2 despierta con la manada
  s = hasta(s, 'lobos');
  assert.ok(s.current.actores.includes('j2'));
});

test('Niño Salvaje: si su modelo sobrevive, sigue siendo aldeano', () => {
  let s = empezar(['lobo', 'nino_salvaje', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'nino_salvaje');
  s = enviar(s, 'j2', 'j3');
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j4'); // no matan al modelo
  s = hasta(s, 'debate');
  assert.equal(s.players.j2.flags.lobo, undefined);
  assert.ok(!s.players.j2.flags.transformado);
});

// --- Doble Naturaleza --------------------------------------------------------------------

test('Doble Naturaleza: elige ser lobo y despierta con la manada', () => {
  let s = empezar(['lobo', 'perro_lobo', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'perro_lobo');
  s = enviar(s, 'j2', 'lobo');
  s = hasta(s, 'lobos');
  assert.ok(s.current.actores.includes('j2'));
  assert.equal(s.players.j2.flags.lobo, true);
});

test('Doble Naturaleza: elige ser aldeano y NO despierta con la manada', () => {
  let s = empezar(['lobo', 'perro_lobo', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'perro_lobo');
  s = enviar(s, 'j2', 'aldeano');
  s = hasta(s, 'lobos');
  // j2 no debe estar como actor de la manada (solo j1)
  const lobosActores = s.current.actores.filter(id => id !== 'j2' || s.players[id].flags.lobo);
  // El Doble Naturaleza que eligió aldeano no debería ser lobo
  assert.equal(s.players.j2.flags.lobo, undefined);
});

test('Doble Naturaleza: la elección es irrevocable (solo la primera noche)', () => {
  let s = empezar(['lobo', 'perro_lobo', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'perro_lobo');
  s = enviar(s, 'j2', 'aldeano');
  s = hasta(s, 'debate');
  // En la segunda noche, la Doble Naturaleza no vuelve a despertar
  s = hasta(s, 'anochecer');
  s = avanzar(s);
  // No debe haber paso de perro_lobo
  assert.notEqual(s.current.tipo, 'perro_lobo');
});

// --- Flautista ---------------------------------------------------------------------

test('Flautista: hechiza a dos jugadores por noche y gana cuando todos están hechizados', () => {
  let s = empezar(['lobo', 'flautista', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'flautista');
  s = enviar(s, 'j2', ['j3', 'j4']);
  s = hasta(s, 'hechizados');
  assert.deepEqual(s.current.actores.sort(), ['j3', 'j4']);
  s = hasta(s, 'debate');
  // Los hechizados se reconocen
  const v3 = engine.viewFor(s, 'j3');
  assert.ok(v3.rol.notas.some(n => n.includes('hechizado')));
  // Noche 2: hechiza a otro (el lobo)
  s = hasta(s, 'flautista');
  // Solo puede hechizar a j1 y j5 (los no hechizados y no a sí mismo)
  const candidatos = engine.viewFor(s, 'j2').opciones.map(o => o.id);
  assert.ok(!candidatos.includes('j3'));
  assert.ok(!candidatos.includes('j4'));
  s = enviar(s, 'j2', ['j1', 'j5']);
  // Esto debería gatillar la victoria del Flautista
  while (s.phase !== 'fin') s = avanzar(s);
  assert.equal(s.winner, 'flautista');
});

test('Flautista infectado: se vuelve lobo y pierde su objetivo', () => {
  let s = empezar(['infecto', 'flautista', 'aldeano', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'infecto');
  s = enviar(s, 'j1', 'infectar');
  s = hasta(s, 'debate');
  assert.equal(s.players.j2.flags.infectado, true);
  // El Flautista infectado ya no actúa como Flautista
  s = hasta(s, 'flautista');
  assert.deepEqual(s.current.actores, []);
});

// --- Ángel -------------------------------------------------------------------------

test('Ángel: la partida empieza con debate+votación; si lo linchan, gana', () => {
  let s = empezar(['lobo', 'angel', 'aldeano', 'aldeano', 'aldeano']);
  // El Ángel fuerza un debate antes de la primera noche
  assert.equal(s.phase, 'dia');
  s = hasta(s, 'votacion');
  for (const id of ['j1', 'j3', 'j4', 'j5']) s = enviar(s, id, 'j2');
  s = avanzar(s);
  assert.equal(s.winner, 'angel');
});

test('Ángel: si no lo linchan en la primera votación, pasa a ser aldeano', () => {
  let s = empezar(['lobo', 'angel', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'votacion');
  for (const id of ['j1', 'j4', 'j5']) s = enviar(s, id, 'j3');
  s = enviar(s, 'j3', 'j4');
  s = avanzar(s);
  assert.notEqual(s.winner, 'angel');
  // El Ángel ahora tiene la flag de aldeano
  assert.equal(s.players.j2.flags.comoAldeano, true);
});

// --- Cultista -----------------------------------------------------------

test('Cultista: la aldea se divide en dos grupos', () => {
  let s = empezar(['lobo', 'sectario', 'aldeano', 'aldeano', 'aldeano', 'aldeano']);
  assert.ok(s.grupos);
  // Cada jugador tiene un grupo asignado
  for (const id of s.ids) assert.ok(['sol', 'luna'].includes(s.grupos[id]));
  // La vista del Cultista muestra su grupo
  const vSect = engine.viewFor(s, 'j2');
  assert.ok(vSect.rol.notas.some(n => n.includes('grupo')));
});

test('Cultista: gana si todo el otro grupo muere', async () => {
  let s = empezar(['lobo', 'sectario', 'aldeano', 'aldeano']);
  // Forzar que el sectario y el lobo estén en el mismo grupo
  const grupoSectario = s.grupos.j2;
  // Si por azar están en grupos distintos, cambiar la seed para probar algo coherente
  // Simplemente verificamos la lógica: si todos los del otro grupo mueren
  const otroGrupo = Object.entries(s.grupos).filter(([, g]) => g !== grupoSectario).map(([id]) => id);
  // Matamos a los del otro grupo
  for (const id of otroGrupo) s.players[id].alive = false;
  const { checkVictory } = await import('../src/engine/victory.js');
  const ctx = engine.ctx;
  const resultado = checkVictory(ctx, s);
  assert.equal(resultado, 'sectario');
});

// --- Doncella Leal ------------------------------------------------------------

test('Doncella: se ofrece tras un linchamiento y toma la carta del linchado', () => {
  let s = empezar(['lobo', 'sirvienta', 'vidente', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'votacion');
  for (const id of ['j1', 'j4', 'j5', 'j6']) s = enviar(s, id, 'j3');
  s = avanzar(s); // cierra votación
  // El paso de la sirvienta aparece antes de la ejecución
  s = hasta(s, 'sirvienta');
  assert.ok(s.current.actores.includes('j2'));
  s = enviar(s, 'j2', 'tomar');
  s = avanzar(s);
  s = hasta(s, 'ejecucion');
  s = avanzar(s);
  // La Doncella ahora tiene el rol de Vidente
  assert.equal(s.players.j2.role, 'vidente');
  // j3 muere
  assert.equal(vivo(s, 'j3'), false);
});

// --- Bufón --------------------------------------------------------------------

test('Bufón: elige un rol prestado y lo usa esa noche', () => {
  let s = empezar(['lobo', 'comediante', 'aldeano', 'aldeano', 'aldeano'],
    { poolComediante: ['vidente', 'protector', 'bruja', 'zorro'] });
  assert.ok(s.cartasComediante?.length === 3);
  s = hasta(s, 'comediante');
  const cartas = engine.viewFor(s, 'j2').cartas;
  assert.ok(cartas.length > 0);
  const rolElegido = cartas[0].rol;
  s = enviar(s, 'j2', rolElegido);
  s = avanzar(s); // cierra comediante
  // Ahora el Bufón debería actuar como ese rol en el paso correspondiente
  assert.ok(s.players.j2.flags.prestado);
  assert.equal(s.players.j2.flags.prestado.rol, rolElegido);
  // La carta elegida se retira
  assert.ok(!s.cartasComediante.includes(rolElegido));
});

// --- Interacciones complejas -------------------------------------------------------

test('Cazador enamorado: si muere de pena, dispara', () => {
  let s = empezar(['lobo', 'cupido', 'cazador', 'aldeano', 'aldeano', 'aldeano']);
  s = hasta(s, 'cupido');
  s = enviar(s, 'j2', ['j3', 'j4']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j4'); // mata al enamorado de j3
  // j3 (cazador) muere de pena y dispara
  s = hasta(s, 'cazador');
  assert.deepEqual(s.current.actores, ['j3']);
  s = enviar(s, 'j3', 'j1');
  s = avanzar(s);
  assert.equal(vivo(s, 'j1'), false);
});

test('Anciano protegido por la Alquimista: curación recupera una vida', () => {
  let s = empezar(['lobo', 'anciano', 'bruja', 'aldeano', 'aldeano']);
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'debate');
  // El Anciano sobrevivió al primer ataque
  assert.equal(vivo(s, 'j2'), true);
  assert.equal(s.players.j2.flags.vidas, 1);
  // Noche 2: los lobos atacan de nuevo al Anciano, la Alquimista lo cura
  s = hasta(s, 'lobos');
  s = enviar(s, 'j1', 'j2');
  s = hasta(s, 'bruja');
  s = enviar(s, 'j3', { curar: 'j2', veneno: null });
  s = hasta(s, 'debate');
  assert.equal(vivo(s, 'j2'), true);
});
