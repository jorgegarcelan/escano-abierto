/* Elecciones 29N · las encuestas: la media día a día, cada encuesta y la tabla de todas.
   Lo carga elecciones.js. Datos: datos/encuestas/encuestas.json (escano/encuestas.py, de la tabla de Wikipedia).
   Veda: la ley (LOREG, art. 69.7) prohíbe publicar, difundir o reproducir encuestas los cinco días anteriores a la
   votación; en ese tiempo, la página solo lo explica. */

const cache = {};
const pedir = url => cache[url] ||= fetch(url).then(r=>r.ok?r.json():null).catch(()=>null);
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const dec = (x, d=1) => x.toLocaleString("es-ES", {minimumFractionDigits:d, maximumFractionDigits:d});
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MESES_L = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const fCorta = iso => { const [y,m,d] = iso.split("-").map(Number); return `${d} ${MESES[m-1]}`; };
const fLarga = iso => { const [y,m,d] = iso.split("-").map(Number); return `${d} de ${MESES_L[m-1]} de ${y}`; };
// «5–8 oct 2026», «29 sep–1 oct 2026», «31 dic 2025».
const campo = e => { const [y2,m2,d2] = e.fin.split("-").map(Number); if (!e.ini || e.ini === e.fin) return `${d2} ${MESES[m2-1]} ${y2}`;
  const [y1,m1,d1] = e.ini.split("-").map(Number); return m1 === m2 && y1 === y2 ? `${d1}–${d2} ${MESES[m2-1]} ${y2}` : `${d1} ${MESES[m1-1]}${y1 !== y2 ? " " + y1 : ""}–${d2} ${MESES[m2-1]} ${y2}`; };
const dias = iso => { const [y,m,d] = iso.split("-").map(Number); return Date.UTC(y,m-1,d)/864e5; };

