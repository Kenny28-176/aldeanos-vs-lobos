// Historial de partidas guardado en el navegador de la tablet (localStorage). No se sube a ningún servidor.
import { agregarPartida } from '../engine/historial.js';

const CLAVE = 'lobos:historial';

export function leerHistorial() {
  try {
    const lista = JSON.parse(globalThis.localStorage?.getItem(CLAVE));
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

// Guarda una partida (sin repetirla) y devuelve la lista actualizada.
export function guardarPartida(partida) {
  const lista = agregarPartida(leerHistorial(), partida);
  try { globalThis.localStorage?.setItem(CLAVE, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
  return lista;
}

export function borrarHistorial() {
  try { globalThis.localStorage?.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
}
