// Descarga las bibliotecas externas y las guarda dentro del repositorio (public/vendor/), para que la app no
// dependa de ningún CDN: si un servicio cae o cambia, el juego sigue funcionando (y nadie recibe tu IP de rebote).
//
//   node tools/vendor.js              descarga todo y reescribe public/vendor/ (con sus licencias y vendor.json)
//   node tools/vendor.js --solo=firebase   actualiza solo esa biblioteca (firebase, preact, qrcode o fuentes) y deja las demás
//   node tools/vendor.js --comprobar  verifica que los archivos coinciden con vendor.json y avisa de versiones nuevas
//
// Para actualizar una biblioteca: cambia su versión en LIBRERIAS, ejecuta el script, prueba (npm test y tools/e2e.js)
// y sube el resultado. Las versiones y las huellas (SHA-256) quedan anotadas en public/vendor/vendor.json.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'public', 'vendor');
const MANIFIESTO = join(DESTINO, 'vendor.json');
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const FIREBASE = '13.0.0';
const HTM = '3.1.1';
const QRCODE = '1.4.4';
const FUENTES = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&family=IM+Fell+English:ital@0;1&display=swap';

export const LIBRERIAS = {
  firebase: {
    nombre: 'Firebase JS SDK (app + realtime database)', version: FIREBASE, licencia: 'Apache-2.0',
    archivos: [
      { url: `https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-app.js`, destino: 'firebase/firebase-app.js' },
      {
        url: `https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-database.js`, destino: 'firebase/firebase-database.js',
        // La biblioteca se importa a sí misma por dirección absoluta: se apunta al archivo local.
        transformar: t => t.replaceAll(`https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-app.js`, './firebase-app.js'),
      },
    ],
    licencias: [{ url: `https://raw.githubusercontent.com/firebase/firebase-js-sdk/firebase%40${FIREBASE}/LICENSE`, destino: 'firebase/LICENSE' }],
  },
  preact: {
    nombre: 'htm + Preact (versión «standalone»)', version: HTM, licencia: 'Apache-2.0 (htm) y MIT (Preact)',
    archivos: [{ url: `https://unpkg.com/htm@${HTM}/preact/standalone.module.js`, destino: 'preact/standalone.module.js' }],
    licencias: [
      { url: `https://unpkg.com/htm@${HTM}/LICENSE`, destino: 'preact/LICENSE-htm' },
      { url: 'https://unpkg.com/preact@10/LICENSE', destino: 'preact/LICENSE-preact' },
    ],
  },
  qrcode: {
    nombre: 'qrcode-generator', version: QRCODE, licencia: 'MIT',
    archivos: [{ url: `https://cdn.jsdelivr.net/npm/qrcode-generator@${QRCODE}/qrcode.js`, destino: 'qrcode/qrcode.js' }],
    licencias: [{ url: 'https://raw.githubusercontent.com/kazuhikoarase/qrcode-generator/master/LICENSE', destino: 'qrcode/LICENSE' }],
  },
  fuentes: {
    nombre: 'Cinzel e IM Fell English (Google Fonts)', version: 'v26 / v14', licencia: 'SIL OFL 1.1',
    // Los archivos .woff2 y fuentes.css se generan a partir del CSS de Google Fonts (ver descargarFuentes).
    licencias: [
      { url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/OFL.txt', destino: 'fuentes/OFL-Cinzel.txt' },
      { url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/OFL.txt', destino: 'fuentes/OFL-IMFellEnglish.txt' },
    ],
  },
};

const sha256 = datos => createHash('sha256').update(datos).digest('hex');

async function bajar(url, opciones = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': NAVEGADOR }, ...opciones });
  if (!r.ok) throw new Error(`No se pudo descargar ${url} (HTTP ${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

function escribir(destino, datos) {
  const ruta = join(DESTINO, destino);
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, datos);
  return { destino, sha256: sha256(datos), bytes: datos.length };
}

// Descarga el CSS de Google Fonts, baja cada .woff2 y escribe un fuentes.css que apunta a los archivos locales.
async function descargarFuentes() {
  const css = (await bajar(FUENTES)).toString('utf8');
  const bloques = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/g)];
  if (!bloques.length) throw new Error('No se reconoció el CSS de Google Fonts');
  const campo = (texto, nombre) => texto.match(new RegExp(`${nombre}:\\s*([^;]+);`))?.[1].trim();
  const porArchivo = new Map(); // url → { familia, estilo, subconjunto, pesos[], rango }
  for (const [, subconjunto, cuerpo] of bloques) {
    const url = cuerpo.match(/url\(([^)]+)\)/)[1];
    const f = porArchivo.get(url) ?? {
      familia: campo(cuerpo, 'font-family').replace(/['"]/g, ''), estilo: campo(cuerpo, 'font-style'), subconjunto,
      pesos: [], rango: campo(cuerpo, 'unicode-range'),
    };
    f.pesos.push(Number(campo(cuerpo, 'font-weight')));
    porArchivo.set(url, f);
  }
  const archivos = [];
  let salida = '/* Generado por tools/vendor.js a partir de Google Fonts. Licencia: SIL OFL 1.1 (ver los OFL-*.txt). */\n';
  for (const [url, f] of porArchivo) {
    const slug = `${f.familia.toLowerCase().replace(/\s+/g, '-')}-${f.subconjunto}${f.estilo === 'italic' ? '-cursiva' : ''}.woff2`;
    archivos.push({ ...escribir(`fuentes/${slug}`, await bajar(url)), origen: url });
    const min = Math.min(...f.pesos);
    const max = Math.max(...f.pesos);
    salida += `/* ${f.subconjunto} */\n@font-face {\n  font-family: '${f.familia}';\n  font-style: ${f.estilo};\n`
      + `  font-weight: ${min === max ? min : `${min} ${max}`};\n  font-display: swap;\n  src: url(${slug}) format('woff2');\n`
      + `  unicode-range: ${f.rango};\n}\n`;
  }
  archivos.push(escribir('fuentes/fuentes.css', salida));
  return archivos;
}

// Con `solo` (una lista de identificadores) se actualizan únicamente esas bibliotecas y el resto se queda como está.
async function descargar(solo = null) {
  for (const id of solo ?? []) if (!LIBRERIAS[id]) throw new Error(`Biblioteca desconocida «${id}». Opciones: ${Object.keys(LIBRERIAS).join(', ')}`);
  const previo = solo && existsSync(MANIFIESTO) ? JSON.parse(readFileSync(MANIFIESTO, 'utf8')) : null;
  if (!previo) rmSync(DESTINO, { recursive: true, force: true });
  const manifiesto = previo ?? { librerias: {} };
  manifiesto.generado = new Date().toISOString().slice(0, 10);
  for (const [id, lib] of Object.entries(LIBRERIAS)) {
    if (solo && !solo.includes(id)) continue;
    for (const a of previo?.librerias[id]?.archivos ?? []) rmSync(join(DESTINO, a.destino), { force: true });
    console.log(`→ ${lib.nombre} ${lib.version}`);
    const archivos = [];
    for (const a of lib.archivos ?? []) {
      let texto = await bajar(a.url);
      if (a.transformar) texto = Buffer.from(a.transformar(texto.toString('utf8')), 'utf8');
      archivos.push({ ...escribir(a.destino, texto), origen: a.url });
    }
    if (id === 'fuentes') archivos.push(...await descargarFuentes());
    for (const l of lib.licencias) archivos.push({ ...escribir(l.destino, await bajar(l.url)), origen: l.url });
    manifiesto.librerias[id] = { nombre: lib.nombre, version: lib.version, licencia: lib.licencia, archivos };
  }
  writeFileSync(MANIFIESTO, `${JSON.stringify(manifiesto, null, 2)}\n`);
  writeFileSync(join(DESTINO, 'LEEME.md'), leeme(manifiesto));
  console.log(`\n✔ Bibliotecas guardadas en public/vendor/ (${Object.values(manifiesto.librerias).reduce((n, l) => n + l.archivos.length, 0)} archivos)`);
}

function leeme(manifiesto) {
  const filas = Object.values(manifiesto.librerias).map(l => `| ${l.nombre} | ${l.version} | ${l.licencia} |`).join('\n');
  return `# Bibliotecas de terceros

Estos archivos **no son código del proyecto**: son copias, sin modificar (salvo lo indicado), de las bibliotecas que usa
la app. Se guardan aquí para que el juego no dependa de ningún CDN y para no enviar la dirección IP de los jugadores a
servicios externos. Cada biblioteca conserva su licencia, que está junto a sus archivos.

| Biblioteca | Versión | Licencia |
|---|---|---|
${filas}

- \`vendor.json\` anota de dónde sale cada archivo y su huella SHA-256 (\`tests/vendor.test.js\` la comprueba).
- Cambio respecto al original: en \`firebase-database.js\` la importación de \`firebase-app.js\` apunta al archivo local.
- **Para actualizar:** cambia la versión en \`tools/vendor.js\`, ejecuta \`node tools/vendor.js\`, prueba (\`npm test\` y
  \`node tools/e2e.js\`) y sube el resultado. \`node tools/vendor.js --comprobar\` avisa de versiones nuevas.
`;
}

// Comprueba las huellas y consulta si hay versiones más nuevas en npm. Devuelve el número de problemas.
export async function comprobar({ red = true } = {}) {
  if (!existsSync(MANIFIESTO)) { console.log('✖ Falta public/vendor/vendor.json: ejecuta node tools/vendor.js'); return 1; }
  const manifiesto = JSON.parse(readFileSync(MANIFIESTO, 'utf8'));
  let problemas = 0;
  for (const lib of Object.values(manifiesto.librerias)) {
    for (const a of lib.archivos) {
      const ruta = join(DESTINO, a.destino);
      if (!existsSync(ruta)) { console.log(`✖ Falta ${a.destino}`); problemas += 1; continue; }
      if (sha256(readFileSync(ruta)) !== a.sha256) { console.log(`✖ ${a.destino} no coincide con vendor.json`); problemas += 1; }
    }
  }
  if (!problemas) console.log('✔ Todos los archivos de public/vendor/ coinciden con vendor.json');
  if (red) {
    const paquetes = { firebase: ['firebase', FIREBASE], preact: ['htm', HTM], qrcode: ['qrcode-generator', QRCODE] };
    for (const [id, [paquete, actual]] of Object.entries(paquetes)) {
      try {
        const { version } = await (await fetch(`https://registry.npmjs.org/${paquete}/latest`)).json();
        console.log(version === actual ? `  ${paquete} ${actual}: al día` : `  ${paquete}: hay una versión nueva (${actual} → ${version}). Revisa sus notas antes de actualizar.`);
      } catch { console.log(`  ${paquete}: no se pudo consultar npm`); }
      void id;
    }
  }
  return problemas;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  if (process.argv.includes('--comprobar')) process.exitCode = await comprobar() ? 1 : 0;
  else await descargar(process.argv.find(a => a.startsWith('--solo='))?.slice('--solo='.length).split(','));
}
