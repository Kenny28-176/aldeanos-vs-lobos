// Revisa y empaqueta la web para publicarla (GitHub Pages).
//
//   node tools/construir-sitio.js            revisa y copia lo necesario a _sitio/
//   node tools/construir-sitio.js --revisar  solo revisa (sin copiar)
//
// La revisión comprueba que todos los archivos a los que apuntan las páginas y los módulos existen y que la app no
// depende de ningún servidor externo para cargar código, estilos, imágenes o tipografías (todo va dentro del repo).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, '_sitio');
const PUBLICAR = ['index.html', 'sw.js', 'public', 'src']; // lo único que necesita la web publicada

function archivos(dir, extensiones) {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta, extensiones));
    else if (extensiones.some(e => nombre.endsWith(e))) salida.push(ruta);
  }
  return salida;
}

const externa = ref => /^(https?:)?\/\//i.test(ref);
const ignorable = ref => !ref || ref.startsWith('#') || /^(data|mailto|tel|javascript|blob):/i.test(ref);

// Referencias de carga (no enlaces de navegación) de cada tipo de archivo.
function referencias(archivo, texto) {
  const refs = [];
  const nombre = archivo.toLowerCase();
  if (nombre.endsWith('.js')) {
    const patrones = [
      /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/g, // import x from '…'
      /import\s*['"]([^'"]+)['"]/g, // import '…'
      /import\(\s*['"]([^'"]+)['"]\s*\)/g, // import('…')
    ];
    for (const p of patrones) for (const m of texto.matchAll(p)) refs.push({ ref: m[1], tipo: 'módulo' });
  } else if (nombre.endsWith('.html')) {
    for (const m of texto.matchAll(/<(script|img|source|iframe|video|audio)\b[^>]*?\bsrc=["']([^"']+)["']/gi)) refs.push({ ref: m[2], tipo: m[1] });
    for (const m of texto.matchAll(/<link\b[^>]*?\bhref=["']([^"']+)["']/gi)) refs.push({ ref: m[1], tipo: 'link' });
    for (const m of texto.matchAll(/<a\b[^>]*?\bhref=["']([^"'#][^"']*)["']/gi)) if (!externa(m[1]) && !ignorable(m[1])) refs.push({ ref: m[1], tipo: 'enlace' });
    for (const m of texto.matchAll(/url=([^"'>\s]+)/gi)) refs.push({ ref: m[1], tipo: 'redirección' });
  } else if (nombre.endsWith('.css')) {
    for (const m of texto.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) refs.push({ ref: m[1], tipo: 'css' });
    for (const m of texto.matchAll(/@import\s+['"]([^'"]+)['"]/g)) refs.push({ ref: m[1], tipo: 'css' });
  } else if (nombre.endsWith('.webmanifest')) {
    for (const m of JSON.parse(texto).icons ?? []) refs.push({ ref: m.src, tipo: 'icono' });
  }
  return refs;
}

// Devuelve la lista de problemas encontrados (vacía si todo está bien).
export function revisarSitio(raiz = RAIZ) {
  const problemas = [];
  const sitio = [
    join(raiz, 'index.html'),
    join(raiz, 'sw.js'),
    ...archivos(join(raiz, 'public'), ['.html', '.css', '.webmanifest']),
    ...archivos(join(raiz, 'public'), ['.js']).filter(f => !relative(raiz, f).replaceAll('\\', '/').startsWith('public/vendor/')),
    ...archivos(join(raiz, 'src'), ['.js']),
  ];
  for (const archivo of sitio) {
    const nombre = relative(raiz, archivo).replaceAll('\\', '/');
    const texto = readFileSync(archivo, 'utf8');
    for (const { ref, tipo } of referencias(archivo, texto)) {
      if (ignorable(ref)) continue;
      if (externa(ref)) {
        problemas.push(`${nombre}: depende de un servidor externo (${tipo}): ${ref}`);
        continue;
      }
      const limpia = decodeURIComponent(ref.split(/[?#]/)[0]);
      // Los módulos y recursos se resuelven desde la carpeta del archivo; en las páginas HTML, también.
      const destino = limpia.startsWith('/') ? join(raiz, limpia) : resolve(dirname(archivo), limpia);
      if (!existsSync(destino) && !existsSync(`${destino}index.html`)) problemas.push(`${nombre}: no existe ${ref} (${tipo})`);
    }
  }
  return problemas;
}

function datosDeVersion() {
  const paquete = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
  let commit = process.env.GITHUB_SHA?.slice(0, 7);
  if (!commit) {
    try { commit = execSync('git rev-parse --short HEAD', { cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { commit = 'local'; }
  }
  return { version: paquete.version, commit, fecha: new Date().toISOString() };
}

// Archivos que el service worker guarda al instalarse: la «carcasa» de la app (páginas, estilos, código, datos,
// bibliotecas y tipografías). Las imágenes de los roles y el audio se guardan solo cuando se usan.
export function listaDePrecarga(sitio) {
  const lista = ['index.html'];
  for (const archivo of archivos(sitio, ['.html', '.css', '.js', '.json', '.webmanifest', '.woff2', '.svg', '.png'])) {
    const ruta = relative(sitio, archivo).replaceAll('\\', '/');
    const esNuestro = ruta.startsWith('public/') || ruta.startsWith('src/');
    const pesado = ruta.startsWith('public/img/roles/') || ruta.startsWith('public/audio/');
    if (esNuestro && !pesado) lista.push(ruta);
  }
  return lista.sort();
}

// Copia la web a `salida` (por defecto _sitio/), estampa la versión en el service worker y escribe version.json.
export function construirSitio(salida = SALIDA) {
  rmSync(salida, { recursive: true, force: true });
  mkdirSync(salida, { recursive: true });
  for (const elemento of PUBLICAR) cpSync(join(RAIZ, elemento), join(salida, elemento), { recursive: true });
  const version = datosDeVersion();
  const precarga = listaDePrecarga(salida);
  // Se sustituyen las constantes (con sus comillas), no las menciones en los comentarios.
  const sw = readFileSync(join(salida, 'sw.js'), 'utf8')
    .replace("'__VERSION__'", `'${version.version}-${version.commit}'`)
    .replace("'__PRECARGA__'", `'${JSON.stringify(precarga)}'`);
  if (/'__[A-Z]+__'/.test(sw)) throw new Error('Quedan marcas sin sustituir en sw.js');
  writeFileSync(join(salida, 'sw.js'), sw);
  writeFileSync(join(salida, 'version.json'), `${JSON.stringify(version, null, 2)}\n`);
  return { ...version, precarga };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problemas = revisarSitio();
  if (problemas.length) {
    console.log(`✖ ${problemas.length} problema(s) en la web:\n${problemas.map(p => `  - ${p}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('✔ La web no depende de servidores externos y todos sus archivos existen');
    if (!process.argv.includes('--revisar')) {
      const v = construirSitio();
      console.log(`✔ Sitio preparado en _sitio/ (versión ${v.version}, commit ${v.commit}, ${v.precarga.length} archivos precargados)`);
    }
  }
}
