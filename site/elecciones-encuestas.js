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
  <p>Volverán a verse a las 20.00 del 29 de noviembre. Mientras, puedes ver <a href="/elecciones/historico/">cómo fueron las dieciséis elecciones anteriores</a>.</p></div>`;

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
      <div class="chart"><div class="enc-tabla-w" id="enc-t"></div><button class="btn boton-claro enc-mas" id="enc-mas" type="button">Ver más</button></div>
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

/* =====================================================================================================
   LA PROYECCIÓN: los escaños que salen de la media (escano/proyeccion.py)
   ===================================================================================================== */
const ORDEN_PROY = ["SUMAR","PODEMOS","BILDU","ERC","BNG","PSOE","CC","PNV","JUNTS","ALIANCA","AA","UPN","PP","SALF","VOX"];   // de izquierda a derecha, para el hemiciclo
const CSS_PROY = `
.pr-top{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(240px,1fr);gap:16px;align-items:stretch}
@media (max-width:820px){ .pr-top{grid-template-columns:1fr} }
.pr-hemi{display:grid;align-content:center;gap:8px}
.pr-hemi .hi-hemi{max-width:560px;margin:0 auto}
.pr-ley{display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:center;font-size:12.5px;color:var(--muted)}
.pr-ley span{display:inline-flex;align-items:center;gap:5px}.pr-ley b{color:var(--ink)}
.pr-ley i{width:9px;height:9px;border-radius:50%}
.pr-probs{display:grid;gap:10px;align-content:start}
.pr-p{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
.pr-p b{grid-row:span 2;font:800 clamp(26px,3.4vw,36px)/1 var(--led,var(--display));font-variant-numeric:tabular-nums;min-width:3.2em;text-align:right}
.pr-p span{font-size:13.5px;font-weight:600;line-height:1.25}
.pr-p small{font-size:12px;color:var(--muted)}
.pr-filas{display:grid;gap:6px}
.pr-f{display:grid;grid-template-columns:minmax(0,7em) minmax(0,1fr) 3.4em;gap:10px;align-items:center;font-size:13px}
.pr-f .n{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px}
.pr-f .n i{width:9px;height:9px;border-radius:50%;flex:none}
.pr-f .t{position:relative;height:18px}
.pr-f .t::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:1px dashed var(--line)}
.pr-f .rg{position:absolute;top:5px;height:8px;border-radius:99px;opacity:.38;transition:left .6s ease,width .6s ease}
.pr-f .md{position:absolute;top:2px;width:3px;height:14px;border-radius:2px;transform:translateX(-50%);transition:left .6s ease}
.pr-f .v23{position:absolute;top:4px;width:9px;height:9px;transform:translateX(-50%) rotate(45deg);border:1.5px solid var(--ink);background:var(--surface)}
.pr-f b{font:700 14px var(--mono);text-align:right}
.pr-esc-ley{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--muted);margin-top:10px}
.pr-esc-ley span{display:inline-flex;align-items:center;gap:6px}
.pr-esc-ley .r{width:22px;height:8px;border-radius:99px;background:var(--muted);opacity:.4}.pr-esc-ley .m{width:3px;height:12px;border-radius:2px;background:var(--ink)}
.pr-esc-ley .d{width:8px;height:8px;transform:rotate(45deg);border:1.5px solid var(--ink)}
svg.pr-hist{display:block;width:100%;height:auto;overflow:visible}
svg.pr-hist rect{transition:opacity .2s}
svg.pr-hist .eje text,svg.pr-serie .eje text{font:10.5px var(--mono);fill:var(--muted)}
svg.pr-hist .m176 line,svg.pr-serie .m176 line{stroke:var(--ink);stroke-dasharray:4 3}
svg.pr-hist .m176 text,svg.pr-serie .m176 text{font:600 11px var(--sans,inherit);fill:var(--ink)}
svg.pr-serie{display:block;width:100%;height:auto;overflow:visible}
svg.pr-serie .ejes line{stroke:var(--line);stroke-dasharray:2 4}
svg.pr-serie .l{fill:none;stroke-width:2.2;stroke-linejoin:round}
svg.pr-serie .bl{fill:none;stroke-width:2.6;stroke-dasharray:6 4}
svg.pr-serie .fin text{font:700 11.5px var(--sans,inherit)}
svg.pr-serie .cruz{stroke:var(--ink);opacity:0;pointer-events:none}
.pr-mapa-w{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,1fr);gap:16px;align-items:start}
@media (max-width:820px){ .pr-mapa-w{grid-template-columns:1fr} }
svg.pr-mapa{display:block;width:100%;height:auto}
svg.pr-mapa path{stroke:var(--surface);stroke-width:1;cursor:pointer;transition:fill .4s}
svg.pr-mapa path:hover,svg.pr-mapa path.sel{stroke:var(--ink);stroke-width:2.5}
svg.pr-mapa path.aire{stroke:var(--ink);stroke-width:1.6;stroke-dasharray:3 2}
.pr-aire{display:grid;gap:3px}
.pr-aire button{all:unset;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);font-size:12.5px}
.pr-aire button:hover{border-color:var(--line-strong)}
.pr-aire span{display:inline-flex;align-items:center;gap:4px;color:var(--muted)}
.pr-aire i{width:8px;height:8px;border-radius:50%;display:inline-block}
.pr-aire small{font:700 11.5px var(--mono);color:var(--no);grid-row:span 2;align-self:center}
.pr-prov h3{margin:0 0 6px}
.pr-prov .pr-f{grid-template-columns:minmax(0,6em) minmax(0,1fr) 6.4em}
.pr-prov .cmp{font:12px var(--mono);color:var(--muted);text-align:right}
.pr-metodo{font-size:13.5px;line-height:1.6;color:var(--muted)}
.pr-metodo ol{padding-left:20px;margin:6px 0}
.pr-metodo b{color:var(--ink)}
`;
export async function pintarProyeccion(sec, ctx){
  estilos(); if (!document.getElementById("enc-css-pr")){ const st = document.createElement("style"); st.id = "enc-css-pr"; st.textContent = CSS_PROY; document.head.appendChild(st); }
  const [D, PR, GEO] = await Promise.all([pedir("datos/encuestas/encuestas.json"), pedir("datos/encuestas/proyeccion.json"), pedir("datos/elecciones/geo-provincias.json")]);
  if (!D || !PR){ sec.innerHTML = `<p class="nota">No se ha podido cargar la proyección.</p>`; return; }
  if (enVeda(D)){ sec.innerHTML = `<section class="sec" style="padding-top:8px">${avisoVeda()}</section>`; return; }
  const P = Object.fromEntries(D.partidos.map(p=>[p.id, p])), S = PR.simulacion, C = PR.central;
  const col = id => P[id]?.color || "#888", nom = id => P[id]?.nombre || id;
  const r23 = D.resultado2023?.e || {}, en23 = id => r23[id]?.[0] ?? (id === "PODEMOS" || id === "SALF" || id === "ALIANCA" || id === "AA" ? null : 0);
  const pc = x => `${Math.round(x*100)} %`, probTxt = x => x >= .995 ? "> 99 %" : x <= .005 ? "< 1 %" : pc(x);
  const ids = ORDEN_PROY.filter(id=>C[id]);
  const porEscanos = Object.keys(S.partidos).filter(id=>S.partidos[id].p95 > 0).sort((a,b)=>(S.partidos[b].med - S.partidos[a].med) || (C[b]||0) - (C[a]||0));
  const B = S.bloques, bPPV = B["PP + Vox"], bSoc = B["PSOE y sus socios de 2023"], primero = Object.entries(S.primero).sort((a,b)=>b[1]-a[1])[0];
  sec.innerHTML = `<section class="sec" style="padding-top:8px">
      <div class="sec-h"><h2>Si las elecciones fueran hoy</h2><p>Los escaños que salen de la media de las encuestas del ${esc(fLarga(PR.fecha))}, provincia a provincia y con la ley D'Hondt; y lo probable que es cada cosa, en ${fmt(S.n)} simulaciones.</p></div>
      <div class="pr-top"><div class="chart pr-hemi"><div id="pr-hemi"></div><div class="pr-ley">${ids.map(id=>`<span><i style="background:${col(id)}"></i>${esc(nom(id))} <b>${C[id]}</b></span>`).join("")}</div></div>
        <div class="pr-probs">
          <div class="pr-p"><b>${probTxt(primero[1])}</b><span>${esc(nom(primero[0]))}, primera fuerza</span><small>en ${probTxt(primero[1])} de las simulaciones saca más escaños que nadie</small></div>
          <div class="pr-p"><b>${probTxt(bPPV.p176)}</b><span>PP y Vox suman mayoría absoluta</span><small>${bPPV.med} escaños (entre ${bPPV.p05} y ${bPPV.p95}); hacen falta 176</small></div>
          <div class="pr-p"><b>${probTxt(Math.max(0, ...Object.values(S.solo176 || {}), 0))}</b><span>Un partido solo, mayoría absoluta</span><small>el PP, con ${S.partidos.PP?.med ?? "–"} escaños (entre ${S.partidos.PP?.p05} y ${S.partidos.PP?.p95})</small></div>
          <div class="pr-p"><b>${probTxt(bSoc.p176)}</b><span>Los socios de la investidura de 2023 repiten mayoría</span><small>PSOE, Sumar, Podemos, ERC, Junts, Bildu, PNV, BNG y CC: ${bSoc.med} (entre ${bSoc.p05} y ${bSoc.p95})</small></div>
        </div></div></section>
    <section class="sec"><div class="sec-h"><h2>Escaños por partido</h2><p>La raya es lo más probable; la barra, el margen en 9 de cada 10 simulaciones; el rombo, lo que sacó en 2023.</p></div>
      <div class="chart"><div class="pr-filas" id="pr-filas"></div><div class="pr-esc-ley"><span><i class="m"></i>lo más probable</span><span><i class="r"></i>9 de cada 10 simulaciones</span><span><i class="d"></i>escaños en 2023</span></div></div></section>
    <section class="sec"><div class="sec-h"><h2>¿Llegan a 176?</h2><p>Cuántas simulaciones acaban con cada número de escaños. A la derecha de la línea, mayoría absoluta.</p></div>
      <div class="chart"><div class="hi-seg" role="group" aria-label="Bloque">${Object.keys(B).map((b,k)=>`<button data-pr-b="${esc(b)}" aria-pressed="${k===0}">${esc(b)}</button>`).join("")}</div><div id="pr-hist"></div></div></section>
    <section class="sec"><div class="sec-h"><h2>Semana a semana</h2><p>La proyección con la media de cada semana desde 2023 (sin simulaciones: lo más probable).</p></div>
      <div class="chart"><div id="pr-serie"></div></div></section>
    <section class="sec"><div class="sec-h"><h2>Provincia a provincia</h2><p>Quién se llevaría más escaños en cada una. Con borde discontinuo, donde el último escaño está a menos de medio punto. Pulsa una provincia.</p></div>
      <div class="pr-mapa-w"><div class="chart"><div id="pr-mapa"></div></div><div class="chart" id="pr-lado"></div></div></section>
    <section class="sec"><div class="sec-h"><h2>Cómo se hace</h2></div><div class="chart pr-metodo">
      <ol><li><b>La media de las encuestas</b> (la de <a href="/elecciones/encuestas/">Las encuestas</a>) da el voto de cada partido en toda España.</li>
        <li><b>A cada provincia</b>, desde su resultado de 2023: si un partido sube un 50 % en España, sube un 50 % en cada provincia. Podemos, que en 2023 fue dentro de Sumar, hereda su reparto provincial; Se Acabó La Fiesta, a medias uniforme y como Vox; Aliança Catalana y Adelante Andalucía, solo en su comunidad.</li>
        <li><b>La ley D'Hondt</b> en cada provincia, con los escaños de 2026 (Cádiz pierde uno y Madrid gana uno) y la barrera del 3 %. Con el resultado de 2023, el modelo devuelve exactamente el Congreso de 2023.</li>
        <li><b>${fmt(S.n)} simulaciones</b>: en cada una, cada partido se desvía de su media lo que suelen fallar las encuestas (unos ±2 puntos el PP o el PSOE, menos de uno los pequeños) y cada provincia, un poco más. Las probabilidades son la parte de simulaciones en que pasa cada cosa.</li></ol>
      <p>No es un pronóstico: es lo que dirían las urnas si votáramos hoy como dicen las encuestas, que pueden fallar todas en la misma dirección. El código está en <a href="https://github.com/jorgegarcelan/escano-abierto/blob/main/escano/proyeccion.py">proyeccion.py</a>.</p></div></section>`;
  // El hemiciclo, de izquierda a derecha.
  import("./elecciones-historico.js").then(m=>m.hemicicloReal(sec.querySelector("#pr-hemi"), ctx, ids.map(id=>({color: col(id), n: C[id], tip: `<b>${esc(nom(id))}</b><br>${C[id]} escaños (entre ${S.partidos[id]?.p05 ?? C[id]} y ${S.partidos[id]?.p95 ?? C[id]})`})), "350")).catch(err=>console.error(err));
  // Escaños por partido: rango, lo más probable y 2023, en una escala común.
  { const max = Math.max(...porEscanos.map(id=>Math.max(S.partidos[id].p95, en23(id) || 0)), 10), X = v => `${(v/max*100).toFixed(2)}%`;
    sec.querySelector("#pr-filas").innerHTML = porEscanos.map(id=>{ const s = S.partidos[id], a = en23(id);
      return `<div class="pr-f" data-tip="${esc(`<b>${esc(nom(id))}</b><br>Lo más probable: ${s.med} escaños<br>9 de cada 10 simulaciones: entre ${s.p05} y ${s.p95}${a != null ? `<br>En 2023: ${a}` : "<br>No se presentó en 2023"}`)}"><span class="n"><i style="background:${col(id)}"></i>${esc(nom(id))}</span>
        <span class="t"><span class="rg" style="left:${X(s.p05)};width:calc(${X(s.p95 - s.p05)} + 3px);background:${col(id)}"></span>${a != null ? `<span class="v23" style="left:${X(a)}"></span>` : ""}<span class="md" style="left:${X(s.med)};background:${col(id)}"></span></span><b>${s.med}</b></div>`; }).join(""); }
  // ¿Llegan a 176? El histograma de un bloque.
  function hist(nombre){
    const b = B[nombre], h = b.hist, caja = sec.querySelector("#pr-hist"), W = Math.max(300, caja.clientWidth || 700), H = 220, m = {l: 30, r: 10, t: 28, b: 24};
    const lo = Math.max(0, Math.min(b.p05 - 15, 150)), hi = Math.max(b.p95 + 15, 200), X = v => m.l + (v - lo)/(hi - lo)*(W - m.l - m.r), bw = Math.max(1, (W - m.l - m.r)/(hi - lo) - 1);
    const max = Math.max(...h.slice(lo, hi + 1), 1), Y = c => H - m.b - c/max*(H - m.t - m.b), color = b.partidos.length === 2 ? col("PP") : col("PSOE");
    const barras = h.map((c,v)=>v < lo || v > hi || !c ? "" : `<rect x="${X(v).toFixed(1)}" y="${Y(c).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - m.b - Y(c)).toFixed(1)}" fill="${color}" opacity="${v >= 176 ? 1 : .45}" data-tip="${esc(`<b>${v} escaños</b><br>${dec(c/S.n*100)} % de las simulaciones`)}"/>`).join("");
    const ticks = []; for (let v = Math.ceil(lo/10)*10; v <= hi; v += (hi - lo) > 80 ? 20 : 10) ticks.push(v);
    caja.innerHTML = `<svg class="pr-hist" viewBox="0 0 ${W} ${H}" role="img" aria-label="Escaños de ${esc(nombre)} en las simulaciones">${barras}
      <g class="eje">${ticks.map(v=>`<text x="${X(v) + bw/2}" y="${H - 6}" text-anchor="middle">${v}</text>`).join("")}</g>
      ${176 >= lo && 176 <= hi ? `<g class="m176"><line x1="${X(176) - .5}" x2="${X(176) - .5}" y1="${m.t - 6}" y2="${H - m.b}"/><text x="${X(176) + 4}" y="${m.t - 10}">176 · mayoría: ${probTxt(b.p176)}</text></g>` : ""}</svg>`;
  }
  hist(Object.keys(B)[0]);
  // Semana a semana: los principales partidos y el bloque PP + Vox.
  function serie(){
    const caja = sec.querySelector("#pr-serie"), W = Math.max(320, caja.clientWidth || 800), estrecho = W < 640, H = estrecho ? 280 : 340, m = {l: 32, r: estrecho ? 80 : 110, t: 18, b: 24};
    const Sr = PR.serie, t0 = dias(Sr[0][0]), t1 = dias(D.eleccion), X = iso => m.l + (dias(iso) - t0)/(t1 - t0)*(W - m.l - m.r), Y = v => m.t + (1 - v/240)*(H - m.t - m.b);
    const prin = ["PP","PSOE","VOX","SUMAR"].filter(id=>Sr.some(([,t])=>t[id])), bloque = Sr.map(([d,t])=>[d, (t.PP||0) + (t.VOX||0)]);
    const linea = pts => pts.map(([d,v],i)=>`${i?"L":"M"}${X(d).toFixed(1)} ${Y(v).toFixed(1)}`).join("");
    const ult = Sr[Sr.length-1], finales = [...prin.map(id=>({t:`${nom(id)} ${ult[1][id]||0}`, c:col(id), y:Y(ult[1][id]||0)})), {t:`PP + Vox ${bloque[bloque.length-1][1]}`, c:"var(--ink)", y:Y(bloque[bloque.length-1][1])}].sort((a,b)=>a.y-b.y);
    for (let i = 1; i < finales.length; i++) finales[i].y = Math.max(finales[i].y, finales[i-1].y + 14);
    const anios = ["2024-01-01","2025-01-01","2026-01-01"].filter(d=>dias(d) > t0);
    caja.innerHTML = `<svg class="pr-serie" viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyección de escaños semana a semana">
      <g class="ejes eje">${[0,50,100,150,200].map(v=>`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join("")}${anios.map(d=>`<text x="${X(d)}" y="${H - 6}" text-anchor="middle">${d.slice(0,4)}</text>`).join("")}</g>
      <g class="m176"><line x1="${m.l}" x2="${W - m.r}" y1="${Y(176)}" y2="${Y(176)}"/><text x="${m.l + 4}" y="${Y(176) - 5}">176</text></g>
      <path class="bl" d="${linea(bloque)}" stroke="var(--ink)" opacity=".7"/>${prin.map(id=>`<path class="l" d="${linea(Sr.map(([d,t])=>[d, t[id]||0]))}" stroke="${col(id)}"/>`).join("")}
      <g class="fin">${finales.map(f=>`<text x="${X(ult[0]) + 6}" y="${(f.y + 4).toFixed(1)}" fill="${f.c}">${esc(f.t)}</text>`).join("")}</g><line class="cruz" y1="${m.t}" y2="${H - m.b}"/></svg>`;
    const svg = caja.querySelector("svg"), cruz = svg.querySelector(".cruz");
    svg.onmousemove = ev => { const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left)/r.width*W; let k = 0, d = 1e9; Sr.forEach(([f],i)=>{ const dd = Math.abs(X(f) - x); if (dd < d){ d = dd; k = i; } });
      const [f, t] = Sr[k]; cruz.setAttribute("x1", X(f)); cruz.setAttribute("x2", X(f)); cruz.style.opacity = .5;
      tip(`<b>Semana del ${esc(fLarga(f))}</b>${Object.entries(t).sort((a,b)=>b[1]-a[1]).map(([id,v])=>filaTip(col(id), nom(id), v)).join("")}${filaTip("var(--ink)", "PP + Vox", (t.PP||0) + (t.VOX||0))}`, ev); };
    svg.onmouseleave = () => { cruz.style.opacity = 0; tip(""); };
  }
  serie();
  // Provincia a provincia: el que más escaños se llevaría y los escaños en el aire.
  let selP = null;
  const vp = cod => PR.votos?.[cod] || {};   // el voto proyectado en la provincia, para desempatar y para enseñarlo
  const ganaProv = cod => { const r = PR.provincias[cod] || {}; return Object.entries(r).sort((a,b)=>b[1]-a[1] || (vp(cod)[b[0]]||0) - (vp(cod)[a[0]]||0))[0]?.[0]; };
  const aire = Object.entries(PR.ultimos).filter(([,u])=>u.falta < .5).sort((a,b)=>a[1].falta - b[1].falta);
  if (GEO){ sec.querySelector("#pr-mapa").innerHTML = `<svg class="pr-mapa" viewBox="0 0 ${GEO.ancho} ${GEO.alto}" role="img" aria-label="Quién ganaría cada provincia">${Object.entries(GEO.provincias).map(([cod,g])=>`<path d="${g.d}" data-p="${cod}" class="${PR.ultimos[cod]?.falta < .5 ? "aire" : ""}" fill="${col(ganaProv(cod))}"/>`).join("")}<path d="${GEO.canarias}" fill="none" stroke="var(--line-strong)"/></svg>`; }
  const nomProv = cod => GEO?.provincias?.[cod]?.circ || cod;
  function lado(){
    const el = sec.querySelector("#pr-lado");
    if (!selP){ el.innerHTML = `<div class="eyebrow">Escaños en el aire</div><p class="enc-nota" style="margin:2px 0 8px">El último escaño de estas provincias se decide por menos de medio punto de voto.</p><div class="pr-aire">${aire.map(([cod,u])=>`<button type="button" data-pr-p="${cod}"><b>${esc(nomProv(cod))}</b><small>${dec(u.falta, 2)} pt</small><span><i style="background:${col(u.gana)}"></i>${esc(nom(u.gana))} → <i style="background:${col(u.segundo)}"></i>${esc(nom(u.segundo))}</span></button>`).join("") || `<p class="nota">Ninguno.</p>`}</div>`; return; }
    const r = PR.provincias[selP] || {}, u = PR.ultimos[selP], n = PR.escanos2026[selP], v = vp(selP);
    const filas = Object.keys({...v, ...r}).map(id=>[id, r[id] || 0]).filter(([id,e])=>e || (v[id] || 0) >= 3).sort((a,b)=>b[1]-a[1] || (v[b[0]]||0) - (v[a[0]]||0)), max = Math.max(...filas.map(x=>x[1]), 1);
    el.innerHTML = `<div class="pr-prov"><div class="eyebrow">${n} ${n === 1 ? "escaño" : "escaños"} · proyección</div><h3>${esc(nomProv(selP))}</h3><div class="pr-filas">${filas.map(([id,e])=>`<div class="pr-f"><span class="n"><i style="background:${col(id)}"></i>${esc(nom(id))}</span><span class="t"><span class="rg" style="left:0;width:${(e/max*100).toFixed(1)}%;background:${col(id)};opacity:.85"></span></span><b>${e} <span class="cmp">${dec(v[id] || 0)} %</span></b></div>`).join("")}</div>
      ${u ? `<p class="enc-nota">El último escaño sería de <b>${esc(nom(u.gana))}</b>; a ${esc(nom(u.segundo))} le faltarían ${dec(u.falta, 2)} puntos de voto en la provincia para quitárselo.</p>` : ""}
      <p><button class="btn boton-claro" type="button" data-pr-x>← Escaños en el aire</button> <a class="btn boton-claro" href="/elecciones/provincia-${esc(slugP(selP))}/">Su historia →</a></p></div>`;
  }
  const slugP = cod => ctx.slug(nomProv(cod));   // el mismo enlace que usa la web para cada provincia
  lado();
  const mapa = sec.querySelector("#pr-mapa svg");
  if (mapa){ mapa.addEventListener("mousemove", ev=>{ const p = ev.target.closest("[data-p]"); if (!p) return tip(""); const cod = p.dataset.p, r = PR.provincias[cod] || {};
      tip(`<b>${esc(nomProv(cod))}</b> · ${PR.escanos2026[cod]} escaños${Object.entries(r).sort((a,b)=>b[1]-a[1] || (vp(cod)[b[0]]||0) - (vp(cod)[a[0]]||0)).map(([id,v])=>filaTip(col(id), nom(id), `${v} <span style="color:var(--muted);font-weight:400">· ${dec(vp(cod)[id] || 0)} %</span>`)).join("")}`, ev); });
    mapa.addEventListener("mouseleave", ()=>tip("")); }
  const elegir = cod => { selP = cod; mapa?.querySelectorAll("path[data-p]").forEach(p=>p.classList.toggle("sel", p.dataset.p === cod)); lado(); };
  sec.addEventListener("click", ev=>{
    const b = ev.target.closest("[data-pr-b]"); if (b){ sec.querySelectorAll("[data-pr-b]").forEach(x=>x.setAttribute("aria-pressed", String(x === b))); hist(b.dataset.prB); return; }
    const p = ev.target.closest("#pr-mapa [data-p], [data-pr-p]"); if (p){ elegir(p.dataset.p || p.dataset.prP); return; }
    if (ev.target.closest("[data-pr-x]")) elegir(null);
  });
}

