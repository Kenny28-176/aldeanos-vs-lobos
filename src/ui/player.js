// Pantalla del celular de cada jugador. Nunca calcula reglas: muestra su vista y envía acciones.
// Los celulares no suenan ni vibran de noche (delataría a quien está despierto).
import './ajustes.js'; // aplica el tamaño de texto, el contraste y las animaciones guardados
import './sw-registro.js'; // carga más rápida y resistencia a los cortes de red
import {
  html, render, useState, useEffect, useRef,
  Temporizador, Cementerio, Votacion, Reparto, Aldea, CartasComediante, Cronica, ETIQUETA_PASO, GANADOR,
  AjustesPantalla, AvisoConexion, useDialogo,
} from './comun.js';
import { Carta, Avatar, imgRol, imgPortada } from './cartas.js';
import { Escenario } from './escena.js';
import * as net from '../net/sala.js';
import { mantenerEncendida } from './wakelock.js';
import { t, idiomaActual, usarIdioma, iniciarIdioma, alCambiarIdioma } from '../i18n/idioma.js';

const params = new URLSearchParams(location.search);
const salaInicial = net.normalizarCodigo(params.get('sala') || localStorage.getItem('lobos:ultimaSala') || '');
const montadoEn = Date.now();

const claveYo = sala => `lobos:yo:${sala}`;
const leerYo = sala => { try { return JSON.parse(localStorage.getItem(claveYo(sala))); } catch { return null; } };
const nuevoId = () => 'j' + Math.random().toString(36).slice(2, 10);
const vibrar = ms => { try { navigator.vibrate?.(ms); } catch { /* no soportado */ } };

// --- Entrar --------------------------------------------------------------------

// Las páginas informativas existen en cada idioma: como-jugar.html → en/como-jugar.html
const enlaceAyuda = pagina => (idiomaActual() === 'es' ? pagina : `${idiomaActual()}/${pagina}`);

function Entrar({ alEntrar }) {
  const [sala, setSala] = useState(salaInicial);
  const [nombre, setNombre] = useState(localStorage.getItem('lobos:nombre') || '');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [pantalla, setPantalla] = useState(false);
  const enviar = async e => {
    e.preventDefault();
    const codigo = net.normalizarCodigo(sala);
    if (!codigo || !nombre.trim()) return setError(t('ui.entrar.sala_y_nombre'));
    setCargando(true);
    setError(null);
    try {
      if (!(await net.existeSala(codigo))) { setCargando(false); return setError(t('ui.entrar.no_existe', { codigo })); }
      const yo = { id: leerYo(codigo)?.id ?? nuevoId(), nombre: nombre.trim() };
      localStorage.setItem(claveYo(codigo), JSON.stringify(yo));
      localStorage.setItem('lobos:ultimaSala', codigo);
      localStorage.setItem('lobos:nombre', yo.nombre);
      await net.enviarAccion(codigo, { type: 'unirse', id: yo.id, nombre: yo.nombre });
      alEntrar(codigo, yo);
    } catch (fallo) {
      setCargando(false);
      setError(fallo.message);
    }
  };
  return html`
    <main class="movil portada-movil">
      <img class="carta-portada" src=${imgPortada()} alt="" />
      <h1 class="titulo-juego">${t('ui.titulo')}<small>${t('ui.entrar.subtitulo')}</small></h1>
      <form onSubmit=${enviar} class="formulario vidrio">
        <label class="campo">${t('ui.entrar.codigo')}
          <input value=${sala} onInput=${e => setSala(e.target.value)} maxlength="4" autocapitalize="characters" class="input-codigo" />
        </label>
        <label class="campo">${t('ui.entrar.nombre')}
          <input value=${nombre} onInput=${e => setNombre(e.target.value)} maxlength="20" autocomplete="nickname" />
        </label>
        <button class="btn grande brillo" disabled=${cargando}>${cargando ? t('ui.entrar.entrando') : t('ui.entrar.boton')}</button>
        ${error && html`<p class="error">${error}</p>`}
      </form>
      <nav class="enlaces-pie">
        <a href=${enlaceAyuda('como-jugar.html')}>${t('ui.entrar.como_jugar')}</a>
        <a href=${enlaceAyuda('acerca.html')}>${t('ui.entrar.acerca')}</a>
        <button class="btn enlace" onClick=${() => setPantalla(true)}>${t('ui.boton.pantalla')}</button>
      </nav>
      ${pantalla && html`
        <${Hoja} etiqueta=${t('ui.boton.pantalla')} cerrar=${() => setPantalla(false)}>
          <${AjustesPantalla} />
          <button class="btn grande" onClick=${() => setPantalla(false)}>${t('ui.boton.cerrar')}</button>
        </${Hoja}>`}
    </main>`;
}

