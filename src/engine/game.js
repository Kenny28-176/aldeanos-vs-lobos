// Máquina de estados de la partida. Todo es puro: step(estado, acción) → { state, events, error }.
// El estado es JSON plano (se guarda tal cual en Firebase). La tablet es quien llama a step().
import { buildCircle } from './circle.js';
import { STEPS, INTERRUPCIONES, DIFIEREN_INTERRUPCIONES, pasosDelDia } from './steps.js';
import { enMazo, hayRol, FLAGS_INICIALES, POOL_COMEDIANTE, actuanComo } from './helpers.js';
import { checkVictory } from './victory.js';
import { shuffle, random } from './rng.js';
import { repartirCartas } from './reparto.js';
import { prepararRoles, anunciosIniciales } from './preparativos.js';

// Segundos por tipo de paso (configurables por sala).
export const DURACIONES = {
  paso: 25, corto: 10, lobos: 50,
  anochecer: 8, amanecer: 20, debate: 180, votacion: 60, resultado: 15, interrupcion: 30,
  sirvienta: 12, ejecucion: 10, reparto: 60,
};

const nuevoJugador = (id, nombreJ, bot = false) => ({
  id, name: nombreJ, role: null, rightId: null,
  alive: true, canVote: true, flags: {}, edificio: null, fichas: [], ...(bot ? { bot: true } : {}),
});

const err = (state, codigo, mensaje) => ({ state, events: [], error: { codigo, mensaje } });

export function newGame(ctx, { sala, seed = Date.now() } = {}) {
  return {
    v: 1,
    sala: sala ?? null,
    rng: seed >>> 0,
    phase: 'sala', // sala → noche ⇄ dia → fin
    config: {
      mazo: {}, duraciones: { ...DURACIONES }, alguacil: true, riesgoNina: 0.2,
      poolComediante: [...POOL_COMEDIANTE], explicarReglas: false, muertosVenTodo: false,
      // Pausa inicial para que cada jugador mire su carta (la app reparte las cartas al azar).
      mostrarReparto: true,
      // 'rapido': se puede saltar la espera cuando todos están listos; 'clasico': tiempos fijos.
      ritmo: 'rapido',
    },
    ids: [],
    players: {},
    order: [],
    noche: 0,
    dia: 0,
    queue: [],
    current: null,
    seq: 0,
    inputs: {},
    listos: {}, // quién ha pulsado «Listo» en el paso actual (o «Pasar a votar» en el debate)
    nocheActual: null,
    cementerio: [],
    ultimaVotacion: null,
    interrupciones: [], // pasos que se abren tras una muerte (Cazador, sucesor…)
    alguacil: null,
    alguacilElegido: false,
    alguacilPerdido: false, // el Inocente del Pueblo Alguacil indultado pierde el cargo para siempre
    votantesProximos: null, // los que eligió el Chivo Expiatorio
    aldeaSinPoderes: false,
    votaciones: 0, // votaciones hechas en toda la partida (la 1.ª decide al Ángel)
    votacionesHoy: 0,
    segundaVotacionPedida: false, // el Juez pulsó su botón en la votación en curso
    segundaVotacion: false, // toca una 2.ª votación tras la actual
    linchamiento: null, // linchado pendiente de la Doncella
    ferozSinPoder: false,
    oxido: null, // { id, noche } lobo que morirá por la espada del Caballero
    grupos: null, // Cultista: { idJugador: 'sol' | 'luna' }
    cartasComediante: null,
    ganadorForzado: null,
    cronica: [],
    winner: null,
  };
}

// ¿Hace falta el círculo de asientos? Solo si hay roles que miran a sus vecinos.
export const necesitaCirculo = (ctx, s) =>
  Object.keys(s.config.mazo).some(r => enMazo(s, r) && ctx.roles[r]?.usaVecinos);

export function step(ctx, state, action) {
  const s = structuredClone(state);
  const events = [];
  const fn = ACCIONES[action?.type];
  if (!fn) return err(state, 'accion_desconocida', ctx.t('motor.error.accion_desconocida', { tipo: String(action?.type) }));
  const error = fn(ctx, s, action, events);
  if (error) return err(state, error.codigo, error.mensaje);
  return { state: s, events, error: null };
}

