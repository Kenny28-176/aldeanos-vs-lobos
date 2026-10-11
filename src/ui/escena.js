// Escenario de fondo, compartido por la tablet y los celulares: el pueblo de la aldea de
// noche (luna, estrellas fugaces, luciérnagas, ojos de lobo en el bosque, murciélagos,
// ventanas encendidas) o de día (sol, nubes, pájaros, tejados de colores, humo de chimeneas).
// Todo es CSS (transformaciones y opacidad) para que vaya fluido incluso en celulares.
import { html } from './preact.js';

// Azar con semilla para que el pueblo sea siempre el mismo.
function azarDe(semilla) {
  let s = semilla;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Campo de estrellas: un único elemento con muchas sombras (barato de pintar).
const ESTRELLAS = (() => {
  const azar = azarDe(7);
  const capa = n => Array.from({ length: n }, () => {
    const x = (azar() * 100).toFixed(2);
    const y = (azar() * 62).toFixed(2);
    const a = (0.35 + azar() * 0.65).toFixed(2);
    return `${x}vw ${y}vh 0 ${azar() < 0.15 ? 1 : 0}px rgba(255,255,240,${a})`;
  }).join(',');
  return [capa(120), capa(50)];
})();

// El pueblo: montañas, bosque, colina, casas (pared, tejado, puerta, ventanas, chimeneas),
// iglesia con reloj, árboles y ojos de lobo escondidos en el bosque.
const PUEBLO = (() => {
  const azar = azarDe(11);
  const montes = 'M0,150 L90,105 L170,140 L260,80 L360,135 L450,95 L560,140 L650,70 L760,130 L860,100 L960,145 L1060,90 L1200,135 L1200,260 L0,260 Z';
  const pinos = [];
  for (let x = -20; x < 1240; x += 16 + azar() * 22) {
    const h = 45 + azar() * 65;
    const b = 200 - azar() * 18;
    pinos.push(`M${x.toFixed(0)},${b.toFixed(0)} L${(x + 13).toFixed(0)},${(b - h).toFixed(0)} L${(x + 26).toFixed(0)},${b.toFixed(0)} Z`);
  }
  const colina = 'M0,215 C160,190 300,205 450,198 C600,190 760,212 900,200 C1020,190 1110,205 1200,198 L1200,260 L0,260 Z';
  const casas = [];
  let x = 18;
  while (x < 1170) {
    if (x > 520 && x < 680) { x = 690; continue; }
    const w = 52 + azar() * 40;
    const h = 34 + azar() * 30;
    const base = 238;
    const tejado = 20 + azar() * 16;
    const ventanas = [];
    const nv = 1 + Math.floor(azar() * 3);
    for (let i = 0; i < nv; i++) {
      ventanas.push({ x: x + 8 + ((w - 22) * (i + 0.5)) / nv, y: base - h + 10 + (azar() < 0.4 ? 14 : 0), retraso: (azar() * 6).toFixed(1) });
    }
    casas.push({
      x, w, h, base, tejado,
      tono: Math.floor(azar() * 4),
      puerta: x + w * (0.25 + azar() * 0.4),
      chimenea: azar() < 0.6 ? { x: x + w * 0.65, y: base - h - tejado * 0.55 } : null,
      ventanas,
    });
    x += w + 14 + azar() * 26;
  }
  const arboles = [];
  for (let i = 0; i < 9; i++) {
    const ax = 40 + i * 135 + azar() * 40;
    if (ax > 540 && ax < 680) continue;
    arboles.push({ x: ax, r: 13 + azar() * 9 });
  }
  const ojos = Array.from({ length: 5 }, (_, i) => ({ x: 70 + i * 240 + azar() * 90, y: 168 + azar() * 22, retraso: (i * 3.7 + azar() * 4).toFixed(1) }));
  return { montes, pinos: pinos.join(' '), colina, casas, arboles, ojos };
})();

const LUCIERNAGAS = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 61) % 100, y: 8 + ((i * 37) % 24), dur: 7 + (i % 5) * 2.3, retraso: (i * 1.3) % 9,
}));

