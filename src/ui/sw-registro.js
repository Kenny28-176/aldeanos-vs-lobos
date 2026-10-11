// Registra el service worker (sw.js, en la raíz de la web): carga más rápida y resistencia a los cortes de red.
// Solo se activa con https (GitHub Pages) o, en pruebas, en localhost añadiendo ?sw a la dirección.
// Con ?sinsw se desactiva y se borra todo lo guardado (por si algo fallara).
const parametros = new URLSearchParams(globalThis.location?.search ?? '');
const local = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname);

async function desactivar() {
  const controlada = !!navigator.serviceWorker.controller;
  for (const registro of await navigator.serviceWorker.getRegistrations()) await registro.unregister();
  for (const nombre of await caches.keys()) if (nombre.startsWith('lobos-')) await caches.delete(nombre);
  // Mientras esta página siga controlada por el service worker viejo, este podría volver a guardar cosas:
  // se recarga una sola vez para que ya no lo use.
  if (controlada && !sessionStorage.getItem('lobos:sinsw')) {
    sessionStorage.setItem('lobos:sinsw', '1');
    location.reload();
  }
}

if ('serviceWorker' in navigator) {
  if (parametros.has('sinsw')) {
    desactivar().catch(() => {});
  } else if (location.protocol === 'https:' || (local && parametros.has('sw'))) {
    navigator.serviceWorker.register(new URL('../../sw.js', import.meta.url)).catch(() => { /* sin service worker no pasa nada */ });
  }
}