// --- Hojas inferiores: mi carta y roles en juego -----------------------------------------

function Hoja({ cerrar, etiqueta, children }) {
  const ref = useRef(null);
  useDialogo(ref, cerrar);
  return html`
    <div class="velo hoja-fondo" onClick=${e => e.target === e.currentTarget && cerrar()}>
      <div class="hoja" ref=${ref} role="dialog" aria-modal="true" aria-label=${etiqueta}>${children}</div>
    </div>`;
}

function MiRol({ rol, mazo, resumen, discreto = false }) {
  const [abierto, setAbierto] = useState(null); // 'carta' | 'roles'
  if (!rol && !mazo?.length) return null;
  return html`
    <div class=${`mi-rol ${discreto ? 'discreto' : ''}`}>
      ${rol && html`<button class="btn sec ver-rol" onClick=${() => setAbierto('carta')}>${t('ui.mi_carta.boton')}</button>`}
      ${mazo?.length ? html`<button class="btn sec ver-roles" onClick=${() => setAbierto('roles')} aria-label=${t('ui.mazo.titulo')} title=${t('ui.mazo.titulo')}>📖</button>` : null}
      <button class="btn sec ver-pantalla" onClick=${() => setAbierto('pantalla')} aria-label=${t('ui.pantalla.aria')} title=${t('ui.pantalla.aria')}>Aa</button>
      ${abierto === 'carta' && html`
        <${Hoja} etiqueta=${t('ui.mi_carta.etiqueta')} cerrar=${() => setAbierto(null)}>
          <${Carta} rol=${rol.id} voltearAlMontar clase="media" alt=${rol.nombre} />
          <h2 class="hoja-titulo">${rol.nombre}</h2>
          ${rol.subtitulo ? html`<p class="hoja-subtitulo">${rol.subtitulo}</p>` : null}
          ${rol.companeros?.length ? html`<p class="companeros-lobo">${t('ui.manada')} <b>${rol.companeros.join(', ')}</b></p>` : null}
          ${rol.notas?.length ? html`<ul class="notas">${rol.notas.map(n => html`<li>${n}</li>`)}</ul>` : null}
          ${rol.guia && html`
            <div class="guia">
              <p>${rol.guia.resumen}</p>
              <p><b>${t('ui.guia.cuando')}</b> ${rol.guia.cuando}</p>
              <p><b>${t('ui.guia.accion')}</b> ${rol.guia.accion}</p>
              <p><b>${t('ui.guia.objetivo')}</b> ${rol.guia.objetivo}</p>
            </div>`}
          <button class="btn grande" onClick=${() => setAbierto(null)}>${t('ui.ocultar')}</button>
        </${Hoja}>`}
      ${abierto === 'roles' && html`
        <${Hoja} etiqueta=${t('ui.mazo.titulo')} cerrar=${() => setAbierto(null)}>
          <h2 class="hoja-titulo">${t('ui.mazo.titulo')}</h2>
          ${resumen && resumen.cartas > resumen.jugadores
            ? html`<p class="tenue centrado">${t('ui.mazo.sobran', { cartas: resumen.cartas, jugadores: resumen.jugadores })}</p>`
            : null}
          <ul class="guia-roles">
            ${mazo.map(r => html`
              <li class=${`bando-${r.bando}`}>
                <img src=${imgRol(r.rol)} alt="" loading="lazy" />
                <div>
                  <b>${r.nombre}${r.n > 1 ? ` ×${r.n}` : ''}</b>
                  ${r.subtitulo ? html`<span class="subtitulo-rol">${r.subtitulo}</span>` : null}
                  ${r.nota && html`<p class="nota-rol">${r.nota}</p>`}
                  ${r.guia && html`<p>${r.guia.resumen}</p><p class="tenue"><b>${t('ui.guia.objetivo')}</b> ${r.guia.objetivo}</p>`}
                </div>
              </li>`)}
          </ul>
          <button class="btn grande" onClick=${() => setAbierto(null)}>${t('ui.boton.cerrar')}</button>
        </${Hoja}>`}
      ${abierto === 'pantalla' && html`
        <${Hoja} etiqueta=${t('ui.boton.pantalla')} cerrar=${() => setAbierto(null)}>
          <${AjustesPantalla} />
          <button class="btn grande" onClick=${() => setAbierto(null)}>${t('ui.boton.cerrar')}</button>
        </${Hoja}>`}
    </div>`;
}

