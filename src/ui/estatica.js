// Páginas informativas (portada, «¿Cómo se juega?», «Acerca de»): pintan el fondo animado del
// pueblo y, si hay un #roles en la página, la lista de roles leída de src/data/roles.json.
// Cada idioma tiene su carpeta de páginas (public/en/…): el idioma es el de <html lang>.
import './ajustes.js'; // aplica el tamaño de texto, el contraste y las animaciones guardados
import './sw-registro.js'; // carga más rápida y resistencia a los cortes de red
import { html, render } from './preact.js';
import { Escenario } from './escena.js';
import { imgRol } from './cartas.js';
import { t, idiomaActual, usarIdioma, recordarIdioma } from '../i18n/idioma.js';
import { mezclarRoles } from '../data/mezclar.js';

await usarIdioma(document.documentElement.lang);
render(html`<${Escenario} noche=${true} atenuado />`, document.getElementById('fondo'));

// Elegir un idioma en estos enlaces lo recuerda para el resto de la web (tablet y celulares).
for (const enlace of document.querySelectorAll('a[hreflang]')) enlace.addEventListener('click', () => recordarIdioma(enlace.hreflang));

const BANDOS = ['aldea', 'lobos', 'ambiguo', 'solitario'];
const leerJson = async ruta => (await fetch(new URL(ruta, import.meta.url))).json();

const contenedor = document.getElementById('roles');
if (contenedor) {
  try {
    const idioma = idiomaActual();
    const { roles } = mezclarRoles(await leerJson('../data/roles.json'), idioma === 'es' ? null : await leerJson(`../data/roles.${idioma}.json`));
    const lista = Object.entries(roles).filter(([, r]) => r.implementado);
    render(html`${BANDOS.map(bando => html`
      <section class="grupo-roles vidrio">
        <h3>${t(`ui.grupo.${bando}.titulo`)}</h3>
        <p class="tenue">${t(`ui.grupo.${bando}.texto`)}</p>
        <ul class="guia-roles">
          ${lista.filter(([, r]) => r.bando === bando).map(([id, r]) => html`
            <li class=${`bando-${r.bando}`}>
              <img src=${imgRol(id)} alt="" loading="lazy" width="64" height="64" />
              <div>
                <b>${r.nombre}${r.copias > 1 ? html` <small class="tenue">${t('ui.estatica.hasta', { n: r.copias })}</small>` : ''}</b>
                ${r.subtitulo ? html`<span class="subtitulo-rol">${r.subtitulo}</span>` : null}
                ${r.nota ? html`<p class="nota-rol">${r.nota}</p>` : null}
                ${r.guia ? html`<p>${r.guia.resumen}</p><p class="tenue"><b>${t('ui.estatica.objetivo')}</b> ${r.guia.objetivo}</p>` : null}
              </div>
            </li>`)}
        </ul>
      </section>`)}`, contenedor);
  } catch {
    contenedor.textContent = t('ui.estatica.sin_roles');
  }
}

// «Acerca de»: versión publicada (la escribe la compilación en version.json; en desarrollo es un archivo genérico).
const version = document.getElementById('version');
if (version) {
  try {
    const v = await leerJson('../../version.json');
    version.textContent = v.commit === 'local'
      ? t('ui.estatica.version_dev')
      : t('ui.estatica.version', { version: v.version, commit: v.commit, fecha: String(v.fecha).slice(0, 10) });
  } catch {
    version.textContent = '';
  }
}
