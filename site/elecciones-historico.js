/* Elecciones 29N · histórico (1977–2023), precio del escaño y mapa municipal.
   Lo carga elecciones.js cuando el lector llega a estas secciones. Datos: datos/elecciones/historico*.json,
   municipios-*.json y geo-*.json (ficheros oficiales de Interior e IGN, procesados en escano/historico.py). */

/* Familias agrupadas para leer cuarenta y nueve años de un vistazo: seis de ámbito estatal con su color, los
   partidos nacionalistas y regionalistas juntos y el resto. Colores comprobados con el validador de la guía de
   visualización (separación con daltonismo y contraste en modo claro y oscuro). */
export const GRUPOS = [
  {id:"IZQ", nombre:"IU, Podemos y Sumar", color:"#8B5CC4", familias:["IZQ"]},
  {id:"PSOE", nombre:"PSOE", color:"#D8342B", familias:["PSOE"]},
  {id:"NAC", nombre:"Nacionalistas y regionalistas", color:"#8F8270", familias:["BILDU","ERC","BNG","PNV","CIU","CC"]},
  {id:"UCD", nombre:"UCD y CDS", color:"#B98A16", familias:["UCD"]},
  {id:"CS", nombre:"Ciudadanos", color:"#CF7F12", familias:["CS"]},
  {id:"PP", nombre:"PP (antes AP y CD)", color:"#2C7BC4", familias:["PP"]},
  {id:"VOX", nombre:"Vox", color:"#4E9A35", familias:["VOX"]},
  {id:"OTROS", nombre:"Otros", color:"#5E636B", familias:["OTROS"]},
];
const GRUPO_DE = Object.fromEntries(GRUPOS.flatMap(g=>g.familias.map(f=>[f, g.id])));
const G8 = Object.fromEntries(GRUPOS.map(g=>[g.id, g]));
const CORTO = {IZQ:"IU-Podemos-Sumar", PSOE:"PSOE", NAC:"Nacionalistas", UCD:"UCD-CDS", CS:"Cs", PP:"PP", VOX:"Vox", OTROS:"Otros"};

const CSS = `
.hi-anios{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.hi-anios button{appearance:none;font:500 12.5px var(--mono);border:1px solid var(--line);background:var(--surface);color:var(--muted);border-radius:var(--r-chip);padding:4px 7px;cursor:pointer}
.hi-anios button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.hi-anios .play{font-family:var(--sans);color:var(--ink);border-color:var(--line-strong);margin-right:6px}
.hi-top{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:18px;align-items:start}
@media (max-width:820px){ .hi-top{grid-template-columns:1fr} }
.hi-hemi{display:block;width:100%;height:auto}
.hi-hemi circle{transition:fill .55s ease;transition-delay:calc(var(--k) * 1.6ms)}
.hi-anio{font-family:var(--led,var(--display));font-size:clamp(40px,6vw,64px);font-weight:900;line-height:.9}
.hi-tabla{width:100%;border-collapse:collapse;font-size:13px}
.hi-tabla td,.hi-tabla th{padding:5px 4px;border-top:1px solid var(--line);text-align:left;font-weight:400}
.hi-tabla th{color:var(--muted);font-size:11.5px;border-top:0}
.hi-tabla .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.hi-tabla i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:0}
.hi-svg{display:block;width:100%;height:auto;overflow:visible;max-width:100%}
.hi-svg .eje{stroke:var(--line);stroke-width:1}
.hi-svg .tick{font:11px var(--mono);fill:var(--muted)}
.hi-svg .lbl{font:600 12px var(--sans)}
.hi-svg .lbl-fuera{font:500 12px var(--sans);fill:var(--ink)}
.hi-svg .cruz{stroke:var(--ink);stroke-width:1;opacity:0;pointer-events:none}
.hi-svg .sel{stroke:var(--ink);stroke-width:1.5}
.hi-svg .banda{stroke:var(--surface);stroke-width:2;stroke-linejoin:round}
.hi-svg .linea{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.hi-svg .punto{stroke:var(--surface);stroke-width:2}
.hi-svg .prov{stroke:var(--surface);stroke-width:.7}
.hi-svg .prov:hover,.hi-svg .muni:hover{stroke:var(--ink);stroke-width:1.2}
.hi-svg .can{fill:none;stroke:var(--line-strong);stroke-width:.8}
.hi-tip{position:fixed;z-index:60;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--line-strong);border-radius:8px;padding:8px 10px;font-size:12.5px;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:280px}
.hi-tip b{font-weight:600}
.hi-tip .f{display:flex;justify-content:space-between;gap:14px}
.hi-tip .f i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.hi-rampa{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.hi-rampa span.r{display:inline-block;width:140px;height:9px;border-radius:2px}
.hi-dos{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:18px}
.hi-ultimo{display:grid;gap:0;margin:0;padding:0;list-style:none}
.hi-ultimo li{display:grid;grid-template-columns:120px minmax(0,1fr) auto;gap:10px;padding:8px 0;border-top:1px solid var(--line);align-items:baseline;font-size:13.5px}
.hi-ultimo li:first-child{border-top:0}
.hi-ultimo .m{font-family:var(--mono);font-size:12.5px;white-space:nowrap}
.hi-sim table{width:100%;border-collapse:collapse;font-size:13px}
.hi-sim td{padding:4px;border-top:1px solid var(--line)}
.hi-sim input[type=range]{width:100%}
.hi-sim .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.hi-sim .esc{display:flex;gap:2px;flex-wrap:wrap}
.hi-sim .esc i{width:10px;height:10px;border-radius:50%;display:inline-block}
.hi-sim .q{font-family:var(--mono);font-size:11.5px;color:var(--muted)}
.hi-sim .q b{color:var(--ink);font-weight:600}
`;

let ctx = null, HIST = null, GEO = null;
const cache = {};
const pedir = url => cache[url] ||= fetch(url).then(r=>r.ok?r.json():null).catch(()=>null);