const CSS = `
.hi-tip{position:fixed;z-index:60;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--line-strong);border-radius:8px;padding:8px 10px;font-size:12.5px;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:290px}
.hi-tip .f{display:flex;justify-content:space-between;gap:14px}
.hi-tip .f i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.hi-seg{display:inline-flex;border:1px solid var(--line);border-radius:var(--r-pill);overflow:hidden;background:var(--surface);margin:2px 0 4px}
.hi-seg button{appearance:none;border:0;background:none;font:500 12.5px var(--sans);color:var(--muted);padding:5px 12px;cursor:pointer}
.hi-seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.enc-veda{display:grid;gap:8px;padding:22px;border:1px solid var(--line-strong);border-radius:14px;background:var(--surface)}
.enc-veda h3{margin:0}
.enc-hoy{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.enc-k{display:grid;gap:2px;padding:12px 12px 8px;border:1px solid var(--line);border-radius:12px;background:var(--surface);border-top:3px solid var(--c)}
.enc-k .n{font-size:12.5px;font-weight:600;color:var(--muted)}
.enc-k b{font:800 clamp(24px,3vw,32px)/1.05 var(--led,var(--display));font-variant-numeric:tabular-nums}
.enc-k small{font:600 11.5px var(--mono)}.enc-k .sube{color:var(--si)}.enc-k .baja{color:var(--no)}.enc-k .igual{color:var(--muted)}
.enc-k svg{display:block;width:100%;height:26px;margin-top:4px}
.enc-k svg path{fill:none;stroke:var(--c);stroke-width:1.6}
.enc-res{display:flex;flex-wrap:wrap;gap:6px 18px;margin:12px 0 0;font-size:13.5px;color:var(--muted)}
.enc-res b{color:var(--ink)}
.enc-ctl{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin-bottom:8px}
.enc-ps{display:flex;flex-wrap:wrap;gap:5px}
.enc-ps button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;border:1px solid var(--line);font:600 12px var(--sans,inherit);color:var(--muted)}
.enc-ps button i{width:9px;height:9px;border-radius:50%;background:var(--c)}
.enc-ps button[aria-pressed="true"]{color:var(--ink);border-color:var(--c);background:color-mix(in srgb,var(--c) 16%,var(--surface))}
.enc-ps button:focus-visible{outline:2px solid var(--no);outline-offset:2px}
svg.enc-g{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y}
svg.enc-g .ejes line{stroke:var(--line);stroke-dasharray:2 4}
svg.enc-g .ejes text,svg.enc-g .meses text{font:10.5px var(--mono);fill:var(--muted)}
svg.enc-g .banda{opacity:.16}
svg.enc-g .linea{fill:none;stroke-width:2.4;stroke-linejoin:round}
svg.enc-g .pto{opacity:.32}
svg.enc-g .hito line{stroke:var(--muted);stroke-dasharray:3 3}
svg.enc-g .hito text{font:600 10.5px var(--sans,inherit);fill:var(--muted)}
svg.enc-g .r23{stroke:var(--surface);stroke-width:1.2}
svg.enc-g .fin text{font:700 12px var(--sans,inherit)}
svg.enc-g .cruz{stroke:var(--ink);stroke-width:1;opacity:0;pointer-events:none}
.enc-tabla-w{overflow-x:auto;max-width:100%}
table.enc-t{border-collapse:collapse;font-size:12.5px;width:100%;min-width:720px}
.enc-t th{font:600 10.5px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);text-align:right;padding:6px 6px;border-bottom:1px solid var(--line-strong);white-space:nowrap}
.enc-t th:first-child,.enc-t td:first-child{text-align:left}
.enc-t th i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:baseline}
.enc-t td{padding:6px 6px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.enc-t td small{display:block;font:10.5px var(--mono);color:var(--muted)}
.enc-t td.max{font-weight:700}
.enc-t .em b{font-weight:600}.enc-t .em span{color:var(--muted)}
.enc-t .fuera{font:600 10px var(--mono);color:var(--muted);border:1px solid var(--line-strong);border-radius:999px;padding:0 6px;margin-left:6px}
.enc-mas{margin-top:10px}
.enc-nota{font-size:12.5px;color:var(--muted);line-height:1.55}
`;
function estilos(){ if (document.getElementById("enc-css")) return; const s = document.createElement("style"); s.id = "enc-css"; s.textContent = CSS; document.head.appendChild(s); }
let tipEl = null;
function tip(html, ev){
  if (!tipEl){ tipEl = document.querySelector(".hi-tip") || Object.assign(document.createElement("div"), {className:"hi-tip", hidden:true}); if (!tipEl.parentNode) document.body.appendChild(tipEl); }
  if (!html){ tipEl.hidden = true; return; }
  tipEl.innerHTML = html; tipEl.hidden = false;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight, vw = document.documentElement.clientWidth;
  let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > vw - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
  tipEl.style.left = Math.max(8, x) + "px"; tipEl.style.top = Math.max(8, y) + "px";
}
const filaTip = (color, nombre, valor) => `<div class="f"><span><i style="background:${color}"></i>${esc(nombre)}</span><b>${valor}</b></div>`;

/* ¿Estamos en la veda? Del 24-N (00.00) a las 20.00 del 29-N, en hora peninsular. */
export function enVeda(datos, ahora = new Date()){
  const [ini, fin] = datos?.veda || ["2026-11-24", "2026-11-29T20:00"];
  const madrid = new Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Madrid", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false}).format(ahora).replace(" ", "T");
  return madrid >= ini && madrid < fin;
}
export const avisoVeda = () => `<div class="enc-veda"><div class="eyebrow">Veda electoral</div><h3>Hasta las 20.00 del domingo, sin encuestas</h3>
  <p>La ley electoral (LOREG, art. 69.7) prohíbe publicar, difundir o reproducir encuestas durante los cinco días anteriores a la votación, del 24 de noviembre al cierre de los colegios. Por eso esta página no las enseña ahora: ni las nuevas ni las de antes.</p>
  <p>Volverán a verse a las 20.00 del 29 de noviembre. Mientras, puedes ver <a href="#elecciones-historico">cómo fueron las dieciséis elecciones anteriores</a>.</p></div>`;

