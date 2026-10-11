// Historial de partidas: un resumen de cada partida terminada y las estadísticas de todas ellas.
// Todo es puro (sin red ni pantalla): la tablet guarda la lista en su propio navegador (src/net/almacen.js).
import { esLobo } from './helpers.js';

export const MAX_PARTIDAS = 100;
const SOLITARIOS = new Set(['flautista', 'angel', 'sectario', 'albino']);

// Quiénes ganan según el resultado de la partida (aproximación para las estadísticas, no una regla del juego):
// con la victoria de la aldea ganan todos los que no son lobos ni solitarios, estén vivos o muertos.
export function ganadoresDe(ctx, s) {
  const jugador = id => s.players[id];
  const con = filtro => s.ids.filter(id => filtro(jugador(id), id));
  switch (s.winner) {
    case 'aldea': return con(p => !esLobo(ctx, p) && !SOLITARIOS.has(p.role));
    case 'lobos': return con(p => esLobo(ctx, p) && p.role !== 'albino');
    case 'enamorados': return con(p => !!p.flags.enamorado);
    case 'flautista': return con(p => p.role === 'flautista');
    case 'albino': return con(p => p.role === 'albino');
    case 'sectario': return con(p => p.role === 'sectario');
    case 'angel': return con(p => p.role === 'angel');
    default: return [];
  }
}

// Identifica una partida (sala, resultado, quién tenía cada rol y el estado final del azar) para no guardarla dos veces.
export function huella(s) {
  const texto = `${s.sala}|${s.winner}|${s.noche}|${s.rng}|${s.ids.map(id => `${id}:${s.players[id].role}`).sort().join(',')}`;
  let h = 5381;
  for (const c of texto) h = ((h * 33) ^ c.codePointAt(0)) >>> 0;
  return h.toString(16);
}

// El resumen que se guarda de una partida terminada.
export function resumirPartida(ctx, s, { fecha = new Date().toISOString(), duracionMin = null } = {}) {
  const ganadores = new Set(ganadoresDe(ctx, s));
  return {
    v: 1,
    fecha,
    sala: s.sala,
    ganador: s.winner,
    abortada: !!s.abortada,
    noches: s.noche,
    duracionMin,
    huella: huella(s),
    jugadores: s.ids.map(id => {
      const p = s.players[id];
      return {
        nombre: p.name, rol: p.role, bando: ctx.roles[p.role]?.bando ?? null,
        vivo: p.alive, bot: !!p.bot, gano: ganadores.has(id), alguacil: s.alguacil === id,
      };
    }),
  };
}

// Añade una partida al principio de la lista (la más reciente primero), sin repetirla y con un máximo.
export function agregarPartida(lista, partida, max = MAX_PARTIDAS) {
  if (lista.some(p => p.huella === partida.huella && p.sala === partida.sala)) return lista;
  return [partida, ...lista].slice(0, max);
}

const contar = (objeto, clave, n = 1) => { objeto[clave] = (objeto[clave] ?? 0) + n; };

export function estadisticas(lista) {
  const abortadas = lista.filter(p => p.abortada).length;
  lista = lista.filter(p => !p.abortada); // las partidas abortadas no cuentan para las estadísticas
  const porGanador = {};
  const roles = {};
  const jugadores = {};
  let noches = 0;
  let conDuracion = 0;
  let minutos = 0;
  let total = 0;
  for (const partida of lista) {
    contar(porGanador, partida.ganador);
    noches += partida.noches ?? 0;
    if (partida.duracionMin != null) { minutos += partida.duracionMin; conDuracion += 1; }
    total += partida.jugadores.length;
    for (const j of partida.jugadores) {
      roles[j.rol] ??= { veces: 0, victorias: 0 };
      roles[j.rol].veces += 1;
      if (j.gano) roles[j.rol].victorias += 1;
      if (!j.bot) {
        jugadores[j.nombre] ??= { nombre: j.nombre, partidas: 0, victorias: 0 };
        jugadores[j.nombre].partidas += 1;
        if (j.gano) jugadores[j.nombre].victorias += 1;
      }
    }
  }
  const n = lista.length;
  return {
    partidas: n,
    abortadas,
    porGanador,
    nochesMedias: n ? noches / n : 0,
    duracionMediaMin: conDuracion ? minutos / conDuracion : null,
    jugadoresMedios: n ? total / n : 0,
    roles: Object.entries(roles).map(([rol, d]) => ({ rol, ...d })).sort((a, b) => b.veces - a.veces || a.rol.localeCompare(b.rol)),
    jugadores: Object.values(jugadores).sort((a, b) => b.victorias - a.victorias || b.partidas - a.partidas || a.nombre.localeCompare(b.nombre)),
  };
}
