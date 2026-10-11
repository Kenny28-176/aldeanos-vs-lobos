// Extrae de CHANGELOG.md las notas de una versión (para la «release» de GitHub).
//   node tools/notas-version.js 0.2.0      imprime las notas de la versión 0.2.0
//   node tools/notas-version.js            usa la versión de package.json
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// Devuelve el texto de la sección «## [version]» del registro de cambios, o null si no existe.
export function notasDeVersion(changelog, version) {
  const lineas = changelog.split(/\r?\n/);
  const inicio = lineas.findIndex(l => l.startsWith(`## [${version}]`));
  if (inicio < 0) return null;
  let fin = lineas.findIndex((l, i) => i > inicio && l.startsWith('## ['));
  if (fin < 0) fin = lineas.length;
  return lineas.slice(inicio + 1, fin).join('\n').trim();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = process.argv[2] ?? JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;
  const notas = notasDeVersion(readFileSync(join(RAIZ, 'CHANGELOG.md'), 'utf8'), version);
  if (!notas) {
    console.error(`No hay una sección «## [${version}]» en CHANGELOG.md`);
    process.exitCode = 1;
  } else {
    console.log(notas);
  }
}
