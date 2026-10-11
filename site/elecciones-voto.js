/* Apartado «La geografía del voto» de la sección de elecciones (#elecciones-voto).
   Los ejes de la España municipal —ciudad y campo, la España vacía, la edad, el dinero, las Españas, el giro y el
   peso del voto— y cómo vota cada uno, con un mapa fijo de los ocho mil municipios que cambia al bajar.
   Los datos del INE, los mapas y las utilidades comunes (formatos, colores, tooltip) son de la sección de geografía
   (site/geografia.js); los votos de cada municipio, de datos/elecciones/. elecciones.js llama a geografiaDelVoto. */

import {datosGeo, RUTAS, pedir, tip, esc, fmt, dec, pct, signo, millones, habitantes, hexRgb, cssVar, rampa, divergente, TONO, pobHoy, nombreP, partido} from "./geografia.js";

const VOTOS = {
  v23: "datos/elecciones/municipios-202307.json",
  v19: "datos/elecciones/municipios-201911.json",
};

const CSS = `
.geo-tam{display:inline-flex;border:1px solid var(--line);border-radius:var(--r-pill,999px);overflow:hidden;margin-top:4px}
.geo-tam button{appearance:none;border:0;background:none;font:500 13px var(--sans);color:var(--muted);padding:5px 12px;cursor:pointer}
.geo-tam button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.geo-cubos{display:grid;gap:2px;margin-top:10px}
.geo-cubo{display:grid;grid-template-columns:12px minmax(0,1fr);gap:2px 9px;padding:6px 6px;border-radius:8px;cursor:pointer}
.geo-cubo:hover,.geo-cubo.on{background:var(--sunk)}
.geo-cubo>i{width:12px;height:12px;border-radius:3px;margin-top:3px;grid-row:span 3}
.geo-cubo .c1{display:flex;justify-content:space-between;gap:8px;font-size:13.5px}
.geo-cubo .c1 small{color:var(--muted);font-size:11.5px;white-space:nowrap}
.geo-cubo .c2{font-size:11.5px;color:var(--muted)}
.geo-barra{display:flex;height:10px;border-radius:3px;overflow:hidden;gap:2px;background:var(--surface)}
.geo-barra i{display:block;min-width:1px}
.geo-partidos{display:flex;flex-wrap:wrap;gap:3px 10px;font-size:11.5px;color:var(--muted);margin-top:6px}
.geo-partidos span{display:inline-flex;align-items:center;gap:4px}
.geo-partidos i{width:8px;height:8px;border-radius:2px;display:inline-block}
.geo-esp-chips{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}
.geo-esp-chips button{appearance:none;font:500 12.5px var(--sans);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:var(--r-pill,999px);padding:4px 10px;cursor:pointer}
.geo-esp-chips button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.geo-esp-det{border-top:1px solid var(--line);padding-top:8px;margin-top:4px}
.geo-esp-det h4{margin:0 0 4px;font-size:15px}
.geo-esp-det h4 small{font-weight:400;color:var(--muted);font-size:11.5px}
.geo-esp-tabla{display:grid;gap:1px;margin-top:8px}
.geo-esp-tabla button{all:unset;display:grid;grid-template-columns:minmax(0,8.5em) minmax(0,1fr) 4.2em;gap:8px;align-items:center;font-size:12px;padding:4px 6px;border-radius:6px;cursor:pointer}
.geo-esp-tabla button:hover,.geo-esp-tabla button.on{background:var(--sunk)}
.geo-esp-tabla .v{font-family:var(--mono);color:var(--muted);text-align:right}
.geo-pres-btn{appearance:none;font:600 13px var(--sans);color:var(--ink);background:var(--surface);border:1px solid var(--line-strong);border-radius:var(--r-pill,999px);padding:6px 14px;cursor:pointer}
.geo-pres{display:none}
.geo-story.presentando{position:fixed;inset:0;z-index:200;background:var(--bg);margin:0;display:block}
.geo-story.presentando .geo-pasos{display:none}
.geo-story.presentando .geo-fijo{position:absolute;inset:14px 14px 14px 470px;height:auto;top:14px}
.geo-story.presentando .geo-pres{display:grid;position:absolute;left:18px;top:18px;bottom:18px;width:430px;align-content:center;gap:10px;overflow:auto}
.geo-pres nav{display:flex;gap:8px;align-items:center;font:500 13px var(--mono);color:var(--muted)}
.geo-pres nav button{appearance:none;font:600 14px var(--sans);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:5px 12px;cursor:pointer}
.geo-pres nav button:disabled{opacity:.35;cursor:default}
@media (max-width:860px){
  .geo-story.presentando .geo-fijo{inset:8px 8px 45vh 8px}
  .geo-story.presentando .geo-pres{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:44vh}
}
`;
function estilosVoto(){
  if (document.getElementById("voto-css")) return;
  const s = document.createElement("style"); s.id = "voto-css"; s.textContent = CSS; document.head.appendChild(s);
}
let T = null, GP = null;

/* =====================================================================================================
   Cada eje agrupa los municipios (por tamaño, por cuánto se vacían, por edad, por renta…), cuenta cómo votan
   y, al pasar por un grupo, lo ilumina en el mapa. «Presentar» la recorre con el teclado, para un directo.
   ===================================================================================================== */
const BLOQUES = [["PP", "PP"], ["PSOE", "PSOE"], ["VOX", "Vox"], ["IZQ", "Sumar"], ["OTROS", "Otros"]];
const OTROS_COLOR = "#8A8F98";

