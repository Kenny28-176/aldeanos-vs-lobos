// Reparto de cartas: al empezar la partida, la app reparte a cada jugador una carta secreta
// al azar del mazo. Si el mazo tiene más cartas que jugadores, se reparte un subconjunto:
//  - los roles de grupo (hermanas, hermanos) entran enteros o no entran;
//  - siempre hay al menos un lobo entre las cartas repartidas (si el mazo tiene alguno).
import { shuffle } from './rng.js';

const esCartaLobo = (ctx, rol) => ctx.roles[rol]?.bando === 'lobos';
const contar = obj => Object.values(obj).reduce((a, b) => a + b, 0);

// Cartas del mazo como lista: { lobo: 2, vidente: 1 } → ['lobo', 'lobo', 'vidente'].
export const expandirMazo = mazo => Object.entries(mazo).flatMap(([rol, n]) => Array(Math.max(0, n)).fill(rol));

// Elige `k` cartas de `quedan` ({ rol: cuántas }) respetando grupos y garantizando un lobo.
export function elegirCartas(ctx, s, quedan, k) {
  const todas = expandirMazo(quedan);
  if (contar(quedan) <= k) return todas;

  // Unidades: cada carta suelta, o el grupo entero.
  const unidades = [];
  for (const [rol, n] of Object.entries(quedan)) {
    if (n <= 0) continue;
    if (ctx.roles[rol]?.grupo) unidades.push(Array(n).fill(rol));
    else for (let i = 0; i < n; i++) unidades.push([rol]);
  }
  const hayLobo = lista => lista.some(r => esCartaLobo(ctx, r));
  const hayLoboEnMazo = hayLobo(todas);

  for (let intento = 0; intento < 80; intento++) {
    let falta = k;
    const elegidas = [];
    for (const u of shuffle(s, unidades)) {
      if (u.length > falta) continue;
      elegidas.push(...u);
      falta -= u.length;
      if (!falta) break;
    }
    if (falta === 0 && (!hayLoboEnMazo || hayLobo(elegidas))) return elegidas;
  }

  // Plan B (casi imposible): se ignoran los grupos y se fuerza un lobo.
  const mezcla = shuffle(s, todas);
  const elegidas = mezcla.slice(0, k);
  if (hayLoboEnMazo && !hayLobo(elegidas)) {
    const lobo = mezcla.slice(k).find(r => esCartaLobo(ctx, r));
    const sustituible = elegidas.findIndex(r => !ctx.roles[r]?.grupo);
    if (lobo && sustituible >= 0) elegidas[sustituible] = lobo;
  }
  return elegidas;
}

// Reparte las cartas a los jugadores que aún no tienen rol (los que ya lo tienen, por asignación
// manual, lo conservan y su carta se descuenta del mazo).
export function repartirCartas(ctx, s) {
  const quedan = { ...s.config.mazo };
  for (const id of s.ids) {
    const rol = s.players[id].role;
    if (rol) quedan[rol] = (quedan[rol] ?? 0) - 1;
  }
  const sinCarta = s.ids.filter(id => !s.players[id].role);
  const cartas = shuffle(s, elegirCartas(ctx, s, quedan, sinCarta.length));
  sinCarta.forEach((id, i) => { s.players[id].role = cartas[i]; });
}
