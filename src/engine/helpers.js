// Utilidades sobre jugadores y roles que usan varios módulos del motor.
import { neighbors } from './circle.js';

export const vivos = s => s.ids.filter(id => s.players[id].alive);

export function rolDe(ctx, p) {
  return ctx.roles[p.role];
}

// ¿Cuenta como Hombre Lobo? Las cartas de lobo, el Lobo Lunar (para la manada es uno más), los
// infectados, la Doble Naturaleza que eligió ser lobo y el Niño Salvaje convertido (flags.lobo).
export function esLobo(ctx, p) {
  return rolDe(ctx, p)?.bando === 'lobos' || p.role === 'albino' || !!p.flags.lobo;
}

export const lobosVivos = (ctx, s) => vivos(s).filter(id => esLobo(ctx, s.players[id]));

export function nombre(s, id) {
  return s.players[id]?.name ?? '¿?';
}

// ¿Está este rol (alguna carta) en el mazo de la partida?
export const enMazo = (s, rolId) => (s.config.mazo[rolId] ?? 0) > 0;

// ¿Algún jugador tiene esta carta (repartida)? Con un mazo mayor que los jugadores, no basta con que esté en el mazo.
export const hayRol = (s, rolId) => s.ids.some(id => s.players[id].role === rolId);

// ¿Puede actuar este rol esta partida? En el mazo, o como carta del Bufón.
export const enJuego = (s, rolId) =>
  enMazo(s, rolId) || (enMazo(s, 'comediante') && (s.cartasComediante ?? []).includes(rolId));

// ¿Conserva su poder? Si la aldea mató al Anciano, los aldeanos lo pierden todo.
export function tienePoder(ctx, s, p) {
  return !(s.aldeaSinPoderes && rolDe(ctx, p)?.bando === 'aldea');
}

// Jugadores vivos con este rol y con su poder intacto.
export const conPoder = (ctx, s, rolId) =>
  vivos(s).filter(id => s.players[id].role === rolId && tienePoder(ctx, s, s.players[id]));

// Quién actúa como `rolId` esta noche: los que tienen la carta (con poder) y el Bufón
// que esta noche ha tomado prestada esa carta.
export function actuanComo(ctx, s, rolId) {
  const prestados = vivos(s).filter(id => {
    const pr = s.players[id].flags.prestado;
    return pr && pr.rol === rolId && pr.noche === s.noche;
  });
  return [...conPoder(ctx, s, rolId), ...prestados];
}

export const listaJugadores = (s, ids) => ids.map(id => ({ id, nombre: nombre(s, id) }));

// Peso del voto en las votaciones del día (el Alguacil vale doble).
export const pesoVoto = (s, id) => (s.alguacil === id ? 2 : 1);

// Vecinos vivos de un jugador en el círculo (izquierda y derecha, saltando muertos).
export function vecinosVivos(s, id) {
  const { izquierda, derecha } = neighbors(s.order, s.players, id);
  return [...new Set([izquierda, derecha].filter(x => x && x !== id))];
}

// Apunta un hecho en la crónica secreta de la partida (se revela al final).
export function cronica(s, texto) {
  (s.cronica ??= []).push({ noche: s.noche, dia: s.dia, fase: s.phase, texto });
}

// Estado inicial de los roles con recursos (al empezar, o cuando la Doncella toma la carta).
export const FLAGS_INICIALES = {
  bruja: { pocionVida: true, pocionMuerte: true },
  anciano: { vidas: 2 },
};

// Cartas por defecto que puede interpretar el Bufón (nunca lobos).
export const POOL_COMEDIANTE = ['vidente', 'protector', 'bruja', 'zorro'];
