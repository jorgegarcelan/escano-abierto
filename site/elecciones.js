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
.el-subnav{display:flex;gap:6px;overflow-x:auto;padding:10px 0 14px;margin-bottom:6px;border-bottom:1px solid var(--line);scrollbar-width:thin}
.el-subnav a{flex:none;font-size:13px;text-decoration:none;color:var(--muted);border:1px solid var(--line);border-radius:var(--r-pill);padding:5px 11px;background:var(--surface)}
.el-subnav a:hover{color:var(--ink);border-color:var(--line-strong)}
.el-subnav a[aria-current="page"]{color:var(--bg);background:var(--ink);border-color:var(--ink)}
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
  {id:"350", t:"Los 350", d:"Cada escaño sale de una provincia. Del mapa al hemiciclo, y cómo ha cambiado el reparto desde 1977."},
  {id:"caducan", t:"Lo que caduca", d:"Las leyes que la disolución deja a medio camino y los decretos-leyes que heredará la Diputación Permanente."},
  {id:"legislatura", t:"La legislatura en cifras", d:"La XV legislatura, de la sesión constitutiva a la disolución: votaciones, leyes, decretos y preguntas."},
  {id:"repite", t:"¿Repite?", d:"Quién de los 350 vuelve a ir en las listas, en qué puesto y por qué provincia."},
  {id:"escano", t:"El precio de un escaño", d:"Cuántos votos cuesta un diputado en cada provincia, el último escaño de cada una y un simulador D'Hondt."},
  {id:"historico", t:"Elecciones desde 1977", d:"Las dieciséis generales, con la ficha de cada elección y de su legislatura."},
  {id:"provincias", t:"Provincias", d:"Las 52 circunscripciones: escaños, participación, votos por escaño y su historia electoral."},
  {id:"metricas", t:"Métricas", d:"Participación, fragmentación, desproporcionalidad, volatilidad y bipartidismo, elección a elección."},
  {id:"mapa", t:"Municipio a municipio", d:"El voto de 2019 y 2023 en los 8.131 municipios y cuánto cambió entre las dos."},
  {id:"voto", t:"La geografía del voto", d:"Ciudad y campo, la España vacía, la edad, el dinero, las Españas, el giro y el peso del voto: cómo vota cada España, municipio a municipio."},
  {id:"noche", t:"La noche electoral", d:"El escrutinio del 29N en directo, provincia a provincia, con los escaños que aún están en el aire."},
];
const PAG = Object.fromEntries(PAGINAS.map(p=>[p.id, p]));

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
  el.innerHTML = `<nav class="el-migas" aria-label="Estás en"><a href="#elecciones">Elecciones 29N</a>${eleccion||provincia?` <span>›</span> <a href="#elecciones-${actual}">${esc(PAG[actual].t)}</a>`:""}</nav>
    <nav class="el-subnav" aria-label="Apartados de las elecciones">${PAGINAS.map(x=>`<a href="#elecciones-${x.id}"${x.id===actual?' aria-current="page"':""}>${esc(x.t)}</a>`).join("")}</nav>
    <div id="el-pagina">${p ? `<div class="view-intro"><div><h2>${esc(p.t)}</h2><p>${esc(p.d)}</p></div></div>` : ""}<div class="el-cuerpo"><p class="nota">Cargando…</p></div></div>`;
  const cuerpo = el.querySelector(".el-cuerpo");
  // El menú de apartados se desplaza de lado: que se vea el actual.
  const nav = el.querySelector(".el-subnav"), act = nav?.querySelector('[aria-current="page"]');
  if (act) nav.scrollLeft = act.offsetLeft - nav.offsetLeft - (nav.clientWidth - act.offsetWidth) / 2;
  const hist = f => import("./elecciones-historico.js").then(m=>m[f](cuerpo, ctx, sub)).catch(err=>{ console.error(err); cuerpo.innerHTML = `<p class="nota">No se ha podido cargar este apartado.</p>`; });
  if (sub === "350"){
    cuerpo.innerHTML = `<section class="sec" style="padding-top:8px">${bloque350()}</section><section class="sec" id="el-reparto"><p class="nota">Cargando…</p></section>`;
    montar350(cuerpo.querySelector(".el-350"));
    import("./elecciones-historico.js").then(m=>m.pintarReparto(cuerpo.querySelector("#el-reparto"), ctx));
  } else if (sub === "caducan"){ cuerpo.innerHTML = `<section class="sec" style="padding-top:8px">${caducan()}</section>${convalidar()}`; }
  else if (sub === "legislatura"){ cuerpo.innerHTML = `<section class="sec" style="padding-top:8px">${balance()}</section>`; }
  else if (sub === "repite"){ cuerpo.innerHTML = `<section class="sec" id="el-repite" style="padding-top:8px"><p class="nota">Cargando…</p></section>`; pintarRepite(cuerpo.querySelector("#el-repite")); }
  else if (sub === "escano") hist("pintarEscano");
  else if (sub === "historico") hist("pintarHistorico");
  else if (sub === "provincias") hist("pintarProvincias");
  else if (sub === "metricas") hist("pintarMetricas");
  else if (sub === "mapa") hist("pintarMunicipios");
  else if (sub === "noche") hist("pintarNoche");
  else if (sub === "voto") import("./geografia.js").then(m=>m.geografiaDelVoto(cuerpo, ctx)).catch(err=>{ console.error(err); cuerpo.innerHTML = `<p class="nota">No se ha podido cargar este apartado.</p>`; });
  else if (eleccion) hist("pintarFicha");
  else if (provincia) hist("pintarProvincia");
}

