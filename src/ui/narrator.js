// Pantalla de la tablet (narrador). Es la autoridad: ejecuta el motor y publica en Firebase.
// También pone la voz, la música, los efectos y las revelaciones de cartas.
import './ajustes.js'; // aplica el tamaño de texto, el contraste y las animaciones guardados
import './sw-registro.js'; // carga más rápida y resistencia a los cortes de red
import {
  html, render, useState, useEffect, useRef,
  Temporizador, Cementerio, Votacion, Reparto, CartasComediante, Cronica, ETIQUETA_PASO, GANADOR, restante,
  AjustesPantalla, AvisoConexion, Segmentado, useDialogo,
} from './comun.js';
import { Carta, Avatar, imgRol } from './cartas.js';
import { Escenario } from './escena.js';
import { particulas } from './efectos.js';
import { loadData } from '../data/load.js';
import { createEngine } from '../engine/index.js';
import { estadisticas, resumirPartida } from '../engine/historial.js';
import { crearControlador } from '../net/tablet.js';
import * as net from '../net/sala.js';
import { servidor } from '../net/servidor.js';
import { leerHistorial, guardarPartida, borrarHistorial } from '../net/historial-local.js';
import { crearVoz } from './voz.js';
import * as audio from './audio.js';
import { mantenerEncendida } from './wakelock.js';
import { t, tn, existe, idiomaActual, usarIdioma, iniciarIdioma, alCambiarIdioma } from '../i18n/idioma.js';
import { IDIOMAS } from '../i18n/traducir.js';

const params = new URLSearchParams(location.search);
let engine = null;
let ctl = null;
let pantallaEncendida = null;
let refrescarGlobal = () => {};
let presencia = {}; // celulares conectados ahora
const narracion = []; // últimas frases dichas
// Estado de la interfaz que no es del juego (revelaciones, intro, subtítulo, oso…).
const ui = { revelacion: null, intro: false, subtitulo: null, victoria: false, oso: false };

const voz = crearVoz({
  alHablar: texto => {
    ui.subtitulo = texto;
    if (texto && narracion.at(-1) !== texto) {
      narracion.push(texto);
      narracion.splice(0, Math.max(0, narracion.length - 12));
    }
    refrescarGlobal();
  },
});

const NOMBRES_BOT = ['🤖 Bruno', '🤖 Celia', '🤖 Dimas', '🤖 Elsa', '🤖 Fausto', '🤖 Greta', '🤖 Homero', '🤖 Irene', '🤖 Jacinto', '🤖 Lola', '🤖 Mateo', '🤖 Nieves', '🤖 Olmo', '🤖 Paz', '🤖 Ramiro', '🤖 Sol'];

// --- Arranque ---------------------------------------------------------------

async function entrar(codigo, refrescar) {
  voz.desbloquear();
  audio.iniciarAudio();
  pantallaEncendida ??= mantenerEncendida();
  let datos = null;
  if (codigo) {
    datos = await net.leerSala(codigo);
    if (!datos?.state) throw new Error(t('ui.entrar.no_existe', { codigo }));
  } else {
    codigo = await net.codigoLibre();
    net.marcarCreada(codigo);
    net.limpiarSalasViejas();
  }
  localStorage.setItem('lobos:tablet', codigo);
  history.replaceState(null, '', `?sala=${codigo}`);

  let jugadoresAntes = datos?.state?.ids.length ?? 0;
  ctl = crearControlador({
    engine,
    sala: codigo,
    io: { escribir: net.escribir, ahora: net.ahora },
    state: datos?.state,
    reloj: datos?.reloj,
    hablando: voz.hablando,
    alNarrar,
    alCambiar: s => {
      if (s.phase === 'sala' && s.ids.length > jugadoresAntes) audio.sonar('union');
      jugadoresAntes = s.ids.length;
      anotarPartida(s);
      refrescar();
    },
  });
  ctl.publicar(true);
  net.escucharAcciones(codigo, a => ctl.desdeJugador(a));
  net.escucharPresencia(codigo, p => { presencia = p; refrescar(); });
  audio.musica(musicaDeFase(ctl.state));
  setInterval(latido, 250);
  refrescar();
}

// Historial: al terminar una partida se guarda un resumen en esta tablet (solo en este navegador, no en el servidor).
let ultimaAnotada = null;
function anotarPartida(s) {
  try {
    const claveInicio = `lobos:inicio:${s.sala}`;
    if (s.phase === 'sala') { localStorage.removeItem(claveInicio); ultimaAnotada = null; return; }
    if (!localStorage.getItem(claveInicio)) localStorage.setItem(claveInicio, String(Date.now()));
    if (s.phase !== 'fin') return;
    const resumen = resumirPartida(engine.ctx, s, {
      duracionMin: Math.max(1, Math.round((Date.now() - Number(localStorage.getItem(claveInicio))) / 60000)),
    });
    if (resumen.huella === ultimaAnotada) return;
    ultimaAnotada = resumen.huella;
    guardarPartida(resumen);
  } catch { /* sin almacenamiento: no pasa nada */ }
}

const musicaDeFase = s => (s.phase === 'noche' || s.phase === 'sala' ? 'noche'
  : s.phase === 'fin' ? null
  : s.current?.tipo === 'votacion' ? 'tension' : 'dia');

// Cuatro veces por segundo: reloj de la partida, música y tictac final.
let ultimoTic = null;
let agachado = null;
function latido() {
  ctl.tick();
  const habla = voz.hablando();
  if (habla !== agachado) { audio.agachar(habla); agachado = habla; }
  const c = ctl.state.current;
  const r = ctl.reloj;
  if (!c || !r || r.arrancado === false || r.restante != null) return;
  const { quedan, total } = restante(r, net.ahora);
  if (c.tipo === 'votacion') audio.tension(1 - quedan / total);
  const seg = Math.ceil(quedan / 1000);
  if (ctl.state.phase === 'dia' && ['debate', 'votacion', 'alguacil'].includes(c.tipo) && seg <= 5 && seg > 0 && seg !== ultimoTic) {
    audio.sonar('tic');
  }
  ultimoTic = seg;
}

// --- Narración con efectos sincronizados ---------------------------------------------

