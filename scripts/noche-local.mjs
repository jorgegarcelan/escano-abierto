// Prueba local de la noche electoral: sirve site/ y monta /api/resultados con la función de Vercel.
//
//   node scripts/noche-local.mjs                         # proxy contra ESCANO_RESULTADOS_URL (la web oficial)
//   node scripts/noche-local.mjs --muestra               # el «Ministerio» es la respuesta real del 23J (22.03 h)
//   node scripts/noche-local.mjs --puerto 8031
//
// Después abre http://localhost:8031/#elecciones-noche
import http from "node:http";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {extname, join, normalize} from "node:path";
import {fileURLToPath} from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const puerto = Number(args[args.indexOf("--puerto") + 1]) || 8031;
const require = createRequire(import.meta.url);

if (args.includes("--muestra")) {
  // Un «Ministerio» de pega en otro puerto que siempre devuelve la muestra del 23J.
  const muestra = await readFile(join(raiz, "tests/fixtures/resultados_23j_2203.json"));
  const falso = http.createServer((req, res) => { res.setHeader("Content-Type", "application/json"); res.end(muestra); });
  await new Promise(ok => falso.listen(puerto + 1, ok));
  // La función solo acepta https: en local se le deja usar http.
  const original = globalThis.fetch;
  globalThis.fetch = (url, op) => original(String(url).replace(/^https:\/\/localhost/, "http://localhost"), op);
  process.env.ESCANO_RESULTADOS_URL = `https://localhost:${puerto + 1}`;
}
const handler = require(join(raiz, "api/resultados.js"));
const TIPOS = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css",
               ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".xml": "application/xml"};

http.createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (ruta === "/api/resultados") return handler(req, res);
  const fichero = normalize(join(raiz, "site", ruta.endsWith("/") ? ruta + "index.html" : ruta));
  if (!fichero.startsWith(join(raiz, "site"))) { res.statusCode = 403; return res.end(); }
  try {
    const cuerpo = await readFile(fichero);
    res.setHeader("Content-Type", TIPOS[extname(fichero)] || "application/octet-stream");
    res.end(cuerpo);
  } catch {
    res.statusCode = 404; res.end("No encontrado");
  }
}).listen(puerto, () => console.log(`http://localhost:${puerto}/#elecciones-noche${args.includes("--muestra") ? " (con la muestra del 23J)" : ""}`));
