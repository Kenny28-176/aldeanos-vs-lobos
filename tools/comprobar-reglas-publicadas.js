// Comprueba si las reglas estrictas de database.rules.json ya están publicadas en TU base de datos de Firebase
// (la de src/net/firebaseConfig.js). Desde fuera no se pueden leer las reglas, así que se prueban con dos escrituras
// en una sala inventada (IOIO: la app nunca genera códigos con la «I» ni la «O», no choca con ninguna partida real):
//   1) un dato válido (control): lo aceptan las reglas estrictas y también las antiguas;
//   2) un campo desconocido: solo lo rechazan las estrictas.
// Después borra la sala de prueba. Escribe y borra un dato diminuto en tu base de datos.
//   node tools/comprobar-reglas-publicadas.js     (o: npm run reglas:comprobar)
// Con EMULADOR=host:puerto lo prueba contra el emulador de Firebase (que carga las reglas del repositorio).
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { resolverServidor } from '../src/net/servidor.js';

export const SALA_DE_PRUEBA = 'IOIO';

// A partir de si la base aceptó el dato válido (control) y el campo desconocido (intruso), qué reglas hay publicadas.
export function interpretar({ control, intruso }) {
  if (!control) return { estado: 'inconcluso', mensaje: 'No se pudo guardar ni un dato válido: ¿sin conexión, base de datos bloqueada o reglas distintas a las del juego? No se puede saber.' };
  if (intruso) return { estado: 'abiertas', mensaje: 'La base de datos acepta datos que las reglas estrictas rechazan: tiene reglas antiguas o abiertas. Publica database.rules.json (guía: docs/ALOJAR_TU_COPIA.md, paso 4).' };
  return { estado: 'estrictas', mensaje: 'Las reglas estrictas están publicadas: la base de datos rechaza los datos que no son del juego.' };
}

async function main() {
  const servidor = resolverServidor(process.env.EMULADOR ?? null); // por defecto, la base de datos de verdad
  const pedir = async (metodo, ruta, cuerpo) => (await fetch(servidor.urlRest(ruta), { method: metodo, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) })).ok;
  const sala = `/rooms/${SALA_DE_PRUEBA}`;
  const control = await pedir('PUT', `${sala}/presencia/comprobacion`, Date.now());
  const intruso = control && await pedir('PUT', `${sala}/zz_comprobacion`, 1);
  await pedir('DELETE', sala);
  const { estado, mensaje } = interpretar({ control, intruso });
  console.log(`${{ estrictas: '✔', abiertas: '✖', inconcluso: '?' }[estado]} ${mensaje}`);
  console.log(`  Base de datos: ${servidor.config.databaseURL}`);
  if (estado === 'abiertas') {
    console.log('\nDesde la terminal (después de iniciar sesión con tu cuenta de Google) también se publican con:');
    console.log(`  npx firebase-tools@15 login\n  npx firebase-tools@15 deploy --only database --project ${servidor.config.projectId}`);
  }
  process.exitCode = estado === 'estrictas' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
