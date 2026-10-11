// Prepara una versión nueva, sin tocar git: pasa lo de «Sin publicar» del CHANGELOG a su propia sección con la fecha,
// deja una sección «Sin publicar» vacía y sube la versión de package.json.
//   node tools/preparar-version.js 0.2.0            usa la fecha de hoy
//   node tools/preparar-version.js 0.2.0 2026-10-20 con otra fecha
// Después se revisa el cambio, se hace el commit y se crea la etiqueta (la «release» de GitHub sale sola):
// los pasos exactos se imprimen al terminar y están en CONTRIBUTING.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// ¿Es `nueva` una versión válida y mayor que `actual`? Devuelve null si sí, o el motivo si no.
export function problemaDeVersion(actual, nueva) {
  if (!SEMVER.test(nueva)) return `«${nueva}» no es una versión válida (se espera x.y.z, por ejemplo 0.2.0)`;
  const [a, n] = [actual, nueva].map(v => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) {
    if (n[i] > a[i]) return null;
    if (n[i] < a[i]) break;
  }
  return `la versión ${nueva} no es mayor que la actual (${actual})`;
}

// Devuelve el CHANGELOG con lo de «Sin publicar» convertido en la sección de `version`.
export function ascenderChangelog(texto, version, fecha) {
  const salto = texto.includes('\r\n') ? '\r\n' : '\n'; // se respeta el final de línea del archivo (en Windows suele ser CRLF)
  const lineas = texto.split(salto);
  const inicio = lineas.findIndex(l => l.startsWith('## [Sin publicar]'));
  if (inicio < 0) throw new Error('No hay una sección «## [Sin publicar]» en CHANGELOG.md');
  if (lineas.some(l => l.startsWith(`## [${version}]`))) throw new Error(`La versión ${version} ya tiene sección en CHANGELOG.md`);
  let fin = lineas.findIndex((l, i) => i > inicio && l.startsWith('## ['));
  if (fin < 0) fin = lineas.length;
  const contenido = lineas.slice(inicio + 1, fin).join(salto).trim();
  if (!contenido) throw new Error('«Sin publicar» está vacío: no hay nada que publicar');
  return [...lineas.slice(0, inicio), '## [Sin publicar]', '', `## [${version}] - ${fecha}`, '', contenido, '', ...lineas.slice(fin)].join(salto);
}

// Cambia la versión en el texto de package.json sin tocar nada más de su formato.
export function ascenderPaquete(texto, actual, nueva) {
  const antes = `"version": "${actual}"`;
  if (!texto.includes(antes)) throw new Error(`No encuentro ${antes} en package.json`);
  return texto.replace(antes, `"version": "${nueva}"`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [nueva, fecha = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
  try {
    const rutaPaquete = join(RAIZ, 'package.json');
    const rutaCambios = join(RAIZ, 'CHANGELOG.md');
    const paquete = readFileSync(rutaPaquete, 'utf8');
    const actual = JSON.parse(paquete).version;
    const problema = nueva ? problemaDeVersion(actual, nueva) : 'indica la versión nueva, por ejemplo: node tools/preparar-version.js 0.2.0';
    if (problema) throw new Error(problema);
    if (!FECHA.test(fecha)) throw new Error(`La fecha «${fecha}» no es válida (se espera AAAA-MM-DD)`);
    const cambios = ascenderChangelog(readFileSync(rutaCambios, 'utf8'), nueva, fecha);
    writeFileSync(rutaCambios, cambios);
    writeFileSync(rutaPaquete, ascenderPaquete(paquete, actual, nueva));
    console.log(`✔ CHANGELOG.md y package.json listos para la versión ${nueva} (antes ${actual})\n`);
    console.log('Siguientes pasos (no se hace nada de esto solo):');
    console.log('  1. npm run revisar:imagenes        debe salir en verde (imágenes pequeñas, WebP de verdad y con créditos)');
    console.log('  2. npm test                        y mira el cambio con git diff');
    console.log(`  3. git add CHANGELOG.md package.json && git commit -m "Versión ${nueva}"`);
    console.log(`  4. git tag v${nueva} && git push origin main v${nueva}    (GitHub crea la release con las notas del CHANGELOG)`);
  } catch (e) {
    console.error(`✖ ${e.message}`);
    process.exitCode = 1;
  }
}
