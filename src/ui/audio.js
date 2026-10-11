// Motor de audio de la tablet: efectos y música generados con Web Audio (sin archivos ni
// licencias). Cualquier sonido se puede sustituir por un MP3 propio: ver public/audio/LEEME.txt.
//
//   iniciarAudio()        en un toque del usuario (el navegador lo exige)
//   sonar('aullido')      efecto
//   musica('noche')       cambia la música con fundido ('noche' | 'dia' | 'tension' | null)
//   tension(0..1)         acelera el latido de la música de tensión
//   agachar(true/false)   baja la música mientras habla el narrador
//   ajustes / guardarAjustes({ musica, efectos })  volúmenes 0..1

let ctx = null;
let master, busMusica, busEfectos, agachador, envioReverb, ruido;
const archivos = {}; // nombre → AudioBuffer (MP3 del usuario)

const CLAVE = 'lobos:audio';
export const ajustes = (() => {
  try { return { musica: 0.45, efectos: 0.85, ...JSON.parse(localStorage.getItem(CLAVE)) }; }
  catch { return { musica: 0.45, efectos: 0.85 }; }
})();

export function guardarAjustes(cambios) {
  Object.assign(ajustes, cambios);
  try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch { /* sin almacenamiento */ }
  if (!ctx) return;
  busMusica.gain.setTargetAtTime(ajustes.musica, ctx.currentTime, 0.1);
  busEfectos.gain.setTargetAtTime(ajustes.efectos, ctx.currentTime, 0.1);
}

export function iniciarAudio() {
  try {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ganancia(1, comp);
    comp.connect(ctx.destination);
    busMusica = ganancia(ajustes.musica, master);
    agachador = ganancia(1, busMusica);
    busEfectos = ganancia(ajustes.efectos, master);
    const reverb = ctx.createConvolver();
    reverb.buffer = impulso(3, 2.5);
    envioReverb = ganancia(0.9, reverb);
    reverb.connect(ganancia(0.5, master));
    ruido = bufferRuido(2);
    cargarArchivos();
  } catch { ctx = null; }
}

// --- Utilidades -----------------------------------------------------------------

function ganancia(valor, destino) {
  const g = ctx.createGain();
  g.gain.value = valor;
  if (destino) g.connect(destino);
  return g;
}

function impulso(segundos, caida) {
  const n = Math.floor(ctx.sampleRate * segundos);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** caida;
  }
  return b;
}

function bufferRuido(segundos) {
  const n = Math.floor(ctx.sampleRate * segundos);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

const midi = n => 440 * 2 ** ((n - 69) / 12);

// Salida con envío a la reverberación.
function salida(destino, reverb = 0.25) {
  const g = ganancia(1, destino);
  if (reverb > 0) g.connect(ganancia(reverb, envioReverb));
  return g;
}

// Nota con envolvente. Devuelve el oscilador (por si se quiere modular la frecuencia).
function nota({ tipo = 'sine', f, t, dur, vol = 0.2, ataque = 0.01, destino, reverb = 0.25, detune = 0 }) {
  const o = ctx.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(salida(destino ?? busEfectos, reverb));
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

// Ráfaga de ruido filtrado.
function rafaga({ t, dur, vol = 0.3, filtro = 'lowpass', f = 1000, f2, q = 1, destino, reverb = 0.2 }) {
  const s = ctx.createBufferSource();
  s.buffer = ruido;
  s.loop = true;
  const fl = ctx.createBiquadFilter();
  fl.type = filtro;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  fl.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(salida(destino ?? busEfectos, reverb));
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}

// Golpe grave (latido, timbal).
function golpe(t, f = 60, vol = 0.7) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f * 2.5, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g).connect(salida(busEfectos, 0.1));
  o.start(t);
  o.stop(t + 0.4);
}