function estilos(){
  if (document.getElementById("hi-css")) return;
  const s = document.createElement("style"); s.id = "hi-css"; s.textContent = CSS; document.head.appendChild(s);
}
const fmt = n => Math.round(n).toLocaleString("es-ES");
const fmtCorto = n => n >= 1e6 ? (n/1e6).toLocaleString("es-ES", {maximumFractionDigits:2}) + " M" : fmt(n);
const pct = (x, d=1) => (x*100).toLocaleString("es-ES", {minimumFractionDigits:d, maximumFractionDigits:d}) + " %";
const anio = e => e.fecha.slice(0,4) + (e.id==="201904" ? "-A" : e.id==="201911" ? "-N" : "");
const anioLargo = e => { const M=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]; const [y,m,d]=e.fecha.split("-").map(Number); return `${d} de ${M[m-1]} de ${y}`; };
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- tooltip propio (los del resto de la web van por data-tip) ---------- */
let tipEl = null;
function tip(html, ev){
  if (!tipEl){ tipEl = document.createElement("div"); tipEl.className = "hi-tip"; tipEl.hidden = true; document.body.appendChild(tipEl); }
  if (!html){ tipEl.hidden = true; return; }
  tipEl.innerHTML = html; tipEl.hidden = false;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight, vw = document.documentElement.clientWidth;
  let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + w > vw - 8) x = ev.clientX - w - 14;
  if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
  tipEl.style.left = Math.max(8, x) + "px"; tipEl.style.top = Math.max(8, y) + "px";
}

/* ---------- datos agregados ---------- */
function porGrupo(fam){
  const out = Object.fromEntries(GRUPOS.map(g=>[g.id, [0,0]]));
  for (const [f, [v, e]] of Object.entries(fam||{})){ const g = GRUPO_DE[f] || "OTROS"; out[g][0] += v; out[g][1] += e; }
  return out;
}
const textoSobre = hex => { const n=parseInt(hex.slice(1),16), r=n>>16&255, g=n>>8&255, b=n&255; return (0.299*r+0.587*g+0.114*b) > 150 ? "#08090B" : "#FFFFFF"; };

/* Rampa secuencial de un solo tono: del color de la superficie al color de la familia. */
function rampa(hex){
  const sup = getComputedStyle(document.documentElement).getPropertyValue("--sunk").trim() || "#EDEEEA";
  const a = hexRgb(sup.startsWith("#") ? sup : "#EDEEEA"), b = hexRgb(hex);
  return t => { t = Math.max(0, Math.min(1, t)); const c = a.map((x,i)=>Math.round(x + (b[i]-x)*(0.12 + 0.88*t))); return `rgb(${c.join(",")})`; };
}
function hexRgb(h){ h = h.replace("#",""); if (h.length===3) h = h.split("").map(c=>c+c).join(""); const n=parseInt(h,16); return [n>>16&255, n>>8&255, n&255]; }

/* Escaños de un hemiciclo genérico de 350 (mismo algoritmo que la web). */
function asientos(N){
  const filas = 12, r0 = .4, radios = Array.from({length:filas},(_,i)=>r0+(1-r0)*i/(filas-1));
  const suma = radios.reduce((a,b)=>a+b,0), n = radios.map(r=>Math.round(N*r/suma));
  n[filas-1] += N - n.reduce((a,b)=>a+b,0);
  const out = [];
  radios.forEach((r,i)=>{ for(let j=0;j<n[i];j++){ const a=Math.PI*(1-j/Math.max(1,n[i]-1)); out.push({a, r, x:100*r*Math.cos(a), y:-100*r*Math.sin(a)}); } });
  out.sort((p,q)=>q.a-p.a || p.r-q.r);
  const paso = Math.min(...radios.map((r,i)=>Math.PI*r*100/Math.max(1,n[i]-1)), (1-r0)*100/(filas-1));
  return {pts: out, rad: paso*.42};
}

/* =====================================================================================================
   HISTÓRICO
   ===================================================================================================== */
