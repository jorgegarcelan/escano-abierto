import React from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/fonts";
import datos from "./datos.json";

// Marca Marcador: fondo casi negro, cifras en matriz de puntos (Doto), texto en Geist, escaños redondos.
loadFont({ family: "Doto", url: staticFile("Doto.ttf"), weight: "100 900" });
loadFont({ family: "Geist", url: staticFile("Geist.ttf"), weight: "100 900" });

const C = {
  bg: "#08090B", surface: "#101216", ink: "#EEEEE8", muted: "#8B929C", line: "#1F232A",
  gris: "#3A404A", si: "#39D98A", no: "#FF5D52", abst: "#F5C542", nv: "#353B43",
};
const VOTO: Record<string, string> = { S: C.si, N: C.no, A: C.abst, X: C.nv };
const DOTO: React.CSSProperties = { fontFamily: "Doto", fontWeight: 900, fontVariantNumeric: "tabular-nums" };
const GEIST: React.CSSProperties = { fontFamily: "Geist" };

export const DURACION = 480; // 16 s a 30 fps

// Escenas: [inicio, duración] en fotogramas.
const S = { hemi: [0, 195], embudo: [195, 108], funciones: [303, 90], cierre: [393, 87] } as const;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const fundido = (f: number, dur: number, entrada = 8, salida = 8) =>
  Math.min(interpolate(f, [0, entrada], [0, 1], clamp), interpolate(f, [dur - salida, dur], [1, 0], clamp));
const fmt = (n: number) => Math.round(n).toLocaleString("es-ES");

// ---------------------------------------------------------------- hemiciclo con los 350 escaños reales
const { ancho: PW, alto: PH } = datos.plano;
const ASIENTOS = datos.asientos as [number, number, string, string][];
// Orden de aparición: del centro de la Mesa hacia fuera, como en la web.
const RANGO = (() => {
  const orden = ASIENTOS.map((a, i) => ({ i, d: Math.hypot(a[0] - PW / 2, a[1] - PH) })).sort((p, q) => p.d - q.d);
  const r = new Array(ASIENTOS.length);
  orden.forEach((o, k) => (r[o.i] = k));
  return r as number[];
})();
// El escaño destacado del logotipo: el más alto del centro.
const DESTACADO = ASIENTOS.reduce((m, a, i) =>
  Math.abs(a[0] - PW / 2) < 14 && a[1] < ASIENTOS[m][1] ? i : m, 0);

