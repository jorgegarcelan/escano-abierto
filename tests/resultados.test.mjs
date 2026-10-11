// Tests del proxy de la noche electoral (api/resultados.js y api/_normalizar.js).
//   node --test tests/resultados.test.mjs
// La muestra es la respuesta real de las 22.03 del 23J de 2023 (69,15 % escrutado), recortada.
import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";

const require = createRequire(import.meta.url);
const {normalizar, mapaNomenclator} = require("../api/_normalizar.js");
const handler = require("../api/resultados.js");
const muestra = JSON.parse(readFileSync(new URL("./fixtures/resultados_23j_2203.json", import.meta.url)));

test("normaliza el escrutinio nacional del 23J", () => {
  const d = normalizar(muestra);
  assert.equal(d.estado, "ok");
  assert.equal(d.escrutado, 69.15);
  assert.equal(d.participacion, 69.59);
  assert.equal(d.votantes, 15902806);
  assert.equal(d.escanos, 350);
  assert.deepEqual(d.partidos.slice(0, 2).map(p => [p.s, p.e]), [["PP", 131], ["PSOE", 128]]);
  assert.ok(d.partidos.every((p, i, a) => i === 0 || a[i - 1].e >= p.e));
});

test("cada hijo, con su código de dos cifras", () => {
  const d = normalizar(muestra);
  assert.deepEqual(Object.keys(d.provincias), ["01", "02", "05"]);
  const and = d.provincias["01"];
  assert.equal(and.partidos[0].s, "PP");
  assert.equal(and.partidos[0].e, 24);
  assert.ok(and.escrutado > 0 && and.escrutado <= 100);
});

test("sin código, el nomenclátor da la provincia", () => {
  const sin = structuredClone(muestra);
  sin.mapa.forEach(m => { delete m.codigo; });
  const nomen = {amb: [{ambitos: [{l: 30, c: sin.mapa[0].id.scopeId, co: "28"}, {l: 20, c: "x", co: "01"}]}]};
  const d = normalizar(sin, {nomenclator: mapaNomenclator(nomen)});
  assert.deepEqual(Object.keys(d.provincias), ["28"]);
});

test("antes del escrutinio no hay resultados", () => {
  const d = normalizar({scope: {codigo: "1", escrutinio: null}, mapa: []});
  assert.equal(d.estado, "sin-escrutinio");
  assert.deepEqual(d.partidos, []);
});

function respuesta() {
  const r = {cabeceras: {}, statusCode: 0, cuerpo: ""};
  r.setHeader = (k, v) => { r.cabeceras[k.toLowerCase()] = v; };
  r.end = c => { r.cuerpo = c; };
  return r;
}

test("sin dirección configurada responde 503", async () => {
  delete process.env.ESCANO_RESULTADOS_URL;
  const res = respuesta();
  await handler({}, res);
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.cuerpo).estado, "sin-configurar");
});

test("pide al Ministerio, normaliza y cachea 15 segundos", async () => {
  process.env.ESCANO_RESULTADOS_URL = "https://resultados.ejemplo.es/";
  const pedidas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, op) => { pedidas.push([url, op.headers.Referer]); return {ok: true, json: async () => muestra}; };
  try {
    const res = respuesta();
    await handler({}, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.cabeceras["cache-control"], /s-maxage=15/);
    assert.equal(res.cabeceras["access-control-allow-origin"], "*");
    const d = JSON.parse(res.cuerpo);
    assert.equal(d.partidos[0].s, "PP");
    assert.equal(pedidas[0][0], "https://resultados.ejemplo.es/backend-difu/scope/data/getScopeDataTopPartidosGanadores/00000000000000000000000b/1/2/1/1/30");
    assert.equal(pedidas[0][1], "https://resultados.ejemplo.es/");
  } finally {
    globalThis.fetch = original;
  }
});

test("si el Ministerio falla responde 502 con caché corta", async () => {
  process.env.ESCANO_RESULTADOS_URL = "https://resultados.ejemplo.es";
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ok: false, status: 403});
  try {
    const res = respuesta();
    await handler({}, res);
    assert.equal(res.statusCode, 502);
    assert.match(res.cabeceras["cache-control"], /s-maxage=5/);
    assert.match(JSON.parse(res.cuerpo).motivo, /403/);
  } finally {
    globalThis.fetch = original;
  }
});