let selH = null, playH = null;
export async function pintarHistorico(sec, c){
  ctx = c; estilos();
  [HIST, GEO] = await Promise.all([pedir("datos/elecciones/historico.json"), pedir("datos/elecciones/geo-provincias.json")]);
  if (!HIST){ sec.querySelector(".nota").textContent = "No se ha podido cargar el histórico."; return; }
  const E = HIST.elecciones;
  selH ??= E.length - 1;
  const {pts, rad} = asientos(350);
  sec.querySelector(".nota").outerHTML = `
    <div class="hi-anios" role="group" aria-label="Elección"><button class="play" data-hi-play>▶ Reproducir</button>${E.map((e,k)=>`<button data-hi="${k}" aria-pressed="${k===selH}">${anio(e)}</button>`).join("")}</div>
    <div class="hi-top">
      <div class="chart"><svg class="hi-hemi" viewBox="-110 -110 220 116" role="img" aria-label="Hemiciclo de la elección seleccionada">
        ${pts.map((p,k)=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rad.toFixed(2)}" style="--k:${k}"></circle>`).join("")}
        <text class="hi-anio" x="0" y="-6" text-anchor="middle" fill="currentColor" style="font-size:17px"></text></svg>
        <div class="el-leyenda">${GRUPOS.map(g=>`<span><i style="background:${g.color}"></i>${esc(g.nombre)}</span>`).join("")}</div></div>
      <div class="chart" id="hi-ficha"></div>
    </div>
    <div class="chart"><h3>Los 350 escaños, elección a elección</h3><p class="sub">Escaños de cada familia de partidos en cada legislatura, de 1977 a la disolución de 2026. Pasa por encima para ver el reparto; pulsa para elegir una elección.</p><div id="hi-rio"></div><div class="el-leyenda">${GRUPOS.map(g=>`<span><i style="background:${g.color};border-radius:2px"></i>${esc(g.nombre)}</span>`).join("")}</div></div>
    <div class="hi-dos">
      <div class="chart"><h3>Participación</h3><p class="sub">Votantes sobre el censo, con el voto exterior.</p><div id="hi-part"></div></div>
      <div class="chart"><h3>PSOE y PP juntos</h3><p class="sub">Su parte de los votos válidos y de los escaños.</p><div id="hi-bip"></div></div>
    </div>
    <div class="chart"><div class="sec-h" style="padding:0"><h3 id="hi-mapa-t"></h3><div class="controls"><select id="hi-mapa-g" aria-label="Familia del mapa">${GRUPOS.filter(g=>g.id!=="OTROS").map(g=>`<option value="${g.id}">${esc(g.nombre)}</option>`).join("")}<option value="PART">Participación</option></select></div></div><div id="hi-mapa"></div></div>
    <p class="nota">Fuente: Ministerio del Interior, resultados oficiales de las elecciones al Congreso (ficheros de infoelectoral). Las candidaturas se agrupan con su cabecera nacional y cada una se asigna a una familia con reglas fijas, iguales para las dieciséis elecciones (<a href="https://github.com/jorgegarcelan/escano-abierto/blob/main/escano/historico.py">escano/historico.py</a>).</p>`;
  const hemi = sec.querySelector(".hi-hemi"), seats = [...hemi.querySelectorAll("circle")];
  const ficha = sec.querySelector("#hi-ficha");
  const selMapa = sec.querySelector("#hi-mapa-g");
  let mapaG = null;
  function pintar(k){
    selH = k; const e = E[k], g = porGrupo(e.fam);
    // Escaños de izquierda a derecha en el orden de GRUPOS.
    let i = 0; GRUPOS.forEach(gr=>{ for (let n=0; n<g[gr.id][1]; n++){ const s = seats[i++]; if (s){ s.setAttribute("fill", gr.color); s.dataset.g = gr.id; } } });
    hemi.querySelector("text").textContent = anio(e).replace("-A"," abr").replace("-N"," nov");
    sec.querySelectorAll("[data-hi]").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.hi===k)));
    const part = e.votantes / e.censo, primeros = e.partidos.filter(p=>p[4]).slice(0, 14);
    ficha.innerHTML = `<div class="eyebrow">${esc(anioLargo(e))}</div>
      <div class="kpis" style="border:0;padding:4px 0 8px"><div class="kpi"><b>${pct(part)}</b><span>participación</span></div><div class="kpi"><b>${e.partidos.filter(p=>p[4]).length}</b><span>candidaturas con escaño</span></div></div>
      <table class="hi-tabla"><thead><tr><th>Candidatura</th><th class="n">Votos</th><th class="n">%</th><th class="n">Escaños</th></tr></thead><tbody>
      ${primeros.map(p=>`<tr><td><i style="background:${G8[GRUPO_DE[p[2]]||"OTROS"].color}"></i>${esc(p[0])}</td><td class="n">${fmt(p[3])}</td><td class="n">${pct(p[3]/e.validos)}</td><td class="n"><b>${p[4]}</b></td></tr>`).join("")}</tbody></table>`;
    rio(); mapa();
  }
  function rio(){ const c = sec.querySelector("#hi-rio"); c.innerHTML = graficoRio(E, selH, c.clientWidth); montarRio(c.querySelector("svg"), E, k=>pintar(k)); }
  function mapa(){
    const e = E[selH], g = porGrupo(e.fam);
    if (!mapaG){ mapaG = GRUPOS.filter(x=>x.id!=="OTROS").sort((a,b)=>g[b.id][1]-g[a.id][1])[0].id; selMapa.value = mapaG; }
    sec.querySelector("#hi-mapa-t").textContent = mapaG==="PART" ? `Participación por provincia, ${anio(e)}` : `Voto a ${G8[mapaG].nombre} por provincia, ${anio(e)}`;
    sec.querySelector("#hi-mapa").innerHTML = mapaProvincias(e, mapaG);
  }
  const anchoDe = id => sec.querySelector(id).clientWidth;
  sec.querySelector("#hi-part").innerHTML = graficoLinea(E, [{nombre:"Participación", color:"#8A8F98", valores:E.map(e=>e.votantes/e.censo)}], {min:.6, max:.85, ancho:anchoDe("#hi-part")});
  sec.querySelector("#hi-bip").innerHTML = graficoLinea(E, [
    {nombre:"Votos", color:"#6E8FB8", valores:E.map(e=>((e.fam.PSOE?.[0]||0)+(e.fam.PP?.[0]||0))/e.validos)},
    {nombre:"Escaños", color:"#C9A227", valores:E.map(e=>((e.fam.PSOE?.[1]||0)+(e.fam.PP?.[1]||0))/350)}], {min:.3, max:1, ancho:anchoDe("#hi-bip")});
  montarLineas(sec);
  selMapa.addEventListener("change", ()=>{ mapaG = selMapa.value; mapa(); });
  sec.querySelector("#hi-mapa").addEventListener("mousemove", ev=>{ const p = ev.target.closest("[data-p]"); tip(p ? tipProvincia(E[selH], p.dataset.p, mapaG) : "", ev); });
  sec.querySelector("#hi-mapa").addEventListener("mouseleave", ()=>tip(""));
  hemi.addEventListener("mousemove", ev=>{ const s = ev.target.closest("circle"); if (!s || !s.dataset.g){ tip("", ev); return; } const g = porGrupo(E[selH].fam)[s.dataset.g];
    tip(`<b>${esc(G8[s.dataset.g].nombre)}</b><br>${g[1]} escaños · ${pct(g[0]/E[selH].validos)} de los votos${s.dataset.g==="NAC"||s.dataset.g==="OTROS"?`<br><span style="color:var(--muted)">${esc(E[selH].partidos.filter(p=>p[4] && (GRUPO_DE[p[2]]||"OTROS")===s.dataset.g).map(p=>`${p[0]} ${p[4]}`).join(" · "))}</span>`:""}`, ev); });
  hemi.addEventListener("mouseleave", ()=>tip(""));
  sec.addEventListener("click", ev=>{
    const b = ev.target.closest("[data-hi]"); if (b){ parar(); pintar(+b.dataset.hi); return; }
    if (ev.target.closest("[data-hi-play]")){ playH ? parar() : reproducir(); }
  });
  function reproducir(){
    const boton = sec.querySelector("[data-hi-play]"); boton.textContent = "❚❚ Pausa";
    let k = selH >= E.length-1 ? 0 : selH + 1; pintar(k);
    playH = setInterval(()=>{ k++; if (k >= E.length){ parar(); return; } pintar(k); }, 1500);
  }
  function parar(){ clearInterval(playH); playH = null; const b = sec.querySelector("[data-hi-play]"); if (b) b.textContent = "▶ Reproducir"; }
  pintar(selH);
}

/* Escaños por familia en el tiempo: áreas apiladas en escalón (cada legislatura dura hasta la siguiente). */
const FIN = "2026-10-06";
const tiempo = iso => { const [y,m,d] = iso.split("-").map(Number); return y + (m-1)/12 + (d-1)/365; };
const medidasRio = ancho => { const W = Math.max(320, Math.round(ancho || 1000)); return {W, H: W < 640 ? 280 : 340, ml: 32, mr: W < 640 ? 96 : 170, mt: 8, mb: 24}; };
function graficoRio(E, sel, ancho){
  const {W, H, ml, mr, mt, mb} = medidasRio(ancho), t0 = tiempo(E[0].fecha), t1 = tiempo(FIN), estrecho = W < 640;
  const x = t => ml + (tiempo(t)-t0)/(t1-t0)*(W-ml-mr), y = v => mt + (1 - v/350)*(H-mt-mb);
  const G = E.map(e=>porGrupo(e.fam));
  let bandas = "", etiquetas = "";
  const fuera = [];   // etiquetas a la derecha: se colocan al final, sin pisarse
  const base = E.map(()=>0);
  GRUPOS.forEach(gr=>{
    const top = E.map((_,k)=>base[k] + G[k][gr.id][1]);
    if (top.every((v,k)=>v===base[k])) return;
    // Escalón: el valor de cada elección se mantiene hasta la siguiente.
    const xs = E.map(e=>x(e.fecha)).concat([x(FIN)]);
    let d = `M${xs[0].toFixed(1)} ${y(top[0]).toFixed(1)}`;
    E.forEach((_,k)=>{ d += `H${xs[k+1].toFixed(1)}`; if (k+1<E.length) d += `V${y(top[k+1]).toFixed(1)}`; });
    d += `V${y(base[E.length-1]).toFixed(1)}`;
    for (let k=E.length-1; k>=0; k--){ d += `H${xs[k].toFixed(1)}`; if (k>0) d += `V${y(base[k-1]).toFixed(1)}`; }
    bandas += `<path class="banda" d="${d}Z" fill="${gr.color}"><title>${esc(gr.nombre)}</title></path>`;
    // Etiqueta dentro de la banda en la legislatura donde es más ancha, si cabe; si no, a la derecha al final.
    const anchos = E.map((_,k)=>G[k][gr.id][1]), kmax = anchos.indexOf(Math.max(...anchos));
    const alto = y(base[kmax]) - y(top[kmax]), anchoTxt = gr.nombre.length * 6.6 + 10, hueco = xs[kmax+1] - xs[kmax];
    if (alto >= 17 && hueco >= anchoTxt){
      etiquetas += `<text class="lbl" x="${((xs[kmax]+xs[kmax+1])/2).toFixed(1)}" y="${((y(base[kmax])+y(top[kmax]))/2 + 4).toFixed(1)}" text-anchor="middle" fill="${textoSobre(gr.color)}">${esc(gr.nombre)}</text>`;
    } else if (G[E.length-1][gr.id][1] > 0){
      fuera.push({y: (y(base[E.length-1])+y(top[E.length-1]))/2 + 4, t: `${estrecho ? CORTO[gr.id] : gr.nombre} ${G[E.length-1][gr.id][1]}`});
    }
    E.forEach((_,k)=>base[k] = top[k]);
  });
  // Las etiquetas de la derecha, de arriba abajo y separadas al menos 14 px (sin salirse del gráfico).
  fuera.sort((a,b)=>a.y-b.y);
  for (let i=1; i<fuera.length; i++) fuera[i].y = Math.max(fuera[i].y, fuera[i-1].y + 14);
  for (let i=fuera.length-2; i>=0; i--) fuera[i].y = Math.min(fuera[i].y, fuera[i+1].y - 14);
  etiquetas += fuera.map(f=>`<text class="lbl-fuera" x="${(W-mr+8).toFixed(1)}" y="${f.y.toFixed(1)}">${esc(f.t)}</text>`).join("");
  const ticks = [0, 100, 250, 350].map(v=>`<line class="eje" x1="${ml}" x2="${W-mr}" y1="${y(v)}" y2="${y(v)}" ${v===176?'stroke-dasharray="0"':""}/><text class="tick" x="${ml-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join("");
  const anios = E.filter((e,k)=>k===0 || k===E.length-1 || (estrecho ? ["1982","1996","2011"].includes(e.fecha.slice(0,4)) : k%2===0 && k<E.length-2)).map(e=>`<text class="tick" x="${x(e.fecha).toFixed(1)}" y="${H-6}" text-anchor="middle">${e.fecha.slice(0,4)}</text>`).join("");
  const xs = E.map(e=>x(e.fecha));
  return `<svg class="hi-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Escaños de cada familia de partidos en cada legislatura desde 1977 (la línea discontinua es la mayoría absoluta, 176)">
    ${ticks}${bandas}<line class="eje" x1="${ml}" x2="${W-mr}" y1="${y(176)}" y2="${y(176)}" stroke-dasharray="3 3"/><text class="tick" x="${ml-6}" y="${y(176)+4}" text-anchor="end">176</text>
    ${etiquetas}${anios}
    <line class="sel" x1="${xs[sel]}" x2="${xs[sel]}" y1="${mt}" y2="${H-mb}"/>
    <line class="cruz" x1="0" x2="0" y1="${mt}" y2="${H-mb}"/>
    <rect x="${ml}" y="${mt}" width="${W-ml-mr}" height="${H-mt-mb}" fill="transparent" data-zona="1"/></svg>`;
}
function montarRio(svg, E, elegir){
  if (!svg) return;
  const {W, ml, mr} = medidasRio(+svg.getAttribute("width")), t0 = tiempo(E[0].fecha), t1 = tiempo(FIN);
  const xs = E.map(e=>ml + (tiempo(e.fecha)-t0)/(t1-t0)*(W-ml-mr)).concat([W-mr]);
  const cruz = svg.querySelector(".cruz");
  const cual = ev => { const r = svg.getBoundingClientRect(), xv = (ev.clientX - r.left) / r.width * W; let k = 0; while (k < E.length-1 && xv >= xs[k+1]) k++; return k; };
  svg.addEventListener("mousemove", ev=>{
    const k = cual(ev), e = E[k], g = porGrupo(e.fam);
    cruz.setAttribute("x1", xs[k]); cruz.setAttribute("x2", xs[k]); cruz.style.opacity = .5;
    tip(`<b>${esc(anioLargo(e))}</b>${GRUPOS.slice().reverse().filter(gr=>g[gr.id][1]).map(gr=>`<div class="f"><span><i style="background:${gr.color}"></i>${esc(gr.nombre)}</span><b>${g[gr.id][1]}</b></div>`).join("")}`, ev);
  });
  svg.addEventListener("mouseleave", ()=>{ cruz.style.opacity = 0; tip(""); });
  svg.addEventListener("click", ev=>elegir(cual(ev)));
}

