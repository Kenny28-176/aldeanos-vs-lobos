// Herramientas de publicación: la revisión de imágenes (que no se publique arte sin revisar) y la preparación de versiones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tipoReal, dimensiones, cubre, patronesDeCreditos, revisarImagenes } from '../tools/revisar-imagenes.js';
import { problemaDeVersion, ascenderChangelog, ascenderPaquete } from '../tools/preparar-version.js';
import { interpretar, SALA_DE_PRUEBA } from '../tools/comprobar-reglas-publicadas.js';

// --- imágenes de mentira, con solo las cabeceras que las herramientas leen -------------------------------------
const u32 = (n, big) => { const b = Buffer.alloc(4); big ? b.writeUInt32BE(n) : b.writeUInt32LE(n); return b; };
const rellenar = (b, kb = 5) => Buffer.concat([b, Buffer.alloc(Math.max(0, kb * 1024 - b.length))]);
const png = (w, h, kb) => rellenar(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), u32(13, true), Buffer.from('IHDR'), u32(w, true), u32(h, true)]), kb);
const gif = (w, h) => rellenar(Buffer.concat([Buffer.from('GIF89a'), Buffer.from([w & 255, w >> 8, h & 255, h >> 8])]), 1);
const riff = (trozo, resto, kb) => rellenar(Buffer.concat([Buffer.from('RIFF'), u32(0), Buffer.from('WEBP'), Buffer.from(trozo), u32(0), resto]), kb);
const webpLossy = (w, h, kb) => riff('VP8 ', Buffer.concat([Buffer.from([0, 0, 0, 0x9d, 0x01, 0x2a]), Buffer.from([w & 255, w >> 8, h & 255, h >> 8])]), kb);
const webpLossless = (w, h, kb) => riff('VP8L', Buffer.concat([Buffer.from([0x2f]), u32((w - 1) | ((h - 1) << 14))]), kb);
const webpExtendido = (w, h, kb) => riff('VP8X', Buffer.concat([Buffer.alloc(4), Buffer.from([(w - 1) & 255, ((w - 1) >> 8) & 255, (w - 1) >> 16, (h - 1) & 255, ((h - 1) >> 8) & 255, (h - 1) >> 16])]), kb);
const jpg = (w, h, kb) => rellenar(Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF'), Buffer.alloc(10), // APP0
  Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03]), // SOF0
]), kb);

test('tipoReal reconoce la imagen por su contenido, no por su extensión', () => {
  assert.equal(tipoReal(png(10, 10)), 'png');
  assert.equal(tipoReal(jpg(10, 10)), 'jpg');
  assert.equal(tipoReal(webpLossy(10, 10)), 'webp');
  assert.equal(tipoReal(gif(10, 10)), 'gif');
  assert.equal(tipoReal(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), 'svg');
  assert.equal(tipoReal(Buffer.from('hola, esto no es una imagen')), null);
});

test('dimensiones lee el ancho y el alto de PNG, GIF, JPEG y de los tres tipos de WebP', () => {
  assert.deepEqual(dimensiones(png(300, 200)), { ancho: 300, alto: 200 });
  assert.deepEqual(dimensiones(gif(64, 32)), { ancho: 64, alto: 32 });
  assert.deepEqual(dimensiones(jpg(1024, 768)), { ancho: 1024, alto: 768 });
  assert.deepEqual(dimensiones(webpLossy(512, 400)), { ancho: 512, alto: 400 });
  assert.deepEqual(dimensiones(webpLossless(1000, 640)), { ancho: 1000, alto: 640 });
  assert.deepEqual(dimensiones(webpExtendido(2048, 1536)), { ancho: 2048, alto: 1536 });
  assert.equal(dimensiones(Buffer.from('RIFF')), null);
});

test('cubre: un nombre exacto o un patrón con un asterisco dentro de la misma carpeta', () => {
  assert.ok(cubre('icono.svg', 'icono.svg'));
  assert.ok(cubre('roles/*.webp', 'roles/lobo.webp'));
  assert.ok(!cubre('roles/*.webp', 'roles/sub/lobo.webp'));
  assert.ok(!cubre('roles/*.webp', 'roles/lobo.png'));
  assert.ok(!cubre('icono.svg', 'otro/icono.svg'));
});

const CREDITOS = [
  '# Créditos', '', '| Archivos | Autoría | Licencia | Fecha | Notas |', '|---|---|---|---|---|',
  '| `roles/*.webp` | Obra propia | CC0 | 2026-10-10 | Roles |',
  '| `icono.svg`, `icono-192.png` | Generados por el código | MIT | 2026-10-10 | Icono |', '',
].join('\n');

test('patronesDeCreditos saca los nombres de la primera columna de la tabla', () => {
  assert.deepEqual(patronesDeCreditos(CREDITOS), ['roles/*.webp', 'icono.svg', 'icono-192.png']);
});

