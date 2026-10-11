// Acceso a Firebase Realtime Database.
// Estructura: /rooms/{CODIGO}/
//   state     JSON (texto) con el estado completo del motor — solo la tablet lo lee
//   reloj     { paso, fin, restante } — fin en hora del servidor (ms)
//   public    JSON (texto) con lo que ve todo el mundo
//   views/{id}  JSON (texto) con lo que ve ese jugador
//   avisos/{id} { texto, t } — errores para ese jugador (p. ej. "código no existe")
//   actions/{pushId} acciones que envían los celulares; la tablet las procesa y borra
//   presencia/{id}   el celular está conectado (se borra solo al desconectarse)
//   meta             { creada } — para limpiar salas viejas
// Se guardan como texto JSON porque Firebase borra listas vacías y nulls.
import { initializeApp } from '../../public/vendor/firebase/firebase-app.js';
import {
  getDatabase, connectDatabaseEmulator, ref, get, set, update, push, remove, onValue, onChildAdded, onDisconnect,
  serverTimestamp,
} from '../../public/vendor/firebase/firebase-database.js';
import { servidor } from './servidor.js';
import { planLimpieza } from './limpieza.js';
import { conTiempo } from './errores.js';

const db = getDatabase(initializeApp(servidor.config));
if (servidor.emulador) connectDatabaseEmulator(db, servidor.emulador.host, servidor.emulador.puerto);
const r = ruta => ref(db, ruta);
const parse = snap => (snap.exists() ? JSON.parse(snap.val()) : null);

// Hora del servidor, para que todos los temporizadores coincidan.
let offset = 0;
onValue(r('.info/serverTimeOffset'), s => { offset = s.val() ?? 0; });
export const ahora = () => Date.now() + offset;

export function onConexion(cb) {
  return onValue(r('.info/connected'), s => cb(!!s.val()));
}

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export async function codigoLibre() {
  for (;;) {
    const c = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
    if (!(await conTiempo(() => get(r(`rooms/${c}/state`)))).exists()) return c;
  }
}

export const normalizarCodigo = c => String(c ?? '').trim().toUpperCase();

// --- Tablet ---------------------------------------------------------------

export async function leerSala(sala) {
  const snap = await conTiempo(() => get(r(`rooms/${sala}`)));
  if (!snap.exists()) return null;
  const v = snap.val();
  return { state: v.state ? JSON.parse(v.state) : null, reloj: v.reloj ?? null };
}

// cambios: { state: obj, public: obj, reloj: obj, 'views/j1': obj, 'avisos/j1': obj … }
export function escribir(sala, cambios) {
  const plano = {};
  for (const [k, v] of Object.entries(cambios)) {
    plano[k] = k === 'reloj' || k.startsWith('avisos/') || v === null ? v : JSON.stringify(v);
  }
  return update(r(`rooms/${sala}`), plano);
}

export function escucharAcciones(sala, cb) {
  return onChildAdded(r(`rooms/${sala}/actions`), snap => {
    remove(snap.ref);
    cb(snap.val());
  });
}

// --- Celular --------------------------------------------------------------

export function enviarAccion(sala, accion) {
  return push(r(`rooms/${sala}/actions`), { ...accion, t: serverTimestamp() });
}

export function escucharVista(sala, id, cb) {
  return onValue(r(`rooms/${sala}/views/${id}`), s => cb(parse(s)));
}

export function escucharPublico(sala, cb) {
  return onValue(r(`rooms/${sala}/public`), s => cb(parse(s)));
}

export function escucharReloj(sala, cb) {
  return onValue(r(`rooms/${sala}/reloj`), s => cb(s.val()));
}

export function escucharAviso(sala, id, cb) {
  return onValue(r(`rooms/${sala}/avisos/${id}`), s => cb(s.val()));
}

export async function existeSala(sala) {
  return (await conTiempo(() => get(r(`rooms/${sala}/public`)))).exists();
}

// Cierra una sala para siempre: borra todos sus datos (los celulares verán «sala cerrada»).
export function borrarSala(sala) {
  return remove(r(`rooms/${sala}`));
}

// --- Presencia y limpieza ---------------------------------------------------------------

// El celular marca que está conectado; Firebase lo borra solo si se cae la conexión.
export function marcarPresencia(sala, id) {
  const yo = r(`rooms/${sala}/presencia/${id}`);
  return onValue(r('.info/connected'), s => {
    if (!s.val()) return;
    onDisconnect(yo).remove().then(() => set(yo, serverTimestamp())).catch(() => {});
  });
}

export function escucharPresencia(sala, cb) {
  return onValue(r(`rooms/${sala}/presencia`), s => cb(s.val() ?? {}));
}

export function marcarCreada(sala) {
  return set(r(`rooms/${sala}/meta`), { creada: serverTimestamp() }).catch(() => {});
}

// Borra las salas creadas hace más de `dias` días (las partidas viejas no sirven para nada) y los restos sin partida.
// Las salas sin fecha (de versiones antiguas) se marcan con la hora actual y se borrarán pasado ese plazo.
export async function limpiarSalasViejas(dias = 2) {
  try {
    const leer = async ruta => (await (await fetch(servidor.urlRest(ruta))).json()) ?? {};
    const salas = {};
    for (const codigo of Object.keys(await leer('/rooms?shallow=true'))) {
      const claves = Object.keys(await leer(`/rooms/${codigo}?shallow=true`));
      const creada = claves.includes('meta') ? (await get(r(`rooms/${codigo}/meta`))).val()?.creada ?? null : null;
      salas[codigo] = { claves, creada };
    }
    const { borrar, marcar } = planLimpieza(salas, ahora(), dias);
    await Promise.all([...borrar.map(c => remove(r(`rooms/${c}`))), ...marcar.map(marcarCreada)]);
  } catch { /* no es importante */ }
}
