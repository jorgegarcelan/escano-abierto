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
.vj-embudo{display:grid;gap:6px}
.vj-fila{display:grid;grid-template-columns:minmax(0,12em) minmax(0,1fr) 3.5em;gap:10px;align-items:center;font-size:13px}
.vj-fila .l small{display:block;color:var(--muted);font-size:11.5px}
.vj-barra{display:flex;height:22px;gap:2px}
.vj-barra button{all:unset;display:block;height:100%;min-width:2px;cursor:pointer;border-radius:2px;transition:opacity .2s,outline-color .2s;outline:2px solid transparent;outline-offset:1px}
.vj-barra button:hover,.vj-barra button:focus-visible{outline-color:var(--ink)}
.vj-barra button.on{outline-color:var(--ink)}
.vj-embudo.filtrado .vj-barra button:not(.on){opacity:.35}
.vj-fila .v{font:600 13px var(--mono);text-align:right}
.vj-ley{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--muted);margin-top:8px}
.vj-ley span{display:inline-flex;align-items:center;gap:5px}
.vj-ley i{width:10px;height:10px;border-radius:2px;display:inline-block}
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
@media (max-width:640px){ .vj-fila{grid-template-columns:1fr 3em} .vj-fila .vj-barra{grid-column:1/-1;grid-row:2} }
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
  const cajaE = raiz.querySelector("#vj-embudo"), cajaG = raiz.querySelector("#vj-guillotina");
  if (!cajaE && !cajaG) return;
  await cargar();
  if (!V){ [cajaE, cajaG].forEach(c=>{ if (c) c.innerHTML = `<p class="nota">No se han podido cargar los viajes de las leyes.</p>`; }); return; }
  const L = preparar(ctx, colorOrigen), POR_EXP = Object.fromEntries(L.map(l=>[l.exp, l]));
  const ficha = crearFicha(ctx);
  let sel = null;            // {etapa, destino}: el tramo del embudo elegido
  const enSel = l => !sel || (l.etapa === sel.etapa && (sel.destino === "sigue" ? false : l.destino === sel.destino));
  const guillo = cajaG ? guillotina(cajaG, L, ficha) : null;
  if (cajaE) embudo(cajaE, L, ficha, s=>{ sel = s; guillo?.filtrar(sel ? enSel : null); });
  // La ficha también en las listas de leyes del apartado (las que llevan data-ini).
  raiz.addEventListener("mouseover", ev=>{ const b = ev.target.closest(".el-lista [data-ini]"); if (b && POR_EXP[b.dataset.ini] && !ficha.fija()) ficha.mostrar(POR_EXP[b.dataset.ini], b); });
  raiz.addEventListener("mouseout", ev=>{ const b = ev.target.closest(".el-lista [data-ini]"); if (b && !ficha.fija()) ficha.ocultar(); });
}

