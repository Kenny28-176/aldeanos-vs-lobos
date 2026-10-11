import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadData } from './loadData.js';

const { roles: { roles }, nightOrder, narration } = loadData();

test('roles.json: cada rol tiene lo necesario y los de grupo cuadran', () => {
  for (const [id, r] of Object.entries(roles)) {
    assert.ok(r.nombre && r.bando && Number.isInteger(r.copias) && r.copias >= 1, id);
    assert.ok(['aldea', 'lobos', 'ambiguo', 'solitario'].includes(r.bando), `${id}: bando ${r.bando}`);
    if (r.grupo) assert.ok(r.copias >= 2, `${id}: un rol de grupo necesita varias copias`);
    if (r.requierePueblo) assert.ok(r.nota, `${id}: los roles simplificados llevan una nota`);
  }
  assert.deepEqual(Object.keys(roles).filter(id => roles[id].grupo).sort(), ['dos_hermanas', 'tres_hermanos']);
});

test('hay una imagen para cada rol', () => {
  for (const id of Object.keys(roles)) {
    assert.ok(existsSync(new URL(`../public/img/roles/${id}.webp`, import.meta.url)), `falta public/img/roles/${id}.webp`);
  }
});

test('nightOrder: todos los pasos existen y sus roles también', () => {
  for (const p of [...nightOrder.primeraNoche, ...nightOrder.cadaNoche]) {
    assert.ok(nightOrder.pasos[p], `paso sin definir: ${p}`);
  }
  for (const [p, def] of Object.entries(nightOrder.pasos)) {
    for (const r of def.roles) assert.ok(roles[r], `paso ${p}: rol desconocido ${r}`);
  }
});

test('los roles implementados tienen guía completa', () => {
  for (const [id, r] of Object.entries(roles)) {
    if (!r.implementado) continue;
    for (const campo of ['resumen', 'cuando', 'accion', 'objetivo']) assert.ok(r.guia?.[campo], `${id}.guia.${campo}`);
  }
});

test('los pasos implementados tienen frases de despertar y dormir', () => {
  assert.ok(narration.pasos.lobos.despertar && narration.pasos.lobos.dormir);
});
