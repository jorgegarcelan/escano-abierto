/* Sección «Geografía»: España, sus 19 comunidades y ciudades autónomas y sus 52 provincias, con los datos del INE.
   Autocontenida para poder servirse en otra web: index.html llama a render(el, ctx, sub) y todo lo demás (datos,
   estilos, mapas, tooltip) está aquí. De la web solo usa, si están, los diputados (ctx.DIPS, ctx.G) para la parte
   del Congreso, y enlaza a otras secciones a través de FUERA. Los datos salen de escano/geografia.py. */

const RUTAS = {
  datos: "datos/geografia/",
  provincias: "datos/elecciones/geo-provincias.json",   // geometrías de escano/geo.py (las comparte con elecciones)
  municipios: "datos/elecciones/geo-municipios.json",
  voto23: "datos/elecciones/municipios-202307.json",     // votos de cada municipio (la historia los cruza con el INE)
  voto19: "datos/elecciones/municipios-201911.json",
};
// Enlaces a otras secciones de Escaño Abierto (si la sección se sirve en otra web, se apuntan allí o se vacían).
const FUERA = {
  diputados: circ => `#provincia-${sl(circ)}`,
  elecciones: circ => `#elecciones-provincia-${sl(circ)}`,
  diputado: nombre => `#diputado-${sl(nombre)}`,
};

const CSS = `
.geo-migas{font-size:13px;color:var(--muted);padding-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.geo-migas a{color:var(--muted)}
.geo-hero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:18px 36px;align-items:center;padding-block:6px 18px;border-bottom:1px solid var(--line)}
.geo-hero h2{font-size:clamp(30px,4.4vw,50px);line-height:1.02;letter-spacing:-.02em;margin-top:8px;max-width:16ch}
.geo-hero p{margin:12px 0 0;color:var(--muted);max-width:58ch;font-size:15.5px}
.geo-hero .mini,.geo-hero .geo-mapa{display:block;width:100%;height:auto;max-height:300px}
.geo-hero .mini path{fill:var(--sunk);stroke:var(--line-strong);stroke-width:1;stroke-opacity:.6}
.geo-hero-ficha{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}
@media (max-width:760px){ .geo-hero,.geo-hero-ficha{grid-template-columns:1fr} .geo-hero .mini,.geo-hero .geo-mapa{max-height:200px} }
.geo-cifras{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:4px 24px;padding-block:14px;border-bottom:1px solid var(--line)}
.geo-cifras div{display:grid;gap:2px;align-content:start}
.geo-cifras b{font-family:var(--display);font-size:28px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.05}
.geo-cifras span{font-size:12.5px;color:var(--muted);line-height:1.3}
.geo-gancho{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:16px;align-items:center;text-decoration:none;color:var(--ink);background:var(--surface);border:var(--borde,1px) solid var(--line);border-radius:var(--r-card-lg,14px);padding:14px 18px;box-shadow:var(--sombra,none);transition:border-color .2s}
.geo-gancho:hover{border-color:var(--line-strong);text-decoration:none}
.geo-gancho svg{width:84px;height:auto;display:block}
.geo-gancho b{font-size:17px}.geo-gancho p{margin:3px 0 0;color:var(--muted);font-size:13.5px}
.geo-gancho .ir{font-size:22px;color:var(--muted)}
.geo-ctl{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.geo-seg{display:inline-flex;border:1px solid var(--line);border-radius:var(--r-pill,999px);overflow:hidden;background:var(--surface)}
.geo-seg button{appearance:none;border:0;background:none;font:500 13px var(--sans);color:var(--muted);padding:5px 12px;cursor:pointer}
.geo-seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.geo-ctl select,.geo-ctl input{font:500 13px var(--sans);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:6px 10px}
.geo-ctl input{min-width:min(260px,100%)}
.geo-mapa-y-rank{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(240px,1fr);gap:18px;align-items:start}
@media (max-width:860px){ .geo-mapa-y-rank{grid-template-columns:1fr} }
svg.geo-mapa{display:block;width:100%;height:auto;max-height:72vh}
.geo-mapa .t{stroke:var(--surface);stroke-width:.8;transition:fill .35s,opacity .3s;cursor:pointer}
.geo-mapa a:hover .t,.geo-mapa .t.sel{stroke:var(--ink);stroke-width:1.6}
.geo-mapa .t.apagada{opacity:.35}
.geo-mapa .can{fill:none;stroke:var(--line-strong);stroke-width:.8}
.geo-mapa .m{stroke:var(--surface);stroke-width:.25;vector-effect:non-scaling-stroke;cursor:pointer}
.geo-mapa .m:hover,.geo-mapa .m.sel{stroke:var(--ink);stroke-width:1.5}
.geo-mapa .borde{fill:none;stroke:var(--ink);stroke-width:1.2;vector-effect:non-scaling-stroke;pointer-events:none;opacity:.55}
.geo-rampa{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);margin-top:8px;flex-wrap:wrap}
.geo-rampa .r{flex:0 1 200px;height:9px;border-radius:5px}
.geo-ley{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted);margin-top:8px}
.geo-ley span{display:inline-flex;align-items:center;gap:5px}
.geo-ley i{width:9px;height:9px;border-radius:50%;display:inline-block}
.geo-rank{list-style:none;margin:0;padding:0 4px 0 0;max-height:min(72vh,640px);overflow:auto;scrollbar-width:thin}
.geo-rank li a{display:grid;grid-template-columns:minmax(0,9.5em) minmax(0,1fr) auto;gap:8px;align-items:center;padding:3px 0;font-size:12.5px;color:var(--ink);text-decoration:none;border-radius:4px}
.geo-rank li a:hover{background:var(--sunk)}
.geo-rank li.es a{font-weight:700}
.geo-rank .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.geo-rank .b{height:10px;background:var(--sunk);border-radius:2px;overflow:hidden}
.geo-rank .b i{display:block;height:100%;border-radius:0 4px 4px 0}
.geo-rank .v{font:12px var(--mono);color:var(--muted);text-align:right;white-space:nowrap}
.geo-dir{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr));gap:12px}
.geo-card{display:grid;grid-template-columns:64px minmax(0,1fr);gap:4px 14px;align-content:start;background:var(--surface);border:var(--borde,1px) solid var(--line);border-radius:var(--r-card-lg,14px);padding:14px 14px 12px;box-shadow:var(--sombra,none);transition:border-color .2s}
.geo-card:hover{border-color:var(--line-strong)}
.geo-card svg{grid-row:span 3;width:64px;height:64px;display:block}
.geo-card svg path{fill:var(--sunk);stroke:var(--line-strong);stroke-width:1;vector-effect:non-scaling-stroke}
.geo-card .t{font-weight:600;font-size:16px;color:var(--ink);text-decoration:none}
.geo-card .t:hover{text-decoration:underline}
.geo-card .d{font-size:12.5px;color:var(--muted)}
.geo-card .ps{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.geo-chip{font-size:12px;text-decoration:none;color:var(--ink);background:var(--sunk);border-radius:var(--r-pill,999px);padding:2px 9px;display:inline-flex;align-items:center;gap:5px}
.geo-chip:hover{background:var(--line)}
.geo-chip i{width:8px;height:8px;border-radius:50%;display:inline-block}
.geo-dos{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:18px;align-items:start}
@media (max-width:860px){ .geo-dos{grid-template-columns:1fr} }
.geo-tiras{display:grid;gap:12px}
.geo-tira{display:grid;grid-template-columns:minmax(0,10em) minmax(0,1fr) minmax(0,9em);gap:10px;align-items:center;font-size:13px}
.geo-tira .l small{display:block;color:var(--muted);font-size:11.5px}
.geo-tira .pista{position:relative;height:22px}
.geo-tira .pista::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--line)}
.geo-tira .o{position:absolute;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--line-strong);opacity:.45}
.geo-tira .es{position:absolute;top:2px;bottom:2px;width:2px;margin-left:-1px;background:var(--muted)}
.geo-tira .cc{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid var(--ink);background:var(--surface)}
.geo-tira .yo{position:absolute;top:50%;width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 2px var(--surface)}
.geo-tira .v{font:600 13px var(--mono);text-align:right;white-space:nowrap}
.geo-tira .v small{display:block;font-weight:400;color:var(--muted);font-size:11px}
@media (max-width:560px){ .geo-tira{grid-template-columns:1fr auto} .geo-tira .pista{grid-column:1/-1;grid-row:2} }
.geo-tabla{width:100%;border-collapse:collapse;font-size:13px}
.geo-tabla th{font-weight:600;font-size:12px;color:var(--muted);text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
.geo-tabla td{padding:6px 8px;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}
.geo-tabla .n{text-align:right}
.geo-desliza{overflow-x:auto}
.geo-lista{list-style:none;margin:0;padding:0;display:grid}
.geo-lista li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:6px 0;border-top:1px solid var(--line);font-size:13.5px}
.geo-lista li:first-child{border-top:0}
.geo-lista .m{font:12px var(--mono);color:var(--muted);white-space:nowrap;align-self:baseline}
.geo-lista button{all:unset;cursor:pointer}
.geo-lista button:hover{text-decoration:underline}
.geo-enlaces{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:13.5px}
.geo-chips{display:flex;flex-wrap:wrap;gap:5px}
.geo-tres{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.geo-muni-ficha{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px;background:var(--surface)}
.geo-muni-ficha b{font-size:15px}
.geo-muni-ficha dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:6px 0 0}
.geo-muni-ficha dt{color:var(--muted)}.geo-muni-ficha dd{margin:0;font-variant-numeric:tabular-nums}
svg.geo-linea{display:block;width:100%;height:auto;overflow:visible}
.geo-linea .eje{stroke:var(--line);stroke-width:1}
.geo-linea text{font:11px var(--mono);fill:var(--muted)}
.geo-linea .et{font:600 11.5px var(--sans)}
.geo-linea .cruz{stroke:var(--line-strong);stroke-width:1;stroke-dasharray:2 3}
.geo-tip{position:fixed;z-index:60;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.14);padding:8px 10px;font-size:12.5px;line-height:1.4;max-width:280px}
.geo-tip .f{display:flex;justify-content:space-between;gap:14px}
.geo-tip .f span{display:inline-flex;align-items:center;gap:6px}
.geo-tip .f i{width:8px;height:8px;border-radius:50%;display:inline-block}
.geo-tip small{color:var(--muted)}
/* la historia: los ejes de la España municipal, con un mapa fijo */
.geo-story{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.35fr);gap:28px;margin-top:10px}
.geo-fijo{grid-column:2;grid-row:1;position:sticky;top:72px;height:calc(100vh - 92px);display:grid;grid-template-rows:auto minmax(0,1fr) auto;align-self:start}
.geo-fijo canvas{width:100%;height:100%;display:block;cursor:crosshair}
.geo-fijo .pie{min-height:44px;padding-top:6px}
.geo-indice{display:flex;flex-wrap:wrap;gap:4px 6px;padding-bottom:6px}
.geo-indice button{appearance:none;font:500 12px var(--sans);color:var(--muted);background:none;border:1px solid var(--line);border-radius:var(--r-pill,999px);padding:3px 10px;cursor:pointer;white-space:nowrap}
.geo-indice button:hover{color:var(--ink);border-color:var(--line-strong)}
.geo-indice button[aria-current="step"]{color:var(--bg);background:var(--ink);border-color:var(--ink)}
.geo-pasos{grid-column:1;grid-row:1;padding-bottom:30vh}
.geo-paso{min-height:92vh;display:flex;align-items:center;padding-block:4vh}
.geo-paso:first-child{min-height:70vh;align-items:flex-start;padding-top:6vh}
.geo-paso .caja{width:100%;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card-lg,14px);padding:18px 20px;box-shadow:var(--sombra,none);transition:opacity .3s,border-color .3s;opacity:.55}
.geo-paso.activo .caja{opacity:1;border-color:var(--line-strong)}
.geo-kicker{font:600 11.5px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.geo-caja h3{font-size:23px;line-height:1.12;margin:0 0 10px;letter-spacing:-.01em}
.geo-caja p{margin:0 0 9px;font-size:14.5px;line-height:1.5}
.geo-caja .num{font-family:var(--display);font-weight:700;font-variant-numeric:tabular-nums}
.geo-caja .pista-t{font-size:12px;color:var(--muted);margin:8px 0 0}
.geo-tam{display:inline-flex;border:1px solid var(--line);border-radius:var(--r-pill,999px);overflow:hidden;margin-top:4px}
.geo-tam button{appearance:none;border:0;background:none;font:500 13px var(--sans);color:var(--muted);padding:5px 12px;cursor:pointer}
.geo-tam button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.geo-cubos{display:grid;gap:2px;margin-top:10px}
.geo-cubo{display:grid;grid-template-columns:12px minmax(0,1fr);gap:2px 9px;padding:6px 6px;border-radius:8px;cursor:pointer}
.geo-cubo:hover,.geo-cubo.on{background:var(--sunk)}
.geo-cubo>i{width:12px;height:12px;border-radius:3px;margin-top:3px;grid-row:span 3}
.geo-cubo .c1{display:flex;justify-content:space-between;gap:8px;font-size:13.5px}
.geo-cubo .c1 small{color:var(--muted);font-size:11.5px;white-space:nowrap}
.geo-cubo .c2{font-size:11.5px;color:var(--muted)}
.geo-barra{display:flex;height:10px;border-radius:3px;overflow:hidden;gap:2px;background:var(--surface)}
.geo-barra i{display:block;min-width:1px}
.geo-partidos{display:flex;flex-wrap:wrap;gap:3px 10px;font-size:11.5px;color:var(--muted);margin-top:6px}
.geo-partidos span{display:inline-flex;align-items:center;gap:4px}
.geo-partidos i{width:8px;height:8px;border-radius:2px;display:inline-block}
.geo-esp-chips{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}
.geo-esp-chips button{appearance:none;font:500 12.5px var(--sans);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:var(--r-pill,999px);padding:4px 10px;cursor:pointer}
.geo-esp-chips button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.geo-esp-det{border-top:1px solid var(--line);padding-top:8px;margin-top:4px}
.geo-esp-det h4{margin:0 0 4px;font-size:15px}
.geo-esp-det h4 small{font-weight:400;color:var(--muted);font-size:11.5px}
.geo-esp-tabla{display:grid;gap:1px;margin-top:8px}
.geo-esp-tabla button{all:unset;display:grid;grid-template-columns:minmax(0,8.5em) minmax(0,1fr) 4.2em;gap:8px;align-items:center;font-size:12px;padding:4px 6px;border-radius:6px;cursor:pointer}
.geo-esp-tabla button:hover,.geo-esp-tabla button.on{background:var(--sunk)}
.geo-esp-tabla .v{font-family:var(--mono);color:var(--muted);text-align:right}
.geo-pres-btn{appearance:none;font:600 13px var(--sans);color:var(--ink);background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--r-pill,999px);padding:6px 14px;cursor:pointer}
.geo-pres{display:none}
.geo-story.presentando{position:fixed;inset:0;z-index:200;background:var(--bg);margin:0;display:block}
.geo-story.presentando .geo-pasos{display:none}
.geo-story.presentando .geo-fijo{position:absolute;inset:14px 14px 14px 470px;height:auto;top:14px}
.geo-story.presentando .geo-pres{display:grid;position:absolute;left:18px;top:18px;bottom:18px;width:430px;align-content:center;gap:10px;overflow:auto}
.geo-pres nav{display:flex;gap:8px;align-items:center;font:500 13px var(--mono);color:var(--muted)}
.geo-pres nav button{appearance:none;font:600 14px var(--sans);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:5px 12px;cursor:pointer}
.geo-pres nav button:disabled{opacity:.35;cursor:default}
@media (max-width:860px){
  .geo-story{grid-template-columns:1fr}
  .geo-fijo{grid-column:1;top:58px;height:54vh;z-index:0;background:var(--bg)}
  .geo-indice{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-top:4px}
  .geo-pasos{grid-column:1;grid-row:1;position:relative;z-index:1;margin-top:54vh}
  .geo-paso,.geo-paso:first-child{min-height:90vh;align-items:flex-end;padding:0 0 10vh}
  .geo-paso .caja{background:color-mix(in srgb,var(--surface) 95%,transparent);opacity:1}
  .geo-story.presentando .geo-fijo{inset:8px 8px 45vh 8px}
  .geo-story.presentando .geo-pres{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:44vh}
}
`;

