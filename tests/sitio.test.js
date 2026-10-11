// La web publicada: todos los archivos a los que apuntan las páginas y los módulos existen, y no se carga nada de
// servidores externos. Las bibliotecas de public/vendor no se han tocado (coinciden con vendor.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { construirSitio, revisarSitio } from '../tools/construir-sitio.js';
import { comprobar } from '../tools/vendor.js';

test('la web no depende de servidores externos y no hay referencias rotas', () => {
  assert.deepEqual(revisarSitio(), []);
});

test('las bibliotecas de public/vendor coinciden con vendor.json', async () => {
  assert.equal(await comprobar({ red: false }), 0);
});

test('la compilación estampa la versión en el service worker y precarga la carcasa de la app', () => {
  const salida = mkdtempSync(join(tmpdir(), 'lobos-sitio-'));
  try {
    const v = construirSitio(salida);
    const sw = readFileSync(join(salida, 'sw.js'), 'utf8');
    assert.ok(!/'__[A-Z]+__'/.test(sw), 'quedan marcas sin sustituir');
    assert.ok(sw.includes(`const VERSION = '${v.version}-${v.commit}'`));
    const lista = JSON.parse(sw.match(/const PRECARGA = '(.*)';/)[1]);
    for (const esperado of ['index.html', 'public/player.html', 'public/narrator.html', 'public/estilos.css', 'src/ui/player.js',
      'src/net/sala.js', 'public/vendor/firebase/firebase-app.js', 'public/vendor/fuentes/fuentes.css']) {
      assert.ok(lista.includes(esperado), `falta en la precarga: ${esperado}`);
    }
    assert.ok(!lista.some(r => r.startsWith('public/img/roles/') || r.startsWith('public/audio/')), 'no se precargan las imágenes de los roles');
    for (const ruta of lista) assert.ok(existsSync(join(salida, ruta)), `la precarga lista un archivo que no existe: ${ruta}`);
    assert.ok(existsSync(join(salida, 'version.json')));
    for (const sobra of ['tests', 'tools', 'docs', '.github', 'node_modules']) assert.ok(!existsSync(join(salida, sobra)), `no debe publicarse ${sobra}/`);
  } finally {
    rmSync(salida, { recursive: true, force: true });
  }
});
