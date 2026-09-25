<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Escaño Abierto · sneak peek</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Doto"; src: url("assets/Doto.ttf") format("truetype"); font-weight: 100 900; }
      @font-face { font-family: "Geist"; src: url("assets/Geist.ttf") format("truetype"); font-weight: 100 900; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #08090B; }
      :root { --bg: #08090B; --surface: #101216; --ink: #EEEEE8; --muted: #8B929C; --line: #1F232A; --si: #39D98A; --no: #FF5D52; --abst: #F5C542; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--bg); color: var(--ink); font-family: "Geist", sans-serif; }
      .capa { position: absolute; inset: 0; width: 1920px; height: 1080px; }
      .doto { font-family: "Doto", monospace; font-weight: 900; font-variant-numeric: tabular-nums; }

      #bg-glow { background: radial-gradient(ellipse 70% 55% at 50% -10%, #1B2231 0%, rgba(8,9,11,0) 70%); }
      #bg-dots { top: -200px; height: 1480px; background-image: radial-gradient(circle, rgba(238,238,232,.05) 1.4px, transparent 1.6px); background-size: 26px 26px; }

      /* cámara: todo el mundo de puntos vive en un único SVG a tamaño de pantalla */
      #cam { perspective: 1300px; }
      #stage { transform-origin: 960px 540px; will-change: transform; }
      #mundo { width: 1920px; height: 1080px; overflow: visible; display: block; }
      #bloom-start { position: absolute; left: 760px; top: 340px; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.38) 0%, rgba(255,255,255,0) 65%); }
      #etiqueta { left: 0; right: 0; top: 590px; height: 50px; width: auto; text-align: center; font-size: 30px; letter-spacing: .18em; color: var(--muted); }

      .deco { display: inline-block; white-space: nowrap; }
      .deco .ch { display: inline-block; transform-origin: 50% 100%; }
      #wm1 { left: 0; right: 0; width: auto; top: 862px; height: 130px; text-align: center; font-size: 104px; letter-spacing: .07em; }

      /* votación */
      #panel { left: 130px; top: 250px; width: 800px; height: 600px; }
      .eyebrow { display: flex; align-items: center; gap: 14px; font-size: 24px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); font-weight: 500; }
      .eyebrow i { display: block; width: 12px; height: 12px; border-radius: 2px; }
      .linea { display: flex; gap: 18px; font-size: 72px; font-weight: 700; line-height: 1.1; letter-spacing: -.015em; }
      .w { display: inline-block; }
      #marcador { display: flex; align-items: baseline; gap: 30px; margin-top: 44px; font-size: 140px; line-height: 1; }
      #marcador > span { display: block; transform-origin: 0% 80%; }
      #n-si, #n-no { width: 270px; }
      #n-si { text-align: right; transform-origin: 100% 80% !important; }
      #veredicto { position: relative; display: flex; align-items: center; gap: 22px; margin-top: 36px; }
      #chip { position: relative; display: block; font-weight: 700; font-size: 30px; letter-spacing: .08em; color: var(--bg); background: var(--si); padding: 10px 20px; border-radius: 10px; box-shadow: 0 0 40px rgba(57,217,138,.5); }
      #chip-onda { position: absolute; left: 90px; top: 29px; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%; border: 3px solid var(--si); }
      #por { display: block; font-size: 34px; color: var(--muted); }

      /* embudo */
      #embudo-txt { left: 150px; top: 120px; width: 1620px; height: 900px; }
      #titulo2 { display: flex; gap: 22px; margin-top: 24px; font-size: 76px; font-weight: 700; letter-spacing: -.015em; }
      #titulo2 .n { font-family: "Doto", monospace; font-weight: 900; }
      #titulo2 .ok { color: var(--si); text-shadow: 0 0 30px rgba(57,217,138,.55); }
      .et { position: absolute; left: 0; font-size: 32px; color: var(--muted); }
      .et.fin { color: var(--ink); font-weight: 600; }
      .num { position: absolute; right: 0; font-size: 58px; text-align: right; width: 220px; }
      .num.fin { color: var(--si); text-shadow: 0 0 24px rgba(57,217,138,.5); }
      #flash { background: radial-gradient(circle at 50% 50%, #FFFFFF 0%, #C8FFE3 30%, rgba(57,217,138,.6) 60%, rgba(8,9,11,0) 100%); }

      /* vuelo por las tarjetas */
      #vuelo { perspective: 1400px; }
      .fcard { position: absolute; left: 400px; top: 250px; width: 1120px; height: 580px; border-radius: 30px; background: linear-gradient(160deg, #161A20 0%, #0D0F13 100%); border: 1px solid #262B33; box-shadow: 0 60px 140px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06); display: grid; grid-template-columns: 430px 1fr; overflow: hidden; }
      .fcard .vis { position: relative; display: flex; align-items: center; justify-content: center; border-right: 1px solid #1F242B; background: radial-gradient(circle at 50% 45%, rgba(255,255,255,.05), transparent 70%); }
      .fcard .cuerpo { padding: 64px 60px; display: flex; flex-direction: column; justify-content: center; gap: 30px; }
      .fcard .eyebrow { font-size: 24px; }
      .fcard .txt { font-size: 52px; font-weight: 650; line-height: 1.12; letter-spacing: -.015em; }
      .fcard .big { font-size: 170px; line-height: 1; }
      .chip2 { display: block; font-weight: 700; font-size: 34px; letter-spacing: .08em; color: var(--bg); background: var(--si); padding: 12px 22px; border-radius: 12px; box-shadow: 0 0 40px rgba(57,217,138,.45); }
      .dipgrid { display: grid; grid-template-columns: repeat(5, 40px); gap: 16px; }
      .dipgrid i { display: block; width: 40px; height: 40px; border-radius: 50%; }
      .sub { display: block; font-size: 28px; color: var(--muted); letter-spacing: .12em; text-align: center; margin-top: 10px; }

      /* cierre */
      #cierre { display: flex; flex-direction: column; align-items: center; justify-content: center; }
      #logo { position: relative; width: 300px; height: 168px; perspective: 900px; }
      #logo .p { position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: #5E646D; }
      #logo .p.blanco { background: #FFFFFF; box-shadow: 0 0 26px rgba(255,255,255,.8); }
      #logo-bloom { position: absolute; left: 50%; top: 50%; width: 900px; height: 900px; margin: -450px 0 0 -450px; border-radius: 50%; background: radial-gradient(circle, rgba(120,150,210,.22) 0%, rgba(8,9,11,0) 62%); }
      #logo-onda { position: absolute; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%; border: 2px solid #FFFFFF; }
      #wm2 { font-size: 132px; letter-spacing: .07em; margin-top: 46px; }
      #lema { display: flex; gap: 14px; font-size: 50px; font-weight: 500; margin-top: 28px; }
      #url-wrap { margin-top: 38px; display: flex; flex-direction: column; align-items: center; }
      #url { font-size: 46px; font-weight: 600; letter-spacing: .01em; }
      #url-line { display: block; width: 100%; height: 3px; margin-top: 10px; background: var(--si); border-radius: 2px; box-shadow: 0 0 18px rgba(57,217,138,.6); }

      /* estado de partida: lo que entra más tarde empieza invisible */
      #bloom-start, #etiqueta, #panel .eyebrow, #panel .w, #marcador, #chip, #por, #chip-onda, #e-eye, #titulo2 .w, .et, .num, .fcard,
      #logo .p, #logo-onda, #logo-bloom, #lema .w, #url, #flash, .deco .ch { opacity: 0; }
      #grano { pointer-events: none; opacity: .035; mix-blend-mode: screen; }
      #vineta { background: radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, rgba(0,0,0,.6) 100%); pointer-events: none; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="19" data-width="1920" data-height="1080">
      <div id="bg-glow" class="capa"></div>
      <div id="bg-dots" class="capa"></div>
      <div id="bloom-start"></div>

      <div id="cam" class="capa"><div id="stage" class="capa" data-layout-allow-overflow>
        <svg id="mundo" viewBox="0 0 1920 1080">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <g id="asientos" filter="url(#glow)"></g>
        </svg>
      </div></div>

      <div id="etiqueta" class="capa doto">350 ESCAÑOS</div>
      <div id="wm1" class="capa doto"><span class="deco" id="deco1"></span></div>

      <div id="panel" class="capa">
        <div class="eyebrow" id="p-eye"><i style="background:var(--si);box-shadow:0 0 14px var(--si)"></i>Moción · 23 sep 2026</div>
        <div style="margin-top:30px">
          <div class="linea"><span class="w">Cada</span><span class="w">voto.</span></div>
          <div class="linea"><span class="w">De</span><span class="w">cada</span><span class="w">diputado.</span></div>
        </div>
        <div id="marcador" class="doto"><span id="n-si">0</span><span id="guion">–</span><span id="n-no">0</span></div>
        <div id="veredicto"><span id="chip-onda"></span><span id="chip">APROBADA</span><span id="por">por dos votos</span></div>
      </div>

      <div id="embudo-txt" class="capa">
        <div class="eyebrow" id="e-eye"><i style="background:var(--abst);box-shadow:0 0 14px var(--abst)"></i>Leyes de la legislatura</div>
        <div id="titulo2"><span class="w">De</span><span class="w n">__E0__</span><span class="w">propuestas,</span><span class="w n ok">__E5__</span><span class="w">son ley.</span></div>
        <div id="filas-txt"></div>
      </div>

      <div id="flash" class="capa"></div>

      <div id="vuelo" class="capa">
        <div class="fcard"><div class="vis"><div><span class="chip2">APROBADA</span><span class="sub">PROPOSICIÓN NO DE LEY</span></div></div><div class="cuerpo"><div class="eyebrow"><i style="background:var(--si)"></i>¿Qué significa?</div><div class="txt">Aprobarla no cambia ninguna ley. Te lo explicamos en cada votación.</div></div></div>
        <div class="fcard"><div class="vis"><div class="dipgrid" id="dipgrid"></div></div><div class="cuerpo"><div class="eyebrow"><i style="background:#2C7BC4"></i>Tus diputados</div><div class="txt">Elige tu provincia y mira cómo vota quien te representa.</div></div></div>
        <div class="fcard"><div class="vis"><div><div class="doto big" style="font-size:120px">29·30</div><span class="sub">SEPTIEMBRE</span></div></div><div class="cuerpo"><div class="eyebrow"><i style="background:var(--abst)"></i>Próximo pleno</div><div class="txt">Lo que se va a votar, antes de que se vote.</div></div></div>
        <div class="fcard"><div class="vis"><div><div class="doto big" style="color:var(--no);text-shadow:0 0 36px rgba(255,93,82,.5)">__CONG__</div><span class="sub">SEMANAS</span></div></div><div class="cuerpo"><div class="eyebrow"><i style="background:var(--no)"></i>El congelador</div><div class="txt">Leyes con el plazo de enmiendas ampliado semana tras semana.</div></div></div>
      </div>

      <div id="cierre" class="capa">
        <div id="logo"><div id="logo-bloom" data-layout-allow-overflow></div><div id="logo-onda"></div></div>
        <div id="wm2" class="doto"><span class="deco" id="deco2"></span></div>
        <div id="lema"><span class="w">Entender</span><span class="w">lo</span><span class="w">que</span><span class="w">se</span><span class="w">hace</span><span class="w">en</span><span class="w">el</span><span class="w">Congreso.</span></div>
        <div id="url-wrap"><div id="url">escañoabierto.com</div><span id="url-line"></span></div>
      </div>

      <canvas id="grano" class="capa" width="960" height="540"></canvas>
      <div id="vineta" class="capa"></div>
    </div>

    <script>
      // Datos reales de escañoabierto.com: los 350 escaños del plano oficial con su voto, el embudo de leyes y el congelador.
      const D = __DATOS__;
      const NS = "http://www.w3.org/2000/svg";
      const C = { gris: "#3A404A", ink: "#EEEEE8", si: "#39D98A", no: "#FF5D52", abst: "#F5C542", nv: "#2A2F37" };
      const VOTO = { S: C.si, N: C.no, A: C.abst, X: C.nv };
      const PW = D.plano.ancho, PH = D.plano.alto;
      // pseudoaleatorio con semilla: el mismo resultado en cada fotograma y cada render
      const semilla = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      const azar = semilla(20260925);

      // ---------------------------------------------------------------- mundo de puntos
      const S = 1.85, OX = (1920 - PW * S) / 2, OY = 104, R = 8.4;       // hemiciclo en pantalla
      const CX = 960, CY = 540;
      const gA = document.getElementById("asientos");
      const circulo = (padre, attrs) => { const c = document.createElementNS(NS, "circle"); for (const k in attrs) c.setAttribute(k, attrs[k]); padre.appendChild(c); return c; };
      const seats = D.asientos.map(([x, y, grupo, voto]) => {
        const sx = OX + x * S, sy = OY + y * S;
        return { x: sx, y: sy, voto, c: circulo(gA, { cx: CX, cy: CY, r: 0, fill: C.gris }),
                 radio: Math.hypot(x - PW / 2, y - PH), ang: Math.atan2(PH - y, x - PW / 2) };
      });
      const porRadio = seats.slice().sort((a, b) => a.radio - b.radio);
      const porAngulo = seats.slice().sort((a, b) => b.ang - a.ang);
      const destacado = seats.filter(s => Math.abs(s.x - CX) < 26).sort((a, b) => a.y - b.y)[0];

      // Las filas del embudo, en LEDs: cuántos puntos por fila y dónde.
      const MAXLED = 44, FX = 700, FY = 388, FDY = 88, FDX = 21, RL = 7.4;
      const nLed = D.embudo.map(n => Math.max(1, Math.round(n / D.embudo[0] * MAXLED)));
      const destinos = [];
      nLed.forEach((n, fila) => { for (let j = 0; j < n; j++) destinos.push({ x: FX + j * FDX, y: FY + fila * FDY, fila }); });
      // 81 escaños viajan a los LEDs (repartidos por todo el hemiciclo); el resto cae.
      const paso = porAngulo.length / destinos.length;
      const viajeros = destinos.map((d, k) => ({ ...d, s: porAngulo[Math.floor(k * paso + paso / 2)] }));
      const quedan = new Set(viajeros.map(v => v.s));
      const caen = seats.filter(s => !quedan.has(s));

      // ---------------------------------------------------------------- textos que se decodifican
      const GLIFOS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&";
      const glifo = seed => GLIFOS[Math.floor(((seed * 9301 + 49297) % 233280) / 233280 * GLIFOS.length)];
      const decodificable = (id, texto) => [...texto].map(ch => { const s = document.createElement("span"); s.className = "ch"; s.textContent = ch === " " ? " " : ch; s.dataset.t = ch; document.getElementById(id).appendChild(s); return s; });
      const deco1 = decodificable("deco1", "ESCAÑO ABIERTO"), deco2 = decodificable("deco2", "ESCAÑO ABIERTO");

      // Etiquetas y cifras del embudo, alineadas con las filas de LEDs.
      const ETAPAS = ["Presentadas", "Admitidas a debate", "Con informe en comisión", "Aprobadas en el Congreso", "Pasaron por el Senado", "Son ley"];
      const filasTxt = document.getElementById("filas-txt");
      const etiquetas = [], cifras = [];
      ETAPAS.forEach((et, k) => {
        const y = FY + k * FDY - 120;   // coordenadas relativas a #embudo-txt (top 120)
        const fin = k === ETAPAS.length - 1 ? " fin" : "";
        const e = document.createElement("div"); e.className = "et" + fin; e.textContent = et; e.style.top = (y - 22) + "px"; filasTxt.appendChild(e); etiquetas.push(e);
        const n = document.createElement("div"); n.className = "num doto" + fin; n.textContent = "0"; n.style.top = (y - 36) + "px"; filasTxt.appendChild(n); cifras.push(n);
      });

      // Diputados de una provincia (tarjeta 2): colores reales de los grupos.
      const dipgrid = document.getElementById("dipgrid");
      ["PP", "PP", "PP", "PP", "PP", "PSOE", "PSOE", "PSOE", "PSOE", "VOX", "VOX", "SUMAR", "SUMAR", "PP", "PSOE"].forEach(g => { const i = document.createElement("i"); i.style.background = D.colores[g]; dipgrid.appendChild(i); });

      // Logo: tres filas de escaños y el blanco en lo alto.
      const logo = document.getElementById("logo"), puntosLogo = [];
      [[22, 9], [15, 7], [8, 5]].forEach(([r, n], fila) => { for (let k = 0; k < n; k++) {
        const a = k * Math.PI / (n - 1), blanco = fila === 0 && k === (n - 1) / 2;
        const p = document.createElement("div"); p.className = "p" + (blanco ? " blanco" : "");
        p.style.left = ((24 - r * Math.cos(a)) / 48 * 300) + "px"; p.style.top = ((24 - r * Math.sin(a)) / 26 * 168) + "px";
        logo.appendChild(p); puntosLogo.push({ p, blanco });
      } });
      const blancoLogo = puntosLogo.find(p => p.blanco).p;
      const onda = document.getElementById("logo-onda");
      onda.style.left = blancoLogo.style.left; onda.style.top = blancoLogo.style.top;

      // Grano de película: ruido fijo con semilla, que se desplaza a saltos.
      (() => { const cv = document.getElementById("grano"), cx = cv.getContext("2d"), img = cx.createImageData(960, 540), rnd = semilla(7);
        for (let i = 0; i < img.data.length; i += 4) { const v = rnd() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
        cx.putImageData(img, 0, 0); })();

      // ================================================================ línea de tiempo
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
      const decodificar = (spans, t0, dur, paso) => spans.forEach((el, i) => {
        const st = { p: 0 }, real = el.dataset.t;
        tl.fromTo(el, { opacity: 0, rotationX: 90 }, { opacity: 1, rotationX: 0, duration: dur, ease: "back.out(1.6)", immediateRender: false }, t0 + i * paso);
        tl.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: "none", immediateRender: false,
          onUpdate: () => { el.textContent = real === " " ? " " : (st.p < 0.72 ? glifo(i * 131 + Math.floor(st.p * 14)) : real); } }, t0 + i * paso);
      });
      const cascada = (sel, t0, paso = 0.06) => tl.fromTo(sel, { opacity: 0, y: 70, rotationX: -55 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.7, stagger: paso, ease: "expo.out", immediateRender: false }, t0);

      // Fondo y grano durante todo el vídeo
      tl.fromTo("#bg-dots", { opacity: 0, y: 0 }, { opacity: 1, y: 140, duration: 19, ease: "none" }, 0);
      tl.fromTo("#grano", { x: 0, y: 0, scale: 2.1 }, { x: -60, y: -40, scale: 2.2, duration: 19, ease: "steps(228)" }, 0);

      // 0 · un punto
      tl.fromTo(destacado.c, { attr: { r: 0, fill: "#FFFFFF" } }, { attr: { r: 9 }, duration: 0.5, ease: "back.out(3)" }, 0.15);
      tl.fromTo("#bloom-start", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.9, ease: "sine.out" }, 0);
      tl.to("#etiqueta", { keyframes: [{ opacity: 1, duration: 0.05 }, { opacity: 0.2, duration: 0.05 }, { opacity: 1, duration: 0.08 }] }, 0.4);
      tl.to("#etiqueta", { opacity: 0, y: 14, duration: 0.25, ease: "power2.in" }, 0.85);
      tl.fromTo("#bloom-start", { opacity: 1, scale: 1 }, { opacity: 0, scale: 2.2, duration: 0.7, ease: "power2.out", immediateRender: false }, 0.95);

      // 1 · estalla en 350 escaños que vuelan a su sitio; la cámara baja de un plano inclinado
      porRadio.forEach((s, k) => {
        tl.fromTo(s.c, { attr: { cx: CX, cy: CY, r: s === destacado ? 9 : 0 } },
          { attr: { cx: s.x, cy: s.y, r: R }, duration: 1.05, ease: "expo.out", immediateRender: false }, 0.95 + k / porRadio.length * 0.55);
      });
      tl.fromTo("#stage", { rotationX: 42, y: 90, scale: 1.22 }, { rotationX: 0, y: 0, scale: 1, duration: 2.1, ease: "power3.out" }, 0.9);
      // brillo que recorre los escaños: una banda diagonal los enciende a su paso
      seats.forEach(s => {
        if (s === destacado) return;
        const t = 2.05 + ((s.x - OX) / (PW * S) * 0.75) + ((s.y - OY) / (PH * S)) * 0.22;
        tl.fromTo(s.c, { attr: { fill: C.gris } }, { keyframes: [{ attr: { fill: "#E6E9EE" }, duration: 0.12, ease: "power2.out" }, { attr: { fill: C.gris }, duration: 0.45, ease: "power2.in" }], immediateRender: false }, t);
      });
      decodificar(deco1, 2.2, 0.5, 0.04);

      // 2 · reencuadre y votación
      tl.to("#wm1", { opacity: 0, y: -30, filter: "blur(8px)", duration: 0.4, ease: "power2.in" }, 3.25);
      tl.to("#stage", { x: 390, y: 70, scale: 0.9, duration: 0.95, ease: "power3.inOut" }, 3.3);
      tl.to("#stage", { scale: 0.93, duration: 3.1, ease: "none" }, 4.25);
      tl.to("#panel .eyebrow", { opacity: 1, duration: 0.01 }, 3.75);
      tl.fromTo("#panel .eyebrow", { x: -30 }, { x: 0, duration: 0.6 }, 3.75);
      cascada("#panel .w", 3.85, 0.07);
      const barrido = 4.05, dB = 1.85;
      porAngulo.forEach((s, k) => {
        const t = barrido + k / porAngulo.length * dB;
        tl.fromTo(s.c, { attr: { fill: s === destacado ? "#FFFFFF" : C.gris } }, { attr: { fill: VOTO[s.voto] || C.gris }, duration: 0.16, ease: "none", immediateRender: false }, t);
        tl.fromTo(s.c, { attr: { r: R } }, { keyframes: [{ attr: { r: 13 }, duration: 0.09, ease: "power2.out" }, { attr: { r: R }, duration: 0.4, ease: "power2.inOut" }], immediateRender: false }, t);
      });
      tl.to("#marcador", { opacity: 1, duration: 0.2 }, barrido);
      [["#n-si", D.voto.si], ["#n-no", D.voto.no]].forEach(([sel, total]) => {
        const st = { v: 0 }, el = document.querySelector(sel);
        tl.fromTo(st, { v: 0 }, { v: total, duration: dB, ease: "sine.inOut", immediateRender: false, onUpdate: () => { el.textContent = Math.round(st.v); } }, barrido);
        tl.fromTo(sel, { scale: 0.55 }, { scale: 1, duration: dB, ease: "sine.inOut", immediateRender: false }, barrido);
      });
      tl.fromTo("#guion", { scale: 0.55 }, { scale: 1, duration: dB, ease: "sine.inOut", immediateRender: false }, barrido);
      const golpe = barrido + dB + 0.08;
      tl.fromTo("#chip", { opacity: 0, scale: 2.2, rotation: -8, textShadow: "-10px 0 rgba(255,0,80,.9), 10px 0 rgba(0,229,255,.9)" },
        { opacity: 1, scale: 1, rotation: 0, textShadow: "0px 0 rgba(255,0,80,0), 0px 0 rgba(0,229,255,0)", duration: 0.5, ease: "back.out(2.6)", immediateRender: false }, golpe);
      tl.fromTo("#chip-onda", { opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 7, duration: 0.9, ease: "expo.out", immediateRender: false }, golpe + 0.12);
      tl.fromTo("#por", { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.5, immediateRender: false }, golpe + 0.25);
      tl.fromTo("#marcador", { x: 0 }, { keyframes: [{ x: -9, duration: 0.05 }, { x: 7, duration: 0.05 }, { x: 0, duration: 0.25, ease: "elastic.out(1,.4)" }], immediateRender: false }, golpe);

      // 3 · los escaños se convierten en el embudo
      const M = 7.45;
      tl.to("#panel", { opacity: 0, x: -80, filter: "blur(10px)", duration: 0.45, ease: "power2.in" }, M - 0.1);
      tl.to("#stage", { x: 0, y: 0, scale: 1, duration: 1.0, ease: "power3.inOut" }, M);
      viajeros.forEach((v, k) => {
        const t = M + 0.05 + k * 0.006;
        tl.fromTo(v.s.c, { attr: { cx: v.s.x, cy: v.s.y, r: R, fill: VOTO[v.s.voto] || C.gris } },
          { attr: { cx: v.x, cy: v.y, r: RL, fill: v.fila === nLed.length - 1 ? C.si : C.ink }, duration: 1.0, ease: "power3.inOut", immediateRender: false }, t);
      });
      caen.forEach((s, k) => {
        const r2 = azar();
        tl.fromTo(s.c, { attr: { cy: s.y, r: R }, opacity: 1 }, { attr: { cy: s.y + 160 + r2 * 220, r: 0 }, opacity: 0, duration: 0.8 + r2 * 0.3, ease: "power2.in", immediateRender: false }, M + (s.x / 1920) * 0.35);
      });
      tl.to("#e-eye", { opacity: 1, duration: 0.01 }, M + 0.85);
      tl.fromTo("#e-eye", { y: 20 }, { y: 0, duration: 0.5 }, M + 0.85);
      cascada("#titulo2 .w", M + 0.9, 0.07);
      etiquetas.forEach((e, k) => tl.fromTo(e, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.5, immediateRender: false }, M + 1.0 + k * 0.08));
      cifras.forEach((el, k) => {
        const st = { v: 0 };
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, M + 1.05 + k * 0.08);
        tl.fromTo(st, { v: 0 }, { v: D.embudo[k], duration: 1.0, ease: "power2.out", immediateRender: false, onUpdate: () => { el.textContent = Math.round(st.v); } }, M + 1.05 + k * 0.08);
      });
      // el golpe verde: «32 son ley»
      const verdes = viajeros.filter(v => v.fila === nLed.length - 1);
      verdes.forEach((v, k) => tl.fromTo(v.s.c, { attr: { r: RL } }, { keyframes: [{ attr: { r: 12 }, duration: 0.12 }, { attr: { r: RL }, duration: 0.5, ease: "elastic.out(1,.4)" }], immediateRender: false }, M + 2.35 + k * 0.05));
      tl.fromTo("#titulo2 .ok", { scale: 1 }, { keyframes: [{ scale: 1.3, duration: 0.14 }, { scale: 1, duration: 0.55, ease: "elastic.out(1,.45)" }], immediateRender: false }, M + 2.35);

      // 4 · zoom a través del verde
      const Z = 11.05, verde = { x: FX + (nLed[nLed.length - 1] - 1) * FDX / 2, y: FY + (nLed.length - 1) * FDY }, ZS = 9;
      tl.to("#embudo-txt", { opacity: 0, filter: "blur(12px)", scale: 1.05, duration: 0.45, ease: "power2.in" }, Z);
      tl.to("#stage", { x: -ZS * (verde.x - CX), y: -ZS * (verde.y - CY), scale: ZS, duration: 0.75, ease: "power3.in" }, Z);
      tl.fromTo("#flash", { opacity: 0, scale: 0.6 }, { keyframes: [{ opacity: 1, scale: 1.1, duration: 0.35, ease: "power2.in" }, { opacity: 0, scale: 1.6, duration: 0.45, ease: "power2.out" }], immediateRender: false }, Z + 0.45);
      tl.to("#stage", { opacity: 0, duration: 0.01 }, Z + 0.8);

      // 5 · vuelo a través de las tarjetas
      const V = 11.8;
      document.querySelectorAll(".fcard").forEach((card, i) => {
        const t = V + i * 0.86, lado = i % 2 ? 1 : -1;
        tl.fromTo(card, { opacity: 0, z: -2600, rotationY: 30 * lado, x: 260 * lado, filter: "blur(18px)" },
          { opacity: 1, z: 0, rotationY: 0, x: 0, filter: "blur(0px)", duration: 0.62, ease: "power4.out", immediateRender: false }, t);
        tl.to(card, { rotationY: -3 * lado, duration: 0.1, ease: "sine.inOut" }, t + 0.62);
        if (i < 3) tl.to(card, { opacity: 0, z: 900, x: -520 * lado, rotationY: -22 * lado, filter: "blur(16px)", duration: 0.34, ease: "power3.in" }, t + 0.72);
        else tl.to(card, { opacity: 0, z: -400, scale: 0.85, filter: "blur(14px)", duration: 0.38, ease: "power2.in" }, t + 0.95);
        tl.fromTo(card.querySelector(".vis > *"), { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(2.2)", immediateRender: false }, t + 0.18);
      });
      tl.fromTo("#dipgrid i", { scale: 0 }, { scale: 1, duration: 0.3, stagger: 0.02, ease: "back.out(3)", immediateRender: false }, V + 0.86 + 0.25);

      // 6 · cierre: el logo llega desde la profundidad
      const F = 15.4;
      puntosLogo.forEach(({ p, blanco }, k) => {
        const a = azar(), b = azar(), c = azar();
        tl.fromTo(p, { opacity: 0, x: (a - 0.5) * 1300, y: (b - 0.5) * 700, z: -900 + c * 1300, scale: 0.4 },
          { opacity: 1, x: 0, y: 0, z: 0, scale: 1, duration: 1.15, ease: "expo.out", immediateRender: false }, F + (blanco ? 0.22 : k * 0.012));
      });
      tl.fromTo("#logo-bloom", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 1.4, ease: "sine.out", immediateRender: false }, F + 0.3);
      tl.fromTo(blancoLogo, { scale: 1 }, { keyframes: [{ scale: 1.9, duration: 0.14, ease: "power2.out" }, { scale: 1, duration: 0.6, ease: "elastic.out(1,.4)" }], immediateRender: false }, F + 1.05);
      tl.fromTo("#logo-onda", { opacity: 0.9, scale: 0.4 }, { opacity: 0, scale: 16, duration: 1.2, ease: "expo.out", immediateRender: false }, F + 1.08);
      decodificar(deco2, F + 0.75, 0.5, 0.04);
      cascada("#lema .w", F + 1.55, 0.045);
      tl.fromTo("#url", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, immediateRender: false }, F + 2.0);
      tl.fromTo("#url-line", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "expo.inOut", transformOrigin: "0% 50%" }, F + 2.15);
      tl.fromTo("#cierre", { scale: 0.97 }, { scale: 1, duration: 3.75, ease: "power1.out", immediateRender: false }, F);

      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
