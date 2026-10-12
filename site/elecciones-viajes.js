/* «Lo que caduca», la parte interactiva: el viaje de cada ley de la XV legislatura.
   - El embudo: de las presentadas a las que acabaron en ley, y dónde se quedó cada una (caducan, rechazadas,
     retiradas…). Pulsar un tramo ilumina esas leyes en la guillotina y las lista.
   - La guillotina: cada ley es un punto que entra el día que se presentó y avanza por las etapas; se reproduce
     la legislatura entera y el día de la disolución lo que seguía en trámite cae.
   - La ficha: al pasar por un punto (o por una ley de la lista), su viaje con fechas; al pulsar, se queda fija.
   Los datos salen de escano/elecciones.py (viajes): datos/elecciones/viajes.json. */

const COLUMNAS = ["Presentadas", "Admitidas a debate", "Informe en comisión", "Aprobadas en el Congreso", "Pasaron por el Senado", "Leyes"];
const CORTAS = ["Presentadas", "Admitidas", "Informe", "Congreso", "Senado", "Leyes", "Fuera"];   // si las columnas son estrechas
const MINIS = ["Registro", "Admit.", "Informe", "Congr.", "Senado", "Leyes", "Fuera"];             // en el móvil
const ETAPA_DE = ["presentada", "admitida a debate", "con informe en comisión", "aprobada en el Congreso", "de vuelta del Senado", "ley"];
const DESTINOS = [
  ["sigue", "Siguen adelante", "color-mix(in srgb,var(--ink) 22%,var(--surface))"],
  ["caduca", "Caducan", "var(--no,#C8473B)"],
  ["rechazada", "Rechazadas", "#C9873E"],
  ["retirada", "Retiradas", "#8A8F98"],
  ["decaída", "Decaídas", "#B3AFA4"],
  ["otra", "Subsumidas o inadmitidas", "#6B7079"],
  ["aprobada", "Leyes", "var(--si,#3C8C6A)"],
  ["pendiente", "Aprobadas, pendientes del BOE", "color-mix(in srgb,var(--si,#3C8C6A) 55%,var(--surface))"],
];
const DESTINO = Object.fromEntries(DESTINOS.map(d=>[d[0], d]));
const CSS = `
#vj-sankey{min-width:0;max-width:100%}
.vj-sankey{overflow-x:auto;scrollbar-width:thin;max-width:100%}
.vj-sankey svg{display:block;width:100%;min-width:760px;height:auto}
.vj-sankey .enlaces path{fill-opacity:.32;transition:fill-opacity .2s;cursor:pointer}
.vj-sankey .enlaces path:hover{fill-opacity:.55}
.vj-sankey rect{cursor:pointer}
.vj-sankey svg.filtrado .enlaces path{fill-opacity:.09}
.vj-sankey .rastro path{fill-opacity:.78;cursor:pointer}
.vj-sankey svg.dibujando [data-n]:not(.visto){opacity:0}
.vj-sankey [data-n]{transition:opacity .35s}
.vj-sankey svg.filtrado rect.off{opacity:.3}
.vj-sankey svg.filtrado text.off{opacity:.45}
.vj-sankey svg.filtrado text:not(.off) .v{fill:var(--ink);font-weight:700}
.vj-sankey text{font:12px var(--sans);fill:var(--ink);pointer-events:none}
.vj-sankey text .t{font-weight:600}
.vj-sankey text .v{fill:var(--muted);font-family:var(--mono);font-size:11px}
.vj-tip{position:fixed;z-index:65;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:7px 10px;font-size:12.5px;line-height:1.4;max-width:280px}
.vj-tip[hidden]{display:none}
.vj-sel{margin-top:10px;border-top:1px solid var(--line);padding-top:10px}
.vj-sel h4{margin:0 0 4px;font-size:14px}
.vj-sel ul{list-style:none;margin:0;padding:0;display:grid;gap:2px;max-height:320px;overflow:auto}
.vj-sel li button{all:unset;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;font-size:13px;padding:4px 6px;border-radius:6px;width:calc(100% - 12px)}
.vj-sel li button:hover{background:var(--sunk)}
.vj-sel li .m{font:11.5px var(--mono);color:var(--muted)}
.vj-guillo{position:relative}
.vj-guillo svg{display:block;width:100%;height:auto;overflow:visible}
.vj-guillo .col-t{font:600 11px var(--sans);fill:var(--muted)}
@media (max-width:640px){ .vj-guillo .col-t{font-size:9.5px} .vj-guillo .col-n{font-size:12px} }
.vj-guillo .col-n{font:700 15px var(--mono);fill:var(--ink)}
.vj-guillo .cad-band{fill:color-mix(in srgb,var(--no,#C8473B) 9%,transparent)}
.vj-guillo .cad-t{font:600 11px var(--mono);fill:var(--no,#C8473B);letter-spacing:.06em}
.vj-guillo circle{cursor:pointer;transition:opacity .25s}
.vj-guillo.filtrado circle:not(.on){opacity:.12}
.vj-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:8px}
.vj-ctl .btn{padding:6px 14px}
.vj-ctl input[type=range]{flex:1;min-width:160px;accent-color:var(--ink)}
.vj-fecha{font:600 14px var(--mono);min-width:13ch}
.vj-aviso{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);width:max-content;max-width:92%;background:var(--surface);border:1px solid var(--no,#C8473B);color:var(--ink);border-radius:12px;padding:12px 18px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.25);pointer-events:none;opacity:0;transition:opacity .4s}
.vj-aviso.si{opacity:1}
.vj-aviso b{display:block;font-size:17px}.vj-aviso small{color:var(--muted)}
.vj-ficha{position:fixed;z-index:70;width:min(360px,calc(100vw - 24px));background:var(--surface);color:var(--ink);border:1px solid var(--line-strong);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.28);padding:12px 14px;font-size:13px;line-height:1.4}
.vj-ficha[hidden]{display:none}
.vj-ficha .t{font-weight:600;font-size:14px;line-height:1.3;padding-right:18px}
.vj-ficha .s{color:var(--muted);font-size:12px;margin-top:3px}
.vj-ficha ol{list-style:none;margin:10px 0 0;padding:0 0 0 14px;border-left:2px solid var(--line);display:grid;gap:5px}
.vj-ficha li{position:relative;font-size:12.5px}
.vj-ficha li::before{content:"";position:absolute;left:-20px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--surface);border:2px solid var(--line-strong)}
.vj-ficha li.ok::before{background:var(--ink);border-color:var(--ink)}
.vj-ficha li.fin::before{background:var(--c);border-color:var(--c)}
.vj-ficha li small{color:var(--muted);font-family:var(--mono)}
.vj-ficha .x{all:unset;position:absolute;right:10px;top:8px;cursor:pointer;color:var(--muted);font-size:16px}
.vj-ficha .ir{margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}

`;
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MESES_L = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const corta = iso => { if (!iso) return ""; const [y,m,d] = iso.split("-").map(Number); return `${d} ${MESES[m-1]} ${y}`; };
const larga = iso => { const [y,m,d] = iso.split("-").map(Number); return `${d} de ${MESES_L[m-1]} de ${y}`; };
const dia = iso => { const [y,m,d] = iso.split("-").map(Number); return Date.UTC(y,m-1,d)/864e5; };
const deDia = n => new Date(n*864e5).toISOString().slice(0,10);
const miles = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

