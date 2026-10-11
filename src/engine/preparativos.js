// Preparativos de la partida que dependen de qué cartas se han repartido:
// el Bufón elige sus tres cartas, el Cultista divide la aldea en grupos y, después del reparto,
// el narrador hace los anuncios públicos del principio.
import { hayRol, nombre } from './helpers.js';
import { shuffle } from './rng.js';

// Estado inicial de los roles que necesitan preparación (solo si alguien tiene esa carta):
// el Bufón elige tres cartas con poder que no estén en juego y el Cultista divide la aldea en dos grupos.
export function prepararRoles(ctx, s) {
  if (hayRol(s, 'comediante')) {
    const pool = s.config.poolComediante.filter(r => ctx.roles[r]?.implementado);
    const libres = pool.filter(r => !hayRol(s, r));
    const base = libres.length ? libres : pool;
    const cartas = shuffle(s, base).slice(0, 3);
    while (cartas.length < 3) cartas.push(base[cartas.length % base.length]);
    s.cartasComediante = cartas;
  }
  if (hayRol(s, 'sectario')) {
    const mezcla = shuffle(s, s.ids);
    s.grupos = Object.fromEntries(mezcla.map((id, i) => [id, i % 2 === 0 ? 'sol' : 'luna']));
  }
}

// Anuncios públicos del principio de la partida (después del reparto de cartas).
export function anunciosIniciales(ctx, s) {
  const eventos = [];
  if (s.cartasComediante) {
    eventos.push({ tipo: 'narrar', clave: 'comedianteCartas', vars: { cartas: s.cartasComediante.map(r => ctx.roles[r].nombre).join(', ') } });
  }
  if (s.grupos) {
    const ids = s.ids.filter(id => s.grupos[id]);
    eventos.push({ tipo: 'narrar', clave: 'sectarioGrupos', vars: {
      sol: ids.filter(id => s.grupos[id] === 'sol').map(id => nombre(s, id)).join(', '),
      luna: ids.filter(id => s.grupos[id] === 'luna').map(id => nombre(s, id)).join(', '),
    } });
  }
  if (hayRol(s, 'angel')) eventos.push({ tipo: 'narrar', clave: 'angelPrimerDia' });
  return eventos;
}