/* Votos de un municipio agrupados en los cuatro grandes y el resto, y los dos bloques (para el giro). */
function agrupar(fila, orden){
  const g = {PP: 0, PSOE: 0, VOX: 0, IZQ: 0, OTROS: 0, der: 0, izq: 0, val: 0, votantes: fila[1]};
  orden.forEach((f, i) => {
    const v = fila[2 + i] || 0; g.val += v;
    g[["PP", "PSOE", "VOX", "IZQ"].includes(f) ? f : "OTROS"] += v;
    if (f === "PP" || f === "VOX" || f === "CS") g.der += v;
    if (f === "PSOE" || f === "IZQ") g.izq += v;
  });
  return g;
}
/* Resumen de un grupo de municipios: cuántos, cuánta gente, cuánto territorio y cómo votó. */
function resumen(lista){
  const r = {n: lista.length, pob: 0, pob0: 0, pobCon0: 0, km2: 0, val: 0, PP: 0, PSOE: 0, VOX: 0, IZQ: 0, OTROS: 0};
  for (const d of lista){
    r.pob += d.pob; r.km2 += d.km2;
    if (d.pob0){ r.pob0 += d.pob0; r.pobCon0 += d.pob; }
    if (d.v){ r.val += d.v.val; BLOQUES.forEach(([k]) => { r[k] += d.v[k]; }); }
  }
  r.sh = k => r.val ? r[k] / r.val : 0;
  r.crec = r.pob0 ? r.pobCon0 / r.pob0 - 1 : null;
  return r;
}