// Efectos que suenan antes / después de ciertas frases: [función, pausa en ms].
const ANTES = {
  anochecer: [() => { audio.musica('noche'); audio.sonar('noche'); }, 2600],
  amanecer: [() => { audio.musica('dia'); audio.sonar('amanecer'); }, 2400],
  votacion: [() => { audio.musica('tension'); audio.sonar('campana'); }, 900],
  segundaVotacion: [() => { audio.musica('tension'); audio.sonar('mazo'); }, 1000],
  alguacil: [() => audio.sonar('campana'), 900],
  reparto: [() => audio.sonar('mazo'), 1200],
  debate: [() => audio.musica('dia'), 200],
  debateAngel: [() => audio.musica('dia'), 200],
  chivoElige: [() => audio.sonar('revelacion'), 900],
  angelPrimerDia: [() => audio.sonar('coro'), 2200],
  sectarioGrupos: [() => audio.sonar('tambores'), 1600],
  comedianteCartas: [() => audio.sonar('comedia'), 1500],
  linchamientoDecidido: [() => audio.sonar('revelacion'), 900],
  sirvientaRevela: [() => audio.sonar('arpa'), 1200],
  gruñido: [() => { ui.oso = true; audio.sonar('oso'); refrescarGlobal(); setTimeout(() => { ui.oso = false; refrescarGlobal(); }, 3200); }, 2400],
  // Cada personaje tiene su sonido al despertar (suena aunque esté muerto: no delata nada).
  'pasos.cupido.despertar': [() => audio.sonar('arpa'), 900],
  'pasos.enamorados.despertar': [() => audio.sonar('arpa'), 700],
  'pasos.vidente.despertar': [() => audio.sonar('cristal'), 900],
  'pasos.bruja.despertar': [() => audio.sonar('caldero'), 1100],
  'pasos.protector.despertar': [() => audio.sonar('escudo'), 700],
  'pasos.zorro.despertar': [() => audio.sonar('olfato'), 700],
  'pasos.lobos.despertar': [() => audio.sonar('aullido'), 1800],
  'pasos.albino.despertar': [() => audio.sonar('aullido'), 1500],
  'pasos.feroz.despertar': [() => audio.sonar('feroz'), 1300],
  'pasos.infecto.despertar': [() => audio.sonar('infeccion'), 1300],
  'pasos.flautista.despertar': [() => audio.sonar('flauta'), 1900],
  'pasos.hechizados.despertar': [() => audio.sonar('hechizo'), 900],
  'pasos.perro_lobo.despertar': [() => audio.sonar('ladrido'), 800],
  'pasos.juez.despertar': [() => audio.sonar('mazo'), 700],
  'pasos.domador.despertar': [() => audio.sonar('oso'), 1500],
  'pasos.comediante.despertar': [() => audio.sonar('comedia'), 1200],
  'pasos.dos_hermanas.despertar': [() => audio.sonar('hechizo'), 700],
  'pasos.tres_hermanos.despertar': [() => audio.sonar('hechizo'), 700],
  'pasos.nino_salvaje.despertar': [() => audio.sonar('tambores'), 1500],
};
const DESPUES = {
  alguacilElegido: [() => audio.sonar('fanfarria'), 1400],
  indultoTonto: [() => audio.sonar('indulto'), 1100],
  aldeaSinPoderes: [() => audio.sonar('tristeza'), 1500],
};
const SONIDO_VICTORIA = {
  aldea: 'victoriaAldea', lobos: 'victoriaLobos', enamorados: 'victoriaEnamorados', nadie: 'viento',
  angel: 'coro', flautista: 'flauta', albino: 'feroz', sectario: 'tambores',
};
const PARTICULAS_VICTORIA = { aldea: 'confeti', lobos: 'ceniza', enamorados: 'corazones', angel: 'confeti', flautista: 'confeti', sectario: 'ceniza', albino: 'ceniza' };

function alNarrar(frases, eventos) {
  const grupos = new Map();
  for (const f of frases) {
    if (!grupos.has(f.evento)) grupos.set(f.evento, []);
    grupos.get(f.evento).push(f);
  }
  const decir = fs => fs.forEach(f => voz.decir(f.texto));
  eventos.forEach((ev, i) => {
    const fs = grupos.get(i) ?? [];
    if (ev.tipo === 'inicio') {
      voz.efecto(() => { ui.intro = true; audio.musica(null); audio.sonar('manada'); refrescarGlobal(); }, 4600);
      voz.efecto(() => { ui.intro = false; refrescarGlobal(); }, 400);
    } else if (ev.tipo === 'narrar') {
      const [antes, pa] = ANTES[ev.clave] ?? [];
      if (antes) voz.efecto(antes, pa);
      decir(fs);
      const [despues, pd] = DESPUES[ev.clave] ?? [];
      if (despues) voz.efecto(despues, pd);
    } else if (ev.tipo === 'muerte') {
      revelar(ev, fs);
    } else if (ev.tipo === 'votos') {
      if (Object.keys(ev.votos).length) voz.efecto(() => { audio.musica('dia'); audio.sonar('redoble'); }, 1800);
      decir(fs);
    } else if (ev.tipo === 'victoria') {
      voz.efecto(() => {
        ui.victoria = true;
        audio.musica(null);
        audio.sonar(SONIDO_VICTORIA[ev.ganador]);
        if (PARTICULAS_VICTORIA[ev.ganador]) particulas(PARTICULAS_VICTORIA[ev.ganador], { cantidad: 180, duracion: 6000 });
        refrescarGlobal();
      }, 1800);
      decir(fs);
    } else {
      decir(fs);
    }
  });
}

// Revelación de una muerte: la carta aparece boca abajo, se anuncia, se da la vuelta y la
// aldea reacciona (confeti si era lobo, ceniza si era aldeano).
function revelar(ev, fs) {
  const datos = {
    nombre: ev.nombre,
    rolId: ev.rol,
    rol: ev.rol ? engine.ctx.roles[ev.rol].nombre : null,
    bando: ev.bando,
    causa: ev.causa,
    volteada: false,
    reaccion: null,
  };
  const [anuncio, revelacion, ...reaccion] = fs;
  if (ev.causa === 'disparo') voz.efecto(() => audio.sonar('disparo'), 1000);
  if (ev.causa === 'oxido') voz.efecto(() => audio.sonar('oxido'), 1000);
  voz.efecto(() => { ui.revelacion = datos; audio.sonar('revelacion'); refrescarGlobal(); }, 1200);
  if (anuncio) voz.decir(anuncio.texto);
  if (datos.rolId) voz.efecto(() => { ui.revelacion = { ...ui.revelacion, volteada: true }; audio.sonar('whoosh'); refrescarGlobal(); }, 1100);
  if (revelacion) voz.decir(revelacion.texto);
  if (reaccion.length) {
    const tipo = reaccion[0].tipo;
    voz.efecto(() => {
      if (tipo === 'celebracion') { audio.sonar('celebracion'); particulas('confeti'); }
      if (tipo === 'tristeza') { audio.sonar('tristeza'); particulas('ceniza', { cantidad: 70, duracion: 5000 }); }
      ui.revelacion = { ...ui.revelacion, reaccion: reaccion[0].texto };
      refrescarGlobal();
    }, 900);
    reaccion.forEach(f => voz.decir(f.texto));
  }
  voz.efecto(() => { ui.revelacion = null; refrescarGlobal(); }, 700);
}

