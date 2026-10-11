// Qué ve cada celular (viewFor) y qué ve todo el mundo (publicView).
// La tablet las calcula y las escribe en Firebase: views/{id} y public.
// Regla: una vista nunca incluye nada que ese jugador no deba saber.
import { STEPS, INTERRUPCIONES } from './steps.js';
import { necesitaCirculo } from './game.js';
import { esLobo, lobosVivos, nombre, tienePoder, vivos, vecinosVivos } from './helpers.js';

// Muertes nocturnas: no se dice cómo (el veneno de la Alquimista no se delata).
const CAUSA_PUBLICA = { devorado: 'noche', envenenado: 'noche' };

// Lo que el jugador sabe de su propio personaje (se muestra en "Ver mi carta").
function notasDe(ctx, s, p) {
  const f = p.flags;
  const notas = [];
  const nombres = ids => ids.map(id => nombre(s, id)).join(', ');
  const grupo = g => ctx.t(`motor.grupo.${g}`);
  if (f.exSirvienta) notas.push(ctx.t('motor.nota.ex_sirvienta', { rol: ctx.roles[p.role].nombre }));
  if (f.infectado) notas.push(ctx.t('motor.nota.infectado'));
  if (s.alguacil === p.id) notas.push(ctx.t('motor.nota.alguacil'));
  if (f.enamorado) notas.push(ctx.t('motor.nota.enamorado', { nombre: nombre(s, f.enamorado) }));
  if (s.grupos?.[p.id]) {
    notas.push(ctx.t('motor.nota.grupo', { grupo: grupo(s.grupos[p.id]) }));
    if (p.role === 'sectario' && !esLobo(ctx, p)) notas.push(ctx.t('motor.nota.sectario_objetivo', { grupo: grupo(s.grupos[p.id] === 'sol' ? 'luna' : 'sol') }));
  }
  if (p.role === 'dos_hermanas' || p.role === 'tres_hermanos') {
    notas.push(ctx.t('motor.nota.hermanos', { nombres: nombres(s.ids.filter(o => o !== p.id && s.players[o].role === p.role)) }));
  }
  for (const v of f.visiones ?? []) notas.push(ctx.t('motor.nota.vision', { noche: v.noche, nombre: v.nombre, rol: v.rol }));
  for (const o of f.olfatos ?? []) notas.push(ctx.t(o.hay ? 'motor.nota.olfato_si' : 'motor.nota.olfato_no', { noche: o.noche, grupo: o.grupo.join(', ') }));
  if (p.role === 'zorro' && f.sinOlfato) notas.push(ctx.t('motor.nota.sin_olfato'));
  if (f.espio) notas.push(ctx.t('motor.nota.espio', { noche: f.espio.noche, lobo: f.espio.lobo }));
  if (p.role === 'bruja' || f.prestado?.rol === 'bruja') {
    notas.push(ctx.t('motor.nota.pociones', {
      vida: ctx.t(f.pocionVida ? 'motor.pocion.disponible' : 'motor.pocion.usada'),
      muerte: ctx.t(f.pocionMuerte ? 'motor.pocion.disponible' : 'motor.pocion.usada'),
    }));
  }
  if (p.role === 'anciano' && f.vidas === 1) notas.push(ctx.t('motor.nota.anciano_vida'));
  if (f.indultado) notas.push(ctx.t('motor.nota.indultado'));
  if (p.role === 'nino_salvaje' && f.modelo) {
    notas.push(f.transformado
      ? ctx.t('motor.nota.nino_transformado', { nombre: nombre(s, f.modelo) })
      : ctx.t(f.modeloAlAzar ? 'motor.nota.nino_modelo_azar' : 'motor.nota.nino_modelo', { nombre: nombre(s, f.modelo) }));
  }
  if (p.role === 'perro_lobo' && f.perroEligio) notas.push(ctx.t(f.lobo ? 'motor.nota.perro_lobo' : 'motor.nota.perro_aldeano'));
  if (p.role === 'infecto') notas.push(ctx.t(f.infectoUsado ? 'motor.nota.infecto_usado' : 'motor.nota.infecto_disponible'));
  if (p.role === 'lobo_feroz') notas.push(ctx.t(s.ferozSinPoder ? 'motor.nota.feroz_sin_poder' : 'motor.nota.feroz_poder'));
  if (p.role === 'albino') notas.push(ctx.t('motor.nota.albino'));
  if (p.role === 'juez') notas.push(ctx.t(f.juezUsado ? 'motor.nota.juez_usado' : 'motor.nota.juez_disponible'));
  if (p.role === 'domador' && p.alive) notas.push(ctx.t('motor.nota.domador', { vecinos: nombres(vecinosVivos(s, p.id)) || ctx.t('motor.nadie') }));
  if (p.role === 'flautista' && !esLobo(ctx, p)) {
    const h = vivos(s).filter(o => s.players[o].flags.hechizado);
    notas.push(ctx.t('motor.nota.flautista', { lista: h.length ? nombres(h) : ctx.t('motor.nadie_todavia') }));
  }
  if (f.hechizado) notas.push(ctx.t('motor.nota.hechizado', { lista: nombres(vivos(s).filter(o => s.players[o].flags.hechizado)) }));
  if (p.role === 'comediante' && s.cartasComediante) {
    notas.push(ctx.t('motor.nota.comediante_cartas', { cartas: s.cartasComediante.map(r => ctx.roles[r].nombre).join(', ') || ctx.t('motor.ninguna') }));
  }
  if (f.prestado && f.prestado.noche === s.noche) notas.push(ctx.t('motor.nota.comediante_hoy', { rol: ctx.roles[f.prestado.rol].nombre }));
  if (p.role === 'sirvienta') notas.push(ctx.t('motor.nota.sirvienta'));
  if (p.role === 'angel' && f.comoAldeano) notas.push(ctx.t('motor.nota.angel'));
  if (!tienePoder(ctx, s, p)) notas.push(ctx.t('motor.nota.sin_poderes'));
  return notas;
}