// Novedades secretas (infección, transformación…): primero un aviso discreto; al tocarlo se lee.
function Alertas({ sala, yo, alertas }) {
  const clave = `lobos:alertas:${sala}:${yo.id}`;
  const [vistas, setVistas] = useState(() => { try { return JSON.parse(localStorage.getItem(clave)) ?? []; } catch { return []; } });
  const [abierta, setAbierta] = useState(false);
  const pendiente = (alertas ?? []).find(a => !vistas.includes(a.clave));
  if (!pendiente) return null;
  const marcar = () => {
    const nuevas = [...vistas, pendiente.clave];
    setVistas(nuevas);
    setAbierta(false);
    try { localStorage.setItem(clave, JSON.stringify(nuevas)); } catch { /* sin almacenamiento */ }
  };
  if (!abierta) return html`<button class="novedad pop" onClick=${() => setAbierta(true)}>${t('ui.alerta.boton')}</button>`;
  return html`
    <${Hoja} etiqueta=${t('ui.alerta.etiqueta')} cerrar=${marcar}>
      <p class="alerta-icono">${pendiente.icono}</p>
      <p class="alerta-texto">${pendiente.texto}</p>
      <button class="btn grande" onClick=${marcar}>${t('ui.entendido')}</button>
    </${Hoja}>`;
}

// --- Sala: asiento ----------------------------------------------------------------------

function Asiento({ vista, enviar }) {
  if (!vista.preguntarDerecha) return null;
  return html`
    <section class="vidrio">
      <h2>${t('ui.asiento.pregunta')}</h2>
      <p class="tenue">${t('ui.asiento.ayuda')}</p>
      <select value=${vista.derecha ?? ''} onChange=${e => enviar({ type: 'derecha', derechaId: e.target.value })}>
        <option value="" disabled>${t('ui.asiento.elige')}</option>
        ${vista.otros.map(o => html`<option value=${o.id}>${o.nombre}</option>`)}
      </select>
    </section>`;
}

// --- Acciones -------------------------------------------------------------------------------

function Accion({ vista, enviar }) {
  const mandar = eleccion => enviar({ type: 'enviar', paso: vista.paso, eleccion });
  const listo = (valor = true) => enviar({ type: 'listo', paso: vista.paso, valor });
  const cuerpo = {
    elegir: AccionElegir,
    varios: AccionVarios,
    bruja: AccionBruja,
    espiar: AccionEspiar,
    boton: AccionBoton,
    dos: AccionDos,
    cartas: AccionCartas,
    debate: AccionDebate,
    carta: AccionCarta,
    info: () => html`<div class="info vidrio">${vista.texto}</div>`,
  }[vista.accion] ?? (() => null);
  return html`
    <section class="accion">
      <h1 class="accion-titulo">${vista.titulo}</h1>
      ${vista.ayuda && html`<p class="tenue">${vista.ayuda}</p>`}
      <${cuerpo} key=${vista.paso} vista=${vista} mandar=${mandar} enviar=${enviar} />
      ${vista.accion !== 'debate' && html`<${BarraListo} vista=${vista} listo=${listo} />`}
    </section>`;
}

