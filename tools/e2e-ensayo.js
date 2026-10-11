// Prueba de punta a punta del modo ensayo: 1 tablet + 2 celulares «humanos» + 6 bots, con un mazo de roles
// avanzados (Doble Naturaleza, Bufón, Cultista, Flautista, Juez…). Las cartas se reparten al azar, así que los
// dos humanos se manejan con un piloto automático que hace algo razonable en cualquier pantalla.
// Termina cuando se resuelve la primera votación del día (o la partida acaba antes).
// Requiere el servidor local (node tools/serve.js).
//   node tools/e2e-ensayo.js [carpetaCapturas]
//   IDIOMA=en node tools/e2e-ensayo.js   la misma partida en inglés (y se comprueba que no quede español en pantalla)
//   ACCESIBLE=1 node tools/e2e-ensayo.js los celulares usan el texto muy grande y el contraste alto, y se comprueba que nada se desborde
import { iniciarChrome, borrarSala, espera, log } from './cdp.js';
import { IDIOMA, T, rol as nombreRol, hayEspanol } from './textos.js';

const BASE = process.env.BASE ?? 'http://localhost:8080/public/';
const { abrir, errores, capturas, cerrar } = await iniciarChrome({ puerto: 9335, capturas: process.argv[2] });

const ACCESIBLE = !!process.env.ACCESIBLE;
const almacenamiento = ACCESIBLE ? { 'lobos:pantalla': JSON.stringify({ texto: 'enorme', contraste: 'alto', movimiento: 'reducido' }) } : null;

// Textos de los botones que usa el piloto (en el idioma de la prueba).
const TEXTOS = {
  yaVi: T('ui.boton.ya_vi'), pasarVotacion: T('ui.debate.pasar'), confirmar: T('ui.varios.confirmar'),
  listo: T('ui.boton.listo'), entendido: T('ui.entendido'), abstenerme: T('ui.boton.abstenerme'), pasar: T('ui.boton.pasar'),
};

// Un «tic» del piloto automático: mira la pantalla del celular y hace como mucho una cosa.
// Devuelve qué hizo ('rol:Nombre' al ver su carta en el reparto).
const piloto = X => {
  const visible = e => e.getClientRects().length > 0;
  const botones = () => [...document.querySelectorAll('button')].filter(b => !b.disabled && visible(b));
  const con = t => botones().find(b => b.textContent.includes(t));
  const pulsa = (b, que) => { b.click(); return que; };

  if (document.querySelector('.barra-listo.hecho')) return 'esperando';

  // Reparto: tocar la carta para verla y pulsar «Listo».
  if (document.querySelector('.carta-reparto')) {
    const titulo = document.querySelector('.carta-reparto .hoja-titulo');
    if (!titulo) return pulsa(document.querySelector('.carta-tocar'), 'ver-carta');
    const rol = titulo.textContent.trim();
    const listo = con(X.yaVi);
    return listo ? (listo.click(), `rol:${rol}`) : 'esperando';
  }

  // Dos cartas (Bufón, Doble Naturaleza…): elegir la primera.
  const cartas = [...document.querySelectorAll('.dos-cartas .carta-opcion')];
  if (cartas.length && !document.querySelector('.carta-opcion.elegida')) return pulsa(cartas[0], 'carta');

  // Debate: pedir pasar a la votación (una sola vez: el botón cambia de texto).
  const pasar = con(X.pasarVotacion);
  if (pasar) return pulsa(pasar, 'debate');

  // Elegir varios (Arquero del Amor, Flautista…): marcar hasta completar y confirmar.
  const confirmar = con(X.confirmar);
  if (confirmar) {
    const cuenta = confirmar.textContent.match(/\((\d+)\/(\d+)\)/);
    if (cuenta && Number(cuenta[1]) < Number(cuenta[2])) {
      const libre = [...document.querySelectorAll('.opcion-ficha:not(.elegida)')].find(b => !b.disabled);
      if (libre) return pulsa(libre, 'marcar');
    }
    return pulsa(confirmar, 'confirmar');
  }

  // Elegir uno (la Alquimista no: ahí solo se pasa).
  const fichas = [...document.querySelectorAll('.opcion-ficha')].filter(b => !b.disabled);
  if (fichas.length && !document.querySelector('.pocion') && !document.querySelector('.opcion-ficha.elegida')) return pulsa(fichas[0], 'elegir');

  const listo = con(X.listo) ?? con(X.entendido) ?? con(X.abstenerme) ?? con(X.pasar);
  return listo ? pulsa(listo, 'listo') : 'nada';
};

