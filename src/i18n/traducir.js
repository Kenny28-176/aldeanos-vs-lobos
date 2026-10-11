// Traducción de textos con claves y marcadores. Son funciones puras (sin navegador), así que las usan tanto
// la interfaz como el motor del juego y las pruebas.
//
// Un diccionario es un objeto plano { 'clave.con.puntos': 'Texto con {marcadores}' }.
// Si falta una clave en el idioma elegido se usa el español (la base); si tampoco está, se devuelve la propia clave.

export const IDIOMAS = { es: 'Español', en: 'English' };
export const IDIOMA_BASE = 'es';

// Sustituye los {marcadores} por sus valores (un marcador sin valor se queda vacío).
export function interpolar(texto, params = {}) {
  return texto.replace(/\{(\w+)\}/g, (_, nombre) => (params[nombre] ?? ''));
}

// Busca la clave en el diccionario del idioma y, si falta, en el de la base.
export function traducir(diccionario, base, clave, params) {
  const texto = diccionario?.[clave] ?? base?.[clave];
  return texto === undefined ? clave : interpolar(texto, params);
}

// Plurales: usa «clave.uno» cuando n vale 1 y «clave.otros» en cualquier otro caso (vale para español e inglés).
export function traducirN(diccionario, base, clave, n, params = {}) {
  return traducir(diccionario, base, `${clave}.${n === 1 ? 'uno' : 'otros'}`, { n, ...params });
}

// Idioma que se usará: ?lang= de la dirección, luego lo guardado y luego el del navegador; por defecto, español.
export function elegirIdioma({ parametro = null, guardado = null, navegador = '' } = {}) {
  const valido = codigo => (codigo && IDIOMAS[codigo] ? codigo : null);
  const delNavegador = valido(String(navegador).toLowerCase().slice(0, 2));
  return valido(parametro) ?? valido(guardado) ?? delNavegador ?? IDIOMA_BASE;
}

// «Lista de nombres»: «A, B y C» en español, «A, B and C» en inglés.
export function listaDeNombres(nombres, conjuncion) {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} ${conjuncion} ${nombres.at(-1)}`;
}
