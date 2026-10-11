// Controlador de la tablet: la autoridad de la partida.
// Recibe acciones (de los celulares o del anfitrión), llama al motor, lleva el reloj de cada
// paso y publica en Firebase solo lo que cambió. `io` se inyecta para poder probarlo sin red:
//   io.escribir(sala, cambios)   io.ahora() → ms en hora del servidor
// También mueve a los bots del modo ensayo (jugadores falsos que deciden solos).
import { decidirBot } from '../engine/bots.js';

// Lo único que un celular puede pedir. El resto (empezar, avanzar…) solo desde la tablet.
const ACCIONES_JUGADOR = new Set(['unirse', 'salir', 'derecha', 'enviar', 'listo', 'poder']);
// Pasos sin decisiones que terminan cuando la voz acaba de hablar.
const AUTO = new Set(['anochecer', 'amanecer', 'resultado', 'ejecucion']);
const PAUSA_TRAS_VOZ = 2500;
// Cuando todos están listos se espera un momento (por si alguien cambia de idea).
const GRACIA_LISTOS = 1500;
// De noche, ningún paso dura menos que esto aunque todos estén listos (discreción).
const MINIMO_NOCHE = 5000;
// Retraso con el que actúa un bot (entre 2 y 6 s, distinto para cada uno y cada paso).
const retrasoBot = (id, paso) => {
  let h = 0;
  for (const c of id + paso) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 2000 + (h % 4000);
};

export function crearControlador({
  engine, sala, io, state = null, reloj = null,
  alNarrar = () => {}, alCambiar = () => {}, hablando = () => false,
}) {
  let s = state ?? engine.newGame({ sala });
  let rel = reloj; // { paso, inicio, fin, restante } — restante ≠ null ⇒ en pausa
  let historial = [];
  const escrito = {};
  let idsPublicados = new Set();
  let listosDesde = null;
  let vozLibreDesde = null;
  const botsHechos = new Set();

  function publicar(forzar = false) {
    const cambios = {};
    const poner = (k, v) => {
      const j = JSON.stringify(v);
      if (forzar || escrito[k] !== j) { escrito[k] = j; cambios[k] = v; }
    };
    poner('state', s);
    // El idioma de la sala es el de la tablet: los celulares lo siguen (ver player.js).
    poner('public', { ...engine.publicView(s), sala, idioma: engine.ctx?.idioma ?? 'es' });
    poner('reloj', rel);
    for (const id of s.ids) poner(`views/${id}`, engine.viewFor(s, id));
    for (const id of idsPublicados) {
      if (!s.ids.includes(id)) { cambios[`views/${id}`] = null; delete escrito[`views/${id}`]; }
    }
    idsPublicados = new Set(s.ids);
    if (Object.keys(cambios).length) io.escribir(sala, cambios);
    alCambiar(s, rel);
  }

  function relojNuevo() {
    if (!s.current) { rel = null; return; }
    if (rel?.paso === s.current.id) return;
    const t = io.ahora();
    // El reloj no arranca hasta que la voz termina de anunciar el paso (ver tick).
    rel = { paso: s.current.id, inicio: t, fin: t + s.current.duracion * 1000, restante: null, arrancado: false };
    listosDesde = null;
    vozLibreDesde = null;
  }

  function aplicar(accion, { deJugador = false } = {}) {
    const r = engine.step(s, accion);
    if (r.error) {
      if (deJugador && accion.id) {
        io.escribir(sala, { [`avisos/${accion.id}`]: { texto: r.error.mensaje, t: io.ahora() } });
      }
      return r.error;
    }
    const cambiaPaso = r.state.current?.id !== s.current?.id || r.state.phase !== s.phase;
    if (cambiaPaso) {
      historial.push({ s, rel });
      if (historial.length > 30) historial.shift();
    }
    s = r.state;
    relojNuevo();
    const frases = engine.narrate(r.events);
    if (frases.length || r.events.length) alNarrar(frases, r.events);
    publicar();
    return null;
  }

  function avanzar() {
    if (s.current) aplicar({ type: 'avanzar', paso: s.current.id });
  }

  // Se llama varias veces por segundo desde la tablet.
  function tick() {
    const c = s.current;
    if (!c || !rel || rel.restante != null) return;
    const t = io.ahora();
    // Nunca se corta a la voz: el paso espera a que termine de hablar.
    if (hablando()) { vozLibreDesde = null; return; }
    vozLibreDesde ??= t;
    if (!rel.arrancado) {
      rel = { ...rel, inicio: t, fin: t + c.duracion * 1000, arrancado: true };
      publicar();
    }
    if (AUTO.has(c.tipo) && t - vozLibreDesde >= PAUSA_TRAS_VOZ && t - rel.inicio >= 3000) return avanzar();
    if (t >= rel.fin) return avanzar();
    moverBots(t);
    const minimo = s.phase === 'noche' ? MINIMO_NOCHE : 0;
    if (engine.puedeAcabar(s) && t - rel.inicio >= minimo) {
      listosDesde ??= t;
      if (t - listosDesde >= GRACIA_LISTOS) return avanzar();
    } else {
      listosDesde = null;
    }
  }

  // Modo ensayo: cada bot actúa una vez por paso, con un pequeño retraso, como una persona.
  function moverBots(t) {
    const c = s.current;
    for (const id of c.actores) {
      if (!s.players[id]?.bot || botsHechos.has(`${c.id}:${id}`)) continue;
      if (t - rel.inicio < retrasoBot(id, c.id)) continue;
      botsHechos.add(`${c.id}:${id}`);
      for (const a of decidirBot(engine.viewFor(s, id))) {
        if (s.current?.id !== c.id) return;
        aplicar({ ...a, id, paso: c.id });
      }
    }
  }

  return {
    get state() { return s; },
    get reloj() { return rel; },
    publicar,
    aplicar,
    tick,
    avanzar,
    // Acción que llega de un celular.
    desdeJugador(accion) {
      if (!accion || !ACCIONES_JUGADOR.has(accion.type)) return;
      const { t, ...limpia } = accion;
      return aplicar(limpia, { deJugador: true });
    },
    pausar() {
      if (!rel || rel.restante != null) return;
      rel = { ...rel, restante: Math.max(0, rel.fin - io.ahora()) };
      publicar();
    },
    reanudar() {
      if (!rel || rel.restante == null) return;
      rel = { ...rel, fin: io.ahora() + rel.restante, restante: null };
      publicar();
    },
    masTiempo(segundos) {
      if (!rel) return;
      if (rel.restante != null) rel = { ...rel, restante: rel.restante + segundos * 1000 };
      else rel = { ...rel, fin: Math.max(rel.fin, io.ahora()) + segundos * 1000 };
      publicar();
    },
    // Vuelve al paso anterior (con su tiempo completo).
    deshacer() {
      const prev = historial.pop();
      if (!prev) return false;
      s = prev.s;
      rel = null;
      relojNuevo();
      publicar();
      return true;
    },
    get puedeDeshacer() { return historial.length > 0; },
    // Añade un bot a la sala (modo ensayo).
    anadirBot(nombreBot) {
      const id = `bot-${Math.random().toString(36).slice(2, 8)}`;
      return aplicar({ type: 'unirse', id, nombre: nombreBot, bot: true });
    },
    get pausado() { return rel?.restante != null; },
  };
}
