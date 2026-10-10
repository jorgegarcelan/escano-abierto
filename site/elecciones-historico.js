/* Elecciones 29N · histórico (1977–2023): directorio y ficha de cada elección y legislatura, directorio y ficha de
   cada provincia, métricas, reparto de escaños por año, precio del escaño y mapa municipal.
   Lo carga elecciones.js al abrir uno de estos apartados. Datos: datos/elecciones/historico*.json, provincias/*.json,
   municipios-*.json y geo-*.json (ficheros oficiales de Interior e IGN, procesados en escano/historico.py). */
import {racimos, girasol, R_PUNTO} from "./elecciones.js";

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
  {id:"VOX", nombre:"Vox", color:"#5BA83A", familias:["VOX"]},
  {id:"OTROS", nombre:"Otros", color:"#5E636B", familias:["OTROS"]},
];
const GRUPO_DE = Object.fromEntries(GRUPOS.flatMap(g=>g.familias.map(f=>[f, g.id])));
const G8 = Object.fromEntries(GRUPOS.map(g=>[g.id, g]));
const CORTO = {IZQ:"IU-Podemos-Sumar", PSOE:"PSOE", NAC:"Nacionalistas", UCD:"UCD-CDS", CS:"Cs", PP:"PP", VOX:"Vox", OTROS:"Otros"};
const grupoDe = fam => G8[GRUPO_DE[fam] || "OTROS"];
/* El color de cada partido, el mismo que en el resto de la web (Sumar, magenta; Podemos, morado; IU, granate…).
   Las siglas cambian de una elección a otra (PSC, PSdeG-PSOE, AP-PDP, JxCAT-JUNTS, ERC-CATSÍ…): se reconocen por
   su comienzo. Si no se reconoce, el color de su familia. */
