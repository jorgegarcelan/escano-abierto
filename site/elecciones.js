/* Sección «Elecciones» (generales del 29 de noviembre de 2026).
   Se carga solo cuando alguien abre la pestaña: index.html llama a render(el, ctx, sub) con los datos y
   ayudas de la web (grupos, diputados, plano del hemiciclo, esc, fmt…). Los datos salen de datos/elecciones/. */

const CSS = `
.el-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px 32px;align-items:end;padding-block:8px 18px;border-bottom:1px solid var(--line)}
.el-hero h2{font-size:clamp(28px,4.2vw,46px);line-height:1.04;letter-spacing:-.02em;margin-top:8px;max-width:20ch}
.el-hero p{margin:12px 0 0;color:var(--muted);max-width:60ch;font-size:15.5px}
.el-cuenta{display:grid;justify-items:end;gap:2px;text-align:right}
.el-cuenta b{font-family:var(--led,var(--display));font-size:clamp(56px,9vw,96px);line-height:.9;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.el-cuenta span{font-size:13px;color:var(--muted)}
.el-nav{display:flex;flex-wrap:wrap;gap:6px 14px;padding-block:12px;font-size:13.5px}
.el-nav a{color:var(--muted);text-decoration:none}
.el-nav a:hover{color:var(--ink)}
.el-cal{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:0;margin-top:6px}
.el-cal::before{content:"";position:absolute;left:0;right:0;top:9px;height:2px;background:var(--line)}
.el-cal .h{position:relative;padding:0 8px 0 0;display:grid;gap:4px;align-content:start}
.el-cal .h i{width:12px;height:12px;border-radius:50%;background:var(--bg);border:2px solid var(--line-strong);margin-top:4px;z-index:1}
.el-cal .h.pasado i{background:var(--line-strong)}
.el-cal .h.ahora i{background:var(--ink);border-color:var(--ink);box-shadow:0 0 0 4px color-mix(in srgb,var(--ink) 18%,transparent)}
.el-cal .h b{font-size:13px;font-weight:600;line-height:1.25}
.el-cal .h small{font-size:11.5px;color:var(--muted);font-family:var(--mono)}
.el-cal .h.pasado b{color:var(--muted)}
@media (max-width:760px){
  .el-hero{grid-template-columns:1fr}.el-cuenta{justify-items:start;text-align:left}
  .el-cal{grid-template-columns:1fr;gap:10px;padding-left:4px}
  .el-cal::before{left:9px;right:auto;top:0;bottom:0;width:2px;height:auto}
  .el-cal .h{grid-template-columns:20px 1fr;column-gap:10px}
  .el-cal .h i{grid-row:span 2;margin-top:2px}
}
/* portada */
.elh-hero{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(250px,1fr);gap:22px 40px;align-items:stretch;padding-block:10px 26px;border-bottom:1px solid var(--line)}
.elh-txt{display:flex;flex-direction:column;align-items:flex-start}
.elh-fase{margin-top:14px;font:600 11.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--bg);background:var(--ink);border-radius:var(--r-pill);padding:3px 10px}
.elh-hero h2{font-size:clamp(34px,5.2vw,62px);line-height:1;letter-spacing:-.025em;margin-top:12px;max-width:15ch}
.elh-hero p{margin:14px 0 0;color:var(--muted);max-width:58ch;font-size:16px;line-height:1.5}
.elh-ctas{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.elh-cuenta{display:grid;align-content:space-between;gap:14px;background:var(--surface);border:var(--borde) solid var(--line);border-radius:var(--r-card-lg);box-shadow:var(--sombra);padding:18px 20px}
.elh-cuenta .n{display:grid;gap:2px}
.elh-cuenta .n b{font-family:var(--led,var(--display));font-size:clamp(64px,9vw,104px);line-height:.88;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.elh-cuenta .n span{font-size:13px;color:var(--muted)}
.elh-cuenta .f{display:grid;gap:2px;border-top:1px solid var(--line);padding-top:10px}
.elh-cuenta .f small{font:600 11px var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.elh-cuenta .f b{font-size:15.5px;line-height:1.25}
.elh-cuenta .f span{font-size:12.5px;color:var(--muted)}
.elh-sec{padding-top:30px}
.elh-cal::after{content:"";position:absolute;left:0;top:9px;height:2px;width:var(--hoy);background:var(--ink)}
.elh-cal .hoy{position:absolute;left:var(--hoy);top:-16px;transform:translateX(-50%);font:600 10.5px var(--mono);text-transform:uppercase;letter-spacing:.06em;color:var(--ink)}
.elh-cal .h.proximo i{border-color:var(--ink)}
.elh-cal .h.proximo b{color:var(--ink)}
.elh-cal .h.proximo small{color:var(--ink)}
.elh-prov{gap:14px}
.elh-prov-sel{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.elh-prov-sel label{font-size:13px;color:var(--muted)}
.elh-prov-sel select{font:600 15px var(--sans);color:var(--ink);background:var(--surface);border:1px solid var(--line-strong);border-radius:8px;padding:6px 10px}
.elh-prov-c{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px 32px;align-items:start}
.elh-prov-c h3{font-size:24px;line-height:1.15;margin:0}
.elh-prov-c .sub{margin:4px 0 10px;color:var(--muted);font-size:13px}
.elh-escanos{display:flex;flex-wrap:wrap;gap:4px;max-width:420px}
.elh-escanos i{width:16px;height:16px;border-radius:50%;display:block}
.elh-leyenda{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:12.5px;color:var(--muted);margin:8px 0 0}
.elh-leyenda span{display:inline-flex;align-items:center;gap:5px}
.elh-leyenda i{width:9px;height:9px;border-radius:50%;display:inline-block}
.elh-datos{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:14px;line-height:1.4}
.elh-datos li{padding-left:12px;border-left:2px solid var(--line)}
.elh-dips{display:grid;gap:6px;border-top:1px solid var(--line);padding-top:12px}
.elh-dips small{font-size:12px;color:var(--muted)}
.elh-dips>div{display:flex;flex-wrap:wrap;gap:5px}
.elh-dips a{font-size:12.5px;color:var(--ink);text-decoration:none;background:var(--sunk);border-radius:var(--r-pill);padding:2px 9px;display:inline-flex;align-items:center;gap:5px}
.elh-dips a:hover{background:var(--line)}
.elh-dips a.mas{background:none;color:var(--muted)}
.elh-dips a i{width:8px;height:8px;border-radius:50%;display:inline-block}
.elh-links{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0;font-size:13.5px}
.elh-grupo{padding-top:44px}
.elh-grupo-h{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 16px;align-items:baseline;border-top:1px solid var(--line-strong);padding-top:14px}
.elh-grupo-h .k{font:600 13px var(--mono);color:var(--muted)}
.elh-grupo-h h2{font-size:26px;margin:0}
.elh-grupo-h p{margin:4px 0 0;color:var(--muted);font-size:14px;max-width:62ch}
.elh-350{display:grid;gap:8px}
.elh-pronto{opacity:.7;box-shadow:none;border-style:dashed}
.elh-pronto:hover{transform:none}
@media (max-width:760px){
  .elh-hero{grid-template-columns:1fr}
  .elh-prov-c{grid-template-columns:1fr}
  .elh-cal::after,.elh-cal .hoy{display:none}
  .elh-cal .h.proximo i{box-shadow:0 0 0 3px color-mix(in srgb,var(--ink) 18%,transparent)}
}
.el-lead{margin:2px 0 4px;font-size:16px;line-height:1.5;max-width:68ch}
.el-barras{display:grid;gap:3px}
.el-barras button{all:unset;display:grid;grid-template-columns:minmax(0,11em) minmax(0,1fr) 3em;gap:10px;align-items:center;font-size:13px;padding:3px 6px;border-radius:6px;cursor:pointer}
.el-barras button:hover,.el-barras button:focus-visible{background:var(--sunk)}
.el-barras .b{height:12px;background:var(--sunk);border-radius:2px;overflow:hidden}
.el-barras .b i{display:block;height:100%;border-radius:0 4px 4px 0}
.el-barras .v{font:12px var(--mono);color:var(--muted);text-align:right}
.el-350{position:relative;background:var(--surface);border:var(--borde) solid var(--line);border-radius:var(--r-card-lg);box-shadow:var(--sombra);overflow:hidden}
.el-350 svg{display:block;width:100%;max-width:min(900px,calc(78vh * 1000 / 820));height:auto;margin:0 auto;touch-action:manipulation}
.el-350 .prov{fill:var(--sunk);stroke:var(--line-strong);stroke-width:.6;transition:opacity .6s}
.el-350 .can{fill:none;stroke:var(--line-strong);stroke-width:.8;transition:opacity .6s}
.el-350 circle{stroke:var(--surface);stroke-width:.8}
.el-350 .rot{font:600 11px var(--sans);fill:var(--muted);text-anchor:middle;pointer-events:none;transition:opacity .4s}
.el-350 .cifra{position:absolute;left:18px;top:14px;display:grid;gap:2px;pointer-events:none}
.el-350 .cifra b{font-family:var(--led,var(--display));font-size:clamp(34px,6vw,64px);font-weight:900;line-height:.9}
.el-350 .cifra span{font-size:12.5px;color:var(--muted);max-width:26ch}
.el-350 .ctl{position:absolute;right:14px;bottom:12px;display:flex;gap:6px}
.el-leyenda{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--muted)}
.el-leyenda span{display:inline-flex;align-items:center;gap:6px}
.el-leyenda i{width:9px;height:9px;border-radius:50%;display:inline-block}
.el-waffle{display:grid;gap:14px}
.el-waffle .fila{display:grid;grid-template-columns:200px minmax(0,1fr);gap:12px;align-items:start}
.el-waffle .fila>div:first-child{font-size:13px;line-height:1.3}
.el-waffle .fila>div:first-child small{display:block;color:var(--muted)}
.el-waffle .cel{display:flex;flex-wrap:wrap;gap:3px}
.el-waffle .cel button{all:unset;width:12px;height:12px;border-radius:2px;cursor:pointer;background:var(--c)}
.el-waffle .cel button:hover,.el-waffle .cel button:focus-visible{outline:2px solid var(--ink);outline-offset:1px}
@media (max-width:640px){ .el-waffle .fila{grid-template-columns:1fr;gap:6px} }
.el-lista{display:grid;gap:0;margin:0;padding:0;list-style:none}
.el-lista li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 14px;padding:10px 0;border-top:1px solid var(--line);align-items:baseline}
.el-lista li:first-child{border-top:0}
.el-lista .t{font-size:14px;line-height:1.35;text-align:left}
.el-lista .m{font-size:12px;color:var(--muted);font-family:var(--mono);white-space:nowrap}
.el-lista .s{grid-column:1/-1;font-size:12.5px;color:var(--muted)}
.el-hemi{display:block;width:100%;max-width:720px;height:auto;margin:0 auto}
.el-hemi circle{cursor:pointer;stroke:var(--surface);stroke-width:.6}
.el-lista .dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:1px}
.el-prom-barra{display:flex;height:22px;border-radius:4px;overflow:hidden;gap:2px;background:var(--surface)}
.el-prom-barra i{display:block;min-width:2px}
.el-prom-cats{display:flex;flex-wrap:wrap;gap:6px}
.el-prom-cats button{appearance:none;display:inline-flex;align-items:center;gap:6px;font:500 12.5px var(--sans);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:var(--r-pill);padding:4px 10px;cursor:pointer}
.el-prom-cats button[aria-pressed="true"]{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
.el-prom-cats i{width:9px;height:9px;border-radius:2px;display:inline-block}
.el-prom{display:grid;gap:0;margin:0;padding:0;list-style:none}
.el-prom>li{padding:14px 0;border-top:1px solid var(--line);display:grid;gap:6px}
.el-prom>li:first-child{border-top:0}
.el-prom .r{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600}
.el-prom .r i{width:9px;height:9px;border-radius:2px}
.el-prom blockquote{margin:0;padding-left:10px;border-left:2px solid var(--line-strong);color:var(--muted);font-size:13px}
.el-prom .vs{display:grid;gap:4px;font-size:13px}
.el-prom .vs div{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:baseline}
.el-prom .vs .x{font:600 11.5px var(--mono);white-space:nowrap}
.el-prom .vs small{color:var(--muted)}
.el-migas{font-size:13px;color:var(--muted);padding-top:4px;display:flex;gap:6px;align-items:center}
.el-migas a{color:var(--muted)}
.el-nav{padding:12px 0 14px;margin-bottom:6px;border-bottom:1px solid var(--line)}
.el-nav-grupos{display:flex;flex-wrap:wrap;gap:12px 0}
.el-nav-grupos .g{display:grid;gap:6px;align-content:start;padding:0 12px;border-left:1px solid var(--line)}
.el-nav-grupos .g:first-child{padding-left:0;border-left:0}
.el-nav-grupos .gt{font:600 10.5px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.el-nav-grupos .g.act .gt{color:var(--ink)}
.el-nav-grupos .gi{display:flex;flex-wrap:wrap;gap:4px}
.el-nav-grupos .gi a{font-size:12.5px;color:var(--muted);text-decoration:none;padding:4px 9px;border-radius:var(--r-pill);border:1px solid var(--line);background:var(--surface);white-space:nowrap}
.el-nav-grupos .gi a:hover{color:var(--ink);border-color:var(--line-strong)}
.el-nav-grupos .gi a[aria-current="page"]{color:var(--bg);background:var(--ink);border-color:var(--ink)}
.el-nav-movil{display:none}
.el-nav-movil summary{display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none;border:1px solid var(--line-strong);border-radius:10px;padding:9px 12px;background:var(--surface)}
.el-nav-movil summary::-webkit-details-marker{display:none}
.el-nav-movil summary span{font:600 10.5px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.el-nav-movil summary b{flex:1;font-size:14.5px}
.el-nav-movil summary::after{content:"▾";color:var(--muted)}
.el-nav-movil[open] summary::after{content:"▴"}
.el-nav-movil .el-nav-grupos{flex-direction:column;gap:14px;padding:14px 2px 4px}
.el-nav-movil .el-nav-grupos .g{padding:0;border:0}
@media (max-width:760px){ .el-nav>.el-nav-grupos{display:none} .el-nav-movil{display:block} }
.el-sigue{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:40px;padding-top:18px;border-top:1px solid var(--line)}
.el-sigue a{display:grid;gap:2px;text-decoration:none;color:var(--ink);background:var(--surface);border:var(--borde) solid var(--line);border-radius:var(--r-card-lg);padding:12px 16px;transition:border-color .2s}
.el-sigue a:hover{border-color:var(--line-strong)}
.el-sigue a.sig{text-align:right}
.el-sigue small{font-size:12px;color:var(--muted)}
.el-sigue b{font-size:15px}
.el-tarjetas{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:12px}
.el-tarjeta{display:grid;grid-template-rows:auto auto auto auto 1fr;gap:4px;text-decoration:none;color:var(--ink);background:var(--surface);border:var(--borde) solid var(--line);border-radius:var(--r-card-lg);padding:16px 16px 14px;box-shadow:var(--sombra);transition:border-color .2s,transform .2s;min-height:220px}
.el-tarjeta:hover{border-color:var(--line-strong);transform:translateY(-2px);text-decoration:none}
.el-tarjeta .t{font-weight:600;font-size:16px}
.el-tarjeta .d{font-size:13px;color:var(--muted);line-height:1.35}
.el-tarjeta .c{font-family:var(--led,var(--display));font-size:34px;font-weight:900;line-height:1;margin-top:8px}
.el-tarjeta .p{font-size:12px;color:var(--muted)}
.el-tarjeta .v{align-self:end;display:block;margin-top:10px}
.el-tarjeta .v svg{display:block;width:100%;height:auto;max-height:110px}
.el-pronto{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.el-pronto .chart{gap:6px}
.el-pronto .chart b{font-size:15px}
.el-pronto .chart p{margin:0;font-size:13px;color:var(--muted)}
.el-pronto .chart small{font-family:var(--mono);font-size:11.5px;color:var(--muted)}
`;

