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
.el-lista .t{font-size:14px;line-height:1.35}
.el-lista .m{font-size:12px;color:var(--muted);font-family:var(--mono);white-space:nowrap}
.el-lista .s{grid-column:1/-1;font-size:12.5px;color:var(--muted)}
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

export async function render(el, c, sub){
  ctx = c; estilos();
  if (!DATOS){ el.innerHTML = `<p class="nota">Cargando la sección de elecciones…</p>`; await cargar(); }
  if (!DATOS){ el.innerHTML = `<p class="nota">No se han podido cargar los datos de las elecciones.</p>`; return; }
  const {esc} = ctx;
  const faltan = diasHasta(DATOS.votacion);
  const cuenta = faltan > 1 ? `<b>${faltan}</b><span>días para votar</span>` : faltan === 1 ? `<b>1</b><span>día: mañana se vota</span>`
    : faltan === 0 ? `<b>HOY</b><span>se vota de 9.00 a 20.00</span>` : `<b>29N</b><span>elecciones generales</span>`;
  el.innerHTML = `
    <div class="el-hero"><div><div class="eyebrow">Elecciones generales · domingo 29 de noviembre de 2026</div>
      <h2>Antes de votar, mira lo que votaron</h2>
      <p>La XV legislatura se cierra con la disolución de las Cortes. Aquí está lo que dejó hecho y sin hacer, quién vuelve a presentarse, qué se prometió en 2023 y qué se votó después, cómo se reparten los 350 escaños y cuarenta y nueve años de elecciones. Todo con datos oficiales.</p></div>
      <div class="el-cuenta">${cuenta}</div></div>
    <nav class="el-nav" aria-label="Apartados de las elecciones">${[["el-calendario","Calendario"],["el-350","Los 350"],["el-caducan","Lo que caduca"],["el-balance","La legislatura en cifras"],["el-proximamente","Próximamente"]]
      .map(([a,l])=>`<a href="#${a}" data-el-ir="${a}">${l}</a>`).join("")}</nav>
    <section class="sec" id="el-calendario"><div class="sec-h"><h2>Calendario</h2><p>Los plazos los fija la Ley Orgánica del Régimen Electoral General (LOREG) y se cuentan desde la publicación del decreto de convocatoria.</p></div>
      ${calendario()}</section>
    <section class="sec" id="el-350"><div class="sec-h"><h2>Los 350</h2><p>Cada punto es un escaño del Congreso que sale de las urnas de su provincia. Así quedaron repartidos en 2023, y así se sientan hoy en el hemiciclo.</p></div>
      ${bloque350()}</section>
    <section class="sec" id="el-caducan">${caducan()}</section>
    ${convalidar()}
    <section class="sec" id="el-balance">${balance()}</section>
    <section class="sec" id="el-proximamente"><div class="sec-h"><h2>Próximamente</h2><p>Lo que irá apareciendo en esta sección hasta el 29N.</p></div>
      <div class="el-pronto">${[
        ["¿Repite?","Quién de los 350 vuelve a ir en las listas, en qué puesto y con qué historial de votos.","Desde el 28 de octubre, cuando el BOE publique las candidaturas"],
        ["Qué prometieron y qué votaron","Las promesas de los programas de 2023, una a una, frente a lo que cada grupo votó en el Congreso.","En preparación"],
        ["El precio de un escaño","Cuántos votos cuesta un escaño en cada provincia y cuántos se quedan sin representación.","En preparación"],
        ["Cuarenta y nueve años de elecciones","Todas las generales desde 1977: escaños, participación y el mapa de cada una.","En preparación"],
        ["La noche electoral","Los resultados del escrutinio en directo, provincia a provincia, y el nuevo hemiciclo escaño a escaño.","29 de noviembre, desde las 20.00"],
      ].map(([t,p,s])=>`<div class="chart"><b>${esc(t)}</b><p>${esc(p)}</p><small>${esc(s)}</small></div>`).join("")}</div></section>`;
  el.querySelectorAll("[data-el-ir]").forEach(a => a.addEventListener("click", e => {
    e.preventDefault(); const t = document.getElementById(a.dataset.elIr); if (t){ t.scrollIntoView({block:"start"}); window.scrollBy(0,-70); }
  }));
  montar350(el.querySelector(".el-350"));
  montarWaffle(el.querySelector(".el-waffle"));
  if (sub){ const t = document.getElementById("el-"+sub); if (t){ t.scrollIntoView({block:"start"}); window.scrollBy(0,-70); } }
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
const R_PUNTO = 6.2;
function racimos(cuantos){
  // Un círculo por provincia, de área proporcional a sus escaños, empujado hasta que no se solapen
  // (cartograma de Dorling), siempre atraído hacia su sitio en el mapa. Determinista: mismas iteraciones.
  const P = GEO.provincias, sep = R_PUNTO*2+1.6;
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
function girasol(n){
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
  svg.addEventListener("click", e=>{ const c = e.target.closest("circle[data-dip]"); if (c) ctx.irDiputado(c.dataset.dip); });
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