let V = null, cargando = null;
const cargar = () => cargando ||= fetch("datos/elecciones/viajes.json").then(r=>r.ok?r.json():null).catch(()=>null).then(j=>V=j);
function estilos(){ if (document.getElementById("vj-css")) return; const s = document.createElement("style"); s.id = "vj-css"; s.textContent = CSS; document.head.appendChild(s); }

/* Cada ley: hasta qué etapa llegó, cómo acabó y dónde está en un día dado. */
function preparar(ctx, colorOrigen){
  return V.leyes.map((x,i)=>{
    const [exp, titulo, tipo, origen, autores, comision, presentada, fechas, estado, fin, ampl] = x;
    const etapa = fechas.reduce((k,d,j)=>d ? j+1 : k, 0);
    const destino = estado === "en trámite" ? "pendiente" : ["subsumida","inadmitida"].includes(estado) ? "otra" : estado;
    return {i, exp, titulo, tipo, origen, autores, comision, presentada, fechas, estado, fin, ampl, etapa, destino,
      color: colorOrigen[origen] || "var(--line-strong)", d0: dia(presentada), dfin: fin ? dia(fin) : Infinity, de: fechas.map(d=>d ? dia(d) : Infinity)};
  });
}
// Dónde está una ley el día t: null si aún no se ha presentado; {col, cae} si no.
function lugar(L, t, tDis){
  if (t < L.d0) return null;
  let col = 0; L.de.forEach((d,j)=>{ if (d <= t) col = j+1; });
  if (L.destino === "caduca") return t >= tDis ? {col, cae:true} : {col};
  if (L.destino !== "aprobada" && L.destino !== "pendiente" && t >= L.dfin) return {col:6};   // fuera del camino
  return {col};
}

export async function montarViajes(raiz, ctx, colorOrigen){
  estilos();
  const cajaE = raiz.querySelector("#vj-sankey"), cajaG = raiz.querySelector("#vj-guillotina");
  if (!cajaE && !cajaG) return;
  await cargar();
  if (!V){ [cajaE, cajaG].forEach(c=>{ if (c) c.innerHTML = `<p class="nota">No se han podido cargar los viajes de las leyes.</p>`; }); return; }
  const L = preparar(ctx, colorOrigen), POR_EXP = Object.fromEntries(L.map(l=>[l.exp, l]));
  const ficha = crearFicha(ctx);
  const guillo = cajaG ? guillotina(cajaG, L, ficha) : null;
  if (cajaE) sankey(cajaE, L, ctx, colorOrigen, ficha, f=>guillo?.filtrar(f));   // pulsar un nodo ilumina sus leyes en la guillotina
  // La ficha también en las listas de leyes del apartado (las que llevan data-ini).
  raiz.addEventListener("mouseover", ev=>{ const b = ev.target.closest(".el-lista [data-ini], .cad-cards [data-ini], .cad-hielos [data-ini], .cad-filas [data-ini]"); if (b && POR_EXP[b.dataset.ini] && !ficha.fija()) ficha.mostrar(POR_EXP[b.dataset.ini], b); });
  raiz.addEventListener("mouseout", ev=>{ const b = ev.target.closest(".el-lista [data-ini], .cad-cards [data-ini], .cad-hielos [data-ini], .cad-filas [data-ini]"); if (b && !ficha.fija()) ficha.ocultar(); });
}

