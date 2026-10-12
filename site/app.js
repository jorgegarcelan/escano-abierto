/* La web: una sola página (index.html) con todas las vistas. Cada vista tiene su ruta (/votaciones/,
   /diputado/<slug>/…); ver «rutas» más abajo. */
/* ---------- rutas ---------- */
// Cada vista tiene su URL (/votaciones/, /diputado/<slug>/, /elecciones/provincia-madrid/…), que es lo que se comparte
// y lo que indexa Google. Por dentro la web sigue usando los identificadores de siempre («diputado-<slug>»,
// «elecciones-provincia-madrid»): rutaDe() los pasa a URL e idDeRuta() al revés. Las direcciones con # de antes
// (#votaciones, #diputado-…) siguen valiendo: al llegar, pasan a su ruta.
const PREFIJOS_RUTA = ["diputado","votacion","sesion","iniciativa","provincia","tema","semana","cargo","elecciones","geografia"];
function rutaDe(id){
  id = String(id || "").replace(/^[#/]+/, "");
  if (!id || id === "inicio") return "/";
  const m = id.match(/^([a-z]+)-(.+)$/);
  if (m && PREFIJOS_RUTA.includes(m[1])) return `/${m[1]}/${m[1] === "sesion" ? m[2].toLowerCase() : m[2]}/`;   // las páginas de las sesiones van en minúsculas
  return `/${id}/`;
}
function idDeRuta(ruta){
  let p = String(ruta).split(/[?#]/)[0];
  try{ p = decodeURIComponent(p); }catch(e){}
  p = p.replace(/^\/+|\/+$/g, "");
  return p ? p.split("/").join("-") : "inicio";
}
window.rutaDe = rutaDe;
let ultimaVista = null;   // la última vista contada en la analítica (fuera de iniciar: cambiar de periodo no es otra visita)
let mesCargado = null;    // el mes que se cargó para abrir una votación o sesión de otro periodo (solo una vez)

/* ---------- carga por meses ---------- */
// datos/indice.json trae lo común y la lista de meses; cada mes está en datos/AAAA-MM.json.
const CARGADOS = {};
// Cada mes trae las intervenciones sin el texto largo; el detalle se pide por sesión al ir a enseñar sus tarjetas.
const IV_POR_ID = {}; let IV_SEQ = 0, pintarIv = null;
function guardarMes(m, j){
  (j.intervenciones||[]).forEach(i=>{ if (typeof i.item==="number") i.item = j.items[i.item]; i._id = ++IV_SEQ; IV_POR_ID[i._id] = i; });
  CARGADOS[m] = j;
}
const DETALLE_IV = {};
function detalleSesion(sid){
  return DETALLE_IV[sid] ||= fetch(`datos/iv/${encodeURIComponent(sid)}.json`).then(r=>r.ok?r.json():[]).catch(()=>[]);
}
const obsIv = new IntersectionObserver(entradas=>entradas.forEach(e=>{
  if (!e.isIntersecting) return;
  obsIv.unobserve(e.target);
  const el = e.target, i = IV_POR_ID[el.dataset.id];
  if (!i) return;
  detalleSesion(i.s).then(det=>{ if (!i._det){ Object.assign(i, det[i.d]||{}); i._det = true; } if (el.isConnected && pintarIv) el.outerHTML = pintarIv(i); });
}), {rootMargin:"800px 0px"});
new MutationObserver(()=>document.querySelectorAll(".iv[data-pend]:not([data-vigilada])").forEach(el=>{ el.dataset.vigilada = 1; obsIv.observe(el); }))
  .observe(document.body, {childList:true, subtree:true});
let INDICE = null, ctl = null;
const MESES_LARGOS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const nombreMes = m => { const [y,mm]=m.split("-").map(Number); return `${MESES_LARGOS[mm-1][0].toUpperCase()+MESES_LARGOS[mm-1].slice(1)} ${y}`; };
function periodos(){
  const ms = INDICE.meses.map(m=>m.mes);
  const out = [["reciente","Últimos 3 meses", ms.slice(-3)], ...ms.slice().reverse().map(m=>[m, nombreMes(m), [m]])];
  if (ms.length > 3) out.push(["todo","Toda la legislatura", ms]);
  return out;
}
function textoPeriodo(fechas){
  if (!fechas.length) return "";
  const f = iso => { const [y,m,d]=iso.split("-").map(Number); return {d, m:MESES_LARGOS[m-1], y}; };
  const a = f(fechas[0]), b = f(fechas[fechas.length-1]);
  return a.y===b.y ? `${a.d} de ${a.m} – ${b.d} de ${b.m} de ${b.y}` : `${a.d} de ${a.m} de ${a.y} – ${b.d} de ${b.m} de ${b.y}`;
}
async function arrancar(clave){
  const lista = periodos(), p = lista.find(x=>x[0]===clave) || lista[0];
  await Promise.all(p[2].filter(m=>!CARGADOS[m]).map(m=>fetch(`datos/${m}.json`, {cache:"no-store"}).then(r=>r.json()).then(j=>guardarMes(m, j))));
  const sesiones=[], votaciones=[], ivs=[];
  p[2].forEach(m=>{ const c=CARGADOS[m]; sesiones.push(...c.sesiones); votaciones.push(...c.votaciones); ivs.push(...c.intervenciones); });
  const DATA = {...INDICE, meta:{...INDICE.meta, periodo: textoPeriodo(sesiones.map(s=>s.fecha).sort())}, sesiones, votaciones};
  try{ localStorage.setItem("periodo", p[0]); }catch(e){}
  // El periodo: dos atajos (los tres últimos meses y toda la legislatura) y una barra por mes, del alto de sus
  // votaciones; se pulsa un mes para ver solo ese. Lo que se está viendo queda resaltado.
  const ms = INDICE.meses, maxV = Math.max(1, ...ms.map(m=>m.votaciones)), elegidos = new Set(p[2]);
  // Si se está viendo un mes, aparece como tercera opción (así se sabe cuál es aunque la barra esté compacta).
  const atajos = [["reciente","Últimos 3 meses"],["todo","Toda la legislatura"]].filter(([k])=>lista.some(x=>x[0]===k));
  if (/^\d{4}-\d{2}$/.test(p[0])) atajos.push([p[0], nombreMes(p[0])]);
  document.getElementById("periodo-seg").innerHTML = atajos.map(([k,l])=>`<button type="button" data-periodo="${k}" aria-pressed="${k===p[0]}">${l}</button>`).join("");
  const anioIni = {}; ms.forEach((m,i)=>{ const y = m.mes.slice(0,4); if (!(y in anioIni)) anioIni[y] = i; });
  const cuenta = (n, uno, varios) => `${n} ${n===1?uno:varios}`;
  document.getElementById("periodo-meses").innerHTML = `<div class="pb-barras">${ms.map(m=>{ const txt = `${nombreMes(m.mes)}: ${cuenta(m.sesiones,"sesión","sesiones")} y ${cuenta(m.votaciones,"votación","votaciones")}`;
      return `<button type="button" data-periodo="${m.mes}"${elegidos.has(m.mes)?' class="sel"':""} aria-pressed="${p[0]===m.mes}" aria-label="${txt}" data-tip="${txt}"><i style="--h:${Math.max(10, Math.round(m.votaciones/maxV*100))}%"></i></button>`; }).join("")}</div>`
    + `<div class="pb-anios" aria-hidden="true">${Object.entries(anioIni).map(([y,i])=>`<span style="left:${(i/ms.length*100).toFixed(2)}%">${y}</span>`).join("")}</div>`;
  // En la barra, las fechas cortas («17 ago 2023 – 2 oct 2026»): con las largas no cabe en una línea
  const corta = iso => { const [y,m,d] = iso.split("-").map(Number); return `${d} ${MESES_LARGOS[m-1].slice(0,3)} ${y}`; };
  const fs = sesiones.map(s=>s.fecha).sort();
  document.getElementById("periodo-info").innerHTML = `${fs.length ? `${corta(fs[0])} – ${corta(fs[fs.length-1])}` : ""} · <b>${sesiones.length}</b> ${sesiones.length===1?"sesión":"sesiones"} · <b>${votaciones.length}</b> ${votaciones.length===1?"votación":"votaciones"}`;
  iniciar(DATA, ivs);
}
fetch("datos/indice.json", {cache: "no-store"}).then(r => r.json()).then(j => {
  INDICE = j;
  let clave = "reciente"; try{ clave = localStorage.getItem("periodo") || clave; }catch(e){}
  // El periodo se queda fijo bajo la barra al bajar: cuando su ancla sale por arriba, pasa a una franja compacta.
  const pb = document.querySelector(".periodo-bar"), ancla = document.getElementById("periodo-ancla");
  const altoBarra = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--alto-barra")) || 0;
  const pegar = () => pb.classList.toggle("pegada", !pb.hidden && ancla.getBoundingClientRect().top < altoBarra());
  addEventListener("scroll", pegar, {passive: true}); addEventListener("resize", pegar);
  document.querySelector(".periodo-bar").addEventListener("click", e => { const b = e.target.closest("[data-periodo]"); if (b && b.getAttribute("aria-pressed") !== "true") arrancar(b.dataset.periodo); });
  return arrancar(clave);
}).catch(() => { document.querySelector("main").innerHTML = '<p class="nota">No se pudieron cargar los datos. Si abres la web en local, sírvela con <code>python -m http.server</code> desde la carpeta site/.</p>'; });

function iniciar(DATA, IVS){
  pintarIv = i => ivCard(i);
// Al cambiar de periodo se vuelve a llamar: se retiran los listeners del arranque anterior.
ctl?.abort(); ctl = new AbortController();
const SIG = {signal: ctl.signal};
const G = DATA.grupos;
// El Gobierno no es un grupo y no tiene color de partido: cada marca puede darle el suyo (Sol: tinta, como el organigrama).
{ const c = getComputedStyle(document.documentElement).getPropertyValue("--color-gob").trim(); if (c && G.GOB) G.GOB.color = c; }
const PARL = ["PSOE","PP","VOX","SUMAR","ERC","JUNTS","BILDU","PNV","MIXTO"];
const TONES = ["combativo","crítico","irónico","defensivo","técnico","conciliador","propositivo"];
const TONEVAR = {"combativo":"--t-combativo","crítico":"--t-critico","irónico":"--t-ironico","defensivo":"--t-defensivo","técnico":"--t-tecnico","conciliador":"--t-conciliador","propositivo":"--t-propositivo"};
const VLABEL = {S:"Sí",N:"No",A:"Abst.",D:"Dividido","?":"s/d"};
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const $ = (s,el=document)=>el.querySelector(s);
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = n => n.toLocaleString("es-ES");
const dt = iso => { const [y,m,d]=iso.split("-").map(Number); const x=new Date(y,m-1,d); return {d, m:MESES[m-1], w:DIAS[x.getDay()]}; };
const gdot = g => `<span class="dot" style="background:${G[g].color}"></span>`;
const gname = g => g==="GOB"?"Gobierno":g==="COMP"?"Compareciente":g;
const toneChip = t => `<span class="tone"><i style="background:var(${TONEVAR[t]})"></i>${esc(t)}</span>`;
const intMeter = n => `<span class="int" title="Intensidad ${n} de 5" aria-label="Intensidad ${n} de 5">${[1,2,3,4,5].map(i=>`<i class="${i<=n?"on":""}"></i>`).join("")}</span>`;
const VOTES = Object.fromEntries(DATA.votaciones.map(v=>[v.id,v]));
const passed = v => v.si > v.no;
const resLabel = v => {
  if (v.tipo==="Convalidación RDL" && !v.titulo.startsWith("Tramitar")) return passed(v)?"Convalidado":"Derogado";
  if (v.tipo==="Toma en consideración") return passed(v)?"Tomada en consideración":"Rechazada";
  return passed(v)?"Aprobada":"Rechazada";
};

function toneBar(list){
  const c = {}; list.forEach(i=>c[i.tono]=(c[i.tono]||0)+1);
  const n = list.length||1;
  return `<div class="tonebar" role="img" aria-label="${TONES.filter(t=>c[t]).map(t=>`${t}: ${c[t]}`).join(", ")}">${TONES.filter(t=>c[t]).map(t=>`<i style="width:${c[t]/n*100}%;background:var(${TONEVAR[t]})" title="${t}: ${c[t]}"></i>`).join("")}</div>`;
}
function toneLegend(list){
  const c = {}; list.forEach(i=>c[i.tono]=(c[i.tono]||0)+1);
  return `<div class="legend">${TONES.filter(t=>c[t]).map(t=>`<span><i class="dot" style="background:var(${TONEVAR[t]})"></i>${t} <span class="num">${c[t]}</span></span>`).join("")}</div>`;
}
function voteRow(v, compact){
  const tot = v.si+v.no+v.abst+v.novota;
  const w = x => (x/tot*100).toFixed(2)+"%";
  const gp = PARL.map(g=>{ const x=v.grupos[g]||"?"; return `<span class="gp ${x==="?"?"q":x}" title="${G[g].nombre}: ${VLABEL[x]}">${gdot(g)}${g}<span class="v">${VLABEL[x]}</span></span>`; }).join("");
  const d = dt(v.fecha);
  const hemi = (v.v && v.v.length===DIPS.length) || (v.conteo && Object.keys(v.conteo).length);
  return `<article class="vote${hemi?" con-hemi":""}" id="v-${v.id}">${hemi?`<div class="hemi-col"><div class="hemi-lazy" data-hemi="${v.id}" role="img" aria-label="Hemiciclo de la votación"></div></div>`:""}
    <div class="vote-h"><div class="t">${esc(v.titulo)}<div class="sub">${compact?"":`${d.d} ${d.m} · `}${tipoGlosa(v.tipo)} · ${v.proponente==="GOB"?"Gobierno":esc(v.proponente)} · ${v.exp?`<button class="expbtn mono" data-ini="${esc(v.exp)}" data-tip="Ver la iniciativa ${esc(v.exp)}">${esc(v.exp)}</button>`:""}${v.titulo_fuente==="oficial"?" "+`<span class="oficial" data-tip="Título abreviado del texto oficial del expediente. Conserva las palabras del grupo que presenta la iniciativa.">título oficial</span>`:""}</div></div>
      <span class="vote-acc"><span class="res ${passed(v)?"ok":"ko"}">${resLabel(v)}</span>${botonCompartir("votacion/"+v.id, v.titulo)}</span></div>
    ${significa(v)?`<p class="significa"><b>¿Qué significa?</b> ${esc(significa(v))}</p>`:""}
    <div class="stack" role="img" aria-label="Sí ${v.si}, No ${v.no}, Abstenciones ${v.abst}, No votan ${v.novota}">
      <i style="width:${w(v.si)};background:var(--si)"></i><i style="width:${w(v.abst)};background:var(--abst)"></i><i style="width:${w(v.novota)};background:var(--nv)"></i><i style="width:${w(v.no)};background:var(--no)"></i><span class="half"></span></div>
    <div class="counts num"><span><i class="dot" style="background:var(--si)"></i>Sí <b>${v.si}</b></span><span><i class="dot" style="background:var(--no)"></i>No <b>${v.no}</b></span><span><i class="dot" style="background:var(--abst)"></i>Abst. <b>${v.abst}</b></span><span><i class="dot" style="background:var(--nv)"></i>No votan <b>${v.novota}</b></span><a href="${v.json}" target="_blank" rel="noopener">${/\.pdf$/i.test(v.json||"")?"Diario de Sesiones (votación por llamamiento)":"JSON oficial"}</a></div>
    <div class="gpos">${gp}</div>
    ${porqueVoto(v)}
    ${decideNota(v)}
    ${(v.discrepantes||[]).length?`<p class="nota">Votaron distinto a su grupo: ${esc(v.discrepantes.slice(0,12).join(", "))}${v.discrepantes.length>12?` y ${v.discrepantes.length-12} más`:""}</p>`:""}
  </article>`;
}
function porqueVoto(v){
  const gs = PARL.filter(g=>v.porque?.[g]);
  if (!gs.length) return "";
  return `<details class="porque"><summary>Por qué votó así cada grupo</summary><ul>${gs.map(g=>{ const [m,o,s,f]=v.porque[g], x=v.grupos[g]||"?";
    return `<li><span class="gp ${x}">${gdot(g)}${g}<span class="v">${VLABEL[x]}</span></span><span>${esc(m)} <button class="linklike quien" data-irs="${esc(s)}" data-f="${esc(f)}">${esc(o)}</button></span></li>`; }).join("")}</ul>
    <p class="nota">Motivo resumido con IA a partir del debate de esta iniciativa en el Diario de Sesiones. Solo aparece si lo que dijo el grupo coincide con lo que votó.</p></details>`;
}
function ivCard(i){
  const pos = i.pos ? `<span class="pill pos-${i.pos.replace(/ /g,"-")}">${esc(i.pos[0].toUpperCase()+i.pos.slice(1))}</span>` : "";
  const comp = (i.comp||[]).map(c=>`<div class="compromiso"><b>${esc(c.que)}</b>${c.plazo?` <span class="plazo">· ${esc(c.plazo)}</span>`:""}<br><q>${esc(c.cita)}</q></div>`).join("");
  const extra = [
    comp ? `<div><div class="eyebrow">Se compromete a</div>${comp}</div>` : "",
    (i.prop||[]).length ? `<div><div class="eyebrow">Propone</div><ul>${i.prop.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>` : "",
    (i.cifras||[]).length ? `<details class="cifras"><summary>${i.cifras.length} ${i.cifras.length===1?"dato citado":"datos citados"}</summary><ul>${i.cifras.map(c=>`<li><b>${esc(c.dato)}</b> <q>${esc(c.cita)}</q></li>`).join("")}</ul></details>` : "",
  ].filter(Boolean).join("");
  const pend = i.d!=null && !i._det;
  return `<div class="iv"${pend?` data-pend data-id="${i._id}"`:""}><span class="bar" style="background:${G[i.g].color}"></span><div>
    <div class="iv-h"><b>${esc(i.orador)}</b><span class="rol">${esc(i.rol)}</span>${toneChip(i.tono)}${intMeter(i.int)}</div>
    ${i.frase?`<p class="frase">${esc(i.frase)}</p>`:""}
    ${i.resumen?`<p>${esc(i.resumen)}</p>`:pend?`<p class="nota">Cargando el resumen…</p>`:""}
    ${i.cita?`<blockquote><mark>«${esc(i.cita)}»</mark></blockquote>`:""}
    ${pos?`<p class="nota">${pos} ${esc(i.motivo||"")}</p>`:""}
    ${i.responde && i.responde!=="no aplica"?`<p class="nota"><span class="pill resp-${i.responde==="sí"?"si":i.responde}">¿Contesta? ${esc(i.responde)}</span> ${esc(i.responde_motivo||"")}</p>`:""}
    ${extra?`<div class="iv-extra">${extra}</div>`:""}
    <div class="tags">${i.temas.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}${(i.lugares||[]).map(t=>`<span class="tag lugar" title="Lugar del que se habla">${esc(t)}</span>`).join("")}${(i.leyes||[]).map(t=>`<span class="tag ley" title="Norma o iniciativa mencionada">${esc(t)}</span>`).join("")}</div>
  </div></div>`;
}

/* ---------- hemiciclo ---------- */
// Orden de izquierda a derecha según la convención habitual de estos gráficos; el Mixto, que reúne partidos
// de ideologías distintas, va en el centro.
const ORDEN_HEMI = ["SUMAR","BILDU","ERC","PSOE","MIXTO","PNV","JUNTS","PP","VOX"];
const ORDEN_VOTO = {S:0,A:1,N:2,X:3};
const FORMA_ASIENTO = getComputedStyle(document.documentElement).getPropertyValue("--asiento").trim();
const DIPS = DATA.diputados || [];
const LEG = INDICE?.meta?.legislatura || "XV";   // legislatura de los datos (enlaces a las fichas del Congreso)
const _layouts = {};
function asientos(N){
  if (_layouts[N]) return _layouts[N];
  const filas = N>200 ? 12 : Math.max(3, Math.round(Math.sqrt(N/1.8)));
  const r0 = .4, radios = Array.from({length:filas},(_,i)=>r0+(1-r0)*i/(filas-1));
  const suma = radios.reduce((a,b)=>a+b,0);
  const n = radios.map(r=>Math.round(N*r/suma));
  n[filas-1] += N - n.reduce((a,b)=>a+b,0);
  const out = [];
  radios.forEach((r,i)=>{ for(let j=0;j<n[i];j++){ const a=Math.PI*(1-j/Math.max(1,n[i]-1)); out.push({a, r, x:100*r*Math.cos(a), y:-100*r*Math.sin(a)}); } });
  out.sort((p,q)=>q.a-p.a || p.r-q.r);
  const paso = Math.min(...radios.map((r,i)=>Math.PI*r*100/Math.max(1,n[i]-1)), (1-r0)*100/(filas-1));
  return _layouts[N] = {pts: out, rad: paso*.42};
}
// Grupo desde el que votó el diputado i en v (cg lleva solo los cambios respecto a su grupo actual).
const fechaCorta = iso => { const [y,m,dd]=iso.split("-").map(Number); return `${dd} ${MESES[m-1]} ${y}`; };
const grupoEn = (v,i) => v.cg?.[i] || DIPS[i][1];
function escanosDe(v){
  // Lista de {n, g, x} por diputado: del voto nominal si lo hay; si no, del recuento por grupo.
  let lista = [];
  if (v.v && DIPS.length===v.v.length){
    for (let i=0;i<v.v.length;i++){ const x=v.v[i]; if (x!=="-") lista.push({n:DIPS[i][0], g:grupoEn(v,i), x, i}); }
  } else if (v.conteo && Object.keys(v.conteo).length){
    for (const [g,c] of Object.entries(v.conteo)) for (const [x,k] of Object.entries(c)) for (let i=0;i<k;i++) lista.push({n:"", g, x});
  } else return null;
  const pos = g => { const i=ORDEN_HEMI.indexOf(g); return i<0?99:i; };
  lista.sort((a,b)=>pos(a.g)-pos(b.g) || (ORDEN_VOTO[a.x]??9)-(ORDEN_VOTO[b.x]??9) || a.n.localeCompare(b.n,"es"));
  return lista;
}
// Plano real del hemiciclo (coordenadas de cada escaño en la página oficial del Congreso).
const PLANO = DATA.hemiciclo || null;
// Hay plano si casi todos los diputados de hoy tienen escaño en él (quien dejó el acta puede no tenerlo).
const CON_PLANO = !!PLANO && DIPS.filter(d=>!d[8] && d[5]!=null).length >= DIPS.filter(d=>!d[8]).length*.9;
const ESC_R = 5.3;
function gobiernoSinEscano(){
  // Ministros que no son diputados: se sientan en el banco azul, pero no votan.
  return (PLANO?.gobierno||[]).map(m=>`<circle class="gob" cx="${m.x}" cy="${m.y}" r="${ESC_R-.8}" data-n="${esc(m.nombre)}" data-g="GOB" data-x="-" data-tip="${esc(`<b>${esc(m.nombre.split(", ").reverse().join(" "))}</b><br>${esc(m.cargo||"Gobierno")}<br>No es diputado: no vota`)}"></circle>`).join("");
}
function hemicicloReal(v, lista, {anim=false}={}){
  const conPlano = lista.filter(e=>e.i!=null && DIPS[e.i][5]!=null);
  const cx = PLANO.ancho/2, cy = PLANO.alto;
  conPlano.sort((a,b)=>Math.hypot(DIPS[a.i][5]-cx,DIPS[a.i][6]-cy)-Math.hypot(DIPS[b.i][5]-cx,DIPS[b.i][6]-cy));
  const discrepa = e => ["S","N","A"].includes(e.x) && ["S","N","A"].includes(v.grupos[e.g]) && e.x!==v.grupos[e.g];
  const cuadrado = FORMA_ASIENTO==="cuadrado", escala = FORMA_ASIENTO==="punto" ? .7 : 1;
  const seats = conPlano.map((e,k)=>{ const x=DIPS[e.i][5], y=DIPS[e.i][6], r=(e.x==="X"?ESC_R-.7:ESC_R)*escala;
    const attrs = `class="${e.x}${discrepa(e)?" dis":""}"${anim?` style="--d:${k}"`:""} data-n="${esc(e.n)}" data-g="${e.g}" data-x="${e.x}"${discrepa(e)?' data-dis="1"':""}`;
    return cuadrado ? `<rect x="${(x-r*.85).toFixed(1)}" y="${(y-r*.85).toFixed(1)}" width="${(r*1.7).toFixed(1)}" height="${(r*1.7).toFixed(1)}" rx="1" ${attrs}></rect>`
      : `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" ${attrs}></circle>`; }).join("");
  const aria = `Hemiciclo con la disposición real de los escaños: Sí ${v.si}, No ${v.no}, Abstenciones ${v.abst}, No votan ${v.novota}`;
  return `<svg class="hemi real${anim?" anim":""}" viewBox="-4 -4 ${PLANO.ancho+8} ${PLANO.alto+4}" role="img" aria-label="${aria}">${gobiernoSinEscano()}${seats}</svg>`;
}
function hemiciclo(v, {grande=false, anim=false}={}){
  const lista = escanosDe(v);
  if (!lista) return "";
  if (CON_PLANO && lista.some(e=>e.i!=null)) return hemicicloReal(v, lista, {anim});
  const {pts, rad} = asientos(lista.length);
  const discrepa = e => ["S","N","A"].includes(e.x) && ["S","N","A"].includes(v.grupos[e.g]) && e.x!==v.grupos[e.g];
  const cuadrado = FORMA_ASIENTO==="cuadrado";
  const escala = FORMA_ASIENTO==="punto" ? .62 : 1;
  const circ = lista.map((e,k)=>{ const p=pts[k]; e.a=p.a; const r=(e.x==="X"?rad-.6:rad)*escala;
    const attrs = `class="${e.x}${discrepa(e)?" dis":""}"${anim?` style="--d:${k}"`:""} data-n="${esc(e.n)}" data-g="${e.g}" data-x="${e.x}"${discrepa(e)?' data-dis="1"':""}`;
    return cuadrado ? `<rect x="${(p.x-r*.85).toFixed(1)}" y="${(p.y-r*.85).toFixed(1)}" width="${(r*1.7).toFixed(2)}" height="${(r*1.7).toFixed(2)}" rx=".5" ${attrs}></rect>`
      : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(2)}" ${attrs}></circle>`; }).join("");
  // Arco exterior con el color de cada grupo.
  const bandas = ORDEN_HEMI.map(g=>{ const s=lista.filter(e=>e.g===g); if(!s.length) return "";
    const a1=Math.max(...s.map(e=>e.a))+.012, a2=Math.min(...s.map(e=>e.a))-.012, R=108;
    const P=a=>`${(R*Math.cos(a)).toFixed(1)} ${(-R*Math.sin(a)).toFixed(1)}`;
    const lab = grande && s.length>=20 ? (()=>{const am=(a1+a2)/2, Rl=118; return `<text class="glab" x="${(Rl*Math.cos(am)).toFixed(1)}" y="${(-Rl*Math.sin(am)+2.5).toFixed(1)}" text-anchor="middle">${g}</text>`;})() : "";
    return `<path class="band" d="M${P(a1)} A${R} ${R} 0 0 1 ${P(a2)}" stroke="${G[g]?.color||"#999"}"/>${lab}`; }).join("");
  const top = grande ? -128 : -112;
  const aria = `Hemiciclo: Sí ${v.si}, No ${v.no}, Abstenciones ${v.abst}, No votan ${v.novota}`;
  return `<svg class="hemi${anim?" anim":""}" viewBox="-124 ${top} 248 ${-top+8}" role="img" aria-label="${aria}">${bandas}${circ}</svg>`;
}
const hemiLeyenda = () => `<div class="hemi-legend"><span><i style="background:var(--si)"></i>Sí</span><span><i style="background:var(--no)"></i>No</span><span><i style="background:var(--abst)"></i>Abstención</span><span><i class="hueco"></i>No vota</span><span><i class="anillo"></i>Distinto a su grupo</span></div>`;

// Tooltip de los escaños.
const tip = $("#tip");
document.addEventListener("pointerover", e=>{
  const dt_ = e.target.closest?.("[data-tip]");
  if (dt_){ tip.innerHTML = dt_.dataset.tip; const b=dt_.getBoundingClientRect(); tip.style.left=(b.left+b.width/2)+"px"; tip.style.top=b.top+"px"; tip.hidden=false; return; }
  const c = e.target.closest?.(".hemi [data-x]"); if(!c){ tip.hidden=true; return; }
  const g=c.dataset.g, x=c.dataset.x;
  const dFoto = fotoDip(DIP_NOMBRE[c.dataset.n]);
  tip.innerHTML = `${dFoto?`<img class="tip-foto" src="${dFoto}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`:""}${c.dataset.n?`<b>${esc(c.dataset.n.split(", ").reverse().join(" "))}</b><br>`:""}${esc(G[g]?.nombre||g)}${x in MIVOTO?` · ${MIVOTO[x]}`:""}${c.dataset.dis?"<br>Votó distinto a su grupo":""}${c.dataset.extra?`<br>${esc(c.dataset.extra)}`:""}`;
  const b=c.getBoundingClientRect(); tip.style.left=(b.left+b.width/2)+"px"; tip.style.top=b.top+"px"; tip.hidden=false;
}, SIG);
window.addEventListener("scroll", ()=>{ tip.hidden=true; }, {passive:true, signal:ctl.signal});

if (DATA.meta.datos_hasta){ const [y,m,d] = DATA.meta.datos_hasta.split("-").map(Number); $("#gen").textContent = `Datos hasta el ${d} de ${MESES_LARGOS[m-1]} de ${y}`; }

/* ---------- temas ---------- */
const COLS_TEMA = [...ORDEN_HEMI, "GOB"];
const TEMAS = (()=>{
  const m = {};
  IVS.filter(i=>i.g!=="COMP" && i.g!=="?").forEach(i=>new Set(i.temas.map(t=>t.toLowerCase())).forEach(k=>{
    const e = m[k] ||= {k, formas:{}, n:0, porG:{}, ivs:[]};
    const forma = i.temas.find(t=>t.toLowerCase()===k); e.formas[forma]=(e.formas[forma]||0)+1;
    e.n++; e.porG[i.g]=(e.porG[i.g]||0)+1; e.ivs.push(i);
  }));
  return Object.values(m).map(e=>({...e, label:Object.entries(e.formas).sort((a,b)=>b[1]-a[1])[0][0]}))
    .sort((a,b)=>b.n-a.n || a.label.localeCompare(b.label,"es"));
})();
let temaSel = TEMAS[0]?.k;
const gLabel = g => g==="GOB"?"Gob.":g;
function rankTemas(lista, {sel=null, max=null}={}){
  const top = lista[0]?.n || 1;
  return `<div class="rank" role="list">${lista.map(t=>{
    const gs = COLS_TEMA.filter(g=>t.porG[g]);
    return `<button class="rank-row" role="listitem" data-tema-sel="${esc(t.k)}" ${sel?`aria-pressed="${t.k===sel}"`:""}
      data-tip="${esc(`<b>${esc(t.label)}</b><br>${t.n} intervenciones · ${gs.map(g=>`${gLabel(g)} ${t.porG[g]}`).join(" · ")}`)}">
      <span class="lab">${esc(t.label)}</span>
      <span class="trk"><span class="br" style="width:${(t.n/top*100*.78).toFixed(1)}%"></span><span class="n">${t.n}</span>
        <span class="gs" aria-label="${gs.map(gLabel).join(", ")}">${gs.map(g=>`<i style="background:${G[g].color}"></i>`).join("")}</span></span>
    </button>`; }).join("")}</div>`;
}
function matrizTemas(lista, sel=null){
  const max = Math.max(...lista.flatMap(t=>COLS_TEMA.map(g=>t.porG[g]||0)), 1);
  const cols = COLS_TEMA.filter(g=>lista.some(t=>t.porG[g]));
  const R = 13;
  return `<div class="mx-wrap"><table class="mx"><thead><tr><th></th>${cols.map(g=>`<th scope="col"><i style="background:${G[g].color}"></i>${gLabel(g)}</th>`).join("")}<th></th></tr></thead>
    <tbody>${lista.map(t=>`<tr data-tema-sel="${esc(t.k)}" class="${t.k===sel?"sel":""}"><th scope="row">${esc(t.label)}</th>${cols.map(g=>{ const n=t.porG[g]||0; if(!n) return `<td></td>`;
      const d = 2*Math.max(3.5, R*Math.sqrt(n/max));
      return `<td data-tip="${esc(`<b>${G[g].nombre}</b> sobre ${esc(t.label)}: ${n} ${n===1?"intervención":"intervenciones"}`)}" aria-label="${G[g].nombre}: ${n}"><span style="width:${d.toFixed(1)}px;height:${d.toFixed(1)}px;background:${G[g].color}"></span></td>`; }).join("")}<td class="tot">${t.n}</td></tr>`).join("")}</tbody></table></div>`;
}
function intensidadTema(t){
  // Una fila por grupo: un punto por nivel de intensidad (1-5), área = nº de intervenciones; la marca negra es la media.
  const gs = COLS_TEMA.filter(g=>t.porG[g]);
  const W=420, L=58, Rt=14, fila=30, H=gs.length*fila+26;
  const x = v => L + (v-1)/4*(W-L-Rt);
  const maxc = Math.max(...gs.flatMap(g=>[1,2,3,4,5].map(v=>t.ivs.filter(i=>i.g===g&&i.int===v).length)),1);
  const filas = gs.map((g,r)=>{ const y=14+r*fila, iv=t.ivs.filter(i=>i.g===g), media=iv.reduce((a,i)=>a+i.int,0)/iv.length;
    const pts=[1,2,3,4,5].map(v=>{ const c=iv.filter(i=>i.int===v).length; if(!c) return "";
      return `<circle cx="${x(v)}" cy="${y}" r="${(4+6*Math.sqrt(c/maxc)).toFixed(1)}" fill="${G[g].color}" data-tip="${esc(`<b>${G[g].nombre}</b><br>${c} ${c===1?"intervención":"intervenciones"} de intensidad ${v}`)}"/>`; }).join("");
    return `<line class="ax" x1="${L}" x2="${W-Rt}" y1="${y}" y2="${y}"/><text class="g" x="0" y="${y+4}">${gLabel(g)}</text>${pts}<rect class="mean" x="${(x(media)-1.5).toFixed(1)}" y="${y-9}" width="3" height="18" rx="1.5" data-tip="${esc(`${G[g].nombre}: intensidad media ${media.toFixed(1).replace(".",",")}`)}"/>`; }).join("");
  const ejes = [1,2,3,4,5].map(v=>`<text x="${x(v)}" y="${H-2}" text-anchor="middle">${v}</text>`).join("");
  return `<div class="dotplot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Intensidad de las intervenciones sobre ${esc(t.label)} por grupo">${filas}${ejes}</svg></div>
    <div class="legend"><span>1 = sereno · 5 = confrontación directa</span><span><i class="dot" style="background:var(--ink);border-radius:1px;width:3px;height:12px"></i>media del grupo</span><span>tamaño = nº de intervenciones</span></div>`;
}
function detalleTema(t){
  const citas = t.ivs.filter(i=>i.cita).sort((a,b)=>COLS_TEMA.indexOf(a.g)-COLS_TEMA.indexOf(b.g)).slice(0,5);
  return `<div class="chart"><h3>Con qué intensidad</h3><p class="sub">${esc(t.label)}: ${t.n} intervenciones de ${Object.keys(t.porG).length} grupos.</p>${intensidadTema(t)}</div>
    <div class="chart"><h3>Qué dijeron</h3><p class="sub">Citas literales del Diario de Sesiones, en orden de izquierda a derecha.</p>
      <div class="citas">${citas.map(i=>`<figure><blockquote><mark>«${esc(i.cita)}»</mark></blockquote><figcaption>${gdot(i.g)}${esc(i.orador)} · ${esc(gname(i.g))}</figcaption></figure>`).join("") || '<p class="nota">No hay citas verificadas sobre este tema.</p>'}</div>
      <button class="linklike" data-tema="${esc(t.label)}">Ver las ${t.n} intervenciones</button></div>`;
}
function renderTemas(){
  const lista = TEMAS.slice(0,15);
  if (!lista.length){ $("#temas").innerHTML = `<div class="view-intro"><div><h2>Temas</h2></div></div>${seguirTemas()}`; return; }
  const t = TEMAS.find(x=>x.k===temaSel) || lista[0];
  $("#temas").innerHTML = `
    <div class="view-intro"><div><h2>Temas</h2><p>De qué se habló en ${esc(DATA.meta.periodo)}, quién lo sacó y con qué tono. Los temas los asigna la IA a cada intervención; una intervención puede tener varios. Pulsa un tema para ver el detalle.</p></div></div>
    ${seguirTemas()}
    <div class="temas-top">
      <div class="chart"><h3>Los más repetidos</h3><p class="sub">Intervenciones que tocan cada tema. Los puntos son los grupos que hablaron de él.</p>${rankTemas(lista,{sel:t.k})}</div>
      <div class="chart"><h3>Quién habla de qué</h3><p class="sub">Área del círculo = intervenciones del grupo sobre el tema.</p>${matrizTemas(lista, t.k)}</div>
    </div>
    <h2 style="font-size:24px;margin-top:10px">${esc(t.label[0].toUpperCase()+t.label.slice(1))}</h2>
    <div class="tema-panel">${detalleTema(t)}</div>`;
}

/* ---------- quién decide ---------- */
function conteoDe(v){
  if (v.conteo && Object.keys(v.conteo).length) return v.conteo;
  const c = {}; (escanosDe(v)||[]).forEach(e=>{ (c[e.g] ||= {})[e.x]=(c[e.g][e.x]||0)+1; }); return c;
}
function decide(v){
  // Un grupo decide «con su voto» si, de haberse abstenido en bloque, el resultado habría sido otro;
  // decide «con su abstención» si, de haber votado en bloque con el bando perdedor, el resultado habría sido otro.
  const aprobada = passed(v), out = [];
  for (const [g,c] of Object.entries(conteoDe(v))){
    const s=c.S||0, n=c.N||0, a=c.A||0;
    if (aprobada){ if (s && v.si-s <= v.no) out.push({g,tipo:"voto",n:s}); else if (a && v.si <= v.no+a) out.push({g,tipo:"abs",n:a}); }
    else { if (n && v.si > v.no-n) out.push({g,tipo:"voto",n}); else if (a && v.si+a > v.no) out.push({g,tipo:"abs",n:a}); }
  }
  out.sort((x,y)=>ORDEN_HEMI.indexOf(x.g)-ORDEN_HEMI.indexOf(y.g));
  const bastan = aprobada ? Math.ceil((v.si-v.no)/2) : Math.floor((v.no-v.si)/2)+1;
  return {grupos:out, bastan};
}
function decideNota(v){
  const d = decide(v);
  if (!d.grupos.length && margen(v)>10) return "";
  return `<p class="decide-note"><span class="eyebrow" style="letter-spacing:.06em">Quién decide</span>${d.grupos.map(x=>`<span class="gp" data-tip="${esc(`${G[x.g].nombre}: ${x.tipo==="voto"?`si sus ${x.n} diputados se hubieran abstenido`:`si sus ${x.n} abstenciones hubieran sido votos ${passed(v)?"en contra":"a favor"}`}, el resultado habría sido otro`)}">${gdot(x.g)}${x.g}<span class="v" style="color:var(--muted)">${x.tipo==="voto"?"con su voto":"absteniéndose"}</span></span>`).join("")}
    <span style="color:var(--muted)">· Bastaban ${d.bastan} ${d.bastan===1?"diputado":"diputados"} cambiando su voto para darle la vuelta</span></p>`;
}
function rankingDecide(){
  const cuenta = {}; DATA.votaciones.forEach(v=>decide(v).grupos.forEach(x=>{ const c=(cuenta[x.g] ||= {voto:0,abs:0}); c[x.tipo]++; }));
  const filas = ORDEN_HEMI.filter(g=>cuenta[g]).sort((a,b)=>(cuenta[b].voto+cuenta[b].abs)-(cuenta[a].voto+cuenta[a].abs));
  if (!filas.length) return "";
  const max = Math.max(...filas.map(g=>cuenta[g].voto+cuenta[g].abs));
  return `<div class="decide-rank">${filas.map(g=>{ const c=cuenta[g], t=c.voto+c.abs;
    return `<div class="decide-row" data-tip="${esc(`<b>${G[g].nombre}</b> (${G[g].escanos||"?"} escaños)<br>Decidió ${t} de ${DATA.votaciones.length} votaciones: ${c.voto} con su voto, ${c.abs} con su abstención`)}"><span class="g">${gdot(g)}${g}</span>
      <span class="trk">${c.voto?`<i class="voto" style="width:${c.voto/max*100}%"></i>`:""}${c.abs?`<i class="abs" style="width:${c.abs/max*100}%"></i>`:""}</span><span class="n">${t}</span></div>`; }).join("")}</div>
    <div class="key"><span><i style="background:var(--ink)"></i>con su voto</span><span><i style="background:color-mix(in srgb,var(--ink) 35%,var(--surface))"></i>con su abstención</span></div>`;
}
const decideIntro = `Un grupo decide una votación si, de haber actuado de otra forma en bloque, el resultado habría cambiado: absteniéndose en vez de votar, o votando con el bando perdedor en vez de abstenerse. Cuantos más escaños, más fácil es decidir; lo llamativo es cuando lo hace un grupo pequeño.`;

/* ---------- diputados ---------- */
const sinTildes = t => t.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const slug = n => sinTildes(n).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const legible = n => n.includes(", ") ? n.split(", ").reverse().join(" ") : n;
const DIP = DIPS.map((d,i)=>({i, n:d[0], g:d[1], circ:d[2]||"", form:d[3]||"", alta:d[4]||"", cod:d[7]||null, baja:d[8]||"", slug:slug(d[0])}));
const DIP_NOMBRE = Object.fromEntries(DIP.map(d=>[d.n,d]));
// Foto y ficha oficiales del Congreso, a partir del código del diputado (vienen del plano del hemiciclo).
const fotoDip = d => d?.cod ? `https://www.congreso.es/docu/imgweb/diputados/${d.cod}_15.jpg` : null;
const fichaOficial = d => `https://www.congreso.es/es/hemiciclo?p_p_id=diputadomodule&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_diputadomodule_mostrarFicha=true&codParlamentario=${d.cod}&idLegislatura=${LEG}`;
// «lazy» solo en listados largos; las fotos que se ven siempre se piden en el momento.
const imgFoto = (d, cls, extra="", lazy=false) => fotoDip(d) ? `<img class="${cls}" src="${fotoDip(d)}" alt=""${lazy?' loading="lazy"':""} referrerpolicy="no-referrer" onerror="this.remove()"${extra}>` : "";
const DIP_SLUG = Object.fromEntries(DIP.map(d=>[d.slug,d]));
const porApellidos = {};
DIP.forEach(d=>{ const k=sinTildes(d.n.split(",")[0]).trim(); (porApellidos[k] ||= []).push(d); });
const dipDeOrador = orador => { const c=porApellidos[sinTildes(orador).trim()]; return c && c.length===1 ? c[0] : null; };
const VOTOS_NOM = DATA.votaciones.filter(v=>v.v && v.v.length===DIPS.length).sort((a,b)=>b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id, undefined, {numeric:true}));
const MIVOTO = {S:"Sí",N:"No",A:"Abstención",X:"No vota"};
const statsDip = (() => {
  const st = DIP.map(()=>({vot:0, aus:0, dis:0, con:0}));
  VOTOS_NOM.forEach(v=>DIP.forEach(d=>{ const x=v.v[d.i]; if(x==="-") return; const s=st[d.i];
    if (x==="X") { s.aus++; return; } s.vot++; const gp=v.grupos[grupoEn(v,d.i)]; if (["S","N","A"].includes(gp)) { if (x===gp) s.con++; else s.dis++; } }));
  const ivsPor = {}; IVS.forEach(i=>{ const d=dipDeOrador(i.orador); if (d) (ivsPor[d.i] ||= []).push(i); });
  return st.map((s,i)=>({...s, part: s.vot+s.aus ? s.vot/(s.vot+s.aus) : null, lealtad: s.con+s.dis ? s.con/(s.con+s.dis) : null, ivs: ivsPor[i]||[]}));
})();
const pct = x => x==null ? "–" : `${Math.round(x*100)} %`;
const pctBar = x => x==null ? "–" : `<span class="pct">${pct(x)}<i><b style="width:${x*100}%"></b></i></span>`;
let dipFiltro = {q:"", g:"TODOS", orden:"dis", circ:null, vista:"fotos"};
let dipSel = null;
function hemiDiputado(d){
  if (CON_PLANO && DIPS[d.i][5]!=null){
    const mismoSitio = e => DIPS[e.i][5]===DIPS[d.i][5] && DIPS[e.i][6]===DIPS[d.i][6];
    const seats = DIP.filter(e=>DIPS[e.i][5]!=null && (e===d || (!e.baja && !(d.baja && mismoSitio(e))))).map(e=>{ const yo=e===d, x=DIPS[e.i][5], y=DIPS[e.i][6];
      return `<circle class="${yo?"yo":"otro"}" cx="${x}" cy="${y}" r="${yo?ESC_R*1.7:ESC_R}" ${yo?"":`fill="${G[e.g]?.color}"`} data-n="${esc(e.n)}" data-g="${e.g}" data-x="-"></circle>`; }).join("");
    return `<svg class="hemi real" viewBox="-4 -4 ${PLANO.ancho+8} ${PLANO.alto+4}" role="img" aria-label="Su escaño en el hemiciclo">${gobiernoSinEscano()}${seats}</svg>`;
  }
  // Todos los escaños por grupo; el del diputado, en tinta.
  const lista = DIP.slice().sort((a,b)=>ORDEN_HEMI.indexOf(a.g)-ORDEN_HEMI.indexOf(b.g) || a.n.localeCompare(b.n,"es"));
  const {pts, rad} = asientos(lista.length);
  return `<svg class="hemi" viewBox="-124 -112 248 120" role="img" aria-label="Posición en el hemiciclo por grupo">${lista.map((e,k)=>{ const p=pts[k], yo=e===d;
    return `<circle class="${yo?"yo":"otro"}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(yo?rad*1.9:rad).toFixed(2)}" ${yo?"":`fill="${G[e.g]?.color}"`} data-n="${esc(e.n)}" data-g="${e.g}" data-x="-"></circle>`; }).join("")}</svg>`;
}
function renderDiputados(){
  if (dipSel && DIP_SLUG[dipSel]) return renderFicha(DIP_SLUG[dipSel]);
  const q = sinTildes(dipFiltro.q.trim());
  let lista = DIP.filter(d=>(dipFiltro.g==="BAJA" ? d.baja : !d.baja && (dipFiltro.g==="TODOS"||d.g===dipFiltro.g)) && (!dipFiltro.circ || d.circ===dipFiltro.circ) && (!q || sinTildes(d.n+" "+legible(d.n)+" "+d.circ).includes(q)));
  const S = statsDip, ord = dipFiltro.orden;
  lista.sort((a,b)=> ord==="dis" ? S[b.i].dis-S[a.i].dis || a.n.localeCompare(b.n,"es")
    : ord==="part" ? (S[a.i].part??2)-(S[b.i].part??2) || a.n.localeCompare(b.n,"es")
    : ord==="ivs" ? S[b.i].ivs.length-S[a.i].ivs.length || a.n.localeCompare(b.n,"es")
    : a.n.localeCompare(b.n,"es"));
  const nBajas = DIP.filter(d=>d.baja).length;
  const chips = ["TODOS",...ORDEN_HEMI].map(g=>`<button class="chipbtn" data-dg="${g}" aria-pressed="${dipFiltro.g===g}">${g==="TODOS"?"Todos":gdot(g)+g}</button>`).join("")
    + (nBajas ? `<button class="chipbtn" data-dg="BAJA" aria-pressed="${dipFiltro.g==="BAJA"}">Dejaron el escaño · ${nBajas}</button>` : "");
  const th = (k,l,cls="") => `<th class="${cls}"><button data-dord="${k}" aria-pressed="${ord===k}">${l}${ord===k?" ↓":""}</button></th>`;
  $("#diputados").innerHTML = `
    <div class="view-intro"><div><h2>Diputados</h2><p>Los 350 diputados con su voto en las ${VOTOS_NOM.length} votaciones incluidas: cuánto participan, cuántas veces se apartan de su grupo y cuántas intervenciones tienen analizadas. Pulsa uno para ver su ficha, o un escaño en cualquier hemiciclo.</p></div></div>
    ${bloqueTusDiputados()}
    <section class="sec dp-dir" id="dip-tabla"><div class="sec-h"><h2>Los 350</h2><p>Busca por nombre o provincia, filtra por grupo y ordena por lo que quieras ver.</p></div>
      <div class="or-barra">
        <label class="or-busca"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input id="dip-q" type="search" placeholder="Buscar por nombre o provincia…" value="${esc(dipFiltro.q)}" aria-label="Buscar diputado por nombre o provincia"></label>
        <div class="or-seg" role="group" aria-label="Vista">${[["fotos","Fotos"],["tabla","Tabla"]].map(([k,l])=>`<button type="button" data-dvista="${k}" aria-pressed="${dipFiltro.vista===k}">${l}</button>`).join("")}</div>
        <div class="or-seg" role="group" aria-label="Orden">${[["dis","Más veces por libre"],["part","Menos participación"],["ivs","Más intervenciones"],["nom","A–Z"]].map(([k,l])=>`<button type="button" data-dord="${k}" aria-pressed="${ord===k}">${l}</button>`).join("")}</div>
      </div>
      <div class="controls" id="dip-g">${chips}${dipFiltro.circ?`<button class="chipbtn" aria-pressed="true" data-circ="${esc(dipFiltro.circ)}">${esc(nombreCirc(dipFiltro.circ))} ✕</button><button class="linklike" data-prov="${esc(slug(dipFiltro.circ))}">Página de ${esc(nombreCirc(dipFiltro.circ))} →</button>`:""}</div>
      <p class="or-n-res">${lista.length} ${lista.length===1?"diputado":"diputados"}${dipFiltro.g!=="TODOS"&&dipFiltro.g!=="BAJA"?` · ${esc(G[dipFiltro.g]?.nombre||dipFiltro.g)}`:""}</p>
      ${dipFiltro.vista==="fotos" ? `<div class="dp-cards">${lista.map(d=>{ const s=S[d.i]; return `<button type="button" class="dp-card" data-dip="${d.slug}" style="--grupo:${G[d.g]?.color}">
          ${imgFoto(d, "dp-foto foto", "", true) || `<span class="dp-foto avatar" style="background:${G[d.g]?.color}">${esc(iniciales(legible(d.n)))}</span>`}
          <span class="dp-id"><b>${esc(legible(d.n))}</b><small>${gdot(d.g)}${esc(d.g)}${d.circ?` · ${esc(d.circ)}`:""}</small></span>
          <span class="dp-cifras"><span><b>${pct(s.part)}</b>participa</span><span><b>${s.dis||0}</b>por libre</span><span><b>${s.ivs.length||0}</b>interv.</span></span>
        </button>`; }).join("") || '<p class="nota">Nadie coincide con la búsqueda.</p>'}</div>`
      : `<div class="dtable-wrap"><table class="dt"><thead><tr>${th("nom","Diputado")}<th>Circunscripción</th>${th("part","Participación","num")}${th("dis","Distinto a su grupo","num")}${th("ivs","Interv.","num")}</tr></thead>
      <tbody>${lista.map(d=>{ const s=S[d.i]; return `<tr data-dip="${d.slug}"><td><span class="nm">${imgFoto(d, "mini-foto", ` style="--grupo:${G[d.g]?.color}"`, true) || gdot(d.g)}${esc(legible(d.n))}</span></td><td>${esc(d.circ)||"–"}</td><td class="num">${pctBar(s.part)}</td><td class="num">${s.dis||"·"}</td><td class="num">${s.ivs.length||"·"}</td></tr>`; }).join("") || `<tr><td colspan="5" class="nota">Nadie coincide con la búsqueda.</td></tr>`}</tbody></table></div>`}
      <p class="nota">Participación: votaciones en las que votó (sí, no o abstención) sobre las que le correspondían; una ausencia puede tener causas justificadas. «Por libre»: veces que votó distinto de la mayoría de su grupo.</p>
    </section>
    <section class="sec"><div class="sec-h"><h2>Dónde se sientan y de dónde vienen</h2></div>
    ${CON_PLANO?`<div class="chart"><h3>El hemiciclo</h3><p class="sub">Cada punto es un diputado en su escaño real. Elige qué mostrar o resalta a quien busques; pulsa un escaño para abrir su ficha.</p><div id="hemi-datos">${hemiDatos()}</div></div>`:""}
    <div class="chart"><h3>Por circunscripción</h3>${mapaCirc()}</div></section>`;
  pintarHemiDatos();
  if (!EXTRA) cargarExtra().then(()=>{ if (mapaHemi.metrica==="turnos") pintarHemiDatos(); });
  const inp=$("#dip-q");
  inp.addEventListener("input", e=>{ dipFiltro.q=e.target.value; const pos=e.target.selectionStart; renderDiputados(); const n=$("#dip-q"); n.focus(); n.setSelectionRange(pos,pos); });
}
function renderFicha(d){
  const s = statsDip[d.i], grupo = G[d.g];
  const alta = d.alta ? (()=>{ const [y,m,dd]=d.alta.split("-").map(Number); return `${dd} ${MESES[m-1]} ${y}`; })() : "";
  const filas = VOTOS_NOM.map(v=>{ const x=v.v[d.i]; if (x==="-") return ""; const gp=v.grupos[grupoEn(v,d.i)]||"?"; const dis=["S","N","A"].includes(x)&&["S","N","A"].includes(gp)&&x!==gp; const dd=dt(v.fecha);
    return `<tr class="${dis?"dis":""}"><td class="num" style="white-space:nowrap">${dd.d} ${dd.m}</td><td class="t"><button class="linklike" style="text-decoration:none;text-align:left;font-weight:400" data-go="votaciones" data-anchor="v-${v.id}">${esc(v.titulo)}</button></td>
      <td><span class="mivoto ${x}">${MIVOTO[x]}</span></td><td><span class="gp ${gp==="?"?"q":gp}">${grupoEn(v,d.i)}<span class="v">${VLABEL[gp]}</span></span></td><td><span class="res ${passed(v)?"ok":"ko"}">${resLabel(v)}</span></td></tr>`; }).join("");
  const kpis = [[pct(s.part),"participación",`${s.vot} de ${s.vot+s.aus} votaciones`],[pct(s.lealtad),"con su grupo",""],[s.dis,s.dis===1?"vez distinto a su grupo":"veces distinto a su grupo","",s.dis>0],[s.ivs.length,s.ivs.length===1?"intervención analizada":"intervenciones analizadas",""]]
    .map(([n,l,t,a])=>`<div class="kpi ${a?"alert":""}"${t?` title="${t}"`:""}><b>${n}</b><span>${l}</span></div>`).join("");
  $("#diputados").innerHTML = `
    <button class="back" data-dip-volver>← Todos los diputados</button>
    <div class="ficha-top">
      <div class="ficha-id">${imgFoto(d, "foto-dip", ` style="--grupo:${grupo?.color||"var(--line)"}"`)}<div><div class="eyebrow">${esc(d.circ||"Circunscripción sin dato")} · ${esc(grupo?.nombre||d.g)}</div>
        <h2>${esc(legible(d.n))}</h2>
        <p class="meta">${d.form?`Elegido en la lista de ${esc(d.form)}`:""}${d.form&&alta?" · ":""}${alta?`En el Congreso desde el ${alta}`:""}${d.baja?` · ${d.baja.includes("-")?`Dejó el escaño el ${fechaCorta(d.baja)}`:"Ya no es diputado"}`:""}</p>
        <p class="meta ficha-acc">${d.cod?`<a href="${fichaOficial(d)}" target="_blank" rel="noopener">Ficha oficial en el Congreso ↗</a>`:""}${botonCompartir("diputado/"+d.slug, legible(d.n))}${botonRss("diputado/"+d.slug)}</p></div></div>
      <div>${hemiDiputado(d)}</div>
    </div>
    <div class="kpis">${kpis}</div>
    <section class="sec"><div class="sec-h"><h2>Perfil</h2></div><div id="perfil">${perfilFicha(d)}</div></section>
    ${comparacion(d)}
    ${s.ivs.length?`<section class="sec"><div class="sec-h"><h2>Sus intervenciones</h2></div><div class="iv-list">${s.ivs.map(ivCard).join("")}</div></section>`:""}
    <section class="sec" id="ficha-cargos"></section>
    <section class="sec" id="ficha-preguntas"></section>
    <div id="ficha-intereses">${interesesFicha(d)}</div>
    <section class="sec"><div class="sec-h"><h2>Cómo votó</h2><p>${s.dis?`Las filas marcadas son las votaciones en las que se apartó de la mayoría de su grupo.`:`Votó siempre como la mayoría de su grupo.`}</p></div>
      <div class="dtable-wrap"><table class="dt vt"><thead><tr><th>Fecha</th><th>Votación</th><th>Su voto</th><th>Su grupo</th><th>Resultado</th></tr></thead><tbody>${filas}</tbody></table></div></section>`;
  iniciarFicha(d);
}
function iniciarFicha(d){
  if (!EXTRA) cargarExtra().then(()=>{ const p=document.getElementById("perfil"); if (p && dipSel===d.slug){ p.innerHTML=perfilFicha(d); const i=document.getElementById("ficha-intereses"); if (i) i.innerHTML=interesesFicha(d); } });
  pintarPreguntasFicha(d);
  pintarCargosFicha(d);
  document.getElementById("comp-q")?.addEventListener("change", e=>{ const q=sinTildes(e.target.value.trim()); const o=DIP.find(x=>sinTildes(legible(x.n))===q) || DIP.find(x=>q && sinTildes(legible(x.n)).includes(q));
    if (o){ dipComp=o.slug; const y=window.scrollY; renderFicha(d); window.scrollTo(0,y); } });
}
function irDiputado(sl){ dipSel = sl; rendered.diputados=false; show("diputados", false); fijarRuta("diputado-"+sl, true); window.scrollTo(0,0); }

/* ---------- listas de votaciones (agrupa las que votan partes del mismo texto) ---------- */
const baseTitulo = t => t.replace(/\s*\([^()]*\)\s*$/,"");
function listaVotos(list, compact){
  const out = []; let i = 0;
  while (i < list.length){
    const v = list[i], clave = v.fecha+"|"+(v.texto||baseTitulo(v.titulo));
    let j = i+1; while (j < list.length && list[j].fecha+"|"+(list[j].texto||baseTitulo(list[j].titulo))===clave) j++;
    const grupo = list.slice(i,j);
    if (grupo.length >= 3){
      const ok = grupo.filter(passed).length, d = dt(v.fecha);
      const rev = grupo.find(x=>x.titulo_fuente==="revisado"), tit = baseTitulo((rev||v).titulo);
      out.push(`<article class="vote vgroup" id="vg-${v.id}">
        <div class="vote-h"><div class="t">${esc(tit)}<div class="sub">${compact?"":`${d.d} ${d.m} · `}${esc(v.tipo)} · ${grupo.length} votaciones de partes del mismo texto${rev?"":` <span class="oficial" data-tip="Título abreviado del texto oficial del expediente. Conserva las palabras del grupo que presenta la iniciativa.">título oficial</span>`}</div></div>
          <span class="res mix">${ok} ${ok===1?"aprobada":"aprobadas"} · ${grupo.length-ok} ${grupo.length-ok===1?"rechazada":"rechazadas"}</span></div>
        <div class="mini" aria-hidden="true">${grupo.map(x=>`<i style="background:var(${passed(x)?"--si":"--no"})" data-tip="${esc(`${esc(x.titulo)}<br>Sí ${x.si} · No ${x.no} · Abst. ${x.abst}`)}"></i>`).join("")}</div>
        <details><summary>Ver las ${grupo.length} votaciones</summary><div class="votes">${grupo.map(x=>voteRow(x,compact)).join("")}</div></details>
      </article>`);
    } else grupo.forEach(x=>out.push(voteRow(x,compact)));
    i = j;
  }
  return out.join("");
}

/* ---------- termómetro de la cámara ---------- */
const REAC = [["aplausos","Aplausos"],["risas","Risas"],["rumores","Rumores"],["protestas","Protestas"]];
const reacLeyenda = () => `<div class="key">${REAC.map(([k,l])=>`<span><i style="background:var(--r-${k})"></i>${l}</span>`).join("")}</div>`;
function termometroSesiones(){
  const ses = DATA.sesiones.filter(s=>s.organo==="Pleno" && s.reacciones && Object.keys(s.reacciones).length).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  if (!ses.length) return "";
  const tot = s => REAC.reduce((a,[k])=>a+(s.reacciones[k]||0),0);
  const max = Math.max(...ses.map(tot));
  return `<div class="thermo">${ses.map(s=>{ const d=dt(s.fecha), o=s.reacciones.llamadas_al_orden||0;
    return `<div class="th-row" data-tip="${esc(`<b>${d.d} ${d.m} · ${s.sesion}</b><br>${REAC.map(([k,l])=>`${l}: ${s.reacciones[k]||0}`).join(" · ")}${o?`<br>Llamadas al orden: ${o}`:""}`)}">
      <span class="lab">${d.d} ${d.m} <small>${d.w}</small></span>
      <span class="trk">${REAC.filter(([k])=>s.reacciones[k]).map(([k])=>`<i style="width:${s.reacciones[k]/max*100}%;background:var(--r-${k})"></i>`).join("")}</span><span class="n">${tot(s)}${o?`<span class="orden" title="${o} ${o===1?"llamada":"llamadas"} al orden">·${o}!</span>`:""}</span></div>`; }).join("")}</div>${reacLeyenda()}${ses.some(s=>s.reacciones.llamadas_al_orden)?`<p class="nota"><span style="color:var(--no)">·N!</span> = llamadas al orden de la Presidencia.</p>`:""}`;
}
function termometroGrupos(){
  // Reacciones que anota el Diario durante los turnos de cada grupo, por turno de palabra.
  const acc = {};
  DATA.sesiones.forEach(s=>Object.entries(s.termometro||{}).forEach(([g,c])=>{ const a=(acc[g] ||= {turnos:0}); for (const [k,n] of Object.entries(c)) a[k]=(a[k]||0)+n; }));
  const gs = [...ORDEN_HEMI,"GOB"].filter(g=>acc[g]?.turnos>=5);
  if (!gs.length) return "";
  const val = g => ({ap:(acc[g].aplausos||0)/acc[g].turnos, rp:((acc[g].rumores||0)+(acc[g].protestas||0))/acc[g].turnos});
  const max = Math.max(...gs.flatMap(g=>{const v=val(g); return [v.ap,v.rp];}));
  const W=440, L=56, R=16, fila=28, H=gs.length*fila+24, x=v=>L+v/max*(W-L-R);
  const ticks = [0, max/2, max].map(t=>Math.round(t*10)/10);
  return `<div class="dual"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Aplausos y rumores o protestas por turno de palabra, por grupo">
    ${ticks.map(t=>`<line class="ax" x1="${x(t)}" x2="${x(t)}" y1="4" y2="${H-18}"/><text x="${x(t)}" y="${H-4}" text-anchor="middle">${String(t).replace(".",",")}</text>`).join("")}
    ${gs.map((g,r)=>{ const y=14+r*fila, v=val(g), tip=`<b>${G[g].nombre}</b> · ${acc[g].turnos} turnos<br>Aplausos: ${acc[g].aplausos||0} (${v.ap.toFixed(1).replace(".",",")} por turno)<br>Rumores y protestas: ${(acc[g].rumores||0)+(acc[g].protestas||0)} (${v.rp.toFixed(1).replace(".",",")} por turno)`;
      return `<text class="g" x="0" y="${y+4}">${gLabel(g)}</text><line class="ax" x1="${x(Math.min(v.ap,v.rp))}" x2="${x(Math.max(v.ap,v.rp))}" y1="${y}" y2="${y}" style="stroke:var(--line-strong)"/>
        <circle cx="${x(v.rp)}" cy="${y}" r="6" fill="var(--r-protestas)" data-tip="${esc(tip)}"/><circle cx="${x(v.ap)}" cy="${y}" r="6" fill="var(--r-aplausos)" data-tip="${esc(tip)}"/>`; }).join("")}
  </svg></div><div class="key"><span><i style="background:var(--r-aplausos);border-radius:50%;width:10px;height:10px"></i>aplausos por turno</span><span><i style="background:var(--r-protestas);border-radius:50%;width:10px;height:10px"></i>rumores y protestas por turno</span></div>`;
}

/* ---------- afinidad, cohesión y mayorías con el voto nominal ---------- */
const reparto = c => { const t=(c.S||0)+(c.N||0)+(c.A||0); return t ? {S:(c.S||0)/t, N:(c.N||0)/t, A:(c.A||0)/t, t} : null; };
function afinidad(a,b){
  // Probabilidad de que un diputado de A y otro de B, al azar, votaran lo mismo; media de todas las votaciones.
  let s=0, n=0;
  DATA.votaciones.forEach(v=>{ const c=conteoDe(v), pa=c[a]&&reparto(c[a]), pb=c[b]&&reparto(c[b]); if(!pa||!pb) return; s+=pa.S*pb.S+pa.N*pb.N+pa.A*pb.A; n++; });
  return n ? s/n : null;
}
function cohesion(g){
  let s=0, n=0; DATA.votaciones.forEach(v=>{ const p=conteoDe(v)[g]&&reparto(conteoDe(v)[g]); if(!p||p.t<2) return; s+=Math.max(p.S,p.N,p.A); n++; });
  return n ? s/n : null;
}
function mayorias(){
  const m = {};
  DATA.votaciones.forEach(v=>{ const w=passed(v)?"S":"N"; const gs=ORDEN_HEMI.filter(g=>v.grupos[g]===w); const k=gs.join("+");
    const e=(m[k] ||= {gs, n:0, ok:0, ids:[]}); e.n++; if(passed(v)) e.ok++; e.ids.push(v.id); });
  return Object.values(m).sort((a,b)=>b.n-a.n);
}
function tablaMayorias(max=10){
  const lista = mayorias().slice(0,max); if(!lista.length) return "";
  const top = lista[0].n;
  return `<div class="mx-wrap"><table class="upset"><thead><tr>${ORDEN_HEMI.map(g=>`<th>${g}</th>`).join("")}<th style="text-align:left;padding-left:12px">Votaciones</th><th style="text-align:right">Escaños</th></tr></thead><tbody>
    ${lista.map(e=>{ const esc_=e.gs.reduce((a,g)=>a+(G[g].escanos||0),0);
      return `<tr data-tip="${esc(`${e.gs.length?e.gs.join(" + "):"Ningún grupo en bloque"}<br>${e.n} votaciones: ${e.ok} aprobadas, ${e.n-e.ok} rechazadas`)}">${ORDEN_HEMI.map(g=>`<td>${e.gs.includes(g)?`<i style="background:${G[g].color}"></i>`:`<i class="no"></i>`}</td>`).join("")}
        <td class="bar"><span><b style="width:${e.n/top*100}px"></b><em>${e.n} · ${e.ok} aprob.</em></span></td><td class="esc">${esc_||"–"}</td></tr>`; }).join("")}
  </tbody></table></div>`;
}

/* ---------- mayorías a lo largo del tiempo ---------- */
const votosCrono = () => DATA.votaciones.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id, undefined, {numeric:true}));
function matrizGanadores(){
  // Una columna por votación y una fila por grupo: color del grupo si estaba en bloque en el lado ganador.
  const vs = votosCrono(); if (!vs.length) return "";
  const gs = ORDEN_HEMI, celda = 12, hueco = 2, sepDia = 10, L = 2, top = 18, alto = celda+hueco;
  let x = L, dia = null; const cols = [];
  vs.forEach(v=>{ if (dia && v.fecha!==dia) x += sepDia; cols.push({v, x}); dia = v.fecha; x += celda+hueco; });
  const W = x + 4, H = top + gs.length*alto + 30;
  const dias = []; cols.forEach(c=>{ const u=dias[dias.length-1]; if (!u || u.f!==c.v.fecha) dias.push({f:c.v.fecha, x0:c.x, x1:c.x+celda}); else u.x1=c.x+celda; });
  const txt = {S:"sí",N:"no",A:"abstención",D:"dividido","?":"sin dato"};
  const celdas = cols.map(({v,x})=>{ const w = passed(v)?"S":"N";
    return `<g data-go="votaciones" data-anchor="v-${v.id}" style="cursor:pointer">
      <rect x="${x}" y="2" width="${celda}" height="${celda-2}" rx="2" fill="var(${passed(v)?"--si":"--no"})" data-tip="${esc(`<b>${esc(v.titulo)}</b><br>${resLabel(v)} · ${v.si} a ${v.no}`)}"/>
      ${gs.map((g,r)=>{ const p=v.grupos[g]||"?", y=top+r*alto, gana=p===w;
        const tip = `<b>${esc(v.titulo)}</b><br>${G[g].nombre}: ${txt[p]||p} · ${gana?"en el lado ganador":"no ganó"}`;
        return gana ? `<rect x="${x}" y="${y}" width="${celda}" height="${celda}" rx="2" fill="${G[g].color}" data-tip="${esc(tip)}"/>`
          : ["S","N"].includes(p) ? `<rect x="${x+.75}" y="${y+.75}" width="${celda-1.5}" height="${celda-1.5}" rx="2" fill="none" stroke="var(--line-strong)" stroke-width="1" data-tip="${esc(tip)}"/>`
          : `<circle cx="${x+celda/2}" cy="${y+celda/2}" r="1.6" fill="var(--line-strong)" data-tip="${esc(tip)}"/>`; }).join("")}</g>`; }).join("");
  const filas = gs.map((g,r)=>`<text class="g" x="0" y="${top+r*alto+celda-1}">${g}</text>`).join("");
  const fechas = dias.map(d=>{ const t=dt(d.f); return `<line x1="${d.x0}" x2="${d.x1}" y1="${H-22}" y2="${H-22}" stroke="var(--line-strong)"/><text x="${(d.x0+d.x1)/2}" y="${H-8}" text-anchor="middle">${t.d} ${t.m}</text>`; }).join("");
  return `<div class="gan-grid"><svg class="gan" viewBox="0 0 48 ${H}" width="48" height="${H}" aria-hidden="true">${filas}</svg>
    <div class="mx-wrap gan-wrap"><svg class="gan" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Grupos en el lado ganador de cada votación">${celdas}${fechas}</svg></div></div>
    <div class="key"><span><i style="background:var(--ink);border-radius:2px"></i>en el lado ganador (color del grupo)</span><span><i style="background:none;box-shadow:inset 0 0 0 1px var(--line-strong);border-radius:2px"></i>votó con el perdedor</span><span><i style="width:4px;height:4px;border-radius:50%;background:var(--line-strong)"></i>abstención o dividido</span><span><i style="background:var(--si)"></i><i style="background:var(--no);margin-left:-3px"></i>fila superior: aprobada / rechazada</span></div>`;
}
function semanaDe(iso){ const [y,m,d]=iso.split("-").map(Number); const f=new Date(Date.UTC(y,m-1,d)); const dia=(f.getUTCDay()+6)%7; f.setUTCDate(f.getUTCDate()-dia); return f.toISOString().slice(0,10); }
function ganadasPorSemana(){
  const vs = votosCrono(); const semanas = [...new Set(vs.map(v=>semanaDe(v.fecha)))];
  if (semanas.length < 2) return "";
  const serie = g => semanas.map(s=>{ const w = vs.filter(v=>semanaDe(v.fecha)===s); const con = w.filter(v=>["S","N","A","D"].includes(v.grupos[g]));
    const gan = con.filter(v=>v.grupos[g]===(passed(v)?"S":"N")).length; return con.length ? {s, p:gan/con.length, gan, n:con.length} : {s, p:null, gan:0, n:0}; });
  const W=200, H=92, L=6, R=34, T=10, B=18, x=i=>L+i*(W-L-R)/Math.max(1,semanas.length-1), y=p=>T+(1-p)*(H-T-B);
  const etiqueta = s => { const t=dt(s); return `${t.d} ${t.m}`; };
  return `<div class="multiples">${ORDEN_HEMI.map(g=>{ const d=serie(g), pts=d.map((e,i)=>e.p==null?null:[x(i),y(e.p),e]).filter(Boolean); const ult=pts[pts.length-1];
    return `<figure class="mult"><figcaption>${gdot(g)}${g}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${G[g].nombre}: votaciones ganadas por semana">
      <line class="ax mid" x1="${L}" x2="${W-R}" y1="${y(.5)}" y2="${y(.5)}"/>
      <line class="ax" x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}"/><line class="ax" x1="${L}" x2="${W-R}" y1="${y(1)}" y2="${y(1)}"/>
      <polyline points="${pts.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ")}" fill="none" stroke="${G[g].color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(([px,py,e])=>`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="${G[g].color}" stroke="var(--surface)" stroke-width="2" data-tip="${esc(`<b>${G[g].nombre}</b> · semana del ${etiqueta(e.s)}<br>Ganó ${e.gan} de ${e.n} votaciones (${Math.round(e.p*100)} %)`)}"/>`).join("")}
      ${ult?`<text x="${W-R+4}" y="${ult[1]+4}" class="fin">${Math.round(ult[2].p*100)} %</text>`:""}
      <text x="${L}" y="${H-3}" class="lbl">${etiqueta(semanas[0])}</text><text x="${W-R}" y="${H-3}" text-anchor="end" class="lbl">${etiqueta(semanas[semanas.length-1])}</text>
    </svg></figure>`; }).join("")}</div>`;
}

/* ---------- mapa de circunscripciones ---------- */
// [abreviatura, fila, columna] en una rejilla que imita la geografía; todas las casillas del mismo tamaño.
const TESELAS = {"Coruña (A)":["COR",0,0],"Lugo":["LUG",0,1],"Asturias":["AST",0,2],"Cantabria":["CAN",0,3],"Bizkaia":["BIZ",0,4],"Gipuzkoa":["GIP",0,5],
  "Pontevedra":["PON",1,0],"Ourense":["OUR",1,1],"León":["LEÓ",1,2],"Palencia":["PAL",1,3],"Burgos":["BUR",1,4],"Araba/Álava":["ÁLA",1,5],"Navarra":["NAV",1,6],"Huesca":["HUE",1,7],"Lleida":["LLE",1,8],"Girona":["GIR",1,9],
  "Zamora":["ZAM",2,1],"Valladolid":["VLL",2,2],"Segovia":["SEG",2,3],"Soria":["SOR",2,4],"Rioja (La)":["RIO",2,5],"Zaragoza":["ZAR",2,6],"Tarragona":["TAR",2,8],"Barcelona":["BCN",2,9],
  "Salamanca":["SAL",3,1],"Ávila":["ÁVI",3,2],"Madrid":["MAD",3,3],"Guadalajara":["GUA",3,4],"Cuenca":["CUE",3,5],"Teruel":["TER",3,6],"Castellón/Castelló":["CAS",3,7],
  "Cáceres":["CÁC",4,1],"Toledo":["TOL",4,2],"Ciudad Real":["CRE",4,3],"Albacete":["ALB",4,4],"Valencia/València":["VAL",4,6],"Balears (Illes)":["BAL",4,8],
  "Badajoz":["BAD",5,1],"Córdoba":["CÓR",5,2],"Jaén":["JAÉ",5,3],"Murcia":["MUR",5,5],"Alicante/Alacant":["ALI",5,6],
  "Huelva":["HLV",6,1],"Sevilla":["SEV",6,2],"Málaga":["MÁL",6,3],"Granada":["GRA",6,4],"Almería":["ALM",6,5],
  "Cádiz":["CÁD",7,2],"Ceuta":["CEU",7,3],"Melilla":["MEL",7,5],"Palmas (Las)":["LPA",8,0],"S/C Tenerife":["TFE",8,1]};
const nombreCirc = c => ({"Coruña (A)":"A Coruña","Rioja (La)":"La Rioja","Palmas (Las)":"Las Palmas","S/C Tenerife":"Santa Cruz de Tenerife","Balears (Illes)":"Illes Balears"}[c]||c);
let mapaModo = "escanos";
function mapaCirc(){
  const por = {}; DIP.forEach(d=>(por[d.circ] ||= []).push(d));
  const part = c => { const ds=por[c]||[]; let v=0,t=0; ds.forEach(d=>{ const s=statsDip[d.i]; v+=s.vot; t+=s.vot+s.aus; }); return t? v/t : null; };
  const vals = Object.keys(TESELAS).map(part).filter(x=>x!=null), lo=Math.min(...vals), hi=Math.max(...vals);
  const tiles = Object.entries(TESELAS).map(([c,[ab,r,col]])=>{ const ds=por[c]||[]; const p=part(c);
    const seg = ORDEN_HEMI.map(g=>[g, ds.filter(d=>d.g===g).length]).filter(x=>x[1]);
    const heat = mapaModo==="part" && p!=null ? (hi>lo ? (p-lo)/(hi-lo) : 1) : null;
    const estilo = heat!=null ? `background:color-mix(in srgb, var(--ink) ${Math.round(15+heat*75)}%, var(--surface));color:${heat>.45?"var(--bg)":"var(--ink)"}` : "";
    return `<button class="tile${heat!=null?" heat":""}" style="grid-row:${r+1};grid-column:${col+1};${estilo}" data-circ="${esc(c)}" aria-pressed="${dipFiltro.circ===c}"
      data-tip="${esc(`<b>${esc(nombreCirc(c))}</b> · ${ds.length} ${ds.length===1?"escaño":"escaños"}<br>${seg.map(([g,n])=>`${g} ${n}`).join(" · ")}${p!=null?`<br>Participación: ${pct(p)}`:""}`)}">
      <span class="ab">${ab}</span><span class="es">${mapaModo==="part"&&p!=null?pct(p):ds.length}</span>
      ${mapaModo==="escanos"?`<span class="strip">${seg.map(([g,n])=>`<i style="flex:${n};background:${G[g].color}"></i>`).join("")}</span>`:""}</button>`; }).join("");
  return `<div class="controls"><button class="chipbtn" data-mapa="escanos" aria-pressed="${mapaModo==="escanos"}">Escaños por grupo</button><button class="chipbtn" data-mapa="part" aria-pressed="${mapaModo==="part"}">Participación en votaciones</button></div>
    <div class="tiles" role="group" aria-label="Circunscripciones">${tiles}</div>
    <p class="nota">${mapaModo==="part"?`Más oscuro, más participación (de ${pct(lo)} a ${pct(hi)}). `:"La franja muestra el reparto de escaños por grupo. "}Cada casilla es una circunscripción del mismo tamaño, colocada de forma aproximada. Púlsala para ver sus diputados.</p>`;
}

/* ---------- vida de una iniciativa ---------- */
const TIPO_EXP = {"121":"Proyecto de ley","122":"Proposición de ley de grupos","124":"Proposición de ley del Senado","125":"Proposición de ley de comunidades autónomas","130":"Real decreto-ley","162":"Proposición no de ley en el Pleno","161":"Proposición no de ley en comisión","173":"Moción consecuencia de interpelación","172":"Interpelación urgente","180":"Pregunta oral en el Pleno","219":"Comparecencia","213":"Comparecencia del Gobierno","210":"Comparecencia del Gobierno","042":"Informe"};
const INICIATIVAS = (()=>{
  const m = {};
  const e = x => (m[x] ||= {exp:x, votos:[], debates:[]});
  DATA.votaciones.forEach(v=>{ if (v.exp) e(v.exp).votos.push(v); });
  DATA.sesiones.forEach(s=>s.puntos.forEach(p=>{ if (p.exp) e(p.exp).debates.push({s, p}); }));
  return m;
})();
const slugExp = x => x.replace("/","-");
let iniSel = null;
const urlIniciativa = x => `https://www.congreso.es/es/busqueda-de-iniciativas?p_p_id=iniciativas&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_iniciativas_mode=mostrarDetalle&_iniciativas_legislatura=${LEG}&_iniciativas_id=${encodeURIComponent(x)}`;
function renderIniciativa(x){
  const ini = INICIATIVAS[x] ||= {exp:x, votos:[], debates:[]};
  const ley = LEYES?.porExp[x];
  if (!LEYES && /^12[1-5]\//.test(x)) cargarLeyes().then(()=>{ if (iniSel===x && !$("#votaciones").hidden) renderIniciativa(x); });
  const titulo = ley ? tituloLey(ley) : ini.votos[0] ? baseTitulo(ini.votos[0].titulo) : ini.debates[0]?.p.titulo || x;
  const ev = [
    ...ini.debates.map(({s,p})=>({f:s.fecha, k:0, html:`<li><div class="when">${esc(fechaLarga(s.fecha))} · ${esc(s.organo)}</div><div class="what">Debate: ${esc(p.titulo)}</div>
      <div class="extra">${IVS.filter(i=>i.s===s.id && matchItem(i,p)).length?`<span>${IVS.filter(i=>i.s===s.id && matchItem(i,p)).length} intervenciones analizadas</span>`:`<span>Sin analizar</span>`}<button class="linklike" style="font-size:13px" data-go="dias" data-anchor="s-${s.id}">Ver la sesión</button></div></li>`})),
    ...ini.votos.map(v=>({f:v.fecha, k:1, html:`<li class="voto"><div class="when">${esc(fechaLarga(v.fecha))} · Votación</div><div class="what">${esc(v.titulo)}</div>
      <div class="extra"><span class="res ${passed(v)?"ok":"ko"}">${resLabel(v)}</span><span>Sí ${v.si} · No ${v.no} · Abst. ${v.abst}</span><button class="linklike" style="font-size:13px" data-go="votaciones" data-anchor="v-${v.id}">Ver votación</button></div></li>`}))
  ].sort((a,b)=>a.f.localeCompare(b.f) || a.k-b.k);
  $("#votaciones").innerHTML = `
    <button class="back" data-ini-volver="${ley?"leyes":"votaciones"}">← ${ley?"Todas las leyes":"Todas las votaciones"}</button>
    <div class="view-intro"><div><div class="eyebrow">${esc(ley?.tipo || TIPO_EXP[x.slice(0,3)] || "Iniciativa")}${ley?.organica?" orgánica":""} · <span class="mono">${esc(x)}</span></div><h2 style="font-size:clamp(26px,3.6vw,38px);margin-top:8px">${esc(titulo)}</h2>
      <p>${ley?"Su recorrido por el Congreso, fase a fase, y lo que se ha votado y debatido sobre ella.":"Lo que ha pasado con esta iniciativa en el periodo que cubre Escaño Abierto."} <a href="${urlIniciativa(x)}" target="_blank" rel="noopener">Tramitación completa en la web del Congreso</a>.</p>
      <p>${botonCompartir("iniciativa/"+slugExp(x), titulo)}${botonRss("iniciativa/"+slugExp(x))}</p></div></div>
    ${ley ? tramitacion(ley) : ""}
    ${ev.length ? `${ley?`<section class="sec"><div class="sec-h"><h2>Debates y votaciones</h2><p>En el periodo que tienes seleccionado.</p></div>`:""}<ol class="timeline">${ev.map(e=>e.html).join("")}</ol>${ley?"</section>":""}` : (ley ? "" : `<p class="nota">No hay debates ni votaciones de esta iniciativa en el periodo seleccionado.</p>`)}`;
}
function irIniciativa(x){ INICIATIVAS[x] ||= {exp:x, votos:[], debates:[]}; iniSel=x; rendered.votaciones=false; show("votaciones",false); fijarRuta("iniciativa-"+slugExp(x), true); window.scrollTo(0,0); }

/* ---------- leyes: la tramitación de la legislatura ---------- */
let LEYES = null, leyesPromesa = null;
function cargarLeyes(){
  if (LEYES) return Promise.resolve(LEYES);
  return leyesPromesa ||= fetch("datos/leyes.json").then(r=>r.ok?r.json():null).catch(()=>null).then(j=>{
    j = j || {iniciativas:[], aprobadas:[]};
    j.porExp = Object.fromEntries(j.iniciativas.map(i=>[i.exp,i]));
    INDICE_BUSCAR = null;
    return LEYES = j; });
}
const ETAPAS = ["Presentadas","Admitidas a debate","Con informe en comisión","Aprobadas en el Congreso","Pasaron por el Senado","Leyes"];
const ETAPA_UNA = ["Presentada","Admitida a debate","Informe en comisión","Aprobada en el Congreso","Senado","Ley"];
const ESTADO_LEY = {"en trámite":["En trámite","mix"], aprobada:["Es ley","ok"], rechazada:["Rechazada","ko"], retirada:["Retirada","mix"], "decaída":["Decaída","mix"], subsumida:["Subsumida","mix"], inadmitida:["Inadmitida","ko"]};
const AUTOR = {GOB:"Gobierno", SEN:"Senado", CCAA:"Parlamentos autonómicos", DIP:"Diputados"};
const autorNombre = a => AUTOR[a] || a;
const autorColor = a => G[a]?.color || "var(--line-strong)";
const autorDot = a => `<span class="dot" style="background:${autorColor(a)}"></span>`;
const tituloLey = l => l.titulo.length > 120 ? l.titulo.slice(0,120).replace(/\s+\S*$/,"")+"…" : l.titulo;
const cerrada = l => !["en trámite","aprobada"].includes(l.estado);
const hoyISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const dias = (a,b) => Math.round((Date.parse(b)-Date.parse(a))/864e5);
const pasosLey = l => `<span class="pasos" title="${esc(ETAPA_UNA[l.etapa])}${cerrada(l)?" · "+ESTADO_LEY[l.estado][0]:""}">${ETAPAS.map((_,k)=>`<i class="${k<=l.etapa?"on":""}${cerrada(l)&&k===l.etapa+1?" x":""}"></i>`).join("")}</span>`;
const chipLey = l => { const [t,c]=ESTADO_LEY[l.estado]||[l.estado,"mix"]; return `<span class="res ${c}">${t}</span>`; };
let leyFiltro = {estado:"todas", autor:"TODOS", q:"", todas:false};

function embudo(lista, titulo, sub){
  const c = ETAPAS.map((_,k)=>lista.filter(i=>i.etapa>=k).length), max = c[0]||1;
  return `<div class="chart"><h3>${titulo}</h3><p class="sub">${sub}</p><div class="embudo">${c.map((x,k)=>`
    <div class="emb-row" data-tip="${esc(`<b>${ETAPAS[k]}</b><br>${x} de ${c[0]} (${pct(x/max)})`)}"><span class="lab">${ETAPAS[k]}</span>
      <span class="trk"><i style="width:${Math.max(x/max*100,.8)}%"></i></span><span class="n"><b>${x}</b>${k?` <small>${pct(x/max)}</small>`:""}</span></div>`).join("")}</div></div>`;
}
function leyesPorAutor(I){
  const c = {};
  I.forEach(i=>i.autores.forEach(a=>{ const x=(c[a] ||= {p:0,t:0,l:0}); x.p++; if (i.etapa>=1) x.t++; if (i.estado==="aprobada") x.l++; }));
  const filas = Object.keys(c).sort((a,b)=>c[b].p-c[a].p), max = Math.max(...filas.map(a=>c[a].p));
  return `<div class="autores">${filas.map(a=>{ const x=c[a];
    return `<button class="aut-row" data-lf-autor="${a}" data-tip="${esc(`<b>${autorNombre(a)}</b><br>${x.p} presentadas · ${x.t} admitidas a debate · ${x.l} convertidas en ley`)}">
      <span class="g">${autorDot(a)}${esc(autorNombre(a))}</span>
      <span class="trk" style="width:${x.p/max*100}%"><i class="t" style="width:${x.t/x.p*100}%;background:${autorColor(a)}"></i><i class="l" style="width:${x.l/x.p*100}%;background:${autorColor(a)}"></i></span>
      <span class="n">${x.p} · ${x.t} · <b>${x.l}</b></span></button>`; }).join("")}</div>
    <div class="key"><span><i style="background:var(--sunk);border:1px solid var(--line)"></i>presentadas</span><span><i style="background:color-mix(in srgb,var(--ink) 35%,var(--surface))"></i>admitidas a debate</span><span><i style="background:var(--ink)"></i>convertidas en ley</span></div>`;
}
function congelador(I){
  const c = I.filter(i=>i.estado==="en trámite" && i.ampliaciones>=8).sort((a,b)=>b.ampliaciones-a.ampliaciones).slice(0,10);
  if (!c.length) return "";
  const max = c[0].ampliaciones;
  return `<div class="cong">${c.map(i=>`<button class="cong-row" data-ini="${i.exp}" data-tip="${esc(`<b>${tituloLey(i)}</b><br>Plazo de enmiendas ampliado ${i.ampliaciones} veces · ${i.situacion}`)}">
    <span class="t">${esc(tituloLey(i))}<small>${i.autores.map(autorDot).join("")}${esc(i.autores.map(autorNombre).join(", "))} · ${esc(i.situacion)}</small></span>
    <span class="trk"><i style="width:${i.ampliaciones/max*100}%"></i></span><span class="n"><b>${i.ampliaciones}</b> <small>semanas</small></span></button>`).join("")}</div>`;
}
function duracionLeyes(I){
  const L = I.filter(i=>i.estado==="aprobada" && i.presentada && i.fecha_resultado).map(i=>({...i, d:dias(i.presentada,i.fecha_resultado)}));
  if (L.length < 3) return "";
  const W = 640, H = 128, izq = 110, max = Math.max(...L.map(i=>i.d)), x = d => izq + d/max*(W-izq-16);
  const filas = [["Proyecto de ley","Del Gobierno",34],["Proposición de ley","De los grupos y otros",86]];
  const med = a => { const s=a.map(i=>i.d).sort((p,q)=>p-q); return s.length ? s[Math.floor(s.length/2)] : null; };
  const ticks = [0,180,365,540,730,910,1095].filter(t=>t<=max);
  return `<svg class="dur" viewBox="0 0 ${W} ${H}" role="img" aria-label="Días entre la presentación y la aprobación definitiva de cada ley">
    ${ticks.map(t=>`<line x1="${x(t)}" x2="${x(t)}" y1="12" y2="${H-18}" class="grid"/><text x="${x(t)}" y="${H-4}" class="ax" text-anchor="middle">${t?(t%365===0?`${t/365} año${t>365?"s":""}`:`${Math.round(t/30.4)} meses`):"0"}</text>`).join("")}
    ${filas.map(([tipo,lab,y])=>{ const g=L.filter(i=>i.tipo===tipo), m=med(g);
      return `<text x="0" y="${y+4}" class="lab">${lab}</text>${m!=null?`<line x1="${x(m)}" x2="${x(m)}" y1="${y-16}" y2="${y+16}" class="med"/><text x="${x(m)+4}" y="${y-18}" class="ax">mediana: ${Math.round(m/30.4)} meses</text>`:""}
        ${g.map(i=>`<circle cx="${x(i.d).toFixed(1)}" cy="${y}" r="5" class="pt" data-ini="${i.exp}" data-tip="${esc(`<b>${tituloLey(i)}</b><br>${i.d} días: de ${fechaCorta(i.presentada)} a ${fechaCorta(i.fecha_resultado)}`)}"/>`).join("")}`; }).join("")}
  </svg>`;
}
function listaLeyes(){
  const I = LEYES.iniciativas, q = sinTildes(leyFiltro.q.trim()), f = leyFiltro;
  const otras = ["retirada","decaída","subsumida","inadmitida"];
  const L = I.filter(i=>(f.estado==="todas" || (f.estado==="otras" ? otras.includes(i.estado) : i.estado===f.estado))
      && (f.autor==="TODOS" || i.autores.includes(f.autor)) && (!q || sinTildes(`${i.titulo} ${i.exp} ${i.comision}`).includes(q)))
    .sort((a,b)=>(b.fases.at(-1)?.[2]||b.presentada).localeCompare(a.fases.at(-1)?.[2]||a.presentada));
  const vis = f.todas ? L : L.slice(0,40);
  return `<div class="dtable-wrap"><table class="dt leyes-t"><thead><tr><th>Iniciativa</th><th>Autor</th><th>Etapa</th><th>Estado</th></tr></thead><tbody>
    ${vis.map(i=>`<tr data-ini="${i.exp}"><td class="t"><b>${esc(tituloLey(i))}</b><small><span class="mono">${i.exp}</span> · ${esc(i.estado==="en trámite"?i.situacion:i.resultado)}</small></td>
      <td>${i.autores.map(a=>`<span class="nm">${autorDot(a)}${esc(a==="GOB"?"Gobierno":a in AUTOR?AUTOR[a]:a)}</span>`).join("<br>")}</td><td>${pasosLey(i)}</td><td>${chipLey(i)}</td></tr>`).join("")
      || `<tr><td colspan="4" class="nota">Ninguna iniciativa coincide.</td></tr>`}</tbody></table></div>
    ${L.length>vis.length?`<p><button class="btn boton-claro" data-lf-todas>Ver las ${L.length}</button></p>`:""}`;
}
function renderLeyes(){
  const el = $("#leyes");
  if (!LEYES){ el.innerHTML = `<p class="nota">Cargando la tramitación de la legislatura…</p>`;
    cargarLeyes().then(()=>{ if (!$("#leyes").hidden) renderLeyes(); else rendered.leyes=false; }); return; }
  const I = LEYES.iniciativas;
  if (!I.length){ el.innerHTML = `<p class="nota">Aún no hay datos de tramitación. Ejecuta <code>python -m escano agenda</code> y vuelve a construir la web.</p>`; return; }
  const n = (...es) => I.filter(i=>es.includes(i.estado)).length;
  const pub = LEYES.aprobadas||[], nRdl = pub.filter(x=>x.tipo==="Real decreto-ley").length;
  const proy = I.filter(i=>i.tipo==="Proyecto de ley"), prop = I.filter(i=>i.tipo!=="Proyecto de ley");
  const kpis = [[I.length,"proyectos y proposiciones de ley"],[n("aprobada"),"convertidos en ley"],[n("en trámite"),"siguen en trámite"],
    [n("rechazada","inadmitida"),"rechazados",true],[n("retirada","decaída","subsumida"),"retirados o decaídos"],[nRdl,"reales decretos-leyes del Gobierno"]]
    .map(([x,l,a])=>`<div class="kpi ${a?"alert":""}"><b>${x}</b><span>${l}</span></div>`).join("");
  const estados = [["todas","Todas"],["en trámite","En trámite"],["aprobada","Leyes"],["rechazada","Rechazadas"],["otras","Retiradas o decaídas"]];
  const autoresSel = ["TODOS","GOB",...ORDEN_HEMI,"SEN","CCAA"].filter(a=>a==="TODOS"||I.some(i=>i.autores.includes(a)));
  el.innerHTML = `
    <div class="view-intro"><div><h2>Leyes de la legislatura</h2><p>Todo lo que ha entrado en el Congreso para convertirse en ley desde agosto de 2023 y hasta dónde ha llegado: los proyectos del Gobierno y las proposiciones de los grupos, del Senado y de los parlamentos autonómicos. Datos abiertos del Congreso, actualizados cada día.</p><p><button class="linklike" data-go-ley>¿Cómo se hace una ley? Siete pasos, con las cifras de esta legislatura →</button></p></div></div>
    <div class="kpis">${kpis}</div>
    <section class="sec"><div class="sec-h"><h2>El embudo</h2><p>Cuántas iniciativas alcanzan cada etapa de la tramitación.</p></div>
      <div class="grid2">${embudo(proy,"Proyectos de ley","Los presenta el Gobierno y entran directamente en tramitación.")}${embudo(prop,"Proposiciones de ley","Las presentan los grupos, el Senado o las comunidades; el Pleno decide si las admite a debate.")}</div></section>
    <section class="sec"><div class="sec-h"><h2>Quién propone y quién consigue</h2><p>Iniciativas de cada autor: presentadas, admitidas a debate y convertidas en ley. Pulsa uno para ver las suyas.</p></div>
      <div class="chart">${leyesPorAutor(I)}</div></section>
    ${congelador(I)?`<section class="sec"><div class="sec-h"><h2>El congelador</h2><p>Iniciativas vivas cuyo plazo de enmiendas se ha ampliado más veces. La Mesa lo prorroga cada semana; mientras tanto, la ley no avanza.</p></div>
      <div class="chart">${congelador(I)}</div></section>`:""}
    ${duracionLeyes(I)?`<section class="sec"><div class="sec-h"><h2>Cuánto tarda una ley</h2><p>Días desde que se presenta hasta que termina su tramitación, para cada ley aprobada. Pulsa un punto para ver su historia.</p></div>
      <div class="chart">${duracionLeyes(I)}</div></section>`:""}
    <section class="sec" id="leyes-lista"><div class="sec-h"><h2>Todas las iniciativas</h2></div>
      <div class="controls"><input id="ley-q" type="search" placeholder="Buscar por título, expediente o comisión…" value="${esc(leyFiltro.q)}" aria-label="Buscar iniciativa legislativa">
        <select id="ley-autor" aria-label="Autor">${autoresSel.map(a=>`<option value="${a}"${leyFiltro.autor===a?" selected":""}>${a==="TODOS"?"Todos los autores":esc(autorNombre(a))}</option>`).join("")}</select></div>
      <div class="controls">${estados.map(([k,l])=>`<button class="chipbtn" data-lf-estado="${k}" aria-pressed="${leyFiltro.estado===k}">${l}</button>`).join("")}</div>
      <div id="leyes-tabla">${listaLeyes()}</div></section>
    ${pub.length?`<p class="nota">Publicadas en el BOE en esta legislatura: ${pub.filter(x=>x.tipo==="Ley").length} leyes, ${pub.filter(x=>x.tipo==="Ley orgánica").length} leyes orgánicas y ${nRdl} reales decretos-leyes.</p>`:""}`;
  $("#ley-q").addEventListener("input", e=>{ leyFiltro.q=e.target.value; leyFiltro.todas=false; $("#leyes-tabla").innerHTML=listaLeyes(); });
  $("#ley-autor").addEventListener("change", e=>{ leyFiltro.autor=e.target.value; leyFiltro.todas=false; $("#leyes-tabla").innerHTML=listaLeyes(); });
}
function pintarFiltroLeyes(){
  document.querySelectorAll("[data-lf-estado]").forEach(b=>b.setAttribute("aria-pressed", b.dataset.lfEstado===leyFiltro.estado));
  const s=$("#ley-autor"); if (s) s.value=leyFiltro.autor;
  $("#leyes-tabla").innerHTML = listaLeyes();
}

/* La tramitación de una iniciativa, en su página: etapas, fases en el tiempo y documentos. */
function tramitacion(l){
  const pasos = ETAPA_UNA.map((e,k)=>`<li class="${k<=l.etapa?"on":""}${cerrada(l)&&k===l.etapa+1?" corte":""}"><span>${e}</span></li>`).join("");
  const hoy = hoyISO(), fs = l.fases.filter(f=>f[2]);
  let gantt = "";
  if (fs.length){
    const t0 = Date.parse(l.presentada || fs[0][2]), t1 = Math.max(...fs.map(f=>Date.parse(f[3]||hoy)), t0+864e5*30);
    const x = t => ((t-t0)/(t1-t0)*100).toFixed(2);
    const anios = []; for (let a=new Date(t0).getFullYear()+1; a<=new Date(t1).getFullYear(); a++) anios.push(a);
    gantt = `<div class="gantt" role="img" aria-label="Fases de la tramitación en el tiempo">
      ${fs.map(f=>{ const a=+x(Date.parse(f[2])), w=Math.max(+x(Date.parse(f[3]||hoy))-a, .6);
        const nombre = f[1] ? `${f[0].replace(/^Comisión de /,"C. de ")} · ${f[1]}` : f[0];
        return `<div class="g-row"><span class="g-lab" title="${esc(nombre)}">${esc(nombre)}</span><span class="g-trk"><i class="${f[3]?"":"abierta"}${f[0]==="Concluido"?" fin":""}" style="left:${a}%;width:${w}%" data-tip="${esc(`<b>${nombre}</b><br>${fechaCorta(f[2])} – ${f[3]?fechaCorta(f[3]):"sigue abierta"} (${dias(f[2],f[3]||hoy)} días)`)}"></i></span></div>`; }).join("")}
      <div class="g-row g-eje"><span></span><span class="g-trk">${anios.map(a=>`<b style="left:${x(Date.parse(a+"-01-01"))}%">${a}</b>`).join("")}</span></div>
    </div>`;
  }
  const ds = (l.diarios||[]).map(id=>{ const s=DATA.sesiones.find(x=>x.id===id); const [, , serie, num] = id.split("-");
    const lab = `${serie==="PL"?"Pleno":"Comisión"} · DS nº ${num}`;
    return s ? `<button class="linklike" data-go="dias" data-anchor="s-${s.id}">${lab}</button>` : `<a href="https://www.congreso.es/public_oficiales/L15/CONG/DS/${serie}/${id}.PDF" target="_blank" rel="noopener">${lab}</a>`; });
  const datos = [["Autor", l.autores.map(a=>`${autorDot(a)}${esc(autorNombre(a))}`).join(", ")],["Presentada", l.presentada?fechaCorta(l.presentada):"–"],
    ["Tramitación", esc(l.tramitacion||"Ordinaria")],["Comisión", esc(l.comision||"–")],
    ["Situación", l.estado==="en trámite" ? esc(l.situacion) : `${chipLey(l)} ${esc(l.resultado)}${l.fecha_resultado?` · ${fechaCorta(l.fecha_resultado)}`:""}`]];
  if (l.ampliaciones) datos.push(["Enmiendas", `Plazo ampliado ${l.ampliaciones} ${l.ampliaciones===1?"vez":"veces"}`]);
  return `<section class="sec"><div class="sec-h"><h2>Tramitación</h2>${l.bocg?`<a href="${l.bocg}" target="_blank" rel="noopener">Texto en el BOCG ↗</a>`:""}</div>
    <ol class="etapas${cerrada(l)?" cerrada":""}">${pasos}</ol>
    <dl class="ley-datos">${datos.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    ${gantt?`<div class="chart">${gantt}</div>`:""}
    ${ds.length?`<p class="nota">Debates en el Diario de Sesiones: ${ds.join(" · ")}</p>`:""}</section>`;
}

/* ---------- la semana en el Congreso ---------- */
let SEMANAS = null, semanasPromesa = null, semSel = null;
function cargarSemanas(){
  if (SEMANAS) return Promise.resolve(SEMANAS);
  return semanasPromesa ||= fetch("datos/semanas.json").then(r=>r.ok?r.json():[]).catch(()=>[]).then(j=>{ INDICE_BUSCAR = null; return SEMANAS=j; });
}
async function datosDeMeses(ms){
  await Promise.all(ms.filter(m=>!CARGADOS[m]).map(m=>fetch(`datos/${m}.json`).then(r=>r.json()).then(j=>guardarMes(m, j)).catch(()=>{})));
  const vs = {}, ss = {};
  ms.forEach(m=>{ const c=CARGADOS[m]; if (!c) return; c.votaciones.forEach(v=>vs[v.id]=v); c.sesiones.forEach(s=>ss[s.id]=s); });
  return {vs, ss};
}
function rangoSemana(s){
  const [a,b] = [s.desde, s.hasta].map(x=>x.split("-").map(Number));
  const M = MESES_LARGOS;
  return a[1]===b[1] ? `${a[2]}–${b[2]} de ${M[b[1]-1]} de ${b[0]}` : `${a[2]} de ${M[a[1]-1]}${a[0]!==b[0]?` de ${a[0]}`:""} – ${b[2]} de ${M[b[1]-1]} de ${b[0]}`;
}
// Ir a una votación o a una sesión aunque no esté en el periodo cargado: se carga su mes.
function irVotacion(id, fecha){
  if (VOTES[id]) return ir("votaciones", "v-"+id);
  fijarRuta("votacion-"+id, true);
  arrancar(fecha.slice(0,7));
}
function irSesion(id, fecha){
  if (DATA.sesiones.some(s=>s.id===id)) return ir("dias", "s-"+id);
  fijarRuta("sesion-"+id, true);
  arrancar(fecha.slice(0,7));
}
const filaVoto = v => { const d=dt(v.fecha); return `<button class="sv-row" data-irv="${v.id}" data-f="${v.fecha}"><span class="sv-f">${d.w.slice(0,3)} ${d.d}</span><span class="sv-t">${esc(v.titulo)}<small>${esc(v.tipo)}</small></span><span class="sv-n">${v.si}–${v.no}</span><span class="res ${passed(v)?"ok":"ko"}">${resLabel(v)}</span></button>`; };
async function renderSemana(){
  const el = $("#semana");
  if (!SEMANAS){ el.innerHTML = `<p class="nota">Cargando…</p>`; await cargarSemanas(); }
  if (!SEMANAS.length){ el.innerHTML = `<p class="nota">Aún no hay semanas con actividad.</p>`; return; }
  let k = SEMANAS.findIndex(s=>s.id===semSel); if (k<0) k = SEMANAS.length-1;
  const s = SEMANAS[k], quiero = s.id; semSel = quiero;
  const {vs, ss} = await datosDeMeses([...new Set([s.desde, s.hasta, ...s.fechas].map(f=>f.slice(0,7)))].filter(m=>INDICE.meses.some(x=>x.mes===m)));
  if (semSel !== quiero) return;
  const V = s.votaciones.map(id=>vs[id]).filter(Boolean), aj = s.ajustadas.map(id=>vs[id]).filter(Boolean);
  const kpis = [[V.length,"votaciones en el Pleno"],[s.aprobadas,"aprobadas"],[V.length-s.aprobadas,"rechazadas"],[s.discrepancias,s.discrepancias===1?"voto distinto al de su grupo":"votos distintos al de su grupo"],[s.sesiones.length,"sesiones"],[s.intervenciones,"intervenciones analizadas"]]
    .filter(([n],i)=>n || i<3).map(([n,l])=>`<div class="kpi"><b>${n}</b><span>${l}</span></div>`).join("");
  const opciones = SEMANAS.slice().reverse().map(x=>`<option value="${x.id}"${x.id===s.id?" selected":""}>${rangoSemana(x)}</option>`).join("");
  const dest = aj[0];
  const leyes = s.leyes.length ? `<div class="chart"><h3>Leyes que se han movido</h3><ul class="sem-leyes">${s.leyes.slice(0,8).map(e=>`<li><button class="linklike" data-ini="${e.exp}">${esc(e.titulo.length>110?e.titulo.slice(0,110)+"…":e.titulo)}</button><span class="pill ${e.evento.startsWith("Es ley")||e.evento.startsWith("Aprobada")?"st-analizado":e.evento==="Rechazada"?"st-pendiente":"st-parcial"}">${esc(e.evento)}</span></li>`).join("")}</ul>${s.leyes.length>8?`<p class="nota">Y ${s.leyes.length-8} más.</p>`:""}</div>` : "";
  const rdl = s.rdl.map(id=>vs[id]).filter(Boolean), tomas = s.tomas.map(id=>vs[id]).filter(Boolean);
  const rebeldes = s.rebeldes.map(([i,n])=>{ const d=DIP[i]; return d ? `<button class="reb" data-dip="${d.slug}">${imgFoto(d,"avatar foto",` style="--grupo:${G[d.g]?.color}"`) || `<span class="avatar" style="background:${G[d.g]?.color}">${esc(iniciales(legible(d.n)))}</span>`}<span><b>${esc(legible(d.n))}</b><small>${esc(d.g)} · ${n} ${n===1?"voto":"votos"} distinto${n===1?"":"s"} a su grupo</small></span></button>` : ""; }).join("");
  el.innerHTML = `
    <div class="view-intro"><div><div class="eyebrow">La semana en el Congreso · ${esc(rangoSemana(s))}</div>
      <h2 style="font-size:clamp(26px,3.6vw,40px);margin-top:8px">${esc(s.titular)}</h2>
      <p>${botonCompartir("semana/"+s.id, s.titular)}${botonRss("")}</p></div></div>
    <nav class="sem-nav" aria-label="Otras semanas"><button class="btn boton-claro" data-sem="${SEMANAS[k-1]?.id||""}" ${k?"":"disabled"}>← Anterior</button>
      <select id="sem-sel" aria-label="Elegir semana">${opciones}</select>
      <button class="btn boton-claro" data-sem="${SEMANAS[k+1]?.id||""}" ${k<SEMANAS.length-1?"":"disabled"}>Siguiente →</button></nav>
    <div class="kpis">${kpis}</div>
    <div class="grid2 sem-top">
      ${dest?`<div class="chart"><h3>La más ajustada</h3><button class="sem-dest" data-irv="${dest.id}" data-f="${dest.fecha}"><div class="hemi-wrap">${hemiciclo(dest,{grande:true})}<div class="hemi-center"><b>${dest.si} – ${dest.no}</b><span>${resLabel(dest)}</span></div></div><span class="sv-t">${esc(dest.titulo)}</span></button></div>`:""}
      ${leyes || (s.citas.length?`<div class="chart"><h3>Frases de la semana</h3>${s.citas.map(c=>`<figure class="sem-cita"><blockquote><mark>«${esc(c.cita)}»</mark></blockquote><figcaption>${gdot(c.g)}${esc(c.orador)}</figcaption></figure>`).join("")}</div>`:"")}
    </div>
    ${leyes && s.citas.length?`<section class="sec"><div class="sec-h"><h2>Frases de la semana</h2></div><div class="grid2">${s.citas.map(c=>`<figure class="sem-cita chart"><blockquote><mark>«${esc(c.cita)}»</mark></blockquote><figcaption>${gdot(c.g)}${esc(c.orador)}</figcaption></figure>`).join("")}</div></section>`:""}
    ${rdl.length?`<section class="sec"><div class="sec-h"><h2>Decretos del Gobierno</h2><p>Los reales decretos-leyes necesitan que el Congreso los convalide en un mes.</p></div><div class="sv-list">${rdl.map(filaVoto).join("")}</div></section>`:""}
    ${tomas.length?`<section class="sec"><div class="sec-h"><h2>Tomas en consideración</h2><p>Proposiciones de ley que el Pleno decide si admite a debate.</p></div><div class="sv-list">${tomas.map(filaVoto).join("")}</div></section>`:""}
    ${rebeldes?`<section class="sec"><div class="sec-h"><h2>Por libre</h2><p>Diputados que más veces votaron distinto a la mayoría de su grupo esta semana.</p></div><div class="rebeldes">${rebeldes}</div></section>`:""}
    ${s.temas.length?`<section class="sec"><div class="sec-h"><h2>De qué se habló</h2></div><div class="controls">${s.temas.map(([t,n])=>`<button class="chipbtn" data-tema="${esc(t)}">${esc(t)} <small>${n}</small></button>`).join("")}</div></section>`:""}
    ${V.length?`<section class="sec"><div class="sec-h"><h2>Todas las votaciones</h2></div><div class="sv-list">${V.map(filaVoto).join("")}</div></section>`:""}
    ${s.sesiones.length?`<section class="sec"><div class="sec-h"><h2>Sesiones</h2></div><div class="controls">${s.sesiones.map(id=>{ const x=ss[id]; if (!x) return ""; const d=dt(x.fecha); return `<button class="chipbtn" data-irs="${x.id}" data-f="${x.fecha}">${d.w.slice(0,3)} ${d.d} · ${esc(x.organo.length>48?x.organo.slice(0,47)+"…":x.organo)}</button>`; }).join("")}</div></section>`:""}`;
  $("#sem-sel").addEventListener("change", e=>irSemana(e.target.value));
}
function irSemana(id){ semSel = id || null; rendered.semana = false; show("semana", false); fijarRuta("semana-"+semSel, true); window.scrollTo(0,0); }

/* ---------- lo que viene: el próximo pleno ---------- */
function proximoPleno(){
  const hoy = hoyISO(), ag = DATA.agenda || {};
  const p = (ag.plenos||[]).filter(x=>x.dias.length && x.dias.at(-1) >= hoy).sort((a,b)=>a.dias[0].localeCompare(b.dias[0]))[0];
  if (!p) return "";
  const secciones = []; p.puntos.forEach(x=>{ let s=secciones.at(-1); if (!s || s.t!==x.seccion) secciones.push(s={t:x.seccion, ps:[]}); s.ps.push(x); });
  const diasTxt = p.dias.map(f=>{ const d=dt(f); return `${d.w} ${d.d}`; }).join(" y ") + ` de ${MESES_LARGOS[+p.dias.at(-1).slice(5,7)-1]}`;
  const enCurso = p.dias[0] <= hoy;
  const punto = x => { const esLey = x.exp.some(e=>/^12[1-5]\//.test(e)), exp = x.exp[0];
    return `<li>${x.grupo?`<span class="od-g" title="${esc(autorNombre(x.grupo))}">${autorDot(x.grupo)}${esc(x.grupo==="GOB"?"Gob.":x.grupo)}</span>`:`<span class="od-g"></span>`}
      <span class="od-t">${x.autor?`<small>${esc(x.autor)} → ${esc(x.a)}</small>`:""}${esc(x.titulo.length>170?x.titulo.slice(0,170)+"…":x.titulo)}</span>
      ${exp?(esLey||INICIATIVAS[exp]?`<button class="linklike mono od-e" data-ini="${exp}">${exp}</button>`:`<span class="mono od-e">${exp}</span>`):""}</li>`; };
  const coms = (ag.comisiones||[]).filter(c=>c.fecha>=hoy && c.fecha<=p.dias.at(-1));
  return `<section class="sec agenda"><div class="sec-h"><h2>${enCurso?"Esta semana en el Pleno":"Próximo pleno"}</h2><a href="${p.pdf}" target="_blank" rel="noopener">Orden del día oficial (PDF) ↗</a></div>
    <div class="chart"><div class="od-cab"><div class="eyebrow">Sesión plenaria nº ${esc(p.sesion)}</div><h3>${esc(diasTxt[0].toUpperCase()+diasTxt.slice(1))}</h3>
      <p class="sub">${resumenOrden(secciones)}</p></div>
      ${secciones.map(s=>`<details class="od-sec"${s.ps.length<=4?" open":""}><summary><b>${esc(s.t)}</b><span class="n">${s.ps.length}</span></summary><ul class="od">${s.ps.map(punto).join("")}</ul></details>`).join("")}
      ${coms.length?`<details class="od-sec"><summary><b>Comisiones hasta entonces</b><span class="n">${coms.length}</span></summary><ul class="od">${coms.map(c=>{ const d=dt(c.fecha); return `<li><span class="od-g">${d.w.slice(0,3)} ${d.d}</span><span class="od-t"><small>${esc(c.hora)}</small>${esc(c.organo)}${c.asunto?`: ${esc(c.asunto.length>160?c.asunto.slice(0,160)+"…":c.asunto)}`:""}</span></li>`; }).join("")}</ul></details>`:""}
    </div></section>`;
}
// «Toma en consideración de Proposiciones de Ley» (2) -> «2 tomas en consideración».
const SECCION_CORTA = [[/^toma en consideraci/i,"toma en consideración","tomas en consideración"],[/^proposiciones no de ley/i,"proposición no de ley","proposiciones no de ley"],
  [/^mociones/i,"moción","mociones"],[/^preguntas/i,"pregunta","preguntas"],[/^interpelaciones/i,"interpelación","interpelaciones"],
  [/^debates? de totalidad/i,"debate de totalidad","debates de totalidad"],[/convenios internacionales/i,"convenio internacional","convenios internacionales"],
  [/^dictámen(es)? de comisi[oó]n(es)? sobre (iniciativas|proyectos|proposiciones)/i,"dictamen de ley","dictámenes de ley"],[/^convalidaci[oó]n/i,"decreto-ley","decretos-leyes"]];
function resumenOrden(secciones){
  let resto = 0; const partes = [];
  secciones.forEach(s=>{ const m = SECCION_CORTA.find(([re])=>re.test(s.t)); const n = s.ps.length;
    if (m) partes.push(`${n} ${n===1?m[1]:m[2]}`); else resto += n; });
  if (resto) partes.push(`${resto} ${resto===1?"asunto más":"asuntos más"}`);
  return partes.join(" · ");
}
function tarjetaSemana(){
  if (!SEMANAS) return "";
  const s = SEMANAS.at(-1); if (!s) return "";
  return `<section class="sec"><div class="sec-h"><h2>La semana en el Congreso</h2><button class="linklike" data-sem="${s.id}">Semanas anteriores</button></div>
    <button class="sem-card chart" data-sem="${s.id}"><span class="eyebrow">${esc(rangoSemana(s))}</span><b>${esc(s.titular)}</b>
      <span class="sub">${s.votaciones.length} votaciones · ${s.aprobadas} aprobadas · ${s.discrepancias} votos distintos al de su grupo${s.leyes.length?` · ${s.leyes.length} leyes se han movido`:""}</span><span class="linklike">Leer el resumen →</span></button></section>`;
}

/* ---------- entender: glosario y «¿qué significa esto?» ---------- */
// Definiciones breves y neutrales. Donde hay artículo de la Constitución (CE) o del Reglamento, se cita.
const GLOSARIO = {
  "legislatura": ["Legislatura", "Periodo entre dos elecciones generales. La XV empezó el 17 de agosto de 2023."],
  "circunscripcion": ["Circunscripción", "Cada provincia, más Ceuta y Melilla: 52 en total. Cada una elige un número de diputados según su población, con un mínimo de dos (uno en Ceuta y en Melilla)."],
  "grupo-parlamentario": ["Grupo parlamentario", "Diputados que se organizan juntos en la Cámara, normalmente los de un mismo partido o coalición. Los grupos reparten el tiempo de palabra, los puestos en comisiones y las iniciativas."],
  "grupo-mixto": ["Grupo Mixto", "Reúne a los diputados de partidos que no tienen bastantes escaños para formar grupo propio y a quienes abandonan el suyo. Sus miembros pueden votar distinto entre sí."],
  "pleno": ["Pleno", "La reunión de los 350 diputados. Allí se hacen las votaciones finales y la sesión de control al Gobierno. Suele reunirse de martes a jueves en las semanas de sesiones."],
  "comision": ["Comisión", "Grupo de diputados especializado en una materia (Sanidad, Justicia…). Allí se estudian y enmiendan las leyes y comparecen los responsables de cada área."],
  "mesa": ["Mesa del Congreso", "El órgano que dirige la Cámara: la Presidencia, cuatro vicepresidencias y cuatro secretarías. Admite a trámite las iniciativas y decide cómo se tramitan y con qué plazos."],
  "junta-portavoces": ["Junta de Portavoces", "Los portavoces de los grupos reunidos con la Presidencia. Fijan el orden del día de los plenos; cada portavoz vota con el peso de los escaños de su grupo."],
  "diputacion-permanente": ["Diputación Permanente", "Un órgano reducido que actúa cuando las Cortes no están reunidas o se han disuelto; por ejemplo, puede convalidar decretos-leyes."],
  "proyecto-de-ley": ["Proyecto de ley", "Propuesta de ley que presenta el Gobierno. Entra directamente en tramitación; los grupos pueden pedir que se devuelva con una enmienda a la totalidad."],
  "proposicion-de-ley": ["Proposición de ley", "Propuesta de ley que presentan los grupos, el Senado o los parlamentos autonómicos (también los ciudadanos, con 500.000 firmas). Antes de tramitarse, el Pleno debe admitirla en la toma en consideración."],
  "toma-en-consideracion": ["Toma en consideración", "Votación en la que el Pleno decide si admite debatir una proposición de ley. Si sale adelante, empieza su tramitación en comisión; todavía no es ley y puede cambiar mucho o no aprobarse nunca."],
  "enmienda": ["Enmienda", "Propuesta de cambio a un texto: añadir, suprimir o modificar una parte. Los grupos las presentan durante el plazo de enmiendas y se votan en comisión y en el Pleno."],
  "enmienda-totalidad": ["Enmienda a la totalidad", "Rechazo de un proyecto de ley entero, que se vota en el debate de totalidad. Si se aprueba una enmienda de devolución, el proyecto vuelve al Gobierno y decae; también puede proponer un texto alternativo."],
  "plazo-enmiendas": ["Plazo de enmiendas", "Tiempo para que los grupos presenten enmiendas. La Mesa puede ampliarlo, normalmente semana a semana; si se amplía indefinidamente, la ley queda parada sin votarse. Es lo que se conoce como «el congelador»."],
  "ponencia": ["Ponencia", "Grupo reducido de diputados de la comisión que estudia las enmiendas y redacta un informe con el texto propuesto."],
  "dictamen": ["Dictamen", "El texto que aprueba la comisión después de la ponencia. Después va al Pleno, salvo que la comisión tenga competencia legislativa plena."],
  "competencia-legislativa-plena": ["Competencia legislativa plena", "Cuando la comisión aprueba la ley en nombre del Congreso, sin votación final en el Pleno. No vale para leyes orgánicas, presupuestos ni otras materias reservadas (art. 75.3 CE)."],
  "lectura-unica": ["Lectura única", "El Pleno debate y vota el texto en una sola vez, sin pasar por comisión. Se usa en textos sencillos o cuando hay mucho acuerdo."],
  "urgente": ["Tramitación urgente", "Los plazos se reducen a la mitad. En el Senado, el plazo pasa de dos meses a veinte días naturales."],
  "senado": ["Paso por el Senado", "Tras aprobarla el Congreso, el Senado tiene dos meses (veinte días si es urgente) para aceptarla, enmendarla o vetarla. El Congreso vota después las enmiendas del Senado por mayoría simple; el veto solo se levanta por mayoría absoluta o, pasados dos meses, por mayoría simple (art. 90 CE)."],
  "ley-organica": ["Ley orgánica", "Ley que regula derechos fundamentales, estatutos de autonomía, el régimen electoral y otras materias previstas en la Constitución. Necesita mayoría absoluta del Congreso (176 votos) en una votación final sobre el conjunto (art. 81 CE)."],
  "real-decreto-ley": ["Real decreto-ley", "Norma con rango de ley que aprueba el Gobierno en casos de «extraordinaria y urgente necesidad». Está en vigor desde que se publica, pero el Congreso debe convalidarla o derogarla en treinta días hábiles (art. 86 CE)."],
  "convalidacion": ["Convalidación", "Votación en la que el Congreso decide si un real decreto-ley sigue en vigor. Si no se convalida, queda derogado. Después puede votarse también tramitarlo como proyecto de ley, para que los grupos puedan enmendarlo."],
  "proposicion-no-de-ley": ["Proposición no de ley (PNL)", "Texto con el que el Congreso expresa una posición o pide al Gobierno que haga algo. No cambia ninguna ley y no obliga jurídicamente al Gobierno, aunque tiene peso político."],
  "mocion": ["Moción consecuencia de interpelación", "Después de una interpelación urgente, el grupo que la hizo presenta una moción que se vota en el pleno siguiente. Como una PNL, pide al Gobierno que actúe, pero no le obliga jurídicamente."],
  "interpelacion": ["Interpelación urgente", "Pregunta al Gobierno sobre su política general en un asunto, con más tiempo que una pregunta oral. Da pie a una moción que se vota después."],
  "pregunta-oral": ["Pregunta oral", "Pregunta breve a un miembro del Gobierno en la sesión de control del Pleno (los miércoles) o en comisión. Pregunta y respuesta tienen unos pocos minutos."],
  "pregunta-escrita": ["Pregunta escrita", "Pregunta al Gobierno que se contesta por escrito. El Gobierno tiene veinte días desde su publicación para responder, prorrogables otros veinte (art. 190 del Reglamento)."],
  "comparecencia": ["Comparecencia", "Un miembro del Gobierno, una autoridad o un experto acude a una comisión o al Pleno a informar y responder a los grupos."],
  "sesion-de-control": ["Sesión de control", "La parte del Pleno, normalmente los miércoles, dedicada a preguntas e interpelaciones al Gobierno."],
  "mayoria-absoluta": ["Mayoría absoluta", "La mitad más uno de los miembros de la Cámara: 176 votos a favor, voten los que voten."],
  "mayoria-simple": ["Mayoría simple", "Más votos a favor que en contra entre los presentes. Es la regla general en las votaciones."],
  "asentimiento": ["Asentimiento", "Aprobación sin votación, porque nadie se opone a la propuesta de la Presidencia."],
  "voto-telematico": ["Voto telemático", "Voto a distancia, que la Mesa autoriza en casos previstos: embarazo, maternidad o paternidad, enfermedad grave y otras situaciones justificadas."],
  "diario-de-sesiones": ["Diario de Sesiones", "La transcripción oficial y literal de lo que se dice en cada sesión, con anotaciones como aplausos o rumores."],
  "bocg": ["BOCG", "Boletín Oficial de las Cortes Generales: publica los textos de las iniciativas, las enmiendas y los informes."],
  "convenio-internacional": ["Convenio internacional", "Tratado que España firma con otros Estados. Muchos necesitan la autorización de las Cortes para obligar a España (art. 94 CE)."],
  "suplicatorio": ["Suplicatorio", "Autorización que pide el Tribunal Supremo al Congreso para procesar a un diputado, que tiene inmunidad parlamentaria."],
  "banco-azul": ["Banco azul", "Los escaños del Gobierno en la primera fila del hemiciclo."],
  "declaracion-intereses": ["Declaración de intereses", "Cada diputado declara al tomar posesión sus actividades de los últimos años, las aportaciones que hace y los regalos que recibe. La Comisión del Estatuto vigila las incompatibilidades."],
};
const glosa = (clave, texto) => GLOSARIO[clave] ? `<button class="gl" data-gl="${clave}" data-tip="${esc(`<b>${GLOSARIO[clave][0]}</b><br>${GLOSARIO[clave][1]}<br><i>Pulsa para ver el glosario</i>`)}">${esc(texto ?? GLOSARIO[clave][0])}</button>` : esc(texto);
const TIPO_GLOSA = {"Proposición no de ley":"proposicion-no-de-ley","Moción":"mocion","Convalidación RDL":"convalidacion","Toma en consideración":"toma-en-consideracion",
  "Enmiendas del Senado":"senado","Dictamen":"dictamen","Proyecto de ley":"proyecto-de-ley"};
const tipoGlosa = t => TIPO_GLOSA[t] ? glosa(TIPO_GLOSA[t], t) : esc(t);
// Una frase fija por tipo y resultado. Evita el error más común: creer que aprobar una PNL cambia una ley.
function significa(v){
  const ok = passed(v), t = v.tipo, tit = v.titulo || "";
  if (/\(enmienda|enmiendas? (?:de|del) /i.test(tit) && t!=="Enmiendas del Senado") return ok ? "Aprobada una enmienda: ese cambio entra en el texto que se sigue tramitando." : "Rechazada una enmienda: el texto queda como estaba en ese punto.";
  if (t==="Convalidación RDL" && tit.startsWith("Tramitar")) return ok ? "El decreto se tramitará también como proyecto de ley: los grupos podrán enmendarlo. Mientras, sigue en vigor." : "El decreto sigue en vigor tal como lo aprobó el Gobierno; no se podrá enmendar.";
  if (t==="Convalidación RDL") return ok ? "Convalidado: el decreto del Gobierno sigue en vigor." : "Derogado: el decreto del Gobierno deja de estar en vigor.";
  if (t==="Proposición no de ley" || t==="Moción") return ok ? "Aprobada: es una petición o una posición del Congreso. No cambia ninguna ley ni obliga jurídicamente al Gobierno." : "Rechazada: el Congreso no hace suya esta petición.";
  if (t==="Toma en consideración") return ok ? "Admitida a debate: empieza su tramitación en comisión. Todavía no es ley." : "Rechazada: esta proposición no se tramitará.";
  if (t==="Enmiendas del Senado") return "Se votan los cambios que introdujo el Senado. Después, la ley ya puede publicarse en el BOE.";
  if (/^debate de totalidad|totalidad/i.test(t+" "+tit)) return ok ? "Aprobada la enmienda a la totalidad: el proyecto se devuelve al Gobierno." : "Rechazada la enmienda a la totalidad: el proyecto sigue su tramitación.";
  if (t==="Dictamen" || t==="Proyecto de ley" || /votaci[oó]n de conjunto|conjunto/i.test(tit)) return ok ? "Aprobado en el Congreso. Si no ha pasado aún por el Senado, va allí; si vuelve de allí, queda listo para publicarse." : "Rechazado en el Congreso: el texto no sigue adelante.";
  if (/convenio|acuerdo entre|protocolo/i.test(tit)) return ok ? "Autorizado: España podrá obligarse por este tratado." : "No autorizado: España no podrá obligarse por este tratado.";
  return "";
}
function renderGlosario(){
  const q = sinTildes(($("#gl-q")?.value)||"");
  const claves = Object.keys(GLOSARIO).sort((a,b)=>GLOSARIO[a][0].localeCompare(GLOSARIO[b][0],"es"));
  $("#glosario").innerHTML = `<div class="view-intro"><div><h2>Glosario</h2><p>Las palabras del Congreso, en pocas líneas. Cuando veas un término subrayado con puntos en la web, puedes pulsarlo para venir aquí.</p>
    <p><button class="linklike" data-go-ley>Cómo se hace una ley, paso a paso →</button></p></div></div>
    <input id="gl-q" type="search" placeholder="Buscar un término…" aria-label="Buscar en el glosario" value="${esc(q)}">
    <dl class="glosario">${claves.map(k=>`<div id="gl-${k}"><dt>${esc(GLOSARIO[k][0])}</dt><dd>${esc(GLOSARIO[k][1])}</dd></div>`).join("")}</dl>`;
  $("#gl-q").addEventListener("input", e=>{ const q=sinTildes(e.target.value); document.querySelectorAll(".glosario > div").forEach(d=>d.hidden = !!q && !sinTildes(d.textContent).includes(q)); });
}
function irGlosario(clave){
  rendered.glosario = false; show("glosario", false); fijarRuta("glosario", true);
  const el = document.getElementById("gl-"+clave);
  if (el){ el.scrollIntoView({block:"center"}); el.animate?.([{background:"var(--sub)"},{background:"transparent"}],{duration:1800}); } else window.scrollTo(0,0);
}

/* ---------- cómo se hace una ley ---------- */
function renderComoLey(){
  const el = $("#como-ley");
  if (!LEYES){ el.innerHTML = `<p class="nota">Cargando…</p>`; cargarLeyes().then(()=>{ if (!$("#como-ley").hidden) renderComoLey(); else rendered["como-ley"]=false; }); return; }
  const I = LEYES.iniciativas, n = k => I.filter(i=>i.etapa>=k).length;
  const ej = f => { const l = I.filter(f).sort((a,b)=>(b.fases.at(-1)?.[2]||"").localeCompare(a.fases.at(-1)?.[2]||""))[0]; return l ? `<p class="ej">Por ejemplo: <button class="linklike" data-ini="${l.exp}">${esc(tituloLey(l))}</button></p>` : ""; };
  const enFase = txt => i => i.estado==="en trámite" && i.situacion.includes(txt);
  const pasos = [
    ["1","Alguien propone una ley", `El Gobierno presenta un ${glosa("proyecto-de-ley","proyecto de ley")}; los grupos, el Senado, los parlamentos autonómicos o 500.000 ciudadanos, una ${glosa("proposicion-de-ley","proposición de ley")}. La ${glosa("mesa","Mesa")} la admite y se publica en el ${glosa("bocg","BOCG")}.`, `${I.length} iniciativas en esta legislatura`, ""],
    ["2","El Pleno decide si la debate", `Las proposiciones pasan por la ${glosa("toma-en-consideracion","toma en consideración")}: si el Pleno vota que sí, empieza su tramitación. Los proyectos del Gobierno entran directamente, aunque los grupos pueden pedir su devolución con una ${glosa("enmienda-totalidad","enmienda a la totalidad")}.`, `${n(1)} admitidas a debate`, ej(enFase("Toma en consideración"))],
    ["3","Los grupos proponen cambios", `Se abre el ${glosa("plazo-enmiendas","plazo de enmiendas")}. La Mesa puede ampliarlo semana a semana; mientras tanto, la ley no avanza.`, `${I.filter(i=>i.estado==="en trámite"&&/Enmiendas/.test(i.situacion)).length} están ahora en plazo de enmiendas`, ej(enFase("Enmiendas"))],
    ["4","La comisión escribe el texto", `Una ${glosa("ponencia","ponencia")} estudia las enmiendas y hace un informe; la ${glosa("comision","comisión")} lo debate y aprueba el ${glosa("dictamen","dictamen")}. A veces la comisión tiene ${glosa("competencia-legislativa-plena","competencia legislativa plena")} y la aprueba ella misma.`, `${n(2)} han llegado a esta fase`, ej(i=>i.estado==="en trámite" && /Informe|Dictamen/.test(i.situacion))],
    ["5","El Pleno del Congreso vota", `Se votan las enmiendas que quedan vivas y el texto. Las ${glosa("ley-organica","leyes orgánicas")} necesitan ${glosa("mayoria-absoluta","mayoría absoluta")} (176 votos) en una votación final; las demás, ${glosa("mayoria-simple","mayoría simple")}.`, `${n(3)} aprobadas en el Congreso`, ""],
    ["6","Pasa por el Senado", `El Senado puede aceptarla, enmendarla o vetarla (${glosa("senado","ver plazos")}). Si la cambia, el Congreso vota si acepta esos cambios; el Congreso tiene la última palabra.`, `${n(4)} han pasado por el Senado`, ej(i=>i.estado==="en trámite" && /Senado/.test(i.situacion))],
    ["7","Se publica en el BOE", `El Rey la sanciona y se publica en el Boletín Oficial del Estado. Desde ese momento es ley.`, `${n(5)} leyes de esta legislatura`, ej(i=>i.estado==="aprobada")],
  ];
  el.innerHTML = `<div class="view-intro"><div><div class="eyebrow">Entender el Congreso</div><h2>Cómo se hace una ley</h2>
      <p>Del registro al BOE, en siete pasos, con las cifras reales de esta legislatura. Los términos subrayados con puntos se explican al pasar por encima.</p></div></div>
    <ol class="como-ley">${pasos.map(([k,t,txt,cifra,ejemplo])=>`<li><span class="num">${k}</span><div><h3>${t}</h3><p>${txt}</p><p class="cifra">${cifra}</p>${ejemplo}</div></li>`).join("")}</ol>
    <section class="sec"><div class="sec-h"><h2>Y los decretos-leyes</h2></div>
      <p class="prosa">El Gobierno también puede aprobar normas con rango de ley por su cuenta: los ${glosa("real-decreto-ley","reales decretos-leyes")}. Están en vigor desde que se publican, pero el Congreso debe ${glosa("convalidacion","convalidarlos")} en un mes; si no, quedan derogados. En esta legislatura se han publicado ${(LEYES.aprobadas||[]).filter(x=>x.tipo==="Real decreto-ley").length}.</p></section>
    <p><button class="btn boton-claro" data-go="leyes">Ver todas las leyes de la legislatura</button> <button class="btn boton-claro" data-gl="toma-en-consideracion">Glosario</button></p>`;
}

/* ---------- tus diputados: por provincia ---------- */
let provSel = null;
const CIRCS = () => [...new Set(DIP.filter(d=>!d.baja && d.circ).map(d=>d.circ))].sort((a,b)=>a.localeCompare(b,"es"));
const provGuardada = () => { try{ return localStorage.getItem("provincia")||""; }catch(e){ return ""; } };
function selectorProvincia(sel){
  return `<select class="prov-sel" aria-label="Elige tu provincia"><option value="">Elige tu provincia…</option>${CIRCS().map(c=>`<option value="${esc(slug(c))}"${slug(c)===sel?" selected":""}>${esc(c)}</option>`).join("")}</select>`;
}
function bloqueTusDiputados(){
  const sl = provGuardada(), circ = CIRCS().find(c=>slug(c)===sl);
  const ds = circ ? DIP.filter(d=>d.circ===circ && !d.baja) : [];
  return `<section class="sec tus"><div class="sec-h"><h2>Tus diputados</h2><p>Quién te representa en el Congreso, cómo vota y qué pregunta.</p></div>
    <div class="chart tus-card">${selectorProvincia(sl)}
      ${circ?`<div class="tus-fotos">${ds.slice(0,16).map(d=>`<button class="tus-f" data-dip="${d.slug}" title="${esc(legible(d.n))} · ${d.g}">${imgFoto(d,"avatar foto",` style="--grupo:${G[d.g]?.color}"`) || `<span class="avatar" style="background:${G[d.g]?.color}">${esc(iniciales(legible(d.n)))}</span>`}</button>`).join("")}${ds.length>16?`<span class="n">+${ds.length-16}</span>`:""}</div>
        <button class="btn primary boton" data-prov="${esc(sl)}">Ver los ${ds.length} diputados de ${esc(circ)}</button>`:`<p class="sub">Elige dónde votas y te enseñamos a tus diputados: su voto en las decisiones más ajustadas, cuántas veces se apartan de su grupo y qué preguntan al Gobierno.</p>`}
    </div></section>`;
}
function irProvincia(sl){ provSel = sl; try{ localStorage.setItem("provincia", sl); }catch(e){} rendered.provincia=false; show("provincia", false); fijarRuta("provincia-"+sl, true); window.scrollTo(0,0); }
function hemiProvincia(ds){
  if (!CON_PLANO) return "";
  const ids = new Set(ds.map(d=>d.i));
  const seats = DIP.filter(d=>DIPS[d.i][5]!=null && !d.baja).map(d=>{ const on=ids.has(d.i);
    return `<circle cx="${DIPS[d.i][5]}" cy="${DIPS[d.i][6]}" r="${on?ESC_R+1:ESC_R*.8}" style="fill:${on?G[d.g]?.color:"var(--line)"}" ${on?`data-n="${esc(d.n)}" data-g="${d.g}"`:""}></circle>`; }).join("");
  return `<svg class="hemi real prov" viewBox="-4 -4 ${PLANO.ancho+8} ${PLANO.alto+4}" role="img" aria-label="Escaños de los diputados de esta provincia">${seats}</svg>`;
}
async function renderProvincia(){
  const el = $("#provincia"), circ = CIRCS().find(c=>slug(c)===provSel) || CIRCS().find(c=>slug(c)===provGuardada());
  if (!circ){ el.innerHTML = `<div class="view-intro"><div><h2>Tus diputados</h2><p>Elige tu provincia.</p></div></div>${selectorProvincia("")}`; return; }
  provSel = slug(circ);
  const ds = DIP.filter(d=>d.circ===circ && !d.baja).sort((a,b)=>ORDEN_HEMI.indexOf(a.g)-ORDEN_HEMI.indexOf(b.g) || a.n.localeCompare(b.n,"es"));
  const reparto = ORDEN_HEMI.map(g=>[g, ds.filter(d=>d.g===g).length]).filter(x=>x[1]);
  const P = await cargarPreguntas(); await cargarExtra();
  if (provSel !== slug(circ)) return;
  const S = statsDip;
  const tarjetas = ds.map(d=>{ const s=S[d.i], pq=P?.diputados?.[d.i], com=(EXTRA?.[d.n]?.comisiones||[]).map(c=>c[0].replace(/^Comisión (de |del |sobre |para )?/,"")).slice(0,3);
    return `<button class="tus-dip" data-dip="${d.slug}">${imgFoto(d,"avatar foto",` style="--grupo:${G[d.g]?.color}"`) || `<span class="avatar" style="background:${G[d.g]?.color}">${esc(iniciales(legible(d.n)))}</span>`}
      <span class="td-body"><span class="td-n"><b>${esc(legible(d.n))}</b><small>${gdot(d.g)}${esc(G[d.g]?.nombre||d.g)}</small></span>
      <span class="td-k"><span><b>${pct(s.part)}</b> participación</span><span><b>${s.dis}</b> ${s.dis===1?"vez":"veces"} distinto a su grupo</span>${pq?`<span><b>${fmt(pq[0])}</b> preguntas escritas</span>`:""}</span>
      ${com.length?`<span class="td-c">${com.map(esc).join(" · ")}</span>`:""}</span></button>`; }).join("");
  // Las decisiones más ajustadas del periodo, con el voto de cada uno.
  const aj = DATA.votaciones.filter(v=>v.v && v.v.length===DIPS.length).sort((a,b)=>margen(a)-margen(b) || b.fecha.localeCompare(a.fecha)).slice(0,8);
  const filasAj = aj.map(v=>`<div class="pv-row"><button class="linklike pv-t" data-irv="${v.id}" data-f="${v.fecha}">${esc(v.titulo)}</button><span class="res ${passed(v)?"ok":"ko"}">${resLabel(v)} ${v.si}–${v.no}</span>
      <span class="pv-dots">${ds.map(d=>{ const x=v.v[d.i]; return `<i class="${x==="-"?"na":x}" data-tip="${esc(`${legible(d.n)} (${d.g}): ${x==="-"?"no era diputado":MIVOTO[x]}`)}"></i>`; }).join("")}</span></div>`).join("");
  el.innerHTML = `<button class="back" data-go="inicio">← Inicio</button>
    <div class="view-intro prov-top"><div><div class="eyebrow">Tus diputados</div><h2>${esc(circ)}</h2>
      <p>${ds.length} ${ds.length===1?"diputado":"diputados"}: ${reparto.map(([g,n])=>`${gdot(g)}${g} ${n}`).join(" · ")}. Se eligen en la ${glosa("circunscripcion","circunscripción")} de ${esc(circ)}.</p>
      <p>${selectorProvincia(provSel)} ${botonCompartir("provincia/"+provSel, "Los diputados de "+circ)}</p></div>
      <div>${hemiProvincia(ds)}</div></div>
    <div class="tus-grid">${tarjetas}</div>
    ${aj.length?`<section class="sec"><div class="sec-h"><h2>Cómo votaron en las decisiones más ajustadas</h2><p>Un punto por diputado, en el orden de arriba: <span class="leyenda-v"><i class="S"></i>sí <i class="N"></i>no <i class="A"></i>abstención <i class="X"></i>no vota</span></p></div><div class="pv">${filasAj}</div></section>`:""}
    <section class="sec" id="prov-lugar"></section>
    <section class="sec" id="prov-preguntas"><div class="sec-h"><h2>Qué preguntan al Gobierno</h2><p>Sus ${glosa("pregunta-escrita","preguntas escritas")} más recientes.</p></div><div class="nota">Cargando…</div></section>`;
  pintarLugar(circ);
  const listas = await Promise.all(ds.filter(d=>P?.diputados?.[d.i]).map(d=>fetch(`datos/preguntas/${d.slug}.json`).then(r=>r.ok?r.json():[]).catch(()=>[]).then(l=>l.slice(0,30).map(p=>[...p.slice(0,5),d]))));
  const todas = listas.flat().sort((a,b)=>b[1].localeCompare(a[1])).filter((p,k,arr)=>arr.findIndex(q=>q[0]===p[0])===k).slice(0,25);
  const sec = $("#prov-preguntas"); if (!sec) return;
  sec.querySelector(".nota").outerHTML = todas.length ? `<ul class="preg-list">${todas.map(p=>filaPregunta(p, p[5])).join("")}</ul>` : `<p class="nota">No constan preguntas escritas.</p>`;
}

/* ---------- temas que se pueden seguir ---------- */
let TEMAS_IDX = null, temasPromesa = null, temaFijo = null;
function cargarTemasIdx(){
  if (TEMAS_IDX) return Promise.resolve(TEMAS_IDX);
  return temasPromesa ||= fetch("datos/temas.json").then(r=>r.ok?r.json():{}).catch(()=>({})).then(j=>{ INDICE_BUSCAR = null; return TEMAS_IDX=j; });
}
function seguirTemas(){
  if (!TEMAS_IDX){ cargarTemasIdx().then(()=>{ const h=$("#seguir-temas"); if (h) h.outerHTML = seguirTemas(); }); return `<div id="seguir-temas"></div>`; }
  const ts = Object.entries(TEMAS_IDX).sort((a,b)=>b[1].votos.length-a[1].votos.length);
  return `<section class="sec" id="seguir-temas"><div class="sec-h"><h2>Sigue un tema</h2><p>Votaciones, leyes y lo que viene en el próximo pleno sobre cada tema. Cada uno tiene su RSS.</p></div>
    <div class="temas-seguir">${ts.map(([k,t])=>`<button class="ts" data-tema-fijo="${k}"><b>${esc(t.nombre)}</b><small>${t.votos.length} votaciones · ${t.leyes.length} leyes</small></button>`).join("")}</div></section>`;
}
async function renderTemaFijo(){
  const el = $("#tema");
  await Promise.all([cargarTemasIdx(), cargarLeyes()]);
  const t = TEMAS_IDX[temaFijo];
  if (!t){ el.innerHTML = seguirTemas(); return; }
  const hoy = hoyISO();
  const proximos = (DATA.agenda?.plenos||[]).filter(p=>p.dias.at(-1)>=hoy).flatMap(p=>p.puntos.filter(x=>(x.tm||[]).includes(temaFijo)));
  const leyes = t.leyes.map(e=>LEYES.porExp[e]).filter(Boolean);
  const vivas = leyes.filter(l=>l.estado==="en trámite").sort((a,b)=>b.etapa-a.etapa || (b.fases.at(-1)?.[2]||"").localeCompare(a.fases.at(-1)?.[2]||""));
  const hechas = leyes.filter(l=>l.estado==="aprobada");
  const votos = t.votos.map(([id,fecha,titulo,tipo,si,no,abst])=>({id,fecha,titulo,tipo,si,no,abst}));
  const filaLey = l => `<li><button class="linklike" data-ini="${l.exp}">${esc(tituloLey(l))}</button> ${pasosLey(l)} <small>${esc(l.estado==="en trámite"?l.situacion:l.resultado)}</small></li>`;
  el.innerHTML = `<button class="back" data-go="temas">← Temas</button>
    <div class="view-intro"><div><div class="eyebrow">Seguir un tema</div><h2>${esc(t.nombre)}</h2>
      <p>${votos.length} ${votos.length===1?"votación":"votaciones"} en el Pleno, ${leyes.length} ${leyes.length===1?"ley":"leyes"} (${vivas.length} en trámite, ${hechas.length} ${hechas.length===1?"aprobada":"aprobadas"})${t.preguntas?` y ${fmt(t.preguntas)} ${t.preguntas===1?"pregunta escrita":"preguntas escritas"} al Gobierno`:""} en esta legislatura. Clasificación automática por palabras clave: puede haber asuntos que se escapen.</p>
      <p><a class="btn primary boton" href="tema/${temaFijo}/rss.xml">${ICONO_RSS} Seguir por RSS</a> ${botonCompartir("tema/"+temaFijo, t.nombre+" en el Congreso")}</p></div></div>
    ${proximos.length?`<section class="sec"><div class="sec-h"><h2>En el próximo pleno</h2></div><div class="chart"><ul class="od">${proximos.map(x=>`<li><span class="od-g">${x.grupo?autorDot(x.grupo)+esc(x.grupo==="GOB"?"Gob.":x.grupo):""}</span><span class="od-t"><small>${esc(x.seccion)}${x.autor?` · ${esc(x.autor)} → ${esc(x.a)}`:""}</small>${esc(x.titulo)}</span></li>`).join("")}</ul></div></section>`:""}
    ${vivas.length?`<section class="sec"><div class="sec-h"><h2>Leyes en trámite</h2></div><ul class="tema-leyes">${vivas.slice(0,15).map(filaLey).join("")}</ul>${vivas.length>15?`<p class="nota">Y ${vivas.length-15} más en la pestaña Leyes.</p>`:""}</section>`:""}
    ${votos.length?`<section class="sec"><div class="sec-h"><h2>Últimas votaciones</h2></div><div class="sv-list">${votos.slice(0,25).map(filaVoto).join("")}</div>${votos.length>25?`<p class="nota">Y ${votos.length-25} votaciones más en la legislatura.</p>`:""}</section>`:""}
    ${hechas.length?`<section class="sec"><div class="sec-h"><h2>Leyes aprobadas</h2></div><ul class="tema-leyes">${hechas.map(filaLey).join("")}</ul></section>`:""}`;
}
function irTemaFijo(k){ temaFijo=k; rendered.tema=false; show("tema", false); fijarRuta("tema-"+k, true); window.scrollTo(0,0); }

/* ---------- preguntas escritas al Gobierno ---------- */
let PREG = null, pregPromesa = null;
function cargarPreguntas(){
  if (PREG) return Promise.resolve(PREG);
  return pregPromesa ||= fetch("datos/preguntas.json").then(r=>r.ok?r.json():null).catch(()=>null).then(j=>PREG=j);
}
const ESTADO_PREG = {pendiente:["Sin contestar","ko"], contestada:["Contestada","ok"], retirada:["Retirada","mix"], caducada:["Caducada","mix"], otra:["Otra","mix"]};
const filaPregunta = (p, d) => { const [exp,fecha,estado,titulo,demora]=p;
  // Pendiente no es «sin contestar» hasta que pasa el plazo (con margen: se cuenta desde el registro).
  const [l,c] = estado==="pendiente" && dias(fecha, hoyISO()) <= (PREG?.dias||60)+5 ? ["En plazo","mix"] : ESTADO_PREG[estado]||[estado,"mix"];
  const extra = [d?esc(legible(d.n)):"", demora!=null?`contestada en ${demora} ${demora===1?"día":"días"}`:""].filter(Boolean).join(" · ");
  return `<li><span class="pq-f">${fechaCorta(fecha)}</span><span class="pq-t">${esc(titulo)}${extra?`<small>${extra}</small>`:""}</span><a class="res ${c}" href="${urlIniciativa(exp)}" target="_blank" rel="noopener" title="Ver en la web del Congreso">${l}</a></li>`; };
function demoraPreguntas(P){
  const D = P.demora; if (!D || !D.n) return "";
  const maxT = Math.max(...D.tramos.map(t=>t[2]));
  const etiqueta = ([a,b]) => b>=100000 ? `más de ${a-1} días` : a===0 ? `hasta ${b} días` : `${a}–${b} días`;
  const gs = Object.entries(D.grupos).filter(([g])=>G[g]).sort((a,b)=>a[1][0]-b[1][0]), maxG = Math.max(...gs.map(x=>x[1][0]));
  return `<section class="sec"><div class="sec-h"><h2>Cuánto tarda en contestar</h2><p>Días desde que la Mesa admite la pregunta hasta que se da por contestada, en las ${fmt(D.n)} respuestas con fecha. El plazo es de veinte días desde la publicación, prorrogables otros veinte.</p></div>
    <div class="kpis">${[[`${D.mediana} días`,"tarda la respuesta típica (mediana)"],[pct(D.fuera/D.n),`de las respuestas llegan pasados ${P.dias} días`,true]].map(([n,l,a])=>`<div class="kpi ${a?"alert":""}"><b>${n}</b><span>${l}</span></div>`).join("")}</div>
    <div class="grid2">
      <div class="chart"><h3>Cuántas en cada plazo</h3><div class="embudo">${D.tramos.map(t=>`<div class="emb-row" data-tip="${esc(`<b>${etiqueta(t)}</b><br>${fmt(t[2])} respuestas (${pct(t[2]/D.n)})`)}"><span class="lab">${etiqueta(t)}</span><span class="trk"><i style="width:${Math.max(t[2]/maxT*100,.8)}%${t[0]>P.dias?";background:var(--no)":""}"></i></span><span class="n"><b>${fmt(t[2])}</b> <small>${pct(t[2]/D.n)}</small></span></div>`).join("")}</div></div>
      ${gs.length?`<div class="chart"><h3>Según quién pregunta</h3><p class="sub">Mediana de días hasta la respuesta, por el grupo que firma la pregunta.</p><div class="autores">${gs.map(([g,[m,n]])=>`<div class="aut-row" data-tip="${esc(`<b>${G[g].nombre}</b><br>Mediana: ${m} días, en ${fmt(n)} respuestas`)}"><span class="g">${gdot(g)}${g}</span><span class="trk" style="width:${m/maxG*100}%;background:${G[g].color};border:0"></span><span class="n">${m} días</span></div>`).join("")}</div></div>`:""}
    </div></section>`;
}
async function renderPreguntas(){
  const el = $("#preguntas");
  if (!PREG){ el.innerHTML = `<p class="nota">Cargando…</p>`; await cargarPreguntas(); }
  if (!PREG){ el.innerHTML = `<p class="nota">Aún no hay datos. Ejecuta <code>python -m escano preguntas --completo</code> y vuelve a construir la web.</p>`; return; }
  const P = PREG, e = P.estados, pend = e.pendiente||0;
  const grupos = Object.entries(P.grupos).filter(([g])=>G[g]).sort((a,b)=>b[1][0]-a[1][0]), maxG = Math.max(...grupos.map(x=>x[1][0]));
  const meses = Object.entries(P.meses), maxM = Math.max(...meses.map(x=>x[1][0]));
  const top = Object.entries(P.diputados).map(([i,v])=>[DIP[+i],v]).filter(x=>x[0]).sort((a,b)=>b[1][0]-a[1][0]).slice(0,10);
  const temas = Object.entries(P.temas).slice(0,10), maxT = temas[0]?.[1]||1;
  el.innerHTML = `<div class="view-intro"><div><div class="eyebrow">Control al Gobierno</div><h2>Preguntas escritas</h2>
      <p>Los diputados pueden preguntar al Gobierno por escrito, y el Gobierno tiene veinte días desde que se publica la pregunta para contestar, prorrogables otros veinte (${glosa("pregunta-escrita","art. 190 del Reglamento")}). Aquí están todas las de la legislatura y cuántas siguen sin respuesta.</p></div></div>
    <div class="kpis">${[[fmt(P.total),"preguntas escritas"],[fmt(e.contestada||0),"contestadas"],[fmt(pend),"sin contestar todavía"],[fmt(P.n_antiguas),`sin contestar tras más de ${P.dias} días`,true]].map(([n,l,a])=>`<div class="kpi ${a?"alert":""}"><b>${n}</b><span>${l}</span></div>`).join("")}</div>
    ${demoraPreguntas(P)}
    <section class="sec"><div class="sec-h"><h2>Mes a mes</h2><p>Preguntas presentadas cada mes; en color, las que siguen sin contestar.</p></div>
      <div class="chart"><div class="pq-meses">${meses.map(([m,[n,p]])=>`<span class="pq-m" data-tip="${esc(`<b>${nombreMes(m)}</b><br>${fmt(n)} presentadas · ${fmt(p)} sin contestar`)}"><i style="height:${n/maxM*100}%"><b style="height:${n?p/n*100:0}%"></b></i></span>`).join("")}</div>
      <div class="pq-eje"><span>${nombreMes(meses[0][0])}</span><span>${nombreMes(meses.at(-1)[0])}</span></div>
      <div class="key"><span><i style="background:color-mix(in srgb,var(--ink) 35%,var(--surface))"></i>contestadas o cerradas</span><span><i style="background:var(--no)"></i>sin contestar</span></div></div></section>
    <div class="grid2">
      <section class="sec"><div class="sec-h"><h2>Por grupo</h2></div><div class="chart"><div class="autores">${grupos.map(([g,[n,p,a]])=>`<div class="aut-row" data-tip="${esc(`<b>${G[g].nombre}</b><br>${fmt(n)} preguntas · ${fmt(p)} sin contestar · ${fmt(a)} de ellas hace más de ${P.dias} días`)}"><span class="g">${gdot(g)}${g}</span><span class="trk" style="width:${n/maxG*100}%"><i class="l" style="width:${p/n*100}%;background:var(--no)"></i></span><span class="n">${fmt(n)}</span></div>`).join("")}</div></div></section>
      <section class="sec"><div class="sec-h"><h2>De qué preguntan</h2></div><div class="chart"><div class="rank">${temas.map(([k,n])=>`<button class="rank-row" data-tema-fijo="${k}"><span class="lab">${esc(TEMAS_IDX?.[k]?.nombre||k)}</span><span class="trk"><span class="br" style="width:${n/maxT*100}%"></span><span class="n">${fmt(n)}</span></span></button>`).join("")}</div></div></section>
    </div>
    <section class="sec"><div class="sec-h"><h2>Quién pregunta más</h2></div><div class="rebeldes">${top.map(([d,[n,p]])=>`<button class="reb" data-dip="${d.slug}">${imgFoto(d,"avatar foto",` style="--grupo:${G[d.g]?.color}"`) || `<span class="avatar" style="background:${G[d.g]?.color}">${esc(iniciales(legible(d.n)))}</span>`}<span><b>${esc(legible(d.n))}</b><small>${esc(d.g)} · ${fmt(n)} preguntas · ${fmt(p)} sin contestar</small></span></button>`).join("")}</div></section>
    ${P.antiguas.length?`<section class="sec"><div class="sec-h"><h2>Las que más esperan</h2><p>Preguntas admitidas hace más de ${P.dias} días que siguen sin respuesta, de la más antigua a la más reciente.</p></div>
      <ul class="preg-list">${P.antiguas.map(([exp,f,titulo,ids,g])=>`<li><span class="pq-f">${fechaCorta(f)}<small>${dias(f,hoyISO())} días</small></span><span class="pq-t">${esc(titulo)}<small>${gdot(g)}${ids.map(i=>DIP[i]?esc(legible(DIP[i].n)):"").filter(Boolean).slice(0,3).join(", ")}</small></span><a class="res ko" href="${urlIniciativa(exp)}" target="_blank" rel="noopener">${exp}</a></li>`).join("")}</ul></section>`:""}
    <p class="nota">Fuente: buscador de iniciativas del Congreso. Una pregunta cuenta como contestada cuando su tramitación se da por terminada, y la fecha de respuesta es la de ese cierre. Se cuenta desde la calificación por la Mesa, unos días antes de la publicación, así que los tiempos están ligeramente por encima de los que marca el Reglamento. Datos a ${fechaCorta(P.generado)}.</p>`;
  if (!TEMAS_IDX) cargarTemasIdx().then(()=>{ if (!$("#preguntas").hidden){ rendered.preguntas=false; renderPreguntas(); } });
}

/* ---------- en la ficha: preguntas y declaración de intereses ---------- */
async function pintarPreguntasFicha(d){
  const cont = document.getElementById("ficha-preguntas"); if (!cont) return;
  const P = await cargarPreguntas(), c = P?.diputados?.[d.i];
  const lista = c ? await fetch(`datos/preguntas/${d.slug}.json`).then(r=>r.ok?r.json():[]).catch(()=>[]) : [];
  if (!c && !lista.length){ cont.remove(); return; }
  cont.innerHTML = `<div class="sec-h"><h2>Sus preguntas al Gobierno</h2><p>${c?`${fmt(c[0])} ${glosa("pregunta-escrita", c[0]===1?"pregunta escrita":"preguntas escritas")}, ${fmt(c[1])} sin contestar${c[2]?` (${fmt(c[2])} desde hace más de ${P.dias} días)`:""}.`:""} <button class="linklike" data-go="preguntas">Todas las preguntas</button></p></div>
    <ul class="preg-list">${lista.slice(0,12).map(p=>filaPregunta(p)).join("")}</ul>${lista.length>12?`<details><summary>Ver ${lista.length-12} más</summary><ul class="preg-list">${lista.slice(12).map(p=>filaPregunta(p)).join("")}</ul></details>`:""}`;
}
function interesesFicha(d){
  const x = EXTRA?.[d.n]?.intereses; if (!x) return "";
  const act = x.actividades||[], apo = x.aportaciones||[], reg = (x.regalos||[]).filter(r=>r[0]||r[1]), obs = x.observaciones||[];
  return `<section class="sec"><div class="sec-h"><h2>Declaración de intereses</h2><p>Lo que declaró al Congreso (${glosa("declaracion-intereses","qué es")}), última actualización ${x.registro?fechaCorta(x.registro):"sin fecha"}. Se reproduce tal cual.</p></div>
    ${act.length?`<h3 class="h-min">Actividades declaradas</h3><div class="dtable-wrap"><table class="dt"><thead><tr><th>Periodo</th><th>Dónde</th><th>Qué</th><th>Sector</th></tr></thead><tbody>${act.map(([per,emp,sec,desc])=>`<tr><td class="num" style="white-space:nowrap">${esc(per)||"–"}</td><td>${esc(emp)||"–"}</td><td>${esc(desc)||"–"}</td><td>${esc(sec)||"–"}</td></tr>`).join("")}</tbody></table></div>`:""}
    ${apo.length?`<h3 class="h-min">Aportaciones a fundaciones, asociaciones o partidos</h3><ul class="decl">${apo.map(([dest,desc])=>`<li><b>${esc(dest)||"Sin especificar"}</b>${desc?` · ${esc(desc)}`:""}</li>`).join("")}</ul>`:""}
    ${reg.length?`<h3 class="h-min">Regalos, donaciones o invitaciones</h3><ul class="decl">${reg.map(([ben,desc])=>`<li>${ben?`<b>${esc(ben)}</b> · `:""}${esc(desc)}</li>`).join("")}</ul>`:""}
    ${obs.length?`<h3 class="h-min">Observaciones</h3><ul class="decl">${obs.map(o=>`<li>${esc(o)}</li>`).join("")}</ul>`:""}
  </section>`;
}

/* ---------- sobre el proyecto ---------- */
const REPO = "https://github.com/jorgegarcelan/escano-abierto";
// Quienes hacen Escaño Abierto (en «Sobre el proyecto»): nombre, usuario de X y foto en site/colaboradores/.
const COLABORADORES = [{nombre: "Jorge Garcelán", x: "jgarcelan", foto: "/colaboradores/jorge-garcelan.webp"}];
function renderSobre(){
  const nV = INDICE.meses.reduce((a,m)=>a+m.votaciones,0), nS = INDICE.meses.reduce((a,m)=>a+m.sesiones,0);
  const cifras = [[fmt(nV),"votaciones, con el voto de cada diputado"],[fmt(nS),"sesiones del Pleno y de las comisiones"],[fmt(DIP.length),"diputados de la legislatura"],
    [LEYES?fmt(LEYES.iniciativas.length):"–","leyes seguidas paso a paso"],[PREG?fmt(PREG.total):"–","preguntas escritas al Gobierno"]];
  $("#sobre").innerHTML = `<div class="sobre">
    <div class="view-intro"><div><div class="eyebrow">Sobre el proyecto</div>
      <h2>Entender lo que se hace en el Congreso</h2>
      <p class="lede">El Congreso publica casi todo lo que hace: cada voto de cada diputado, cada palabra dicha en el Pleno, cada ley con sus fases y sus plazos. Pero está repartido en miles de PDF, buscadores y ficheros pensados para especialistas. Escaño Abierto lo junta, lo ordena y lo cuenta para que cualquiera pueda entenderlo en unos minutos.</p></div></div>
    <div class="kpis">${cifras.map(([n,l])=>`<div class="kpi"><b>${n}</b><span>${l}</span></div>`).join("")}</div>
    <section class="sec"><div class="sec-h"><h2>La idea</h2></div>
      <div class="sobre-ideas">
        <div class="chart"><h3>Entender</h3><p>Qué significa cada votación, en una frase: aprobar una proposición no de ley no cambia ninguna ley. Un <a href="/glosario/">glosario</a> con las palabras del Congreso y <a href="/como-ley/">cómo se hace una ley</a>, paso a paso, con las cifras reales.</p></div>
        <div class="chart"><h3>Acercar</h3><p>Quién te representa: los <a href="/diputados/">diputados de tu provincia</a>, cómo votan y qué preguntan. Los temas que te importan, con su propio RSS; <a href="/semana/">la semana en el Congreso</a> y lo que se votará en el próximo pleno.</p></div>
        <div class="chart"><h3>Rendir cuentas</h3><p>Cuándo un diputado vota distinto a su grupo, qué leyes llevan meses <a href="/leyes/">en el congelador</a>, cuántas <a href="/preguntas/">preguntas al Gobierno</a> siguen sin respuesta y qué actividades e intereses declara cada diputado.</p></div>
      </div></section>
    <section class="sec"><div class="sec-h"><h2>Lo que no es</h2></div>
      <ul class="sobre-lista">
        <li><b>No es un medio de opinión.</b> No dice qué está bien o mal votado: muestra lo que pasó, con las mismas reglas para todos los grupos.</li>
        <li><b>No está vinculado al Congreso ni a ningún partido.</b> Es un proyecto independiente, sin financiación.</li>
        <li><b>No se inventa nada.</b> Cada dato enlaza a su fuente oficial. Cuando interviene la IA (resúmenes, tono, síntesis de cada intervención), se indica, y las citas, cifras y compromisos solo se publican si aparecen literalmente en el Diario de Sesiones.</li>
      </ul></section>
    <section class="sec"><div class="sec-h"><h2>Cómo se hace</h2></div>
      <p class="prosa">Cada mañana, un proceso automático descarga lo nuevo de la web del Congreso: votaciones, Diarios de Sesiones, orden del día, tramitación de leyes, preguntas escritas y declaraciones de intereses. Lo cruza y publica esta web. Los resúmenes de cada sesión y de cada intervención los escribe un modelo de inteligencia artificial (Gemini, de Google) a partir del texto oficial del Diario de Sesiones, con las mismas instrucciones para todos los grupos. Lo que debe ser literal (citas, cifras y compromisos) se comprueba contra el Diario y se descarta si no aparece tal cual. Lo demás se calcula con reglas fijas. El <a href="${REPO}" target="_blank" rel="noopener">código es abierto</a>, y en <a href="/metodo/">Método</a> se explica cada cálculo.</p>
      <p class="prosa">Si ves un error o echas algo en falta, <a href="${REPO}/issues" target="_blank" rel="noopener">abre una incidencia en GitHub</a>. Las correcciones se agradecen.</p></section>
    <section class="sec" id="aviso-legal"><div class="sec-h"><h2>Aviso legal</h2></div>
      <div class="legal">
        <h3>Independencia</h3>
        <p>Escaño Abierto es un proyecto independiente y sin ánimo de lucro, dentro de la iniciativa Reforma Digital. <b>No está asociado, patrocinado ni avalado por el Congreso de los Diputados, las Cortes Generales, el Senado, el Gobierno ni ningún otro organismo público, partido político o grupo parlamentario</b>, y no habla en nombre de ninguno de ellos. No usa sus logotipos ni su identidad visual.</p>
        <h3>Origen de los datos</h3>
        <p>La información procede de fuentes públicas del Congreso de los Diputados (datos abiertos, Diario de Sesiones, Boletín Oficial de las Cortes Generales, buscador de iniciativas y agenda) y se reutiliza de acuerdo con la normativa sobre reutilización de la información del sector público (Ley 37/2007), citando siempre la fuente y enlazando al documento original. Las fotografías de los diputados son las que publica el Congreso y se muestran directamente desde su web.</p>
        <h3>Exactitud</h3>
        <p>Los datos se procesan de forma automática y pueden contener errores u omisiones, o no estar al día. <b>La única fuente con valor oficial es la publicada por el Congreso</b>; ante cualquier discrepancia, prevalece. Los títulos abreviados, las clasificaciones por temas y los textos explicativos son una ayuda para entender y no tienen valor jurídico. Los textos generados con inteligencia artificial (resúmenes de sesiones e intervenciones, frases de síntesis, tono, intensidad, si el Gobierno contesta a lo que se le pregunta, el motivo de cada postura, compromisos, propuestas, cifras, territorios y leyes mencionados, además de la unificación de temas, la ubicación de los lugares y la agrupación de propuestas de la sección Explora) son orientativos, se indican como tales y pueden contener errores; ante cualquier duda, prevalece el Diario de Sesiones enlazado. Nada de lo publicado constituye asesoramiento jurídico.</p>
        <h3>Personas</h3>
        <p>Se muestran datos de diputados y miembros del Gobierno en su condición de cargos públicos y tal como los publica el Congreso: votos, intervenciones, preguntas y declaraciones de actividades e intereses. Si detectas un error o crees que algo debe corregirse, puedes pedirlo <a href="${REPO}/issues" target="_blank" rel="noopener">en GitHub</a>, y se revisará lo antes posible.</p>
        <h3>Privacidad</h3>
        <p>Esta web no usa cookies ni publicidad y no recoge datos personales. Para saber cuánta gente la visita y si carga rápido usa Vercel Web Analytics y Speed Insights, que cuentan visitas y miden el rendimiento de forma anónima y agregada, sin cookies ni identificadores que te sigan de un día a otro. En tu propio navegador solo se guardan tus preferencias (periodo, provincia y estilo visual), que puedes borrar cuando quieras. Para mostrarse, carga tipografías de Google Fonts y las fotografías oficiales desde la web del Congreso, que pueden registrar tu dirección IP según sus propias políticas. Está alojada en Vercel.</p>
        <h3>Código</h3>
        <p>El <a href="${REPO}" target="_blank" rel="noopener">código de Escaño Abierto</a> es público en GitHub. Las tipografías de las tarjetas para compartir (Doto y Geist) se distribuyen con licencia SIL Open Font License.</p>
      </div></section>
    <section class="sec"><div class="sec-h"><h2>Quién está detrás</h2></div>
      <div class="autor-rd">
        <div class="eyebrow">Reforma Digital</div>
        <h3>Un proyecto de Reforma Digital.</h3>
        <p>Escaño Abierto forma parte de <b>Reforma Digital</b>, una iniciativa abierta para que lo público esté a la altura de las personas. Se hace en comunidad y con código abierto: cualquiera puede avisar de un error, proponer una mejora o sumarse.</p>
        <p class="autor-links"><a class="btn boton-claro" href="https://reforma-digital.es" target="_blank" rel="noopener">Conoce Reforma Digital ↗</a><a class="btn boton-claro" href="https://reforma-digital.es/#participar" target="_blank" rel="noopener">Participar ↗</a><a class="btn boton-claro" href="${REPO}" target="_blank" rel="noopener">El código de Escaño Abierto ↗</a></p>
      </div>
</section>
    <section class="sec" id="colaboradores"><div class="sec-h"><h2>Colaboradores</h2><p>Las personas que hacen Escaño Abierto. Se puede sumar cualquiera: con datos, textos, diseño o código.</p></div>
      <ul class="colab">${COLABORADORES.map(c=>`<li><a class="colab-p" href="https://x.com/${esc(c.x)}" target="_blank" rel="noopener" aria-label="${esc(c.nombre)} en X (se abre en otra pestaña)">
          <span class="colab-foto"><img src="${esc(c.foto)}" alt="" width="640" height="640" loading="lazy"></span>
          <span class="colab-info"><span><b>${esc(c.nombre)}</b><small>@${esc(c.x)}</small></span><span class="colab-ir" aria-hidden="true">↗</span></span></a></li>`).join("")}
        <li><a class="colab-p colab-tu" href="${REPO}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">
          <span class="colab-foto"><span class="colab-mas" aria-hidden="true"></span></span>
          <span class="colab-info"><span><b>¿Te sumas?</b><small>Cómo colaborar</small></span><span class="colab-ir" aria-hidden="true">↗</span></span></a></li></ul></section>
  </div>`;
  if (!LEYES || !PREG) Promise.all([cargarLeyes(), cargarPreguntas()]).then(()=>{ if (!$("#sobre").hidden) renderSobre(); });
}

/* ---------- datos extra de los diputados (biografía, comisiones, turnos), bajo demanda ---------- */
let EXTRA = null, extraPromesa = null;
function cargarExtra(){
  if (EXTRA) return Promise.resolve(EXTRA);
  return extraPromesa ||= fetch("datos/diputados-extra.json", {cache:"no-store"}).then(r=>r.ok?r.json():{}).catch(()=>({})).then(j=>EXTRA=j);
}
const turnosDe = d => Object.values(EXTRA?.[d.n]?.turnos||{}).reduce((a,b)=>a+b,0);

/* ---------- el hemiciclo como mapa de datos, con buscador ---------- */
let mapaHemi = {metrica:"grupo", q:""};
const METRICAS = [["grupo","Grupo"],["part","Participación"],["dis","Votos distintos a su grupo"],["turnos","Turnos de palabra"]];
function valorMetrica(d){
  const s = statsDip[d.i];
  if (mapaHemi.metrica==="part") return s.part;
  if (mapaHemi.metrica==="dis") return s.dis;
  if (mapaHemi.metrica==="turnos") return EXTRA ? turnosDe(d) : null;
  return null;
}
function hemiDatos(){
  if (!CON_PLANO) return "";
  const m = mapaHemi.metrica, q = sinTildes(mapaHemi.q.trim());
  const ds = DIP.filter(d=>DIPS[d.i][5]!=null && !d.baja);
  const vals = ds.map(valorMetrica).filter(v=>v!=null);
  // Escala: más intenso = más ausencias (participación), más votos distintos o más turnos.
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const t = v => v==null ? 0 : m==="part" ? (hi>lo ? (hi-v)/(hi-lo) : 0) : (hi>lo ? (v-lo)/(hi-lo) : 0);
  const coincide = d => !q || sinTildes(`${d.n} ${legible(d.n)} ${d.circ} ${d.g} ${G[d.g]?.nombre||""}`).includes(q);
  const texto = (d,v) => m==="part" ? `Participación: ${pct(v)}` : m==="dis" ? `Votos distintos a su grupo: ${v}` : m==="turnos" ? `Turnos de palabra: ${v??"–"}` : `${G[d.g]?.nombre||d.g} · ${d.circ}`;
  const seats = ds.map(d=>{ const x=DIPS[d.i][5], y=DIPS[d.i][6], v=valorMetrica(d), on=coincide(d);
    const fill = m==="grupo" ? G[d.g]?.color : `color-mix(in srgb, var(--ink) ${Math.round(12+t(v)*88)}%, var(--sunk))`;
    return `<circle cx="${x}" cy="${y}" r="${on&&q?ESC_R*1.25:ESC_R}" style="fill:${fill}${on?"":";opacity:.12"}" class="${on&&q?"hit":""}" data-n="${esc(d.n)}" data-g="${d.g}" data-x="-" data-extra="${esc(texto(d,v))}"></circle>`; }).join("");
  const n = q ? ds.filter(coincide).length : ds.length;
  const leyenda = m==="grupo" ? `<div class="key">${ORDEN_HEMI.map(g=>`<span><i style="background:${G[g].color};border-radius:50%"></i>${g}</span>`).join("")}</div>`
    : `<div class="key"><span>${m==="part"?`${pct(hi)}`:lo}</span><span class="rampa"></span><span>${m==="part"?`${pct(lo)} · más ausencias`:`${hi} · ${m==="dis"?"más votos distintos":"más turnos"}`}</span></div>`;
  return `<div class="controls" id="hd-m">${METRICAS.map(([k,l])=>`<button class="chipbtn" data-hm="${k}" aria-pressed="${m===k}">${l}</button>`).join("")}</div>
    <div class="controls"><input id="hd-q" type="search" placeholder="Resalta un nombre, provincia o grupo…" value="${esc(mapaHemi.q)}" aria-label="Resaltar diputados en el hemiciclo">${q?`<span class="nota">${n} ${n===1?"escaño":"escaños"}</span>`:""}</div>
    <svg class="hemi real hemi-datos" viewBox="-4 -4 ${PLANO.ancho+8} ${PLANO.alto+4}" role="img" aria-label="Hemiciclo: ${esc(METRICAS.find(x=>x[0]===m)[1])}">${gobiernoSinEscano()}${seats}</svg>
    ${leyenda}${m==="turnos"?`<p class="nota">Turnos contados en los Diarios de Sesiones del periodo, en el Pleno y en comisiones.</p>`:""}`;
}
function pintarHemiDatos(){ const c=document.getElementById("hemi-datos"); if(!c) return; c.innerHTML = hemiDatos();
  const inp=document.getElementById("hd-q"); inp?.addEventListener("input", e=>{ mapaHemi.q=e.target.value; const pos=e.target.selectionStart; pintarHemiDatos(); const n=document.getElementById("hd-q"); n.focus(); n.setSelectionRange(pos,pos); }); }

/* ---------- la sesión, votación a votación ---------- */
let repro = {fecha:null, k:0, play:false, timer:null};
function diasConVotos(){ return [...new Set(DATA.votaciones.map(v=>v.fecha))].sort().reverse(); }
function votosDelDia(f){ return DATA.votaciones.filter(v=>v.fecha===f && v.v).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})); }
function reproductor(){
  if (!CON_PLANO) return "";
  const dias = diasConVotos(); if (!dias.length) return "";
  repro.fecha ||= dias[0];
  const vs = votosDelDia(repro.fecha); if (!vs.length) return "";
  const seats = DIP.filter(d=>DIPS[d.i][5]!=null && !d.baja).map(d=>`<circle cx="${DIPS[d.i][5]}" cy="${DIPS[d.i][6]}" r="${ESC_R}" data-i="${d.i}" data-n="${esc(d.n)}" data-g="${d.g}" data-x="-"></circle>`).join("");
  return `<div class="repro">
    <div class="repro-cab"><div><h3>La sesión, votación a votación</h3><p class="sub">Cada escaño cambia de color con el voto de su diputado.</p></div>
      <label class="repro-dia">Día <select id="repro-dia">${dias.map(f=>{const d=dt(f);return `<option value="${f}"${f===repro.fecha?" selected":""}>${d.d} ${d.m} · ${votosDelDia(f).length} votaciones</option>`;}).join("")}</select></label></div>
    <div class="repro-cuerpo"><svg class="hemi real anima" id="repro-hemi" viewBox="-4 -4 ${PLANO.ancho+8} ${PLANO.alto+4}" role="img" aria-label="Hemiciclo de la votación en curso">${gobiernoSinEscano()}${seats}</svg>
      <div class="repro-info" aria-live="polite"><div class="eyebrow" id="repro-n"></div><div class="repro-t" id="repro-t"></div><div class="repro-res" id="repro-res"></div>
        <div class="repro-ctl"><button class="btn boton-claro" data-repro="prev" aria-label="Votación anterior">◀</button><button class="btn primary boton" data-repro="play" id="repro-play">▶ Reproducir</button><button class="btn boton-claro" data-repro="next" aria-label="Votación siguiente">▶▶</button></div>
        <div class="repro-barra" id="repro-barra">${vs.map((v,k)=>`<button data-repro-k="${k}" style="background:var(${passed(v)?"--si":"--no"})" aria-label="Votación ${k+1}" data-tip="${esc(`${esc(v.titulo)}<br>${v.si} a ${v.no}`)}"></button>`).join("")}</div></div></div></div>`;
}
function reproPintar(){
  const vs = votosDelDia(repro.fecha); if (!vs.length) return;
  repro.k = Math.max(0, Math.min(repro.k, vs.length-1));
  const v = vs[repro.k], svg = document.getElementById("repro-hemi"); if (!svg) return;
  svg.querySelectorAll("circle[data-i]").forEach(c=>{ const x=v.v[+c.dataset.i]; const gp=v.grupos[c.dataset.g];
    const dis = ["S","N","A"].includes(x) && ["S","N","A"].includes(gp) && x!==gp;
    c.setAttribute("class", (x==="-"?"X":x)+(dis?" dis":"")); c.dataset.x = x==="-"?"X":x; if (dis) c.dataset.dis="1"; else delete c.dataset.dis; });
  document.getElementById("repro-n").textContent = `Votación ${repro.k+1} de ${vs.length}`;
  document.getElementById("repro-t").textContent = v.titulo;
  document.getElementById("repro-res").innerHTML = `<b>${v.si} – ${v.no}</b> <span class="res ${passed(v)?"ok":"ko"}">${resLabel(v)}</span> <span class="nota">Abst. ${v.abst} · No votan ${v.novota}</span>`;
  document.querySelectorAll("#repro-barra button").forEach((b,k)=>b.classList.toggle("on", k===repro.k));
  document.getElementById("repro-play").textContent = repro.play ? "❚❚ Pausa" : "▶ Reproducir";
}
function reproParar(){ repro.play=false; clearInterval(repro.timer); repro.timer=null; }
function reproPlay(){
  if (repro.play){ reproParar(); reproPintar(); return; }
  const vs = votosDelDia(repro.fecha); if (repro.k >= vs.length-1) repro.k = -1;
  repro.play = true; repro.k++; reproPintar();
  repro.timer = setInterval(()=>{ if ($("#votaciones").hidden){ reproParar(); return; }
    const n = votosDelDia(repro.fecha).length; if (repro.k >= n-1){ reproParar(); reproPintar(); return; } repro.k++; reproPintar(); }, 2200);
}
function iniciarReproductor(){ if (!document.getElementById("repro-hemi")) return; reproPintar();
  document.getElementById("repro-dia").addEventListener("change", e=>{ reproParar(); repro.fecha=e.target.value; repro.k=0; const c=document.getElementById("repro-caja"); c.innerHTML=reproductor(); iniciarReproductor(); }); }
ctl.signal.addEventListener("abort", reproParar);

/* ---------- ficha: perfil (biografía, comisiones, turnos) y comparación ---------- */
const ORDEN_CARGO = ["Presidente","Presidenta","Vicepresidente Primero","Vicepresidenta Primera","Vicepresidente Segundo","Vicepresidenta Segunda","Secretario Primero","Secretaria Primera","Secretario Segundo","Secretaria Segunda","Portavoces","Portavoces adjuntos","Vocales","Ponentes","Vocales Suplentes","Ponentes Suplentes","Adscritos"];
const cargoLegible = c => ({Portavoces:"Portavoz","Portavoces adjuntos":"Portavoz adjunto",Vocales:"Vocal",Ponentes:"Ponente","Vocales Suplentes":"Vocal suplente","Ponentes Suplentes":"Ponente suplente",Adscritos:"Adscrito"}[c]||c);
function perfilFicha(d){
  if (!EXTRA) return `<p class="nota">Cargando el perfil…</p>`;
  const e = EXTRA[d.n] || {bio:"", comisiones:[], turnos:{}};
  const com = e.comisiones.slice().sort((a,b)=>{ const i=x=>{const k=ORDEN_CARGO.indexOf(x);return k<0?99:k;}; return i(a[1])-i(b[1]) || a[0].localeCompare(b[0],"es"); });
  const tur = Object.entries(e.turnos).sort((a,b)=>b[1]-a[1]); const maxT = tur[0]?.[1]||1;
  return `<div class="two perfil">
    <div class="chart"><h3>Biografía</h3>${!e.bio?`<p class="nota">El Congreso no publica biografía de este diputado.</p>`:e.bio.length>420?`<details class="bio"><summary><p>${esc(e.bio)}</p></summary></details>`:`<div class="bio"><p>${esc(e.bio)}</p></div>`}
      <p class="nota">Texto de la ficha oficial del Congreso.</p></div>
    <div class="chart"><h3>Comisiones</h3>${com.length?`<ul class="comisiones">${com.map(([c,cargo])=>`<li><span>${esc(c.replace(/^Comisión (de |del |para |sobre )?/,m=>m.charAt(0).toUpperCase()+m.slice(1)))}</span><span class="cargo${/President|Vicepresident|Secretari|Portavoz|Portavoces/.test(cargo)?" destacado":""}">${esc(cargoLegible(cargo))}</span></li>`).join("")}</ul>`:`<p class="nota">No forma parte de ninguna comisión.</p>`}
      ${tur.length?`<h3 style="margin-top:10px">Turnos de palabra</h3><div class="coh">${tur.map(([o,n])=>`<div class="coh-row"><span style="font-size:12.5px">${esc(o.replace(/^Comisión (de |del )?/,""))}</span><span class="trk"><b style="width:${n/maxT*100}%"></b></span><span class="n">${n}</span></div>`).join("")}</div><p class="nota">En los Diarios de Sesiones del periodo.</p>`:""}</div>
  </div>`;
}
let dipComp = null;
function comparacion(d){
  const opciones = DIP.filter(x=>x!==d).map(x=>`<option value="${esc(legible(x.n))}"></option>`).join("");
  let cuerpo = "";
  const o = dipComp && DIP_SLUG[dipComp];
  if (o && o!==d){
    let comun=0, igual=0; const dif=[];
    VOTOS_NOM.forEach(v=>{ const a=v.v[d.i], b=v.v[o.i]; if(!["S","N","A"].includes(a)||!["S","N","A"].includes(b)) return; comun++; if(a===b) igual++; else dif.push([v,a,b]); });
    const p = comun ? igual/comun : null;
    cuerpo = `<div class="comp">
      <div class="comp-cara">${imgFoto(d,"mini-foto comp-foto",` style="--grupo:${G[d.g]?.color}"`)}<b>${esc(legible(d.n))}</b><span class="nota">${esc(G[d.g]?.nombre||d.g)}</span></div>
      <div class="comp-centro"><b class="comp-pct">${pct(p)}</b><span class="nota">de coincidencia en ${comun} votaciones en las que votaron los dos</span></div>
      <div class="comp-cara">${imgFoto(o,"mini-foto comp-foto",` style="--grupo:${G[o.g]?.color}"`)}<b><button class="linklike" data-dip="${o.slug}">${esc(legible(o.n))}</button></b><span class="nota">${esc(G[o.g]?.nombre||o.g)}</span></div>
    </div>
    ${dif.length?`<div class="dtable-wrap"><table class="dt vt"><thead><tr><th>Fecha</th><th>Votación en la que se separaron</th><th>${esc(d.n.split(",")[0])}</th><th>${esc(o.n.split(",")[0])}</th></tr></thead><tbody>${dif.slice(0,20).map(([v,a,b])=>{const dd=dt(v.fecha);return `<tr><td class="num" style="white-space:nowrap">${dd.d} ${dd.m}</td><td class="t"><button class="linklike" style="text-decoration:none;text-align:left;font-weight:400" data-go="votaciones" data-anchor="v-${v.id}">${esc(v.titulo)}</button></td><td><span class="mivoto ${a}">${MIVOTO[a]}</span></td><td><span class="mivoto ${b}">${MIVOTO[b]}</span></td></tr>`;}).join("")}</tbody></table></div>${dif.length>20?`<p class="nota">Y ${dif.length-20} más.</p>`:""}`:`<p class="nota">Votaron siempre lo mismo.</p>`}`;
  }
  return `<section class="sec"><div class="sec-h"><h2>Comparar con otro diputado</h2><p>Coincidencia de voto y votaciones en las que se separaron.</p></div>
    <div class="controls"><input id="comp-q" list="comp-lista" placeholder="Escribe un nombre…" aria-label="Diputado con el que comparar" value="${o&&o!==d?esc(legible(o.n)):""}"><datalist id="comp-lista">${opciones}</datalist></div>${cuerpo}</section>`;
}

/* ---------- inicio ---------- */
const frases = t => (t||"").split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«])/);
const fechaLarga = iso => { const [y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); };
const margen = v => Math.abs(v.si-v.no);
const iniciales = n => n.split(/[\s-]+/).filter(w=>w.length>2).slice(0,2).map(w=>w[0]).join("").toUpperCase();
function renderInicio(){
  const plenos = DATA.sesiones.filter(s=>s.organo==="Pleno" && (s.resumen||s.titular)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const recientes = DATA.sesiones.slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const ses = plenos[0] || recientes.find(s=>s.organo==="Pleno") || recientes[0];
  if (!ses){ $("#inicio").innerHTML = '<p class="nota">Todavía no hay sesiones.</p>'; return; }
  const fr = frases(ses.resumen);
  let titular = ses.titular, lede;
  if (titular) lede = ses.resumen;
  else {
    // Sin titular generado: la primera frase del resumen; si es larga, hasta la primera coma.
    const nv = DATA.votaciones.filter(v=>v.fecha===ses.fecha).length, np = (ses.puntos||[]).length;
    titular = fr.shift() || (nv ? `${ses.organo}: ${nv} ${nv===1?"votación":"votaciones"}` : `${ses.organo}: ${np} ${np===1?"asunto":"asuntos"} en el orden del día`);
    if (!fr.length && !ses.resumen && np) fr.push("En el orden del día: " + ses.puntos.slice(0,3).map(p=>p.titulo).join("; ") + (np>3?"…":"."));
    const c = titular.indexOf(", ", 30);
    if (titular.length > 90 && c > 0){
      const resto = titular.slice(c+2);
      fr.unshift(resto[0].toUpperCase()+resto.slice(1));
      titular = titular.slice(0,c)+".";
    }
    lede = fr.join(" ");
  }

  const delDia = DATA.votaciones.filter(v=>v.fecha===ses.fecha);
  const candidatas = (delDia.length?delDia:DATA.votaciones).slice().sort((a,b)=>margen(a)-margen(b) || b.fecha.localeCompare(a.fecha));
  const dest = candidatas[0];

  // El resumen, solo el principio: las frases que quepan en unas 260 letras (al menos una); el resto está en la sesión.
  const resumenCorto = t => frases(t).reduce((acc, f) => !acc || (acc + " " + f).length <= 260 ? (acc ? acc + " " + f : f) : acc, "");
  // La votación más ajustada: arriba qué es y cómo acabó; en medio el hemiciclo y el marcador; abajo el título.
  const heroVoto = dest ? `<figure class="hero-vote">
      <div class="hv-barra"><span class="eyebrow">${delDia.length?"La más ajustada del día":`La más ajustada · ${dt(dest.fecha).d} ${dt(dest.fecha).m}`}</span><span class="res ${passed(dest)?"ok":"ko"}">${resLabel(dest)}</span></div>
      <div class="hemi-wrap">${hemiciclo(dest,{grande:true, anim:true})}
        <div class="hemi-center"><b>${dest.si} – ${dest.no}</b><span>${margen(dest)} ${margen(dest)===1?"voto":"votos"} de diferencia</span></div></div>
      ${hemiLeyenda()}
      <p class="hv-t">${esc(dest.titulo)}</p>
      <div class="hv-sub">${esc(dest.tipo)} · ${dest.proponente==="GOB"?"Gobierno":esc(dest.proponente)}${dest.titulo_fuente==="oficial"?` · <span class="oficial" data-tip="Título abreviado del texto oficial del expediente. Conserva las palabras del grupo que presenta la iniciativa.">título oficial</span>`:""}</div>
      <button class="linklike hv-ir" data-go="votaciones" data-anchor="v-${dest.id}">Ver la votación</button>
    </figure>` : "";
  // Lo que se votó en esa sesión, una fila por votación (como las fuentes de Reforma Digital): resultado, marcador y título.
  const votosDia = delDia.length ? `<div class="hero-votos"><div class="eyebrow">Lo que se votó</div><ul>${delDia.slice(0,4).map(v=>`<li><button type="button" data-go="votaciones" data-anchor="v-${v.id}"><span class="res ${passed(v)?"ok":"ko"}">${resLabel(v)}</span><span class="hv-n">${v.si} – ${v.no}</span><span class="hv-tt">${esc(v.titulo)}</span></button></li>`).join("")}</ul>${delDia.length>4?`<button class="linklike" data-go="dias" data-anchor="s-${ses.id}">y ${delDia.length-4} más</button>`:""}</div>` : "";

  // Cifras del periodo.
  const oradores = new Set(IVS.map(i=>i.orador));
  const derrotas = DATA.votaciones.filter(v=>v.proponente==="GOB" && !passed(v)).length;
  const ajustadas = DATA.votaciones.filter(v=>margen(v)<=10).length;
  const kpis = [[DATA.sesiones.length,"sesiones"],[IVS.length,"intervenciones analizadas"],[oradores.size,"oradores"],[DATA.votaciones.length,"votaciones"],[ajustadas,"decididas por 10 votos o menos"],[derrotas,derrotas===1?"iniciativa del Gobierno rechazada":"iniciativas del Gobierno rechazadas",derrotas>0]]
    .map(([n,l,a])=>`<div class="kpi ${a?"alert":""}"><b>${n}</b><span>${l}</span></div>`).join("");

  // Cara a cara: la primera respuesta del Gobierno de la sesión más reciente con análisis, y la pregunta previa.
  let cara = "";
  const conResp = IVS.map((i,k)=>[i,k]).filter(([i,k])=>i.g==="GOB" && IVS.slice(0,k).some(p=>p.s===i.s && p.item===i.item && p.g!=="GOB" && p.g!=="COMP"));
  if (conResp.length){
    const ult = conResp.reduce((m,x)=>{ const f=DATA.sesiones.find(s=>s.id===x[0].s)?.fecha||""; return f>m.f?{f,x}:m; },{f:"",x:null}).x;
    const sesR = ult[0].s;
    const [resp,k] = conResp.find(([i])=>i.s===sesR);
    const preg = IVS.slice(0,k).reverse().find(i=>i.s===resp.s && i.item===resp.item && i.g!=="GOB" && i.g!=="COMP");
    if (preg){
      const sR = DATA.sesiones.find(s=>s.id===resp.s), d = dt(sR.fecha);
      const lado = (i,extra) => `<div><div class="who">${imgFoto(dipDeOrador(i.orador), "avatar foto", ` style="--grupo:${G[i.g].color}"`) || `<span class="avatar" style="background:${G[i.g].color}">${esc(iniciales(i.orador))}</span>`}<div><b>${esc(i.orador)}</b><span class="rol">${esc(i.rol)}</span></div></div>
        ${i.cita?`<blockquote><mark>«${esc(i.cita)}»</mark></blockquote>`:""}<p>${esc(i.frase||i.resumen)}</p>${extra||""}</div>`;
      cara = `<section class="sec"><div class="sec-h"><h2>Cara a cara</h2><p>La primera pregunta al Gobierno de la última sesión analizada y su respuesta.</p></div>
        <div class="face">${lado(preg)}${lado(resp, ["sí","parcial","no"].includes(resp.responde)?`<p class="nota"><span class="pill resp-${resp.responde==="sí"?"si":resp.responde}">¿Contesta? ${esc(resp.responde)}</span> ${esc(resp.responde_motivo||"")}</p>`:"")}
        <div class="face-foot"><span>${d.d} ${d.m} · ${esc(sR.organo)} · ${esc(resp.item)}</span><button class="linklike" data-go="dias" data-anchor="s-${sR.id}" style="font-size:13px">Ver la sesión completa</button></div></div></section>`;
    }
  }

  // Votaciones más ajustadas del periodo.
  const top = DATA.votaciones.slice().sort((a,b)=>margen(a)-margen(b) || b.fecha.localeCompare(a.fecha)).filter(v=>v!==dest).slice(0,4);
  const vcards = top.map(v=>{ const d=dt(v.fecha); return `<button class="vcard" data-go="votaciones" data-anchor="v-${v.id}">
      ${hemiciclo(v)}
      <div class="vc-r"><span class="vc-n">${v.si} – ${v.no}</span><span class="res ${passed(v)?"ok":"ko"}">${resLabel(v)}</span></div>
      <div class="vc-t">${esc(v.titulo)}</div><div class="vc-s">${d.d} ${d.m} · ${esc(v.tipo)}</div></button>`; }).join("");

  // Temas.

  $("#inicio").innerHTML = `
    <div class="hero" id="ultimo">
      <div class="hero-texto">
        <div class="eyebrow">${ses.organo==="Pleno"?"Último pleno":"Última sesión"} · ${esc(fechaLarga(ses.fecha))}</div>
        <h2 class="hero-h">${esc(titular)}</h2>
        ${lede?`<p class="hero-lede">${esc(resumenCorto(lede))}</p>`:""}
        ${votosDia}
        <div class="hero-cta"><button class="btn primary boton" data-go="dias" data-anchor="s-${ses.id}">Ver la sesión →</button><button class="linklike" data-go="votaciones">Todas las votaciones</button></div>
      </div>
      ${heroVoto?`<div class="hero-pieza">${heroVoto}</div>`:""}
    </div>
    <div class="kpis" aria-label="${esc(DATA.meta.periodo)} en cifras">${kpis}</div>
    ${proximoPleno()}
    ${bloqueTusDiputados()}
    <div id="home-semana">${tarjetaSemana()}</div>
    ${cara}
    <section class="sec" id="home-juego">${franjaJuego()}</section>
    ${vcards?`<section class="sec"><div class="sec-h"><h2>Las más ajustadas</h2><button class="linklike" data-go="votaciones">Ver las ${DATA.votaciones.length} votaciones</button></div><div class="vgrid">${vcards}</div></section>`:""}
    ${rankingDecide()?`<section class="sec"><div class="sec-h"><h2>Quién decide</h2><p>Veces que cada grupo inclinó el resultado de una votación.</p></div>
      <div class="temas-top"><div class="chart">${rankingDecide()}</div><div class="chart" style="align-content:center"><p class="sub" style="margin:0">${decideIntro}</p>${dest?`<h3 style="font-size:17px;margin-top:6px">En la votación más ajustada del día (${dest.si} – ${dest.no})</h3>${decideNota(dest)}`:""}</div></div></section>`:""}
    ${TEMAS.length?`<section class="sec"><div class="sec-h"><h2>De qué se ha hablado</h2><button class="linklike" data-go="temas">Explorar los temas</button></div>
      <div class="temas-top"><div class="chart"><p class="sub" style="margin:0">Intervenciones que tocan cada tema. Los puntos son los grupos que hablaron de él.</p>${rankTemas(TEMAS.slice(0,8))}</div>
      <div class="chart"><p class="sub" style="margin:0">Quién habla de qué. Área del círculo = intervenciones del grupo.</p>${matrizTemas(TEMAS.slice(0,8))}</div></div></section>`:""}`;
  $("#inicio").insertAdjacentHTML("beforeend", `<section class="sec" id="home-boe"></section>`);
  cargarOrgIdx().then(()=>{ const h=$("#home-boe"); if (!h) return; const t=tarjetaBoe(); if (t) h.innerHTML=t; else h.remove(); });
  $("#inicio").insertAdjacentHTML("beforeend", `<section class="sec sol-manifiesto" aria-labelledby="h-proyecto"><div><div class="eyebrow">El proyecto</div><h2 id="h-proyecto">Que entender el Congreso no sea otro trámite.</h2><button class="linklike" data-go="sobre">Sobre el proyecto</button></div><div class="sol-lectura"><p>Escaño Abierto junta lo que publica el Congreso y lo cuenta para que cualquiera pueda entender qué se decide, quién lo decide y cómo. Independiente, con datos oficiales y código abierto.</p><p>Es un proyecto de <a href="https://reforma-digital.es" target="_blank" rel="noopener">Reforma Digital</a>, una iniciativa abierta para que lo público esté a la altura de las personas.</p></div></section>`);
  if (!SEMANAS) cargarSemanas().then(()=>{ const h=$("#home-semana"); if (h) h.innerHTML = tarjetaSemana(); });
}

/* ---------- explora: lo que sale de juntar toda la legislatura ---------- */
let EXPLORA = null, exploraPromesa = null;
const expSel = {semana:null, tag:null, orden:"n", ministro:null, tema:"vivienda"};
function cargarExplora(){
  if (EXPLORA) return Promise.resolve(EXPLORA);
  return exploraPromesa ||= Promise.all(["radar","contesta","propuestas"].map(n=>fetch(`datos/explora-${n}.json`).then(r=>r.ok?r.json():null).catch(()=>null)))
    .then(([radar,contesta,propuestas])=>EXPLORA={radar,contesta,propuestas});
}
const semanaLarga = iso => { const d=dt(iso); return `semana del ${d.d} de ${MESES_LARGOS[MESES.indexOf(d.m)]}`; };
const expPct = (a,n) => n ? Math.round(a/n*100) : 0;

function expRadar(){
  const R = EXPLORA.radar; if (!R) return "";
  const ds = R.destacados.filter(w=>w.temas.length);
  const w = ds.find(x=>x.semana===expSel.semana) || ds[ds.length-1];
  if (!w) return "";
  expSel.semana = w.semana;
  const k = ds.indexOf(w);
  const tag = R.temas[expSel.tag] ? expSel.tag : w.temas[0][0];
  expSel.tag = tag;
  const t = R.temas[tag];
  const chips = w.temas.map(([c,n,media,nuevo])=>`<button class="exp-chip" data-exp-tag="${esc(c)}" aria-pressed="${c===tag}"><b>${esc(c)}</b><small>${n} ${n===1?"intervención":"intervenciones"} · ${nuevo?"nuevo":media<1?"antes, casi nada":`×${(n/media).toLocaleString("es-ES",{maximumFractionDigits:1})} lo habitual`}</small></button>`).join("");
  const max = Math.max(...t.serie, 1), sw = R.semanas;
  const pico = t.serie.indexOf(Math.max(...t.serie));
  const cols = t.serie.map((n,i)=>`<i class="${sw[i]===w.semana?"act":""}" style="height:${(n/max*100).toFixed(1)}%" data-tip="${esc(`<b>${semanaLarga(sw[i])}</b><br>${n} ${n===1?"intervención":"intervenciones"}`)}"></i>`).join("");
  const anios = sw.map((s,i)=>[s,i]).filter(([s,i])=>i===0 || s.slice(0,4)!==sw[i-1].slice(0,4)).map(([s,i])=>`<span style="left:${(i/sw.length*100).toFixed(1)}%">${s.slice(0,4)}</span>`).join("");
  const gs = Object.entries(t.grupos).filter(([g])=>G[g]).slice(0,8), gmax = gs[0]?.[1]||1;
  return `<section class="sec" id="exp-radar"><div class="sec-h"><h2>De qué se habla</h2><p>Los temas que se disparan cada semana respecto a sus ocho semanas anteriores. Las etiquetas las pone la IA a cada intervención y se unifican (DANA, gota fría y Paiporta cuentan juntas).</p></div>
    <div class="chart">
      <div class="exp-semana"><button class="btn boton-claro" data-exp-sem="${ds[k-1]?.semana||""}" ${k?"":"disabled"} aria-label="Semana anterior">←</button><b>${esc(semanaLarga(w.semana).replace(/^s/,"S"))}</b><button class="btn boton-claro" data-exp-sem="${ds[k+1]?.semana||""}" ${k<ds.length-1?"":"disabled"} aria-label="Semana siguiente">→</button></div>
      <div class="exp-chips">${chips}</div>
    </div>
    <div class="chart"><div class="exp-tag-h"><h3>${esc(tag)}</h3><label class="exp-busca">Otro tema <input list="exp-tags" data-exp-input placeholder="Busca un tema…"></label><datalist id="exp-tags">${Object.keys(R.temas).sort((a,b)=>a.localeCompare(b,"es")).map(c=>`<option value="${esc(c)}">`).join("")}</datalist></div>
      <p class="sub" style="margin:0">${fmt(t.n)} intervenciones en la legislatura · aparece por primera vez el ${fechaCorta(t.primera)} · pico en la ${semanaLarga(sw[pico])}</p>
      <div class="exp-cols" role="img" aria-label="Intervenciones por semana sobre ${esc(tag)}">${cols}</div><div class="exp-anios">${anios}</div>
      <div><div class="eyebrow">Quién lo saca</div><div class="exp-grupos">${gs.map(([g,n])=>`<div class="exp-g">${gdot(g)}<span>${esc(gname(g))}</span><span class="trk"><i style="width:${(n/gmax*100).toFixed(1)}%;background:${G[g].color}"></i></span><span class="num">${fmt(n)}</span></div>`).join("")}</div></div>
      <p><button class="linklike" data-tema="${esc(tag)}">Ver quién habla de «${esc(tag)}» en el periodo</button></p>
    </div></section>`;
}

function expContesta(){
  const C = EXPLORA.contesta; if (!C) return "";
  const orden = {n:(a,b)=>b.n-a.n, si:(a,b)=>b.si/b.n-a.si/a.n, no:(a,b)=>b.no/b.n-a.no/a.n}[expSel.orden];
  const barra = (si,pa,no) => { const n=si+pa+no; return `<span class="exp-stack" role="img" aria-label="Contesta ${expPct(si,n)} %, en parte ${expPct(pa,n)} %, no ${expPct(no,n)} %">${[[si,"si"],[pa,"parcial"],[no,"no"]].map(([x,c])=>x?`<i class="${c}" style="width:${(x/n*100).toFixed(2)}%" data-tip="${esc(`${c==="si"?"Contesta":c==="parcial"?"En parte":"No contesta"}: ${x} de ${n} (${expPct(x,n)} %)`)}"></i>`:"").join("")}</span>`; };
  const filas = C.ministros.slice().sort(orden).map(m=>{
    const abierto = expSel.ministro===m.orador;
    const casos = abierto ? `<ul class="exp-casos">${m.casos.map(([f,s,r,mot,po,pg,fr])=>`<li><span class="nota">${fechaCorta(f)}</span>${po?`<br><span class="nota">Pregunta ${gdot(pg)}${esc(po)}:</span> ${esc(fr)}`:""}<br><span class="pill resp-${r==="sí"?"si":r}">${r==="sí"?"Contesta":r==="parcial"?"En parte":"No contesta"}</span> ${esc(mot)} <button class="linklike" data-irs="${esc(s)}" data-f="${esc(f)}">Ver la sesión</button></li>`).join("")}</ul>` : "";
    return `<div class="exp-min${abierto?" abierto":""}"><button class="exp-min-h" data-exp-min="${esc(m.orador)}" aria-expanded="${abierto}"><span class="exp-nom"><b>${esc(m.orador)}</b><small>${esc(m.rol)}</small></span>${barra(m.si,m.parcial,m.no)}<span class="num exp-pc">${expPct(m.si,m.n)} % sí · ${expPct(m.no,m.n)} % no<small>${m.n} respuestas</small></span></button>${casos}</div>`; }).join("");
  const pg = Object.entries(C.por_grupo).filter(([g])=>G[g]).sort((a,b)=>(b[1].si+b[1].parcial+b[1].no)-(a[1].si+a[1].parcial+a[1].no));
  return `<section class="sec" id="exp-contesta"><div class="sec-h"><h2>¿Contesta el Gobierno?</h2><p>En cada respuesta del Gobierno en el control, la IA valora si contesta a lo que se le pregunta. Es una valoración orientativa: abre a cada ministro para ver los casos y sus sesiones.</p></div>
    <div class="chart">
      <div class="exp-leyenda"><span><i class="si"></i>Contesta</span><span><i class="parcial"></i>En parte</span><span><i class="no"></i>No contesta</span>
        <span class="exp-orden">Ordenar: ${[["n","más respuestas"],["si","más contesta"],["no","menos contesta"]].map(([k,l])=>`<button class="linklike" data-exp-orden="${k}" aria-pressed="${expSel.orden===k}">${l}</button>`).join(" · ")}</span></div>
      <div class="exp-mins">${filas}</div>
      <p class="nota">Solo miembros del Gobierno con 20 respuestas o más en toda la legislatura.</p>
    </div>
    <div class="chart"><h3>Según quién pregunta</h3>
      <div class="exp-mins">${pg.map(([g,c])=>{ const n=c.si+c.parcial+c.no; return `<div class="exp-min"><div class="exp-min-h"><span class="exp-nom"><b>${gdot(g)}${esc(G[g].nombre)}</b></span>${barra(c.si,c.parcial,c.no)}<span class="num exp-pc">${expPct(c.si,n)} % sí · ${expPct(c.no,n)} % no<small>${n} respuestas</small></span></div></div>`; }).join("")}</div>
      <p class="nota">Las preguntas de la oposición suelen ser más duras y abiertas que las de los grupos que apoyan al Gobierno, así que es esperable que se conteste más a unas que a otras.</p>
    </div></section>`;
}

const ORDEN_PROP = ["PSOE","PP","VOX","SUMAR","ERC","JUNTS","BILDU","PNV","MIXTO","GOB"];
function expPropuestas(){
  const P = EXPLORA.propuestas; if (!P) return "";
  const temas = Object.keys(P).sort((a,b)=>Object.values(P[b]).reduce((s,x)=>s+x.total,0)-Object.values(P[a]).reduce((s,x)=>s+x.total,0));
  const tema = P[expSel.tema] ? expSel.tema : temas[0];
  expSel.tema = tema;
  const nombreTema = TEMAS_IDX?.[tema]?.nombre || tema;
  const tarjetas = ORDEN_PROP.filter(g=>P[tema][g] && G[g]).map(g=>{ const x=P[tema][g];
    return `<div class="chart exp-prop"><div class="exp-prop-h">${gdot(g)}<b>${esc(G[g].nombre)}</b><small>${fmt(x.total)} propuestas</small></div>
      <ol>${x.lineas.map(l=>`<li><details><summary><span>${esc(l.titulo)}</span><span class="num">${l.n}</span></summary><ul>${l.ejemplos.map(([t,o,s,f])=>`<li>«${esc(t)}» <span class="nota">${esc(o)}, ${fechaCorta(f)}</span> <button class="linklike" data-irs="${esc(s)}" data-f="${esc(f)}">Ver</button></li>`).join("")}</ul></details></li>`).join("")}</ol></div>`; }).join("");
  if (!TEMAS_IDX) cargarTemasIdx().then(()=>{ const h=$("#exp-propuestas"); if (h) h.outerHTML = expPropuestas(); });
  return `<section class="sec" id="exp-propuestas"><div class="sec-h"><h2>Qué propone cada grupo</h2><p>Las medidas concretas que cada grupo ha pedido en el Congreso, agrupadas con IA cuando piden lo mismo. El número es cuántas veces se ha propuesto; ábrelas para ver ejemplos y su sesión.</p></div>
    <div class="exp-temas">${temas.map(t=>`<button class="exp-chip" data-exp-tema="${t}" aria-pressed="${t===tema}"><b>${esc(TEMAS_IDX?.[t]?.nombre||t)}</b></button>`).join("")}</div>
    <h3 class="sr">${esc(nombreTema)}</h3>
    <div class="grid2">${tarjetas}</div></section>`;
}

const expJuego = () => `<section class="sec" id="exp-juego">${franjaJuego()}</section>`;

async function renderExplora(){
  const el = $("#explora");
  if (!EXPLORA){ el.innerHTML = `<p class="nota">Cargando…</p>`; await cargarExplora(); }
  el.innerHTML = `<div class="view-intro"><div><h2>Explora</h2><p>Lo que sale de juntar el análisis de todas las intervenciones de la legislatura, no solo del periodo elegido. Lo resume la IA a partir del Diario de Sesiones: es orientativo, y cada dato enlaza a su sesión.</p></div></div>
    <nav class="exp-nav" aria-label="Secciones">${[["exp-radar","De qué se habla"],["exp-contesta","¿Contesta el Gobierno?"],["exp-propuestas","Qué propone cada grupo"],["exp-juego","¿Quién lo dijo?"]].map(([a,l])=>`<a href="#${a}" data-exp-ir="${a}">${l}</a>`).join("")}</nav>
    ${expRadar()}${expContesta()}${expPropuestas()}${expJuego()}`;
}
function repintarExp(id, fn){ const h=document.getElementById(id); if (h) h.outerHTML = fn(); }
$("#explora").addEventListener("click", e=>{
  const x = e.target.closest("[data-exp-tag],[data-exp-sem],[data-exp-orden],[data-exp-min],[data-exp-tema],[data-exp-ir]");
  if (!x) return;
  const d = x.dataset;
  if (d.expIr){ e.preventDefault(); document.getElementById(d.expIr)?.scrollIntoView({block:"start"}); window.scrollBy(0,-70); return; }
  if (d.expTag){ expSel.tag=d.expTag; repintarExp("exp-radar", expRadar); }
  else if (d.expSem){ expSel.semana=d.expSem; expSel.tag=null; repintarExp("exp-radar", expRadar); }
  else if (d.expOrden){ expSel.orden=d.expOrden; repintarExp("exp-contesta", expContesta); }
  else if (d.expMin){ expSel.ministro = expSel.ministro===d.expMin ? null : d.expMin; repintarExp("exp-contesta", expContesta); }
  else if (d.expTema){ expSel.tema=d.expTema; repintarExp("exp-propuestas", expPropuestas); }
}, SIG);
$("#explora").addEventListener("change", e=>{ const i=e.target.closest("[data-exp-input]"); if (i && EXPLORA.radar?.temas[i.value]){ expSel.tag=i.value; repintarExp("exp-radar", expRadar); } }, SIG);

/* ---------- ¿Quién lo dijo? ---------- */
// Diez frases literales del Diario de Sesiones (explora-citas.json): se adivina el grupo de quien habla y, si se
// acierta, quién es, de punto extra. El reto del día es el mismo para todos porque la semilla es la fecha; la
// partida libre sale al azar. Las estadísticas se guardan solo en este navegador.
const GRUPOS_JUEGO = ["PSOE","PP","VOX","SUMAR","ERC","JUNTS","BILDU","PNV","GOB"];
const QLD_N = 10, QLD_CLAVE = "escano-qld";
const qld = {fase:"inicio", modo:null, rondas:[], k:0, efecto:""};
let QLD_CITAS = null, QLD_RETOS = {};
const cargarCitas = () => QLD_CITAS ? Promise.resolve(QLD_CITAS)
  : Promise.all([fetch("datos/explora-citas.json").then(r=>r.ok?r.json():[]).catch(()=>[]),
                 fetch("datos/explora-retos.json").then(r=>r.ok?r.json():{}).catch(()=>({}))])
    .then(([c, retos])=>{ QLD_RETOS = retos||{}; return QLD_CITAS = c||[]; });
const qldGrupo = g => g==="GOB" ? "Gobierno" : G[g]?.nombre || g;
const qldTema = () => { const f = QLD_RETOS[hoyISO()]; return f && !Array.isArray(f) ? f.nombre : null; };   // reto especial del día
const ayerISO = () => { const d=new Date(); d.setDate(d.getDate()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const diaMes = iso => { const [,m,d]=iso.split("-").map(Number); return `${d} de ${MESES_LARGOS[m-1]}`; };
function azar(semilla){   // mulberry32: el mismo reto en todos los navegadores
  let a = 2166136261;
  for (const ch of String(semilla)) a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const barajar = (xs, r) => { const a=xs.slice(); for (let i=a.length-1; i>0; i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
function qldLeer(){ try{ return JSON.parse(localStorage.getItem(QLD_CLAVE)) || {}; }catch(e){ return {}; } }
function qldGuardar(x){ try{ localStorage.setItem(QLD_CLAVE, JSON.stringify(x)); }catch(e){} }
const qldColor = r => r.g==null ? "" : r.g!==r.c[2] ? "rojo" : r.p===r.c[1] ? "verde" : "ambar";
const qldAciertos = rs => rs.filter(r=>r.g===r.c[2]).length;
const qldExtra = rs => rs.filter(r=>r.p===r.c[1]).length;
const qldCara = (o, g) => imgFoto(dipDeOrador(o), "avatar foto", ` style="--grupo:${G[g]?.color}"`) || `<span class="avatar" style="background:${G[g]?.color}">${esc(iniciales(o))}</span>`;
const qldNombre = o => { const d=dipDeOrador(o); return d ? legible(d.n) : o; };
const qldDonde = (s, f) => `${/-PL-/.test(s) ? "En el Pleno" : "En una comisión"} · ${MESES_LARGOS[+f.slice(5,7)-1]} de ${f.slice(0,4)}`;
const QLD_TITULOS = [
  [10, "Oído de taquígrafo", "No se te escapa una: como quien escribe el Diario de Sesiones."],
  [8, "Abonado a la tribuna", "Reconoces a casi todos por cómo hablan."],
  [6, "Sigues los plenos", "Distingues bien a los grupos, aunque alguno te despista."],
  [3, "Te suena el hemiciclo", "Más difícil de lo que parece, ¿verdad? Se parecen más de lo que dicen."],
  [0, "Primer día en el Congreso", "Todos los grupos dicen cosas que podría decir otro."],
];

function qldPartida(modo){ Object.assign(qld, {fase:"grupo", modo, rondas:qldRondas(modo), k:0, efecto:""}); }
function qldRondas(modo){
  // El reto del día viene fijado desde el build (explora-retos.json) y no cambia aunque entren frases nuevas; si
  // falta, se calcula aquí con la fecha como semilla.
  const fijo = modo==="dia" && QLD_RETOS[hoyISO()];
  if (fijo) return (Array.isArray(fijo) ? fijo : fijo.rondas).map(x=>({c:x.c, grupos:x.grupos, personas:x.personas, g:null, p:null}));
  const C = QLD_CITAS || [], r = modo==="dia" ? azar("qld-"+hoyISO()) : Math.random;
  // Una persona, una clave: el Diario a veces escribe el mismo nombre de dos formas («Álvaro Vidal» y «Alvaro
  // Vidal», «Madrenas i Mir» y «Marta Madrenas i Mir»). La web y la teaser lo hacen igual: el reto sale idéntico.
  const clave = o => sinTildes(qldNombre(o)).replace(/\s+/g," ").trim();
  const oradores = {};
  C.forEach(c=>{ const m = oradores[c[2]] ||= new Map(); if (!m.has(clave(c[1]))) m.set(clave(c[1]), c[1]); });
  const rondas = [], vistos = new Set(), porGrupo = {};
  for (const c of barajar(C, r)){
    if (rondas.length===QLD_N) break;
    if (vistos.has(clave(c[1])) || (porGrupo[c[2]]||0)>=2) continue;   // variedad: nadie repite y como mucho dos por grupo
    vistos.add(clave(c[1])); porGrupo[c[2]] = (porGrupo[c[2]]||0)+1;
    const grupos = barajar([c[2], ...barajar(GRUPOS_JUEGO.filter(g=>g!==c[2]), r).slice(0,3)], r);
    const personas = barajar([c[1], ...barajar([...oradores[c[2]]].filter(([k])=>k!==clave(c[1])).map(([,o])=>o), r).slice(0,2)], r);
    rondas.push({c, grupos, personas, g:null, p:null});
  }
  return rondas;
}

function qldCerrar(){
  const st = qldLeer(), rs = qld.rondas, ok = qldAciertos(rs), extra = qldExtra(rs);
  st.partidas = (st.partidas||0)+1;
  st.mejor = Math.max(st.mejor||0, ok+extra);
  st.grupos ||= {};
  rs.forEach(r=>{ const x = st.grupos[r.c[2]] ||= [0,0]; x[1]++; if (r.g===r.c[2]) x[0]++; });
  if (qld.modo==="dia" && st.dia?.fecha!==hoyISO()){
    st.racha = st.dia?.fecha===ayerISO() ? (st.racha||0)+1 : 1;
    st.rachaMax = Math.max(st.rachaMax||0, st.racha);
    st.dia = {fecha:hoyISO(), colores:rs.map(qldColor), ok, extra, tema:qldTema()};
  }
  qldGuardar(st);
  puntoReto();
}

function qldTextoCompartir(colores, ok, extra, modo, fecha, tema){
  const emoji = {verde:"🟩", ambar:"🟨", rojo:"🟥"};
  return `¿Quién lo dijo? · ${modo==="dia" ? `Reto del ${diaMes(fecha)}${tema ? ` · Especial ${tema.toLowerCase()}` : ""}` : "Partida libre"}\n${colores.map(c=>emoji[c]||"⬜").join("")}\n${ok}/${QLD_N} grupos · ${extra} ${extra===1?"persona":"personas"}\n${urlCompartir("quien-lo-dijo")}`;
}
async function qldCompartir(texto){
  if (navigator.share && matchMedia("(pointer:coarse)").matches){ try{ await navigator.share({text:texto}); return; }catch(e){ if (e.name==="AbortError") return; } }
  try{ await navigator.clipboard.writeText(texto); aviso("Resultado copiado: pégalo donde quieras"); }catch(e){ aviso(texto); }
}

const cuadros = colores => `<div class="qld-cuadros" role="img" aria-label="${colores.filter(c=>c!=="rojo").length} de ${colores.length} acertadas">${colores.map((c,i)=>`<i class="${c}" style="animation-delay:${i*60}ms"></i>`).join("")}</div>`;

function qldInicio(){
  const st = qldLeer(), hoy = hoyISO(), hecho = st.dia?.fecha===hoy ? st.dia : null;
  const racha = st.dia && [hoy, ayerISO()].includes(st.dia.fecha) ? st.racha||0 : 0;
  const grupos = Object.entries(st.grupos||{}).filter(([g,[,n]])=>G[g] && n).sort((a,b)=>b[1][0]/b[1][1]-a[1][0]/a[1][1]);
  const stats = st.partidas ? `<section class="sec"><div class="sec-h"><h2>Tus partidas</h2><p>Se guardan solo en este navegador.</p></div>
      <div class="kpis"><div class="kpi"><b>${st.partidas}</b><span>${st.partidas===1?"partida":"partidas"}</span></div><div class="kpi"><b>${racha}</b><span>${racha===1?"día seguido":"días seguidos"} con el reto</span></div><div class="kpi"><b>${st.rachaMax||0}</b><span>mejor racha</span></div><div class="kpi"><b>${st.mejor||0}</b><span>mejor puntuación (de ${QLD_N*2})</span></div></div>
      ${grupos.length?`<div class="chart"><h3>A quién reconoces mejor</h3><div class="exp-grupos">${grupos.map(([g,[a,n]])=>`<div class="exp-g">${gdot(g)}<span>${esc(qldGrupo(g))}</span><span class="trk"><i style="width:${(a/n*100).toFixed(1)}%;background:${G[g].color}"></i></span><span class="num">${expPct(a,n)} %<small class="nota"> de ${n}</small></span></div>`).join("")}</div></div>`:""}</section>` : "";
  return `<div class="qld">
    <div class="qld-hero">
      <div class="eyebrow">El juego de Escaño Abierto</div>
      <h2 class="qld-h">¿Quién lo dijo?</h2>
      <p>${QLD_N} frases dichas en el Congreso esta legislatura, copiadas tal cual del Diario de Sesiones. Adivina de qué grupo es quien habla y, si aciertas, gana un punto extra diciendo quién es.</p>
      ${qldTema() && !hecho ? `<p class="qld-especial"><b>Hoy, especial ${esc(qldTema().toLowerCase())}:</b> las diez frases del reto hablan de ${esc(qldTema().toLowerCase())}.</p>` : ""}
      ${hecho ? `<div class="chart qld-hecho"><div class="eyebrow">Reto del ${diaMes(hoy)} · hecho</div>${cuadros(hecho.colores)}
          <p class="qld-msg"><b>${hecho.ok}/${QLD_N}</b> grupos y <b>${hecho.extra}</b> ${hecho.extra===1?"persona":"personas"}.${racha>1?` Llevas ${racha} días seguidos.`:""} Mañana hay un reto nuevo.</p>
          <div class="qld-cta"><button class="btn primary boton" data-qld="compartir-dia">Compartir resultado</button><button class="btn boton-claro" data-qld="libre">Partida libre</button></div></div>`
        : `<div class="qld-cta"><button class="btn primary boton" data-qld="dia">Jugar el reto de hoy</button><button class="btn boton-claro" data-qld="libre">Partida libre</button>${racha?`<span class="nota">Racha: ${racha} ${racha===1?"día":"días"}</span>`:""}</div>`}
    </div>
    <div class="chart"><h3>Cómo se juega</h3><ul class="qld-reglas">
      <li>Lee la frase y elige el grupo de quien la dijo entre cuatro. El Gobierno cuenta como un grupo más.</li>
      <li>Si aciertas el grupo, elige quién la dijo entre tres personas de ese grupo: <b>punto extra</b>.</li>
      <li>🟩 grupo y persona · 🟨 solo el grupo · 🟥 fallo. El <b>reto del día</b> es igual para todos: compara tu resultado.</li>
      <li>Con teclado: <kbd>1</kbd>–<kbd>4</kbd> para responder y <kbd>Intro</kbd> para seguir.</li>
    </ul><p class="nota">Las frases salen de las intervenciones analizadas y se publican solo si aparecen literalmente en el Diario de Sesiones. Se quitan las que nombran al propio partido, para que no sea trivial.</p></div>
    ${stats}</div>`;
}

function qldRonda(){
  const R = qld.rondas[qld.k], [cita, orador, g, s, f] = R.c, fase = qld.fase;
  const pips = qld.rondas.map((r,i)=>`<i class="${i===qld.k && fase==="grupo" ? "act" : qldColor(r)}"></i>`).join("");
  const pts = qldAciertos(qld.rondas) + qldExtra(qld.rondas);
  let cuerpo;
  if (fase==="grupo") cuerpo = `<div class="qld-ops" role="group" aria-label="¿De qué grupo es?">${R.grupos.map((o,i)=>`<button class="qld-op" data-qld-g="${o}">${gdot(o)}<span>${esc(qldGrupo(o))}</span><kbd>${i+1}</kbd></button>`).join("")}</div>`;
  else {
    const ops = R.grupos.map(o=>`<button class="qld-op${o===g?" ok":o===R.g?" ko":""}" disabled>${gdot(o)}<span>${esc(qldGrupo(o))}</span></button>`).join("");
    if (fase==="persona") cuerpo = `<p class="qld-msg" role="status"><b class="ok">¡Bien!</b> Es ${g==="GOB"?"del Gobierno":`de ${esc(qldGrupo(g))}`}. Punto extra: <b>¿quién lo dijo?</b></p>
      <div class="qld-ops tres" role="group" aria-label="¿Quién lo dijo?">${R.personas.map((o,i)=>`<button class="qld-op" data-qld-p="${esc(o)}">${qldCara(o,g)}<span>${esc(qldNombre(o))}</span><kbd>${i+1}</kbd></button>`).join("")}</div>
      <div class="qld-sig"><span></span><button class="linklike" data-qld-p="">No lo sé</button></div>`;
    else {
      const bienG = R.g===g, bienP = R.p===orador;
      const titulo = !bienG ? `<b class="ko">No.</b> ` : bienP ? `<b class="ok">¡Pleno!</b> ` : R.p ? `<b class="ok">Grupo, sí.</b> La persona, no. ` : `<b class="ok">Grupo, sí.</b> `;
      cuerpo = `<div class="qld-ops">${ops}</div>
        <div class="qld-quien" role="status">${qldCara(orador,g)}<p class="qld-msg">${titulo}Lo dijo <b>${esc(qldNombre(orador))}</b> (${esc(qldGrupo(g))}) el ${fechaCorta(f)}.</p></div>
        <div class="qld-sig"><button class="linklike" data-irs="${esc(s)}" data-f="${esc(f)}">Ver la sesión</button><button class="btn primary boton" data-qld="sig">${qld.k===QLD_N-1?"Ver resultado":"Siguiente"} →</button></div>`;
    }
  }
  return `<div class="qld">
    <div class="qld-top"><span class="eyebrow">${qld.modo==="dia"?`Reto del ${diaMes(hoyISO())}${qldTema()?` · Especial ${esc(qldTema().toLowerCase())}`:""}`:"Partida libre"} · frase ${qld.k+1} de ${QLD_N}</span>
      <span class="qld-pips" aria-hidden="true">${pips}</span><span class="qld-pts"><b class="num">${pts}</b> ${pts===1?"punto":"puntos"}</span></div>
    <div class="chart qld-card ${qld.efecto}"><blockquote class="qld-cita">«${esc(cita)}»</blockquote><p class="qld-ctx">${qldDonde(s,f)}</p>${cuerpo}</div>
    <div class="qld-sig"><button class="linklike" data-qld="salir">Salir de la partida</button></div></div>`;
}

function qldFin(){
  const rs = qld.rondas, ok = qldAciertos(rs), extra = qldExtra(rs);
  const [, titulo, frase] = QLD_TITULOS.find(([min])=>ok>=min);
  const lista = rs.map(r=>{ const [cita,orador,g,s,f]=r.c, d=dipDeOrador(orador);
    return `<li><i class="${qldColor(r)}"></i><blockquote>«${esc(cita)}»</blockquote>
      <span class="nota">${gdot(g)}${d?`<button class="linklike" data-dip="${d.slug}">${esc(legible(d.n))}</button>`:esc(orador)} · ${esc(qldGrupo(g))} · ${fechaCorta(f)}${r.g!==g?` · dijiste ${esc(qldGrupo(r.g))}`:""} · <button class="linklike" data-irs="${esc(s)}" data-f="${esc(f)}">Ver la sesión</button></span></li>`; }).join("");
  return `<div class="qld">
    <div class="chart qld-fin"><div class="eyebrow">${qld.modo==="dia"?`Reto del ${diaMes(hoyISO())}${qldTema()?` · Especial ${esc(qldTema().toLowerCase())}`:""}`:"Partida libre"}</div>
      <div class="qld-num">${ok}<small>/${QLD_N}</small></div>
      <p>grupos acertados${extra?`, y ${extra} ${extra===1?"persona":"personas"} de punto extra`:""}</p>
      ${cuadros(rs.map(qldColor))}
      <h2>${titulo}</h2><p>${frase}</p>
      <div class="qld-cta" style="justify-content:center"><button class="btn primary boton" data-qld="compartir">Compartir resultado</button><button class="btn boton-claro" data-qld="libre">Otra partida</button><button class="btn boton-claro" data-qld="inicio">Tus estadísticas</button></div></div>
    <section class="sec"><div class="sec-h"><h2>Las ${QLD_N} frases</h2><p>Cada una enlaza a la sesión en la que se dijo.</p></div><div class="chart"><ol class="qld-lista">${lista}</ol></div></section></div>`;
}

function pintarQld(foco){
  const el = $("#quien-lo-dijo");
  el.innerHTML = qld.fase==="inicio" ? qldInicio() : qld.fase==="fin" ? qldFin() : qldRonda();
  qld.efecto = "";
  if (foco) el.querySelector(".qld-op:not([disabled]),[data-qld=sig],.qld-fin .btn.primary")?.focus({preventScroll:true});
}
async function renderQuienLoDijo(){
  if (!QLD_CITAS){ $("#quien-lo-dijo").innerHTML = `<p class="nota">Cargando las frases…</p>`; await cargarCitas(); }
  if (!QLD_CITAS.length){ $("#quien-lo-dijo").innerHTML = `<p class="nota">No se han podido cargar las frases. Prueba a recargar la página.</p>`; return; }
  pintarQld(false);
}
// La franja que invita a jugar, en la portada y en Explora.
const franjaJuego = () => { const st=qldLeer(), hecho=st.dia?.fecha===hoyISO();
  return `<div class="chart qld-franja"><div><div class="eyebrow">El juego</div><h3>¿Quién lo dijo?</h3><p>${hecho?`Hoy has acertado ${st.dia.ok} de ${QLD_N}. Mañana hay un reto nuevo.`:`${QLD_N} frases literales del Congreso. ¿Sabrías decir de qué grupo es quien habla?`}</p></div><button class="btn ${hecho?"boton-claro":"primary boton"}" data-go="quien-lo-dijo">${hecho?"Ver mi resultado":"Jugar el reto de hoy"}</button></div>`; };

// Aviso del reto diario: mientras no se haya jugado hoy, un punto en la pestaña y un botón discreto en la esquina
// (fuera del juego). La ✕ lo quita hasta el día siguiente. Sin servidor no hay notificaciones push.
const retoPendiente = () => qldLeer().dia?.fecha!==hoyISO();
function puntoReto(){ const no = !retoPendiente(); document.querySelectorAll(".tab-punto").forEach(p=>p.hidden = no); }
function avisoReto(vista){
  const a = document.getElementById("qld-aviso");
  const toca = vista!=="quien-lo-dijo" && retoPendiente() && qldLeer().avisado!==hoyISO();
  if (!toca){ a?.remove(); return; }
  if (a) return;
  const racha = (st => st.dia?.fecha===ayerISO() ? st.racha||0 : 0)(qldLeer());
  document.body.insertAdjacentHTML("beforeend", `<div id="qld-aviso" role="complementary" aria-label="Reto del día">
    <button class="qld-aviso-ir" data-qld-aviso="jugar"><i aria-hidden="true"></i>Reto del día<span> · ${racha>1?`racha de ${racha}`:"¿Quién lo dijo?"}</span></button>
    <button class="qld-aviso-x" data-qld-aviso="cerrar" aria-label="Ocultar hasta mañana" title="Ocultar hasta mañana">×</button></div>`);
}
document.addEventListener("click", e=>{
  const b = e.target.closest("[data-qld-aviso]"); if (!b) return;
  if (b.dataset.qldAviso==="cerrar"){ const st=qldLeer(); st.avisado=hoyISO(); qldGuardar(st); avisoReto(); return; }
  show("quien-lo-dijo", true); window.scrollTo(0,0);
  const empezar = () => { if (QLD_CITAS.length && qld.fase==="inicio" && retoPendiente()){ qldPartida("dia"); pintarQld(true); } };
  QLD_CITAS ? empezar() : cargarCitas().then(empezar);
}, SIG);
$("#quien-lo-dijo").addEventListener("click", e=>{
  const x = e.target.closest("[data-qld],[data-qld-g],[data-qld-p]"); if (!x || x.disabled) return;
  const d = x.dataset, R = qld.rondas[qld.k];
  if (d.qldG && qld.fase==="grupo"){ R.g = d.qldG; const bien = R.g===R.c[2]; qld.fase = bien ? "persona" : "visto"; qld.efecto = bien ? "bien" : "mal"; }
  else if ("qldP" in d && qld.fase==="persona"){ R.p = d.qldP; qld.fase = "visto"; qld.efecto = R.p===R.c[1] ? "bien" : R.p ? "mal" : ""; }
  else if (d.qld==="sig"){ if (qld.k<QLD_N-1){ qld.k++; qld.fase="grupo"; } else { qld.fase="fin"; qldCerrar(); } window.scrollTo({top:0}); }
  else if (d.qld==="dia" || d.qld==="libre"){
    if (d.qld==="dia" && qldLeer().dia?.fecha===hoyISO()){ qld.fase="inicio"; }
    else qldPartida(d.qld);
    window.scrollTo({top:0});
  }
  else if (d.qld==="salir" || d.qld==="inicio"){ qld.fase="inicio"; }
  else if (d.qld==="compartir"){ const rs=qld.rondas; qldCompartir(qldTextoCompartir(rs.map(qldColor), qldAciertos(rs), qldExtra(rs), qld.modo, hoyISO(), qld.modo==="dia" ? qldTema() : null)); return; }
  else if (d.qld==="compartir-dia"){ const h=qldLeer().dia; if (h) qldCompartir(qldTextoCompartir(h.colores, h.ok, h.extra, "dia", h.fecha, h.tema)); return; }
  else return;
  pintarQld(true);
}, SIG);
document.addEventListener("keydown", e=>{
  if ($("#quien-lo-dijo").hidden || e.metaKey || e.ctrlKey || e.altKey || e.target.closest("input,select,textarea,[contenteditable]")) return;
  if (/^[1-4]$/.test(e.key)){ const b = $("#quien-lo-dijo").querySelectorAll(".qld-op:not([disabled])")[+e.key-1]; if (b){ e.preventDefault(); b.click(); } }
  else if (e.key==="Enter" && qld.fase==="visto" && !e.target.closest("button,a")){ e.preventDefault(); $("#quien-lo-dijo [data-qld=sig]")?.click(); }
}, SIG);

async function pintarLugar(circ){
  const x = await fetch(`datos/lugares/${slug(circ)}.json`).then(r=>r.ok?r.json():null).catch(()=>null);
  const sec = $("#prov-lugar"); if (!sec) return;
  if (!x || !(x.n || x.comunidad?.n)){ sec.remove(); return; }
  const fila = ([f,s,o,g,lug,fr]) => `<li><span class="nota">${fechaCorta(f)} · ${G[g]?gdot(g):""}${esc(o)}</span><br>${esc(fr)} <span class="tag lugar">${esc(lug)}</span> <button class="linklike" data-irs="${esc(s)}" data-f="${esc(f)}">Ver</button></li>`;
  const bloque = (d, nombre) => { const gs = Object.entries(d.grupos).filter(([g])=>G[g]).slice(0,8), gmax = gs[0]?.[1]||1;
    return `<div class="grid2"><div class="chart"><div class="eyebrow">De qué se habla</div><div class="tags">${d.temas.map(([t,n])=>`<span class="tag">${esc(t)} <span class="num">${n}</span></span>`).join("")}</div>
      <div class="eyebrow">Quién habla de ${esc(nombre)}</div><div class="exp-grupos">${gs.map(([g,n])=>`<div class="exp-g">${gdot(g)}<span>${esc(gname(g))}</span><span class="trk"><i style="width:${(n/gmax*100).toFixed(1)}%;background:${G[g].color}"></i></span><span class="num">${fmt(n)}</span></div>`).join("")}</div></div>
      <div class="chart"><div class="eyebrow">Lo más reciente</div><ul class="exp-casos">${d.central.slice(0,8).map(fila).join("")}</ul>
        ${d.central.length>8?`<details class="exp-mas"><summary>Ver más</summary><ul class="exp-casos">${d.central.slice(8).map(fila).join("")}</ul></details>`:""}
        ${d.pasada.length?`<details class="exp-mas"><summary>Menciones de pasada (${d.pasada.length}${d.pasada.length>=40?"+":""})</summary><p class="nota">Intervenciones que citan ${esc(nombre)} sin que sea su asunto principal. Puede colarse alguna confusión, por ejemplo con apellidos.</p><ul class="exp-casos">${d.pasada.map(fila).join("")}</ul></details>`:""}</div></div>`; };
  const cc = x.comunidad;
  sec.innerHTML = `${x.n?`<div class="sec-h"><h2>Lo que se dice de ${esc(circ)}</h2><p>${fmt(x.n)} ${x.n===1?"intervención":"intervenciones"} de la legislatura tratan sobre ${esc(circ)} o sus municipios. Los lugares los detecta la IA en cada intervención.</p></div>${bloque(x, circ)}`:""}
    ${cc?.n?`<div class="sec-h" style="margin-top:18px"><h2>Y de ${esc(cc.nombre)}</h2><p>${fmt(cc.n)} intervenciones tratan sobre la comunidad en su conjunto.</p></div>${bloque(cc, cc.nombre)}`:""}`;
}

/* ---------- días ---------- */
// Por día: un índice de las jornadas del periodo (un punto por sesión, rojo si es pleno), un filtro por órgano y cada
// jornada con su fecha fija a la izquierda. En cada sesión, sus cifras arriba y el orden del día plegable si es largo.
let diasFiltro = "todas";
const tipoOrgano = s => s.organo === "Pleno" ? "pleno" : /comisi|ponencia/i.test(s.organo) ? "comision" : "otros";
function renderDias(){
  const byDate = {};
  const visibles = DATA.sesiones.filter(s=>diasFiltro==="todas" || tipoOrgano(s)===diasFiltro);
  visibles.forEach(s=>(byDate[s.fecha]=byDate[s.fecha]||[]).push(s));
  const dates = Object.keys(byDate).sort().reverse();
  let primera = true;
  const html = dates.map(f=>{
    const d = dt(f);
    const sess = byDate[f].map(s=>{
      const ivs = IVS.filter(i=>i.s===s.id);
      const puntos = s.puntos.map(p=>{
        const pivs = ivs.filter(i=>matchItem(i,p));
        const stLabel = {analizado:"Analizado",parcial:"Parcial",pendiente:"Sin analizar","sin-ds":"Diario pendiente"}[p.estado];
        return `<div class="punto">
          <div class="punto-h"><span class="tipo">${esc(p.tipo)}</span><span class="t">${esc(p.titulo)}${p.exp?(/^12[1-5]\//.test(p.exp)?` <button class="linklike mono" style="color:var(--muted);font-size:inherit" data-ini="${esc(p.exp)}">${esc(p.exp)}</button>`:` <span class="mono" style="color:var(--muted)">${esc(p.exp)}</span>`):""}</span><span class="pill st-${p.estado}">${stLabel}</span></div>
          ${p.nota?`<p class="nota">${esc(p.nota)}</p>`:""}
          ${p.preguntas?`<ul class="qlist">${p.preguntas.map(q=>`<li><span class="gp">${gdot(q[1])}${esc(q[0])}</span><span>${esc(q[2])}</span></li>`).join("")}</ul>`:""}
          ${pivs.length?`<details class="ivs"${pivs.length<=4?" open":""}><summary>${pivs.length} intervenciones</summary><div class="iv-list">${pivs.map(ivCard).join("")}</div></details>`:""}
          ${listaVotos((p.votos||[]).filter(id=>VOTES[id]).map(id=>VOTES[id]), true)}
        </div>`;
      }).join("");
      const nVot = s.puntos.reduce((n,p)=>n+(p.votos||[]).filter(id=>VOTES[id]).length, 0);
      const plegar = !primera && s.puntos.length > 2; primera = false;
      const cifras = `<div class="ses-cifras"><span><b>${s.puntos.length}</b> ${s.puntos.length===1?"asunto":"asuntos"}</span>${nVot?`<span><b>${nVot}</b> ${nVot===1?"votación":"votaciones"}</span>`:""}${ivs.length?`<span><b>${ivs.length}</b> ${ivs.length===1?"intervención analizada":"intervenciones analizadas"}</span>`:""}</div>`;
      return `<article class="session" id="s-${s.id}">
        <div class="session-head"><div><div class="organ">${esc(s.organo)}</div><h3>${esc(s.sesion)}</h3></div>
          <div class="meta-links">${botonCompartir("sesion/"+slugPy(s.id), s.organo+", "+s.fecha)}${s.ds?`<a href="${s.ds}" target="_blank" rel="noopener">Diario de Sesiones <span class="mono">${s.dsNombre}</span></a>`:`<span style="color:var(--muted)">Diario de Sesiones aún no publicado</span>`}${s.ordenDia?`<a href="${s.ordenDia}" target="_blank" rel="noopener">Orden del día</a>`:""}</div></div>
        ${s.resumen?`<p class="sum">${esc(s.resumen)}</p>`:""}${s.nota?`<p class="nota">${esc(s.nota)}</p>`:""}
        ${(s.momentos||[]).length?`<div style="display:grid;gap:6px"><div class="eyebrow">Momentos clave</div><ol class="momentos">${s.momentos.map(m=>`<li>${esc(m.que)}${(m.quien||[]).length?` <span class="quien">· ${esc(m.quien.join(", "))}</span>`:""}</li>`).join("")}</ol></div>`:""}
        ${ivs.length?`<div style="display:grid;gap:6px"><div class="eyebrow">Tono de las intervenciones analizadas</div>${toneBar(ivs)}${toneLegend(ivs)}</div>`:""}
        ${s.reacciones && Object.keys(s.reacciones).length?`<p class="nota">En la Cámara: ${Object.entries(s.reacciones).map(([k,n])=>`${esc(k.replace(/_/g," "))} <b class="num">${n}</b>`).join(" · ")}</p>`:""}
        ${cifras}
        ${s.puntos.length ? (plegar ? `<details class="od-plegable"><summary>Orden del día · ${s.puntos.length} asuntos${nVot?` · ${nVot} ${nVot===1?"votación":"votaciones"}`:""}</summary><div class="puntos">${puntos}</div></details>` : `<div class="puntos">${puntos}</div>`) : ""}
      </article>`;
    }).join("");
    return `<div class="day" id="dia-${f}"><div class="date"><div class="d">${d.d}</div><div class="m">${d.m} ${f.slice(0,4)}</div><div class="w">${d.w}</div></div><div class="sessions">${sess}</div></div>`;
  }).join("");
  const cuenta = k => DATA.sesiones.filter(s=>k==="todas" || tipoOrgano(s)===k).length;
  const filtros = [["todas","Todas"],["pleno","Pleno"],["comision","Comisiones"],["otros","Otros órganos"]].filter(([k])=>k==="todas" || cuenta(k));
  // El índice: de la jornada más antigua a la más reciente, como un calendario
  const indice = dates.slice().reverse().map(f=>{ const d = dt(f), ss = byDate[f];
    return `<button type="button" class="dia-i" data-dia="${f}" data-tip="${esc(`${d.d} ${d.m} · ${ss.map(s=>s.organo).join(", ")}`)}"><small>${esc(d.w.slice(0,3))}</small><b>${d.d}</b><span>${ss.map(s=>`<i class="${tipoOrgano(s)}"></i>`).join("")}</span><em>${esc(d.m)}</em></button>`; }).join("");
  $("#dias").innerHTML = `<div class="view-intro"><div><h2>Sesión a sesión</h2><p>Resumen de cada jornada, orden del día, intervenciones analizadas y resultado de las votaciones. Cada votación aparece junto al asunto debatido; si se votó otro día, se indica la fecha.</p></div></div>
    <div class="dias-barra"><div class="or-seg" role="group" aria-label="Qué sesiones">${filtros.map(([k,l])=>`<button type="button" data-org="${k}" aria-pressed="${diasFiltro===k}">${l} <small>${cuenta(k)}</small></button>`).join("")}</div>
      <p class="dias-n">${dates.length} ${dates.length===1?"jornada":"jornadas"} · ${visibles.length} ${visibles.length===1?"sesión":"sesiones"}</p></div>
    <nav class="dias-indice" aria-label="Jornadas">${indice}</nav>
    <div>${html || '<p class="nota">No hay sesiones de este tipo en el periodo.</p>'}</div>`;
  $("#dias .dias-barra").addEventListener("click", e=>{ const b=e.target.closest("[data-org]"); if (!b) return; diasFiltro = b.dataset.org; renderDias(); });
  $("#dias .dias-indice").addEventListener("click", e=>{ const b=e.target.closest("[data-dia]"); if (!b) return;
    const dia = document.getElementById("dia-"+b.dataset.dia); window.scrollTo({top: scrollY + dia.getBoundingClientRect().top - 150, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); });
  const ind = $("#dias .dias-indice"); if (ind) ind.scrollLeft = ind.scrollWidth;   // el índice se abre por lo más reciente
}
function matchItem(i,p){ if (p.itemId) return i.item===p.itemId; return !!p.match && new RegExp(p.match).test(i.item); }

/* ---------- grupos ---------- */
function renderGrupos(){
  const keys = [...PARL,"GOB"];
  const rows = keys.map(g=>{
    const ivs = IVS.filter(i=>i.g===g);
    const avg = ivs.length? (ivs.reduce((a,i)=>a+i.int,0)/ivs.length).toFixed(1) : "–";
    const votes = DATA.votaciones.filter(v=>v.grupos[g]);
    const win = votes.filter(v=>{const x=v.grupos[g]; return (x==="S"&&passed(v))||(x==="N"&&!passed(v));}).length;
    const decided = votes.filter(v=>["S","N"].includes(v.grupos[g])).length;
    const tc = {}; ivs.forEach(i=>i.temas.forEach(t=>tc[t]=(tc[t]||0)+1));
    const top = Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]).join(", ");
    // Una tarjeta por grupo: su nombre, sus escaños (y lo que pesan en los 350), cuánto habla y con qué tono, cuántas
    // votaciones gana y su cohesión. Lleva a sus diputados (el Gobierno, a sus oradores).
    const esc_ = DIP.filter(d=>d.g===g && !d.baja).length, coh = g==="GOB" ? null : cohesion(g);
    const temas = Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
    const cifra = (n, l) => `<span><b>${n}</b>${l}</span>`;
    return `<button type="button" class="gr-card" ${g==="GOB" ? `data-gr-or="GOB"` : `data-gr="${g}"`} style="--grupo:${G[g].color}">
      <span class="gr-cab"><span class="gr-sigla">${esc(g==="GOB"?"Gobierno":g)}</span><b class="gr-nombre">${esc(G[g].nombre)}</b></span>
      ${g==="GOB" ? `<span class="gr-esc gr-esc-gob">El Consejo de Ministros, en el banco azul</span>` : `<span class="gr-esc"><span class="gr-esc-n"><b>${esc_}</b> ${esc_===1?"escaño":"escaños"}</span><span class="gr-esc-b"><i style="width:${(esc_/350*100).toFixed(1)}%"></i><em></em></span></span>`}
      <span class="gr-cifras">${cifra(ivs.length, "intervenciones")}${cifra(String(avg).replace(".",","), "intensidad")}${g==="GOB" ? "" : cifra(decided ? `${Math.round(win/decided*100)} %` : "–", "votaciones ganadas") + cifra(coh!=null ? `${(coh*100).toFixed(1).replace(".",",")} %` : "–", "cohesión")}</span>
      ${ivs.length ? `<span class="gr-tono">${toneBar(ivs)}</span>` : ""}
      ${temas.length ? `<span class="gr-temas">${temas.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</span>` : ""}
      <span class="gr-ir">${g==="GOB" ? "Sus oradores" : "Sus diputados"}</span>
    </button>`;
  }).join("");

  // Afinidad con el voto nominal: probabilidad de que dos diputados de cada grupo votaran lo mismo.
  const H = ORDEN_HEMI;
  const heat = `<table class="heat"><thead><tr><th></th>${H.map(g=>`<th>${g}</th>`).join("")}</tr></thead><tbody>${H.map(a=>`<tr><th class="rowh">${gdot(a)} ${a}</th>${H.map(b=>{ if(a===b) return `<td style="background:var(--sunk);color:var(--muted)">·</td>`; const r=afinidad(a,b); if(r==null) return `<td>–</td>`; const pc=Math.round(r*100); return `<td style="background:color-mix(in srgb, var(--ink) ${Math.round(r*85)}%, var(--sunk));color:${r>.55?"var(--bg)":"var(--ink)"}" data-tip="${a} y ${b}: ${pc} % de coincidencia">${pc}</td>`;}).join("")}</tr>`).join("")}</tbody></table>`;
  const coh = H.map(g=>[g,cohesion(g)]).filter(x=>x[1]!=null).sort((a,b)=>b[1]-a[1]);

  const tc = {}; IVS.filter(i=>i.g!=="COMP").forEach(i=>i.temas.forEach(t=>tc[t]=(tc[t]||0)+1));
  const topics = Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const max = topics.length ? topics[0][1] : 1;

  $("#grupos").innerHTML = `
    <div class="view-intro"><div><h2>Grupos parlamentarios</h2><p>Cuánto intervino cada grupo y con qué tono, qué mayorías se formaron, cuánto ruido hubo en la Cámara y qué grupos votan juntos.</p><p><button class="linklike" data-go="preguntas">Preguntas escritas al Gobierno por grupo →</button></p></div></div>
    <div class="gr-cards">${rows}</div>
    ${toneLegend(IVS)}
    <section class="sec gr-sec"><div class="sec-h"><h2>Cómo votan</h2><p>Quién gana, con quién y con cuánta disciplina, votación a votación.</p></div></section>
    ${DATA.votaciones.length?`<div class="chart"><h3>Quién gana cada votación</h3><p class="sub">Cada columna es una votación, en orden cronológico; cada fila, un grupo. El cuadro se rellena con el color del grupo cuando votó en bloque con el lado ganador. Pulsa una columna para ir a la votación.</p>${matrizGanadores()}</div>`:""}
    ${ganadasPorSemana()?`<div class="chart"><h3>Votaciones ganadas, semana a semana</h3><p class="sub">Parte de las votaciones de cada semana en las que el grupo, en bloque, estuvo en el lado ganador. La línea gris del centro marca el 50 %; arriba, el 100 %.</p>${ganadasPorSemana()}</div>`:""}
    <div class="chart"><h3>Mayorías</h3><p class="sub">Qué grupos estaban, en bloque, en el lado ganador de cada votación: los que votaron sí en las aprobadas y los que votaron no en las rechazadas. Cada fila es una combinación; los escaños son los que suman esos grupos.</p>${tablaMayorias()}</div>
    <div class="two">
      <div class="panel"><h3>Afinidad de voto</h3><p>Probabilidad de que un diputado de cada grupo, tomados al azar, votaran lo mismo, de media en las ${DATA.votaciones.length} votaciones.</p><div class="heat-wrap">${heat}</div></div>
      <div class="panel"><h3>Cohesión</h3><p>Parte de los diputados de cada grupo que votó con la mayoría de su grupo, de media.</p><div class="coh">${coh.map(([g,c])=>`<div class="coh-row" data-tip="${esc(`${G[g].nombre}: ${pct(c)} de sus diputados vota con la mayoría del grupo`)}"><span class="g" style="font-weight:600;display:inline-flex;gap:6px;align-items:center">${gdot(g)}${g}</span><span class="trk"><b style="width:${(c*100).toFixed(1)}%"></b></span><span class="n">${(c*100).toFixed(1).replace(".",",")} %</span></div>`).join("")}</div></div>
    </div>
    <section class="sec gr-sec"><div class="sec-h"><h2>Cómo reacciona la Cámara</h2><p>Lo que anota el Diario de Sesiones mientras se habla, y si el Gobierno contesta a lo que se le pregunta.</p></div></section>
    <div class="two">
      <div class="chart"><h3>Termómetro de la cámara</h3><p class="sub">Aplausos, risas, rumores y protestas que anota el Diario de Sesiones en cada pleno.</p>${termometroSesiones()||'<p class="nota">Sin datos.</p>'}</div>
      <div class="chart"><h3>Durante los turnos de cada grupo</h3><p class="sub">Reacciones por turno de palabra. Los aplausos suelen venir del propio grupo; los rumores y las protestas, de los demás.</p>${termometroGrupos()||'<p class="nota">Sin datos.</p>'}</div>
    </div>
    ${respPanel()}`;
  // La matriz de ganadores se abre por las votaciones más recientes.
  requestAnimationFrame(()=>{ const w=$("#grupos .gan-wrap"); if (w) w.scrollLeft = w.scrollWidth; });
}

function respPanel(){
  const r = {}; IVS.filter(i=>i.g==="GOB" && i.responde && i.responde!=="no aplica").forEach(i=>{ const o=(r[i.orador]=r[i.orador]||{sí:0,parcial:0,no:0}); o[i.responde]++; });
  const filas = Object.entries(r).sort((a,b)=>(b[1].no+b[1].parcial)-(a[1].no+a[1].parcial));
  if(!filas.length) return "";
  return `<div class="panel"><h3>¿Contesta el Gobierno?</h3><p>Respuestas a preguntas e interpelaciones: si el ministro contesta a lo que se le pregunta, en parte o nada.</p><div class="topics">${filas.map(([o,c])=>{const n=c.sí+c.parcial+c.no; return `<div class="topic"><span>${esc(o)}</span><span class="stack" style="height:10px"><i style="width:${c.sí/n*100}%;background:var(--si)"></i><i style="width:${c.parcial/n*100}%;background:var(--abst)"></i><i style="width:${c.no/n*100}%;background:var(--no)"></i></span><span class="n">${n}</span></div>`;}).join("")}</div></div>`;
}

/* ---------- oradores ---------- */
let orFilter = {q:"", g:"TODOS", orden:"act", vista:"tarjetas", pag:1, letra:null};
const OR_POR_PAGINA = 24;
// Los oradores: un directorio de quien habló en el periodo. Cada tarjeta lleva a su ficha si es diputado; si no
// (ministros que no lo son, comparecientes), abre un panel con sus intervenciones.
function datosOradores(){
  const by = {};
  IVS.forEach(i=>{ (by[i.orador] ||= {nombre:i.orador, g:i.g, rol:i.rol.split(" · ")[0], ivs:[]}).ivs.push(i); });
  return Object.values(by).map(o=>{
    const tc = {}; o.ivs.forEach(i=>tc[i.tono]=(tc[i.tono]||0)+1);
    const ses = [...new Set(o.ivs.map(i=>i.s))].map(id=>DATA.sesiones.find(s=>s.id===id)).filter(Boolean).sort((a,b)=>b.fecha.localeCompare(a.fecha));
    return {...o, avg: o.ivs.reduce((s,i)=>s+i.int,0)/o.ivs.length, dom: Object.entries(tc).sort((a,b)=>b[1]-a[1])[0][0],
      temas: [...new Set(o.ivs.flatMap(i=>i.temas))].slice(0,3), cita: o.ivs.map(i=>i.cita).filter(Boolean).sort((a,b)=>a.length-b.length)[0],
      ses, dip: dipDeOrador(o.nombre)};
  }).map(o=>({...o, visible: o.dip ? legible(o.dip.n) : o.nombre}));   // de los diputados, el nombre completo
}
function renderOradores(){
  const todos = datosOradores(), q = sinTildes(orFilter.q.trim());
  let list = todos.filter(o=>(orFilter.g==="TODOS"||o.g===orFilter.g) && (!q || sinTildes(o.nombre+" "+o.visible).includes(q) || o.ivs.some(i=>sinTildes(i.temas.join(" ")+" "+(i.resumen||i.frase||"")).includes(q))));
  const az = (a,b)=>a.nombre.localeCompare(b.nombre,"es");
  list.sort(orFilter.orden==="int" ? (a,b)=>b.avg-a.avg || b.ivs.length-a.ivs.length : orFilter.orden==="az" || orFilter.vista==="directorio" ? az : (a,b)=>b.ivs.length-a.ivs.length || b.avg-a.avg);
  const present = [...new Set(IVS.map(i=>i.g))];
  const order = [...PARL,"GOB","COMP"].filter(g=>present.includes(g));
  const chips = ["TODOS",...order].map(g=>`<button class="chipbtn" data-g="${g}" aria-pressed="${orFilter.g===g}">${g==="TODOS"?"Todos":gdot(g)+gname(g)}</button>`).join("");
  const seg = (k, opts) => `<div class="or-seg" role="group">${opts.map(([v,l])=>`<button type="button" data-${k}="${v}" aria-pressed="${orFilter[k]===v}">${l}</button>`).join("")}</div>`;
  const foto = (o, cls) => (o.dip && imgFoto(o.dip, `${cls} foto`, ` style="--grupo:${G[o.g]?.color}"`, true)) || `<span class="${cls} avatar" style="background:${G[o.g]?.color||"var(--line-strong)"}">${esc(iniciales(o.nombre))}</span>`;
  const destino = o => o.dip ? `data-dip="${o.dip.slug}"` : `data-or="${esc(o.nombre)}"`;
  const ultima = o => { const s = o.ses[0]; if (!s) return ""; const d = dt(s.fecha); return `${o.ses.length === 1 ? "en 1 sesión" : `en ${o.ses.length} sesiones`} · la última, ${d.d} ${d.m}`; };
  const cargo = o => o.rol && o.rol!==gname(o.g) && o.rol!==G[o.g]?.nombre ? o.rol : "";   // sin repetir el grupo
  const tarjeta = o => `<button type="button" class="or-card" ${destino(o)}>
      <span class="or-top">${foto(o, "or-foto")}<span class="or-id"><b class="or-n">${esc(o.visible)}</b><span class="or-g">${gdot(o.g)}${esc(gname(o.g))}</span>${cargo(o) ? `<span class="or-cargo" title="${esc(cargo(o))}">${esc(cargo(o))}</span>` : ""}</span></span>
      <span class="or-stats"><span><b>${o.ivs.length}</b>${o.ivs.length===1?"intervención":"intervenciones"}</span><span><b>${o.avg.toFixed(1).replace(".",",")}</b>intensidad</span></span>
      <span class="or-tonos" title="Tono habitual de sus intervenciones y el reparto de todas">${toneChip(o.dom)}${toneBar(o.ivs)}</span>
      ${o.cita ? `<span class="or-cita">«${esc(o.cita)}»</span>` : ""}
      ${o.temas.length ? `<span class="or-temas">${o.temas.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</span>` : ""}
      <span class="or-pie">${ultima(o)}<span class="or-ir">${o.dip ? "Su ficha" : "Sus intervenciones"}</span></span>
    </button>`;
  // Las tarjetas, de 24 en 24
  const paginas = Math.max(1, Math.ceil(list.length / OR_POR_PAGINA)), pag = Math.min(orFilter.pag, paginas);
  const trozo = list.slice((pag-1)*OR_POR_PAGINA, pag*OR_POR_PAGINA);
  const paginador = () => paginas < 2 ? "" : `<nav class="or-pags" aria-label="Páginas">
      <button type="button" data-pag="${pag-1}" ${pag===1?"disabled":""} aria-label="Página anterior">←</button>
      ${Array.from({length: paginas}, (_, k)=>k+1).filter(n=>n===1||n===paginas||Math.abs(n-pag)<=1).map((n,k,a)=>`${k&&n-a[k-1]>1?'<span class="or-pags-h">…</span>':""}<button type="button" data-pag="${n}" ${n===pag?'aria-current="page"':""}>${n}</button>`).join("")}
      <button type="button" data-pag="${pag+1}" ${pag===paginas?"disabled":""} aria-label="Página siguiente">→</button>
      <span class="or-pags-n">${(pag-1)*OR_POR_PAGINA+1}–${Math.min(pag*OR_POR_PAGINA, list.length)} de ${list.length}</span></nav>`;
  // El directorio: una letra cada vez (por apellido), con el índice de letras arriba
  const letra = o => sinTildes(o.nombre)[0].toUpperCase();
  const letras = [...new Set(list.map(letra))].sort();
  const sel = letras.includes(orFilter.letra) ? orFilter.letra : letras[0];
  const directorio = () => `<nav class="or-letras" aria-label="Índice">${letras.map(l=>`<button type="button" data-letra="${l}" aria-pressed="${l===sel}">${l}<small>${list.filter(o=>letra(o)===l).length}</small></button>`).join("")}</nav>
    <div class="or-dir">${[sel].map(l=>`<section class="or-dir-l" id="or-l-${l}"><h3>${l}</h3><ul>${list.filter(o=>letra(o)===l).map(o=>`<li><button type="button" class="or-fila" ${destino(o)}>${foto(o, "or-mini")}<span class="or-fila-n"><b>${esc(o.visible)}</b><small>${esc(gname(o.g))}${o.rol && o.rol!==gname(o.g) ? ` · ${esc(o.rol)}` : ""}</small></span><span class="or-fila-d"><b>${o.ivs.length}</b> interv.</span><span class="or-fila-i">${intMeter(Math.round(o.avg))}</span></button></li>`).join("")}</ul></section>`).join("")}</div>`;
  $("#oradores").innerHTML = `
    <div class="view-intro"><div><h2>Oradores</h2><p>Quién habló en el Congreso en el periodo: ${todos.length} oradores entre diputados, miembros del Gobierno y comparecientes. Busca por nombre o por tema (por ejemplo «Ceuta» o «vivienda») y pulsa uno para ver su ficha o sus intervenciones.</p></div></div>
    <div class="or-barra">
      <label class="or-busca"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input id="or-q" type="search" placeholder="Buscar orador o tema…" value="${esc(orFilter.q)}" aria-label="Buscar orador o tema"></label>
      ${seg("vista", [["tarjetas","Tarjetas"],["directorio","Directorio A–Z"]])}
      ${orFilter.vista === "tarjetas" ? seg("orden", [["act","Más activos"],["int","Más intensos"],["az","A–Z"]]) : ""}
    </div>
    <div class="controls" id="or-g">${chips}</div>
    <p class="or-n-res">${list.length === todos.length ? `${list.length} oradores` : `${list.length} de ${todos.length} oradores`}</p>
    ${!list.length ? '<p class="nota">Ningún orador coincide con la búsqueda.</p>' : orFilter.vista === "directorio" ? directorio() : `<div class="or-cards">${trozo.map(tarjeta).join("")}</div>${paginador()}`}`;
  const inp = $("#or-q");
  inp.addEventListener("input", e=>{ orFilter.q=e.target.value; orFilter.pag=1; const pos=e.target.selectionStart; renderOradores(); const n=$("#or-q"); n.focus(); n.setSelectionRange(pos,pos); });
  $("#oradores .or-barra").addEventListener("click", e=>{ const b=e.target.closest("[data-vista],[data-orden]"); if(!b) return; if (b.dataset.vista) orFilter.vista=b.dataset.vista; if (b.dataset.orden) orFilter.orden=b.dataset.orden; orFilter.pag=1; renderOradores(); });
  $("#or-g").addEventListener("click", e=>{ const b=e.target.closest("button"); if(!b) return; orFilter.g=b.dataset.g; orFilter.pag=1; orFilter.letra=null; renderOradores(); });
  $("#oradores").querySelector(".or-pags")?.addEventListener("click", e=>{ const b=e.target.closest("[data-pag]"); if (!b || b.disabled) return; orFilter.pag=+b.dataset.pag; renderOradores();
    const c = $("#oradores .or-barra"); window.scrollTo({top: scrollY + c.getBoundingClientRect().top - 150}); });
  $("#oradores").querySelector(".or-letras")?.addEventListener("click", e=>{ const b=e.target.closest("[data-letra]"); if (!b) return; orFilter.letra=b.dataset.letra; renderOradores(); });
}
// El panel de un orador que no es diputado: quién es y todas sus intervenciones del periodo, de la más reciente.
function panelOrador(o){
  if (!o) return;
  let dlg = document.getElementById("or-panel");
  if (!dlg){ dlg = document.createElement("dialog"); dlg.id = "or-panel"; document.body.appendChild(dlg);
    dlg.addEventListener("click", e=>{ if (e.target === dlg || e.target.closest("[data-cerrar]")) dlg.close(); }); }
  const ivs = o.ivs.slice().sort((a,b)=>(DATA.sesiones.find(s=>s.id===b.s)?.fecha||"").localeCompare(DATA.sesiones.find(s=>s.id===a.s)?.fecha||""));
  dlg.innerHTML = `<div class="or-panel-in"><header><span class="or-top"><span class="or-foto avatar" style="background:${G[o.g]?.color||"var(--line-strong)"}">${esc(iniciales(o.nombre))}</span><span class="or-id"><span class="or-g">${gdot(o.g)}${esc(gname(o.g))}${o.rol && o.rol!==gname(o.g) ? ` · ${esc(o.rol)}` : ""}</span><b class="or-n">${esc(o.visible)}</b></span></span>
      <button type="button" class="or-cerrar" data-cerrar aria-label="Cerrar">×</button></header>
    <p class="or-panel-r">${o.ivs.length} ${o.ivs.length===1?"intervención":"intervenciones"} en el periodo · intensidad media ${o.avg.toFixed(1).replace(".",",")} · tono habitual ${toneChip(o.dom)}</p>
    <div class="iv-list">${ivs.map(ivCard).join("")}</div></div>`;
  dlg.showModal();
}

/* ---------- votaciones ---------- */
let vFilter = {res:"todas", g:"PSOE"};
function renderVotaciones(){
  if (iniSel && INICIATIVAS[iniSel]) return renderIniciativa(iniSel);
  let list = DATA.votaciones.slice().sort((a,b)=>b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id, undefined, {numeric:true}));
  if (vFilter.res==="ok") list=list.filter(passed);
  if (vFilter.res==="ko") list=list.filter(v=>!passed(v));
  if (vFilter.res==="ajustadas") list=list.filter(v=>Math.abs(v.si-v.no)<=10);
  const opts = [["todas","Todas"],["ok","Aprobadas"],["ko","Rechazadas"],["ajustadas","Ajustadas (≤10 votos)"]];
  $("#votaciones").innerHTML = `
    <div class="view-intro"><div><h2>Votaciones</h2><p>Resultados oficiales, voto de cada diputado y posición mayoritaria de cada grupo. Pasa el ratón por un escaño para ver quién es; púlsalo para abrir su ficha.</p></div></div>
    ${CON_PLANO?`<div class="chart" id="repro-caja">${reproductor()}</div>`:""}
    <div class="chart"><h3>Quién decide</h3><p class="sub">${decideIntro}</p>${rankingDecide()}</div>
    <div class="controls" id="v-f">${opts.map(([k,l])=>`<button class="chipbtn" data-k="${k}" aria-pressed="${vFilter.res===k}">${l}</button>`).join("")}</div>
    <div class="votes">${listaVotos(list,false)}</div>`;
  $("#v-f").addEventListener("click", e=>{ const b=e.target.closest("button"); if(!b) return; vFilter.res=b.dataset.k; renderVotaciones(); });
  iniciarReproductor();
}

/* ---------- método ---------- */
function renderMetodo(){
  $("#metodo").innerHTML = `<div class="method">
    <h2>Cómo se hace</h2>
    <p>Qué es Escaño Abierto y quién lo hace: <a href="/sobre/">sobre el proyecto</a>.</p>
    <h3>Fuentes</h3>
    <ul>
      <li><b>Diario de Sesiones</b> del Pleno y de las comisiones (PDF oficial), para lo que se dijo.</li>
      <li><b>Datos abiertos de votaciones</b> (un JSON por votación con el voto de cada diputado), para cómo se votó.</li>
      <li><b>Órdenes del día</b> de los plenos convocados (PDF de la agenda semanal), para lo que se va a debatir y votar.</li>
      <li><b>Buscador de iniciativas del Congreso</b>, para las preguntas escritas al Gobierno: autores, fechas de registro y de calificación, si están contestadas y la fecha en que se cerraron.</li>
      <li><b>Declaraciones de actividades e intereses</b> de los diputados (datos abiertos), tal como las presentan.</li>
      <li><b>Datos abiertos de iniciativas</b> (proyectos y proposiciones de ley), para la tramitación de cada ley: autor, fases con sus fechas, situación actual, resultado y ampliaciones del plazo de enmiendas.</li>
      <li><b>Plano del hemiciclo y fichas de diputados</b> de la web del Congreso, para el escaño de cada diputado, su foto oficial y el enlace a su ficha.</li>
      <li><b>Boletín Oficial del Estado</b> (sumarios en datos abiertos y el XML de cada disposición), para el organigrama del Estado: los nombramientos y ceses de altos cargos desde junio de 2018.</li>
    </ul>
    <h3>Organigrama del Estado</h3>
    <ul>
      <li>Cada mañana se lee la sección II.A del BOE (nombramientos, situaciones e incidencias) y se abren las disposiciones que el propio BOE etiqueta con la alerta «Nombramientos y ceses de altos cargos». De cada una se saca el cargo, la persona, la fecha y la disposición.</li>
      <li>Un <b>nombramiento</b> abre un mandato y el <b>cese</b> de esa persona lo cierra. Si alguien pasa a otro cargo sin que se publique su cese, el anterior se da por terminado. Un nuevo nombramiento en el mismo cargo y a la misma persona (un nuevo Gobierno, un nuevo periodo) no abre otro mandato: se anota como renovación.</li>
      <li>Al formarse un Gobierno tras una investidura el BOE no publica el cese de los ministros salientes: sus mandatos se cierran el día en que se nombra al nuevo Gobierno. Tras unas elecciones, el presidente cesa pero sigue <b>en funciones</b>, y así se anota.</li>
      <li>Cuando un ministerio cambia de nombre, a quien se nombró con el nombre antiguo y no tiene cese ni nombramiento nuevo se le coloca en el ministerio de hoy y se marca <b>sin confirmar</b>.</li>
      <li>Los anillos ordenan los cargos por rango (ministro, secretarías de Estado, subsecretaría y secretarías generales, direcciones generales y demás). El BOE no dice de qué secretaría de Estado depende cada dirección general, así que la dependencia interna no se dibuja.</li>
      <li>Un <b>cese sin sustituto publicado</b> puede ser una vacante o un cargo suprimido en una reestructuración.</li>
      <li>La idea y el dibujo radial se inspiran en el <a href="https://graph.civlab.org/us" target="_blank" rel="noopener">US Gov Graph</a> de CivLab, que hace lo mismo con el Gobierno federal de Estados Unidos.</li>
    </ul>
    <h3>Análisis</h3>
    <ul>
      <li>Cada turno de palabra se resume en 2–3 frases y se clasifica en un tono: combativo, crítico, irónico, defensivo, técnico, conciliador o propositivo.</li>
      <li>La <b>intensidad</b> va de 1 (exposición serena) a 5 (confrontación directa, descalificaciones).</li>
      <li>La <b>afinidad de voto</b> se calcula con el voto de cada diputado: es la probabilidad de que dos diputados de dos grupos, tomados al azar, votaran lo mismo. La <b>cohesión</b> es la parte de un grupo que vota con su mayoría.</li>
      <li>Las <b>mayorías</b> agrupan las votaciones por los grupos que estaban en bloque en el lado ganador. Un grupo dividido o abstenido no cuenta en ninguna.</li>
      <li>El <b>termómetro</b> cuenta las anotaciones del Diario (aplausos, risas, rumores, protestas, llamadas al orden) y las asigna al turno de palabra en el que aparecen.</li>
      <li>Sin análisis de IA, el título de cada votación es un <b>resumen automático del texto oficial</b> y conserva las palabras del grupo que presenta la iniciativa; se marca como «título oficial».</li>
      <li>El <b>hemiciclo</b> dibuja a los 350 diputados en su escaño real, según el plano oficial del Congreso, con su voto nominal. Abajo está la Mesa; en la primera fila, el banco azul del Gobierno (los ministros que no son diputados aparecen como huecos: no votan).</li>
      <li>El <b>embudo</b> de las leyes cuenta hasta qué etapa llegó cada iniciativa según las fases de su tramitación oficial: admitida a debate (toma en consideración, o directamente si es un proyecto del Gobierno o viene del Senado), informe de la ponencia en comisión, aprobación en el Congreso, paso por el Senado y publicación como ley.</li>
      <li>El <b>congelador</b> ordena las iniciativas vivas por el número de veces que la Mesa ha ampliado su plazo de enmiendas; cada ampliación suele ser de una semana.</li>
      <li><b>La semana en el Congreso</b> se escribe con reglas fijas, sin IA: el titular es, por este orden, un decreto derogado, una ley que termina su tramitación, una votación decidida por diez votos o menos, o el balance de votaciones.</li>
      <li><b>Por qué votó así cada grupo</b>: el motivo de cada grupo sale del debate de esa misma iniciativa (el mismo día o, si se votó otro, por su número de expediente) y solo se muestra si la postura que expresó en el debate coincide con lo que votó.</li>
      <li><b>Explora</b> junta toda la legislatura. En <b>de qué se habla</b>, la IA unifica las etiquetas de tema que son la misma cosa (plurales, tildes, sinónimos exactos; nunca las cambia por una categoría más general) y un tema se destaca cuando una semana dobla con creces su media de las ocho anteriores. En <b>¿contesta el Gobierno?</b> cada respuesta del control lleva la valoración de la IA (sí, en parte, no) y se asocia a la última intervención de otro grupo en ese asunto; solo salen quienes tienen 20 respuestas o más. En <b>qué propone cada grupo</b>, la IA agrupa las propuestas concretas que piden lo mismo a partir de las 500 más recientes de cada grupo y tema.</li>
      <li><b>¿Quién lo dijo?</b> es un juego con citas comprobadas literalmente en el Diario de Sesiones: el mismo número de cada grupo y del Gobierno (300), de 60 a 220 caracteres y sin las que nombran al propio partido o a su líder. Cada partida tiene 10 frases de 10 personas distintas, con dos como mucho de cada grupo; las opciones de grupo se sortean entre los demás, y las de persona entre quienes tienen citas en ese mismo grupo. El reto de cada día se calcula una vez, con la fecha como semilla, y se guarda: es igual para todos y no cambia aunque a lo largo del día entren frases nuevas; si aún no lo has jugado, la pestaña lleva un punto y en la esquina aparece un botón para jugarlo, que se puede ocultar hasta el día siguiente. Las estadísticas y el aviso se guardan solo en tu navegador.</li>
      <li><b>Lo que se dice de tu provincia</b>: la IA sitúa cada lugar mencionado en su provincia y comunidad. Las cifras cuentan solo las intervenciones cuyo resumen trata del lugar; las que lo citan de pasada se listan aparte.</li>
      <li>Los <b>temas para seguir</b> (vivienda, sanidad, pensiones…) se asignan con una lista fija de palabras clave sobre el texto oficial, igual para votaciones, leyes, orden del día y preguntas. Un asunto puede tener varios temas o ninguno.</li>
      <li><b>«¿Qué significa?»</b> es una frase fija según el tipo de votación y su resultado; no depende de quién presenta la iniciativa.</li>
      <li>Una <b>pregunta escrita</b> cuenta como «sin contestar tras más de 60 días» si sigue abierta 60 días después de su calificación por la Mesa. El plazo legal es de 20 días desde la publicación, prorrogables otros 20; el margen cubre el tiempo hasta que se publica. El tiempo de respuesta va de la calificación al cierre de la pregunta.</li>
      <li>Quien ha dejado el escaño sigue apareciendo en las votaciones de su tiempo, en el asiento que ocupaba; en cada votación se usa el grupo desde el que votó.</li>
      <li>En la portada, la <b>votación destacada</b> es la de menor diferencia entre síes y noes del último pleno, y el <b>cara a cara</b> es la primera pregunta de control de la última sesión analizada. Se eligen con una regla fija, no a mano.</li>
    </ul>
    <h3>Garantías</h3>
    <ul>
      <li>Las citas solo se publican si aparecen literalmente en el Diario de Sesiones; si el modelo parafrasea, se descartan.</li>
      <li>Los recuentos de votos salen del voto nominal de cada diputado. «Dividido» indica un grupo donde ningún sentido llega al 80 %.</li>
      <li>Aplausos, rumores y protestas son las anotaciones que hace el propio Diario.</li>
      <li>Tono, intensidad, resúmenes y «¿contesta?» los genera un modelo de lenguaje con los mismos criterios para todos los grupos. Son orientativos: cada sesión enlaza al texto oficial.</li>
      <li>El Congreso tarda varios días en publicar cada Diario; mientras tanto se muestran solo las votaciones.</li>
    </ul>
  </div>`;
}

/* ---------- organigrama del Estado ---------- */
// Quién ocupa cada alto cargo, desde cuándo y con qué disposición del BOE (python -m escano estado). El organigrama
// entero se carga al abrir la pestaña; el índice ligero (quién tiene hoy cada cargo, los diputados con cargos y los
// últimos cambios) lo usan el buscador, la portada y las fichas.
let ORG = null, orgPromesa = null, ORG_IDX = null, orgIdxPromesa = null, orgSel = null;
function cargarOrg(){
  if (ORG) return Promise.resolve(ORG);
  return orgPromesa ||= fetch("datos/organigrama.json").then(r=>r.ok?r.json():null).catch(()=>null).then(j=>ORG=j);
}
function cargarOrgIdx(){
  if (ORG_IDX) return Promise.resolve(ORG_IDX);
  return orgIdxPromesa ||= fetch("datos/organigrama-indice.json").then(r=>r.ok?r.json():null).catch(()=>null).then(j=>{ INDICE_BUSCAR = null; return ORG_IDX=j; });
}
const urlBoe = id => `https://www.boe.es/diario_boe/txt.php?id=${encodeURIComponent(id)}`;
const enlaceBoe = (id, disp) => id ? `<a href="${urlBoe(id)}" target="_blank" rel="noopener">${esc(disp||id)} ↗</a>` : "";
const fechaOrg = iso => iso ? fechaCorta(iso) : "antes de jun. 2018";
function ministerioCorto(nombre){
  if (!nombre.startsWith("Ministerio")) return nombre;
  let s = nombre.replace(/^Ministerio (de la |del |de |para la |para el |para )/, "").split(",")[0].split(" y ")[0];
  if (s==="Presidencia") s = "Presidencia y Justicia";
  return s.charAt(0).toUpperCase()+s.slice(1);
}
const panelEnVista = () => { const p=document.getElementById("org-panel"); if (!p) return; const b=p.getBoundingClientRect();
  if (b.top < 60 || b.top > innerHeight*.5){ p.scrollIntoView({block:"start"}); window.scrollBy(0,-70); } };
function irCargo(id){
  if (!id) return;
  orgSel = id; tip.hidden = true;
  const res = document.getElementById("org-res"); if (res) res.hidden = true;
  fijarRuta("cargo-"+id, true);
  if ($("#organigrama").hidden || !ORG || !document.getElementById("org-panel")){ rendered.organigrama=false; show("organigrama", false); window.scrollTo(0,0); return; }
  pintarPanelOrg(); Org.resaltar(); panelEnVista();
}

/* ---------- elecciones del 29N (site/elecciones.js, se carga al abrir la pestaña) ---------- */
let elSub = null, elUltimo = null;
function renderElecciones(){
  const ctxEl = {G, DIPS, PLANO, ORDEN_HEMI, esc, fmt, slug, legible, fechaCorta, autorNombre, irDiputado, glosa};
  const sub = elUltimo = elSub; elSub = null;
  import("./elecciones.js").then(m=>m.render($("#elecciones"), ctxEl, sub))
    .catch(()=>{ $("#elecciones").innerHTML = `<p class="nota">No se ha podido cargar la sección de elecciones.</p>`; });
}
/* ---------- geografía (site/geografia.js, autocontenida: se carga al abrir la pestaña) ---------- */
let geoSub = null, geoUltimo = null;
function renderGeografia(){
  const ctxGeo = {G, DIPS, ORDEN_HEMI, esc, fmt, slug, legible};
  const sub = geoUltimo = geoSub; geoSub = null;
  import("./geografia.js").then(m=>m.render($("#geografia"), ctxGeo, sub))
    .catch(err=>{ console.error(err); $("#geografia").innerHTML = `<p class="nota">No se ha podido cargar la sección de geografía.</p>`; });
}
async function renderOrganigrama(){
  const el = $("#organigrama");
  if (!ORG){ el.innerHTML = `<p class="nota">Cargando el organigrama…</p>`; await cargarOrg(); }
  if (!ORG){ el.innerHTML = `<p class="nota">Aún no hay datos. Ejecuta <code>python -m escano estado --desde 2018-06-01</code> y vuelve a construir la web.</p>`; return; }
  if (orgSel && !ORG.cargos[orgSel]) orgSel = null;
  const c = ORG.cifras, M = ORG.por_mes, maxM = Math.max(...M.map(([,n,x])=>n+x));
  el.innerHTML = `<div class="view-intro"><div><div class="eyebrow">El Estado · BOE</div><h2>El organigrama del Estado</h2>
      <p>Quién ocupa cada alto cargo, desde cuándo y con qué disposición del BOE. En el centro, el presidente del Gobierno, al que inviste el Congreso; alrededor, cada ministerio con sus secretarías de Estado, subsecretarías y direcciones generales. Se actualiza con el BOE de cada mañana.</p>
      <p class="nota">Inspirado en el <a href="https://graph.civlab.org/us" target="_blank" rel="noopener">US Gov Graph</a> de CivLab, el mapa de cargos y personas del Gobierno federal de Estados Unidos.</p></div></div>
    <div class="kpis">${[[fmt(c.cargos_ocupados),"altos cargos con titular"],[c.ministerios,"ministerios"],[c.cambios_30,"nombramientos y ceses en 30 días"],[c.sin_sustituto_90,"ceses sin sustituto publicado (90 días)"]].map(([n,l])=>`<div class="kpi"><b>${n}</b><span>${l}</span></div>`).join("")}</div>
    <div class="org-grid">
      <div class="org-graf">
        <div class="controls org-busca"><input id="org-q" type="search" placeholder="Busca un cargo o una persona" autocomplete="off" aria-label="Buscar un cargo o una persona en el organigrama"><div id="org-res" hidden></div></div>
        <svg id="org-svg" viewBox="-140 -140 1280 1280" role="img" aria-label="Organigrama radial del Estado: ${c.cargos_ocupados} altos cargos agrupados por ministerio"></svg>
        <div class="legend org-ley"><span><i class="org-i"></i>Alto cargo con titular</span><span><i class="org-i nuevo"></i>Nombrado en los últimos 90 días</span><span><i class="org-i tenue"></i>Sin confirmar tras una reestructuración</span><span><i class="org-i hueco"></i>Cesado sin sustituto publicado</span></div>
        <p class="nota">De dentro afuera: ministro · secretarías de Estado · subsecretaría y secretarías generales · direcciones generales, gabinetes y organismos. Abajo, órganos del Estado, delegaciones del Gobierno, presidencias autonómicas y embajadas.</p>
      </div>
      <aside class="org-panel" id="org-panel" aria-live="polite"></aside>
    </div>
    <section class="sec"><div class="sec-h"><h2>Mes a mes</h2><p>Nombramientos y ceses de altos cargos que publica el BOE cada mes. Los picos son los cambios de Gobierno.</p></div>
      <div class="chart"><div class="pq-meses org-meses">${M.map(([m,n,x])=>`<span class="pq-m" data-tip="${esc(`<b>${nombreMes(m)}</b><br>${fmt(n)} nombramientos · ${fmt(x)} ceses`)}"><i style="height:${(n+x)/maxM*100}%"><b style="height:${n+x?x/(n+x)*100:0}%"></b></i></span>`).join("")}</div>
      <div class="pq-eje"><span>${nombreMes(M[0][0])}</span><span>${nombreMes(M.at(-1)[0])}</span></div>
      <div class="key"><span><i style="background:var(--org)"></i>nombramientos</span><span><i style="background:color-mix(in srgb,var(--ink) 35%,var(--surface))"></i>ceses</span></div></div></section>
    ${ORG.sin_sustituto.length?`<section class="sec"><div class="sec-h"><h2>Cesados sin sustituto publicado</h2><p>Altos cargos cuyo cese ha salido en el BOE en los últimos 90 días sin que se haya publicado quién los sustituye. Puede ser una vacante o un cargo que se suprime en una reestructuración: el BOE publica el cese, no siempre la supresión.</p></div>
      <ul class="preg-list">${ORG.sin_sustituto.map(v=>`<li><span class="pq-f">${fechaCorta(v.desde)}</span><span class="pq-t"><button class="linklike" style="text-align:left;font-weight:400" data-cargo="${esc(v.id)}">${esc(v.cargo)}</button><small>Cesó ${esc(v.persona)}</small></span>${enlaceBoe(v.boe, "BOE")}</li>`).join("")}</ul></section>`:""}
    <section class="sec" id="org-todos"><div class="sec-h"><h2>Todos los altos cargos</h2><p>Por ministerio, con quién lo ocupa y desde cuándo.</p></div><div>${listaOrg()}</div></section>
    <p class="nota">Fuente: sumarios del BOE en datos abiertos. De la sección II.A (nombramientos, situaciones e incidencias) se leen las disposiciones que el propio BOE etiqueta como «Nombramientos y ceses de altos cargos», desde el ${fechaCorta(ORG.desde_serie)}: ${fmt(c.disposiciones)} disposiciones${c.sin_leer?`, ${c.sin_leer} de ellas sin interpretar`:""}. Datos hasta el BOE del ${fechaCorta(ORG.actualizado)}. Cada dato enlaza a su disposición, que es la que vale. <button class="linklike" data-go="metodo">Cómo se hace</button></p>`;
  Org.dibujar(document.getElementById("org-svg"));
  pintarPanelOrg(); Org.resaltar();
  buscadorOrg();
  if (orgSel && !matchMedia("(min-width:1100px)").matches) setTimeout(panelEnVista, 0);
}

function listaOrg(){
  return ORG.ramas.map(r=>`<details class="org-rama" data-rama="${esc(r.nombre)}"><summary><b>${esc(r.nombre)}</b><span>${r.ministro?esc(r.ministro)+" · ":""}${r.cargos.length} ${r.cargos.length===1?"cargo":"cargos"}</span></summary>
    ${r.grupo==="antiguos"?`<p class="nota" style="margin-bottom:8px">Nombrados en un ministerio que después cambió de nombre, sin cese publicado y sin sucesor claro.</p>`:""}
    <div class="dtable-wrap"><table class="dt"><thead><tr><th>Cargo</th><th>Titular</th><th>Desde</th></tr></thead><tbody>${r.cargos.map(x=>`<tr data-cargo="${esc(x.id)}"><td>${esc(x.cargo)}${x.antiguo?` <span class="org-sc">· sin confirmar</span>`:""}</td><td>${esc(x.persona)}</td><td class="num" style="white-space:nowrap">${fechaOrg(x.desde)}</td></tr>`).join("")}</tbody></table></div></details>`).join("");
}

function pintarPanelOrg(){
  const p = document.getElementById("org-panel"); if (!p) return;
  p.innerHTML = orgSel && ORG.cargos[orgSel] ? fichaCargo(orgSel) : ultimosCambiosOrg(14);
  p.scrollTop = 0;
}
function ultimosCambiosOrg(n){
  let h = `<div class="eyebrow">Últimos cambios en el BOE</div>`, dia = "";
  for (const e of ORG.cambios.slice(0, n)){
    if (e.fecha !== dia){ dia = e.fecha; h += `<div class="org-dia">${fechaCorta(dia)}</div>`; }
    h += `<div class="org-cambio"><span class="pill ${e.tipo==="cese"?"org-cese":"org-nom"}">${e.tipo==="cese"?"Cese":"Nombra"}</span><div><button class="linklike org-t" data-cargo="${esc(e.cargo_id)}"><b>${esc(e.persona)}</b><span>${esc(e.cargo)}</span></button><small>${enlaceBoe(e.boe, e.disposicion)}${e.motivo?` · ${esc(e.motivo)}`:""}</small></div></div>`;
  }
  if (ORG.cambios.length > n) h += `<button class="linklike org-mas" data-org-mas="${n+30}">Ver más cambios</button>`;
  return h;
}
function fichaCargo(id){
  const c = ORG.cargos[id], abiertos = c.mandatos.filter(m=>!m.hasta), ult = c.mandatos[0];
  const visible = abiertos[0]?.cargo || ult?.cargo || c.cargo;
  let h = `<button class="back" data-org-volver>← Últimos cambios</button><div class="eyebrow">${esc(c.ministerio||"")}</div><h3 class="org-h">${esc(visible)}</h3>`;
  if (abiertos.length) h += abiertos.map(m=>`<div class="org-titular"><div class="eyebrow">Titular</div><div class="org-nombre">${esc(m.persona)}</div>
      <div class="org-desde">${m.desde?`Desde el ${fechaCorta(m.desde)}`:"Desde antes de junio de 2018"}${m.boe?` · ${enlaceBoe(m.boe, m.disposicion)}`:""}</div>
      ${c.antiguo?`<p class="nota" style="margin-top:8px">Sin confirmar: se le nombró en el antiguo ${esc(c.antiguo)} y, desde que el ministerio cambió, el BOE no ha publicado ni su cese ni un nombramiento nuevo. Lo más probable es que siga, quizá con el cargo renombrado.</p>`:""}
      ${m.diputado?`<button class="chipbtn" data-dip="${esc(m.diputado)}" style="margin-top:10px">Su ficha de diputado →</button>`:""}</div>`).join("");
  else h += `<div class="org-titular vacio"><div class="eyebrow">Sin titular publicado</div><div class="org-desde">Desde el cese de ${esc(ult.persona)} el ${fechaCorta(ult.hasta)} · ${enlaceBoe(ult.boe_cese, ult.disposicion_cese)}</div></div>`;
  if (c.mandatos.length > 1 || c.mandatos.some(m=>m.renovaciones || m.en_funciones)){
    h += `<span class="eyebrow org-sub">Quién lo ha ocupado</span><ol class="org-hist">${c.mandatos.map(m=>{
      const lineas = [m.boe?`Nombramiento: ${enlaceBoe(m.boe, m.disposicion)}`:"",
        ...(m.en_funciones||[]).map(r=>`En funciones desde el ${fechaCorta(r.fecha)}: ${enlaceBoe(r.boe, r.disposicion)}`),
        ...(m.renovaciones||[]).map(r=>`Nombrado de nuevo el ${fechaCorta(r.fecha)}: ${enlaceBoe(r.boe, r.disposicion)}`),
        m.boe_cese?`Cese: ${enlaceBoe(m.boe_cese, m.disposicion_cese)}`:""].filter(Boolean);
      return `<li class="${m.hasta?"":"actual"}"><b>${esc(m.persona)}${m.diputado?` · <button class="linklike" data-dip="${esc(m.diputado)}">diputado</button>`:""}</b>
        <span>${fechaOrg(m.desde)} – ${m.hasta?fechaCorta(m.hasta):"hoy"}${m.motivo?` · ${esc(m.motivo)}`:""}</span><small>${lineas.join("<br>")}</small></li>`; }).join("")}</ol>`;
  }
  const rama = ORG.ramas.find(r=>r.cargos.some(x=>x.id===id)), yo = rama?.cargos.find(x=>x.id===id);
  if (rama && rama.cargos.length > 1 && (yo.rango <= 1 || rama.grupo !== "gobierno"))
    h += `<span class="eyebrow org-sub">${rama.grupo==="gobierno"?"Altos cargos del ministerio":esc(rama.nombre)} · ${rama.cargos.length}</span><ul class="org-sublista">${rama.cargos.filter(x=>x.id!==id).map(x=>`<li><button class="linklike" data-cargo="${esc(x.id)}">${esc(x.cargo)}</button><span>${esc(x.persona)}</span></li>`).join("")}</ul>`;
  return h;
}

function buscadorOrg(){
  const q = document.getElementById("org-q"), caja = document.getElementById("org-res");
  if (!q) return;
  q.addEventListener("input", ()=>{
    const t = sinTildes(q.value.trim());
    if (t.length < 2){ caja.hidden = true; return; }
    const res = [];
    for (const [id, c] of Object.entries(ORG.cargos)) for (const m of c.mandatos){
      const cargo = m.cargo || c.cargo;
      if (sinTildes(m.persona).includes(t) || sinTildes(cargo).includes(t)) res.push({id, persona:m.persona, cargo, actual:!m.hasta, hasta:m.hasta});
    }
    res.sort((a,b)=>(b.actual-a.actual) || (b.hasta||"").localeCompare(a.hasta||""));
    caja.innerHTML = res.slice(0,12).map(r=>`<button type="button" data-cargo="${esc(r.id)}">${esc(r.persona)}<small>${esc(r.cargo)}${r.actual?"":` · hasta el ${fechaCorta(r.hasta)}`}</small></button>`).join("")
      || `<p class="nota">Nada coincide con «${esc(q.value)}».</p>`;
    caja.hidden = false;
  });
  q.addEventListener("keydown", e=>{ if (e.key==="Escape") caja.hidden = true; });
  q.addEventListener("blur", ()=>setTimeout(()=>{ caja.hidden = true; }, 200));
}

// El dibujo radial: el presidente en el centro, un sector por ministerio y un anillo por rango.
const Org = (()=>{
  const NS = "http://www.w3.org/2000/svg", CX = 500, CY = 500;
  const R = {hub:62, min:112, se:162, sg:210, dg:256};
  const TAM = r => [13, 6.5, 5, 4.2, 3.4, 3][Math.min(r, 5)];
  const polar = (a, r) => [CX + r*Math.cos(a), CY + r*Math.sin(a)];
  let SECT = [], lineas = null, hoy90 = "";
  function nodo(tag, attrs, padre){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); padre?.appendChild(e); return e; }
  function arco(a0, a1, r0, r1){
    const [x0,y0]=polar(a0,r1), [x1,y1]=polar(a1,r1), [x2,y2]=polar(a1,r0), [x3,y3]=polar(a0,r0), g = a1-a0 > Math.PI ? 1 : 0;
    return `M${x0},${y0} A${r1},${r1} 0 ${g} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${g} 0 ${x3},${y3} Z`;
  }
  const rangoDe = c => /^(Vicepresident[ea] (Primer[oa] |Segund[oa] |Tercer[oa] |Cuart[oa] )?del Gobierno|Ministr)/.test(c) ? 1
    : /^Secretari[oa] de Estado/.test(c) ? 2 : /^(Subsecretari|Secretari[oa] General)/.test(c) ? 3 : 4;
  function sectores(){
    const nombres = {organismos:"Órganos y organismos", territorio:"Delegaciones del Gobierno", comunidades:"Presidencias autonómicas", exterior:"Embajadas"};
    const lista = [];
    for (const r of ORG.ramas){
      if (r.grupo === "antiguos") continue;
      if (r.grupo === "gobierno"){ lista.push({nombre:r.nombre, grupo:r.grupo, ramas:[r.nombre], cargos:r.cargos.map(x=>({...x}))}); continue; }
      let s = lista.find(x=>x.grupo===r.grupo);
      if (!s) lista.push(s = {nombre:nombres[r.grupo]||r.nombre, grupo:r.grupo, ramas:[], cargos:[]});
      s.cargos.push(...r.cargos.map(x=>({...x}))); s.ramas.push(r.nombre);
    }
    for (const v of ORG.sin_sustituto){  // un hueco en su ministerio
      const s = lista.find(x=>x.nombre===ORG.cargos[v.id]?.ministerio);
      if (s) s.cargos.push({id:v.id, cargo:v.cargo, persona:null, hueco:true, rango:rangoDe(v.cargo), desde:v.desde});
    }
    return lista;
  }
  function dibujar(svg){
    svg.innerHTML = "";
    const d = new Date(ORG.actualizado+"T12:00:00"); d.setDate(d.getDate()-90); hoy90 = d.toISOString().slice(0,10);
    SECT = sectores();
    const peso = s => Math.max(4, s.cargos.length) ** (s.grupo==="gobierno" ? .72 : .6);
    const hueco = .012, huecoGrupo = .05;
    const salto = i => i && SECT[i-1].grupo !== SECT[i].grupo ? huecoGrupo : hueco;
    let saltos = SECT.reduce((a,_,i)=>a+salto(i), 0) + (SECT.at(-1).grupo !== SECT[0].grupo ? huecoGrupo : hueco);
    const total = SECT.reduce((a,s)=>a+peso(s), 0), util = 2*Math.PI - saltos;
    // El Gobierno arriba y centrado, en el sentido de las agujas del reloj por orden de precedencia; abajo, el resto.
    const gob = SECT.filter(s=>s.grupo==="gobierno");
    let a = -Math.PI/2 - (gob.reduce((x,s)=>x+peso(s), 0)/total*util + hueco*(gob.length-1))/2;
    SECT.forEach((s,i)=>{ if (i) a += salto(i); s.a0 = a; s.a1 = a + peso(s)/total*util; a = s.a1; });
    let exterior = 0;
    for (const s of SECT){
      const bandas = s.grupo==="gobierno"
        ? [[c=>c.rango===1, R.min, 18], [c=>c.rango===2, R.se, 15], [c=>c.rango===3, R.sg, 12.5], [c=>c.rango>=4, R.dg, 10.5]]
        : [[()=>true, R.sg+6, s.grupo==="exterior" ? 8.6 : 10.5]];
      let r = 0;
      for (const [f, r0, paso] of bandas){
        const ns = s.cargos.filter(f).filter(c=>c.rango>0);
        r = Math.max(r0, r);
        let i = 0;
        while (i < ns.length){
          const ancho = (s.a1-s.a0)*r, caben = Math.max(1, Math.floor((ancho - paso*.6)/paso)), fila = ns.slice(i, i+caben);
          fila.forEach((c,j)=>{ c.a = s.a0 + (s.a1-s.a0)*(fila.length===caben ? (j+.5)/fila.length : .5 + (j-(fila.length-1)/2)*paso/ancho); c.r = r; });
          i += fila.length;
          if (i < ns.length) r += paso*.95;
        }
        if (ns.length) r += paso*1.2;
      }
      exterior = Math.max(exterior, r);
    }
    const RO = Math.min(exterior + 4, 400);
    const guias = nodo("g", {}, svg);
    for (const r of [R.min, R.se, R.sg]) nodo("circle", {cx:CX, cy:CY, r, fill:"none", stroke:"var(--line)", "stroke-dasharray":"2 4"}, guias);
    const capaS = nodo("g", {}, svg), capaL = nodo("g", {}, svg);
    lineas = nodo("g", {}, svg);
    const capaN = nodo("g", {}, svg);
    let par = 0;
    for (const s of SECT){
      const g = s.grupo === "gobierno", am = (s.a0+s.a1)/2;
      const fondo = g ? `color-mix(in oklab,var(--org) ${par%2?14:9}%,var(--surface))` : `color-mix(in oklab,var(--ink) ${par%2?8:5}%,var(--surface))`;
      par++;
      s.fondo = nodo("path", {d:arco(s.a0, s.a1, g ? R.hub+20 : R.sg-50, RO), fill:fondo, class:"org-sec", "data-org-rama":s.nombre}, capaS);
      const [x, y] = polar(am, RO+10), grados = am*180/Math.PI, izq = Math.cos(am) < 0;
      s.etq = nodo("text", {x, y, class:"org-etq", "dominant-baseline":"middle", "text-anchor":izq?"end":"start", "data-org-rama":s.nombre,
        transform:`rotate(${izq ? grados+180 : grados} ${x} ${y})`, ...(g ? {} : {"font-weight":600})}, capaL);
      s.etq.textContent = g ? ministerioCorto(s.nombre) : s.nombre;
      for (const c of s.cargos){
        if (c.a === undefined) continue;
        const [nx, ny] = polar(c.a, c.r), tam = TAM(c.rango), nuevo = !c.hueco && c.desde && c.desde >= hoy90;
        const tipTxt = c.hueco ? `<b>${esc(c.cargo)}</b><br>Sin titular publicado desde el ${fechaCorta(c.desde)}`
          : `<b>${esc(c.persona)}</b><br>${esc(c.cargo)}<br>Desde el ${fechaOrg(c.desde)}${c.antiguo?" · sin confirmar":""}`;
        const gN = nodo("g", {class:"org-n", "data-cargo":c.id, "data-tip":tipTxt, tabindex:0, role:"button",
          "aria-label":`${c.cargo}${c.persona ? ": "+c.persona : ", sin titular publicado"}`}, capaN);
        nodo("circle", {cx:nx, cy:ny, r:tam+3.5, fill:"transparent"}, gN);  // zona de toque mayor que el punto
        c.p = nodo("circle", {cx:nx, cy:ny, r:tam, class:"p", fill:c.hueco ? "var(--surface)" : nuevo ? "var(--org-nuevo)" : "var(--org)",
          stroke:c.hueco ? "var(--muted)" : "var(--surface)", "stroke-width":c.hueco ? 1.3 : 1,
          ...(c.hueco ? {"stroke-dasharray":"2 1.5"} : {}), ...(c.antiguo ? {"fill-opacity":.38} : {})}, gN);
        c.x = nx; c.y = ny; c.sector = s;
      }
    }
    // Centro: el presidente del Gobierno.
    const pres = ORG.ramas.flatMap(r=>r.cargos).find(c=>c.rango===0);
    const hub = nodo("g", {class:"org-n", tabindex:0, role:"button", ...(pres ? {"data-cargo":pres.id, "aria-label":`Presidente del Gobierno: ${pres.persona}`} : {})}, capaN);
    const disco = nodo("circle", {cx:CX, cy:CY, r:R.hub, fill:"var(--surface)", stroke:"var(--line-strong)", class:"p"}, hub);
    const partes = (pres?.persona||"").split(" ");
    const t = (y, txt, estilo) => { const e = nodo("text", {x:CX, y, "text-anchor":"middle", style:estilo}, hub); e.textContent = txt; };
    t(CY-16, "PRESIDENTE", "font-size:10px;letter-spacing:.12em;font-weight:600");
    t(CY+4, partes[0]||"", "font-family:var(--display);font-size:17px;font-weight:600;fill:var(--ink)");
    t(CY+23, partes[1]||"", "font-family:var(--display);font-size:17px;font-weight:600;fill:var(--ink)");
    const sp = SECT.find(s=>s.nombre==="Presidencia del Gobierno"), pc = pres && sp?.cargos.find(c=>c.id===pres.id);
    if (pc) Object.assign(pc, {x:CX, y:CY, sector:sp, p:disco, hub:true});
    // El dibujo se ciñe a lo que ocupa: el círculo y sus etiquetas (en el móvil, sin ellas, que se ocultan).
    const b = svg.getBBox();
    if (b.width) svg.setAttribute("viewBox", `${b.x-8} ${b.y-8} ${b.width+16} ${b.height+16}`);
    svg.addEventListener("keydown", e=>{ const n = e.target.closest("[data-cargo]"); if (n && (e.key==="Enter" || e.key===" ")){ e.preventDefault(); irCargo(n.dataset.cargo); } });
  }
  function resaltar(){
    if (!lineas || !SECT.length) return;
    lineas.innerHTML = "";
    for (const s of SECT) for (const c of s.cargos) if (c.p){ c.p.setAttribute("stroke", c.hub ? "var(--line-strong)" : c.hueco ? "var(--muted)" : "var(--surface)"); c.p.setAttribute("stroke-width", c.hueco ? 1.3 : 1); }
    const sel = SECT.flatMap(s=>s.cargos).filter(c=>c.id===orgSel && c.x !== undefined);
    const sector = sel[0]?.sector;
    for (const s of SECT){
      const fuera = !!sector && s !== sector;
      s.fondo.classList.toggle("apagado", fuera); s.etq.classList.toggle("activa", s === sector);
      for (const c of s.cargos) c.p?.parentNode.classList.toggle("apagado", fuera);
    }
    for (const c of sel){
      // Del presidente al ministro y del ministro al cargo: pertenece a ese ministerio (no es su dependencia interna).
      const ministro = c.sector.cargos.find(x=>x.rango===1 && /^Ministr/.test(x.cargo));
      const cadena = [[CX, CY]];
      if (ministro && ministro !== c && ministro.x !== undefined) cadena.push([ministro.x, ministro.y]);
      if (c.x !== CX || c.y !== CY) cadena.push([c.x, c.y]);
      for (let i = 1; i < cadena.length; i++){
        const [x0,y0] = cadena[i-1], [x1,y1] = cadena[i];
        nodo("path", {d:`M${x0},${y0} Q${(x0+x1)/2+(y1-y0)*.12},${(y0+y1)/2-(x1-x0)*.12} ${x1},${y1}`, fill:"none", stroke:"var(--ink)", "stroke-width":1.6, "stroke-opacity":.55}, lineas);
      }
      c.p?.setAttribute("stroke", "var(--ink)"); c.p?.setAttribute("stroke-width", 2.4);
    }
  }
  function enfocar(nombre){
    const s = SECT.find(x=>x.nombre===nombre); if (!s) return;
    if (s.grupo === "gobierno"){ const m = s.cargos.find(c=>c.rango===1 && /^Ministr/.test(c.cargo)) || s.cargos.find(c=>!c.hueco); if (m) irCargo(m.id); return; }
    const d = [...document.querySelectorAll("#org-todos details")].find(x=>s.ramas.includes(x.dataset.rama));
    if (d){ d.open = true; d.scrollIntoView({block:"start"}); window.scrollBy(0,-70); }
  }
  return {dibujar, resaltar, enfocar};
})();

/* ---------- el organigrama en la portada y en las fichas ---------- */
function tarjetaBoe(){
  const u = ORG_IDX?.ultimos; if (!u?.length) return "";
  return `<div class="sec-h"><h2>En el BOE</h2><button class="linklike" data-go="organigrama">Ver el organigrama del Estado</button></div>
    <ul class="preg-list">${u.slice(0,5).map(e=>`<li><span class="pq-f">${fechaCorta(e.fecha)}<small>${e.tipo==="cese"?"Cese":"Nombramiento"}</small></span><span class="pq-t"><button class="linklike" style="text-align:left" data-cargo="${esc(e.cargo_id)}">${esc(e.persona)}</button><small>${esc(e.cargo)}</small></span>${enlaceBoe(e.boe, "BOE")}</li>`).join("")}</ul>`;
}
async function pintarCargosFicha(d){
  const cont = document.getElementById("ficha-cargos"); if (!cont) return;
  const lista = (await cargarOrgIdx())?.diputados?.[d.slug];
  if (!lista?.length || dipSel !== d.slug){ cont.remove(); return; }
  lista.sort((a,b)=>(!!a[3]-!!b[3]) || (b[2]||"").localeCompare(a[2]||""));
  cont.innerHTML = `<div class="sec-h"><h2>Sus cargos en el Estado</h2><p>Nombramientos publicados en el BOE desde junio de 2018. <button class="linklike" data-go="organigrama">El organigrama del Estado</button></p></div>
    <ul class="preg-list">${lista.map(([id,cargo,desde,hasta])=>`<li><span class="pq-f">${desde?fechaCorta(desde):"antes de 2018"}<small>${hasta?"hasta el "+fechaCorta(hasta):"sigue hoy"}</small></span><span class="pq-t"><button class="linklike" style="text-align:left;font-weight:400" data-cargo="${esc(id)}">${esc(cargo)}</button></span></li>`).join("")}</ul>`;
}

/* ---------- buscador global ---------- */
// Un índice en memoria con lo que ya ha cargado la web: diputados, votaciones, iniciativas, sesiones,
// temas e intervenciones. Sin servidor. Ignora tildes y mayúsculas y tolera una errata por palabra larga.
let INDICE_BUSCAR = null;
const TIPOS_BUSCAR = [["d","Diputados"],["c","Cargos del Estado"],["p","Tus diputados"],["tf","Temas para seguir"],["g","Glosario"],["l","Leyes"],["v","Votaciones"],["i","Iniciativas"],["w","Semanas"],["s","Sesiones"],["t","Temas"],["iv","Intervenciones"]];
function indiceBuscar(){
  if (INDICE_BUSCAR) return INDICE_BUSCAR;
  const e = [];
  const poner = (tipo, titulo, sub, extra, ir) => e.push({tipo, titulo, sub, ir, texto: sinTildes(`${titulo} ${sub} ${extra||""}`), tnorm: sinTildes(titulo)});
  DIP.forEach(d=>poner("d", legible(d.n), `${G[d.g]?.nombre||d.g} · ${d.circ}`, `${d.n} ${d.form} ${d.g}`, {hash:"diputado-"+d.slug, foto:d}));
  DATA.votaciones.forEach(v=>{ const dd=dt(v.fecha); poner("v", v.titulo, `${dd.d} ${dd.m} · ${resLabel(v)} ${v.si}–${v.no}`, `${v.exp||""} ${v.tipo} ${v.texto||""}`, {hash:"votacion-"+v.id}); });
  Object.values(INICIATIVAS).forEach(x=>{ const t = x.votos[0] ? baseTitulo(x.votos[0].titulo) : x.debates[0]?.p.titulo || x.exp; poner("i", t, `${TIPO_EXP[x.exp.slice(0,3)]||"Iniciativa"} · ${x.exp}`, x.exp, {hash:"iniciativa-"+slugExp(x.exp)}); });
  DATA.sesiones.forEach(s=>{ const dd=dt(s.fecha); poner("s", `${s.organo}, ${dd.d} ${dd.m}`, s.titular || (s.resumen||"").slice(0,120) || s.sesion, `${s.resumen||""} ${(s.puntos||[]).map(p=>p.titulo).join(" ")}`, {hash:"sesion-"+s.id}); });
  (LEYES?.iniciativas||[]).forEach(l=>poner("l", tituloLey(l), `${l.tipo} · ${l.exp} · ${ESTADO_LEY[l.estado]?.[0]||l.estado}`, `${l.exp} ${l.comision} ${l.autores.map(autorNombre).join(" ")}`, {hash:"iniciativa-"+slugExp(l.exp)}));
  (ORG_IDX?.actuales||[]).forEach(([id,persona,cargo,rama])=>poner("c", persona, cargo, rama, {hash:"cargo-"+id}));
  CIRCS().forEach(c=>poner("p", `Diputados de ${c}`, `${DIP.filter(d=>d.circ===c && !d.baja).length} diputados`, c, {hash:"provincia-"+slug(c)}));
  Object.entries(TEMAS_IDX||{}).forEach(([k,t])=>poner("tf", t.nombre, `Seguir el tema · ${t.votos.length} votaciones`, k, {hash:"tema-"+k}));
  Object.entries(GLOSARIO).forEach(([k,[t,def]])=>poner("g", t, def.slice(0,110)+"…", def, {gl:k}));
  (SEMANAS||[]).forEach(w=>poner("w", w.titular, `Semana del ${rangoSemana(w)}`, "", {hash:"semana-"+w.id}));
  TEMAS.forEach(t=>poner("t", t.label, `${t.n} intervenciones`, "", {tema:t.k}));
  IVS.forEach(i=>poner("iv", `${i.orador}: ${(i.frase||i.resumen||"").slice(0,90)}${(i.frase||i.resumen||"").length>90?"…":""}`, `${gname(i.g)} · ${(DATA.sesiones.find(s=>s.id===i.s)||{}).organo||""}`, `${i.cita||""} ${i.temas.join(" ")} ${i.item}`, {hash:"sesion-"+i.s}));
  return INDICE_BUSCAR = e;
}
function casiIgual(a, b){ // distancia de edición ≤ 1
  if (Math.abs(a.length-b.length)>1) return false;
  let i=0, j=0, dif=0;
  while (i<a.length && j<b.length){ if (a[i]===b[j]){ i++; j++; continue; } if (++dif>1) return false;
    if (a.length>b.length) i++; else if (b.length>a.length) j++; else { i++; j++; } }
  return dif + (a.length-i) + (b.length-j) <= 1;
}
function buscar(q){
  const toks = sinTildes(q).split(/[^a-z0-9ñ/]+/).filter(t=>t.length>1);
  if (!toks.length) return [];
  const res = [];
  for (const e of indiceBuscar()){
    let puntos = 0, ok = true;
    for (const t of toks){
      if (e.tnorm.startsWith(t) || e.tnorm.includes(" "+t)) puntos += 3;
      else if (e.tnorm.includes(t)) puntos += 2;
      else if (e.texto.includes(t)) puntos += 1;
      else if (t.length>=5 && e.texto.split(/\s+/).some(w=>casiIgual(w, t))) puntos += .5;
      else { ok = false; break; }
    }
    if (ok) res.push([puntos, e]);
  }
  return res.sort((a,b)=>b[0]-a[0]).map(x=>x[1]);
}
let buscaSel = 0, buscaRes = [];
function abrirBuscador(){
  let dlg = document.getElementById("buscador");
  if (!dlg){ dlg = document.createElement("div"); dlg.id="buscador"; dlg.setAttribute("role","dialog"); dlg.setAttribute("aria-modal","true"); dlg.setAttribute("aria-label","Buscar en Escaño Abierto");
    dlg.innerHTML = `<div class="bu-caja"><div class="bu-cab"><input id="bu-q" type="search" placeholder="Busca un diputado, un ministro, una votación, un tema…" aria-label="Buscar" autocomplete="off" aria-controls="bu-res"><kbd>Esc</kbd></div><div id="bu-res" role="listbox"></div></div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener("click", e=>{ if (e.target===dlg) cerrarBuscador(); });
    document.getElementById("bu-q").addEventListener("input", e=>pintarBusqueda(e.target.value));
  }
  dlg.hidden = false; document.body.classList.add("con-buscador");
  if (!LEYES || !SEMANAS || !TEMAS_IDX || !ORG_IDX) Promise.all([cargarLeyes(), cargarSemanas(), cargarTemasIdx(), cargarOrgIdx()]).then(()=>{ const q=document.getElementById("bu-q"); if (q.value.trim()) pintarBusqueda(q.value); });
  const q = document.getElementById("bu-q"); q.value = ""; pintarBusqueda(""); setTimeout(()=>q.focus(), 0);
}
function cerrarBuscador(){ const d=document.getElementById("buscador"); if (d) d.hidden=true; document.body.classList.remove("con-buscador"); }
function pintarBusqueda(q){
  const cont = document.getElementById("bu-res");
  buscaRes = buscar(q); buscaSel = 0;
  if (!q.trim()){ cont.innerHTML = `<p class="bu-vacio">Prueba con «Rufián», «vivienda», «Ceuta», «122/000012» o «Madrid».</p>`; return; }
  if (!buscaRes.length){ cont.innerHTML = `<p class="bu-vacio">Nada coincide con «${esc(q)}».</p>`; return; }
  let k = 0; const orden = [];
  cont.innerHTML = TIPOS_BUSCAR.map(([t,l])=>{ const g = buscaRes.filter(e=>e.tipo===t).slice(0,t==="d"?6:5); if(!g.length) return "";
    return `<div class="bu-grupo"><div class="bu-tit">${l}</div>${g.map(e=>{ orden.push(e); const i=k++;
      return `<button class="bu-item" role="option" data-bu="${i}" aria-selected="${i===0}">${e.ir.foto?imgFoto(e.ir.foto,"mini-foto",` style="--grupo:${G[e.ir.foto.g]?.color}"`):`<span class="bu-ico">${{v:"◉",i:"§",l:"§",w:"◷",s:"▦",t:"#",tf:"#",p:"⌂",g:"?",iv:"❝",c:"◇"}[e.tipo]||"·"}</span>`}<span class="bu-txt"><b>${esc(e.titulo)}</b><small>${esc(e.sub)}</small></span></button>`; }).join("")}</div>`; }).join("");
  buscaRes = orden;
}
function irResultado(e){
  cerrarBuscador();
  if (e.ir.gl){ irGlosario(e.ir.gl); return; }
  if (e.ir.tema){ temaSel = e.ir.tema; rendered.temas=false; show("temas",true); window.scrollTo(0,0); return; }
  irA(e.ir.hash);
}
function moverSeleccion(d){
  const items = [...document.querySelectorAll("#bu-res .bu-item")]; if (!items.length) return;
  buscaSel = (buscaSel + d + items.length) % items.length;
  items.forEach((b,i)=>b.setAttribute("aria-selected", i===buscaSel)); items[buscaSel].scrollIntoView({block:"nearest"});
}
document.addEventListener("keydown", e=>{
  const abierto = !document.getElementById("buscador")?.hidden && document.getElementById("buscador");
  if (abierto){
    if (e.key==="Escape"){ e.preventDefault(); cerrarBuscador(); }
    else if (e.key==="ArrowDown"){ e.preventDefault(); moverSeleccion(1); }
    else if (e.key==="ArrowUp"){ e.preventDefault(); moverSeleccion(-1); }
    else if (e.key==="Enter" && buscaRes[buscaSel]){ e.preventDefault(); irResultado(buscaRes[buscaSel]); }
    return;
  }
  const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((e.key==="/" && !escribiendo) || ((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="k")){ e.preventDefault(); abrirBuscador(); }
}, SIG);

/* ---------- RSS ---------- */
// Solo hay canal para lo que tiene página propia (diputados, iniciativas con votación).
const botonRss = ruta => (ruta.startsWith("iniciativa/") && !INICIATIVAS[ruta.slice(11).replace("-","/")]?.votos.length && !/^iniciativa\/12[1-5]-/.test(ruta)) ? "" :
  `<a class="btn-rss" href="${ruta?ruta+"/":""}rss.xml" title="Recibe en tu lector de RSS lo que pase aquí">${ICONO_RSS}Seguir</a>`;
const ICONO_RSS = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><circle cx="3" cy="13" r="2" fill="currentColor"/><path d="M1.5 7.5a7 7 0 0 1 7 7M1.5 2a12.5 12.5 0 0 1 12.5 12.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

/* ---------- compartir ---------- */
// Cada diputado, votación, sesión e iniciativa tiene su página estática con título e imagen para redes.
const RAIZ = location.origin + "/";
const urlCompartir = ruta => RAIZ + ruta + "/";
const slugPy = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const botonCompartir = (ruta, titulo) => `<button class="compartir" data-compartir="${esc(ruta)}" data-titulo="${esc(titulo)}" aria-label="Compartir">Compartir ↗</button>${botonImagen(ruta)}`;
const ICONO_DESCARGA = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3 12.8h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const botonImagen = ruta => `<button class="btn-img" data-imagen="${esc(ruta)}" title="Descarga la tarjeta de esta página para compartirla" aria-label="Descargar imagen">${ICONO_DESCARGA}<span>Imagen</span></button>`;
// La tarjeta es la og:image de la página para compartir. Se lee de ahí porque algunas llevan en el nombre un
// resumen de lo que dibujan (una ley que avanza), y solo se toma su ruta: en los previews la URL absoluta
// apunta al dominio de producción.
async function descargarImagen(boton){
  if (boton.dataset.estado) return;
  boton.dataset.estado = "ocupado";
  const ruta = boton.dataset.imagen;
  try{
    const pagina = await fetch(urlCompartir(ruta));
    const og = (await pagina.text()).match(/<meta property="og:image" content="([^"]+)"/);
    if (!pagina.ok || !og) throw new Error("sin tarjeta");
    const r = await fetch(RAIZ + new URL(og[1], RAIZ).pathname.replace(/^\//, ""));
    if (!r.ok) throw new Error("tarjeta " + r.status);
    const blob = await r.blob();
    const nombre = "escano-abierto-" + ruta.replace(/\//g, "-") + ".png";
    const archivo = new File([blob], nombre, {type: "image/png"});
    if (matchMedia("(pointer:coarse)").matches && navigator.canShare?.({files:[archivo]})){
      try{ await navigator.share({files:[archivo]}); return; }catch(e){ if (e.name==="AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }catch(e){ aviso("No se ha podido descargar la imagen"); }
  finally{ delete boton.dataset.estado; }
}
function aviso(texto){ let t=document.getElementById("aviso"); if(!t){ t=document.createElement("div"); t.id="aviso"; t.setAttribute("role","status"); document.body.appendChild(t); }
  t.textContent=texto; t.classList.add("visible"); clearTimeout(aviso.t); aviso.t=setTimeout(()=>t.classList.remove("visible"), 2200); }
async function compartir(ruta, titulo){
  const url = urlCompartir(ruta);
  if (navigator.share && matchMedia("(pointer:coarse)").matches){ try{ await navigator.share({title:titulo, url}); return; }catch(e){ if (e.name==="AbortError") return; } }
  try{ await navigator.clipboard.writeText(url); aviso("Enlace copiado"); }catch(e){ aviso(url); }
}

/* ---------- navegación ---------- */
const TABS = ["inicio","elecciones","geografia","dias","votaciones","leyes","temas","preguntas","explora","quien-lo-dijo","diputados","grupos","organigrama","oradores","metodo"];
const VISTAS = [...TABS, "semana", "glosario", "como-ley", "provincia", "tema", "sobre"];   // «semana» no tiene pestaña: se llega desde la portada o por enlace
const rendered = {};
const renderers = {elecciones:renderElecciones, geografia:renderGeografia, "quien-lo-dijo":renderQuienLoDijo, explora:renderExplora, sobre:renderSobre, leyes:renderLeyes, semana:renderSemana, glosario:renderGlosario, "como-ley":renderComoLey, provincia:renderProvincia, tema:renderTemaFijo, preguntas:renderPreguntas, inicio:renderInicio, temas:renderTemas, diputados:renderDiputados, dias:renderDias, grupos:renderGrupos, organigrama:renderOrganigrama, oradores:renderOradores, votaciones:renderVotaciones, metodo:renderMetodo};
// Cada dirección cuenta como una página en la analítica, también la primera (el script no cuenta solo): la ruta agrupa
// (/diputado/[id]/, /votacion/[id]/…) y la dirección lleva el detalle.
function contarVista(){
  const path = location.pathname;
  if (path === ultimaVista) return;
  ultimaVista = path;
  const m = path.match(/^\/([a-z]+)\/[^/]+\/$/);
  window.va?.("pageview", {route: m && PREFIJOS_RUTA.includes(m[1]) ? `/${m[1]}/[id]/` : path, path});
}
// El título de la pestaña (y el que lee Google) y la dirección canónica de cada vista. La página para compartir con la
// que se llega ya trae los suyos, más precisos (el nombre de la votación, de la sesión…): esos no se tocan.
const TITULOS = {elecciones:"Elecciones generales del 29N", geografia:"Geografía de España", dias:"El Congreso, día a día",
  votaciones:"Votaciones del Congreso", leyes:"Leyes", temas:"De qué se habla en el Congreso", explora:"Toda la legislatura",
  "quien-lo-dijo":"¿Quién lo dijo?", diputados:"Diputados", grupos:"Grupos parlamentarios", organigrama:"Organigrama del Estado",
  oradores:"Por orador", metodo:"Método", semana:"La semana en el Congreso", glosario:"Glosario", "como-ley":"Cómo se hace una ley",
  provincia:"Tus diputados", tema:"Seguir un tema", preguntas:"Preguntas al Gobierno", sobre:"Sobre el proyecto"};
let tituloPropio = document.documentElement.dataset.ruta || null, vistaActual = null;
function ponerTitulo(vista, original){
  if (tituloPropio && location.pathname === rutaDe(tituloPropio)) return;   // seguimos en la página con la que se llegó
  tituloPropio = null;
  const dip = String(original).startsWith("diputado-") && DIP_SLUG[original.slice(9)];
  const t = dip ? legible(dip.n) : TITULOS[vista];
  document.title = t ? `${t} · Escaño Abierto` : "Escaño Abierto · Qué se dijo en el Congreso y cómo se votó";
  let c = document.querySelector('link[rel="canonical"]');
  if (!c){ c = document.createElement("link"); c.rel = "canonical"; document.head.appendChild(c); }
  c.href = location.origin + location.pathname;
}
const esRuta = id => !!id && (id === "inicio" || id === "aviso-legal" || VISTAS.includes(id) || PREFIJOS_RUTA.some(p => id.startsWith(p + "-")));
// Pone en la barra de direcciones la ruta de una vista: como entrada nueva del historial o en lugar de la actual.
function fijarRuta(id, nueva){
  const r = rutaDe(id);
  if (location.pathname === r && !location.hash) return;
  try{ history[nueva ? "pushState" : "replaceState"](null, "", r); }catch(e){}
  if (vistaActual){ contarVista(); ponerTitulo(vistaActual, id); }   // una ficha que cambia la dirección sin cambiar de vista
}
// Ir a una vista por su identificador («diputado-<slug>») o por su ruta («/diputado/<slug>/»).
function irA(destino){
  const id = String(destino).startsWith("/") ? idDeRuta(destino) : String(destino).replace(/^#/, "");
  fijarRuta(id, true); show(id, true); window.scrollTo(0,0);
}
window.irA = irA;
function show(id, push){
  const hashOriginal = id;
  // Enlaces de las páginas para compartir: #votacion-<id> y #sesion-<id> llevan a su vista.
  if (id && id.startsWith("votacion-") && VOTES[id.slice(9)]){ const a="v-"+id.slice(9); setTimeout(()=>ir("votaciones", a, false), 0); id="votaciones"; push=false; }
  else if (id && id.startsWith("sesion-")){   // la ruta de la sesión va en minúsculas; su ancla, con el id tal cual
    const sid = id.slice(7).toLowerCase(), s = DATA.sesiones.find(x=>x.id.toLowerCase()===sid);
    const a="s-"+(s ? s.id : id.slice(7)); setTimeout(()=>ir("dias", a, false), 0); id="dias"; push=false; }
  if (id && id.startsWith("diputado-")){ const sl=id.slice(9); if (DIP_SLUG[sl]){ if (dipSel!==sl){ dipSel=sl; rendered.diputados=false; } id="diputados"; push=false; } }
  else if (id==="diputados" && push && dipSel){ dipSel=null; rendered.diputados=false; }
  if (id && id.startsWith("iniciativa-")){ const x=id.slice(11).replace("-","/"); if (INICIATIVAS[x] || /^\d{3}\/\d{6}$/.test(x)){ INICIATIVAS[x] ||= {exp:x, votos:[], debates:[]}; if (iniSel!==x){ iniSel=x; rendered.votaciones=false; } id="votaciones"; push=false; } }
  if (id==="aviso-legal"){ setTimeout(()=>{ document.getElementById("aviso-legal")?.scrollIntoView({block:"start"}); window.scrollBy(0,-70); }, 0); id="sobre"; push=false; }
  if (id && id.startsWith("cargo-")){ const c=id.slice(6); if (orgSel!==c){ orgSel=c; rendered.organigrama=false; } id="organigrama"; push=false; }
  else if (id==="organigrama" && push && orgSel){ orgSel=null; rendered.organigrama=false; }
  if (id && id.startsWith("elecciones-")){ elSub = id.slice(11); rendered.elecciones=false; id="elecciones"; push=false; }
  else if (id==="elecciones" && elUltimo){ rendered.elecciones=false; }   // de un apartado a la portada de la sección
  if (id && id.startsWith("geografia-")){ geoSub = id.slice(10); rendered.geografia=false; id="geografia"; push=false; }
  else if (id==="geografia" && geoUltimo){ rendered.geografia=false; }   // de una ficha a la portada de la sección
  if (id && id.startsWith("provincia-")){ if (provSel!==id.slice(10)){ provSel=id.slice(10); rendered.provincia=false; } id="provincia"; push=false; }
  if (id && id.startsWith("tema-")){ if (temaFijo!==id.slice(5)){ temaFijo=id.slice(5); rendered.tema=false; } id="tema"; push=false; }
  if (id && id.startsWith("semana-")){ if (semSel!==id.slice(7)){ semSel=id.slice(7); rendered.semana=false; } id="semana"; push=false; }
  else if (id==="votaciones" && push && iniSel){ iniSel=null; rendered.votaciones=false; }
  if(!VISTAS.includes(id)) id="inicio";
  avisoReto(id);
  VISTAS.forEach(t=>{ $("#"+t).hidden = t!==id; const b=$("#tab-"+t); if (b){ b.classList.toggle("activa", t===id); if (t===id) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); } });
  document.querySelectorAll(".tab-menu").forEach(m=>m.classList.toggle("activa", !!$("#"+m.getAttribute("aria-controls")+" .activa")));
  const portada = $("#portada");   // la portada de la marca (Sol): solo en Inicio, con la barra pintada dentro
  if (portada){ portada.hidden = id!=="inicio"; document.documentElement.classList.toggle("en-portada", id==="inicio"); }
  cerrarMenus();
  document.querySelectorAll("#menu-movil [data-go]").forEach(b=>{ b.classList.toggle("activa", b.dataset.go===id); if (b.dataset.go===id) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  menuMovil(false);
  const nav = $("nav.tabs"), act = $("nav.tabs>button.activa");   // en el móvil la barra se desplaza: que se vea la sección actual
  if (act && (act.offsetLeft < nav.scrollLeft || act.offsetLeft + act.offsetWidth > nav.scrollLeft + nav.clientWidth)) nav.scrollLeft = act.offsetLeft - 8;
  $(".periodo-bar").hidden = id==="organigrama" || id==="quien-lo-dijo" || id==="elecciones" || id==="geografia";   // el periodo es del Congreso; el organigrama va con el BOE de hoy y el juego con toda la legislatura
  if(!rendered[id]){ renderers[id](); rendered[id]=true; }
  vistaActual = id;
  if(push) fijarRuta(id, true);
  contarVista(); ponerTitulo(id, hashOriginal);
}
function ir(tab, anchor, push=true){
  if (tab==="dias" && anchor && diasFiltro!=="todas"){ diasFiltro="todas"; rendered.dias=false; }   // que la sesión buscada se vea
  if (tab==="votaciones"){ if (anchor) vFilter.res="todas"; if (anchor || iniSel){ iniSel=null; rendered.votaciones=false; } }
  show(tab,push);
  const el = anchor && document.getElementById(anchor);
  el?.closest("details")?.setAttribute("open","");
  if (el){ el.scrollIntoView({block:"start"}); window.scrollBy(0,-72); el.animate?.([{outline:"2px solid var(--ink)"},{outline:"2px solid transparent"}],{duration:1600}); }
  else window.scrollTo(0,0);
}
TABS.forEach(t=>$("#tab-"+t).addEventListener("click",()=>{ show(t,true); window.scrollTo(0,0); }, SIG));
// Menús de la barra: se abren con clic (o flecha abajo), se cierran al elegir, con Esc o al pulsar fuera.
// El panel va fuera de la barra y con posición fija, porque la barra se desplaza en horizontal en el móvil.
function cerrarMenus(foco){ document.querySelectorAll(".tab-menu[aria-expanded=true]").forEach(m=>{ m.setAttribute("aria-expanded","false"); $("#"+m.getAttribute("aria-controls")).hidden=true; if (foco) m.focus(); }); }
function abrirMenu(m, enfocar){
  cerrarMenus();
  const p = $("#"+m.getAttribute("aria-controls")), r = m.getBoundingClientRect();
  m.setAttribute("aria-expanded","true"); p.hidden = false;
  p.style.top = Math.round($(".topbar").getBoundingClientRect().bottom + 6) + "px";
  const ancho = window.visualViewport?.width || document.documentElement.clientWidth;
  p.style.maxWidth = (ancho - 16) + "px";
  p.style.left = Math.round(Math.max(8, Math.min(r.left, ancho - p.offsetWidth - 8))) + "px";
  if (enfocar) p.querySelector(".tab-item").focus();
}
document.querySelectorAll(".tab-menu").forEach(m=>{
  m.addEventListener("click", e=>{ e.stopPropagation(); m.getAttribute("aria-expanded")==="true" ? cerrarMenus() : abrirMenu(m, e.detail===0); }, SIG);
  m.addEventListener("keydown", e=>{ if (e.key==="ArrowDown"){ e.preventDefault(); abrirMenu(m, true); } }, SIG);
});
document.querySelectorAll(".tab-panel").forEach(p=>p.addEventListener("keydown", e=>{
  const its=[...p.querySelectorAll(".tab-item")], k=its.indexOf(document.activeElement);
  if (e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); its[(k+(e.key==="ArrowDown"?1:its.length-1))%its.length].focus(); }
  else if (e.key==="Escape"){ e.preventDefault(); cerrarMenus(true); }
  else if (e.key==="Tab") cerrarMenus();
}, SIG));
document.addEventListener("click", e=>{ if (!e.target.closest(".tab-panel")) cerrarMenus(); }, SIG);
window.addEventListener("resize", ()=>cerrarMenus(), SIG);
$("nav.tabs").addEventListener("scroll", ()=>cerrarMenus(), SIG);
// Menú ☰: el panel se construye con la propia barra y sus menús, para que no haya dos listas que mantener.
// Cada sección es un [data-go]; al elegir una, show() la marca y cierra el panel.
$("#menu-movil").innerHTML = [...$("nav.tabs").children].map(b=>{
  if (b.dataset.vista) return `<button class="mm-item" type="button" data-go="${b.dataset.vista}">${b.innerHTML}</button>`;
  const its = [...$("#"+b.getAttribute("aria-controls")).querySelectorAll(".tab-item")];
  return `<div class="mm-grupo"><h2>${esc(b.textContent)}</h2>${its.map(it=>`<button class="mm-item mm-sub" type="button" data-go="${it.dataset.vista}">${it.innerHTML}</button>`).join("")}</div>`;
}).join("");
function menuMovil(abrir){
  const m = $("#menu-movil"), btn = $("#btn-menu");
  if (m.hidden === !abrir) return;
  m.hidden = !abrir; btn.setAttribute("aria-expanded", String(abrir));
  document.documentElement.classList.toggle("menu-abierto", abrir);
  if (abrir){ m.style.top = Math.round($(".topbar").getBoundingClientRect().bottom) + "px"; m.scrollTop = 0; }
}
$("#btn-menu").addEventListener("click", e=>{ e.stopPropagation(); cerrarMenus(); menuMovil($("#menu-movil").hidden); }, SIG);
document.addEventListener("keydown", e=>{ if (e.key==="Escape" && !$("#menu-movil").hidden){ menuMovil(false); $("#btn-menu").focus(); } }, SIG);
matchMedia("(min-width:1201px)").addEventListener("change", e=>{ if (e.matches) menuMovil(false); }, SIG);
document.addEventListener("click", e=>{
  const g = e.target.closest("[data-go]");
  if (g){ e.preventDefault(); ir(g.dataset.go, g.dataset.anchor); return; }
  const cg = e.target.closest("[data-cargo]");
  if (cg){ irCargo(cg.dataset.cargo); return; }
  const orr = e.target.closest("[data-org-rama]");
  if (orr){ Org.enfocar(orr.dataset.orgRama); return; }
  const om = e.target.closest("[data-org-mas]");
  if (om){ document.getElementById("org-panel").innerHTML = ultimosCambiosOrg(+om.dataset.orgMas); return; }
  if (e.target.closest("[data-org-volver]")){ orgSel=null; pintarPanelOrg(); Org.resaltar(); fijarRuta("organigrama", true); return; }
  if (e.target.closest("#btn-buscar")){ menuMovil(false); abrirBuscador(); return; }
  const bu = e.target.closest("[data-bu]");
  if (bu){ irResultado(buscaRes[+bu.dataset.bu]); return; }
  const cp = e.target.closest("[data-compartir]");
  if (cp){ compartir(cp.dataset.compartir, cp.dataset.titulo); return; }
  const im = e.target.closest("[data-imagen]");
  if (im){ descargarImagen(im); return; }
  const hm = e.target.closest("[data-hm]");
  if (hm){ mapaHemi.metrica=hm.dataset.hm; if (mapaHemi.metrica==="turnos" && !EXTRA){ cargarExtra().then(pintarHemiDatos); } pintarHemiDatos(); return; }
  const rp = e.target.closest("[data-repro]");
  if (rp){ const a=rp.dataset.repro; if (a==="play") reproPlay(); else { reproParar(); repro.k += a==="next"?1:-1; reproPintar(); } return; }
  const rk = e.target.closest("[data-repro-k]");
  if (rk){ reproParar(); repro.k=+rk.dataset.reproK; reproPintar(); return; }
  const ib = e.target.closest("[data-ini]");
  if (ib){ tip.hidden=true; irIniciativa(ib.dataset.ini); return; }
  const gl = e.target.closest("[data-gl]");
  if (gl){ e.preventDefault(); e.stopPropagation(); tip.hidden=true; irGlosario(gl.dataset.gl); return; }
  if (e.target.closest("[data-go-ley]")){ rendered["como-ley"]=false; show("como-ley", true); window.scrollTo(0,0); return; }
  const pv = e.target.closest("[data-prov]");
  if (pv){ irProvincia(pv.dataset.prov); return; }
  const tf = e.target.closest("[data-tema-fijo]");
  if (tf){ irTemaFijo(tf.dataset.temaFijo); return; }
  const sm = e.target.closest("[data-sem]");
  if (sm && sm.dataset.sem){ irSemana(sm.dataset.sem); return; }
  const iv = e.target.closest("[data-irv]");
  if (iv){ irVotacion(iv.dataset.irv, iv.dataset.f); return; }
  const is = e.target.closest("[data-irs]");
  if (is){ irSesion(is.dataset.irs, is.dataset.f); return; }
  const lfe = e.target.closest("[data-lf-estado]");
  if (lfe){ leyFiltro.estado=lfe.dataset.lfEstado; leyFiltro.todas=false; pintarFiltroLeyes(); return; }
  const lfa = e.target.closest("[data-lf-autor]");
  if (lfa){ leyFiltro.autor = leyFiltro.autor===lfa.dataset.lfAutor ? "TODOS" : lfa.dataset.lfAutor; leyFiltro.todas=false; pintarFiltroLeyes(); document.getElementById("leyes-lista")?.scrollIntoView({block:"start"}); window.scrollBy(0,-70); return; }
  if (e.target.closest("[data-lf-todas]")){ leyFiltro.todas=true; $("#leyes-tabla").innerHTML=listaLeyes(); return; }
  const iv0 = e.target.closest("[data-ini-volver]");
  if (iv0){ iniSel=null; rendered.votaciones=false; show(iv0.dataset.iniVolver||"votaciones",true); window.scrollTo(0,0); return; }
  const tc = e.target.closest("[data-circ]");
  if (tc){ dipFiltro.circ = dipFiltro.circ===tc.dataset.circ ? null : tc.dataset.circ; renderDiputados(); document.getElementById("dip-tabla")?.scrollIntoView({block:"start"}); window.scrollBy(0,-70); return; }
  const mm = e.target.closest("[data-mapa]");
  if (mm){ mapaModo = mm.dataset.mapa; renderDiputados(); return; }
  const orb = e.target.closest("[data-or]");   // un orador que no es diputado: el panel con sus intervenciones
  if (orb){ panelOrador(datosOradores().find(o=>o.nombre===orb.dataset.or)); return; }
  const dp = e.target.closest("[data-dip]");
  if (dp){ irDiputado(dp.dataset.dip); return; }
  if (e.target.closest("[data-dip-volver]")){ dipSel=null; rendered.diputados=false; show("diputados",true); window.scrollTo(0,0); return; }
  const gr = e.target.closest("[data-gr],[data-gr-or]");   // una tarjeta de Grupos: a sus diputados (el Gobierno, a sus oradores)
  if (gr){ window.scrollTo(0,0);
    if (gr.dataset.gr){ dipFiltro.g = gr.dataset.gr; dipSel = null; rendered.diputados = false; show("diputados", true);
      requestAnimationFrame(()=>{ const t = document.getElementById("dip-tabla"); if (t) window.scrollTo(0, scrollY + t.getBoundingClientRect().top - 140); }); }
    else { orFilter.g = gr.dataset.grOr; rendered.oradores = false; show("oradores", true); }
    return; }
  const dg = e.target.closest("[data-dg]");
  if (dg){ dipFiltro.g=dg.dataset.dg; renderDiputados(); return; }
  const dvi = e.target.closest("[data-dvista]");
  if (dvi){ dipFiltro.vista=dvi.dataset.dvista; renderDiputados(); return; }
  const dor = e.target.closest("[data-dord]");
  if (dor){ dipFiltro.orden=dor.dataset.dord; renderDiputados(); return; }
  const seat = e.target.closest(".hemi [data-n]");
  if (seat && seat.dataset.n){ const d=DIP.find(x=>x.n===seat.dataset.n); if (d){ tip.hidden=true; irDiputado(d.slug); return; } }
  const ts = e.target.closest("[data-tema-sel]");
  if (ts){ temaSel = ts.dataset.temaSel; const y=window.scrollY; const enTemas=!$("#temas").hidden; renderTemas(); rendered.temas=true;
    if (enTemas) window.scrollTo(0,y); else { show("temas",true); window.scrollTo(0,0); } return; }
  const t = e.target.closest("[data-tema]");
  if (t){ orFilter = {q:t.dataset.tema, g:"TODOS"}; rendered.oradores=false; ir("oradores"); }
}, SIG);
document.addEventListener("change", e=>{ const ps=e.target.closest(".prov-sel"); if (ps && ps.value) irProvincia(ps.value); }, SIG);
// La vista de la dirección con la que se llega. Una dirección con # de las de antes pasa a su ruta; la página para
// compartir de una sesión dice cuál es en data-ruta (su ruta va en minúsculas).
{ const h = location.hash.slice(1), dr = document.documentElement.dataset.ruta;
  let id = esRuta(h) ? h : dr && rutaDe(dr) === location.pathname ? dr : idDeRuta(location.pathname);
  if (!esRuta(id)) id = "inicio";
  if (location.pathname !== rutaDe(id) || esRuta(h)) try{ history.replaceState(null, "", rutaDe(id) + location.search); }catch(e){}
  // La página de una votación o sesión que no cae en el periodo cargado: se carga su mes (una vez) y se abre ahí.
  const mes = id === dr && (document.documentElement.dataset.fecha || "").slice(0,7);
  const falta = (id.startsWith("votacion-") && !VOTES[id.slice(9)])
             || (id.startsWith("sesion-") && !DATA.sesiones.some(s=>s.id.toLowerCase()===id.slice(7).toLowerCase()));
  if (mes && falta && mesCargado !== mes){ mesCargado = mes; arrancar(mes); }
  else show(id, false); }
puntoReto();
window.addEventListener("hashchange", ()=>{ const h = location.hash.slice(1); if (!esRuta(h)) return; fijarRuta(h, false); show(h, true); window.scrollTo(0,0); }, SIG);
// Atrás y adelante. Los saltos dentro de la página (#exp-radar…) no cambian de vista.
window.addEventListener("popstate", ()=>{ if (location.hash) return; show(idDeRuta(location.pathname), true); window.scrollTo(0,0); }, SIG);
// Los enlaces a otra vista (/votaciones/, /diputado/…, o un #votaciones de los de antes) no recargan la página. Va en
// window para que los manejadores propios (data-go, data-exp-ir…) actúen antes y puedan quedárselo.
window.addEventListener("click", e=>{
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.("a[href]");
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
  const href = a.getAttribute("href");
  let id;
  if (href.startsWith("#")) id = href.slice(1);
  else {
    const u = new URL(a.href);
    if (u.origin !== location.origin || /\.[a-z0-9]+$/i.test(u.pathname) || /^\/(datos|og|marcas?|api)\//.test(u.pathname)) return;
    id = idDeRuta(u.pathname);
  }
  if (!esRuta(id)) return;
  e.preventDefault(); irA(id);
}, SIG);
// Hemiciclos perezosos: se dibujan al acercarse a la pantalla.
const vigia = new IntersectionObserver(es=>es.forEach(e=>{ if(!e.isIntersecting) return; const el=e.target; vigia.unobserve(el); const v=VOTES[el.dataset.hemi]; if (v) el.outerHTML = hemiciclo(v); }), {rootMargin:"600px 0px"});
const hidratar = () => document.querySelectorAll("main .hemi-lazy:not([data-vigilado])").forEach(el=>{ el.dataset.vigilado="1"; vigia.observe(el); });
const mo = new MutationObserver(hidratar); mo.observe(document.querySelector("main"), {childList:true, subtree:true});
ctl.signal.addEventListener("abort", ()=>{ mo.disconnect(); vigia.disconnect(); });
hidratar();
}
