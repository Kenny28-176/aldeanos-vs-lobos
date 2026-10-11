// Voz del narrador (Web Speech API). Solo la tablet habla.
// - Chrome exige un toque del usuario antes de hablar: llamar a desbloquear() en un click.
// - Chrome corta frases largas: se parte el texto en frases cortas.
// - Si onend no llega (pasa en Android), un temporizador de seguridad libera la cola.
// - Las voces disponibles dependen del dispositivo; la elegida (una por idioma) se guarda en este navegador.
// - Habla en el idioma de la partida: usarIdioma('es' | 'en') cambia el tipo de voz que se busca.

const partir = texto => texto.match(/[^.!?…]+[.!?…]*/g)?.map(f => f.trim()).filter(Boolean) ?? [];
const CLAVE = 'lobos:voz';
// Voz principal que se busca en cada idioma (si no hay ninguna, se usa cualquiera del mismo idioma).
const PRINCIPAL = { es: 'es-ES', en: 'en-US' };

export function crearVoz({ alHablar = () => {}, idioma = 'es' } = {}) {
  let voz = null;
  let lang = idioma;
  let activa = true;
  let ocupada = false;
  let seguro = null;
  const cola = [];
  // Guardado: { voces: { es: nombre, en: nombre }, velocidad, tono }. Antes se guardaba solo { voz } (la española).
  const ajustes = (() => {
    const base = { voces: {}, velocidad: 0.95, tono: 1 };
    try {
      const { voz: antigua, ...guardado } = JSON.parse(localStorage.getItem(CLAVE)) ?? {};
      return { ...base, ...guardado, voces: { ...(antigua ? { es: antigua } : {}), ...guardado.voces } };
    } catch { return base; }
  })();

  const disponible = 'speechSynthesis' in window;
  const todas = () => (disponible ? speechSynthesis.getVoices() : []);
  const principal = () => PRINCIPAL[lang] ?? lang;
  // Android escribe «en_US» y el resto «en-US»: se comparan en minúsculas y con guion.
  const codigo = v => (v.lang ?? '').toLowerCase().replace('_', '-');
  // Solo las voces del idioma de la partida (si no hay ninguna, todas).
  const voces = () => {
    const delIdioma = todas().filter(v => codigo(v).startsWith(lang));
    return delIdioma.length ? delIdioma : todas();
  };

  const elegirVoz = () => {
    const vs = voces();
    const principalMin = principal().toLowerCase();
    voz = vs.find(v => v.name === ajustes.voces[lang])
      ?? vs.find(v => codigo(v) === principalMin && /google/i.test(v.name))
      ?? vs.find(v => codigo(v) === principalMin)
      ?? vs.find(v => codigo(v).startsWith(lang))
      ?? null;
  };
  if (disponible) {
    elegirVoz();
    speechSynthesis.addEventListener?.('voiceschanged', elegirVoz);
  }

  function liberar() {
    clearTimeout(seguro);
    ocupada = false;
    alHablar(null);
    setTimeout(siguiente, 200);
  }

  function siguiente() {
    if (ocupada || !cola.length) return;
    const item = cola.shift();
    // Un efecto en la cola: se ejecuta en su turno y deja una pausa.
    if (typeof item.fn === 'function') {
      ocupada = true;
      try { item.fn(); } catch { /* que un efecto no pare la narración */ }
      seguro = setTimeout(liberar, item.pausa);
      return;
    }
    if (!activa || !disponible) { alHablar(item.texto); seguro = setTimeout(liberar, 600 + item.texto.length * 45); ocupada = true; return; }
    ocupada = true;
    const u = new SpeechSynthesisUtterance(item.texto);
    u.lang = voz?.lang ?? principal();
    if (voz) u.voice = voz;
    u.rate = ajustes.velocidad;
    u.pitch = ajustes.tono;
    u.onstart = () => alHablar(item.texto);
    u.onend = liberar;
    u.onerror = liberar;
    seguro = setTimeout(liberar, 2000 + (item.texto.length * 110) / ajustes.velocidad);
    alHablar(item.texto);
    speechSynthesis.speak(u);
  }

  return {
    decir(texto) {
      cola.push(...partir(texto).map(t => ({ texto: t })));
      siguiente();
    },
    // Encola una función (efecto de sonido, mostrar una carta…) entre frases.
    efecto(fn, pausa = 1300) {
      cola.push({ fn, pausa });
      siguiente();
    },
    hablando: () => ocupada || cola.length > 0,
    desbloquear() {
      if (!disponible) return;
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(' '));
    },
    callar() {
      cola.length = 0;
      if (disponible) speechSynthesis.cancel();
      clearTimeout(seguro);
      ocupada = false;
      alHablar(null);
    },
    // Cambia el idioma en el que habla (las frases que ya están en la cola se dicen como estaban).
    usarIdioma(codigo) {
      lang = codigo;
      elegirVoz();
    },
    // Ajustes: { voz: nombre (la del idioma actual), velocidad: 0.5..1.5, tono: 0.5..1.5 }
    get ajustes() { return { voz: ajustes.voces[lang] ?? null, velocidad: ajustes.velocidad, tono: ajustes.tono }; },
    ajustar({ voz: nombre, ...cambios }) {
      Object.assign(ajustes, cambios);
      if (nombre !== undefined) ajustes.voces = { ...ajustes.voces, [lang]: nombre };
      try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch { /* sin almacenamiento */ }
      elegirVoz();
    },
    probar(frase) {
      if (!disponible || !frase) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(frase);
      if (voz) u.voice = voz;
      u.lang = voz?.lang ?? principal();
      u.rate = ajustes.velocidad;
      u.pitch = ajustes.tono;
      speechSynthesis.speak(u);
    },
    voces: () => voces().map(v => ({ nombre: v.name, idioma: v.lang, local: v.localService })),
    set activa(v) { activa = v; if (!v && disponible) speechSynthesis.cancel(); },
    get activa() { return activa; },
    get nombreVoz() { return voz ? `${voz.name} (${voz.lang})` : null; },
    disponible,
  };
}
