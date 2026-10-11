// Ayudas para las pruebas: crear partidas con las cartas ya asignadas y jugarlas paso a paso.
import { createEngine } from '../src/engine/index.js';
import { loadData } from './loadData.js';

export const engine = createEngine(loadData());

// Aplica una acción y falla si da error.
export function ok(s, action) {
  const r = engine.step(s, action);
  if (r.error) throw new Error(`${action.type}: ${r.error.mensaje}`);
  return r;
}

// roles: lista de roles en orden de asiento, p. ej. ['lobo', 'aldeano', 'aldeano'].
// Jugadores j1, j2… sentados en círculo (j1 → derecha j2 → …).
// Por defecto sin Alguacil (para que su voto doble no interfiera; actívalo con { alguacil: true }) y sin
// la pausa de reparto (para empezar directamente en la noche; actívala con { mostrarReparto: true }).
export function partida(roles, seed = 1, opciones = {}) {
  let s = engine.newGame({ sala: 'TEST', seed });
  const mazo = {};
  for (const r of roles) mazo[r] = (mazo[r] ?? 0) + 1;
  roles.forEach((_, i) => { s = ok(s, { type: 'unirse', id: `j${i + 1}`, nombre: `J${i + 1}` }).state; });
  s = ok(s, { type: 'configurar', mazo, opciones: { alguacil: false, mostrarReparto: false, ...opciones } }).state;
  roles.forEach((rol, i) => {
    s = ok(s, { type: 'asignar', id: `j${i + 1}`, rol }).state;
    s = ok(s, { type: 'derecha', id: `j${i + 1}`, derechaId: `j${((i + 1) % roles.length) + 1}` }).state;
  });
  return s;
}

// Avanza hasta que el paso actual sea `tipo` (o falla tras muchos intentos).
export function hasta(s, tipo, eventos = []) {
  for (let i = 0; i < 50; i++) {
    if (s.current?.tipo === tipo) return s;
    const r = ok(s, { type: 'avanzar' });
    eventos.push(...r.events);
    s = r.state;
  }
  throw new Error(`No se llegó al paso ${tipo}`);
}

export function enviar(s, id, eleccion) {
  return ok(s, { type: 'enviar', id, paso: s.current.id, eleccion }).state;
}