// --- Componentes comunes ---------------------------------------------------------

function pantallaCompleta() {
  if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
  document.documentElement.requestFullscreen?.()
    .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
    .catch(() => {});
}

function Deslizador({ etiqueta, valor, min = 0, max = 1, paso = 0.05, onChange, formato = v => `${Math.round(v * 100)} %` }) {
  return html`
    <label class="deslizador">
      <span>${etiqueta}</span>
      <input type="range" min=${min} max=${max} step=${paso} value=${valor} onInput=${e => onChange(Number(e.target.value))} />
      <b>${formato(valor)}</b>
    </label>`;
}

// Ajustes de voz y sonido (se guardan en esta tablet).
function Ajustes({ cerrar }) {
  const [, setV] = useState(0);
  const re = () => setV(v => v + 1);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.addEventListener?.('voiceschanged', re);
    return () => speechSynthesis.removeEventListener?.('voiceschanged', re);
  }, []);
  const a = voz.ajustes;
  const voces = voz.voces();
  const ref = useRef(null);
  useDialogo(ref, cerrar);
  return html`
    <div class="velo" onClick=${e => e.target === e.currentTarget && cerrar()}>
      <div class="dialogo vidrio aparecer" ref=${ref} role="dialog" aria-modal="true" aria-label=${t('ui.ajustes.aria')}>
        <h2>${t('ui.ajustes.voz_titulo')}</h2>
        ${voces.length ? html`
          <label class="campo">${t('ui.ajustes.voz')}
            <select value=${voces.find(v => v.nombre === a.voz) ? a.voz : ''} onChange=${e => { voz.ajustar({ voz: e.target.value || null }); re(); }}>
              <option value="">${t('ui.ajustes.automatica', { voz: voz.nombreVoz ?? t('ui.ajustes.voz_defecto') })}</option>
              ${voces.map(v => html`<option value=${v.nombre}>${v.nombre} · ${v.idioma}${v.local ? '' : t('ui.ajustes.en_linea')}</option>`)}
            </select>
          </label>` : html`<p class="tenue">${t('ui.ajustes.sin_voces')}</p>`}
        <${Deslizador} etiqueta=${t('ui.ajustes.velocidad')} valor=${a.velocidad} min=${0.6} max=${1.4} paso=${0.05} formato=${v => `${v.toFixed(2)}×`} onChange=${v => { voz.ajustar({ velocidad: v }); re(); }} />
        <${Deslizador} etiqueta=${t('ui.ajustes.tono')} valor=${a.tono} min=${0.5} max=${1.5} paso=${0.05} formato=${v => v.toFixed(2)} onChange=${v => { voz.ajustar({ tono: v }); re(); }} />
        <button class="btn sec" onClick=${() => voz.probar(t('ui.ajustes.frase_prueba'))}>${t('ui.ajustes.probar')}</button>

        <h2>${t('ui.ajustes.musica_titulo')}</h2>
        <${Deslizador} etiqueta=${t('ui.ajustes.musica')} valor=${audio.ajustes.musica} onChange=${v => { audio.guardarAjustes({ musica: v }); re(); }} />
        <${Deslizador} etiqueta=${t('ui.ajustes.efectos')} valor=${audio.ajustes.efectos} onChange=${v => { audio.guardarAjustes({ efectos: v }); re(); }} />
        <div class="fila-botones">
          ${[['aullido', '🐺'], ['oso', '🐻'], ['flauta', '🪈'], ['cristal', '🔮'], ['campana', '🔔'], ['celebracion', '🎉']].map(([s, i]) => html`
            <button class="btn sec" onClick=${() => audio.sonar(s)}>${i}</button>`)}
        </div>
        <p class="tenue pequeno">${t('ui.ajustes.sonidos_1')}<code>public/audio/</code>${t('ui.ajustes.sonidos_2')}</p>
        <${SelectorIdioma} />
        <${AjustesPantalla} />
        <button class="btn grande" onClick=${cerrar}>${t('ui.ajustes.listo')}</button>
      </div>
    </div>`;
}

// Cierra la sala: borra sus datos del servidor, olvida la sala en esta tablet y vuelve a la portada.
async function descartarSala() {
  const sala = ctl?.state?.sala;
  voz.callar();
  try { if (sala) await net.borrarSala(sala); } catch { /* si no hay red, igual se olvida en esta tablet */ }
  localStorage.removeItem('lobos:tablet');
  location.href = servidor.conservar(location.pathname); // sin ?sala=, para que no ofrezca continuar la misma
}

function BotonDescartar({ clase = 'btn sec', texto = null }) {
  const [seguro, setSeguro] = useState(false);
  useEffect(() => {
    if (!seguro) return;
    const t = setTimeout(() => setSeguro(false), 4000);
    return () => clearTimeout(t);
  }, [seguro]);
  return html`
    <button class=${clase} onClick=${() => (seguro ? descartarSala() : setSeguro(true))}>
      ${seguro ? t('ui.tablet.descartar_seguro') : texto ?? t('ui.tablet.descartar')}
    </button>`;
}

// --- Idioma -------------------------------------------------------------------------------

// Las páginas informativas existen en cada idioma: como-jugar.html → en/como-jugar.html
const enlaceAyuda = pagina => (idiomaActual() === 'es' ? pagina : `${idiomaActual()}/${pagina}`);

// Cambia el idioma de la tablet: la interfaz, la narración y los textos que reciben los celulares.
async function cambiarIdiomaTablet(codigo) {
  const datos = await loadData(codigo); // si no se pudieran cargar los textos, no se cambia nada
  await usarIdioma(codigo, { guardar: true });
  engine.usarDatos(datos);
  voz.usarIdioma(codigo);
  ctl?.publicar(true); // los celulares reciben sus pantallas ya en el nuevo idioma
  refrescarGlobal();
}

function SelectorIdioma() {
  return html`<${Segmentado} etiqueta=${t('ui.idioma')} valor=${idiomaActual()} opciones=${Object.entries(IDIOMAS)} onChange=${cambiarIdiomaTablet} />`;
}

// --- Historial de partidas ---------------------------------------------------------------

const ganadorCorto = g => (existe(`ui.ganador_corto.${g}`) ? t(`ui.ganador_corto.${g}`) : g);
const FORMATO_FECHA = { dateStyle: 'medium', timeStyle: 'short' };

