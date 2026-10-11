// Cartas (con su dibujo real), dorso, volteo animado y avatares de jugador.
import { html, useState, useEffect } from './preact.js';

export const imgRol = id => new URL(`../../public/img/roles/${id}.webp`, import.meta.url).href;
export const imgPortada = () => new URL('../../public/img/portada.webp', import.meta.url).href;

// Dorso de las cartas: una luna creciente y estrellas sobre un fondo de rayos (dibujo propio).
export function Dorso() {
  return html`
    <div class="cara dorso">
      <svg viewBox="0 0 100 100" class="emblema" aria-hidden="true">
        <path class="luna-dorso" d="M56.3 18.6 A32 32 0 1 0 78.9 63.8 A26 26 0 1 1 56.3 18.6 Z" />
        <g class="estrellas-dorso">
          <path d="M76 24 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" />
          <path d="M84 48 l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1 z" />
          <path d="M70 76 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 z" />
        </g>
      </svg>
    </div>`;
}

// Carta que puede estar boca abajo (dorso) o boca arriba (dibujo).
// `voltearAlMontar`: aparece boca abajo y se da la vuelta sola (para revelaciones).
export function Carta({ rol, boca = 'arriba', voltearAlMontar = false, retraso = 0, clase = '', alt = '' }) {
  const [arriba, setArriba] = useState(voltearAlMontar ? false : boca === 'arriba');
  useEffect(() => {
    if (!voltearAlMontar) { setArriba(boca === 'arriba'); return; }
    const t = setTimeout(() => setArriba(boca === 'arriba'), 350 + retraso);
    return () => clearTimeout(t);
  }, [boca, voltearAlMontar, retraso]);
  return html`
    <div class=${`carta3d ${arriba && rol ? 'volteada' : ''} ${clase}`} role="img" aria-label=${alt}>
      <div class="interior">
        <${Dorso} />
        <div class="cara frente">${rol && html`<img src=${imgRol(rol)} alt="" loading="lazy" />`}</div>
      </div>
    </div>`;
}

// Color estable por nombre (para los avatares).
export function tonoDe(nombre = '') {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

// Iniciales del nombre (hasta 2), ignorando emojis sueltos como el «🤖» de los bots.
export const iniciales = nombre => {
  const partes = nombre.trim().split(/\s+/).filter(p => /[\p{L}\p{N}]/u.test(p));
  const base = partes.length ? partes : [nombre.trim() || '?'];
  return Array.from(base.map(p => Array.from(p)[0]).join('')).slice(0, 2).join('').toUpperCase();
};

// Avatar redondo: iniciales con color propio, o el dibujo de su carta si ya se conoce.
export function Avatar({ nombre, rolId = null, clase = '' }) {
  return html`
    <span class=${`avatar ${rolId ? 'con-carta' : ''} ${clase}`} style=${`--tono:${tonoDe(nombre)}`}>
      ${rolId ? html`<img src=${imgRol(rolId)} alt="" />` : iniciales(nombre)}
    </span>`;
}
