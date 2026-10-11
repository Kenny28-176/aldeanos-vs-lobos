// Partida de prueba de punta a punta: 1 tablet + 6 celulares en Chrome headless, con Firebase real (o el emulador).
// Requiere el servidor local corriendo (node tools/serve.js) y Chrome instalado.
//   node tools/e2e.js [carpetaCapturas]        (con IDIOMA=en, la misma partida con la web en inglés)
// Usa el protocolo DevTools directamente (tools/cdp.js, sin dependencias).
// Las cartas se reparten al azar: el guion mira qué rol le tocó a cada celular y juega siempre la misma historia.
// Los textos y los nombres de los roles que busca salen de los diccionarios de la app (tools/textos.js).
import { iniciarChrome, borrarSala, servidor, espera, log } from './cdp.js';
import { T, N, rol as nombreRol } from './textos.js';

const BASE = process.env.BASE ?? 'http://localhost:8080/public/';
const { abrir, errores, capturas: CAPTURAS, cerrar } = await iniciarChrome({ capturas: process.argv[2] });

// ACCESIBLE=1: los celulares usan el texto muy grande y el contraste alto, y en cada pantalla se comprueba que nada se desborde.
const ACCESIBLE = !!process.env.ACCESIBLE;
const almacenamiento = ACCESIBLE ? { 'lobos:pantalla': JSON.stringify({ texto: 'enorme', contraste: 'alto', movimiento: 'reducido' }) } : null;
const paginas = [];
const sinDesbordes = async pantalla => {
  if (!ACCESIBLE) return;
  for (const p of paginas.filter(x => x.nombre !== 'tablet')) {
    const sobra = await p.desborde();
    if (sobra > 1) throw new Error(`${p.nombre}: la pantalla «${pantalla}» se desborda ${sobra}px con el texto muy grande`);
  }
};
// Una frase del narrador sin lo que va tras los dos puntos ni el punto final (así se encuentra aunque la pantalla la corte).
const frase = (ruta, params) => N(ruta, params).split(':')[0].replace(/[.!?…]+$/, '');

