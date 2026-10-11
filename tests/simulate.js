// Simulador de partidas con jugadores falsos (sin red).
//   node tests/simulate.js            → una partida narrada en consola
//   node tests/simulate.js 7 12       → semilla 7, 12 jugadores
// Cada jugador falso actúa según lo que muestra su celular (su vista), con el mismo cerebro
// que los bots del modo ensayo. También lo usa sim.test.js para jugar cientos de partidas.
import { pathToFileURL } from 'node:url';
import { engine, ok } from './fixtures.js';
import { rngNext } from '../src/engine/rng.js';
import { decidirBot } from '../src/engine/bots.js';

const NOMBRES = ['Ana', 'Beto', 'Carla', 'Dani', 'Eva', 'Fede', 'Gema', 'Hugo', 'Inés', 'Juan', 'Kike', 'Lara', 'Mario', 'Nora', 'Óscar', 'Paula', 'Quique', 'Rosa'];
// Roles especiales que el simulador puede meter (los de grupo van todos o ninguno).
const ESPECIALES = Object.entries(engine.ctx.roles)
  .filter(([id, r]) => r.implementado && !['lobo', 'aldeano'].includes(id))
  .map(([id, r]) => ({ id, n: r.copias }));

// motor: el motor con el que se juega (por defecto, el español); con otro idioma se comprueba que no falte ningún texto.
export function simular({ seed = 1, jugadores = 8, lobos, especiales = true, narrar = false, ritmo, reparto = false, extra = 0, mazo: mazoFijo, motor = engine } = {}) {
  const ok = (estado, accion) => {
    const r = motor.step(estado, accion);
    if (r.error) throw new Error(`${accion.type}: ${r.error.mensaje}`);
    return r;
  };
  let semilla = seed;
  const azar = () => { const r = rngNext(semilla); semilla = r.seed; return r.value; };
  const elegir = l => l[Math.floor(azar() * l.length)];
  const barajar = l => l.map(x => [azar(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  const log = [];

  // Mazo: lobos + roles especiales al azar + aldeanos de relleno (hay 9 como máximo), o el mazo que se pida.
  if (mazoFijo) jugadores = Object.values(mazoFijo).reduce((a, b) => a + b, 0);
  const nLobos = lobos ?? Math.min(4, Math.max(1, Math.round(jugadores / 4), especiales ? 0 : jugadores - 9));
  const cartas = mazoFijo ? Object.entries(mazoFijo).flatMap(([r, k]) => Array(k).fill(r)) : Array(nLobos).fill('lobo');
  if (especiales && !mazoFijo) {
    const orden = barajar(ESPECIALES);
    const meter = e => { if (!cartas.includes(e.id) && cartas.length + e.n <= jugadores) cartas.push(...Array(e.n).fill(e.id)); };
    for (const e of orden) if (azar() < 0.6) meter(e);
    // Si faltan cartas especiales para no pasar de 9 aldeanos, se añaden más.
    for (const e of orden) if (jugadores - cartas.length > 9) meter(e);
  }
  while (cartas.length < jugadores) cartas.push('aldeano');
  if (cartas.filter(c => c === 'aldeano').length > 9) throw new Error('Demasiados aldeanos');
  const mazo = {};
  for (const c of cartas) mazo[c] = (mazo[c] ?? 0) + 1;
  // Cartas de más en el mazo (la app reparte un subconjunto): solo roles sueltos, nunca a medias los de grupo.
  for (let i = 0; i < extra; i++) {
    const libres = Object.entries(motor.ctx.roles).filter(([id, r]) => r.implementado && !r.grupo && (mazo[id] ?? 0) < r.copias).map(([id]) => id);
    if (!libres.length) break;
    const r = elegir(libres);
    mazo[r] = (mazo[r] ?? 0) + 1;
  }

  let s = motor.newGame({ sala: 'SIM', seed });
  const ids = Array.from({ length: jugadores }, (_, i) => ({ id: `j${i + 1}`, nombre: NOMBRES[i] ?? `Jugador ${i + 1}` }));
  for (const j of ids) s = ok(s, { type: 'unirse', ...j }).state;
  s = ok(s, { type: 'configurar', mazo, opciones: { alguacil: azar() < 0.7, riesgoNina: 0.3, explicarReglas: false, mostrarReparto: reparto, ...(ritmo ? { ritmo } : {}) } }).state;
  // Con `reparto`, la app reparte las cartas al azar (y se juega el paso de reparto); si no, se asignan a mano.
  if (!reparto) barajar(cartas).forEach((rol, i) => { s = ok(s, { type: 'asignar', id: ids[i].id, rol }).state; });
  s = ok(s, { type: 'asientos', orden: barajar(ids.map(j => j.id)) }).state;

  const salida = r => {
    for (const f of motor.narrate(r.events, elegir)) log.push(f.texto);
    return r.state;
  };
  s = salida(ok(s, { type: 'empezar' }));

  let pasos = 0;
  while (s.phase !== 'fin') {
    if (++pasos > 2000) throw new Error(`Partida infinita (semilla ${seed})`);
    const c = s.current;
    for (const id of c.actores) {
      for (const accion of decidirBot(motor.viewFor(s, id), azar)) {
        const r = motor.step(s, { ...accion, id, paso: c.id });
        // Un bot puede intentar algo que ya no vale (p. ej. cambiar algo bloqueado): se ignora.
        if (!r.error) s = r.state;
      }
    }
    if (c.tipo === 'resultado' && s.ultimaVotacion?.linchado) {
      log.push(`   (votos: ${Object.entries(s.ultimaVotacion.votos).map(([a, b]) => `${s.players[a].name}→${s.players[b].name}`).join(', ')})`);
    }
    s = salida(ok(s, { type: 'avanzar' }));
  }
  if (narrar) console.log(log.join('\n'));
  return { state: s, log, mazo };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [seed = '1', jugadores = '10'] = process.argv.slice(2);
  const { state, mazo } = simular({ seed: Number(seed), jugadores: Number(jugadores), narrar: true });
  console.log('\nMazo:', Object.entries(mazo).map(([r, n]) => `${r}×${n}`).join(', '));
  console.log('Reparto:', state.ids.map(id => `${state.players[id].name}=${state.players[id].role}${state.players[id].alive ? '' : '†'}`).join(', '));
  console.log('Ganador:', state.winner);
}
