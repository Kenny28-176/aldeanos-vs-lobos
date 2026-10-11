// Prueba de accesibilidad en Chrome sin cabeza: con el texto «muy grande» y el contraste alto, ninguna página se
// desborda en un móvil pequeño; el diálogo de «Pantalla» se maneja con teclado y los ajustes se recuerdan.
// Requiere el servidor local (node tools/serve.js). No escribe nada en la base de datos.
//   node tools/e2e-a11y.js [carpetaCapturas]      (con IDIOMA=en, la interfaz de la aplicación se prueba en inglés)
import { iniciarChrome, espera, log } from './cdp.js';
import { T } from './textos.js';

const BASE = process.env.BASE ?? 'http://localhost:8080/public/';
const { abrir, errores, capturas, cerrar } = await iniciarChrome({ puerto: 9337, capturas: process.argv[2] });

const AJUSTES = JSON.stringify({ texto: 'enorme', contraste: 'alto', movimiento: 'reducido' });
const MOVIL = { ancho: 360, alto: 740 };
let fallo = null;

try {
  // 1) Ninguna página se desborda con el texto muy grande y el contraste alto.
  const paginas = [
    ['player.html', T('ui.entrar.boton')],
    ['index.html', 'Soy jugador'],
    ['como-jugar.html', 'La idea'],
    ['acerca.html', 'Privacidad'],
    ['en/index.html', "I'm a player"],
    ['en/como-jugar.html', 'The idea'],
    ['en/acerca.html', 'Privacy'],
  ];
  for (const [archivo, texto] of paginas) {
    for (const [etiqueta, almacenamiento] of [['normal', null], ['accesible', { 'lobos:pantalla': AJUSTES }]]) {
      const p = await abrir(`${archivo}-${etiqueta}`, `${BASE}${archivo}`, { ...MOVIL, almacenamiento });
      await p.esperarTexto(texto, 20000);
      await espera(500);
      const datos = await p.eval(() => ({ ...document.documentElement.dataset }));
      if (etiqueta === 'accesible') {
        if (datos.texto !== 'enorme' || datos.contraste !== 'alto' || datos.movimiento !== 'reducido') throw new Error(`${archivo}: no se aplicaron los ajustes: ${JSON.stringify(datos)}`);
        const tam = await p.eval(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
        if (tam < 20) throw new Error(`${archivo}: el texto «muy grande» mide solo ${tam}px`);
      }
      const sobra = await p.desborde();
      if (sobra > 1) throw new Error(`${archivo} (${etiqueta}): se desborda ${sobra}px a lo ancho`);
      await p.captura(`${archivo.replace('.html', '').replace('/', '-')}-${etiqueta}.png`);
    }
    log(`${archivo}: sin desbordes con texto muy grande y contraste alto ✓`);
  }

  // 2) La tablet, a su tamaño, con ajustes accesibles.
  const tablet = await abrir('tablet', `${BASE}narrator.html`, { ancho: 1280, alto: 800, movil: false, almacenamiento: { 'lobos:pantalla': AJUSTES } });
  await tablet.esperarTexto(T('ui.tablet.crear'), 20000);
  if (await tablet.desborde() > 1) throw new Error('La portada de la tablet se desborda con el texto muy grande');
  await tablet.captura('tablet-portada-accesible.png');
  log('Portada de la tablet con ajustes accesibles ✓');

  // 3) Ajustes de pantalla en el celular: diálogo accesible, teclado y memoria.
  const cel = await abrir('celular', `${BASE}player.html`, MOVIL);
  await cel.esperarTexto(T('ui.entrar.boton'), 20000);
  // Como lo haría quien usa el teclado o un lector de pantalla: llegar al botón y pulsar Intro.
  await cel.eval(texto => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === texto).focus(), T('ui.boton.pantalla'));
  await cel.tecla('Enter');
  await cel.esperarSelector(`[role="dialog"][aria-label="${T('ui.boton.pantalla')}"]`);
  const foco = await cel.eval(() => !!document.activeElement?.closest('[role="dialog"]'));
  if (!foco) throw new Error('Al abrir el diálogo, el foco no entra en él');
  await espera(800); // que termine la animación de la hoja
  await cel.captura('dialogo-pantalla.png');
  await cel.click(T('ui.ajuste.texto.enorme'));
  await cel.click([T('ui.ajuste.contraste'), T('ui.ajuste.contraste.alto')], '.segmentado');
  const aplicados = await cel.eval(() => ({ ...document.documentElement.dataset }));
  if (aplicados.texto !== 'enorme' || aplicados.contraste !== 'alto') throw new Error(`Los botones no cambian los ajustes: ${JSON.stringify(aplicados)}`);
  const pulsados = await cel.eval(() => [...document.querySelectorAll('.segmentado-botones .btn[aria-pressed="true"]')].map(b => b.textContent.trim()));
  if (!pulsados.includes(T('ui.ajuste.texto.enorme')) || !pulsados.includes(T('ui.ajuste.contraste.alto'))) throw new Error(`aria-pressed no refleja la selección: ${pulsados}`);
  await cel.tecla('Escape');
  const abierto = await cel.eval(() => !!document.querySelector('[role="dialog"]'));
  if (abierto) throw new Error('Escape no cierra el diálogo');
  const devuelto = await cel.eval(() => document.activeElement?.textContent?.trim());
  if (devuelto !== T('ui.boton.pantalla')) throw new Error(`Al cerrar, el foco no vuelve al botón (está en «${devuelto}»)`);
  log('Diálogo de pantalla: foco, aria-pressed, Escape y retorno del foco ✓');

  const guardado = await cel.eval(() => JSON.parse(localStorage.getItem('lobos:pantalla')));
  if (guardado.texto !== 'enorme' || guardado.contraste !== 'alto') throw new Error(`No se guardaron los ajustes: ${JSON.stringify(guardado)}`);
  await cel.eval(() => location.reload());
  await cel.esperarTexto(T('ui.entrar.boton'), 20000);
  const trasRecargar = await cel.eval(() => document.documentElement.dataset.texto);
  if (trasRecargar !== 'enorme') throw new Error('Los ajustes no se recuerdan al recargar');
  log('Los ajustes se recuerdan al recargar ✓');

  // 4) El sistema pide contraste alto y menos movimiento: se respeta si el jugador no ha elegido nada.
  const sistema = await abrir('sistema', `${BASE}player.html`, { ...MOVIL, medios: { 'prefers-contrast': 'more', 'prefers-reduced-motion': 'reduce' } });
  await sistema.esperarTexto(T('ui.entrar.boton'), 20000);
  const heredados = await sistema.eval(() => ({ ...document.documentElement.dataset }));
  if (heredados.contraste !== 'alto' || heredados.movimiento !== 'reducido' || heredados.texto !== 'normal') {
    throw new Error(`No se respetan las preferencias del sistema: ${JSON.stringify(heredados)}`);
  }
  log('Se respetan las preferencias del sistema (contraste alto y menos movimiento) ✓');
} catch (e) {
  fallo = e;
}

if (errores.length) console.log('\nErrores en consola del navegador:\n' + errores.join('\n'));
console.log(fallo ? `\n✖ FALLO: ${fallo.message}` : `\n✔ Accesibilidad correcta. Capturas en ${capturas}`);
cerrar();
process.exitCode = fallo || errores.length ? 1 : 0;