/* ---------- datos y utilidades ---------- */
let ctx = null, T = null, GP = null, GC = null, cargando = null;
// Las familias del histórico electoral se llaman por toda su historia («PP (antes AP y CD)»); para el 23J, el nombre de hoy.
const HOY = {IZQ: "Sumar", BILDU: "EH Bildu", ERC: "ERC", BNG: "BNG", PSOE: "PSOE", UCD: "UCD", CS: "Cs", PNV: "PNV", CIU: "Junts", CC: "CC", PP: "PP", VOX: "Vox", OTROS: "Otros"};
const partido = (M, k) => HOY[M.orden[k]] || M.familias[M.orden[k]]?.[0] || "";
const cache = {};
const pedir = url => cache[url] ||= fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
const base = () => cargando ||= Promise.all([pedir(RUTAS.datos + "territorios.json"), pedir(RUTAS.provincias), pedir(RUTAS.datos + "geo-ccaa.json")])
  .then(([t, p, c]) => { T = t; GP = p; GC = c; if (!T || !GP || !GC) cargando = null; });

function estilos(){
  if (document.getElementById("geo-css")) return;
  const s = document.createElement("style"); s.id = "geo-css"; s.textContent = CSS; document.head.appendChild(s);
}
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const sl = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Miles con punto también en los números de cuatro cifras (Intl en español no los agrupa).
const fmt = n => n == null ? "–" : (n < 0 ? "−" : "") + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const dec = (x, d = 1) => { if (x == null) return "–"; const [e, f] = Math.abs(x).toFixed(d).split("."); return (x < 0 && +(e + (f || "")) ? "−" : "") + e.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (f ? "," + f : ""); };
const pct = (x, d = 1) => x == null ? "–" : dec(x * 100, d) + " %";
const signo = (x, d = 1) => x == null ? "–" : (x > 0 ? "+" : x < 0 ? "−" : "±") + dec(Math.abs(x) * 100, d) + " %";
const habitantes = n => n >= 1e6 ? millones(n) + " de habitantes" : fmt(n) + " habitantes";
const millones = n => n >= 1e6 ? dec(n / 1e6, n >= 1e7 ? 1 : 2).replace(/,?0+$/, "") + " millones" : fmt(n);
const pob0 = x => x.serie[0], pobHoy = x => x.serie[x.serie.length - 1];
const crec = x => pob0(x) ? pobHoy(x) / pob0(x) - 1 : null;

const nombreC = c => T.ccaa[c].corto;
const nombreP = c => c === "38" ? "Santa Cruz de Tenerife" : T.provincias[c].corto;
const uni = c => T.ccaa[c].provincias.length === 1;
const slugC = c => c === "10" ? "comunitat-valenciana" : sl(T.ccaa[c].corto);
const slugP = c => sl(nombreP(c));
const enlaceC = c => `#geografia-${slugC(c)}`;
// Las comunidades de una sola provincia no tienen ficha de provincia aparte: la de la comunidad ya es la suya.
const enlaceP = c => uni(T.provincias[c].ccaa) ? enlaceC(T.provincias[c].ccaa) : `#geografia-provincia-${slugP(c)}`;

/* ---------- color ---------- */
// Secuencial: un solo tono, de la superficie al color. Divergente: dos tonos con el gris de la superficie en medio.
const TONO = {neutro: "#4F7AA6", calido: "#B4613A", frio: "#3D7CB0", renta: "#3C8C6A", edad: "#8A5AA8"};
function hexRgb(h){ h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
const cssVar = (v, def) => { const x = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return x.startsWith("#") ? x : def; };
const mezcla = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
const rgb = c => `rgb(${c.join(",")})`;
function rampa(hex){
  const a = hexRgb(cssVar("--sunk", "#EDEEEA")), b = hexRgb(hex);
  return t => rgb(mezcla(a, b, 0.1 + 0.9 * Math.max(0, Math.min(1, t))));
}
function divergente(t){   // t en [-1, 1]
  const g = hexRgb(cssVar("--sunk", "#EDEEEA")), k = Math.max(-1, Math.min(1, t));
  return rgb(mezcla(g, hexRgb(k < 0 ? TONO.calido : TONO.frio), Math.pow(Math.abs(k), .8)));
}

/* Lentes: qué se pinta en los mapas de comunidades y provincias. */
const LENTES = [
  {id: "pob", t: "Población", v: x => pobHoy(x), f: millones, escala: "sqrt", tono: "neutro", suma: true},
  {id: "dens", t: "Densidad", v: x => x.dens, f: v => fmt(v) + " hab./km²", escala: "log", tono: "neutro"},
  {id: "crec", t: "Población ganada o perdida desde 1996", corto: "Desde 1996", v: crec, f: v => signo(v), div: true},
  {id: "edad", t: "Edad media", v: x => x.edad, f: v => dec(v, 1) + " años", tono: "edad"},
  {id: "envej", t: "Envejecimiento", v: x => x.envej, f: v => fmt(v), unidad: "mayores de 64 por cada 100 menores de 16", tono: "edad"},
  {id: "vida", t: "Esperanza de vida", v: x => x.vida, f: v => dec(v, 1) + " años", tono: "renta"},
  {id: "paro", t: "Paro", v: x => x.paro, f: v => dec(v, 1) + " %", tono: "calido"},
  {id: "renta", t: "Renta por persona", v: x => x.renta, f: v => fmt(v) + " €", tono: "renta"},
  {id: "hesc", t: "Habitantes por escaño", v: x => x.esc ? pobHoy(x) / x.esc : null, f: v => fmt(v), tono: "neutro"},
];
const LENTE = Object.fromEntries(LENTES.map(l => [l.id, l]));
function escala(lente, valores){
  const vs = valores.filter(v => v != null && isFinite(v));
  if (!vs.length) return {color: () => null, leyenda: ""};
  if (lente.div){
    const lim = Math.max(...vs.map(Math.abs)) || 1;
    return {color: v => v == null ? null : divergente(v / lim),
      leyenda: `<div class="geo-rampa"><span>${lente.f(-lim)}</span><span class="r" style="background:linear-gradient(90deg,${divergente(-1)},${divergente(0)},${divergente(1)})"></span><span>${lente.f(lim)}</span></div>`};
  }
  const lo = Math.min(...vs), hi = Math.max(...vs), tr = lente.escala === "log" ? Math.log : lente.escala === "sqrt" ? Math.sqrt : x => x;
  const r = rampa(TONO[lente.tono] || TONO.neutro), t = v => (tr(v) - tr(lo)) / ((tr(hi) - tr(lo)) || 1);
  return {color: v => v == null ? null : r(t(v)),
    leyenda: `<div class="geo-rampa"><span>${lente.f(lo)}</span><span class="r" style="background:linear-gradient(90deg,${r(0)},${r(.5)},${r(1)})"></span><span>${lente.f(hi)}</span>${lente.unidad ? `<span>· ${esc(lente.unidad)}</span>` : ""}</div>`};
}

/* ---------- tooltip propio ---------- */
let tipEl = null;
function tip(html, ev){
  if (!tipEl){ tipEl = document.createElement("div"); tipEl.className = "geo-tip"; tipEl.hidden = true; document.body.appendChild(tipEl); }
  if (!html){ tipEl.hidden = true; return; }
  tipEl.innerHTML = html; tipEl.hidden = false;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight, vw = document.documentElement.clientWidth;
  let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + w > vw - 8) x = ev.clientX - w - 14;
  if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
  tipEl.style.left = Math.max(8, x) + "px"; tipEl.style.top = Math.max(8, y) + "px";
}
const conTip = (el, fn) => { if (!el) return; el.addEventListener("mousemove", ev => tip(fn(ev), ev)); el.addEventListener("mouseleave", () => tip("")); };

/* ---------- mapas ---------- */
const vbDe = (bb, margen = .08) => { const w = bb[2] - bb[0], h = bb[3] - bb[1], m = Math.max(w, h) * margen; return `${(bb[0] - m).toFixed(1)} ${(bb[1] - m).toFixed(1)} ${(w + 2 * m).toFixed(1)} ${(h + 2 * m).toFixed(1)}`; };
function mapaSVG(nivel, color, {apagar = null, sel = null, vb = null, etiqueta = "Mapa"} = {}){
  const capa = nivel === "ccaa" ? GC.ccaa : GP.provincias;
  return `<svg class="geo-mapa" viewBox="${vb || `0 0 ${GP.ancho} ${GP.alto}`}" role="img" aria-label="${esc(etiqueta)}">${Object.entries(capa).map(([c, x]) => {
    const href = nivel === "ccaa" ? enlaceC(c) : enlaceP(c), nombre = nivel === "ccaa" ? nombreC(c) : nombreP(c);
    return `<a href="${href}" aria-label="${esc(nombre)}"><path class="t${apagar && apagar(c) ? " apagada" : ""}${sel === c ? " sel" : ""}" d="${x.d}" data-${nivel === "ccaa" ? "cc" : "pv"}="${c}" style="fill:${color(c) || "var(--sunk)"}"></path></a>`;
  }).join("")}<path class="can" d="${GP.canarias}"/></svg>`;
}
function siluetaCCAA(c, cls = ""){
  const x = GC.ccaa[c];
  return `<svg class="${cls}" viewBox="${vbDe(x.bb, .06)}" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><path d="${x.d}"/></svg>`;
}
function filaTip(t, x, lente){
  const v = lente.v(x);
  return `<b>${esc(t)}</b><br>${esc(lente.t)}: <b>${v == null ? "sin dato" : lente.f(v)}</b><br><small>${millones(pobHoy(x))} hab. · Pulsa para ver su ficha</small>`;
}

