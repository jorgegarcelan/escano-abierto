/* Sección «Geografía»: España, sus 19 comunidades y ciudades autónomas y sus 52 provincias, con los datos del INE.
   Autocontenida para poder servirse en otra web: index.html llama a render(el, ctx, sub) y todo lo demás (datos,
   estilos, mapas, tooltip) está aquí. De la web solo usa, si están, los diputados (ctx.DIPS, ctx.G) para la parte
   del Congreso, y enlaza a otras secciones a través de FUERA. Los datos salen de escano/geografia.py. */

const RUTAS = {
  datos: "datos/geografia/",
  provincias: "datos/elecciones/geo-provincias.json",   // geometrías de escano/geo.py (las comparte con elecciones)
  municipios: "datos/elecciones/geo-municipios.json",
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
/* la historia con el mapa fijo */
.geo-story{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.4fr);gap:28px;margin-top:10px}
.geo-fijo{position:sticky;top:72px;height:calc(100vh - 92px);display:grid;grid-template-rows:auto minmax(0,1fr) auto;align-self:start}
.geo-indice{display:flex;flex-wrap:wrap;gap:4px 6px;padding-bottom:6px}
.geo-indice button{appearance:none;font:500 12px var(--sans);color:var(--muted);background:none;border:1px solid var(--line);border-radius:var(--r-pill,999px);padding:3px 10px;cursor:pointer;white-space:nowrap}
.geo-indice button:hover{color:var(--ink);border-color:var(--line-strong)}
.geo-indice button[aria-current="step"]{color:var(--bg);background:var(--ink);border-color:var(--ink)}
.geo-indice b{font-family:var(--mono);font-weight:600;margin-right:5px;opacity:.7}
.geo-paso .etq{font:600 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.geo-fijo canvas{width:100%;height:100%;display:block;cursor:crosshair}
.geo-fijo .pie{min-height:44px;padding-top:6px}
.geo-pasos{grid-column:1;grid-row:1;padding-bottom:30vh}
.geo-fijo{grid-column:2;grid-row:1}
.geo-paso{min-height:88vh;display:flex;align-items:center}
.geo-paso:first-child{min-height:60vh;align-items:flex-start;padding-top:8vh}
.geo-paso .caja{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card-lg,14px);padding:18px 20px;box-shadow:var(--sombra,none);transition:opacity .3s,border-color .3s;opacity:.5}
.geo-paso.activo .caja{opacity:1;border-color:var(--line-strong)}
.geo-paso h3{font-size:21px;line-height:1.15;margin:0 0 8px;letter-spacing:-.01em}
.geo-paso p{margin:0 0 8px;font-size:15px;line-height:1.5}
.geo-paso p:last-child{margin-bottom:0}
.geo-paso .num{font-family:var(--display);font-weight:700;font-variant-numeric:tabular-nums}
@media (max-width:860px){
  .geo-story{grid-template-columns:1fr}
  .geo-fijo{grid-column:1;top:58px;height:54vh;z-index:0;background:var(--bg)}
  .geo-indice{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-top:4px}
  .geo-pasos{grid-column:1;grid-row:1;position:relative;z-index:1;margin-top:54vh}
  .geo-paso,.geo-paso:first-child{min-height:85vh;align-items:flex-end;padding:0 0 12vh}
  .geo-paso .caja{background:color-mix(in srgb,var(--surface) 94%,transparent);opacity:1}
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
   HISTORIA: un mapa fijo de los ocho mil municipios que cambia mientras se baja
   ===================================================================================================== */
async function historia(el){
  el.innerHTML = `<nav class="geo-migas" aria-label="Estás en"><a href="#geografia">Geografía</a></nav><p class="nota">Cargando los municipios…</p>`;
  const M = await pedir(RUTAS.datos + "municipios.json");
  if (!M){ el.innerHTML = `<p class="nota">No se han podido cargar los municipios.</p>`; return; }
  const F = M.familias, ORD = M.orden;
  const D = Object.entries(M.m).map(([c, r]) => ({c, n: r[0], x: r[1], y: r[2], km2: r[3] || 0, pob: r[4], pob0: r[5], renta: r[6], edad: r[7], may65: r[8], gana: r[9]}));
  // Cifras de la historia, calculadas aquí con los mismos datos que se pintan.
  const N = D.length, total = D.reduce((s, d) => s + d.pob, 0), kmTot = D.reduce((s, d) => s + d.km2, 0);
  const porPob = D.slice().sort((a, b) => b.pob - a.pob);
  let acum = 0, mitad = 0; for (const d of porPob){ acum += d.pob; mitad++; if (acum >= total / 2) break; }
  const peq = D.filter(d => d.pob < 1000), muyPeq = D.filter(d => d.pob < 100);
  const pobPeq = peq.reduce((s, d) => s + d.pob, 0), kmPeq = peq.reduce((s, d) => s + d.km2, 0);
  const con0 = D.filter(d => d.pob0), pierden = con0.filter(d => d.pob < d.pob0), total0 = con0.reduce((s, d) => s + d.pob0, 0);
  const pierdenKm = pierden.reduce((s, d) => s + d.km2, 0);
  const conEdad = D.filter(d => d.may65 != null), tercio = conEdad.filter(d => d.may65 >= 100 / 3), mitadMay = conEdad.filter(d => d.may65 >= 50);
  const conRenta = D.filter(d => d.renta != null && d.pob >= 1000).sort((a, b) => a.renta - b.renta);
  const rMin = conRenta[0], rMax = conRenta[conRenta.length - 1];
  const ps = Object.entries(T.provincias).map(([c, p]) => ({c, h: pobHoy(p) / p.esc})).sort((a, b) => a.h - b.h);
  const pMin = ps[0], pMax = ps[ps.length - 1];
  const gan = {}; D.forEach(d => { if (d.gana != null) gan[d.gana] = (gan[d.gana] || 0) + 1; });
  const ganPob = {}; D.forEach(d => { if (d.gana != null) ganPob[d.gana] = (ganPob[d.gana] || 0) + d.pob; });
  const topGan = Object.entries(gan).sort((a, b) => b[1] - a[1]);
  const n = x => `<span class="num">${x}</span>`;
  const PASOS = [
    {n: "Un punto, un municipio", t: `${fmt(N)} municipios`, p: [`Cada punto es un municipio de España, colocado en su sitio. Vistos así, todos iguales, el país parece lleno: hay un pueblo en casi cada rincón.`, `Baja para ver qué pasa cuando cada punto pesa lo que pesa su gente.`]},
    {n: "Dónde vive la gente", t: `La mitad de España vive en ${fmt(mitad)} municipios`, p: [`Ahora cada círculo tiene el tamaño de su población. Los ${n(fmt(mitad))} municipios más grandes —el ${pct(mitad / N)} del total— reúnen a la mitad de los ${millones(total)} de habitantes. La otra mitad se reparte entre los ${fmt(N - mitad)} restantes.`]},
    {n: "Los pueblos pequeños", t: `${pct(peq.length / N, 0)} de los municipios no llegan a mil habitantes`, p: [`Son ${n(fmt(peq.length))}, en naranja. Ocupan el ${n(pct(kmPeq / kmTot, 0))} del territorio, pero ahí vive solo el ${n(pct(pobPeq / total))} de la gente.`, `${fmt(muyPeq.length)} de ellos no llegan ni a cien vecinos.`]},
    {n: "Desde 1996", t: `${fmt(pierden.length)} municipios tienen menos gente que en ${M.anio0}`, p: [`En ${M.anio0} España tenía ${millones(total0)} de habitantes en estos municipios; hoy, ${millones(con0.reduce((s, d) => s + d.pob, 0))}. Pero el crecimiento no llegó a todas partes: en naranja, los que han perdido población (el ${pct(pierden.length / con0.length, 0)}), que suman el ${n(pct(pierdenKm / kmTot, 0))} del territorio. En azul, los que ganan, sobre todo en la costa, en las islas y alrededor de Madrid.`]},
    {n: "Los mayores", t: `En ${fmt(tercio.length)} municipios, uno de cada tres vecinos tiene 65 años o más`, p: [`Cuanto más intenso el color, más mayores. En ${n(fmt(mitadMay.length))} municipios los de 65 o más ya son la mitad. El envejecimiento dibuja casi el mismo mapa que la pérdida de población: donde se van los jóvenes, quedan los mayores.`]},
    {n: "La renta", t: `La renta, de ${fmt(rMin.renta)} a ${fmt(rMax.renta)} euros por persona`, p: [`Entre los municipios de más de mil habitantes, la renta neta media va de los ${fmt(rMin.renta)} € de ${esc(rMin.n)} (${esc(nombreP(rMin.c.slice(0, 2)))}) a los ${fmt(rMax.renta)} € de ${esc(rMax.n)} (${esc(nombreP(rMax.c.slice(0, 2)))}). La media de España, ponderada por población, es de ${fmt(T.espana.renta)} €.`, `Se nota una línea norte-sur, y el empuje de las grandes ciudades.`]},
    {n: "El voto", t: `Un voto, distinto peso`, p: [`El 23 de julio de 2023 ${esc(partido(M, topGan[0][0]))} fue la fuerza más votada en ${n(fmt(topGan[0][1]))} municipios; ${esc(topGan[1] ? partido(M, topGan[1][0]) : "")}, en ${fmt(topGan[1]?.[1] || 0)}. Pero los escaños no se reparten por municipios ni por superficie, sino por provincias.`, `Cada provincia tiene dos escaños fijos y el resto va por población. Por eso en ${esc(nombreP(pMin.c))} un diputado representa a ${n(fmt(pMin.h))} habitantes, y en ${esc(nombreP(pMax.c))}, a ${n(fmt(pMax.h))}.`]},
    {n: "Las fichas", t: `Cada comunidad, cada provincia`, p: [`Detrás de cada punto hay un municipio con su ficha: pulsa cualquiera en el mapa. Y cada comunidad y cada provincia tiene la suya, con su evolución, sus datos frente a España y sus diputados.`, `<a href="#geografia">Ver todas las comunidades y provincias →</a>`]},
  ];
  el.innerHTML = `<nav class="geo-migas" aria-label="Estás en"><a href="#geografia">Geografía</a> <span>›</span> <span>La España que no sale en el mapa</span></nav>
    <div class="view-intro"><div><div class="eyebrow">Geografía · historia</div><h2>La España que no sale en el mapa</h2><p>Un mapa de los ${fmt(N)} municipios que se queda quieto mientras bajas. Datos del INE: padrón de ${M.anio}, Atlas de renta (${T.fuentes.renta}) y resultados del 23J.</p></div></div>
    <div class="geo-story"><div class="geo-pasos">${PASOS.map((p, i) => `<div class="geo-paso" data-paso="${i}" id="geo-paso-${i}"><div class="caja"><div class="etq">${i + 1} de ${PASOS.length} · ${esc(p.n)}</div><h3>${p.t}</h3>${p.p.map(x => `<p>${x}</p>`).join("")}</div></div>`).join("")}</div>
      <div class="geo-fijo"><nav class="geo-indice" aria-label="Pasos de la historia">${PASOS.map((p, i) => `<button data-ir-paso="${i}"><b>${i + 1}</b>${esc(p.n)}</button>`).join("")}</nav><canvas aria-label="Mapa de los municipios de España" role="img"></canvas><div class="pie" id="geo-pie"></div></div></div>
    ${fuentes()}`;

  // ---------- el lienzo ----------
  const canvas = el.querySelector("canvas"), g = canvas.getContext("2d"), pie = el.querySelector("#geo-pie");
  const W0 = GP.ancho, H0 = GP.alto, provincias = Object.values(GP.provincias).map(p => new Path2D(p.d)), recuadro = new Path2D(GP.canarias);
  const tinta = () => hexRgb(cssVar("--muted", "#5C6069")), linea = () => cssVar("--line", "#DCDDD8");
  const naranja = hexRgb(TONO.calido), azul = hexRgb(TONO.neutro);
  const rPob = d => Math.max(.5, Math.sqrt(d.pob) * .025);
  const rgbDe = s => s.startsWith("#") ? hexRgb(s) : s.match(/\d+/g).slice(0, 3).map(Number);
  const rampaRgb = hex => { const f = rampa(hex); return t => rgbDe(f(t)); };
  const rEdad = rampaRgb(TONO.edad), rRenta = rampaRgb(TONO.renta);
  const rentas = conRenta.map(d => d.renta), q = p => rentas[Math.floor(p * (rentas.length - 1))], r05 = q(.05), r95 = q(.95);
  const gris = () => hexRgb(cssVar("--line-strong", "#82868E"));
  // Estado de cada paso: radio, color y opacidad de cada punto, y la leyenda del pie.
  const ESTADOS = [
    () => ({r: () => 1.7, c: () => tinta(), a: () => .75, pie: `<div class="geo-ley"><span><i style="background:var(--muted)"></i>Un municipio</span></div>`}),
    () => ({r: rPob, c: () => azul, a: () => .5, pie: `<div class="geo-ley"><span>Círculos del tamaño de la población: el mayor, Madrid (${millones(porPob[0].pob)})</span></div>`}),
    () => ({r: d => d.pob < 1000 ? 2 : 1.3, c: d => d.pob < 1000 ? naranja : gris(), a: d => d.pob < 1000 ? .85 : .35,
      pie: `<div class="geo-ley"><span><i style="background:${TONO.calido}"></i>Menos de 1.000 habitantes</span><span><i style="background:var(--line-strong)"></i>El resto</span></div>`}),
    () => ({r: () => 1.9, c: d => d.pob0 ? rgbDe(divergente(Math.max(-1, Math.min(1, (d.pob / d.pob0 - 1) / .5)))) : gris(), a: () => .9,
      pie: `<div class="geo-rampa"><span>−50 % o más</span><span class="r" style="background:linear-gradient(90deg,${divergente(-1)},${divergente(0)},${divergente(1)})"></span><span>+50 % o más desde ${M.anio0}</span></div>`}),
    () => ({r: () => 1.9, c: d => d.may65 == null ? gris() : rEdad((d.may65 - 10) / 40), a: d => d.may65 == null ? .25 : .9,
      pie: `<div class="geo-rampa"><span>10 % o menos</span><span class="r" style="background:linear-gradient(90deg,${rampa(TONO.edad)(0)},${rampa(TONO.edad)(1)})"></span><span>50 % o más de mayores de 65</span><span>· gris: sin dato</span></div>`}),
    () => ({r: () => 1.9, c: d => d.renta == null ? gris() : rRenta((d.renta - r05) / (r95 - r05)), a: d => d.renta == null ? .25 : .9,
      pie: `<div class="geo-rampa"><span>${fmt(r05)} €</span><span class="r" style="background:linear-gradient(90deg,${rampa(TONO.renta)(0)},${rampa(TONO.renta)(1)})"></span><span>${fmt(r95)} € por persona</span><span>· gris: sin dato</span></div>`}),
    () => ({r: rPob, c: d => d.gana != null ? hexRgb(F[ORD[d.gana]][1]) : gris(), a: () => .7,
      pie: `<div class="geo-ley">${topGan.slice(0, 6).map(([k]) => `<span><i style="background:${F[ORD[k]][1]}"></i>${esc(partido(M, k))}</span>`).join("")}</div>`}),
    () => ({r: rPob, c: () => azul, a: () => .5, pie: ""}),
  ];
  // Orden de dibujo: de mayor a menor, para que los pequeños queden encima.
  const orden = D.map((d, i) => i).sort((a, b) => D[b].pob - D[a].pob);
  const cur = D.map(() => ({r: 1.7, c: [128, 128, 128], a: .75})), desde = cur.map(x => ({...x})), hacia = cur.map(x => ({...x}));
  let paso = -1, anim = null, k = 1, ox = 0, oy = 0, dpr = 1;
  const medir = () => {
    const r = canvas.getBoundingClientRect(); dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    k = Math.min(r.width / W0, r.height / H0); ox = (r.width - W0 * k) / 2; oy = (r.height - H0 * k) / 2;
  };
  const dibujar = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
    g.save(); g.translate(ox, oy); g.scale(k, k);
    g.strokeStyle = linea(); g.lineWidth = .7 / k * 1.2;
    provincias.forEach(p => g.stroke(p)); g.stroke(recuadro);
    const esc2 = Math.max(.75, Math.min(1.4, 1 / (k * 1.3)));   // en pantallas pequeñas los puntos no encogen tanto
    for (const i of orden){
      const s = cur[i]; if (s.a <= 0.01) continue;
      g.globalAlpha = s.a; g.fillStyle = `rgb(${s.c[0]},${s.c[1]},${s.c[2]})`;
      g.beginPath(); g.arc(D[i].x, D[i].y, Math.max(.45, s.r * (s.r > 3 ? 1 : esc2)), 0, Math.PI * 2); g.fill();
    }
    g.restore(); g.globalAlpha = 1;
  };
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ir = j => {
    if (j === paso) return; paso = j;
    el.querySelectorAll(".geo-paso").forEach(p => p.classList.toggle("activo", +p.dataset.paso === j));
    el.querySelectorAll("[data-ir-paso]").forEach(b => { const si = +b.dataset.irPaso === j; if (si){ b.setAttribute("aria-current", "step"); const nav = b.parentNode; if (b.offsetLeft < nav.scrollLeft || b.offsetLeft + b.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = b.offsetLeft - 8; } else b.removeAttribute("aria-current"); });
    const E = ESTADOS[j]();
    D.forEach((d, i) => { desde[i] = {...cur[i], c: [...cur[i].c]}; hacia[i] = {r: E.r(d), c: E.c(d), a: E.a(d)}; });
    pie.innerHTML = E.pie;
    if (anim) cancelAnimationFrame(anim);
    const t0 = performance.now(), dur = reducido ? 1 : 900, ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const frame = ahora => {
      const t = ease(Math.min(1, (ahora - t0) / dur));
      for (let i = 0; i < D.length; i++){
        const a = desde[i], b = hacia[i], s = cur[i];
        s.r = a.r + (b.r - a.r) * t; s.a = a.a + (b.a - a.a) * t;
        s.c = [0, 1, 2].map(q => Math.round(a.c[q] + (b.c[q] - a.c[q]) * t));
      }
      dibujar();
      if (t < 1) anim = requestAnimationFrame(frame);
    };
    anim = requestAnimationFrame(frame);
  };
  medir();
  const ro = new ResizeObserver(() => { medir(); dibujar(); }); ro.observe(canvas);
  const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) ir(+e.target.dataset.paso); }); }, {rootMargin: "-45% 0px -45% 0px"});
  el.querySelectorAll(".geo-paso").forEach(p => io.observe(p));
  // El índice lleva a cada paso: su tarjeta, a media pantalla.
  el.querySelector(".geo-indice").addEventListener("click", ev => {
    const b = ev.target.closest("[data-ir-paso]"); if (!b) return;
    const caja = el.querySelector(`#geo-paso-${b.dataset.irPaso} .caja`), r = caja.getBoundingClientRect();
    window.scrollTo({top: scrollY + r.top - (innerHeight - r.height) / 2, behavior: reducido ? "auto" : "smooth"});
  });
  // Si se sale de la historia, se dejan de vigilar los pasos.
  const limpiar = new MutationObserver(() => { if (!el.contains(canvas)){ io.disconnect(); ro.disconnect(); limpiar.disconnect(); } });
  limpiar.observe(el, {childList: true});
  ir(0);
  // Tooltip y clic: el municipio más cercano al puntero.
  const cercano = ev => {
    const r = canvas.getBoundingClientRect(), mx = (ev.clientX - r.left - ox) / k, my = (ev.clientY - r.top - oy) / k;
    let mejor = -1, dm = Infinity;
    for (let i = 0; i < D.length; i++){
      if (cur[i].a < .3) continue;
      const dx = D[i].x - mx, dy = D[i].y - my, d2 = dx * dx + dy * dy, lim = Math.max(cur[i].r, 5 / k);
      if (d2 < lim * lim && d2 - cur[i].r * cur[i].r < dm){ dm = d2 - cur[i].r * cur[i].r; mejor = i; }
    }
    return mejor;
  };
  canvas.addEventListener("mousemove", ev => {
    const i = cercano(ev); if (i < 0){ tip(""); return; }
    const d = D[i];
    tip(`<b>${esc(d.n)}</b> <small>${esc(nombreP(d.c.slice(0, 2)))}</small><br>${fmt(d.pob)} habitantes${d.pob0 ? ` (${signo(d.pob / d.pob0 - 1, 0)} desde ${M.anio0})` : ""}${d.may65 != null ? `<br>${dec(d.may65, 0)} % mayores de 65` : ""}${d.renta != null ? ` · ${fmt(d.renta)} € por persona` : ""}${d.gana != null ? `<br>23J: ${esc(partido(M, d.gana))}` : ""}<br><small>Pulsa para ver su ficha</small>`, ev);
  });
  canvas.addEventListener("mouseleave", () => tip(""));
  canvas.addEventListener("click", ev => { const i = cercano(ev); if (i >= 0) location.hash = `geografia-municipio-${D[i].c}`; });
}