// Aullido de lobo: dos osciladores con formantes, subida, vibrato y caída.
function aullido(t, { base = 360, pico = 610, dur = 3.4, vol = 0.2 } = {}) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.45);
  env.gain.setValueAtTime(vol, t + dur * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass'; f1.frequency.value = 1050; f1.Q.value = 1.8;
  const f2 = ctx.createBiquadFilter();
  f2.type = 'lowpass'; f2.frequency.value = 2400;
  f1.connect(f2).connect(env).connect(salida(busEfectos, 0.7));
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.2;
  const vibG = ganancia(0, null);
  vibG.gain.setValueAtTime(0, t);
  vibG.gain.linearRampToValueAtTime(11, t + 0.9);
  vib.connect(vibG);
  for (const [tipo, det] of [['sawtooth', 0], ['triangle', 9]]) {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.detune.value = det;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(pico, t + 0.7);
    o.frequency.linearRampToValueAtTime(pico * 0.97, t + dur * 0.72);
    o.frequency.exponentialRampToValueAtTime(base * 0.72, t + dur);
    vibG.connect(o.frequency);
    o.connect(f1);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
  vib.start(t);
  vib.stop(t + dur + 0.1);
}

// Campana de iglesia: parciales inarmónicos.
function campana(t, f = 196, vol = 0.22) {
  const parciales = [[0.5, 1, 4.5], [1, 0.8, 3.5], [1.19, 0.6, 2.6], [1.56, 0.5, 2.2], [2, 0.45, 1.8], [2.74, 0.3, 1.2], [3, 0.25, 1], [4.07, 0.15, 0.7]];
  for (const [r, a, d] of parciales) nota({ f: f * r, t, dur: d, vol: vol * a, ataque: 0.004, reverb: 0.5 });
}

function trino(t) {
  const f = 2600 + Math.random() * 1400;
  for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
    const o = nota({ f, t: t + i * 0.09, dur: 0.07, vol: 0.05, ataque: 0.005, reverb: 0.3 });
    o.frequency.exponentialRampToValueAtTime(f * 1.35, t + i * 0.09 + 0.06);
  }
}

function metal(notas, t, { paso = 0.16, dur = 0.5, vol = 0.12 } = {}) {
  notas.forEach((n, i) => {
    const ti = t + i * paso;
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = det;
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.setValueAtTime(300, ti);
      fl.frequency.exponentialRampToValueAtTime(3200, ti + 0.08);
      fl.frequency.exponentialRampToValueAtTime(900, ti + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ti);
      g.gain.linearRampToValueAtTime(vol, ti + 0.03);
      g.gain.setValueAtTime(vol * 0.8, ti + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, ti + dur);
      o.connect(fl).connect(g).connect(salida(busEfectos, 0.35));
      o.start(ti);
      o.stop(ti + dur + 0.05);
    }
  });
}

// Gruñido de oso: ruido grave con trémolo y un zumbido de sierra.
function gruñido(t, dur = 2.2) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.55, t + 0.25);
  env.gain.setValueAtTime(0.5, t + dur * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const trem = ctx.createGain();
  trem.gain.value = 0.6;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 23;
  const lfoG = ganancia(0.4, trem.gain);
  lfo.connect(lfoG);
  const fl = ctx.createBiquadFilter();
  fl.type = 'lowpass';
  fl.frequency.value = 420;
  fl.Q.value = 4;
  trem.connect(fl).connect(env).connect(salida(busEfectos, 0.3));
  const s = ctx.createBufferSource();
  s.buffer = ruido;
  s.loop = true;
  s.connect(trem);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(78, t);
  o.frequency.linearRampToValueAtTime(64, t + dur);
  o.connect(ganancia(0.5, trem));
  for (const n of [s, o, lfo]) { n.start(t); n.stop(t + dur + 0.1); }
}