let ctx = null, DATOS = null, GEO = null, cargando = null;

const cargar = () => cargando ||= Promise.all([
  fetch("datos/elecciones/elecciones.json").then(r => r.ok ? r.json() : null).catch(() => null),
  fetch("datos/elecciones/geo-provincias.json").then(r => r.ok ? r.json() : null).catch(() => null),
]).then(([d, g]) => { DATOS = d; GEO = g; });

function estilos(){
  if (document.getElementById("el-css")) return;
  const s = document.createElement("style"); s.id = "el-css"; s.textContent = CSS; document.head.appendChild(s);
}

const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const diasHasta = iso => { const [y,m,d] = iso.split("-").map(Number); const h = new Date(); return Math.round((new Date(y,m-1,d) - new Date(h.getFullYear(),h.getMonth(),h.getDate()))/864e5); };
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const fechaLarga = iso => { const [,m,d] = iso.split("-").map(Number); return `${d} de ${MESES[m-1]}`; };
const fechaCortaEl = iso => { const [,m,d] = iso.split("-").map(Number); return `${d} ${MESES[m-1].slice(0,3)}`; };

/* Apartados de la sección: cada uno es una subpágina (#elecciones-<id>). */
const PAGINAS = [
  {id:"350", c:"Los 350", t:"Los 350", d:"Cada escaño sale de una provincia. Del mapa al hemiciclo, y cómo ha cambiado el reparto desde 1977."},
  {id:"caducan", c:"Lo que caduca", t:"Lo que caduca", d:"Las leyes que la disolución deja a medio camino y los decretos-leyes que heredará la Diputación Permanente."},
  {id:"legislatura", c:"En cifras", t:"La legislatura en cifras", d:"La XV legislatura, de la sesión constitutiva a la disolución: votaciones, leyes, decretos y preguntas."},
  {id:"repite", c:"¿Repite?", t:"¿Repite?", d:"Quién de los 350 vuelve a ir en las listas, en qué puesto y por qué provincia."},
  {id:"escano", c:"Precio del escaño", t:"El precio de un escaño", d:"Cuántos votos cuesta un diputado en cada provincia, el último escaño de cada una y un simulador D'Hondt."},
  {id:"historico", c:"Desde 1977", t:"Elecciones desde 1977", d:"Las dieciséis generales, con la ficha de cada elección y de su legislatura."},
  {id:"provincias", c:"Provincias", t:"Provincias", d:"Las 52 circunscripciones: escaños, participación, votos por escaño y su historia electoral."},
  {id:"metricas", c:"Métricas", t:"Métricas", d:"Participación, fragmentación, desproporcionalidad, volatilidad y bipartidismo, elección a elección."},
  {id:"mapa", c:"Por municipios", t:"Municipio a municipio", d:"El voto de 2019 y 2023 en los 8.131 municipios y cuánto cambió entre las dos."},
  {id:"voto", c:"Geografía del voto", t:"La geografía del voto", d:"Ciudad y campo, la España vacía, la edad, el dinero, las Españas, el giro y el peso del voto: cómo vota cada España, municipio a municipio."},
  {id:"noche", c:"En directo", t:"La noche electoral", d:"El escrutinio del 29N en directo, provincia a provincia, con los escaños que aún están en el aire."},
];
const PAG = Object.fromEntries(PAGINAS.map(p=>[p.id, p]));
let NAV = null, ORDEN_NAV = null;   // se completan con GRUPOS_PAG (más abajo, con la portada)

