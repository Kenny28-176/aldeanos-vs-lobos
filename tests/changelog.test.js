// El registro de cambios: la versión de package.json tiene su sección (la «release» sale de ahí) y las notas se extraen bien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notasDeVersion } from '../tools/notas-version.js';

const leer = ruta => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');

test('notasDeVersion devuelve el texto de una sección y null si no existe', () => {
  const texto = '# Registro\n\n## [Sin publicar]\n- futuro\n\n## [0.2.0] - 2026-01-01\n### Añadido\n- algo\n\n## [0.1.0]\n- inicio\n';
  assert.equal(notasDeVersion(texto, '0.2.0'), '### Añadido\n- algo');
  assert.equal(notasDeVersion(texto, '0.1.0'), '- inicio');
  assert.equal(notasDeVersion(texto, 'Sin publicar'), '- futuro');
  assert.equal(notasDeVersion(texto, '9.9.9'), null);
  assert.equal(notasDeVersion('## [0.2.0]\r\n- con retorno\r\n', '0.2.0'), '- con retorno');
});

test('CHANGELOG.md tiene una sección con contenido para la versión de package.json', () => {
  const { version } = JSON.parse(leer('package.json'));
  const notas = notasDeVersion(leer('CHANGELOG.md'), version);
  assert.ok(notas, `falta «## [${version}]» en CHANGELOG.md`);
  assert.ok(notas.length > 40, 'la sección de la versión está vacía');
});

test('las secciones del registro de cambios van de la más nueva a la más antigua y no se repiten', () => {
  const versiones = [...leer('CHANGELOG.md').matchAll(/^## \[([^\]]+)\]/gm)].map(m => m[1]);
  assert.equal(versiones[0], 'Sin publicar');
  const numeradas = versiones.slice(1);
  assert.equal(new Set(numeradas).size, numeradas.length, 'versiones repetidas');
  const partes = v => v.split('.').map(Number);
  for (let i = 1; i < numeradas.length; i++) {
    const [a, b] = [partes(numeradas[i - 1]), partes(numeradas[i])];
    assert.ok(a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))), `${numeradas[i - 1]} debe ir antes que ${numeradas[i]}`);
  }
});