// Melodía de flauta (el Flautista): sinusoides con vibrato y un soplo de aire.
function flauta(t, notas = [74, 77, 81, 79, 77, 76, 74, 81], paso = 0.22) {
  notas.forEach((n, i) => {
    const ti = t + i * paso;
    const o = nota({ tipo: 'sine', f: midi(n), t: ti, dur: paso * 1.6, vol: 0.12, ataque: 0.04, reverb: 0.45 });
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    vib.connect(ganancia(6, o.frequency));
    vib.start(ti);
    vib.stop(ti + paso * 1.7);
    nota({ tipo: 'triangle', f: midi(n + 12), t: ti, dur: paso, vol: 0.015, ataque: 0.04, reverb: 0.3 });
    rafaga({ t: ti, dur: 0.12, vol: 0.03, filtro: 'bandpass', f: 3000, q: 1, reverb: 0.1 });
  });
}

// Arpa: arpegio punteado que sube.
const arpa = (t, base = 60) => [0, 4, 7, 11, 12, 16, 19, 23, 24].forEach((n, i) =>
  nota({ tipo: 'triangle', f: midi(base + n), t: t + i * 0.07, dur: 1.4, vol: 0.08, ataque: 0.003, reverb: 0.55 }));

// --- Efectos ------------------------------------------------------------------------

