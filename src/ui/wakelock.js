// Mantiene la pantalla encendida (Wake Lock API). El navegador lo suelta al cambiar de
// pestaña o bloquear, así que se vuelve a pedir al regresar. Requiere HTTPS (o localhost).
export function mantenerEncendida() {
  let lock = null;
  async function pedir() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch { /* p. ej. batería baja: seguimos sin él */ }
  }
  document.addEventListener('visibilitychange', pedir);
  pedir();
  return { activo: () => !!lock && !lock.released, soportado: 'wakeLock' in navigator };
}