// «Listo»: ya decidí (o no quiero hacer nada) → no hace falta esperar al reloj.
function BarraListo({ vista, listo }) {
  const voto = vista.tipo === 'votacion' || vista.tipo === 'alguacil';
  const hecho = vista.eleccion != null && !(Array.isArray(vista.eleccion) && !vista.eleccion.length)
    && !(vista.accion === 'bruja' && !vista.eleccion.curar && !vista.eleccion.veneno);
  if (vista.listo) {
    return html`
      <div class="barra-listo hecho">
        <span>${t('ui.listo.esperando', { estado: voto && !hecho ? t('ui.listo.abstienes') : t('ui.listo.listo') })}</span>
        <button class="btn sec mini" onClick=${() => listo(false)}>${t('ui.listo.cambiar')}</button>
      </div>`;
  }
  const texto = vista.accion === 'info' ? t('ui.boton.entendido_info')
    : vista.accion === 'carta' ? t('ui.boton.ya_vi')
    : hecho ? t('ui.boton.listo') : voto ? t('ui.boton.abstenerme') : t('ui.boton.pasar');
  const destacado = hecho || vista.accion === 'info' || vista.accion === 'carta';
  return html`<div class="barra-listo"><button class=${`btn grande ${destacado ? 'brillo' : 'sec'}`} onClick=${() => listo(true)}>${texto}</button></div>`;
}

// Botón de jugador con avatar (y marcas de quién más lo eligió).
function OpcionJugador({ o, elegida, onClick, disabled, marcas = [] }) {
  return html`
    <button class=${`opcion-ficha ${elegida ? 'elegida' : ''}`} disabled=${disabled} aria-pressed=${!!elegida} onClick=${onClick}>
      <${Avatar} nombre=${o.nombre} />
      <span class="opcion-nombre">${o.nombre}</span>
      ${marcas.length ? html`<span class="marcas">${marcas.map(m => html`<span class="chip-mini">🐺 ${m}</span>`)}</span>` : null}
      ${elegida && html`<span class="check">✓</span>`}
    </button>`;
}

function AccionElegir({ vista, mandar, enviar }) {
  const marcasDe = id => (vista.companeros ?? []).filter(c => c.eligio === id).map(c => c.nombre);
  const pendientes = (vista.companeros ?? []).filter(c => !c.eligio).map(c => c.nombre);
  return html`
    ${vista.rolVisto && html`
      <div class="vision aparecer">
        <${Carta} rol=${vista.rolVisto} voltearAlMontar clase="media" />
        <p class="revelacion-texto">${vista.resultado}</p>
      </div>`}
    ${!vista.rolVisto && vista.resultado && html`<p class="revelacion-texto aparecer">${vista.resultado}</p>`}
    ${!vista.bloqueado && html`
      <div class="opciones-fichas">
        ${vista.opciones.map(o => html`
          <${OpcionJugador} o=${o} elegida=${vista.eleccion === o.id} marcas=${marcasDe(o.id)}
            onClick=${() => mandar(vista.eleccion === o.id ? null : o.id)} />`)}
      </div>`}
    ${pendientes.length ? html`<p class="tenue centrado">${t('ui.elegir.pensando', { nombres: pendientes.join(', ') })}</p>` : null}
    ${vista.poderJuez && html`
      <button class=${`btn sec juez ${vista.poderJuez.pedido ? 'activo' : ''}`} onClick=${() => enviar({ type: 'poder', paso: vista.paso, poder: 'segundaVotacion' })}>
        ⚖️ ${vista.poderJuez.pedido ? t('ui.juez.pedida') : t('ui.juez.pedir')}
      </button>`}`;
}

// Elegir varios (Arquero del Amor, Flautista: un número exacto; Chivo Expiatorio: los que quiera).
function AccionVarios({ vista, mandar }) {
  const [marcados, setMarcados] = useState(vista.eleccion ?? []);
  const enviados = vista.eleccion ?? [];
  const enviado = enviados.length > 0 && JSON.stringify(enviados) === JSON.stringify(marcados);
  const alternar = id => setMarcados(m => (m.includes(id) ? m.filter(x => x !== id)
    : vista.n && m.length >= vista.n ? [...m.slice(1), id] : [...m, id]));
  const listo = vista.n ? marcados.length === vista.n : true;
  return html`
    <div class="opciones-fichas">
      ${vista.opciones.map(o => html`<${OpcionJugador} o=${o} elegida=${marcados.includes(o.id)} onClick=${() => alternar(o.id)} />`)}
    </div>
    ${enviado
      ? html`<p class="ok centrado">${t('ui.varios.enviado')}</p>`
      : html`<button class="btn grande brillo" disabled=${!listo} onClick=${() => mandar(marcados)}>${t('ui.varios.confirmar')}${vista.n ? ` (${marcados.length}/${vista.n})` : ''}</button>`}`;
}

