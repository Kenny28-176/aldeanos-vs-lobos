// Glosario de los roles (id, nombre y subtítulo en cada idioma) para docs/DISENO.md. Sale de los datos, así que no se queda anticuado:
//   node tools/glosario-roles.js            imprime la tabla
//   node tools/glosario-roles.js --escribir la escribe en docs/DISENO.md (entre las marcas «roles:inicio» y «roles:fin»)
// tests/documentacion.test.js comprueba que lo escrito en DISENO.md coincide con los datos.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const INICIO = '<!-- roles:inicio -->';
export const FIN = '<!-- roles:fin -->';
const leer = ruta => JSON.parse(readFileSync(join(RAIZ, 'src', 'data', ruta), 'utf8')).roles;

// Tabla Markdown con una fila por rol: id, nombre y subtítulo en español y en inglés.
export function tablaDeRoles(es = leer('roles.json'), en = leer('roles.en.json')) {
  const filas = Object.entries(es).map(([id, r]) => `| \`${id}\` | ${r.nombre} | ${r.subtitulo ?? ''} | ${en[id]?.nombre ?? ''} | ${en[id]?.subtitulo ?? ''} |`);
  return ['| Id | Español | Subtítulo | English | Subtitle |', '|---|---|---|---|---|', ...filas].join('\n');
}

// Cambia lo que hay entre las marcas del texto por la tabla actual.
export function conTabla(texto, tabla = tablaDeRoles()) {
  const a = texto.indexOf(INICIO);
  const b = texto.indexOf(FIN);
  if (a < 0 || b < a) throw new Error(`Faltan las marcas ${INICIO} y ${FIN}`);
  return `${texto.slice(0, a + INICIO.length)}\n${tabla}\n${texto.slice(b)}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--escribir')) {
    const ruta = join(RAIZ, 'docs', 'DISENO.md');
    writeFileSync(ruta, conTabla(readFileSync(ruta, 'utf8')));
    console.log('✔ Glosario escrito en docs/DISENO.md');
  } else {
    console.log(tablaDeRoles());
  }
}