function Historial({ cerrar }) {
  const [lista, setLista] = useState(leerHistorial);
  const [seguro, setSeguro] = useState(false);
  const ref = useRef(null);
  useDialogo(ref, cerrar);
  const e = estadisticas(lista);
  const nombreRol = id => engine.ctx.roles[id]?.nombre ?? id;
  const otros = e.partidas - (e.porGanador.aldea ?? 0) - (e.porGanador.lobos ?? 0);
  const exportar = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(lista, null, 2)], { type: 'application/json' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'historial-aldeanos-vs-lobos.json';
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const borrar = () => {
    if (!seguro) { setSeguro(true); setTimeout(() => setSeguro(false), 4000); return; }
    borrarHistorial();
    setLista([]);
    setSeguro(false);
  };
  return html`
    <div class="velo" onClick=${ev => ev.target === ev.currentTarget && cerrar()}>
      <div class="dialogo historial vidrio aparecer" ref=${ref} role="dialog" aria-modal="true" aria-label=${t('ui.historial.titulo')}>
        <h2>${t('ui.historial.titulo_h')}</h2>
        ${!lista.length ? html`<p class="tenue">${t('ui.historial.vacio')}</p>` : html`
          <div class="tarjetas-estadisticas">
            <div class="tarjeta-estadistica"><b>${e.partidas}</b><span>${tn('ui.historial.partidas', e.partidas)}${e.abortadas ? ` ${tn('ui.historial.abortadas', e.abortadas)}` : ''}</span></div>
            <div class="tarjeta-estadistica"><b>${e.porGanador.aldea ?? 0}</b><span>${t('ui.historial.vic_aldea')}</span></div>
            <div class="tarjeta-estadistica"><b>${e.porGanador.lobos ?? 0}</b><span>${t('ui.historial.vic_lobos')}</span></div>
            <div class="tarjeta-estadistica"><b>${otros}</b><span>${t('ui.historial.otros')}</span></div>
            ${e.duracionMediaMin != null ? html`<div class="tarjeta-estadistica"><b>${t('ui.historial.minutos', { n: Math.round(e.duracionMediaMin) })}</b><span>${t('ui.historial.duracion')}</span></div>` : null}
            <div class="tarjeta-estadistica"><b>${e.jugadoresMedios.toFixed(1)}</b><span>${t('ui.historial.jugadores_media')}</span></div>
          </div>
          <div class="columnas-top">
            <section>
              <h3>${t('ui.historial.h_jugadores')}</h3>
              <ol class="lista-top">${e.jugadores.slice(0, 5).map(j => html`<li><b>${j.nombre}</b> <span class="tenue">${tn('ui.historial.victorias_de', j.victorias, { total: j.partidas })}</span></li>`)}</ol>
            </section>
            <section>
              <h3>${t('ui.historial.h_roles')}</h3>
              <ol class="lista-top">${e.roles.slice(0, 5).map(r => html`<li><b>${nombreRol(r.rol)}</b> <span class="tenue">${tn('ui.historial.veces', r.veces)} · ${tn('ui.historial.victorias', r.victorias)}</span></li>`)}</ol>
            </section>
          </div>
          <h3>${t('ui.historial.h_partidas')}</h3>
          <div class="lista-partidas">
            ${lista.map(p => html`
              <details class="partida-historial" key=${p.huella}>
                <summary>
                  <b>${new Date(p.fecha).toLocaleString(idiomaActual(), FORMATO_FECHA)}</b>${` · ${[
                    p.abortada ? t('ui.historial.abortada') : t('ui.historial.gano', { ganador: ganadorCorto(p.ganador) }),
                    t('ui.historial.n_jugadores', { n: p.jugadores.length }),
                    p.duracionMin ? t('ui.historial.minutos', { n: p.duracionMin }) : null,
                  ].filter(Boolean).join(' · ')}`}
                </summary>
                <ul class="jugadores-partida">
                  ${p.jugadores.map(j => html`
                    <li class=${j.vivo ? '' : 'muerto'}>
                      <b>${j.nombre}</b> — ${nombreRol(j.rol)}${j.alguacil ? ' ⭐' : ''}${j.vivo ? '' : ' †'}${j.gano ? ' 🏆' : ''}
                    </li>`)}
                </ul>
              </details>`)}
          </div>
          <div class="fila-botones">
            <button class="btn sec" onClick=${exportar}>${t('ui.historial.exportar')}</button>
            <button class="btn sec" onClick=${borrar}>${seguro ? t('ui.historial.seguro') : t('ui.historial.borrar')}</button>
          </div>`}
        <button class="btn grande" onClick=${cerrar}>${t('ui.boton.cerrar')}</button>
      </div>
    </div>`;
}

function BotonHistorial({ clase = 'btn sec' }) {
  const [abierto, setAbierto] = useState(false);
  return html`
    <button class=${clase} onClick=${() => setAbierto(true)}>${t('ui.historial.boton')}</button>
    ${abierto && html`<${Historial} cerrar=${() => setAbierto(false)} />`}`;
}

function BotonesCabecera() {
  const [ajustes, setAjustes] = useState(false);
  return html`
    <div class="botones-cabecera">
      <button class="btn icono" title=${t('ui.boton.pantalla_completa')} aria-label=${t('ui.boton.pantalla_completa')} onClick=${pantallaCompleta}>⛶</button>
      <button class="btn icono" title=${t('ui.ajustes.aria')} aria-label=${t('ui.ajustes.aria')} onClick=${() => setAjustes(true)}>🔊</button>
      ${ajustes && html`<${Ajustes} cerrar=${() => setAjustes(false)} />`}
    </div>`;
}

// --- Inicio --------------------------------------------------------------------------

function Inicio({ refrescar }) {
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const ultima = params.get('sala') || localStorage.getItem('lobos:tablet');
  const ir = async codigo => {
    setCargando(true);
    setError(null);
    try { await entrar(codigo, refrescar); } catch (e) { setError(e.message); setCargando(false); }
  };
  return html`
    <main class="portada">
      <div class="portada-cartas">
        ${['lobo', 'vidente', 'bruja', 'cazador', 'cupido'].map((r, i) => html`<img src=${imgRol(r)} style=${`--i:${i};--y:${Math.abs(i - 2) * 8}px`} alt="" />`)}
      </div>
      <h1 class="titulo-juego">${t('ui.titulo')}<small>${t('ui.tablet.subtitulo')}</small></h1>
      <p class="tenue">${t('ui.tablet.portada_texto')}</p>
      <button class="btn grande brillo" disabled=${cargando} onClick=${() => ir(null)}>${t('ui.tablet.crear')}</button>
      ${ultima && html`<button class="btn sec grande" disabled=${cargando} onClick=${() => ir(net.normalizarCodigo(ultima))}>${t('ui.tablet.continuar', { codigo: ultima })}</button>`}
      <${BotonHistorial} clase="btn sec grande" />
      <${SelectorIdioma} />
      ${error && html`<p class="error">${error}</p>`}
      <nav class="enlaces-pie">
        <a href=${enlaceAyuda('como-jugar.html')}>${t('ui.entrar.como_jugar')}</a>
        <a href=${enlaceAyuda('acerca.html')}>${t('ui.tablet.acerca')}</a>
      </nav>
    </main>`;
}

