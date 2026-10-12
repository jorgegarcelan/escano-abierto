/* «La legislatura en cifras», la parte interactiva.
   - La legislatura, día a día: un calendario con cada día del 17 de agosto de 2023 a la disolución, pintado por
     votaciones, por leyes y decretos-leyes o por preguntas registradas; con ▶ se reproduce y los contadores suben.
   - Por cuántos votos: las votaciones según su margen (sí menos no); pulsar una barra las lista.
   Los días y las votaciones salen de escano/elecciones.py (dia_a_dia, datos/elecciones/legislatura.json). */

const CSS = `
.cf-cont{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:4px 18px;padding:12px 0 14px;border-block:1px solid var(--line)}
.cf-cont div{display:grid;gap:2px}
.cf-cont b{font-family:var(--led,var(--display));font-size:clamp(28px,4vw,40px);font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
.cf-cont span{font-size:12.5px;color:var(--muted)}
.cf-cont .alerta b{color:var(--no)}
.cf-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:10px 0}
.cf-seg{display:inline-flex;border:1px solid var(--line);border-radius:var(--r-pill,999px);overflow:hidden;background:var(--surface)}
.cf-seg button{appearance:none;border:0;background:none;font:500 12.5px var(--sans);color:var(--muted);padding:5px 12px;cursor:pointer}
.cf-seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.cf-fecha{font:600 13px var(--mono);color:var(--muted)}
.cf-cal{display:block;width:100%;height:auto}
.cf-cal rect.d{cursor:pointer;transition:opacity .15s}
.cf-cal rect.d:hover{stroke:var(--ink);stroke-width:1.5}
.cf-cal rect.fut{opacity:.12}
.cf-cal text{font:10.5px var(--mono);fill:var(--muted)}
.cf-cal .anio{font:700 12px var(--mono);fill:var(--ink)}
.cf-ley{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--muted);margin-top:6px;align-items:center}
.cf-ley span{display:inline-flex;align-items:center;gap:5px}
.cf-ley i{width:10px;height:10px;border-radius:2px;display:inline-block}
.cf-ley .r{width:120px;height:9px;border-radius:5px}
.cf-hist{display:block;width:100%;height:auto;overflow:visible}
.cf-hist rect.b{cursor:pointer}
.cf-hist rect.b:hover,.cf-hist rect.b.on{stroke:var(--ink);stroke-width:1.5}
.cf-hist text{font:10.5px var(--mono);fill:var(--muted)}
.cf-hist .rot{font:600 11px var(--sans)}
.cf-hist .cero{stroke:var(--line-strong)}
.cf-lista{margin-top:10px;border-top:1px solid var(--line);padding-top:10px}
.cf-lista h4{margin:0 0 6px;font-size:14px}
.cf-lista ul{list-style:none;margin:0;padding:0;display:grid;max-height:380px;overflow:auto}
.cf-lista li button{all:unset;box-sizing:border-box;width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:7px 6px;border-top:1px solid var(--line);cursor:pointer}
.cf-lista li:first-child button{border-top:0}
.cf-lista li button:hover{background:var(--sunk)}
.cf-lista .t{font-size:13.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cf-lista .m{font:12px var(--mono);color:var(--muted);text-align:right;white-space:nowrap}
.cf-lista .m b{color:var(--ink)}
.cf-tip{position:fixed;z-index:65;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:8px 10px;font-size:12.5px;line-height:1.45;max-width:300px}
.cf-tip[hidden]{display:none}
`;
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DIAS = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"];
const MESES_L = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const miles = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const iso = d => d.toISOString().slice(0, 10);
const deIso = s => { const [y,m,d] = s.split("-").map(Number); return new Date(Date.UTC(y, m-1, d)); };
const corta = s => { const [y,m,d] = s.split("-").map(Number); return `${d} ${MESES[m-1]} ${y}`; };
const larga = s => { const f = deIso(s); return `${DIAS[(f.getUTCDay()+6)%7]} ${f.getUTCDate()} de ${MESES_L[f.getUTCMonth()]} de ${f.getUTCFullYear()}`; };

