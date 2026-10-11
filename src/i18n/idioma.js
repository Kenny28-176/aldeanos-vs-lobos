// Idioma de la interfaz en este dispositivo. El español siempre está cargado (es la base); el resto se carga al elegirlo.
//   await iniciarIdioma()                al arrancar: ?lang=, lo guardado o el idioma del navegador
//   t('clave', { marcador: valor })      texto traducido
//   tn('clave', n, { marcador: valor })  con plural (clave.uno / clave.otros)
//   await usarIdioma('en')               cambia de idioma y avisa a quien lo escuche (para volver a pintar la pantalla)
//   recordarIdioma('en')                 guarda la elección en este navegador (sin cambiar la pantalla actual)
import { IDIOMAS, IDIOMA_BASE, elegirIdioma, traducir, traducirN } from './traducir.js';

const CLAVE = 'lobos:idioma';
const leerJson = async codigo => (await fetch(new URL(`./${codigo}.json`, import.meta.url), { cache: 'no-cache' })).json();

let base = {};
let diccionario = {};
let actual = IDIOMA_BASE;
const oyentes = new Set();

export const idiomaActual = () => actual;
export const t = (clave, params) => traducir(diccionario, base, clave, params);
export const tn = (clave, n, params) => traducirN(diccionario, base, clave, n, params);
export const existe = clave => (diccionario[clave] ?? base[clave]) !== undefined;
export const alCambiarIdioma = oyente => { oyentes.add(oyente); return () => oyentes.delete(oyente); };

// Diccionario de un idioma (para el motor, que lo recibe dentro de los datos del juego).
export async function cargarDiccionario(codigo) {
  return leerJson(IDIOMAS[codigo] ? codigo : IDIOMA_BASE);
}

export function recordarIdioma(codigo) {
  if (!IDIOMAS[codigo]) return;
  try { localStorage.setItem(CLAVE, codigo); } catch { /* sin almacenamiento */ }
}

// Cambia el idioma; con { guardar: true } lo recuerda en este navegador.
export async function usarIdioma(codigo, { guardar = false } = {}) {
  if (!IDIOMAS[codigo]) codigo = IDIOMA_BASE;
  if (!Object.keys(base).length) base = await leerJson(IDIOMA_BASE);
  let cargado = true;
  try {
    diccionario = codigo === IDIOMA_BASE ? base : await leerJson(codigo);
  } catch {
    // Si no se pueden cargar los textos del idioma pedido (red caída, archivo que falta), se sigue en español en lugar de
    // dejar la pantalla en blanco (y no se recuerda esa elección: el fallo puede ser pasajero).
    cargado = false;
    codigo = IDIOMA_BASE;
    diccionario = base;
  }
  if (guardar && cargado) recordarIdioma(codigo);
  const cambio = codigo !== actual;
  actual = codigo;
  if (globalThis.document) document.documentElement.lang = codigo;
  if (cambio) oyentes.forEach(oyente => oyente(codigo));
  return codigo;
}

// Al arrancar: ?lang=, lo guardado o el idioma del navegador. Lo pedido con ?lang= se recuerda (es una elección).
export async function iniciarIdioma() {
  let guardado = null;
  try { guardado = localStorage.getItem(CLAVE); } catch { /* sin almacenamiento */ }
  const parametro = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
  return usarIdioma(elegirIdioma({ parametro, guardado, navegador: globalThis.navigator?.language }), { guardar: !!IDIOMAS[parametro] });
}
