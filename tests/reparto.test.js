// Reparto de cartas: la app reparte una carta secreta al azar a cada jugador al empezar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engine, ok, partida, hasta, enviar } from './fixtures.js';
import { expandirMazo } from '../src/engine/reparto.js';

// Sala con n jugadores (j1…jn), un mazo y ninguna carta asignada.
function sala(mazo, n, { seed = 1, opciones = {} } = {}) {
  let s = engine.newGame({ sala: 'TEST', seed });
  for (let i = 1; i <= n; i++) s = ok(s, { type: 'unirse', id: `j${i}`, nombre: `J${i}` }).state;
  s = ok(s, { type: 'configurar', mazo, opciones: { alguacil: false, ...opciones } }).state;
  for (let i = 1; i <= n; i++) s = ok(s, { type: 'derecha', id: `j${i}`, derechaId: `j${(i % n) + 1}` }).state;
  return s;
}
const roles = s => s.ids.map(id => s.players[id].role);
const cuenta = lista => lista.reduce((m, r) => ({ ...m, [r]: (m[r] ?? 0) + 1 }), {});

test('al empezar, cada jugador recibe una carta y se reparte exactamente el mazo', () => {
  const mazo = { lobo: 2, vidente: 1, bruja: 1, aldeano: 4 };
  const s = ok(sala(mazo, 8), { type: 'empezar' }).state;
  assert.ok(roles(s).every(Boolean));
  assert.deepEqual(cuenta(roles(s)), mazo);
});

test('el reparto es al azar pero reproducible con la misma semilla', () => {
  const mazo = { lobo: 2, vidente: 1, bruja: 1, cazador: 1, aldeano: 5 };
  const a = roles(ok(sala(mazo, 10, { seed: 7 }), { type: 'empezar' }).state);
  const b = roles(ok(sala(mazo, 10, { seed: 7 }), { type: 'empezar' }).state);
  assert.deepEqual(a, b);
  const distintos = new Set();
  for (let seed = 1; seed <= 30; seed++) distintos.add(roles(ok(sala(mazo, 10, { seed }), { type: 'empezar' }).state).join());
  assert.ok(distintos.size > 20, `solo ${distintos.size} repartos distintos en 30 semillas`);
});

test('la carta de cada jugador no se conoce hasta empezar', () => {
  const s = sala({ lobo: 1, aldeano: 3 }, 4);
  assert.ok(s.ids.every(id => s.players[id].role === null));
  assert.equal(engine.viewFor(s, 'j1').rol, null);
});

test('mazo mayor que los jugadores: se reparte un subconjunto, con grupos enteros y al menos un lobo', () => {
  const mazo = { lobo: 3, lobo_feroz: 1, dos_hermanas: 2, tres_hermanos: 3, vidente: 1, bruja: 1, aldeano: 4 };
  for (let seed = 1; seed <= 300; seed++) {
    const n = 5 + (seed % 7); // de 5 a 11 jugadores (el mazo tiene 15 cartas)
    const s = ok(sala(mazo, n, { seed }), { type: 'empezar' }).state;
    const r = roles(s);
    assert.equal(r.length, n);
    const c = cuenta(r);
    for (const [rol, k] of Object.entries(c)) assert.ok(k <= mazo[rol], `semilla ${seed}: demasiados ${rol}`);
    for (const g of ['dos_hermanas', 'tres_hermanos']) {
      assert.ok(!c[g] || c[g] === mazo[g], `semilla ${seed}: ${g} partido (${c[g]})`);
    }
    assert.ok(r.some(x => engine.ctx.roles[x].bando === 'lobos'), `semilla ${seed}: sin ningún lobo`);
  }
});

test('las cartas asignadas a mano se respetan y el resto se reparte', () => {
  let s = sala({ lobo: 1, vidente: 1, aldeano: 2 }, 4);
  s = ok(s, { type: 'asignar', id: 'j3', rol: 'lobo' }).state;
  s = ok(s, { type: 'empezar' }).state;
  assert.equal(s.players.j3.role, 'lobo');
  assert.deepEqual(cuenta(roles(s)), { lobo: 1, vidente: 1, aldeano: 2 });
});

test('los roles de grupo se juegan completos o no se juegan', () => {
  const s = sala({}, 3);
  assert.equal(engine.step(s, { type: 'configurar', mazo: { dos_hermanas: 1 } }).error.codigo, 'grupo');
  assert.equal(engine.step(s, { type: 'configurar', mazo: { tres_hermanos: 2 } }).error.codigo, 'grupo');
  ok(s, { type: 'configurar', mazo: { dos_hermanas: 2, tres_hermanos: 3 } });
  ok(s, { type: 'configurar', mazo: { dos_hermanas: 0 } });
});

test('empezar ya no pide que cada jugador registre su carta', () => {
  const s = sala({ lobo: 1, aldeano: 3 }, 4);
  assert.deepEqual(engine.problemasParaEmpezar(s), []);
  assert.deepEqual(engine.problemasParaEmpezar(sala({ lobo: 1, aldeano: 2 }, 4)).length, 1); // faltan cartas
});

// --- El paso de reparto ----------------------------------------------------------------

