// Accesibilidad: contraste de las paletas (normal y alto) y ajustes de pantalla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OPCIONES, porDefecto, normalizar, leerAjustes, guardarAjustes, aplicarAjustes } from '../src/ui/ajustes.js';

const css = readFileSync(new URL('../public/estilos.css', import.meta.url), 'utf8');

// Variables --nombre: valor; de un bloque como «:root {…}» o «html[data-contraste="alto"] {…}».
function variablesDe(selector) {
  const inicio = css.indexOf(`${selector} {`);
  assert.ok(inicio >= 0, `no existe el bloque ${selector}`);
  const bloque = css.slice(inicio, css.indexOf('}', inicio));
  const completo = hex => (hex.length === 4 ? `#${[...hex.slice(1)].map(c => c + c).join('')}` : hex); // #fff → #ffffff
  return Object.fromEntries([...bloque.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)].map(m => [m[1], completo(m[2])]));
}

const luminancia = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};

const BLANCO = '#ffffff';
const normal = { ...variablesDe(':root') };
const alto = { ...normal, ...variablesDe('html[data-contraste="alto"]') };

function comprobar(paleta, nombre, minimos) {
  for (const [texto, fondo, minimo] of minimos) {
    const colorTexto = texto === 'blanco' ? BLANCO : paleta[texto];
    const colorFondo = fondo === 'blanco' ? BLANCO : paleta[fondo];
    const c = contraste(colorTexto, colorFondo);
    assert.ok(c >= minimo, `${nombre}: ${texto} (${colorTexto}) sobre ${fondo} (${colorFondo}) = ${c.toFixed(2)}:1, mínimo ${minimo}:1`);
  }
}

test('paleta normal: el texto se lee bien sobre los fondos (WCAG AA)', () => {
  comprobar(normal, 'normal', [
    ['texto', 'fondo', 7], ['texto', 'panel-solido', 7],
    ['tenue', 'fondo', 4.5], ['tenue', 'panel-solido', 4.5],
    ['oro', 'fondo', 4.5], ['oro', 'panel-solido', 4.5], ['oro-claro', 'panel-solido', 4.5],
    ['ok', 'panel-solido', 4.5], ['pendiente', 'panel-solido', 4.5], ['luna', 'panel-solido', 4.5],
    ['sangre-clara', 'fondo', 4.5], ['sangre-clara', 'panel-solido', 4.5],
    // Botones rojos: texto blanco sobre las dos puntas del degradado.
    ['blanco', 'sangre-boton', 4.5], ['blanco', 'sangre', 4.5],
  ]);
});

test('contraste alto: blanco sobre negro y acentos muy legibles (WCAG AAA)', () => {
  assert.equal(alto.fondo, '#000000');
  comprobar(alto, 'alto', [
    ['texto', 'fondo', 15], ['tenue', 'fondo', 15],
    ['oro', 'fondo', 7], ['oro-claro', 'fondo', 7], ['ok', 'fondo', 7], ['pendiente', 'fondo', 7],
    ['sangre-clara', 'fondo', 7],
    ['blanco', 'sangre-boton', 4.5], ['blanco', 'sangre', 4.5],
  ]);
});

test('hay tamaños de texto y el CSS los aplica', () => {
  assert.deepEqual(OPCIONES.texto, ['normal', 'grande', 'enorme']);
  assert.match(css, /html\[data-texto="grande"\]\s*\{\s*font-size/);
  assert.match(css, /html\[data-texto="enorme"\]\s*\{\s*font-size/);
});

test('los ajustes por defecto respetan lo que pide el sistema', () => {
  const consulta = activas => q => ({ matches: activas.includes(q) });
  assert.deepEqual(porDefecto(consulta([])), { texto: 'normal', contraste: 'normal', movimiento: 'normal' });
  assert.equal(porDefecto(consulta(['(prefers-contrast: more)'])).contraste, 'alto');
  assert.equal(porDefecto(consulta(['(prefers-reduced-motion: reduce)'])).movimiento, 'reducido');
  assert.deepEqual(porDefecto(undefined), { texto: 'normal', contraste: 'normal', movimiento: 'normal' });
});

test('lo guardado se valida: valores raros se ignoran y lo que falta se completa', () => {
  const base = { texto: 'normal', contraste: 'normal', movimiento: 'normal' };
  assert.deepEqual(normalizar({ texto: 'enorme', contraste: 'rosa', otra: 1 }, base), { texto: 'enorme', contraste: 'normal', movimiento: 'normal' });
  assert.deepEqual(normalizar(null, base), base);
  assert.deepEqual(normalizar('basura', base), base);
  assert.deepEqual(normalizar({ movimiento: 'reducido' }, { ...base, texto: 'grande' }), { texto: 'grande', contraste: 'normal', movimiento: 'reducido' });
});

test('guardar, leer y aplicar los ajustes', () => {
  const guardado = {};
  const previo = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: k => guardado[k] ?? null, setItem: (k, v) => { guardado[k] = v; } },
  });
  try {
    assert.equal(leerAjustes().texto, 'normal');
    const raiz = { dataset: {} };
    const aplicados = guardarAjustes({ texto: 'grande', contraste: 'alto', movimiento: 'reducido' });
    assert.deepEqual(aplicados, { texto: 'grande', contraste: 'alto', movimiento: 'reducido' });
    assert.deepEqual(leerAjustes(), aplicados);
    aplicarAjustes(aplicados, raiz);
    assert.deepEqual(raiz.dataset, aplicados);
    guardado['lobos:pantalla'] = '{no es json';
    assert.equal(leerAjustes().texto, 'normal', 'un valor corrupto no rompe nada');
  } finally {
    if (previo) Object.defineProperty(globalThis, 'localStorage', previo); else delete globalThis.localStorage;
  }
});
