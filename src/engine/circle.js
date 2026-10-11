// Círculo de asientos. Cada jugador responde "¿quién está a tu derecha?" (mirando al centro).
// `order` es la lista de ids recorrida hacia la DERECHA: order[i + 1] está a la derecha de order[i].
// La izquierda de alguien es el anterior en la lista.

// rightOf: { id: idDeSuDerecha }. ids: todos los jugadores.
// Devuelve { ok: true, order } o { ok: false, errores: [{ tipo, ids }] }.
export function buildCircle(rightOf, ids) {
  const errores = [];
  const sinRespuesta = ids.filter(id => !rightOf[id]);
  if (sinRespuesta.length) errores.push({ tipo: 'sin_respuesta', ids: sinRespuesta });

  const aSiMismo = ids.filter(id => rightOf[id] === id);
  if (aSiMismo.length) errores.push({ tipo: 'a_si_mismo', ids: aSiMismo });

  const desconocidos = ids.filter(id => rightOf[id] && !ids.includes(rightOf[id]));
  if (desconocidos.length) errores.push({ tipo: 'desconocido', ids: desconocidos });

  // Dos personas no pueden tener a la misma persona a su derecha.
  const elegidoPor = {};
  for (const id of ids) {
    const r = rightOf[id];
    if (r) (elegidoPor[r] ??= []).push(id);
  }
  for (const [elegido, por] of Object.entries(elegidoPor)) {
    if (por.length > 1) errores.push({ tipo: 'repetido', ids: por, elegido });
  }
  if (errores.length) return { ok: false, errores };

  // Todo es una permutación: comprobamos que sea un único ciclo.
  const order = [ids[0]];
  let actual = rightOf[ids[0]];
  while (actual !== ids[0]) {
    order.push(actual);
    actual = rightOf[actual];
  }
  if (order.length !== ids.length) {
    const fuera = ids.filter(id => !order.includes(id));
    return { ok: false, errores: [{ tipo: 'circulo_partido', ids: fuera }] };
  }
  return { ok: true, order };
}

// Primer jugador vivo en una dirección ('derecha' | 'izquierda') desde `id`,
// que cumpla `pred` (opcional). Salta a los muertos. Devuelve null si no hay.
export function walk(order, players, id, dir, pred = () => true) {
  const n = order.length;
  const paso = dir === 'derecha' ? 1 : -1;
  let i = order.indexOf(id);
  for (let k = 1; k < n; k++) {
    const otro = order[(((i + paso * k) % n) + n) % n];
    if (players[otro].alive && pred(players[otro])) return otro;
  }
  return null;
}

// Vecinos vivos a cada lado (pueden coincidir si quedan 2 vivos).
export function neighbors(order, players, id) {
  return {
    izquierda: walk(order, players, id, 'izquierda'),
    derecha: walk(order, players, id, 'derecha'),
  };
}
