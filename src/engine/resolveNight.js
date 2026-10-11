// Resolución de la noche: convierte lo que pasó (s.nocheActual) en muertes e infecciones.
// Orden (sección 7 del CLAUDE.md):
//   1. Víctima de la manada (o la Espía si la pillaron): infección del Corruptor, o
//      protección / curación / segunda vida del Anciano / muerte.
//   2. Víctima del Lobo Feroz: protección / curación / Anciano / muerte.
//   3. Víctima del Lobo Lunar: no la evita el Guardián ni la cura la Alquimista.
//   4. Veneno de la Alquimista.
//   5. Muerte diferida del Caballero de las Espadas (el lobo "oxidado").
import { esLobo, tienePoder, cronica } from './helpers.js';
import { walk } from './circle.js';

export function resolveNight(ctx, s) {
  const n = s.nocheActual;
  const muertes = [];
  const muere = (id, causa, extra = {}) => {
    if (s.players[id]?.alive && !muertes.some(m => m.id === id)) muertes.push({ id, causa, ...extra });
  };
  const protegido = id => (n.protegidos ?? []).includes(id);
  const curado = id => (n.curados ?? []).includes(id);

  const chequearFuego = (v) => {
    if (v === n.quemado) {
      cronica(s, ctx.t('motor.cronica.fuego_salva', { nombre: s.players[v].name }));
      const loboQuemado = walk(s.order, s.players, v, 'derecha', p => esLobo(ctx, p));
      if (loboQuemado) {
        cronica(s, ctx.t('motor.cronica.llamas', { nombre: s.players[loboQuemado].name }));
        muere(loboQuemado, 'quemado');
      }
      return true;
    }
    return false;
  };


  // Mordisco de lobo: el Anciano aguanta el primero (en silencio).
  const mordisco = (id, responsables) => {
    const v = s.players[id];
    if (v.role === 'anciano' && tienePoder(ctx, s, v) && (v.flags.vidas ?? 2) > 1) {
      v.flags.vidas = (v.flags.vidas ?? 2) - 1;
      return;
    }
    muere(id, 'devorado', { responsables });
  };

  // 1. La manada.
  const v = n.victimaLobos;
  const victima = v && s.players[v];
  if (victima?.alive && !esLobo(ctx, victima)) {
    if (n.infectado === v) {
      // La infección no la para el Guardián ni la deshace la Alquimista; al Anciano no le
      // afecta la primera vez que le muerden.
      if (victima.role === 'anciano' && (victima.flags.vidas ?? 2) > 1) {
        victima.flags.vidas = (victima.flags.vidas ?? 2) - 1;
        cronica(s, ctx.t('motor.cronica.infeccion_anciano', { nombre: victima.name }));
      } else {
        victima.flags.lobo = true;
        victima.flags.infectado = true;
        victima.flags.infectadoNoche = s.noche;
        cronica(s, ctx.t('motor.cronica.infectado', { nombre: victima.name }));
      }
    } else if (!(protegido(v) && !n.ninaDescubierta) && !curado(v) && !chequearFuego(v)) {
      // El Guardián no protege a la Espía si la descubren.
      mordisco(v, n.manada ?? []);
    }
  }

  // 2. El Lobo Feroz.
  const f = n.victimaFeroz;
  if (f && s.players[f]?.alive && !esLobo(ctx, s.players[f]) && !protegido(f) && !curado(f) && !chequearFuego(f)) {
    mordisco(f, n.feroz ? [n.feroz] : []);
  }

  // 3. El Lobo Lunar (mata a un lobo; nada lo impide).
  const a = n.victimaAlbino;
  if (a && s.players[a]?.alive) mordisco(a, n.albino ? [n.albino] : []);

  // 4. Veneno.
  for (const id of n.envenenados ?? []) muere(id, 'envenenado');

  // 5. Espada oxidada.
  if (s.oxido && s.oxido.noche === s.noche) {
    muere(s.oxido.id, 'oxido');
    s.oxido = null;
  }
  return muertes;
}