function Pueblo() {
  const p = PUEBLO;
  return html`
    <svg class="pueblo" viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice">
      <path class="montes" d=${p.montes} />
      <path class="bosque" d=${p.pinos} />
      ${p.ojos.map(o => html`
        <g class="ojos" style=${`animation-delay:${o.retraso}s`}>
          <circle cx=${o.x} cy=${o.y} r="2.2" /><circle cx=${o.x + 8} cy=${o.y} r="2.2" />
        </g>`)}
      <path class="colina" d=${p.colina} />
      ${p.casas.map(c => html`
        <g class=${`casa tono${c.tono}`}>
          ${c.chimenea && html`
            <rect class="chimenea" x=${c.chimenea.x} y=${c.chimenea.y - 12} width="8" height="18" />
            <circle class="humo" cx=${c.chimenea.x + 4} cy=${c.chimenea.y - 16} r="5" />
            <circle class="humo h2" cx=${c.chimenea.x + 4} cy=${c.chimenea.y - 16} r="5" />
            <circle class="humo h3" cx=${c.chimenea.x + 4} cy=${c.chimenea.y - 16} r="5" />`}
          <rect class="pared" x=${c.x} y=${c.base - c.h} width=${c.w} height=${c.h} />
          <path class="tejado" d=${`M${c.x - 6},${c.base - c.h} L${c.x + c.w / 2},${c.base - c.h - c.tejado} L${c.x + c.w + 6},${c.base - c.h} Z`} />
          <rect class="puerta" x=${c.puerta} y=${c.base - 17} width="10" height="17" />
          ${c.ventanas.map(v => html`<rect class="ventana" x=${v.x} y=${v.y} width="8" height="9" style=${`animation-delay:${v.retraso}s`} />`)}
        </g>`)}
      <g class="iglesia">
        <rect class="pared" x="560" y="150" width="34" height="88" />
        <path class="tejado" d="M556,150 L577,108 L598,150 Z" />
        <rect class="pared" x="594" y="182" width="66" height="56" />
        <path class="tejado" d="M590,182 L627,158 L664,182 Z" />
        <circle class="reloj" cx="577" cy="165" r="7" />
        <path class="aguja" d="M577,165 L577,160 M577,165 L581,166" />
        <rect class="cruz" x="575.5" y="92" width="3" height="16" />
        <rect class="cruz" x="571" y="97" width="12" height="3" />
        <rect class="ventana alta" x="572" y="190" width="10" height="16" />
        <rect class="ventana alta" x="612" y="196" width="9" height="14" />
        <rect class="ventana alta" x="634" y="196" width="9" height="14" />
        <rect class="puerta" x="620" y="216" width="14" height="22" />
      </g>
      ${p.arboles.map(a => html`
        <g class="arbol">
          <rect class="tronco" x=${a.x - 2.5} y="226" width="5" height="14" />
          <circle class="copa" cx=${a.x} cy=${226 - a.r * 0.6} r=${a.r} />
        </g>`)}
    </svg>`;
}

// Pájaros (de día) y murciélagos (de noche) que cruzan el cielo.
const Ave = ({ clase, estilo }) => html`
  <div class=${`ave ${clase}`} style=${estilo}>
    <svg viewBox="0 0 40 14"><path d="M0,7 Q10,0 20,7 Q30,0 40,7" /></svg>
  </div>`;

export function Escenario({ noche, amaneciendo = false, tension = false, atenuado = false }) {
  return html`
    <div class=${`escenario ${noche ? 'es-noche' : 'es-dia'} ${amaneciendo ? 'amaneciendo' : ''} ${tension ? 'tension' : ''} ${atenuado ? 'atenuado' : ''}`} aria-hidden="true">
      <div class="cielo cielo-dia"></div>
      <div class="cielo cielo-noche"></div>
      <div class="estrellas" style=${`box-shadow:${ESTRELLAS[0]}`}></div>
      <div class="estrellas titilan" style=${`box-shadow:${ESTRELLAS[1]}`}></div>
      <div class="estrella-fugaz"></div>
      <div class="estrella-fugaz f2"></div>
      <div class="sol"><div class="rayos"></div></div>
      <div class="luna"><div class="crater c1"></div><div class="crater c2"></div><div class="crater c3"></div></div>
      <div class="nube n1"></div><div class="nube n2"></div><div class="nube n3"></div>
      <${Ave} clase="pajaro" estilo="top:16vh;animation-delay:2s" />
      <${Ave} clase="pajaro" estilo="top:20vh;animation-delay:3.1s;--escala:.7" />
      <${Ave} clase="pajaro" estilo="top:13vh;animation-delay:14s;--escala:.85" />
      <${Ave} clase="murcielago" estilo="top:24vh;animation-delay:5s" />
      <${Ave} clase="murcielago" estilo="top:30vh;animation-delay:19s;--escala:.75" />
      <div class="velo-dia"></div>
      <${Pueblo} />
      <div class="luciernagas">
        ${LUCIERNAGAS.map(l => html`<span style=${`left:${l.x}%;bottom:${l.y}vh;animation-duration:${l.dur}s,2.3s;animation-delay:${l.retraso}s,${l.retraso}s`}></span>`)}
      </div>
      <div class="niebla f1"></div>
      <div class="niebla f2"></div>
      <div class="vineta-tension"></div>
    </div>`;
}
