// Mando a distancia de Chrome headless por el protocolo DevTools (sin dependencias).
// Lo usan las pruebas de punta a punta (tools/e2e.js, tools/e2e-ensayo.js).
// Cada pestaña abierta con abrir() va en un contexto aislado (su propio localStorage),
// como si fuera un dispositivo distinto.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolverServidor } from '../src/net/servidor.js';

// Con EMULADOR=127.0.0.1:9000 las pruebas usan el emulador local de Firebase en lugar de la base de datos real.
export const servidor = resolverServidor(process.env.EMULADOR);

// Idioma del navegador de prueba: español (como siempre) o, con IDIOMA=en, inglés.
const LOCALE = { es: 'es-ES', en: 'en-US' }[process.env.IDIOMA ?? 'es'] ?? process.env.IDIOMA;

export const espera = ms => new Promise(r => setTimeout(r, ms));
export const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// PUERTO_CHROME=9400 cambia el puerto de depuración (para ejecutar dos pruebas a la vez, cada una con su Chrome).
export async function iniciarChrome({ puerto: puertoPorDefecto = 9333, capturas = join(tmpdir(), 'lobos-e2e') } = {}) {
  const puerto = Number(process.env.PUERTO_CHROME) || puertoPorDefecto;
  mkdirSync(capturas, { recursive: true });
  const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${join(tmpdir(), `lobos-e2e-${puerto}`)}`,
    '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--window-size=420,900',
    `--lang=${LOCALE}`, `--accept-lang=${LOCALE}`, // el idioma del navegador (la app lo usa si nadie ha elegido otro)
    ...(process.env.CI ? ['--no-sandbox', '--disable-gpu'] : []),
  ], { stdio: 'ignore' });

  let salida = null;
  chrome.once('exit', codigo => { salida = codigo; });
  chrome.once('error', e => { salida = e.message; });
  let ws;
  // Chrome puede tardar en arrancar (sobre todo la primera vez, en máquinas lentas): se espera hasta 30 s.
  for (let i = 0; i < 100 && !ws && salida === null; i++) {
    try {
      const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${puerto}/json/version`)).json();
      ws = new WebSocket(webSocketDebuggerUrl);
    } catch { await espera(300); }
  }
  if (!ws) throw new Error(salida === null ? `Chrome no abrió el puerto de depuración ${puerto} en 30 s` : `Chrome no arrancó (${salida}). ¿Está bien la ruta en CHROME?`);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let n = 0;
  const pendientes = new Map();
  const errores = [];
  const direcciones = new Map(); // requestId → url, para decir qué petición falló
  ws.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && pendientes.has(m.id)) {
      const { ok, ko } = pendientes.get(m.id);
      pendientes.delete(m.id);
      m.error ? ko(new Error(m.error.message)) : ok(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errores.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errores.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    } else if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) {
      errores.push(`HTTP ${m.params.response.status}: ${m.params.response.url}`); // un archivo que no existe, etc.
    } else if (m.method === 'Network.requestWillBeSent') {
      direcciones.set(m.params.requestId, m.params.request.url);
    } else if (m.method === 'Network.loadingFailed' && !m.params.canceled && m.params.errorText !== 'net::ERR_ABORTED') {
      errores.push(`Fallo de red (${m.params.errorText}): ${direcciones.get(m.params.requestId) ?? m.params.requestId}`);
    }
  });
  const cdp = (method, params = {}, sessionId) => new Promise((ok, ko) => {
    const id = ++n;
    pendientes.set(id, { ok, ko });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

  // almacenamiento: { clave: valor } que se guarda en localStorage antes de que cargue la página (p. ej. los ajustes de pantalla).
  // medios: preferencias del sistema a simular, p. ej. { 'prefers-contrast': 'more', 'prefers-reduced-motion': 'reduce' }.
  async function abrir(nombre, url, { ancho = 400, alto = 860, movil = true, almacenamiento = null, medios = null } = {}) {
    const { browserContextId } = await cdp('Target.createBrowserContext');
    const { targetId } = await cdp('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
    await cdp('Runtime.enable', {}, sessionId);
    await cdp('Page.enable', {}, sessionId);
    await cdp('Network.enable', {}, sessionId);
    await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: movil }, sessionId);
    if (medios) {
      await cdp('Emulation.setEmulatedMedia', { features: Object.entries(medios).map(([name, value]) => ({ name, value })) }, sessionId);
    }
    if (almacenamiento) {
      const fuente = `try { for (const [k, v] of Object.entries(${JSON.stringify(almacenamiento)})) localStorage.setItem(k, v); } catch {}`;
      await cdp('Page.addScriptToEvaluateOnNewDocument', { source: fuente }, sessionId);
    }
    await cdp('Page.navigate', { url: servidor.conservar(url) }, sessionId);
    return {
      nombre,
      async eval(fn, ...args) {
        const r = await cdp('Runtime.evaluate', {
          expression: `(${fn})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true,
        }, sessionId);
        if (r.exceptionDetails) throw new Error(`${nombre}: ${r.exceptionDetails.exception?.description}`);
        return r.result.value;
      },
      texto() { return this.eval(() => document.body.textContent); },
      async esperarTexto(t, ms = 30000) {
        const fin = Date.now() + ms;
        while (Date.now() < fin) {
          if ((await this.texto().catch(() => '')).includes(t)) return;
          await espera(250);
        }
        const html = await this.eval(() => document.body.innerHTML.slice(0, 1500)).catch(e => String(e));
        throw new Error(`${nombre}: no apareció "${t}". Pantalla:\n${await this.texto()}\nHTML:\n${html}`);
      },
      // Pulsa el primer botón (o enlace) cuyo texto contiene `t`. Con `dentroDe`, t = [textoDelBloque, textoDelBotón].
      async click(t, dentroDe, ms = 8000) {
        const fin = Date.now() + ms;
        let ok = false;
        while (!ok && Date.now() < fin) {
          ok = await this.eval((t, sel) => {
            const raiz = sel ? [...document.querySelectorAll(sel)].find(e => e.innerText.includes(t[0])) : document;
            const objetivo = sel ? t[1] : t;
            const b = [...(raiz ?? document).querySelectorAll('button,a')].find(e => !e.disabled && e.textContent.trim().includes(objetivo));
            if (b) b.click();
            return !!b;
          }, t, dentroDe ?? null);
          if (!ok) await espera(250);
        }
        if (!ok) throw new Error(`${nombre}: no hay botón "${t}"`);
        await espera(150);
      },
      async escribir(indice, valor) {
        await this.eval((i, v) => {
          const el = document.querySelectorAll('input')[i];
          el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, indice, valor);
      },
      async esperarSelector(sel, ms = 30000, cuantos = 1) {
        const fin = Date.now() + ms;
        while (Date.now() < fin) {
          if ((await this.eval(s => document.querySelectorAll(s).length, sel).catch(() => 0)) >= cuantos) return;
          await espera(150);
        }
        throw new Error(`${nombre}: no apareció ${cuantos}× "${sel}"`);
      },
      async enviarForm(indice = 0) {
        await this.eval(i => document.querySelectorAll('form')[i].requestSubmit(), indice);
        await espera(300);
      },
      // Píxeles de más que tiene la página a lo ancho (0 = no hay desplazamiento horizontal).
      desborde() { return this.eval(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); },
      async tecla(key) {
        const codigos = { Escape: 27, Enter: 13, Tab: 9 };
        for (const type of ['keyDown', 'keyUp']) {
          const texto = type === 'keyDown' && key === 'Enter' ? String.fromCharCode(13) : undefined; // sin «text» Chrome no activa el botón
          await cdp('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: codigos[key] ?? 0, text: texto, unmodifiedText: texto }, sessionId);
        }
        await espera(150);
      },
      async captura(archivo) {
        const { data } = await cdp('Page.captureScreenshot', { format: 'png' }, sessionId);
        writeFileSync(join(capturas, archivo), Buffer.from(data, 'base64'));
      },
    };
  }

  // Cierra la conexión y el navegador. Los scripts fijan process.exitCode y dejan que Node termine solo
  // (llamar a process.exit con los manejadores aún cerrándose provoca una aserción de libuv en Windows).
  return { abrir, errores, capturas, cerrar: () => { try { ws.close(); } catch { /* ya cerrada */ } chrome.kill(); } };
}

// Borra una sala de prueba (ojo: sin EMULADOR, la base de datos es la de verdad).
export async function borrarSala(sala) {
  if (!sala) return;
  await fetch(servidor.urlRest(`/rooms/${sala}`), { method: 'DELETE' }).catch(() => {});
}
