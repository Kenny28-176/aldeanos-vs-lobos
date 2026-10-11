// Ejecuta las pruebas de punta a punta contra el EMULADOR de Firebase, sin tocar ninguna base de datos real:
// las reglas de seguridad, una partida completa con 6 celulares (normal y con texto muy grande + contraste alto),
// el ensayo con bots (en español y en inglés), el cambio de idioma, la accesibilidad y el modo sin conexión.
// Se lanza dentro del emulador (así lo hace la integración continua y `npm run e2e:emulador`):
//
//   npx firebase-tools emulators:exec --only database --project demo-lobos "node tools/ci-emulador.js"
//
// Variables: PRUEBAS=reglas,partida,… (por defecto todas) · CHROME=ruta del navegador · EMULADOR=host:puerto
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIONES = {
  reglas: { guion: 'tools/probar-reglas.js' },
  partida: { guion: 'tools/e2e.js' },
  'partida-accesible': { guion: 'tools/e2e.js', entorno: { ACCESIBLE: '1' } },
  ensayo: { guion: 'tools/e2e-ensayo.js' },
  accesibilidad: { guion: 'tools/e2e-a11y.js' },
  idioma: { guion: 'tools/e2e-idioma.js' },
  'ensayo-en': { guion: 'tools/e2e-ensayo.js', entorno: { IDIOMA: 'en' } },
  'ensayo-en-accesible': { guion: 'tools/e2e-ensayo.js', entorno: { IDIOMA: 'en', ACCESIBLE: '1' } },
  'sin-conexion': { guion: 'tools/e2e-offline.js' },
  'sin-conexion-en': { guion: 'tools/e2e-offline.js', entorno: { IDIOMA: 'en' } },
};
const lista = (process.env.PRUEBAS ?? Object.keys(GUIONES).join(',')).split(',').map(p => p.trim()).filter(Boolean);
for (const p of lista) if (!GUIONES[p]) throw new Error(`Prueba desconocida «${p}». Opciones: ${Object.keys(GUIONES).join(', ')}`);

const entorno = { ...process.env, EMULADOR: process.env.EMULADOR ?? '127.0.0.1:9000', BASE: process.env.BASE ?? 'http://localhost:8080/public/' };

// Servidor de archivos de la web (los celulares y la tablet cargan la app de aquí).
const web = spawn(process.execPath, ['tools/serve.js', '8080'], { cwd: raiz, stdio: 'ignore' });
for (let i = 0; i < 50; i++) {
  if (await fetch(entorno.BASE).then(r => r.ok, () => false)) break;
  await new Promise(r => setTimeout(r, 200));
}

let fallos = 0;
for (const prueba of lista) {
  console.log(`\n━━ ${prueba} ━━`);
  const { guion, entorno: extra } = GUIONES[prueba];
  const hijo = spawn(process.execPath, [guion], { cwd: raiz, env: { ...entorno, ...extra }, stdio: 'inherit' });
  const [codigo] = await once(hijo, 'exit');
  if (codigo) fallos += 1;
}
web.kill();
console.log(fallos ? `\n✖ Fallaron ${fallos} de ${lista.length} grupos de pruebas` : `\n✔ ${lista.length} grupos de pruebas correctos`);
process.exitCode = fallos ? 1 : 0;