function AccionBruja({ vista, mandar }) {
  const e = vista.eleccion;
  const cambiar = cambio => mandar({ ...e, ...cambio });
  const victimas = vista.victimas ?? (vista.victima ? [vista.victima] : []);
  const vida = !vista.pocionVida ? html`<p class="tenue">${t('ui.bruja.ya_usada')}</p>`
    : !victimas.length ? html`<p class="tenue">${t('ui.bruja.sin_ataque')}</p>`
    : html`
      <p>${t('ui.bruja.atacado')}<b>${victimas.map(v => v.nombre).join(` ${t('motor.y')} `)}</b>.</p>
      ${victimas.map(v => html`
        <button class=${`btn grande pocion-vida ${e.curar === v.id ? 'elegida' : ''}`} onClick=${() => cambiar({ curar: e.curar === v.id ? null : v.id })}>
          ${e.curar === v.id ? t('ui.bruja.curando', { nombre: v.nombre }) : t('ui.bruja.curar', { nombre: v.nombre })}
        </button>`)}`;
  const muerte = !vista.pocionMuerte ? html`<p class="tenue">${t('ui.bruja.ya_usada')}</p>` : html`
    <div class="opciones-fichas">
      ${vista.opciones.map(o => html`<${OpcionJugador} o=${o} elegida=${e.veneno === o.id} onClick=${() => cambiar({ veneno: e.veneno === o.id ? null : o.id })} />`)}
    </div>`;
  return html`
    <div class=${`pocion vidrio ${vista.pocionVida ? '' : 'gastada'}`}><h2><span class="frasco">🧪</span> ${t('ui.bruja.pocion_vida')}</h2>${vida}</div>
    <div class=${`pocion veneno vidrio ${vista.pocionMuerte ? '' : 'gastada'}`}><h2><span class="frasco">☠️</span> ${t('ui.bruja.pocion_muerte')}</h2>${muerte}</div>`;
}

function AccionEspiar({ vista, mandar }) {
  if (vista.resultado) {
    return html`
      <p class="revelacion-texto aparecer">${vista.resultado}</p>
      ${vista.descubierta && html`<p class="error grande-texto">${t('ui.espiar.descubierta')}</p>`}`;
  }
  return html`<button class="btn ojo" onClick=${() => mandar('espiar')}><span>👁</span>${t('ui.espiar.boton')}</button>`;
}

function AccionBoton({ vista, mandar }) {
  if (vista.eleccion === vista.boton.valor) {
    return html`
      <p class="ok grande-texto aparecer">${t('ui.boton.hecho')}</p>
      <button class="btn sec mini" onClick=${() => mandar(null)}>${t('ui.boton.arrepiento')}</button>`;
  }
  return html`<button class="btn grande brillo boton-poder" onClick=${() => mandar(vista.boton.valor)}>${vista.boton.texto}</button>`;
}

function AccionDos({ vista, mandar }) {
  return html`
    <div class="dos-cartas">
      ${vista.opciones.map(o => html`
        <button class=${`carta-opcion ${vista.eleccion === o.valor ? 'elegida' : ''}`} onClick=${() => mandar(o.valor)}>
          <img src=${imgRol(o.rol)} alt="" />
          <span>${o.texto}</span>
        </button>`)}
    </div>`;
}

function AccionCartas({ vista, mandar }) {
  return html`
    <div class="dos-cartas">
      ${vista.cartas.map(c => html`
        <button class=${`carta-opcion ${vista.eleccion === c.rol ? 'elegida' : ''}`} onClick=${() => mandar(vista.eleccion === c.rol ? null : c.rol)}>
          <img src=${imgRol(c.rol)} alt="" />
          <span>${c.nombre}</span>
        </button>`)}
    </div>`;
}

