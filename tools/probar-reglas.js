// Prueba las reglas de seguridad de la base de datos (database.rules.json) contra el emulador de Firebase.
// Comprueba que los datos que escribe el juego se aceptan y que los datos raros o excesivos se rechazan.
//
//   1) Arranca el emulador:   npx firebase-tools emulators:start --only database --project demo-lobos
//   2) En otra terminal:      node tools/probar-reglas.js
// (o todo junto:              npx firebase-tools emulators:exec --only database --project demo-lobos "node tools/probar-reglas.js")
//
// Variables: EMULADOR=host:puerto (por defecto 127.0.0.1:9000).
import { resolverServidor } from '../src/net/servidor.js';

const servidor = resolverServidor(process.env.EMULADOR ?? '127.0.0.1:9000');
let fallos = 0;
let pruebas = 0;

// Las peticiones REST sin credenciales pasan por las reglas (igual que un navegador sin sesión).
async function pedir(metodo, ruta, cuerpo) {
  const r = await fetch(servidor.urlRest(ruta), {
    method: metodo,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { ok: r.ok, estado: r.status };
}

async function debe(descripcion, esperado, metodo, ruta, cuerpo) {
  pruebas += 1;
  const { ok, estado } = await pedir(metodo, ruta, cuerpo);
  if (ok === esperado) {
    console.log(`  ✓ ${descripcion}`);
  } else {
    fallos += 1;
    console.log(`  ✖ ${descripcion} — se esperaba ${esperado ? 'aceptar' : 'rechazar'} y se obtuvo HTTP ${estado}`);
  }
}

const acepta = (d, ruta, cuerpo, metodo = 'PUT') => debe(d, true, metodo, ruta, cuerpo);
const rechaza = (d, ruta, cuerpo, metodo = 'PUT') => debe(d, false, metodo, ruta, cuerpo);

await pedir('DELETE', '/rooms/TEST'); // empezar limpio (sin credenciales también pasa por las reglas)
const sala = '/rooms/TEST';

console.log('Sala y claves');
await acepta('un código de sala de 4 letras mayúsculas', `${sala}/state`, '{"fase":"sala"}');
await rechaza('un código en minúsculas', '/rooms/test/state', '"{}"');
await rechaza('un código de 5 letras', '/rooms/TESTS/state', '"{}"');
await rechaza('escribir fuera de /rooms', '/otra/cosa', 'x');
await rechaza('un hijo desconocido de la sala', `${sala}/basura`, 'x');

console.log('state / public / views (texto con límite de tamaño)');
await acepta('state como texto', `${sala}/state`, 'x'.repeat(30000));
await rechaza('state que no es texto', `${sala}/state`, { a: 1 });
await rechaza('state demasiado grande', `${sala}/state`, 'x'.repeat(400000));
await acepta('public como texto', `${sala}/public`, '{"fase":"noche"}');
await rechaza('public numérico', `${sala}/public`, 5);
await acepta('la vista de un jugador', `${sala}/views/j1`, 'x'.repeat(15000));
await rechaza('una vista que no es texto', `${sala}/views/j1`, { a: 1 });
await acepta('actualización de varias rutas a la vez (como la tablet)', sala, { state: '{}', public: '{}', 'views/j1': '{}', 'views/j2': '{}' }, 'PATCH');
await rechaza('actualización con una ruta inválida', sala, { state: '{}', 'views/j1': 7 }, 'PATCH');

console.log('reloj');
await acepta('reloj completo', `${sala}/reloj`, { paso: 'p3', inicio: 1791675000000, fin: 1791675050000, arrancado: true });
await acepta('reloj en pausa', `${sala}/reloj`, { paso: 'p3', inicio: 1, fin: 2, restante: 12000, arrancado: true });
await rechaza('reloj sin paso', `${sala}/reloj`, { inicio: 1, fin: 2 });
await rechaza('reloj con un campo desconocido', `${sala}/reloj`, { paso: 'p3', inicio: 1, fin: 2, extra: 1 });
await rechaza('reloj con fin de texto', `${sala}/reloj`, { paso: 'p3', inicio: 1, fin: 'mañana' });

console.log('acciones de los celulares');
await acepta('unirse', `${sala}/actions/a1`, { type: 'unirse', id: 'j1abc', nombre: 'Ana', t: 1791675000000 });
await acepta('derecha', `${sala}/actions/a2`, { type: 'derecha', id: 'j1abc', derechaId: 'j2', t: 1 });
await acepta('elegir a un jugador', `${sala}/actions/a3`, { type: 'enviar', id: 'j1', paso: 'p4', eleccion: 'j2', t: 1 });
await acepta('elegir a varios (lista)', `${sala}/actions/a4`, { type: 'enviar', id: 'j1', paso: 'p4', eleccion: ['j2', 'j3'], t: 1 });
await acepta('la Bruja (curar y envenenar)', `${sala}/actions/a5`, { type: 'enviar', id: 'j1', paso: 'p4', eleccion: { curar: 'j2', veneno: 'j5' }, t: 1 });
await acepta('estoy listo', `${sala}/actions/a6`, { type: 'listo', id: 'j1', paso: 'p4', valor: true, t: 1 });
await acepta('poder del Juez', `${sala}/actions/a7`, { type: 'poder', id: 'j1', paso: 'p4', poder: 'segundaVotacion', t: 1 });
await acepta('salir', `${sala}/actions/a8`, { type: 'salir', id: 'j1', t: 1 });
await rechaza('acción sin tipo', `${sala}/actions/b1`, { id: 'j1', t: 1 });
await rechaza('acción sin id', `${sala}/actions/b2`, { type: 'listo', t: 1 });
await rechaza('acción con un campo desconocido', `${sala}/actions/b3`, { type: 'listo', id: 'j1', hack: 'x', t: 1 });
await rechaza('nombre larguísimo', `${sala}/actions/b4`, { type: 'unirse', id: 'j1', nombre: 'x'.repeat(200), t: 1 });
await rechaza('elección con datos anidados', `${sala}/actions/b5`, { type: 'enviar', id: 'j1', eleccion: { a: { b: { c: 1 } } }, t: 1 });
await rechaza('elección con un texto enorme', `${sala}/actions/b6`, { type: 'enviar', id: 'j1', eleccion: 'x'.repeat(5000), t: 1 });
await rechaza('valor que no es booleano', `${sala}/actions/b7`, { type: 'listo', id: 'j1', valor: 'si', t: 1 });

console.log('avisos, presencia y meta');
await acepta('aviso para un jugador', `${sala}/avisos/j1`, { texto: 'No te toca actuar ahora.', t: 1791675000000 });
await rechaza('aviso sin texto', `${sala}/avisos/j1`, { t: 1 });
await rechaza('aviso con un campo desconocido', `${sala}/avisos/j1`, { texto: 'hola', t: 1, x: 1 });
await acepta('presencia (marca de tiempo)', `${sala}/presencia/j1`, 1791675000000);
await rechaza('presencia que no es número', `${sala}/presencia/j1`, 'aquí');
await acepta('meta de la sala', `${sala}/meta`, { creada: 1791675000000 });
await rechaza('meta con fecha de texto', `${sala}/meta`, { creada: 'ayer' });

console.log('lectura y borrado');
await acepta('leer una sala', sala, undefined, 'GET');
await acepta('listar las salas (limpieza de salas viejas)', '/rooms?shallow=true', undefined, 'GET');
await rechaza('leer la raíz', '/', undefined, 'GET');
await acepta('borrar una sala entera', sala, undefined, 'DELETE');

console.log(`\n${fallos ? '✖' : '✔'} ${pruebas - fallos} de ${pruebas} comprobaciones correctas`);
process.exitCode = fallos ? 1 : 0;
