// Carga los JSON de src/data y src/i18n desde disco (en el navegador se hace con fetch).
import { readFileSync } from 'node:fs';
import { mezclarRoles } from '../src/data/mezclar.js';

const leer = ruta => JSON.parse(readFileSync(new URL(`../src/${ruta}`, import.meta.url), 'utf8'));

export function loadData(idioma = 'es') {
  const base = leer('i18n/es.json');
  return {
    idioma,
    roles: mezclarRoles(leer('data/roles.json'), idioma === 'es' ? null : leer(`data/roles.${idioma}.json`)),
    nightOrder: leer('data/nightOrder.json'),
    narration: leer(`data/narration.${idioma}.json`),
    base,
    textos: idioma === 'es' ? base : leer(`i18n/${idioma}.json`),
  };
}