/* ---------- entrada ---------- */
export async function render(el, c, sub){
  ctx = c || {}; estilos();
  if (!T){ el.innerHTML = `<p class="nota">Cargando la geografía…</p>`; await base(); }
  if (!T){ el.innerHTML = `<p class="nota">No se han podido cargar los datos de geografía.</p>`; return; }
  tip("");
  sub = (sub || "").trim();
  if (!sub) return portada(el);
  if (sub === "historia") return historia(el);
  if (sub.startsWith("municipio-")) return irAMunicipio(el, sub.slice(10));
  if (sub.startsWith("provincia-")){
    const s = sub.slice(10), cod = Object.keys(T.provincias).find(k => slugP(k) === s || sl(T.provincias[k].n) === s);
    if (cod) return uni(T.provincias[cod].ccaa) ? ficha(el, "ccaa", T.provincias[cod].ccaa) : ficha(el, "prov", cod);
  } else {
    const cod = Object.keys(T.ccaa).find(k => slugC(k) === sub || sl(T.ccaa[k].n) === sub);
    if (cod) return ficha(el, "ccaa", cod);
  }
  el.innerHTML = `<p class="nota">No encontramos ese territorio. <a href="#geografia">Ver todas las comunidades y provincias</a></p>`;
}

/* =====================================================================================================
   PORTADA: mapa por lentes + ranking + directorio de comunidades y provincias
   ===================================================================================================== */