const ACCIONES = {
  unirse(ctx, s, { id, nombre: n, bot }) {
    if (s.phase !== 'sala') return { codigo: 'en_juego', mensaje: ctx.t('motor.error.ya_empezo') };
    n = String(n ?? '').trim().slice(0, 20);
    if (!id || !n) return { codigo: 'datos', mensaje: ctx.t('motor.error.falta_nombre') };
    const repetido = s.ids.some(o => o !== id && s.players[o].name.toLowerCase() === n.toLowerCase());
    if (repetido) return { codigo: 'nombre_repetido', mensaje: ctx.t('motor.error.nombre_repetido', { nombre: n }) };
    if (s.players[id]) { s.players[id].name = n; return; }
    s.ids.push(id);
    s.players[id] = nuevoJugador(id, n, bot);
  },

  // El anfitrión ordena los asientos desde la tablet: orden = ids hacia la derecha.
  asientos(ctx, s, { orden }) {
    if (s.phase !== 'sala') return { codigo: 'en_juego', mensaje: ctx.t('motor.error.ya_empezo') };
    if (!Array.isArray(orden) || orden.length !== s.ids.length || new Set(orden).size !== orden.length
      || !orden.every(id => s.players[id])) {
      return { codigo: 'asientos', mensaje: ctx.t('motor.error.asientos') };
    }
    orden.forEach((id, i) => { s.players[id].rightId = orden[(i + 1) % orden.length]; });
  },

  // Poderes que se usan con un botón aparte (el del Juez durante la votación).
  poder(ctx, s, { id, paso, poder }) {
    const c = s.current;
    if (!c || c.id !== paso) return { codigo: 'paso_viejo', mensaje: ctx.t('motor.error.paso_viejo') };
    const p = s.players[id];
    if (poder !== 'segundaVotacion' || c.tipo !== 'votacion' || !c.actores.includes(id) || p?.role !== 'juez'
      || s.aldeaSinPoderes || s.votacionesHoy !== 1) {
      return { codigo: 'poder', mensaje: ctx.t('motor.error.poder_ahora') };
    }
    if (s.segundaVotacionPedida) {
      s.segundaVotacionPedida = false;
      p.flags.juezUsado = false;
      return;
    }
    if (p.flags.juezUsado) return { codigo: 'poder', mensaje: ctx.t('motor.error.poder_usado') };
    s.segundaVotacionPedida = true;
    p.flags.juezUsado = true;
  },

  // Al terminar: misma gente, mismo mazo y asientos; al empezar otra vez se reparten cartas nuevas.
  revancha(ctx, s) {
    if (s.phase !== 'fin') return { codigo: 'en_juego', mensaje: ctx.t('motor.error.no_ha_terminado') };
    const nueva = newGame(ctx, { sala: s.sala, seed: s.rng });
    nueva.config = { ...s.config, explicarReglas: false };
    nueva.ids = [...s.ids];
    for (const id of s.ids) {
      nueva.players[id] = { ...nuevoJugador(id, s.players[id].name, s.players[id].bot), rightId: s.players[id].rightId };
    }
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, nueva);
  },

  // Termina forzosamente la partida a la mitad para empezar otra.
  abortar(ctx, s, _, events) {
    if (s.phase === 'sala' || s.phase === 'fin') return { codigo: 'no_en_juego', mensaje: ctx.t('motor.error.no_en_curso') };
    s.phase = 'fin';
    s.winner = 'nadie';
    s.abortada = true; // para el historial: no es una partida terminada
    s.current = null;
    s.queue = [];
    events.push({ tipo: 'victoria', ganador: 'nadie' });
  },

  salir(ctx, s, { id }) {
    if (s.phase !== 'sala') return { codigo: 'en_juego', mensaje: ctx.t('motor.error.ya_empezo') };
    s.ids = s.ids.filter(o => o !== id);
    delete s.players[id];
    for (const p of Object.values(s.players)) if (p.rightId === id) p.rightId = null;
  },

  configurar(ctx, s, { mazo, duraciones, opciones }) {
    if (s.phase !== 'sala') return { codigo: 'en_juego', mensaje: ctx.t('motor.error.ya_empezo') };
    if (mazo) {
      for (const [rol, n] of Object.entries(mazo)) {
        const def = ctx.roles[rol];
        if (!def) return { codigo: 'rol', mensaje: ctx.t('motor.error.rol_desconocido', { rol }) };
        if (n > 0 && !def.implementado) return { codigo: 'rol', mensaje: ctx.t('motor.error.rol_no_disponible', { nombre: def.nombre }) };
        if (!Number.isInteger(n) || n < 0 || n > def.copias) {
          return { codigo: 'cantidad', mensaje: ctx.t('motor.error.cantidad', { nombre: def.nombre, max: def.copias }) };
        }
        if (def.grupo && n !== 0 && n !== def.copias) {
          return { codigo: 'grupo', mensaje: ctx.t('motor.error.grupo', { nombre: def.nombre, copias: def.copias }) };
        }
      }
      s.config.mazo = Object.fromEntries(Object.entries(mazo).filter(([, n]) => n > 0));
    }
    if (duraciones) s.config.duraciones = { ...s.config.duraciones, ...duraciones };
    if (opciones) {
      if ('alguacil' in opciones) s.config.alguacil = !!opciones.alguacil;
      if ('riesgoNina' in opciones) s.config.riesgoNina = Math.min(1, Math.max(0, Number(opciones.riesgoNina) || 0));
      if ('explicarReglas' in opciones) s.config.explicarReglas = !!opciones.explicarReglas;
      if ('muertosVenTodo' in opciones) s.config.muertosVenTodo = !!opciones.muertosVenTodo;
      if ('mostrarReparto' in opciones) s.config.mostrarReparto = !!opciones.mostrarReparto;
      if ('ritmo' in opciones) s.config.ritmo = opciones.ritmo === 'clasico' ? 'clasico' : 'rapido';
      if ('poolComediante' in opciones) {
        const pool = (opciones.poolComediante ?? []).filter(r => POOL_COMEDIANTE.includes(r));
        if (!pool.length) return { codigo: 'pool', mensaje: ctx.t('motor.error.pool') };
        s.config.poolComediante = pool;
      }
    }
  },

  // Asignación manual de una carta (solo la tablet, antes de empezar; se usa en las pruebas).
  // Los jugadores sin carta asignada la reciben al azar al empezar la partida.
  asignar(ctx, s, { id, rol }) {
    if (s.phase !== 'sala') return { codigo: 'en_juego', mensaje: ctx.t('motor.error.ya_empezo') };
    const p = s.players[id];
    if (!p) return { codigo: 'jugador', mensaje: ctx.t('motor.error.jugador_desconocido') };
    if (rol == null) { p.role = null; return; }
    if (!ctx.roles[rol]) return { codigo: 'rol', mensaje: ctx.t('motor.error.carta_no_existe') };
    const enElMazo = s.config.mazo[rol] ?? 0;
    if (!enElMazo) return { codigo: 'no_en_mazo', mensaje: ctx.t('motor.error.no_en_mazo', { nombre: ctx.roles[rol].nombre }) };
    const yaTienen = s.ids.filter(o => o !== id && s.players[o].role === rol).length;
    if (yaTienen >= enElMazo) {
      return { codigo: 'excedido', mensaje: ctx.t('motor.error.excedido', { nombre: ctx.roles[rol].nombre, n: enElMazo }) };
    }
    p.role = rol;
  },

  derecha(ctx, s, { id, derechaId }) {
    if (s.phase !== 'sala') return { codigo: 'en_juego', mensaje: ctx.t('motor.error.ya_empezo') };
    if (!s.players[id]) return { codigo: 'jugador', mensaje: ctx.t('motor.error.jugador_desconocido') };
    if (derechaId === id) return { codigo: 'a_si_mismo', mensaje: ctx.t('motor.error.a_si_mismo') };
    if (!s.players[derechaId]) return { codigo: 'jugador', mensaje: ctx.t('motor.error.no_en_sala') };
    s.players[id].rightId = derechaId;
  },

  empezar(ctx, s, a, events) {
    const problemas = problemasParaEmpezar(ctx, s);
    if (problemas.length) return { codigo: 'no_listo', mensaje: problemas.join(' ') };
    if (necesitaCirculo(ctx, s)) {
      const rightOf = Object.fromEntries(s.ids.map(id => [id, s.players[id].rightId]));
      s.order = buildCircle(rightOf, s.ids).order;
    } else {
      s.order = [...s.ids];
    }
    // La app reparte una carta secreta al azar a cada jugador.
    repartirCartas(ctx, s);
    for (const id of s.ids) {
      const p = s.players[id];
      Object.assign(p.flags, structuredClone(FLAGS_INICIALES[p.role] ?? {}));
      if (ctx.roles[p.role].cartaPublica) p.flags.rolPublico = true;
    }
    events.push({ tipo: 'inicio' });
    // Opcional (para quien nunca ha jugado): el narrador explica en voz alta lo básico.
    if (s.config.explicarReglas) events.push({ tipo: 'narrar', clave: 'reglas' });

    prepararRoles(ctx, s);
    // Ángel: la partida empieza con un día (debate y votación) antes de la 1.ª noche.
    if (hayRol(s, 'angel')) {
      s.dia = 0;
      s.phase = 'dia';
      s.queue = pasosDelDia(s).filter(p => p !== 'amanecer');
    }
    if (s.config.mostrarReparto) {
      // Cada jugador mira su carta; los anuncios públicos se hacen al terminar el reparto.
      s.queue.unshift('reparto');
    } else {
      events.push(...anunciosIniciales(ctx, s));
    }
    avanzar(ctx, s, events);
  },

  // Un jugador envía su elección para el paso actual (se puede cambiar hasta que se cierre).
  enviar(ctx, s, { id, paso, eleccion }) {
    const c = s.current;
    if (!c || c.id !== paso) return { codigo: 'paso_viejo', mensaje: ctx.t('motor.error.paso_viejo') };
    if (!c.actores.includes(id)) return { codigo: 'no_te_toca', mensaje: ctx.t('motor.error.no_te_toca') };
    const def = STEPS[c.tipo];
    const bloquea = typeof def.bloquea === 'function' ? def.bloquea(ctx, s, id) : def.bloquea;
    if (bloquea && s.inputs[id] != null) return { codigo: 'bloqueado', mensaje: ctx.t('motor.error.bloqueado') };
    if (eleccion != null) {
      if (def.validar) {
        const error = def.validar(ctx, s, id, eleccion);
        if (error) return { codigo: 'opcion', mensaje: error };
      } else if (!def.opciones?.(ctx, s, id).includes(eleccion)) {
        return { codigo: 'opcion', mensaje: ctx.t('motor.error.opcion') };
      }
    }
    if (eleccion == null) delete s.inputs[id];
    else {
      s.inputs[id] = eleccion;
      def.alEnviar?.(ctx, s, id, eleccion);
    }
  },

  // «Listo»: el jugador ya decidió (o no quiere hacer nada) y no hace falta esperar al reloj.
  // En el debate significa «pasemos a votar»; en una votación sin elegir a nadie, abstenerse.
  listo(ctx, s, { id, paso, valor = true }) {
    const c = s.current;
    if (!c || c.id !== paso) return { codigo: 'paso_viejo', mensaje: ctx.t('motor.error.paso_viejo') };
    if (!c.actores.includes(id)) return { codigo: 'no_te_toca', mensaje: ctx.t('motor.error.no_te_toca') };
    s.listos ??= {};
    if (valor) s.listos[id] = true;
    else delete s.listos[id];
  },

  // La tablet cierra el paso actual (tiempo agotado, todos listos o el anfitrión lo salta).
  avanzar(ctx, s, a, events) {
    if (s.phase === 'sala') return { codigo: 'no_empezada', mensaje: ctx.t('motor.error.no_empezada') };
    if (s.phase === 'fin') return { codigo: 'fin', mensaje: ctx.t('motor.error.terminada') };
    if (a.paso && s.current?.id !== a.paso) return { codigo: 'paso_viejo', mensaje: ctx.t('motor.error.paso_viejo') };
    avanzar(ctx, s, events);
  },
};

