// Ningún texto visible va escrito en el código de las pantallas: todo sale del diccionario (t, tn). Esta prueba lee
// las plantillas html`…` de src/ui/ y avisa si encuentra palabras sueltas o atributos con texto (title, aria-label…).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const BARRA_INVERSA = 92;
const ACENTUADAS = 'ÁÉÍÓÚÜÑáéíóúüñ';
const TRES_LETRAS = texto => {
  let seguidas = 0;
  for (const c of texto) {
    seguidas = /[A-Za-z]/.test(c) || ACENTUADAS.includes(c) ? seguidas + 1 : 0;
    if (seguidas >= 3) return true;
  }
  return false;
};
const ATRIBUTOS_CON_TEXTO = new Set(['title', 'aria-label', 'placeholder', 'alt', 'label', 'aria-description']);
// Textos fijos que sí pueden ir en el código: rutas y nombres de archivo, no palabras para leer.
const PERMITIDOS = new Set(['public/audio/']);

// Devuelve, de cada plantilla html`…` del código, la lista de sus trozos de texto fijo (entre los huecos ${…}).
export function plantillasHtml(codigo) {
  const plantillas = [];
  let pos = 0;
  const saltarCadena = comilla => {
    pos++;
    while (pos < codigo.length && codigo[pos] !== comilla) pos += codigo.charCodeAt(pos) === BARRA_INVERSA ? 2 : 1;
    pos++;
  };
  const leerPlantilla = esHtml => {
    const trozos = [''];
    while (pos < codigo.length && codigo[pos] !== '`') {
      if (codigo.charCodeAt(pos) === BARRA_INVERSA) { trozos[trozos.length - 1] += codigo.slice(pos, pos + 2); pos += 2; continue; }
      if (codigo[pos] === '$' && codigo[pos + 1] === '{') { pos += 2; leerCodigo(true); pos++; trozos.push(''); continue; }
      trozos[trozos.length - 1] += codigo[pos++];
    }
    pos++;
    if (esHtml) plantillas.push(trozos);
  };
  // Lee código hasta la llave que cierra el hueco ${…} (o hasta el final si `enHueco` es falso).
  const leerCodigo = enHueco => {
    let profundidad = 0;
    while (pos < codigo.length) {
      const c = codigo[pos];
      const d = codigo[pos + 1];
      if (c === '/' && d === '/') { const fin = codigo.indexOf('\n', pos); pos = fin < 0 ? codigo.length : fin; continue; }
      if (c === '/' && d === '*') { pos = codigo.indexOf('*/', pos + 2) + 2; continue; }
      if (c === "'" || c === '"') { saltarCadena(c); continue; }
      if (c === '`') { const esHtml = codigo.slice(Math.max(0, pos - 4), pos) === 'html'; pos++; leerPlantilla(esHtml); continue; }
      if (c === '{') profundidad++;
      if (c === '}') { if (enHueco && profundidad === 0) return; profundidad--; }
      pos++;
    }
  };
  leerCodigo(false);
  return plantillas;
}

// Los textos fijos que ve una persona dentro de una plantilla: palabras entre etiquetas y atributos con texto.
export function textosFijos(trozos) {
  const hallazgos = [];
  let enEtiqueta = false;
  let comilla = null;
  let texto = '';
  let valor = '';
  let palabra = '';
  let ultima = '';
  let nombre = '';
  const cerrarTexto = () => { const t = texto.replaceAll('\u0001', '').trim(); if (TRES_LETRAS(t) && !PERMITIDOS.has(t)) hallazgos.push(t); texto = ''; };
  trozos.forEach((trozo, i) => {
    for (const c of trozo) {
      if (!enEtiqueta) {
        if (c === '<') { cerrarTexto(); enEtiqueta = true; palabra = ''; ultima = ''; } else texto += c;
      } else if (comilla) {
        if (c !== comilla) valor += c;
        else {
          comilla = null;
          const limpio = valor.replaceAll('\u0001', '');
          if (ATRIBUTOS_CON_TEXTO.has(nombre) && TRES_LETRAS(limpio)) hallazgos.push(`${nombre}="${limpio}"`);
        }
      } else if (c === '"' || c === "'") { comilla = c; valor = ''; nombre = ultima; } else if (c === '>') { enEtiqueta = false; } else if (/[A-Za-z-]/.test(c)) palabra += c; else if (palabra) { ultima = palabra; palabra = ''; }
    }
    if (i < trozos.length - 1) { if (comilla) valor += '\u0001'; else if (!enEtiqueta) texto += '\u0001'; }
  });
  cerrarTexto();
  return hallazgos;
}

const BT = String.fromCharCode(96);
test('el lector de plantillas encuentra textos fijos y atributos con texto, también dentro de huecos y plantillas anidadas', () => {
  const codigo = [
    'const a = html', BT, '<p class="tenue">Hola mundo</p><b title="Cerrar" aria-label=${t(\'x\')}>${t(\'y\')}</b>',
    '${ok && html', BT, '<i>Dentro</i><span>⭐</span>', BT, '} de ${n} cosas', BT, ';',
    '// html', BT, '<p>esto es un comentario</p>', BT, '\nconst b = "<p>y esto una cadena</p>";',
  ].join('');
  const plantillas = plantillasHtml(codigo);
  assert.equal(plantillas.length, 2, 'la plantilla de fuera y la anidada; no los comentarios ni las cadenas');
  assert.deepEqual(plantillas.flatMap(textosFijos), ['Dentro', 'Hola mundo', 'title="Cerrar"', 'de  cosas']);
});

test('las pantallas no llevan textos escritos en el código: todo sale del diccionario', () => {
  const carpeta = new URL('../src/ui/', import.meta.url);
  const archivos = readdirSync(carpeta).filter(f => f.endsWith('.js'));
  assert.ok(archivos.includes('narrator.js') && archivos.includes('player.js'), 'no se encontraron las pantallas');
  const mal = [];
  let plantillas = 0;
  for (const archivo of archivos) {
    for (const trozos of plantillasHtml(readFileSync(new URL(archivo, carpeta), 'utf8'))) {
      plantillas++;
      for (const texto of textosFijos(trozos)) mal.push(`${archivo}: «${texto}»`);
    }
  }
  assert.ok(plantillas > 100, `solo se leyeron ${plantillas} plantillas: el lector se ha perdido`);
  assert.deepEqual(mal, [], 'textos fijos en el código: muévelos a src/i18n/es.json y en.json y usa t(\'clave\')');
});