const est = {nivel: "ccaa", lente: "pob", orden: "pob", q: ""};
function portada(el){
  const E = T.espana, F = T.fuentes, anios = T.anios;
  const ganan = Object.values(T.provincias).filter(p => crec(p) > 0).length;
  el.innerHTML = `
    <div class="geo-hero"><div><div class="eyebrow">Geografía · datos del INE</div>
      <h2>España, comunidad a comunidad</h2>
      <p>Diecisiete comunidades, dos ciudades autónomas, cincuenta provincias y ${fmt(E.mun)} municipios. Quién vive dónde, cuánto ha cambiado desde ${anios[0]}, cómo envejece, cuánto gana y cuántos diputados elige. Con datos oficiales del padrón, la EPA y el Atlas de renta.</p></div>
      <svg class="mini" viewBox="0 0 ${GP.ancho} ${GP.alto}" aria-hidden="true">${Object.values(GC.ccaa).map(x => `<path d="${x.d}"/>`).join("")}</svg></div>
    <div class="geo-cifras">
      <div><b>${millones(pobHoy(E))}</b><span>habitantes a 1 de enero de ${F.padron}</span></div>
      <div><b>${signo(crec(E))}</b><span>que en ${anios[0]} (${millones(pob0(E))})</span></div>
      <div><b>${fmt(E.mun_peq)}</b><span>de sus ${fmt(E.mun)} municipios tienen menos de 1.000 habitantes</span></div>
      <div><b>${fmt(E.pierden)}</b><span>municipios tienen hoy menos gente que en ${anios[0]}</span></div>
      <div><b>${52 - ganan}</b><span>de las 52 provincias han perdido población</span></div>
    </div>
    <section class="sec" style="padding-top:18px"><a class="geo-gancho" href="#geografia-historia">
      <svg viewBox="0 0 ${GP.ancho} ${GP.alto}" aria-hidden="true">${puntosMini()}</svg>
      <div><b>La España que no sale en el mapa</b><p>Ocho mil municipios en un mapa que se queda quieto mientras bajas: dónde vive la gente, dónde se vacía, dónde envejece y cuánto pesa su voto.</p></div><span class="ir" aria-hidden="true">→</span></a></section>
    <section class="sec"><div class="sec-h"><h2 id="geo-t"></h2>
      <div class="geo-ctl"><div class="geo-seg" role="group" aria-label="Nivel">${[["ccaa", "Comunidades"], ["prov", "Provincias"]].map(([v, t]) => `<button data-nivel="${v}" aria-pressed="${est.nivel === v}">${t}</button>`).join("")}</div>
        <select id="geo-lente" aria-label="Qué se pinta en el mapa">${LENTES.map(l => `<option value="${l.id}"${l.id === est.lente ? " selected" : ""}>${esc(l.t)}</option>`).join("")}</select></div></div>
      <div class="chart"><div class="geo-mapa-y-rank"><div><div id="geo-mapa"></div><div id="geo-ley"></div></div><ol class="geo-rank" id="geo-rank"></ol></div>
        <p class="nota" id="geo-nota"></p></div></section>
    <section class="sec"><div class="sec-h"><h2>Las comunidades y sus provincias</h2>
      <div class="geo-ctl"><input type="search" id="geo-q" placeholder="Busca una comunidad, provincia o municipio" aria-label="Buscar" autocomplete="off" value="${esc(est.q)}">
        <select id="geo-orden" aria-label="Ordenar">${[["pob", "Por población"], ["km2", "Por superficie"], ["dens", "Por densidad"], ["crec", "Por crecimiento"], ["nombre", "Por nombre"]].map(([v, t]) => `<option value="${v}"${v === est.orden ? " selected" : ""}>${t}</option>`).join("")}</select></div></div>
      <div id="geo-munis" hidden></div>
      <div class="geo-dir" id="geo-dir"></div></section>
    ${fuentes()}`;
  const pintarMapa = () => {
    const l = LENTE[est.lente], datos = est.nivel === "ccaa" ? T.ccaa : T.provincias;
    const vals = Object.fromEntries(Object.entries(datos).map(([c, x]) => [c, l.v(x)]));
    const s = escala(l, Object.values(vals));
    el.querySelector("#geo-t").textContent = `${l.t}, por ${est.nivel === "ccaa" ? "comunidades" : "provincias"}`;
    el.querySelector("#geo-mapa").innerHTML = mapaSVG(est.nivel, c => s.color(vals[c]), {etiqueta: `${l.t} por ${est.nivel === "ccaa" ? "comunidades" : "provincias"}`});
    el.querySelector("#geo-ley").innerHTML = s.leyenda;
    const filas = Object.keys(datos).filter(c => vals[c] != null).sort((a, b) => vals[b] - vals[a]);
    const ve = l.suma ? null : l.v(T.espana), max = Math.max(...filas.map(c => Math.abs(vals[c])), Math.abs(ve || 0)) || 1;
    const fila = (c, x, nombre, href, cls = "") => `<li class="${cls}"><a href="${href}" data-${est.nivel === "ccaa" ? "cc" : "pv"}="${c}"><span class="n">${esc(nombre)}</span><span class="b"><i style="width:${(Math.abs(x) / max * 100).toFixed(1)}%;background:${cls ? "var(--ink)" : s.color(x)}"></i></span><span class="v">${l.f(x)}</span></a></li>`;
    let html = "", puesta = ve == null;
    for (const c of filas){
      if (!puesta && ve >= vals[c]){ html += fila("es", ve, "España", "#geografia", "es"); puesta = true; }
      html += fila(c, vals[c], est.nivel === "ccaa" ? nombreC(c) : nombreP(c), est.nivel === "ccaa" ? enlaceC(c) : enlaceP(c));
    }
    if (!puesta) html += fila("es", ve, "España", "#geografia", "es");
    el.querySelector("#geo-rank").innerHTML = html;
    el.querySelector("#geo-nota").textContent = notaLente(l);
  };
  const pintarDir = () => {
    const q = sl(est.q), cods = Object.keys(T.ccaa);
    const clave = {pob: c => -pobHoy(T.ccaa[c]), km2: c => -T.ccaa[c].km2, dens: c => -T.ccaa[c].dens, crec: c => -crec(T.ccaa[c]), nombre: c => nombreC(c)}[est.orden];
    const orden = cods.sort((a, b) => { const x = clave(a), y = clave(b); return typeof x === "string" ? x.localeCompare(y, "es") : x - y; });
    const casa = c => !q || sl(T.ccaa[c].n).includes(q) || sl(nombreC(c)).includes(q) || T.ccaa[c].provincias.some(p => sl(nombreP(p)).includes(q));
    el.querySelector("#geo-dir").innerHTML = orden.filter(casa).map(c => {
      const x = T.ccaa[c];
      return `<div class="geo-card">${siluetaCCAA(c)}<a class="t" href="${enlaceC(c)}">${esc(nombreC(c))}</a>
        <span class="d">${millones(pobHoy(x))} hab. · ${pct(pobHoy(x) / pobHoy(T.espana))} de España</span>
        <span class="d">${fmt(x.km2)} km² · ${fmt(x.mun)} municipios · ${signo(crec(x))} desde ${T.anios[0]}</span>
        <div class="ps">${uni(c) ? `<span class="d">Una sola provincia</span>` : x.provincias.map(p => `<a class="geo-chip" href="${enlaceP(p)}">${esc(nombreP(p))}</a>`).join("")}</div></div>`;
    }).join("") || `<p class="nota">Ninguna comunidad ni provincia coincide.</p>`;
    buscarMunicipios(q);
  };
  // Municipios: el buscador también los encuentra (el fichero se pide la primera vez que se escribe).
  let M = null;
  const buscarMunicipios = async q => {
    const caja = el.querySelector("#geo-munis");
    if (q.length < 3){ caja.hidden = true; return; }
    M ||= await pedir(RUTAS.datos + "municipios.json");
    if (!M || sl(est.q) !== q) return;
    const hits = Object.entries(M.m).filter(([, r]) => sl(r[0]).includes(q)).sort((a, b) => (sl(a[1][0]).startsWith(q) ? 0 : 1) - (sl(b[1][0]).startsWith(q) ? 0 : 1) || b[1][4] - a[1][4]).slice(0, 12);
    caja.hidden = !hits.length;
    caja.innerHTML = hits.length ? `<div class="chart" style="margin-bottom:12px"><h3>Municipios</h3><div class="geo-chips">${hits.map(([cod, r]) => `<a class="geo-chip" href="#geografia-municipio-${cod}">${esc(r[0])} <small style="color:var(--muted)">${esc(nombreP(cod.slice(0, 2)))} · ${fmt(r[4])} hab.</small></a>`).join("")}</div></div>` : "";
  };
  el.addEventListener("click", ev => {
    const b = ev.target.closest("[data-nivel]"); if (!b) return;
    est.nivel = b.dataset.nivel; el.querySelectorAll("[data-nivel]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); pintarMapa();
  });
  el.querySelector("#geo-lente").addEventListener("change", e => { est.lente = e.target.value; pintarMapa(); });
  el.querySelector("#geo-orden").addEventListener("change", e => { est.orden = e.target.value; pintarDir(); });
  let t0 = null;
  el.querySelector("#geo-q").addEventListener("input", e => { est.q = e.target.value; clearTimeout(t0); t0 = setTimeout(pintarDir, 180); });
  conTip(el.querySelector("#geo-mapa"), ev => {
    const p = ev.target.closest("[data-cc],[data-pv]"); if (!p) return "";
    return p.dataset.cc ? filaTip(nombreC(p.dataset.cc), T.ccaa[p.dataset.cc], LENTE[est.lente]) : filaTip(nombreP(p.dataset.pv), T.provincias[p.dataset.pv], LENTE[est.lente]);
  });
  // Al pasar por el ranking se resalta en el mapa.
  const rank = el.querySelector("#geo-rank");
  rank.addEventListener("mouseover", ev => { const a = ev.target.closest("a"); el.querySelectorAll("#geo-mapa .t.sel").forEach(x => x.classList.remove("sel"));
    const c = a?.dataset.cc || a?.dataset.pv; if (c) el.querySelector(`#geo-mapa [data-${a.dataset.cc ? "cc" : "pv"}="${c}"]`)?.classList.add("sel"); });
  rank.addEventListener("mouseleave", () => el.querySelectorAll("#geo-mapa .t.sel").forEach(x => x.classList.remove("sel")));
  pintarMapa(); pintarDir();
}
function notaLente(l){
  const F = T.fuentes;
  return {
    pob: `Población a 1 de enero de ${F.padron} (padrón municipal).`,
    dens: `Habitantes por kilómetro cuadrado (padrón de ${F.padron}; superficie calculada sobre los límites del IGN).`,
    crec: `Población de ${F.padron} frente a la de ${T.anios[0]}, primer padrón con revisión anual.`,
    edad: `Edad media de la población a 1 de enero de ${F.edad} (Indicadores demográficos básicos del INE).`,
    envej: `Personas de 65 años o más por cada 100 menores de 16, a 1 de enero de ${F.envej}.`,
    vida: `Años que se espera que viva un recién nacido con la mortalidad de ${F.vida}.`,
    paro: `Tasa de paro de la EPA: media de los cuatro trimestres hasta el ${F.paro.replace(/(\d{4})T(\d)/, "$2.º de $1")}. La EPA es una encuesta y en las provincias pequeñas oscila de un trimestre a otro.`,
    renta: `Renta neta media por persona en ${F.renta} (Atlas de distribución de renta de los hogares). El Atlas da el dato de cada municipio; el de comunidades y provincias es la media de sus municipios ponderada por población.`,
    hesc: `Habitantes (padrón de ${F.padron}) por cada diputado que elige al Congreso. Cada provincia tiene dos escaños fijos y el resto se reparte por población, así que en las menos pobladas un escaño representa a menos gente.`,
  }[l.id];
}
function puntosMini(){
  // Un puntito por provincia, de área proporcional a su población, para el gancho de la historia.
  return Object.entries(GP.provincias).map(([c, p]) => `<circle cx="${p.c[0]}" cy="${p.c[1]}" r="${(Math.sqrt(pobHoy(T.provincias[c]) / 1e6) * 34 + 3).toFixed(1)}" fill="${TONO.neutro}" fill-opacity=".55"/>`).join("");
}
function fuentes(){
  const F = T.fuentes;
  return `<p class="nota" style="margin-top:22px">Fuentes: INE — padrón municipal (cifras oficiales a 1 de enero de ${F.padron}, y desde ${T.anios[0]}), Indicadores demográficos básicos (${F.edad}), Encuesta de Población Activa (hasta ${esc(F.paro)}) y Atlas de distribución de renta de los hogares (${F.renta}). Escaños: Ministerio del Interior, últimas generales. Límites: IGN, vía es-atlas.</p>`;
}

/* =====================================================================================================
   FICHAS de comunidad y de provincia (comparten casi todo)
   ===================================================================================================== */
function ficha(el, tipo, cod){
  const X = tipo === "ccaa" ? T.ccaa[cod] : T.provincias[cod], E = T.espana;
  const ccaa = tipo === "ccaa" ? cod : X.ccaa, C = T.ccaa[ccaa];
  const provs = tipo === "ccaa" ? X.provincias : [cod];
  const nombre = tipo === "ccaa" ? (uni(cod) ? T.ccaa[cod].n : nombreC(cod)) : nombreP(cod);
  const tipoTxt = tipo === "prov" ? "Provincia" : cod === "18" || cod === "19" ? "Ciudad autónoma" : uni(cod) ? "Comunidad autónoma uniprovincial" : "Comunidad autónoma";
  const parte = pobHoy(X) / pobHoy(E), cambio = pobHoy(X) - pob0(X);
  const frase = `${millones(pobHoy(X))} habitantes —el ${pct(parte)} de España— en ${fmt(X.km2)} km²${tipo === "ccaa" && !uni(cod) ? `, repartidos en ${X.provincias.length} provincias` : ""} y ${fmt(X.mun)} municipios. ${cambio >= 0 ? "Ha ganado" : "Ha perdido"} ${fmt(Math.abs(cambio))} habitantes desde ${T.anios[0]} (${signo(crec(X))}).${X.esc ? ` Elige ${X.esc} de los 350 diputados del Congreso.` : ""}`;
  // Mapa de situación: provincias, con las suyas destacadas.
  const situacion = mapaSVG("prov", c => provs.includes(c) ? TONO.neutro : T.provincias[c].ccaa === ccaa ? rampa(TONO.neutro)(.35) : null,
    {apagar: c => !provs.includes(c) && T.provincias[c].ccaa !== ccaa, etiqueta: `Situación de ${nombre}`});
  el.innerHTML = `
    <nav class="geo-migas" aria-label="Estás en"><a href="#geografia">Geografía</a>${tipo === "prov" ? ` <span>›</span> <a href="${enlaceC(ccaa)}">${esc(nombreC(ccaa))}</a>` : ""}</nav>
    <div class="geo-hero geo-hero-ficha"><div><div class="eyebrow">${esc(tipoTxt)}</div><h2>${esc(nombre)}</h2><p>${frase}</p></div>
      <div>${situacion}</div></div>
    <div class="geo-cifras">
      <div><b>${millones(pobHoy(X))}</b><span>habitantes en ${T.fuentes.padron}</span></div>
      <div><b>${fmt(X.dens)}</b><span>habitantes por km² (España: ${fmt(E.dens)})</span></div>
      <div><b>${signo(crec(X))}</b><span>de población desde ${T.anios[0]} (España: ${signo(crec(E))})</span></div>
      <div><b>${fmt(X.mun_peq)}</b><span>de sus ${fmt(X.mun)} municipios no llegan a 1.000 habitantes</span></div>
      <div><b>${fmt(X.pierden)}</b><span>municipios tienen menos gente que en ${T.anios[0]}</span></div>
      ${X.mayor ? `<div><b style="font-size:22px">${esc(X.mayor[1])}</b><span>su municipio más poblado: ${fmt(X.mayor[2])} hab. (${pct(X.mayor[2] / pobHoy(X), 0)})</span></div>` : ""}
    </div>
    <div class="geo-dos" style="margin-top:18px">
      <div class="chart"><h3>Cómo ha cambiado su población</h3><p class="sub">Población de cada año frente a la de ${T.anios[0]} (= 100).</p><div id="geo-evo"></div></div>
      <div class="chart"><h3>Dónde queda frente al resto</h3><p class="sub">Cada punto gris es ${tipo === "ccaa" ? "una comunidad" : "una provincia"}; la raya, España${tipo === "prov" ? `; el círculo, ${esc(nombreC(ccaa))}` : ""}.</p><div class="geo-tiras" id="geo-tiras"></div></div>
    </div>
    ${tipo === "ccaa" && !uni(cod) ? `<section class="sec"><div class="sec-h"><h2>Sus provincias</h2></div><div class="chart geo-desliza">${tablaProvincias(X.provincias)}</div></section>` : ""}
    <section class="sec" id="geo-muni"><div class="sec-h"><h2>Municipio a municipio</h2><p>Sus ${fmt(X.mun)} municipios. Pulsa uno para ver sus datos.</p></div><p class="nota">Cargando…</p></section>
    <section class="sec" id="geo-congreso">${congreso(tipo, cod, X, provs)}</section>
    ${fuentes()}`;
  // Evolución: índice 1996 = 100.
  const series = [{nombre, color: "var(--ink)", v: X.serie}, ...(tipo === "prov" ? [{nombre: nombreC(ccaa), color: TONO.neutro, v: C.serie}] : []), {nombre: "España", color: "var(--line-strong)", v: E.serie}];
  const evo = el.querySelector("#geo-evo");
  lineaIndice(evo, series);
  // Tiras: dónde queda en cada indicador entre sus pares.
  const pares = tipo === "ccaa" ? T.ccaa : T.provincias, nombrePar = tipo === "ccaa" ? nombreC : nombreP;
  el.querySelector("#geo-tiras").innerHTML = ["dens", "crec", "edad", "envej", "vida", "paro", "renta", "hesc"].map(id => {
    const l = LENTE[id], v = l.v(X); if (v == null) return "";
    const todos = Object.entries(pares).map(([c, x]) => [c, l.v(x)]).filter(([, y]) => y != null);
    const tr = l.escala === "log" ? Math.log : x => x;
    const ys = todos.map(([, y]) => tr(y)), lo = Math.min(...ys, tr(l.v(E))), hi = Math.max(...ys, tr(l.v(E))), pos = y => ((tr(y) - lo) / ((hi - lo) || 1) * 100).toFixed(1);
    const rango = [...todos].sort((a, b) => b[1] - a[1]).findIndex(([c]) => c === cod) + 1;
    return `<div class="geo-tira"><div class="l">${esc(l.corto || l.t)}<small>${rango}.º de ${todos.length}</small></div>
      <div class="pista">${todos.filter(([c]) => c !== cod).map(([c, y]) => `<i class="o" style="left:${pos(y)}%" data-tip-geo="${esc(nombrePar(c))}: ${esc(l.f(y))}"></i>`).join("")}
        <i class="es" style="left:${pos(l.v(E))}%" data-tip-geo="España: ${esc(l.f(l.v(E)))}"></i>
        ${tipo === "prov" && l.v(C) != null ? `<i class="cc" style="left:${pos(l.v(C))}%" data-tip-geo="${esc(nombreC(ccaa))}: ${esc(l.f(l.v(C)))}"></i>` : ""}
        <i class="yo" style="left:${pos(v)}%" data-tip-geo="${esc(nombre)}: ${esc(l.f(v))}"></i></div>
      <div class="v">${l.f(v)}<small>España ${l.f(l.v(E))}</small></div></div>`;
  }).join("");
  conTip(el.querySelector("#geo-tiras"), ev => { const i = ev.target.closest("[data-tip-geo]"); return i ? esc(i.dataset.tipGeo) : ""; });
  conTip(el.querySelector(".geo-hero .geo-mapa"), ev => { const p = ev.target.closest("[data-pv]"); return p ? filaTip(nombreP(p.dataset.pv), T.provincias[p.dataset.pv], LENTE.pob) : ""; });
  municipios(el.querySelector("#geo-muni"), tipo, cod, provs);
}
function tablaProvincias(ps){
  const filas = ps.slice().sort((a, b) => pobHoy(T.provincias[b]) - pobHoy(T.provincias[a]));
  return `<table class="geo-tabla"><thead><tr><th>Provincia</th><th class="n">Población</th><th class="n">Desde ${T.anios[0]}</th><th class="n">Hab./km²</th><th class="n">Edad media</th><th class="n">Paro</th><th class="n">Renta/persona</th><th class="n">Escaños</th></tr></thead><tbody>
    ${filas.map(p => { const x = T.provincias[p]; return `<tr><td><a href="${enlaceP(p)}">${esc(nombreP(p))}</a></td><td class="n">${fmt(pobHoy(x))}</td><td class="n">${signo(crec(x))}</td><td class="n">${fmt(x.dens)}</td><td class="n">${dec(x.edad)}</td><td class="n">${dec(x.paro)} %</td><td class="n">${fmt(x.renta)} €</td><td class="n">${x.esc ?? "–"}</td></tr>`; }).join("")}</tbody></table>`;
}
function congreso(tipo, cod, X, provs){
  const E = T.espana, hX = pobHoy(X) / X.esc, hE = pobHoy(E) / E.esc;
  const circs = provs.map(p => T.provincias[p].n);
  const dips = (ctx.DIPS || []).filter(d => !d[8] && circs.includes(d[2]));
  const orden = ctx.ORDEN_HEMI || [];
  const enlaces = provs.map(p => `<li><b>${esc(nombreP(p))}</b> · ${T.provincias[p].esc} escaños · <a href="${FUERA.diputados(T.provincias[p].n)}">sus diputados</a> · <a href="${FUERA.elecciones(T.provincias[p].n)}">su historia electoral</a></li>`).join("");
  return `<div class="sec-h"><h2>En el Congreso</h2><p>Cada escaño de ${esc(tipo === "ccaa" ? nombreC(cod) : nombreP(cod))} representa a ${fmt(hX)} habitantes; la media de España es ${fmt(hE)}. ${hX < hE ? `Aquí hacen falta ${pct(1 - hX / hE, 0)} menos habitantes por diputado` : `Aquí hacen falta ${pct(hX / hE - 1, 0)} más habitantes por diputado`} que en el conjunto del país.</p></div>
    <div class="chart"><ul class="geo-enlaces">${enlaces}</ul>
    ${dips.length ? `<h3 style="margin-top:12px">Sus ${dips.length} diputados en la XV legislatura</h3><div class="geo-chips">${dips.sort((a, b) => orden.indexOf(a[1]) - orden.indexOf(b[1]) || a[0].localeCompare(b[0], "es")).map(d => `<a class="geo-chip" href="${FUERA.diputado(d[0])}"><i style="background:${ctx.G?.[d[1]]?.color || "var(--line-strong)"}"></i>${esc(ctx.legible ? ctx.legible(d[0]) : d[0])}</a>`).join("")}</div>` : ""}</div>`;
}

/* Gráfico de líneas con el índice (primer año = 100), con cruceta y tooltip. */
function lineaIndice(cont, series){
  const anios = T.anios, W = Math.max(300, cont.clientWidth || 520), H = 230, m = {l: 34, r: 140, t: 10, b: 22};
  const idx = series.map(s => s.v.map(v => v / s.v[0] * 100));
  const todos = idx.flat(), lo = Math.floor(Math.min(95, ...todos) / 5) * 5, hi = Math.ceil(Math.max(105, ...todos) / 5) * 5;
  const x = i => m.l + i / (anios.length - 1) * (W - m.l - m.r), y = v => m.t + (hi - v) / (hi - lo) * (H - m.t - m.b);
  const paso = (hi - lo) > 60 ? 20 : (hi - lo) > 30 ? 10 : 5;
  let ejes = "";
  for (let v = lo; v <= hi; v += paso) ejes += `<line class="eje" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"${v === 100 ? ' style="stroke:var(--line-strong)"' : ""}/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  anios.forEach((a, i) => { if (a % 5 === 0 || i === anios.length - 1) ejes += `<text x="${x(i)}" y="${H - 4}" text-anchor="middle">${a}</text>`; });
  // Etiquetas al final de cada línea, separadas para que no se pisen.
  const finales = idx.map((s, k) => ({k, y: y(s[s.length - 1])})).sort((a, b) => a.y - b.y);
  for (let i = 1; i < finales.length; i++) if (finales[i].y - finales[i - 1].y < 14) finales[i].y = finales[i - 1].y + 14;
  const etiquetas = finales.map(f => `<text class="et" x="${W - m.r + 8}" y="${f.y + 4}" style="fill:${series[f.k].color}">${esc(series[f.k].nombre.length > 19 ? series[f.k].nombre.slice(0, 18) + "…" : series[f.k].nombre)} ${dec(idx[f.k][idx[f.k].length - 1], 0)}</text>`).join("");
  cont.innerHTML = `<svg class="geo-linea" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución de la población desde ${anios[0]}">${ejes}
    ${idx.map((s, k) => `<path d="${s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("")}" fill="none" stroke="${series[k].color}" stroke-width="${k ? 1.6 : 2.4}" stroke-linejoin="round"/>`).join("")}
    ${etiquetas}<line class="cruz" y1="${m.t}" y2="${H - m.b}" x1="-10" x2="-10"/><rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/></svg>`;
  const svg = cont.querySelector("svg"), cruz = svg.querySelector(".cruz");
  svg.addEventListener("mousemove", ev => {
    const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(anios.length - 1, Math.round((px - m.l) / (W - m.l - m.r) * (anios.length - 1))));
    cruz.setAttribute("x1", x(i)); cruz.setAttribute("x2", x(i));
    tip(`<b>${anios[i]}</b>${series.map((s, k) => `<div class="f"><span><i style="background:${s.color}"></i>${esc(s.nombre)}</span><b>${fmt(s.v[i])}</b></div>`).join("")}<small>Índice ${anios[0]} = 100: ${idx.map(s => dec(s[i], 0)).join(" · ")}</small>`, ev);
  });
  svg.addEventListener("mouseleave", () => { cruz.setAttribute("x1", -10); cruz.setAttribute("x2", -10); tip(""); });
}

/* ---------- municipio a municipio (en las fichas) ---------- */
const MLENTES = [
  {id: "crec", t: "Desde 1996", v: r => r[5] ? r[4] / r[5] - 1 : null, f: v => signo(v), div: true, lim: .6},
  {id: "dens", t: "Densidad", v: r => r[3] ? r[4] / r[3] : null, f: v => dec(v, v < 10 ? 1 : 0) + " hab./km²", escala: "log", tono: "neutro"},
  {id: "pob", t: "Población", v: r => r[4], f: v => fmt(v) + " hab.", escala: "log", tono: "neutro"},
  {id: "may65", t: "Mayores de 65", v: r => r[8] != null ? r[8] / 100 : null, f: v => pct(v, 0), tono: "edad"},
  {id: "edad", t: "Edad media", v: r => r[7], f: v => dec(v, 1) + " años", tono: "edad"},
  {id: "renta", t: "Renta por persona", v: r => r[6], f: v => fmt(v) + " €", tono: "renta"},
  {id: "gana", t: "Primera fuerza el 23J", v: r => r[9]},
];
let mLente = "crec";
async function municipios(sec, tipo, cod, provs){
  const [M, GM] = await Promise.all([pedir(RUTAS.datos + "municipios.json"), pedir(RUTAS.municipios)]);
  if (!M || !GM){ sec.querySelector(".nota").textContent = "No se ha podido cargar el mapa municipal."; return; }
  const cods = Object.keys(M.m).filter(c => provs.includes(c.slice(0, 2)));
  const bb = tipo === "ccaa" ? GC.ccaa[cod].bb : GP.provincias[cod].bb;
  const R = c => M.m[c];
  const mayores = cods.slice().sort((a, b) => R(b)[4] - R(a)[4]).slice(0, 8);
  const conBase = cods.filter(c => R(c)[5] >= 1000);
  const porCambio = conBase.slice().sort((a, b) => (R(b)[4] / R(b)[5]) - (R(a)[4] / R(a)[5]));
  const item = c => `<li><button data-mu="${c}">${esc(R(c)[0])}</button><span class="m">${fmt(R(c)[4])} · ${R(c)[5] ? signo(R(c)[4] / R(c)[5] - 1, 0) : "nuevo"}</span></li>`;
  sec.innerHTML = `<div class="sec-h"><h2>Municipio a municipio</h2>
      <div class="geo-ctl"><select id="geo-ml" aria-label="Qué se pinta en el mapa municipal">${MLENTES.map(l => `<option value="${l.id}"${l.id === mLente ? " selected" : ""}>${esc(l.t)}</option>`).join("")}</select>
        <input id="geo-mq" list="geo-mlist" placeholder="Busca un municipio" aria-label="Buscar un municipio" autocomplete="off"><datalist id="geo-mlist">${cods.map(c => `<option value="${esc(R(c)[0])}">`).join("")}</datalist></div></div>
    <div class="geo-mapa-y-rank"><div class="chart"><div id="geo-mmapa"></div><div id="geo-mley"></div></div>
      <div style="display:grid;gap:12px;align-content:start"><div id="geo-mficha" class="geo-muni-ficha"><span class="nota">Pulsa un municipio del mapa o búscalo.</span></div>
        <div class="chart"><h3>Los más poblados</h3><ul class="geo-lista">${mayores.map(item).join("")}</ul></div></div></div>
    ${porCambio.length > 6 ? `<div class="geo-tres" style="margin-top:12px"><div class="chart"><h3>Los que más crecen desde ${M.anio0}</h3><p class="sub">Entre los que tenían 1.000 habitantes o más.</p><ul class="geo-lista">${porCambio.slice(0, 6).map(item).join("")}</ul></div>
      <div class="chart"><h3>Los que más se vacían</h3><p class="sub">Entre los que tenían 1.000 habitantes o más.</p><ul class="geo-lista">${porCambio.slice(-6).reverse().map(item).join("")}</ul></div></div>` : ""}`;
  const borde = provs.length > 1 ? provs.map(p => `<path class="borde" d="${GP.provincias[p].d}"/>`).join("") : "";
  const pintar = () => {
    const l = MLENTES.find(x => x.id === mLente);
    let color, ley;
    if (l.id === "gana"){
      const fam = M.orden, F = M.familias;
      color = c => R(c)[9] != null ? F[fam[R(c)[9]]]?.[1] : null;
      const usados = [...new Set(cods.map(c => R(c)[9]).filter(x => x != null))];
      ley = `<div class="geo-ley">${usados.map(k => `<span><i style="background:${F[fam[k]][1]}"></i>${esc(partido(M, k))}</span>`).join("")}</div>`;
    } else {
      const s = l.lim ? escala({...l, f: l.f}, [-l.lim, l.lim]) : escala(l, cods.map(c => l.v(R(c))));
      color = c => { const v = l.v(R(c)); return v == null ? null : s.color(l.lim ? Math.max(-l.lim, Math.min(l.lim, v)) : v); };
      ley = s.leyenda.replace(/<span>([^<]*)<\/span>(<span class="r")/, l.lim ? `<span>${l.f(-l.lim)} o menos</span>$2` : "<span>$1</span>$2");
    }
    sec.querySelector("#geo-mmapa").innerHTML = `<svg class="geo-mapa" viewBox="${vbDe(bb, .03)}" role="img" aria-label="Mapa municipal">${cods.map(c => GM.municipios[c] ? `<path class="m" d="${GM.municipios[c][1]}" data-mu="${c}" style="fill:${color(c) || "var(--sunk)"}"/>` : "").join("")}${borde}</svg>`;
    sec.querySelector("#geo-mley").innerHTML = ley + (l.id === "renta" || l.id === "edad" || l.id === "may65" ? `<p class="nota" style="margin:6px 0 0">Atlas de renta del INE (${T.fuentes.renta}). En gris, municipios sin dato (los más pequeños, por secreto estadístico).</p>` : "");
  };
  const elegir = c => {
    if (!c || !M.m[c]) return;
    const r = R(c), F = M.familias;
    sec.querySelectorAll("#geo-mmapa .m.sel").forEach(x => x.classList.remove("sel"));
    const p = sec.querySelector(`#geo-mmapa [data-mu="${c}"]`); if (p){ p.classList.add("sel"); p.parentNode.appendChild(p); }
    sec.querySelector("#geo-mficha").innerHTML = `<b>${esc(r[0])}</b> <small class="nota">${esc(nombreP(c.slice(0, 2)))}</small><dl>
      <dt>Habitantes</dt><dd>${fmt(r[4])} (${M.anio})</dd>
      <dt>En ${M.anio0}</dt><dd>${r[5] ? `${fmt(r[5])} (${signo(r[4] / r[5] - 1)})` : "no existía o sin dato"}</dd>
      <dt>Superficie</dt><dd>${dec(r[3], r[3] < 10 ? 1 : 0)} km² · ${dec(r[4] / r[3], r[4] / r[3] < 10 ? 1 : 0)} hab./km²</dd>
      ${r[7] != null ? `<dt>Edad media</dt><dd>${dec(r[7])} años · ${dec(r[8], 0)} % con 65 o más</dd>` : ""}
      ${r[6] != null ? `<dt>Renta</dt><dd>${fmt(r[6])} € por persona (España: ${fmt(T.espana.renta)} €)</dd>` : ""}
      ${r[9] != null ? `<dt>23J</dt><dd><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${F[M.orden[r[9]]][1]}"></i> ganó ${esc(partido(M, r[9]))}</dd>` : ""}</dl>`;
  };
  sec.querySelector("#geo-ml").addEventListener("change", e => { mLente = e.target.value; pintar(); });
  sec.querySelector("#geo-mq").addEventListener("change", e => { const q = sl(e.target.value); elegir(cods.find(c => sl(R(c)[0]) === q) || cods.find(c => sl(R(c)[0]).startsWith(q))); });
  sec.addEventListener("click", ev => { const b = ev.target.closest("[data-mu]"); if (b) elegir(b.dataset.mu); });
  conTip(sec.querySelector("#geo-mmapa"), ev => {
    const p = ev.target.closest("[data-mu]"); if (!p) return "";
    const r = R(p.dataset.mu), l = MLENTES.find(x => x.id === mLente), v = l.v(r);
    return `<b>${esc(r[0])}</b><br>${fmt(r[4])} habitantes<br>${esc(l.t)}: <b>${l.id === "gana" ? (v != null ? esc(partido(M, v)) : "–") : v == null ? "sin dato" : l.f(v)}</b>`;
  });
  pintar();
  if (municipioPendiente){ elegir(municipioPendiente); sec.scrollIntoView({block: "start"}); window.scrollBy(0, -70); municipioPendiente = null; }
}
let municipioPendiente = null;
function irAMunicipio(el, ine){
  const p = ine.slice(0, 2);
  if (!T.provincias[p]) return render(el, ctx, "");
  municipioPendiente = ine;
  const cc = T.provincias[p].ccaa;
  return uni(cc) ? ficha(el, "ccaa", cc) : ficha(el, "prov", p);
}

