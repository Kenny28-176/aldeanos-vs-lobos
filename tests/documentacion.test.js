// La documentación y los textos hablan de los roles con los nombres de ahora: el glosario sale de los datos, los README
// los nombran todos y ningún texto conserva un nombre retirado (así un renombrado no deja frases a medias).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { tablaDeRoles, INICIO, FIN } from '../tools/glosario-roles.js';

const leer = ruta => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replaceAll(String.fromCharCode(13), '');
const json = ruta => JSON.parse(leer(ruta));
const roles = { es: json('src/data/roles.json').roles, en: json('src/data/roles.en.json').roles };
const sinArticulo = nombre => nombre.replace(/^(El|La|Los|Las|The) /, '');

// Nombres que ya no existen (de antes de renombrar los roles con los de las cartas nuevas).
const RETIRADOS = {
  es: ['Hombre Lobo Común', 'Aldeano Común', 'Infecto', 'Niña Pequeña', 'Cabeza de turco', 'Tonto de la aldea', 'Dos Hermanas', 'Tres Hermanos',
    'Domador de Osos', 'Juez Tartamudo', 'Espada Oxidada', 'espada oxidada', 'Abnegada', 'Sirvienta', 'Abominable', 'Sectario', 'Albino',
    'Pirómano', 'Perro Lobo', 'Comediante', 'Cupido', 'Bruja', 'Protector'],
  en: ['Infecting', 'Stuttering', 'Rusty Sword', 'rusty sword', 'Devoted', 'Servant', 'Abominable', 'Albino', 'Pyromaniac', 'Comedian',
    'Little Girl', 'Bear Tamer', 'Village Idiot', 'Cupid', 'Protector', 'Dog-Wolf', 'Two Sisters', 'Three Brothers', 'Big Bad Wolf', 'Town Guard'],
};

const planos = (valor, ruta = '') => {
  if (typeof valor === 'string') return [[ruta, valor]];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => planos(v, `${ruta}[${i}]`));
  return Object.entries(valor ?? {}).flatMap(([k, v]) => planos(v, ruta ? `${ruta}.${k}` : k));
};

test('el glosario de docs/DISENO.md coincide con los datos de los roles', () => {
  const texto = leer('docs/DISENO.md');
  const dentro = texto.slice(texto.indexOf(INICIO) + INICIO.length, texto.indexOf(FIN)).trim();
  assert.equal(dentro, tablaDeRoles(), 'ejecuta: node tools/glosario-roles.js --escribir');
});

test('los README nombran todos los roles jugables con su nombre actual', () => {
  const lista = { es: leer('README.md'), en: leer('README.en.md') };
  for (const idioma of ['es', 'en']) {
    for (const [id, r] of Object.entries(roles[idioma])) {
      if (!r.implementado && roles.es[id].implementado === false) continue;
      assert.ok(lista[idioma].includes(sinArticulo(r.nombre)), `README (${idioma}): falta «${r.nombre}» (${id})`);
    }
  }
});

test('ningún texto del juego conserva el nombre de un rol que ya no existe', () => {
  const fuentes = {
    es: [['src/i18n/es.json', json('src/i18n/es.json')], ['src/data/narration.es.json', json('src/data/narration.es.json')]],
    en: [['src/i18n/en.json', json('src/i18n/en.json')], ['src/data/narration.en.json', json('src/data/narration.en.json')]],
  };
  const guias = idioma => Object.entries(roles[idioma]).map(([id, r]) => [`roles ${id}`, { nombre: r.nombre, guia: r.guia, nota: r.nota }]);
  const mal = [];
  for (const idioma of ['es', 'en']) {
    for (const [archivo, datos] of [...fuentes[idioma], ...guias(idioma)]) {
      for (const [ruta, texto] of planos(datos)) {
        for (const viejo of RETIRADOS[idioma]) if (texto.includes(viejo)) mal.push(`${archivo} ${ruta}: «${viejo}» en «${texto.slice(0, 80)}»`);
      }
    }
  }
  assert.deepEqual(mal, []);
});

test('la documentación tampoco usa los nombres retirados (el CHANGELOG, que cuenta el pasado, queda fuera)', () => {
  const archivos = ['README.md', 'README.en.md', 'CONTRIBUTING.md', 'AVISO_LEGAL.md', ...readdirSync(new URL('../docs/', import.meta.url)).filter(f => f.endsWith('.md')).map(f => `docs/${f}`)];
  const mal = [];
  for (const archivo of archivos) {
    const texto = leer(archivo);
    for (const viejo of [...RETIRADOS.es, ...RETIRADOS.en]) if (texto.includes(viejo)) mal.push(`${archivo}: «${viejo}»`);
  }
  assert.deepEqual(mal, []);
});