/* Líneas sencillas (mismo eje, misma unidad), con punto final y etiquetas solo en el último valor y en los extremos. */
function graficoLinea(E, series, {min=0, max=1, ancho=480}={}){
  const W = Math.max(300, Math.round(ancho)), H = 200, ml = 40, mr = series.length > 1 ? 100 : 56, mt = 14, mb = 24, t0 = tiempo(E[0].fecha), t1 = tiempo(E[E.length-1].fecha);
  const x = k => ml + (tiempo(E[k].fecha)-t0)/(t1-t0)*(W-ml-mr), y = v => mt + (1-(v-min)/(max-min))*(H-mt-mb);
  const marcas = [];
  for (let v = Math.ceil(min*10)/10; v <= max+1e-9; v += .1) marcas.push(+v.toFixed(2));
  const rejilla = marcas.filter((_,i)=>i%(marcas.length>6?2:1)===0).map(v=>`<line class="eje" x1="${ml}" x2="${W-mr}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${ml-6}" y="${y(v)+4}" text-anchor="end">${Math.round(v*100)}%</text>`).join("");
  const lineas = series.map(s=>{ const d = s.valores.map((v,k)=>`${k?"L":"M"}${x(k).toFixed(1)} ${y(v).toFixed(1)}`).join("");
    const kmax = s.valores.indexOf(Math.max(...s.valores)), kmin = s.valores.indexOf(Math.min(...s.valores)), ult = s.valores.length-1;
    const etq = [...new Set([kmax, kmin])].filter(k=>k!==ult).map(k=>`<text class="tick" x="${x(k)}" y="${y(s.valores[k]) + (k===kmax?-8:14)}" text-anchor="middle">${pct(s.valores[k],0)}</text>`).join("");
    return `<path class="linea" d="${d}" stroke="${s.color}"/>${etq}<circle class="punto" cx="${x(ult)}" cy="${y(s.valores[ult])}" r="4.5" fill="${s.color}"/><text class="lbl-fuera" x="${x(ult)+9}" y="${y(s.valores[ult])+4}">${series.length>1?esc(s.nombre)+" ":""}${pct(s.valores[ult],0)}</text>`; }).join("");
  const anios = E.filter((_,k)=>k%3===0 || k===E.length-1).map(e=>`<text class="tick" x="${x(E.indexOf(e))}" y="${H-6}" text-anchor="middle">${e.fecha.slice(0,4)}</text>`).join("");
  const datos = esc(JSON.stringify({series: series.map(s=>({n:s.nombre, c:s.color, v:s.valores})), xs: E.map((_,k)=>x(k)), et: E.map(anioLargo)}));
  return `<svg class="hi-svg hi-linea" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(series.map(s=>s.nombre).join(" y "))} en cada elección" data-serie="${datos}">${rejilla}${lineas}${anios}<line class="cruz" x1="0" x2="0" y1="${mt}" y2="${H-mb}"/></svg>`;
}
function montarLineas(sec){
  sec.querySelectorAll(".hi-linea").forEach(svg=>{
    const D = JSON.parse(svg.dataset.serie), cruz = svg.querySelector(".cruz");
    svg.addEventListener("mousemove", ev=>{ const r = svg.getBoundingClientRect(), xv = (ev.clientX-r.left)/r.width*(+svg.getAttribute("width"));
      let k = 0, best = 1e9; D.xs.forEach((x,i)=>{ if (Math.abs(x-xv) < best){ best = Math.abs(x-xv); k = i; } });
      cruz.setAttribute("x1", D.xs[k]); cruz.setAttribute("x2", D.xs[k]); cruz.style.opacity = .5;
      tip(`<b>${esc(D.et[k])}</b>${D.series.map(s=>`<div class="f"><span><i style="background:${s.c}"></i>${esc(s.n)}</span><b>${pct(s.v[k])}</b></div>`).join("")}`, ev); });
    svg.addEventListener("mouseleave", ()=>{ cruz.style.opacity = 0; tip(""); });
  });
}