export function problemasParaEmpezar(ctx, s) {
  const p = [];
  const total = Object.values(s.config.mazo).reduce((a, b) => a + b, 0);
  if (s.ids.length < 3) p.push(ctx.t('motor.problema.pocos_jugadores'));
  if (total < s.ids.length) p.push(ctx.t('motor.problema.mazo_corto', { cartas: total, jugadores: s.ids.length }));
  const lobos = Object.entries(s.config.mazo).filter(([r]) => ctx.roles[r]?.bando === 'lobos').reduce((a, [, n]) => a + n, 0);
  if (!lobos) p.push(ctx.t('motor.problema.sin_lobo'));
  if (necesitaCirculo(ctx, s)) {
    const rightOf = Object.fromEntries(s.ids.map(id => [id, s.players[id].rightId]));
    const c = buildCircle(rightOf, s.ids);
    if (!c.ok) p.push(ctx.t('motor.problema.circulo'));
  }
  return p;
}

const tipoDe = item => (typeof item === 'string' ? item : item?.tipo);

// Cierra el paso actual y abre el siguiente (planificando noche o día cuando se vacía la cola).
// Las interrupciones (Cazador, sucesor del Alguacil…) se abren justo después del paso que
// causó la muerte; tras una votación, después de mostrar el resultado.
// La victoria se comprueba cuando no queda ninguna interrupción pendiente (el disparo del
// Cazador puede cambiar quién gana).
function avanzar(ctx, s, events) {
  const cerrado = s.current?.tipo;
  if (s.current) cerrarPaso(ctx, s, events);
  if (s.interrupciones.length && !DIFIEREN_INTERRUPCIONES.has(cerrado)) {
    s.queue.unshift(...s.interrupciones.splice(0));
  }
  const pendiente = s.interrupciones.length > 0 || INTERRUPCIONES.has(tipoDe(s.queue[0]));
  if (cerrado && !pendiente) s.winner = checkVictory(ctx, s);
  if (s.winner) {
    s.phase = 'fin';
    s.current = null;
    s.queue = [];
    events.push({ tipo: 'victoria', ganador: s.winner });
    return;
  }
  if (!s.queue.length) planificar(ctx, s);
  abrirPaso(ctx, s, s.queue.shift(), events);
}