const COLORES_PARTIDO = [
  [/SUMAR/, "#C92F72"], [/PSOE|^P\.S\.O\.E/, "#D8342B"], [/^(PODEMOS|UNIDAS PODEMOS|UNIDOS PODEMOS|UP\b|EN COMU|ECP|EN MAREA)/, "#7B4BA8"],
  [/^(PCE|PSUC|IU|I\.U\.|IC\b|IC-|ICV|ICU|EUPV|EUIB|EU\b|EU-|EB\b|EB-|UG-EU|UPEC-IU|IZQUIERDA)|PCE\b/, "#A4243B"],
  [/^(MAS PAIS|M PAIS|MES COMPROM)/, "#2FA77A"], [/^COMPROMIS/, "#E07B39"],
  [/^(PSC|PSDEG|PSE\b|PSE-|PSIB|PSN|PSPV)/, "#D8342B"], [/^(PP|AP|CD|UPN-PP)\b|^P\.P|^PP-|^AP-/, "#2C7BC4"],
  [/^VOX\b/, "#5BA83A"], [/^C['´`’]S\b|^CS\b|^CIUDADANOS/, "#EB6109"], [/^(ERC|ESQUERRA|EC-FED|ERFN)/, "#E0A410"],
  [/^(JXCAT|JUNTS|CIU|CDC|DL|PDPC|PDECAT)\b|^JXCAT/, "#1FA8A0"], [/^(EH BILDU|BILDU|AMAIUR|HB)\b/, "#86A832"], [/^(EAJ-PNV|PNV|EAJ)\b|^E\.A\.J\.|P\.N\.V\./, "#2F7A4A"],
  [/^(BNG|B\.N\.G\.)/, "#6FB2DE"], [/^(CC|CCA|AIC)\b/, "#E8C21B"], [/^UCD\b/, "#E39A2D"], [/^(CDS|C\.D\.S\.)/, "#66C2A5"], [/^UPYD\b/, "#E0388C"],
  [/^(UPN|U\.P\.N\.)/, "#1D4F91"], [/^NA\+/, "#3B6FB6"], [/^(PRC|P\.R\.C\.)/, "#9BBF2E"], [/^(¡?TERUEL|EXISTE)/, "#0E7C66"], [/^CUP/, "#E2C400"],
  [/^PACMA/, "#7FB241"], [/^ADELANTE/, "#3C9A5A"], [/^(PA|PSA-PA|PSA)\b/, "#4BA05A"], [/^PAR\b/, "#D9A03A"], [/^UV\b/, "#4A6FA5"],
];
const colorPartido = (siglas, fam) => { const s = planoMay(siglas).trim(); return (COLORES_PARTIDO.find(([re])=>re.test(s)) || [, grupoDe(fam).color])[1]; };
/* El color de una familia en una elección concreta: el de su partido más votado (en 2023, la izquierda es Sumar). */
const colorFamEn = (id, e) => { if (id === "NAC" || id === "OTROS" || !e) return G8[id]?.color || G8.OTROS.color;
  const p = (e.partidos || []).filter(x=>(GRUPO_DE[x[2]] || "OTROS") === id).sort((a,b)=>b[3]-a[3])[0];
  return p ? colorPartido(p[0], p[2]) : G8[id].color; };

const CSS = `
.hi-anios{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.hi-anios button{appearance:none;font:500 12.5px var(--mono);border:1px solid var(--line);background:var(--surface);color:var(--muted);border-radius:var(--r-chip);padding:4px 7px;cursor:pointer}
.hi-anios button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.hi-anios .play{font-family:var(--sans);color:var(--ink);border-color:var(--line-strong);margin-right:6px}
.hi-top{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:18px;align-items:start}
@media (max-width:820px){ .hi-top{grid-template-columns:1fr} }
.hi-hemi{display:block;width:100%;height:auto}
.hi-hemi circle{fill:var(--sunk);transition:fill .55s ease;transition-delay:calc(var(--k) * 1.6ms)}
.hi-hemi .anio{font-family:var(--led,var(--display));font-weight:900;fill:var(--ink)}
.hi-tabla{width:100%;border-collapse:collapse;font-size:13px}
.hi-tabla td,.hi-tabla th{padding:6px 5px;border-top:1px solid var(--line);text-align:left;font-weight:400;vertical-align:baseline}
.hi-tabla th{color:var(--muted);font-size:11.5px;border-top:0;white-space:nowrap}
.hi-tabla th button{all:unset;cursor:pointer}
.hi-tabla th button:hover{color:var(--ink)}
.hi-tabla .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.hi-tabla i.d{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:0}
.hi-tabla .bar{display:inline-block;height:8px;border-radius:0 3px 3px 0;vertical-align:middle}
.hi-desliza{overflow-x:auto;-webkit-overflow-scrolling:touch}
.hi-svg{display:block;width:100%;height:auto;overflow:visible;max-width:100%}
.hi-svg .eje{stroke:var(--line);stroke-width:1}
.hi-svg .tick{font:11px var(--mono);fill:var(--muted)}
.hi-svg .lbl{font:600 12px var(--sans)}
.hi-svg .lbl-fuera{font:500 12px var(--sans);fill:var(--ink)}
.hi-svg .cruz{stroke:var(--ink);stroke-width:1;opacity:0;pointer-events:none}
.hi-svg .sel{stroke:var(--ink);stroke-width:1.5}
.hi-svg .banda{stroke:var(--surface);stroke-width:2;stroke-linejoin:round}
.hi-svg .linea{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;transition:opacity .2s}
.hi-svg .punto{stroke:var(--surface);stroke-width:2}
.hi-svg .prov{stroke:var(--surface);stroke-width:.7}
.hi-svg a:hover .prov,.hi-svg .prov:hover{stroke:var(--ink);stroke-width:1.4}
.hi-svg .muni{stroke:var(--surface);stroke-width:.35px}
.hi-svg .muni:hover{stroke:var(--ink);stroke-width:1.5px}
.hi-svg .can{fill:none;stroke:var(--line-strong);stroke-width:.8}
.hi-svg .clic{cursor:pointer}
.hi-tip{position:fixed;z-index:60;pointer-events:none;background:var(--surface);color:var(--ink);border:1px solid var(--line-strong);border-radius:8px;padding:8px 10px;font-size:12.5px;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:290px}
.hi-tip b{font-weight:600}
.hi-tip .f{display:flex;justify-content:space-between;gap:14px}
.hi-tip .f i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.hi-rampa{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);flex-wrap:wrap}
.hi-rampa span.r{display:inline-block;width:140px;height:9px;border-radius:2px}
.hi-dos{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:18px}
/* el precio de un escaño */
.pe-hero{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr);gap:18px 28px;align-items:center;margin-top:14px;background:var(--surface);border:var(--borde) solid var(--line);border-radius:var(--r-card-lg);box-shadow:var(--sombra);padding:20px 22px}
@media (max-width:820px){ .pe-hero{grid-template-columns:1fr} }
.pe-sel{display:flex;align-items:center;gap:8px;font-size:15px;margin-top:8px}
.pe-sel select{font:600 16px var(--sans);color:var(--ink);background:var(--sunk);border:1px solid var(--line-strong);border-radius:8px;padding:6px 10px}
.pe-n{display:grid;gap:2px;margin-top:12px}
.pe-n b{font-family:var(--led,var(--display));font-size:clamp(52px,7vw,84px);line-height:.9;font-weight:900;font-variant-numeric:tabular-nums}
.pe-n span{font-size:13px;color:var(--muted)}
.pe-frase{margin:12px 0 0;font-size:14.5px;line-height:1.5;color:var(--muted)}
.pe-frase b{color:var(--ink)}
.pe-balanza svg{display:block;width:100%;height:auto;overflow:visible}
.pe-bal-t{display:flex;justify-content:space-between;font:600 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.pe-balanza .eje{stroke:var(--line);stroke-width:1}
.pe-balanza circle{fill:color-mix(in srgb,var(--ink) 22%,var(--surface));stroke:var(--surface);stroke-width:1;cursor:pointer;transition:cx .9s cubic-bezier(.2,.8,.2,1),cy .9s cubic-bezier(.2,.8,.2,1),r .6s,fill .3s}
.pe-balanza circle:hover{fill:color-mix(in srgb,var(--ink) 55%,var(--surface))}
.pe-balanza circle.tu{fill:#4F7AA6;stroke:var(--ink);stroke-width:2}
.pe-balanza text{font:600 11px var(--sans);fill:var(--muted);pointer-events:none}
.pe-balanza text.tu{fill:var(--ink)}
.pe-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:4px 20px;padding:14px 0;margin-top:14px;border-block:1px solid var(--line)}
.pe-kpis div{display:grid;gap:2px}
.pe-kpis b{font-family:var(--led,var(--display));font-size:clamp(30px,4vw,42px);line-height:1;font-weight:900;font-variant-numeric:tabular-nums}
.pe-kpis span{font-size:12.5px;color:var(--muted);line-height:1.3}
.pe-kpis .alerta b{color:var(--no)}
.pe-mapa .prov{transition:fill .7s ease}
.pe-mapa .prov.tu{stroke:var(--ink);stroke-width:2.2}
.pe-coste{display:grid;gap:5px}
.pe-bar{display:grid;grid-template-columns:7.5em minmax(0,1fr) 5.5em;gap:10px;align-items:center;font-size:13px}
.pe-bar .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pe-bar .b{height:14px;background:var(--sunk);border-radius:3px;overflow:hidden}
.pe-bar .b i,.hi-ult .b i{width:0;transition:width .9s cubic-bezier(.2,.8,.2,1);transition-delay:var(--d,0ms)}
.pe-coste.ya .b i,.hi-ult.ya .b i{width:var(--w)}
.pe-bar .b i{display:block;height:100%;border-radius:0 5px 5px 0}
.pe-bar .v{font:12.5px var(--mono);text-align:right}
.pu-todas{margin-top:12px}
.pu-todas summary{cursor:pointer;font-size:13.5px;color:var(--muted)}
.pe-ve{display:block;width:100%;height:auto;overflow:visible}
.pe-ve .ejes line{stroke:var(--line);stroke-width:1}
.pe-ve .ejes text{font:10.5px var(--mono);fill:var(--muted)}
.pe-ve .ejes text.t{font:600 11px var(--sans)}
.pe-ve .diag{stroke:var(--ink);stroke-width:1.5;stroke-dasharray:5 4;opacity:.6}
.pe-ve .diag-t{font:italic 600 11px var(--sans);fill:var(--muted)}
.pe-ve [data-ve]{transition:transform 1s cubic-bezier(.2,.8,.2,1),opacity .5s;opacity:0;cursor:pointer}
.pe-ve [data-ve] circle{stroke:var(--surface);stroke-width:2;transition:fill .5s}
.pe-ve [data-ve]:hover circle{stroke:var(--ink)}
.pe-ve [data-ve] text{font:700 11px var(--sans);fill:var(--ink);paint-order:stroke;stroke:var(--surface);stroke-width:3px}
.pe-saldo{display:grid;gap:7px;margin-top:14px}
.pe-sal-t{margin:0 0 2px;font-size:13px;color:var(--muted)}.pe-sal-t b{color:var(--ink);font-family:var(--mono)}
.pe-sal-h,.pe-sal{display:grid;grid-template-columns:6.5em minmax(0,1fr) minmax(0,1fr) 2.6em;column-gap:0}
.pe-sal-h{font:600 10.5px var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.pe-sal-h span:first-child{grid-column:2;text-align:right;padding-right:8px}.pe-sal-h span:last-child{padding-left:8px}
.pe-sal{align-items:center;font-size:12.5px}
.pe-sal .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pe-sal .neg,.pe-sal .pos{display:flex;flex-wrap:wrap;gap:3px;min-height:11px;padding:2px 8px;box-sizing:border-box;max-width:calc(10*14px - 3px + 16px)}  /* de diez en diez */
.pe-sal .neg{flex-direction:row-reverse;justify-self:end;width:100%;border-right:1.5px solid var(--line-strong)}
.pe-sal .q{box-sizing:border-box;width:11px;height:11px;border-radius:2.5px;transform:scale(0);opacity:0;transition:transform .35s cubic-bezier(.3,1.6,.5,1) var(--d),opacity .2s var(--d)}
.pe-sal .pos .q{background:var(--c)}
.pe-sal .neg .q{border:1.5px dashed var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
.pe-saldo.ya .q{transform:none;opacity:1}
.pe-sal .v{font:600 12px var(--mono);text-align:right}
.pe-sal .v.mas{color:var(--si)}.pe-sal .v.menos{color:var(--no)}
@media (prefers-reduced-motion:reduce){.pe-sal .q{transition:none}}
.ps{background:linear-gradient(180deg,color-mix(in srgb,var(--no) 6%,var(--surface)),var(--surface))}
.ps-t{font-size:clamp(20px,2.8vw,26px);margin:4px 0 6px}
.ps-c{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(220px,1fr);gap:14px 26px;align-items:center;margin-top:10px}
@media (max-width:760px){ .ps-c{grid-template-columns:1fr} }
.ps-hemi .hi-hemi{max-width:520px;margin:0 auto}
.ps-cifras{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ps-cifras div{display:grid;gap:2px}
.ps-cifras b{font-family:var(--led,var(--display));font-size:clamp(30px,4.4vw,46px);line-height:1;font-weight:900;font-variant-numeric:tabular-nums}
.ps-cifras span{font-size:12.5px;color:var(--muted);line-height:1.3}
.ps-g{display:grid;gap:3px;margin-top:12px}
.ps-g div{display:grid;grid-template-columns:10px minmax(0,1fr) 3em 3em;gap:8px;align-items:center;font-size:13px;padding:3px 6px;border-radius:6px;transition:background .3s}
.ps-g i{width:10px;height:10px;border-radius:50%}
.ps-g b{font-family:var(--mono);text-align:right}
.ps-g small{font:700 12px var(--mono);text-align:right}
.ps-g .mas{background:color-mix(in srgb,var(--si) 14%,transparent)}.ps-g .mas small{color:var(--si)}
.ps-g .menos{background:color-mix(in srgb,var(--no) 14%,transparent)}.ps-g .menos small{color:var(--no)}
.ps-esc{margin-top:16px;padding:12px 14px 6px;border:1px solid var(--line);border-radius:12px;background:var(--surface);position:relative}
.ps-esc-h{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;font-size:13px;color:var(--muted)}
.ps-esc-h b{color:var(--ink);font-weight:600}
.ps-btns{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.ps-menos{font-size:12px;color:var(--muted);margin:0 2px 0 6px}
.ps-btns button{all:unset;cursor:pointer;padding:4px 10px;border:1px solid var(--line);border-radius:999px;font:600 11.5px var(--mono);color:var(--ink);background:var(--sunk)}
.ps-btns button:hover{border-color:var(--line-strong)}.ps-btns button:focus-visible{outline:2px solid var(--no)}
.ps-btns [data-ps-play]{background:var(--no);border-color:var(--no);color:#fff}
[data-ps-esc]{display:block;width:100%;height:auto;margin-top:6px;cursor:ew-resize;touch-action:pan-y;user-select:none;-webkit-user-select:none}
[data-ps-esc] .ejes line{stroke:var(--line);stroke-dasharray:2 3}
[data-ps-esc] .ejes text{font:10px var(--mono);fill:var(--muted)}
[data-ps-esc] .esc{fill:none;stroke:var(--line-strong);stroke-width:1;stroke-linejoin:round}
[data-ps-esc] .base{stroke:var(--line-strong)}
[data-ps-esc] .ptos circle{fill:var(--surface);stroke:var(--c);stroke-width:1.5;stroke-opacity:.7;transition:fill .4s ease var(--d),r .2s,stroke .2s}
[data-ps-esc] .ptos circle.si{fill:var(--c);stroke:var(--surface);stroke-opacity:1}
[data-ps-esc] .ptos circle.ult{r:6.5;stroke:var(--ink);stroke-width:2}
[data-ps-esc] .ptos circle.h{r:6.5;stroke:var(--ink);stroke-width:2}
[data-ps-esc] .guia{transition:opacity .2s}
[data-ps-esc] .guia line{stroke:var(--ult,var(--no));stroke-width:1;stroke-dasharray:3 3;opacity:.7}
[data-ps-esc] .guia text{font:700 10.5px var(--mono);fill:var(--ult,var(--no));transition:fill .3s}
[data-ps-esc] .d0{stop-color:var(--ult,var(--no));stop-opacity:.42;transition:stop-color .3s}
[data-ps-esc] .d1{stop-color:var(--ult,var(--no));stop-opacity:.04;transition:stop-color .3s}
[data-ps-esc] .area{fill:url(#ps-deg)}
[data-ps-esc] .cursor line{stroke:var(--no);stroke-width:1.5}
[data-ps-esc] .cursor circle{fill:var(--no);stroke:var(--surface);stroke-width:2}
[data-ps-esc] .cursor text{font:700 11.5px var(--mono);fill:var(--ink)}
.ps-esc:focus-within{outline:2px solid color-mix(in srgb,var(--no) 50%,transparent)}
.ps-tr{margin-top:18px}
.ps-tr .nota{margin:6px 0 0}
.ps-fl-t{display:flex;justify-content:space-between;margin-top:8px;font:600 10.5px var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
[data-ps-flujo]{display:block;width:100%;height:auto;margin-top:4px;overflow:visible}
[data-ps-flujo] .hilo{fill:none;opacity:.78;cursor:pointer;transition:opacity .2s}
[data-ps-flujo] .hilo.nuevo{stroke-dasharray:1;stroke-dashoffset:1;animation:ps-dib .7s cubic-bezier(.3,.7,.3,1) forwards}
@keyframes ps-dib{to{stroke-dashoffset:0}}
[data-ps-flujo]:hover .hilo{opacity:.35}[data-ps-flujo] .hilo:hover{opacity:1}
[data-ps-flujo] .hilo.fuera,[data-ps-flujo]:hover .hilo.fuera{opacity:.07}
[data-ps-flujo] .nodo{cursor:pointer}
[data-ps-flujo] .nodo text{font:600 12.5px var(--sans,inherit);fill:var(--ink)}
[data-ps-flujo] .nodo .mas{fill:var(--si);font-family:var(--mono)}[data-ps-flujo] .nodo .menos{fill:var(--no);font-family:var(--mono)}
[data-ps-flujo] .nodo:hover rect,[data-ps-flujo] .nodo.on rect{stroke:var(--ink);stroke-width:1.5}
[data-ps-flujo].sel .nodo:not(.on) text{opacity:.5}
.ps-ayuda{margin:10px 0 2px;font-size:12.5px;color:var(--muted)}
.ps-fil{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:10px 0 2px;font-size:13px;color:var(--muted)}
.ps-fil b{display:inline-flex;align-items:center;gap:5px;color:var(--ink)}.ps-fil i{width:9px;height:9px;border-radius:50%}
.ps-fil button{all:unset;cursor:pointer;margin-left:4px;padding:2px 9px;border:1px solid var(--line);border-radius:999px;font-size:12px;color:var(--ink)}
.ps-par{display:grid;grid-template-columns:minmax(0,15em) minmax(0,1fr);gap:4px 12px;align-items:start;padding:7px 0;border-top:1px solid var(--line)}
.ps-par:first-of-type{border-top:0}
@media (max-width:640px){ .ps-par{grid-template-columns:1fr} }
.ps-dir{display:flex;align-items:center;gap:5px;font-size:12.5px;font-weight:600;min-width:0;padding-top:3px}
.ps-dir i{width:8px;height:8px;border-radius:50%;flex:none}
.ps-dir em{font-style:normal;color:var(--muted);margin:0 1px}
.ps-dir b{margin-left:auto;font:700 13px var(--mono);padding-left:8px}
.ps-pv{display:flex;flex-wrap:wrap;gap:4px}
.ps-pv button{all:unset;cursor:pointer;padding:2px 8px;border-radius:999px;background:var(--sunk);border:1px solid var(--line);font-size:11.5px}
.ps-pv button:hover{border-color:var(--line-strong);color:var(--ink)}
.ps-pv button.nuevo{animation:pe-pop .35s ease}
@media (prefers-reduced-motion:reduce){ [data-ps-flujo] .hilo.nuevo{animation:none;stroke-dashoffset:0} }
.pv-ctl{display:grid;gap:10px;margin-bottom:12px}
.pv-ctl{min-width:0}
.pv-ctl .hi-seg{display:flex;width:max-content;max-width:100%;overflow-x:auto;scrollbar-width:none}
.pv-ctl .hi-seg button{white-space:nowrap;flex:none}
.pv-top{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(220px,1fr);gap:16px;align-items:start}
@media (max-width:820px){ .pv-top{grid-template-columns:1fr} }
.pv-mapa-w h3{margin:0 0 6px}
#pv-mapa path.prov{transition:fill .6s ease;cursor:pointer}
#pv-mapa path.prov:hover{stroke:var(--ink);stroke-width:1.5}
.pv-res{display:grid;gap:4px;align-content:start}
.pv-res .eyebrow{margin:8px 0 2px}.pv-res .eyebrow:first-child{margin-top:0}
.pv-cuenta{display:grid;grid-template-columns:minmax(0,7.5em) minmax(0,1fr) 2em;gap:8px;align-items:center;font-size:13px}
.pv-cuenta .nm{display:flex;align-items:center;gap:6px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv-cuenta .nm i{width:9px;height:9px;border-radius:50%;flex:none}
.pv-cuenta .br{height:8px;background:var(--sunk);border-radius:99px;overflow:hidden}
.pv-cuenta .br i{display:block;height:100%;border-radius:99px;transition:width .6s ease}
.pv-cuenta b{font:700 13px var(--mono);text-align:right}
.pv-top-f{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:4px 0;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none}
.pv-top-f:hover span{text-decoration:underline}
.pv-top-f b{font:600 12.5px var(--mono);white-space:nowrap}
.pv-tira{display:grid;gap:2px;font-size:12px}
.pv-fila{display:grid;grid-template-columns:minmax(0,9.5em) repeat(16,minmax(0,1fr));gap:2px;align-items:center;border-radius:4px}
.pv-fila > a{color:var(--ink);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:6px}
.pv-fila > a:hover{text-decoration:underline}
.pv-fila i{display:block;height:13px;border-radius:2px;background:var(--c);transition:transform .35s ease var(--d),opacity .35s ease var(--d),background .5s,box-shadow .2s;cursor:pointer}
.pv-tira.espera .pv-fila i{transform:scaleX(0);opacity:0}
.pv-fila:not(.pv-cab):hover{background:var(--sunk)}
.pv-fila:not(.pv-cab):hover > a{font-weight:600}
.pv-fila i.sel{box-shadow:0 0 0 1.5px var(--ink)}
.pv-cab{position:sticky;top:var(--nav-h,56px);z-index:2;background:var(--surface);padding:4px 0}
.pv-cab button{all:unset;cursor:pointer;text-align:center;font:600 10px var(--mono);color:var(--muted);padding:3px 0;border-radius:4px}
.pv-cab button:hover{color:var(--ink);background:var(--sunk)}
.pv-cab button.sel{color:var(--bg);background:var(--ink)}
.pv-ca{margin:8px 0 1px;font:600 10.5px var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
@media (max-width:560px){ .pv-fila{grid-template-columns:minmax(0,6.5em) repeat(16,minmax(0,1fr));gap:1.5px} .pv-fila i{height:11px} .pv-cab button{font-size:9px;letter-spacing:-.02em} .pv-cab .ap{display:none} }
#pv-busca{font:inherit;font-size:13px;padding:6px 10px;border-radius:999px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);min-width:200px}
.pv-tabla tbody tr{cursor:pointer}
.pv-tabla tbody tr:hover{background:var(--sunk)}
.pv-esc{display:inline-flex;align-items:center;gap:8px;justify-content:flex-end}
.pv-chispa{width:66px;height:20px;display:block}
.pv-chispa path{fill:none;stroke:var(--muted);stroke-width:1.4}
.pv-chispa circle{fill:var(--ink)}
.pv-part{display:inline-block;width:56px;height:6px;border-radius:99px;background:var(--sunk);margin-right:8px;vertical-align:middle;overflow:hidden}
.pv-part i{display:block;height:100%;background:var(--muted);border-radius:99px}
.pv-chip{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:12.5px}
.pv-chip::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--c)}
@media (prefers-reduced-motion:reduce){ .pv-fila i,#pv-mapa path.prov{transition:none} }
.pe-sim{min-width:0;max-width:100%;overflow:hidden}
.pe-sim-h{display:flex;gap:16px 28px;align-items:center;justify-content:space-between}
.pe-sim-tx{flex:1 1 auto;min-width:0}
.pe-silueta{flex:none;margin:0;width:clamp(76px,13vw,128px);display:grid;gap:4px;justify-items:center}
.pe-silueta svg{display:block;width:100%;height:clamp(76px,13vw,128px);overflow:visible}
.pe-silueta path{fill:color-mix(in srgb,var(--c,var(--ink)) 24%,transparent);stroke:var(--ink);stroke-width:1.6;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:pe-sil 1.4s ease forwards;transition:fill .5s}
@keyframes pe-sil{0%{stroke-dashoffset:1;fill-opacity:0}55%{fill-opacity:0}100%{stroke-dashoffset:0;fill-opacity:1}}
.pe-silueta figcaption{font:600 10.5px var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
@media (max-width:560px){ .pe-sim-h{align-items:flex-start} .pe-silueta{width:64px} .pe-silueta svg{height:64px} }
@media (prefers-reduced-motion:reduce){ .pe-silueta path{animation:none;stroke-dashoffset:0} }
.pe-sim-h h3{font-size:clamp(19px,2.6vw,24px);margin:4px 0 6px;line-height:1.3}
.pe-sim-h select{font:inherit;font-weight:700;color:var(--ink);background:var(--sunk);border:1px solid var(--line-strong);border-radius:8px;padding:1px 6px}
.pe-sim-h .sub{margin:0;max-width:64ch}
.pe-sim-c{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(200px,1fr);gap:18px 32px;align-items:start;margin-top:16px}
@media (max-width:820px){ .pe-sim-c{grid-template-columns:1fr} }
.pe-ctl{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.pe-ctl button{all:unset;cursor:pointer;padding:6px 12px;border-radius:999px;font:600 12.5px var(--sans,inherit);border:1px solid var(--line-strong);color:var(--ink);white-space:nowrap}
.pe-ctl button:hover{background:var(--sunk)}
.pe-ctl .pri{background:var(--ink);color:var(--bg);border-color:var(--ink)}.pe-ctl .pri:hover{background:var(--ink);opacity:.88}
.pe-ctl button:focus-visible{outline:2px solid var(--no);outline-offset:2px}
.pe-barras{display:grid;gap:5px;position:relative}
.pe-b,.pe-b-h{display:grid;grid-template-columns:minmax(0,6.5em) minmax(0,1fr) 10.5em 7em;gap:10px;align-items:center}
.pe-b .cq{font:11.5px var(--mono);color:var(--muted);text-align:right;white-space:nowrap}.pe-b .cq b{color:var(--ink);font-weight:600}
@media (max-width:560px){ .pe-b,.pe-b-h{grid-template-columns:minmax(0,5em) minmax(0,1fr) 6.6em 3.6em;gap:6px} .pe-b .cq .vv{display:none} }   /* columnas fijas: todas las barras, en la misma escala */
.pe-b-h{font:600 10.5px var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted);min-height:14px}
.pe-b-h > span:last-child{text-align:left}
.pe-b .n{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pe-b .t,.pe-b-h .t{position:relative;height:22px;display:block}
.pe-b-h .t{height:14px}
.pe-b .t i{position:absolute;left:0;top:3px;bottom:3px;width:var(--w,0%);background:var(--c);border-radius:2px;transition:width .5s cubic-bezier(.3,.7,.3,1),box-shadow .25s,opacity .3s}
.pe-b .s{display:flex;align-items:center;gap:6px}
.pe-b .s b{font:700 14px var(--mono);min-width:1.2em;text-align:right}
.pe-b .s .q{display:flex;flex-wrap:wrap;gap:2px;align-content:center}
.pe-b .s .q i{width:8px;height:8px;border-radius:1.5px;background:var(--c);animation:pe-pop .3s ease}
.pe-b.fuera .t i{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--c) 45%,transparent) 0 3px,transparent 3px 6px)}
.pe-b.fuera .n{color:var(--muted)}
.pe-b.toca .t i{box-shadow:0 0 0 2px var(--surface),0 0 0 3.5px var(--c)}
.pe-b.toca .n{color:var(--c)}
.pe-barras.fin .pe-b .t::after,.pe-barras.fin .pe-b-h .t::after{content:"";position:absolute;left:var(--l);top:-3px;bottom:-3px;border-left:1.5px dashed var(--ink);opacity:.55}
.pe-barras.fin .pe-b-h .t::after{display:none}
.lin-t{position:absolute;left:var(--l,0%);transform:translateX(-50%);white-space:nowrap;text-transform:none;letter-spacing:0;color:var(--ink);font-weight:600}
.pe-paso{min-height:2.8em;margin:12px 0 0;font-size:13.5px;line-height:1.45;color:var(--muted)}
.pe-paso b{color:var(--ink)}
.pe-paso-n{display:inline-block;font:700 10.5px var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--ink);background:var(--sunk);border-radius:999px;padding:2px 8px;margin-right:4px}
.pe-sillas-w{min-width:0}
.pe-sillas{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:6px;margin-top:8px}
.pe-sillas.muchas{grid-template-columns:repeat(auto-fill,minmax(30px,1fr));gap:4px}
.pe-silla{position:relative;min-height:58px;border:1.5px dashed var(--line-strong);border-radius:8px;padding:6px 7px;display:grid;align-content:space-between;gap:2px;transition:background .3s,border-color .3s}
.pe-silla .k{font:600 10px var(--mono);opacity:.7}
.pe-silla b{font-size:12.5px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pe-silla small{font:10.5px var(--mono);opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pe-silla.llena{background:var(--c);border:1.5px solid var(--c)}
.pe-silla.llena .k{opacity:.8}
.pe-silla.nueva{animation:pe-silla .45s cubic-bezier(.3,1.5,.5,1)}
@keyframes pe-silla{from{transform:scale(.6);opacity:.2}to{transform:none;opacity:1}}
.pe-sillas.muchas .pe-silla{min-height:30px;padding:3px;border-radius:5px;place-items:center}
.pe-sillas.muchas .pe-silla b,.pe-sillas.muchas .pe-silla small{display:none}
.pe-sillas.muchas .pe-silla .k{font-size:9px}
.pe-votos{margin-top:22px;border-top:1px solid var(--line)}
.pe-votos-h{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;padding:12px 0 6px;font-size:13px;color:var(--muted)}
.pe-votos-h > b{color:var(--ink);font-size:14px}
.pe-voto{display:grid;grid-template-columns:minmax(0,9em) minmax(0,1fr) 7.5em auto;gap:14px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line);font-size:13px;transition:opacity .3s}
.pe-voto.fuera{opacity:.55}
.pe-voto .n{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:7px}
.pe-voto .n::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--c);flex:none}
.pe-voto .v{display:flex;gap:6px;justify-content:flex-end;align-items:baseline;font-family:var(--mono)}
.pe-voto .v b{font-weight:600;font-size:12.5px}
.pe-voto .v small{font-size:10.5px;font-weight:600}.pe-voto .v .sube{color:var(--si)}.pe-voto .v .baja{color:var(--no)}
.pe-voto input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:2px;margin:0;background:linear-gradient(90deg,var(--c) var(--p,50%),var(--line-strong) var(--p,50%));outline:none;cursor:pointer}
.pe-voto input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--c);border:2px solid var(--surface);cursor:grab}
.pe-voto input[type=range]::-moz-range-thumb{width:11px;height:11px;border-radius:50%;background:var(--c);border:2px solid var(--surface);cursor:grab}
.pe-voto input[type=range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 40%,transparent)}
.pe-voto .mas{all:unset;cursor:pointer;font:600 12px var(--sans,inherit);color:var(--muted);white-space:nowrap;padding:2px 0;border-bottom:1px dashed var(--line-strong)}
.pe-voto .mas:hover{color:var(--ink);border-bottom-color:var(--ink)}
.pe-voto .mas:disabled{opacity:.35;cursor:default}
.pe-voto .mas:focus-visible{outline:2px solid var(--no);outline-offset:2px}
@media (max-width:560px){ .pe-voto{grid-template-columns:minmax(0,1fr) auto auto;gap:6px 12px} .pe-voto input{grid-column:1/-1;grid-row:2} }
.pe-votos .nota{margin:8px 0 0}
@keyframes pe-pop{from{transform:scale(0)}to{transform:scale(1)}}
.pe-flip{min-height:30px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;opacity:0;transform:translateY(6px)}
.pe-flip.si{animation:pe-flip 2.6s ease forwards}
.pe-flip span{font:700 14px var(--mono);padding:4px 10px;border-radius:var(--r-pill);background:var(--sunk)}
.pe-flip .mas{background:color-mix(in srgb,var(--si) 25%,var(--surface));color:var(--ink)}
.pe-flip .menos{background:color-mix(in srgb,var(--no) 25%,var(--surface));color:var(--ink)}
@keyframes pe-flip{0%{opacity:0;transform:translateY(6px) scale(.96)}12%{opacity:1;transform:none}80%{opacity:1}100%{opacity:.0}}
.hi-coc td.ahora{outline:2px solid var(--no);outline-offset:1px;color:var(--ink)}
@media (prefers-reduced-motion:reduce){ .pe-b .t i{transition:none} }
.hi-coc td{transition:background .3s,color .3s}
.hi-seg{display:inline-flex;border:1px solid var(--line);border-radius:var(--r-pill);overflow:hidden;background:var(--surface);margin:2px 0 4px}
.hi-seg button{appearance:none;border:0;background:none;font:500 12.5px var(--sans);color:var(--muted);padding:5px 12px;cursor:pointer}
.hi-seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.hi-ult{display:grid;gap:2px;max-height:460px;overflow:auto;padding-right:4px}
.hi-ult button{all:unset;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,8.5em) minmax(0,1fr) minmax(0,9em) 4.5em;gap:10px;align-items:center;font-size:12.5px;padding:4px 6px;border-radius:6px;cursor:pointer}
.hi-ult button:hover,.hi-ult button:focus-visible{background:var(--sunk)}
.hi-ult .p{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hi-ult .b{height:10px;background:var(--sunk);border-radius:2px;overflow:hidden}
.hi-ult .b i{display:block;height:100%;border-radius:0 4px 4px 0}
.hi-ult .q{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hi-ult .q b{color:var(--ink)}
.hi-ult .m{font:12px var(--mono);text-align:right}
@media (max-width:640px){ .hi-ult button{grid-template-columns:minmax(0,1fr) 4.5em} .hi-ult .b{grid-column:1/-1;grid-row:2} .hi-ult .q{display:none} }
.hi-coc-c{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}
.hi-coc-c h4{margin:0 0 4px;font-size:14px}
.hi-coc{overflow-x:auto;max-width:100%}
.hi-coc-c,.pe-sim-c,.pe-sim-h,.pe-sim-filas{min-width:0}
.hi-coc table{border-collapse:separate;border-spacing:2px;font-size:12px}
.hi-coc th{font-weight:600;text-align:left;white-space:nowrap;padding:3px 6px;color:var(--muted)}
.hi-coc th i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}
.hi-coc td{font-family:var(--mono);text-align:right;padding:4px 7px;border-radius:4px;background:var(--sunk);color:var(--muted);white-space:nowrap;transition:background .25s}
.hi-coc td.ult{outline:2px solid var(--ink);outline-offset:1px}
.hi-coc td.sig{outline:2px dashed var(--ink);outline-offset:1px;color:var(--ink)}
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
.hi-cartas{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr));gap:10px}
.hi-carta{display:grid;gap:4px;text-decoration:none;color:var(--ink);background:var(--surface);border:var(--borde) solid var(--line);border-radius:var(--r-card);padding:10px 12px 12px;transition:border-color .2s,transform .2s}
.hi-carta:hover{border-color:var(--line-strong);transform:translateY(-2px);text-decoration:none}
.hi-carta svg{display:block;width:100%;height:auto}
.hi-carta b{font-family:var(--led,var(--display));font-size:22px;font-weight:900;line-height:1}
.hi-carta small{font-size:12px;color:var(--muted);line-height:1.3}
.hi-pasos{display:flex;justify-content:space-between;gap:10px;font-size:13.5px;padding:2px 0 8px}
.hi-pasos a{text-decoration:none;color:var(--muted)}
.hi-pasos a:hover{color:var(--ink)}
.hi-caja{display:grid;gap:6px;font-size:13.5px}
.hi-caja dt{color:var(--muted);font-size:12px}
.hi-caja dd{margin:0 0 6px}
.hi-cocientes{border-collapse:separate;border-spacing:2px;font:12px var(--mono)}
.hi-cocientes th{font-weight:500;color:var(--muted);padding:2px 6px;text-align:right;white-space:nowrap}
.hi-cocientes th.c{text-align:left;font-family:var(--sans);color:var(--ink)}
.hi-cocientes td{padding:3px 6px;text-align:right;border-radius:3px;background:var(--sunk);color:var(--muted);white-space:nowrap}
.hi-cocientes td.g{color:#fff;font-weight:600}
.hi-cocientes td.u{outline:2px solid var(--ink);outline-offset:-2px}
.hi-chips{display:flex;flex-wrap:wrap;gap:6px}
.hi-chips button,.hi-chips a{appearance:none;display:inline-flex;align-items:center;gap:6px;font:500 12.5px var(--sans);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:var(--r-pill);padding:4px 10px;cursor:pointer;text-decoration:none}
.hi-chips button[aria-pressed="true"]{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
.hi-chips i{width:9px;height:9px;border-radius:50%;display:inline-block}
.hi-reparto{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:18px;align-items:start}
@media (max-width:820px){ .hi-reparto{grid-template-columns:1fr} }
.hi-reparto circle{transition:cx .9s cubic-bezier(.6,0,.3,1),cy .9s cubic-bezier(.6,0,.3,1),fill .6s,opacity .5s;stroke:var(--surface);stroke-width:.8}
`;

let ctx = null, HIST = null, GEO = null;
const cache = {};
const pedir = url => cache[url] ||= fetch(url).then(r=>r.ok?r.json():null).catch(()=>null);
const base = () => Promise.all([pedir("datos/elecciones/historico.json"), pedir("datos/elecciones/geo-provincias.json")]).then(([h, g])=>{ HIST = h; GEO = g; return h; });

function estilos(){
  if (document.getElementById("hi-css")) return;
  const s = document.createElement("style"); s.id = "hi-css"; s.textContent = CSS; document.head.appendChild(s);
}
const fmt = n => (n < 0 ? "−" : "") + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");   // con punto de miles también en 1.000
const fmtCorto = n => n >= 1e6 ? (n/1e6).toLocaleString("es-ES", {maximumFractionDigits:2}) + " M" : fmt(n);
const pct = (x, d=1) => (x*100).toLocaleString("es-ES", {minimumFractionDigits:d, maximumFractionDigits:d}) + " %";
const dec = (x, d=2) => x.toLocaleString("es-ES", {minimumFractionDigits:d, maximumFractionDigits:d});
const conSigno = (x, f=fmt) => (x > 0 ? "+" : x < 0 ? "−" : "±") + f(Math.abs(x));
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const anio = e => e.fecha.slice(0,4) + (e.id==="201904" ? "-A" : e.id==="201911" ? "-N" : "");
const anioLargo = e => { const [y,m,d]=e.fecha.split("-").map(Number); return `${d} de ${MESES[m-1]} de ${y}`; };
export const slugE = e => e.fecha.slice(0,4) + (e.id==="201904" ? "-abril" : e.id==="201911" ? "-noviembre" : "");
const enlaceE = e => `#elecciones-${slugE(e)}`;
const nombreProv = cod => GEO?.provincias[cod]?.circ || cod;
const slugProv = cod => ctx.slug(nombreProv(cod));
const enlaceProv = cod => `#elecciones-provincia-${slugProv(cod)}`;
const duracion = (a, b) => { const d = (new Date(b) - new Date(a))/864e5, anos = Math.floor(d/365.25), meses = Math.round((d - anos*365.25)/30.44);
  return anos ? `${anos} ${anos===1?"año":"años"}${meses?` y ${meses} ${meses===1?"mes":"meses"}`:""}` : `${meses} ${meses===1?"mes":"meses"}`; };

/* ---------- tooltip propio para mapas y gráficos (el de la web, data-tip, para lo demás) ---------- */
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
const conTip = (el, fn) => { if (!el) return; el.addEventListener("mousemove", ev=>tip(fn(ev), ev)); el.addEventListener("mouseleave", ()=>tip("")); };
const filaTip = (color, nombre, valor) => `<div class="f"><span><i style="background:${color}"></i>${esc(nombre)}</span><b>${valor}</b></div>`;

/* ---------- datos agregados ---------- */
function porGrupo(fam){
  const out = Object.fromEntries(GRUPOS.map(g=>[g.id, [0,0]]));
  for (const [f, [v, e]] of Object.entries(fam||{})){ const g = GRUPO_DE[f] || "OTROS"; out[g][0] += v; out[g][1] += e; }
  return out;
}
const porGrupoLista = c => { const out = Object.fromEntries(GRUPOS.map(g=>[g.id, [0,0]])); c.forEach(x=>{ const g = GRUPO_DE[x[1]]||"OTROS"; out[g][0] += x[2]; out[g][1] += x[3]; }); return out; };
const primera = g => GRUPOS.filter(x=>x.id!=="OTROS").reduce((a,b)=>g[b.id][1] > g[a.id][1] || (g[b.id][1]===g[a.id][1] && g[b.id][0] > g[a.id][0]) ? b : a);
const textoSobre = hex => { const n=parseInt(hex.slice(1),16), r=n>>16&255, g=n>>8&255, b=n&255; return (0.299*r+0.587*g+0.114*b) > 150 ? "#08090B" : "#FFFFFF"; };
function hexRgb(h){ h = h.replace("#",""); if (h.length===3) h = h.split("").map(c=>c+c).join(""); const n=parseInt(h,16); return [n>>16&255, n>>8&255, n&255]; }
/* Rampa secuencial de un solo tono: del color de la superficie al de la familia. */
function rampa(hex){
  const sup = getComputedStyle(document.documentElement).getPropertyValue("--sunk").trim() || "#EDEEEA";
  const a = hexRgb(sup.startsWith("#") ? sup : "#EDEEEA"), b = hexRgb(hex);
  return t => { t = Math.max(0, Math.min(1, t)); const c = a.map((x,i)=>Math.round(x + (b[i]-x)*(0.12 + 0.88*t))); return `rgb(${c.join(",")})`; };
}
const NEUTRO = "#5E7FA3";

/* Hemiciclo genérico de N escaños (mismo algoritmo que la web). */
const _asientos = {};
function asientos(N){
  if (_asientos[N]) return _asientos[N];
  const filas = N>200 ? 12 : Math.max(2, Math.round(Math.sqrt(N/1.8))), r0 = N>200 ? .4 : .32;
  const radios = Array.from({length:filas},(_,i)=>r0+(1-r0)*i/Math.max(1,filas-1));
  const suma = radios.reduce((a,b)=>a+b,0), n = radios.map(r=>Math.round(N*r/suma));
  n[filas-1] += N - n.reduce((a,b)=>a+b,0);
  const out = [];
  radios.forEach((r,i)=>{ for(let j=0;j<n[i];j++){ const a=Math.PI*(1-j/Math.max(1,n[i]-1)); out.push({a, r, x:100*r*Math.cos(a), y:-100*r*Math.sin(a)}); } });
  out.sort((p,q)=>q.a-p.a || p.r-q.r);
  const paso = Math.min(...radios.map((r,i)=>n[i]>1 ? Math.PI*r*100/(n[i]-1) : 60), filas>1 ? (1-r0)*100/(filas-1) : 60);
  return _asientos[N] = {pts: out, rad: Math.min(paso*.42, 9)};
}
/* El hemiciclo de verdad: los 350 escaños en su sitio del plano del Congreso, ordenados de izquierda a derecha
   para que pintarHemi() los pinte por cuñas, como se sientan los grupos. Si el plano no está completo, null. */
function hemiReal(etiqueta = "350"){
  const P = ctx?.PLANO, D = ctx?.DIPS; if (!P || !D) return null;
  const vistos = new Set(), cx = P.ancho/2, cy = P.alto*1.3;   // el centro, algo por debajo del plano: así los escaños de la primera fila no se mezclan
  const pts = D.filter(d=>!d[8] && d[5] != null).map(d=>({x: +d[5], y: +d[6]})).filter(p=>{ const k = p.x + "," + p.y; if (vistos.has(k)) return false; vistos.add(k); return true; });
  if (pts.length !== 350) return null;
  pts.forEach(p=>{ p.a = Math.atan2(cy - p.y, p.x - cx); p.r = Math.hypot(p.x - cx, p.y - cy); });
  pts.sort((a,b)=>b.a - a.a || a.r - b.r);
  return `<svg class="hi-hemi hi-real" viewBox="-4 -4 ${P.ancho + 8} ${P.alto + 4}" role="img" aria-label="Hemiciclo del Congreso, con los escaños en su sitio">${pts.map((p,k)=>`<circle cx="${p.x}" cy="${p.y}" r="5.3" style="--k:${k}"></circle>`).join("")}
    <text class="anio" x="${cx}" y="${P.alto*.8}" text-anchor="middle" style="font-size:${(P.ancho*.075).toFixed(0)}px">${esc(etiqueta)}</text></svg>`;
}
/* Un hemiciclo como SVG vacío; pintarHemi() le pone color (con transición) a partir de segmentos {color, n, tip}. */
function hemiSVG(N, {etiqueta="", clase=""}={}){
  const {pts, rad} = asientos(N);
  return `<svg class="hi-hemi ${clase}" viewBox="-108 -108 216 114" role="img" aria-label="Hemiciclo de ${N} escaños">${pts.map((p,k)=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rad.toFixed(2)}" style="--k:${k}"></circle>`).join("")}
    ${etiqueta?`<text class="anio" x="0" y="-5" text-anchor="middle" style="font-size:${N>200?17:22}px">${esc(etiqueta)}</text>`:""}</svg>`;
}
function pintarHemi(svg, segs, etiqueta){
  const cs = [...svg.querySelectorAll("circle")];
  let i = 0;
  segs.forEach(s=>{ for (let n=0; n<s.n; n++){ const c = cs[i++]; if (c){ c.style.fill = s.color; c.dataset.tip = s.tip; } } });
  for (; i<cs.length; i++){ cs[i].style.fill = ""; delete cs[i].dataset.tip; }
  if (etiqueta != null){ const t = svg.querySelector(".anio"); if (t) t.textContent = etiqueta; }
}
const segsGrupo = (fam, validos, e) => { const g = porGrupo(fam); return GRUPOS.filter(x=>g[x.id][1]).map(x=>({color:e ? colorFamEn(x.id, e) : x.color, n:g[x.id][1], tip:`<b>${esc(x.nombre)}</b><br>${g[x.id][1]} escaños · ${pct(g[x.id][0]/validos)} de los votos`})); };
const segsLista = (c, validos) => GRUPOS.flatMap(gr=>c.filter(x=>x[3] && (GRUPO_DE[x[1]]||"OTROS")===gr.id).sort((a,b)=>b[3]-a[3]).map(x=>({color:colorPartido(x[0], x[1]), n:x[3], tip:`<b>${esc(x[0])}</b><br>${x[3]} ${x[3]===1?"escaño":"escaños"} · ${pct(x[2]/validos)} de los votos`})));
const leyendaGrupos = (ids, e) => `<div class="el-leyenda">${GRUPOS.filter(g=>!ids || ids.includes(g.id)).map(g=>`<span><i style="background:${e ? colorFamEn(g.id, e) : g.color}"></i>${esc(g.nombre)}</span>`).join("")}</div>`;
const chipsAnios = (E, sel, attr, play=false) => `<div class="hi-anios" role="group" aria-label="Elección">${play?`<button class="play" data-${attr}-play>▶ Reproducir</button>`:""}${E.map((e,k)=>`<button data-${attr}="${k}" aria-pressed="${k===sel}">${anio(e)}</button>`).join("")}</div>`;

/* ---------- áreas apiladas en escalón (cada legislatura dura hasta la siguiente elección) ---------- */
const FIN = "2026-10-06";
const tiempo = iso => { const [y,m,d] = iso.split("-").map(Number); return y + (m-1)/12 + (d-1)/365; };
const medidasApilado = (ancho, mini=false) => { const W = Math.max(mini ? 100 : 320, Math.round(ancho || 1000));
  return mini ? {W, H: 110, ml: 0, mr: 0, mt: 0, mb: 0} : {W, H: W < 640 ? 260 : 320, ml: 32, mr: W < 640 ? 96 : 170, mt: 8, mb: 24}; };
function graficoApilado(E, valores, {sel=-1, ancho=1000, total=350, mayoria=true, mini=false}={}){
  const {W, H, ml, mr, mt, mb} = medidasApilado(ancho, mini), t0 = tiempo(E[0].fecha), t1 = tiempo(FIN), estrecho = W < 640;
  const tope = Math.max(total, ...valores.map(v=>Object.values(v).reduce((a,b)=>a+b,0)));
  const x = t => ml + (tiempo(t)-t0)/(t1-t0)*(W-ml-mr), y = v => mt + (1 - v/tope)*(H-mt-mb);
  const xs = E.map(e=>x(e.fecha)).concat([x(FIN)]);
  let bandas = "", etiquetas = "";
  const fuera = [], basev = E.map(()=>0);
  GRUPOS.forEach(gr=>{
    const top = E.map((_,k)=>basev[k] + (valores[k][gr.id]||0));
    if (top.every((v,k)=>v===basev[k])) return;
    let d = `M${xs[0].toFixed(1)} ${y(top[0]).toFixed(1)}`;
    E.forEach((_,k)=>{ d += `H${xs[k+1].toFixed(1)}`; if (k+1<E.length) d += `V${y(top[k+1]).toFixed(1)}`; });
    d += `V${y(basev[E.length-1]).toFixed(1)}`;
    for (let k=E.length-1; k>=0; k--){ d += `H${xs[k].toFixed(1)}`; if (k>0) d += `V${y(basev[k-1]).toFixed(1)}`; }
    bandas += `<path class="banda" d="${d}Z" fill="${gr.color}"></path>`;
    const anchos = E.map((_,k)=>valores[k][gr.id]||0), kmax = anchos.indexOf(Math.max(...anchos));
    const alto = y(basev[kmax]) - y(top[kmax]), nombre = estrecho ? CORTO[gr.id] : gr.nombre, anchoTxt = nombre.length * 6.6 + 10, hueco = xs[kmax+1] - xs[kmax];
    if (alto >= 17 && hueco >= anchoTxt){
      etiquetas += `<text class="lbl" x="${((xs[kmax]+xs[kmax+1])/2).toFixed(1)}" y="${((y(basev[kmax])+y(top[kmax]))/2 + 4).toFixed(1)}" text-anchor="middle" fill="${textoSobre(gr.color)}">${esc(nombre)}</text>`;
    } else if ((valores[E.length-1][gr.id]||0) > 0){
      fuera.push({y: (y(basev[E.length-1])+y(top[E.length-1]))/2 + 4, t: `${CORTO[gr.id]} ${valores[E.length-1][gr.id]}`});
    }
    E.forEach((_,k)=>basev[k] = top[k]);
  });
  fuera.sort((a,b)=>a.y-b.y);
  for (let i=1; i<fuera.length; i++) fuera[i].y = Math.max(fuera[i].y, fuera[i-1].y + 14);
  for (let i=fuera.length-2; i>=0; i--) fuera[i].y = Math.min(fuera[i].y, fuera[i+1].y - 14);
  etiquetas += fuera.map(f=>`<text class="lbl-fuera" x="${(W-mr+8).toFixed(1)}" y="${f.y.toFixed(1)}">${esc(f.t)}</text>`).join("");
  const marcas = (total===350 ? [0, 100, 250, 350] : [0, Math.round(tope/2), tope]).map(v=>`<line class="eje" x1="${ml}" x2="${W-mr}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${ml-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join("");
  const anios = E.filter((e,k)=>k===0 || k===E.length-1 || (estrecho ? ["1982","1996","2011"].includes(e.fecha.slice(0,4)) : k%2===0 && k<E.length-2)).map(e=>`<text class="tick" x="${x(e.fecha).toFixed(1)}" y="${H-6}" text-anchor="middle">${e.fecha.slice(0,4)}</text>`).join("");
  return `<svg class="hi-svg hi-apilado clic" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-total="${total}" role="img" aria-label="Escaños de cada familia de partidos en cada legislatura desde 1977${mayoria?" (la línea discontinua es la mayoría absoluta, 176)":""}">
    ${marcas}${bandas}${mayoria?`<line class="eje" x1="${ml}" x2="${W-mr}" y1="${y(176)}" y2="${y(176)}" stroke-dasharray="3 3"/><text class="tick" x="${ml-6}" y="${y(176)+4}" text-anchor="end">176</text>`:""}
    ${etiquetas}${anios}${sel>=0?`<line class="sel" x1="${xs[sel]}" x2="${xs[sel]}" y1="${mt}" y2="${H-mb}"/>`:""}<line class="cruz" x1="0" x2="0" y1="${mt}" y2="${H-mb}"/></svg>`;
}
function montarApilado(svg, E, valores, elegir){
  if (!svg) return;
  const {W, ml, mr} = medidasApilado(+svg.getAttribute("width")), t0 = tiempo(E[0].fecha), t1 = tiempo(FIN);
  const xs = E.map(e=>ml + (tiempo(e.fecha)-t0)/(t1-t0)*(W-ml-mr)).concat([W-mr]);
  const cruz = svg.querySelector(".cruz");
  const cual = ev => { const r = svg.getBoundingClientRect(), xv = (ev.clientX - r.left) / r.width * W; let k = 0; while (k < E.length-1 && xv >= xs[k+1]) k++; return k; };
  svg.addEventListener("mousemove", ev=>{
    const k = cual(ev), v = valores[k];
    cruz.setAttribute("x1", xs[k]); cruz.setAttribute("x2", xs[k]); cruz.style.opacity = .5;
    tip(`<b>${esc(anioLargo(E[k]))}</b>${GRUPOS.slice().reverse().filter(gr=>v[gr.id]).map(gr=>filaTip(gr.color, gr.nombre, v[gr.id])).join("")}<div style="color:var(--muted);margin-top:4px">Pulsa para ver esa elección</div>`, ev);
  });
  svg.addEventListener("mouseleave", ()=>{ cruz.style.opacity = 0; tip(""); });
  svg.addEventListener("click", ev=>elegir(cual(ev)));
}

