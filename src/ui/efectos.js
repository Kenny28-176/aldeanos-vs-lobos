// Partículas en un canvas a pantalla completa: confeti (celebración), ceniza (tristeza),
// corazones (enamorados). Ligero: se crea al usarlo y se borra al terminar.

const PALETAS = {
  confeti: ['#e3a740', '#f4ead8', '#c8452f', '#7fbf6a', '#8f9cff', '#ffd66b'],
  ceniza: ['#8a8580', '#5d5955', '#b5aea6', '#3f3c39'],
  corazones: ['#ff6b8a', '#ff9eb5', '#e3405f', '#ffd1dc'],
};

export function particulas(tipo = 'confeti', { cantidad = 140, duracion = 4200 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lienzo = document.createElement('canvas');
  lienzo.className = 'lienzo-particulas';
  document.body.appendChild(lienzo);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = (lienzo.width = innerWidth * dpr);
  const H = (lienzo.height = innerHeight * dpr);
  const c = lienzo.getContext('2d');
  const colores = PALETAS[tipo] ?? PALETAS.confeti;
  const cae = tipo !== 'confeti';
  const ps = Array.from({ length: cantidad }, () => ({
    x: cae ? Math.random() * W : W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: cae ? -Math.random() * H * 0.5 : H * 0.55,
    vx: cae ? (Math.random() - 0.5) * 0.6 * dpr : (Math.random() - 0.5) * 16 * dpr,
    vy: cae ? (0.6 + Math.random() * 1.4) * dpr : -(8 + Math.random() * 14) * dpr,
    giro: Math.random() * Math.PI,
    vg: (Math.random() - 0.5) * 0.3,
    tam: (tipo === 'corazones' ? 10 + Math.random() * 10 : 4 + Math.random() * 6) * dpr,
    color: colores[Math.floor(Math.random() * colores.length)],
    fase: Math.random() * Math.PI * 2,
  }));
  const inicio = performance.now();
  function cuadro(ahora) {
    const t = ahora - inicio;
    c.clearRect(0, 0, W, H);
    c.globalAlpha = t > duracion - 800 ? Math.max(0, (duracion - t) / 800) : 1;
    for (const p of ps) {
      if (cae) {
        p.x += p.vx + Math.sin(t / 600 + p.fase) * 0.6 * dpr;
        p.y += p.vy;
      } else {
        p.vy += 0.35 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
      }
      p.giro += p.vg;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.giro);
      c.fillStyle = p.color;
      if (tipo === 'corazones') {
        c.font = `${p.tam}px serif`;
        c.fillText('♥', 0, 0);
      } else if (tipo === 'ceniza') {
        c.beginPath();
        c.ellipse(0, 0, p.tam / 2, p.tam / 3, 0, 0, Math.PI * 2);
        c.fill();
      } else {
        c.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
      }
      c.restore();
    }
    if (t < duracion) requestAnimationFrame(cuadro);
    else lienzo.remove();
  }
  requestAnimationFrame(cuadro);
}