function planificar(ctx, s) {
  // (el reparto de cartas ocurre en la «noche 0»: al acabar, empieza la noche 1)
  if (s.phase === 'noche' && s.noche > 0) {
    s.queue = pasosDelDia(s);
    return;
  }
  // El Juez pidió una segunda votación: sin debate.
  if (s.segundaVotacion) {
    s.segundaVotacion = false;
    s.queue = ['votacion', 'resultado'];
    return;
  }
  s.noche += 1;
  const { primeraNoche, cadaNoche, pasos } = ctx.nightOrder;
  const lista = s.noche === 1 ? primeraNoche : cadaNoche;
  // Un paso entra si hay algún jugador vivo actuando como ese rol.
  const presentes = lista.filter(p => STEPS[p] && (STEPS[p].presente
    ? STEPS[p].presente(ctx, s)
    : pasos[p].roles.some(r => actuanComo(ctx, s, r).length > 0)));
  s.queue = ['anochecer', ...presentes];
}

function abrirPaso(ctx, s, item, events) {
  const tipo = tipoDe(item);
  const def = STEPS[tipo];
  const claveDur = ctx.nightOrder.pasos[tipo]?.duracion ?? def.duracion ?? tipo;
  s.seq += 1;
  s.phase = def.fase;
  s.inputs = {};
  s.listos = {};
  s.current = {
    id: `p${s.seq}`,
    tipo,
    duracion: s.config.duraciones[claveDur] ?? DURACIONES.paso,
    actores: [],
    acabaAntes: !!def.acabaAntes,
    ...(item.datos ? { datos: item.datos } : {}),
  };
  if (ctx.nightOrder.pasos[tipo]) events.push({ tipo: 'narrar', clave: `pasos.${tipo}.despertar` });
  def.inicio?.(ctx, s, events);
  s.current.actores = def.actores(ctx, s);
  // Ritmo rápido: un paso nocturno sin nadie que actúe (rol muerto, ausente o sin poder) dura
  // un tiempo al azar parecido al de una persona decidiendo, para no delatar nada.
  if (def.fase === 'noche' && ctx.nightOrder.pasos[tipo] && !s.current.actores.length && s.config.ritmo !== 'clasico') {
    s.current.duracion = Math.min(s.current.duracion, 6 + Math.floor(random(s) * 9));
  }
  events.push({ tipo: 'paso', paso: { ...s.current } });
}