/* ---------- líneas (misma unidad en un solo eje), con punto final y etiquetas solo en extremos ---------- */
function graficoLinea(E, series, {min=0, max=1, ancho=480, alto=200, formato=v=>pct(v,0), paso=.1, eje=v=>Math.round(v*100)+"%"}={}){
  const W = Math.max(300, Math.round(ancho)), H = alto, ml = 40, mr = series.length > 1 ? 104 : 60, mt = 16, mb = 24;
  const ks = E.map((_,k)=>k), t0 = tiempo(E[0].fecha), t1 = tiempo(E[E.length-1].fecha);
  const x = k => ml + (tiempo(E[k].fecha)-t0)/(t1-t0)*(W-ml-mr), y = v => mt + (1-(v-min)/(max-min))*(H-mt-mb);
  const marcas = []; for (let v = min; v <= max + 1e-9; v += paso) marcas.push(+v.toFixed(4));
  const rejilla = marcas.filter((_,i)=>i%(marcas.length>6?2:1)===0).map(v=>`<line class="eje" x1="${ml}" x2="${W-mr}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${ml-6}" y="${y(v)+4}" text-anchor="end">${eje(v)}</text>`).join("");
  const finales = [];   // etiquetas del último valor: se separan después para que no se pisen
  const lineas = series.map((s,si)=>{ const pts = ks.filter(k=>s.valores[k]!=null);
    const d = pts.map((k,i)=>`${i?"L":"M"}${x(k).toFixed(1)} ${y(s.valores[k]).toFixed(1)}`).join("");
    const vals = pts.map(k=>s.valores[k]), kmax = pts[vals.indexOf(Math.max(...vals))], kmin = pts[vals.indexOf(Math.min(...vals))], ult = pts[pts.length-1];
    const etq = s.extremos===false ? "" : [...new Set([kmax, kmin])].filter(k=>k!==ult).map(k=>`<text class="tick" x="${x(k)}" y="${y(s.valores[k]) + (k===kmax?-8:15)}" text-anchor="middle">${formato(s.valores[k])}</text>`).join("");
    if (s.etiqueta !== false) finales.push({x: x(ult)+9, y: y(s.valores[ult])+4, t: `${series.length>1?s.nombre+" ":""}${formato(s.valores[ult])}`});
    return `<g data-serie="${si}"><path class="linea" d="${d}" style="stroke:${s.color}"/>${etq}<circle class="punto" cx="${x(ult)}" cy="${y(s.valores[ult])}" r="4.5" style="fill:${s.color}"/></g>`; }).join("");
  finales.sort((a,b)=>a.y-b.y);
  for (let i=1; i<finales.length; i++) finales[i].y = Math.max(finales[i].y, finales[i-1].y + 13);
  for (let i=finales.length-2; i>=0; i--) finales[i].y = Math.min(finales[i].y, finales[i+1].y - 13);
  const etiquetasFin = finales.map(f=>`<text class="lbl-fuera" x="${f.x.toFixed(1)}" y="${f.y.toFixed(1)}">${esc(f.t)}</text>`).join("");
  const anios = E.filter((_,k)=>k%3===0 || k===E.length-1).map(e=>`<text class="tick" x="${x(E.indexOf(e))}" y="${H-6}" text-anchor="middle">${e.fecha.slice(0,4)}</text>`).join("");
  const datos = esc(JSON.stringify({series: series.map(s=>({n:s.nombre, c:s.color, v:s.valores})), xs: E.map((_,k)=>x(k)), et: E.map(anioLargo), w: W}));
  return `<svg class="hi-svg hi-linea clic" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(series.map(s=>s.nombre).join(" y "))} en cada elección" data-serie="${datos}">${rejilla}${lineas}${etiquetasFin}${anios}<line class="cruz" x1="0" x2="0" y1="${mt}" y2="${H-mb}"/></svg>`;
}
function montarLineas(raiz, E, formato=v=>pct(v), alPulsar=k=>{ location.hash = enlaceE(E[k]).slice(1); }){
  raiz.querySelectorAll(".hi-linea:not([data-montada])").forEach(svg=>{
    svg.dataset.montada = "1";
    const D = JSON.parse(svg.dataset.serie), cruz = svg.querySelector(".cruz");
    const cual = ev => { const r = svg.getBoundingClientRect(), xv = (ev.clientX-r.left)/r.width*D.w; let k = 0, best = 1e9; D.xs.forEach((x,i)=>{ if (Math.abs(x-xv) < best){ best = Math.abs(x-xv); k = i; } }); return k; };
    svg.addEventListener("mousemove", ev=>{ const k = cual(ev);
      cruz.setAttribute("x1", D.xs[k]); cruz.setAttribute("x2", D.xs[k]); cruz.style.opacity = .5;
      tip(`<b>${esc(D.et[k])}</b>${D.series.filter(s=>s.v[k]!=null).map(s=>filaTip(s.c, s.n, formato(s.v[k]))).join("")}`, ev); });
    svg.addEventListener("mouseleave", ()=>{ cruz.style.opacity = 0; tip(""); });
    svg.addEventListener("click", ev=>alPulsar(cual(ev)));
  });
}

/* ---------- mapa de provincias (cada provincia enlaza a su ficha) ---------- */
function mapaSVG(color, {enlazar=true, clase=""}={}){
  if (!GEO) return `<p class="nota">El mapa no está disponible.</p>`;
  return `<svg class="hi-svg ${clase}" viewBox="0 0 ${GEO.ancho} ${GEO.alto}" role="img" aria-label="Mapa por provincias">${Object.entries(GEO.provincias).map(([c,p])=>{
    const path = `<path class="prov" d="${p.d}" style="fill:${color(c) || "var(--sunk)"}" data-p="${c}"></path>`;
    return enlazar ? `<a href="${enlaceProv(c)}" aria-label="${esc(p.circ)}">${path}</a>` : path; }).join("")}<path class="can" d="${GEO.canarias}"/></svg>`;
}
const leyendaRampa = (color, lo, hi, f=pct) => `<div class="hi-rampa"><span>${f(lo)}</span><span class="r" style="background:linear-gradient(90deg,${color(0)},${color(1)})"></span><span>${f(hi)}</span></div>`;

/* Modos de los mapas por provincia de una elección: primera fuerza, voto a una familia, participación, votos por escaño. */
const MODOS = [["primera","Primera fuerza"], ...GRUPOS.filter(g=>g.id!=="OTROS").map(g=>[g.id, `Voto a ${g.nombre}`]), ["part","Participación"], ["precio","Votos por escaño"]];
function mapaEleccion(e, modo){
  const prov = e.prov, cods = Object.keys(GEO.provincias).filter(c=>prov[c]);
  if (modo === "primera"){
    const gan = Object.fromEntries(cods.map(c=>[c, primera(porGrupo(prov[c].fam))]));
    const usados = [...new Set(Object.values(gan).map(g=>g.id))];
    return mapaSVG(c=>gan[c]?.color) + leyendaGrupos(usados);
  }
  const valor = c => modo==="part" ? prov[c].votantes/prov[c].censo : modo==="precio" ? prov[c].validos/prov[c].e : porGrupo(prov[c].fam)[modo][0]/prov[c].validos;
  const vs = cods.map(valor), lo = modo==="part"||modo==="precio" ? Math.min(...vs) : 0, hi = Math.max(...vs) || 1;
  const r = rampa(modo==="part"||modo==="precio" ? NEUTRO : G8[modo].color);
  return mapaSVG(c=>prov[c] ? r((valor(c)-lo)/(hi-lo||1)) : null) + leyendaRampa(r, lo, hi, modo==="precio" ? v=>fmt(v)+" votos" : v=>pct(v,0));
}
function tipProvincia(e, c){
  const p = e.prov[c]; if (!p) return "";
  const G = porGrupo(p.fam);
  return `<b>${esc(nombreProv(c))}</b> · ${p.e} escaños<br>Participación ${pct(p.votantes/p.censo)} · ${fmt(p.validos/p.e)} votos por escaño${GRUPOS.filter(gr=>G[gr.id][0]).sort((a,b)=>G[b.id][0]-G[a.id][0]).slice(0,5).map(gr=>filaTip(gr.color, gr.nombre, `${pct(G[gr.id][0]/p.validos)} · ${G[gr.id][1]}`)).join("")}<div style="color:var(--muted);margin-top:4px">Pulsa para ver su ficha</div>`;
}
const recordarAnio = id => { try{ sessionStorage.setItem("el-anio", id); }catch(err){} };
const anioRecordado = () => { try{ return sessionStorage.getItem("el-anio"); }catch(err){ return null; } };

/* =====================================================================================================
   MINIATURAS DE LA PORTADA
   ===================================================================================================== */
export async function miniaturas(el, c){
  ctx = c; estilos();
  await base(); if (!HIST) return;
  const E = HIST.elecciones, ult = E[E.length-1];
  const caja = id => el.querySelector(`[data-mini="${id}"]`);
  const historico = caja("historico");
  if (historico){ const G = E.map(e=>Object.fromEntries(Object.entries(porGrupo(e.fam)).map(([k,v])=>[k,v[1]])));
    historico.innerHTML = graficoApilado(E, G, {ancho:320, mayoria:false, mini:true}).replace(/<text[^>]*>[^<]*<\/text>/g, "").replace('class="hi-svg hi-apilado clic"', 'class="hi-svg" aria-hidden="true"'); }
  const metricas = caja("metricas");
  if (metricas) metricas.innerHTML = `<span class="c" style="font-family:var(--led,var(--display));font-size:34px;font-weight:900;display:block;margin-bottom:2px">${dec(ult.metricas.nep_votos,1)}</span><span class="p" style="font-size:12px;color:var(--muted);display:block;margin-bottom:6px">partidos efectivos en 2023 (${dec(E[0].metricas.nep_votos,1)} en 1977)</span>`
    + graficoLinea(E, [{nombre:"", color:NEUTRO, valores:E.map(e=>e.metricas.nep_votos), extremos:false}], {min:2, max:6.5, ancho:320, alto:110, paso:1, eje:v=>v, formato:v=>dec(v,1)}).replace(/<text[^>]*>[^<]*<\/text>/g, "");
  const escano = caja("escano");
  if (escano){ const precios = Object.entries(ult.prov).map(([c,p])=>[c, p.validos/p.e]).sort((a,b)=>a[1]-b[1]), lo = precios[0], hi = precios[precios.length-1];
    escano.innerHTML = `<span style="display:grid;gap:6px;font-size:12.5px">${[lo, hi].map(([c,v])=>`<span style="display:grid;grid-template-columns:70px 1fr 56px;gap:8px;align-items:center"><span>${esc(GEO.provincias[c].corto)}</span><span style="display:block;height:10px;width:${(v/hi[1]*100).toFixed(0)}%;background:${NEUTRO};border-radius:0 3px 3px 0"></span><span style="text-align:right;font-variant-numeric:tabular-nums">${fmt(v)}</span></span>`).join("")}</span><span style="font-size:12px;color:var(--muted);display:block;margin-top:6px">votos por escaño en 2023</span>`; }
  const provincias = caja("provincias");
  if (provincias){ const vs = Object.values(ult.prov).map(p=>p.e), r = rampa(NEUTRO), hi = Math.max(...vs);
    provincias.innerHTML = mapaSVG(c=>ult.prov[c] ? r(Math.sqrt(ult.prov[c].e/hi)) : null, {enlazar:false}).replace('role="img"', 'aria-hidden="true"'); }
  const mapa = caja("mapa");
  if (mapa){ const gan = c => ult.prov[c] && primera(porGrupo(ult.prov[c].fam)).color;
    mapa.innerHTML = mapaSVG(gan, {enlazar:false}).replace('role="img"', 'aria-hidden="true"'); }
  // La geografía del voto: un círculo por provincia, del tamaño de sus votantes y del color de la más votada.
  const voto = caja("voto");
  if (voto){ const P = Object.entries(ult.prov).filter(([c])=>GEO.provincias[c]).sort((a,b)=>b[1].votantes-a[1].votantes);
    voto.innerHTML = `<svg viewBox="0 0 ${GEO.ancho} ${GEO.alto}" aria-hidden="true">${Object.values(GEO.provincias).map(p=>`<path d="${p.d}" style="fill:var(--sunk);stroke:var(--line)" stroke-width="1"/>`).join("")}
      ${P.map(([c,p])=>`<circle cx="${GEO.provincias[c].c[0]}" cy="${GEO.provincias[c].c[1]}" r="${(Math.sqrt(p.votantes)*0.046+4).toFixed(1)}" fill="${primera(porGrupo(p.fam)).color}" fill-opacity=".8" stroke="var(--surface)" stroke-width="2"/>`).join("")}</svg>`; }
}

/* =====================================================================================================
   ELECCIONES DESDE 1977 (directorio)
   ===================================================================================================== */
let selH = null, playH = null;
export async function pintarHistorico(sec, c){
  ctx = c; estilos();
  await base(); if (!HIST){ sec.innerHTML = `<p class="nota">No se ha podido cargar el histórico.</p>`; return; }
  const E = HIST.elecciones;
  selH ??= E.length - 1;
  const G = E.map(e=>Object.fromEntries(Object.entries(porGrupo(e.fam)).map(([k,v])=>[k,v[1]])));
  sec.innerHTML = `
    <section class="sec" style="padding-top:8px">${chipsAnios(E, selH, "hi", true)}
    <div class="hi-top">
      <div class="chart">${hemiSVG(350, {etiqueta:" "})}<div id="hi-leyenda"></div></div>
      <div class="chart" id="hi-ficha"></div>
    </div></section>
    <section class="sec"><div class="sec-h"><h2>Los 350 escaños, legislatura a legislatura</h2><p>Escaños de cada familia de partidos desde 1977 hasta la disolución de 2026. Pasa por encima para ver el reparto; pulsa para abrir la ficha de esa elección.</p></div>
      <div class="chart"><div id="hi-rio"></div>${leyendaGrupos()}</div></section>
    <section class="sec"><div class="sec-h"><h2>Las dieciséis elecciones</h2><p>Cada tarjeta abre la ficha de la elección y de la legislatura que salió de ella.</p></div>
      <div class="hi-cartas">${E.map((e,k)=>{ const g = porGrupo(e.fam), p1 = primera(g);
        return `<a class="hi-carta" href="${enlaceE(e)}">${hemiSVG(350).replace('class="hi-hemi "', 'class="hi-hemi" data-mini-hemi="'+k+'"')}<b>${anio(e)}</b><small>${esc(e.legislatura==="Constituyente"?"Cortes constituyentes":e.legislatura+" legislatura")}<br>${esc(CORTO[p1.id])} ${g[p1.id][1]} · participación ${pct(e.votantes/e.censo,0)}</small></a>`; }).join("")}</div></section>
    <section class="sec"><div class="sec-h"><h2 id="hi-mapa-t"></h2><div class="controls"><select id="hi-mapa-modo" aria-label="Qué se pinta en el mapa">${MODOS.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join("")}</select></div></div>
      <div class="chart"><div id="hi-mapa"></div></div>
      <p class="nota">Fuente: Ministerio del Interior, resultados oficiales de las elecciones al Congreso. Las candidaturas se agrupan con su cabecera nacional y cada una se asigna a una familia con reglas fijas, iguales para las dieciséis elecciones (<a href="https://github.com/jorgegarcelan/escano-abierto/blob/main/escano/historico.py">escano/historico.py</a>). Más indicadores en <a href="#elecciones-metricas">Métricas</a>.</p></section>`;
  // Miniaturas de las tarjetas.
  sec.querySelectorAll("[data-mini-hemi]").forEach(svg=>{ const e = E[+svg.dataset.miniHemi]; pintarHemi(svg, segsGrupo(e.fam, e.validos, e)); });   // cada una, con los colores de su año
  const hemi = sec.querySelector(".hi-top .hi-hemi"), ficha = sec.querySelector("#hi-ficha"), modo = sec.querySelector("#hi-mapa-modo");
  modo.value = "primera";
  function pintar(k){
    selH = k; const e = E[k];
    pintarHemi(hemi, segsGrupo(e.fam, e.validos, e), anio(e).replace("-A"," abr").replace("-N"," nov"));
    const gE = porGrupo(e.fam); sec.querySelector("#hi-leyenda").innerHTML = leyendaGrupos(GRUPOS.filter(x=>gE[x.id][1]).map(x=>x.id), e);   // la leyenda, con los colores de esa elección
    sec.querySelectorAll("[data-hi]").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.hi===k)));
    const primeros = e.partidos.filter(p=>p[4]).slice(0, 10);
    ficha.innerHTML = `<div class="eyebrow">${esc(anioLargo(e))} · ${esc(e.legislatura==="Constituyente"?"Cortes constituyentes":e.legislatura+" legislatura")}</div>
      <div class="kpis" style="border:0;padding:4px 0 8px"><div class="kpi"><b>${pct(e.votantes/e.censo)}</b><span>participación</span></div><div class="kpi"><b>${e.partidos.filter(p=>p[4]).length}</b><span>candidaturas con escaño</span></div></div>
      <table class="hi-tabla"><thead><tr><th>Candidatura</th><th class="n">%</th><th class="n">Escaños</th></tr></thead><tbody>
      ${primeros.map(p=>`<tr><td><i class="d" style="background:${colorPartido(p[0], p[2])}"></i>${esc(p[0])}</td><td class="n">${pct(p[3]/e.validos)}</td><td class="n"><b>${p[4]}</b></td></tr>`).join("")}</tbody></table>
      <p><a class="btn" href="${enlaceE(e)}">Ficha de la elección y de la legislatura →</a></p>`;
    const rio = sec.querySelector("#hi-rio"); rio.innerHTML = graficoApilado(E, G, {sel:k, ancho:rio.clientWidth});
    montarApilado(rio.querySelector("svg"), E, G, j=>{ location.hash = enlaceE(E[j]).slice(1); });
    mapa();
  }
  function mapa(){
    const e = E[selH];
    sec.querySelector("#hi-mapa-t").textContent = `${MODOS.find(m=>m[0]===modo.value)[1]} por provincia, ${anio(e)}`;
    sec.querySelector("#hi-mapa").innerHTML = mapaEleccion(e, modo.value);
    recordarAnio(e.id);
  }
  modo.addEventListener("change", mapa);
  conTip(sec.querySelector("#hi-mapa"), ev=>{ const p = ev.target.closest("[data-p]"); return p ? tipProvincia(E[selH], p.dataset.p) : ""; });
  sec.addEventListener("click", ev=>{
    const b = ev.target.closest("[data-hi]"); if (b){ parar(); pintar(+b.dataset.hi); return; }
    if (ev.target.closest("[data-hi-play]")){ playH ? parar() : reproducir(); }
  });
  function reproducir(){
    sec.querySelector("[data-hi-play]").textContent = "❚❚ Pausa";
    let k = selH >= E.length-1 ? 0 : selH + 1; pintar(k);
    playH = setInterval(()=>{ k++; if (k >= E.length || !document.body.contains(sec)){ parar(); return; } pintar(k); }, 1500);
  }
  function parar(){ clearInterval(playH); playH = null; const b = sec.querySelector("[data-hi-play]"); if (b) b.textContent = "▶ Reproducir"; }
  requestAnimationFrame(()=>pintar(selH));
}

/* =====================================================================================================
   FICHA DE UNA ELECCIÓN Y SU LEGISLATURA
   ===================================================================================================== */
export async function pintarFicha(sec, c, slug){
  ctx = c; estilos();
  await base(); if (!HIST){ sec.innerHTML = `<p class="nota">No se ha podido cargar el histórico.</p>`; return; }
  const E = HIST.elecciones, k = E.findIndex(e=>slugE(e)===slug);
  if (k < 0){ sec.innerHTML = `<p class="nota">No hay elecciones generales con esa fecha. <a href="#elecciones-historico">Ver todas</a></p>`; return; }
  const e = E[k], prev = E[k-1], next = E[k+1], g = porGrupo(e.fam), p1 = primera(g);
  recordarAnio(e.id);
  const D = await pedir(`datos/elecciones/historico-${e.id}.json`);
  const part = e.votantes/e.censo, partPrev = prev ? prev.votantes/prev.censo : null;
  const conEscano = e.partidos.filter(p=>p[4]);
  const mayor = conEscano[0], mayoria = mayor[4] >= 176;
  const leg = e.legislatura === "Constituyente" ? "Cortes constituyentes" : `${e.legislatura} legislatura`;
  const presidentes = e.presidentes.length ? e.presidentes.map(esc).join("<br>") : "Ninguna investidura: se repitieron las elecciones";
  const tituloLeg = e.id === "202307" ? `${duracion(e.fecha, e.hasta)}, hasta la disolución del 6 de octubre de 2026` : `${duracion(e.fecha, e.hasta)}, hasta las elecciones del ${anioLargo(next)}`;
  // Candidaturas para la tabla y el cambio respecto a la anterior (por siglas idénticas).
  const prevPorSiglas = prev ? Object.fromEntries(prev.partidos.map(p=>[p[0], p])) : {};
  const gPrev = prev ? porGrupo(prev.fam) : null;
  const filas = e.partidos.filter(p=>p[4] || p[3] >= 0.005*e.validos);
  const maxPct = Math.max(...filas.map(p=>p[3]/e.validos));
  sec.innerHTML = `
    <nav class="hi-pasos">${prev?`<a href="${enlaceE(prev)}">← ${anio(prev)}</a>`:"<span></span>"}${next?`<a href="${enlaceE(next)}">${anio(next)} →</a>`:`<a href="#elecciones">29N →</a>`}</nav>
    <div class="view-intro"><div><div class="eyebrow">Elecciones generales · ${esc(leg)}</div><h2>${esc(anioLargo(e))}</h2>
      <p>${mayoria ? `${esc(mayor[0])} logró la mayoría absoluta con ${mayor[4]} escaños.` : `Sin mayoría absoluta: ${esc(mayor[0])} fue la primera fuerza con ${mayor[4]} escaños, a ${176-mayor[4]} de los 176.`} Votó el ${pct(part)} del censo${partPrev!=null?` (${conSigno((part-partPrev)*100, v=>dec(v,1))} puntos respecto a ${anio(prev)})`:""}.</p></div></div>
    <div class="kpis"><div class="kpi"><b>${pct(part)}</b><span>participación</span></div><div class="kpi"><b>${fmtCorto(e.votantes)}</b><span>votantes</span></div>
      <div class="kpi"><b>${conEscano.length}</b><span>candidaturas con escaño</span></div><div class="kpi"><b>${dec(e.metricas.nep_votos,1)}</b><span>partidos efectivos (votos)</span></div>
      <div class="kpi"><b>${dec(e.metricas.gallagher,1)}</b><span>desproporcionalidad (Gallagher)</span></div><div class="kpi"><b>${fmtCorto(e.metricas.sin_escano)}</b><span>votos sin escaño</span></div></div>
    <div class="hi-top" style="margin-top:14px">
      <div class="chart"><h3>El hemiciclo</h3><p class="sub">Un punto por escaño, por candidatura y de izquierda a derecha según su familia. Pasa por encima para ver cada una.</p>${hemiSVG(350)}${leyendaGrupos(GRUPOS.filter(x=>g[x.id][1]).map(x=>x.id))}</div>
      <div class="chart"><h3>La legislatura</h3><dl class="hi-caja"><dt>Legislatura</dt><dd>${esc(leg)}</dd><dt>Presidencia del Gobierno</dt><dd>${presidentes}</dd><dt>Duración</dt><dd>${esc(tituloLeg)}</dd></dl>
        ${e.id==="202307"?`<p><a href="#elecciones-legislatura">La XV legislatura en cifras →</a><br><a href="#inicio">Toda su actividad en Escaño Abierto →</a></p>`:""}</div>
    </div>
    <section class="sec"><div class="sec-h"><h2>Resultados</h2><p>Candidaturas con escaño o con más del 0,5 % de los votos válidos. Votos válidos: ${fmt(e.validos)}, de ellos ${fmt(e.blancos)} en blanco; nulos: ${fmt(e.nulos)}.</p></div>
      <div class="chart hi-desliza"><table class="hi-tabla"><thead><tr><th>Candidatura</th><th class="n">Votos</th><th class="n">%</th><th></th><th class="n">Escaños</th>${prev?`<th class="n">Δ ${anio(prev)}</th>`:""}</tr></thead><tbody>
        ${filas.map(p=>{ const gr = {color: colorPartido(p[0], p[2])}, ant = prevPorSiglas[p[0]];
          return `<tr><td title="${esc(p[1])}"><i class="d" style="background:${gr.color}"></i>${esc(p[0])}</td><td class="n">${fmt(p[3])}</td><td class="n">${pct(p[3]/e.validos)}</td><td style="width:22%"><span class="bar" style="width:${(p[3]/e.validos/maxPct*100).toFixed(1)}%;background:${gr.color}"></span></td><td class="n"><b>${p[4]}</b></td>${prev?`<td class="n">${ant?conSigno(p[4]-ant[4]):`<span style="color:var(--muted)" data-tip="No se presentó con estas siglas en ${anio(prev)}: el cambio por familias está en el gráfico de abajo">–</span>`}</td>`:""}</tr>`; }).join("")}</tbody></table></div></section>
    <div class="hi-dos" style="margin-top:18px">
      ${prev?`<div class="chart"><h3>Cambio de escaños desde ${anio(prev)}</h3><p class="sub">Por familia de partidos.</p>${cambioGrupos(g, gPrev)}</div>`:""}
      <div class="chart"><h3>Votos y escaños</h3><p class="sub">Parte de los votos (anillo) y de los escaños (punto) de cada candidatura con escaño. Si el punto queda a la derecha, sacó más escaños que votos.</p>${votosEscanos(conEscano, e.validos)}</div>
    </div>
    <section class="sec"><div class="sec-h"><h2 id="fi-mapa-t">Por provincia</h2><div class="controls"><select id="fi-modo" aria-label="Qué se pinta en el mapa">${MODOS.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join("")}</select></div></div>
      <div class="chart"><div id="fi-mapa"></div><p class="nota">Pulsa una provincia para ver su ficha.</p></div></section>
    ${D?`<section class="sec"><div class="sec-h"><h2>Los últimos escaños más ajustados</h2><p>El último diputado que repartió la ley D'Hondt en cada provincia y los votos que le faltaron a la siguiente candidatura. <a href="#elecciones-escano">Más en «El precio de un escaño»</a>.</p></div>
      <div class="chart"><ul class="hi-ultimo">${Object.entries(D.prov).filter(([,p])=>p.ultimo).sort((a,b)=>a[1].ultimo.faltan-b[1].ultimo.faltan).slice(0,8).map(([cod,p])=>`<li><a href="${enlaceProv(cod)}">${esc(nombreProv(cod))}</a><span>Lo ganó <b>${esc(p.ultimo.gana)}</b>; a <b>${esc(p.ultimo.segundo)}</b> le faltaron</span><span class="m">${fmt(p.ultimo.faltan)} votos</span></li>`).join("")}</ul></div></section>`:""}`;
  requestAnimationFrame(()=>pintarHemi(sec.querySelector(".hi-top .hi-hemi"), segsLista(e.partidos.map(p=>[p[0], p[2], p[3], p[4]]), e.validos)));
  const modo = sec.querySelector("#fi-modo"); modo.value = "primera";
  const mapa = () => { sec.querySelector("#fi-mapa-t").textContent = `${MODOS.find(m=>m[0]===modo.value)[1]} por provincia`; sec.querySelector("#fi-mapa").innerHTML = mapaEleccion(e, modo.value); };
  modo.addEventListener("change", mapa); mapa();
  conTip(sec.querySelector("#fi-mapa"), ev=>{ const p = ev.target.closest("[data-p]"); return p ? tipProvincia(e, p.dataset.p) : ""; });
}
function cambioGrupos(g, gPrev){
  const filas = GRUPOS.map(x=>[x, g[x.id][1] - gPrev[x.id][1], g[x.id][1], gPrev[x.id][1]]).filter(x=>x[2] || x[3]);
  const max = Math.max(1, ...filas.map(x=>Math.abs(x[1])));
  return `<div style="display:grid;gap:6px">${filas.map(([x,d,a,b])=>`<div style="display:grid;grid-template-columns:140px 1fr 1fr 48px;gap:6px;align-items:center;font-size:13px" data-tip="${esc(`<b>${esc(x.nombre)}</b><br>${b} → ${a} escaños`)}"><span>${esc(x.nombre)}</span>
    <span style="display:flex;justify-content:flex-end">${d<0?`<span style="display:block;height:12px;width:${(-d/max*100).toFixed(1)}%;background:${x.color};border-radius:4px 0 0 4px"></span>`:""}</span>
    <span>${d>0?`<span style="display:block;height:12px;width:${(d/max*100).toFixed(1)}%;background:${x.color};border-radius:0 4px 4px 0"></span>`:""}</span>
    <span style="text-align:right;font-variant-numeric:tabular-nums">${conSigno(d)}</span></div>`).join("")}</div>`;
}
function votosEscanos(lista, validos){
  const filas = lista.slice(0, 14), max = Math.max(...filas.map(p=>Math.max(p[3]/validos, p[4]/350))) * 1.05;
  const W = 420, fila = 22, H = filas.length*fila + 26, ml = 92, mr = 16, x = v => ml + v/max*(W-ml-mr);
  const marcas = [0, .1, .2, .3, .4, .5].filter(v=>v<=max).map(v=>`<line class="eje" x1="${x(v)}" x2="${x(v)}" y1="0" y2="${H-20}"/><text class="tick" x="${x(v)}" y="${H-6}" text-anchor="middle">${v*100}%</text>`).join("");
  return `<svg class="hi-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Parte de los votos y de los escaños de cada candidatura">${marcas}${filas.map((p,i)=>{ const yy = i*fila + 12, v = p[3]/validos, e = p[4]/350, col = colorPartido(p[0], p[2]);
    return `<g data-tip="${esc(`<b>${esc(p[0])}</b><br>${pct(v)} de los votos · ${pct(e)} de los escaños (${p[4]})`)}"><rect x="0" y="${yy-10}" width="${W}" height="${fila}" fill="transparent"/><text class="tick" x="${ml-8}" y="${yy+4}" text-anchor="end" style="fill:var(--ink)">${esc(p[0].slice(0,13))}</text>
      <line x1="${x(v)}" x2="${x(e)}" y1="${yy}" y2="${yy}" stroke="${col}" stroke-width="2"/><circle cx="${x(v)}" cy="${yy}" r="4.5" style="fill:var(--surface);stroke:${col};stroke-width:2"/><circle cx="${x(e)}" cy="${yy}" r="4.5" style="fill:${col}" class="punto"/></g>`; }).join("")}</svg>`;
}

