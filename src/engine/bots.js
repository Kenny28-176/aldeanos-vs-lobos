// Cerebro de los bots: decide qué haría un jugador ante su pantalla (su vista).
// Lo usan el simulador de pruebas y el modo ensayo de la tablet (bots en la sala).
// `azar` es una función que devuelve un número en [0, 1).
//
// Devuelve una lista de acciones (sin `id` ni `paso`, que añade quien la llama):
//   [{ type: 'enviar', eleccion }, { type: 'listo' }, { type: 'poder', poder }]

export function decidirBot(vista, azar = Math.random) {
  if (!vista || vista.pantalla !== 'accion') return [];
  const elegir = l => l[Math.floor(azar() * l.length)];
  const acciones = [];
  const enviar = eleccion => acciones.push({ type: 'enviar', eleccion });
  const listo = () => acciones.push({ type: 'listo' });

  switch (vista.accion) {
    case 'elegir': {
      if (vista.poderJuez && !vista.poderJuez.pedido && azar() < 0.15) acciones.push({ type: 'poder', poder: 'segundaVotacion' });
      if (!vista.bloqueado && vista.opciones?.length && vista.eleccion == null) {
        // Los lobos siguen al primero de la manada que ya eligió; algunos dudan.
        const sigue = vista.companeros?.find(c => c.eligio)?.eligio;
        if (sigue && azar() < 0.85) enviar(sigue);
        else if (azar() < 0.9) enviar(elegir(vista.opciones).id);
      }
      if (azar() < 0.85) listo();
      break;
    }
    case 'varios': {
      const ids = vista.opciones.map(o => o.id).sort(() => azar() - 0.5);
      if (vista.n) { if (ids.length >= vista.n) enviar(ids.slice(0, vista.n)); }
      else enviar(ids.slice(0, Math.floor(azar() * (ids.length + 1))));
      listo();
      break;
    }
    case 'bruja': {
      const victima = vista.victimas?.length ? elegir(vista.victimas).id : null;
      enviar({
        curar: vista.pocionVida && victima && azar() < 0.5 ? victima : null,
        veneno: vista.pocionMuerte && azar() < 0.2 ? elegir(vista.opciones).id : null,
      });
      listo();
      break;
    }
    case 'espiar':
      if (!vista.eleccion && azar() < 0.5) enviar('espiar');
      listo();
      break;
    case 'boton':
      if (!vista.eleccion && azar() < 0.4) enviar(vista.boton.valor);
      listo();
      break;
    case 'dos':
      if (!vista.eleccion) enviar(elegir(vista.opciones).valor);
      listo();
      break;
    case 'cartas':
      if (!vista.eleccion && vista.cartas?.length && azar() < 0.6) enviar(elegir(vista.cartas).rol);
      listo();
      break;
    case 'debate':
      if (azar() < 0.8) listo();
      break;
    default: // 'info' y cualquier otra: entendido
      listo();
  }
  return acciones;
}
