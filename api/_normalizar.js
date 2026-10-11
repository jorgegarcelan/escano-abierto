/* Normaliza el escrutinio provisional del Ministerio del Interior (plataforma de Indra, «backend-difu») al formato
   que usa la web en «La noche electoral». Sin dependencias: lo usan la función api/resultados.js y los tests.

   Entrada: la respuesta de
     /backend-difu/scope/data/getScopeDataTopPartidosGanadores/<ámbito nacional>/1/2/1/1/30
   (España con sus hijos de nivel 30, las provincias). Cada cifra viene como {pro, def}: se usa la provisional.
   Salida:
     {estado, actualizado, envio, escrutado, participacion, votantes, validos, blancos, nulos,
      partidos: [{s, n, c, v, p, e}], provincias: {"28": {escrutado, participacion, votantes, partidos}}} */
"use strict";

const valor = x => x == null ? null : typeof x === "object" ? (x.pro ?? x.def ?? null) : x;

function partidos(lista) {
  return (lista || [])
    .map(p => ({s: p.siglas, n: p.nombre || "", c: String(p.codigo ?? ""), v: valor(p.votos) || 0, p: valor(p.porcentaje) || 0, e: valor(p.cargos) || 0}))
    .filter(p => p.s)
    .sort((a, b) => b.e - a.e || b.v - a.v);
}

/* scopeId -> código INE de provincia, a partir del nomenclátor (para cuando los hijos no traen el código). */
function mapaNomenclator(nomenclator) {
  const out = {};
  for (const eleccion of (nomenclator && nomenclator.amb) || []) {
    for (const a of eleccion.ambitos || []) {
      if (a.l === 30 && a.c && a.co) out[a.c] = String(a.co).padStart(2, "0");
    }
  }
  return out;
}

function provincia(hijo, nomenclator) {
  const codigo = String(hijo.codigo ?? "");
  if (/^\d{1,2}$/.test(codigo)) return codigo.padStart(2, "0");
  const id = hijo.id && hijo.id.scopeId;
  return (nomenclator && id && nomenclator[id]) || null;
}

function normalizar(raw, {nomenclator = null} = {}) {
  const scope = raw && raw.scope;
  const e = scope && scope.escrutinio;
  if (!e) {
    // Antes de que empiece el escrutinio el ámbito existe pero no trae resultados.
    return {estado: "sin-escrutinio", actualizado: null, escrutado: 0, partidos: [], provincias: {}};
  }
  const provincias = {};
  for (const hijo of raw.mapa || []) {
    const cod = provincia(hijo, nomenclator);
    const he = hijo.escrutinio;
    if (!cod || !he) continue;
    provincias[cod] = {
      escrutado: valor(he.porcMesasEscrutadas) ?? valor(he.porcCensoNocheEscrutado) ?? valor(he.porcCensoEscrutado) ?? 0,
      participacion: valor(he.participacion),
      votantes: valor(he.votosTotales),
      partidos: partidos(he.partidos),
    };
  }
  return {
    estado: "ok",
    actualizado: e.fecha || null,
    envio: e.envio ?? null,
    escrutado: valor(e.porcMesasEscrutadas) ?? 0,
    censoEscrutado: valor(e.porcCensoEscrutado),
    participacion: valor(e.participacion),
    votantes: valor(e.votosTotales),
    validos: valor(e.votosValidos),
    blancos: valor(e.votosBlancos),
    nulos: valor(e.votosNulos),
    escanos: e.cargos ?? null,
    partidos: partidos(e.partidos),
    provincias,
  };
}

module.exports = {normalizar, mapaNomenclator, valor};