test('con pausa de reparto: todos miran su carta y la noche empieza cuando todos están listos', () => {
  let s = ok(partida(['lobo', 'vidente', 'aldeano', 'aldeano'], 1, { mostrarReparto: true }), { type: 'empezar' }).state;
  assert.equal(s.current.tipo, 'reparto');
  assert.equal(s.noche, 0);
  assert.deepEqual(s.current.actores, ['j1', 'j2', 'j3', 'j4']);
  const v = engine.viewFor(s, 'j2');
  assert.equal(v.pantalla, 'accion');
  assert.equal(v.accion, 'carta');
  assert.equal(v.rol.id, 'vidente');
  assert.equal(engine.puedeAcabar(s), false);
  for (const id of ['j1', 'j2', 'j3']) s = ok(s, { type: 'listo', id, paso: s.current.id }).state;
  assert.equal(engine.puedeAcabar(s), false); // falta uno
  s = ok(s, { type: 'listo', id: 'j4', paso: s.current.id }).state;
  assert.equal(engine.puedeAcabar(s), true);
  s = ok(s, { type: 'avanzar' }).state;
  assert.equal(s.current.tipo, 'anochecer');
  assert.equal(s.noche, 1);
});

test('el reparto acaba con «Listo» también en ritmo clásico', () => {
  let s = ok(partida(['lobo', 'aldeano', 'aldeano'], 1, { mostrarReparto: true, ritmo: 'clasico' }), { type: 'empezar' }).state;
  for (const id of s.ids) s = ok(s, { type: 'listo', id, paso: s.current.id }).state;
  assert.equal(engine.puedeAcabar(s), true);
});

test('sin pausa de reparto: la partida empieza directamente en la noche', () => {
  const s = ok(partida(['lobo', 'aldeano', 'aldeano'], 1, { mostrarReparto: false }), { type: 'empezar' }).state;
  assert.equal(s.current.tipo, 'anochecer');
});

test('los anuncios del Bufón y del Cultista se hacen al acabar el reparto', () => {
  let s = ok(partida(['lobo', 'comediante', 'sectario', 'aldeano', 'aldeano'], 1, { mostrarReparto: true }), { type: 'empezar' }).state;
  assert.ok(s.cartasComediante?.length === 3);
  assert.ok(s.grupos);
  const r = ok(s, { type: 'avanzar' });
  const frases = engine.narrate(r.events, l => l[0]).map(f => f.texto).join(' ');
  assert.match(frases, new RegExp(`${engine.ctx.roles.comediante.nombre} podrá interpretar`));
  assert.match(frases, /Grupo del Sol/);
});

test('con el Ángel, tras el reparto viene el día previo a la primera noche', () => {
  let s = ok(partida(['lobo', 'angel', 'aldeano', 'aldeano', 'aldeano'], 1, { mostrarReparto: true, alguacil: true }), { type: 'empezar' }).state;
  assert.equal(s.current.tipo, 'reparto');
  const r = ok(s, { type: 'avanzar' });
  s = r.state;
  assert.equal(s.current.tipo, 'alguacil');
  assert.equal(s.dia, 0);
  assert.equal(s.noche, 0);
  assert.match(engine.narrate(r.events, l => l[0]).map(f => f.texto).join(' '), /Un Ángel( Celestial)? ha bajado/);
});

test('un Ángel que está en el mazo pero no se reparte no provoca el día previo', () => {
  // 3 jugadores, mazo de 4 cartas: probamos semillas hasta ver una en la que el Ángel queda fuera.
  let visto = false;
  for (let seed = 1; seed <= 40 && !visto; seed++) {
    const s = ok(sala({ lobo: 1, angel: 1, aldeano: 2 }, 3, { seed, opciones: { mostrarReparto: false } }), { type: 'empezar' }).state;
    if (!roles(s).includes('angel')) {
      visto = true;
      assert.equal(s.current.tipo, 'anochecer');
    }
  }
  assert.ok(visto, 'ninguna semilla dejó fuera al Ángel');
});

test('la revancha deja a todos sin carta y con el mismo mazo', () => {
  let s = ok(partida(['lobo', 'aldeano', 'aldeano'], 1, { mostrarReparto: false }), { type: 'empezar' }).state;
  s = ok(s, { type: 'abortar' }).state;
  s = ok(s, { type: 'revancha' }).state;
  assert.equal(s.phase, 'sala');
  assert.ok(s.ids.every(id => s.players[id].role === null));
  assert.deepEqual(s.config.mazo, { lobo: 1, aldeano: 2 });
  s = ok(s, { type: 'empezar' }).state;
  assert.deepEqual(cuenta(roles(s)), { lobo: 1, aldeano: 2 });
});

test('expandirMazo ignora cantidades no positivas', () => {
  assert.deepEqual(expandirMazo({ lobo: 2, vidente: 0, aldeano: -1 }), ['lobo', 'lobo']);
});

// --- Regresión: el rol prestado al Bufón despierta esa noche ----------------------------

test('Bufón: el rol que elige tiene su paso esa noche, en su sitio del orden', () => {
  let s = ok(partida(['lobo', 'comediante', 'aldeano', 'aldeano', 'aldeano'], 1, { poolComediante: ['vidente', 'protector', 'bruja', 'zorro'] }), { type: 'empezar' }).state;
  s = hasta(s, 'comediante');
  const elegido = engine.viewFor(s, 'j2').cartas.find(c => c.rol === 'vidente' || c.rol === 'protector' || c.rol === 'zorro').rol;
  s = enviar(s, 'j2', elegido);
  const pasos = [];
  while (s.phase === 'noche') { s = ok(s, { type: 'avanzar' }).state; pasos.push(s.current?.tipo); }
  assert.ok(pasos.includes(elegido), `el paso ${elegido} no apareció: ${pasos.join(' → ')}`);
  assert.ok(pasos.indexOf(elegido) < pasos.indexOf('lobos'), 'el paso prestado debe ir antes de los lobos');
});