// Avisos importantes que el celular muestra en grande una sola vez (cada uno con su clave).
function alertasDe(ctx, s, p) {
  const f = p.flags;
  const a = [];
  if (f.infectado) a.push({ clave: `infectado-${f.infectadoNoche}`, icono: '🩸', texto: ctx.t('motor.alerta.infectado') });
  if (f.transformado) a.push({ clave: 'transformado', icono: '🐺', texto: ctx.t('motor.alerta.transformado') });
  if (f.exSirvienta) a.push({ clave: `sirvienta-${p.role}`, icono: '🕯', texto: ctx.t('motor.alerta.sirvienta', { rol: ctx.roles[p.role].nombre }) });
  if (f.modeloAlAzar) a.push({ clave: 'modelo', icono: '🌿', texto: ctx.t('motor.alerta.modelo', { nombre: nombre(s, f.modelo) }) });
  if (p.role === 'angel' && f.comoAldeano && p.alive) a.push({ clave: 'angel', icono: '🪽', texto: ctx.t('motor.nota.angel') });
  return a;
}

function miRol(ctx, s, p) {
  if (!p.role) return null;
  const r = ctx.roles[p.role];
  const info = { id: p.role, nombre: r.nombre, subtitulo: r.subtitulo ?? null, bando: r.bando, guia: r.guia ?? null };
  if (s.phase !== 'sala') {
    if (esLobo(ctx, p)) info.companeros = lobosVivos(ctx, s).filter(o => o !== p.id).map(o => nombre(s, o));
    info.notas = notasDe(ctx, s, p);
  }
  return info;
}

// Cartas del mazo (información pública) para la guía de roles de los celulares.
const rolesDelMazo = (ctx, s) => Object.entries(s.config.mazo).map(([rol, n]) => ({
  rol, n, nombre: ctx.roles[rol].nombre, subtitulo: ctx.roles[rol].subtitulo ?? null, bando: ctx.roles[rol].bando, guia: ctx.roles[rol].guia ?? null,
  ...(ctx.roles[rol].nota ? { nota: ctx.roles[rol].nota } : {}),
}));

// Cuántas cartas tiene el mazo y cuántos jugadores hay (si sobran cartas, algunas no se reparten).
const resumenMazo = s => ({
  cartas: Object.values(s.config.mazo).reduce((a, b) => a + b, 0),
  jugadores: s.ids.length,
});

