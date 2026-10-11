// Definición de cada tipo de paso de la partida. Un paso tiene:
//   fase        'noche' | 'dia'
//   actores     (ctx, s) → ids de quienes actúan (sus celulares se activan)
//   opciones    (ctx, s, id) → valores elegibles (si el paso pide elegir algo simple)
//   validar     (ctx, s, id, eleccion) → mensaje de error (para elecciones compuestas)
//   bloquea     true (o función) si la elección no se puede cambiar una vez hecha
//   alEnviar    (ctx, s, id, eleccion) → efecto inmediato (p. ej. la Vidente ve la carta)
//   inicio      (ctx, s, eventos) → al empezar
//   cierre      (ctx, s, eventos) → al acabar (lee s.inputs)
//   vista       (ctx, s, id) → datos para el celular de un actor
//   presente    (ctx, s) → si el paso entra esta noche (por defecto: su rol está en juego)
//   acabaAntes  true si la tablet puede cerrar el paso cuando todos han respondido
//               (nunca de noche: el tiempo fijo evita deducciones)
//   duracion    clave de duración (si no viene de nightOrder.json)
// s.current.actores guarda los actores calculados al abrir el paso; s.current.datos, los
// datos de una interrupción (p. ej. qué Cazador dispara).
import {
  vivos, lobosVivos, esLobo, nombre, conPoder, actuanComo, listaJugadores, pesoVoto,
  tienePoder, enJuego, vecinosVivos, cronica, FLAGS_INICIALES,
} from './helpers.js';
import { killPlayers } from './deaths.js';
import { anunciosIniciales } from './preparativos.js';
import { resolveNight } from './resolveNight.js';
import { random, pick } from './rng.js';

const otros = (s, id) => vivos(s).filter(o => o !== id);
const narrar = (clave, vars) => ({ tipo: 'narrar', clave, ...(vars ? { vars } : {}) });
const nombres = (s, ids) => ids.map(id => nombre(s, id)).join(', ');
const rolNombre = (ctx, rol) => ctx.roles[rol]?.nombre ?? rol;

// Recuento de votos con pesos. votos: { votante: objetivo }.
function recuento(votos, peso = () => 1, extra = {}) {
  const conteo = { ...extra };
  for (const [de, a] of Object.entries(votos)) conteo[a] = (conteo[a] ?? 0) + peso(de);
  const max = Math.max(0, ...Object.values(conteo));
  return { conteo, max, masVotados: Object.keys(conteo).filter(id => conteo[id] === max && max > 0) };
}

// Pasos de la noche que despiertan a un rol (p. ej. 'bruja' → ['bruja']).
const pasosDelRol = (ctx, rol) => Object.entries(ctx.nightOrder.pasos)
  .filter(([paso, def]) => def.roles.includes(rol) && STEPS[paso] && paso !== 'lobos').map(([paso]) => paso);

// Mete un paso en la cola de la noche en su sitio según el orden de llamada (si no estaba ya).
function insertarPasoEnLaNoche(ctx, s, paso) {
  const orden = s.noche === 1 ? ctx.nightOrder.primeraNoche : ctx.nightOrder.cadaNoche;
  const tipoDe = q => (typeof q === 'string' ? q : q?.tipo);
  if (s.queue.some(q => tipoDe(q) === paso) || !orden.includes(paso)) return;
  const idx = orden.indexOf(paso);
  const pos = s.queue.findIndex(q => orden.indexOf(tipoDe(q)) > idx);
  if (pos < 0) s.queue.push(paso); else s.queue.splice(pos, 0, paso);
}

const votosDe = s => Object.fromEntries(s.current.actores.filter(id => s.inputs[id]).map(id => [id, s.inputs[id]]));

// Paso de información (sin decisión): hermanas, enamorados, hechizados…
const pasoInfo = (actores, vista, extra = {}) => ({
  fase: 'noche', actores, vista: (ctx, s, id) => ({ accion: 'info', ...vista(ctx, s, id) }), ...extra,
});

// Pasos de primera noche que vuelven a aparecer si la Doncella adopta ese rol más tarde.
const pendientes = (s, rol, falta) => vivos(s).filter(id => s.players[id].role === rol && !s.players[id].flags[falta]);
const primeraNocheOPendiente = (rol, falta) => (ctx, s) =>
  (s.noche === 1 ? enJuego(s, rol) : pendientes(s, rol, falta).length > 0);

// Víctimas de los lobos que ve la Alquimista: la de la manada y la del Lobo Feroz.
const victimasLobos = s => [...new Set([s.nocheActual.victimaLobos, s.nocheActual.victimaFeroz].filter(Boolean))];

