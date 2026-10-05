/* La noche electoral: proxy del escrutinio provisional del Ministerio del Interior.

   La web oficial de resultados (Indra) publica JSON en su propio dominio pero sin cabeceras CORS, así que el
   navegador no puede pedirlos directamente. Esta función (Vercel) los pide, los normaliza (api/_normalizar.js) y los
   sirve con caché de 15 segundos en la CDN: haya los lectores que haya, al Ministerio le llega como mucho una
   petición cada 15 segundos.

   Configuración (variables de entorno en Vercel):
     ESCANO_RESULTADOS_URL    origen de la web oficial de resultados, p. ej. https://resultados.<dominio>.es
                              (se conoce unos días antes de la votación; sin ella responde 503 «sin-configurar»)
     ESCANO_RESULTADOS_NIVEL  nivel de los ámbitos hijos (30 = provincias; por defecto)

   GET /api/resultados -> JSON (ver _normalizar.js) */
"use strict";

const {normalizar, mapaNomenclator} = require("./_normalizar");

const NACIONAL = "00000000000000000000000b";
let nomenclator = null;   // se guarda mientras la instancia siga viva

async function pedir(url, base) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: control.signal,
      headers: {"Accept": "application/json", "Referer": base + "/",
                "User-Agent": "Mozilla/5.0 (compatible; EscanoAbierto/1.0; +https://escano-abierto.vercel.app)"},
    });
    if (!r.ok) throw new Error(`${r.status} en ${url.slice(base.length)}`);
    return await r.json();
  } finally {
    clearTimeout(reloj);
  }
}

module.exports = async (req, res) => {
  const base = (process.env.ESCANO_RESULTADOS_URL || "").trim().replace(/\/+$/, "");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!/^https:\/\/[^/]+$/.test(base)) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.statusCode = 503;
    res.end(JSON.stringify({estado: "sin-configurar", motivo: "Aún no se conoce la dirección de los resultados oficiales."}));
    return;
  }
  try {
    const nivel = /^\d+$/.test(process.env.ESCANO_RESULTADOS_NIVEL || "") ? process.env.ESCANO_RESULTADOS_NIVEL : "30";
    const raw = await pedir(`${base}/backend-difu/scope/data/getScopeDataTopPartidosGanadores/${NACIONAL}/1/2/1/1/${nivel}`, base);
    // Si los hijos no traen el código INE, se saca del nomenclátor (una vez por instancia).
    if (!nomenclator && (raw.mapa || []).some(m => !/^\d{1,2}$/.test(String(m.codigo ?? "")))) {
      const config = await pedir(`${base}/backend-difu/web/getConfig`, base).catch(() => ({}));
      const version = config.versionNomenclator ?? config.nomenclator?.version ?? "";
      nomenclator = mapaNomenclator(await pedir(`${base}/backend-difu/nomenclator/getNomenclator${version !== "" ? `?v=${version}` : ""}`, base));
    }
    const datos = normalizar(raw, {nomenclator});
    datos.fuente = "Ministerio del Interior, escrutinio provisional";
    datos.pedido = new Date().toISOString();
    res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=45");
    res.statusCode = 200;
    res.end(JSON.stringify(datos));
  } catch (err) {
    res.setHeader("Cache-Control", "public, s-maxage=5");
    res.statusCode = 502;
    res.end(JSON.stringify({estado: "error", motivo: String(err && err.message || err).slice(0, 200)}));
  }
};
