// Ajustes de pantalla de cada dispositivo: tamaño del texto, contraste y animaciones.
// Se guardan en el navegador (no en la partida) y se aplican como atributos de <html>: el CSS hace el resto.
// Al importar este módulo se aplican los ajustes guardados, así que basta con importarlo desde cada página.
const CLAVE = 'lobos:pantalla';

// Valores posibles de cada ajuste (sus etiquetas están en el diccionario: ui.ajuste.<ajuste>.<valor>).
export const OPCIONES = {
  texto: ['normal', 'grande', 'enorme'],
  contraste: ['normal', 'alto'],
  movimiento: ['normal', 'reducido'],
};

// Valores iniciales: respetan lo que ya pide el sistema (contraste alto, menos movimiento).
export function porDefecto(consultar = globalThis.matchMedia?.bind(globalThis)) {
  const pide = consulta => { try { return !!consultar?.(consulta)?.matches; } catch { return false; } };
  return {
    texto: 'normal',
    contraste: pide('(prefers-contrast: more)') ? 'alto' : 'normal',
    movimiento: pide('(prefers-reduced-motion: reduce)') ? 'reducido' : 'normal',
  };
}

// Valida lo guardado: ignora claves y valores desconocidos y completa lo que falte.
export function normalizar(crudo, base = porDefecto()) {
  const ajustes = { ...base };
  for (const [clave, opciones] of Object.entries(OPCIONES)) {
    if (opciones.includes(crudo?.[clave])) ajustes[clave] = crudo[clave];
  }
  return ajustes;
}

export function leerAjustes() {
  try { return normalizar(JSON.parse(globalThis.localStorage?.getItem(CLAVE))); } catch { return normalizar(null); }
}

export function aplicarAjustes(ajustes = leerAjustes(), raiz = globalThis.document?.documentElement) {
  if (raiz) Object.assign(raiz.dataset, ajustes);
  return ajustes;
}

export function guardarAjustes(nuevos) {
  const ajustes = normalizar(nuevos);
  try { globalThis.localStorage?.setItem(CLAVE, JSON.stringify(ajustes)); } catch { /* sin almacenamiento */ }
  return aplicarAjustes(ajustes);
}

aplicarAjustes();