const EFECTOS = {
  // Sonidos de los personajes (al llamarlos de noche o cuando actúan).
  oso: t => gruñido(t),
  flauta: t => flauta(t),
  arpa: t => arpa(t),
  cristal: t => { for (let i = 0; i < 7; i++) nota({ f: 1800 + Math.random() * 2600, t: t + i * 0.09, dur: 1.8, vol: 0.035, ataque: 0.02, reverb: 0.7 }); },
  caldero: t => {
    for (let i = 0; i < 14; i++) {
      const ti = t + Math.random() * 1.6;
      const o = nota({ f: 180 + Math.random() * 160, t: ti, dur: 0.12, vol: 0.09, ataque: 0.005, reverb: 0.2 });
      o.frequency.exponentialRampToValueAtTime(700 + Math.random() * 300, ti + 0.1);
    }
    nota({ tipo: 'sawtooth', f: midi(33), t, dur: 2, vol: 0.03, ataque: 0.3, reverb: 0.3 });
  },
  olfato: t => { for (let i = 0; i < 3; i++) rafaga({ t: t + i * 0.16, dur: 0.11, vol: 0.18, filtro: 'bandpass', f: 1500 + i * 500, f2: 2600 + i * 500, q: 2, reverb: 0.1 }); },
  escudo: t => { for (const [r, a, d] of [[1, 1, 1.2], [2.76, 0.5, 0.8], [5.4, 0.25, 0.5]]) nota({ f: 520 * r, t, dur: d, vol: 0.08 * a, ataque: 0.002, reverb: 0.4 }); },
  infeccion: t => {
    for (const det of [-25, 0, 25]) {
      const o = nota({ tipo: 'sawtooth', f: midi(57), t, dur: 2.4, vol: 0.04, ataque: 0.2, reverb: 0.6, detune: det });
      o.frequency.exponentialRampToValueAtTime(midi(45), t + 2.3);
    }
    golpe(t + 0.4, 50, 0.6);
  },
  feroz: t => {
    rafaga({ t, dur: 1.4, vol: 0.4, filtro: 'lowpass', f: 900, f2: 200, q: 3, reverb: 0.4 });
    for (const det of [-30, 30]) {
      const o = nota({ tipo: 'sawtooth', f: 95, t, dur: 1.5, vol: 0.12, ataque: 0.05, reverb: 0.4, detune: det });
      o.frequency.exponentialRampToValueAtTime(55, t + 1.4);
    }
  },
  ladrido: t => {
    for (const ti of [t, t + 0.32]) {
      rafaga({ t: ti, dur: 0.16, vol: 0.35, filtro: 'bandpass', f: 700, f2: 450, q: 3, reverb: 0.2 });
      const o = nota({ tipo: 'sawtooth', f: 420, t: ti, dur: 0.15, vol: 0.07, ataque: 0.005, reverb: 0.2 });
      o.frequency.exponentialRampToValueAtTime(260, ti + 0.14);
    }
  },
  mazo: t => { for (const ti of [t, t + 0.28]) { nota({ f: 320, t: ti, dur: 0.18, vol: 0.4, ataque: 0.001, reverb: 0.3 }); rafaga({ t: ti, dur: 0.05, vol: 0.4, filtro: 'bandpass', f: 1800, q: 1, reverb: 0.2 }); } },
  oxido: t => {
    rafaga({ t, dur: 0.6, vol: 0.3, filtro: 'bandpass', f: 4200, f2: 2200, q: 6, reverb: 0.5 });
    for (const r of [1, 1.47, 2.09, 2.56]) nota({ f: 410 * r, t: t + 0.02, dur: 1.1, vol: 0.05, ataque: 0.002, reverb: 0.5 });
  },
  coro: t => [60, 64, 67, 71, 74].forEach((n, i) => {
    const o = nota({ tipo: 'triangle', f: midi(n + 12), t: t + i * 0.05, dur: 3.2, vol: 0.06, ataque: 0.6, reverb: 0.8 });
    const vib = ctx.createOscillator();
    vib.frequency.value = 5 + i * 0.3;
    vib.connect(ganancia(4, o.frequency));
    vib.start(t);
    vib.stop(t + 3.3);
  }),
  tambores: t => [0, 0.3, 0.45, 0.9, 1.2, 1.35, 1.8].forEach((d, i) => golpe(t + d, i % 3 === 2 ? 80 : 60, 0.7)),
  comedia: t => {
    const o = nota({ tipo: 'sine', f: 400, t, dur: 0.9, vol: 0.14, ataque: 0.01, reverb: 0.2 });
    o.frequency.exponentialRampToValueAtTime(1300, t + 0.4);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.85);
    metal([67, 72], t + 0.95, { paso: 0.14, dur: 0.4, vol: 0.09 });
  },
  hechizo: t => [86, 89, 93, 96, 98, 93].forEach((n, i) => nota({ f: midi(n), t: t + i * 0.11, dur: 1.2, vol: 0.05, ataque: 0.004, reverb: 0.7 })),

  aullido: t => aullido(t),
  manada: t => { aullido(t, { base: 330, pico: 560 }); aullido(t + 0.9, { base: 400, pico: 680, vol: 0.13 }); aullido(t + 1.6, { base: 300, pico: 500, vol: 0.12 }); },
  campana: t => campana(t),
  amanecer: t => { campana(t, 262, 0.16); campana(t + 1.4, 262, 0.13); campana(t + 2.8, 196, 0.15); trino(t + 0.6); trino(t + 2.1); },
  latido: t => { golpe(t, 55, 0.75); golpe(t + 0.27, 48, 0.55); },
  disparo: t => {
    rafaga({ t, dur: 0.5, vol: 0.9, f: 4000, f2: 300, reverb: 0.6 });
    golpe(t, 90, 0.9);
  },
  revelacion: t => {
    golpe(t, 70, 0.9);
    for (const n of [38, 39, 45]) nota({ tipo: 'sawtooth', f: midi(n), t, dur: 2.2, vol: 0.05, ataque: 0.05, reverb: 0.5 });
  },
  celebracion: t => {
    metal([60, 64, 67, 72], t, { paso: 0.11, dur: 0.45 });
    for (let i = 0; i < 8; i++) nota({ f: midi(84 + [0, 4, 7, 12][i % 4]), t: t + 0.45 + i * 0.06, dur: 0.6, vol: 0.05 });
  },
  tristeza: t => {
    [69, 67, 65, 64].forEach((n, i) => nota({ tipo: 'triangle', f: midi(n), t: t + i * 0.42, dur: 1.4, vol: 0.12, ataque: 0.12, reverb: 0.5 }));
    nota({ tipo: 'sine', f: midi(45), t, dur: 2.6, vol: 0.12, ataque: 0.3, reverb: 0.4 });
  },
  redoble: t => {
    for (let i = 0; i < 40; i++) rafaga({ t: t + i * 0.035, dur: 0.05, vol: 0.06 + i * 0.006, filtro: 'bandpass', f: 1800, q: 0.8, reverb: 0.05 });
    rafaga({ t: t + 1.45, dur: 1.4, vol: 0.35, filtro: 'highpass', f: 5000, reverb: 0.3 });
    golpe(t + 1.42, 65, 0.9);
  },
  fanfarria: t => metal([60, 64, 67, 72, 67, 72, 76], t, { paso: 0.17, dur: 0.55, vol: 0.11 }),
  victoriaAldea: t => { metal([60, 64, 67, 72, 76, 79, 84], t, { paso: 0.15, dur: 0.7 }); campana(t + 1.2, 262, 0.15); },
  victoriaLobos: t => { golpe(t, 50, 1); EFECTOS.manada(t + 0.3); },
  victoriaEnamorados: t => [60, 64, 67, 71, 72, 76, 79, 83, 84].forEach((n, i) => nota({ tipo: 'triangle', f: midi(n), t: t + i * 0.12, dur: 1.6, vol: 0.09, reverb: 0.6 })),
  viento: t => rafaga({ t, dur: 4, vol: 0.18, filtro: 'bandpass', f: 400, f2: 1400, q: 3, reverb: 0.3 }),
  indulto: t => {
    const o = nota({ tipo: 'sine', f: 180, t, dur: 0.9, vol: 0.25 });
    o.frequency.exponentialRampToValueAtTime(620, t + 0.25);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.85);
  },
  tic: t => { nota({ f: 1050, t, dur: 0.07, vol: 0.12, ataque: 0.002, reverb: 0 }); nota({ f: 2100, t, dur: 0.04, vol: 0.05, ataque: 0.002, reverb: 0 }); },
  union: t => { nota({ tipo: 'triangle', f: midi(76), t, dur: 0.4, vol: 0.1 }); nota({ tipo: 'triangle', f: midi(83), t: t + 0.09, dur: 0.6, vol: 0.1 }); },
  whoosh: t => rafaga({ t, dur: 0.7, vol: 0.2, filtro: 'bandpass', f: 300, f2: 3500, q: 1.5, reverb: 0.2 }),
  noche: t => { campana(t, 131, 0.14); EFECTOS.aullido(t + 1.2); },
};