// Reparto: la carta secreta del jugador, boca abajo hasta que la toca.
function AccionCarta({ vista }) {
  const [vista_, setVista] = useState(false);
  const rol = vista.rol;
  if (!rol) return html`<p class="tenue">${t('ui.carta.esperando')}</p>`;
  return html`
    <div class="carta-reparto">
      <button class="carta-tocar" onClick=${() => setVista(v => !v)} aria-label=${vista_ ? t('ui.carta.ocultar_aria') : t('ui.carta.ver_aria')}>
        <${Carta} rol=${rol.id} boca=${vista_ ? 'arriba' : 'abajo'} clase="media" alt=${rol.nombre} />
      </button>
      ${!vista_ && html`<p class="tenue centrado">${t('ui.carta.tocar')}</p>`}
      ${vista_ && html`
        <div class="aparecer">
          <h2 class="hoja-titulo">${rol.nombre}</h2>
          ${rol.subtitulo ? html`<p class="hoja-subtitulo">${rol.subtitulo}</p>` : null}
          ${rol.companeros?.length ? html`<p class="companeros-lobo">${t('ui.manada')} <b>${rol.companeros.join(', ')}</b></p>` : null}
          ${rol.notas?.length ? html`<ul class="notas">${rol.notas.map(n => html`<li>${n}</li>`)}</ul>` : null}
          ${rol.guia && html`
            <div class="guia">
              <p>${rol.guia.resumen}</p>
              <p><b>${t('ui.guia.cuando')}</b> ${rol.guia.cuando}</p>
              <p><b>${t('ui.guia.accion')}</b> ${rol.guia.accion}</p>
              <p><b>${t('ui.guia.objetivo')}</b> ${rol.guia.objetivo}</p>
            </div>`}
          <p class="tenue centrado pequeno">${t('ui.carta.ocultar')}</p>
        </div>`}
    </div>`;
}

// Debate: cada jugador puede pedir pasar a la votación (con el 75 % se pasa).
function AccionDebate({ vista, enviar }) {
  const alternar = () => enviar({ type: 'listo', paso: vista.paso, valor: !vista.listo });
  return html`
    <div class="debate">
      <p class="lema-dia">${t('ui.debate.lema')}</p>
      <button class=${`btn grande ${vista.listo ? 'sec' : 'brillo'}`} onClick=${alternar}>
        ${vista.listo ? t('ui.debate.seguir') : t('ui.debate.pasar')}
      </button>
      <div class="medidor"><div style=${`width:${Math.min(100, (100 * vista.saltan) / vista.necesarios)}%`}></div></div>
      <p class="tenue centrado">${t('ui.debate.necesarios', { saltan: vista.saltan, necesarios: vista.necesarios })}</p>
    </div>`;
}

function Aviso({ aviso }) {
  const [oculto, setOculto] = useState(null);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setOculto(aviso.t), 6000);
    return () => clearTimeout(t);
  }, [aviso?.t]);
  if (!aviso || aviso.t < montadoEn - 5000 || oculto === aviso.t) return null;
  return html`<div class="aviso" role="status" onClick=${() => setOculto(aviso.t)}>${aviso.texto}</div>`;
}

// --- Pantallas según la vista --------------------------------------------------

function Cabecera({ vista, publico, reloj, centro, grupo }) {
  return html`
    <header class="cabecera-movil">
      <span class="yo"><${Avatar} nombre=${vista.nombre} /> ${vista.nombre}${grupo ? html` <small class="grupo">${t(`motor.grupo.${grupo}`)}</small>` : ''}</span>
      <span class="cabecera-centro">${centro}</span>
      ${reloj ? html`<${Temporizador} reloj=${reloj} ahora=${net.ahora} tam=${54} />` : html`<span class="tenue">${publico?.sala ?? ''}</span>`}
    </header>`;
}

