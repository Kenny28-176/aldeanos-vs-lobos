// A qué servidor se conecta la app.
// Por defecto, al proyecto de Firebase de src/net/firebaseConfig.js. Para pruebas se puede usar el emulador local de
// Firebase añadiendo ?emulador=127.0.0.1:9000 a la dirección (solo se admiten direcciones locales o de red privada,
// para que nadie pueda desviar una partida a un servidor ajeno con un enlace).
// Sirve tanto en el navegador como en Node (las herramientas de prueba), por eso no toca nada del navegador salvo location.
import { firebaseConfig } from './firebaseConfig.js';

const ESPACIO_EMULADOR = 'demo-lobos-default-rtdb';
const CONFIG_EMULADOR = {
  apiKey: 'emulador-sin-clave',
  projectId: 'demo-lobos',
  databaseURL: `https://${ESPACIO_EMULADOR}.firebaseio.com`,
};

const ES_LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

// «host:puerto» → { host, puerto }, o null si no es una dirección local válida.
export function analizarEmulador(texto) {
  if (!texto) return null;
  const [host, puerto = '9000', resto] = String(texto).split(':');
  if (resto !== undefined || !ES_LOCAL.test(host) || !/^\d{2,5}$/.test(puerto)) return null;
  return { host, puerto: Number(puerto) };
}

export function resolverServidor(emuladorTexto = null) {
  const emulador = analizarEmulador(emuladorTexto);
  const base = (emulador ? `http://${emulador.host}:${emulador.puerto}` : firebaseConfig.databaseURL).replace(/\/+$/, '');
  return {
    emulador,
    config: emulador ? CONFIG_EMULADOR : firebaseConfig,
    // Dirección REST de una ruta de la base de datos: urlRest('/rooms/ABCD/meta') o urlRest('/rooms?shallow=true').
    urlRest(ruta) {
      const [camino, consulta = ''] = ruta.split('?');
      const limpio = camino.replace(/^\/+|\/+$/g, '');
      const parametros = [emulador ? `ns=${ESPACIO_EMULADOR}` : '', consulta].filter(Boolean).join('&');
      return `${base}/${limpio}.json${parametros ? `?${parametros}` : ''}`;
    },
    // Mantiene el emulador en un enlace (para el QR de los celulares o al recargar la página).
    conservar(url) {
      if (!emulador) return url;
      const u = new URL(url, globalThis.location?.href ?? 'http://localhost/');
      u.searchParams.set('emulador', `${emulador.host}:${emulador.puerto}`);
      return u.href;
    },
  };
}

export const servidor = resolverServidor(new URLSearchParams(globalThis.location?.search ?? '').get('emulador'));