test('revisarImagenes: lo correcto pasa y cada incumplimiento dice qué falla', () => {
  const buena = { ruta: 'roles/lobo.webp', bytes: webpLossy(512, 512, 60) };
  assert.deepEqual(revisarImagenes([buena], CREDITOS), { problemas: [], generales: [] });

  const disfrazada = { ruta: 'roles/bruja.webp', bytes: jpg(1024, 1024, 1200) };
  const { problemas } = revisarImagenes([disfrazada], CREDITOS);
  assert.equal(problemas.length, 1);
  assert.deepEqual(problemas[0].motivos, ['es JPG pero se llama .webp', 'mide 1024×1024 px (máximo 512)', 'pesa 1200 KB (máximo 120)']);

  const sinCredito = revisarImagenes([{ ruta: 'otras/dibujo.png', bytes: png(100, 100) }], CREDITOS);
  assert.deepEqual(sinCredito.problemas[0].motivos, ['no está anotada en CREDITOS.md']);

  const rota = revisarImagenes([{ ruta: 'roles/rota.webp', bytes: Buffer.from('no soy una imagen') }], CREDITOS);
  assert.ok(rota.problemas[0].motivos.includes('no parece una imagen válida'));

  const conHuecos = revisarImagenes([buena], CREDITOS + '| `x/*.png` | _(completar: autor)_ | _(completar)_ | | |');
  assert.equal(conHuecos.generales.length, 1);
});

// --- preparar una versión --------------------------------------------------------------------------------------
test('problemaDeVersion exige una versión x.y.z mayor que la actual', () => {
  assert.equal(problemaDeVersion('0.1.0', '0.2.0'), null);
  assert.equal(problemaDeVersion('0.9.9', '1.0.0'), null);
  assert.equal(problemaDeVersion('1.2.3', '1.2.4'), null);
  assert.match(problemaDeVersion('0.2.0', '0.2.0'), /no es mayor/);
  assert.match(problemaDeVersion('0.2.0', '0.1.9'), /no es mayor/);
  assert.match(problemaDeVersion('0.2.0', 'v0.3.0'), /no es una versión válida/);
  assert.match(problemaDeVersion('0.2.0', '0.3'), /no es una versión válida/);
});

const CAMBIOS = '# Registro\n\n## [Sin publicar]\n\n### Añadido\n- algo nuevo\n\n## [0.1.0] - 2026-10-09\n- inicio\n';

test('ascenderChangelog convierte «Sin publicar» en la versión nueva y deja una sección vacía', () => {
  const nuevo = ascenderChangelog(CAMBIOS, '0.2.0', '2026-11-01');
  assert.equal(nuevo, '# Registro\n\n## [Sin publicar]\n\n## [0.2.0] - 2026-11-01\n\n### Añadido\n- algo nuevo\n\n## [0.1.0] - 2026-10-09\n- inicio\n');
  assert.throws(() => ascenderChangelog(nuevo, '0.3.0', '2026-11-02'), /vacío/, 'sin cambios nuevos no hay versión que publicar');
  assert.throws(() => ascenderChangelog(CAMBIOS, '0.1.0', '2026-11-01'), /ya tiene sección/);
  assert.throws(() => ascenderChangelog('# Registro\n', '0.2.0', '2026-11-01'), /Sin publicar/);
});

test('ascenderChangelog respeta los finales de línea CRLF de Windows', () => {
  const crlf = CAMBIOS.split('\n').join('\r\n');
  const nuevo = ascenderChangelog(crlf, '0.2.0', '2026-11-01');
  assert.ok(!nuevo.replaceAll('\r\n', '').includes('\n'), 'todas las líneas terminan en CRLF');
  assert.equal(nuevo, ascenderChangelog(CAMBIOS, '0.2.0', '2026-11-01').split('\n').join('\r\n'));
});

test('ascenderPaquete cambia solo la versión', () => {
  const texto = '{\n  "name": "x",\n  "version": "0.1.0",\n  "license": "MIT"\n}\n';
  assert.equal(ascenderPaquete(texto, '0.1.0', '0.2.0'), '{\n  "name": "x",\n  "version": "0.2.0",\n  "license": "MIT"\n}\n');
  assert.throws(() => ascenderPaquete(texto, '9.9.9', '10.0.0'), /No encuentro/);
});

// --- reglas publicadas -----------------------------------------------------------------------------------------
test('interpretar: según lo que acepte la base de datos, qué reglas están publicadas', () => {
  assert.equal(interpretar({ control: true, intruso: false }).estado, 'estrictas');
  assert.equal(interpretar({ control: true, intruso: true }).estado, 'abiertas');
  assert.equal(interpretar({ control: false, intruso: false }).estado, 'inconcluso', 'si ni lo válido se guarda no se puede saber');
  assert.match(interpretar({ control: true, intruso: true }).mensaje, /ALOJAR_TU_COPIA/);
});

test('la sala de prueba de las reglas nunca puede chocar con una partida real', () => {
  const letras = readFileSync(new URL('../src/net/sala.js', import.meta.url), 'utf8').match(/const LETRAS = '([A-Z]+)'/)[1]; // las que usa la app para generar códigos
  assert.match(SALA_DE_PRUEBA, /^[A-Z]{4}$/);
  assert.ok([...SALA_DE_PRUEBA].some(l => !letras.includes(l)), 'la app no genera códigos con estas letras');
});