// Abre una votación aunque sea de otro periodo: la web carga su mes (data-irv / data-f, como el resto de enlaces).
const abrirVotacion = (id, fecha) => { const b = document.createElement("button"); b.hidden = true; b.dataset.irv = id; b.dataset.f = fecha; document.body.appendChild(b); b.click(); b.remove(); };
let tipCaja = null;
function tip(html, ev){
  if (!tipCaja){ tipCaja = document.createElement("div"); tipCaja.className = "cf-tip"; document.body.appendChild(tipCaja); }
  if (!html){ tipCaja.hidden = true; return; }
  tipCaja.innerHTML = html; tipCaja.hidden = false;
  const w = tipCaja.offsetWidth, h = tipCaja.offsetHeight, vw = document.documentElement.clientWidth;
  let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > vw - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
  tipCaja.style.left = Math.max(8, x) + "px"; tipCaja.style.top = Math.max(8, y) + "px";
}
function estilos(){ if (document.getElementById("cf-css")) return; const s = document.createElement("style"); s.id = "cf-css"; s.textContent = CSS; document.head.appendChild(s); }
function rampa(hex, t){
  const v = getComputedStyle(document.documentElement).getPropertyValue("--sunk").trim(), a = v.startsWith("#") ? v : "#24272D";
  const h = x => { x = x.replace("#",""); const n = parseInt(x, 16); return [n>>16&255, n>>8&255, n&255]; };
  const [p, q] = [h(a), h(hex)], k = .32 + .68*Math.max(0, Math.min(1, t));
  return `rgb(${p.map((c,i)=>Math.round(c + (q[i]-c)*k)).join(",")})`;
}

export async function montarCifras(raiz, ctx, B){
  estilos();
  const caja = raiz.querySelector("#cf-dia"), cajaH = raiz.querySelector("#cf-margen");
  const D = await fetch("datos/elecciones/legislatura.json").then(r=>r.ok?r.json():null).catch(()=>null);
  // Las votaciones de toda la legislatura (la web solo tiene en memoria las del periodo que se está viendo).
  const votos = (D?.votos || []).map(([id, fecha, titulo, si, no])=>({id, fecha, titulo, si, no}));
  const dibujar = () => { if (caja && D) calendario(caja, D, votos, B); if (cajaH) margenes(cajaH, votos); };
  dibujar();
  // Los SVG se dibujan para el ancho que hay: si cambia (girar el móvil, otra ventana), se vuelven a dibujar.
  let ancho = (caja || cajaH)?.clientWidth || 0, t0 = null;
  const ro = new ResizeObserver(()=>{ const w = (caja || cajaH)?.clientWidth || 0; if (Math.abs(w - ancho) < 30) return; ancho = w; clearTimeout(t0); t0 = setTimeout(dibujar, 150); });
  if (caja || cajaH) ro.observe(caja || cajaH);
  new MutationObserver((_, mo)=>{ if (!document.body.contains(caja || cajaH)){ ro.disconnect(); mo.disconnect(); } }).observe(raiz, {childList:true});
}
const estado = {modo: "votaciones", reproducida: false};