export function sonar(nombre) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime + 0.03;
    if (archivos[nombre]) return reproducir(archivos[nombre], busEfectos);
    EFECTOS[nombre]?.(t);
  } catch { /* sin audio: no pasa nada */ }
}

function reproducir(buffer, destino, loop = false) {
  const s = ctx.createBufferSource();
  s.buffer = buffer;
  s.loop = loop;
  s.connect(destino);
  s.start();
  return s;
}

// --- Música generativa -----------------------------------------------------------------

const TEMAS = {
  // Re menor: bordón grave, celesta suelta y grillos.
  noche: { raiz: 50, acorde: [0, 7, 15], escala: [0, 3, 5, 7, 10, 12, 15], corte: 520, cada: [1.4, 3.6], voz: 'celesta', ambiente: 'grillos' },
  // Fa mayor: acorde cálido, arpegio punteado y algún pájaro.
  dia: { raiz: 53, acorde: [0, 7, 16], escala: [0, 2, 4, 7, 9, 12, 14], corte: 900, cada: [0.45, 1.3], voz: 'punteo', ambiente: 'pajaros' },
  // Racimo disonante y latido que se acelera con el reloj.
  tension: { raiz: 50, acorde: [0, 1, 7], escala: null, corte: 420, ambiente: 'latido' },
};

let temaActual = null; // { nombre, gain, nodos, temporizador }
let intensidad = 0;

export function tension(v) { intensidad = Math.max(0, Math.min(1, v)); }

export function agachar(si) {
  if (!ctx) return;
  agachador.gain.setTargetAtTime(si ? 0.32 : 1, ctx.currentTime, si ? 0.12 : 0.6);
}

