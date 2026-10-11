// Textos de la interfaz para los scripts de prueba (e2e): leen los mismos diccionarios que la app,
// así las pruebas valen para cualquier idioma:  IDIOMA=en node tools/e2e-ensayo.js
import { readFileSync } from 'node:fs';
import { traducir, interpolar } from '../src/i18n/traducir.js';
import { mezclarRoles } from '../src/data/mezclar.js';

const leer = ruta => JSON.parse(readFileSync(new URL(`../src/${ruta}`, import.meta.url), 'utf8'));
const base = leer('i18n/es.json');

// Los textos de un idioma: T(clave, params) y rol(id) (el nombre de un rol).
export function textosDe(idioma) {
  const diccionario = idioma === 'es' ? base : leer(`i18n/${idioma}.json`);
  const roles = mezclarRoles(leer('data/roles.json'), idioma === 'es' ? null : leer(`data/roles.${idioma}.json`)).roles;
  const narracion = leer(`data/narration.${idioma}.json`);
  return {
    T: (clave, params) => traducir(diccionario, base, clave, params),
    rol: id => roles[id].nombre,
    idRol: nombre => Object.keys(roles).find(id => roles[id].nombre === nombre),
    // Una frase del narrador (src/data/narration.<idioma>.json), por ejemplo N('muerte.pena', { nombre, de }).
    // Si la frase tiene variantes (una lista), el narrador elige una al azar: se pide la que se quiere con N(ruta, params, 0).
    N: (ruta, params, variante = null) => {
      const frase = ruta.split('.').reduce((nodo, clave) => nodo?.[clave], narracion);
      const texto = Array.isArray(frase) ? frase[variante ?? -1] : frase;
      if (typeof texto !== 'string') throw new Error(`La narración «${ruta}»${Array.isArray(frase) ? ' tiene variantes: indica cuál (N(ruta, params, 0))' : ' no existe'}`);
      return interpolar(texto, params);
    },
  };
}

// El idioma de la prueba (IDIOMA=en): es también el del navegador de prueba (ver cdp.js).
export const IDIOMA = process.env.IDIOMA ?? 'es';
export const { T, rol, N } = textosDe(IDIOMA);
// ¿Quedan letras o signos del español en un texto? (para comprobar que una pantalla en otro idioma está entera traducida)
export const hayEspanol = texto => /[¿¡áéíóúñÁÉÍÓÚÑ]/.test(texto);