function Pantalla({ vista, publico, reloj, enviar, salir, cerrada }) {
  if (cerrada) {
    return html`
      <main class="movil centro">
        <p class="luna-pequena">🌙</p>
        <h1>${t('ui.sala.cerrada')}</h1>
        <p class="tenue">${t('ui.sala.cerrada_texto')}</p>
        <button class="btn grande brillo" onClick=${salir}>${t('ui.sala.entrar_otra')}</button>
      </main>`;
  }
  if (!vista) {
    if (publico && publico.fase !== 'sala') {
      return html`<main class="movil centro"><p>${t('ui.sala.empezo_sin_ti')}</p><button class="btn" onClick=${salir}>${t('ui.boton.volver')}</button></main>`;
    }
    return html`<main class="movil centro"><div class="cargando"></div><p class="tenue">${t('ui.sala.conectando')}</p></main>`;
  }
  const clave = `${vista.pantalla}-${vista.paso ?? ''}`;
  const grupo = publico?.jugadores?.find(j => j.nombre === vista.nombre)?.grupo;
  const etiqueta = tipo => (publico?.dia === 0 && tipo === 'debate' ? t('ui.sala.antes_noche') : ETIQUETA_PASO[tipo] ?? '');
  switch (vista.pantalla) {
    case 'fuera':
      return html`<main class="movil centro"><p>${t('ui.sala.no_estas')}</p><button class="btn" onClick=${salir}>${t('ui.boton.volver_entrar')}</button></main>`;
    case 'sala':
      return html`
        <main class="movil pantalla" key=${clave}>
          <${Cabecera} vista=${vista} publico=${publico} centro=${html`${t('ui.sala.palabra')} <b>${publico?.sala}</b>`} />
          <${Asiento} vista=${vista} enviar=${enviar} />
          <section class="vidrio sala-espera aparecer">
            <p class="sala-espera-icono">🃏</p>
            <h2>${t('ui.sala.dentro')}</h2>
            <p class="tenue">${t('ui.sala.dentro_1')}<b>${t('ui.sala.dentro_carta')}</b>${t('ui.sala.dentro_2')}</p>
          </section>
          <p class="tenue centrado esperando">${t('ui.sala.esperando')}</p>
          <${MiRol} rol=${vista.rol} mazo=${vista.mazo} resumen=${vista.resumenMazo} />
        </main>`;
    case 'noche':
      return html`
        <main class="movil noche-pantalla" key=${clave}>
          <p class="luna-pequena">🌙</p>
          <h1>${t('ui.noche.titulo')}</h1>
          <p>${t('ui.noche.ojos')}</p>
          <${Temporizador} reloj=${reloj} ahora=${net.ahora} tam=${80} clase="tenue-reloj" />
        </main>`;
    case 'accion':
      return html`
        <main class=${`movil pantalla ${publico?.fase === 'noche' ? 'accion-noche' : ''}`} key=${clave}>
          <${Cabecera} vista=${vista} publico=${publico} reloj=${reloj} centro=${etiqueta(vista.tipo)} grupo=${grupo} />
          <${Accion} vista=${vista} enviar=${enviar} />
          ${vista.tipo === 'debate' && html`<${Aldea} jugadores=${publico?.jugadores} orden=${publico?.orden} />`}
          ${vista.tipo === 'debate' && html`<${Cementerio} muertos=${publico?.muertos} />`}
          <${MiRol} rol=${vista.rol} mazo=${vista.mazo} resumen=${vista.resumenMazo} discreto />
        </main>`;
    case 'dia':
      return html`
        <main class="movil pantalla" key=${clave}>
          <${Cabecera} vista=${vista} publico=${publico} reloj=${reloj} centro=${t('ui.dia.cabecera', { dia: publico?.dia, etiqueta: etiqueta(vista.tipo) })} grupo=${grupo} />
          ${(vista.tipo === 'votacion' || vista.tipo === 'alguacil') && html`<p class="centrado tenue">${t('ui.dia.no_votas')}</p>`}
          ${publico?.votacion && html`<${Votacion} votacion=${publico.votacion} />`}
          ${publico?.votantesProximos && html`<p class="aviso-suave">${t('ui.dia.proxima', { nombres: publico.votantesProximos.join(', ') })}</p>`}
          <${CartasComediante} cartas=${publico?.cartasComediante} />
          <${Aldea} jugadores=${publico?.jugadores} orden=${publico?.orden} />
          <${Cementerio} muertos=${publico?.muertos} />
          <${MiRol} rol=${vista.rol} mazo=${vista.mazo} resumen=${vista.resumenMazo} />
        </main>`;
    case 'muerto':
      return html`
        <main class="movil pantalla muerto-pantalla" key=${clave}>
          <section class="centro-muerto">
            ${vista.rol && html`<${Carta} rol=${vista.rol.id} clase="media fantasma" />`}
            <h1>${t('ui.muerto.titulo')}</h1>
            <p class="tenue">${t('ui.muerto.texto')}</p>
          </section>
          ${vista.reparto && html`<h2 class="centrado">${t('ui.muerto.reparto')}</h2><${Reparto} reparto=${vista.reparto.map(r => ({ ...r, bando: '' }))} />`}
          ${publico?.votacion && html`<${Votacion} votacion=${publico.votacion} />`}
          <${Aldea} jugadores=${publico?.jugadores} orden=${publico?.orden} />
          <${Cementerio} muertos=${publico?.muertos} />
        </main>`;
    case 'fin':
      return html`
        <main class="movil pantalla" key=${clave}>
          <section class=${`final ganador-${vista.ganador}`}>
            <h1 class="titulo-final">${GANADOR[vista.ganador]}</h1>
            <${Reparto} reparto=${publico?.reparto} />
            <${Cronica} cronica=${publico?.cronica} />
          </section>
        </main>`;
    default:
      return html`<main class="movil centro"><p class="tenue">…</p></main>`;
  }
}