let fallo = null;
let sala = null;
const paginas = [];
const abrirP = async (...a) => { const p = await abrir(...a); paginas.push(p); return p; };
try {
  const tablet = await abrirP('tablet', `${BASE}narrator.html`, { ancho: 1280, alto: 800, movil: false });
  await tablet.click(T('ui.tablet.crear'), null, 20000);
  await tablet.esperarSelector('.codigo');
  sala = await tablet.eval(() => document.querySelector('.codigo').textContent.trim());
  log('Sala creada:', sala);

  for (let i = 0; i < 6; i++) await tablet.click(T('ui.sala.bot'));
  await tablet.esperarSelector('.jugadores-sala li', 15000, 6);
  log('6 bots en la sala');

  const humanos = [];
  for (const nombre of ['Perla', 'Coco']) {
    const c = await abrirP(nombre, `${BASE}player.html?sala=${sala}`, { almacenamiento });
    await c.esperarTexto(T('ui.entrar.nombre'));
    await c.escribir(1, nombre);
    await c.enviarForm();
    await c.esperarTexto(T('ui.sala.dentro'));
    humanos.push({ c, n: nombre });
  }
  await tablet.esperarSelector('.jugadores-sala li', 15000, 8);

  for (const id of ['lobo', 'lobo', 'perro_lobo', 'comediante', 'sectario', 'flautista', 'juez', 'aldeano']) {
    await tablet.click([nombreRol(id), '+'], '.mazo-carta');
  }
  await tablet.esperarTexto('8 / 8');
  for (let i = 0; i < 3; i++) await tablet.click([T('ui.dur.paso'), '−'], '.fila-ajuste');
  await tablet.esperarTexto(T('ui.sala.todo_listo'), 15000);
  await tablet.captura('1-tablet-sala-bots.png');
  log('Mazo de 8 cartas con roles avanzados; el reparto es automático');

  await tablet.click(T('ui.sala.empezar'));

  // Bucle del piloto: hasta la primera votación resuelta, o hasta que la partida acabe.
  const roles = {};
  const hecho = {};
  const restos = new Set();
  const desbordes = [];
  const limite = Date.now() + 9 * 60 * 1000;
  let fin = null;
  while (Date.now() < limite && !fin) {
    for (const j of humanos) {
      const que = await j.c.eval(piloto, TEXTOS).catch(() => 'error');
      if (que.startsWith('rol:')) {
        roles[j.n] = que.slice(4);
        log(`${j.n} recibe la carta ${roles[j.n]}`);
        await j.c.captura(`2-celular-${j.n}-carta.png`);
      } else if (que !== 'esperando' && que !== 'nada') {
        hecho[que] = (hecho[que] ?? 0) + 1;
      }
      if (ACCESIBLE && desbordes.length < 5) {
        const sobra = await j.c.desborde().catch(() => 0);
        if (sobra > 1) { desbordes.push(`${j.n} (${que}): ${sobra}px`); await j.c.captura(`desborde-${j.n}-${desbordes.length}.png`); }
      }
    }
    const pantalla = await tablet.eval(dia1 => ({
      votacion: !!document.querySelector('.votacion'),
      final: !!document.querySelector('.final'),
      dia: document.body.textContent.includes(dia1),
    }), T('ui.mesa.dia', { n: 1 }));
    // En otro idioma, ninguna pantalla debe dejar textos en español.
    if (IDIOMA !== 'es') {
      for (const p of [tablet, ...humanos.map(j => j.c)]) {
        for (const linea of (await p.eval(() => document.body.innerText).catch(() => '')).split('\n')) {
          if (hayEspanol(linea) && !restos.has(linea)) { restos.add(linea); console.log(`⚠ ${p.nombre}: texto en español: «${linea.trim()}»`); }
        }
      }
    }
    if (pantalla.dia && !hecho.dia) { hecho.dia = 1; await espera(5000); await tablet.captura('4-tablet-dia.png'); log('Amanece el día 1 ✓'); }
    if (pantalla.votacion) fin = 'votacion';
    else if (pantalla.final) fin = 'final';
    await espera(700);
  }
  if (!fin) throw new Error(`La partida no llegó a la primera votación en 9 minutos. Acciones del piloto: ${JSON.stringify(hecho)}`);
  await espera(2500);
  await tablet.captura('6-tablet-resultado.png');
  log(fin === 'votacion' ? 'Votación del día 1 resuelta ✓' : 'La partida terminó antes de votar ✓', '· acciones del piloto:', JSON.stringify(hecho));
  if (restos.size) throw new Error(`Quedan ${restos.size} textos en español en la interfaz en «${IDIOMA}»`);
  if (desbordes.length) throw new Error(`Pantallas que se desbordan con el texto muy grande: ${desbordes.join('; ')}`);
} catch (e) {
  fallo = e;
  for (const p of paginas) {
    await p.captura(`fallo-${p.nombre}.png`).catch(() => {});
    console.log(`--- ${p.nombre}: ${(await p.texto().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}`);
  }
}

await borrarSala(sala);
if (errores.length) console.log('\nErrores en consola del navegador:\n' + errores.join('\n'));
console.log(fallo ? `\n✖ FALLO: ${fallo.message}` : `\n✔ Ensayo con bots sin errores. Capturas en ${capturas}`);
cerrar();
process.exitCode = fallo || errores.length ? 1 : 0;