/* =====================================================================================================
   PROVINCIAS (directorio)
   ===================================================================================================== */
let ordenProv = {col:"e", asc:false}, modoProv = "primera", buscaProv = "";
/* Las comunidades, para agrupar las provincias (en el orden de siempre). */
const CCAA_PROV = [["Andalucía",["04","11","14","18","21","23","29","41"]],["Aragón",["22","44","50"]],["Asturias",["33"]],["Baleares",["07"]],["Canarias",["35","38"]],
  ["Cantabria",["39"]],["Castilla y León",["05","09","24","34","37","40","42","47","49"]],["Castilla-La Mancha",["02","13","16","19","45"]],["Cataluña",["08","17","25","43"]],
  ["C. Valenciana",["03","12","46"]],["Extremadura",["06","10"]],["Galicia",["15","27","32","36"]],["Madrid",["28"]],["Murcia",["30"]],["Navarra",["31"]],["País Vasco",["01","20","48"]],
  ["La Rioja",["26"]],["Ceuta",["51"]],["Melilla",["52"]]];
/* El nombre corto de cada partido, para rótulos (JxCAT - JUNTS → Junts, EAJ-PNV → PNV, PODEMOS-IU-EQUO… → Podemos). */
const CORTOS_PARTIDO = [[/SUMAR/,"Sumar"],[/^(EN COMU|ECP)/,"En Comú"],[/^EN MAREA/,"En Marea"],[/^(PODEMOS|UNIDAS PODEMOS|UNIDOS PODEMOS|UP\b)/,"Podemos"],[/^(IU|I\.U\.|IC-V|ICV)/,"IU"],
  [/^PCE|^PSUC/,"PCE"],[/^(MAS PAIS|MES COMPROM)/,"Más País"],[/^COMPROMIS/,"Compromís"],[/^PSC/,"PSC"],[/PSOE|^P\.S\.O\.E/,"PSOE"],[/^AP\b|^AP-/,"AP"],[/^CD\b/,"CD"],[/^P\.?P\b|^PP/,"PP"],
  [/^VOX/,"Vox"],[/^C['´`’]S\b|^CS\b/,"Cs"],[/^(ERC|ESQUERRA|EC-FED|ERFN)/,"ERC"],[/^(JXCAT|JUNTS)/,"Junts"],[/^CIU/,"CiU"],[/^CDC/,"CDC"],[/^DL\b/,"DL"],[/^PDPC/,"PDPC"],
  [/^EH BILDU/,"Bildu"],[/^AMAIUR/,"Amaiur"],[/^HB\b/,"HB"],[/PNV/,"PNV"],[/^(BNG|B\.N\.G)/,"BNG"],[/^(CC|CCA)\b|^CC-|^CCA-/,"CC"],[/^UCD/,"UCD"],[/^(CDS|C\.D\.S)/,"CDS"],
  [/^UPN-PP/,"UPN-PP"],[/^(UPN|U\.P\.N)/,"UPN"],[/^NA\+/,"Navarra Suma"],[/^(¡?TERUEL)/,"Teruel Existe"],[/^EA\b/,"EA"],[/^UPYD/,"UPyD"]];
const siglaCorta = s => { const x = planoMay(s).trim(); return (CORTOS_PARTIDO.find(([re])=>re.test(x)) || [, s])[1]; };
const cacheD = {};
const cargarD = id => cacheD[id] ||= pedir(`datos/elecciones/historico-${id}.json`);

export async function pintarProvincias(sec, c){
  ctx = c; estilos();
  await base(); if (!HIST){ sec.innerHTML = `<p class="nota">No se ha podido cargar el histórico.</p>`; return; }
  const E = HIST.elecciones, quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cods = Object.keys(GEO.provincias).filter(c2=>E[E.length-1].prov[c2]);
  let k = Math.max(0, E.findIndex(e=>e.id===anioRecordado())); if (E[k]?.id !== anioRecordado()) k = E.length - 1;
  const D = {};   // el detalle de cada elección, cuando llega (para el último escaño y el partido exacto que ganó)
  // Quién ganó cada provincia en cada elección: la familia más votada y, si hay detalle, la candidatura exacta.
  const topFam = (e, f) => (e.partidos || []).filter(x=>x[2]===f).sort((a,b)=>b[3]-a[3])[0];
  // La candidatura más votada (no la familia: en 2015, Podemos e IU iban por separado). Sin el detalle, la familia como aproximación.
  function ganador(j, cod){
    const e = E[j], p = e.prov[cod]; if (!p) return null;
    const det = D[e.id]?.prov?.[cod]?.c?.slice().sort((a,b)=>b[2]-a[2])[0];
    if (det) return {f: det[1], v: det[2], s: det[3], cuota: det[2]/p.validos, sig: det[0], nombre: siglaCorta(det[0]), color: colorPartido(det[0], det[1])};
    const [f, [v, s]] = Object.entries(p.fam).sort((a,b)=>b[1][0]-a[1][0])[0], nac = topFam(e, f);
    return {f, v, s, cuota: v/p.validos, sig: nac?.[0] || "Otros", nombre: f === "OTROS" || !nac ? "Otros" : siglaCorta(nac[0]), color: f === "OTROS" || !nac ? G8.OTROS.color : colorPartido(nac[0], f)};
  }
  // Para contar y para la leyenda, cada marca con su partido de siempre (el PSC con el PSOE, las confluencias con Podemos).
  const MARCA = {"PSC":"PSOE", "En Comú":"Podemos", "En Marea":"Podemos"}, marca = n => MARCA[n] || n;
  const METRICAS = [["primera","Primera fuerza"],["e","Escaños"],["part","Participación"],["precio","Votos por escaño"],["margen","Último escaño"]];
  const valor = (j, cod, m) => { const p = E[j].prov[cod]; if (!p) return null;
    return m === "e" ? p.e : m === "part" ? p.votantes/p.censo : m === "precio" ? p.validos/p.e : m === "margen" ? D[E[j].id]?.prov?.[cod]?.ultimo?.faltan ?? null : null; };
  const fmtM = (m, v) => v == null ? "–" : m === "part" ? pct(v) : m === "e" ? `${v} ${v === 1 ? "escaño" : "escaños"}` : m === "precio" ? `${fmt(v)} votos` : `${fmt(v)} votos`;
  sec.innerHTML = `<section class="sec" style="padding-top:8px">
      <div class="pv-ctl"><div class="hi-seg" role="group" aria-label="Qué se pinta">${METRICAS.map(([v,l])=>`<button data-pv-m="${v}" aria-pressed="${v===modoProv}">${esc(l)}</button>`).join("")}</div>${chipsAnios(E, k, "pv", true)}</div>
      <div class="pv-top"><div class="chart pv-mapa-w"><h3 id="pv-t"></h3><div id="pv-mapa">${mapaSVG(()=>null)}</div><div id="pv-ley"></div></div>
        <div class="chart pv-res" id="pv-res"></div></div></section>
    <section class="sec"><div class="sec-h"><h2>Elección a elección</h2><p>Quién ganó cada provincia en las dieciséis generales. Pulsa un año para verlo en el mapa; pulsa una provincia para abrir su ficha.</p></div>
      <div class="chart"><div class="pv-tira" id="pv-tira"></div><div class="el-leyenda" id="pv-tira-ley"></div></div></section>
    <section class="sec"><div class="sec-h"><h2 id="pv-tabla-t"></h2><div class="controls"><input type="search" id="pv-busca" placeholder="Busca una provincia" aria-label="Buscar provincia" value="${esc(buscaProv)}"></div></div>
      <div class="chart hi-desliza" id="pv-tabla"></div></section>`;
  const $ = s => sec.querySelector(s), mapaEl = $("#pv-mapa");
  const paths = Object.fromEntries([...mapaEl.querySelectorAll("[data-p]")].map(p=>[p.dataset.p, p]));
  // ---------- el mapa ----------
  function pintarMapa(){
    const e = E[k], m = modoProv;
    $("#pv-t").textContent = `${METRICAS.find(x=>x[0]===m)[1]} · ${anioLargo(e)}`;
    sec.querySelectorAll("[data-pv-m]").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.pvM === m)));
    sec.querySelectorAll("[data-pv]").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.pv === k)));
    let color, ley = "", res = "";
    if (m === "primera"){
      const G = Object.fromEntries(cods.map(c2=>[c2, ganador(k, c2)]));
      color = c2 => G[c2]?.color;
      const cuenta = {}; Object.values(G).forEach(g=>{ if (!g) return; (cuenta[marca(g.nombre)] ||= {n:0, color:g.color}).n++; });
      const L = Object.entries(cuenta).sort((a,b)=>b[1].n - a[1].n), max = L[0]?.[1].n || 1;
      res = `<div class="eyebrow">Primera fuerza en…</div>${L.map(([n,x])=>`<div class="pv-cuenta"><span class="nm"><i style="background:${x.color}"></i>${esc(n)}</span><span class="br"><i style="width:${(x.n/max*100).toFixed(1)}%;background:${x.color}"></i></span><b>${x.n}</b></div>`).join("")}<p class="nota">provincias de ${cods.length}</p>`;
    } else {
      const vs = cods.map(c2=>[c2, valor(k, c2, m)]).filter(x=>x[1] != null);
      if (!vs.length){ color = ()=>null; res = `<p class="nota">Cargando…</p>`; }
      else {
        const nums = vs.map(x=>x[1]), lo = m === "e" ? 0 : Math.min(...nums), hi = Math.max(...nums), r = rampa(NEUTRO);
        const t = v => m === "margen" ? 1 - Math.sqrt((v-lo)/(hi-lo||1)) : m === "e" ? Math.sqrt(v/hi) : (v-lo)/(hi-lo||1);
        const V = Object.fromEntries(vs); color = c2 => V[c2] == null ? null : r(t(V[c2]));
        ley = leyendaRampa(m === "margen" ? x=>r(1-x) : r, lo, hi, m === "part" ? v=>pct(v,0) : m === "e" ? v=>v+" escaños" : v=>fmt(v)+" votos");
        const ord = vs.slice().sort((a,b)=>b[1]-a[1]), alto = ord.slice(0, 5), bajo = ord.slice(-5).reverse();
        const titA = {e:"Más escaños", part:"Más participación", precio:"Escaño más caro", margen:"Último escaño más holgado"}[m], titB = {e:"Menos escaños", part:"Menos participación", precio:"Escaño más barato", margen:"Último escaño más ajustado"}[m];
        const lista = (L, tit) => `<div class="eyebrow">${tit}</div>${L.map(([c2,v])=>`<a class="pv-top-f" href="${enlaceProv(c2)}"><span>${esc(nombreProv(c2))}</span><b>${esc(fmtM(m, v))}</b></a>`).join("")}`;
        res = m === "margen" ? lista(bajo, titB) + lista(alto, titA) : lista(alto, titA) + lista(bajo, titB);
      }
    }
    Object.entries(paths).forEach(([c2, p])=>{ p.style.fill = color(c2) || "var(--sunk)"; });
    $("#pv-ley").innerHTML = ley; $("#pv-res").innerHTML = res;
  }
  conTip(mapaEl, ev=>{ const p = ev.target.closest("[data-p]"); if (!p) return ""; const c2 = p.dataset.p, g = ganador(k, c2), pr = E[k].prov[c2]; if (!pr) return "";
    return `<b>${esc(nombreProv(c2))}</b> · ${anio(E[k])}<br>${g ? `Ganó <b style="color:${g.color}">${esc(g.nombre)}</b> (${pct(g.cuota)})<br>` : ""}${fmtM("e", pr.e)} · participación ${pct(pr.votantes/pr.censo)}<br>${fmt(pr.validos/pr.e)} votos por escaño${valor(k, c2, "margen") != null ? `<br>Último escaño por ${fmt(valor(k, c2, "margen"))} votos` : ""}`; });
  // ---------- elección a elección ----------
  const tira = $("#pv-tira");
  tira.innerHTML = `<div class="pv-fila pv-cab"><span></span>${E.map((e,j)=>`<button data-pv="${j}" title="${esc(anioLargo(e))}"><span class="ap">’</span>${anio(e).slice(2,4)}<span class="ap">${e.id === "201904" ? "a" : e.id === "201911" ? "n" : ""}</span></button>`).join("")}</div>`
    + CCAA_PROV.map(([ca, ps])=>`<div class="pv-ca">${esc(ca)}</div>` + ps.filter(c2=>cods.includes(c2)).map(c2=>`<div class="pv-fila" data-fila="${c2}"><a href="${enlaceProv(c2)}">${esc(nombreProv(c2))}</a>${E.map((e,j)=>`<i data-j="${j}" style="--d:${j*45}ms"></i>`).join("")}</div>`).join("")).join("");
  function pintarTira(){
    const ley = new Map();
    tira.querySelectorAll("[data-fila]").forEach(f=>{ const c2 = f.dataset.fila;
      f.querySelectorAll("i").forEach(cel=>{ const j = +cel.dataset.j, g = ganador(j, c2); cel.style.setProperty("--c", g ? g.color : "transparent"); cel.classList.toggle("sel", j === k); if (g) ley.set(marca(g.nombre), g.color); }); });
    tira.querySelectorAll(".pv-cab [data-pv]").forEach(b=>b.classList.toggle("sel", +b.dataset.pv === k));
    const porColor = new Map(); [...ley].forEach(([n,col])=>porColor.set(col, [...(porColor.get(col) || []), n]));   // AP y PP, CiU y DL…: un color, una entrada
    $("#pv-tira-ley").innerHTML = [...porColor].map(([col,ns])=>`<span><i style="background:${col}"></i>${esc(ns.join(" · "))}</span>`).join("");
  }
  conTip(tira, ev=>{ const cel = ev.target.closest("i[data-j]"); if (!cel) return ""; const c2 = cel.closest("[data-fila]").dataset.fila, j = +cel.dataset.j, g = ganador(j, c2), pr = E[j].prov[c2]; if (!g) return "";
    return `<b>${esc(nombreProv(c2))}</b> · ${esc(anioLargo(E[j]))}<br>Ganó <b style="color:${g.color}">${esc(g.nombre)}</b> con el ${pct(g.cuota)} de los votos<br>${g.s} de ${pr.e} ${pr.e === 1 ? "escaño" : "escaños"}`; });
  // Al llegar a la vista, las columnas se pintan de izquierda a derecha.
  if (!quieto && "IntersectionObserver" in window){ tira.classList.add("espera"); const io = new IntersectionObserver(es=>{ if (es.some(x=>x.isIntersecting)){ io.disconnect(); tira.classList.remove("espera"); } }, {threshold:.15}); io.observe(tira); }
  // ---------- la tabla ----------
  function tabla(){
    const e = E[k], cols = [["nombre","Provincia"],["e","Escaños"],["part","Participación"],["precio","Votos por escaño"],["primera","Primera fuerza"],["margen","Último escaño"]];
    $("#pv-tabla-t").textContent = `Las ${cods.length} circunscripciones en ${anio(e)}`;
    const F = cods.filter(c2=>e.prov[c2]).map(c2=>{ const p = e.prov[c2]; return {cod:c2, nombre:nombreProv(c2), e:p.e, part:p.votantes/p.censo, precio:p.validos/p.e, g:ganador(k, c2), margen:valor(k, c2, "margen")}; })
      .filter(f=>!buscaProv || planoMay(f.nombre).includes(planoMay(buscaProv)));
    const kk = ordenProv.col, sg = ordenProv.asc ? 1 : -1, maxPart = Math.max(...F.map(f=>f.part), .01);
    const orden = F.sort((a,b)=>{ const x = kk==="primera" ? a.g?.nombre : a[kk], y = kk==="primera" ? b.g?.nombre : b[kk];
      if (x==null) return 1; if (y==null) return -1; return (typeof x === "string" ? x.localeCompare(y, "es") : x - y) * sg; });
    // La evolución de los escaños de cada provincia, en miniatura (el año elegido, marcado).
    // En escalón (los escaños van de uno en uno) y con un margen mínimo de 4: un escaño arriba o abajo no parece un vuelco.
    const chispa = cod => { const s = E.map(x=>x.prov[cod]?.e ?? null), vs = s.filter(v=>v!=null), mx = Math.max(...vs), mn = Math.min(...vs), W = 64, H = 18;
      const rango = Math.max(mx - mn, 4), base = (mx + mn)/2 - rango/2, X = j => j/(E.length-1)*W, Y = v => H - 2 - (v - base)/rango*(H-4);
      return `<svg class="pv-chispa" viewBox="-2 -1 ${W+4} ${H+2}" aria-hidden="true"><path d="${s.map((v,j)=>v==null?"":j?`H${X(j).toFixed(1)}V${Y(v).toFixed(1)}`:`M0 ${Y(v).toFixed(1)}`).join("")}"/><circle cx="${X(k).toFixed(1)}" cy="${Y(s[k]).toFixed(1)}" r="2.4"/></svg>`; };
    $("#pv-tabla").innerHTML = `<table class="hi-tabla pv-tabla"><thead><tr>${cols.map(([c2,l])=>`<th class="${c2==="nombre"||c2==="primera"?"":"n"}"><button data-orden="${c2}" aria-label="Ordenar por ${esc(l)}">${esc(l)}${c2===kk?(ordenProv.asc?" ↑":" ↓"):""}</button></th>`).join("")}</tr></thead><tbody>
      ${orden.map(f=>`<tr data-ir="${enlaceProv(f.cod)}"><td><a href="${enlaceProv(f.cod)}">${esc(f.nombre)}</a></td><td class="n"><span class="pv-esc">${chispa(f.cod)}<b>${f.e}</b></span></td>
        <td class="n"><span class="pv-part"><i style="width:${(f.part/maxPart*100).toFixed(1)}%"></i></span>${pct(f.part)}</td><td class="n">${fmt(f.precio)}</td>
        <td>${f.g ? `<span class="pv-chip" style="--c:${f.g.color}">${esc(f.g.nombre)}</span>` : "–"}</td><td class="n">${f.margen!=null?fmt(f.margen)+" votos":"–"}</td></tr>`).join("") || `<tr><td colspan="6" class="nota">Ninguna provincia con ese nombre.</td></tr>`}</tbody></table>`;
  }
  // ---------- el año ----------
  let playP = null;
  function ir(j){ k = j; recordarAnio(E[k].id); pintarMapa(); pintarTira(); tabla();
    if (!D[E[k].id]) cargarD(E[k].id).then(d=>{ if (!d) return; D[E[k].id] = d; if (E[j].id === E[k].id){ pintarMapa(); pintarTira(); tabla(); } }); }
  function pararP(){ clearInterval(playP); playP = null; const b = sec.querySelector("[data-pv-play]"); if (b) b.textContent = "▶ Reproducir"; }
  sec.addEventListener("click", ev=>{
    const m = ev.target.closest("[data-pv-m]"); if (m){ modoProv = m.dataset.pvM; pintarMapa(); return; }
    if (ev.target.closest("[data-pv-play]")){ if (playP){ pararP(); return; } sec.querySelector("[data-pv-play]").textContent = "❚❚ Pausa"; if (k >= E.length-1) ir(0); else ir(k+1);
      playP = setInterval(()=>{ if (k >= E.length-1 || !document.body.contains(sec)){ pararP(); return; } ir(k+1); }, 1500); return; }
    const y = ev.target.closest("[data-pv]"); if (y){ pararP(); ir(+y.dataset.pv); return; }
    const cel = ev.target.closest("#pv-tira i[data-j]"); if (cel){ pararP(); ir(+cel.dataset.j); return; }
    const o = ev.target.closest("[data-orden]"); if (o){ const c2 = o.dataset.orden; ordenProv = {col:c2, asc: ordenProv.col===c2 ? !ordenProv.asc : c2==="nombre"||c2==="margen"}; tabla(); return; }
    const tr = ev.target.closest("tr[data-ir]"); if (tr && !ev.target.closest("a")) location.hash = tr.dataset.ir.slice(1);
  });
  $("#pv-busca").addEventListener("input", ev=>{ buscaProv = ev.target.value; tabla(); });
  // El detalle de las dieciséis (unos 20 KB cada una), antes de pintar: el ganador de cada provincia es su candidatura más votada.
  await Promise.all(E.map(e=>cargarD(e.id).then(d=>{ if (d) D[e.id] = d; })));
  ir(k);
}

/* =====================================================================================================
   FICHA DE UNA PROVINCIA
   ===================================================================================================== */
