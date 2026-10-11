// Prueba del modo sin conexión (service worker) y del aviso de «servidor no responde», en Chrome sin cabeza.
//   1) El service worker se instala y guarda la «carcasa» de la app.
//   2) Con la web caída (se apaga el servidor de la prueba), la página sigue cargando desde la copia guardada.
//   3) Si Firebase no responde, se avisa: primero «reconectando…» y, pasado un rato, que el servidor no responde.
//   4) ?sinsw desactiva el service worker y borra lo guardado.
// No necesita internet ni Firebase: la web se sirve desde un servidor propio de la prueba y Firebase apunta a un puerto cerrado.
//   node tools/e2e-offline.js [carpetaCapturas]      (con IDIOMA=en, la misma prueba con la web en inglés)
process.env.EMULADOR = '127.0.0.1:9998'; // un «emulador» que no existe: Firebase nunca llega a conectar
const { IDIOMA, T } = await import('./textos.js');
const { iniciarChrome, espera, log } = await import('./cdp.js');
const { crearServidor } = await import('./serve.js');

const PUERTO = 8093;
const BASE = `http://localhost:${PUERTO}/public/`;
const encender = () => new Promise((ok, ko) => {
  const web = crearServidor();
  web.once('error', ko);
  web.listen(PUERTO, '127.0.0.1', () => ok(web));
});
const apagar = web => new Promise(ok => { web.closeAllConnections(); web.close(ok); });
const hasta = async (descripcion, comprobar, ms = 20000) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (await comprobar().catch(() => false)) return;
    await espera(250);
  }
  throw new Error(`Se agotó el tiempo esperando: ${descripcion}`);
};

let web = await encender();
const { abrir, errores, capturas, cerrar } = await iniciarChrome({ puerto: 9339, capturas: process.argv[2] });
let fallo = null;
try {
  const p = await abrir('celular', `${BASE}player.html?sw`, { ancho: 380, alto: 780 });
  await p.esperarTexto(T('ui.entrar.boton'), 20000);

  // 1) El service worker se instala y, tras recargar, controla la página y deja los archivos en la caché.
  await hasta('que el service worker esté activo', () => p.eval(async () => !!(await navigator.serviceWorker.getRegistration())?.active));
  await p.eval(() => location.reload());
  await p.esperarTexto(T('ui.entrar.boton'), 20000);
  await hasta('que la página la controle el service worker', () => p.eval(() => !!navigator.serviceWorker.controller));
  await espera(1500); // que termine de guardar lo que acaba de cargar
  const guardados = await p.eval(async () => {
    const nombres = (await caches.keys()).filter(n => n.startsWith('lobos-'));
    const cache = await caches.open(nombres[0]);
    return (await cache.keys()).map(r => new URL(r.url).pathname);
  });
  for (const esperado of ['/public/player.html', '/public/estilos.css', '/src/ui/player.js', '/public/vendor/fuentes/fuentes.css', '/public/vendor/firebase/firebase-database.js', '/src/i18n/es.json', `/src/i18n/${IDIOMA}.json`]) {
    if (!guardados.includes(esperado)) throw new Error(`Falta en la caché ${esperado}. Hay: ${guardados.join(', ')}`);
  }
  if (guardados.some(ruta => ruta.includes('?'))) throw new Error('La caché guarda direcciones con «?»');
  log(`Service worker instalado: ${guardados.length} archivos guardados ✓`);

  // 2) Se apaga la web: la página recargada sale de la caché.
  await apagar(web);
  await p.eval(() => location.reload());
  await p.esperarTexto(T('ui.entrar.boton'), 30000);
  log('Con la web apagada, la página carga desde la copia guardada ✓');

  // 3) Firebase no responde: aviso en dos tiempos.
  await p.esperarTexto(T('ui.conexion.reconectando'), 15000);
  await p.captura('1-sin-conexion.png');
  await p.esperarTexto(T('ui.conexion.caido').split('.')[0], 25000);
  const alerta = await p.eval(() => document.querySelector('.sin-red.grave')?.getAttribute('role'));
  if (alerta !== 'alert') throw new Error('El aviso de conexión no es un role="alert"');
  await p.captura('2-servidor-no-responde.png');
  log('Aviso «Sin conexión» y, después, «El servidor no responde» ✓');

  // 4) ?sinsw desactiva y limpia.
  web = await encender();
  await p.eval(url => { location.href = url; }, `${BASE}player.html?sinsw`);
  await p.esperarTexto(T('ui.entrar.boton'), 20000);
  await hasta('que se borre el service worker y su caché', () => p.eval(async () => {
    const registros = await navigator.serviceWorker.getRegistrations();
    const caches_ = (await caches.keys()).filter(n => n.startsWith('lobos-'));
    return registros.length === 0 && caches_.length === 0;
  }));
  log('?sinsw desactiva el service worker y borra la caché ✓');
} catch (e) {
  fallo = e;
}

await apagar(web).catch(() => {});
// Los intentos de conectar con el «emulador» que no existe (puerto 9998) son lo esperado en esta prueba.
const inesperados = errores.filter(e => !e.includes('127.0.0.1:9998'));
if (inesperados.length) console.log('\nErrores en consola del navegador:\n' + inesperados.join('\n'));
console.log(fallo ? `\n✖ FALLO: ${fallo.message}` : `\n✔ Modo sin conexión correcto. Capturas en ${capturas}`);
cerrar();
process.exitCode = fallo || inesperados.length ? 1 : 0;
