// Punto de entrada del motor. Recibe los datos (roles, orden de noche, frases y textos del idioma)
// para funcionar igual en el navegador (fetch) y en Node (pruebas).
import {
  newGame, step, todosListos, puedeAcabar, necesariosDebate, problemasParaEmpezar, necesitaCirculo, DURACIONES,
} from './game.js';
import { viewFor, publicView } from './views.js';
import { narrate } from './narrate.js';
import { buildCircle } from './circle.js';
import { sugerirMazo, maxJugadores, NIVELES } from './mazo.js';
import { traducir, traducirN, listaDeNombres } from '../i18n/traducir.js';

export function createEngine(data) {
  const ctx = {};
  let narracion = null;
  // Aplica los datos de un idioma (se puede cambiar en cualquier momento: el motor lee siempre el ctx actual).
  function usarDatos(nuevos) {
    const diccionario = nuevos.textos ?? {};
    const base = nuevos.base ?? diccionario; // si falta una clave, se usa el español
    ctx.idioma = nuevos.idioma ?? 'es';
    ctx.roles = nuevos.roles.roles ?? nuevos.roles;
    ctx.nightOrder = nuevos.nightOrder;
    ctx.t = (clave, params) => traducir(diccionario, base, clave, params);
    ctx.tn = (clave, n, params) => traducirN(diccionario, base, clave, n, params);
    ctx.lista = nombres => listaDeNombres(nombres, ctx.t('motor.y'));
    narracion = nuevos.narration;
  }
  usarDatos(data);
  return {
    ctx,
    usarDatos,
    newGame: opts => newGame(ctx, opts),
    step: (s, action) => step(ctx, s, action),
    viewFor: (s, id) => viewFor(ctx, s, id),
    publicView: s => publicView(ctx, s),
    narrate: (eventos, elegir) => narrate(ctx, narracion, eventos, elegir),
    todosListos,
    puedeAcabar: s => puedeAcabar(ctx, s),
    necesariosDebate,
    problemasParaEmpezar: s => problemasParaEmpezar(ctx, s),
    necesitaCirculo: s => necesitaCirculo(ctx, s),
    buildCircle,
    sugerirMazo: (n, nivel, azar) => sugerirMazo(ctx, n, nivel, azar),
    maxJugadores: () => maxJugadores(ctx),
    NIVELES,
    DURACIONES,
  };
}
