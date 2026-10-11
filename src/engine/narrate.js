// Convierte eventos del motor en frases para la voz y la pantalla de la tablet.
// `elegir` decide entre variantes de una frase (por defecto al azar; en pruebas, la primera).

const get = (obj, ruta) => ruta.split('.').reduce((o, k) => o?.[k], obj);

function plantilla(frases, clave, vars, elegir) {
  let t = get(frases, clave);
  if (Array.isArray(t)) t = elegir(t);
  if (typeof t !== 'string') return null;
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// De noche no se dice cómo murió nadie (no se delata a la Alquimista).
const CAUSA_NARRADA = { devorado: 'noche', envenenado: 'noche' };

function categoriaReaccion(ev) {
  if (ev.bando === 'lobos') return 'lobo';
  if (ev.bando === 'aldea') return ev.rol === 'aldeano' ? 'aldea' : 'aldeaPoder';
  return 'otro';
}

// Devuelve [{ texto, tipo, evento }], donde tipo = 'normal' | 'celebracion' | 'tristeza' |
// 'victoria' y evento es el índice del evento que la originó (para sincronizar efectos).
export function narrate(ctx, frases, eventos, elegir = l => l[Math.floor(Math.random() * l.length)]) {
  const salida = [];
  let evento = 0;
  const decir = (clave, vars = {}, tipo = 'normal') => {
    const t = plantilla(frases, clave, vars, elegir);
    if (t) salida.push({ texto: t, tipo, evento });
  };
  for (const [i, ev] of eventos.entries()) {
    evento = i;
    if (ev.tipo === 'narrar') decir(ev.clave, ev.vars);
    else if (ev.tipo === 'muerte') {
      decir(`muerte.${CAUSA_NARRADA[ev.causa] ?? ev.causa}`, { nombre: ev.nombre, de: ev.de });
      if (ev.rol) {
        const rol = ctx.roles[ev.rol].nombre;
        decir('revelacion', { nombre: ev.nombre, rol });
        const cat = categoriaReaccion(ev);
        decir(`reaccion.${cat}`, { rol }, cat === 'lobo' ? 'celebracion' : cat === 'otro' ? 'normal' : 'tristeza');
      } else {
        decir('revelacionOculta', { nombre: ev.nombre });
      }
    } else if (ev.tipo === 'votos') {
      if (Object.keys(ev.votos).length) decir('votosRevelados');
    } else if (ev.tipo === 'victoria') {
      decir(`victoria.${ev.ganador}`, {}, 'victoria');
    }
  }
  return salida;
}
