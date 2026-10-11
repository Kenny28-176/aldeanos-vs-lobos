// Carga los datos del juego en el navegador, en el idioma pedido (español por defecto).
import { mezclarRoles } from './mezclar.js';
import { IDIOMA_BASE } from '../i18n/traducir.js';

const url = nombre => new URL(`./${nombre}`, import.meta.url);
const leer = async nombre => (await fetch(url(nombre), { cache: 'no-cache' })).json();
const leerTextos = async codigo => (await fetch(new URL(`../i18n/${codigo}.json`, import.meta.url), { cache: 'no-cache' })).json();

export async function loadData(idioma = IDIOMA_BASE) {
  const [roles, nightOrder, narration, base] = await Promise.all([
    leer('roles.json'), leer('nightOrder.json'), leer(`narration.${idioma}.json`), leerTextos(IDIOMA_BASE),
  ]);
  const traducidos = idioma === IDIOMA_BASE ? null : await leer(`roles.${idioma}.json`);
  return {
    idioma, roles: mezclarRoles(roles, traducidos), nightOrder, narration, base,
    textos: idioma === IDIOMA_BASE ? base : await leerTextos(idioma),
  };
}
