// Errores de red con un mensaje que se entiende. Es independiente de Firebase para poder probarlo.
export const MENSAJES_SERVIDOR = {
  red: 'No se pudo conectar con el servidor. Revisa tu internet e inténtalo de nuevo. Si a todos os pasa lo mismo, puede que el servidor gratuito esté saturado o sin cuota: probad dentro de un rato.',
  permisos: 'El servidor ha rechazado la petición (permisos). Si alojas tu propia copia, publica en Firebase las reglas de database.rules.json.',
};

export class ErrorServidor extends Error {
  constructor(motivo = 'red') {
    super(MENSAJES_SERVIDOR[motivo] ?? MENSAJES_SERVIDOR.red);
    this.name = 'ErrorServidor';
    this.motivo = motivo;
  }
}

// Espera una operación de red como mucho `ms` milisegundos. Si falla o se agota el tiempo, lanza un ErrorServidor.
export async function conTiempo(operacion, ms = 15000) {
  let temporizador;
  const limite = new Promise((_, rechazar) => { temporizador = setTimeout(() => rechazar(new ErrorServidor('red')), ms); });
  try {
    return await Promise.race([Promise.resolve().then(operacion), limite]);
  } catch (e) {
    if (e instanceof ErrorServidor) throw e;
    const denegado = e?.code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(e?.message ?? '');
    throw new ErrorServidor(denegado ? 'permisos' : 'red');
  } finally {
    clearTimeout(temporizador);
  }
}