// --- Sala de espera ----------------------------------------------------------------------

function QR({ texto }) {
  const svg = (() => {
    try {
      const q = window.qrcode(0, 'M');
      q.addData(texto);
      q.make();
      return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    } catch { return ''; }
  })();
  return html`<div class="qr" dangerouslySetInnerHTML=${{ __html: svg }}></div>`;
}

function Contador({ valor, min = 0, max, onChange, paso = 1, formato = v => v }) {
  return html`
    <span class="contador">
      <button class="btn mini" aria-label=${t('ui.contador.menos')} disabled=${valor <= min} onClick=${() => onChange(Math.max(min, valor - paso))}>−</button>
      <b>${formato(valor)}</b>
      <button class="btn mini" aria-label=${t('ui.contador.mas')} disabled=${max != null && valor >= max} onClick=${() => onChange(Math.min(max ?? Infinity, valor + paso))}>+</button>
    </span>`;
}

function Interruptor({ valor, onChange, si = t('ui.si'), no = t('ui.no') }) {
  return html`<button role="switch" aria-checked=${!!valor} class=${`btn mini interruptor ${valor ? 'on' : 'sec'}`} onClick=${() => onChange(!valor)}>${valor ? si : no}</button>`;
}

// Duraciones editables (sus nombres están en el diccionario: ui.dur.<k>).
const DUR_EDITABLES = [
  { k: 'debate', min: 30, max: 900, paso: 30, f: v => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` },
  { k: 'votacion', min: 20, max: 180, paso: 10, f: v => `${v} s` },
  { k: 'lobos', min: 20, max: 120, paso: 5, f: v => `${v} s` },
  { k: 'paso', min: 10, max: 60, paso: 5, f: v => `${v} s` },
];

// Ordenar los asientos desde la tablet: tocar a los jugadores en orden hacia la derecha.
function Asientos({ s }) {
  const [orden, setOrden] = useState(null);
  const rightOf = Object.fromEntries(s.ids.map(id => [id, s.players[id].rightId]));
  const circulo = engine.buildCircle(rightOf, s.ids);
  if (orden) {
    const faltan = s.ids.filter(id => !orden.includes(id));
    return html`
      <section class="vidrio ancho">
        <h2>${t('ui.asientos.ordenar_titulo')}</h2>
        <p class="tenue">${t('ui.asientos.ordenar_ayuda')}</p>
        <div class="orden-asientos">${orden.map((id, i) => html`<span class="chip-mini">${i + 1}. ${s.players[id].name}</span>`)}</div>
        <div class="fila-botones">${faltan.map(id => html`<button class="btn sec" onClick=${() => setOrden([...orden, id])}>${s.players[id].name}</button>`)}</div>
        <div class="fila-botones">
          <button class="btn sec" onClick=${() => setOrden([])}>${t('ui.asientos.de_nuevo')}</button>
          <button class="btn" disabled=${faltan.length > 0} onClick=${() => { ctl.aplicar({ type: 'asientos', orden }); setOrden(null); }}>${t('ui.asientos.confirmar')}</button>
        </div>
      </section>`;
  }
  return html`
    <section class="vidrio ancho">
      <h2>${t('ui.asientos.titulo')} <small class="tenue">${t('ui.asientos.quienes')}</small></h2>
      ${circulo.ok
        ? html`<p class="ok">${t('ui.asientos.cuadra', { orden: circulo.order.map(id => s.players[id].name).join(' → ') })}</p>`
        : html`<p class="pendiente">${t('ui.asientos.pendiente')}</p>`}
      <button class="btn sec" onClick=${() => setOrden([])}>${t('ui.asientos.desde_tablet')}</button>
    </section>`;
}

// «✨ Sugerir mazo»: propone un mazo equilibrado según cuántos jugadores hay.
function AsistenteMazo({ s, total }) {
  const n = s.ids.length;
  const sugerir = nivel => ctl.aplicar({ type: 'configurar', mazo: engine.sugerirMazo(n, nivel).mazo });
  const faltan = n >= 3 && total < n;
  return html`
    <div class=${`asistente-mazo ${faltan ? 'llamativo' : ''}`}>
      <p class="asistente-titulo">${t('ui.asistente.titulo_1')}<b>${Math.max(n, 3)}</b>${t('ui.asistente.titulo_2')}${n < 3 ? html` <span class="tenue">${t('ui.asistente.faltan')}</span>` : ''}</p>
      <div class="fila-botones">
        ${Object.keys(engine.NIVELES).map(id => html`
          <button class="btn mini" title=${t(`ui.nivel.${id}.texto`)} onClick=${() => sugerir(id)}>${t(`ui.nivel.${id}.nombre`)}</button>`)}
        <button class="btn mini sec" title=${t('ui.asistente.azar_titulo')} onClick=${() => sugerir('azar')}>${t('ui.asistente.azar')}</button>
        <button class="btn mini sec" disabled=${total === 0} onClick=${() => ctl.aplicar({ type: 'configurar', mazo: {} })}>${t('ui.asistente.vaciar')}</button>
      </div>
      <p class="tenue pequeno">${total > n && n >= 3
        ? t('ui.asistente.nota_sobran', { n: total - n })
        : t('ui.asistente.nota')}</p>
    </div>`;
}

function Sala() {
  const s = ctl.state;
  const url = servidor.conservar(new URL(`player.html?sala=${s.sala}`, location.href).href);
  const roles = Object.entries(engine.ctx.roles).filter(([, r]) => r.implementado);
  const mazo = s.config.mazo;
  const total = Object.values(mazo).reduce((a, b) => a + b, 0);
  const problemas = engine.problemasParaEmpezar(s);
  const circulo = engine.necesitaCirculo(s);
  const cambiarMazo = (rol, n) => ctl.aplicar({ type: 'configurar', mazo: { ...mazo, [rol]: n } });
  const cambiarDur = (k, v) => ctl.aplicar({ type: 'configurar', duraciones: { [k]: v } });
  const opcion = cambios => ctl.aplicar({ type: 'configurar', opciones: cambios });
  const nuevoBot = () => ctl.anadirBot(NOMBRES_BOT.find(n => !s.ids.some(id => s.players[id].name === n)) ?? `🤖 Bot ${s.ids.length + 1}`);

  return html`
    <main class="sala-tablet">
      <header class="cabecera">
        <h1 class="titulo-juego pequeno">${t('ui.titulo')}<small>${t('ui.tablet.subtitulo_corto')}</small></h1>
        <${BotonesCabecera} />
      </header>

      <section class="vidrio entrada">
        <div>
          <p class="tenue">${t('ui.tablet.entrad')}</p>
          <div class="codigo">${s.sala.split('').map(l => html`<span>${l}</span>`)}</div>
          <p class="tenue url">${url}</p>
        </div>
        <${QR} texto=${url} />
      </section>

      <section class="vidrio">
        <h2>${t('ui.sala.jugadores')} <span class="contador-chip">${s.ids.length}</span></h2>
        ${!s.ids.length && html`<p class="tenue">${t('ui.sala.escanead')}</p>`}
        ${s.ids.length > 0 && html`<p class="tenue pequeno">${t('ui.sala.cartas_solas')}</p>`}
        <ul class="jugadores-sala">
          ${s.ids.map(id => {
            const p = s.players[id];
            const conectado = p.bot || !!presencia[id];
            return html`<li class="pop" key=${id}>
              <span class=${`punto-conexion ${conectado ? 'si' : 'no'}`} title=${conectado ? t('ui.sala.conectado') : t('ui.sala.sin_conexion')}></span><span class="solo-lectores">${conectado ? t('ui.sala.conectado') : t('ui.sala.sin_conexion')}</span>
              <${Avatar} nombre=${p.name} />
              <b>${p.name}</b>
              ${circulo && html`<span class=${p.rightId ? 'ok' : 'pendiente'} title=${t('ui.sala.asiento')}>${p.rightId ? '🪑 ✓' : '🪑 …'}</span>`}
              <button class="btn mini sec" title=${t('ui.sala.quitar')} onClick=${() => ctl.aplicar({ type: 'salir', id })}>✕</button>
            </li>`;
          })}
        </ul>
        <div class="fila-botones">
          <button class="btn sec mini" onClick=${nuevoBot}>${t('ui.sala.bot')}</button>
          <${BotonDescartar} clase="btn sec mini" />
        </div>
      </section>

      ${circulo && html`<${Asientos} s=${s} />`}

      <section class="vidrio ancho">
        <h2>${t('ui.mazo.partida')} <span class=${`contador-chip ${total >= s.ids.length ? 'ok' : 'pendiente'}`}>${total} / ${s.ids.length}</span></h2>
        <${AsistenteMazo} s=${s} total=${total} />
        <div class="mazo-cartas">
          ${roles.map(([id, r]) => {
            const n = mazo[id] ?? 0;
            // Los roles de grupo (hermanas, hermanos) se juegan completos o no se juegan.
            const salto = r.grupo ? r.copias : 1;
            return html`
              <div class=${`mazo-carta ${n ? 'en-mazo' : ''}`}>
                <button class="mazo-imagen" onClick=${() => cambiarMazo(id, r.grupo ? (n ? 0 : r.copias) : Math.min(r.copias, n + 1))} title=${t('ui.mazo.anadir', { nombre: r.nombre })}>
                  <img src=${imgRol(id)} alt="" loading="lazy" />
                  ${n > 0 && html`<span class="mazo-n">×${n}</span>`}
                </button>
                <small>${r.nombre}</small>
                ${r.nota && html`<span class="etiqueta-simple" title=${r.nota}>${t('ui.mazo.simplificado')}</span>`}
                <${Contador} valor=${n} max=${r.copias} paso=${salto} onChange=${v => cambiarMazo(id, v)} />
              </div>`;
          })}
        </div>
      </section>

      <section class="vidrio">
        <h2>${t('ui.opciones.titulo')}</h2>
        <div class="fila-ajuste">
          <span>${t('ui.opciones.ritmo')} <small class="tenue">${s.config.ritmo === 'clasico' ? t('ui.opciones.ritmo_clasico') : t('ui.opciones.ritmo_rapido')}</small></span>
          <${Interruptor} valor=${s.config.ritmo !== 'clasico'} si=${t('ui.opciones.rapido')} no=${t('ui.opciones.clasico')} onChange=${v => opcion({ ritmo: v ? 'rapido' : 'clasico' })} />
        </div>
        <div class="fila-ajuste">
          <span>${t('ui.opciones.pausa')} <small class="tenue">${t('ui.opciones.recomendado')}</small></span>
          <${Interruptor} valor=${s.config.mostrarReparto} onChange=${v => opcion({ mostrarReparto: v })} />
        </div>
        <div class="fila-ajuste">
          <span>${t('ui.opciones.alguacil')} <small class="tenue">${t('ui.opciones.voto_doble')}</small></span>
          <${Interruptor} valor=${s.config.alguacil} onChange=${v => opcion({ alguacil: v })} />
        </div>
        <div class="fila-ajuste">
          <span>${t('ui.opciones.explicar')} <small class="tenue">${t('ui.opciones.explicar_nota')}</small></span>
          <${Interruptor} valor=${s.config.explicarReglas} onChange=${v => opcion({ explicarReglas: v })} />
        </div>
        <div class="fila-ajuste">
          <span>${t('ui.opciones.muertos')}</span>
          <${Interruptor} valor=${s.config.muertosVenTodo} onChange=${v => opcion({ muertosVenTodo: v })} />
        </div>
        ${mazo.nina ? html`
          <div class="fila-ajuste">
            <span>${t('ui.opciones.nina')}</span>
            <${Contador} valor=${Math.round(s.config.riesgoNina * 100)} min=${0} max=${100} paso=${10} formato=${v => `${v} %`}
              onChange=${v => opcion({ riesgoNina: v / 100 })} />
          </div>` : null}
        ${mazo.comediante ? html`
          <div class="fila-ajuste columna">
            <span>${t('ui.opciones.comediante')}</span>
            <div class="fila-botones">
              ${['vidente', 'protector', 'bruja', 'zorro'].map(r => {
                const dentro = s.config.poolComediante.includes(r);
                return html`<button class=${`btn mini ${dentro ? '' : 'sec'}`} onClick=${() => opcion({ poolComediante: dentro ? s.config.poolComediante.filter(x => x !== r) : [...s.config.poolComediante, r] })}>${engine.ctx.roles[r].nombre}</button>`;
              })}
            </div>
          </div>` : null}
      </section>

      <section class="vidrio">
        <h2>${t('ui.tiempos.titulo')}</h2>
        ${DUR_EDITABLES.map(d => html`
          <div class="fila-ajuste">
            <span>${t(`ui.dur.${d.k}`)}</span>
            <${Contador} valor=${s.config.duraciones[d.k]} min=${d.min} max=${d.max} paso=${d.paso} formato=${d.f} onChange=${v => cambiarDur(d.k, v)} />
          </div>`)}
      </section>

      <footer class="pie-empezar vidrio">
        ${problemas.length
          ? html`<ul class="problemas">${problemas.map(p => html`<li>${p}</li>`)}</ul>`
          : html`<p class="ok">${t('ui.sala.todo_listo')}</p>`}
        <button class=${`btn grande ${problemas.length ? '' : 'brillo'}`} disabled=${problemas.length > 0} onClick=${() => ctl.aplicar({ type: 'empezar' })}>${t('ui.sala.empezar')}</button>
      </footer>
    </main>`;
}

// --- Partida -------------------------------------------------------------------------------

// Jugadores sentados en círculo alrededor del paso actual.
function Mesa({ s, pub }) {
  const orden = pub.orden ?? [];
  const n = orden.length;
  const conteo = {};
  if (pub.votacion) for (const v of pub.votacion.votos) conteo[v.a] = (conteo[v.a] ?? 0) + (v.peso ?? 1);
  const muertos = Object.fromEntries(pub.muertos.map(m => [m.nombre, m]));
  const c = s.current;
  const noche = s.phase === 'noche';
  const radio = 41;
  const fase = noche ? t('ui.mesa.noche', { n: s.noche }) : s.dia === 0 ? t('ui.mesa.antes') : t('ui.mesa.dia', { n: s.dia });
  return html`
    <div class="mesa">
      <div class="mesa-tablero"></div>
      ${orden.map((nombre, i) => {
        const j = pub.jugadores.find(x => x.nombre === nombre);
        const m = muertos[nombre];
        const ang = Math.PI / 2 + (i * 2 * Math.PI) / n;
        const x = 50 + radio * Math.cos(ang);
        const y = 50 + radio * Math.sin(ang);
        const clases = ['ficha', j.vivo ? '' : 'muerta', noche && j.vivo ? 'durmiendo' : '',
          pub.votacion?.linchado === nombre ? 'linchada' : '', j.alguacil ? 'es-alguacil' : ''].join(' ');
        const desconectado = j.vivo && !j.bot && !presencia[j.id];
        return html`
          <div class=${clases} style=${`left:${x}%;top:${y}%;--i:${i}`} key=${nombre}>
            <${Avatar} nombre=${nombre} rolId=${m?.rolId ?? j.rolPublicoId ?? null} />
            ${j.alguacil && html`<span class="insignia estrella">⭐</span>`}
            ${conteo[nombre] ? html`<span class="insignia votos">${conteo[nombre]}</span>` : null}
            ${j.noVota && j.vivo ? html`<span class="insignia sin-voto">🚫</span>` : null}
            ${j.grupo ? html`<span class="insignia grupo">${j.grupo === 'sol' ? '☀️' : '🌙'}</span>` : null}
            ${desconectado ? html`<span class="insignia desconectado" title=${t('ui.mesa.desconectado')}>📵</span>` : null}
            <span class="ficha-nombre">${j.exSirvienta ? '🕯 ' : ''}${nombre}</span>
          </div>`;
      })}
      <div class="mesa-centro">
        <p class="mesa-fase">${fase}</p>
        <h1 class="paso-titulo" key=${c?.id}>${ETIQUETA_PASO[c?.tipo] ?? c?.tipo ?? ''}</h1>
        <${Temporizador} reloj=${ctl.reloj} ahora=${net.ahora} tam=${140} />
      </div>
    </div>`;
}

function Subtitulos() {
  const actual = ui.subtitulo;
  const previas = narracion.filter(t => t !== actual).slice(-2);
  return html`
    <div class="subtitulos">
      ${previas.map(t => html`<p class="previa">${t}</p>`)}
      ${actual && html`<p class="actual" key=${actual}>${actual}</p>`}
    </div>`;
}

// Progreso de un paso de día: quién ha votado, cuántos quieren saltarse el debate…
function Progreso({ s }) {
  const c = s.current;
  if (!c || s.phase !== 'dia' || !c.actores.length) return null;
  const listos = s.listos ?? {};
  if (c.tipo === 'debate') {
    const si = c.actores.filter(id => listos[id]).length;
    const hacen = engine.necesariosDebate(c.actores.length);
    return html`
      <div class="progreso-voto">
        <p>${t('ui.progreso.quieren_1')}<b>${si}</b>${t('ui.progreso.quieren_2', { hacen })}</p>
        <div class="medidor"><div style=${`width:${Math.min(100, (100 * si) / hacen)}%`}></div></div>
      </div>`;
  }
  if (!['votacion', 'alguacil'].includes(c.tipo)) return null;
  const estado = id => (s.inputs[id] != null ? 'hecho' : listos[id] ? 'abstiene' : '');
  const hechos = c.actores.filter(id => estado(id)).length;
  return html`
    <div class="progreso-voto">
      <p>${t('ui.progreso.votado_1')}<b>${hechos}</b>${t('ui.progreso.votado_2', { total: c.actores.length })}</p>
      <div class="puntos">${c.actores.map(id => html`<span class=${`punto ${estado(id)}`}>${s.players[id].name}</span>`)}</div>
    </div>`;
}

function Revelacion() {
  const r = ui.revelacion;
  if (!r) return null;
  const clase = !r.volteada ? '' : r.bando === 'lobos' ? 'bando-lobos' : r.bando === 'aldea' ? 'bando-aldea' : 'bando-otro';
  return html`
    <div class=${`velo revelacion ${clase}`}>
      <div class="revelacion-contenido aparecer">
        <p class="revelacion-nombre">${r.nombre}</p>
        <${Carta} rol=${r.rolId} boca=${r.volteada ? 'arriba' : 'abajo'} clase="grande" alt=${r.rol ?? t('ui.carta_secreta')} />
        <p class="revelacion-rol">${r.volteada ? r.rol : r.rolId ? '…' : t('ui.revelacion.secreto')}</p>
        ${r.reaccion && html`<p class="revelacion-reaccion aparecer">${r.reaccion}</p>`}
      </div>
    </div>`;
}

function Intro() {
  if (!ui.intro) return null;
  return html`
    <div class="velo intro">
      <div class="intro-contenido">
        <img src=${imgRol('lobo')} class="intro-lobo" alt="" />
        <h1 class="titulo-juego">${t('ui.titulo')}<small>${t('ui.tablet.subtitulo')}</small></h1>
        <p class="intro-lema">${t('ui.intro.lema')}</p>
      </div>
    </div>`;
}

// El oso dla Domadora gruñe: la zarpa aparece y tiembla.
function Oso() {
  if (!ui.oso) return null;
  return html`
    <div class="velo oso">
      <div class="oso-contenido">
        <img src=${imgRol('domador')} alt="" />
        <p>${t('ui.oso')}</p>
      </div>
    </div>`;
}

function MenuAnfitrion({ refrescar }) {
  const [abierto, setAbierto] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const pedir = (clave, fn) => () => {
    if (confirmar !== clave) { setConfirmar(clave); setTimeout(() => setConfirmar(c => (c === clave ? null : c)), 3000); return; }
    setConfirmar(null);
    fn();
    refrescar();
  };
  const ultima = narracion.at(-1);
  if (ajustes) return html`<${Ajustes} cerrar=${() => setAjustes(false)} />`;
  if (!abierto) return html`<button class="btn menu-boton" aria-label=${t('ui.menu.aria')} onClick=${() => setAbierto(true)}>⚙</button>`;
  return html`
    <div class="menu vidrio aparecer">
      ${ctl.pausado
        ? html`<button class="btn" onClick=${() => { ctl.reanudar(); refrescar(); }}>${t('ui.menu.reanudar')}</button>`
        : html`<button class="btn" onClick=${() => { ctl.pausar(); refrescar(); }}>${t('ui.menu.pausar')}</button>`}
      <button class="btn sec" onClick=${() => { ctl.masTiempo(30); refrescar(); }}>+30 s</button>
      <button class="btn sec" onClick=${pedir('saltar', () => { voz.callar(); ctl.avanzar(); })}>${confirmar === 'saltar' ? t('ui.menu.seguro') : t('ui.menu.saltar')}</button>
      <button class="btn sec" disabled=${!ctl.puedeDeshacer} onClick=${pedir('deshacer', () => { voz.callar(); ui.revelacion = null; ctl.deshacer(); })}>${confirmar === 'deshacer' ? t('ui.menu.seguro') : t('ui.menu.deshacer')}</button>
      <button class="btn sec" disabled=${!ultima} onClick=${() => voz.decir(ultima)}>${t('ui.menu.repetir')}</button>
      <button class="btn sec" onClick=${() => { voz.activa = !voz.activa; refrescar(); }}>${voz.activa ? t('ui.menu.silenciar') : t('ui.menu.activar')}</button>
      <button class="btn sec" onClick=${() => setAjustes(true)}>${t('ui.menu.voz_sonido')}</button>
      <button class="btn sec" onClick=${pedir('abortar', () => { voz.callar(); ctl.aplicar({ type: 'abortar' }); })}>${confirmar === 'abortar' ? t('ui.menu.seguro') : t('ui.menu.abortar')}</button>
      <button class="btn sec" onClick=${pantallaCompleta}>${t('ui.menu.pantalla_completa')}</button>
      <button class="btn" onClick=${() => setAbierto(false)}>${t('ui.boton.cerrar')}</button>
      <p class="tenue pequeno">${t('ui.menu.estado', { pantalla: pantallaEncendida?.activo() ? t('ui.menu.encendida') : t('ui.menu.apagable'), voz: voz.nombreVoz ?? t('ui.ajustes.voz_defecto') })}</p>
    </div>`;
}

// El final espera a que termine la última revelación (si la tablet se recargó, sale ya).
function Final({ s, pub }) {
  const listo = ui.victoria || !voz.hablando();
  if (!listo) return html`<section class="final"><div class="cargando"></div></section>`;
  return html`
    <section class=${`final ganador-${s.winner}`}>
      <h1 class="titulo-final">${GANADOR[s.winner]}</h1>
      <${Reparto} reparto=${pub.reparto} />
      <${Votacion} votacion=${pub.votacion} />
      <${Cronica} cronica=${pub.cronica} />
      <button class="btn grande brillo" onClick=${() => { ui.victoria = false; audio.musica('noche'); ctl.aplicar({ type: 'revancha' }); }}>${t('ui.final.volver')}</button>
      <${BotonHistorial} clase="btn sec grande" />
      <${BotonDescartar} clase="btn sec grande" texto=${t('ui.tablet.descartar_cero')} />
    </section>`;
}

function Juego({ refrescar }) {
  const s = ctl.state;
  const pub = engine.publicView(s);
  if (s.phase === 'fin') {
    return html`
      <main class="tablero fin">
        <${Final} s=${s} pub=${pub} />
        <${MenuAnfitrion} refrescar=${refrescar} />
      </main>`;
  }
  return html`
    <main class=${`tablero ${s.phase === 'noche' ? 'es-noche' : 'es-dia'}`}>
      <${Mesa} s=${s} pub=${pub} />
      <aside class="panel">
        <${Subtitulos} />
        <${Progreso} s=${s} />
        ${pub.votacion && html`<${Votacion} votacion=${pub.votacion} key=${`v${s.dia}-${pub.votacion.linchado}`} />`}
        ${pub.votantesProximos && html`<p class="aviso-suave">${t('ui.dia.proxima', { nombres: pub.votantesProximos.join(', ') })}</p>`}
        ${pub.aldeaSinPoderes && html`<p class="aviso-suave">${t('ui.juego.sin_poderes')}</p>`}
        <${CartasComediante} cartas=${pub.cartasComediante} />
        <${Cementerio} muertos=${pub.muertos} compacto />
      </aside>
      <${MenuAnfitrion} refrescar=${refrescar} />
    </main>`;
}

function App() {
  const [, setV] = useState(0);
  const refrescar = useRef(() => setV(v => v + 1)).current;
  refrescarGlobal = refrescar;
  const [conectado, setConectado] = useState(true);
  useEffect(() => net.onConexion(setConectado), []);
  useEffect(() => alCambiarIdioma(refrescar), []); // al cambiar de idioma se vuelve a pintar todo
  const s = ctl?.state;
  const noche = !s || s.phase === 'noche' || s.phase === 'sala';
  const amaneciendo = s?.current?.tipo === 'amanecer';
  const tension = s?.current?.tipo === 'votacion';
  return html`
    <${Escenario} noche=${noche} amaneciendo=${amaneciendo} tension=${tension} />
    <${AvisoConexion} conectado=${conectado} />
    ${!ctl ? html`<${Inicio} refrescar=${refrescar} />` : s.phase === 'sala' ? html`<${Sala} />` : html`<${Juego} refrescar=${refrescar} />`}
    <${Revelacion} />
    <${Oso} />
    <${Intro} />`;
}

await iniciarIdioma();
// Si faltara alguno de los archivos del idioma elegido, se sigue en español en lugar de dejar la pantalla en blanco.
engine = createEngine(await loadData(idiomaActual()).catch(async () => { await usarIdioma('es'); return loadData('es'); }));
voz.usarIdioma(idiomaActual());
render(html`<${App} />`, document.getElementById('app'));
