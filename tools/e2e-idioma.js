// Prueba del idioma de punta a punta: la tablet elige el idioma (en la portada y en ⚙), lo recuerda al recargar y los
// celulares lo siguen solos, también a mitad de la partida (los nombres de los roles cambian en su pantalla).
// Requiere el servidor local (node tools/serve.js).
//   node tools/e2e-idioma.js [carpetaCapturas]
import { iniciarChrome, borrarSala, espera, log } from './cdp.js';
import { textosDe } from './textos.js';

const BASE = process.env.BASE ?? 'http://localhost:8080/public/';
const { abrir, errores, capturas, cerrar } = await iniciarChrome({ puerto: 9338, capturas: process.argv[2] });
const es = textosDe('es');
const en = textosDe('en');

let fallo = null;
let sala = null;
const paginas = [];
const abrirP = async (...a) => { const p = await abrir(...a); paginas.push(p); return p; };

// Elige un idioma en el selector que haya en pantalla (el de la portada o el del diálogo de ajustes).
const elegir = (tablet, actual, nombre) => tablet.click([actual.T('ui.idioma'), nombre], '.segmentado');

try {
  // 1) La portada sale en el idioma del navegador (español) y se puede cambiar; se recuerda al recargar.
  const tablet = await abrirP('tablet', `${BASE}narrator.html`, { ancho: 1280, alto: 800, movil: false });
  await tablet.esperarTexto(es.T('ui.tablet.crear'), 20000);
  await elegir(tablet, es, 'English');
  await tablet.esperarTexto(en.T('ui.tablet.crear'), 10000);
  const marcas = await tablet.eval(() => ({ lang: document.documentElement.lang, guardado: localStorage.getItem('lobos:idioma') }));
  if (marcas.lang !== 'en' || marcas.guardado !== 'en') throw new Error(`El idioma no queda anotado: ${JSON.stringify(marcas)}`);
  await tablet.eval(() => location.reload());
  await tablet.esperarTexto(en.T('ui.tablet.crear'), 20000);
  log('Portada: cambia de idioma y se recuerda al recargar ✓');

  // 2) El celular (que tiene guardado el español) sigue el idioma de la sala en cuanto entra.
  await tablet.click(en.T('ui.tablet.crear'), null, 20000);
  await tablet.esperarSelector('.codigo');
  sala = await tablet.eval(() => document.querySelector('.codigo').textContent.trim());
  const cel = await abrirP('Perla', `${BASE}player.html?sala=${sala}`, { almacenamiento: { 'lobos:idioma': 'es' } });
  await cel.esperarTexto(es.T('ui.entrar.nombre'));
  await cel.escribir(1, 'Perla');
  await cel.enviarForm();
  await cel.esperarTexto(en.T('ui.sala.dentro'));
  log('El celular entra en español y pasa a inglés porque la sala está en inglés ✓');

  // 3) Cambiar el idioma desde ⚙ en la tablet: el diálogo, la tablet y el celular cambian a la vez.
  await tablet.click('🔊');
  await tablet.esperarTexto(en.T('ui.ajustes.voz_titulo'));
  await elegir(tablet, en, 'Español');
  await tablet.esperarTexto(es.T('ui.ajustes.voz_titulo'));
  await cel.esperarTexto(es.T('ui.sala.dentro'));
  if (await tablet.eval(() => document.documentElement.lang) !== 'es') throw new Error('La tablet no actualiza <html lang>');
  await tablet.click(es.T('ui.ajustes.listo'));
  await tablet.esperarTexto(es.T('ui.sala.cartas_solas'));
  log('Desde ⚙: la tablet y el celular pasan a español ✓');
  await tablet.captura('1-tablet-espanol.png');

  // 4) A mitad de la partida: la carta del celular cambia de idioma (el nombre del rol y su guía).
  for (let i = 0; i < 4; i++) await tablet.click(es.T('ui.sala.bot'));
  await tablet.esperarSelector('.jugadores-sala li', 15000, 5);
  await tablet.click(es.T('ui.nivel.sencillo.nombre'));
  await tablet.esperarTexto(es.T('ui.sala.todo_listo'), 15000);
  await tablet.click(es.T('ui.sala.empezar'));
  await cel.esperarSelector('.carta-reparto', 30000);
  await cel.eval(() => document.querySelector('.carta-tocar').click());
  await cel.esperarSelector('.carta-reparto .hoja-titulo');
  const titulo = () => cel.eval(() => (document.querySelector('.carta-reparto .hoja-titulo')?.textContent ?? '').trim());
  const nombreEs = await titulo();
  const id = es.idRol(nombreEs);
  if (!id) throw new Error(`El celular muestra «${nombreEs}», que no es un rol en español`);
  log(`Perla recibe la carta «${nombreEs}»`);
  await cel.captura('2-celular-carta-espanol.png');

  await tablet.click('⚙');
  await tablet.click(es.T('ui.menu.voz_sonido'));
  await tablet.esperarTexto(es.T('ui.ajustes.voz_titulo'));
  await elegir(tablet, es, 'English');
  await tablet.esperarTexto(en.T('ui.ajustes.voz_titulo'));
  const limite = Date.now() + 15000;
  while (Date.now() < limite && (await titulo()) !== en.rol(id)) await espera(300);
  if ((await titulo()) !== en.rol(id)) throw new Error(`La carta no pasó a inglés: «${await titulo()}» en vez de «${en.rol(id)}»`);
  await cel.esperarTexto(en.T('ui.boton.ya_vi'));
  const restos = (await cel.eval(() => document.body.innerText)).split(String.fromCharCode(10)).filter(l => /[¿¡áéíóúñÁÉÍÓÚÑ]/.test(l));
  if (restos.length) throw new Error(`El celular deja texto en español tras el cambio: ${JSON.stringify(restos)}`);
  await cel.captura('3-celular-carta-ingles.png');
  log(`A mitad de la partida la carta pasa de «${nombreEs}» a «${en.rol(id)}», con su guía y sus botones ✓`);
} catch (e) {
  fallo = e;
  for (const p of paginas) {
    await p.captura(`fallo-${p.nombre}.png`).catch(() => {});
    console.log(`--- ${p.nombre}: ${(await p.texto().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}`);
  }
}

await borrarSala(sala);
if (errores.length) console.log('\nErrores en consola del navegador:\n' + errores.join('\n'));
console.log(fallo ? `\n✖ FALLO: ${fallo.message}` : `\n✔ El idioma funciona de punta a punta. Capturas en ${capturas}`);
cerrar();
process.exitCode = fallo || errores.length ? 1 : 0;
