// Muertes y muertes en cadena. Toda muerte pasa por aquí.
// Cada efecto de CADENA recibe la muerte y puede devolver muertes nuevas (que vuelven a
// pasar por la cadena) o apuntar interrupciones: pasos que se abren justo después
// (el Cazador dispara, el Alguacil designa sucesor, el Chivo Expiatorio elige votantes).
//
// muerte: { id, causa, de?, responsables?, sustituido? }
//   responsables: lobos que causaron un "devorado" (para el Caballero de las Espadas)
//   sustituido: la Doncella Leal tomó su carta → la carta no se revela y los efectos
//               de su rol (disparo, prerrogativas, castigo del Anciano…) no se aplican.
import { rolDe, tienePoder, esLobo, cronica } from './helpers.js';
import { walk } from './circle.js';

// Causas por las que el Cazador dispara.
const CAZADOR_DISPARA = new Set(['devorado', 'linchado', 'pena']);
// Causas que, si matan al Anciano, dejan a la aldea sin poderes.
const ANCIANO_CULPA_ALDEA = new Set(['linchado', 'envenenado', 'disparo']);

const CADENA = [
  // Enamorados: si uno muere, el otro muere de pena.
  (ctx, s, m) => {
    const pareja = s.players[m.id].flags.enamorado;
    return pareja && s.players[pareja].alive ? [{ id: pareja, causa: 'pena', de: m.id }] : [];
  },
  // Cazador: dispara antes de morir.
  (ctx, s, m, eventos, poderAlMorir) => {
    if (!m.sustituido && s.players[m.id].role === 'cazador' && poderAlMorir && CAZADOR_DISPARA.has(m.causa)) {
      s.interrupciones.push({ tipo: 'cazador', datos: { id: m.id } });
    }
    return [];
  },
  // Chivo Expiatorio linchado: decide quién vota en la próxima votación.
  (ctx, s, m, eventos, poderAlMorir) => {
    if (!m.sustituido && s.players[m.id].role === 'cabeza_turco' && poderAlMorir && m.causa === 'linchado') {
      s.interrupciones.push({ tipo: 'chivo', datos: { id: m.id } });
    }
    return [];
  },
  // Alguacil: designa a su sucesor.
  (ctx, s, m) => {
    if (s.alguacil === m.id) {
      s.alguacil = null;
      s.interrupciones.push({ tipo: 'sucesor', datos: { id: m.id } });
    }
    return [];
  },
  // Anciano muerto a manos de la aldea: los aldeanos pierden sus poderes.
  (ctx, s, m, eventos) => {
    if (!m.sustituido && s.players[m.id].role === 'anciano' && ANCIANO_CULPA_ALDEA.has(m.causa) && !s.aldeaSinPoderes) {
      s.aldeaSinPoderes = true;
      eventos.push({ tipo: 'narrar', clave: 'aldeaSinPoderes' });
    }
    return [];
  },
  // Lobo Feroz: pierde su segundo ataque en cuanto cae un lobo, un Niño Salvaje o un Perro
  // Lobo (sean lobos o no).
  (ctx, s, m) => {
    const p = s.players[m.id];
    if (!m.sustituido && (esLobo(ctx, p) || p.role === 'nino_salvaje' || p.role === 'perro_lobo')) s.ferozSinPoder = true;
    return [];
  },
  // Niño Salvaje: si muere su modelo, se convierte en Hombre Lobo (en secreto). Las muertes de
  // una misma resolución son simultáneas: si él también muere en ella, ya no se transforma.
  (ctx, s, m, eventos, poderAlMorir, mueren) => {
    for (const id of s.ids) {
      const n = s.players[id];
      if (n.alive && !mueren.has(id) && n.role === 'nino_salvaje' && n.flags.modelo === m.id && !n.flags.lobo) {
        n.flags.lobo = true;
        n.flags.transformado = true;
        cronica(s, ctx.t('motor.cronica.nino_salvaje', { nombre: n.name }));
      }
    }
    return [];
  },
  // Caballero de las Espadas devorado: el lobo responsable más cercano a su izquierda
  // morirá la noche siguiente.
  (ctx, s, m, eventos, poderAlMorir) => {
    if (m.sustituido || s.players[m.id].role !== 'caballero' || m.causa !== 'devorado' || !poderAlMorir) return [];
    const responsables = m.responsables ?? [];
    const enfermo = walk(s.order, s.players, m.id, 'izquierda', p => responsables.includes(p.id));
    if (enfermo) {
      s.oxido = { id: enfermo, noche: s.noche + 1 };
      cronica(s, ctx.t('motor.cronica.espada', { nombre: s.players[enfermo].name }));
    }
    return [];
  },
];

// muertes: [{ id, causa, … }]. Marca muertos, apunta en el cementerio y devuelve eventos.
export function killPlayers(ctx, s, muertes) {
  const eventos = [];
  const pendientes = [...muertes];
  const mueren = new Set(muertes.map(m => m.id)); // todos los que mueren en esta resolución
  while (pendientes.length) {
    const muerte = pendientes.shift();
    const p = s.players[muerte.id];
    if (!p || !p.alive) continue;
    const poderAlMorir = tienePoder(ctx, s, p);
    p.alive = false;
    const rol = rolDe(ctx, p);
    const revelado = rol.revelarAlMorir && !muerte.sustituido;
    const registro = {
      id: muerte.id,
      nombre: p.name,
      causa: muerte.causa,
      rol: revelado ? p.role : null,
      noche: s.noche,
      dia: s.dia,
    };
    s.cementerio.push(registro);
    cronica(s, ctx.t('motor.cronica.muerte', {
      nombre: p.name, rol: muerte.sustituido ? ctx.t('motor.carta_sirvienta') : rol.nombre, causa: ctx.t(`motor.causa.${muerte.causa}`),
    }));
    eventos.push({
      tipo: 'muerte', ...registro, bando: revelado ? rol.bando : null,
      ...(muerte.de ? { de: s.players[muerte.de].name } : {}),
    });
    const contexto = { ...registro, responsables: muerte.responsables, sustituido: muerte.sustituido };
    for (const efecto of CADENA) {
      const nuevas = efecto(ctx, s, contexto, eventos, poderAlMorir, mueren);
      for (const n of nuevas) mueren.add(n.id);
      pendientes.push(...nuevas);
    }
  }
  return eventos;
}