function mapaProvincias(e, g){
  if (!GEO) return `<p class="nota">El mapa no está disponible.</p>`;
  const valor = c => { const p = e.prov[c]; if (!p) return null; return g==="PART" ? p.votantes/p.censo : (porGrupo(p.fam)[g][0] / p.validos); };
  const vals = Object.keys(GEO.provincias).map(valor).filter(v=>v!=null);
  const lo = g==="PART" ? Math.min(...vals) : 0, hi = Math.max(...vals) || 1;
  const color = rampa(g==="PART" ? "#5E7FA3" : G8[g].color);
  const paths = Object.entries(GEO.provincias).map(([c,p])=>{ const v = valor(c); return `<path class="prov" d="${p.d}" fill="${v==null?"var(--sunk)":color((v-lo)/(hi-lo||1))}" data-p="${c}"></path>`; }).join("");
  return `<svg class="hi-svg" viewBox="0 0 ${GEO.ancho} ${GEO.alto}" role="img" aria-label="Mapa por provincias">${paths}<path class="can" d="${GEO.canarias}"/></svg>
    <div class="hi-rampa"><span>${pct(lo,0)}</span><span class="r" style="background:linear-gradient(90deg,${color(0)},${color(1)})"></span><span>${pct(hi,0)}</span></div>`;
}
function tipProvincia(e, c, g){
  const p = e.prov[c], geo = GEO.provincias[c]; if (!p) return "";
  const G = porGrupo(p.fam);
  return `<b>${esc(geo.circ)}</b> · ${p.e} escaños<br>Participación ${pct(p.votantes/p.censo)}${GRUPOS.filter(gr=>G[gr.id][0]).sort((a,b)=>G[b.id][0]-G[a.id][0]).slice(0,5).map(gr=>`<div class="f"><span><i style="background:${gr.color}"></i>${esc(gr.nombre)}</span><span>${pct(G[gr.id][0]/p.validos)} · <b>${G[gr.id][1]}</b></span></div>`).join("")}`;
}