export async function pintarEncuestas(sec){
  estilos();
  const D = await pedir("datos/encuestas/encuestas.json");
  if (!D){ sec.innerHTML = `<p class="nota">No se han podido cargar las encuestas.</p>`; return; }
  if (enVeda(D)){ sec.innerHTML = `<section class="sec" style="padding-top:8px">${avisoVeda()}</section>`; return; }
  const P = Object.fromEntries(D.partidos.map(p=>[p.id, p])), M = D.media, nd = M.dias.length, hoy = M.dias[nd-1];
  const ult = id => { const m = M.partidos[id]?.m; for (let i = (m?.length||0) - 1; i >= 0; i--) if (m[i] != null) return [m[i], i]; return [null, -1]; };
  const hace = (id, n) => { const [, i] = ult(id); const m = M.partidos[id]?.m; for (let j = i - n; j >= 0; j--) if (m[j] != null) return m[j]; return null; };
  const orden = Object.keys(M.partidos).filter(id=>ult(id)[0] != null).sort((a,b)=>ult(b)[0] - ult(a)[0]);
  const principales = orden.filter(id=>ult(id)[0] >= 1);
  const validas = D.encuestas.filter(e=>!e.cis && !e.agregador), ultima = validas[0];
  const [a1, a2] = orden;
  sec.innerHTML = `<section class="sec" style="padding-top:8px">
      <div class="sec-h"><h2>La media de hoy</h2><p>De las ${fmt(validas.filter(e=>dias(e.fin) > dias(hoy) - 45).length)} encuestas de los últimos 45 días, la más reciente de cada empresa. Cambio respecto a hace 30 días.</p></div>
      <div class="enc-hoy">${orden.slice(0, 6).map(id=>{ const [v] = ult(id), a = hace(id, 30), d = a == null ? null : v - a;
        return `<div class="enc-k" style="--c:${P[id]?.color || "#888"}"><span class="n">${esc(P[id]?.nombre || id)}</span><b>${dec(v)} %</b>${d == null ? "" : `<small class="${Math.abs(d) < .25 ? "igual" : d > 0 ? "sube" : "baja"}">${Math.abs(d) < .25 ? "= " : d > 0 ? "▲ " : "▼ "}${dec(Math.abs(d))}</small>`}${chispa(id)}</div>`; }).join("")}</div>
      <p class="enc-res"><span>El <b>${esc(P[a1].nombre)}</b> saca <b>${dec(ult(a1)[0] - ult(a2)[0])} puntos</b> al ${esc(P[a2].nombre)}</span><span>Última encuesta: <b>${esc(ultima.empresa)}</b>${ultima.medio ? ` para ${esc(ultima.medio)}` : ""}, ${esc(fCorta(ultima.fin))}</span><span>${fmt(D.encuestas.length)} encuestas desde julio de 2023</span></p></section>
    <section class="sec"><div class="sec-h"><h2>La media, día a día</h2><p>Cada línea es la media; la sombra, cuánto se separan las encuestas entre sí; cada punto, una encuesta. Pasa por encima para ver un día.</p></div>
      <div class="chart"><div class="enc-ctl"><div class="hi-seg" role="group" aria-label="Periodo"><button data-enc-r="todo" aria-pressed="true">Desde 2023</button><button data-enc-r="ano" aria-pressed="false">Último año</button><button data-enc-r="90" aria-pressed="false">90 días</button></div>
        <div class="enc-ps" id="enc-ps">${principales.map(id=>`<button data-enc-p="${id}" aria-pressed="true" style="--c:${P[id].color}"><i></i>${esc(P[id].nombre)}</button>`).join("")}</div></div>
        <div id="enc-g"></div></div></section>
    <section class="sec"><div class="sec-h"><h2>Todas las encuestas</h2><div class="controls"><select id="enc-emp" aria-label="Encuestadora"><option value="">Todas las empresas</option>${[...new Set(D.encuestas.map(e=>e.empresa))].sort((a,b)=>a.localeCompare(b,"es")).map(e=>`<option>${esc(e)}</option>`).join("")}</select></div></div>
      <div class="chart"><div class="enc-tabla-w" id="enc-t"></div><button class="btn enc-mas" id="enc-mas" type="button">Ver más</button></div>
      <p class="enc-nota">Cómo se hace la media: de cada empresa cuenta solo su última encuesta de los 45 días anteriores, con un peso que se reduce a la mitad cada dos semanas largas y crece un poco con el tamaño de la muestra. No entran el CIS (su estimación se aparta sistemáticamente del resto) ni KeyData (es ya una media de encuestas). Fuente: <a href="${esc(D.fuente)}">la tabla de encuestas de Wikipedia</a>, actualizada el ${esc(fLarga(D.actualizado))}. La ley prohíbe publicar encuestas del 24 al 29 de noviembre: en esos días esta página no las enseñará.</p></section>`;
  function chispa(id){ const m = M.partidos[id].m.slice(-90), vs = m.filter(v=>v!=null), mx = Math.max(...vs), mn = Math.min(...vs), r = Math.max(mx - mn, 2), b = (mx + mn)/2 - r/2;
    return `<svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true"><path d="${m.map((v,i)=>v==null?"":`${i&&m[i-1]!=null?"L":"M"}${(i/(m.length-1)*100).toFixed(1)} ${(24 - (v-b)/r*22).toFixed(1)}`).join("")}"/></svg>`; }

  // ---------- el gráfico ----------
  let rango = "todo"; const visibles = new Set(principales);
  const caja = sec.querySelector("#enc-g");
  function grafico(){
    const W = Math.max(320, caja.clientWidth || 800), estrecho = W < 640, H = estrecho ? 300 : 380, m = {l: 34, r: estrecho ? 70 : 96, t: 26, b: 26};
    const fin = D.eleccion, i0 = rango === "todo" ? 0 : Math.max(0, nd - (rango === "ano" ? 365 : 90)), ini = M.dias[i0];
    const t0 = dias(ini), t1 = dias(fin), X = iso => m.l + (dias(iso) - t0)/(t1 - t0)*(W - m.l - m.r);
    const ids = principales.filter(id=>visibles.has(id));
    const tope = Math.ceil((Math.max(...ids.map(id=>Math.max(...M.partidos[id].m.slice(i0).filter(v=>v!=null).map((v,i)=>v + (M.partidos[id].s[i0+i]||0)))), 10) + 2)/5)*5;
    const Y = v => m.t + (1 - v/tope)*(H - m.t - m.b);
    const marcas = []; for (let v = 0; v <= tope; v += tope > 30 ? 10 : 5) marcas.push(v);
    // Meses (o años) en el eje.
    const ticks = []; { const [y0, mo0] = ini.split("-").map(Number); let y = y0, mo = mo0 + 1; if (mo > 12){ mo = 1; y++; }
      while (`${y}-${String(mo).padStart(2,"0")}-01` <= fin){ ticks.push(`${y}-${String(mo).padStart(2,"0")}-01`); mo += rango === "todo" ? 6 : rango === "ano" ? 2 : 1; while (mo > 12){ mo -= 12; y++; } } }
    const serie = (id, k) => M.partidos[id][k].slice(i0).map((v,i)=>[M.dias[i0+i], v]).filter(x=>x[1]!=null);
    const linea = id => { let d = "", prev = false; M.partidos[id].m.slice(i0).forEach((v,i)=>{ if (v == null){ prev = false; return; } d += `${prev?"L":"M"}${X(M.dias[i0+i]).toFixed(1)} ${Y(v).toFixed(1)}`; prev = true; }); return d; };
    const banda = id => { const s = serie(id, "m"), sd = M.partidos[id].s.slice(i0); const pts = M.partidos[id].m.slice(i0).map((v,i)=>v==null?null:[X(M.dias[i0+i]), v, sd[i]||0]).filter(Boolean);
      if (!pts.length) return ""; return "M" + pts.map(p=>`${p[0].toFixed(1)} ${Y(p[1] + p[2]).toFixed(1)}`).join("L") + "L" + pts.reverse().map(p=>`${p[0].toFixed(1)} ${Y(Math.max(0, p[1] - p[2])).toFixed(1)}`).join("L") + "Z"; };
    const puntos = D.encuestas.filter(e=>!e.cis && !e.agregador && e.fin >= ini).flatMap(e=>ids.filter(id=>e.v[id] != null).map(id=>`<circle class="pto" cx="${X(e.fin).toFixed(1)}" cy="${Y(e.v[id]).toFixed(1)}" r="2.2" fill="${P[id].color}"/>`)).join("");
    const r23 = rango === "todo" && D.resultado2023 ? ids.filter(id=>D.resultado2023.v[id] != null).map(id=>`<rect class="r23" x="${(X(D.resultado2023.fecha) - 4).toFixed(1)}" y="${(Y(D.resultado2023.v[id]) - 4).toFixed(1)}" width="8" height="8" transform="rotate(45 ${X(D.resultado2023.fecha).toFixed(1)} ${Y(D.resultado2023.v[id]).toFixed(1)})" fill="${P[id].color}"/>`).join("") : "";
    // Los nombres al final de cada línea, separados para que no se pisen.
    const finales = ids.map(id=>({id, v: ult(id)[0], y: Y(ult(id)[0]) + 4})).sort((a,b)=>a.y - b.y);
    for (let i = 1; i < finales.length; i++) finales[i].y = Math.max(finales[i].y, finales[i-1].y + 14);
    if (finales.length) finales[finales.length-1].y = Math.min(finales[finales.length-1].y, H - m.b);   // el último, dentro del gráfico; los demás, hacia arriba
    for (let i = finales.length - 2; i >= 0; i--) finales[i].y = Math.min(finales[i].y, finales[i+1].y - 14);
    // La disolución, rotulada hacia la izquierda; el 29N, hacia la derecha (si están muy juntas, solo el 29N).
    const xHoy = X(hoy), cerca = X(fin) - X("2026-10-06") < 70;
    const hitos = [["2026-10-06", "Disolución", "end", -4], [fin, "29N", "end", -4]].filter(([f])=>f >= ini).map(([f,t,an,dx])=>`<g class="hito"><line x1="${X(f)}" x2="${X(f)}" y1="${m.t - 8}" y2="${H - m.b}"/>${f !== fin && cerca ? "" : `<text x="${(X(f) + dx).toFixed(1)}" y="${m.t - 12}" text-anchor="${an}">${t}</text>`}</g>`).join("");
    caja.innerHTML = `<svg class="enc-g" viewBox="0 0 ${W} ${H}" role="img" aria-label="Media de las encuestas por partido desde 2023">
      <defs><clipPath id="enc-clip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
      <g class="ejes">${marcas.map(v=>`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v} %</text>`).join("")}</g>
      <g class="meses">${ticks.filter((t,i,a)=>X(t) > m.l + 10 && X(t) < W - m.r - 10).map(t=>`<text x="${X(t).toFixed(1)}" y="${H - 6}" text-anchor="middle">${MESES[+t.slice(5,7)-1]}${t.slice(5,7) === "01" || rango === "todo" ? " " + t.slice(2,4) : ""}</text>`).join("")}</g>
      ${hitos}<g clip-path="url(#enc-clip)">${ids.map(id=>`<path class="banda" d="${banda(id)}" fill="${P[id].color}"/>`).join("")}${puntos}${r23}${ids.map(id=>`<path class="linea" d="${linea(id)}" stroke="${P[id].color}"/>`).join("")}</g>
      <g class="fin">${finales.map(f=>`<text x="${(xHoy + 6).toFixed(1)}" y="${f.y.toFixed(1)}" fill="${P[f.id].color}">${esc(P[f.id].nombre)} ${dec(f.v)}</text>`).join("")}</g>
      <line class="cruz" y1="${m.t}" y2="${H - m.b}"/></svg>`;
    // Pasar por encima: el día más cercano, con la media de cada partido.
    const svg = caja.querySelector("svg"), cruz = svg.querySelector(".cruz");
    svg.onmousemove = ev => { const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left)/r.width*W, t = t0 + (x - m.l)/(W - m.l - m.r)*(t1 - t0);
      let i = Math.round(t - dias(M.dias[0])); i = Math.max(i0, Math.min(nd - 1, i)); const dia = M.dias[i];
      cruz.setAttribute("x1", X(dia)); cruz.setAttribute("x2", X(dia)); cruz.style.opacity = .5;
      const filas = ids.map(id=>[id, M.partidos[id].m[i]]).filter(x=>x[1] != null).sort((a,b)=>b[1] - a[1]);
      tip(`<b>${esc(fLarga(dia))}</b>${filas.map(([id,v])=>filaTip(P[id].color, P[id].nombre, `${dec(v)} %`)).join("")}`, ev); };
    svg.onmouseleave = () => { cruz.style.opacity = 0; tip(""); };
  }
  grafico();
  let ancho = caja.clientWidth; if ("ResizeObserver" in window) new ResizeObserver(()=>{ if (Math.abs(caja.clientWidth - ancho) > 24){ ancho = caja.clientWidth; grafico(); } }).observe(caja);

  // ---------- la tabla ----------
  let cuantas = 25, empresa = "";
  const cols = principales.slice(0, 10);
  function tabla(){
    const L = D.encuestas.filter(e=>!empresa || e.empresa === empresa), V = L.slice(0, cuantas);
    sec.querySelector("#enc-t").innerHTML = `<table class="enc-t"><thead><tr><th>Encuestadora</th><th>Campo</th><th>Muestra</th>${cols.map(id=>`<th><i style="background:${P[id].color}"></i>${esc(P[id].nombre)}</th>`).join("")}</tr></thead><tbody>
      ${V.map(e=>{ const mx = Math.max(...cols.map(id=>e.v[id] ?? -1));
        return `<tr><td class="em"><b>${esc(e.empresa)}</b>${e.medio ? ` <span>· ${esc(e.medio)}</span>` : ""}${e.cis || e.agregador ? `<span class="fuera" title="No entra en la media">fuera de la media</span>` : ""}</td>
          <td>${esc(campo(e))}</td><td>${e.n ? fmt(e.n) : "–"}</td>
          ${cols.map(id=>{ const v = e.v[id], s = e.e[id]; return `<td class="${v === mx ? "max" : ""}">${v != null ? dec(v) : "–"}${s ? `<small>${s[0] === s[1] ? s[0] : `${s[0]}–${s[1]}`}</small>` : ""}</td>`; }).join("")}</tr>`; }).join("")}</tbody></table>`;
    sec.querySelector("#enc-mas").hidden = V.length >= L.length;
  }
  tabla();
  sec.addEventListener("click", ev=>{
    const r = ev.target.closest("[data-enc-r]"); if (r){ rango = r.dataset.encR; sec.querySelectorAll("[data-enc-r]").forEach(b=>b.setAttribute("aria-pressed", String(b === r))); grafico(); return; }
    const p = ev.target.closest("[data-enc-p]"); if (p){ const id = p.dataset.encP; if (visibles.has(id) && visibles.size > 1) visibles.delete(id); else visibles.add(id); p.setAttribute("aria-pressed", String(visibles.has(id))); grafico(); return; }
    if (ev.target.closest("#enc-mas")){ cuantas += 50; tabla(); }
  });
  sec.querySelector("#enc-emp").addEventListener("change", ev=>{ empresa = ev.target.value; cuantas = 25; tabla(); });
}