export function viewFor(ctx, s, id) {
  const p = s.players[id];
  if (!p) return { pantalla: 'fuera' };
  const base = {
    nombre: p.name, rol: miRol(ctx, s, p), vivo: p.alive,
    mazo: rolesDelMazo(ctx, s), resumenMazo: resumenMazo(s), alertas: alertasDe(ctx, s, p),
  };

  if (s.phase === 'sala') {
    return {
      ...base,
      pantalla: 'sala',
      preguntarDerecha: necesitaCirculo(ctx, s),
      derecha: p.rightId,
      otros: s.ids.filter(o => o !== id).map(o => ({ id: o, nombre: nombre(s, o) })),
    };
  }
  if (s.phase === 'fin') return { ...base, pantalla: 'fin', ganador: s.winner };

  // Va antes que "muerto": el Cazador o el Alguacil actúan justo después de morir.
  const c = s.current;
  if (c && c.actores.includes(id)) {
    const def = STEPS[c.tipo];
    return {
      ...base, pantalla: 'accion', paso: c.id, tipo: c.tipo, listo: !!s.listos?.[id],
      ...(def.vista?.(ctx, s, id) ?? {}),
    };
  }
  if (!p.alive) {
    return {
      ...base, pantalla: 'muerto',
      // Opción de la sala: los muertos ven todas las cartas (ya no pueden hablar).
      ...(s.config.muertosVenTodo ? { reparto: s.ids.map(o => ({ nombre: nombre(s, o), rol: ctx.roles[s.players[o].role].nombre, rolId: s.players[o].role, vivo: s.players[o].alive })) } : {}),
    };
  }
  // Pantalla neutra: idéntica para todos los que no actúan (no delata quién está despierto).
  return { ...base, pantalla: s.phase === 'noche' ? 'noche' : 'dia', paso: c?.id ?? null, tipo: s.phase === 'noche' ? null : c?.tipo };
}

export function publicView(ctx, s) {
  const c = s.current;
  const jugadores = s.ids.map(id => {
    const p = s.players[id];
    const v = { id, nombre: p.name, vivo: p.alive };
    if (s.alguacil === id) v.alguacil = true;
    if (p.flags.rolPublico) { v.rolPublico = ctx.roles[p.role].nombre; v.rolPublicoId = p.role; }
    if (p.flags.exSirvienta) v.exSirvienta = true;
    if (s.grupos?.[id]) v.grupo = s.grupos[id];
    if (!p.canVote && p.alive) v.noVota = true;
    if (p.bot) v.bot = true;
    if (s.phase === 'sala') v.sentado = !!p.rightId;
    return v;
  });
  const dia = s.phase === 'dia';
  return {
    fase: s.phase,
    noche: s.noche,
    dia: s.dia,
    // De noche no se publica qué rol está actuando en pantalla (solo lo dice la voz).
    paso: c ? {
      id: c.id, tipo: s.phase === 'noche' ? 'noche' : c.tipo, duracion: c.duracion, acabaAntes: c.acabaAntes,
      // De día se ve cuántos están listos (debate: quieren votar; votación: han votado).
      ...(dia && c.actores.length ? {
        total: c.actores.length,
        listos: c.actores.filter(id => s.listos?.[id] || (STEPS[c.tipo].acabaAntes && s.inputs[id] != null)).length,
        ...(c.tipo === 'debate' ? { necesarios: Math.ceil(c.actores.length * 0.75) } : {}),
      } : {}),
    } : null,
    jugadores,
    orden: s.phase === 'sala' ? null : s.order.map(id => nombre(s, id)),
    muertos: s.cementerio.map(m => ({
      nombre: m.nombre,
      causa: CAUSA_PUBLICA[m.causa] ?? m.causa,
      rol: m.rol ? ctx.roles[m.rol].nombre : null,
      rolId: m.rol,
      bando: m.rol ? ctx.roles[m.rol].bando : null,
      noche: m.noche,
      dia: m.dia,
    })),
    votacion: s.ultimaVotacion && (c?.tipo === 'resultado' || s.phase === 'fin' || INTERRUPCIONES.has(c?.tipo)) ? {
      votos: Object.entries(s.ultimaVotacion.votos).map(([de, a]) => ({
        de: nombre(s, de), a: nombre(s, a), peso: s.ultimaVotacion.pesos?.[de] ?? 1,
      })),
      linchado: s.ultimaVotacion.linchado ? nombre(s, s.ultimaVotacion.linchado) : null,
      motivo: s.ultimaVotacion.motivo,
      indultado: !!s.ultimaVotacion.indultado,
    } : null,
    alguacil: s.alguacil ? nombre(s, s.alguacil) : null,
    votantesProximos: s.votantesProximos ? s.votantesProximos.map(id => nombre(s, id)) : null,
    aldeaSinPoderes: !!s.aldeaSinPoderes,
    cartasComediante: s.cartasComediante ? s.cartasComediante.map(rol => ({ rol, nombre: ctx.roles[rol].nombre })) : null,
    grupos: !!s.grupos,
    // Al terminar se revela todo, incluida la crónica secreta de la partida.
    ganador: s.winner,
    reparto: s.phase === 'fin'
      ? s.ids.map(id => ({
        nombre: nombre(s, id), rol: ctx.roles[s.players[id].role].nombre, rolId: s.players[id].role,
        bando: ctx.roles[s.players[id].role].bando, vivo: s.players[id].alive,
        lobo: esLobo(ctx, s.players[id]),
      }))
      : null,
    cronica: s.phase === 'fin' ? s.cronica : null,
  };
}
