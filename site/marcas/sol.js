/* Sol, de Reforma Digital: lo que la marca necesita en JS (index.html lo carga después de app.js).

   Las flechas de texto de enlaces y botones («Ver más →», «BOE ↗», «Tu provincia ↓», «← Anterior») pasan a los
   iconos de Sol: el chevrón pixelado y la flecha de enlace externo, los de apps/web/components/sol/icon.tsx (licencia
   MIT, ver marcas/sol/LEEME.md). Así las vistas siguen escribiendo flechas y la marca decide cómo se ven; un
   observador las cambia también en lo que se pinta después (cada vista, los apartados de Elecciones, los textos que
   cambian). */
(() => {
  const chevron = (giro) => `<svg class="icono" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path transform="rotate(${giro} 8 8)" d="M4 0h3v3H4zM7 3h3v3H7zM10 6h3v3h-3zM7 9h3v3H7zM4 12h3v3H4z"/></svg>`;
  const externo = `<svg class="icono" viewBox="0 0 18 18" width="15" height="15" aria-hidden="true"><path d="M5 13 13 5M6.5 5H13v6.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICONO = { "→": chevron(0), "↗": externo, "↓": chevron(90), "←": chevron(180) };
  const SEL = "a, button";
  const FIN = /(^|\s+)([→↗↓])\s*$/, INI = /^\s*(←)\s*/;

  const icono = (flecha, lado) => {
    const t = document.createElement("template");
    t.innerHTML = ICONO[flecha];
    const svg = t.content.firstChild;
    svg.classList.add(lado === "fin" ? "icono-fin" : "icono-ini");
    return svg;
  };

  function cambiar(el) {
    if (el.closest("svg")) return;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textos = [];
    while (w.nextNode()) textos.push(w.currentNode);
    for (const n of textos) {
      if (n.parentElement?.closest("svg")) continue;
      // Solo una flecha al final de su texto («Siguiente →», o un <span>→</span> suelto), nunca en medio («PP → PSOE»).
      let m = n.data.match(FIN);
      if (m) {
        n.data = n.data.slice(0, m.index);
        n.after(icono(m[2], "fin"));
      }
      if ((m = n.data.match(INI))) {
        n.data = n.data.slice(m[0].length);
        n.before(icono(m[1], "ini"));
      }
    }
  }

  function decorar(raiz) {
    if (raiz.nodeType !== 1) raiz = raiz.parentElement;
    if (!raiz) return;
    const cerca = raiz.closest(SEL);
    if (cerca) cambiar(cerca);
    raiz.querySelectorAll(SEL).forEach(cambiar);
  }

  decorar(document.body);
  new MutationObserver((cambios) => {
    const raices = new Set();
    for (const c of cambios) {
      raices.add(c.target);
      c.addedNodes.forEach((n) => raices.add(n));
    }
    raices.forEach(decorar);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  // «Lo último del Congreso»: de la portada al primer bloque de Inicio.
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-bajar]")) return;
    const destino = document.getElementById("ultimo") || document.getElementById("inicio");
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    destino?.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
  });
})();