/* ---------- la legislatura, día a día ---------- */
const MODOS = [["votaciones","Votaciones"],["leyes","Leyes y decretos-leyes"],["preguntas","Preguntas registradas"]];
// Cada marca puede poner los suyos en --cf-verde, --cf-morado… (Sol: rojo, tinta, tinta y ámbar).
const cfColor = (k, def) => getComputedStyle(document.documentElement).getPropertyValue("--cf-" + k).trim() || def;
const VERDE = cfColor("verde", "#3C8C6A"), MORADO = cfColor("morado", "#7152A8"), AZUL = cfColor("azul", "#4F7AA6"), AMBAR = cfColor("ambar", "#C9873E");
function calendario(caja, D, votos, B){
  const desde = deIso(D.desde), hasta = deIso(D.hasta), dias = [];
  for (let d = new Date(desde); d <= hasta; d.setUTCDate(d.getUTCDate()+1)) dias.push(iso(d));
  const val = f => D.dias[f] || [0,0,0,0];
  const primerVoto = {}; votos.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id, undefined, {numeric:true})).forEach(v=>{ primerVoto[v.fecha] ||= v.id; });
  // Un bloque por año: columnas = semanas (de lunes a domingo), filas = días de la semana.
  const anios = [...new Set(dias.map(f=>+f.slice(0,4)))];
  const W = Math.max(320, caja.clientWidth || 900), izq = 40, c = Math.min(15, Math.max(4.6, (W - izq) / 54)), g = c > 8 ? 2 : 1, alto = 7*c + 22;
  const H = anios.length * alto + 4;
  const pos = f => { const d = deIso(f), y = d.getUTCFullYear(), ene = new Date(Date.UTC(y,0,1)), off = (ene.getUTCDay()+6)%7;
    const n = Math.round((d - ene)/864e5), col = Math.floor((n + off)/7), fila = (d.getUTCDay()+6)%7;
    return {x: izq + col*c, y: anios.indexOf(y)*alto + 18 + fila*c}; };
  const maxV = Math.max(...dias.map(f=>val(f)[0])), maxP = Math.max(...dias.map(f=>val(f)[3]));
  let modo = estado.modo, cursor = dias.length - 1, jugando = false;
  const color = f => { const [v, l, r, p] = val(f);
    if (modo === "votaciones") return v ? rampa(AZUL, Math.sqrt(v/maxV)) : null;
    if (modo === "leyes") return l ? VERDE : r ? MORADO : null;
    return p ? rampa(AMBAR, Math.log1p(p)/Math.log1p(maxP)) : null; };
  const meses = []; anios.forEach(y=>{ for (let m = 0; m < 12; m++){ const f = `${y}-${String(m+1).padStart(2,"0")}-01`; if (f >= D.desde.slice(0,8)+"01" && f <= D.hasta){ const p = pos(f < D.desde ? D.desde : f), prev = meses[meses.length-1];
      if (prev && prev.y === anios.indexOf(y)*alto + 10 && p.x - prev.x < 2.2*c) meses.pop();
      meses.push({x: p.x, y: anios.indexOf(y)*alto + 10, t: MESES[m]}); } } });
  caja.innerHTML = `<div class="cf-cont">
      <div><b data-c="0">0</b><span>votaciones en el Pleno</span></div><div><b data-c="1">0</b><span>leyes publicadas</span></div>
      <div><b data-c="2">0</b><span>reales decretos-leyes</span></div><div><b data-c="3">0</b><span>preguntas registradas</span></div>
      <div><b>${miles(B.plenos)}</b><span>días de Pleno con votaciones</span></div><div class="alerta"><b>${miles(B.sin_respuesta)}</b><span>preguntas sin respuesta</span></div></div>
    <div class="cf-ctl"><button class="btn primary boton" data-cf-play>▶ Reproducir la legislatura</button>
      <div class="cf-seg" role="group" aria-label="Qué se pinta">${MODOS.map(([v,t])=>`<button data-cf-modo="${v}" aria-pressed="${v===modo}">${t}</button>`).join("")}</div>
      <span class="cf-fecha"></span></div>
    <svg class="cf-cal" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cada día de la legislatura">
      ${anios.map((y,i)=>`<text class="anio" x="0" y="${i*alto + 18 + 4*c}">${y}</text>`).join("")}
      ${meses.map(m=>`<text x="${m.x}" y="${m.y}">${m.t}</text>`).join("")}
      <g class="dias">${dias.map((f,i)=>{ const p = pos(f); return `<rect class="d" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${(c-g).toFixed(1)}" height="${(c-g).toFixed(1)}" rx="${c > 8 ? 2 : 1}" data-i="${i}"/>`; }).join("")}</g></svg>
    <div class="cf-ley"></div>`;
  const rects = [...caja.querySelectorAll("rect.d")], cont = [...caja.querySelectorAll("[data-c]")], fecha = caja.querySelector(".cf-fecha"), ley = caja.querySelector(".cf-ley");
  const acum = []; { let s = [0,0,0,0]; dias.forEach(f=>{ const v = val(f); s = s.map((x,k)=>x + v[k]); acum.push(s); }); }
  const pintar = () => { rects.forEach((r,i)=>{ const col = color(dias[i]); r.setAttribute("fill", col || "var(--sunk)"); r.setAttribute("fill-opacity", col ? 1 : .55); });
    ley.innerHTML = modo === "leyes" ? `<span><i style="background:${VERDE}"></i>Se publica una ley</span><span><i style="background:${MORADO}"></i>Se publica un decreto-ley</span>`
      : modo === "votaciones" ? `<span>Menos</span><span class="r" style="background:linear-gradient(90deg,${rampa(AZUL,0)},${rampa(AZUL,1)})"></span><span>Más votaciones (hasta ${maxV} en un día)</span>`
      : `<span>Menos</span><span class="r" style="background:linear-gradient(90deg,${rampa(AMBAR,0)},${rampa(AMBAR,1)})"></span><span>Más preguntas (hasta ${miles(maxP)} en un día)</span>`; };
  const mover = () => { const a = acum[Math.max(0, Math.min(cursor, acum.length - 1))]; if (!a) return;
    rects.forEach((r,i)=>r.classList.toggle("fut", i > cursor)); a.forEach((x,k)=>{ cont[k].textContent = miles(x); }); fecha.textContent = corta(dias[Math.min(cursor, dias.length - 1)]); };
  const boton = caja.querySelector("[data-cf-play]"), reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function play(){
    if (jugando){ jugando = false; boton.textContent = "▶ Seguir"; return; }
    if (cursor >= dias.length - 1) cursor = 0;
    jugando = true; boton.textContent = "❚❚ Pausa";
    let antes = performance.now(), t = cursor;
    const paso = ahora => { if (!jugando || !caja.contains(boton)) return;   // se paró, o se salió de la página / se volvió a dibujar t = Math.min(dias.length - 1, t + (ahora - antes) * dias.length / 11000); antes = ahora; cursor = Math.floor(t); mover();
      if (cursor >= dias.length - 1){ jugando = false; boton.textContent = "↺ Otra vez"; return; } requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }
  boton.addEventListener("click", play);
  caja.addEventListener("click", ev=>{
    const m = ev.target.closest("[data-cf-modo]"); if (m){ modo = estado.modo = m.dataset.cfModo; caja.querySelectorAll("[data-cf-modo]").forEach(b=>b.setAttribute("aria-pressed", String(b === m))); pintar(); return; }
    const r = ev.target.closest("rect.d"); if (r){ const f = dias[+r.dataset.i]; if (primerVoto[f]) abrirVotacion(primerVoto[f], f); }
  });
  const svg = caja.querySelector("svg");
  svg.addEventListener("mousemove", ev=>{ const r = ev.target.closest("rect.d"); if (!r){ tip(""); return; } const f = dias[+r.dataset.i], [v, l, d, p] = val(f);
    const partes = [v && `${v} ${v === 1 ? "votación" : "votaciones"}`, l && `${l} ${l === 1 ? "ley publicada" : "leyes publicadas"}`, d && `${d} ${d === 1 ? "decreto-ley" : "decretos-leyes"}`, p && `${miles(p)} ${p === 1 ? "pregunta registrada" : "preguntas registradas"}`].filter(Boolean);
    tip(`<b>${esc(larga(f))}</b><br>${partes.length ? partes.join("<br>") : "Sin actividad registrada"}${v ? "<br><i>Pulsa para ver sus votaciones</i>" : ""}`, ev); });
  svg.addEventListener("mouseleave", ()=>tip(""));
  pintar(); mover();
  // Empieza completo y se reproduce sola la primera vez que se ve (una sola vez, aunque se vuelva a dibujar).
  if (!reducido && !estado.reproducida && "IntersectionObserver" in window){
    const io = new IntersectionObserver(es=>{ if (es.some(e=>e.isIntersecting && e.intersectionRatio > .3)){ io.disconnect(); estado.reproducida = true; setTimeout(play, 300); } }, {threshold:[.3]});
    io.observe(svg);
  }
}

/* ---------- por cuántos votos ---------- */
function margenes(caja, votos){
  const bin = m => m === 0 ? 0 : m > 0 ? Math.ceil(m/10) : -Math.ceil(-m/10);   // 0: empate; ±1: de 1 a 10 votos; ±2: de 11 a 20…
  const por = {}; votos.forEach(v=>{ const b = bin(v.si - v.no); (por[b] ||= []).push(v); });
  const bins = Object.keys(por).map(Number), lo = Math.min(...bins), hi = Math.max(...bins), max = Math.max(...bins.map(b=>por[b].length));
  const justas = votos.filter(v=>Math.abs(v.si - v.no) <= 10), empates = por[0] || [];
  const W = Math.max(320, caja.clientWidth || 900), H = W < 600 ? 220 : 260, m = {l:36, r:8, t:22, b:30};
  const n = hi - lo + 1, bw = (W - m.l - m.r) / n, X = b => m.l + (b - lo)*bw, Y = c => m.t + (1 - c/max)*(H - m.t - m.b);
  const col = b => b === 0 ? "#E0A410" : Math.abs(b) === 1 ? (b > 0 ? "var(--si)" : "var(--no)") : b > 0 ? "color-mix(in srgb,var(--si) 45%,var(--surface))" : "color-mix(in srgb,var(--no) 45%,var(--surface))";
  const etq = b => b === 0 ? "Empate" : `${b > 0 ? "Aprobadas" : "Rechazadas"} por ${b === 1 || b === -1 ? "1 a 10" : `${(Math.abs(b)-1)*10 + 1} a ${Math.abs(b)*10}`} votos`;
  const ticks = [lo, -10, -5, 0, 5, 10, 20, hi].filter((t,i,a)=>t >= lo && t <= hi && a.indexOf(t) === i);
  caja.innerHTML = `<p class="sub" style="margin:0 0 8px">De ${miles(votos.length)} votaciones con voto nominal, <b>${miles(justas.length)}</b> se decidieron por 10 votos o menos y <b>${empates.length}</b> acabaron en empate (en el Congreso, un empate repetido tres veces tumba la propuesta). Pulsa una barra para ver esas votaciones.</p>
    <svg class="cf-hist" viewBox="0 0 ${W} ${H}" role="img" aria-label="Votaciones según la diferencia entre votos a favor y en contra">
      ${[0, .5, 1].map(f=>`<text x="${m.l - 6}" y="${Y(max*f) + 4}" text-anchor="end">${miles(Math.round(max*f))}</text>`).join("")}
      ${bins.map(b=>`<rect class="b" x="${(X(b)+.5).toFixed(1)}" y="${Y(por[b].length).toFixed(1)}" width="${Math.max(1, bw-1).toFixed(1)}" height="${(H - m.b - Y(por[b].length)).toFixed(1)}" fill="${col(b)}" rx="1.5" data-b="${b}"/>`).join("")}
      <line class="cero" x1="${X(0) + bw/2}" x2="${X(0) + bw/2}" y1="${m.t - 10}" y2="${H - m.b}"/>
      <text class="rot" x="${X(0) + bw/2 - 6}" y="${m.t - 12}" text-anchor="end">← rechazadas</text><text class="rot" x="${X(0) + bw/2 + 6}" y="${m.t - 12}">aprobadas →</text>
      ${ticks.map(t=>`<text x="${X(t) + bw/2}" y="${H - 12}" text-anchor="middle">${t === 0 ? "0" : (t > 0 ? "+" : "−") + Math.abs(t*10)}</text>`).join("")}
      <text x="${W - m.r}" y="${H}" text-anchor="end">diferencia de votos (sí − no)</text>
    </svg><div class="cf-lista" hidden></div>`;
  const svg = caja.querySelector("svg"), lista = caja.querySelector(".cf-lista");
  svg.addEventListener("mousemove", ev=>{ const r = ev.target.closest("rect.b"); if (!r){ tip(""); return; } const b = +r.dataset.b; tip(`<b>${esc(etq(b))}</b><br>${miles(por[b].length)} ${por[b].length === 1 ? "votación" : "votaciones"}<br><i>Pulsa para verlas</i>`, ev); });
  svg.addEventListener("mouseleave", ()=>tip(""));
  let actual = null;
  const listar = b => { const xs = (por[b] || []).slice().sort((x,y)=>y.fecha.localeCompare(x.fecha));
    lista.hidden = false;
    lista.innerHTML = `<h4>${esc(etq(b))} · ${miles(xs.length)}</h4><ul>${xs.slice(0, 200).map(v=>`<li><button data-irv="${esc(v.id)}" data-f="${esc(v.fecha)}"><span class="t">${esc(v.titulo)}</span><span class="m"><b>${v.si}–${v.no}</b> · ${esc(corta(v.fecha))}</span></button></li>`).join("")}</ul>${xs.length > 200 ? `<p class="nota">Se muestran las 200 más recientes.</p>` : ""}`; };
  svg.addEventListener("click", ev=>{ const r = ev.target.closest("rect.b"); if (!r) return; const b = +r.dataset.b;
    actual = actual === b ? null : b; svg.querySelectorAll("rect.b").forEach(x=>x.classList.toggle("on", +x.dataset.b === actual));
    if (actual === null){ lista.hidden = true; return; } listar(b); });
  // Empieza enseñando los empates.
  if (empates.length){ actual = 0; svg.querySelector('rect.b[data-b="0"]')?.classList.add("on"); listar(0); }
}