/* =====================================================================================================
   EL PRECIO DE UN ESCAÑO
   ===================================================================================================== */
let selE = null, simProv = null, simVotos = null;
export async function pintarEscano(sec, c){
  ctx = c; estilos();
  [HIST, GEO] = await Promise.all([pedir("datos/elecciones/historico.json"), pedir("datos/elecciones/geo-provincias.json")]);
  if (!HIST){ sec.querySelector(".nota").textContent = "No se han podido cargar los resultados."; return; }
  const E = HIST.elecciones;
  selE ??= E.length - 1;
  const cuerpo = sec.querySelector(".nota");
  cuerpo.outerHTML = `<div class="hi-anios" role="group" aria-label="Elección">${E.map((e,k)=>`<button data-he="${k}" aria-pressed="${k===selE}">${anio(e)}</button>`).join("")}</div><div id="he-cuerpo"><p class="nota">Cargando…</p></div>`;
  async function pintar(k){
    selE = k; const e = E[k];
    sec.querySelectorAll("[data-he]").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.he===k)));
    const D = await pedir(`datos/elecciones/historico-${e.id}.json`); if (!D) return;
    const P = D.prov, nombre = cod => GEO?.provincias[cod]?.circ || cod;
    const precio = Object.entries(P).map(([cod,p])=>[cod, p.validos/p.e]).sort((a,b)=>a[1]-b[1]);
    const sinEsc = Object.values(P).reduce((s,p)=>s+p.sin_escano, 0);
    const ultimos = Object.entries(P).filter(([,p])=>p.ultimo).sort((a,b)=>a[1].ultimo.faltan-b[1].ultimo.faltan);
    const barato = precio[0], caro = precio[precio.length-1];
    const menosDeMil = ultimos.filter(([,p])=>p.ultimo.faltan < 1000).length;
    // Lo que costó cada escaño a cada candidatura: sus votos en toda España entre sus escaños.
    const coste = e.partidos.filter(x=>x[4]).map(x=>[x, x[3]/x[4]]).sort((a,b)=>a[1]-b[1]);
    const maxCoste = Math.max(...coste.map(x=>x[1]));
    simProv = simProv && P[simProv] ? simProv : (()=>{ try{ const sl = localStorage.getItem("provincia"); const c = Object.keys(P).find(cod=>ctx.slug(nombre(cod))===sl); if (c) return c; }catch(err){} return "28"; })();
    sec.querySelector("#he-cuerpo").innerHTML = `
      <div class="kpis"><div class="kpi"><b>${fmt(barato[1])}</b><span>votos por escaño en ${esc(nombre(barato[0]))}</span></div>
        <div class="kpi"><b>${fmt(caro[1])}</b><span>votos por escaño en ${esc(nombre(caro[0]))}</span></div>
        <div class="kpi alert"><b>${fmtCorto(sinEsc)}</b><span>votos (${fmt(sinEsc)}) a candidaturas que no sacaron escaño en su provincia</span></div>
        <div class="kpi"><b>${menosDeMil}</b><span>últimos escaños decididos por menos de 1.000 votos</span></div></div>
      <div class="hi-dos">
        <div class="chart"><h3>Votos por escaño en cada provincia</h3><p class="sub">Votos válidos entre escaños. Cuanto más intenso el color, más caro: cada provincia tiene al menos dos diputados y el resto se reparte por población.</p>${mapaPrecio(P)}</div>
        <div class="chart"><h3>Lo que costó cada escaño</h3><p class="sub">Votos de cada candidatura en toda España entre los escaños que sacó.</p>
          ${coste.map(([x,v])=>`<div style="display:grid;grid-template-columns:110px 1fr 74px;gap:8px;align-items:center;font-size:13px" title="${esc(x[1])}"><span>${esc(x[0])}</span><span style="display:block;height:12px;width:${(v/maxCoste*100).toFixed(1)}%;background:${G8[GRUPO_DE[x[2]]||"OTROS"].color};border-radius:0 4px 4px 0"></span><span class="n" style="text-align:right;font-variant-numeric:tabular-nums">${fmt(v)}</span></div>`).join("")}
          <p class="nota">Las candidaturas que se presentan en pocas provincias pueden necesitar menos votos por escaño: compiten solo donde son fuertes.</p></div>
      </div>
      <div class="chart"><h3>El último escaño de cada provincia</h3><p class="sub">El último diputado que reparte la ley D'Hondt en cada circunscripción y los votos que le faltaron a la siguiente candidatura para quitárselo.</p>
        <ul class="hi-ultimo">${ultimos.slice(0, 12).map(([cod,p])=>`<li><span>${esc(nombre(cod))}</span><span>Lo ganó <b>${esc(p.ultimo.gana)}</b>; a <b>${esc(p.ultimo.segundo)}</b> le faltaron</span><span class="m">${fmt(p.ultimo.faltan)} votos</span></li>`).join("")}</ul>
        <details><summary>Las ${ultimos.length} provincias</summary><ul class="hi-ultimo">${ultimos.slice(12).map(([cod,p])=>`<li><span>${esc(nombre(cod))}</span><span>${esc(p.ultimo.gana)} sobre ${esc(p.ultimo.segundo)}</span><span class="m">${fmt(p.ultimo.faltan)}</span></li>`).join("")}</ul></details></div>
      <div class="chart hi-sim" id="he-sim"></div>`;
    const svgMapa = sec.querySelector("#he-cuerpo .hi-svg");
    svgMapa?.addEventListener("mousemove", ev=>{ const p = ev.target.closest("[data-p]"); if (!p){ tip("", ev); return; } const x = P[p.dataset.p];
      tip(`<b>${esc(nombre(p.dataset.p))}</b><br>${x.e} escaños · ${fmt(x.validos/x.e)} votos por escaño<br>${fmt(x.sin_escano)} votos sin escaño`, ev); });
    svgMapa?.addEventListener("mouseleave", ()=>tip(""));
    svgMapa?.addEventListener("click", ev=>{ const p = ev.target.closest("[data-p]"); if (p){ simProv = p.dataset.p; simVotos = null; simulador(sec, P, nombre); sec.querySelector("#he-sim").scrollIntoView({block:"nearest"}); } });
    simVotos = null; simulador(sec, P, nombre);
  }
  sec.addEventListener("click", ev=>{ const b = ev.target.closest("[data-he]"); if (b) pintar(+b.dataset.he); });
  pintar(selE);
}
function mapaPrecio(P){
  if (!GEO) return "";
  const v = Object.fromEntries(Object.entries(P).map(([c,p])=>[c, p.validos/p.e])), vs = Object.values(v), lo = Math.min(...vs), hi = Math.max(...vs);
  const color = rampa("#5E7FA3");
  return `<svg class="hi-svg" viewBox="0 0 ${GEO.ancho} ${GEO.alto}" role="img" aria-label="Votos por escaño en cada provincia">${Object.entries(GEO.provincias).map(([c,p])=>`<path class="prov" d="${p.d}" fill="${v[c]==null?"var(--sunk)":color((v[c]-lo)/(hi-lo))}" data-p="${c}" style="cursor:pointer"></path>`).join("")}<path class="can" d="${GEO.canarias}"/></svg>
    <div class="hi-rampa"><span>${fmt(lo)}</span><span class="r" style="background:linear-gradient(90deg,${color(0)},${color(1)})"></span><span>${fmt(hi)} votos</span></div>`;
}