export async function render(el, c, sub){
  ctx = c; estilos();
  if (!DATOS){ el.innerHTML = `<p class="nota">Cargando la sección de elecciones…</p>`; await cargar(); }
  if (!DATOS){ el.innerHTML = `<p class="nota">No se han podido cargar los datos de las elecciones.</p>`; return; }
  sub = (sub || "").replace(/^el-/, "");
  const eleccion = /^\d{4}(-abril|-noviembre)?$/.test(sub), provincia = sub.startsWith("provincia-");
  if (!sub || (!PAG[sub] && !eleccion && !provincia)) return home(el);
  const {esc} = ctx;
  const actual = eleccion ? "historico" : provincia ? "provincias" : sub;
  const p = PAG[sub];
  const g = NAV.findIndex(x=>x.ids.includes(actual)), i = ORDEN_NAV.indexOf(actual);
  const grupos = NAV.map((x,k)=>`<div class="g${k===g?" act":""}"><span class="gt">${String(k+1).padStart(2,"0")} · ${esc(x.n)}</span><div class="gi">${x.ids.map(id=>`<a href="#elecciones-${id}"${id===actual?' aria-current="page"':""}>${esc(PAG[id].c||PAG[id].t)}</a>`).join("")}</div></div>`).join("");
  const vecino = (id, cls, flecha) => id ? `<a class="${cls}" href="#elecciones-${id}"><small>${cls==="ant"?"← Anterior":"Siguiente →"}</small><b>${esc(PAG[id].t)}</b></a>` : `<span></span>`;
  el.innerHTML = `<nav class="el-migas" aria-label="Estás en"><a href="#elecciones">Elecciones 29N</a>${g>=0?` <span>›</span> <span>${esc(NAV[g].n)}</span>`:""}${eleccion||provincia?` <span>›</span> <a href="#elecciones-${actual}">${esc(PAG[actual].t)}</a>`:""}</nav>
    <nav class="el-nav" aria-label="Apartados de las elecciones"><div class="el-nav-grupos">${grupos}</div>
      <details class="el-nav-movil"><summary><span>Apartado</span><b>${esc(PAG[actual].t)}</b></summary><div class="el-nav-grupos">${grupos}</div></details></nav>
    <div id="el-pagina">${p ? `<div class="view-intro"><div><h2>${esc(p.t)}</h2><p>${esc(p.d)}</p></div></div>` : ""}<div class="el-cuerpo"><p class="nota">Cargando…</p></div>
      ${p ? `<nav class="el-sigue" aria-label="Otros apartados">${vecino(ORDEN_NAV[i-1], "ant")}${vecino(ORDEN_NAV[i+1], "sig")}</nav>` : ""}</div>`;
  const cuerpo = el.querySelector(".el-cuerpo");
  const hist = f => import("./elecciones-historico.js").then(m=>m[f](cuerpo, ctx, sub)).catch(err=>{ console.error(err); cuerpo.innerHTML = `<p class="nota">No se ha podido cargar este apartado.</p>`; });
  if (sub === "350"){
    cuerpo.innerHTML = `<section class="sec" style="padding-top:8px">${bloque350()}</section><section class="sec" id="el-reparto"><p class="nota">Cargando…</p></section>`;
    montar350(cuerpo.querySelector(".el-350"));
    import("./elecciones-historico.js").then(m=>m.pintarReparto(cuerpo.querySelector("#el-reparto"), ctx));
  } else if (sub === "caducan"){ cuerpo.innerHTML = `<section class="sec" style="padding-top:8px">${caducan()}</section>${convalidar()}`; montarCaducan(cuerpo);
    import("./elecciones-viajes.js").then(m=>m.montarViajes(cuerpo, ctx, COLOR_ORIGEN)).catch(err=>console.error(err)); }
  else if (sub === "legislatura"){ cuerpo.innerHTML = `<section class="sec" style="padding-top:8px">${balance()}</section>`; }
  else if (sub === "repite"){ cuerpo.innerHTML = `<section class="sec" id="el-repite" style="padding-top:8px"><p class="nota">Cargando…</p></section>`; pintarRepite(cuerpo.querySelector("#el-repite")); }
  else if (sub === "escano") hist("pintarEscano");
  else if (sub === "historico") hist("pintarHistorico");
  else if (sub === "provincias") hist("pintarProvincias");
  else if (sub === "metricas") hist("pintarMetricas");
  else if (sub === "mapa") hist("pintarMunicipios");
  else if (sub === "noche") hist("pintarNoche");
  else if (sub === "voto") import("./elecciones-voto.js").then(m=>m.geografiaDelVoto(cuerpo)).catch(err=>{ console.error(err); cuerpo.innerHTML = `<p class="nota">No se ha podido cargar este apartado.</p>`; });
  else if (eleccion) hist("pintarFicha");
  else if (provincia) hist("pintarProvincia");
}

/* ---------- portada de la sección ---------- */
// Los apartados, agrupados por temas. El de los 350 no es una tarjeta: es la pieza central de su grupo.
const GRUPOS_PAG = [
  {n:"La legislatura", t:"La legislatura que se acaba", d:"Lo que deja hecho y sin hacer la XV legislatura, y quién vuelve a presentarse.", ids:["caducan","legislatura","repite"]},
  {n:"Los escaños", t:"Cómo se reparten los 350", d:"Cada provincia elige sus diputados por separado, con la ley D'Hondt: por eso unos votos pesan más que otros.", ids:["escano","provincias"], los350:true},
  {n:"La historia", t:"Cuarenta y nueve años de elecciones", d:"Las dieciséis generales desde 1977, una a una y en cifras.", ids:["historico","metricas"]},
  {n:"El mapa", t:"El mapa del voto", d:"Quién gana dónde, municipio a municipio, y cómo vota cada España.", ids:["mapa","voto"]},
  {n:"La noche", t:"La noche del 29N", d:"El escrutinio en directo desde que cierran los colegios.", ids:["noche"], pronto:true},
];
NAV = GRUPOS_PAG.map(g=>({n:g.n, ids: g.los350 ? ["350", ...g.ids] : g.ids}));
ORDEN_NAV = NAV.flatMap(g=>g.ids);
// En qué fase está la elección: cambia la cabecera y lo que se destaca.
function fase(){
  const hoy = hoyISO(), H = DATOS.calendario, de = n => H.find(x=>x.hito.startsWith(n)) || {};
  if (hoy > DATOS.votacion) return "despues";
  if (hoy === DATOS.votacion) return new Date().getHours() >= 20 ? "noche" : "votacion";
  if (hoy === de("Jornada de reflexión").fecha) return "reflexion";
  const c = de("Campaña"); if (c.fecha && hoy >= c.fecha && hoy <= c.hasta) return "campana";
  if (hoy >= (de("Listas presentadas").fecha || "9")) return "listas";
  return "precampana";
}
const FASES = {
  precampana: {etq:"Precampaña", h:"Antes de votar, mira lo que votaron",
    p:"La XV legislatura se cierra con la disolución de las Cortes. Lo que dejó hecho y sin hacer, quién vuelve a presentarse, cómo se reparten los 350 escaños y cuarenta y nueve años de elecciones, provincia a provincia. Todo con datos oficiales.",
    cta:[["caducan","Lo que caduca"],["350","Los 350 escaños"]]},
  listas: {etq:"Ya hay listas", h:"Ya hay listas: mira quién repite",
    p:"Las candidaturas ya están en el BOE. Quién de los 350 vuelve a presentarse, en qué puesto y por qué provincia, y lo que dejó hecho y sin hacer la legislatura que acaba.",
    cta:[["repite","¿Repite?"],["caducan","Lo que caduca"]]},
  campana: {etq:"Campaña electoral", h:"Quince días de campaña. Antes, mira lo que votaron",
    p:"Hasta el viernes 27, los partidos piden el voto. Aquí, lo que hicieron en la legislatura que acaba, quién repite y cuánto vale un voto en cada provincia.",
    cta:[["repite","¿Repite?"],["legislatura","La legislatura en cifras"]]},
  reflexion: {etq:"Jornada de reflexión", h:"Mañana se vota",
    p:"Hoy no hay campaña ni propaganda. Mira cuántos diputados elige tu provincia y cómo se repartieron en 2023.",
    cta:[["provincias","Las 52 provincias"],["350","Los 350 escaños"]]},
  votacion: {etq:"Hoy se vota", h:"Hoy se vota, de 9.00 a 20.00",
    p:"A las ocho de la tarde cierran los colegios y empieza el escrutinio. Lo seguiremos aquí, en directo y provincia a provincia.",
    cta:[["noche","La noche electoral"]]},
  noche: {etq:"Escrutinio en directo", h:"La noche electoral, en directo",
    p:"El recuento provincia a provincia, con los escaños que aún están en el aire.",
    cta:[["noche","Seguir el escrutinio"]]},
  despues: {etq:"Resultados", h:"Así quedan los 350",
    p:"Los resultados del 29N, provincia a provincia. Las nuevas Cortes se constituyen el 23 de diciembre.",
    cta:[["noche","Los resultados"]]},
};
function home(el){
  const {esc, fmt} = ctx;
  const F = FASES[fase()], faltan = diasHasta(DATOS.votacion);
  const C = DATOS.caducan, B = DATOS.balance;
  const tarjeta = (id, cifra, pie, visual="") => `<a class="el-tarjeta" href="#elecciones-${id}"><span class="t">${esc(PAG[id].t)} <span aria-hidden="true">→</span></span><span class="d">${esc(PAG[id].d)}</span>
    ${cifra?`<span class="c">${cifra}</span><span class="p">${pie}</span>`:""}<span class="v" data-mini="${id}">${visual}</span></a>`;
  const TARJETAS = {
    caducan: ()=>tarjeta("caducan", fmt(C.total), "leyes caducan sin terminar", miniWaffle()),
    legislatura: ()=>tarjeta("legislatura", fmt(B.votaciones), `votaciones; la más ajustada, ${B.mas_ajustada?`${B.mas_ajustada.si} a ${B.mas_ajustada.no}`:""}`),
    repite: ()=>tarjeta("repite", DATOS.hay?.candidaturas ? "" : "28 oct", DATOS.hay?.candidaturas ? "" : "el BOE publica las listas", miniHemi()),
    escano: ()=>tarjeta("escano", "", ""),
    provincias: ()=>tarjeta("provincias", "52", "circunscripciones", miniMapa()),
    historico: ()=>tarjeta("historico", "16", "elecciones generales desde 1977"),
    metricas: ()=>tarjeta("metricas", "", ""),
    mapa: ()=>tarjeta("mapa", "8.131", "municipios"),
    voto: ()=>tarjeta("voto", "7", "ejes para entender cómo vota cada España"),
    noche: ()=>tarjeta("noche", "20.00", "del 29 de noviembre: empieza el escrutinio. Antes, un ensayo con el 23J"),
  };
  // Lo que pasa ahora y lo siguiente del calendario.
  const hoy = hoyISO(), H = DATOS.calendario;
  const ahora = H.find(h=>h.hasta && h.fecha <= hoy && hoy <= h.hasta) || H.find(h=>h.fecha === hoy);
  const prox = H.find(h=>h.fecha > hoy);
  const cuando = h => { const n = diasHasta(h.fecha); return n === 1 ? "mañana" : `en ${n} días`; };
  const cambios = (DATOS.escanos_cambian || []).filter(([c])=>GEO?.provincias[c]);   // [provincia, escaños 2023, escaños 2026]
  el.innerHTML = `
    <div class="elh-hero">
      <div class="elh-txt"><div class="eyebrow">Elecciones generales · domingo 29 de noviembre de 2026</div>
        <span class="elh-fase">${esc(F.etq)}</span>
        <h2>${esc(F.h)}</h2><p>${esc(F.p)}</p>
        <div class="elh-ctas">${F.cta.map(([id,t],k)=>`<a class="btn${k?"":" primary"}" href="#elecciones-${id}">${esc(t)} →</a>`).join("")}<button class="btn" type="button" data-elh-prov>Tu provincia ↓</button></div></div>
      <div class="elh-cuenta">
        <div class="n">${faltan > 0 ? `<b>${faltan}</b><span>${faltan === 1 ? "día: mañana se vota" : "días para votar"}</span>` : faltan === 0 ? `<b>HOY</b><span>se vota de 9.00 a 20.00</span>` : `<b>29N</b><span>elecciones generales</span>`}</div>
        ${ahora ? `<div class="f"><small>Ahora</small><b>${esc(ahora.hito)}</b>${ahora.hasta?`<span>hasta el ${esc(fechaLarga(ahora.hasta))}</span>`:""}</div>` : ""}
        ${prox ? `<div class="f"><small>Lo próximo · ${esc(cuando(prox))}</small><b>${esc(prox.hito)}</b><span>${prox.hasta?`del ${esc(fechaLarga(prox.fecha))} al ${esc(fechaLarga(prox.hasta))}`:`el ${esc(fechaLarga(prox.fecha))}`}</span></div>` : ""}
      </div>
    </div>
    <section class="sec elh-sec"><div class="sec-h"><h2>En qué punto estamos</h2><p>Los plazos los fija la Ley Orgánica del Régimen Electoral General y se cuentan desde que el BOE publica el decreto de convocatoria${DATOS.decreto?` (${esc(DATOS.decreto.rd)})`:""}.</p></div>${calendario()}</section>
    <section class="sec elh-sec" id="elh-provincia"><div class="sec-h"><h2>Tu provincia</h2><p>Cuántos diputados elige, cómo se repartieron en 2023 y quiénes la representan hoy.</p></div><div class="chart elh-prov"><p class="nota">Cargando…</p></div></section>
    ${GRUPOS_PAG.map((g,k)=>`<section class="sec elh-grupo"><div class="elh-grupo-h"><span class="k">${String(k+1).padStart(2,"0")}</span><div><h2>${esc(g.t)}</h2><p>${esc(g.d)}</p></div></div>
      ${g.los350 ? `<div class="elh-350">${bloque350()}<p class="nota"><a href="#elecciones-350">Cómo ha cambiado el reparto de escaños por provincia desde 1977 →</a>${cambios.length ? ` · En 2026, ${cambios.map(([c,a,b])=>`${esc(GEO.provincias[c].corto)} ${b > a ? "gana" : "pierde"} ${Math.abs(b-a) === 1 ? "un escaño" : `${Math.abs(b-a)} escaños`}`).join(" y ")} respecto a 2023.` : ""}</p></div>` : ""}
      <div class="el-tarjetas">${g.ids.map(id=>TARJETAS[id]()).join("")}
        ${g.pronto ? `<div class="el-tarjeta elh-pronto"><span class="t">Qué prometieron y qué votaron</span><span class="d">Las promesas de los programas de 2023 frente a lo que votó cada candidatura en el Congreso.</span><span class="p">Más adelante</span></div>` : ""}</div></section>`).join("")}`;
  montar350(el.querySelector(".el-350"));
  pintarTuProvincia(el.querySelector(".elh-prov"));
  // Un ancla (#elh-provincia) cambiaría de vista: la web enruta por el hash. Se baja con scroll.
  el.querySelector("[data-elh-prov]").addEventListener("click", ()=>{ const s = el.querySelector("#elh-provincia"); window.scrollTo({top: scrollY + s.getBoundingClientRect().top - 70, behavior: "smooth"}); });
  // Las tarjetas que necesitan el histórico se completan cuando llega (sin bloquear la portada).
  import("./elecciones-historico.js").then(m=>m.miniaturas(el, ctx)).catch(()=>{});
}

