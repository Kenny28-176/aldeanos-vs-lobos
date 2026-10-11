// Las páginas informativas existen en cada idioma con la misma estructura (así una traducción no se queda atrás en silencio).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = ruta => readFileSync(new URL(`../public/${ruta}`, import.meta.url), 'utf8');
const cuenta = (texto, etiqueta) => (texto.match(new RegExp(`<${etiqueta}[ >]`, 'g')) ?? []).length;

for (const pagina of ['index.html', 'como-jugar.html', 'acerca.html']) {
  test(`${pagina}: la versión inglesa tiene la misma estructura que la española`, () => {
    const es = leer(pagina);
    const en = leer(`en/${pagina}`);
    assert.match(es, /<html lang="es">/);
    assert.match(en, /<html lang="en">/);
    for (const etiqueta of ['section', 'h1', 'h2', 'ul', 'ol', 'li', 'p', 'a', 'nav', 'b', 'img']) {
      assert.equal(cuenta(en, etiqueta), cuenta(es, etiqueta), `<${etiqueta}>: no coincide el número de elementos`);
    }
    // Cada versión enlaza a la otra, y el JavaScript recuerda la elección (estatica.js lee hreflang).
    assert.ok(es.includes(`href="en/${pagina}" hreflang="en"`), 'la página española no enlaza a la inglesa');
    assert.match(en, /hreflang="es"/);
    assert.ok(!/[¿¡áéíóúñÁÉÍÓÚÑ]/.test(en.replace(/lang="es">Español</, '')), 'la página inglesa contiene letras del español');
  });
}

test('la portada inglesa entra en el celular y en la tablet con el idioma elegido', () => {
  const en = leer('en/index.html');
  assert.ok(en.includes('href="../player.html?lang=en"'));
  assert.ok(en.includes('href="../narrator.html?lang=en"'));
  const es = leer('index.html');
  assert.ok(es.includes('href="player.html?lang=es"'));
  assert.ok(es.includes('href="narrator.html?lang=es"'));
});