/* ---------- el sankey: de quién presentó cada ley a dónde acabó ---------- */
// Las salidas de cada etapa se agrupan en tres: caducan, rechazadas y retiradas o decaídas (con las subsumidas e inadmitidas).
const SALIDAS = [
  ["caduca", "Caducan", ["caduca"], "var(--no,#C8473B)"],
  ["rechazada", "Rechazadas", ["rechazada"], "#C9873E"],
  ["fuera", "Retiradas o decaídas", ["retirada","decaída","otra"], "#8A8F98"],
  ["pendiente", "Aprobadas, pendientes del BOE", ["pendiente"], "color-mix(in srgb,var(--si,#3C8C6A) 55%,var(--surface))"],
];
// Quién presentó cada ley, para la primera columna: el Gobierno, cada grupo (las firmadas por varios, juntas),
// el Senado y los parlamentos autonómicos. Cada ley, una sola vez.
const NOMBRE_ORIGEN_V = {GOB:"Gobierno", SEN:"Senado", CCAA:"Parlamentos autonómicos", VARIOS:"Varios grupos", MIXTO:"Grupo Mixto", SUMAR:"Sumar", VOX:"Vox", BILDU:"EH Bildu", JUNTS:"Junts"};
const quienPresento = l => ["GOB","SEN","CCAA"].includes(l.origen) ? l.origen : l.autores.length === 1 ? l.autores[0] : "VARIOS";
function sankey(caja, L, ctx, colorOrigen, ficha, alElegir){
  const NS = "http://www.w3.org/2000/svg", T = L.length, pct = n => (n/T*100).toLocaleString("es-ES", {maximumFractionDigits: n/T < .01 ? 1 : 0}) + " %";
  // Nodos por columna: 0, los orígenes; 1, presentadas; 2…6, el tronco de cada etapa y, debajo, las salidas de la anterior.
  const cuenta = {}; L.forEach(l=>{ const q = quienPresento(l); cuenta[q] = (cuenta[q]||0) + 1; });
  const grupos = Object.keys(cuenta).filter(q=>!["GOB","SEN","CCAA","VARIOS"].includes(q)).sort((a,b)=>cuenta[b]-cuenta[a]);
  const colorDe = q => q === "VARIOS" ? "#A7A9AE" : ctx.G?.[q]?.color || colorOrigen[q] || "var(--line-strong)";
  const origenes = ["GOB", ...grupos, "VARIOS", "SEN", "CCAA"].filter(q=>cuenta[q])
    .map(q=>({id:"o-"+q, col:0, n:cuenta[q], nombre:NOMBRE_ORIGEN_V[q] || q, color:colorDe(q), filtro:{quien:q}, linea:true, de:l=>quienPresento(l)===q}));
  const tronco = COLUMNAS.map((t,k)=>({id:"e-"+k, col:k+1, n:L.filter(l=>l.etapa>=k).length, nombre:t, color: k===5 ? "var(--si,#3C8C6A)" : "#7C8089", tronco:true, k, de:l=>l.etapa>=k, filtro:{minimo:k}}));
  const salidas = [];
  for (let k = 0; k < 5; k++) SALIDAS.forEach(([id, nombre, ds, color])=>{ const n = L.filter(l=>l.etapa===k && ds.includes(l.destino)).length;
    if (n) salidas.push({id:`s-${k}-${id}`, col:k+2, n, nombre, color, desde:k, filtro:{etapa:k, destinos:ds}, de:l=>l.etapa===k && ds.includes(l.destino)}); });
  const nodos = [...origenes, ...tronco, ...salidas];
  // Medidas.
  const W = Math.max(760, caja.clientWidth || 900), H = W < 900 ? 500 : 540, nodoW = 12, top = 46, gap = 14, gapO = 7;
  const k = (H - top - 10 - gapO*(origenes.length-1)) / T;
  const xCol = c => c * (W - nodoW - 150) / 6, ancho = (W - nodoW - 150) / 6;
  if (ancho < 175) tronco.forEach((n,k)=>{ n.nombre = CORTAS[k]; });
  const porCol = {}; nodos.forEach(n=>(porCol[n.col] ||= []).push(n));
  Object.values(porCol).forEach(ns=>{ let y = top; ns.forEach(n=>{ n.x = xCol(n.col); n.y = y; n.h = Math.max(1.5, n.n*k); y += n.h + (n.col === 0 ? gapO : gap); }); });
  // Enlaces: orígenes → presentadas; cada tronco → el siguiente tronco y sus salidas.
  const enlaces = [];
  origenes.forEach(o=>enlaces.push({a:o, b:tronco[0], n:o.n, color:o.color, filtro:o.filtro, de:o.de, origen:true}));
  for (let e = 0; e < 5; e++){
    enlaces.push({a:tronco[e], b:tronco[e+1], n:tronco[e+1].n, color:"#7C8089", de:tronco[e+1].de});
    salidas.filter(s=>s.desde===e).forEach(s=>enlaces.push({a:tronco[e], b:s, n:s.n, color:s.color, filtro:s.filtro, de:s.de}));
  }
  const salida = {}, entrada = {};   // dónde va por dentro de cada nodo el siguiente enlace (para apilarlos sin cruzarse)
  enlaces.forEach(e=>{ const y1 = e.a.y + (salida[e.a.id] || 0), y2 = e.b.y + (entrada[e.b.id] || 0), h = e.n*k;
    salida[e.a.id] = (salida[e.a.id] || 0) + h; entrada[e.b.id] = (entrada[e.b.id] || 0) + h;
    const x1 = e.a.x + nodoW, x2 = e.b.x, xm = (x1 + x2)/2;
    e.tramo = (o, h2) => { const a = y1 + o, b = y2 + o; return `M${x1} ${a}C${xm} ${a} ${xm} ${b} ${x2} ${b}L${x2} ${b+h2}C${xm} ${b+h2} ${xm} ${a+h2} ${x1} ${a+h2}Z`; };
    e.banda = h2 => e.tramo(0, h2);
    e.d = e.banda(h); });
  // Rótulos: el tronco, encima; orígenes y salidas, a la derecha (empujando hacia abajo si se pisan).
  const rot = [];
  nodos.forEach(n=>{ if (n.tronco) rot.push({n, x:n.x, y:n.y - 22, ancla:"start", arriba:true}); else rot.push({n, x:n.x + nodoW + 6, y:n.y + n.h/2 + 4, ancla:"start"}); });
  const laterales = rot.filter(r=>!r.arriba).sort((a,b)=>a.n.col-b.n.col || a.y-b.y);
  laterales.forEach((r,i)=>{ const prev = laterales[i-1], min = r.n.linea ? 15 : 26; if (prev && prev.n.col === r.n.col && r.y - prev.y < min) r.y = prev.y + min; });
  caja.innerHTML = `<div class="vj-sankey"><svg viewBox="0 0 ${W} ${H + 20}" role="img" aria-label="De dónde vino y dónde acabó cada proyecto y proposición de ley de la legislatura">
      <defs><clipPath id="vj-c-base"><rect x="-2" y="0" width="${W + 4}" height="${H + 20}"/></clipPath><clipPath id="vj-c-rastro"><rect x="-2" y="0" width="${W + 4}" height="${H + 20}"/></clipPath></defs>
      <g class="enlaces" clip-path="url(#vj-c-base)">${enlaces.map((e,i)=>`<path d="${e.d}" fill="${e.color}" data-e="${i}"/>`).join("")}</g>
      <g class="rastro" clip-path="url(#vj-c-rastro)"></g>
      <g class="nodos">${nodos.map(n=>`<rect x="${n.x}" y="${n.y}" width="${nodoW}" height="${n.h.toFixed(1)}" rx="2" fill="${n.color}" data-n="${esc(n.id)}"/>`).join("")}</g>
      <g class="rotulos">${rot.map(r=>`<text x="${r.x}" y="${r.y}" text-anchor="${r.ancla}" data-n="${esc(r.n.id)}"><tspan class="t">${esc(r.n.nombre)}</tspan>${r.n.linea ? `<tspan class="v" dx="6">${miles(r.n.n)}</tspan>` : `<tspan class="v" x="${r.x}" dy="13">${miles(r.n.n)} · ${pct(r.n.n)}</tspan>`}</text>`).join("")}</g>
    </svg></div><div class="vj-sel" hidden></div>`;
  const svg = caja.querySelector("svg"), lista = caja.querySelector(".vj-sel");
  const enlace = i => enlaces[i], nodo = id => nodos.find(n=>n.id===id);
  let actual = null, selXs = null;
  const tipT = (titulo, n, extra="") => `<b>${esc(titulo)}</b><br>${miles(n)} ${n===1?"ley":"leyes"} · ${pct(n)} de las presentadas${extra}`;
  svg.addEventListener("mousemove", ev=>{
    const p = ev.target.closest("[data-e]"), r = ev.target.closest("[data-n]");
    let html = "";
    if (p){ const e = enlace(+p.dataset.e), q = p.dataset.q, m = selXs && p.closest(".rastro") ? selXs.filter(l=>e.de(l) && (!q || quienPresento(l)===q)).length : null;
      html = m != null ? `<b>${esc(e.a.nombre)} → ${esc(e.b.nombre)}</b><br>${q ? `${esc(NOMBRE_ORIGEN_V[q] || q)}: ` : ""}${miles(m)} de las ${miles(e.n)} ${e.n===1?"ley":"leyes"} de este tramo` : tipT(`${e.a.nombre} → ${e.b.nombre}`, e.n); }
    else if (r){ const n = nodo(r.dataset.n); html = tipT(n.tronco ? n.nombre : n.col === 0 ? `Presentadas por: ${n.nombre}` : `${n.nombre} ${n.desde === 0 ? "sin admitir a debate" : "tras: " + COLUMNAS[n.desde].toLowerCase()}`, n.n, n.filtro ? "<br><i>Pulsa para verlas</i>" : ""); }
    tipVj(html, ev);
  });
  svg.addEventListener("mouseleave", ()=>tipVj(""));
  svg.addEventListener("click", ev=>{
    const r = ev.target.closest("[data-n]"), p = ev.target.closest("[data-e]");
    // Pulsar un flujo es pulsar su grupo (si sale de un grupo) o la salida a la que va.
    const e = p ? enlace(+p.dataset.e) : null, n = r ? nodo(r.dataset.n) : e ? (e.origen ? e.a : e.b) : null;
    const f = n?.filtro;
    if (!f) return;
    const id = n.id;
    actual = actual === id ? null : id;
    svg.classList.toggle("filtrado", !!actual);
    svg.querySelectorAll("[data-n]").forEach(x=>x.classList.remove("on","off"));
    if (!actual){ rastro(null); lista.hidden = true; alElegir(null); return; }
    const pasa = l => (f.quien ? quienPresento(l) === f.quien : true) && (f.etapa !== undefined ? l.etapa === f.etapa && f.destinos.includes(l.destino) : true)
      && (f.minimo !== undefined ? l.etapa >= f.minimo : true);
    const xs = L.filter(pasa).sort((a,b)=>b.d0-a.d0);
    // Los grupos de color gris (el Mixto, «varios») se confundirían con el fondo: su rastro va con el color del texto.
    rastro(xs, f.quien ? (["MIXTO","VARIOS"].includes(f.quien) ? "var(--ink)" : n.color) : null);
    lista.hidden = false;
    const titulo = f.quien ? `${xs.length} presentadas por: ${NOMBRE_ORIGEN_V[f.quien] || f.quien}` :
      f.minimo !== undefined ? (f.minimo === 0 ? `Las ${xs.length} presentadas` : f.minimo === 5 ? `${xs.length} acabaron en ley` : `${xs.length} llegaron a «${COLUMNAS[f.minimo]}»`) : `${xs.length} ${n.nombre.toLowerCase()} · se quedaron en «${COLUMNAS[f.etapa]}»`;
    lista.innerHTML = `<h4>${esc(titulo)}</h4><ul>${xs.map(l=>`<li><button data-vj-ley="${esc(l.exp)}"><span>${esc(l.titulo.length > 110 ? l.titulo.slice(0,108)+"…" : l.titulo)}</span><span class="m">${esc(l.exp)}</span></button></li>`).join("")}</ul>`;
    alElegir(pasa);
  });
  lista.addEventListener("click", ev=>{ const b = ev.target.closest("[data-vj-ley]"); if (b) ficha.pulsar(L.find(x=>x.exp===b.dataset.vjLey), b); });
  lista.addEventListener("mouseover", ev=>{ const b = ev.target.closest("[data-vj-ley]"); if (b && !ficha.fija()) ficha.mostrar(L.find(x=>x.exp===b.dataset.vjLey), b); });
  lista.addEventListener("mouseleave", ()=>{ if (!ficha.fija()) ficha.ocultar(); });
  // El rastro de una selección: por cada enlace, la banda de las suyas (encima del enlace, con el color del grupo,
  // o del de cada origen si se eligió una salida), y en cada nodo, «X de N».
  const capa = svg.querySelector(".rastro"), valores = new Map([...svg.querySelectorAll(".rotulos text")].map(t=>[t.dataset.n, t.querySelector(".v")]));
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const corteBase = svg.querySelector("#vj-c-base rect"), corteRastro = svg.querySelector("#vj-c-rastro rect");
  let barridos = {};
  // Abre un recorte de izquierda a derecha en «dur» ms; enX(x) avisa de por dónde va (para los nodos y sus cifras).
  function barrer(rect, dur, enX, clave){
    cancelAnimationFrame(barridos[clave]);
    const ease = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2, t0 = performance.now();
    if (reducido){ rect.setAttribute("width", W + 4); enX(W + 4); return; }
    const paso = ahora => { const t = Math.min(1, (ahora - t0)/dur), x = ease(t) * (W + 4);
      rect.setAttribute("width", x.toFixed(1)); enX(x); if (t < 1) barridos[clave] = requestAnimationFrame(paso); };
    rect.setAttribute("width", 0); enX(-1); barridos[clave] = requestAnimationFrame(paso);
  }
  const rects = id => [...svg.querySelectorAll("rect[data-n]")].filter(r=>r.dataset.n === id);
  function rastro(xs, color){
    selXs = xs; capa.innerHTML = "";
    const cuentas = new Map(nodos.map(n=>[n.id, xs ? xs.filter(n.de).length : null]));
    const pintarNodo = n => { const v = valores.get(n.id), m = cuentas.get(n.id); if (!v) return;
      v.textContent = m ? `${miles(m)} de ${miles(n.n)}` : n.linea ? miles(n.n) : `${miles(n.n)} · ${pct(n.n)}`;
      rects(n.id).forEach(r=>{ r.classList.toggle("on", !!m); r.classList.toggle("off", m === 0); });
      v.closest("text").classList.toggle("off", m === 0); };
    if (!xs){ nodos.forEach(n=>{ pintarNodo(n); rects(n.id).forEach(r=>r.classList.remove("on","off")); }); return; }
    const colorGrupo = q => color === "var(--ink)" ? color : colorDe(q);   // el Mixto o «varios» solos, con el color del texto
    capa.innerHTML = enlaces.map((e,i)=>{ const sub = xs.filter(e.de); if (!sub.length) return ""; let o = 0;
      return origenes.map(og=>{ const q = og.filtro.quien, m = sub.filter(l=>quienPresento(l)===q).length; if (!m) return "";
        const d = e.tramo(o*k, m*k); o += m; return `<path d="${d}" fill="${colorGrupo(q)}" data-e="${i}" data-q="${q}"/>`; }).join(""); }).join("");
    // Mientras el rastro no llega a un nodo, ese nodo se queda apagado.
    nodos.forEach(n=>{ const v = valores.get(n.id); if (v) v.closest("text").classList.add("off"); rects(n.id).forEach(r=>r.classList.add("off")); });
    const hechos = new Set();
    barrer(corteRastro, 1700, x=>{ nodos.forEach(n=>{ if (!hechos.has(n.id) && n.x <= x){ hechos.add(n.id); pintarNodo(n); } }); }, "rastro");
  }
  // La primera vez que se ve, el diagrama se dibuja etapa a etapa: los flujos avanzan y cada nodo aparece al llegarle.
  const aparecer = () => {
    const hechos = new Set();
    svg.classList.add("dibujando");
    barrer(corteBase, 2200, x=>{ nodos.forEach(n=>{ if (!hechos.has(n.id) && n.x <= x + 2){ hechos.add(n.id);
      svg.querySelectorAll("[data-n]").forEach(el=>{ if (el.dataset.n === n.id) el.classList.add("visto"); }); } });
      if (x >= W) svg.classList.remove("dibujando"); }, "base");
  };
  if (reducido || !("IntersectionObserver" in window)) svg.querySelectorAll("[data-n]").forEach(el=>el.classList.add("visto"));
  else {
    corteBase.setAttribute("width", 0); svg.classList.add("dibujando");
    const io = new IntersectionObserver(es=>{ if (es.some(e=>e.isIntersecting && e.intersectionRatio > .35)){ io.disconnect(); aparecer(); } }, {threshold:[.35]});
    io.observe(svg);
  }
}
let tipEl = null;
function tipVj(html, ev){
  if (!tipEl){ tipEl = document.createElement("div"); tipEl.className = "vj-tip"; document.body.appendChild(tipEl); }
  if (!html){ tipEl.hidden = true; return; }
  tipEl.innerHTML = html; tipEl.hidden = false;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight, vw = document.documentElement.clientWidth;
  let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > vw - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
  tipEl.style.left = Math.max(8, x) + "px"; tipEl.style.top = Math.max(8, y) + "px";
}