/* =====================================================================================================
   HISTORIA: los ejes de la España municipal, con un mapa fijo de los ocho mil municipios que cambia al bajar.
   Cada eje agrupa los municipios (por tamaño, por cuánto se vacían, por edad, por renta…), cuenta cómo votan
   y, al pasar por un grupo, lo ilumina en el mapa. «Presentar» la recorre con el teclado, para un directo.
   ===================================================================================================== */
const BLOQUES = [["PP", "PP"], ["PSOE", "PSOE"], ["VOX", "Vox"], ["IZQ", "Sumar"], ["OTROS", "Otros"]];
const OTROS_COLOR = "#8A8F98";

/* Votos de un municipio agrupados en los cuatro grandes y el resto, y los dos bloques (para el giro). */
function agrupar(fila, orden){
  const g = {PP: 0, PSOE: 0, VOX: 0, IZQ: 0, OTROS: 0, der: 0, izq: 0, val: 0, votantes: fila[1]};
  orden.forEach((f, i) => {
    const v = fila[2 + i] || 0; g.val += v;
    g[["PP", "PSOE", "VOX", "IZQ"].includes(f) ? f : "OTROS"] += v;
    if (f === "PP" || f === "VOX" || f === "CS") g.der += v;
    if (f === "PSOE" || f === "IZQ") g.izq += v;
  });
  return g;
}
/* Resumen de un grupo de municipios: cuántos, cuánta gente, cuánto territorio y cómo votó. */
function resumen(lista){
  const r = {n: lista.length, pob: 0, pob0: 0, pobCon0: 0, km2: 0, val: 0, PP: 0, PSOE: 0, VOX: 0, IZQ: 0, OTROS: 0};
  for (const d of lista){
    r.pob += d.pob; r.km2 += d.km2;
    if (d.pob0){ r.pob0 += d.pob0; r.pobCon0 += d.pob; }
    if (d.v){ r.val += d.v.val; BLOQUES.forEach(([k]) => { r[k] += d.v[k]; }); }
  }
  r.sh = k => r.val ? r[k] / r.val : 0;
  r.crec = r.pob0 ? r.pobCon0 / r.pob0 - 1 : null;
  return r;
}