export const STEPS = {
  anochecer: {
    fase: 'noche',
    actores: () => [],
    inicio(ctx, s, eventos) {
      s.nocheActual = {
        victimaLobos: null, victimaFeroz: null, victimaAlbino: null, infectado: null,
        protegidos: [], curados: [], envenenados: [], ninaDescubierta: false,
        manada: [], feroz: null, albino: null, quemado: null,
      };
      // El poder prestado al Bufón dura hasta la noche siguiente.
      for (const id of s.ids) {
        const f = s.players[id].flags;
        if (f.prestado && f.prestado.noche < s.noche) {
          if (f.prestado.rol === 'bruja' && s.players[id].role !== 'bruja') { delete f.pocionVida; delete f.pocionMuerte; }
          delete f.prestado;
        }
      }
      eventos.push(narrar('anochecer'));
    },
  },

  // Reparto de cartas: cada jugador mira su carta secreta antes de que empiece la partida.
  // Ocurre en la «noche 0»; los anuncios públicos (cartas del Bufón, grupos del Cultista…) se hacen al acabar.
  reparto: {
    fase: 'noche',
    duracion: 'reparto',
    cierreRapido: true, // acaba en cuanto todos pulsan «Listo», también en ritmo clásico
    actores: (ctx, s) => [...s.ids],
    inicio: (ctx, s, eventos) => eventos.push(narrar('reparto')),
    vista: ctx => ({
      accion: 'carta',
      titulo: ctx.t('motor.paso.reparto.titulo'),
      ayuda: ctx.t('motor.paso.reparto.ayuda'),
    }),
    cierre: (ctx, s, eventos) => eventos.push(...anunciosIniciales(ctx, s)),
  },

  // --- Primera noche (y reinicios de la Doncella) -----------------------------------------

  comediante: {
    fase: 'noche',
    actores: (ctx, s) => vivos(s).filter(id => s.players[id].role === 'comediante' && (s.cartasComediante ?? []).length),
    opciones: (ctx, s) => [...new Set(s.cartasComediante ?? [])],
    vista(ctx, s, id) {
      return {
        accion: 'cartas',
        titulo: ctx.t('motor.paso.comediante.titulo'),
        ayuda: ctx.t('motor.paso.comediante.ayuda'),
        cartas: this.opciones(ctx, s).map(rol => ({ rol, nombre: rolNombre(ctx, rol) })),
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s) {
      for (const id of s.current.actores) {
        const rol = s.inputs[id];
        if (!rol) continue;
        s.cartasComediante.splice(s.cartasComediante.indexOf(rol), 1);
        const f = s.players[id].flags;
        f.prestado = { rol, noche: s.noche };
        if (rol === 'bruja') { f.pocionVida = true; f.pocionMuerte = true; }
        // El paso de ese rol quizá no estaba programado (nadie más tiene esa carta): se añade a la noche.
        for (const paso of pasosDelRol(ctx, rol)) insertarPasoEnLaNoche(ctx, s, paso);
        cronica(s, ctx.t('motor.cronica.comediante', { nombre: nombre(s, id), rol: rolNombre(ctx, rol) }));
      }
    },
  },

  cupido: {
    fase: 'noche',
    presente: primeraNocheOPendiente('cupido', 'flechasUsadas'),
    actores: (ctx, s) => conPoder(ctx, s, 'cupido').filter(id => !s.players[id].flags.flechasUsadas),
    // Solo jugadores que aún no están enamorados (puede elegirse a sí mismo).
    opciones: (ctx, s) => vivos(s).filter(id => !s.players[id].flags.enamorado),
    validar(ctx, s, id, e) {
      const v = this.opciones(ctx, s, id);
      if (!Array.isArray(e) || e.length !== 2 || e[0] === e[1] || !e.every(x => v.includes(x))) {
        return ctx.t('motor.error.dos_distintos');
      }
    },
    vista(ctx, s, id) {
      return {
        accion: 'varios', n: 2,
        titulo: ctx.t('motor.paso.cupido.titulo'),
        ayuda: ctx.t('motor.paso.cupido.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: s.inputs[id] ?? [],
      };
    },
    cierre(ctx, s) {
      for (const id of s.current.actores) {
        s.players[id].flags.flechasUsadas = true;
        const [a, b] = s.inputs[id] ?? [];
        if (!a) continue;
        s.players[a].flags.enamorado = b;
        s.players[b].flags.enamorado = a;
        s.players[a].flags.enamoradoNoche = s.noche;
        s.players[b].flags.enamoradoNoche = s.noche;
        cronica(s, ctx.t('motor.cronica.cupido', { nombre: nombre(s, id), a: nombre(s, a), b: nombre(s, b) }));
      }
    },
  },

  enamorados: pasoInfo(
    (ctx, s) => vivos(s).filter(id => s.players[id].flags.enamoradoNoche === s.noche),
    (ctx, s, id) => ({
      titulo: ctx.t('motor.paso.enamorados.titulo'),
      texto: ctx.t('motor.paso.enamorados.texto', { nombre: nombre(s, s.players[id].flags.enamorado) }),
    }),
    { presente: (ctx, s) => STEPS.cupido.presente(ctx, s) },
  ),

  juez: pasoInfo(
    (ctx, s) => conPoder(ctx, s, 'juez'),
    ctx => ({
      titulo: ctx.t('motor.paso.juez.titulo'),
      texto: ctx.t('motor.paso.juez.texto'),
    }),
  ),

  dos_hermanas: pasoInfo(
    (ctx, s) => vivos(s).filter(id => s.players[id].role === 'dos_hermanas'),
    (ctx, s, id) => ({ titulo: ctx.t('motor.paso.dos_hermanas.titulo'), texto: hermanos(ctx, s, id) }),
  ),

  tres_hermanos: pasoInfo(
    (ctx, s) => vivos(s).filter(id => s.players[id].role === 'tres_hermanos'),
    (ctx, s, id) => ({ titulo: ctx.t('motor.paso.tres_hermanos.titulo'), texto: hermanos(ctx, s, id) }),
  ),

  nino_salvaje: {
    fase: 'noche',
    presente: primeraNocheOPendiente('nino_salvaje', 'modelo'),
    actores: (ctx, s) => pendientes(s, 'nino_salvaje', 'modelo'),
    opciones: (ctx, s, id) => otros(s, id),
    vista(ctx, s, id) {
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.nino_salvaje.titulo'),
        ayuda: ctx.t('motor.paso.nino_salvaje.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s) {
      for (const id of s.current.actores) {
        const f = s.players[id].flags;
        const candidatos = otros(s, id);
        if (!candidatos.length) continue;
        f.modelo = s.inputs[id] ?? pick(s, candidatos);
        if (!s.inputs[id]) f.modeloAlAzar = true;
        cronica(s, ctx.t('motor.cronica.nino_salvaje_modelo', { nombre: nombre(s, id), modelo: nombre(s, f.modelo) }));
      }
    },
  },

  domador: pasoInfo(
    (ctx, s) => conPoder(ctx, s, 'domador'),
    (ctx, s, id) => ({
      titulo: ctx.t('motor.paso.domador.titulo'),
      texto: ctx.t('motor.paso.domador.texto', { vecinos: nombres(s, vecinosVivos(s, id)) || ctx.t('motor.nadie') }),
    }),
  ),

  // --- Cada noche ---------------------------------------------------------------------------

  vidente: {
    fase: 'noche',
    actores: (ctx, s) => actuanComo(ctx, s, 'vidente'),
    opciones: (ctx, s, id) => otros(s, id),
    bloquea: true,
    alEnviar(ctx, s, id, e) {
      const vision = { nombre: nombre(s, e), rol: rolNombre(ctx, s.players[e].role), rolId: s.players[e].role, noche: s.noche };
      (s.players[id].flags.visiones ??= []).push(vision);
      cronica(s, ctx.t('motor.cronica.vidente', { nombre: nombre(s, id), visto: vision.nombre, rol: vision.rol }));
    },
    vista(ctx, s, id) {
      const e = s.inputs[id];
      const vision = e && s.players[id].flags.visiones.at(-1);
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.vidente.titulo'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: e ?? null,
        bloqueado: !!e,
        resultado: vision ? ctx.t('motor.paso.vidente.resultado', { nombre: vision.nombre, rol: vision.rol }) : null,
        rolVisto: vision ? vision.rolId : null,
      };
    },
  },

  zorro: {
    fase: 'noche',
    actores: (ctx, s) => actuanComo(ctx, s, 'zorro').filter(id => !s.players[id].flags.sinOlfato || s.players[id].flags.prestado),
    opciones: (ctx, s) => vivos(s),
    bloquea: true,
    alEnviar(ctx, s, id, centro) {
      const grupo = [centro, ...vecinosVivos(s, centro)];
      const hay = grupo.some(g => esLobo(ctx, s.players[g]));
      const f = s.players[id].flags;
      (f.olfatos ??= []).push({ noche: s.noche, grupo: grupo.map(g => nombre(s, g)), hay });
      if (!hay && s.players[id].role === 'zorro') f.sinOlfato = true;
      cronica(s, ctx.t(hay ? 'motor.cronica.zorro_si' : 'motor.cronica.zorro_no', { nombre: nombre(s, id), grupo: nombres(s, grupo) }));
    },
    vista(ctx, s, id) {
      const e = s.inputs[id];
      const o = e && s.players[id].flags.olfatos.at(-1);
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.zorro.titulo'),
        ayuda: ctx.t('motor.paso.zorro.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: e ?? null,
        bloqueado: !!e,
        resultado: !o ? null : ctx.t(o.hay ? 'motor.paso.zorro.resultado_si' : 'motor.paso.zorro.resultado_no', { grupo: o.grupo.join(', ') }),
      };
    },
  },

  protector: {
    fase: 'noche',
    actores: (ctx, s) => actuanComo(ctx, s, 'protector'),
    opciones: (ctx, s, id) => vivos(s).filter(o => o !== s.players[id].flags.ultimoProtegido),
    vista(ctx, s, id) {
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.protector.titulo'),
        ayuda: ctx.t('motor.paso.protector.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s) {
      for (const id of s.current.actores) {
        const e = s.inputs[id] ?? null;
        if (e) s.nocheActual.protegidos.push(e);
        s.players[id].flags.ultimoProtegido = e;
        if (e) cronica(s, ctx.t('motor.cronica.protector', { nombre: nombre(s, id), objetivo: nombre(s, e) }));
      }
    },
  },

  perro_lobo: {
    fase: 'noche',
    presente: primeraNocheOPendiente('perro_lobo', 'perroEligio'),
    actores: (ctx, s) => pendientes(s, 'perro_lobo', 'perroEligio'),
    opciones: () => ['aldeano', 'lobo'],
    vista: (ctx, s, id) => ({
      accion: 'dos',
      titulo: ctx.t('motor.paso.perro_lobo.titulo'),
      ayuda: ctx.t('motor.paso.perro_lobo.ayuda'),
      opciones: [
        { valor: 'aldeano', rol: 'aldeano', texto: ctx.t('motor.paso.perro_lobo.aldeano') },
        { valor: 'lobo', rol: 'lobo', texto: ctx.t('motor.paso.perro_lobo.lobo') },
      ],
      eleccion: s.inputs[id] ?? null,
    }),
    cierre(ctx, s) {
      for (const id of s.current.actores) {
        const f = s.players[id].flags;
        f.perroEligio = true;
        if (s.inputs[id] === 'lobo') f.lobo = true;
        cronica(s, ctx.t(f.lobo ? 'motor.cronica.perro_lobo' : 'motor.cronica.perro_aldeano', { nombre: nombre(s, id) }));
      }
    },
  },

  // Turno de los lobos. La Espía Silenciosa también actúa aquí: puede espiar.
  lobos: {
    fase: 'noche',
    // Hay turno de lobos mientras quede algún lobo, aunque no tenga carta de lobo (un infectado, por ejemplo).
    presente: (ctx, s) => lobosVivos(ctx, s).length > 0,
    actores: (ctx, s) => [...lobosVivos(ctx, s), ...conPoder(ctx, s, 'nina').filter(id => !esLobo(ctx, s.players[id]))],
    opciones: (ctx, s, id) => (esLobo(ctx, s.players[id])
      ? vivos(s).filter(o => !esLobo(ctx, s.players[o]))
      : ['espiar']),
    bloquea: (ctx, s, id) => !esLobo(ctx, s.players[id]),
    alEnviar(ctx, s, id, e) {
      if (e !== 'espiar') return;
      s.players[id].flags.espio = { lobo: nombre(s, pick(s, lobosVivos(ctx, s))), noche: s.noche };
      if (random(s) < s.config.riesgoNina) s.nocheActual.ninaDescubierta = true;
      cronica(s, ctx.t(s.nocheActual.ninaDescubierta ? 'motor.cronica.nina_pillada' : 'motor.cronica.nina', { nombre: nombre(s, id), lobo: s.players[id].flags.espio.lobo }));
    },
    vista(ctx, s, id) {
      if (!esLobo(ctx, s.players[id])) {
        const espio = s.inputs[id] ? s.players[id].flags.espio : null;
        return {
          accion: 'espiar',
          titulo: ctx.t('motor.paso.lobos.nina_titulo'),
          ayuda: ctx.t('motor.paso.lobos.nina_ayuda', { riesgo: Math.round(s.config.riesgoNina * 100) }),
          eleccion: s.inputs[id] ?? null,
          resultado: espio ? ctx.t('motor.paso.lobos.nina_resultado', { lobo: espio.lobo }) : null,
          descubierta: !!espio && s.nocheActual.ninaDescubierta,
        };
      }
      const companeros = lobosVivos(ctx, s).filter(o => o !== id);
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.lobos.titulo'),
        ayuda: ctx.t('motor.paso.lobos.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        companeros: companeros.map(o => ({ id: o, nombre: nombre(s, o), eligio: s.inputs[o] ?? null })),
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s) {
      // Unanimidad entre los lobos vivos.
      const lobos = lobosVivos(ctx, s);
      const votos = lobos.map(id => s.inputs[id]);
      const acuerdo = votos[0] && votos.every(v => v === votos[0]) ? votos[0] : null;
      const nina = s.current.actores.find(id => !esLobo(ctx, s.players[id]));
      const n = s.nocheActual;
      n.manada = lobos;
      n.victimaLobos = n.ninaDescubierta ? nina : acuerdo;
      cronica(s, acuerdo
        ? ctx.t('motor.cronica.lobos_ataque', { lobos: nombres(s, lobos), nombre: nombre(s, acuerdo) })
        : ctx.t('motor.cronica.lobos_desacuerdo', { lobos: nombres(s, lobos) }));
    },
  },

  // Noches pares: el Lobo Lunar despierta solo y puede matar a un lobo.
  albino: {
    fase: 'noche',
    presente: (ctx, s) => enJuego(s, 'albino') && s.noche % 2 === 0,
    actores: (ctx, s) => vivos(s).filter(id => s.players[id].role === 'albino'),
    opciones: (ctx, s, id) => lobosVivos(ctx, s).filter(o => o !== id),
    vista(ctx, s, id) {
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.albino.titulo'),
        ayuda: ctx.t('motor.paso.albino.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s) {
      for (const id of s.current.actores) {
        const e = s.inputs[id];
        if (!e) continue;
        s.nocheActual.victimaAlbino = e;
        s.nocheActual.albino = id;
        cronica(s, ctx.t('motor.cronica.albino', { nombre: nombre(s, id), objetivo: nombre(s, e) }));
      }
    },
  },

  // Una vez por partida: infectar a la víctima de la manada en vez de matarla.
  infecto: {
    fase: 'noche',
    actores: (ctx, s) => vivos(s).filter(id => s.players[id].role === 'infecto' && !s.players[id].flags.infectoUsado),
    validar: (ctx, s, id, e) => (e === 'infectar' && s.nocheActual.victimaLobos ? null : ctx.t('motor.error.nadie_infectar')),
    vista(ctx, s, id) {
      const v = s.nocheActual.victimaLobos;
      if (!v) return { accion: 'info', titulo: ctx.t('motor.paso.infecto.sin_victima_titulo'), texto: ctx.t('motor.paso.infecto.sin_victima_texto') };
      return {
        accion: 'boton',
        titulo: ctx.t('motor.paso.infecto.titulo'),
        ayuda: ctx.t('motor.paso.infecto.ayuda', { nombre: nombre(s, v) }),
        boton: { valor: 'infectar', texto: ctx.t('motor.paso.infecto.boton', { nombre: nombre(s, v) }) },
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s) {
      for (const id of s.current.actores) {
        if (s.inputs[id] !== 'infectar' || !s.nocheActual.victimaLobos) continue;
        s.nocheActual.infectado = s.nocheActual.victimaLobos;
        s.players[id].flags.infectoUsado = true;
        cronica(s, ctx.t('motor.cronica.infecto', { nombre: nombre(s, id), objetivo: nombre(s, s.nocheActual.infectado) }));
      }
    },
  },

  // Mientras no haya caído ningún lobo, el Lobo Feroz devora a una segunda víctima.
  feroz: {
    fase: 'noche',
    actores: (ctx, s) => (s.ferozSinPoder ? [] : vivos(s).filter(id => s.players[id].role === 'lobo_feroz')),
    opciones: (ctx, s) => vivos(s).filter(o => !esLobo(ctx, s.players[o]) && o !== s.nocheActual.victimaLobos),
    vista(ctx, s, id) {
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.feroz.titulo'),
        ayuda: ctx.t('motor.paso.feroz.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s) {
      for (const id of s.current.actores) {
        const e = s.inputs[id];
        if (!e) continue;
        s.nocheActual.victimaFeroz = e;
        s.nocheActual.feroz = id;
        cronica(s, ctx.t('motor.cronica.feroz', { nombre: nombre(s, id), objetivo: nombre(s, e) }));
      }
    },
  },

  bruja: {
    fase: 'noche',
    actores: (ctx, s) => actuanComo(ctx, s, 'bruja'),
    validar(ctx, s, id, e) {
      const f = s.players[id].flags;
      if (!e || typeof e !== 'object') return ctx.t('motor.error.eleccion_no_valida');
      const curar = e.curar === true ? s.nocheActual.victimaLobos : e.curar;
      if (curar && (!f.pocionVida || !victimasLobos(s).includes(curar))) return ctx.t('motor.error.no_curar');
      if (e.veneno && (!f.pocionMuerte || !vivos(s).includes(e.veneno))) return ctx.t('motor.error.no_envenenar');
    },
    vista(ctx, s, id) {
      const f = s.players[id].flags;
      const victimas = victimasLobos(s);
      const e = s.inputs[id] ?? { curar: null, veneno: null };
      return {
        accion: 'bruja',
        titulo: ctx.t('motor.paso.bruja.titulo'),
        victimas: listaJugadores(s, victimas),
        victima: victimas.length ? { id: victimas[0], nombre: nombre(s, victimas[0]) } : null,
        pocionVida: !!f.pocionVida,
        pocionMuerte: !!f.pocionMuerte,
        opciones: listaJugadores(s, vivos(s)),
        eleccion: { curar: e.curar === true ? s.nocheActual.victimaLobos : e.curar ?? null, veneno: e.veneno ?? null },
      };
    },
    cierre(ctx, s) {
      const n = s.nocheActual;
      for (const id of s.current.actores) {
        const e = s.inputs[id];
        const f = s.players[id].flags;
        if (!e) continue;
        const curar = e.curar === true ? n.victimaLobos : e.curar;
        if (curar && f.pocionVida && victimasLobos(s).includes(curar)) {
          n.curados.push(curar);
          f.pocionVida = false;
          cronica(s, ctx.t('motor.cronica.bruja_cura', { nombre: nombre(s, id), objetivo: nombre(s, curar) }));
        }
        if (e.veneno && f.pocionMuerte) {
          n.envenenados.push(e.veneno);
          f.pocionMuerte = false;
          cronica(s, ctx.t('motor.cronica.bruja_veneno', { nombre: nombre(s, id), objetivo: nombre(s, e.veneno) }));
        }
      }
    },
  },

  flautista: {
    fase: 'noche',
    actores: (ctx, s) => vivos(s).filter(id => s.players[id].role === 'flautista' && !esLobo(ctx, s.players[id])),
    candidatos: (s, id) => otros(s, id).filter(o => !s.players[o].flags.hechizado),
    validar(ctx, s, id, e) {
      const c = this.candidatos(s, id);
      const n = Math.min(2, c.length);
      if (!Array.isArray(e) || e.length !== n || new Set(e).size !== n || !e.every(x => c.includes(x))) {
        return ctx.t(n === 1 ? 'motor.error.un_jugador' : 'motor.error.dos_jugadores');
      }
    },
    vista(ctx, s, id) {
      const c = this.candidatos(s, id);
      return {
        accion: 'varios', n: Math.min(2, c.length),
        titulo: ctx.t('motor.paso.flautista.titulo'),
        ayuda: ctx.t('motor.paso.flautista.ayuda'),
        opciones: listaJugadores(s, c),
        eleccion: s.inputs[id] ?? [],
      };
    },
    cierre(ctx, s) {
      for (const id of s.current.actores) {
        const e = s.inputs[id];
        if (!Array.isArray(e)) continue;
        for (const h of e) { s.players[h].flags.hechizado = true; s.players[h].flags.hechizadoNoche = s.noche; }
        cronica(s, ctx.t('motor.cronica.flautista', { nombre: nombre(s, id), objetivos: nombres(s, e) }));
      }
    },
  },

  hechizados: pasoInfo(
    (ctx, s) => vivos(s).filter(id => s.players[id].flags.hechizado),
    (ctx, s) => ({
      titulo: ctx.t('motor.paso.hechizados.titulo'),
      texto: ctx.t('motor.paso.hechizados.texto', { lista: nombres(s, vivos(s).filter(o => s.players[o].flags.hechizado)) }),
    }),
    { presente: (ctx, s) => enJuego(s, 'flautista') },
  ),

  piromano: {
    fase: 'noche',
    actores: (ctx, s) => vivos(s).filter(id => s.players[id].role === 'piromano' && !s.players[id].flags.piromanoUsado),
    opciones: (ctx, s, id) => vivos(s),
    vista(ctx, s, id) {
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.piromano.titulo'),
        ayuda: ctx.t('motor.paso.piromano.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: s.inputs[id] ?? null,
        botonNo: { valor: 'nadie', texto: ctx.t('motor.paso.piromano.no_usar') },
      };
    },
    cierre(ctx, s) {
      for (const id of s.current.actores) {
        const e = s.inputs[id];
        if (!e || e === 'nadie') continue;
        s.players[id].flags.piromanoUsado = true;
        s.nocheActual.quemado = e;
        cronica(s, ctx.t('motor.cronica.piromano', { nombre: nombre(s, id), objetivo: nombre(s, e) }));
      }
    },
  },

  cuervo: {
    fase: 'noche',
    actores: (ctx, s) => vivos(s).filter(id => s.players[id].role === 'cuervo'),
    opciones: (ctx, s, id) => otros(s, id),
    vista(ctx, s, id) {
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.cuervo.titulo'),
        ayuda: ctx.t('motor.paso.cuervo.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s, eventos) {
      s.maldito = null;
      for (const id of s.current.actores) {
        const e = s.inputs[id];
        if (!e) continue;
        s.maldito = e;
        cronica(s, ctx.t('motor.cronica.cuervo', { nombre: nombre(s, id), objetivo: nombre(s, e) }));
        eventos.push(narrar('cuervoMaldice'));
      }
    },
  },

  // --- Día -------------------------------------------------------------------

  amanecer: {
    fase: 'dia',
    actores: () => [],
    inicio(ctx, s, eventos) {
      s.dia += 1;
      s.votacionesHoy = 0;
      const muertes = resolveNight(ctx, s);
      eventos.push(narrar('amanecer'));
      eventos.push(narrar(muertes.length ? 'amanecerConMuertos' : 'amanecerSinMuertos'));
      eventos.push(...killPlayers(ctx, s, muertes));
      s.nocheActual = null;
      // El oso dla Domadora gruñe si un vecino vivo es lobo (o siempre, si está infectado).
      for (const id of vivos(s).filter(o => s.players[o].role === 'domador')) {
        const d = s.players[id];
        const gruñe = esLobo(ctx, d) || (tienePoder(ctx, s, d) && vecinosVivos(s, id).some(v => esLobo(ctx, s.players[v])));
        if (gruñe) {
          eventos.push(narrar('gruñido'));
          cronica(s, ctx.t('motor.cronica.oso', { nombre: d.name }));
        }
      }
    },
  },

  // Elección del Alguacil (1.ª mañana). Empate: al azar entre los más votados.
  alguacil: {
    fase: 'dia',
    duracion: 'votacion',
    acabaAntes: true,
    actores: (ctx, s) => vivos(s),
    opciones: (ctx, s) => vivos(s),
    inicio: (ctx, s, eventos) => eventos.push(narrar('alguacil')),
    vista(ctx, s, id) {
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.alguacil.titulo'),
        ayuda: ctx.t('motor.paso.alguacil.ayuda'),
        opciones: listaJugadores(s, vivos(s)),
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s, eventos) {
      const { masVotados } = recuento(votosDe(s));
      const elegido = pick(s, masVotados.length ? masVotados : vivos(s));
      s.alguacil = elegido;
      s.alguacilElegido = true;
      eventos.push(narrar('alguacilElegido', { nombre: nombre(s, elegido) }));
      cronica(s, ctx.t('motor.cronica.alguacil', { nombre: nombre(s, elegido) }));
    },
  },

  // Todos los vivos pueden pedir pasar a votar: con el 75 % se salta el resto del debate.
  debate: {
    fase: 'dia',
    actores: (ctx, s) => vivos(s),
    inicio: (ctx, s, eventos) => eventos.push(narrar(s.dia === 0 ? 'debateAngel' : 'debate')),
    vista: (ctx, s, id) => ({
      accion: 'debate',
      titulo: ctx.t(s.dia === 0 ? 'motor.paso.debate.titulo_angel' : 'motor.paso.debate.titulo'),
      ayuda: ctx.t('motor.paso.debate.ayuda'),
      saltan: s.current.actores.filter(o => s.listos?.[o]).length,
      necesarios: Math.ceil(s.current.actores.length * 0.75),
    }),
  },

  votacion: {
    fase: 'dia',
    acabaAntes: true,
    actores(ctx, s) {
      const base = vivos(s).filter(id => s.players[id].canVote);
      return s.votantesProximos ? base.filter(id => s.votantesProximos.includes(id)) : base;
    },
    // Un enamorado nunca puede votar contra su pareja.
    opciones: (ctx, s, id) => vivos(s).filter(o => o !== id && o !== s.players[id].flags.enamorado),
    inicio(ctx, s, eventos) {
      s.votacionesHoy = (s.votacionesHoy ?? 0) + 1;
      eventos.push(narrar(s.votacionesHoy > 1 ? 'segundaVotacion' : 'votacion'));
    },
    vista(ctx, s, id) {
      const p = s.players[id];
      const juez = p.role === 'juez' && tienePoder(ctx, s, p) && s.votacionesHoy === 1
        && (!p.flags.juezUsado || s.segundaVotacionPedida);
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.votacion.titulo'),
        ayuda: ctx.t(s.alguacil === id ? 'motor.paso.votacion.ayuda_alguacil' : 'motor.paso.votacion.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: s.inputs[id] ?? null,
        ...(juez ? { poderJuez: { pedido: !!s.segundaVotacionPedida } } : {}),
      };
    },
    cierre(ctx, s, eventos) {
      const votos = votosDe(s);
      const extra = s.maldito ? { [s.maldito]: 2 } : {};
      const { conteo, max, masVotados } = recuento(votos, de => pesoVoto(s, de), extra);
      let linchado = null;
      let motivo = null;
      if (max === 0) motivo = 'nadieVota';
      else if (masVotados.length > 1) {
        // Empate: paga el Chivo Expiatorio si está en juego.
        const chivo = conPoder(ctx, s, 'cabeza_turco')[0];
        if (chivo) { linchado = chivo; motivo = 'chivo'; } else motivo = 'empate';
      } else linchado = masVotados[0];

      s.votaciones = (s.votaciones ?? 0) + 1;
      const primeraDeLaPartida = s.votaciones === 1;
      s.votantesProximos = null;
      const pesos = Object.fromEntries(Object.keys(votos).map(de => [de, pesoVoto(s, de)]));
      s.ultimaVotacion = { dia: s.dia, votos, pesos, conteo, linchado, motivo, indultado: false };
      eventos.push({ tipo: 'votos', ...s.ultimaVotacion });
      if (motivo) eventos.push(narrar(motivo));
      cronica(s, linchado
        ? ctx.t('motor.cronica.votacion_linchado', { nombre: nombre(s, linchado) })
        : ctx.t(motivo === 'empate' ? 'motor.cronica.votacion_empate' : 'motor.cronica.votacion_nadie'));

      // Segunda votación pedida por el Juez (salvo que se indulte al Inocente del Pueblo).
      const pidioJuez = s.segundaVotacionPedida;
      s.segundaVotacionPedida = false;

      // Tras la primera votación de la partida, el Ángel pasa a ser un aldeano más.
      const finRondaAngel = () => {
        if (!primeraDeLaPartida) return;
        for (const id of s.ids) if (s.players[id].role === 'angel') s.players[id].flags.comoAldeano = true;
      };

      if (!linchado) {
        if (pidioJuez) { s.segundaVotacion = true; cronica(s, ctx.t('motor.cronica.juez')); }
        finRondaAngel();
        return;
      }
      const p = s.players[linchado];
      if (p.role === 'tonto' && tienePoder(ctx, s, p) && !p.flags.indultado) {
        // El Inocente del Pueblo muestra su carta y se le indulta: pierde el voto (y el cargo de Alguacil).
        // No hay ninguna otra votación ese día: el Juez conserva su poder.
        p.flags.indultado = true;
        p.flags.rolPublico = true;
        p.canVote = false;
        if (s.alguacil === linchado) { s.alguacil = null; s.alguacilPerdido = true; }
        s.ultimaVotacion.indultado = true;
        if (pidioJuez) for (const id of s.ids) if (s.players[id].role === 'juez') s.players[id].flags.juezUsado = false;
        eventos.push(narrar('indultoTonto', { nombre: p.name }));
        finRondaAngel();
        return;
      }
      if (pidioJuez) {
        s.segundaVotacion = true;
        cronica(s, ctx.t('motor.cronica.juez'));
      }
      // El Ángel linchado en la primera votación de la partida gana.
      if (primeraDeLaPartida && p.role === 'angel') {
        s.ganadorForzado = 'angel';
        s.segundaVotacion = false;
        eventos.push(...killPlayers(ctx, s, [{ id: linchado, causa: 'linchado' }]));
        return;
      }
      finRondaAngel();
      // Con la Doncella Leal en el mazo, antes de revelar la carta se le da su oportunidad.
      if (enJuego(s, 'sirvienta')) {
        s.linchamiento = { id: linchado, sirvienta: null };
        eventos.push(narrar('linchamientoDecidido', { nombre: p.name }));
        s.queue.unshift('sirvienta', 'ejecucion');
        return;
      }
      eventos.push(...killPlayers(ctx, s, [{ id: linchado, causa: 'linchado' }]));
    },
  },

  // La Doncella Leal puede ocupar el lugar del linchado (antes de revelar su carta).
  sirvienta: {
    fase: 'dia',
    duracion: 'sirvienta',
    acabaAntes: true, // solo si acepta: si no hace nada, el paso dura su tiempo fijo
    actores: (ctx, s) => vivos(s).filter(id => s.players[id].role === 'sirvienta'
      && id !== s.linchamiento?.id && !s.players[id].flags.enamorado),
    opciones: () => ['tomar'],
    inicio: (ctx, s, eventos) => eventos.push(narrar('sirvienta', { nombre: nombre(s, s.linchamiento.id) })),
    vista: (ctx, s, id) => ({
      accion: 'boton',
      titulo: ctx.t('motor.paso.sirvienta.titulo'),
      ayuda: ctx.t('motor.paso.sirvienta.ayuda', { nombre: nombre(s, s.linchamiento.id) }),
      boton: { valor: 'tomar', texto: ctx.t('motor.paso.sirvienta.boton', { nombre: nombre(s, s.linchamiento.id) }) },
      eleccion: s.inputs[id] ?? null,
    }),
    cierre(ctx, s) {
      const quien = s.current.actores.find(id => s.inputs[id] === 'tomar');
      if (quien) s.linchamiento.sirvienta = quien;
    },
  },

  // Ejecución del linchado (después de la Doncella).
  ejecucion: {
    fase: 'dia',
    actores: () => [],
    inicio(ctx, s, eventos) {
      const L = s.linchamiento;
      s.linchamiento = null;
      if (!L || !s.players[L.id].alive) return;
      const victima = s.players[L.id];
      const sv = L.sirvienta && s.players[L.sirvienta];
      if (!sv || !sv.alive) {
        eventos.push(...killPlayers(ctx, s, [{ id: L.id, causa: 'linchado' }]));
        return;
      }
      // La Doncella toma la carta del linchado: poderes restaurados, como en su primera noche.
      eventos.push(narrar('sirvientaRevela', { sirvienta: sv.name, nombre: victima.name }));
      const infectada = !!sv.flags.infectado;
      sv.role = victima.role;
      sv.flags = {
        exSirvienta: true,
        ...(infectada ? { lobo: true, infectado: true } : {}),
        ...structuredClone(FLAGS_INICIALES[victima.role] ?? {}),
      };
      if (s.alguacil === sv.id) { s.alguacil = null; s.alguacilPerdido = true; }
      cronica(s, ctx.t('motor.cronica.sirvienta', { nombre: sv.name, victima: victima.name, rol: rolNombre(ctx, victima.role) }));
      eventos.push(...killPlayers(ctx, s, [{ id: L.id, causa: 'linchado', sustituido: true }]));
    },
  },

  // Pausa para que la tablet muestre los votos y anuncie al linchado.
  resultado: {
    fase: 'dia',
    actores: () => [],
  },

  // --- Interrupciones (se abren tras una muerte) ---------------------------------

  cazador: {
    fase: 'dia',
    duracion: 'interrupcion',
    acabaAntes: true, // de día no hay nada que ocultar: se cierra en cuanto decide
    actores: (ctx, s) => [s.current.datos.id],
    opciones: (ctx, s, id) => otros(s, id),
    inicio: (ctx, s, eventos) => eventos.push(narrar('cazador', { nombre: nombre(s, s.current.datos.id) })),
    vista(ctx, s, id) {
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.cazador.titulo'),
        ayuda: ctx.t('motor.paso.cazador.ayuda'),
        opciones: listaJugadores(s, this.opciones(ctx, s, id)),
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s, eventos) {
      const e = s.inputs[s.current.datos.id];
      if (e && s.players[e].alive) {
        cronica(s, ctx.t('motor.cronica.cazador', { nombre: nombre(s, s.current.datos.id), objetivo: nombre(s, e) }));
        eventos.push(...killPlayers(ctx, s, [{ id: e, causa: 'disparo' }]));
      } else eventos.push(narrar('cazadorNoDispara'));
    },
  },

  // El Alguacil muerto designa a su sucesor (si no elige, al azar).
  sucesor: {
    fase: 'dia',
    duracion: 'interrupcion',
    acabaAntes: true, // de día no hay nada que ocultar: se cierra en cuanto decide
    actores: (ctx, s) => [s.current.datos.id],
    opciones: (ctx, s) => vivos(s),
    inicio: (ctx, s, eventos) => eventos.push(narrar('sucesor', { nombre: nombre(s, s.current.datos.id) })),
    vista(ctx, s, id) {
      return {
        accion: 'elegir',
        titulo: ctx.t('motor.paso.sucesor.titulo'),
        ayuda: ctx.t('motor.paso.sucesor.ayuda'),
        opciones: listaJugadores(s, vivos(s)),
        eleccion: s.inputs[id] ?? null,
      };
    },
    cierre(ctx, s, eventos) {
      const v = vivos(s);
      if (!v.length) return;
      const e = s.inputs[s.current.datos.id];
      s.alguacil = e && s.players[e].alive ? e : pick(s, v);
      eventos.push(narrar('alguacilElegido', { nombre: nombre(s, s.alguacil) }));
      cronica(s, ctx.t('motor.cronica.sucesor', { nombre: nombre(s, s.alguacil) }));
    },
  },

  // El Chivo Expiatorio linchado decide quién vota en la próxima votación.
  chivo: {
    fase: 'dia',
    duracion: 'interrupcion',
    acabaAntes: true, // de día no hay nada que ocultar: se cierra en cuanto decide
    actores: (ctx, s) => [s.current.datos.id],
    validar(ctx, s, id, e) {
      const v = vivos(s);
      if (!Array.isArray(e) || !e.every(x => v.includes(x)) || new Set(e).size !== e.length) return ctx.t('motor.error.eleccion_no_valida');
    },
    inicio: (ctx, s, eventos) => eventos.push(narrar('chivoElige')),
    vista: (ctx, s, id) => ({
      accion: 'varios',
      titulo: ctx.t('motor.paso.chivo.titulo'),
      ayuda: ctx.t('motor.paso.chivo.ayuda'),
      opciones: listaJugadores(s, vivos(s).filter(o => s.players[o].canVote)),
      eleccion: s.inputs[id] ?? [],
    }),
    cierre(ctx, s, eventos) {
      const e = s.inputs[s.current.datos.id];
      if (!Array.isArray(e)) return;
      s.votantesProximos = e;
      eventos.push(narrar('votantesElegidos', { nombres: e.length ? nombres(s, e) : ctx.t('motor.nadie') }));
    },
  },
};

function hermanos(ctx, s, id) {
  const otrosH = s.ids.filter(o => o !== id && s.players[o].role === s.players[id].role).map(o => nombre(s, o));
  return otrosH.length ? ctx.t('motor.paso.hermanos.reconocelos', { nombres: otrosH.join(', ') }) : ctx.t('motor.paso.hermanos.ya_no');
}

export const INTERRUPCIONES = new Set(['cazador', 'sucesor', 'chivo']);

// Pasos tras los que no se abren todavía las interrupciones (se esperan al resultado).
export const DIFIEREN_INTERRUPCIONES = new Set(['votacion', 'sirvienta', 'ejecucion']);

// Orden del día. La elección del Alguacil va la 1.ª mañana, antes del debate.
export function pasosDelDia(s) {
  const eleccion = s.config.alguacil && !s.alguacilElegido && !s.alguacilPerdido;
  return ['amanecer', ...(eleccion ? ['alguacil'] : []), 'debate', 'votacion', 'resultado'];
}