/* Simulador: mueve los votos de una provincia y mira cómo cambia el reparto. Misma regla que la ley (y que
   escano/elecciones.py): barrera del 3 % de los votos válidos, cocientes de mayor a menor. */
export function dhondt(votos, escanos, validos, barrera=.03){
  const entran = Object.entries(votos).filter(([,v])=>v>0 && v >= barrera*validos);
  const coc = entran.flatMap(([c,v])=>Array.from({length:escanos},(_,d)=>({c, v, q:v/(d+1), d:d+1}))).sort((a,b)=>b.q-a.q || b.v-a.v || a.c.localeCompare(b.c));
  const gan = coc.slice(0, escanos), rep = {};
  gan.forEach(x=>rep[x.c]=(rep[x.c]||0)+1);
  return {rep, gan, fuera: coc.slice(escanos, escanos+4), barrera: barrera*validos};
}
function simulador(sec, P, nombre){
  const caja = sec.querySelector("#he-sim"); if (!caja) return;
  const p = P[simProv];
  const lista = p.c.filter(x=>x[2] >= p.validos*0.005).slice(0, 10);   // las que pasan del 0,5 %: el resto no cambia nada
  simVotos ||= Object.fromEntries(lista.map(x=>[x[0], x[2]]));
  const opciones = Object.keys(P).sort((a,b)=>nombre(a).localeCompare(nombre(b),"es")).map(c=>`<option value="${c}"${c===simProv?" selected":""}>${esc(nombre(c))}</option>`).join("");
  caja.innerHTML = `<div class="sec-h" style="padding:0"><h3>Simulador D'Hondt</h3><div class="controls"><select data-sim-prov aria-label="Provincia">${opciones}</select><button class="chipbtn" data-sim-reset>Volver al resultado real</button></div></div>
    <p class="sub">Mueve los votos de cada candidatura en ${esc(nombre(simProv))} (${p.e} escaños) y mira cómo cambia el reparto. Para entrar en el reparto hace falta el 3 % de los votos válidos.</p>
    <table><tbody>${lista.map(x=>{ const gr = G8[GRUPO_DE[x[1]]||"OTROS"]; return `<tr data-fila="${esc(x[0])}"><td style="width:24%"><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${gr.color};margin-right:6px"></i>${esc(x[0])}</td>
      <td style="width:38%"><input type="range" min="0" max="${Math.round(x[2]*2+p.validos*0.02)}" step="${Math.max(1, Math.round(p.validos/2000))}" value="${simVotos[x[0]] ?? x[2]}" data-sim="${esc(x[0])}" aria-label="Votos de ${esc(x[0])}"></td>
      <td class="n" style="width:14%" data-v></td><td style="width:24%"><span class="esc" data-e></span></td></tr>`; }).join("")}</tbody></table>
    <p class="q" data-q></p>`;
  const pintar = () => {
    const validos = p.validos - lista.reduce((s,x)=>s+x[2],0) + Object.values(simVotos).reduce((s,v)=>s+v,0);
    const r = dhondt(simVotos, p.e, validos);
    caja.querySelectorAll("[data-fila]").forEach(tr=>{ const c = tr.dataset.fila, n = r.rep[c]||0, real = lista.find(x=>x[0]===c)[3], gr = G8[GRUPO_DE[lista.find(x=>x[0]===c)[1]]||"OTROS"];
      tr.querySelector("[data-v]").textContent = fmt(simVotos[c]);
      tr.querySelector("[data-e]").innerHTML = Array.from({length:n},()=>`<i style="background:${gr.color}"></i>`).join("") + `<span class="q">&nbsp;${n}${n!==real?` (real: ${real})`:""}</span>`; });
    const ult = r.gan[r.gan.length-1], sig = r.fuera[0];
    caja.querySelector("[data-q]").innerHTML = ult ? `Último escaño: <b>${esc(ult.c)}</b> con ${fmt(ult.q)} votos por escaño (sus votos entre ${ult.d}). ${sig?`El siguiente cociente era de <b>${esc(sig.c)}</b>: ${fmt(sig.q)}.`:""} Barrera del 3 %: ${fmt(r.barrera)} votos.` : "";
  };
  caja.addEventListener("input", ev=>{ const i = ev.target.closest("[data-sim]"); if (i){ simVotos[i.dataset.sim] = +i.value; pintar(); } });
  caja.querySelector("[data-sim-prov]").addEventListener("change", ev=>{ simProv = ev.target.value; simVotos = null; simulador(sec, P, nombre); });
  caja.querySelector("[data-sim-reset]").addEventListener("click", ()=>{ simVotos = null; simulador(sec, P, nombre); });
  pintar();
}

/* =====================================================================================================
   MAPA MUNICIPAL (2019-11 y 2023)
   ===================================================================================================== */
