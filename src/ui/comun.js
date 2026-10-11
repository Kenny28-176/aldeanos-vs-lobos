// Piezas de interfaz compartidas por la tablet y los celulares (Preact + htm, sin build).
export { html, render, useState, useEffect, useRef, useMemo, useCallback } from './preact.js';
import { html, useState, useEffect, useRef } from './preact.js';
import { OPCIONES, leerAjustes, guardarAjustes } from './ajustes.js';
import { t, existe } from '../i18n/idioma.js';
import { Avatar, Carta, imgRol } from './cartas.js';

// Textos que dependen del idioma: se leen del diccionario en cada uso (así cambian al cambiar de idioma).
// ETIQUETA_PASO.votacion → t('ui.paso.votacion'); si la clave no existe, devuelve undefined.
const delDiccionario = prefijo => new Proxy({}, {
  get: (_, clave) => (typeof clave === 'string' && existe(`${prefijo}.${clave}`) ? t(`${prefijo}.${clave}`) : undefined),
});
export const ETIQUETA_PASO = delDiccionario('ui.paso');
export const CAUSA = delDiccionario('ui.causa');
export const GANADOR = delDiccionario('ui.ganador');

// Re-renderiza cada `ms` (para temporizadores).
export function useTick(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set(n => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

// Milisegundos que quedan en un reloj { inicio, fin, restante, arrancado }.
export function restante(reloj, ahora) {
  if (!reloj) return { quedan: 0, total: 1, pausado: false };
  const total = Math.max(1, reloj.fin - reloj.inicio);
  const pausado = reloj.restante != null;
  const quedan = reloj.arrancado === false ? total : Math.max(0, pausado ? reloj.restante : reloj.fin - ahora());
  return { quedan, total, pausado };
}

const formato = seg => (seg >= 60 ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}` : `${seg}`);

// Cuenta atrás en anillo, con el reloj del servidor.
export function Temporizador({ reloj, ahora, tam = 120, clase = '' }) {
  useTick(250);
  if (!reloj) return null;
  const { quedan, total, pausado } = restante(reloj, ahora);
  const seg = Math.ceil(quedan / 1000);
  const r = 52;
  const vuelta = 2 * Math.PI * r;
  const frac = Math.min(1, quedan / total);
  const urgente = seg <= 5 && !pausado && reloj.arrancado !== false;
  return html`
    <div class=${`temporizador ${urgente ? 'urgente' : ''} ${pausado ? 'pausado' : ''} ${clase}`} style=${`width:${tam}px;height:${tam}px`}
      role="timer" aria-label=${pausado ? t('ui.temporizador.pausa') : t('ui.temporizador.quedan', { tiempo: formato(seg) })}>
      <svg viewBox="0 0 120 120">
        <circle class="pista" cx="60" cy="60" r=${r} />
        <circle class="progreso" cx="60" cy="60" r=${r} stroke-dasharray=${vuelta} stroke-dashoffset=${vuelta * (1 - frac)} />
      </svg>
      <span class="cifra">${pausado ? '⏸' : formato(seg)}</span>
    </div>`;
}

// Muertos con su carta revelada.
export function Cementerio({ muertos, compacto = false }) {
  if (!muertos?.length) return null;
  return html`
    <ul class=${`cementerio ${compacto ? 'compacto' : ''}`}>
      ${muertos.map(m => html`
        <li class="aparecer">
          <${Carta} rol=${m.rolId} boca=${m.rolId ? 'arriba' : 'abajo'} clase="mini" />
          <div>
            <b>${m.nombre}</b>
            <div class="tenue">${m.rol ?? t('ui.carta_secreta')} · ${CAUSA[m.causa] ?? m.causa}</div>
          </div>
        </li>`)}
    </ul>`;
}

// Resultado de la votación: barras que crecen, quién votó a quién y el veredicto.
export function Votacion({ votacion }) {
  const [crecer, setCrecer] = useState(false);
  useEffect(() => { const t = setTimeout(() => setCrecer(true), 60); return () => clearTimeout(t); }, []);
  if (!votacion) return null;
  const conteo = {};
  for (const v of votacion.votos) conteo[v.a] = (conteo[v.a] ?? 0) + (v.peso ?? 1);
  const orden = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...Object.values(conteo));
  return html`
    <div class="votacion">
      ${orden.map(([nombre, n]) => html`
        <div class=${`voto-fila ${nombre === votacion.linchado ? 'linchado' : ''}`}>
          <${Avatar} nombre=${nombre} />
          <div class="voto-cuerpo">
            <div class="voto-cabecera"><b>${nombre}</b><span class="voto-n">${n}</span></div>
            <div class="barra"><div style=${`width:${crecer ? (100 * n) / max : 0}%`}></div></div>
            <div class="votantes">${votacion.votos.filter(v => v.a === nombre).map(v => html`<span class="chip-mini">${v.de}${v.peso > 1 ? ' ⭐×2' : ''}</span>`)}</div>
          </div>
        </div>`)}
      <p class="veredicto">
        ${votacion.indultado ? t('ui.votacion.indultado', { nombre: votacion.linchado })
          : votacion.motivo === 'chivo' ? t('ui.votacion.chivo', { nombre: votacion.linchado })
          : votacion.linchado ? t('ui.votacion.linchado', { nombre: votacion.linchado })
          : votacion.motivo === 'empate' ? t('ui.votacion.empate') : t('ui.votacion.nadie')}
      </p>
    </div>`;
}

// Reparto final: todas las cartas se dan la vuelta una tras otra.
export function Reparto({ reparto }) {
  if (!reparto) return null;
  return html`
    <ul class="reparto">
      ${reparto.map((r, i) => html`
        <li class=${`${r.vivo ? '' : 'muerto'} bando-${r.bando}`}>
          <${Carta} rol=${r.rolId} voltearAlMontar retraso=${400 + i * 220} clase="media" alt=${r.rol} />
          <b>${r.nombre}</b>
          <small>${r.rol}${r.vivo ? '' : ' ✝'}</small>
        </li>`)}
    </ul>`;
}

// Los jugadores con sus marcas públicas (Alguacil, carta pública, sin voto).
export function Aldea({ jugadores, orden }) {
  if (!jugadores) return null;
  const lista = orden ? orden.map(n => jugadores.find(j => j.nombre === n)).filter(Boolean) : jugadores;
  return html`
    <div class="aldea-fichas">
      ${lista.map(j => html`
        <span class=${`ficha-mini ${j.vivo ? '' : 'muerta'}`}>
          <${Avatar} nombre=${j.nombre} rolId=${j.rolPublicoId ?? null} />
          <span>${j.alguacil ? '⭐ ' : ''}${j.nombre}${j.noVota ? ' 🚫' : ''}${j.grupo ? (j.grupo === 'sol' ? ' ☀️' : ' 🌙') : ''}${j.exSirvienta ? ' 🕯' : ''}</span>
        </span>`)}
    </div>`;
}

// Cartas del Bufón (públicas).
export function CartasComediante({ cartas }) {
  if (!cartas?.length) return null;
  return html`
    <div class="cartas-comediante">
      <p class="tenue">${t('ui.cartas_comediante')}</p>
      <div>${cartas.map(c => html`<img src=${imgRol(c.rol)} alt=${c.nombre} title=${c.nombre} />`)}</div>
    </div>`;
}

// Crónica de la partida (al final se revela todo lo que pasó en secreto).
export function Cronica({ cronica, abierta = false }) {
  const [ver, setVer] = useState(abierta);
  if (!cronica?.length) return null;
  if (!ver) return html`<button class="btn sec" onClick=${() => setVer(true)}>${t('ui.cronica.ver')}</button>`;
  return html`
    <ol class="cronica vidrio">
      ${cronica.map(c => html`<li><span class="tenue">${c.fase === 'noche' ? `🌙 ${c.noche}` : `☀️ ${c.dia}`}</span> ${c.texto}</li>`)}
    </ol>`;
}

// --- Accesibilidad y conexión -------------------------------------------------------------

// Diálogo accesible: el foco entra en él al abrirse, Escape lo cierra y el foco vuelve a donde estaba.
export function useDialogo(ref, cerrar) {
  useEffect(() => {
    const anterior = document.activeElement;
    ref.current?.querySelector('button, [href], input, select, textarea')?.focus();
    const tecla = e => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('keydown', tecla); anterior?.focus?.(); };
  }, []);
}

// Grupo de botones excluyentes (un interruptor de varias posiciones).
export function Segmentado({ etiqueta, valor, opciones, onChange }) {
  return html`
    <div class="segmentado" role="group" aria-label=${etiqueta}>
      <span class="segmentado-etiqueta">${etiqueta}</span>
      <div class="segmentado-botones">
        ${opciones.map(([v, texto]) => html`
          <button type="button" class=${`btn mini ${valor === v ? 'on' : 'sec'}`} aria-pressed=${valor === v} onClick=${() => onChange(v)}>${texto}</button>`)}
      </div>
    </div>`;
}

// Ajustes de pantalla de este dispositivo: tamaño del texto, contraste y animaciones.
export function AjustesPantalla() {
  const [ajustes, setAjustes] = useState(leerAjustes);
  const poner = (clave, valor) => setAjustes(guardarAjustes({ ...ajustes, [clave]: valor }));
  return html`
    <section class="ajustes-pantalla">
      <h2>${t('ui.pantalla.titulo')}</h2>
      ${Object.entries(OPCIONES).map(([clave, valores]) => html`
        <${Segmentado} etiqueta=${t(`ui.ajuste.${clave}`)} valor=${ajustes[clave]} opciones=${valores.map(v => [v, t(`ui.ajuste.${clave}.${v}`)])} onChange=${v => poner(clave, v)} />`)}
    </section>`;
}

// Aviso de conexión: al principio «reconectando…»; si pasa un buen rato sin servidor, explica qué puede ocurrir.
export function AvisoConexion({ conectado, espera = 15000 }) {
  const desde = useRef(null);
  useTick(1000);
  if (conectado) { desde.current = null; return null; }
  desde.current ??= Date.now();
  if (Date.now() - desde.current < espera) return html`<div class="sin-red" role="alert">${t('ui.conexion.reconectando')}</div>`;
  return html`<div class="sin-red grave" role="alert">${t('ui.conexion.caido')}</div>`;
}