const Hemiciclo: React.FC<{ f: number; colorear: number | null; logo: boolean }> = ({ f, colorear, logo }) => (
  <svg viewBox={`-6 -6 ${PW + 12} ${PH + 12}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
    {ASIENTOS.map(([x, y, , v], i) => {
      const r = RANGO[i];
      const p = interpolate(f - r * 0.1, [0, 10], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
      let color = logo && i === DESTACADO ? "#FFFFFF" : C.gris;
      let extra = 0;
      if (colorear !== null) {
        const t = f - colorear - r * 0.12;
        if (t > 0) color = VOTO[v] ?? C.gris;
        extra = interpolate(t, [0, 4, 10], [0, 1.6, 0], clamp);
      }
      return <circle key={i} cx={x} cy={y} r={Math.max(0, 4.6 * p + extra)} fill={color} opacity={p} />;
    })}
  </svg>
);

const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = C.si }) => (
  <div style={{ ...GEIST, display: "flex", alignItems: "center", gap: 14, fontSize: 24, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, fontWeight: 500 }}>
    <span style={{ width: 12, height: 12, background: color, borderRadius: 2, boxShadow: `0 0 14px ${color}` }} />
    {children}
  </div>
);

// ---------------------------------------------------------------- 1 y 2: logo y una votación real
const EscenaHemiciclo: React.FC = () => {
  const f = useCurrentFrame();
  const [, dur] = S.hemi;
  const mover = interpolate(f, [70, 100], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const v = datos.voto;
  const cuenta = interpolate(f, [100, 150], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const texto = interpolate(f, [96, 112], [0, 1], clamp);
  const [a, m, d] = v.fecha.split("-").map(Number);
  const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return (
    <AbsoluteFill style={{ opacity: fundido(f, dur, 1, 10) }}>
      {/* El hemiciclo: centrado con la marca y, después, a la derecha con la votación. */}
      <div style={{
        position: "absolute", width: interpolate(mover, [0, 1], [880, 960]), height: interpolate(mover, [0, 1], [652, 710]),
        left: interpolate(mover, [0, 1], [520, 860]), top: interpolate(mover, [0, 1], [96, 200]),
      }}>
        <Hemiciclo f={f} colorear={f > 104 ? 104 : null} logo={f < 104} />
      </div>
      <div style={{ position: "absolute", width: "100%", top: 820, textAlign: "center", ...DOTO, fontSize: 104, color: C.ink, letterSpacing: "0.06em",
        opacity: interpolate(f, [26, 40, 66, 78], [0, 1, 1, 0], clamp), transform: `translateY(${interpolate(f, [26, 44], [24, 0], clamp)}px)` }}>
        ESCAÑO ABIERTO
      </div>
      <div style={{ position: "absolute", left: 120, top: 250, width: 700, opacity: texto, transform: `translateY(${(1 - texto) * 24}px)` }}>
        <Eyebrow>{v.tipo} · {d} {MES[m - 1]} {a}</Eyebrow>
        <div style={{ ...GEIST, fontSize: 64, fontWeight: 700, lineHeight: 1.08, color: C.ink, marginTop: 28, letterSpacing: "-0.01em" }}>
          Cada voto.<br />De cada diputado.
        </div>
        <div style={{ ...DOTO, fontSize: 128, color: C.ink, marginTop: 44, lineHeight: 1, whiteSpace: "nowrap" }}>
          {fmt(v.si * cuenta)} – {fmt(v.no * cuenta)}
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 30, opacity: interpolate(f, [150, 160], [0, 1], clamp) }}>
          <span style={{ ...GEIST, fontWeight: 700, fontSize: 26, letterSpacing: "0.06em", background: C.si, color: C.bg, padding: "8px 16px", borderRadius: 8 }}>APROBADA</span>
          <span style={{ ...GEIST, fontSize: 30, color: C.muted }}>por dos votos</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 3: el embudo de las leyes
const ETAPAS = ["Presentadas", "Admitidas a debate", "Con informe en comisión", "Aprobadas en el Congreso", "Pasaron por el Senado", "Son ley"];
const EscenaEmbudo: React.FC = () => {
  const f = useCurrentFrame();
  const [, dur] = S.embudo;
  const e = datos.embudo, max = e[0];
  return (
    <AbsoluteFill style={{ opacity: fundido(f, dur), padding: "130px 160px" }}>
      <Eyebrow color={C.abst}>Leyes de la legislatura</Eyebrow>
      <div style={{ ...GEIST, fontSize: 70, fontWeight: 700, color: C.ink, marginTop: 26, letterSpacing: "-0.01em" }}>
        De <span style={DOTO}>{e[0]}</span> propuestas, <span style={{ ...DOTO, color: C.si }}>{e[5]}</span> son ley.
      </div>
      <div style={{ marginTop: 64, display: "grid", gap: 22 }}>
        {e.map((n, k) => {
          const p = interpolate(f - 14 - k * 7, [0, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          const ultima = k === e.length - 1;
          return (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "460px 1fr 150px", alignItems: "center", gap: 28, opacity: interpolate(p, [0, 0.2], [0, 1], clamp) }}>
              <span style={{ ...GEIST, fontSize: 32, color: ultima ? C.ink : C.muted, fontWeight: ultima ? 600 : 400 }}>{ETAPAS[k]}</span>
              <span style={{ height: 26 }}>
                <span style={{ display: "block", height: "100%", width: `${Math.max((n / max) * 100 * p, 0.6)}%`, background: ultima ? C.si : C.ink, borderRadius: "0 6px 6px 0",
                  boxShadow: ultima ? `0 0 24px ${C.si}66` : "none" }} />
              </span>
              <span style={{ ...DOTO, fontSize: 56, color: ultima ? C.si : C.ink, textAlign: "right" }}>{fmt(n * p)}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 4: lo que se puede hacer
const FUNCIONES: [string, string, string][] = [
  ["¿Qué significa?", "Aprobar una proposición no de ley no cambia ninguna ley.", C.si],
  ["Tus diputados", "Elige tu provincia: cómo votan y qué preguntan.", "#2C7BC4"],
  ["Próximo pleno", "Lo que se va a votar, antes de que se vote.", C.abst],
  ["El congelador", `Leyes con el plazo de enmiendas ampliado ${datos.congelador} semanas.`, C.no],
];
const EscenaFunciones: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [, dur] = S.funciones;
  return (
    <AbsoluteFill style={{ opacity: fundido(f, dur), padding: "120px 150px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, alignContent: "center" }}>
      {FUNCIONES.map(([t, txt, color], k) => {
        const s = spring({ frame: f - 4 - k * 7, fps, config: { damping: 14, stiffness: 160 } });
        return (
          <div key={k} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 24, padding: "44px 48px", height: 300,
            opacity: s, transform: `translateY(${(1 - s) * 40}px) scale(${0.96 + 0.04 * s})`, boxShadow: "0 30px 80px rgba(0,0,0,.45)" }}>
            <Eyebrow color={color}>{t}</Eyebrow>
            <div style={{ ...GEIST, fontSize: 50, fontWeight: 650, color: C.ink, lineHeight: 1.15, marginTop: 28, letterSpacing: "-0.01em" }}>{txt}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 5: cierre
const Logo: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 0.56} viewBox="-1 -1 50 28">
    {[[22, 9], [15, 7], [8, 5]].flatMap(([r, n], fila) => Array.from({ length: n }, (_, k) => {
      const a = (k * Math.PI) / (n - 1);
      return <circle key={`${fila}-${k}`} cx={24 - r * Math.cos(a)} cy={24 - r * Math.sin(a)} r={2.3}
        fill={fila === 0 && k === (n - 1) / 2 ? "#FFFFFF" : "#5E646D"} />;
    }))}
  </svg>
);
const EscenaCierre: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 16 } });
  const t = interpolate(f, [10, 22], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: interpolate(f, [0, 8], [0, 1], clamp), alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ transform: `scale(${0.8 + 0.2 * s})`, opacity: s }}><Logo size={220} /></div>
      <div style={{ ...DOTO, fontSize: 124, color: C.ink, letterSpacing: "0.06em", marginTop: 36, opacity: s }}>ESCAÑO ABIERTO</div>
      <div style={{ ...GEIST, fontSize: 48, color: C.ink, fontWeight: 500, marginTop: 26, opacity: t, transform: `translateY(${(1 - t) * 16}px)` }}>
        Entender lo que se hace en el Congreso.
      </div>
      <div style={{ ...GEIST, fontSize: 36, color: C.muted, marginTop: 34, opacity: interpolate(f, [18, 28], [0, 1], clamp), letterSpacing: "0.02em" }}>
        escañoabierto.com
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- composición
export const Sneak: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 60% at 50% -12%, #1A2130 0%, ${C.bg} 62%)` }}>
    <Sequence from={S.hemi[0]} durationInFrames={S.hemi[1]}><EscenaHemiciclo /></Sequence>
    <Sequence from={S.embudo[0]} durationInFrames={S.embudo[1]}><EscenaEmbudo /></Sequence>
    <Sequence from={S.funciones[0]} durationInFrames={S.funciones[1]}><EscenaFunciones /></Sequence>
    <Sequence from={S.cierre[0]} durationInFrames={S.cierre[1]}><EscenaCierre /></Sequence>
  </AbsoluteFill>
);