export async function pintarProvincia(sec, c, sub){
  ctx = c; estilos();
  await base(); if (!HIST){ sec.innerHTML = `<p class="nota">No se ha podido cargar el histórico.</p>`; return; }
  const sl = sub.replace(/^provincia-/, ""), cod = Object.keys(GEO.provincias).find(k=>slugProv(k)===sl);
  if (!cod){ sec.innerHTML = `<p class="nota">No existe esa circunscripción. <a href="#elecciones-provincias">Ver las 52</a></p>`; return; }
  const P = await pedir(`datos/elecciones/provincias/${cod}.json`);
  if (!P){ sec.innerHTML = `<p class="nota">No se ha podido cargar la ficha.</p>`; return; }
  const E = HIST.elecciones.filter(e=>P[e.id]), nombre = nombreProv(cod);
  let k = Math.max(0, E.findIndex(e=>e.id===anioRecordado())); if (E[k]?.id !== anioRecordado()) k = E.length - 1;
  const ult = P[E[E.length-1].id], pri = P[E[0].id];
  const diputados = ctx.DIPS.filter(d=>!d[8] && d[2]===nombre);
  sec.innerHTML = `
    <div class="view-intro"><div><div class="eyebrow">Circunscripción electoral</div><h2>${esc(nombre)}</h2>
      <p>Elige ${ult.e} ${ult.e===1?"diputado":"diputados"} al Congreso (${pri.e} en 1977). <a href="#provincia-${esc(sl)}">Sus diputados de la XV legislatura</a> · <a href="#elecciones-escano" data-sim-prov="${cod}">Simular su reparto D'Hondt</a></p></div></div>
    <section class="sec" style="padding-top:10px">${chipsAnios(E, k, "pr")}</section>
    <div id="pr-kpis" style="margin-top:10px"></div>
    <div class="hi-top" style="margin-top:12px">
      <div class="chart"><h3 id="pr-hemi-t"></h3>${hemiSVG(P[E[k].id].e)}<div id="pr-leyenda"></div></div>
      <div class="chart hi-desliza" id="pr-tabla"></div>
    </div>
    <section class="sec"><div class="sec-h"><h2>Cómo se repartieron los escaños</h2><p>La tabla de la ley D'Hondt: los votos de cada candidatura entre 1, 2, 3… Los ${"<span id='pr-n'></span>"} cocientes más altos se llevan los escaños; el recuadro marca el último. Solo entran las candidaturas con el 3 % de los votos válidos.</p></div>
      <div class="chart hi-desliza" id="pr-cocientes"></div></section>
    <div class="hi-dos" style="margin-top:18px">
      <div class="chart"><h3>Escaños en cada elección</h3><p class="sub">Por familia de partidos. Pulsa una elección para verla arriba.</p><div id="pr-apilado"></div></div>
      <div class="chart"><h3>Voto a cada familia</h3><p class="sub">Parte de los votos válidos. Pulsa una familia para destacarla.</p><div class="hi-chips" id="pr-fams"></div><div id="pr-lineas"></div></div>
    </div>
    <div class="hi-dos" style="margin-top:18px">
      <div class="chart"><h3>Participación</h3><p class="sub">${esc(nombre)} frente al total de España.</p><div id="pr-part"></div></div>
      <div class="chart"><h3>Votos por escaño</h3><p class="sub">Votos válidos entre escaños en ${esc(nombre)} y en el conjunto de España.</p><div id="pr-precio"></div></div>
    </div>
    <section class="sec" id="pr-muni"><div class="sec-h"><h2>Municipio a municipio</h2><p>El voto en cada municipio de ${esc(nombre)} (sin el voto desde el extranjero).</p></div><p class="nota">Cargando…</p></section>
    ${diputados.length?`<section class="sec"><div class="sec-h"><h2>Sus diputados en la XV legislatura</h2></div><div class="hi-chips">${diputados.sort((a,b)=>ctx.ORDEN_HEMI.indexOf(a[1])-ctx.ORDEN_HEMI.indexOf(b[1])).map(d=>`<a href="#diputado-${esc(ctx.slug(d[0]))}"><i style="background:${ctx.G[d[1]]?.color}"></i>${esc(ctx.legible(d[0]))}</a>`).join("")}</div></section>`:""}`;
  // Series de toda la historia de la provincia.
  const Gv = E.map(e=>porGrupoLista(P[e.id].c)), validos = E.map(e=>P[e.id].validos);
  const apilado = () => { const cont = sec.querySelector("#pr-apilado"), vals = Gv.map(g=>Object.fromEntries(Object.entries(g).map(([a,b])=>[a,b[1]])));
    cont.innerHTML = graficoApilado(E, vals, {sel:k, ancho:cont.clientWidth, total:Math.max(...E.map(e=>P[e.id].e)), mayoria:false});
    montarApilado(cont.querySelector("svg"), E, vals, j=>{ k = j; pintar(); }); };
  const fams = GRUPOS.filter(g=>Gv.some(x=>x[g.id][0]));
  let destacada = null;
  const lineas = () => { const cont = sec.querySelector("#pr-lineas"), max = Math.max(...Gv.flatMap((g,i)=>fams.map(f=>g[f.id][0]/validos[i])));
    cont.innerHTML = graficoLinea(E, fams.map(f=>({nombre:CORTO[f.id], color: !destacada || destacada===f.id ? f.color : "var(--line-strong)", valores:Gv.map((g,i)=>g[f.id][0] ? g[f.id][0]/validos[i] : null),
      extremos: destacada===f.id, etiqueta: !destacada ? Gv[Gv.length-1][f.id][0] > 0 : destacada===f.id})), {min:0, max:Math.min(1, Math.ceil(max*10)/10), ancho:cont.clientWidth, alto:240});
    if (destacada) cont.querySelectorAll("[data-serie]").forEach((g,i)=>{ if (fams[i].id!==destacada) g.style.opacity = .35; else g.parentNode.appendChild(g); });
    montarLineas(cont, E, v=>pct(v), j=>{ k = j; pintar(); }); };
  sec.querySelector("#pr-fams").innerHTML = fams.map(f=>`<button data-fam="${f.id}" aria-pressed="false"><i style="background:${f.color}"></i>${esc(CORTO[f.id])}</button>`).join("");
  sec.querySelector("#pr-fams").addEventListener("click", ev=>{ const b = ev.target.closest("[data-fam]"); if (!b) return; destacada = destacada===b.dataset.fam ? null : b.dataset.fam;
    sec.querySelectorAll("[data-fam]").forEach(x=>x.setAttribute("aria-pressed", String(x.dataset.fam===destacada))); lineas(); });
  const pa = sec.querySelector("#pr-part");
  pa.innerHTML = graficoLinea(E, [{nombre:nombre.split(/[\/(]/)[0].trim(), color:NEUTRO, valores:E.map(e=>(P[e.id].validos+P[e.id].nulos)/P[e.id].censo)}, {nombre:"España", color:"#8A8F98", valores:E.map(e=>e.votantes/e.censo), extremos:false}], {min:.5, max:.9, ancho:pa.clientWidth});
  const pp = sec.querySelector("#pr-precio"), precios = E.map(e=>P[e.id].validos/P[e.id].e), nacional = E.map(e=>e.validos/350), maxP = Math.max(...precios, ...nacional);
  pp.innerHTML = graficoLinea(E, [{nombre:nombre.split(/[\/(]/)[0].trim(), color:NEUTRO, valores:precios}, {nombre:"España", color:"#8A8F98", valores:nacional, extremos:false}], {min:0, max:Math.ceil(maxP/20000)*20000, paso:20000, ancho:pp.clientWidth, formato:v=>fmt(v), eje:v=>fmt(v/1000)+" mil"});
  montarLineas(pa, E); montarLineas(pp, E, v=>fmt(v)+" votos");
  function pintar(){
    const e = E[k], p = P[e.id], gr = porGrupoLista(p.c), p1 = p.c.find(x=>x[3]), votantes = p.validos + p.nulos;
    recordarAnio(e.id);
    sec.querySelectorAll("[data-pr]").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.pr===k)));
    const partE = e.votantes/e.censo, partP = votantes/p.censo;
    sec.querySelector("#pr-kpis").innerHTML = `<div class="kpis"><div class="kpi"><b>${p.e}</b><span>escaños en ${anio(e)}</span></div>
      <div class="kpi"><b>${pct(partP)}</b><span>participación (${conSigno((partP-partE)*100, v=>dec(v,1))} pt frente a España)</span></div>
      <div class="kpi"><b>${fmt(p.validos/p.e)}</b><span>votos por escaño</span></div><div class="kpi"><b>${fmtCorto(p.sin_escano)}</b><span>votos sin escaño</span></div>
      ${p.ultimo?`<div class="kpi"><b>${fmt(p.ultimo.faltan)}</b><span>votos le faltaron a ${esc(p.ultimo.segundo)} para el último escaño, que ganó ${esc(p.ultimo.gana)}</span></div>`:""}</div>`;
    // Hemiciclo de la provincia con sus escaños de ese año.
    const caja = sec.querySelector(".hi-top .chart"), viejo = caja.querySelector(".hi-hemi");
    if (viejo && viejo.querySelectorAll("circle").length !== p.e) viejo.outerHTML = hemiSVG(p.e);
    sec.querySelector("#pr-hemi-t").textContent = `${anioLargo(e)}`;
    requestAnimationFrame(()=>pintarHemi(caja.querySelector(".hi-hemi"), segsLista(p.c, p.validos)));
    sec.querySelector("#pr-leyenda").innerHTML = leyendaGrupos(GRUPOS.filter(x=>gr[x.id][1]).map(x=>x.id));
    const filas = p.c.filter(x=>x[3] || x[2] >= 0.01*p.validos), max = Math.max(...filas.map(x=>x[2]));
    sec.querySelector("#pr-tabla").innerHTML = `<h3>Resultados</h3><table class="hi-tabla"><thead><tr><th>Candidatura</th><th class="n">Votos</th><th class="n">%</th><th></th><th class="n">Escaños</th></tr></thead><tbody>
      ${filas.map(x=>`<tr><td><i class="d" style="background:${colorPartido(x[0], x[1])}"></i>${esc(x[0])}</td><td class="n">${fmt(x[2])}</td><td class="n">${pct(x[2]/p.validos)}</td><td style="width:24%"><span class="bar" style="width:${(x[2]/max*100).toFixed(1)}%;background:${colorPartido(x[0], x[1])}"></span></td><td class="n"><b>${x[3]}</b></td></tr>`).join("")}</tbody></table>
      <p class="nota">Votos válidos: ${fmt(p.validos)} (${fmt(p.blancos)} en blanco). <a href="${enlaceE(e)}">Ver la elección de ${anio(e)} en toda España →</a></p>`;
    sec.querySelector("#pr-n").textContent = p.e;
    sec.querySelector("#pr-cocientes").innerHTML = tablaCocientes(p);
    apilado();
  }
  sec.addEventListener("click", ev=>{
    const b = ev.target.closest("[data-pr]"); if (b){ k = +b.dataset.pr; pintar(); return; }
    const s = ev.target.closest("[data-sim-prov]"); if (s){ try{ localStorage.setItem("el-sim-prov", s.dataset.simProv); }catch(err){} }
  });
  pintar(); lineas();
  // Mapa municipal de la provincia.
  pintarMapaMunicipal(sec.querySelector("#pr-muni"), {prov: cod});
}
function tablaCocientes(p){
  const entran = p.c.filter(x=>x[2] >= 0.03*p.validos);
  const coc = entran.flatMap(x=>Array.from({length:p.e},(_,d)=>({s:x[0], v:x[2], q:x[2]/(d+1), d:d+1, col:colorPartido(x[0], x[1])}))).sort((a,b)=>b.q-a.q || b.v-a.v);
  const gan = new Map(coc.slice(0, p.e).map((x,i)=>[x.s+"|"+x.d, i+1]));
  const cols = Math.min(p.e, 40);
  return `<table class="hi-cocientes"><thead><tr><th class="c">Candidatura</th>${Array.from({length:cols},(_,d)=>`<th>÷${d+1}</th>`).join("")}</tr></thead><tbody>
    ${entran.map(x=>`<tr><th class="c">${esc(x[0])}</th>${Array.from({length:cols},(_,d)=>{ const n = gan.get(x[0]+"|"+(d+1)), q = x[2]/(d+1), col = colorPartido(x[0], x[1]);
      return `<td class="${n?"g":""}${n===p.e?" u":""}" ${n?`style="background:${col};color:${textoSobre(col)}"`:""} data-tip="${esc(`<b>${esc(x[0])}</b> ÷ ${d+1} = ${fmt(q)}${n?`<br>Escaño nº ${n} de ${p.e}`:"<br>No llega a escaño"}`)}">${fmt(q)}</td>`; }).join("")}</tr>`).join("")}</tbody></table>
    ${p.e>cols?`<p class="nota">Se muestran los ${cols} primeros divisores.</p>`:""}`;
}

/* =====================================================================================================
   MÉTRICAS
   ===================================================================================================== */