let selM = {id:"202307", g:null, modo:"voto"};
export async function pintarMunicipios(sec, c){
  ctx = c; estilos();
  const cuerpo = sec.querySelector(".nota");
  const [geoM, m23, m19] = await Promise.all([pedir("datos/elecciones/geo-municipios.json"), pedir("datos/elecciones/municipios-202307.json"), pedir("datos/elecciones/municipios-201911.json")]);
  if (!geoM || !m23){ cuerpo.textContent = "No se ha podido cargar el mapa municipal."; return; }
  const M = {"202307": m23, "201911": m19}, orden = m23.orden;
  const codigos = Object.keys(geoM.municipios);
  cuerpo.outerHTML = `<div class="controls"><select data-m-id aria-label="Elección"><option value="202307">23 de julio de 2023</option>${m19?`<option value="201911">10 de noviembre de 2019</option>`:""}</select>
      <select data-m-g aria-label="Qué se pinta">${GRUPOS.filter(g=>g.id!=="OTROS").map(g=>`<option value="${g.id}">Voto a ${esc(g.nombre)}</option>`).join("")}<option value="PART">Participación</option></select>
      ${m19?`<button class="chipbtn" data-m-cambio aria-pressed="${selM.modo==="cambio"}">Cambio desde 2019</button>`:""}</div>
    <div class="chart" style="padding:8px"><svg class="hi-svg" viewBox="0 0 ${geoM.ancho} ${geoM.alto}" role="img" aria-label="Mapa de los ${codigos.length} municipios">${codigos.map(cod=>`<path class="muni" d="${geoM.municipios[cod][1]}" data-m="${cod}"></path>`).join("")}</svg>
      <div class="hi-rampa" data-m-leyenda></div></div>
    <p class="nota">Voto de los residentes en España (el voto desde el extranjero no se reparte por municipio). Fuente: Ministerio del Interior; geometrías del IGN (es-atlas).</p>`;
  const svg = sec.querySelector("svg.hi-svg"), paths = [...svg.querySelectorAll("[data-m]")];
  const iG = g => orden.indexOf(g);
  const share = (fila, g) => { if (!fila) return null; const tot = fila.slice(2).reduce((a,b)=>a+b,0); if (!tot) return null;
    if (g==="PART") return fila[1]/fila[0];
    return G8[g].familias.reduce((s,f)=>s+(fila[2+iG(f)]||0),0)/tot; };
  function pintar(){
    const cambio = selM.modo==="cambio" && m19, g = selM.g ||= "PP";
    const datos = (cambio ? m23 : M[selM.id]).municipios;   // el cambio es siempre de 2019 a 2023
    sec.querySelector("[data-m-id]").disabled = !!cambio;
    let vals = {};
    for (const cod of codigos){ const a = share(datos[cod], g); if (a==null) continue;
      vals[cod] = cambio ? (()=>{ const b = share(m19.municipios[cod], g); return b==null ? null : a - b; })() : a; }
    const v = Object.values(vals).filter(x=>x!=null).sort((a,b)=>a-b);
    let color, leyenda;
    if (cambio){
      // Divergente: dos tonos y gris en el cero.
      const lim = Math.max(Math.abs(v[Math.floor(v.length*.02)]||0), Math.abs(v[Math.floor(v.length*.98)]||0)) || .1;
      const sube = rampa(g==="PART" ? "#5E7FA3" : G8[g].color), baja = rampa("#9A6B4F");
      color = x => x==null ? "var(--sunk)" : x >= 0 ? sube(x/lim) : baja(-x/lim);
      leyenda = `<span>−${Math.round(lim*100)} pt</span><span class="r" style="background:linear-gradient(90deg,${baja(1)},${baja(0)},${sube(0)},${sube(1)})"></span><span>+${Math.round(lim*100)} pt</span>`;
    } else {
      const lo = g==="PART" ? (v[Math.floor(v.length*.02)]||0) : 0, hi = v[Math.floor(v.length*.98)] || 1;
      const r = rampa(g==="PART" ? "#5E7FA3" : G8[g].color);
      color = x => x==null ? "var(--sunk)" : r((x-lo)/(hi-lo||1));
      leyenda = `<span>${pct(lo,0)}</span><span class="r" style="background:linear-gradient(90deg,${r(0)},${r(1)})"></span><span>${pct(hi,0)} o más</span>`;
    }
    paths.forEach(p=>p.setAttribute("fill", color(vals[p.dataset.m])));
    sec.querySelector("[data-m-leyenda]").innerHTML = leyenda;
  }
  sec.querySelector("[data-m-id]").addEventListener("change", ev=>{ selM.id = ev.target.value; pintar(); });
  sec.querySelector("[data-m-g]").addEventListener("change", ev=>{ selM.g = ev.target.value; pintar(); });
  sec.querySelector("[data-m-cambio]")?.addEventListener("click", ev=>{ selM.modo = selM.modo==="cambio" ? "voto" : "cambio"; ev.currentTarget.setAttribute("aria-pressed", String(selM.modo==="cambio")); pintar(); });
  selM.g ||= "PP";
  sec.querySelector("[data-m-g]").value = selM.g; sec.querySelector("[data-m-id]").value = selM.id;
  svg.addEventListener("mousemove", ev=>{ const p = ev.target.closest("[data-m]"); if (!p){ tip("", ev); return; }
    const cod = p.dataset.m, fila = M[selM.id].municipios[cod]; if (!fila){ tip(`<b>${esc(geoM.municipios[cod][0])}</b><br>Sin datos`, ev); return; }
    const tot = fila.slice(2).reduce((a,b)=>a+b,0);
    const fams = GRUPOS.map(g=>[g, g.familias.reduce((s,f)=>s+(fila[2+iG(f)]||0),0)]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).slice(0,4);
    tip(`<b>${esc(geoM.municipios[cod][0])}</b><br>Participación ${pct(fila[1]/fila[0])} · censo ${fmt(fila[0])}${fams.map(([g,n])=>`<div class="f"><span><i style="background:${g.color}"></i>${esc(g.nombre)}</span><b>${pct(n/tot)}</b></div>`).join("")}`, ev); });
  svg.addEventListener("mouseleave", ()=>tip(""));
  pintar();
}