export async function geografiaDelVoto(el){
  estilosVoto();
  el.innerHTML = `<p class="nota">Cargando los municipios…</p>`;
  ({T, GP} = await datosGeo());
  if (!T){ el.innerHTML = `<p class="nota">No se han podido cargar los datos de geografía.</p>`; return; }
  const [M, V23, V19] = await Promise.all([pedir(RUTAS.datos + "municipios.json"), pedir(VOTOS.v23), pedir(VOTOS.v19)]);
  if (!M){ el.innerHTML = `<p class="nota">No se han podido cargar los municipios.</p>`; return; }
  const F = M.familias, ORD = M.orden;
  const colorBloque = k => k === "OTROS" ? OTROS_COLOR : F[k]?.[1] || OTROS_COLOR;
  const D = Object.entries(M.m).map(([c, r]) => {
    const d = {c, n: r[0], x: r[1], y: r[2], km2: r[3] || 0, pob: r[4], pob0: r[5], renta: r[6], edad: r[7], may65: r[8], gana: r[9]};
    const a = V23?.municipios[c], b = V19?.municipios[c];
    d.v = a ? agrupar(a, V23.orden) : null;
    const w = b ? agrupar(b, V19.orden) : null;
    // Giro: cuántos puntos ganó el bloque de PP, Vox y Cs sobre el de PSOE y Sumar (UP en 2019) entre las dos elecciones.
    d.giro = d.v && w && d.v.val && w.val ? ((d.v.der - d.v.izq) / d.v.val - (w.der - w.izq) / w.val) * 100 : null;
    d.dens = d.km2 ? d.pob / d.km2 : null;
    return d;
  });
  const N = D.length, TOT = resumen(D), total = TOT.pob, kmTot = TOT.km2;
  const sh = (r, k) => pct(r.sh(k), 0);
  const n = x => `<span class="num">${x}</span>`;

  // ---------- cifras ----------
  const porGanador = {}; D.forEach(d => { if (d.gana != null){ (porGanador[d.gana] ||= []).push(d); } });
  const ganadores = Object.entries(porGanador).sort((a, b) => b[1].length - a[1].length);
  // El partido que gana en muchos municipios pequeños: más municipios que gente (entre los que ganan en cien o más).
  const pobDe = l => l.reduce((s, d) => s + d.pob, 0);
  const [gP, lP] = ganadores.filter(([, l]) => l.length >= 100).sort((a, b) => (b[1].length / pobDe(b[1])) - (a[1].length / pobDe(a[1])))[0];
  const porPob = D.slice().sort((a, b) => b.pob - a.pob);
  let mitad = 0; { let acum = 0; for (const d of porPob){ acum += d.pob; mitad++; if (acum >= total / 2) break; } }
  const cien = D.filter(d => d.pob < 100).length;
  // Cuartos de población por renta (ordenados de más a menos renta).
  const conRenta = D.filter(d => d.renta != null).sort((a, b) => b.renta - a.renta), pobRenta = conRenta.reduce((s, d) => s + d.pob, 0);
  const cortes = []; { let acum = 0, q = 1; for (const d of conRenta){ acum += d.pob; if (acum >= pobRenta * q / 4 && q < 4){ cortes.push(d.renta); q++; } } }
  const ps = Object.entries(T.provincias).map(([c, p]) => ({c, h: pobHoy(p) / p.esc})).sort((a, b) => a.h - b.h);
  const conGiro = D.filter(d => d.giro != null), aDer = conGiro.filter(d => d.giro > 0);
  const bloque = V => { let der = 0, izq = 0, val = 0; Object.values(V.municipios).forEach(f => { const g = agrupar(f, V.orden); der += g.der; izq += g.izq; val += g.val; }); return {der: der / val, izq: izq / val}; };
  const B23 = V23 ? bloque(V23) : null, B19 = V19 ? bloque(V19) : null;

  // ---------- los ejes: cada uno, unos grupos de municipios ----------
  const rS = rampa(TONO.neutro), rE = rampa(TONO.edad), rR = rampa(TONO.renta);
  const EJES = {
    ciudad: {alto: rS(1), cubos: [
      {k: "gc", t: "Grandes ciudades", s: "100.000 habitantes o más", f: d => d.pob >= 1e5, col: rS(1)},
      {k: "cm", t: "Ciudades medias", s: "de 20.000 a 100.000", f: d => d.pob >= 2e4 && d.pob < 1e5, col: rS(.85)},
      {k: "pg", t: "Pueblos grandes", s: "de 5.000 a 20.000", f: d => d.pob >= 5e3 && d.pob < 2e4, col: rS(.7)},
      {k: "pu", t: "Pueblos", s: "de 1.000 a 5.000", f: d => d.pob >= 1e3 && d.pob < 5e3, col: rS(.56)},
      {k: "ru", t: "La España rural", s: "menos de 1.000", f: d => d.pob < 1e3, col: rS(.42)}]},
    vacia: {cubos: [
      {k: "va", t: "Se vacían", s: `pierden más del 25 % desde ${M.anio0}`, f: d => d.pob0 && d.pob / d.pob0 - 1 <= -.25, col: divergente(-1)},
      {k: "pi", t: "Pierden", s: "hasta un 25 % menos", f: d => d.pob0 && d.pob / d.pob0 - 1 > -.25 && d.pob < d.pob0, col: divergente(-.5)},
      {k: "cr", t: "Crecen", s: "hasta un 25 % más", f: d => d.pob0 && d.pob >= d.pob0 && d.pob / d.pob0 - 1 < .25, col: divergente(.5)},
      {k: "cm", t: "Crecen mucho", s: "más de un 25 %", f: d => d.pob0 && d.pob / d.pob0 - 1 >= .25, col: divergente(1)}]},
    edad: {alto: rE(1), cubos: [
      {k: "j", t: "Jóvenes", s: "menos del 18 % con 65 o más", f: d => d.may65 != null && d.may65 < 18, col: rE(.4)},
      {k: "m", t: "En la media", s: "del 18 al 25 %", f: d => d.may65 >= 18 && d.may65 < 25, col: rE(.6)},
      {k: "e", t: "Envejecidos", s: "del 25 al 33 %", f: d => d.may65 >= 25 && d.may65 < 100 / 3, col: rE(.8)},
      {k: "me", t: "Muy envejecidos", s: "uno de cada tres o más", f: d => d.may65 >= 100 / 3, col: rE(1)}]},
    dinero: {alto: rR(1), cubos: [
      {k: "a", t: "Renta alta", s: `más de ${fmt(cortes[0])} € por persona`, f: d => d.renta != null && d.renta >= cortes[0], col: rR(1)},
      {k: "ma", t: "Por encima de la media", s: `de ${fmt(cortes[1])} a ${fmt(cortes[0])} €`, f: d => d.renta >= cortes[1] && d.renta < cortes[0], col: rR(.8)},
      {k: "mb", t: "Por debajo de la media", s: `de ${fmt(cortes[2])} a ${fmt(cortes[1])} €`, f: d => d.renta >= cortes[2] && d.renta < cortes[1], col: rR(.6)},
      {k: "b", t: "Renta baja", s: `menos de ${fmt(cortes[2])} €`, f: d => d.renta != null && d.renta < cortes[2], col: rR(.4)}]},
  };
  for (const e of Object.values(EJES)) e.cubos.forEach(c => { c.lista = D.filter(c.f); c.r = resumen(c.lista); c.rgb = rgbDe(c.col); });
  const R = id => EJES[id].cubos.map(c => c.r);

  // Las Españas: regiones con nombre propio que no coinciden con el mapa autonómico (los «cinturones» de aquí).
  const prov = d => d.c.slice(0, 2), cc = d => T.provincias[prov(d)]?.ccaa;
  const ESPANAS = [
    {k: "laponia", t: "La Laponia del sur", f: d => d.dens != null && d.dens < 8 && !["07", "35", "38"].includes(prov(d)),
      d: r => `Los ${fmt(r.n)} municipios con menos de 8 habitantes por km², el umbral con el que la UE define las zonas muy escasamente pobladas, como la Laponia. Ocupan el ${pct(r.km2 / kmTot, 0)} de España y tienen ${habitantes(r.pob)}. Su corazón es la Serranía Celtibérica, entre Soria, Teruel, Cuenca y Guadalajara.`},
    {k: "castillas", t: "Las dos Castillas", f: d => ["07", "08"].includes(cc(d)),
      d: r => `Castilla y León y Castilla-La Mancha: el ${pct(r.km2 / kmTot, 0)} del territorio, el ${pct(r.pob / total, 0)} de la población y ${fmt(r.n)} municipios, más de la mitad de los de España.`},
    {k: "verde", t: "La España verde", f: d => ["12", "03", "06", "16"].includes(cc(d)),
      d: r => `Galicia, Asturias, Cantabria y el País Vasco: la cornisa atlántica y cantábrica, con ${habitantes(r.pob)}.`},
    {k: "medi", t: "El corredor mediterráneo", aprox: true, f: d => ["17", "08", "43", "12", "46", "03", "30", "04"].includes(prov(d)),
      d: r => `Las provincias de la costa mediterránea, de Girona a Almería: ${habitantes(r.pob)}, el ${pct(r.pob / total, 0)} de España, en el ${pct(r.km2 / kmTot, 0)} de su territorio.`},
    {k: "corona", t: "La corona de Madrid", f: d => prov(d) === "28" && d.c !== "28079",
      d: r => `Los ${fmt(r.n)} municipios de la Comunidad de Madrid sin la capital, con ${habitantes(r.pob)}: ${r.crec != null ? `han crecido un ${pct(r.crec, 0)} desde ${M.anio0}` : ""}.`},
    {k: "islas", t: "Las islas", f: d => ["07", "35", "38"].includes(prov(d)),
      d: r => `Baleares y Canarias: ${habitantes(r.pob)}${r.crec != null ? `, un ${pct(r.crec, 0)} más que en ${M.anio0}` : ""}.`},
    {k: "grandes", t: "Las grandes capitales", f: d => d.pob >= 25e4,
      d: r => `Los ${r.n} municipios de más de 250.000 habitantes. En ellos vive el ${pct(r.pob / total, 0)} de la población.`},
  ];
  ESPANAS.forEach(e => { e.lista = D.filter(e.f); e.r = resumen(e.lista); e.set = new Set(e.lista.map(d => d.c)); });

  // ---------- textos de cada paso ----------
  const barra = r => `<div class="geo-barra" role="img" aria-label="${BLOQUES.map(([k, t]) => `${t} ${pct(r.sh(k), 0)}`).join(", ")}">${BLOQUES.map(([k]) => r[k] ? `<i style="flex:${r[k]};background:${colorBloque(k)}"></i>` : "").join("")}</div>`;
  const partidos = `<div class="geo-partidos">${BLOQUES.map(([k, t]) => `<span><i style="background:${colorBloque(k)}"></i>${t}</span>`).join("")}<span>· voto del 23J</span></div>`;
  const cubos = id => `<div class="geo-cubos" data-eje="${id}">${EJES[id].cubos.map(c => `<div class="geo-cubo" data-cubo="${c.k}" tabindex="0"><i style="background:${c.col}"></i>
      <div class="c1"><b>${esc(c.t)}</b><small>${fmt(c.r.n)} municipios · ${pct(c.r.pob / total, 0)} de la gente</small></div><div class="c2">${esc(c.s)}${c.r.val ? ` · PP ${sh(c.r, "PP")}, PSOE ${sh(c.r, "PSOE")}, Vox ${sh(c.r, "VOX")}, Sumar ${sh(c.r, "IZQ")}` : ""}</div>${barra(c.r)}</div>`).join("")}</div>${partidos}<p class="pista-t">Pasa el cursor (o toca) un grupo para iluminar sus municipios.</p>`;
  const espanas = () => `<div class="geo-esp-chips" role="group" aria-label="Elige una España">${ESPANAS.map(e => `<button data-espana="${e.k}" aria-pressed="${e.k === modo.espana}">${esc(e.t)}</button>`).join("")}</div>
    <div class="geo-esp-det"></div>
    <div class="geo-esp-tabla">${ESPANAS.map(e => `<button data-espana="${e.k}" class="${e.k === modo.espana ? "on" : ""}"><b>${esc(e.t)}</b>${barra(e.r)}<span class="v">${millones(e.r.pob).replace(" millones", " M")}</span></button>`).join("")}</div>${partidos}`;
  const detalleEspana = () => { const e = ESPANAS.find(x => x.k === modo.espana), r = e.r;
    return `<h4>${esc(e.t)}${e.aprox ? ` <small>· límites aproximados: provincias enteras</small>` : ""}</h4><p style="margin:0 0 6px;font-size:13.5px">${e.d(r)}</p>
      <p style="margin:0;font-size:13px;color:var(--muted)">El 23J: PP ${sh(r, "PP")}, PSOE ${sh(r, "PSOE")}, Vox ${sh(r, "VOX")}, Sumar ${sh(r, "IZQ")}, otros ${sh(r, "OTROS")}.${r.crec != null ? ` Población desde ${M.anio0}: ${signo(r.crec, 0)}.` : ""}</p>`; };

  const [cG, cCm, , , cRu] = R("ciudad"), [vVa, , , vCm] = R("vacia"), [eJ, , , eMe] = R("edad"), [dA, , , dB] = R("dinero");
  const mitadMay = D.filter(d => d.may65 >= 50).length;
  const PASOS = [
    {id: "engana", n: "El mapa engaña", k: "El mapa engaña", t: "El territorio no vota. La gente, sí.", html: () => `
      <p>Cada punto es un municipio, pintado del color del partido más votado el 23J. Vistos todos iguales, pesan lo mismo los ${n(fmt(cien))} pueblos de menos de cien vecinos que ${esc(porPob[0].n)}, con ${millones(porPob[0].pob)} de habitantes.</p>
      <p>Pero la mitad de la población vive en solo ${n(fmt(mitad))} municipios, el ${pct(mitad / N, 1)}. Si cada punto pesa lo que pesa su gente, el mapa cambia: unos pocos círculos enormes en un mar de pueblos pequeños, y hay colores que casi desaparecen. ${esc(partido(M, gP))} ganó en ${fmt(lP.length)} municipios, pero en ellos vive el ${pct(pobDe(lP) / total, 1)} de la gente.</p>
      <div class="geo-tam" role="group" aria-label="Tamaño de los puntos"><button data-tam="mun" aria-pressed="${modo.tam === "mun"}">Por municipio</button><button data-tam="pob" aria-pressed="${modo.tam === "pob"}">Por habitantes</button></div>`},
    {id: "ciudad", n: "Ciudad y campo", k: "Eje 1 · Ciudad y campo", t: "Las ciudades y los pueblos", html: () => `
      <p>Los ${n(fmt(cG.n))} municipios de más de cien mil habitantes reúnen al ${pct(cG.pob / total, 0)} de la población; los ${fmt(cRu.n)} de menos de mil, al ${pct(cRu.pob / total, 1)}. El 23J el PP sacó el ${sh(cRu, "PP")} de los votos en la España rural y el ${sh(cG, "PP")} en las grandes ciudades; Sumar, el ${sh(cRu, "IZQ")} y el ${sh(cG, "IZQ")}.</p>${cubos("ciudad")}`},
    {id: "vacia", n: "La España vacía", k: "Eje 2 · La España vacía", t: "La España que se vacía", html: () => `
      <p>${n(fmt(vVa.n))} municipios han perdido más de una cuarta parte de sus vecinos desde ${M.anio0}. Ocupan el ${n(pct(vVa.km2 / kmTot, 0))} del territorio y hoy vive en ellos el ${pct(vVa.pob / total, 1)} de la población. En el otro extremo, ${fmt(vCm.n)} municipios han crecido más de un 25 %, sobre todo en la costa, en las islas y alrededor de las grandes ciudades.</p>${cubos("vacia")}`},
    {id: "edad", n: "La edad", k: "Eje 3 · La edad", t: "Los pueblos que envejecen", html: () => `
      <p>En ${n(fmt(eMe.n))} municipios al menos uno de cada tres vecinos tiene 65 años o más, y en ${fmt(mitadMay)} ya son la mitad. El envejecimiento dibuja casi el mismo mapa que la pérdida de población: donde se van los jóvenes, quedan los mayores.</p>
      <p>Donde más mayores hay, el PP sacó el ${sh(eMe, "PP")} de los votos; en los municipios más jóvenes, el ${sh(eJ, "PP")}.</p>${cubos("edad")}`},
    {id: "dinero", n: "El dinero", k: "Eje 4 · El dinero", t: "La renta", html: () => `
      <p>Ordenados por renta neta por persona (Atlas de renta del INE, ${T.fuentes.renta}), cada grupo reúne a una cuarta parte de la población. El cuarto con más renta vive en ${n(fmt(dA.n))} municipios; el de menos, en ${fmt(dB.n)}.</p>
      <p>En los municipios de renta alta el PP sacó el ${sh(dA, "PP")} y el PSOE el ${sh(dA, "PSOE")}; en los de renta baja, el ${sh(dB, "PP")} y el ${sh(dB, "PSOE")}.</p>${cubos("dinero")}`},
    {id: "espanas", n: "Las Españas", k: "Eje 5 · Las Españas", t: "Las Españas que no salen en el mapa autonómico", html: () => `
      <p>Hay regiones que comparten paisaje, economía y forma de vivir sin coincidir con una comunidad. Elige una para ver dónde está, cuánta gente vive en ella y cómo votó.</p>${espanas()}`},
    {id: "giro", n: "El giro", k: "Eje 6 · El giro", t: "Hacia dónde se movió el mapa", html: () => B23 && B19 ? `
      <p>Entre noviembre de 2019 y julio de 2023, el bloque de PP, Vox y Cs pasó del ${pct(B19.der, 1)} al ${n(pct(B23.der, 1))} de los votos, y el de PSOE y Sumar (Unidas Podemos en 2019), del ${pct(B19.izq, 1)} al ${n(pct(B23.izq, 1))}.</p>
      <p>El ${n(pct(aDer.length / conGiro.length, 0))} de los municipios se movió hacia la derecha. Cada flecha apunta a la derecha si ganó terreno el bloque de PP, Vox y Cs, y a la izquierda si lo ganó el de PSOE y Sumar; cuanto más larga, mayor el giro, y cuanto más gruesa, más votantes. Los partidos nacionalistas y regionalistas no cuentan en ninguno de los dos bloques.</p>` : `<p>No se han podido cargar los resultados municipales.</p>`},
    {id: "peso", n: "El peso del voto", k: "Eje 7 · El peso del voto", t: "Un voto, distinto peso", html: () => `
      <p>Los escaños no se reparten por municipios ni por territorio, sino por provincias. Cada una tiene dos fijos y el resto va por población.</p>
      <p>Por eso en ${esc(nombreP(ps[0].c))} un diputado representa a ${n(fmt(ps[0].h))} habitantes, y en ${esc(nombreP(ps[ps.length - 1].c))}, a ${n(fmt(ps[ps.length - 1].h))}: un voto de ${esc(nombreP(ps[0].c))} pesa ${dec(ps[ps.length - 1].h / ps[0].h, 1)} veces más.</p>`},
    {id: "fichas", n: "Las fichas", k: "Y ahora, tu provincia", t: "Cada provincia, cada municipio", html: () => `
      <p>Detrás de cada punto hay un municipio con su ficha: pulsa cualquiera en el mapa. Cada provincia tiene además su historia electoral desde 1977, y cada comunidad y provincia, su ficha geográfica.</p><p><a href="/elecciones/provincias/">Las 52 circunscripciones →</a><br><a href="/geografia/">La geografía de España, sin votos →</a></p>`},
  ];
  const caja = (p, i) => `<div class="geo-kicker">${esc(p.k)}</div><h3>${esc(p.t)}</h3>${p.html()}`;

  el.innerHTML = `<div class="geo-ctl" style="justify-content:space-between;margin-top:4px"><p class="nota" style="margin:0;max-width:70ch">Un mapa de los ${fmt(N)} municipios que se queda quieto mientras bajas. Pasa el cursor por los gráficos para iluminar cada grupo, o pulsa Presentar para recorrerlo en directo.</p>
      <button class="geo-pres-btn" data-presentar>Presentar ▶</button></div>
    <div class="geo-story"><div class="geo-pasos">${PASOS.map((p, i) => `<section class="geo-paso" data-paso="${i}" id="geo-paso-${i}"><div class="caja geo-caja">${caja(p, i)}</div></section>`).join("")}</div>
      <div class="geo-fijo"><nav class="geo-indice" aria-label="Ejes de la historia">${PASOS.map((p, i) => `<button data-ir-paso="${i}">${esc(p.n)}</button>`).join("")}</nav><canvas aria-label="Mapa de los municipios de España" role="img"></canvas><div class="pie" id="geo-pie"></div></div>
      <div class="geo-pres" aria-live="polite"><div class="caja geo-caja"></div><nav><button data-pres="-1" aria-label="Anterior">←</button><span></span><button data-pres="1" aria-label="Siguiente">→</button><button data-pres="salir">Salir</button></nav></div></div>
    <p class="nota" style="margin-top:22px">Datos: INE (padrón municipal ${M.anio} y ${M.anio0}, Atlas de distribución de renta de los hogares ${T.fuentes.renta}) y Ministerio del Interior (generales de noviembre de 2019 y julio de 2023, sin el voto desde el extranjero). Los grupos de renta reparten la población en cuartos; los municipios sin dato del Atlas quedan fuera de ese eje. «El corredor mediterráneo» toma provincias enteras.</p>`;

  // ---------- el lienzo ----------
  const canvas = el.querySelector("canvas"), g = canvas.getContext("2d"), pie = el.querySelector("#geo-pie"), story = el.querySelector(".geo-story");
  const W0 = GP.ancho, H0 = GP.alto, contornos = Object.values(GP.provincias).map(p => new Path2D(p.d)), recuadro = new Path2D(GP.canarias);
  const linea = () => cssVar("--line", "#DCDDD8"), gris = () => hexRgb(cssVar("--line-strong", "#82868E"));
  const colGana = d => d.gana != null ? hexRgb(F[ORD[d.gana]][1]) : gris();
  const rPob = d => Math.max(.5, Math.sqrt(d.pob) * .025);
  const der = hexRgb(colorBloque("PP")), izq = hexRgb(colorBloque("PSOE"));
  const leyGana = () => { const usados = ganadores.slice(0, 7).map(([k]) => k);
    return `<div class="geo-ley">${usados.map(k => `<span><i style="background:${F[ORD[k]][1]}"></i>${esc(partido(M, k))}</span>`).join("")}<span>· más votado el 23J</span></div>`; };
  const leyCubos = id => `<div class="geo-ley">${EJES[id].cubos.map(c => `<span><i style="background:${c.col}"></i>${esc(c.t)}</span>`).join("")}<span><i style="background:var(--line-strong)"></i>Sin dato</span></div>`;
  // Lo que pinta cada paso: radio, color y opacidad de cada punto, flechas sí o no, y la leyenda.
  function estado(){
    const p = PASOS[modo.paso].id;
    if (p === "engana") return {r: modo.tam === "pob" ? rPob : () => 1.8, c: colGana, a: () => modo.tam === "pob" ? .65 : .85, pie: leyGana()};
    if (EJES[p]){
      const cs = EJES[p].cubos, de = d => cs.find(c => c.f(d)), sel = cs.find(c => c.k === modo.cubo);
      const alto = rgbDe(EJES[p].alto || sel?.col || "#888");   // el grupo elegido, con el tono entero para que destaque
      if (sel) return {r: d => sel.f(d) ? Math.max(1.9, rPob(d)) : 1.1, c: d => sel.f(d) ? (EJES[p].alto ? alto : sel.rgb) : gris(), a: d => sel.f(d) ? .95 : .12, pie: leyCubos(p)};
      // Del tamaño de su gente (con un mínimo para que se vean los pueblos), como en «Por habitantes».
      return {r: d => Math.max(1.5, rPob(d)), c: d => de(d)?.rgb || gris(), a: d => de(d) ? .8 : .25, pie: leyCubos(p)};
    }
    if (p === "espanas"){
      const e = ESPANAS.find(x => x.k === modo.espana);
      return {r: d => e.set.has(d.c) ? Math.max(1.3, rPob(d)) : 1.1, c: d => e.set.has(d.c) ? colGana(d) : gris(), a: d => e.set.has(d.c) ? .8 : .1, pie: leyGana()};
    }
    if (p === "giro") return {r: () => 1, c: () => gris(), a: () => .14, flechas: 1,
      pie: `<div class="geo-ley"><span><i style="background:${colorBloque("PP")}"></i>→ hacia PP, Vox y Cs</span><span><i style="background:${colorBloque("PSOE")}"></i>← hacia PSOE y Sumar</span><span>· de 2019 a 2023</span></div>`};
    return {r: rPob, c: colGana, a: () => .7, pie: leyGana()};
  }
  const orden = D.map((d, i) => i).sort((a, b) => D[b].pob - D[a].pob);
  const cur = D.map(() => ({r: 1.8, c: [128, 128, 128], a: .8})), desde = cur.map(x => ({...x})), hacia = cur.map(x => ({...x}));
  let flechas = 0, flechas0 = 0, flechas1 = 0, anim = null, k = 1, ox = 0, oy = 0, dpr = 1;
  const medir = () => {
    const r = canvas.getBoundingClientRect(); dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    k = Math.min(r.width / W0, r.height / H0); ox = (r.width - W0 * k) / 2; oy = (r.height - H0 * k) / 2;
  };
  const dibujar = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
    g.save(); g.translate(ox, oy); g.scale(k, k);
    g.strokeStyle = linea(); g.lineWidth = .8 / k;
    contornos.forEach(p => g.stroke(p)); g.stroke(recuadro);
    const esc2 = Math.max(.75, Math.min(1.4, 1 / (k * 1.3)));
    for (const i of orden){
      const s = cur[i]; if (s.a <= .01) continue;
      g.globalAlpha = s.a; g.fillStyle = `rgb(${s.c[0]},${s.c[1]},${s.c[2]})`;
      g.beginPath(); g.arc(D[i].x, D[i].y, Math.max(.45, s.r * (s.r > 3 ? 1 : esc2)), 0, Math.PI * 2); g.fill();
    }
    if (flechas > .01){
      g.lineCap = "round";
      for (const i of orden){
        const d = D[i]; if (d.giro == null || !d.v) continue;
        const largo = Math.max(-26, Math.min(26, d.giro * .9)) * flechas, ancho = Math.min(4, .35 + Math.sqrt(d.v.votantes) / 110);
        if (Math.abs(largo) < .6) continue;
        const c = d.giro > 0 ? der : izq;
        g.globalAlpha = Math.min(.85, .35 + ancho / 5) * flechas; g.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.lineWidth = ancho;
        const x1 = d.x + largo, pu = Math.sign(largo) * Math.min(3, Math.abs(largo) * .4);
        g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(x1, d.y); g.moveTo(x1 - pu, d.y - pu * .7); g.lineTo(x1, d.y); g.lineTo(x1 - pu, d.y + pu * .7); g.stroke();
      }
    }
    g.restore(); g.globalAlpha = 1;
  };
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function aplicar(dur = 900){
    const E = estado();
    D.forEach((d, i) => { desde[i] = {...cur[i], c: [...cur[i].c]}; hacia[i] = {r: E.r(d), c: E.c(d), a: E.a(d)}; });
    flechas0 = flechas; flechas1 = E.flechas || 0;
    pie.innerHTML = E.pie;
    if (anim) cancelAnimationFrame(anim);
    const t0 = performance.now(), T0 = reducido ? 1 : dur, ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const frame = ahora => {
      const t = ease(Math.min(1, (ahora - t0) / T0));
      for (let i = 0; i < D.length; i++){
        const a = desde[i], b = hacia[i], s = cur[i];
        s.r = a.r + (b.r - a.r) * t; s.a = a.a + (b.a - a.a) * t;
        s.c = [0, 1, 2].map(q => Math.round(a.c[q] + (b.c[q] - a.c[q]) * t));
      }
      flechas = flechas0 + (flechas1 - flechas0) * t;
      dibujar();
      if (t < 1) anim = requestAnimationFrame(frame);
    };
    anim = requestAnimationFrame(frame);
  }

  // ---------- pasos, interacción y modo presentación ----------
  let presentando = false;
  const pres = el.querySelector(".geo-pres");
  function pintarDetalle(raiz){ raiz.querySelectorAll(".geo-esp-det").forEach(x => { x.innerHTML = detalleEspana(); }); }
  function ir(j, {forzar = false} = {}){
    j = Math.max(0, Math.min(PASOS.length - 1, j));
    if (j === modo.paso && !forzar) return;
    modo.paso = j; modo.cubo = null;
    el.querySelectorAll(".geo-paso").forEach(p => p.classList.toggle("activo", +p.dataset.paso === j));
    el.querySelectorAll("[data-ir-paso]").forEach(b => { const si = +b.dataset.irPaso === j; if (si){ b.setAttribute("aria-current", "step"); const nav = b.parentNode; if (b.offsetLeft < nav.scrollLeft || b.offsetLeft + b.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = b.offsetLeft - 8; } else b.removeAttribute("aria-current"); });
    if (presentando){
      pres.querySelector(".caja").innerHTML = caja(PASOS[j], j); pintarDetalle(pres);
      pres.querySelector("nav span").textContent = `${j + 1} / ${PASOS.length}`;
      pres.querySelector('[data-pres="-1"]').disabled = j === 0; pres.querySelector('[data-pres="1"]').disabled = j === PASOS.length - 1;
    }
    aplicar();
  }
  const irA = j => {
    if (presentando) return ir(j);
    const c = el.querySelector(`#geo-paso-${j} .caja`), r = c.getBoundingClientRect();
    window.scrollTo({top: scrollY + r.top - Math.max(80, (innerHeight - r.height) / 2), behavior: reducido ? "auto" : "smooth"});
  };
  const pasoDe = nodo => { const s = nodo.closest("[data-paso]"); return s ? +s.dataset.paso : modo.paso; };
  el.addEventListener("click", ev => {
    const t = ev.target;
    const ip = t.closest("[data-ir-paso]"); if (ip) return irA(+ip.dataset.irPaso);
    const tm = t.closest("[data-tam]"); if (tm){ modo.tam = tm.dataset.tam; el.querySelectorAll("[data-tam]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tam === modo.tam))); if (pasoDe(tm) !== modo.paso) ir(pasoDe(tm)); else aplicar(700); return; }
    const es = t.closest("[data-espana]"); if (es){ modo.espana = es.dataset.espana;
      el.querySelectorAll("[data-espana]").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.espana === modo.espana)); b.classList.toggle("on", b.dataset.espana === modo.espana); });
      pintarDetalle(el); if (pasoDe(es) !== modo.paso) ir(pasoDe(es)); else aplicar(600); return; }
    const cu = t.closest("[data-cubo]"); if (cu){ marcarCubo(cu, modo.cubo === cu.dataset.cubo ? null : cu.dataset.cubo); return; }
    const pr = t.closest("[data-presentar]"); if (pr) return presentar(true);
    const pn = t.closest("[data-pres]"); if (pn){ if (pn.dataset.pres === "salir") presentar(false); else ir(modo.paso + +pn.dataset.pres); }
  });
  function marcarCubo(nodo, k){
    const j = pasoDe(nodo); if (j !== modo.paso) ir(j);
    modo.cubo = k;
    el.querySelectorAll("[data-cubo]").forEach(x => x.classList.toggle("on", x.dataset.cubo === k && x.closest("[data-eje]") === nodo.closest("[data-eje]")));
    aplicar(350);
  }
  el.addEventListener("mouseover", ev => { const cu = ev.target.closest("[data-cubo]"); if (cu && cu.dataset.cubo !== modo.cubo) marcarCubo(cu, cu.dataset.cubo); });
  el.addEventListener("mouseout", ev => { const de = ev.target.closest("[data-eje]"); if (de && !de.contains(ev.relatedTarget) && modo.cubo){ marcarCubo(de, null); } });
  el.addEventListener("focusin", ev => { const cu = ev.target.closest("[data-cubo]"); if (cu) marcarCubo(cu, cu.dataset.cubo); });
  function presentar(si){
    presentando = si; story.classList.toggle("presentando", si);
    document.documentElement.style.overflow = si ? "hidden" : "";
    if (si) ir(modo.paso, {forzar: true});
    else { const j = modo.paso; requestAnimationFrame(() => { medir(); dibujar(); el.querySelector(`#geo-paso-${j}`)?.scrollIntoView({block: "center"}); }); }
  }
  const tecla = ev => {
    if (!presentando) return;
    if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(ev.key)){ ev.preventDefault(); ir(modo.paso + 1); }
    else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(ev.key)){ ev.preventDefault(); ir(modo.paso - 1); }
    else if (ev.key === "Escape") presentar(false);
  };
  document.addEventListener("keydown", tecla);

  medir();
  const ro = new ResizeObserver(() => { medir(); dibujar(); }); ro.observe(canvas);
  const io = new IntersectionObserver(es => { if (presentando) return; es.forEach(e => { if (e.isIntersecting) ir(+e.target.dataset.paso); }); }, {rootMargin: "-45% 0px -45% 0px"});
  el.querySelectorAll(".geo-paso").forEach(p => io.observe(p));
  pintarDetalle(el);
  // Al salir de la historia se deja de vigilar, se suelta el teclado y se sale del modo presentación.
  const limpiar = new MutationObserver(() => { if (!el.contains(canvas)){ io.disconnect(); ro.disconnect(); limpiar.disconnect(); document.removeEventListener("keydown", tecla); document.documentElement.style.overflow = ""; } });
  limpiar.observe(el, {childList: true});
  modo.paso = -1; ir(0);
  if (new URLSearchParams(location.search).has("presentar")) presentar(true);

  // Tooltip y clic: el municipio más cercano al puntero.
  const cercano = ev => {
    const r = canvas.getBoundingClientRect(), mx = (ev.clientX - r.left - ox) / k, my = (ev.clientY - r.top - oy) / k;
    let mejor = -1, dm = Infinity;
    for (let i = 0; i < D.length; i++){
      if (cur[i].a < .3 && !flechas) continue;
      const dx = D[i].x - mx, dy = D[i].y - my, d2 = dx * dx + dy * dy, lim = Math.max(cur[i].r, 5 / k);
      if (d2 < lim * lim && d2 - cur[i].r * cur[i].r < dm){ dm = d2 - cur[i].r * cur[i].r; mejor = i; }
    }
    return mejor;
  };
  canvas.addEventListener("mousemove", ev => {
    const i = cercano(ev); if (i < 0){ tip(""); return; }
    const d = D[i];
    tip(`<b>${esc(d.n)}</b> <small>${esc(nombreP(d.c.slice(0, 2)))}</small><br>${fmt(d.pob)} habitantes${d.pob0 ? ` (${signo(d.pob / d.pob0 - 1, 0)} desde ${M.anio0})` : ""}${d.may65 != null ? `<br>${dec(d.may65, 0)} % con 65 años o más` : ""}${d.renta != null ? ` · ${fmt(d.renta)} € por persona` : ""}${d.v ? `<br>23J: ${BLOQUES.slice(0, 4).map(([k2, t2]) => `${t2} ${pct(d.v[k2] / d.v.val, 0)}`).join(" · ")}` : ""}${d.giro != null && PASOS[modo.paso].id === "giro" ? `<br>Giro 2019→2023: ${d.giro > 0 ? "+" : "−"}${dec(Math.abs(d.giro), 1)} puntos hacia ${d.giro > 0 ? "PP, Vox y Cs" : "PSOE y Sumar"}` : ""}<br><small>Pulsa para ver su ficha</small>`, ev);
  });
  canvas.addEventListener("mouseleave", () => tip(""));
  canvas.addEventListener("click", ev => { const i = cercano(ev); if (i >= 0){ presentar(false); irA(`geografia-municipio-${D[i].c}`); } });
}
const modo = {paso: -1, cubo: null, tam: "mun", espana: "laponia"};
const rgbDe = s => s.startsWith("#") ? hexRgb(s) : s.match(/\d+/g).slice(0, 3).map(Number);