/* ---------- la guillotina ---------- */
function guillotina(caja, L, ficha){
  const t0 = dia(V.inicio), tDis = dia(V.disolucion), NS = "http://www.w3.org/2000/svg";
  const W = Math.max(320, caja.clientWidth || 900), gap = W < 600 ? 6 : 12, ncol = 7;
  const colW = (W - gap*(ncol-1)) / ncol, d = W < 600 ? 5.2 : W < 900 ? 7.5 : 9, nc = Math.max(3, Math.floor(colW / d));
  // Cuántos puntos llega a tener cada caja (arriba, en su etapa; abajo, los que caen): para el alto del dibujo.
  const muestras = []; for (let t = t0; t <= tDis; t += 15) muestras.push(t); muestras.push(tDis);
  let maxArriba = 0; const cuenta = Array(ncol).fill(0);
  for (const t of muestras){ cuenta.fill(0); L.forEach(l=>{ const p = lugar(l, t, tDis + 1); if (p) cuenta[p.col]++; }); maxArriba = Math.max(maxArriba, ...cuenta); }
  const caen = Array(ncol).fill(0); L.forEach(l=>{ const p = lugar(l, tDis, tDis); if (p?.cae) caen[p.col]++; });
  const cab = 40, filasArriba = Math.ceil(maxArriba / nc), yCad = cab + filasArriba*d + 34, H = yCad + 22 + Math.ceil(Math.max(...caen) / nc)*d + 8;
  const xCol = c => c*(colW+gap);
  caja.innerHTML = `<div class="vj-ctl"><button class="btn primary boton" data-vj-play>▶ Reproducir la legislatura</button><input type="range" min="${t0}" max="${tDis}" step="1" value="${tDis}" aria-label="Fecha"><span class="vj-fecha"></span></div>
    <div class="vj-guillo"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cada ley de la legislatura, según la etapa a la que había llegado en cada fecha">
      <rect class="cad-band" x="0" y="${yCad - 6}" width="${W}" height="${H - yCad + 6}" rx="8" opacity="0"/>
      <text class="cad-t" x="6" y="${yCad + 8}" opacity="0">CADUCAN CON LA DISOLUCIÓN</text>
      ${(colW >= 150 ? [...COLUMNAS, "Rechazadas, retiradas…"] : colW >= 70 ? CORTAS : MINIS).map((t,c)=>`<text class="col-n" x="${xCol(c)}" y="14" data-n="${c}">0</text><text class="col-t" x="${xCol(c)}" y="30">${esc(t)}</text>`).join("")}
      <g class="puntos"></g></svg><div class="vj-aviso"><b>6 de octubre de 2026</b><small>Se disuelven las Cortes: caduca todo lo que no había terminado</small></div></div>`;
  const svg = caja.querySelector("svg"), capa = svg.querySelector(".puntos"), banda = svg.querySelector(".cad-band"), bandaT = svg.querySelector(".cad-t");
  const rango = caja.querySelector("input"), fecha = caja.querySelector(".vj-fecha"), boton = caja.querySelector("[data-vj-play]"), aviso = caja.querySelector(".vj-aviso");
  const nums = [...svg.querySelectorAll("[data-n]")];
  const pts = L.map(l=>{ const c = document.createElementNS(NS, "circle"); c.setAttribute("r", (d*0.42).toFixed(2)); c.setAttribute("fill", l.color); c.dataset.i = l.i;
    capa.appendChild(c); return {l, el:c, x:null, y:null, tx:null, ty:null, o:0, to:0}; });
  let t = tDis, anim = null, jugando = false;
  function objetivos(){
    const cajas = Array.from({length:ncol}, ()=>[]), abajo = Array.from({length:ncol}, ()=>[]);
    pts.forEach(p=>{ const q = lugar(p.l, t, tDis); p.q = q; if (q) (q.cae ? abajo : cajas)[q.col].push(p); });
    const colocar = (lista, c, y0) => lista.sort((a,b)=>a.l.d0-b.l.d0 || a.l.i-b.l.i).forEach((p,k)=>{ p.tx = xCol(c) + (k % nc)*d + d/2; p.ty = y0 + Math.floor(k / nc)*d + d/2; });
    cajas.forEach((lista,c)=>colocar(lista, c, cab));
    abajo.forEach((lista,c)=>colocar(lista, c, yCad + 16));
    pts.forEach(p=>{ p.to = p.q ? (p.q.col === 6 ? .45 : 1) : 0; if (!p.q){ p.tx = xCol(0) + d; p.ty = cab - 8; } if (p.x === null){ p.x = p.tx; p.y = p.ty; } });
    nums.forEach((n,c)=>{ n.textContent = miles(cajas[c].length + abajo[c].length); });
    const cayo = t >= tDis; banda.setAttribute("opacity", cayo ? 1 : 0); bandaT.setAttribute("opacity", cayo ? 1 : 0);
    fecha.textContent = corta(deDia(t)); rango.value = t;
  }
  const paso = () => {
    let quieto = true;
    pts.forEach(p=>{ const k = jugando ? .22 : .18;
      p.x += (p.tx - p.x)*k; p.y += (p.ty - p.y)*k; p.o += (p.to - p.o)*.2;
      if (Math.abs(p.tx-p.x) > .3 || Math.abs(p.ty-p.y) > .3 || Math.abs(p.to-p.o) > .02) quieto = false;
      p.el.setAttribute("cx", p.x.toFixed(1)); p.el.setAttribute("cy", p.y.toFixed(1)); p.el.setAttribute("fill-opacity", p.o.toFixed(2)); });
    return quieto;
  };
  const bucle = () => { anim = null; const quieto = paso(); if (!quieto || jugando) anim = requestAnimationFrame(bucle); };
  const mover = () => { objetivos(); if (!anim) anim = requestAnimationFrame(bucle); };
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function play(){
    if (jugando){ jugando = false; boton.textContent = "▶ Seguir"; return; }
    if (t >= tDis) t = t0;
    jugando = true; boton.textContent = "❚❚ Pausa"; aviso.classList.remove("si");
    let antes = performance.now();
    const avanzar = ahora => {
      if (!jugando) return;
      const dt = Math.min(64, ahora - antes); antes = ahora;
      t = Math.min(tDis, t + dt * (tDis - t0) / 14000);       // la legislatura entera en unos 14 segundos
      if (t >= tDis){ t = tDis; jugando = false; boton.textContent = "↺ Otra vez"; mover(); aviso.classList.add("si"); setTimeout(()=>aviso.classList.remove("si"), 3200); return; }
      mover(); requestAnimationFrame(avanzar);
    };
    requestAnimationFrame(avanzar); mover();
  }
  boton.addEventListener("click", play);
  rango.addEventListener("input", ()=>{ jugando = false; boton.textContent = "▶ Reproducir"; t = +rango.value; aviso.classList.remove("si"); mover(); });
  // Ficha al pasar por un punto; al pulsar, se queda fija.
  svg.addEventListener("mouseover", ev=>{ const c = ev.target.closest("circle"); if (c && !ficha.fija()) ficha.mostrar(L[+c.dataset.i], c); });
  svg.addEventListener("mouseout", ev=>{ if (ev.target.closest("circle") && !ficha.fija()) ficha.ocultar(); });
  svg.addEventListener("click", ev=>{ const c = ev.target.closest("circle"); if (c) ficha.pulsar(L[+c.dataset.i], c); });
  // Empieza con el final (la foto de la disolución) y se reproduce sola la primera vez que se ve entera.
  objetivos(); pts.forEach(p=>{ p.x = p.tx; p.y = p.ty; p.o = p.to; }); paso();
  if (!reducido && "IntersectionObserver" in window){
    const io = new IntersectionObserver(es=>{ if (es.some(e=>e.isIntersecting && e.intersectionRatio > .55)){ io.disconnect(); setTimeout(()=>{ if (!jugando && t >= tDis) play(); }, 500); } }, {threshold:[.55]});
    io.observe(svg);
  }
  return {filtrar(f){ caja.querySelector(".vj-guillo").classList.toggle("filtrado", !!f); pts.forEach(p=>p.el.classList.toggle("on", !!f && f(p.l))); }};
}

