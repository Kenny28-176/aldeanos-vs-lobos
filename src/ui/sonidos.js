// Efectos de sonido sintetizados (sin archivos): celebración, tristeza, victoria, noche.
let ctx = null;
const audio = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)());

function nota(frec, inicio, dur, { tipo = 'triangle', vol = 0.25 } = {}) {
  const a = audio();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = tipo;
  o.frequency.value = frec;
  const t = a.currentTime + inicio;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const SONIDOS = {
  celebracion: () => [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.12, 0.35)),
  tristeza: () => [440, 415, 392, 330].forEach((f, i) => nota(f, i * 0.3, 0.6, { tipo: 'sine' })),
  victoria: () => [523, 523, 523, 659, 784, 659, 784].forEach((f, i) => nota(f, i * 0.16, 0.4, { tipo: 'square', vol: 0.12 })),
  noche: () => { nota(110, 0, 2.5, { tipo: 'sine', vol: 0.35 }); nota(165, 0.05, 2.2, { tipo: 'sine', vol: 0.15 }); },
  amanecer: () => [392, 523, 659].forEach((f, i) => nota(f, i * 0.2, 0.8, { tipo: 'sine' })),
};

export function sonar(nombre) {
  try { SONIDOS[nombre]?.(); } catch { /* sin audio: no pasa nada */ }
}

// Llamar en un click para que el navegador permita el audio.
export function desbloquearAudio() {
  try { audio().resume(); } catch { /* sin audio */ }
}
