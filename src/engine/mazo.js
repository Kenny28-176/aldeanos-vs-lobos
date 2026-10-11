// Asistente de mazo: propone un mazo equilibrado según el número de jugadores y el nivel elegido.
// Es una función pura (el azar se inyecta), así que se puede probar sin red ni navegador.
//
// Criterios:
//  - Lobos: uno por cada 4 jugadores, aproximadamente (de 1 a 4); en los niveles altos, alguno especial.
//  - Poderes: una fracción de los no-lobos según el nivel; el resto, aldeanos comunes.
//  - Los roles de grupo (hermanas, hermanos) solo entran en partidas grandes, siempre enteros, y ocupan
//    el sitio de aldeanos comunes (no gastan plazas de poderes).
//  - A lo sumo uno o dos roles solitarios, para que nadie juegue en solitario sin oposición.
//  - Nunca se proponen roles que necesitan el modo Pueblo (versión simplificada).
//  - El nivel «Sencillo» solo usa roles clásicos, que no obligan a sentarse en círculo.

// poder: qué fracción de los jugadores que no son lobos recibe un poder. Los nombres y las descripciones de los
// niveles están en el diccionario de la interfaz (ui.nivel.<id>.nombre / .texto).
export const NIVELES = {
  sencillo: { poder: 0.3 },
  equilibrado: { poder: 0.5 },
  avanzado: { poder: 0.7 },
};

const CLASICOS = ['vidente', 'bruja', 'cazador', 'protector', 'cupido', 'nina'];
const EXTRA = ['anciano', 'tonto', 'cabeza_turco', 'aldeano_aldeano', 'zorro', 'domador', 'caballero', 'juez'];
const AVANZADOS = ['perro_lobo', 'nino_salvaje', 'sirvienta', 'comediante', 'flautista', 'angel', 'sectario'];
const LOBOS_ESPECIALES = ['lobo_feroz', 'infecto', 'albino'];
const SOLITARIOS = ['flautista', 'angel', 'sectario', 'albino'];
const TODOS = [...CLASICOS, ...EXTRA, ...AVANZADOS];

// Con pocos jugadores, algunos roles no tienen gracia (o no se pueden jugar): jugadores mínimos para proponerlos.
const MINIMO = {
  vidente: 3, bruja: 4, cazador: 4, protector: 5, cupido: 5, nina: 5, anciano: 5, tonto: 5, cabeza_turco: 6,
  aldeano_aldeano: 6, zorro: 7, domador: 7, caballero: 7, juez: 7, perro_lobo: 6, nino_salvaje: 6, sirvienta: 6,
  comediante: 7, flautista: 8, angel: 6, sectario: 9, albino: 10, lobo_feroz: 8, infecto: 11,
};