// --- Guion de la partida ---------------------------------------------------------
let fallo = null;
let sala = null;
const abrirP = async (...a) => { const p = await abrir(...a); paginas.push(p); return p; };
try {
  const tablet = await abrirP('tablet', `${BASE}narrator.html`, { ancho: 1280, alto: 800, movil: false });
  await tablet.esperarTexto(T('ui.tablet.crear'));
  await tablet.click(T('ui.tablet.crear'));
  await tablet.esperarSelector('.codigo');
  sala = await tablet.eval(() => document.querySelector('.codigo').textContent.trim());
  log('Sala creada:', sala);

  const nombres = ['Ana', 'Beto', 'Carla', 'Dani', 'Eva', 'Fede'];
  const cels = [];
  for (const nombre of nombres) {
    const c = await abrirP(nombre, `${BASE}player.html?sala=${sala}`, { almacenamiento });
    await c.esperarTexto(T('ui.entrar.nombre'));
    await c.escribir(1, nombre);
    await c.enviarForm();
    await c.esperarTexto(T('ui.sala.dentro'));
    cels.push({ c, n: nombre });
  }
  log('6 jugadores dentro (sin registrar carta: se reparten solas)');

  // El asistente propone un mazo para 6; después se vacía y se arma a mano para conocer el mazo exacto.
  await tablet.esperarSelector('.jugadores-sala li', 30000, 6);
  await tablet.click(T('ui.nivel.sencillo.nombre'));
  await tablet.esperarTexto('6 / 6');
  await tablet.eval(() => document.querySelector('.asistente-mazo').scrollIntoView({ block: 'start' }));
  await espera(400);
  await tablet.captura('1-tablet-sala-asistente.png');
  await tablet.eval(() => window.scrollTo(0, 0));
  await tablet.click(T('ui.asistente.vaciar'));
  await tablet.esperarTexto('0 / 6');
  const MAZO = ['lobo', 'aldeano', 'vidente', 'cupido', 'bruja', 'cazador'];
  for (const id of MAZO) await tablet.click([nombreRol(id), '+'], '.mazo-carta');
  await tablet.esperarTexto('6 / 6');
  await tablet.esperarTexto(T('ui.sala.todo_listo'));
  log(`Asistente de mazo ✓ · mazo manual: ${MAZO.map(nombreRol).join(', ')}`);
  await cels[0].c.captura('1-celular-sala.png');
  await sinDesbordes('sala');

  // Tiempos mínimos para que la prueba vaya rápida.
  for (let i = 0; i < 6; i++) await tablet.click([T('ui.dur.lobos'), '−'], '.fila-ajuste'); // 50 s → 20 s
  for (let i = 0; i < 3; i++) await tablet.click([T('ui.dur.paso'), '−'], '.fila-ajuste'); // 25 s → 10 s
  await tablet.captura('1-tablet-sala.png');
  await tablet.click(T('ui.sala.empezar'));
  await tablet.esperarSelector('.intro', 15000);
  await espera(1200);
  await tablet.captura('2-tablet-intro.png');

  // Reparto: cada uno toca su carta, la lee y pulsa «Listo».
  const por = {}; // nombre del rol → { c, n }
  for (const j of cels) {
    await j.c.esperarTexto(T('motor.paso.reparto.ayuda').split('.')[0], 60000);
    if (j === cels[0]) await j.c.captura('2-celular-reparto-boca-abajo.png');
    await j.c.eval(() => document.querySelector('.carta-tocar').click());
    await j.c.esperarSelector('.carta-reparto .hoja-titulo');
    const rol = await j.c.eval(() => document.querySelector('.carta-reparto .hoja-titulo').textContent.trim());
    por[rol] = j;
    if (j === cels[0]) { await espera(1400); await j.c.captura('2-celular-reparto-carta.png'); await sinDesbordes('reparto'); }
    await j.c.eval(() => document.querySelector('.carta-tocar').click()); // la oculta otra vez
    if (j === cels[cels.length - 2]) { // con casi todos listos, la tablet ya muestra el reparto (la intro acabó)
      for (let i = 0; i < 60 && await tablet.eval(() => !!document.querySelector('.intro')); i++) await espera(250);
      await espera(1500);
      await tablet.captura('2-tablet-reparto.png');
    }
    await j.c.click(T('ui.boton.ya_vi'));
  }
  log('Reparto al azar:', Object.entries(por).map(([r, j]) => `${j.n}=${r}`).join(', '));
  const quien = id => {
    if (!por[nombreRol(id)]) throw new Error(`Nadie recibió la carta ${nombreRol(id)}: ${JSON.stringify(Object.keys(por))}`);
    return por[nombreRol(id)];
  };
  const lobo = quien('lobo');
  const vidente = quien('vidente');
  const bruja = quien('bruja');
  const cazador = quien('cazador');
  const cupido = quien('cupido');
  const aldeano = quien('aldeano');
  await tablet.esperarTexto(T('ui.mesa.noche', { n: 1 }), 60000);
  log('Empieza la primera noche (todos habían pulsado «Listo»)');

  await cupido.c.esperarTexto(T('motor.paso.cupido.titulo'), 40000);
  await cupido.c.click(cazador.n);
  await cupido.c.click(aldeano.n);
  await cupido.c.captura('3-celular-cupido.png');
  await sinDesbordes('Cupido');
  await cupido.c.click(T('ui.varios.confirmar'));
  await cupido.c.esperarTexto(T('ui.varios.enviado'));
  await cupido.c.click(T('ui.boton.listo'));
  log(`${nombreRol('cupido')} enamora a ${cazador.n} (${nombreRol('cazador')}) y ${aldeano.n} (${nombreRol('aldeano')}) ✓`);

  await vidente.c.esperarTexto(T('motor.paso.vidente.titulo'), 40000);
  await vidente.c.click(lobo.n);
  await vidente.c.esperarTexto(T('motor.paso.vidente.resultado', { nombre: lobo.n, rol: nombreRol('lobo') }));
  await espera(1500);
  await vidente.c.captura('3-celular-vidente.png');
  await sinDesbordes('Vidente');
  await vidente.c.click(T('ui.boton.listo'));
  log(`${nombreRol('vidente')} descubre a ${lobo.n} ✓`);

  await cazador.c.esperarTexto(T('motor.paso.enamorados.titulo'), 40000);
  await cazador.c.esperarTexto(aldeano.n);
  await aldeano.c.esperarTexto(T('motor.paso.enamorados.titulo'), 10000);
  await cazador.c.click(T('ui.entendido'));
  await aldeano.c.click(T('ui.entendido'));
  log('Los enamorados se reconocen ✓');

  await lobo.c.esperarTexto(T('motor.paso.lobos.titulo'), 40000);
  await aldeano.c.esperarTexto(T('ui.noche.titulo'));
  await lobo.c.click(bruja.n);
  await lobo.c.captura('3-celular-lobo.png');
  await sinDesbordes('lobos');
  await lobo.c.click(T('ui.boton.listo'));
  await tablet.captura('3-tablet-noche.png');
  log(`${nombreRol('lobo')} (${lobo.n}) ataca a ${bruja.n} (${nombreRol('bruja')})`);

  await bruja.c.esperarTexto(`${T('ui.bruja.atacado')}${bruja.n}`, 60000);
  await bruja.c.click(T('ui.bruja.curar', { nombre: bruja.n }));
  await bruja.c.esperarTexto(T('ui.bruja.curando', { nombre: bruja.n }));
  await bruja.c.captura('3-celular-bruja.png');
  await sinDesbordes('Bruja');
  await bruja.c.click(T('ui.boton.listo'));
  log(`${nombreRol('bruja')} se cura a sí misma ✓`);

  // Mañana: nadie muere; se elige Alguacil (la Vidente).
  for (const j of cels) await j.c.esperarTexto(T('motor.paso.alguacil.titulo'), 60000);
  for (const j of cels) await j.c.click(vidente.n);
  await tablet.esperarTexto(frase('alguacilElegido', { nombre: vidente.n }), 30000);
  await tablet.esperarTexto(T('ui.paso.debate'), 30000);
  log(`Nadie murió de noche; ${vidente.n} (${nombreRol('vidente')}) es elegido Alguacil ✓`);

  // El debate se salta cuando el 75 % lo pide (5 de 6).
  for (const j of cels) await j.c.esperarTexto(T('ui.debate.pasar'), 30000);
  await lobo.c.captura('4-celular-debate.png');
  await sinDesbordes('debate');
  for (const j of [lobo, vidente, bruja, cazador]) await j.c.click(T('ui.debate.pasar'));
  await tablet.esperarTexto(`${T('ui.progreso.quieren_1')}4${T('ui.progreso.quieren_2', { hacen: 5 })}`, 10000);
  await tablet.captura('4-tablet-debate.png');
  await cupido.c.click(T('ui.debate.pasar'));
  log('5 de 6 piden votar: se salta el debate ✓');

  // Votación: el Cazador recibe 3 votos + el doble del Alguacil = 4; el lobo, 3. El aldeano no puede votar a su pareja.
  await aldeano.c.esperarTexto(T('motor.paso.votacion.titulo'), 30000);
  const opciones = await aldeano.c.eval(() => [...document.querySelectorAll('.opcion-ficha .opcion-nombre')].map(b => b.textContent.trim()));
  if (opciones.includes(cazador.n)) throw new Error(`${aldeano.n} puede votar a su pareja`);
  for (const [j, a] of [[lobo, cazador], [vidente, cazador], [bruja, cazador], [cazador, lobo], [cupido, lobo], [aldeano, lobo]]) await j.c.click(a.n);
  await vidente.c.captura('5-celular-votacion.png');
  await sinDesbordes('votación');
  await tablet.esperarSelector('.revelacion .carta3d.volteada', 40000);
  await espera(1600);
  await tablet.captura('5-tablet-revelacion.png');
  await tablet.esperarTexto(frase('muerte.pena', { nombre: aldeano.n, de: cazador.n }), 60000);
  await tablet.captura('5-tablet-resultado.png');
  log(`${cazador.n} (${nombreRol('cazador')}) es linchado (voto doble del Alguacil); ${aldeano.n} muere de pena ✓`);

  await cazador.c.esperarTexto(T('motor.paso.cazador.titulo'), 40000);
  await cazador.c.captura('6-celular-cazador.png');
  await sinDesbordes('Cazador');
  await cazador.c.click(lobo.n);
  await tablet.esperarSelector('.revelacion.bando-lobos', 40000);
  await espera(1800);
  await tablet.captura('6-tablet-revelacion-lobo.png');
  await tablet.esperarTexto(T('ui.ganador.aldea'), 90000);
  await lobo.c.esperarTexto(T('ui.ganador.aldea'));
  await espera(4500);
  await tablet.captura('6-tablet-fin.png');
  await lobo.c.captura('6-celular-fin.png');
  await sinDesbordes('fin');
  log(`${nombreRol('cazador')} dispara a ${lobo.n} → ¡gana la aldea! ✓`);

  // Historial: la tablet guarda la partida terminada (solo en su navegador) y la muestra con estadísticas.
  const historial = await tablet.eval(() => JSON.parse(localStorage.getItem('lobos:historial') ?? '[]'));
  if (historial.length !== 1) throw new Error(`El historial debería tener 1 partida y tiene ${historial.length}`);
  const [anotada] = historial;
  if (anotada.ganador !== 'aldea' || anotada.abortada || anotada.jugadores.length !== 6) throw new Error(`Resumen de partida incorrecto: ${JSON.stringify(anotada)}`);
  const ganadoresAnotados = anotada.jugadores.filter(j => j.gano).map(j => j.nombre).sort();
  const esperados = [vidente, bruja, cazador, cupido, aldeano].map(j => j.n).sort();
  if (JSON.stringify(ganadoresAnotados) !== JSON.stringify(esperados)) throw new Error(`Ganadores anotados: ${ganadoresAnotados}; se esperaba ${esperados}`);
  await tablet.click(T('ui.historial.boton'));
  await tablet.esperarSelector(`[role="dialog"][aria-label="${T('ui.historial.titulo')}"]`);
  await tablet.esperarTexto(T('ui.historial.vic_aldea'));
  const pantallaHistorial = await tablet.texto();
  for (const j of cels) if (!pantallaHistorial.includes(j.n)) throw new Error(`El historial no menciona a ${j.n}`);
  await espera(700);
  await tablet.captura('6-tablet-historial.png');
  await tablet.tecla('Escape');
  if (await tablet.eval(() => !!document.querySelector('[role="dialog"]'))) throw new Error('Escape no cierra el historial');
  log('Historial: la partida queda anotada con sus ganadores y se muestra con estadísticas ✓');

  // Revancha: los mismos jugadores vuelven a la sala (sin cartas); luego se descarta la sala.
  await tablet.click(T('ui.final.volver'));
  for (const j of cels) await j.c.esperarTexto(T('ui.sala.dentro'), 30000);
  await tablet.esperarTexto(T('ui.mazo.partida'));
  log('Revancha: los celulares vuelven a la sala ✓');

  await tablet.click(T('ui.tablet.descartar'));
  await tablet.click(T('ui.tablet.descartar_seguro'));
  await tablet.esperarTexto(T('ui.tablet.crear'), 30000);
  await cels[0].c.esperarTexto(T('ui.sala.cerrada'), 30000);
  await cels[0].c.captura('7-celular-sala-cerrada.png');
  const resto = await (await fetch(servidor.urlRest(`/rooms/${sala}`))).json();
  if (resto !== null) throw new Error('La sala descartada sigue en el servidor');
  const url = await tablet.eval(() => location.href);
  if (url.includes('sala=')) throw new Error(`La portada conserva la sala en la dirección: ${url}`);
  log('Sala descartada: borrada del servidor, celulares avisados y portada limpia ✓');
} catch (e) {
  fallo = e;
  for (const p of paginas) {
    await p.captura(`fallo-${p.nombre}.png`).catch(() => {});
    console.log(`--- ${p.nombre}: ${(await p.texto().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}`);
  }
}

await borrarSala(sala);
if (errores.length) console.log('\nErrores en consola del navegador:\n' + errores.join('\n'));
console.log(fallo ? `\n✖ FALLO: ${fallo.message}` : `\n✔ Partida completa sin errores. Capturas en ${CAPTURAS}`);
cerrar();
process.exitCode = fallo || errores.length ? 1 : 0;
