// Chequeo de victoria. Devuelve 'aldea' | 'lobos' | 'enamorados' | 'flautista' | 'albino' |
// 'sectario' | 'angel' | 'nadie' | null (la partida sigue).
// Prioridad si se cumplen varias a la vez: nadie vivo → Ángel → enamorados mixtos →
// Flautista → Lobo Lunar → Cultista → lobos → aldea.
import { vivos, esLobo } from './helpers.js';

// Enamorados de bandos distintos (aldeano + lobo): su objetivo es quedar solos.
export function parejaMixta(ctx, s) {
  const a = s.ids.find(id => s.players[id].flags.enamorado);
  if (!a) return null;
  const b = s.players[a].flags.enamorado;
  return esLobo(ctx, s.players[a]) !== esLobo(ctx, s.players[b]) ? [a, b] : null;
}

export function checkVictory(ctx, s) {
  const v = vivos(s);
  if (v.length === 0) return 'nadie';
  if (s.ganadorForzado) return s.ganadorForzado; // el Ángel linchado en la 1.ª votación
  const p = id => s.players[id];

  const pareja = parejaMixta(ctx, s);
  if (pareja && v.length === 2 && pareja.every(id => v.includes(id))) return 'enamorados';

  // Flautista: todos los vivos (menos él) hechizados. Si lo infectaron, ya no juega para sí.
  const flautista = v.find(id => p(id).role === 'flautista' && !esLobo(ctx, p(id)));
  if (flautista && v.length > 1 && v.every(id => id === flautista || p(id).flags.hechizado)) return 'flautista';

  // Lobo Lunar: único superviviente.
  if (v.length === 1 && p(v[0]).role === 'albino') return 'albino';

  // Cultista: vivo, sin infectar, y ha caído todo el otro grupo.
  const sectario = v.find(id => p(id).role === 'sectario' && !esLobo(ctx, p(id)));
  if (sectario && s.grupos && v.every(id => s.grupos[id] === s.grupos[sectario])) return 'sectario';

  const lobos = v.filter(id => esLobo(ctx, p(id)));
  if (lobos.length === 0) return 'aldea';
  // Con el Lobo Lunar vivo entre los lobos, la partida sigue (él quiere quedarse solo).
  if (lobos.length === v.length && !lobos.some(id => p(id).role === 'albino')) return 'lobos';
  return null;
}