const baraja = (lista, azar) => {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ¿Se puede proponer este rol? (implementado y sin necesitar el modo Pueblo)
const usable = (ctx, rol) => !!ctx.roles[rol]?.implementado && !ctx.roles[rol].requierePueblo;

// Cuántos jugadores admite como máximo el asistente (cartas disponibles).
export const maxJugadores = ctx => Object.entries(ctx.roles)
  .filter(([id]) => usable(ctx, id)).reduce((a, [, r]) => a + r.copias, 0);

// Lobos según el tamaño del grupo: 1 hasta 6 jugadores, 2 hasta 10, 3 hasta 14 y 4 a partir de ahí.
export const numeroDeLobos = n => Math.min(4, Math.max(1, Math.floor((n + 1) / 4)));

/**
 * @param ctx     datos del juego (ctx.roles)
 * @param n       número de jugadores
 * @param nivel   'sencillo' | 'equilibrado' | 'avanzado' | 'azar'
 * @param azar    () => número en [0, 1)
 * @returns { mazo: { rol: cuántas }, lobos, poderes }  con exactamente n cartas
 */
export function sugerirMazo(ctx, n, nivel = 'equilibrado', azar = Math.random) {
  n = Math.max(3, Math.min(Math.floor(n), maxJugadores(ctx)));
  const alAzar = nivel === 'azar';
  const poder = alAzar ? 0.3 + azar() * 0.45 : (NIVELES[nivel] ?? NIVELES.equilibrado).poder;
  const copias = rol => ctx.roles[rol].copias;
  const mazo = {};
  const poner = (rol, k = 1) => { mazo[rol] = (mazo[rol] ?? 0) + k; };
  const total = () => Object.values(mazo).reduce((a, b) => a + b, 0);

  // 1. Lobos (con alguno especial en los niveles altos).
  const L = numeroDeLobos(n);
  let especiales = [];
  if (alAzar || nivel === 'avanzado') {
    const posibles = LOBOS_ESPECIALES.filter(r => usable(ctx, r) && n >= (MINIMO[r] ?? 3));
    especiales = baraja(posibles, azar).slice(0, Math.floor(L / 2));
  }
  poner('lobo', L - especiales.length);
  for (const r of especiales) poner(r);

  const solitariosMax = n >= 12 ? 2 : 1;
  let solitarios = especiales.filter(r => SOLITARIOS.includes(r)).length;
  let quedan = Math.round((n - L) * poder); // plazas de poderes sueltos

  // 2. Grupos (hermanas / hermanos): ocupan sitio de aldeanos comunes.
  if (nivel !== 'sencillo') {
    let puestos = 0;
    for (const [rol, minimo] of baraja([['dos_hermanas', 8], ['tres_hermanos', 11]], azar)) {
      const k = copias(rol);
      if (puestos >= (n >= 14 ? 2 : 1) || !usable(ctx, rol) || n < minimo) continue;
      if (total() + k + quedan > n) continue; // que sigan cabiendo los poderes sueltos
      if (azar() < 0.6) { poner(rol, k); puestos += 1; }
    }
  }
  quedan = Math.min(quedan, n - total());

  // 3. Poderes sueltos: Vidente y Alquimista primero; el resto, al azar dentro del nivel.
  const base = nivel === 'sencillo' ? CLASICOS : nivel === 'equilibrado' ? [...CLASICOS, ...EXTRA] : TODOS;
  const candidatos = alAzar ? baraja(TODOS, azar)
    : [...['vidente', 'bruja'].filter(r => base.includes(r)), ...baraja(base.filter(r => r !== 'vidente' && r !== 'bruja'), azar)];
  for (const rol of candidatos) {
    if (quedan < 1 || total() >= n) break;
    if (!usable(ctx, rol) || n < (MINIMO[rol] ?? 3) || mazo[rol] || ctx.roles[rol].grupo) continue;
    if (SOLITARIOS.includes(rol) && solitarios >= solitariosMax) continue;
    poner(rol);
    quedan -= 1;
    if (SOLITARIOS.includes(rol)) solitarios += 1;
  }

  // 4. Relleno con aldeanos comunes. Si no caben todos (partidas muy grandes), se añaden más poderes:
  //    primero los que tienen sentido con este número de jugadores y no obligan a sentarse en círculo;
  //    después, los demás; después, los grupos enteros y, al final, más lobos.
  const tope = copias('aldeano');
  const relleno = () => n - total();
  if (relleno() > tope) {
    const orden = baraja(TODOS, azar);
    const tiene = r => n >= (MINIMO[r] ?? 3);
    const vecinos = r => !!ctx.roles[r].usaVecinos;
    const preferidos = alAzar ? orden : [
      ...orden.filter(r => tiene(r) && !vecinos(r)), ...orden.filter(r => tiene(r) && vecinos(r)),
      ...orden.filter(r => !tiene(r)),
    ];
    for (const rol of preferidos) {
      if (relleno() <= tope) break;
      if (!usable(ctx, rol) || mazo[rol] || ctx.roles[rol].grupo) continue;
      if (SOLITARIOS.includes(rol) && solitarios >= solitariosMax + 2) continue;
      poner(rol);
      if (SOLITARIOS.includes(rol)) solitarios += 1;
    }
    for (const rol of ['dos_hermanas', 'tres_hermanos']) {
      if (relleno() <= tope) break;
      if (usable(ctx, rol) && !mazo[rol] && total() + copias(rol) <= n) poner(rol, copias(rol));
    }
  }
  for (const rol of LOBOS_ESPECIALES) {
    if (relleno() <= tope) break;
    if (usable(ctx, rol) && !mazo[rol]) poner(rol);
  }
  while (relleno() > tope && (mazo.lobo ?? 0) < copias('lobo')) poner('lobo');
  if (relleno() > 0) poner('aldeano', relleno());

  return { mazo, lobos: L, poderes: Object.keys(mazo).filter(r => r !== 'lobo' && r !== 'aldeano').length };
}