export async function pintarMetricas(sec, c){
  ctx = c; estilos();
  await base(); if (!HIST){ sec.innerHTML = `<p class="nota">No se ha podido cargar el histórico.</p>`; return; }
  const E = HIST.elecciones;
  const tarjeta = (id, titulo, texto) => `<div class="chart"><h3>${esc(titulo)}</h3><p class="sub">${texto}</p><div id="${id}"></div></div>`;
  sec.innerHTML = `<p class="nota" style="padding-top:8px">Pasa por encima de cualquier gráfico para ver el valor de cada elección y pulsa para abrir su ficha.</p>
    <div class="hi-dos" style="margin-top:10px">
      ${tarjeta("me-part", "Participación", "Votantes sobre el censo, con el voto desde el extranjero.")}
      ${tarjeta("me-mayoria", "Primera fuerza y mayoría absoluta", "Escaños de la candidatura más votada. La línea marca los 176 de la mayoría absoluta.")}
      ${tarjeta("me-nep", "Número efectivo de partidos", "Cuántos partidos «cuentan» de verdad (índice de Laakso y Taagepera): 2 es un bipartidismo puro; cuanto más alto, más fragmentado. Por votos y por escaños.")}
      ${tarjeta("me-bip", "PSOE y PP juntos", "Su parte de los votos válidos y de los escaños.")}
      ${tarjeta("me-gal", "Desproporcionalidad", "Índice de Gallagher: cuánto se separa el reparto de escaños del de votos, en puntos. 0 sería un reparto exactamente proporcional.")}
      ${tarjeta("me-ped", "Volatilidad", "Índice de Pedersen: qué parte del voto cambió de familia de partidos respecto a la elección anterior.")}
      ${tarjeta("me-sin", "Votos sin escaño", "Votos a candidaturas que no sacaron ningún escaño en su provincia.")}
    </div>
    <p class="nota">Los índices se calculan por familias de partidos (las confluencias van con su familia) y, dentro de «Otros», por candidatura. Fuente: Ministerio del Interior.</p>`;
  const ancho = id => sec.querySelector("#"+id).clientWidth;
  sec.querySelector("#me-part").innerHTML = graficoLinea(E, [{nombre:"Participación", color:NEUTRO, valores:E.map(e=>e.votantes/e.censo)}], {min:.6, max:.85, ancho:ancho("me-part")});
  sec.querySelector("#me-nep").innerHTML = graficoLinea(E, [{nombre:"Votos", color:"#6E8FB8", valores:E.map(e=>e.metricas.nep_votos)}, {nombre:"Escaños", color:"#C9A227", valores:E.map(e=>e.metricas.nep_escanos)}], {min:2, max:6.5, paso:.5, ancho:ancho("me-nep"), formato:v=>dec(v,1), eje:v=>dec(v,1)});
  sec.querySelector("#me-bip").innerHTML = graficoLinea(E, [{nombre:"Votos", color:"#6E8FB8", valores:E.map(e=>((e.fam.PSOE?.[0]||0)+(e.fam.PP?.[0]||0))/e.validos)}, {nombre:"Escaños", color:"#C9A227", valores:E.map(e=>((e.fam.PSOE?.[1]||0)+(e.fam.PP?.[1]||0))/350)}], {min:.3, max:1, ancho:ancho("me-bip")});
  sec.querySelector("#me-gal").innerHTML = graficoLinea(E, [{nombre:"Gallagher", color:NEUTRO, valores:E.map(e=>e.metricas.gallagher)}], {min:0, max:12, paso:2, ancho:ancho("me-gal"), formato:v=>dec(v,1), eje:v=>v});
  sec.querySelector("#me-ped").innerHTML = graficoLinea(E, [{nombre:"Pedersen", color:NEUTRO, valores:E.map(e=>e.metricas.pedersen ?? null)}], {min:0, max:40, paso:10, ancho:ancho("me-ped"), formato:v=>dec(v,1)+" %", eje:v=>v+"%"});
  sec.querySelector("#me-sin").innerHTML = graficoLinea(E, [{nombre:"Votos sin escaño", color:NEUTRO, valores:E.map(e=>e.metricas.sin_escano)}], {min:1e6, max:3.5e6, paso:5e5, ancho:ancho("me-sin"), formato:v=>fmtCorto(v), eje:v=>dec(v/1e6,1)+" M"});
  sec.querySelector("#me-mayoria").innerHTML = barrasMayoria(E, ancho("me-mayoria"));
  montarLineas(sec, E, v=>v < 1 ? pct(v) : v > 1000 ? fmt(v) : dec(v,2));
}
function barrasMayoria(E, ancho){
  const W = Math.max(300, ancho), H = 220, ml = 34, mr = 8, mt = 12, mb = 24, n = E.length, bw = (W-ml-mr)/n;
  const y = v => mt + (1-v/220)*(H-mt-mb);
  return `<svg class="hi-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Escaños de la primera fuerza en cada elección">
    ${[0,100,176,220].map(v=>`<line class="eje" x1="${ml}" x2="${W-mr}" y1="${y(v)}" y2="${y(v)}" ${v===176?'stroke-dasharray="3 3" style="stroke:var(--ink)"':""}/><text class="tick" x="${ml-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join("")}
    ${E.map((e,k)=>{ const p = e.partidos[0], col = colorPartido(p[0], p[2]), x0 = ml + k*bw + bw*.2, w = Math.min(24, bw*.6);
      return `<a href="${enlaceE(e)}"><g data-tip="${esc(`<b>${esc(anioLargo(e))}</b><br>${esc(p[0])}: ${p[4]} escaños${p[4]>=176?" (mayoría absoluta)":` (a ${176-p[4]} de la mayoría)`}`)}"><rect x="${ml+k*bw}" y="${mt}" width="${bw}" height="${H-mt-mb}" fill="transparent"/>
        <path d="M${x0} ${y(0)}V${y(p[4])+4}q0-4 4-4h${w-8}q4 0 4 4V${y(0)}Z" style="fill:${col}"/></g></a>
        ${k%3===0||k===n-1?`<text class="tick" x="${x0+w/2}" y="${H-6}" text-anchor="middle">${e.fecha.slice(2,4)}</text>`:""}`; }).join("")}</svg>`;
}

/* =====================================================================================================
   EL REPARTO DE ESCAÑOS POR PROVINCIA, AÑO A AÑO (en «Los 350»)
   ===================================================================================================== */
let selR = null, playR = null;
export async function pintarReparto(sec, c){
  ctx = c; estilos();
  await base(); if (!HIST){ sec.innerHTML = ""; return; }
  // Con el decreto de convocatoria se conoce el reparto del 29N (aún sin resultados: los escaños, en gris).
  const E = c.escanos2026 ? [...HIST.elecciones, {id:"2026", fecha:"2026-11-29", prov:Object.fromEntries(Object.entries(c.escanos2026).map(([k,e])=>[k, {e, fam:{}}]))}] : HIST.elecciones;
  selR ??= E.length - 1;
  sec.innerHTML = `<div class="sec-h"><h2>Cómo ha cambiado el reparto</h2><p>Cada provincia tiene al menos dos diputados (Ceuta y Melilla, uno) y el resto se reparte según su población antes de cada elección. Cada punto es un escaño, del color de la familia que lo ganó.</p></div>
    ${chipsAnios(E, selR, "re", true)}
    <div class="hi-reparto"><div class="chart"><svg class="hi-svg" id="re-svg" viewBox="0 0 ${GEO.ancho} ${GEO.alto}" role="img" aria-label="Escaños de cada provincia en la elección seleccionada"><g class="mapa">${Object.values(GEO.provincias).map(p=>`<path class="prov" d="${p.d}" style="fill:var(--sunk)" opacity=".5"></path>`).join("")}<path class="can" d="${GEO.canarias}"/></g><g class="pts"></g></svg>${leyendaGrupos()}</div>
      <div class="chart" id="re-lado"></div></div>`;
  const svg = sec.querySelector("#re-svg"), capa = svg.querySelector(".pts"), NS = "http://www.w3.org/2000/svg";
  const puntos = {};   // provincia -> [circle]
  function pintar(k){
    selR = k; const e = E[k];
    sec.querySelectorAll("[data-re]").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.re===k)));
    const cuantos = Object.fromEntries(Object.entries(e.prov).map(([c,p])=>[c, p.e])), R = racimos(cuantos, GEO);
    for (const [cod, p] of Object.entries(e.prov)){
      const pos = girasol(p.e), colores = GRUPOS.flatMap(g=>Array(porGrupo(p.fam)[g.id][1]).fill(g.color));
      const lista = puntos[cod] ||= [];
      while (lista.length < p.e){ const ci = document.createElementNS(NS, "circle"); ci.setAttribute("r", R_PUNTO); ci.style.opacity = 0; ci.dataset.p = cod; capa.appendChild(ci); lista.push(ci); }
      lista.forEach((ci, j)=>{
        if (j < p.e){ ci.style.cx = (R[cod].x + pos[j].x).toFixed(1) + "px"; ci.style.cy = (R[cod].y + pos[j].y).toFixed(1) + "px"; ci.style.fill = colores[j] || "#888"; ci.style.opacity = 1; }
        else ci.style.opacity = 0;
      });
    }
    const pri = E[0], cambios = Object.keys(e.prov).map(c2=>[c2, e.prov[c2].e - pri.prov[c2].e]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]);
    const ant = E[k-1], cambiosAnt = ant ? Object.keys(e.prov).map(c2=>[c2, e.prov[c2].e - (ant.prov[c2]?.e||0)]).filter(x=>x[1]) : [];
    sec.querySelector("#re-lado").innerHTML = `<div class="eyebrow">${esc(anioLargo(e))}${e.id === "2026" ? " · aún sin votar" : ""}</div>
      ${ant ? `<h3>Frente a ${esc(anio(ant))}</h3>${cambiosAnt.length ? `<ul class="el-lista">${cambiosAnt.map(([c2,d])=>`<li><a class="t" href="${enlaceProv(c2)}">${esc(nombreProv(c2))}</a><span class="m">${ant.prov[c2].e} → ${e.prov[c2].e} (${conSigno(d)})</span></li>`).join("")}</ul>` : `<p class="nota">Los mismos escaños en cada provincia.</p>`}` : ""}
      ${k ? `<h3>Frente a 1977</h3>${cambios.length ? `<ul class="el-lista">${cambios.map(([c2,d])=>`<li><a class="t" href="${enlaceProv(c2)}">${esc(nombreProv(c2))}</a><span class="m">${pri.prov[c2].e} → ${e.prov[c2].e} (${conSigno(d)})</span></li>`).join("")}</ul>` : `<p class="nota">El mismo reparto que en 1977.</p>`}`
        : `<p class="sub">El reparto de las primeras elecciones. Elige otra para ver qué provincias ganaron o perdieron escaños.</p>`}`;
  }
  conTip(svg, ev=>{ const ci = ev.target.closest("circle[data-p]"); if (!ci) return ""; const e = E[selR], p = e.prov[ci.dataset.p], g = porGrupo(p.fam);
    return `<b>${esc(nombreProv(ci.dataset.p))}</b> · ${p.e} escaños en ${anio(e)}${GRUPOS.filter(x=>g[x.id][1]).map(x=>filaTip(x.color, x.nombre, g[x.id][1])).join("")}`; });
  svg.addEventListener("click", ev=>{ const ci = ev.target.closest("circle[data-p]"); if (ci){ recordarAnio(E[selR].id); location.hash = enlaceProv(ci.dataset.p).slice(1); } });
  sec.addEventListener("click", ev=>{
    const b = ev.target.closest("[data-re]"); if (b){ parar(); pintar(+b.dataset.re); return; }
    if (ev.target.closest("[data-re-play]")){ playR ? parar() : reproducir(); }
  });
  function reproducir(){ sec.querySelector("[data-re-play]").textContent = "❚❚ Pausa"; let k = selR >= E.length-1 ? 0 : selR + 1; pintar(k);
    playR = setInterval(()=>{ k++; if (k >= E.length || !document.body.contains(sec)){ parar(); return; } pintar(k); }, 1700); }
  function parar(){ clearInterval(playR); playR = null; const b = sec.querySelector("[data-re-play]"); if (b) b.textContent = "▶ Reproducir"; }
  pintar(selR);
}

/* =====================================================================================================
   EL PRECIO DE UN ESCAÑO
   ===================================================================================================== */
const CSS_ID = s => String(s).replace(/[^A-Za-z0-9]/g, "_");   // para usar unas siglas como atributo
let selE = null, simProv = null, simVotos = null, heModo = "precio", tuProv = null, playE = null;
/* Cuenta de un número a otro (para las cifras grandes). */
function contar(el, a, b, f = fmt, dur = 700){
  if (!el) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || a === b){ el.textContent = f(b); return; }
  const t0 = performance.now(), ease = t => 1 - Math.pow(1 - t, 3);
  const paso = ahora => { const t = Math.min(1, (ahora - t0) / dur); el.textContent = f(a + (b - a) * ease(t)); if (t < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
}
export async function pintarEscano(sec, c){
  ctx = c; estilos();
  await base(); if (!HIST){ sec.innerHTML = `<p class="nota">No se han podido cargar los resultados.</p>`; return; }
  const E = HIST.elecciones;
  const recordada = E.findIndex(e=>e.id===anioRecordado());
  selE = recordada >= 0 ? recordada : (selE ?? E.length - 1);
  try{ const s = localStorage.getItem("el-sim-prov"); if (s){ simProv = s; simVotos = null; localStorage.removeItem("el-sim-prov"); } }catch(err){}
  tuProv ||= (()=>{ try{ const sl = localStorage.getItem("provincia"); const c2 = Object.keys(GEO.provincias).find(cod=>slugProv(cod)===sl); if (c2) return c2; }catch(err){} return "28"; })();
  const opcionesProv = sel => Object.keys(GEO.provincias).sort((a,b)=>nombreProv(a).localeCompare(nombreProv(b),"es")).map(c2=>`<option value="${c2}"${c2===sel?" selected":""}>${esc(nombreProv(c2))}</option>`).join("");
  sec.innerHTML = `<section class="sec" style="padding-top:8px">${chipsAnios(E, selE, "he", true)}
    <div class="pe-hero">
      <div class="pe-tu"><div class="eyebrow">¿Cuánto vale tu voto?</div>
        <label class="pe-sel">En <select data-pe-prov aria-label="Tu provincia">${opcionesProv(tuProv)}</select></label>
        <div class="pe-n"><b data-pe-precio>0</b><span>votos costó cada escaño en <span data-pe-anio></span></span></div>
        <p class="pe-frase" data-pe-frase></p></div>
      <div class="pe-balanza"><div class="pe-bal-t"><span>Más barato</span><span>Más caro</span></div><svg data-pe-bal role="img" aria-label="Votos por escaño en cada provincia"></svg>
        <p class="nota" style="margin:4px 0 0">Cada bola es una provincia, del tamaño de sus escaños. Pasa por una para verla; púlsala para hacerla tuya.</p></div>
    </div>
    <div class="pe-kpis"><div><b data-pe-k="barato">0</b><span data-pe-kl="barato"></span></div><div><b data-pe-k="caro">0</b><span data-pe-kl="caro"></span></div>
      <div class="alerta"><b data-pe-k="sin">0</b><span>votos fueron a candidaturas que no sacaron escaño en su provincia</span></div><div><b data-pe-k="mil">0</b><span>últimos escaños decididos por menos de 1.000 votos</span></div></div>
    <div class="hi-dos" style="margin-top:16px">
      <div class="chart"><h3 id="he-mapa-t">Votos por escaño en cada provincia</h3><div class="hi-seg" role="group" aria-label="Qué se pinta"><button data-he-modo="precio" aria-pressed="${heModo==="precio"}">Votos por escaño</button><button data-he-modo="perdidos" aria-pressed="${heModo==="perdidos"}">Votos que no sirvieron</button></div>
        <p class="sub" id="he-mapa-s"></p><div id="he-mapa"></div></div>
      <div class="chart"><h3>Votos y escaños: a quién favorece la ley</h3><p class="sub">Cada bola es un partido: sus votos en toda España y los escaños que sacó. La diagonal marca lo que le tocaría con un reparto proporcional: por encima, la ley le da más escaños que su parte de los votos; por debajo, menos.</p><svg class="pe-ve" data-pe-ve role="img" aria-label="Votos y escaños de cada partido frente al reparto proporcional"></svg><div class="pe-saldo" data-pe-ve-lado></div></div>
    </div>
    <div class="chart ps" style="margin-top:16px"><div class="eyebrow">El último escaño</div><h3 class="ps-t">El Congreso que pudo ser</h3>
      <p class="sub">En cada provincia, el último escaño se decidió por unos pocos votos. ¿Y si todos los que se decidieron por menos de una cifra hubieran caído del otro lado?</p>
      <div class="ps-c"><div class="ps-hemi" data-ps-hemi></div><div class="ps-lado"><div class="ps-cifras"><div><b data-ps-n>0</b><span>escaños se decidieron por menos de <span data-ps-umbral></span> votos</span></div><div><b data-ps-v>0</b><span>votos, sumándolos todos, bastaban para darles la vuelta<span data-ps-pct></span></span></div></div><div class="ps-g" data-ps-g></div></div></div>
      <div class="ps-esc"><div class="ps-esc-h"><span>Cada punto es un escaño, colocado según los votos que le faltaron al segundo para quitárselo al primero. <b>Mueve la línea:</b> los que quedan a su izquierda cambian de manos.</span>
        <div class="ps-btns"><button type="button" data-ps-play>▶ Reproducir</button><span class="ps-menos">Por menos de</span><button type="button" data-ps-ir="3">1.000</button><button type="button" data-ps-ir="3.699">5.000</button><button type="button" data-ps-ir="4">10.000</button><button type="button" data-ps-ir="max">Todos</button></div></div>
        <svg data-ps-esc role="img" aria-label="Escaños que cambian de manos según los votos repartidos"></svg>
        <input type="range" id="ps-r" class="sr" min="2" max="6" step="0.01" aria-label="Votos para repartir"></div>
      <div class="ps-tr"><div class="eyebrow">Quién se los lleva</div><div class="ps-fl-t"><span>Los pierde</span><span>Se los lleva</span></div><svg data-ps-flujo role="img" aria-label="De qué partido a qué partido pasan los escaños"></svg><div data-ps-lista></div></div></div>
    <div class="chart pe-sim" id="he-sim" style="margin-top:16px"></div></section>`;
  const $ = s => sec.querySelector(s);
  let P = null, prev = {barato:0, caro:0, sin:0, mil:0, precio:0};
  // Balanza: las provincias de la más barata a la más cara, sin solaparse.
  function balanza(e){
    const svg = $("[data-pe-bal]"), W = Math.max(300, svg.clientWidth || svg.parentNode.clientWidth || 600), H = 150, m = 14;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const xs = Object.entries(e.prov).map(([c2,p])=>({c:c2, v:p.validos/p.e, r:3 + Math.sqrt(p.e)*1.9}));
    const lo = Math.min(...xs.map(x=>x.v)), hi = Math.max(...xs.map(x=>x.v)), X = v => m + (v - lo)/(hi - lo || 1)*(W - 2*m);
    // Colocación tipo enjambre: cada bola, en la primera altura libre alrededor del centro.
    const puestas = [];
    xs.sort((a,b)=>b.r-a.r).forEach(b=>{ const x = X(b.v); let y = H/2;
      for (let k = 0; k < 60; k++){ const dy = (k % 2 ? 1 : -1) * Math.ceil(k/2) * 3; y = H/2 + dy;
        if (puestas.every(o=>Math.hypot(o.x - x, o.y - y) > o.r + b.r + 1)) break; }
      b.x = x; b.y = Math.max(b.r, Math.min(H - b.r, y)); puestas.push(b); });
    if (!svg.querySelector("g.bolas")) svg.innerHTML = `<line x1="${m}" x2="${W-m}" y1="${H/2}" y2="${H/2}" class="eje"/><g class="bolas"></g><g class="rots"></g>`;
    svg.querySelector("line.eje").setAttribute("x2", W - m);
    const g = svg.querySelector("g.bolas"), NS = "http://www.w3.org/2000/svg";
    xs.forEach(b=>{ let ci = g.querySelector(`[data-pe-c="${b.c}"]`);
      if (!ci){ ci = document.createElementNS(NS, "circle"); ci.dataset.peC = b.c; ci.style.cx = W/2 + "px"; ci.style.cy = H/2 + "px"; g.appendChild(ci); }
      ci.setAttribute("r", b.r.toFixed(1)); requestAnimationFrame(()=>{ ci.style.cx = b.x.toFixed(1) + "px"; ci.style.cy = b.y.toFixed(1) + "px"; });
      ci.classList.toggle("tu", b.c === tuProv); });
    const cab = xs.reduce((a,b)=>a.v < b.v ? a : b), cola = xs.reduce((a,b)=>a.v > b.v ? a : b), tu = xs.find(b=>b.c === tuProv);
    svg.querySelector("g.rots").innerHTML = [cab, cola, tu].filter((b,i,a)=>b && a.indexOf(b) === i).map(b=>`<text x="${Math.min(W - 4, Math.max(4, b.x)).toFixed(1)}" y="${(b.y - b.r - 5).toFixed(1)}" text-anchor="${b.x < 60 ? "start" : b.x > W - 60 ? "end" : "middle"}" class="${b.c === tuProv ? "tu" : ""}">${esc(nombreProv(b.c))}</text>`).join("");
    conTip(svg, ev=>{ const ci = ev.target.closest("[data-pe-c]"); if (!ci) return ""; const p = e.prov[ci.dataset.peC]; return `<b>${esc(nombreProv(ci.dataset.peC))}</b><br>${fmt(p.validos/p.e)} votos por escaño · ${p.e} escaños`; });
  }
  function tuVoto(e){
    const p = e.prov[tuProv]; if (!p) return;
    const precio = p.validos/p.e, media = e.validos/350;
    const precios = Object.values(e.prov).map(x=>x.validos/x.e), caro = Math.max(...precios), barato = Math.min(...precios);
    const caroC = Object.keys(e.prov).find(c2=>e.prov[c2].validos/e.prov[c2].e === caro), baratoC = Object.keys(e.prov).find(c2=>e.prov[c2].validos/e.prov[c2].e === barato);
    contar($("[data-pe-precio]"), prev.precio, precio); prev.precio = precio;
    $("[data-pe-anio]").textContent = anio(e);
    $("[data-pe-frase]").innerHTML = tuProv === caroC ? `Es la provincia donde un escaño costó más votos. Un voto aquí pesa <b>${dec(caro/barato, 1)} veces menos</b> que uno de ${esc(nombreProv(baratoC))}.`
      : `${precio < media ? "Menos" : "Más"} que la media de España (${fmt(media)}). Un voto de ${esc(nombreProv(tuProv))} pesa <b>${dec(caro/precio, 1)} veces</b> uno de ${esc(nombreProv(caroC))}${tuProv === baratoC ? ", la que más" : ""}.`;
  }
  /* Votos y escaños de cada partido: la diagonal es el reparto proporcional (escalas de raíz: la diagonal es recta). */
  function costes(e){
    const svg = $("[data-pe-ve]"), lado = $("[data-pe-ve-lado]");
    const W = Math.max(300, svg.parentNode.clientWidth || 520), H = Math.round(Math.min(420, W*0.78)), m = {l:44, r:16, t:14, b:34};
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const P = e.partidos.filter(x=>x[3] >= e.validos*0.003 || x[4]);   // los que cuentan: con escaño o con más del 0,3 %
    const prop = x => x[3]/e.validos*350;
    const maxV = Math.max(...P.map(x=>x[3])), maxE = Math.max(...P.map(x=>Math.max(x[4], prop(x))));
    const X = v => m.l + Math.sqrt(v/maxV)*(W - m.l - m.r), Y = s => H - m.b - Math.sqrt(s/maxE)*(H - m.t - m.b);
    const ticksV = [1e5, 5e5, 1e6, 2e6, 4e6, 8e6].filter(v=>v <= maxV*1.02), ticksE = [1, 5, 10, 25, 50, 100, 150].filter(s=>s <= maxE*1.02);
    if (!svg.querySelector("g.bolas")) svg.innerHTML = `<g class="ejes"></g><line class="diag"/><text class="diag-t"></text><g class="bolas"></g>`;
    svg.querySelector("g.ejes").innerHTML = ticksV.map(v=>`<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H - m.b}"/><text x="${X(v)}" y="${H - m.b + 16}" text-anchor="middle">${v >= 1e6 ? dec(v/1e6, 0) + " M" : fmt(v/1000) + " mil"}</text>`).join("")
      + ticksE.map(s=>`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(s)}" y2="${Y(s)}"/><text x="${m.l - 6}" y="${Y(s) + 4}" text-anchor="end">${s}</text>`).join("")
      + `<text x="${W - m.r}" y="${H - 2}" text-anchor="end" class="t">votos →</text><text x="${m.l - 6}" y="${m.t - 2}" text-anchor="end" class="t">escaños</text>`;
    const d = svg.querySelector("line.diag"), x2 = Math.min(maxV, maxE*e.validos/350);
    d.setAttribute("x1", X(0)); d.setAttribute("y1", Y(0)); d.setAttribute("x2", X(x2)); d.setAttribute("y2", Y(x2/e.validos*350));
    const dt = svg.querySelector("text.diag-t"); dt.setAttribute("x", X(x2*0.55)); dt.setAttribute("y", Y(x2*0.55/e.validos*350) + 16); dt.textContent = "reparto proporcional"; dt.setAttribute("transform", "");
    const g = svg.querySelector("g.bolas"), NS = "http://www.w3.org/2000/svg", vistos = new Set();
    P.forEach(x=>{ const id = x[0]; vistos.add(id);
      let b = g.querySelector(`[data-ve="${CSS_ID(id)}"]`);
      if (!b){ b = document.createElementNS(NS, "g"); b.dataset.ve = CSS_ID(id); b.innerHTML = `<circle r="7"/><text dy="-11" text-anchor="middle"></text>`; b.style.transform = `translate(${X(0)}px, ${Y(0)}px)`; g.appendChild(b); }
      b.querySelector("circle").style.fill = colorPartido(x[0], x[2]);
      const t = b.querySelector("text"); t.textContent = x[4] >= 2 || x[3] > e.validos*0.03 ? x[0] : "";
      b.dataset.tip = `<b>${esc(x[1])}</b><br>${fmt(x[3])} votos (${pct(x[3]/e.validos)}) · ${x[4]} ${x[4]===1?"escaño":"escaños"}<br>Con un reparto proporcional: ${dec(prop(x), 1)}<br>${x[4] ? `Cada escaño le costó ${fmt(x[3]/x[4])} votos` : "Ningún escaño"}`;
      requestAnimationFrame(()=>{ b.style.transform = `translate(${X(x[3]).toFixed(1)}px, ${Y(x[4]).toFixed(1)}px)`; b.style.opacity = 1; }); });
    g.querySelectorAll("[data-ve]").forEach(b=>{ if (![...vistos].map(CSS_ID).includes(b.dataset.ve)) b.style.opacity = 0; });
    // Rótulos sin pisarse: cada uno, en el primer hueco libre (encima, debajo, a la derecha o a la izquierda de su bola).
    const cajas = P.map(x=>{ const cx = X(x[3]), cy = Y(x[4]); return {x0: cx - 7, x1: cx + 7, y0: cy - 7, y1: cy + 7}; });   // las bolas también ocupan
    P.filter(x=>x[4] >= 2 || x[3] > e.validos*0.03).sort((a,b)=>b[3]-a[3]).forEach(x=>{
      const t = g.querySelector(`[data-ve="${CSS_ID(x[0])}"] text`); if (!t) return;
      const cx = X(x[3]), cy = Y(x[4]), w = x[0].length*6.8 + 6, h = 14;
      const opciones = [[0,-11,"middle"],[0,20,"middle"],[11,4,"start"],[-11,4,"end"],[7,-10,"start"],[-7,-10,"end"],[7,18,"start"],[-7,18,"end"],[0,-25,"middle"],[0,34,"middle"],[11,-10,"start"],[-11,-10,"end"]];
      const caja = ([dx,dy,an]) => { const x0 = an === "middle" ? cx + dx - w/2 : an === "start" ? cx + dx : cx + dx - w; return {x0, x1: x0 + w, y0: cy + dy - h + 3, y1: cy + dy + 3}; };
      const libre = o => { const c = caja(o); return c.x0 > 2 && c.x1 < W - 2 && cajas.every(k=>c.x1 < k.x0 || c.x0 > k.x1 || c.y1 < k.y0 || c.y0 > k.y1); };
      const o = opciones.find(libre) || opciones[0];
      cajas.push(caja(o)); t.setAttribute("x", o[0]); t.setAttribute("dy", o[1]); t.setAttribute("text-anchor", o[2]); });
    conTip(svg, ev=>{ const b = ev.target.closest("[data-ve]"); return b && b.style.opacity !== "0" ? b.dataset.tip : ""; });
    // Debajo: los escaños de más o de menos frente al reparto proporcional, uno a uno.
    const saldo = P.map(x=>[x, Math.round(x[4] - prop(x))]).filter(([,s])=>s).sort((a,b)=>b[1]-a[1]);
    const movidos = saldo.reduce((t,[,s])=>t + Math.max(0, s), 0);
    let k = 0; const cuadros = (n, color, cls) => Array.from({length:n}, ()=>`<i class="${cls}" style="--c:${color};--d:${Math.min(k++, 60)*22}ms"></i>`).join("");
    lado.innerHTML = `<p class="pe-sal-t">Frente a un reparto proporcional, la ley mueve <b>${movidos}</b> escaños. Cada cuadrado es uno.</p>
      <div class="pe-sal-h"><span>Le quita</span><span>Le da</span></div>` + saldo.map(([x,s])=>{ const c = colorPartido(x[0], x[2]);
      return `<div class="pe-sal" data-tip="${esc(`<b>${esc(x[1])}</b><br>Sacó ${x[4]} escaños; con un reparto proporcional, ${dec(prop(x),1)}<br>${s > 0 ? `La ley le da ${s} de más` : `La ley le quita ${-s}`}`)}">
      <span class="n">${esc(x[0])}</span><span class="neg">${s < 0 ? cuadros(-s, c, "q") : ""}</span><span class="pos">${s > 0 ? cuadros(s, c, "q") : ""}</span><span class="v ${s>0?"mas":"menos"}">${s > 0 ? "+" : "−"}${Math.abs(s)}</span></div>`; }).join("");
    // Los cuadrados caen al llegar a la vista (y al cambiar de elección, si ya se ve).
    lado.classList.remove("ya"); lado._io?.disconnect();
    if (!("IntersectionObserver" in window)) return lado.classList.add("ya");
    lado._io = new IntersectionObserver(es=>{ if (es.some(x=>x.isIntersecting)){ lado._io.disconnect(); requestAnimationFrame(()=>lado.classList.add("ya")); } }, {threshold:.25});
    lado._io.observe(lado);
  }
  /* El Congreso que pudo ser: los últimos escaños que se decidieron por menos de X votos cambian de manos. */
  let pudoVotos = null, selFam = null;
  function ultimo(D, e){
    // Las familias con el color que tienen en esta elección (en 2023, la izquierda es Sumar).
    const GR = GRUPOS.map(g=>({...g, color: colorFamEn(g.id, e)})), GRm = Object.fromEntries(GR.map(g=>[g.id, g]));
    const fam = (p, sig) => GRm[grupoDe((p.c.find(x=>x[0]===sig) || [])[1]).id];
    const vueltas = Object.entries(D.prov).filter(([,p])=>p.ultimo).map(([cod,p])=>({cod, p, de: fam(p, p.ultimo.gana), a: fam(p, p.ultimo.segundo), f: p.ultimo.faltan}))
      .sort((a,b)=>a.f-b.f);
    const base = porGrupo(e.fam), votantes = e.votantes, maxLog = Math.log10(vueltas[vueltas.length-1].f);
    const hemi = $("[data-ps-hemi]"); if (!hemi.querySelector("svg")) hemi.innerHTML = hemiReal() || hemiSVG(350, {etiqueta:"350"});   // el plano real del Congreso
    $("[data-ps-esc]")._parar?.();   // la animación de la elección anterior, fuera
    const rango = $("#ps-r"), svg = $("[data-ps-esc]"), N = vueltas.length, quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // La escalera: los votos que le faltaron a cada escaño (eje logarítmico) frente a cuántos se decidieron por menos; cada punto, un escaño: con el contorno de quien se lo llevaría, relleno cuando cambia.
    const W = Math.max(300, svg.parentNode.clientWidth || 600), H = W < 520 ? 240 : 280, m = {l:30, r:12, t:36, b:34};
    const tope = maxLog + (maxLog - 2)*.02;   // un poco de aire a la derecha
    const X = v => m.l + (Math.log10(Math.max(100, v)) - 2)/(tope - 2)*(W - m.l - m.r), Y = n => H - m.b - n/N*(H - m.t - m.b);
    const aLog = x => Math.max(2, Math.min(maxLog, 2 + (x - m.l)/(W - m.l - m.r)*(tope - 2)));
    const escalon = vueltas.map((v,i)=>`${i ? "" : `M${X(100)} ${Y(0)}`}L${X(v.f).toFixed(1)} ${Y(i).toFixed(1)}L${X(v.f).toFixed(1)} ${Y(i+1).toFixed(1)}`).join("");
    const rC = W < 520 ? 3.6 : 4.4;   // cuentas pequeñas: en la cola se tocan, como un collar
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = `      <g class="ejes">${[10,20,30,40,50].filter(n=>n <= N).map(n=>`<line x1="${m.l}" x2="${W - m.r}" y1="${Y(n)}" y2="${Y(n)}"/><text x="${m.l - 6}" y="${Y(n) + 3.5}" text-anchor="end" data-n="${n}">${n}</text>`).join("")}
        ${[1e3, 1e4, 1e5, 1e6].filter(v=>Math.log10(v) < maxLog - .1).map(v=>`<text x="${X(v)}" y="${H - m.b + 15}" text-anchor="middle">${fmtCorto(v)}</text>`).join("")}<text x="${W - m.r}" y="${H - 2}" text-anchor="end">votos que le faltaron al segundo →</text></g>
      <defs><linearGradient id="ps-deg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="d0"/><stop offset="1" class="d1"/></linearGradient><clipPath id="ps-clip"><rect x="0" y="0" height="${H}" width="0"/></clipPath></defs>
      <path class="area" d="${escalon}L${X(vueltas[N-1].f).toFixed(1)} ${Y(0)}Z" clip-path="url(#ps-clip)"/>
      <line class="base" x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}"/><path class="esc" d="${escalon}"/>
      <g class="guia"><line x1="${m.l}" y1="0" y2="0"/><text x="${m.l - 6}" y="3.5" text-anchor="end"></text></g>
      <g class="ptos">${vueltas.map((v,i)=>`<circle cx="${X(v.f).toFixed(1)}" cy="${Y(i+1).toFixed(1)}" r="${rC}" style="--c:${v.a.color};--d:${(i%6)*30}ms"/>`).join("")}</g>
      <g class="cursor"><line y1="${m.t - 12}" y2="${H - m.b}"/><circle cy="${m.t - 12}" r="6"/><text y="${m.t - 20}"></text></g>`;
    const cur = svg.querySelector(".cursor"), curT = cur.querySelector("text"), cols = [...svg.querySelectorAll(".ptos circle")], guia = svg.querySelector(".guia"), clip = svg.querySelector("#ps-clip rect");
    // Arrastrar (o pulsar) sobre la escalera mueve el deslizador, que sigue ahí para el teclado.
    const xDe = ev => { const r = svg.getBoundingClientRect(); return (ev.clientX - r.left)/r.width*W; };
    let arrastre = false;
    svg.onpointerdown = ev => { arrastre = true; svg.setPointerCapture(ev.pointerId); pararPlay(); rango.value = aLog(xDe(ev)); pintar(); };
    svg.onpointermove = ev => { if (arrastre){ rango.value = aLog(xDe(ev)); pintar(); } };
    svg.onpointerup = svg.onpointercancel = () => { arrastre = false; };
    if (!svg.dataset.tip){ svg.dataset.tip = 1;
      svg.addEventListener("mouseleave", ()=>svg.querySelectorAll(".ptos circle.h").forEach(c=>c.classList.remove("h")));
      conTip(svg, ev=>{ if (arrastre || !svg._v) return ""; const x = xDe(ev), r = svg.getBoundingClientRect(), y = (ev.clientY - r.top)/r.height*H;
        let k = -1, d = 16; svg._v.forEach((v,i)=>{ const dd = Math.hypot(svg._X(v.f) - x, (svg._Y(i+1) - y)*.5); if (dd < d){ d = dd; k = i; } });
        svg.querySelectorAll(".ptos circle").forEach((c,i)=>c.classList.toggle("h", i === k));
        if (k < 0) return ""; const v = svg._v[k];
        return `<b>${esc(nombreProv(v.cod))}</b><br>${esc(v.p.ultimo.gana)} → ${esc(v.p.ultimo.segundo)}: le faltaron <b>${fmt(v.f)}</b> votos<br><span style="color:var(--muted)">${k ? `El ${k+1}.º más ajustado de los ${svg._v.length}` : "El más ajustado de todos"}</span>`; }); }
    svg._v = vueltas; svg._X = X; svg._Y = Y;
    let antes = -1, vistos = new Set(), ultHechas = [];
    // Quién se los lleva: un hilo por escaño, del partido que lo pierde (izquierda) al que se lo lleva (derecha).
    const flujo = $("[data-ps-flujo]"), lista = $("[data-ps-lista]");
    function flujoQuien(hechas){
      ultHechas = hechas;
      if (selFam && !hechas.some(v=>v.de.id === selFam || v.a.id === selFam)) selFam = null;
      if (!hechas.length){ flujo.style.display = "none"; $(".ps-fl-t").style.display = "none";
        lista.innerHTML = `<p class="nota">Con tan pocos votos no cambia ningún escaño: el más barato costaba ${fmt(vueltas[0].f)}.</p>`; vistos = new Set(); return; }
      flujo.style.display = ""; $(".ps-fl-t").style.display = "";
      const Wf = Math.max(300, flujo.parentNode.clientWidth || 600), u = Wf < 520 ? 5 : 6, gap = 12, bw = 8;
      const nomF = f => Wf < 520 ? ({IZQ:"IU-Sumar", NAC:"Nacional.", UCD:"UCD"}[f.id] || CORTO[f.id] || f.nombre) : (CORTO[f.id] || f.nombre);   // en el móvil, nombres cortos
      const lab = Math.min(Wf*.36, 22 + Math.max(...hechas.flatMap(v=>[nomF(v.de), nomF(v.a)]).map(t=>t.length))*7.8);   // lo justo para el rótulo más largo
      const cDe = {}, cA = {}; hechas.forEach(v=>{ cDe[v.de.id] = (cDe[v.de.id] || 0) + 1; cA[v.a.id] = (cA[v.a.id] || 0) + 1; });
      const orden = GR.map(g=>g.id), fam = GRm;
      const izq = orden.filter(id=>cDe[id]), der = orden.filter(id=>cA[id]);
      const alto = (l, c) => l.reduce((t,id)=>t + c[id]*u, 0) + (l.length - 1)*gap, Hf = Math.max(alto(izq, cDe), alto(der, cA)) + 8;
      const nodos = (l, c) => { let y = 4 + (Hf - 8 - alto(l, c))/2; const o = {}; l.forEach(id=>{ o[id] = {y, h: c[id]*u, k: 0}; y += c[id]*u + gap; }); return o; };
      const NI = nodos(izq, cDe), ND = nodos(der, cA), x0 = lab + bw, x1 = Wf - lab - bw, xm = (x0 + x1)/2;
      // Cada hilo ocupa su ranura: a la izquierda, ordenados por destino; a la derecha, por origen (menos cruces).
      const hilos = hechas.map((v,i)=>({v, i}));
      [...hilos].sort((a,b)=>orden.indexOf(a.v.de.id) - orden.indexOf(b.v.de.id) || orden.indexOf(a.v.a.id) - orden.indexOf(b.v.a.id) || a.i - b.i).forEach(h=>{ const n = NI[h.v.de.id]; h.y0 = n.y + n.k++*u + u/2; });
      [...hilos].sort((a,b)=>orden.indexOf(a.v.a.id) - orden.indexOf(b.v.a.id) || orden.indexOf(a.v.de.id) - orden.indexOf(b.v.de.id) || a.i - b.i).forEach(h=>{ const n = ND[h.v.a.id]; h.y1 = n.y + n.k++*u + u/2; });
      const pares = [...new Set(hechas.map(v=>v.de.id + "-" + v.a.id))];
      const toca = v => !selFam || v.de.id === selFam || v.a.id === selFam;
      flujo.setAttribute("viewBox", `0 0 ${Wf} ${Hf}`); flujo.classList.toggle("sel", !!selFam);
      flujo.innerHTML = `<defs>${pares.map(k=>{ const [d,a] = k.split("-"); return `<linearGradient id="ps-fl-${k}" gradientUnits="userSpaceOnUse" x1="${x0}" x2="${x1}" y1="0" y2="0"><stop offset="0" stop-color="${fam[d].color}"/><stop offset="1" stop-color="${fam[a].color}"/></linearGradient>`; }).join("")}</defs>
        <g class="hilos">${hilos.map(h=>`<path class="hilo${vistos.has(h.v.cod) ? "" : " nuevo"}${toca(h.v) ? "" : " fuera"}" data-ult="${h.v.cod}" data-h="${h.i}" pathLength="1" stroke="url(#ps-fl-${h.v.de.id}-${h.v.a.id})" stroke-width="${u - 1.2}" d="M${x0} ${h.y0.toFixed(1)}C${xm} ${h.y0.toFixed(1)} ${xm} ${h.y1.toFixed(1)} ${x1} ${h.y1.toFixed(1)}"/>`).join("")}</g>
        ${izq.map(id=>`<g class="nodo${selFam === id ? " on" : ""}" data-fam="${id}"><rect x="${lab}" y="${NI[id].y}" width="${bw}" height="${NI[id].h}" rx="2" fill="${fam[id].color}"/><text x="${lab - 8}" y="${NI[id].y + NI[id].h/2 + 4}" text-anchor="end">${esc(nomF(fam[id]))} <tspan class="menos">−${cDe[id]}</tspan></text></g>`).join("")}
        ${der.map(id=>`<g class="nodo${selFam === id ? " on" : ""}" data-fam="${id}"><rect x="${x1}" y="${ND[id].y}" width="${bw}" height="${ND[id].h}" rx="2" fill="${fam[id].color}"/><text x="${x1 + bw + 8}" y="${ND[id].y + ND[id].h/2 + 4}"><tspan class="mas">+${cA[id]}</tspan> ${esc(nomF(fam[id]))}</text></g>`).join("")}`;
      // Debajo, las provincias: todas, o solo las del partido elegido.
      const grupos = {}; hechas.filter(toca).forEach(v=>{ const k = v.de.id + ">" + v.a.id; (grupos[k] ||= {de: v.de, a: v.a, l: []}).l.push(v); });
      lista.innerHTML = (selFam ? `<div class="ps-fil">Solo <b><i style="background:${fam[selFam].color}"></i>${esc(nomF(fam[selFam]))}</b>: pierde ${cDe[selFam] || 0}, se lleva ${cA[selFam] || 0} <button type="button" data-ps-todos>Ver todos</button></div>`
          : `<p class="ps-ayuda">Pulsa un partido para ver solo los suyos; pulsa una provincia para probarla en el simulador.</p>`)
        + Object.values(grupos).sort((a,b)=>b.l.length - a.l.length).map(t=>`<div class="ps-par"><span class="ps-dir"><i style="background:${t.de.color}"></i>${esc(nomF(t.de))}<em>→</em><i style="background:${t.a.color}"></i>${esc(nomF(t.a))}<b>${t.l.length}</b></span>
          <span class="ps-pv">${t.l.map(v=>`<button type="button" data-ult="${v.cod}" class="${vistos.has(v.cod) ? "" : "nuevo"}">${esc(nombreProv(v.cod))}</button>`).join("")}</span></div>`).join("");
      vistos = new Set(hechas.map(v=>v.cod));
    }
    flujo.onclick = ev => { const n = ev.target.closest("[data-fam]"); if (!n) return; selFam = selFam === n.dataset.fam ? null : n.dataset.fam; vistos = new Set(ultHechas.map(v=>v.cod)); flujoQuien(ultHechas); };
    lista.onclick = ev => { if (ev.target.closest("[data-ps-todos]")){ selFam = null; flujoQuien(ultHechas); } };
    if (!flujo.dataset.tip){ flujo.dataset.tip = 1;
      conTip(flujo, ev=>{ const h = ev.target.closest(".hilo"), n = ev.target.closest("[data-fam]"), H = flujo._h || [];
        if (h){ const v = H[+h.dataset.h]; return v ? `<b>${esc(nombreProv(v.cod))}</b><br>${esc(v.p.ultimo.gana)} → ${esc(v.p.ultimo.segundo)} con ${fmt(v.f)} votos más<br><span style="color:var(--muted)">Pulsa para probarlo en el simulador</span>` : ""; }
        if (n){ const id = n.dataset.fam, pierde = H.filter(v=>v.de.id === id), gana = H.filter(v=>v.a.id === id);
          return `<b>${esc(CORTO[id] || id)}</b>${pierde.length ? `<br>Pierde ${pierde.length}: ${esc(pierde.map(v=>nombreProv(v.cod)).join(", "))}` : ""}${gana.length ? `<br>Se lleva ${gana.length}: ${esc(gana.map(v=>nombreProv(v.cod)).join(", "))}` : ""}<br><span style="color:var(--muted)">Pulsa para ver solo los suyos</span>`; }
        return ""; }); }
    const pintar = (suave = false) => {
      const presu = Math.pow(10, +rango.value), hechas = vueltas.filter(v=>v.f <= presu), x = X(presu);
      cur.setAttribute("transform", `translate(${x.toFixed(1)},0)`); clip.setAttribute("width", x.toFixed(1)); 
      const r = Math.pow(10, Math.floor(Math.log10(presu)) - 1);
      curT.textContent = `menos de ${fmt(Math.round(presu/r)*r)} votos`; $("[data-ps-umbral]").textContent = fmt(Math.round(presu/r)*r); curT.setAttribute("text-anchor", x > W*.75 ? "end" : x < W*.2 ? "start" : "middle");
      if (hechas.length === antes) return; antes = hechas.length;
      cols.forEach((c,i)=>{ c.classList.toggle("si", i < hechas.length); c.classList.toggle("ult", i === hechas.length - 1); });
      const n = hechas.length; guia.style.opacity = n ? 1 : 0;
      if (n) svg.style.setProperty("--ult", hechas[n-1].a.color);   // el área y la guía, del color del último escaño que cambia
      guia.setAttribute("transform", `translate(0,${Y(n).toFixed(1)})`);
      guia.querySelector("line").setAttribute("x2", n ? X(hechas[n-1].f).toFixed(1) : m.l); guia.querySelector("text").textContent = n;
      svg.querySelectorAll(".ejes [data-n]").forEach(t=>t.style.opacity = n && Math.abs(Y(+t.dataset.n) - Y(n)) < 10 ? 0 : 1);   // que el número de la guía no pise el del eje
      const g = Object.fromEntries(GRUPOS.map(x=>[x.id, base[x.id][1]])), cambio = Object.fromEntries(GRUPOS.map(x=>[x.id, 0]));
      hechas.forEach(v=>{ g[v.de.id]--; g[v.a.id]++; cambio[v.de.id]--; cambio[v.a.id]++; });
      const usados = hechas.reduce((t,v)=>t + v.f, 0), rapido = !suave || quieto;
      pintarHemi(hemi.querySelector(".hi-hemi"), GR.filter(x=>g[x.id] > 0).map(x=>({color:x.color, n:g[x.id], tip:`<b>${esc(x.nombre)}</b><br>${g[x.id]} escaños${cambio[x.id] ? ` (${cambio[x.id] > 0 ? "+" : "−"}${Math.abs(cambio[x.id])})` : ""}`})), null);
      if (rapido){ $("[data-ps-v]").textContent = fmt(usados); $("[data-ps-n]").textContent = fmt(hechas.length); }
      else { contar($("[data-ps-v]"), pudoVotos?.v ?? 0, usados); contar($("[data-ps-n]"), pudoVotos?.n ?? 0, hechas.length); }
      pudoVotos = {v: usados, n: hechas.length};
      $("[data-ps-pct]").textContent = hechas.length ? `: el ${pct(usados/votantes, usados/votantes < .01 ? 2 : 1)} de los que votaron` : "";
      $("[data-ps-g]").innerHTML = GR.filter(x=>base[x.id][1] || cambio[x.id]).map(x=>`<div class="${cambio[x.id] > 0 ? "mas" : cambio[x.id] < 0 ? "menos" : ""}"><i style="background:${x.color}"></i><span>${esc(CORTO[x.id] || x.nombre)}</span><b>${g[x.id]}</b><small>${cambio[x.id] ? (cambio[x.id] > 0 ? "+" : "−") + Math.abs(cambio[x.id]) : ""}</small></div>`).join("");
      flujo._h = hechas; flujoQuien(hechas);
    };
    // Reproducir: el deslizador recorre la escalera de punta a punta (o hasta donde se le diga).
    let anim = null;
    const boton = $("[data-ps-play]");
    let io = null;   // la reproducción automática de la primera vez: si alguien toca antes, ya no hace falta
    function pararPlay(){ io?.disconnect(); if (anim){ cancelAnimationFrame(anim); anim = null; } if (boton) boton.textContent = "▶ Reproducir"; }
    svg._parar = pararPlay;
    function irA(hasta, dur){
      pararPlay(); if (quieto){ rango.value = hasta; pintar(true); return; }
      const desde = +rango.value, t0 = performance.now(), ease = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;
      boton.textContent = "❚❚ Pausa";
      const paso = ahora => { const t = Math.min(1, (ahora - t0)/dur); rango.value = desde + (hasta - desde)*ease(t); pintar();
        if (t < 1 && document.body.contains(svg)) anim = requestAnimationFrame(paso); else pararPlay(); };
      anim = requestAnimationFrame(paso);
    }
    boton.onclick = () => { if (anim) return pararPlay(); if (+rango.value >= maxLog - .01) rango.value = 2; irA(maxLog, 7000*(maxLog - +rango.value)/(maxLog - 2)); };
    sec.querySelectorAll("[data-ps-ir]").forEach(b=>b.onclick = () => irA(b.dataset.psIr === "max" ? maxLog : Math.min(maxLog, +b.dataset.psIr), 900));
    rango.max = maxLog.toFixed(2); if (+rango.value > maxLog) rango.value = maxLog;
    rango.oninput = () => { pararPlay(); pintar(); };
    // La primera vez, la escalera se recorre sola hasta unos 125.000 votos al llegar a la vista.
    if (!rango.dataset.puesto){ rango.dataset.puesto = 1; rango.value = 2; pintar();
      if (quieto || !("IntersectionObserver" in window)){ rango.value = 5.1; pintar(); }
      else { io = new IntersectionObserver(es=>{ if (es.some(x=>x.isIntersecting)){ io.disconnect(); irA(Math.min(4, maxLog), 3200); } }, {threshold:.5}); io.observe(svg); } }
    else pintar();
    return vueltas.map(v=>[v.cod, v.p]);
  }
  function mapa(){
    const perd = heModo === "perdidos", val = Object.fromEntries(Object.entries(P).map(([c2,x])=>[c2, perd ? x.sin_escano/x.validos : x.validos/x.e]));
    const vs = Object.values(val), lo = Math.min(...vs), hi = Math.max(...vs), r = rampa(perd ? "#B4613A" : NEUTRO);
    $("#he-mapa-t").textContent = perd ? "Votos que no sirvieron para elegir a nadie" : "Votos por escaño en cada provincia";
    $("#he-mapa-s").textContent = perd ? "Parte de los votos válidos de cada provincia que fue a candidaturas sin escaño allí. Con pocos escaños en juego se pierden muchos más." : "Votos válidos entre escaños: cuanto más intenso, más caro. Pulsa una provincia para hacerla tuya y jugar con sus votos.";
    sec.querySelectorAll("[data-he-modo]").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.heModo === heModo)));
    const caja = $("#he-mapa"), color = c2 => val[c2] != null ? r((val[c2]-lo)/(hi-lo||1)) : "var(--sunk)";
    if (!caja.querySelector("svg")) caja.innerHTML = mapaSVG(color, {enlazar:false, clase:"clic pe-mapa"}) + `<div class="pe-ley"></div>`;
    else caja.querySelectorAll("[data-p]").forEach(pa=>{ pa.style.fill = color(pa.dataset.p); });
    caja.querySelectorAll("[data-p]").forEach(pa=>pa.classList.toggle("tu", pa.dataset.p === tuProv));
    caja.querySelector(".pe-ley").innerHTML = leyendaRampa(r, lo, hi, perd ? x=>pct(x,0) : x=>fmt(x)+" votos");
  }
  async function pintar(k){
    selE = k; const e = E[k];
    sec.querySelectorAll("[data-he]").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.he===k)));
    const D = await pedir(`datos/elecciones/historico-${e.id}.json`); if (!D) return;
    P = D.prov;
    const precio = Object.entries(P).map(([cod,p])=>[cod, p.validos/p.e]).sort((a,b)=>a[1]-b[1]);
    const barato = precio[0], caro = precio[precio.length-1], sinEsc = Object.values(P).reduce((s,p)=>s+p.sin_escano, 0);
    const ultimos = ultimo(D, e), mil = ultimos.filter(([,p])=>p.ultimo.faltan < 1000).length;
    const K = {barato: barato[1], caro: caro[1], sin: sinEsc, mil};
    Object.entries(K).forEach(([k2,v])=>{ contar($(`[data-pe-k="${k2}"]`), prev[k2], v, k2 === "sin" ? fmtCorto : fmt); prev[k2] = v; });
    $('[data-pe-kl="barato"]').textContent = `votos por escaño en ${nombreProv(barato[0])}, la más barata`;
    $('[data-pe-kl="caro"]').textContent = `votos por escaño en ${nombreProv(caro[0])}, la más cara`;
    tuVoto(e); balanza(e); costes(e); mapa();
    simProv = simProv && P[simProv] ? simProv : tuProv; simVotos = null; simulador(sec, P);
  }
  const elegirProv = c2 => { tuProv = c2; try{ localStorage.setItem("provincia", slugProv(c2)); }catch(err){} $("[data-pe-prov]").value = c2; tuVoto(E[selE]); balanza(E[selE]); mapa(); simProv = c2; simVotos = null; simulador(sec, P); };
  function parar(){ clearInterval(playE); playE = null; const b = $("[data-he-play]"); if (b) b.textContent = "▶ Reproducir"; }
  sec.addEventListener("click", ev=>{
    const b = ev.target.closest("[data-he]"); if (b){ parar(); pintar(+b.dataset.he); return; }
    if (ev.target.closest("[data-he-play]")){ if (playE){ parar(); return; } $("[data-he-play]").textContent = "❚❚ Pausa"; let k = selE >= E.length-1 ? 0 : selE + 1; pintar(k);
      playE = setInterval(()=>{ k++; if (k >= E.length || !document.body.contains(sec)){ parar(); return; } pintar(k); }, 2200); return; }
    const m = ev.target.closest("[data-he-modo]"); if (m){ heModo = m.dataset.heModo; mapa(); return; }
    const u = ev.target.closest("[data-ult]"); if (u){ simProv = u.dataset.ult; simVotos = null; simulador(sec, P, {explicar: true}); $("#he-sim").scrollIntoView({block:"start", behavior:"smooth"}); return; }
    const pr = ev.target.closest("#he-mapa [data-p]"); if (pr){ elegirProv(pr.dataset.p); $("#he-sim").scrollIntoView({block:"nearest", behavior:"smooth"}); return; }
    const bo = ev.target.closest("[data-pe-c]"); if (bo){ elegirProv(bo.dataset.peC); }
  });
  $("[data-pe-prov]").addEventListener("change", ev=>elegirProv(ev.target.value));
  conTip($("#he-mapa"), ev=>{ const p = ev.target.closest("[data-p]"); if (!p || !P) return ""; const x = P[p.dataset.p];
    return `<b>${esc(nombreProv(p.dataset.p))}</b><br>${x.e} escaños · ${fmt(x.validos/x.e)} votos por escaño<br>${fmt(x.sin_escano)} votos sin escaño (${pct(x.sin_escano/x.validos, 0)})<div style="color:var(--muted);margin-top:4px">Pulsa para hacerla tuya</div>`; });
  pintar(selE);
}
/* «Juega con los votos»: el simulador D'Hondt de una provincia. La misma regla que la ley (y que escano/elecciones.py):
   barrera del 3 % de los votos válidos y cocientes de mayor a menor. */