function Juego({ sala, yo, salir, alFase }) {
  const [vista, setVista] = useState(null);
  const [publico, setPublico] = useState(null);
  const [reloj, setReloj] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [vistoPublico, setVistoPublico] = useState(false);
  useEffect(() => { if (publico) setVistoPublico(true); }, [!!publico]);
  // Si la sala existía y deja de existir, el anfitrión la ha descartado.
  const cerrada = vistoPublico && publico === null;
  useEffect(() => {
    const quitar = [
      net.escucharVista(sala, yo.id, setVista),
      net.escucharPublico(sala, setPublico),
      net.escucharReloj(sala, setReloj),
      net.escucharAviso(sala, yo.id, setAviso),
    ];
    net.marcarPresencia?.(sala, yo.id);
    return () => quitar.forEach(q => q());
  }, [sala, yo.id]);
  // Si recargamos en la sala y la tablet aún no nos tiene, volvemos a unirnos.
  useEffect(() => {
    if (publico?.fase !== 'sala' || vista) return;
    const t = setTimeout(() => net.enviarAccion(sala, { type: 'unirse', id: yo.id, nombre: yo.nombre }), 3000);
    return () => clearTimeout(t);
  }, [publico?.fase, !!vista]);
  // Fondo de noche o de día (y tensión en la votación) compartido con la tablet.
  useEffect(() => {
    document.body.classList.toggle('noche', publico?.fase === 'noche');
    alFase?.({ fase: publico?.fase, tipo: publico?.paso?.tipo });
  }, [publico?.fase, publico?.paso?.tipo]);
  // De día, un aviso táctil cuando te toca actuar (nunca de noche).
  useEffect(() => {
    if (vista?.pantalla === 'accion' && publico?.fase === 'dia' && vista.tipo !== 'debate') vibrar([60, 40, 60]);
  }, [vista?.pantalla === 'accion' && vista?.paso]);
  // Los textos de la partida los genera la tablet en su idioma: el celular usa el mismo.
  useEffect(() => { if (publico?.idioma && publico.idioma !== idiomaActual()) usarIdioma(publico.idioma); }, [publico?.idioma]);
  const enviar = accion => net.enviarAccion(sala, { ...accion, id: yo.id });
  return html`
    <${Aviso} aviso=${aviso} />
    <${Alertas} sala=${sala} yo=${yo} alertas=${vista?.alertas} />
    <${Pantalla} vista=${vista} publico=${publico} reloj=${reloj} enviar=${enviar} salir=${salir} cerrada=${cerrada} />`;
}

function App() {
  const [sesion, setSesion] = useState(() => {
    const yo = salaInicial && leerYo(salaInicial);
    return yo ? { sala: salaInicial, yo } : null;
  });
  const [conectado, setConectado] = useState(true);
  const [fase, setFase] = useState({ fase: 'sala', tipo: null });
  const [, repintar] = useState(0);
  useEffect(() => alCambiarIdioma(() => repintar(n => n + 1)), []); // al cambiar de idioma se vuelve a pintar todo
  useEffect(() => net.onConexion(setConectado), []);
  useEffect(() => { if (sesion) mantenerEncendida(); }, [!!sesion]);
  const salir = () => { localStorage.removeItem(claveYo(sesion.sala)); setSesion(null); };
  const noche = !sesion || fase.fase !== 'dia';
  return html`
    <${Escenario} noche=${noche && fase.fase !== 'fin'} tension=${fase.tipo === 'votacion'} atenuado />
    <${AvisoConexion} conectado=${conectado} />
    ${sesion
      ? html`<${Juego} sala=${sesion.sala} yo=${sesion.yo} salir=${salir} alFase=${setFase} />`
      : html`<${Entrar} alEntrar=${(sala, yo) => setSesion({ sala, yo })} />`}`;
}

await iniciarIdioma();
render(html`<${App} />`, document.getElementById('app'));