/* ---------- home de la sección ---------- */
function home(el){
  const {esc, fmt} = ctx;
  const faltan = diasHasta(DATOS.votacion);
  const cuenta = faltan > 1 ? `<b>${faltan}</b><span>días para votar</span>` : faltan === 1 ? `<b>1</b><span>día: mañana se vota</span>`
    : faltan === 0 ? `<b>HOY</b><span>se vota de 9.00 a 20.00</span>` : `<b>29N</b><span>elecciones generales</span>`;
  const C = DATOS.caducan, B = DATOS.balance;
  const tarjeta = (id, cifra, pie, visual="") => `<a class="el-tarjeta" href="#elecciones-${id}"><span class="t">${esc(PAG[id].t)} <span aria-hidden="true">→</span></span><span class="d">${esc(PAG[id].d)}</span>
    ${cifra?`<span class="c">${cifra}</span><span class="p">${pie}</span>`:""}<span class="v" data-mini="${id}">${visual}</span></a>`;
  el.innerHTML = `
    <div class="el-hero"><div><div class="eyebrow">Elecciones generales · domingo 29 de noviembre de 2026</div>
      <h2>Antes de votar, mira lo que votaron</h2>
      <p>La XV legislatura se cierra con la disolución de las Cortes. Lo que dejó hecho y sin hacer, quién vuelve a presentarse, cómo se reparten los 350 escaños y cuarenta y nueve años de elecciones, provincia a provincia. Todo con datos oficiales e interactivo.</p></div>
      <div class="el-cuenta">${cuenta}</div></div>
    <section class="sec" style="padding-top:22px"><div class="sec-h"><h2>Calendario</h2><p>Los plazos los fija la Ley Orgánica del Régimen Electoral General y se cuentan desde la publicación del decreto de convocatoria.</p></div>${calendario()}</section>
    <section class="sec">${bloque350()}<p class="nota"><a href="#elecciones-350">Cómo ha cambiado el reparto de escaños por provincia desde 1977 →</a></p></section>
    <section class="sec"><div class="sec-h"><h2>Apartados</h2></div>
      <div class="el-tarjetas">
        ${tarjeta("caducan", fmt(C.total), "leyes caducan sin terminar", miniWaffle())}
        ${tarjeta("legislatura", fmt(B.votaciones), `votaciones; la más ajustada, ${B.mas_ajustada?`${B.mas_ajustada.si} a ${B.mas_ajustada.no}`:""}`)}
        ${tarjeta("repite", DATOS.hay?.candidaturas ? "" : "28 oct", DATOS.hay?.candidaturas ? "" : "el BOE publica las listas", miniHemi())}
        ${tarjeta("escano", "", "")}
        ${tarjeta("historico", "16", "elecciones generales desde 1977")}
        ${tarjeta("provincias", "52", "circunscripciones", miniMapa())}
        ${tarjeta("metricas", "", "")}
        ${tarjeta("mapa", "8.131", "municipios")}
        ${tarjeta("voto", "7", "ejes para entender cómo vota cada España")}
        ${tarjeta("noche", "20.00", "del 29 de noviembre: empieza el escrutinio. Antes, un ensayo con el 23J")}
      </div></section>
    <section class="sec"><div class="sec-h"><h2>Próximamente</h2></div>
      <div class="el-pronto">${[["Qué prometieron y qué votaron","Las promesas de los programas de 2023 frente a lo que votó cada candidatura en el Congreso.","Más adelante"]]
        .map(([t,p,s])=>`<div class="chart"><b>${esc(t)}</b><p>${esc(p)}</p><small>${esc(s)}</small></div>`).join("")}</div></section>`;
  montar350(el.querySelector(".el-350"));
  // Las tarjetas que necesitan el histórico se completan cuando llega (sin bloquear la portada).
  import("./elecciones-historico.js").then(m=>m.miniaturas(el, ctx)).catch(()=>{});
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

/* ---------- calendario ---------- */
function calendario(){
  const {esc} = ctx, hoy = hoyISO(), H = DATOS.calendario;
  // Hito actual: el último que ha empezado (o el que está en curso, si tiene «hasta»).
  let actual = -1; H.forEach((h,k) => { if (h.fecha <= hoy) actual = k; });
  return `<div class="el-cal" style="--n:${H.length}">${H.map((h,k)=>{
    const estado = k < actual && (!h.hasta || h.hasta < hoy) ? "pasado" : k === actual || (h.hasta && h.fecha <= hoy && hoy <= h.hasta) ? "ahora" : "";
    const f = h.hasta ? `${fechaCortaEl(h.fecha)} – ${fechaCortaEl(h.hasta)}` : (h.aprox ? "antes del " : "") + fechaCortaEl(h.fecha);
    return `<div class="h ${estado}" ${h.detalle?`data-tip="${esc(`<b>${esc(h.hito)}</b><br>${esc(h.detalle)}<br><i>${esc(h.ley)}</i>`)}"`:""}><i></i><b>${esc(h.hito)}</b><small>${esc(f)}</small></div>`;
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
function caducan(){
  const {esc, fmt} = ctx, C = DATOS.caducan;
  const filas = ETAPAS.map((t,k)=>[k, t, C.lista.filter(x=>x[6]===k)]).filter(f=>f[2].length).reverse();
  const cerca = C.lista.filter(x=>x[6]>=3);
  const congeladas = [...C.lista].sort((a,b)=>b[7]-a[7]).slice(0,5);
  const item = x => `<li><button class="linklike t" data-ini="${esc(x[0])}">${esc(x[1].length>170?x[1].slice(0,168)+"…":x[1])}</button><span class="m">${esc(x[0])}</span>
    <span class="s">${x[2]==="PL"?"Proyecto del Gobierno":"Proposición de "+esc(x[4].map(a=>ctx.autorNombre(a)).join(", "))} · presentada el ${esc(ctx.fechaCorta(x[5]))} · ${fmt(x[8])} días en el Congreso${x[7]?` · plazo de enmiendas ampliado ${x[7]} ${x[7]===1?"vez":"veces"}`:""}</span></li>`;
  return `<div class="sec-h"><h2>Lo que caduca con la disolución</h2><p>Al disolverse las Cortes caducan todos los asuntos que el Congreso no había terminado. Las leyes a medio tramitar tendrán que volver a presentarse en la próxima legislatura y empezar de cero.</p></div>
    <div class="kpis"><div class="kpi alert"><b>${fmt(C.total)}</b><span>leyes caducan sin terminar su tramitación</span></div>
      <div class="kpi"><b>${C.proyectos}</b><span>proyectos del Gobierno</span></div><div class="kpi"><b>${C.proposiciones}</b><span>proposiciones de grupos, Senado y comunidades</span></div>
      <div class="kpi"><b>${C.congelador}</b><span>con el plazo de enmiendas ampliado diez veces o más</span></div><div class="kpi"><b>${fmt(C.dias_medio)}</b><span>días de media en el Congreso</span></div></div>
    <div class="chart"><h3>Hasta dónde llegaron</h3><p class="sub">Un cuadrado por ley, según la última etapa que alcanzó. Pulsa uno para ver su tramitación.</p>
      <div class="el-waffle">${filas.map(([k,t,xs])=>`<div class="fila"><div>${esc(t)}<small>${xs.length} ${xs.length===1?"ley":"leyes"}</small></div>
        <div class="cel">${xs.map(x=>`<button style="--c:${COLOR_ORIGEN[x[3]]}" data-ini="${esc(x[0])}" aria-label="${esc(x[1])}" data-tip="${esc(`<b>${esc(x[1].slice(0,160))}</b><br>${esc(NOMBRE_ORIGEN[x[3]])} · ${x[8]} días`)}"></button>`).join("")}</div></div>`).join("")}</div>
      <div class="el-leyenda">${Object.entries(NOMBRE_ORIGEN).filter(([o])=>C.por_origen[o]).map(([o,n])=>`<span><i style="background:${COLOR_ORIGEN[o]};border-radius:2px"></i>${esc(n)} (${C.por_origen[o]})</span>`).join("")}</div></div>
    <div class="grid2">
      <div class="chart"><h3>Las que estaban más cerca</h3><p class="sub">Ya las había aprobado el Pleno del Congreso.</p><ul class="el-lista">${cerca.map(item).join("")}</ul></div>
      <div class="chart"><h3>Las más congeladas</h3><p class="sub">Las de plazo de enmiendas más veces ampliado: <button class="linklike" data-gl="plazo-enmiendas">el congelador</button>.</p><ul class="el-lista">${congeladas.map(item).join("")}</ul></div>
    </div>`;
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