export function dhondt(votos, escanos, validos, barrera=.03){
  const entran = Object.entries(votos).filter(([,v])=>v>0 && v >= barrera*validos);
  const coc = entran.flatMap(([c,v])=>Array.from({length:escanos},(_,d)=>({c, v, q:v/(d+1), d:d+1}))).sort((a,b)=>b.q-a.q || b.v-a.v || a.c.localeCompare(b.c));
  const gan = coc.slice(0, escanos), rep = {};
  gan.forEach(x=>rep[x.c]=(rep[x.c]||0)+1);
  return {rep, gan, fuera: coc.slice(escanos, escanos+4), barrera: barrera*validos};
}
let simVisto = false;   // la explicación por rondas se reproduce sola la primera vez que se ve
function simulador(sec, P, {explicar = false} = {}){
  const caja = sec.querySelector("#he-sim"); if (!caja || !P?.[simProv]) return;
  caja._parar?.();
  const p = P[simProv], quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lista = p.c.filter(x=>x[2] >= p.validos*0.005).slice(0, 10);   // las que pasan del 0,5 %: el resto no cambia nada
  simVotos ||= Object.fromEntries(lista.map(x=>[x[0], x[2]]));
  const resto = p.validos - lista.reduce((s,x)=>s+x[2],0);
  const validosDe = V => resto + Object.values(V).reduce((s,v)=>s+v,0);
  const real = Object.fromEntries(lista.map(x=>[x[0], x[2]])), color = Object.fromEntries(lista.map(x=>[x[0], colorPartido(x[0], x[1])]));
  const opciones = Object.keys(P).sort((a,b)=>nombreProv(a).localeCompare(nombreProv(b),"es")).map(c2=>`<option value="${c2}"${c2===simProv?" selected":""}>${esc(nombreProv(c2))}</option>`).join("");
  const silueta = GEO?.provincias?.[simProv]?.d || GEO?.provincias?.[simProv]?.silueta;   // Ceuta y Melilla, con su contorno a gran escala
  caja.innerHTML = `<div class="pe-sim-h"><div class="pe-sim-tx"><div class="eyebrow">Juega con los votos</div><h3>¿Cuántos votos cambian un escaño en <select data-sim-prov aria-label="Provincia">${opciones}</select>?</h3>
      <p class="sub">${p.e === 1 ? "Aquí se reparte un solo escaño: se lo lleva quien más votos tiene." : `Los ${p.e} escaños se reparten por rondas. En cada una, el escaño es para la barra más larga; y esa barra se divide entre uno más (÷2, ÷3…) para la ronda siguiente.`}</p></div>
      ${silueta ? `<figure class="pe-silueta" aria-hidden="true"><svg><path d="${silueta}" pathLength="1"/></svg><figcaption>${p.e} ${p.e === 1 ? "escaño" : "escaños"}</figcaption></figure>` : ""}</div>
    <div class="pe-sim-c"><div class="pe-rondas">
        <div class="pe-ctl"><button type="button" class="pri" data-sim-play>▶ Ver el reparto</button><button type="button" data-sim-paso>Siguiente escaño →</button><button type="button" data-sim-reset>↺ Resultado real</button></div>
        <div class="pe-barras" data-barras><div class="pe-b-h"><span></span><span class="t"><span class="lin-t" data-lin-t></span></span><span></span><span>Escaños</span></div>
          ${lista.map(x=>`<div class="pe-b" data-b="${esc(x[0])}" style="--c:${color[x[0]]}"><span class="n">${esc(x[0])}</span><span class="t"><i></i></span><small class="cq" data-bq></small><span class="s"><b data-bn>0</b><span class="q" data-bs></span></span></div>`).join("")}</div>
        <p class="pe-paso" data-paso aria-live="polite"></p></div>
      <div class="pe-sillas-w"><div class="eyebrow">${p.e === 1 ? "El escaño" : `Los ${p.e} escaños`} de ${esc(nombreProv(simProv))}</div><div class="pe-sillas${p.e > 12 ? " muchas" : ""}" data-sillas>${Array.from({length:p.e},(_,i)=>`<div class="pe-silla"><span class="k">${i+1}.º</span><b></b><small></small></div>`).join("")}</div><div class="pe-flip" aria-live="polite"></div></div></div>
    <div class="pe-votos"><div class="pe-votos-h"><b>Los votos</b><span>Arrástralos, o pide <b>+1 escaño</b> y la web calcula cuántos faltan.</span></div>
      ${lista.map(x=>`<div class="pe-voto" data-fila="${esc(x[0])}" style="--c:${color[x[0]]}"><span class="n">${esc(x[0])}</span>
        <input type="range" min="0" max="${Math.round(x[2]*2+p.validos*0.02)}" step="${Math.max(1, Math.round(p.validos/2000))}" value="${simVotos[x[0]] ?? x[2]}" data-sim="${esc(x[0])}" aria-label="Votos de ${esc(x[0])}">
        <span class="v"><b data-v></b><small data-dv></small></span><button type="button" class="mas" data-mas="${esc(x[0])}" title="Cuántos votos le faltan para un escaño más">+1 escaño</button></div>`).join("")}
      <p class="nota" data-q></p></div>
    <div class="hi-coc-c"><h4>La tabla de cocientes</h4><p class="sub">Las mismas rondas, en números: los votos de cada candidatura entre 1, 2, 3… Los ${p.e} cocientes más altos se llevan los escaños (en color); el recuadro marca el último y el discontinuo, el primero que se queda fuera.</p><div class="hi-coc" data-coc></div></div>`;
  let antes = null, anim = null, k = null, fase = 0, enVista = null;   // k: escaños ya repartidos en la explicación (null = reparto completo)
  const gen = caja._gen = (caja._gen || 0) + 1;   // si se vuelve a montar (otra provincia, otra elección), lo que quede en marcha de esta se para
  // La silueta de la provincia, encuadrada a su tamaño (el trazo no engorda al ampliar las pequeñas).
  const sil = caja.querySelector(".pe-silueta svg");
  if (sil){ const bb = sil.querySelector("path").getBBox(), pad = Math.max(bb.width, bb.height)*.06;
    sil.setAttribute("viewBox", `${(bb.x - pad).toFixed(1)} ${(bb.y - pad).toFixed(1)} ${(bb.width + 2*pad).toFixed(1)} ${(bb.height + 2*pad).toFixed(1)}`); }
  const flip = caja.querySelector(".pe-flip"), sillas = [...caja.querySelectorAll(".pe-silla")], pasoEl = caja.querySelector("[data-paso]"), barrasEl = caja.querySelector("[data-barras]");
  const cuenta = (r, n) => { const rep = {}; r.gan.slice(0, n).forEach(y=>rep[y.c] = (rep[y.c]||0) + 1); return rep; };
  // Las barras: lo que pide cada candidatura para el escaño siguiente (sus votos entre los escaños que ya tiene más uno).
  function barras(r, n, toca){
    const rep = cuenta(r, n), max = Math.max(...lista.map(x=>simVotos[x[0]]), 1), w = q => q/max*96;   // la barra más larga, casi de lado a lado
    lista.forEach(x=>{ const c2 = x[0], fila = [...barrasEl.querySelectorAll("[data-b]")].find(f=>f.dataset.b === c2), v = simVotos[c2], pasa = v > 0 && v >= r.barrera, d = (rep[c2]||0) + 1;
      if (!fila) return;
      fila.classList.toggle("fuera", !pasa); fila.classList.toggle("toca", !!toca && toca.c === c2);
      fila.style.setProperty("--w", `${w(pasa ? v/d : v).toFixed(2)}%`);
      fila.querySelector("[data-bq]").innerHTML = pasa ? `<span class="vv">${fmt(v)} </span>÷ ${d} = <b>${fmt(v/d)}</b>` : `no llega al 3 %`;
      const s = fila.querySelector("[data-bs]"), ya = s.children.length, quiere = rep[c2]||0; fila.querySelector("[data-bn]").textContent = pasa ? quiere : "";
      if (ya < quiere) s.insertAdjacentHTML("beforeend", Array.from({length: quiere - ya}, ()=>`<i></i>`).join("")); else while (s.children.length > quiere) s.lastChild.remove(); });
    // El listón del final: el último cociente que se llevó escaño. Todas las barras quedan por debajo.
    const fin = n >= r.gan.length && r.gan.length, ult = r.gan[r.gan.length - 1];
    barrasEl.classList.toggle("fin", !!fin); barrasEl.style.setProperty("--l", fin ? `${w(ult.q).toFixed(2)}%` : "0%");
    caja.querySelector("[data-lin-t]").textContent = fin ? `último escaño: ${fmt(ult.q)}` : "";
  }
  // Los escaños de la provincia, en el orden en que se reparten: cada uno, con quién se lo lleva y con qué cociente.
  function asientosProv(r, n){
    sillas.forEach((el,i)=>{ const x = i < n ? r.gan[i] : null, antes = el.dataset.c || "";
      el.dataset.c = x ? x.c : ""; el.classList.toggle("llena", !!x);
      if (x && antes !== x.c){ el.classList.remove("nueva"); void el.offsetWidth; el.classList.add("nueva"); }
      el.style.setProperty("--c", x ? color[x.c] : ""); el.style.color = x ? textoSobre(color[x.c]) : "";
      el.querySelector("b").textContent = x ? x.c : ""; el.querySelector("small").textContent = x ? `÷${x.d} · ${fmt(x.q)}` : "";
      el.dataset.tip = x ? `<b>Escaño ${i+1}.º</b>: ${esc(x.c)}<br>${fmt(simVotos[x.c])} ÷ ${x.d} = <b>${fmt(x.q)}</b>` : `<b>Escaño ${i+1}.º</b><br>Aún sin repartir`; });
  }
  function tabla(r, n, cur){
    const ganan = new Set(r.gan.slice(0, n).map(x=>x.c+"|"+x.d)), cols = Math.min(p.e, 12), fin = n >= r.gan.length;
    const ult = fin ? r.gan[r.gan.length-1] : null, sig = fin ? r.fuera[0] : null;
    const filas = lista.filter(x=>simVotos[x[0]] >= r.barrera && simVotos[x[0]] > 0).sort((a,b)=>simVotos[b[0]]-simVotos[a[0]]);
    caja.querySelector("[data-coc]").innerHTML = filas.length ? `<table><thead><tr><th></th>${Array.from({length:cols},(_,d)=>`<th>÷${d+1}</th>`).join("")}</tr></thead><tbody>${filas.map(x=>{ const c = color[x[0]];
      return `<tr><th><i style="background:${c}"></i>${esc(x[0])}</th>${Array.from({length:cols},(_,d)=>{ const kk = x[0]+"|"+(d+1), q = simVotos[x[0]]/(d+1);
        const cls = [ganan.has(kk) ? "si" : "", ult && ult.c === x[0] && ult.d === d+1 ? "ult" : "", sig && sig.c === x[0] && sig.d === d+1 ? "sig" : "", cur && cur.c === x[0] && cur.d === d+1 ? "ahora" : ""].join(" ");
        return `<td class="${cls}" style="${ganan.has(kk) ? `background:${c};color:${textoSobre(c)}` : ""}">${fmt(q)}</td>`; }).join("")}</tr>`; }).join("")}</tbody></table>${p.e > cols ? `<p class="nota">Se muestran los ${cols} primeros divisores.</p>` : ""}` : `<p class="nota">Ninguna candidatura pasa la barrera.</p>`;
  }
  const final = r => { const u = r.gan[r.gan.length-1], s = r.fuera[0];
    const f = q => s && u && fmt(u.q) === fmt(s.q) ? q.toLocaleString("es-ES", {minimumFractionDigits:2, maximumFractionDigits:2}) : fmt(q);   // en un empate a la vista, con decimales
    return u ? `El último escaño fue para <b>${esc(u.c)}</b>, con ${f(u.q)} (÷${u.d}).${s ? ` La barra más larga que se queda sin escaño es la de <b>${esc(s.c)}</b>: ${f(s.q)}.` : ""}` : "Ninguna candidatura pasa la barrera."; };
  // Un momento de la explicación: n escaños repartidos; si «toca», se señala la barra que se lleva el siguiente.
  function momento(r, n, toca){
    barras(r, n, toca); tabla(r, n, toca); asientosProv(r, n);
    if (n >= r.gan.length) pasoEl.innerHTML = final(r);
    else if (toca) pasoEl.innerHTML = `<span class="pe-paso-n">Escaño ${n+1} de ${p.e}</span> La barra más larga es la de <b style="color:${color[toca.c]}">${esc(toca.c)}</b>: ${fmt(toca.q)}.`;
    else if (n) { const x = r.gan[n-1], d = cuenta(r, n)[x.c] + 1; pasoEl.innerHTML = `<span class="pe-paso-n">Escaño ${n} de ${p.e}</span> Para <b style="color:${color[x.c]}">${esc(x.c)}</b>. Su barra pasa a ÷${d}: ${fmt(simVotos[x.c]/d)}.`; }
    else pasoEl.innerHTML = `Al empezar, cada barra es el total de votos (÷1). Las que no llegan al 3 % no juegan.`;
  }
  const pintar = () => {
    const validos = validosDe(simVotos), r = dhondt(simVotos, p.e, validos);
    const gana = Object.entries(r.rep).sort((a,b)=>b[1]-a[1] || simVotos[b[0]]-simVotos[a[0]])[0];   // la silueta, del color de quien más escaños saca
    if (sil) sil.style.setProperty("--c", gana ? color[gana[0]] : "var(--ink)");
    caja.querySelectorAll("[data-fila]").forEach(f=>{ const c2 = f.dataset.fila, n = r.rep[c2]||0, inp = f.querySelector("[data-sim]"), dv = simVotos[c2] - real[c2];
      f.querySelector("[data-v]").textContent = fmt(simVotos[c2]);
      const dvEl = f.querySelector("[data-dv]"); dvEl.textContent = dv ? `${dv > 0 ? "+" : "−"}${fmt(Math.abs(dv))}` : ""; dvEl.className = dv > 0 ? "sube" : dv < 0 ? "baja" : "";
      inp.style.setProperty("--p", `${(simVotos[c2]/(+inp.max || 1)*100).toFixed(1)}%`);
      f.classList.toggle("fuera", simVotos[c2] < r.barrera);
      f.querySelector("[data-mas]").disabled = n >= p.e; });
    if (k == null) momento(r, r.gan.length);
    if (antes){ const cambios = lista.map(x=>[x[0], (r.rep[x[0]]||0) - (antes[x[0]]||0)]).filter(([,d])=>d);
      if (cambios.length){ flip.innerHTML = cambios.sort((a,b)=>b[1]-a[1]).map(([cn,d])=>`<span class="${d>0?"mas":"menos"}">${esc(cn)} ${d>0?"+":"−"}${Math.abs(d)}</span>`).join(" ");
        flip.classList.remove("si"); void flip.offsetWidth; flip.classList.add("si"); } }
    antes = {...r.rep};
    const bajo = lista.filter(x=>simVotos[x[0]] > 0 && simVotos[x[0]] < r.barrera).map(x=>x[0]);
    caja.querySelector("[data-q]").innerHTML = `Para entrar en el reparto hace falta el 3 % de los votos válidos: <b>${fmt(r.barrera)}</b>.${bajo.length ? ` No llegan: ${bajo.map(esc).join(", ")}.` : ""}`;
  };
  // La explicación por rondas: primero se señala la barra más larga; luego se lleva el escaño y su barra se divide.
  const bPlay = caja.querySelector("[data-sim-play]");
  const rActual = () => dhondt(simVotos, p.e, validosDe(simVotos));
  function parar(){ if (anim){ clearTimeout(anim); anim = null; } enVista?.disconnect(); caja.classList.remove("explicando"); bPlay.textContent = k != null && k < p.e ? "▶ Seguir" : "▶ Ver el reparto"; }
  // Desde fuera (al cambiar de provincia o de elección) solo se cancelan los relojes: los votos ya pueden ser otros.
  caja._parar = () => { if (anim){ clearTimeout(anim); anim = null; } enVista?.disconnect(); };
  function avanzar(r){   // un medio paso: señalar (fase 0) o adjudicar (fase 1)
    if (k == null){ k = 0; fase = 0; momento(r, 0); return true; }
    if (k >= r.gan.length) return false;
    if (fase === 0){ momento(r, k, r.gan[k]); fase = 1; }
    else { k++; fase = 0; momento(r, k); if (k >= r.gan.length){ k = null; } }
    return k != null;
  }
  function reproducir(){
    const r = rActual(), N = r.gan.length; if (!N){ pintar(); return; }
    if (quieto){ k = null; pintar(); return; }
    if (k == null || (k === 0 && fase === 0)){ k = 0; fase = 0; momento(r, 0); }   // desde el principio: las barras, enteras
    caja.classList.add("explicando"); bPlay.textContent = "❚❚ Pausa";
    const t = N > 12 ? Math.max(130, 4200/N) : 520;
    const paso = () => { if (avanzar(r)) anim = setTimeout(paso, fase === 1 ? t : t*.9); else { anim = null; caja.classList.remove("explicando"); bPlay.textContent = "↻ Repetir el reparto"; } };
    anim = setTimeout(paso, k === 0 && fase === 0 ? 1300 : t);
  }
  // +1 escaño: los votos mínimos que necesita esa candidatura (con los demás quietos), buscados con la propia regla.
  const faltan = c2 => { const n0 = dhondt(simVotos, p.e, validosDe(simVotos)).rep[c2] || 0; let lo = simVotos[c2], hi = simVotos[c2] + p.validos*2;
    const gana = v => { const V = {...simVotos, [c2]: v}; return (dhondt(V, p.e, validosDe(V)).rep[c2] || 0) > n0; };
    if (!gana(hi)) return null; while (hi - lo > 1){ const mid = Math.floor((lo + hi)/2); if (gana(mid)) hi = mid; else lo = mid; } return hi; };
  const animar = (c2, destino) => { if (caja._gen !== gen || !simVotos) return; const ini = simVotos[c2], t0 = performance.now(), dur = quieto ? 1 : 900, inp = [...caja.querySelectorAll("[data-sim]")].find(i=>i.dataset.sim === c2);
    if (inp && destino > +inp.max) inp.max = Math.ceil(destino*1.1);
    const paso = ahora => { if (caja._gen !== gen || !simVotos) return; const t = Math.min(1, (ahora - t0)/dur), e2 = 1 - Math.pow(1 - t, 3); simVotos[c2] = Math.round(ini + (destino - ini)*e2); if (inp) inp.value = simVotos[c2]; pintar(); if (t < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso); };
  const alReparto = () => { parar(); k = null; fase = 0; };   // cualquier cambio de votos vuelve al reparto completo
  caja.oninput = ev=>{ const i = ev.target.closest("[data-sim]"); if (i){ alReparto(); simVotos[i.dataset.sim] = +i.value; pintar(); } };
  caja.onclick = ev=>{
    if (ev.target.closest("[data-sim-play]")){ if (anim) parar(); else { if (k == null) { k = 0; fase = 0; } reproducir(); } return; }
    if (ev.target.closest("[data-sim-paso]")){ parar(); const r = rActual(); if (k == null){ k = 0; fase = 0; momento(r, 0); } else { avanzar(r); if (fase === 1) avanzar(r); } bPlay.textContent = k == null ? "↻ Repetir el reparto" : "▶ Seguir"; return; }
    if (ev.target.closest("[data-sim-reset]")){ simVotos = null; simulador(sec, P); return; }
    const m = ev.target.closest("[data-mas]"); if (m){ alReparto(); const c2 = m.dataset.mas, v = faltan(c2);
      if (v != null){ flip.innerHTML = `<span>${esc(c2)} necesita ${fmt(v - simVotos[c2])} votos más</span>`; flip.classList.remove("si"); void flip.offsetWidth; flip.classList.add("si"); setTimeout(()=>animar(c2, v), 500); } return; } };
  caja.querySelector("[data-sim-prov]").addEventListener("change", ev=>{ simProv = ev.target.value; simVotos = null; simulador(sec, P, {explicar: true}); });
  requestAnimationFrame(()=>{ pintar();
    if (explicar && simVisto){ k = 0; fase = 0; reproducir(); }
    else if (!simVisto && "IntersectionObserver" in window && !quieto){ enVista = new IntersectionObserver(es=>{ if (es.some(x=>x.isIntersecting)){ enVista.disconnect(); simVisto = true; k = 0; fase = 0; reproducir(); } }, {threshold:.4}); enVista.observe(barrasEl); } });
}

/* =====================================================================================================
   MAPA MUNICIPAL (2019-11 y 2023), de toda España o de una provincia
   ===================================================================================================== */
export async function pintarMunicipios(sec, c){
  ctx = c; estilos();
  sec.innerHTML = `<section class="sec" style="padding-top:8px"><p class="nota">Cargando los 8.131 municipios…</p></section>`;
  await pintarMapaMunicipal(sec.querySelector("section"), {});
}
const selM = {id:"202307", g:"PP", modo:"voto"};
async function pintarMapaMunicipal(caja, {prov=null}={}){
  const [geoM, m23, m19] = await Promise.all([pedir("datos/elecciones/geo-municipios.json"), pedir("datos/elecciones/municipios-202307.json"), pedir("datos/elecciones/municipios-201911.json")]);
  const cuerpo = caja.querySelector(".nota");
  if (!geoM || !m23){ if (cuerpo) cuerpo.textContent = "No se ha podido cargar el mapa municipal."; return; }
  const M = {"202307": m23, "201911": m19}, orden = m23.orden;
  const codigos = Object.keys(geoM.municipios).filter(cod=>!prov || cod.startsWith(prov));
  let vb = `0 0 ${geoM.ancho} ${geoM.alto}`;
  if (prov && GEO?.provincias[prov]?.bb){ const [x0,y0,x1,y1] = GEO.provincias[prov].bb, m = Math.max(x1-x0, y1-y0)*0.04; vb = `${(x0-m).toFixed(1)} ${(y0-m).toFixed(1)} ${(x1-x0+2*m).toFixed(1)} ${(y1-y0+2*m).toFixed(1)}`; }
  cuerpo.outerHTML = `<div class="controls"><select data-m-id aria-label="Elección"><option value="202307">23 de julio de 2023</option>${m19?`<option value="201911">10 de noviembre de 2019</option>`:""}</select>
      <select data-m-g aria-label="Qué se pinta">${GRUPOS.filter(g=>g.id!=="OTROS").map(g=>`<option value="${g.id}">Voto a ${esc(g.nombre)}</option>`).join("")}<option value="PRIMERA">Primera fuerza</option><option value="PART">Participación</option></select>
      ${m19?`<button class="chipbtn" data-m-cambio aria-pressed="${selM.modo==="cambio"}">Cambio desde 2019</button>`:""}</div>
    <div class="chart" style="padding:8px"><svg class="hi-svg" viewBox="${vb}" role="img" aria-label="Mapa de ${codigos.length} municipios" style="max-height:${prov?"72vh":"none"}">${codigos.map(cod=>`<path class="muni" d="${geoM.municipios[cod][1]}" data-m="${cod}" vector-effect="non-scaling-stroke"></path>`).join("")}</svg>
      <div class="hi-rampa" data-m-leyenda></div></div>
    <p class="nota">Voto de los residentes en España (el voto desde el extranjero no se reparte por municipio). Fuente: Ministerio del Interior; geometrías del IGN (es-atlas).</p>`;
  const svg = caja.querySelector("svg.hi-svg"), paths = [...svg.querySelectorAll("[data-m]")];
  const iG = g => orden.indexOf(g);
  const votosGrupo = (fila, g) => G8[g].familias.reduce((s,f)=>s+(fila[2+iG(f)]||0),0);
  const share = (fila, g) => { if (!fila) return null; const tot = fila.slice(2).reduce((a,b)=>a+b,0); if (!tot) return null;
    return g==="PART" ? fila[1]/fila[0] : votosGrupo(fila, g)/tot; };
  const ganador = fila => { if (!fila) return null; let best = null, bv = 0; GRUPOS.forEach(g=>{ if (g.id==="OTROS") return; const v = votosGrupo(fila, g.id); if (v > bv){ bv = v; best = g; } }); return best; };
  const sel = caja.querySelector("[data-m-g]"), selId = caja.querySelector("[data-m-id]"), botonCambio = caja.querySelector("[data-m-cambio]");
  function pintar(){
    const cambio = selM.modo==="cambio" && m19 && selM.g!=="PRIMERA", g = selM.g;
    const datos = (cambio ? m23 : M[selM.id]).municipios;
    selId.disabled = !!cambio;
    if (botonCambio) botonCambio.disabled = g==="PRIMERA";
    let color, leyenda;
    if (g === "PRIMERA"){
      const gan = Object.fromEntries(codigos.map(cod=>[cod, ganador(datos[cod])]));
      paths.forEach(p=>{ p.style.fill = gan[p.dataset.m]?.color || "var(--sunk)"; });
      caja.querySelector("[data-m-leyenda]").innerHTML = leyendaGrupos([...new Set(Object.values(gan).filter(Boolean).map(x=>x.id))]);
      return;
    }
    const vals = {};
    for (const cod of codigos){ const a = share(datos[cod], g); if (a==null) continue; vals[cod] = cambio ? (()=>{ const b = share(m19.municipios[cod], g); return b==null ? null : a - b; })() : a; }
    const v = Object.values(vals).filter(x=>x!=null).sort((a,b)=>a-b);
    if (cambio){
      const lim = Math.max(Math.abs(v[Math.floor(v.length*.02)]||0), Math.abs(v[Math.floor(v.length*.98)]||0)) || .1;
      const sube = rampa(g==="PART" ? NEUTRO : G8[g].color), baja = rampa("#9A6B4F");
      color = x => x==null ? "var(--sunk)" : x >= 0 ? sube(x/lim) : baja(-x/lim);
      leyenda = `<span>−${Math.round(lim*100)} pt</span><span class="r" style="background:linear-gradient(90deg,${baja(1)},${baja(0)},${sube(0)},${sube(1)})"></span><span>+${Math.round(lim*100)} pt</span>`;
    } else {
      const lo = g==="PART" ? (v[Math.floor(v.length*.02)]||0) : 0, hi = v[Math.floor(v.length*.98)] || 1, r = rampa(g==="PART" ? NEUTRO : G8[g].color);
      color = x => x==null ? "var(--sunk)" : r((x-lo)/(hi-lo||1));
      leyenda = `<span>${pct(lo,0)}</span><span class="r" style="background:linear-gradient(90deg,${r(0)},${r(1)})"></span><span>${pct(hi,0)} o más</span>`;
    }
    paths.forEach(p=>{ p.style.fill = color(vals[p.dataset.m]); });
    caja.querySelector("[data-m-leyenda]").innerHTML = leyenda;
  }
  sel.value = selM.g; selId.value = selM.id;
  selId.addEventListener("change", ev=>{ selM.id = ev.target.value; pintar(); });
  sel.addEventListener("change", ev=>{ selM.g = ev.target.value; pintar(); });
  botonCambio?.addEventListener("click", ev=>{ selM.modo = selM.modo==="cambio" ? "voto" : "cambio"; ev.currentTarget.setAttribute("aria-pressed", String(selM.modo==="cambio")); pintar(); });
  conTip(svg, ev=>{ const p = ev.target.closest("[data-m]"); if (!p) return "";
    const cod = p.dataset.m, fila = M[selM.id].municipios[cod]; if (!fila) return `<b>${esc(geoM.municipios[cod][0])}</b><br>Sin datos`;
    const tot = fila.slice(2).reduce((a,b)=>a+b,0);
    const fams = GRUPOS.map(g=>[g, votosGrupo(fila, g.id)]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).slice(0,4);
    return `<b>${esc(geoM.municipios[cod][0])}</b><br>Participación ${pct(fila[1]/fila[0])} · censo ${fmt(fila[0])}${fams.map(([g,n])=>filaTip(g.color, g.nombre, pct(n/tot))).join("")}`; });
  pintar();
}

/* =====================================================================================================
   LA NOCHE ELECTORAL: escrutinio en directo (api/resultados.js) o ensayo con el 23J
   ===================================================================================================== */
// Las mismas reglas de familias que escano/historico.py, para colorear las candidaturas del directo.
const REGLAS_FAMILIA = [
  ["IZQ", /^(PCE|PSUC|IU|I\.U\.|IC-V|ICV|PODEMOS|EN COMU|ECP|SUMAR|MAS PAIS|MES COMPROM|COMPROMIS(?!-Q)|EN MAREA|UP\b)|IZQUIERDA UNIDA|UNIDAS PODEMOS|UNIDOS PODEMOS/],
  ["BILDU", /^(HB|AMAIUR|EH BILDU)\b|HERRI BATASUNA/], ["ERC", /^(ERC|ESQUERRA)|ESQUERRA REPUBLICANA/], ["BNG", /^(BNG|B\.N\.G\.)|BLOQUE NACIONALISTA GALEGO/],
  ["PSOE", /^(PSOE|P\.S\.O\.E\.|PSC|PSDEG|PSE-EE|PSIB|PSN)|PARTIDO SOCIALISTA OBRERO ESPANOL|SOCIALISTES DE CATALUNYA/], ["CS", /^(C'S|CS)\b|^CIUDADANOS/],
  ["PNV", /PNV|^EAJ/], ["CIU", /^(CIU|DL|CDC|JXCAT|JUNTS)\b|^JXCAT|JUNTS PER CATALUNYA/], ["CC", /^(CC|CCA)\b|COALICION CANARIA/],
  ["PP", /^(PP|UPN-PP|PP-PAR|PP-FORO)\b|^P\.P\.|PARTIDO POPULAR/], ["VOX", /^VOX\b/],
];
const planoMay = s => String(s||"").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function familiaDe(siglas, nombre=""){ const s = planoMay(siglas).trim(), n = planoMay(nombre).trim(); return (REGLAS_FAMILIA.find(([,re])=>re.test(s) || re.test(n)) || ["OTROS"])[0]; }

let nocheIntervalo = null, nocheEnsayo = null, nocheHistoria = [], nocheProv = null;
export async function pintarNoche(sec, c){
  ctx = c; estilos();
  await base();
  const E = HIST?.elecciones || [], ref = E[E.length-1];
  const ensayoPedido = /[?&]ensayo/.test(location.search) || sessionStorage.getItem("el-ensayo") === "1";
  sec.innerHTML = `<div class="chart" id="no-estado" style="gap:8px"></div>
    <div id="no-kpis" style="margin-top:12px"></div>
    <div class="hi-top" style="margin-top:12px">
      <div class="chart"><h3>El nuevo hemiciclo</h3><p class="sub">Los escaños que lleva cada candidatura con lo escrutado. Hacen falta 176 para la mayoría absoluta.</p>${hemiSVG(350)}<div id="no-leyenda"></div></div>
      <div class="chart hi-desliza" id="no-tabla"></div>
    </div>
    <section class="sec"><div class="sec-h"><h2>Provincia a provincia</h2><p>Cada provincia, del color de la candidatura que va primera; más intenso cuanto más escrutado. Pulsa una para ver su reparto.</p></div>
      <div class="chart"><div id="no-mapa"></div></div><div class="chart" id="no-prov" style="margin-top:12px" hidden></div></section>
    <section class="sec"><div class="sec-h"><h2>Escaños en el aire</h2><p>Los últimos escaños más ajustados con lo escrutado: cuántos votos le faltan a la siguiente candidatura para quitárselos. Cálculo propio con la ley D'Hondt sobre los votos provisionales.</p></div>
      <div class="chart"><ul class="hi-ultimo" id="no-aire"></ul></div></section>
    <section class="sec"><div class="sec-h"><h2>Cómo se movieron los escaños</h2><p>Escaños de cada candidatura según avanzaba el escrutinio.</p></div><div class="chart" id="no-evolucion"><p class="nota">Aparece en cuanto haya dos recuentos.</p></div></section>`;
  const estado = sec.querySelector("#no-estado");
  const pintarEstado = (html) => { estado.innerHTML = html; };

  async function directo(){
    try{
      const r = await fetch("/api/resultados", {cache:"no-store"});
      const d = await r.json().catch(()=>null);
      if (!d || d.estado === "sin-configurar" || r.status === 404){
        pintarEstado(`<p class="sub" style="margin:0">El escrutinio empieza el <b>domingo 29 de noviembre a las 20.00</b>, cuando cierran los colegios. Esta página se actualizará sola con los datos provisionales del Ministerio del Interior.</p>
          <p style="margin:0"><button class="btn primary" data-no-ensayo>Ver un ensayo con el escrutinio del 23J</button></p>`);
        return false;
      }
      if (d.estado === "error"){ pintarEstado(`<p class="sub" style="margin:0">No se ha podido leer el escrutinio (${esc(d.motivo||"")}). Se reintenta en unos segundos.</p>`); return true; }
      if (d.estado === "sin-escrutinio"){ pintarEstado(`<p class="sub" style="margin:0">Los colegios han cerrado; aún no hay mesas escrutadas.</p>`); return true; }
      pintarEstado(`<p class="sub" style="margin:0"><b>En directo.</b> Escrutinio provisional del Ministerio del Interior${d.actualizado?`, actualizado a las ${new Date(d.actualizado).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`:""}. Se actualiza solo cada 20 segundos. El recuento definitivo lo hacen las Juntas Electorales a partir del miércoles.</p>`);
      pintar(d); return true;
    } catch(err){ return false; }
  }
  function parar(){ clearInterval(nocheIntervalo); nocheIntervalo = null; clearInterval(nocheEnsayo?.reloj); }
  async function arrancarEnsayo(){
    parar();
    try{ sessionStorage.setItem("el-ensayo", "1"); }catch(err){}
    const D = await pedir(`datos/elecciones/historico-${ref.id}.json`);
    if (!D){ pintarEstado(`<p class="nota">No se ha podido preparar el ensayo.</p>`); return; }
    nocheHistoria = [];
    nocheEnsayo = {f: 0, D, reloj: null};
    pintarEstado(`<p class="sub" style="margin:0"><b>Ensayo.</b> Así se verá la noche, con los resultados del 23 de julio de 2023 repartidos en el tiempo como si llegaran mesa a mesa (las cifras intermedias son simuladas; las finales, las oficiales).</p>
      <div class="controls"><button class="btn" data-no-play>❚❚ Pausa</button><input type="range" min="0" max="100" value="0" step="1" data-no-f aria-label="Porcentaje escrutado del ensayo" style="flex:1;min-width:160px"><button class="chipbtn" data-no-salir>Salir del ensayo</button></div>`);
    const paso = () => { if (!document.body.contains(sec)){ parar(); return; } nocheEnsayo.f = Math.min(1, nocheEnsayo.f + 0.02); const i = sec.querySelector("[data-no-f]"); if (i) i.value = Math.round(nocheEnsayo.f*100); pintar(simular(nocheEnsayo.D, nocheEnsayo.f)); if (nocheEnsayo.f >= 1){ clearInterval(nocheEnsayo.reloj); nocheEnsayo.reloj = null; const b = sec.querySelector("[data-no-play]"); if (b) b.textContent = "▶ Repetir"; } };
    nocheEnsayo.reloj = setInterval(paso, 900); paso();
  }
  sec.addEventListener("click", async ev=>{
    if (ev.target.closest("[data-no-ensayo]")){ arrancarEnsayo(); return; }
    if (ev.target.closest("[data-no-salir]")){ parar(); try{ sessionStorage.removeItem("el-ensayo"); }catch(err){} nocheEnsayo = null; pintarNoche(sec, c); return; }
    const b = ev.target.closest("[data-no-play]");
    if (b && nocheEnsayo){ if (nocheEnsayo.reloj){ clearInterval(nocheEnsayo.reloj); nocheEnsayo.reloj = null; b.textContent = "▶ Seguir"; }
      else { if (nocheEnsayo.f >= 1){ nocheEnsayo.f = 0; nocheHistoria = []; } b.textContent = "❚❚ Pausa"; nocheEnsayo.reloj = setInterval(()=>{ if (!document.body.contains(sec)){ parar(); return; } nocheEnsayo.f = Math.min(1, nocheEnsayo.f + .02); sec.querySelector("[data-no-f]").value = Math.round(nocheEnsayo.f*100); pintar(simular(nocheEnsayo.D, nocheEnsayo.f)); if (nocheEnsayo.f >= 1){ clearInterval(nocheEnsayo.reloj); nocheEnsayo.reloj = null; b.textContent = "▶ Repetir"; } }, 900); } return; }
    const p = ev.target.closest("[data-p]"); if (p && sec.querySelector("#no-mapa").contains(p)){ ev.preventDefault(); nocheProv = p.dataset.p; if (ultimo) pintarProvinciaNoche(ultimo); sec.querySelector("#no-prov").scrollIntoView({block:"nearest", behavior:"smooth"}); }
  });
  sec.addEventListener("input", ev=>{ if (ev.target.matches("[data-no-f]") && nocheEnsayo){ clearInterval(nocheEnsayo.reloj); nocheEnsayo.reloj = null; const b = sec.querySelector("[data-no-play]"); if (b) b.textContent = "▶ Seguir";
    nocheEnsayo.f = ev.target.value/100; nocheHistoria = nocheHistoria.filter(h=>h.escrutado <= ev.target.value); pintar(simular(nocheEnsayo.D, nocheEnsayo.f)); } });

  let ultimo = null;
  function pintar(d){
    ultimo = d;
    const anterior = nocheHistoria[nocheHistoria.length-1];
    if (!anterior || anterior.escrutado !== d.escrutado) nocheHistoria.push({escrutado: d.escrutado, e: Object.fromEntries(d.partidos.filter(p=>p.e).map(p=>[p.s, p.e]))});
    const conEscano = d.partidos.filter(p=>p.e), mayor = conEscano[0];
    sec.querySelector("#no-kpis").innerHTML = `<div class="kpis"><div class="kpi"><b>${dec(d.escrutado||0, 1)} %</b><span>escrutado</span></div>
      ${d.participacion!=null?`<div class="kpi"><b>${dec(d.participacion,1)} %</b><span>participación en lo escrutado (sin el voto desde el extranjero)</span></div>`:""}
      ${mayor?`<div class="kpi"><b>${mayor.e}</b><span>escaños de ${esc(mayor.s)}, primera fuerza${mayor.e>=176?" (mayoría absoluta)":` (a ${176-mayor.e} de la mayoría)`}</span></div>`:""}
      ${d.votantes?`<div class="kpi"><b>${fmtCorto(d.votantes)}</b><span>votos escrutados</span></div>`:""}</div>
      <div style="height:6px;background:var(--sunk);border-radius:3px;overflow:hidden;margin-top:6px" role="progressbar" aria-valuenow="${Math.round(d.escrutado||0)}" aria-valuemin="0" aria-valuemax="100"><div style="height:100%;width:${d.escrutado||0}%;background:var(--ink);transition:width .6s"></div></div>`;
    // Hemiciclo: candidaturas con escaño, de izquierda a derecha por familia.
    const filas = d.partidos.map(p=>[p.s, familiaDe(p.s, p.n), p.v, p.e]);
    pintarHemi(sec.querySelector(".hi-top .hi-hemi"), segsLista(filas, d.validos || d.partidos.reduce((s,p)=>s+p.v,0)));
    sec.querySelector("#no-leyenda").innerHTML = leyendaGrupos([...new Set(filas.filter(f=>f[3]).map(f=>GRUPO_DE[f[1]]||"OTROS"))]);
    const prev = ref ? Object.fromEntries(ref.partidos.map(p=>[p[0], p[4]])) : {};
    const total = d.partidos.reduce((s,p)=>s+p.v,0) || 1, maxV = Math.max(...d.partidos.map(p=>p.v), 1);
    sec.querySelector("#no-tabla").innerHTML = `<h3>Candidaturas</h3><table class="hi-tabla"><thead><tr><th>Candidatura</th><th class="n">Votos</th><th class="n">%</th><th></th><th class="n">Escaños</th>${nocheEnsayo?"":`<th class="n">Δ 2023</th>`}</tr></thead><tbody>
      ${d.partidos.filter(p=>p.e || p.v >= .005*total).slice(0, 16).map(p=>{ const col = colorPartido(p.s, familiaDe(p.s, p.n));
        return `<tr><td title="${esc(p.n)}"><i class="d" style="background:${col}"></i>${esc(p.s)}</td><td class="n">${fmt(p.v)}</td><td class="n">${dec(p.p || p.v/total*100, 2)} %</td><td style="width:20%"><span class="bar" style="width:${(p.v/maxV*100).toFixed(1)}%;background:${col}"></span></td><td class="n"><b>${p.e}</b></td>${nocheEnsayo?"":`<td class="n">${prev[p.s]!=null?conSigno(p.e-prev[p.s]):"–"}</td>`}</tr>`; }).join("")}</tbody></table>`;
    // Mapa: color de quien va primero en cada provincia, intensidad por lo escrutado.
    const lider = cod => { const pr = d.provincias[cod]; const p = pr?.partidos?.slice().sort((a,b)=>b.v-a.v)[0]; return p ? {col: colorPartido(p.s, familiaDe(p.s, p.n)), esc: pr.escrutado||0} : null; };
    sec.querySelector("#no-mapa").innerHTML = mapaSVG(cod=>{ const l = lider(cod); if (!l) return null; const t = 0.18 + 0.82*Math.min(1, l.esc/100); return `color-mix(in srgb, ${l.col} ${Math.round(t*100)}%, var(--sunk))`; })
      + leyendaGrupos([...new Set(Object.keys(d.provincias).map(cod=>{ const p = d.provincias[cod].partidos.slice().sort((a,b)=>b.v-a.v)[0]; return p && (GRUPO_DE[familiaDe(p.s, p.n)]||"OTROS"); }).filter(Boolean))]);
    // Escaños en el aire.
    const aire = Object.entries(d.provincias).map(([cod, pr])=>[cod, ultimoEscano(pr, GEO.provincias[cod] ? (HIST?.elecciones?.[HIST.elecciones.length-1]?.prov?.[cod]?.e) : null)]).filter(x=>x[1]).sort((a,b)=>a[1].faltan-b[1].faltan).slice(0, 10);
    sec.querySelector("#no-aire").innerHTML = aire.length ? aire.map(([cod,u])=>`<li><a href="${enlaceProv(cod)}" data-p="${cod}">${esc(nombreProv(cod))}</a><span>Lo tiene <b>${esc(u.gana)}</b>; a <b>${esc(u.segundo)}</b> le faltan</span><span class="m">${fmt(u.faltan)} votos</span></li>`).join("") : `<li class="nota">Aún no hay votos suficientes.</li>`;
    if (nocheProv) pintarProvinciaNoche(d);
    evolucion();
  }
  function pintarProvinciaNoche(d){
    const caja = sec.querySelector("#no-prov"), pr = d.provincias[nocheProv]; if (!pr){ caja.hidden = true; return; }
    const escanos = pr.partidos.reduce((s,p)=>s+p.e,0) || HIST?.elecciones?.[HIST.elecciones.length-1]?.prov?.[nocheProv]?.e || 0;
    const validos = pr.partidos.reduce((s,p)=>s+p.v,0);
    caja.hidden = false;
    caja.innerHTML = `<div class="sec-h" style="padding:0"><h3>${esc(nombreProv(nocheProv))}</h3><span class="nota">${dec(pr.escrutado||0,1)} % escrutado · ${escanos} escaños</span></div>
      <div class="hi-desliza">${tablaCocientes({e: escanos, validos, c: pr.partidos.map(p=>[p.s, familiaDe(p.s, p.n), p.v, p.e])})}</div>
      <p class="nota">Barrera del 3 % calculada sobre los votos a candidaturas (sin los votos en blanco, que el directo no da por provincia). <a href="${enlaceProv(nocheProv)}">Su historia electoral →</a></p>`;
  }
  function evolucion(){
    const caja = sec.querySelector("#no-evolucion");
    if (nocheHistoria.length < 2) return;
    const partidosTop = Object.entries(nocheHistoria[nocheHistoria.length-1].e).sort((a,b)=>b[1]-a[1]).slice(0, 6).map(x=>x[0]);
    const W = Math.max(300, caja.clientWidth - 36), H = 220, ml = 34, mr = 90, mt = 12, mb = 24;
    const xs = nocheHistoria.map(h=>h.escrutado), maxE = Math.max(...nocheHistoria.flatMap(h=>Object.values(h.e)), 10);
    const x = v => ml + (v/100)*(W-ml-mr), y = v => mt + (1 - v/(Math.ceil(maxE/25)*25))*(H-mt-mb);
    const top = Math.ceil(maxE/25)*25, marcas = Array.from({length: top/25+1}, (_,i)=>i*25);
    const finales = [];
    const lineas = partidosTop.map(s=>{ const col = colorPartido(s, familiaDe(s)), pts = nocheHistoria.map(h=>[h.escrutado, h.e[s]||0]);
      const ult = pts[pts.length-1]; finales.push({y: y(ult[1])+4, t: `${s} ${ult[1]}`});
      return `<path class="linea" d="${pts.map((p,i)=>`${i?"L":"M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join("")}" style="stroke:${col}"/><circle class="punto" cx="${x(ult[0])}" cy="${y(ult[1])}" r="4" style="fill:${col}"/>`; }).join("");
    finales.sort((a,b)=>a.y-b.y); for (let i=1;i<finales.length;i++) finales[i].y = Math.max(finales[i].y, finales[i-1].y+13);
    caja.innerHTML = `<svg class="hi-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Escaños de cada candidatura según el porcentaje escrutado">
      ${marcas.map(v=>`<line class="eje" x1="${ml}" x2="${W-mr}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${ml-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join("")}
      ${[0,25,50,75,100].map(v=>`<text class="tick" x="${x(v)}" y="${H-6}" text-anchor="middle">${v} %</text>`).join("")}
      ${lineas}${finales.map(f=>`<text class="lbl-fuera" x="${W-mr+8}" y="${f.y.toFixed(1)}">${esc(f.t)}</text>`).join("")}</svg>`;
  }
  conTip(sec.querySelector("#no-mapa"), ev=>{ const p = ev.target.closest("[data-p]"); if (!p || !ultimo) return ""; const pr = ultimo.provincias[p.dataset.p]; if (!pr) return `<b>${esc(nombreProv(p.dataset.p))}</b><br>Sin datos todavía`;
    const tot = pr.partidos.reduce((s,x)=>s+x.v,0) || 1;
    return `<b>${esc(nombreProv(p.dataset.p))}</b> · ${dec(pr.escrutado||0,1)} % escrutado${pr.partidos.slice().sort((a,b)=>b.v-a.v).slice(0,5).map(x=>filaTip(colorPartido(x.s, familiaDe(x.s, x.n)), x.s, `${dec(x.v/tot*100,1)} % · ${x.e}`)).join("")}<div style="color:var(--muted);margin-top:4px">Pulsa para ver su reparto</div>`; });

  nocheProv = null;
  if (ensayoPedido){ arrancarEnsayo(); return; }
  const hay = await directo();
  if (hay){ nocheIntervalo = setInterval(()=>{ if (!document.body.contains(sec)){ parar(); return; } if (!document.hidden) directo(); }, 20000); }
}

/* El último escaño de una provincia con lo escrutado: quién lo tiene y cuántos votos le faltan al siguiente. */
function ultimoEscano(pr, escanosRef){
  const escanos = pr.partidos.reduce((s,p)=>s+p.e,0) || escanosRef; if (!escanos) return null;
  const votos = Object.fromEntries(pr.partidos.map(p=>[p.s, p.v]));
  const validos = pr.partidos.reduce((s,p)=>s+p.v,0); if (!validos) return null;
  const r = dhondt(votos, escanos, validos);
  const u = r.gan[r.gan.length-1], sig = r.fuera.find(x=>x.c !== u?.c); if (!u || !sig) return null;
  return {gana: u.c, segundo: sig.c, faltan: Math.max(1, Math.floor(u.q*((r.rep[sig.c]||0)+1)) - votos[sig.c] + 1)};
}

/* Ensayo: los resultados oficiales de 2023 repartidos en el tiempo. Cada provincia escruta a su ritmo y, al
   principio, con un pequeño sesgo que desaparece al llegar al 100 %; los escaños se recalculan con la ley D'Hondt. */
function simular(D, f){
  const azar = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };
  const provincias = {}, nacional = {};
  for (const [cod, p] of Object.entries(D.prov)){
    const ritmo = 0.7 + azar(cod)*0.8, esc = 1 - Math.pow(1 - f, ritmo);   // unas provincias van más deprisa; todas acaban en el 100 %
    const votos = {};
    p.c.forEach(x=>{ const sesgo = (azar(cod + x[0]) - .5) * .22 * (1 - esc); votos[x[0]] = Math.round(x[2] * esc * (1 + sesgo)); });
    const validos = Object.values(votos).reduce((a,b)=>a+b,0) + Math.round(p.blancos*esc);
    const rep = esc > 0 ? dhondt(votos, p.e, validos).rep : {};
    provincias[cod] = {escrutado: Math.round(esc*10000)/100, partidos: p.c.map(x=>({s:x[0], n:"", v:votos[x[0]], e:rep[x[0]]||0, fam:x[1]})).sort((a,b)=>b.e-a.e || b.v-a.v)};
    // España: se suma por familia (las candidaturas regionales de un mismo partido van juntas).
    provincias[cod].partidos.forEach(x=>{ const k = x.fam === "OTROS" ? x.s : x.fam; const t = nacional[k] ||= {s:x.s, n:"", v:0, e:0, porSiglas:{}}; t.v += x.v; t.e += x.e; t.porSiglas[x.s] = (t.porSiglas[x.s]||0) + x.v; });
  }
  const partidos = Object.values(nacional).map(t=>({...t, s: Object.entries(t.porSiglas).sort((a,b)=>b[1]-a[1])[0][0]})).sort((a,b)=>b.e-a.e || b.v-a.v);
  const total = partidos.reduce((s,p)=>s+p.v,0) || 1;
  partidos.forEach(p=>{ p.p = p.v/total*100; delete p.porSiglas; });
  const escrutado = Object.values(provincias).reduce((s,p)=>s+p.escrutado,0)/Object.keys(provincias).length;
  return {estado:"ok", escrutado: Math.round(escrutado*100)/100, participacion: null, votantes: total, validos: total, partidos, provincias};
}