export function musica(nombre) {
  if (!ctx || temaActual?.nombre === nombre) return;
  const t = ctx.currentTime;
  if (temaActual) {
    const viejo = temaActual;
    viejo.gain.gain.setTargetAtTime(0, t, 0.8);
    clearInterval(viejo.temporizador);
    setTimeout(() => viejo.nodos.forEach(n => { try { n.stop(); } catch { /* ya parado */ } }), 4000);
  }
  temaActual = null;
  if (!nombre) return;
  const gain = ganancia(0, agachador);
  gain.gain.setTargetAtTime(1, t, 1.2);
  const nodos = [];

  const archivo = archivos[`musica-${nombre}`];
  if (archivo) {
    nodos.push(reproducir(archivo, gain, true));
    temaActual = { nombre, gain, nodos, temporizador: null };
    return;
  }

  const tema = TEMAS[nombre];
  // Colchón: dos sierras desafinadas por nota, filtro con respiración lenta.
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = tema.corte;
  filtro.Q.value = 0.7;
  filtro.connect(gain);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoG = ganancia(tema.corte * 0.35, filtro.frequency);
  lfo.connect(lfoG);
  lfo.start();
  nodos.push(lfo);
  const colchon = ganancia(0.05, filtro);
  colchon.connect(ganancia(0.4, envioReverb));
  for (const intervalo of tema.acorde) {
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(tema.raiz - 12 + intervalo);
      o.detune.value = det;
      o.connect(colchon);
      o.start();
      nodos.push(o);
    }
  }

  let siguiente = ctx.currentTime + 1;
  let siguienteAmbiente = ctx.currentTime + 2;
  const temporizador = setInterval(() => {
    const ahora = ctx.currentTime;
    if (tema.escala && ahora + 0.3 > siguiente) {
      const grado = tema.escala[Math.floor(Math.random() * tema.escala.length)];
      const f = midi(tema.raiz + 12 + grado);
      if (tema.voz === 'celesta') {
        nota({ f, t: siguiente, dur: 2.8, vol: 0.06, destino: gain, reverb: 0.7 });
        nota({ f: f * 3, t: siguiente, dur: 0.8, vol: 0.012, destino: gain, reverb: 0.7 });
      } else {
        nota({ tipo: 'triangle', f, t: siguiente, dur: 1.1, vol: 0.07, ataque: 0.004, destino: gain, reverb: 0.35 });
      }
      siguiente += tema.cada[0] + Math.random() * (tema.cada[1] - tema.cada[0]);
    }
    if (ahora + 0.3 > siguienteAmbiente) {
      if (tema.ambiente === 'grillos') {
        for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
          nota({ f: 4300 + Math.random() * 300, t: siguienteAmbiente + i * 0.05, dur: 0.03, vol: 0.012, ataque: 0.004, destino: gain, reverb: 0.2 });
        }
        siguienteAmbiente += 0.6 + Math.random() * 1.6;
      } else if (tema.ambiente === 'pajaros') {
        if (Math.random() < 0.5) trino(siguienteAmbiente);
        siguienteAmbiente += 3 + Math.random() * 5;
      } else if (tema.ambiente === 'latido') {
        golpe(siguienteAmbiente, 55, 0.5);
        golpe(siguienteAmbiente + 0.26, 48, 0.35);
        siguienteAmbiente += 1.15 - 0.65 * intensidad;
      }
    }
  }, 100);
  temaActual = { nombre, gain, nodos, temporizador };
}

// --- Sonidos propios (MP3) ------------------------------------------------------------

async function cargarArchivos() {
  try {
    const base = new URL('../../public/audio/', import.meta.url);
    const lista = await (await fetch(new URL('lista.json', base), { cache: 'no-cache' })).json();
    for (const nombre of lista) {
      try {
        const datos = await (await fetch(new URL(`${nombre}.mp3`, base))).arrayBuffer();
        archivos[nombre] = await ctx.decodeAudioData(datos);
      } catch { /* si falla, se usa el sonido generado */ }
    }
  } catch { /* sin lista: todo generado */ }
}

export const NOMBRES_EFECTOS = Object.keys(EFECTOS);