function cerrarPaso(ctx, s, events) {
  const tipo = s.current.tipo;
  STEPS[tipo].cierre?.(ctx, s, events);
  if (ctx.nightOrder.pasos[tipo]) events.push({ tipo: 'narrar', clave: `pasos.${tipo}.dormir` });
  s.inputs = {};
  s.listos = {};
  s.current = null;
}

// Jugadores que hacen falta para saltar el debate (el 75 % de los vivos).
export const necesariosDebate = n => Math.ceil(n * 0.75);

// ¿Puede la tablet cerrar ya el paso, sin esperar al reloj?
//  - debate: el 75 % de los vivos pidió pasar a votar;
//  - pasos con «acabaAntes» (votaciones, interrupciones): todos eligieron o pulsaron «Listo»;
//  - el resto: todos los actores pulsaron «Listo» (de noche, solo en ritmo rápido).
export function puedeAcabar(ctx, s) {
  const c = s.current;
  if (!c || !c.actores.length) return false;
  const listos = s.listos ?? {};
  if (c.tipo === 'debate') return c.actores.filter(id => listos[id]).length >= necesariosDebate(c.actores.length);
  const def = STEPS[c.tipo];
  if (def.fase === 'noche' && s.config.ritmo === 'clasico' && !def.cierreRapido) return false;
  return c.actores.every(id => listos[id] || (def.acabaAntes && s.inputs[id] != null));
}

// ¿Han respondido todos los actores? (la tablet lo usa para cerrar antes los pasos que lo permiten)
export function todosListos(s) {
  const c = s.current;
  return !!c && c.actores.length > 0 && c.actores.every(id => s.inputs[id] != null);
}