/* ---------- el embudo ---------- */
function embudo(caja, L, ficha, alElegir){
  const filas = COLUMNAS.map((t,k)=>{
    const llegan = L.filter(l=>l.etapa >= k), quedan = L.filter(l=>l.etapa === k);
    const por = {}; quedan.forEach(l=>{ por[l.destino] = (por[l.destino]||0) + 1; });
    return {k, t, llegan: llegan.length, siguen: llegan.length - quedan.length, por};
  });
  const max = filas[0].llegan;
  caja.innerHTML = `<div class="vj-embudo">${filas.map(f=>`<div class="vj-fila"><div class="l">${esc(f.t)}<small>${f.k === 0 ? "en la legislatura" : `el ${Math.round(f.llegan/max*100)} % de las presentadas`}</small></div>
      <div class="vj-barra" style="width:${(f.llegan/max*100).toFixed(1)}%">${[...DESTINOS.filter(d=>d[0] !== "sigue" && f.por[d[0]]).map(d=>[d, f.por[d[0]]]), ...(f.siguen ? [[DESTINO.sigue, f.siguen]] : [])]
        .map(([d,n])=>`<button style="flex:${n};background:${d[2]}" data-vj-sel="${f.k}|${d[0]}" aria-label="${esc(`${f.t}: ${n} ${d[1].toLowerCase()}`)}" data-tip="${esc(`<b>${esc(f.t)}</b><br>${n} ${d[0] === "sigue" ? "siguen a la etapa siguiente" : esc(d[1].toLowerCase()) + " en esta etapa"}`)}"></button>`).join("")}</div>
      <div class="v">${miles(f.llegan)}</div></div>`).join("")}</div>
    <div class="vj-ley">${DESTINOS.filter(d=>L.some(l=>l.destino===d[0]) || d[0]==="sigue").map(d=>`<span><i style="background:${d[2]}"></i>${esc(d[1])}</span>`).join("")}</div>
    <div class="vj-sel" hidden></div>`;
  const lista = caja.querySelector(".vj-sel");
  let actual = null;
  caja.addEventListener("click", ev=>{
    const b = ev.target.closest("[data-vj-sel]"); if (!b) return;
    const [k, destino] = b.dataset.vjSel.split("|");
    if (destino === "sigue") return;
    actual = actual === b.dataset.vjSel ? null : b.dataset.vjSel;
    caja.querySelectorAll("[data-vj-sel]").forEach(x=>x.classList.toggle("on", x.dataset.vjSel === actual));
    caja.querySelector(".vj-embudo").classList.toggle("filtrado", !!actual);
    if (!actual){ lista.hidden = true; alElegir(null); return; }
    const xs = L.filter(l=>l.etapa === +k && l.destino === destino).sort((a,b)=>b.d0-a.d0);
    lista.hidden = false;
    lista.innerHTML = `<h4>${xs.length} ${DESTINO[destino][1].toLowerCase()} · se quedaron en «${esc(COLUMNAS[+k])}»</h4><ul>${xs.map(l=>`<li><button data-vj-ley="${esc(l.exp)}"><span>${esc(l.titulo.length > 110 ? l.titulo.slice(0,108)+"…" : l.titulo)}</span><span class="m">${esc(l.exp)}</span></button></li>`).join("")}</ul>`;
    alElegir({etapa:+k, destino});
  });
  lista.addEventListener("click", ev=>{ const b = ev.target.closest("[data-vj-ley]"); if (b){ const l = L.find(x=>x.exp===b.dataset.vjLey); ficha.mostrar(l, b, true); } });
  lista.addEventListener("mouseover", ev=>{ const b = ev.target.closest("[data-vj-ley]"); if (b && !ficha.fija()) ficha.mostrar(L.find(x=>x.exp===b.dataset.vjLey), b); });
  lista.addEventListener("mouseleave", ()=>{ if (!ficha.fija()) ficha.ocultar(); });
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
  caja.innerHTML = `<div class="vj-ctl"><button class="btn primary" data-vj-play>▶ Reproducir la legislatura</button><input type="range" min="${t0}" max="${tDis}" step="1" value="${tDis}" aria-label="Fecha"><span class="vj-fecha"></span></div>
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
  svg.addEventListener("click", ev=>{ const c = ev.target.closest("circle"); if (c) ficha.mostrar(L[+c.dataset.i], c, true); });
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
      <div class="ir"><button class="btn" data-ini="${esc(l.exp)}">Ver su tramitación →</button>${fija ? "" : `<small style="color:var(--muted)">Pulsa para fijarla</small>`}</div>`;
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
  const api = {
    fija: () => fija,
    mostrar(l, ancla, fijar=false){ if (!l) return; fija = fijar; el.innerHTML = contenido(l); el.hidden = false; colocar(ancla); },
    ocultar(){ fija = false; el.hidden = true; },
  };
  el.addEventListener("click", ev=>{ if (ev.target.closest(".x")) api.ocultar(); if (ev.target.closest("[data-ini]")) api.ocultar(); });
  document.addEventListener("click", ev=>{ if (fija && !el.contains(ev.target) && !ev.target.closest("circle,[data-vj-ley]")) api.ocultar(); });
  document.addEventListener("keydown", ev=>{ if (ev.key === "Escape") api.ocultar(); });
  addEventListener("scroll", ()=>{ if (!fija) el.hidden = true; }, {passive:true});
  return api;
}
