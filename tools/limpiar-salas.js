// Mantenimiento de tu base de datos de Firebase: lista las salas guardadas y borra las viejas.
//
//   node tools/limpiar-salas.js                 solo muestra las salas y qué se haría (no borra nada)
//   node tools/limpiar-salas.js --borrar        borra las salas de más de 2 días y los restos sin partida
//   node tools/limpiar-salas.js --dias 7        cambia el plazo (por defecto, 2 días)
//   node tools/limpiar-salas.js --borrar --todas  borra TODAS las salas, incluidas las que estén en juego
//
// Usa la base de datos de src/net/firebaseConfig.js (o el emulador, con EMULADOR=127.0.0.1:9000).
// La app ya hace esta limpieza sola cada vez que una tablet crea una sala; esto sirve para revisarla a mano.
import { resolverServidor } from '../src/net/servidor.js';
import { planLimpieza } from '../src/net/limpieza.js';

const servidor = resolverServidor(process.env.EMULADOR);
const argumentos = process.argv.slice(2);
const borrar = argumentos.includes('--borrar');
const todas = argumentos.includes('--todas');
const dias = Number(argumentos[argumentos.indexOf('--dias') + 1]) || 2;

const leer = async ruta => {
  const r = await fetch(servidor.urlRest(ruta));
  if (!r.ok) throw new Error(`No se pudo leer ${ruta} (HTTP ${r.status}). ¿Están publicadas las reglas de database.rules.json?`);
  return (await r.json()) ?? {};
};

const ahora = Date.now();
const codigos = Object.keys(await leer('/rooms?shallow=true'));
if (!codigos.length) {
  console.log('No hay ninguna sala guardada.');
  process.exit(0);
}

const salas = {};
const detalle = {};
for (const codigo of codigos) {
  const claves = Object.keys(await leer(`/rooms/${codigo}?shallow=true`));
  const meta = claves.includes('meta') ? await leer(`/rooms/${codigo}/meta`) : {};
  const sala = await leer(`/rooms/${codigo}`);
  salas[codigo] = { claves, creada: meta.creada ?? null };
  detalle[codigo] = { bytes: JSON.stringify(sala).length, conectados: Object.keys(sala.presencia ?? {}).length };
}

const plan = planLimpieza(salas, ahora, dias);
const accion = codigo => (todas || plan.borrar.includes(codigo) ? 'BORRAR' : plan.marcar.includes(codigo) ? 'marcar' : 'conservar');
console.log(`${codigos.length} sala(s) en ${servidor.emulador ? 'el emulador' : 'la base de datos'}:\n`);
console.log('código  edad      conectados  tamaño     acción');
for (const codigo of codigos) {
  const { creada } = salas[codigo];
  const edad = creada ? `${((ahora - creada) / 3_600_000).toFixed(1)} h` : 'sin fecha';
  const { bytes, conectados } = detalle[codigo];
  console.log(`${codigo.padEnd(7)} ${edad.padEnd(9)} ${String(conectados).padEnd(11)} ${`${(bytes / 1024).toFixed(1)} KB`.padEnd(10)} ${accion(codigo)}`);
}

const aBorrar = codigos.filter(c => accion(c) === 'BORRAR');
if (!borrar) {
  console.log(`\nNo se ha borrado nada. Para borrar las ${aBorrar.length} sala(s) marcadas: node tools/limpiar-salas.js --borrar${todas ? ' --todas' : ''}`);
} else {
  for (const codigo of aBorrar) {
    const r = await fetch(servidor.urlRest(`/rooms/${codigo}`), { method: 'DELETE' });
    console.log(r.ok ? `  ✓ borrada ${codigo}` : `  ✖ no se pudo borrar ${codigo} (HTTP ${r.status})`);
  }
}