/* =====================================================================================================
   LOS MERCADOS: lo que apuestan en Polymarket (escano/encuestas.py → mercados.json)
   ===================================================================================================== */
const CSS_MERC = `
.me-top{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.me-k{display:grid;gap:4px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
.me-k .q{font-size:12.5px;color:var(--muted);line-height:1.3}
.me-k b{font:800 clamp(30px,4vw,42px)/1 var(--led,var(--display));font-variant-numeric:tabular-nums}
.me-k .r{font-size:14px;font-weight:600}
.me-k small{font-size:11.5px;color:var(--muted)}
.me-k svg{display:block;width:100%;height:34px;margin-top:4px}
.me-k svg path{fill:none;stroke:var(--ink);stroke-width:1.6}
.me-k svg .a{fill:color-mix(in srgb,var(--ink) 10%,transparent);stroke:none}
.me-bl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:16px;align-items:start}
@media (max-width:820px){ .me-bl{grid-template-columns:1fr} }
.me-op{display:grid;gap:6px}
.me-o{display:grid;grid-template-columns:minmax(0,9.5em) minmax(0,1fr) 3.6em;gap:10px;align-items:center;font-size:13px}
.me-o .n{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.me-o .t{height:12px;background:var(--sunk);border-radius:99px;overflow:hidden}
.me-o .t i{display:block;height:100%;border-radius:99px;width:0;transition:width .8s cubic-bezier(.3,.7,.3,1)}
.me-o b{font:700 13px var(--mono);text-align:right}
.me-vol{font-size:12px;color:var(--muted);margin:8px 0 0}
svg.me-g{display:block;width:100%;height:auto;overflow:visible}
svg.me-g .ejes line{stroke:var(--line);stroke-dasharray:2 4}
svg.me-g .ejes text{font:10.5px var(--mono);fill:var(--muted)}
svg.me-g .l{fill:none;stroke-width:2.2;stroke-linejoin:round}
svg.me-g .fin text{font:700 11.5px var(--sans,inherit)}
svg.me-g .hito line{stroke:var(--muted);stroke-dasharray:3 3}
svg.me-g .hito text{font:600 10.5px var(--sans,inherit);fill:var(--muted)}
svg.me-g .cruz{stroke:var(--ink);opacity:0;pointer-events:none}
.me-cmp{width:100%;border-collapse:collapse;font-size:13.5px}
.me-cmp th{font:600 10.5px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);text-align:right;padding:6px 8px;border-bottom:1px solid var(--line-strong)}
.me-cmp th:first-child,.me-cmp td:first-child{text-align:left}
.me-cmp td{padding:8px;border-bottom:1px solid var(--line);text-align:right;font:700 15px var(--mono)}
.me-cmp td:first-child{font:500 13.5px var(--sans,inherit)}
.me-cmp td small{display:block;font:400 11.5px var(--sans,inherit);color:var(--muted)}
`;
// Colores de las opciones: los de su partido (las personas, el del suyo).
const COLOR_OPCION = {"PP":"#2C7BC4","PSOE":"#D8342B","Alberto Núñez Feijóo":"#2C7BC4","Pedro Sánchez":"#D8342B","Santiago Abascal":"#5BA83A","Carlos Cuerpo":"#E07A73","Isabel Díaz Ayuso":"#7FB2E5","Yolanda Díaz":"#C92F72"};
const colorOp = (n, i) => COLOR_OPCION[n] || ["#8A8F98","#B98A16","#7B4BA8","#1FA8A0"][i % 4];
export async function pintarMercados(sec){
  estilos(); if (!document.getElementById("enc-css-me")){ const st = document.createElement("style"); st.id = "enc-css-me"; st.textContent = CSS_MERC; document.head.appendChild(st); }
  const [M, PR] = await Promise.all([pedir("datos/encuestas/mercados.json"), pedir("datos/encuestas/proyeccion.json")]);
  if (!M?.mercados?.length){ sec.innerHTML = `<p class="nota">No se han podido cargar los mercados.</p>`; return; }
  if (enVeda(M)){ sec.innerHTML = `<section class="sec" style="padding-top:8px">${avisoVeda()}</section>`; return; }
  const por = Object.fromEntries(M.mercados.map(m=>[m.tipo, m])), pc = p => p >= .995 ? "> 99 %" : p < .005 ? "< 1 %" : `${Math.round(p*100)} %`;
  const usd = n => `${fmt(n)} $`;
  const titular = {ganador: m=>`${m.opciones[0].nombre} gana las elecciones`, presidente: m=>`${m.opciones[0].nombre.split(" ").slice(-1)[0]}, próximo presidente`, fuera: m=>`Sánchez, fuera antes del ${m.opciones[0].nombre.replace(/ de 20\d\d$/, "")}`};
  const chispa = h => { if (!h || h.length < 2) return ""; const xs = h.map(x=>x[1]), W = 100, H = 34;
    const d = h.map(([,p],i)=>`${i?"L":"M"}${(i/(h.length-1)*W).toFixed(1)} ${(H - 2 - p*(H-4)).toFixed(1)}`).join("");
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="a" d="${d}L${W} ${H}L0 ${H}Z"/><path d="${d}"/></svg>`; };
  const orden = ["ganador","presidente","fuera"].filter(t=>por[t]);
  sec.innerHTML = `<section class="sec" style="padding-top:8px">
      <div class="sec-h"><h2>Lo que apuestan</h2><p>En Polymarket se apuesta dinero a lo que pasará; el precio de cada apuesta es la probabilidad que le da el mercado. No es una encuesta: es lo que creen, con dinero, quienes apuestan. Datos del ${esc(fLarga(M.actualizado))}.</p></div>
      <div class="me-top">${orden.map(t=>{ const m = por[t], o = m.opciones[0];
        return `<div class="me-k"><span class="q">${esc(m.pregunta)}</span><b>${pc(o.p)}</b><span class="r">${esc(titular[t](m))}</span>${chispa(o.hist)}<small>${usd(m.volumen)} apostados</small></div>`; }).join("")}</div></section>
    ${orden.map(t=>{ const m = por[t]; return `<section class="sec"><div class="sec-h"><h2>${esc(m.pregunta)}</h2><p>${t === "fuera" ? "Sánchez sigue en funciones hasta que el nuevo Congreso invista presidente: las Cortes se constituyen el 23 de diciembre y la investidura puede no llegar antes de Año Nuevo." : t === "presidente" ? "Quién sale investido después del 29N. Las opciones con menos del 0,5 % van juntas." : "El partido con más escaños el 29N."}</p></div>
      <div class="me-bl"><div class="chart"><div class="me-op" data-me-op="${t}"></div><p class="me-vol">${usd(m.volumen)} apostados desde el ${esc(fLarga(m.inicio))} · <a href="${esc(m.url)}">el mercado en Polymarket</a></p></div><div class="chart"><div data-me-g="${t}"></div></div></div></section>`; }).join("")}
    <section class="sec"><div class="sec-h"><h2>Las apuestas y la proyección</h2><p>Lo que dice el mercado al lado de lo que sale de nuestra <a href="/elecciones/proyeccion/">proyección</a> con la media de las encuestas.</p></div>
      <div class="chart"><table class="me-cmp"><thead><tr><th></th><th>Polymarket</th><th>Proyección</th></tr></thead><tbody id="me-cmp"></tbody></table>
      <p class="enc-nota">Las dos cosas no miden lo mismo: la proyección dice qué pasaría si se votara hoy como dicen las encuestas; el mercado apuesta por lo que pasará el 29N y después (pactos, investidura). Un mercado con poco dinero se mueve con pocas apuestas.</p></div></section>`;
  // Las opciones, en barras (las de menos del 0,5 %, juntas).
  orden.forEach(t=>{ const m = por[t], vis = m.opciones.filter(o=>o.p >= .005), resto = m.opciones.filter(o=>o.p < .005).reduce((s,o)=>s + o.p, 0);
    const filas = [...vis.map((o,i)=>({n:o.nombre, p:o.p, c:colorOp(o.nombre, i)})), ...(resto > 0 ? [{n:`Otros (${m.opciones.length - vis.length})`, p:resto, c:"var(--muted)"}] : [])];
    const el = sec.querySelector(`[data-me-op="${t}"]`);
    el.innerHTML = filas.map(f=>`<div class="me-o"><span class="n" title="${esc(f.n)}">${esc(f.n)}</span><span class="t"><i data-w="${(f.p*100).toFixed(1)}" style="background:${f.c}"></i></span><b>${pc(f.p)}</b></div>`).join("");
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll("i[data-w]").forEach(i=>i.style.width = i.dataset.w + "%")));
    lineas(sec.querySelector(`[data-me-g="${t}"]`), m.opciones.filter(o=>o.hist?.length > 1).slice(0, 4).map((o,i)=>({n: t === "fuera" ? "Sánchez fuera" : o.nombre, c: t === "fuera" ? "var(--ink)" : colorOp(o.nombre, i), h:o.hist}))); });
  // Comparación con la proyección.
  if (PR){ const S = PR.simulacion, filas = [];
    if (por.ganador){ const pp = por.ganador.opciones.find(o=>o.nombre === "PP"); if (pp) filas.push(["El PP saca más escaños que nadie", pp.p, S.primero.PP || 0]); }
    if (por.presidente){ const f = por.presidente.opciones.find(o=>/Feijóo/.test(o.nombre)); if (f) filas.push(["Feijóo, presidente <small>en la proyección: PP y Vox suman 176</small>", f.p, S.bloques["PP + Vox"].p176]); }
    if (por.presidente){ const s = por.presidente.opciones.find(o=>/Sánchez/.test(o.nombre)); if (s) filas.push(["Sánchez, presidente <small>en la proyección: él y sus socios de 2023 suman 176</small>", s.p, S.bloques["PSOE y sus socios de 2023"].p176]); }
    sec.querySelector("#me-cmp").innerHTML = filas.map(([t,a,b])=>`<tr><td>${t}</td><td>${pc(a)}</td><td>${pc(b)}</td></tr>`).join(""); }
}
/* La probabilidad de cada opción, día a día (0-100 %), con la disolución marcada. */
function lineas(caja, series){
  if (!caja || !series.length){ if (caja) caja.innerHTML = `<p class="nota">Aún no hay historia.</p>`; return; }
  const W = Math.max(300, caja.clientWidth || 600), H = 240, m = {l: 36, r: 92, t: 18, b: 24};
  const fechas = series.flatMap(s=>s.h.map(x=>x[0])).sort(), ini = fechas[0], fin = fechas[fechas.length-1];
  const t0 = dias(ini), t1 = Math.max(dias(fin), t0 + 1), X = iso => m.l + (dias(iso) - t0)/(t1 - t0)*(W - m.l - m.r), Y = p => m.t + (1 - p)*(H - m.t - m.b);
  const finales = series.map(s=>({n:s.n, c:s.c, p:s.h[s.h.length-1][1], y:Y(s.h[s.h.length-1][1]) + 4})).sort((a,b)=>a.y - b.y);
  for (let i = 1; i < finales.length; i++) finales[i].y = Math.max(finales[i].y, finales[i-1].y + 14);
  const corto = n => n.length > 14 ? n.split(" ").slice(-1)[0] : n;
  const meses = []; { let [y, mo] = ini.split("-").map(Number); mo++; if (mo > 12){ mo = 1; y++; } while (`${y}-${String(mo).padStart(2,"0")}-01` <= fin){ meses.push(`${y}-${String(mo).padStart(2,"0")}-01`); mo++; if (mo > 12){ mo = 1; y++; } } }
  const salto = Math.ceil(meses.length / 6);
  const dis = "2026-10-06";
  caja.innerHTML = `<svg class="me-g" viewBox="0 0 ${W} ${H}" role="img" aria-label="Probabilidad de cada opción, día a día">
    <g class="ejes">${[0,.25,.5,.75,1].map(p=>`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(p)}" y2="${Y(p)}"/><text x="${m.l - 6}" y="${Y(p) + 4}" text-anchor="end">${p*100} %</text>`).join("")}${meses.filter((d,i)=>i % salto === 0).map(d=>`<text x="${X(d).toFixed(1)}" y="${H - 6}" text-anchor="middle">${MESES[+d.slice(5,7)-1]}</text>`).join("")}</g>
    ${dis > ini && dis <= fin ? `<g class="hito"><line x1="${X(dis)}" x2="${X(dis)}" y1="${m.t}" y2="${H - m.b}"/><text x="${X(dis) - 4}" y="${m.t + 10}" text-anchor="end">Disolución</text></g>` : ""}
    ${series.map(s=>`<path class="l" d="${s.h.map(([d,p],i)=>`${i?"L":"M"}${X(d).toFixed(1)} ${Y(p).toFixed(1)}`).join("")}" stroke="${s.c}"/>`).join("")}
    <g class="fin">${finales.map(f=>`<text x="${W - m.r + 6}" y="${f.y.toFixed(1)}" fill="${f.c}">${esc(corto(f.n))} ${Math.round(f.p*100)} %</text>`).join("")}</g><line class="cruz" y1="${m.t}" y2="${H - m.b}"/></svg>`;
  const svg = caja.querySelector("svg"), cruz = svg.querySelector(".cruz");
  svg.onmousemove = ev => { const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left)/r.width*W, t = t0 + (x - m.l)/(W - m.l - m.r)*(t1 - t0);
    const filas = series.map(s=>{ let best = s.h[0]; s.h.forEach(p=>{ if (Math.abs(dias(p[0]) - t) < Math.abs(dias(best[0]) - t)) best = p; }); return [s, best]; });
    const dia = filas[0][1][0]; cruz.setAttribute("x1", X(dia)); cruz.setAttribute("x2", X(dia)); cruz.style.opacity = .5;
    tip(`<b>${esc(fLarga(dia))}</b>${filas.map(([s,p])=>filaTip(s.c, s.n, `${Math.round(p[1]*100)} %`)).join("")}`, ev); };
  svg.onmouseleave = () => { cruz.style.opacity = 0; tip(""); };
}

/* =====================================================================================================
   CUÁNTO ACERTARON: las encuestas de 2015 a 2023 frente al resultado (escano/aciertos.py → aciertos.json)
   ===================================================================================================== */
const COLOR_LIN = {PP:"#2C7BC4", PSOE:"#D8342B", VOX:"#5BA83A", IZQ:"#7B4BA8", CS:"#EB6109", IU:"#A4243B", ERC:"#E0A410", JUNTS:"#1FA8A0", PNV:"#2F7A4A", BILDU:"#86A832", MP:"#2FA77A", BNG:"#6FB2DE", UPYD:"#E0388C"};
const NOMBRE_LIN = {PP:"PP", PSOE:"PSOE", VOX:"Vox", IZQ:"Podemos / Sumar", CS:"Ciudadanos", IU:"IU", ERC:"ERC"};
const CSS_AC = `
.ac-top{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
.ac-k{all:unset;cursor:pointer;display:grid;gap:3px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);transition:border-color .2s}
.ac-k:hover{border-color:var(--line-strong)}.ac-k[aria-pressed="true"]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.ac-k .e{font:600 11px var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.ac-k b{font:800 26px/1.05 var(--led,var(--display))}
.ac-k span{font-size:12.5px;color:var(--muted);line-height:1.3}.ac-k span em{font-style:normal;color:var(--ink);font-weight:600}
.ac-k:focus-visible{outline:2px solid var(--no);outline-offset:2px}
svg.ac-g{display:block;width:100%;height:auto;overflow:visible}
svg.ac-g .eje line{stroke:var(--line);stroke-dasharray:2 4}
svg.ac-g .eje text{font:10.5px var(--mono);fill:var(--muted)}
svg.ac-g .n{font:600 12.5px var(--sans,inherit);fill:var(--ink)}
svg.ac-g .enc{opacity:.35}
svg.ac-g .med{fill:var(--surface);stroke-width:2.2}
svg.ac-g .dif{font:700 12px var(--mono)}
.ac-ley{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--muted);margin-top:6px}
.ac-ley span{display:inline-flex;align-items:center;gap:6px}
.ac-ley i{width:10px;height:10px;border-radius:50%;display:inline-block}
.ac-mat{border-collapse:separate;border-spacing:3px;font-size:12.5px;width:100%}
.ac-mat th{font:600 11px var(--mono);color:var(--muted);padding:4px;text-align:center}
.ac-mat th:first-child{text-align:left}
.ac-mat td{text-align:center;padding:8px 4px;border-radius:6px;font:700 12.5px var(--mono)}
.ac-mat td:first-child{text-align:left;font:600 12.5px var(--sans,inherit);background:none}
.ac-mat td.v{color:var(--ink)}
.ac-rk{width:100%;border-collapse:collapse;font-size:13px}
.ac-rk th{font:600 10.5px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);text-align:right;padding:6px;border-bottom:1px solid var(--line-strong);white-space:nowrap}
.ac-rk th:first-child,.ac-rk td:first-child{text-align:left}
.ac-rk td{padding:6px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}
.ac-rk td b{font:700 13px var(--mono)}
.ac-rk .pts{display:inline-flex;gap:3px}
.ac-rk .pts i{display:inline-block;min-width:34px;padding:2px 4px;border-radius:5px;font:600 11px var(--mono);font-style:normal;text-align:center}
.ac-rk .ag{font:600 10px var(--mono);color:var(--muted);border:1px solid var(--line-strong);border-radius:999px;padding:0 6px;margin-left:6px}
.ac-esc{width:100%;border-collapse:collapse;font-size:13px}
.ac-esc th{font:600 10.5px var(--mono);text-transform:uppercase;color:var(--muted);text-align:right;padding:6px;border-bottom:1px solid var(--line-strong)}
.ac-esc th:first-child,.ac-esc td:first-child{text-align:left}
.ac-esc td{padding:7px 6px;border-bottom:1px solid var(--line);text-align:right;font:700 13.5px var(--mono)}
.ac-esc td:first-child{font:500 13px var(--sans,inherit)}
.ac-esc td small{font:500 11px var(--mono);margin-left:4px}
.ac-esc .base td{background:var(--sunk)}
.ac-esc .si{color:var(--si)}.ac-esc .no{color:var(--no)}
`;
export async function pintarAcierto(sec){
  estilos(); if (!document.getElementById("enc-css-ac")){ const st = document.createElement("style"); st.id = "enc-css-ac"; st.textContent = CSS_AC; document.head.appendChild(st); }
  let [A, PR] = await Promise.all([pedir("datos/encuestas/aciertos.json"), pedir("datos/encuestas/proyeccion.json")]);
  if (!A?.elecciones?.length){ sec.innerHTML = `<p class="nota">No se ha podido cargar el análisis.</p>`; return; }
  if (enVeda(null)) PR = null;   // en la veda, lo de 2015-2023 se puede ver; la proyección de hoy (hecha con encuestas de ahora), no
  const E = A.elecciones, nomL = (el, p) => el.rotulos?.[p] && p === "IZQ" ? el.rotulos[p].replace("Unidas", "Unidas").replace("Unidos", "Unidos") : (NOMBRE_LIN[p] || p);
  const colL = (p, el) => p === "IZQ" && el?.id === "202307" ? "#C92F72" : (COLOR_LIN[p] || "#888"), d1 = x => (x > 0 ? "+" : x < 0 ? "−" : "±") + dec(Math.abs(x));
  const peor = el => Object.entries(el.media_dif).sort((a,b)=>Math.abs(b[1]) - Math.abs(a[1]))[0];
  const errMedio = E.reduce((s,el)=>s + el.media_mae, 0)/E.length;
  let sel = 0;
  sec.innerHTML = `<section class="sec" style="padding-top:8px">
      <div class="sec-h"><h2>¿Aciertan las encuestas?</h2><p>En las cinco últimas generales, la media de las encuestas de las tres semanas anteriores se equivocó, de media, en <b>${dec(errMedio)} puntos</b> por partido. Pero no siempre con los mismos ni hacia el mismo lado.</p></div>
      <div class="ac-top">${E.map((el,i)=>{ const [p, d] = peor(el); return `<button type="button" class="ac-k" data-ac="${i}" aria-pressed="${i===0}"><span class="e">${esc(el.nombre)}</span><b>${dec(el.media_mae)} pt</b><span>de error medio · el mayor, <em>${esc(nomL(el, p))} ${d1(d)}</em></span></button>`; }).join("")}</div></section>
    <section class="sec"><div class="sec-h"><h2 id="ac-t"></h2><p>Cada fila, un partido: el círculo hueco es la media de las encuestas; el lleno, lo que votó la gente; los puntos claros, la última encuesta de cada empresa.</p></div>
      <div class="chart"><div id="ac-g"></div><div class="ac-ley"><span><i style="border:2px solid var(--ink)"></i>media de las encuestas</span><span><i style="background:var(--ink)"></i>resultado</span><span><i style="background:var(--ink);opacity:.35;width:7px;height:7px"></i>cada encuesta</span></div></div></section>
    <section class="sec"><div class="sec-h"><h2>Hacia dónde fallan</h2><p>Puntos de más (sobrestimado) o de menos (infravalorado) que la media de las encuestas le dio a cada partido.</p></div>
      <div class="chart" style="overflow-x:auto"><table class="ac-mat" id="ac-mat"></table></div></section>
    <section class="sec"><div class="sec-h"><h2>Las encuestadoras</h2><p>El error medio de la última encuesta de cada empresa (en puntos por partido), en las generales en que publicó. Arriba, las que estuvieron en más elecciones y más acertaron.</p></div>
      <div class="chart" style="overflow-x:auto"><table class="ac-rk" id="ac-rk"></table></div></section>
    ${A.escenarios && PR ? `<section class="sec"><div class="sec-h"><h2>Si fallan como entonces</h2><p>La <a href="/elecciones/proyeccion/">proyección</a> de hoy, corrigiendo la media con el error que tuvo cada vez en el PP, el PSOE, Vox y la izquierda de Sumar y Podemos.</p></div>
      <div class="chart" style="overflow-x:auto"><table class="ac-esc" id="ac-esc"></table></div></section>` : ""}
    <p class="enc-nota">Las encuestas, de las tablas de Wikipedia de cada elección: de cada empresa, la última publicada en las tres semanas anteriores (sin los sondeos a pie de urna). El error es la media de la diferencia, en puntos, en los partidos que pasaron del 2,5 %. La media se hace como la de hoy: sin el CIS ni KeyData. El código está en <a href="https://github.com/jorgegarcelan/escano-abierto/blob/main/escano/aciertos.py">aciertos.py</a>.</p>`;
  // Una elección: media frente a resultado, con cada encuesta.
  function eleccion(i){
    sel = i; const el = E[i], caja = sec.querySelector("#ac-g");
    sec.querySelectorAll("[data-ac]").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.ac === i)));
    const [p0, d0] = peor(el); sec.querySelector("#ac-t").textContent = `${el.nombre}: ${nomL(el, p0)}, ${d0 > 0 ? "sobrestimado" : "infravalorado"} en ${dec(Math.abs(d0))} puntos`;
    const ps = el.partidos, W = Math.max(320, caja.clientWidth || 700), fila = 44, H = ps.length*fila + 34, m = {l: W < 520 ? 92 : 130, r: 56, t: 10, b: 24};
    const todos = ps.flatMap(p=>[el.resultado[p], el.media[p], ...el.encuestas.map(e=>e.v[p]).filter(v=>v != null)]), hi = Math.ceil((Math.max(...todos) + 2)/5)*5;
    const X = v => m.l + v/hi*(W - m.l - m.r), Y = k => m.t + k*fila + fila/2;
    const ticks = []; for (let v = 0; v <= hi; v += hi > 30 ? 10 : 5) ticks.push(v);
    caja.innerHTML = `<svg class="ac-g" viewBox="0 0 ${W} ${H}" role="img" aria-label="Media de las encuestas y resultado de ${esc(el.nombre)}">
      <g class="eje">${ticks.map(v=>`<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H - m.b}"/><text x="${X(v)}" y="${H - 6}" text-anchor="middle">${v} %</text>`).join("")}</g>
      ${ps.map((p,k)=>{ const y = Y(k), c = colL(p, el), r = el.resultado[p], md = el.media[p], d = md - r;
        return `<g data-tip="${esc(`<b>${esc(nomL(el, p))}</b><br>Media de las encuestas: ${dec(md)} %<br>Resultado: ${dec(r)} %<br>${d > 0 ? "Sobrestimado" : "Infravalorado"} en ${dec(Math.abs(d))} puntos`)}">
          <text class="n" x="${m.l - 10}" y="${y + 4}" text-anchor="end">${esc(nomL(el, p))}</text>
          ${el.encuestas.filter(e=>e.v[p] != null).map(e=>`<circle class="enc" cx="${X(e.v[p]).toFixed(1)}" cy="${(y + ((e.empresa.length*7) % 11) - 5).toFixed(1)}" r="3" fill="${c}"/>`).join("")}
          <line x1="${X(Math.min(r, md))}" x2="${X(Math.max(r, md))}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="3" opacity=".5"/>
          <circle cx="${X(r)}" cy="${y}" r="6.5" fill="${c}"/><circle class="med" cx="${X(md)}" cy="${y}" r="6" stroke="${c}"/>
          <text class="dif" x="${W - m.r + 8}" y="${y + 4}" fill="${Math.abs(d) >= 2 ? "var(--no)" : "var(--muted)"}">${d1(d)}</text></g>`; }).join("")}</svg>`;
  }
  eleccion(0);
  // La matriz de errores: partidos de siempre × elecciones.
  { const lins = ["PP","PSOE","VOX","IZQ","CS"], max = 5;
    const fondo = d => { const a = Math.min(1, Math.abs(d)/max); return d > 0 ? `color-mix(in srgb,#D8342B ${Math.round(a*60)}%,var(--surface))` : `color-mix(in srgb,#2C7BC4 ${Math.round(a*60)}%,var(--surface))`; };
    sec.querySelector("#ac-mat").innerHTML = `<thead><tr><th></th>${E.map(el=>`<th>${esc(el.nombre)}</th>`).join("")}</tr></thead><tbody>${lins.map(p=>`<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${colL(p)};margin-right:6px"></span>${esc(NOMBRE_LIN[p])}</td>${E.map(el=>{ const d = el.media_dif[p]; return d == null ? `<td style="color:var(--muted)">–</td>` : `<td class="v" style="background:${fondo(d)}" title="${esc(nomL(el, p))}">${d1(d)}</td>`; }).join("")}</tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="${E.length + 1}" class="enc-nota" style="text-align:left;font:400 12px var(--sans,inherit);padding-top:8px">En rojo, sobrestimado (las encuestas le daban más); en azul, infravalorado.</td></tr></tfoot>`; }
  // Las encuestadoras.
  { const colE = x => x == null ? "var(--sunk)" : `color-mix(in srgb,${x < 1.5 ? "var(--si)" : x < 2.5 ? "#E0A410" : "var(--no)"} 28%,var(--surface))`;
    const R = A.ranking.filter(r=>r.n >= 2);
    sec.querySelector("#ac-rk").innerHTML = `<thead><tr><th>Empresa</th><th>Elecciones</th><th>Error medio</th><th>${E.map(el=>esc(el.nombre.split(" ")[0])).join(" · ")}</th></tr></thead><tbody>${R.map(r=>`<tr><td><b>${esc(r.empresa)}</b>${r.empresa === "KeyData" ? `<span class="ag" title="Es una media de encuestas">media</span>` : ""}</td><td>${r.n}</td><td><b>${dec(r.mae)}</b></td>
      <td><span class="pts">${E.map(el=>{ const x = r.elecciones.find(y=>y.id === el.id)?.mae; return `<i style="background:${colE(x)}" title="${esc(el.nombre)}">${x == null ? "–" : dec(x)}</i>`; }).join("")}</span></td></tr>`).join("")}</tbody>`; }
  // Si fallan como entonces.
  if (A.escenarios && PR){ const C = PR.central, base = {PP: C.PP||0, PSOE: C.PSOE||0, VOX: C.VOX||0, ppvox: (C.PP||0) + (C.VOX||0)};
    const celda = (v, b) => `${v}${v !== b ? `<small class="${v > b ? "si" : "no"}">${v > b ? "+" : "−"}${Math.abs(v - b)}</small>` : ""}`;
    sec.querySelector("#ac-esc").innerHTML = `<thead><tr><th></th><th>PP</th><th>PSOE</th><th>Vox</th><th>PP + Vox</th></tr></thead><tbody>
      <tr class="base"><td>La proyección de hoy</td><td>${base.PP}</td><td>${base.PSOE}</td><td>${base.VOX}</td><td>${base.ppvox}</td></tr>
      ${E.map(el=>{ const s = A.escenarios[el.id]; if (!s) return ""; const e2 = s.escanos;
        return `<tr><td>Si fallan como en ${esc(el.nombre)}</td><td>${celda(e2.PP||0, base.PP)}</td><td>${celda(e2.PSOE||0, base.PSOE)}</td><td>${celda(e2.VOX||0, base.VOX)}</td><td>${celda(s.ppvox, base.ppvox)}</td></tr>`; }).join("")}</tbody>`; }
  sec.addEventListener("click", ev=>{ const b = ev.target.closest("[data-ac]"); if (b) eleccion(+b.dataset.ac); });
}