async function historia(el){
  el.innerHTML = `<nav class="geo-migas" aria-label="Estás en"><a href="#geografia">Geografía</a></nav><p class="nota">Cargando los municipios…</p>`;
  const [M, V23, V19] = await Promise.all([pedir(RUTAS.datos + "municipios.json"), pedir(RUTAS.voto23), pedir(RUTAS.voto19)]);
  if (!M){ el.innerHTML = `<p class="nota">No se han podido cargar los municipios.</p>`; return; }
  const F = M.familias, ORD = M.orden;
  const colorBloque = k => k === "OTROS" ? OTROS_COLOR : F[k]?.[1] || OTROS_COLOR;
  const D = Object.entries(M.m).map(([c, r]) => {
    const d = {c, n: r[0], x: r[1], y: r[2], km2: r[3] || 0, pob: r[4], pob0: r[5], renta: r[6], edad: r[7], may65: r[8], gana: r[9]};
    const a = V23?.municipios[c], b = V19?.municipios[c];
    d.v = a ? agrupar(a, V23.orden) : null;
    const w = b ? agrupar(b, V19.orden) : null;
    // Giro: cuántos puntos ganó el bloque de PP, Vox y Cs sobre el de PSOE y Sumar (UP en 2019) entre las dos elecciones.
    d.giro = d.v && w && d.v.val && w.val ? ((d.v.der - d.v.izq) / d.v.val - (w.der - w.izq) / w.val) * 100 : null;
    d.dens = d.km2 ? d.pob / d.km2 : null;
    return d;
  });
  const N = D.length, TOT = resumen(D), total = TOT.pob, kmTot = TOT.km2;
  const sh = (r, k) => pct(r.sh(k), 0);
  const n = x => `<span class="num">${x}</span>`;

  // ---------- cifras ----------
  const porGanador = {}; D.forEach(d => { if (d.gana != null){ (porGanador[d.gana] ||= []).push(d); } });
  const ganadores = Object.entries(porGanador).sort((a, b) => b[1].length - a[1].length);
  // El partido que gana en muchos municipios pequeños: más municipios que gente (entre los que ganan en cien o más).
  const pobDe = l => l.reduce((s, d) => s + d.pob, 0);
  const [gP, lP] = ganadores.filter(([, l]) => l.length >= 100).sort((a, b) => (b[1].length / pobDe(b[1])) - (a[1].length / pobDe(a[1])))[0];
  const porPob = D.slice().sort((a, b) => b.pob - a.pob);
  let mitad = 0; { let acum = 0; for (const d of porPob){ acum += d.pob; mitad++; if (acum >= total / 2) break; } }
  const cien = D.filter(d => d.pob < 100).length;
  // Cuartos de población por renta (ordenados de más a menos renta).
  const conRenta = D.filter(d => d.renta != null).sort((a, b) => b.renta - a.renta), pobRenta = conRenta.reduce((s, d) => s + d.pob, 0);
  const cortes = []; { let acum = 0, q = 1; for (const d of conRenta){ acum += d.pob; if (acum >= pobRenta * q / 4 && q < 4){ cortes.push(d.renta); q++; } } }
  const ps = Object.entries(T.provincias).map(([c, p]) => ({c, h: pobHoy(p) / p.esc})).sort((a, b) => a.h - b.h);
  const conGiro = D.filter(d => d.giro != null), aDer = conGiro.filter(d => d.giro > 0);
  const bloque = V => { let der = 0, izq = 0, val = 0; Object.values(V.municipios).forEach(f => { const g = agrupar(f, V.orden); der += g.der; izq += g.izq; val += g.val; }); return {der: der / val, izq: izq / val}; };
  const B23 = V23 ? bloque(V23) : null, B19 = V19 ? bloque(V19) : null;

  // ---------- los ejes: cada uno, unos grupos de municipios ----------
  const rS = rampa(TONO.neutro), rE = rampa(TONO.edad), rR = rampa(TONO.renta);
  const EJES = {
    ciudad: {alto: rS(1), cubos: [
      {k: "gc", t: "Grandes ciudades", s: "100.000 habitantes o más", f: d => d.pob >= 1e5, col: rS(1)},
      {k: "cm", t: "Ciudades medias", s: "de 20.000 a 100.000", f: d => d.pob >= 2e4 && d.pob < 1e5, col: rS(.85)},
      {k: "pg", t: "Pueblos grandes", s: "de 5.000 a 20.000", f: d => d.pob >= 5e3 && d.pob < 2e4, col: rS(.7)},
      {k: "pu", t: "Pueblos", s: "de 1.000 a 5.000", f: d => d.pob >= 1e3 && d.pob < 5e3, col: rS(.56)},
      {k: "ru", t: "La España rural", s: "menos de 1.000", f: d => d.pob < 1e3, col: rS(.42)}]},
    vacia: {cubos: [
      {k: "va", t: "Se vacían", s: `pierden más del 25 % desde ${M.anio0}`, f: d => d.pob0 && d.pob / d.pob0 - 1 <= -.25, col: divergente(-1)},
      {k: "pi", t: "Pierden", s: "hasta un 25 % menos", f: d => d.pob0 && d.pob / d.pob0 - 1 > -.25 && d.pob < d.pob0, col: divergente(-.5)},
      {k: "cr", t: "Crecen", s: "hasta un 25 % más", f: d => d.pob0 && d.pob >= d.pob0 && d.pob / d.pob0 - 1 < .25, col: divergente(.5)},
      {k: "cm", t: "Crecen mucho", s: "más de un 25 %", f: d => d.pob0 && d.pob / d.pob0 - 1 >= .25, col: divergente(1)}]},
    edad: {alto: rE(1), cubos: [
      {k: "j", t: "Jóvenes", s: "menos del 18 % con 65 o más", f: d => d.may65 != null && d.may65 < 18, col: rE(.4)},
      {k: "m", t: "En la media", s: "del 18 al 25 %", f: d => d.may65 >= 18 && d.may65 < 25, col: rE(.6)},
      {k: "e", t: "Envejecidos", s: "del 25 al 33 %", f: d => d.may65 >= 25 && d.may65 < 100 / 3, col: rE(.8)},
      {k: "me", t: "Muy envejecidos", s: "uno de cada tres o más", f: d => d.may65 >= 100 / 3, col: rE(1)}]},
    dinero: {alto: rR(1), cubos: [
      {k: "a", t: "Renta alta", s: `más de ${fmt(cortes[0])} € por persona`, f: d => d.renta != null && d.renta >= cortes[0], col: rR(1)},
      {k: "ma", t: "Por encima de la media", s: `de ${fmt(cortes[1])} a ${fmt(cortes[0])} €`, f: d => d.renta >= cortes[1] && d.renta < cortes[0], col: rR(.8)},
      {k: "mb", t: "Por debajo de la media", s: `de ${fmt(cortes[2])} a ${fmt(cortes[1])} €`, f: d => d.renta >= cortes[2] && d.renta < cortes[1], col: rR(.6)},
      {k: "b", t: "Renta baja", s: `menos de ${fmt(cortes[2])} €`, f: d => d.renta != null && d.renta < cortes[2], col: rR(.4)}]},
  };
  for (const e of Object.values(EJES)) e.cubos.forEach(c => { c.lista = D.filter(c.f); c.r = resumen(c.lista); c.rgb = rgbDe(c.col); });
  const R = id => EJES[id].cubos.map(c => c.r);

  // Las Españas: regiones con nombre propio que no coinciden con el mapa autonómico (los «cinturones» de aquí).
  const prov = d => d.c.slice(0, 2), cc = d => T.provincias[prov(d)]?.ccaa;
  const ESPANAS = [
    {k: "laponia", t: "La Laponia del sur", f: d => d.dens != null && d.dens < 8 && !["07", "35", "38"].includes(prov(d)),
      d: r => `Los ${fmt(r.n)} municipios con menos de 8 habitantes por km², el umbral con el que la UE define las zonas muy escasamente pobladas, como la Laponia. Ocupan el ${pct(r.km2 / kmTot, 0)} de España y tienen ${habitantes(r.pob)}. Su corazón es la Serranía Celtibérica, entre Soria, Teruel, Cuenca y Guadalajara.`},
    {k: "castillas", t: "Las dos Castillas", f: d => ["07", "08"].includes(cc(d)),
      d: r => `Castilla y León y Castilla-La Mancha: el ${pct(r.km2 / kmTot, 0)} del territorio, el ${pct(r.pob / total, 0)} de la población y ${fmt(r.n)} municipios, más de la mitad de los de España.`},
    {k: "verde", t: "La España verde", f: d => ["12", "03", "06", "16"].includes(cc(d)),
      d: r => `Galicia, Asturias, Cantabria y el País Vasco: la cornisa atlántica y cantábrica, con ${habitantes(r.pob)}.`},
    {k: "medi", t: "El corredor mediterráneo", aprox: true, f: d => ["17", "08", "43", "12", "46", "03", "30", "04"].includes(prov(d)),
      d: r => `Las provincias de la costa mediterránea, de Girona a Almería: ${habitantes(r.pob)}, el ${pct(r.pob / total, 0)} de España, en el ${pct(r.km2 / kmTot, 0)} de su territorio.`},
    {k: "corona", t: "La corona de Madrid", f: d => prov(d) === "28" && d.c !== "28079",
      d: r => `Los ${fmt(r.n)} municipios de la Comunidad de Madrid sin la capital, con ${habitantes(r.pob)}: ${r.crec != null ? `han crecido un ${pct(r.crec, 0)} desde ${M.anio0}` : ""}.`},
    {k: "islas", t: "Las islas", f: d => ["07", "35", "38"].includes(prov(d)),
      d: r => `Baleares y Canarias: ${habitantes(r.pob)}${r.crec != null ? `, un ${pct(r.crec, 0)} más que en ${M.anio0}` : ""}.`},
    {k: "grandes", t: "Las grandes capitales", f: d => d.pob >= 25e4,
      d: r => `Los ${r.n} municipios de más de 250.000 habitantes. En ellos vive el ${pct(r.pob / total, 0)} de la población.`},
  ];
  ESPANAS.forEach(e => { e.lista = D.filter(e.f); e.r = resumen(e.lista); e.set = new Set(e.lista.map(d => d.c)); });

  // ---------- textos de cada paso ----------
  const barra = r => `<div class="geo-barra" role="img" aria-label="${BLOQUES.map(([k, t]) => `${t} ${pct(r.sh(k), 0)}`).join(", ")}">${BLOQUES.map(([k]) => r[k] ? `<i style="flex:${r[k]};background:${colorBloque(k)}"></i>` : "").join("")}</div>`;
  const partidos = `<div class="geo-partidos">${BLOQUES.map(([k, t]) => `<span><i style="background:${colorBloque(k)}"></i>${t}</span>`).join("")}<span>· voto del 23J</span></div>`;
  const cubos = id => `<div class="geo-cubos" data-eje="${id}">${EJES[id].cubos.map(c => `<div class="geo-cubo" data-cubo="${c.k}" tabindex="0"><i style="background:${c.col}"></i>
      <div class="c1"><b>${esc(c.t)}</b><small>${fmt(c.r.n)} municipios · ${pct(c.r.pob / total, 0)} de la gente</small></div><div class="c2">${esc(c.s)}${c.r.val ? ` · PP ${sh(c.r, "PP")}, PSOE ${sh(c.r, "PSOE")}, Vox ${sh(c.r, "VOX")}, Sumar ${sh(c.r, "IZQ")}` : ""}</div>${barra(c.r)}</div>`).join("")}</div>${partidos}<p class="pista-t">Pasa el cursor (o toca) un grupo para iluminar sus municipios.</p>`;
  const espanas = () => `<div class="geo-esp-chips" role="group" aria-label="Elige una España">${ESPANAS.map(e => `<button data-espana="${e.k}" aria-pressed="${e.k === modo.espana}">${esc(e.t)}</button>`).join("")}</div>
    <div class="geo-esp-det"></div>
    <div class="geo-esp-tabla">${ESPANAS.map(e => `<button data-espana="${e.k}" class="${e.k === modo.espana ? "on" : ""}"><b>${esc(e.t)}</b>${barra(e.r)}<span class="v">${millones(e.r.pob).replace(" millones", " M")}</span></button>`).join("")}</div>${partidos}`;
  const detalleEspana = () => { const e = ESPANAS.find(x => x.k === modo.espana), r = e.r;
    return `<h4>${esc(e.t)}${e.aprox ? ` <small>· límites aproximados: provincias enteras</small>` : ""}</h4><p style="margin:0 0 6px;font-size:13.5px">${e.d(r)}</p>
      <p style="margin:0;font-size:13px;color:var(--muted)">El 23J: PP ${sh(r, "PP")}, PSOE ${sh(r, "PSOE")}, Vox ${sh(r, "VOX")}, Sumar ${sh(r, "IZQ")}, otros ${sh(r, "OTROS")}.${r.crec != null ? ` Población desde ${M.anio0}: ${signo(r.crec, 0)}.` : ""}</p>`; };

  const [cG, cCm, , , cRu] = R("ciudad"), [vVa, , , vCm] = R("vacia"), [eJ, , , eMe] = R("edad"), [dA, , , dB] = R("dinero");
  const mitadMay = D.filter(d => d.may65 >= 50).length;
  const PASOS = [
    {id: "engana", n: "El mapa engaña", k: "El mapa engaña", t: "El territorio no vota. La gente, sí.", html: () => `
      <p>Cada punto es un municipio, pintado del color del partido más votado el 23J. Vistos todos iguales, pesan lo mismo los ${n(fmt(cien))} pueblos de menos de cien vecinos que ${esc(porPob[0].n)}, con ${millones(porPob[0].pob)} de habitantes.</p>
      <p>Pero la mitad de la población vive en solo ${n(fmt(mitad))} municipios, el ${pct(mitad / N, 1)}. Si cada punto pesa lo que pesa su gente, el mapa cambia: unos pocos círculos enormes en un mar de pueblos pequeños, y hay colores que casi desaparecen. ${esc(partido(M, gP))} ganó en ${fmt(lP.length)} municipios, pero en ellos vive el ${pct(pobDe(lP) / total, 1)} de la gente.</p>
      <div class="geo-tam" role="group" aria-label="Tamaño de los puntos"><button data-tam="mun" aria-pressed="${modo.tam === "mun"}">Por municipio</button><button data-tam="pob" aria-pressed="${modo.tam === "pob"}">Por habitantes</button></div>`},
    {id: "ciudad", n: "Ciudad y campo", k: "Eje 1 · Ciudad y campo", t: "Las ciudades y los pueblos", html: () => `
      <p>Los ${n(fmt(cG.n))} municipios de más de cien mil habitantes reúnen al ${pct(cG.pob / total, 0)} de la población; los ${fmt(cRu.n)} de menos de mil, al ${pct(cRu.pob / total, 1)}. El 23J el PP sacó el ${sh(cRu, "PP")} de los votos en la España rural y el ${sh(cG, "PP")} en las grandes ciudades; Sumar, el ${sh(cRu, "IZQ")} y el ${sh(cG, "IZQ")}.</p>${cubos("ciudad")}`},
    {id: "vacia", n: "La España vacía", k: "Eje 2 · La España vacía", t: "La España que se vacía", html: () => `
      <p>${n(fmt(vVa.n))} municipios han perdido más de una cuarta parte de sus vecinos desde ${M.anio0}. Ocupan el ${n(pct(vVa.km2 / kmTot, 0))} del territorio y hoy vive en ellos el ${pct(vVa.pob / total, 1)} de la población. En el otro extremo, ${fmt(vCm.n)} municipios han crecido más de un 25 %, sobre todo en la costa, en las islas y alrededor de las grandes ciudades.</p>${cubos("vacia")}`},
    {id: "edad", n: "La edad", k: "Eje 3 · La edad", t: "Los pueblos que envejecen", html: () => `
      <p>En ${n(fmt(eMe.n))} municipios al menos uno de cada tres vecinos tiene 65 años o más, y en ${fmt(mitadMay)} ya son la mitad. El envejecimiento dibuja casi el mismo mapa que la pérdida de población: donde se van los jóvenes, quedan los mayores.</p>
      <p>Donde más mayores hay, el PP sacó el ${sh(eMe, "PP")} de los votos; en los municipios más jóvenes, el ${sh(eJ, "PP")}.</p>${cubos("edad")}`},
    {id: "dinero", n: "El dinero", k: "Eje 4 · El dinero", t: "La renta", html: () => `
      <p>Ordenados por renta neta por persona (Atlas de renta del INE, ${T.fuentes.renta}), cada grupo reúne a una cuarta parte de la población. El cuarto con más renta vive en ${n(fmt(dA.n))} municipios; el de menos, en ${fmt(dB.n)}.</p>
      <p>En los municipios de renta alta el PP sacó el ${sh(dA, "PP")} y el PSOE el ${sh(dA, "PSOE")}; en los de renta baja, el ${sh(dB, "PP")} y el ${sh(dB, "PSOE")}.</p>${cubos("dinero")}`},
    {id: "espanas", n: "Las Españas", k: "Eje 5 · Las Españas", t: "Las Españas que no salen en el mapa autonómico", html: () => `
      <p>Hay regiones que comparten paisaje, economía y forma de vivir sin coincidir con una comunidad. Elige una para ver dónde está, cuánta gente vive en ella y cómo votó.</p>${espanas()}`},
    {id: "giro", n: "El giro", k: "Eje 6 · El giro", t: "Hacia dónde se movió el mapa", html: () => B23 && B19 ? `
      <p>Entre noviembre de 2019 y julio de 2023, el bloque de PP, Vox y Cs pasó del ${pct(B19.der, 1)} al ${n(pct(B23.der, 1))} de los votos, y el de PSOE y Sumar (Unidas Podemos en 2019), del ${pct(B19.izq, 1)} al ${n(pct(B23.izq, 1))}.</p>
      <p>El ${n(pct(aDer.length / conGiro.length, 0))} de los municipios se movió hacia la derecha. Cada flecha apunta a la derecha si ganó terreno el bloque de PP, Vox y Cs, y a la izquierda si lo ganó el de PSOE y Sumar; cuanto más larga, mayor el giro, y cuanto más gruesa, más votantes. Los partidos nacionalistas y regionalistas no cuentan en ninguno de los dos bloques.</p>` : `<p>No se han podido cargar los resultados municipales.</p>`},
    {id: "peso", n: "El peso del voto", k: "Eje 7 · El peso del voto", t: "Un voto, distinto peso", html: () => `
      <p>Los escaños no se reparten por municipios ni por territorio, sino por provincias. Cada una tiene dos fijos y el resto va por población.</p>
      <p>Por eso en ${esc(nombreP(ps[0].c))} un diputado representa a ${n(fmt(ps[0].h))} habitantes, y en ${esc(nombreP(ps[ps.length - 1].c))}, a ${n(fmt(ps[ps.length - 1].h))}: un voto de ${esc(nombreP(ps[0].c))} pesa ${dec(ps[ps.length - 1].h / ps[0].h, 1)} veces más.</p>`},
    {id: "fichas", n: "Las fichas", k: "Y ahora, tu provincia", t: "Cada comunidad, cada provincia", html: () => `
      <p>Detrás de cada punto hay un municipio con su ficha: pulsa cualquiera en el mapa. Y cada comunidad y cada provincia tiene la suya, con su evolución, sus datos frente a España y sus diputados.</p><p><a href="#geografia">Ver todas las comunidades y provincias →</a></p>`},
  ];
  const caja = (p, i) => `<div class="geo-kicker">${esc(p.k)}</div><h3>${esc(p.t)}</h3>${p.html()}`;

  el.innerHTML = `<nav class="geo-migas" aria-label="Estás en"><a href="#geografia">Geografía</a> <span>›</span> <span>La España que no sale en el mapa</span></nav>
    <div class="view-intro"><div><div class="eyebrow">Geografía · ${fmt(N)} municipios</div><h2>La España que no sale en el mapa</h2><p>Siete ejes para entender España municipio a municipio: ciudad y campo, la España vacía, la edad, el dinero, las Españas que no salen en el mapa autonómico, el giro del voto y su peso. Baja, pasa el cursor por los gráficos o pulsa Presentar para recorrerla en directo.</p></div>
      <button class="geo-pres-btn" data-presentar>Presentar ▶</button></div>
    <div class="geo-story"><div class="geo-pasos">${PASOS.map((p, i) => `<section class="geo-paso" data-paso="${i}" id="geo-paso-${i}"><div class="caja geo-caja">${caja(p, i)}</div></section>`).join("")}</div>
      <div class="geo-fijo"><nav class="geo-indice" aria-label="Ejes de la historia">${PASOS.map((p, i) => `<button data-ir-paso="${i}">${esc(p.n)}</button>`).join("")}</nav><canvas aria-label="Mapa de los municipios de España" role="img"></canvas><div class="pie" id="geo-pie"></div></div>
      <div class="geo-pres" aria-live="polite"><div class="caja geo-caja"></div><nav><button data-pres="-1" aria-label="Anterior">←</button><span></span><button data-pres="1" aria-label="Siguiente">→</button><button data-pres="salir">Salir</button></nav></div></div>
    <p class="nota" style="margin-top:22px">Datos: INE (padrón municipal ${M.anio} y ${M.anio0}, Atlas de distribución de renta de los hogares ${T.fuentes.renta}) y Ministerio del Interior (generales de noviembre de 2019 y julio de 2023, sin el voto desde el extranjero). Los grupos de renta reparten la población en cuartos; los municipios sin dato del Atlas quedan fuera de ese eje. «El corredor mediterráneo» toma provincias enteras.</p>`;

  // ---------- el lienzo ----------
  const canvas = el.querySelector("canvas"), g = canvas.getContext("2d"), pie = el.querySelector("#geo-pie"), story = el.querySelector(".geo-story");
  const W0 = GP.ancho, H0 = GP.alto, contornos = Object.values(GP.provincias).map(p => new Path2D(p.d)), recuadro = new Path2D(GP.canarias);
  const linea = () => cssVar("--line", "#DCDDD8"), gris = () => hexRgb(cssVar("--line-strong", "#82868E"));
  const colGana = d => d.gana != null ? hexRgb(F[ORD[d.gana]][1]) : gris();
  const rPob = d => Math.max(.5, Math.sqrt(d.pob) * .025);
  const der = hexRgb(colorBloque("PP")), izq = hexRgb(colorBloque("PSOE"));
  const leyGana = () => { const usados = ganadores.slice(0, 7).map(([k]) => k);
    return `<div class="geo-ley">${usados.map(k => `<span><i style="background:${F[ORD[k]][1]}"></i>${esc(partido(M, k))}</span>`).join("")}<span>· más votado el 23J</span></div>`; };
  const leyCubos = id => `<div class="geo-ley">${EJES[id].cubos.map(c => `<span><i style="background:${c.col}"></i>${esc(c.t)}</span>`).join("")}<span><i style="background:var(--line-strong)"></i>Sin dato</span></div>`;
  // Lo que pinta cada paso: radio, color y opacidad de cada punto, flechas sí o no, y la leyenda.
  function estado(){
    const p = PASOS[modo.paso].id;
    if (p === "engana") return {r: modo.tam === "pob" ? rPob : () => 1.8, c: colGana, a: () => modo.tam === "pob" ? .65 : .85, pie: leyGana()};
    if (EJES[p]){
      const cs = EJES[p].cubos, de = d => cs.find(c => c.f(d)), sel = cs.find(c => c.k === modo.cubo);
      const alto = rgbDe(EJES[p].alto || sel?.col || "#888");   // el grupo elegido, con el tono entero para que destaque
      if (sel) return {r: d => sel.f(d) ? Math.max(1.9, rPob(d)) : 1.1, c: d => sel.f(d) ? (EJES[p].alto ? alto : sel.rgb) : gris(), a: d => sel.f(d) ? .95 : .12, pie: leyCubos(p)};
      // Del tamaño de su gente (con un mínimo para que se vean los pueblos), como en «Por habitantes».
      return {r: d => Math.max(1.5, rPob(d)), c: d => de(d)?.rgb || gris(), a: d => de(d) ? .8 : .25, pie: leyCubos(p)};
    }
    if (p === "espanas"){
      const e = ESPANAS.find(x => x.k === modo.espana);
      return {r: d => e.set.has(d.c) ? Math.max(1.3, rPob(d)) : 1.1, c: d => e.set.has(d.c) ? colGana(d) : gris(), a: d => e.set.has(d.c) ? .8 : .1, pie: leyGana()};
    }
    if (p === "giro") return {r: () => 1, c: () => gris(), a: () => .14, flechas: 1,
      pie: `<div class="geo-ley"><span><i style="background:${colorBloque("PP")}"></i>→ hacia PP, Vox y Cs</span><span><i style="background:${colorBloque("PSOE")}"></i>← hacia PSOE y Sumar</span><span>· de 2019 a 2023</span></div>`};
    return {r: rPob, c: colGana, a: () => .7, pie: leyGana()};
  }
  const orden = D.map((d, i) => i).sort((a, b) => D[b].pob - D[a].pob);
  const cur = D.map(() => ({r: 1.8, c: [128, 128, 128], a: .8})), desde = cur.map(x => ({...x})), hacia = cur.map(x => ({...x}));
  let flechas = 0, flechas0 = 0, flechas1 = 0, anim = null, k = 1, ox = 0, oy = 0, dpr = 1;
  const medir = () => {
    const r = canvas.getBoundingClientRect(); dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    k = Math.min(r.width / W0, r.height / H0); ox = (r.width - W0 * k) / 2; oy = (r.height - H0 * k) / 2;
  };
  const dibujar = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
    g.save(); g.translate(ox, oy); g.scale(k, k);
    g.strokeStyle = linea(); g.lineWidth = .8 / k;
    contornos.forEach(p => g.stroke(p)); g.stroke(recuadro);
    const esc2 = Math.max(.75, Math.min(1.4, 1 / (k * 1.3)));
    for (const i of orden){
      const s = cur[i]; if (s.a <= .01) continue;
      g.globalAlpha = s.a; g.fillStyle = `rgb(${s.c[0]},${s.c[1]},${s.c[2]})`;
      g.beginPath(); g.arc(D[i].x, D[i].y, Math.max(.45, s.r * (s.r > 3 ? 1 : esc2)), 0, Math.PI * 2); g.fill();
    }
    if (flechas > .01){
      g.lineCap = "round";
      for (const i of orden){
        const d = D[i]; if (d.giro == null || !d.v) continue;
        const largo = Math.max(-26, Math.min(26, d.giro * .9)) * flechas, ancho = Math.min(4, .35 + Math.sqrt(d.v.votantes) / 110);
        if (Math.abs(largo) < .6) continue;
        const c = d.giro > 0 ? der : izq;
        g.globalAlpha = Math.min(.85, .35 + ancho / 5) * flechas; g.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.lineWidth = ancho;
        const x1 = d.x + largo, pu = Math.sign(largo) * Math.min(3, Math.abs(largo) * .4);
        g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(x1, d.y); g.moveTo(x1 - pu, d.y - pu * .7); g.lineTo(x1, d.y); g.lineTo(x1 - pu, d.y + pu * .7); g.stroke();
      }
    }
    g.restore(); g.globalAlpha = 1;
  };
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function aplicar(dur = 900){
    const E = estado();
    D.forEach((d, i) => { desde[i] = {...cur[i], c: [...cur[i].c]}; hacia[i] = {r: E.r(d), c: E.c(d), a: E.a(d)}; });
    flechas0 = flechas; flechas1 = E.flechas || 0;
    pie.innerHTML = E.pie;
    if (anim) cancelAnimationFrame(anim);
    const t0 = performance.now(), T0 = reducido ? 1 : dur, ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const frame = ahora => {
      const t = ease(Math.min(1, (ahora - t0) / T0));
      for (let i = 0; i < D.length; i++){
        const a = desde[i], b = hacia[i], s = cur[i];
        s.r = a.r + (b.r - a.r) * t; s.a = a.a + (b.a - a.a) * t;
        s.c = [0, 1, 2].map(q => Math.round(a.c[q] + (b.c[q] - a.c[q]) * t));
      }
      flechas = flechas0 + (flechas1 - flechas0) * t;
      dibujar();
      if (t < 1) anim = requestAnimationFrame(frame);
    };
    anim = requestAnimationFrame(frame);
  }

  // ---------- pasos, interacción y modo presentación ----------
  let presentando = false;
  const pres = el.querySelector(".geo-pres");
  function pintarDetalle(raiz){ raiz.querySelectorAll(".geo-esp-det").forEach(x => { x.innerHTML = detalleEspana(); }); }
  function ir(j, {forzar = false} = {}){
    j = Math.max(0, Math.min(PASOS.length - 1, j));
    if (j === modo.paso && !forzar) return;
    modo.paso = j; modo.cubo = null;
    el.querySelectorAll(".geo-paso").forEach(p => p.classList.toggle("activo", +p.dataset.paso === j));
    el.querySelectorAll("[data-ir-paso]").forEach(b => { const si = +b.dataset.irPaso === j; if (si){ b.setAttribute("aria-current", "step"); const nav = b.parentNode; if (b.offsetLeft < nav.scrollLeft || b.offsetLeft + b.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = b.offsetLeft - 8; } else b.removeAttribute("aria-current"); });
    if (presentando){
      pres.querySelector(".caja").innerHTML = caja(PASOS[j], j); pintarDetalle(pres);
      pres.querySelector("nav span").textContent = `${j + 1} / ${PASOS.length}`;
      pres.querySelector('[data-pres="-1"]').disabled = j === 0; pres.querySelector('[data-pres="1"]').disabled = j === PASOS.length - 1;
    }
    aplicar();
  }
  const irA = j => {
    if (presentando) return ir(j);
    const c = el.querySelector(`#geo-paso-${j} .caja`), r = c.getBoundingClientRect();
    window.scrollTo({top: scrollY + r.top - Math.max(80, (innerHeight - r.height) / 2), behavior: reducido ? "auto" : "smooth"});
  };
  const pasoDe = nodo => { const s = nodo.closest("[data-paso]"); return s ? +s.dataset.paso : modo.paso; };
  el.addEventListener("click", ev => {
    const t = ev.target;
    const ip = t.closest("[data-ir-paso]"); if (ip) return irA(+ip.dataset.irPaso);
    const tm = t.closest("[data-tam]"); if (tm){ modo.tam = tm.dataset.tam; el.querySelectorAll("[data-tam]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tam === modo.tam))); if (pasoDe(tm) !== modo.paso) ir(pasoDe(tm)); else aplicar(700); return; }
    const es = t.closest("[data-espana]"); if (es){ modo.espana = es.dataset.espana;
      el.querySelectorAll("[data-espana]").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.espana === modo.espana)); b.classList.toggle("on", b.dataset.espana === modo.espana); });
      pintarDetalle(el); if (pasoDe(es) !== modo.paso) ir(pasoDe(es)); else aplicar(600); return; }
    const cu = t.closest("[data-cubo]"); if (cu){ marcarCubo(cu, modo.cubo === cu.dataset.cubo ? null : cu.dataset.cubo); return; }
    const pr = t.closest("[data-presentar]"); if (pr) return presentar(true);
    const pn = t.closest("[data-pres]"); if (pn){ if (pn.dataset.pres === "salir") presentar(false); else ir(modo.paso + +pn.dataset.pres); }
  });
  function marcarCubo(nodo, k){
    const j = pasoDe(nodo); if (j !== modo.paso) ir(j);
    modo.cubo = k;
    el.querySelectorAll("[data-cubo]").forEach(x => x.classList.toggle("on", x.dataset.cubo === k && x.closest("[data-eje]") === nodo.closest("[data-eje]")));
    aplicar(350);
  }
  el.addEventListener("mouseover", ev => { const cu = ev.target.closest("[data-cubo]"); if (cu && cu.dataset.cubo !== modo.cubo) marcarCubo(cu, cu.dataset.cubo); });
  el.addEventListener("mouseout", ev => { const de = ev.target.closest("[data-eje]"); if (de && !de.contains(ev.relatedTarget) && modo.cubo){ marcarCubo(de, null); } });
  el.addEventListener("focusin", ev => { const cu = ev.target.closest("[data-cubo]"); if (cu) marcarCubo(cu, cu.dataset.cubo); });
  function presentar(si){
    presentando = si; story.classList.toggle("presentando", si);
    document.documentElement.style.overflow = si ? "hidden" : "";
    if (si) ir(modo.paso, {forzar: true});
    else { const j = modo.paso; requestAnimationFrame(() => { medir(); dibujar(); el.querySelector(`#geo-paso-${j}`)?.scrollIntoView({block: "center"}); }); }
  }
  const tecla = ev => {
    if (!presentando) return;
    if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(ev.key)){ ev.preventDefault(); ir(modo.paso + 1); }
    else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(ev.key)){ ev.preventDefault(); ir(modo.paso - 1); }
    else if (ev.key === "Escape") presentar(false);
  };
  document.addEventListener("keydown", tecla);

  medir();
  const ro = new ResizeObserver(() => { medir(); dibujar(); }); ro.observe(canvas);
  const io = new IntersectionObserver(es => { if (presentando) return; es.forEach(e => { if (e.isIntersecting) ir(+e.target.dataset.paso); }); }, {rootMargin: "-45% 0px -45% 0px"});
  el.querySelectorAll(".geo-paso").forEach(p => io.observe(p));
  pintarDetalle(el);
  // Al salir de la historia se deja de vigilar, se suelta el teclado y se sale del modo presentación.
  const limpiar = new MutationObserver(() => { if (!el.contains(canvas)){ io.disconnect(); ro.disconnect(); limpiar.disconnect(); document.removeEventListener("keydown", tecla); document.documentElement.style.overflow = ""; } });
  limpiar.observe(el, {childList: true});
  modo.paso = -1; ir(0);
  if (new URLSearchParams(location.search).has("presentar")) presentar(true);

  // Tooltip y clic: el municipio más cercano al puntero.
  const cercano = ev => {
    const r = canvas.getBoundingClientRect(), mx = (ev.clientX - r.left - ox) / k, my = (ev.clientY - r.top - oy) / k;
    let mejor = -1, dm = Infinity;
    for (let i = 0; i < D.length; i++){
      if (cur[i].a < .3 && !flechas) continue;
      const dx = D[i].x - mx, dy = D[i].y - my, d2 = dx * dx + dy * dy, lim = Math.max(cur[i].r, 5 / k);
      if (d2 < lim * lim && d2 - cur[i].r * cur[i].r < dm){ dm = d2 - cur[i].r * cur[i].r; mejor = i; }
    }
    return mejor;
  };
  canvas.addEventListener("mousemove", ev => {
    const i = cercano(ev); if (i < 0){ tip(""); return; }
    const d = D[i];
    tip(`<b>${esc(d.n)}</b> <small>${esc(nombreP(d.c.slice(0, 2)))}</small><br>${fmt(d.pob)} habitantes${d.pob0 ? ` (${signo(d.pob / d.pob0 - 1, 0)} desde ${M.anio0})` : ""}${d.may65 != null ? `<br>${dec(d.may65, 0)} % con 65 años o más` : ""}${d.renta != null ? ` · ${fmt(d.renta)} € por persona` : ""}${d.v ? `<br>23J: ${BLOQUES.slice(0, 4).map(([k2, t2]) => `${t2} ${pct(d.v[k2] / d.v.val, 0)}`).join(" · ")}` : ""}${d.giro != null && PASOS[modo.paso].id === "giro" ? `<br>Giro 2019→2023: ${d.giro > 0 ? "+" : "−"}${dec(Math.abs(d.giro), 1)} puntos hacia ${d.giro > 0 ? "PP, Vox y Cs" : "PSOE y Sumar"}` : ""}<br><small>Pulsa para ver su ficha</small>`, ev);
  });
  canvas.addEventListener("mouseleave", () => tip(""));
  canvas.addEventListener("click", ev => { const i = cercano(ev); if (i >= 0){ presentar(false); location.hash = `geografia-municipio-${D[i].c}`; } });
}
const modo = {paso: -1, cubo: null, tam: "mun", espana: "laponia"};
const rgbDe = s => s.startsWith("#") ? hexRgb(s) : s.match(/\d+/g).slice(0, 3).map(Number);