/* ---------- la ficha de cada ley ---------- */
function crearFicha(ctx){
  let el = document.querySelector(".vj-ficha");
  if (!el){ el = document.createElement("div"); el.className = "vj-ficha"; el.hidden = true; document.body.appendChild(el); }
  let fija = false;
  const NOMBRE = {GOB:"el Gobierno", SEN:"el Senado", CCAA:"un parlamento autonómico", MIXTO:"el Grupo Mixto"};
  const quien = l => l.tipo === "PL" ? "Proyecto del Gobierno" : "Proposición de " + l.autores.map(a=>NOMBRE[a] || a).join(", ");
  function contenido(l){
    const nombres = ["Presentada","Admitida a debate","Informe de la comisión","Aprobada en el Congreso","Pasó por el Senado","Ley"];
    const pasos = nombres.map((n,j)=>{ const f = j === 0 ? l.presentada : l.fechas[j-1]; return f ? `<li class="ok">${n} <small>${corta(f)}</small></li>` : ""; }).join("");
    const D = DESTINO[l.destino];
    const FINAL = {rechazada:"Rechazada", retirada:"Retirada por quien la presentó", "decaída":"Decaída", otra: l.estado === "subsumida" ? "Subsumida en otra iniciativa" : "Inadmitida"};
    const final = l.destino === "caduca" ? `Caducó con la disolución <small>${corta(l.fin)}</small>` : l.destino === "aprobada" ? "" :
      l.destino === "pendiente" ? "Aprobada por las Cortes, pendiente del BOE" : `${FINAL[l.destino] || esc(l.estado)}${l.fin ? ` <small>${corta(l.fin)}</small>` : ""}`;
    return `<button class="x" aria-label="Cerrar">×</button><div class="t">${esc(l.titulo)}</div>
      <div class="s">${esc(quien(l))} · ${esc(l.exp)}${l.comision ? ` · ${esc(l.comision)}` : ""}</div>
      <ol>${pasos}${final ? `<li class="fin" style="--c:${D[2]}">${final}</li>` : ""}</ol>
      ${l.ampl ? `<div class="s" style="margin-top:8px">Plazo de enmiendas ampliado ${l.ampl} ${l.ampl === 1 ? "vez" : "veces"}.</div>` : ""}
      <div class="ir"><button class="btn boton-claro" data-ini="${esc(l.exp)}">Ver su tramitación →</button>${fija ? "" : `<small style="color:var(--muted)">Pulsa para ver su tramitación</small>`}</div>`;
  }
  function colocar(ancla){
    const r = ancla.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, vw = document.documentElement.clientWidth;
    let x = r.right + 12, y = r.top - 10;
    if (x + w > vw - 8) x = r.left - w - 12;
    if (x < 8) x = Math.max(8, Math.min(vw - w - 8, r.left));
    if (y + h > innerHeight - 8) y = innerHeight - h - 8;
    if (x === Math.max(8, Math.min(vw - w - 8, r.left)) && r.bottom + h + 8 < innerHeight) y = r.bottom + 8;
    el.style.left = Math.max(8, x) + "px"; el.style.top = Math.max(8, y) + "px";
  }
  const conRaton = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const api = {
    fija: () => fija,
    pulsar(l, ancla){ if (!l) return;
      if (conRaton){ api.ocultar(); irA("iniciativa-" + l.exp.replace("/", "-")); }
      else api.mostrar(l, ancla, true); },
    mostrar(l, ancla, fijar=false){ if (!l) return; fija = fijar; el.innerHTML = contenido(l); el.hidden = false; colocar(ancla); },
    ocultar(){ fija = false; el.hidden = true; },
  };
  el.addEventListener("click", ev=>{ if (ev.target.closest(".x")) api.ocultar(); if (ev.target.closest("[data-ini]")) api.ocultar(); });
  document.addEventListener("click", ev=>{ if (fija && !el.contains(ev.target) && !ev.target.closest("circle,[data-vj-ley]")) api.ocultar(); });
  document.addEventListener("keydown", ev=>{ if (ev.key === "Escape") api.ocultar(); });
  addEventListener("scroll", ()=>{ if (!fija) el.hidden = true; }, {passive:true});
  return api;
}