/* ---------- tu provincia ---------- */
let HIST_H = null, HIST_23 = null;
const MAX_DIPS = 14;
async function pintarTuProvincia(caja){
  if (!caja || !GEO) return;
  const {esc, slug} = ctx;
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");   // con punto de miles también en 1.340
  [HIST_H, HIST_23] = await Promise.all([HIST_H || fetch("datos/elecciones/historico.json").then(r=>r.ok?r.json():null).catch(()=>null),
    HIST_23 || fetch("datos/elecciones/historico-202307.json").then(r=>r.ok?r.json():null).catch(()=>null)]);
  if (!HIST_H || !HIST_23){ caja.innerHTML = `<p class="nota">No se han podido cargar los datos de las provincias.</p>`; return; }
  const P = GEO.provincias, cods = Object.keys(P).sort((a,b)=>P[a].corto.localeCompare(P[b].corto, "es"));
  let cod = (()=>{ try{ const s = localStorage.getItem("provincia"); return cods.find(c=>slug(P[c].circ)===s); }catch(e){ return null; } })() || "28";
  const FAM = Object.fromEntries(HIST_H.familias.map(f=>[f.id, f]));
  const E = HIST_H.elecciones[HIST_H.elecciones.length-1];
  const pct = x => (x*100).toLocaleString("es-ES", {minimumFractionDigits:1, maximumFractionDigits:1}) + " %";
  const pintar = () => {
    const p = E.prov[cod], d = HIST_23.prov[cod], circ = P[cod].circ, nombre = P[cod].corto;
    const e26 = DATOS.escanos?.[cod] ?? p.e, dif = e26 - p.e, sl = slug(circ);
    const con = d.c.filter(x=>x[3]), dips = (ctx.DIPS||[]).filter(x=>!x[8] && x[2]===circ).sort((a,b)=>ctx.ORDEN_HEMI.indexOf(a[1])-ctx.ORDEN_HEMI.indexOf(b[1]));
    const partE = E.votantes/E.censo, partP = p.votantes/p.censo, vpe = p.validos/p.e, vpeE = E.validos/350;
    caja.innerHTML = `<div class="elh-prov-sel"><label for="elh-prov">Elige tu provincia</label><select id="elh-prov">${cods.map(c=>`<option value="${c}"${c===cod?" selected":""}>${esc(P[c].corto)}</option>`).join("")}</select></div>
      <div class="elh-prov-c">
        <div><h3>${esc(nombre)} elige ${e26} ${e26===1?"diputado":"diputados"}</h3>
          <p class="sub">${dif ? `${dif>0?"Uno más":"Uno menos"} que en 2023, por su población (${esc(DATOS.decreto?.rd || "decreto de convocatoria")}).` : `Los mismos que en 2023.`}</p>
          <div class="elh-escanos" role="img" aria-label="Reparto de 2023: ${esc(con.map(x=>`${x[0]} ${x[3]}`).join(", "))}">${con.flatMap(x=>Array.from({length:x[3]}, ()=>`<i style="background:${FAM[x[1]]?.color||"#888"}" title="${esc(x[0])}"></i>`)).join("")}</div>
          <p class="elh-leyenda">${con.map(x=>`<span><i style="background:${FAM[x[1]]?.color||"#888"}"></i>${esc(x[0])} ${x[3]}</span>`).join("")}<span>· en 2023</span></p></div>
        <ul class="elh-datos">
          ${d.ultimo ? `<li><b>${fmt(d.ultimo.faltan)} votos</b> le faltaron a ${esc(d.ultimo.segundo)} para quitarle el último escaño a ${esc(d.ultimo.gana)} en 2023.</li>` : ""}
          <li><b>${fmt(vpe)} votos</b> costó cada escaño en 2023 (en el conjunto de España, ${fmt(vpeE)}).</li>
          <li><b>${pct(partP)}</b> de participación en 2023 (España: ${pct(partE)}).</li>
          <li>${DATOS.hay?.candidaturas ? `<a href="#elecciones-repite">Quién repite en ${esc(nombre)} →</a>` : `Las listas de cada partido se publican en el BOE el <b>28 de octubre</b>.`}</li>
        </ul>
      </div>
      ${dips.length ? `<div class="elh-dips"><small>Sus ${dips.length} diputados en la XV legislatura</small><div>${dips.slice(0, MAX_DIPS).map(x=>`<a href="#diputado-${esc(slug(x[0]))}"><i style="background:${ctx.G[x[1]]?.color||"#888"}"></i>${esc(ctx.legible(x[0]))}</a>`).join("")}${dips.length > MAX_DIPS ? `<a href="#provincia-${esc(sl)}" class="mas">y ${dips.length - MAX_DIPS} más →</a>` : ""}</div></div>` : ""}
      <p class="elh-links"><a href="#elecciones-provincia-${esc(sl)}">Su historia electoral desde 1977 →</a><a href="#provincia-${esc(sl)}">Qué hicieron sus diputados →</a><a href="#geografia-provincia-${esc(sl)}">Su geografía →</a></p>`;
    caja.querySelector("#elh-prov").addEventListener("change", e=>{ cod = e.target.value; try{ localStorage.setItem("provincia", slug(P[cod].circ)); }catch(err){} pintar(); });
  };
  pintar();
}
function miniWaffle(){
  const L = DATOS.caducan.lista;
  return `<svg viewBox="0 0 ${31*7} ${Math.ceil(L.length/31)*7}" aria-hidden="true">${L.map((x,k)=>`<rect x="${(k%31)*7}" y="${Math.floor(k/31)*7}" width="5.5" height="5.5" rx="1" fill="${COLOR_ORIGEN[x[3]]}"/>`).join("")}</svg>`;
}
function miniHemi(){
  const P = ctx.PLANO; if (!P) return "";
  return `<svg viewBox="0 0 ${P.ancho} ${P.alto}" aria-hidden="true">${ctx.DIPS.filter(d=>!d[8] && d[5]!=null).map(d=>`<circle cx="${d[5]}" cy="${d[6]}" r="5" fill="${ctx.G[d[1]]?.color||"#888"}"/>`).join("")}</svg>`;
}
function miniMapa(){
  if (!GEO) return "";
  return `<svg viewBox="0 0 ${GEO.ancho} ${GEO.alto}" aria-hidden="true">${Object.values(GEO.provincias).map(p=>`<path d="${p.d}" style="fill:var(--sunk);stroke:var(--line-strong)" stroke-width="1"/>`).join("")}</svg>`;
}

/* ---------- calendario: en qué punto estamos ---------- */
const dia = iso => { const [y,m,d] = iso.split("-").map(Number); return Date.UTC(y,m-1,d)/864e5; };
function calendario(){
  const {esc} = ctx, hoy = hoyISO(), H = DATOS.calendario, n = H.length;
  // Hoy, entre los hitos (repartidos a la misma distancia): el último que ha empezado más la parte del tramo hasta el siguiente.
  let pos = -1; H.forEach((h,k) => { if (h.fecha <= hoy) pos = k; });
  if (pos >= 0 && pos < n-1) pos += Math.min(1, (dia(hoy)-dia(H[pos].fecha)) / ((dia(H[pos+1].fecha)-dia(H[pos].fecha)) || 1));
  const prox = H.findIndex(h=>h.fecha > hoy);
  return `<div class="el-cal elh-cal" style="--n:${n};--hoy:${pos < 0 ? 0 : (pos/n*100).toFixed(2)}%">${pos >= 0 && pos < n-1 ? `<span class="hoy" aria-hidden="true">hoy</span>` : ""}${H.map((h,k)=>{
    const encurso = h.hasta && h.fecha <= hoy && hoy <= h.hasta;
    const estado = encurso || h.fecha === hoy ? "ahora" : h.fecha < hoy ? "pasado" : k === prox ? "proximo" : "";
    const f = h.hasta ? `${fechaCortaEl(h.fecha)} – ${fechaCortaEl(h.hasta)}` : (h.aprox ? "antes del " : "") + fechaCortaEl(h.fecha);
    const falta = k === prox ? diasHasta(h.fecha) : null;
    return `<div class="h ${estado}" ${h.detalle?`data-tip="${esc(`<b>${esc(h.hito)}</b><br>${esc(h.detalle)}<br><i>${esc(h.ley)}</i>`)}"`:""}><i></i><b>${esc(h.hito)}</b><small>${esc(f)}${falta!=null?` · ${falta===1?"mañana":`en ${falta} días`}`:""}</small></div>`;
  }).join("")}</div>`;
}

/* ---------- los 350: del mapa al hemiciclo ---------- */
export const R_PUNTO = 6.2;
export function racimos(cuantos, geo = GEO){
  // Un círculo por provincia, de área proporcional a sus escaños, empujado hasta que no se solapen
  // (cartograma de Dorling), siempre atraído hacia su sitio en el mapa. Determinista: mismas iteraciones.
  const P = geo.provincias, sep = R_PUNTO*2+1.6;
  const nodos = Object.entries(cuantos).filter(([c,n])=>n && P[c]).map(([c,n])=>({c, n, x:P[c].c[0], y:P[c].c[1], x0:P[c].c[0], y0:P[c].c[1],
    r: Math.sqrt(n/0.86)*sep/2 + 2}));
  for (let it=0; it<260; it++){
    for (const a of nodos){ a.x += (a.x0-a.x)*0.06; a.y += (a.y0-a.y)*0.06; }
    for (let i=0;i<nodos.length;i++) for (let j=i+1;j<nodos.length;j++){
      const a=nodos[i], b=nodos[j]; let dx=b.x-a.x, dy=b.y-a.y; const d=Math.hypot(dx,dy)||0.01, m=a.r+b.r+1.5;
      if (d < m){ const k=(m-d)/d/2; dx*=k; dy*=k; const wa=b.n/(a.n+b.n), wb=a.n/(a.n+b.n); a.x-=dx*wa*1.0; a.y-=dy*wa; b.x+=dx*wb; b.y+=dy*wb; }
    }
  }
  return Object.fromEntries(nodos.map(n=>[n.c, n]));
}
export function girasol(n){
  // Posiciones en espiral de Fermat (girasol), ordenadas de izquierda a derecha para colocar los grupos.
  const sep = R_PUNTO*2+1.6, c = sep*0.53, ang = Math.PI*(3-Math.sqrt(5));
  const pts = Array.from({length:n}, (_,k)=>({x: c*Math.sqrt(k+0.5)*Math.cos(k*ang), y: c*Math.sqrt(k+0.5)*Math.sin(k*ang)}));
  if (n === 1) pts[0] = {x:0, y:0};
  return pts.sort((a,b)=>a.x-b.x || a.y-b.y);
}
function bloque350(){
  if (!GEO || !ctx.PLANO) return `<p class="nota">El mapa no está disponible.</p>`;
  const {esc, G, ORDEN_HEMI} = ctx;
  const grupos = ORDEN_HEMI.filter(g=>ctx.DIPS.some(d=>!d[8] && d[1]===g));
  return `<div class="el-350"><svg viewBox="0 0 ${GEO.ancho} ${GEO.alto}" role="img" aria-label="Mapa de España con un punto por escaño, que se reordena en el hemiciclo del Congreso">
      <g class="mapa">${Object.values(GEO.provincias).map(p=>`<path class="prov" d="${p.d}"><title>${esc(p.circ)}</title></path>`).join("")}<path class="can" d="${GEO.canarias}"/></g>
      <g class="puntos"></g></svg>
    <div class="cifra"><b>350</b><span class="lbl">escaños, repartidos entre 52 circunscripciones</span></div>
    <div class="ctl"><button class="btn" data-350="hemi">Al hemiciclo →</button></div></div>
    <div class="el-leyenda">${grupos.map(g=>`<span><i style="background:${G[g].color}"></i>${esc(G[g].nombre)}</span>`).join("")}</div>`;
}
function montar350(caja){
  if (!caja) return;
  const {G, ORDEN_HEMI, DIPS, PLANO} = ctx;
  const svg = caja.querySelector("svg"), capa = caja.querySelector(".puntos"), NS = "http://www.w3.org/2000/svg";
  const P = GEO.provincias, porCirc = Object.fromEntries(Object.entries(P).map(([c,p])=>[p.circ, c]));
  const vivos = DIPS.map((d,i)=>({d, i})).filter(({d})=>!d[8] && porCirc[d[2]]);
  const cuantos = {}; vivos.forEach(({d})=>{ const c=porCirc[d[2]]; cuantos[c]=(cuantos[c]||0)+1; });
  const R = racimos(cuantos);
  // Posición A: en su provincia, con los grupos de izquierda a derecha. Posición B: su escaño real.
  const k = Math.min(GEO.ancho*0.86/PLANO.ancho, GEO.alto*0.8/PLANO.alto), ox = (GEO.ancho-PLANO.ancho*k)/2, oy = (GEO.alto-PLANO.alto*k)/2+20;
  const puntos = [];
  for (const [c, n] of Object.entries(cuantos)){
    const pos = girasol(n), suyos = vivos.filter(({d})=>porCirc[d[2]]===c)
      .sort((a,b)=>ORDEN_HEMI.indexOf(a.d[1])-ORDEN_HEMI.indexOf(b.d[1]) || a.d[0].localeCompare(b.d[0],"es"));
    suyos.forEach(({d,i},j)=>puntos.push({d, i, ax: R[c].x+pos[j].x, ay: R[c].y+pos[j].y,
      bx: d[5]!=null ? ox+d[5]*k : null, by: d[6]!=null ? oy+d[6]*k : null}));
  }
  // Quien no tiene escaño en el plano (raro) se queda junto a su provincia.
  puntos.forEach(p=>{ if (p.bx==null){ p.bx=p.ax; p.by=p.ay; } });
  const rB = 5.3*k*0.96;
  puntos.forEach(p=>{ const e = document.createElementNS(NS,"circle"); e.setAttribute("r", R_PUNTO); e.setAttribute("cx", p.ax.toFixed(1)); e.setAttribute("cy", p.ay.toFixed(1));
    e.setAttribute("fill", G[p.d[1]]?.color || "#888"); e.dataset.dip = ctx.slug(p.d[0]);
    e.dataset.tip = `<b>${ctx.esc(ctx.legible(p.d[0]))}</b><br>${ctx.esc(G[p.d[1]]?.nombre||p.d[1])} · ${ctx.esc(p.d[2])}`; p.el = e; capa.appendChild(e); });
  // Retraso de cada punto: los del oeste salen antes, y en el hemiciclo se ordenan por la distancia al centro.
  const xs = puntos.map(p=>p.ax), x0 = Math.min(...xs), x1 = Math.max(...xs);
  puntos.forEach(p=>{ p.ret = (p.ax-x0)/(x1-x0)*0.45 + Math.random()*0.08; });
  let estado = 0, anim = null;           // 0 = mapa, 1 = hemiciclo
  const boton = caja.querySelector("[data-350]"), lbl = caja.querySelector(".lbl"), mapa = caja.querySelector(".mapa");
  const ease = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
  function ir(destino, rapido){
    if (anim) cancelAnimationFrame(anim);
    const dur = rapido ? 1 : 1700, t0 = performance.now();
    mapa.style.opacity = destino ? 0.12 : 1;
    boton.textContent = destino ? "← Al mapa" : "Al hemiciclo →";
    lbl.textContent = destino ? "escaños en el hemiciclo, cada uno en su sitio" : "escaños, repartidos entre 52 circunscripciones";
    const desde = puntos.map(p=>[+p.el.getAttribute("cx"), +p.el.getAttribute("cy"), +p.el.getAttribute("r")]);
    const paso = ahora => {
      let fin = true;
      puntos.forEach((p,j)=>{
        const local = Math.min(1, Math.max(0, ((ahora-t0)/dur - p.ret*(rapido?0:1)) / 0.55));
        if (local < 1) fin = false;
        const e = ease(local), [fx,fy,fr] = desde[j], tx = destino ? p.bx : p.ax, ty = destino ? p.by : p.ay, tr = destino ? rB : R_PUNTO;
        // Un arco suave: el punto sube un poco a mitad de camino.
        const alto = Math.sin(Math.PI*e) * (destino ? -26 : 26) * (rapido?0:1);
        p.el.setAttribute("cx", (fx+(tx-fx)*e).toFixed(1)); p.el.setAttribute("cy", (fy+(ty-fy)*e+alto).toFixed(1)); p.el.setAttribute("r", (fr+(tr-fr)*e).toFixed(2));
      });
      if (!fin) anim = requestAnimationFrame(paso);
    };
    anim = requestAnimationFrame(paso);
    estado = destino;
  }
  boton.addEventListener("click", ()=>ir(estado ? 0 : 1));
  // La primera vez que se ve, el mapa se convierte solo en hemiciclo (salvo si se prefiere menos movimiento).
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window){
    const io = new IntersectionObserver(es=>{ if (es.some(e=>e.isIntersecting && e.intersectionRatio>0.6)){ io.disconnect(); setTimeout(()=>ir(1), 700); } }, {threshold:[0.6]});
    io.observe(svg);
  }
}

/* ---------- lo que caduca ---------- */
const ETAPAS = ["Presentada, sin admitir a debate","Admitida a debate","Con informe en comisión","Aprobada en el Congreso","Pasó por el Senado"];
const COLOR_ORIGEN = {GOB:"var(--c-gob,#7152A8)", GRUPOS:"var(--c-grupos,#2A7DB5)", SEN:"var(--c-sen,#C9962A)", CCAA:"var(--c-ccaa,#83AE6E)"};
const NOMBRE_ORIGEN = {GOB:"Proyectos del Gobierno", GRUPOS:"Proposiciones de los grupos", SEN:"Proposiciones del Senado", CCAA:"Proposiciones autonómicas"};
// Números con punto de miles también en los de cuatro cifras (toLocaleString en español no los agrupa).
const miles = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
// «Proposición del Senado», «de un parlamento autonómico», «de ERC, Bildu y Sumar»…
const NOMBRE_AUTOR = {GOB:"Gobierno", SEN:"Senado", CCAA:"Parlamentos autonómicos", MIXTO:"Grupo Mixto", SUMAR:"Sumar", VOX:"Vox", BILDU:"EH Bildu", JUNTS:"Junts"};
const CON_ARTICULO = new Set(["GOB","SEN","MIXTO","PSOE","PP","PNV","BNG"]);   // «del PSOE», «de Sumar»
const deAutores = xs => { const n = xs.map(a=>a==="CCAA" ? "de un parlamento autonómico" : (CON_ARTICULO.has(a) ? "del " : "de ") + (NOMBRE_AUTOR[a]||a));
  return n.length > 1 ? n.slice(0,-1).join(", ") + " y " + n[n.length-1] : n[0] || ""; };
const colorAutor = a => ctx.G?.[a]?.color || COLOR_ORIGEN[a] || "var(--line-strong)";
const ORDENES_CAD = [["dias","Más tiempo en el Congreso"],["ampl","Más veces ampliado el plazo"],["etapa","Las que llegaron más lejos"],["recientes","Las más recientes"]];
let selCad = {q:"", autor:"", etapa:"", orden:"dias", n:30};
function itemCaducada(x){
  const {esc} = ctx;
  return `<li><button class="linklike t" data-ini="${esc(x[0])}">${esc(x[1].length>170?x[1].slice(0,168)+"…":x[1])}</button><span class="m">${esc(x[0])}</span>
    <span class="s">${x[2]==="PL"?"Proyecto del Gobierno":"Proposición "+esc(deAutores(x[4]))} · ${esc(ETAPAS[x[6]] || "")} · presentada el ${esc(ctx.fechaCorta(x[5]))} · ${miles(x[8])} días en el Congreso${x[7]?` · plazo de enmiendas ampliado ${x[7]} ${x[7]===1?"vez":"veces"}`:""}</span></li>`;
}
function caducan(){
  const {esc} = ctx, C = DATOS.caducan;
  const cerca = C.lista.filter(x=>x[6]>=3);
  const congeladas = [...C.lista].sort((a,b)=>b[7]-a[7]).slice(0,5);
  const autores = Object.entries(C.por_autor);
  return `<p class="el-lead">Al disolverse las Cortes caducan todos los asuntos que el Congreso no había terminado. Las leyes a medio tramitar tendrán que volver a presentarse en la próxima legislatura y empezar de cero.</p>
    <div class="kpis"><div class="kpi alert"><b>${miles(C.total)}</b><span>leyes caducan sin terminar su tramitación</span></div>
      <div class="kpi"><b>${C.proyectos}</b><span>proyectos del Gobierno</span></div><div class="kpi"><b>${C.proposiciones}</b><span>proposiciones de grupos, Senado y comunidades</span></div>
      <div class="kpi"><b>${C.congelador}</b><span>con el plazo de enmiendas ampliado diez veces o más</span></div><div class="kpi"><b>${miles(C.dias_medio)}</b><span>días de media en el Congreso</span></div></div>
    <div class="chart"><h3>La guillotina</h3><p class="sub">Cada punto es una ley: entra el día en que se presentó y avanza a medida que pasa cada etapa. Dale al ▶ o arrastra la fecha. El 6 de octubre de 2026, con la disolución, todo lo que seguía en trámite cae. Pasa por un punto para ver su viaje.</p>
      <div id="vj-guillotina"><p class="nota">Cargando…</p></div>
      <div class="el-leyenda">${Object.entries(NOMBRE_ORIGEN).map(([o,n])=>`<span><i style="background:${COLOR_ORIGEN[o]};border-radius:2px"></i>${esc(n)}</span>`).join("")}</div></div>
    <div class="chart"><h3>De dónde vinieron y dónde acabaron</h3><p class="sub">Los proyectos y proposiciones de ley de toda la legislatura: quién los presentó (el Gobierno, cada grupo, el Senado o un parlamento autonómico), hasta dónde llegó cada uno y dónde se quedó el resto. Las firmadas por más de un grupo van juntas. Pulsa un nodo para ver esas leyes y encontrarlas en la guillotina.</p><div id="vj-sankey"><p class="nota">Cargando…</p></div></div>
    <div class="grid2">
      <div class="chart"><h3>Las que estaban más cerca</h3><p class="sub">Ya las había aprobado el Pleno del Congreso.</p><ul class="el-lista">${cerca.map(itemCaducada).join("")}</ul></div>
      <div class="chart"><h3>Las más congeladas</h3><p class="sub">Las de plazo de enmiendas más veces ampliado: <button class="linklike" data-gl="plazo-enmiendas">el congelador</button>.</p><ul class="el-lista">${congeladas.map(itemCaducada).join("")}</ul></div>
    </div>
    <div class="chart" id="el-cad-todas"><h3>Las ${miles(C.total)}, una a una</h3>
      <div class="controls"><input type="search" data-cad="q" placeholder="Busca por título o expediente…" aria-label="Buscar una ley" value="${esc(selCad.q)}">
        <select data-cad="autor" aria-label="Quién la presentó"><option value="">Todos los autores</option>${autores.map(([a])=>`<option value="${esc(a)}"${a===selCad.autor?" selected":""}>${esc(NOMBRE_AUTOR[a]||a)}</option>`).join("")}</select>
        <select data-cad="etapa" aria-label="Hasta dónde llegó"><option value="">Todas las etapas</option>${ETAPAS.map((t,k)=>C.por_etapa[k]?`<option value="${k}"${String(k)===selCad.etapa?" selected":""}>${esc(t)}</option>`:"").join("")}</select>
        <select data-cad="orden" aria-label="Orden">${ORDENES_CAD.map(([v,t])=>`<option value="${v}"${v===selCad.orden?" selected":""}>${esc(t)}</option>`).join("")}</select></div>
      <div id="el-cad-lista"></div></div>`;
}
function montarCaducan(raiz){
  const C = DATOS.caducan, caja = raiz.querySelector("#el-cad-lista"); if (!caja) return;
  const norm = t => String(t).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  const pintar = () => {
    const q = norm(selCad.q.trim());
    const xs = C.lista.filter(x=>(!selCad.autor || x[4].includes(selCad.autor)) && (selCad.etapa==="" || x[6]===+selCad.etapa) && (!q || norm(x[1]+" "+x[0]).includes(q)));
    const k = {dias:(a,b)=>b[8]-a[8], ampl:(a,b)=>b[7]-a[7]||b[8]-a[8], etapa:(a,b)=>b[6]-a[6]||b[8]-a[8], recientes:(a,b)=>b[5].localeCompare(a[5])}[selCad.orden];
    xs.sort(k);
    caja.innerHTML = `<p class="nota" style="margin:4px 0 0">${xs.length === C.total ? `Las ${miles(xs.length)} leyes.` : `${miles(xs.length)} de ${miles(C.total)} leyes.`}</p>
      <ul class="el-lista">${xs.slice(0, selCad.n).map(itemCaducada).join("") || `<li class="nota">Ninguna ley coincide.</li>`}</ul>
      ${xs.length > selCad.n ? `<button class="btn" data-cad-mas>Ver ${Math.min(30, xs.length - selCad.n)} más</button>` : ""}`;
  };
  let t0 = null;
  raiz.addEventListener("input", e=>{ if (e.target.matches('[data-cad="q"]')){ selCad.q = e.target.value; selCad.n = 30; clearTimeout(t0); t0 = setTimeout(pintar, 200); } });
  raiz.addEventListener("change", e=>{ const c = e.target.dataset.cad; if (c && c !== "q"){ selCad[c] = e.target.value; selCad.n = 30; pintar(); } });
  raiz.addEventListener("click", e=>{
    if (e.target.closest("[data-cad-mas]")){ selCad.n += 30; pintar(); return; }
    const b = e.target.closest("[data-cad-autor]"); if (!b) return;
    selCad = {...selCad, autor: b.dataset.cadAutor, etapa: "", q: "", n: 30};
    raiz.querySelector('[data-cad="autor"]').value = selCad.autor; raiz.querySelector('[data-cad="etapa"]').value = ""; raiz.querySelector('[data-cad="q"]').value = "";
    pintar(); raiz.querySelector("#el-cad-todas").scrollIntoView({behavior:"smooth", block:"start"});
  });
  pintar();
}
function montarWaffle(){ /* los cuadrados usan los manejadores comunes de la web (data-ini, data-tip) */ }

/* ---------- decretos-leyes pendientes ---------- */
function convalidar(){
  const {esc} = ctx, L = DATOS.convalidar || [];
  if (!L.length) return "";
  return `<section class="sec" id="el-convalidar"><div class="sec-h"><h2>Lo que no caduca: los decretos-leyes</h2><p>Un real decreto-ley rige desde que se publica, pero el Congreso tiene que convalidarlo en 30 días hábiles. Con las Cortes disueltas, lo vota la Diputación Permanente.</p></div>
    <div class="chart"><ul class="el-lista">${L.map(r=>`<li><a class="t" href="${esc(r.pdf)}" target="_blank" rel="noopener">${esc(r.titulo)}</a><span class="m">BOE ${esc(ctx.fechaCorta(r.fecha))}</span></li>`).join("")}</ul></div></section>`;
}

/* ---------- la legislatura en cifras ---------- */
function balance(){
  const {esc, fmt} = ctx, B = DATOS.balance, aj = B.mas_ajustada;
  const k = [[B.plenos,"días de Pleno con votaciones"],[fmt(B.votaciones),"votaciones"],[B.ajustadas,"decididas por 10 votos o menos"],
    [B.leyes+B.leyes_organicas,`leyes aprobadas (${B.leyes_organicas} orgánicas)`],[B.decretos_ley,"reales decretos-leyes del Gobierno"],
    [B.derogados,"decretos-leyes derogados por el Congreso",true],[fmt(B.preguntas),"preguntas escritas al Gobierno"],[fmt(B.sin_respuesta),"sin respuesta",true]];
  return `<div class="sec-h"><h2>La legislatura en cifras</h2><p>De la sesión constitutiva del 17 de agosto de 2023 a la disolución del 6 de octubre de 2026.</p></div>
    <div class="kpis">${k.map(([x,l,a])=>`<div class="kpi ${a?"alert":""}"><b>${x}</b><span>${esc(l)}</span></div>`).join("")}</div>
    ${aj?`<div class="chart"><h3>La votación más ajustada</h3><p class="sub">${esc(ctx.fechaCorta(aj.fecha))}: ${aj.si} a favor y ${aj.no} en contra.</p><p><button class="linklike" data-irv="${esc(aj.id)}" data-f="${esc(aj.fecha)}">${esc(aj.titulo)} →</button></p></div>`:""}`;
}

/* ---------- ¿Repite? ---------- */
let CAND = undefined;
const cargarCand = () => CAND !== undefined ? Promise.resolve(CAND) : !DATOS.hay?.candidaturas ? Promise.resolve(CAND = null)
  : fetch("datos/elecciones/candidaturas.json").then(r=>r.ok?r.json():null).catch(()=>null).then(j=>CAND=j);
const tokensSiglas = s => new Set(String(s||"").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g,"").split(/[^A-Z0-9]+/).filter(t=>t.length>1));
let repiteProv = null;
async function pintarRepite(sec){
  if (!sec) return;
  const {esc, G, DIPS, ORDEN_HEMI} = ctx;
  const C = await cargarCand();
  const cuerpo = sec.querySelector(".nota");
  if (!C){
    cuerpo.outerHTML = `<div class="chart"><p class="sub" style="margin:0">Las candidaturas presentadas se publican en el BOE el <b>28 de octubre</b> y las proclamadas, el <b>3 de noviembre</b>. Ese día, esta sección cruzará cada lista con los diputados de la legislatura: quién vuelve, en qué puesto, quién cambia de provincia o de siglas y quién no se presenta.</p></div>`;
    return;
  }
  const vivos = DIPS.map((d,i)=>({d,i})).filter(({d})=>!d[8]);
  const R = C.repite || {};
  // Escaños que sacó cada grupo en cada provincia en 2023 (los diputados que tiene hoy allí): un puesto igual o
  // inferior es un puesto «de salida» si su partido repitiera el resultado.
  const escGrupo = {}; vivos.forEach(({d})=>{ const k=d[2]+"|"+d[1]; escGrupo[k]=(escGrupo[k]||0)+1; });
  const info = vivos.map(({d,i})=>{ const r=R[d[0]]; const salida = r && r.tipo==="titular" && !r.otra_provincia && r.orden <= (escGrupo[d[2]+"|"+d[1]]||0);
    const otrasSiglas = r && ![...tokensSiglas(r.siglas)].some(t=>tokensSiglas(d[3]).has(t));
    return {d, i, r, salida, otrasSiglas}; });
  const repiten = info.filter(x=>x.r), titulares = repiten.filter(x=>x.r.tipo==="titular");
  const fase = C.fase==="proclamadas" ? "proclamadas" : "presentadas";
  const k = [[repiten.length, `de ${vivos.length} diputados van en alguna lista`],[titulares.length,"como titulares"],[info.filter(x=>x.salida).length,"en un puesto que su grupo ganó en 2023"],
    [repiten.filter(x=>x.r.otra_provincia).length,"cambian de provincia"],[repiten.filter(x=>x.otrasSiglas).length,"van con otras siglas"],[vivos.length-repiten.length,"no se presentan al Congreso",true]];
  // Hemiciclo real: encendido quien repite (más tenue si va de suplente).
  const P = ctx.PLANO;
  const hemi = P ? `<svg class="el-hemi" viewBox="-4 -4 ${P.ancho+8} ${P.alto+4}" role="img" aria-label="Hemiciclo: en color, los diputados que vuelven a ir en las listas">${info.filter(x=>x.d[5]!=null).map(x=>
    `<circle cx="${x.d[5]}" cy="${x.d[6]}" r="5.3" fill="${x.r?G[x.d[1]]?.color:"var(--line)"}" ${x.r&&x.r.tipo!=="titular"?'fill-opacity=".45"':""} data-dip="${esc(ctx.slug(x.d[0]))}" data-tip="${esc(`<b>${esc(ctx.legible(x.d[0]))}</b> (${esc(x.d[1])}, ${esc(x.d[2])})<br>${x.r?`${esc(x.r.siglas)} · ${x.r.tipo==="titular"?"nº "+x.r.orden:"suplente "+x.r.orden} por ${esc(x.r.circ)}`:"No va en las listas al Congreso"}`)}"></circle>`).join("")}</svg>` : "";
  const provs = [...new Set(vivos.map(({d})=>d[2]))].sort((a,b)=>a.localeCompare(b,"es"));
  repiteProv ||= (()=>{ try{ const sl=localStorage.getItem("provincia"); return provs.find(c=>ctx.slug(c)===sl); }catch(e){ return null; } })() || "Madrid";
  cuerpo.outerHTML = `<div class="kpis">${k.map(([x,l,a])=>`<div class="kpi ${a?"alert":""}"><b>${x}</b><span>${esc(l)}</span></div>`).join("")}</div>
    <div class="chart"><h3>Quién vuelve</h3><p class="sub">En color, los diputados que van en alguna lista al Congreso (más tenue, de suplentes); en gris, los que no. Según las candidaturas ${fase} en el BOE.</p>${hemi}</div>
    <div class="chart"><div class="controls"><label for="el-rep-prov">Provincia</label><select id="el-rep-prov">${provs.map(c=>`<option${c===repiteProv?" selected":""}>${esc(c)}</option>`).join("")}</select></div><div id="el-rep-tabla"></div></div>
    ${listaCambios(repiten.filter(x=>x.r.otra_provincia), "Cambian de provincia", x=>`ahora por ${esc(x.r.circ)}`)}
    ${listaCambios(repiten.filter(x=>x.otrasSiglas), "Con otras siglas", x=>`en 2023 por ${esc(x.d[3])}; ahora, ${esc(x.r.candidatura)} (${esc(x.r.siglas)})`)}
    <p class="nota">Fuente: candidaturas ${fase} al Congreso de los Diputados (BOE ${(C.boe||[]).map(esc).join(", ")}). Los nombres se casan con los del Congreso de forma automática; un homónimo se desempata por provincia.</p>`;
  const tabla = () => { const t = sec.querySelector("#el-rep-tabla"); if (!t) return;
    const suyos = info.filter(x=>x.d[2]===repiteProv).sort((a,b)=>ORDEN_HEMI.indexOf(a.d[1])-ORDEN_HEMI.indexOf(b.d[1]) || a.d[0].localeCompare(b.d[0],"es"));
    const listas = (C.listas||{})[repiteProv] || [];
    t.innerHTML = `<ul class="el-lista">${suyos.map(x=>`<li><button class="linklike t" data-dip="${esc(ctx.slug(x.d[0]))}"><span class="dot" style="background:${G[x.d[1]]?.color}"></span>${esc(ctx.legible(x.d[0]))}</button>
        <span class="m">${x.r ? `${esc(x.r.siglas)} · ${x.r.tipo==="titular"?"nº "+x.r.orden:"supl. "+x.r.orden}${x.r.otra_provincia?" · "+esc(x.r.circ):""}` : "no se presenta"}</span></li>`).join("")}</ul>
      ${listas.length?`<details><summary>Las ${listas.filter(l=>l.proclamada).length} listas de ${esc(repiteProv)}</summary><ul class="el-lista">${listas.filter(l=>l.proclamada).map(l=>`<li><span class="t"><b>${esc(l.siglas||l.nombre)}</b> · ${esc(l.titulares.slice(0,6).map(x=>x[0]).join(", "))}${l.titulares.length>6?"…":""}</span><span class="m">${l.titulares.length} + ${l.suplentes.length}</span></li>`).join("")}</ul></details>`:""}`; };
  tabla();
  sec.querySelector("#el-rep-prov").addEventListener("change", e=>{ repiteProv = e.target.value; tabla(); });
}
function listaCambios(xs, titulo, detalle){
  if (!xs.length) return "";
  const {esc, G} = ctx;
  return `<div class="chart"><h3>${esc(titulo)} <small class="nota">(${xs.length})</small></h3><ul class="el-lista">${xs.map(x=>`<li><button class="linklike t" data-dip="${esc(ctx.slug(x.d[0]))}"><span class="dot" style="background:${G[x.d[1]]?.color}"></span>${esc(ctx.legible(x.d[0]))}</button><span class="m">${esc(x.d[2])}</span><span class="s">${detalle(x)}</span></li>`).join("")}</ul></div>`;
}


/* ---------- qué prometieron y qué votaron (para más adelante: aún no se muestra) ---------- */
const CATS = [
  ["a_favor_cumple","var(--si)"],["a_favor_avanza","color-mix(in srgb,var(--si) 55%,var(--surface))"],["en_contra_contradice","color-mix(in srgb,var(--si) 75%,var(--ink) 10%)"],
  ["abstencion","var(--abst)"],["distinto_sentido","color-mix(in srgb,var(--abst) 55%,var(--surface))"],
  ["en_contra_cumple","var(--no)"],["en_contra_avanza","color-mix(in srgb,var(--no) 55%,var(--surface))"],["a_favor_contradice","color-mix(in srgb,var(--no) 75%,var(--ink) 10%)"],
  ["no_votada","var(--line-strong)"],["sin_competencia","var(--line)"],["no_verificable","var(--sunk)"]];
const COLOR_CAT = Object.fromEntries(CATS);
const ORDEN_PROG = ["PP","PSOE","VOX","SUMAR","ERC","JUNTS","BILDU","PNV","BNG","UPN"];
let PROM = undefined, promSel = {p:null, cat:null, tema:"", q:""};
async function pintarPromesas(sec){
  if (!sec) return;
  const {esc} = ctx;
  if (PROM === undefined) PROM = DATOS.hay?.promesas ? await fetch("datos/elecciones/promesas.json").then(r=>r.ok?r.json():null).catch(()=>null) : null;
  const cuerpo = sec.querySelector(".nota");
  if (!PROM){ cuerpo.outerHTML = `<div class="chart"><p class="sub" style="margin:0">En preparación: estamos extrayendo las promesas de los diez programas de 2023 y cruzándolas con las votaciones de la legislatura.</p></div>`; return; }
  const R = PROM.resultados || {};
  const progs = ORDEN_PROG.filter(p=>PROM.programas[p]);
  promSel.p ||= progs[0];
  cuerpo.outerHTML = `<div class="chart" style="gap:8px"><p class="sub" style="margin:0"><b>Qué se mide.</b> No si una promesa «se cumplió» (desde la oposición casi nunca se puede), sino qué votaron los diputados de cada candidatura sobre lo que prometió. Un modelo de lenguaje marca las promesas verificables (solo con cita literal del programa) y, sin saber de qué partido es ni cómo votó nadie, dice si cada iniciativa votada la cumple, avanza o la contradice; el resultado lo da una regla fija, igual para todos. No es un ranking: cada programa tiene un tamaño y un nivel de detalle distintos.</p>
      <p class="sub" style="margin:0"><b>Versión preliminar.</b> La clasificación automática está en revisión humana por muestreo. Si ves un error, avísanos. Coalición Canaria no publicó programa para las generales de 2023.</p></div>
    <div class="el-prom-cats" role="group" aria-label="Programa">${progs.map(p=>`<button data-prom-p="${p}" aria-pressed="${p===promSel.p}">${esc(PROM.programas[p].nombre)}</button>`).join("")}</div>
    <div id="el-prom-cuerpo"></div>`;
  const pintar = () => {
    const P = PROM.programas[promSel.p], L = P.promesas;
    const cuenta = Object.fromEntries(CATS.map(([c])=>[c, L.filter(x=>x.resultado===c).length]));
    const temas = [...new Set(L.map(x=>x.tema))].sort();
    const q = promSel.q.trim().toLowerCase();
    const filtradas = L.filter(x=>(!promSel.cat || x.resultado===promSel.cat) && (!promSel.tema || x.tema===promSel.tema) && (!q || (x.resumen+" "+x.cita).toLowerCase().includes(q)));
    const votadas = L.filter(x=>x.votos?.length).length;
    sec.querySelector("#el-prom-cuerpo").innerHTML = `
      <div class="kpis"><div class="kpi"><b>${L.length}</b><span>promesas verificables en su programa</span></div><div class="kpi"><b>${votadas}</b><span>con alguna votación relacionada en el Pleno</span></div><div class="kpi"><b>${P.diputados}</b><span>diputados elegidos en sus listas</span></div></div>
      <div class="chart"><div class="el-prom-barra" role="img" aria-label="Reparto de las ${L.length} promesas por resultado">${CATS.filter(([c])=>cuenta[c]).map(([c,col])=>`<i style="flex:${cuenta[c]};background:${col}" data-tip="${esc(`<b>${esc(R[c]||c)}</b><br>${cuenta[c]} de ${L.length}`)}"></i>`).join("")}</div>
        <div class="el-prom-cats">${CATS.filter(([c])=>cuenta[c]).map(([c,col])=>`<button data-prom-cat="${c}" aria-pressed="${promSel.cat===c}"><i style="background:${col}"></i>${esc(R[c]||c)} · ${cuenta[c]}</button>`).join("")}</div>
        <div class="controls"><select data-prom-tema aria-label="Tema"><option value="">Todos los temas</option>${temas.map(t=>`<option value="${esc(t)}"${t===promSel.tema?" selected":""}>${esc(t==="otro"?"Otros temas":t)}</option>`).join("")}</select>
          <input type="search" data-prom-q placeholder="Buscar en las promesas…" value="${esc(promSel.q)}" aria-label="Buscar en las promesas"></div></div>
      <div class="chart"><ul class="el-prom">${filtradas.slice(0, 80).map(x=>promesa(x, P, R)).join("") || `<li class="nota">Ninguna promesa coincide.</li>`}</ul>
        ${filtradas.length>80?`<p class="nota">Se muestran 80 de ${filtradas.length}. Filtra por tema o resultado para ver el resto.</p>`:""}</div>`;
  };
  sec.addEventListener("click", e=>{
    const b = e.target.closest("[data-prom-p]"); if (b){ promSel = {p:b.dataset.promP, cat:null, tema:"", q:""}; sec.querySelectorAll("[data-prom-p]").forEach(x=>x.setAttribute("aria-pressed", String(x===b))); pintar(); return; }
    const c = e.target.closest("[data-prom-cat]"); if (c){ promSel.cat = promSel.cat===c.dataset.promCat ? null : c.dataset.promCat; pintar(); }
  });
  sec.addEventListener("change", e=>{ if (e.target.matches("[data-prom-tema]")){ promSel.tema = e.target.value; pintar(); } });
  sec.addEventListener("input", e=>{ if (e.target.matches("[data-prom-q]")){ promSel.q = e.target.value; clearTimeout(pintarPromesas.t); pintarPromesas.t = setTimeout(()=>{ pintar(); const i = sec.querySelector("[data-prom-q]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); } });
  pintar();
}
const VOTO = {S:"Sí", N:"No", A:"Abst.", D:"Dividido"};
const RELACION = {cumple:"la cumple", avanza:"avanza hacia ella", contradice:"la contradice"};
function promesa(x, P, R){
  const {esc} = ctx;
  return `<li><span class="r"><i style="background:${COLOR_CAT[x.resultado]}"></i>${esc(R[x.resultado]||x.resultado)}</span>
    <b>${esc(x.resumen)}</b>
    <blockquote>«${esc(x.cita)}» <a href="${esc(P.url)}#page=${x.pagina}" target="_blank" rel="noopener">p. ${x.pagina}</a></blockquote>
    ${x.votos?.length?`<div class="vs">${x.votos.map(v=>`<div><span class="x">${esc(VOTO[v[5]]||v[5]||"–")}</span><span><button class="linklike" style="text-align:left;font-size:13px" data-irv="${esc(v[1])}" data-f="${esc(v[2])}">${esc(v[3])}</button> <small>· ${esc(ctx.fechaCorta(v[2]))} · ${esc(RELACION[v[4]]||v[4])}${v[7]?"":" · no vinculante"}${v[6]?` · ${esc(v[6])}`:""}</small></span></div>`).join("")}</div>`:""}</li>`;
}
