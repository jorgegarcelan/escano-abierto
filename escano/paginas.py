"""Páginas para compartir: una por diputado, votación, sesión e iniciativa, con su tarjeta Open Graph.

La web es una sola página que se mueve con el #fragmento, y los enlaces con # no tienen título ni imagen
propios cuando se comparten. Este módulo genera, para cada cosa que merece un enlace, una página estática
(site/diputado/<slug>/index.html…) con el título, la descripción y la imagen que leen WhatsApp, X o
Google, y que redirige a la vista de la web. La imagen (1200×630) se dibuja aquí con Pillow, con la
estética de la marca Marcador.

Las tarjetas solo llevan datos que no cambian (una votación ya votada, el escaño de un diputado), así
que se regeneran igual y solo se reescriben si su contenido cambia.
"""
from __future__ import annotations

import hashlib
import html
import os
import re
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape as esc_xml

from .config import SITIO
from .temas import NOMBRE as NOMBRE_TEMA, TEMAS

# Dirección pública de la web (p. ej. https://escanoabierto.es). Las redes necesitan URLs absolutas para
# las imágenes; sin ella, las páginas llevan rutas relativas a la raíz del sitio.
# En Vercel, si no se define, se usa el dominio de producción del proyecto.
URL_SITIO = (os.environ.get("ESCANO_URL_SITIO") or
             (f"https://{os.environ['VERCEL_PROJECT_PRODUCTION_URL']}" if os.environ.get("VERCEL_PROJECT_PRODUCTION_URL") else "")
             ).rstrip("/")
# Dibujar las tarjetas lleva unos minutos. La actualización diaria (GitHub Actions) no las necesita: las
# dibuja el despliegue en Vercel, que construye la web a partir del repositorio.
DIBUJAR = not os.environ.get("ESCANO_SIN_TARJETAS")
FUENTES = Path(__file__).parent / "fuentes"
W, H = 1200, 630
FONDO, TINTA, APAGADO, LINEA = (8, 9, 11), (238, 238, 232), (139, 146, 156), (31, 35, 42)
VOTO = {"S": (57, 217, 138), "N": (255, 93, 82), "A": (245, 197, 66), "X": (53, 59, 67)}
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
TIPO_EXP = {"121": "Proyecto de ley", "122": "Proposición de ley", "124": "Proposición de ley del Senado",
            "125": "Proposición de ley autonómica", "130": "Real decreto-ley", "161": "Proposición no de ley",
            "162": "Proposición no de ley", "172": "Interpelación urgente", "173": "Moción",
            "180": "Pregunta oral", "213": "Comparecencia del Gobierno", "219": "Comparecencia"}


# ---------------------------------------------------------------- utilidades

def slug(texto: str) -> str:
    """Igual que la web: sin tildes, en minúsculas y con guiones."""
    s = "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def legible(nombre: str) -> str:
    return " ".join(reversed(nombre.split(", "))) if ", " in nombre else nombre


def fecha_larga(iso: str) -> str:
    a, m, d = (int(x) for x in iso.split("-"))
    return f"{DIAS[date(a, m, d).weekday()]}, {d} de {MESES[m - 1]} de {a}"


def aprobada(v: dict) -> bool:
    return v["si"] > v["no"]


def resultado(v: dict) -> str:
    if v["tipo"] == "Convalidación RDL" and not v.get("titulo", "").startswith("Tramitar"):
        return "Convalidado" if aprobada(v) else "Derogado"
    if v["tipo"] == "Toma en consideración":
        return "Tomada en consideración" if aprobada(v) else "Rechazada"
    return "Aprobada" if aprobada(v) else "Rechazada"


def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def _mezcla(a, b, t: float):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def _escribir_si_cambia(ruta: Path, datos: bytes) -> bool:
    if ruta.exists() and ruta.read_bytes() == datos:
        return False
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(datos)
    return True


# ---------------------------------------------------------------- tarjetas

class Tarjeta:
    """Lienzo de 1200×630 con la cabecera y el pie de la marca."""

    def __init__(self):
        from PIL import Image, ImageDraw  # import perezoso: el resto del pipeline no necesita Pillow
        self.img = Image.new("RGB", (W, H), FONDO)
        self.d = ImageDraw.Draw(self.img)
        # Resplandor tenue arriba, como en la web.
        for i in range(160):
            t = 1 - i / 160
            self.d.line([(0, i), (W, i)], fill=_mezcla(FONDO, (24, 28, 36), t * t * .8))
        self._logo(64, 52)
        self.d.text((W - 64, H - 46), "Congreso de los Diputados · XV Legislatura", font=self.geist(20, 500),
                    fill=APAGADO, anchor="rs")

    def fuente(self, archivo: str, tam: int, peso: int):
        from PIL import ImageFont
        f = ImageFont.truetype(str(FUENTES / archivo), tam)
        try:
            ejes = f.get_variation_axes()
            f.set_variation_by_axes([peso if e["name"] in (b"Weight", "Weight") else e["default"] for e in ejes])
        except (OSError, AttributeError):
            pass
        return f

    def geist(self, tam: int, peso: int = 400):
        return self.fuente("Geist.ttf", tam, peso)

    def doto(self, tam: int):
        return self.fuente("Doto.ttf", tam, 900)

    def _logo(self, x: int, y: int):
        import math
        for i, (r, n) in enumerate([(22, 9), (15, 7), (8, 5)]):
            for k in range(n):
                a = math.radians(k * 180 / (n - 1))
                cx, cy = x + 24 - r * math.cos(a), y + 24 - r * math.sin(a)
                c = (255, 255, 255) if (i == 0 and k == (n - 1) // 2) else (94, 100, 109)
                self.d.ellipse([cx - 2.4, cy - 2.4, cx + 2.4, cy + 2.4], fill=c)
        self.d.text((x + 60, y + 25), "ESCAÑO ABIERTO", font=self.doto(28), fill=TINTA, anchor="lm")

    def texto(self, xy, texto: str, fuente, color, ancho: int, lineas: int, interlinea: float = 1.15) -> int:
        """Escribe `texto` partido en líneas de `ancho` px como mucho; devuelve la y final."""
        palabras, filas, fila = texto.split(), [], ""
        for p in palabras:
            prueba = (fila + " " + p).strip()
            if fuente.getlength(prueba) <= ancho:
                fila = prueba
            else:
                filas.append(fila)
                fila = p
        filas.append(fila)
        if len(filas) > lineas:
            filas = filas[:lineas]
            while filas[-1] and fuente.getlength(filas[-1] + "…") > ancho:
                filas[-1] = filas[-1].rsplit(" ", 1)[0]
            filas[-1] += "…"
        x, y = xy
        alto = round(fuente.size * interlinea)
        for f in filas:
            self.d.text((x, y), f, font=fuente, fill=color)
            y += alto
        return y

    def etiqueta(self, x: int, y: int, texto: str, fondo, color=(8, 9, 11)):
        f = self.geist(20, 700)
        w = f.getlength(texto) + 24
        self.d.rounded_rectangle([x, y, x + w, y + 36], radius=6, fill=fondo)
        self.d.text((x + 12, y + 18), texto, font=f, fill=color, anchor="lm")

    def hemiciclo(self, plano: dict, escanos: list[tuple], caja: tuple[int, int, int, int]):
        """escanos: [(x, y, color, radio_extra)] en coordenadas del plano oficial."""
        x0, y0, x1, y1 = caja
        esc = min((x1 - x0) / plano["ancho"], (y1 - y0) / plano["alto"])
        ox = x0 + ((x1 - x0) - plano["ancho"] * esc) / 2
        oy = y0 + ((y1 - y0) - plano["alto"] * esc) / 2
        r = 5.1 * esc
        for x, y, color, extra in escanos:
            cx, cy, rr = ox + x * esc, oy + y * esc, r + extra
            if extra:
                self.d.ellipse([cx - rr - 5, cy - rr - 5, cx + rr + 5, cy + rr + 5], fill=_mezcla(FONDO, color, .25))
            self.d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color)

    def png(self) -> bytes:
        import io
        b = io.BytesIO()
        self.img.convert("P", palette=1, colors=128).save(b, "PNG", optimize=True)  # 1 = ADAPTIVE
        return b.getvalue()


def _baja(d: list) -> bool:
    return len(d) > 8 and bool(d[8])


def _escanos_voto(v: dict, dips: list, plano: dict) -> list[tuple]:
    out = []
    for i, d in enumerate(dips):
        if d[5] is None or i >= len(v.get("v", "")):
            continue
        x = v["v"][i]
        if x != "-":
            out.append((d[5], d[6], VOTO.get(x, VOTO["X"]), 0))
    return out


def tarjeta_votacion(v: dict, dips: list, plano: dict) -> bytes:
    t = Tarjeta()
    a, m, d = v["fecha"].split("-")
    t.d.text((64, 150), f"VOTACIÓN · {int(d)} {MESES[int(m) - 1].upper()} {a}", font=t.geist(21, 600), fill=APAGADO)
    y = t.texto((64, 190), v["titulo"], t.geist(46, 650), TINTA, 560, 4, 1.12)
    t.etiqueta(64, max(y + 18, 400), resultado(v).upper(), VOTO["S"] if aprobada(v) else VOTO["N"])
    t.d.text((64, 560), f"{v['si']} – {v['no']}", font=t.doto(96), fill=TINTA, anchor="ls")
    if plano.get("ancho"):
        t.hemiciclo(plano, _escanos_voto(v, dips, plano), (660, 130, 1150, 520))
        t.d.text((905, 548), f"Sí {v['si']} · No {v['no']} · Abst. {v['abst']} · No votan {v['novota']}",
                 font=t.geist(19, 500), fill=APAGADO, anchor="ms")
    return t.png()


def tarjeta_diputado(i: int, dips: list, grupos: dict, plano: dict) -> bytes:
    t = Tarjeta()
    n, g, circ, form = dips[i][:4]
    nombre_g = grupos.get(g, {}).get("nombre", g)
    t.d.text((64, 150), "DIPUTADO · " + nombre_g.upper(), font=t.geist(21, 600), fill=APAGADO)
    y = t.texto((64, 190), legible(n), t.geist(62, 700), TINTA, 560, 3, 1.05)
    linea = " · ".join(x for x in (circ, f"lista de {form}" if form else "") if x)
    t.texto((64, y + 14), linea, t.geist(26, 500), APAGADO, 560, 2)
    if plano.get("ancho") and dips[i][5] is not None:
        escanos = []
        yo = dips[i]
        for j, d in enumerate(dips):
            # Solo los diputados de hoy; a quien ya no lo es se le pinta en su antiguo escaño.
            if d[5] is None or (j != i and (_baja(d) or (_baja(yo) and (d[5], d[6]) == (yo[5], yo[6])))):
                continue
            base = _hex(grupos.get(d[1], {}).get("color", "#8A8F98"))
            escanos.append((d[5], d[6], (255, 255, 255) if j == i else _mezcla(FONDO, base, .38), 4 if j == i else 0))
        escanos.sort(key=lambda e: e[3])  # el suyo, encima
        t.hemiciclo(plano, escanos, (660, 130, 1150, 520))
        t.d.text((905, 548), "Su escaño en el hemiciclo", font=t.geist(19, 500), fill=APAGADO, anchor="ms")
    return t.png()


def tarjeta_sesion(s: dict, votos: list, dips: list, plano: dict) -> bytes:
    t = Tarjeta()
    t.d.text((64, 150), f"{s['organo'].upper()} · {fecha_larga(s['fecha']).upper()}", font=t.geist(21, 600), fill=APAGADO)
    titulo = s.get("titular") or (re.split(r"(?<=[.!?])\s", s.get("resumen") or "")[0]) or s.get("sesion", "")
    y = t.texto((64, 190), titulo, t.geist(48, 650), TINTA, 560, 4, 1.12)
    t.d.text((64, 560), f"{len(votos)} votaciones · {len(s.get('puntos', []))} asuntos", font=t.geist(28, 600),
             fill=TINTA, anchor="ls")
    if votos and plano.get("ancho"):
        dest = min(votos, key=lambda v: abs(v["si"] - v["no"]))
        t.hemiciclo(plano, _escanos_voto(dest, dips, plano), (660, 130, 1150, 520))
        t.d.text((905, 548), f"La más ajustada: {dest['si']} – {dest['no']}", font=t.geist(19, 500), fill=APAGADO,
                 anchor="ms")
    return t.png()


def tarjeta_iniciativa(exp: str, titulo: str, votos: list, dips: list, plano: dict, ley: dict | None = None) -> bytes:
    t = Tarjeta()
    tipo = ley["tipo"] + (" orgánica" if ley.get("organica") else "") if ley else TIPO_EXP.get(exp[:3], "Iniciativa")
    t.d.text((64, 150), f"{tipo.upper()} · {exp}", font=t.geist(21, 600), fill=APAGADO)
    y = t.texto((64, 190), titulo, t.geist(46, 650), TINTA, 560, 4, 1.12)
    if votos:
        ult = votos[-1]
        t.etiqueta(64, max(y + 18, 400), resultado(ult).upper(), VOTO["S"] if aprobada(ult) else VOTO["N"])
        t.d.text((64, 560), f"{ult['si']} – {ult['no']}", font=t.doto(96), fill=TINTA, anchor="ls")
        if plano.get("ancho"):
            t.hemiciclo(plano, _escanos_voto(ult, dips, plano), (660, 130, 1150, 520))
    return t.png()


def _etapas(t: "Tarjeta", ley: dict, x: int, y: int, ancho: int):
    """Las seis etapas de la tramitación en una fila de puntos, con la alcanzada resaltada."""
    paso = ancho / (len(ETAPAS) - 1)
    corta = ley["estado"] not in ("en trámite", "aprobada")
    t.d.line([(x, y), (x + paso * min(ley["etapa"], 5), y)], fill=TINTA, width=3)
    t.d.line([(x + paso * ley["etapa"], y), (x + ancho, y)], fill=LINEA, width=3)
    for k, nombre in enumerate(ETAPAS):
        cx = x + paso * k
        on, cortada = k <= ley["etapa"], corta and k == ley["etapa"] + 1
        color = TINTA if on else (VOTO["N"] if cortada else (94, 100, 109))
        r = 11 if on else 9
        t.d.ellipse([cx - r, y - r, cx + r, y + r], fill=color if on else FONDO, outline=color, width=3)
        t.d.text((cx, y + 30), nombre, font=t.geist(17, 600 if on else 500), fill=TINTA if on else APAGADO, anchor="ma")


def tarjeta_ley(ley: dict) -> bytes:
    t = Tarjeta()
    tipo = ley["tipo"] + (" orgánica" if ley.get("organica") else "")
    t.d.text((64, 150), f"{tipo.upper()} · {ley['exp']}", font=t.geist(21, 600), fill=APAGADO)
    y = t.texto((64, 190), ley["titulo"], t.geist(50, 650), TINTA, 1070, 3, 1.12)
    color = VOTO["S"] if ley["estado"] == "aprobada" else VOTO["N"] if ley["estado"] in ("rechazada", "inadmitida") \
        else (245, 197, 66) if ley["estado"] == "en trámite" else (139, 146, 156)
    t.etiqueta(64, max(y + 18, 380), ESTADO_LEY.get(ley["estado"], ley["estado"]).upper(), color)
    if ley["estado"] == "en trámite" and ley.get("ampliaciones", 0) >= 8:
        t.d.text((64 + 24 + t.geist(20, 700).getlength(ESTADO_LEY["en trámite"].upper()) + 20, max(y + 18, 380) + 18),
                 f"Plazo de enmiendas ampliado {ley['ampliaciones']} veces", font=t.geist(22, 500), fill=APAGADO, anchor="lm")
    _etapas(t, ley, 120, 500, 960)
    return t.png()


def tarjeta_semana(sem: dict, vs: list, votos_por_id: dict, dips: list, plano: dict) -> bytes:
    t = Tarjeta()
    a, b = sem["desde"].split("-"), sem["hasta"].split("-")
    rango = (f"{int(a[2])}–{int(b[2])} {MESES[int(b[1]) - 1].upper()} {b[0]}" if a[1] == b[1]
             else f"{int(a[2])} {MESES[int(a[1]) - 1][:3].upper()} – {int(b[2])} {MESES[int(b[1]) - 1][:3].upper()} {b[0]}")
    t.d.text((64, 150), f"LA SEMANA EN EL CONGRESO · {rango}", font=t.geist(21, 600), fill=APAGADO)
    t.texto((64, 190), sem["titular"], t.geist(46, 650), TINTA, 560, 5, 1.12)
    t.d.text((64, 560), f"{len(vs)} votaciones · {sem['aprobadas']} aprobadas · {len(vs) - sem['aprobadas']} rechazadas",
             font=t.geist(26, 600), fill=TINTA, anchor="ls")
    dest = votos_por_id.get((sem["ajustadas"] or [None])[0])
    if dest and plano.get("ancho"):
        t.hemiciclo(plano, _escanos_voto(dest, dips, plano), (660, 130, 1150, 520))
        t.d.text((905, 548), f"La más ajustada: {dest['si']} – {dest['no']}", font=t.geist(19, 500), fill=APAGADO, anchor="ms")
    return t.png()


def tarjeta_provincia(circ: str, ids: list[int], dips: list, grupos: dict, plano: dict) -> bytes:
    t = Tarjeta()
    t.d.text((64, 150), "TUS DIPUTADOS", font=t.geist(21, 600), fill=APAGADO)
    y = t.texto((64, 190), circ, t.geist(66, 700), TINTA, 560, 2, 1.05)
    reparto = Counter(dips[i][1] for i in ids)
    t.texto((64, y + 14), f"{len(ids)} {'diputado' if len(ids) == 1 else 'diputados'}: " +
            ", ".join(f"{g} {n}" for g, n in reparto.most_common()), t.geist(28, 500), APAGADO, 560, 3)
    if plano.get("ancho"):
        esc = []
        for j, d in enumerate(dips):
            if d[5] is None or _baja(d):
                continue
            base = _hex(grupos.get(d[1], {}).get("color", "#8A8F98"))
            esc.append((d[5], d[6], base if j in ids else _mezcla(FONDO, (94, 100, 109), .55), 3 if j in ids else 0))
        esc.sort(key=lambda e: e[3])
        t.hemiciclo(plano, esc, (660, 130, 1150, 520))
    return t.png()


def tarjeta_tema(nombre: str, votos: list, leyes: list, dips: list, plano: dict) -> bytes:
    t = Tarjeta()
    t.d.text((64, 150), "SEGUIR UN TEMA EN EL CONGRESO", font=t.geist(21, 600), fill=APAGADO)
    y = t.texto((64, 190), nombre, t.geist(62, 700), TINTA, 560, 3, 1.05)
    vivas = sum(l["estado"] == "en trámite" for l in leyes)
    t.texto((64, y + 16), f"{len(votos)} votaciones · {len(leyes)} leyes, {vivas} en trámite", t.geist(28, 500), APAGADO, 560, 2)
    if votos and plano.get("ancho"):
        ult = max(votos, key=lambda v: (v["fecha"], v["id"]))
        t.hemiciclo(plano, _escanos_voto(ult, dips, plano), (660, 130, 1150, 520))
        t.d.text((905, 548), f"La última: {corto(ult['titulo'], 38)}", font=t.geist(19, 500), fill=APAGADO, anchor="ms")
    return t.png()


def tarjeta_portada(plano: dict, dips: list) -> bytes:
    t = Tarjeta()
    t.d.text((64, 250), "ESCAÑO", font=t.doto(120), fill=TINTA)
    t.d.text((64, 370), "ABIERTO", font=t.doto(120), fill=TINTA)
    t.d.text((68, 520), "Qué se dijo en el Congreso y cómo se votó.", font=t.geist(30, 500), fill=APAGADO)
    if plano.get("ancho"):
        grises = [(d[5], d[6], (94, 100, 109), 0) for d in dips if d[5] is not None and not _baja(d)]
        t.hemiciclo(plano, grises, (660, 130, 1150, 520))
    return t.png()


# ---------------------------------------------------------------- páginas

def _pagina(ruta: str, hashweb: str, titulo: str, desc: str, imagen: str, feed: bool = False) -> bytes:
    raiz = "../../"
    url = f"{URL_SITIO}/{ruta}/" if URL_SITIO else f"/{ruta}/"
    img = f"{URL_SITIO}/{imagen}" if URL_SITIO else f"/{imagen}"
    e = lambda s: html.escape(s, quote=True)
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo)} · Escaño Abierto</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{e(url)}">
<link rel="alternate" type="application/rss+xml" title="{e(titulo)} · Escaño Abierto" href="{e(_abs(ruta + '/rss.xml') if feed else _abs('rss.xml'))}">
<meta property="og:site_name" content="Escaño Abierto">
<meta property="og:type" content="article">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#08090B">
<link rel="icon" href="{raiz}marcas/marcador-favicon.svg" type="image/svg+xml">
<meta http-equiv="refresh" content="0; url={raiz}#{hashweb}">
<script>location.replace("{raiz}" + location.search + "#{hashweb}");</script>
<style>body{{margin:0;padding:48px 24px;background:#08090B;color:#EEEEE8;font:16px/1.5 system-ui,sans-serif}}a{{color:#EEEEE8}}</style>
</head>
<body>
<h1>{e(titulo)}</h1>
<p>{e(desc)}</p>
<p><a href="{raiz}#{hashweb}">Abrir en Escaño Abierto</a></p>
</body>
</html>
""".encode()


# ---------------------------------------------------------------- RSS

def _abs(ruta: str) -> str:
    return f"{URL_SITIO}/{ruta}" if URL_SITIO else f"/{ruta}"


def _fecha_rss(iso: str) -> str:
    """RFC 822, a mediodía en Madrid (el Congreso no publica la hora de cada cosa)."""
    from datetime import datetime
    from email.utils import format_datetime
    from zoneinfo import ZoneInfo
    return format_datetime(datetime.fromisoformat(iso + "T12:00").replace(tzinfo=ZoneInfo("Europe/Madrid")))


def rss(ruta: str, titulo: str, desc: str, enlace: str, entradas: list[dict], maximo: int = 60) -> bytes:
    """Un canal RSS 2.0. entradas: [{id, fecha, titulo, desc, enlace}]; las más recientes primero.

    No lleva lastBuildDate: el mismo contenido da el mismo fichero y el repositorio no cambia en balde.
    """
    entradas = sorted(entradas, key=lambda e: (e["fecha"], e["id"]), reverse=True)[:maximo]
    items = "".join(
        f"<item><title>{esc_xml(e['titulo'])}</title><link>{esc_xml(_abs(e['enlace']))}</link>"
        f"<guid isPermaLink=\"false\">escano-abierto:{esc_xml(e['id'])}</guid>"
        f"<pubDate>{_fecha_rss(e['fecha'])}</pubDate><description>{esc_xml(e['desc'])}</description></item>\n"
        for e in entradas)
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n'
            f"<title>{esc_xml(titulo)}</title><link>{esc_xml(_abs(enlace))}</link>"
            f"<description>{esc_xml(desc)}</description><language>es-ES</language>"
            f'<atom:link href="{esc_xml(_abs(ruta))}" rel="self" type="application/rss+xml"/>\n'
            f"{items}</channel></rss>\n").encode()


def _entrada_voto(v: dict) -> dict:
    return {"id": f"votacion-{v['id']}", "fecha": v["fecha"], "enlace": f"votacion/{v['id']}/",
            "titulo": f"{resultado(v)}: {v['titulo']}",
            "desc": f"{v['tipo']}. Sí {v['si']} · No {v['no']} · Abstenciones {v['abst']} · No votan {v['novota']}."}


def _entradas_diputado(i: int, d: list, votaciones: list, ivs: list, fecha_ses: dict) -> list[dict]:
    """Solo lo que merece aviso: votos distintos de los de su grupo e intervenciones analizadas."""
    out, voto = [], {"S": "sí", "N": "no", "A": "abstención"}
    for v in votaciones:
        x, gp = (v.get("v") or "-" * (i + 1))[i:i + 1], v.get("grupos", {}).get(d[1])
        if x in voto and gp in voto and x != gp:
            out.append({"id": f"dis-{v['id']}-{slug(d[0])}", "fecha": v["fecha"], "enlace": f"votacion/{v['id']}/",
                        "titulo": f"Vota {voto[x]}, su grupo {voto[gp]}: {v['titulo']}",
                        "desc": f"{resultado(v)} por {v['si']} a {v['no']}. Votó distinto de la mayoría de su grupo."})
    for n, iv in ivs:
        f = fecha_ses.get(iv["s"])
        if f:
            out.append({"id": f"iv-{iv['s']}-{n}", "fecha": f, "enlace": f"sesion/{slug(iv['s'])}/",
                        "titulo": "Interviene: " + re.sub(r"^P\d+ · ", "", iv["item"]),
                        "desc": iv["resumen"] + (f" «{iv['cita']}»" if iv.get("cita") else "")})
    return out


ESTADO_LEY = {"en trámite": "En trámite", "aprobada": "Es ley", "rechazada": "Rechazada", "retirada": "Retirada",
              "decaída": "Decaída", "subsumida": "Subsumida", "inadmitida": "Inadmitida"}
ETAPAS = ["Presentada", "Admitida", "En comisión", "Aprobada en el Congreso", "Senado", "Ley"]


def corto(t: str, n: int = 140) -> str:
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"


def _entradas_tramitacion(ley: dict, ruta: str) -> list[dict]:
    """Cada fase nueva de la tramitación es una entrada: «Pasa a Comisión de Justicia · Informe»."""
    out = []
    for k, f in enumerate(ley["fases"]):
        if not f["desde"]:
            continue
        que = f["fase"] if f["organo"] == "Concluido" else " · ".join(x for x in (f["organo"], f["fase"]) if x)
        out.append({"id": f"fase-{ley['exp']}-{k}", "fecha": f["desde"], "enlace": ruta + "/",
                    "titulo": ("Termina su tramitación: " if f["organo"] == "Concluido" else "Nueva fase: ") + que,
                    "desc": f"{corto(ley['titulo'], 200)}. Desde el {fecha_larga(f['desde'])}."})
    return out


def generar(salida: dict, plano: dict) -> dict:
    """Escribe las páginas, las tarjetas, los canales RSS, sitemap.xml y robots.txt. Devuelve cuántos ha escrito."""
    datos = salida["datos"]
    dips, grupos = datos["diputados"], datos["grupos"]
    escritas = {"paginas": 0, "tarjetas": 0, "rss": 0}
    urls = [""]

    def poner(ruta: str, hashweb: str, titulo: str, desc: str, tarjeta, clave: str = "") -> None:
        """clave: resumen de lo que dibuja la tarjeta cuando puede cambiar (una ley que avanza, la semana en
        curso). Va en el nombre del fichero, así que un cambio da una tarjeta nueva y las redes no se quedan
        con la vieja en caché."""
        imagen = f"og/{ruta}-{hashlib.sha1(clave.encode()).hexdigest()[:8]}.png" if clave else f"og/{ruta}.png"
        feed = ruta.startswith(("diputado/", "iniciativa/", "tema/"))
        escritas["paginas"] += _escribir_si_cambia(SITIO / ruta / "index.html",
                                                   _pagina(ruta, hashweb, titulo, desc, imagen, feed))
        destino = SITIO / imagen
        # Una tarjeta ya dibujada no se vuelve a dibujar: su contenido no cambia.
        if DIBUJAR and not destino.exists():
            escritas["tarjetas"] += _escribir_si_cambia(destino, tarjeta())
            if clave:
                for vieja in destino.parent.glob(ruta.rsplit("/", 1)[-1] + "-*.png"):
                    if vieja != destino:
                        vieja.unlink()
        urls.append(ruta + "/")

    for i, d in enumerate(dips):
        n, g = d[0], d[1]
        nombre_g = grupos.get(g, {}).get("nombre", g)
        desc = f"{nombre_g}{', por ' + d[2] if d[2] else ''}. Cómo vota, cuánto participa, sus intervenciones y comisiones."
        poner(f"diputado/{slug(n)}", f"diputado-{slug(n)}", legible(n), desc,
              lambda i=i: tarjeta_diputado(i, dips, grupos, plano))

    votos_por_id = {v["id"]: v for v in datos["votaciones"]}
    for v in datos["votaciones"]:
        desc = (f"{resultado(v)} por {v['si']} votos a favor y {v['no']} en contra ({v['abst']} abstenciones). "
                f"{v['tipo']}, {fecha_larga(v['fecha'])}.")
        poner(f"votacion/{v['id']}", f"votacion-{v['id']}", v["titulo"], desc,
              lambda v=v: tarjeta_votacion(v, dips, plano))

    for s in datos["sesiones"]:
        vs = [votos_por_id[x] for p in s.get("puntos", []) for x in p.get("votos", []) if x in votos_por_id]
        titulo = f"{s['organo']}, {fecha_larga(s['fecha'])}"
        desc = s.get("titular") or (s.get("resumen") or "")[:220] or f"{len(s.get('puntos', []))} asuntos en el orden del día."
        poner(f"sesion/{slug(s['id'])}", f"sesion-{s['id']}", titulo, desc,
              lambda s=s, vs=vs: tarjeta_sesion(s, vs, dips, plano))

    leyes = {l["exp"]: l for l in (salida.get("leyes") or {}).get("iniciativas", [])}
    iniciativas: dict[str, dict] = {}
    for v in sorted(datos["votaciones"], key=lambda v: (v["fecha"], v["id"])):
        if v.get("exp"):
            iniciativas.setdefault(v["exp"], {"titulo": re.sub(r"\s*\([^()]*\)\s*$", "", v["titulo"]), "votos": []})["votos"].append(v)
    for exp, ley in leyes.items():
        ini = iniciativas.setdefault(exp, {"votos": []})
        ini["titulo"], ini["ley"] = corto(ley["titulo"]), ley
    for exp, ini in iniciativas.items():
        ley, votos = ini.get("ley"), ini["votos"]
        partes = [f"{ley['tipo'] if ley else TIPO_EXP.get(exp[:3], 'Iniciativa')} {exp}."]
        if ley:
            partes.append(f"{ESTADO_LEY.get(ley['estado'], ley['estado'])}: {ley['situacion'] if ley['estado'] == 'en trámite' else ley['resultado']}.")
        if votos:
            ult = votos[-1]
            partes.append(f"Última votación: {resultado(ult).lower()} por {ult['si']} a {ult['no']} el {fecha_larga(ult['fecha'])}.")
        clave = f"{ley['estado']}|{ley['etapa']}|{votos[-1]['id'] if votos else ''}" if ley else ""
        poner(f"iniciativa/{exp.replace('/', '-')}", f"iniciativa-{exp.replace('/', '-')}", ini["titulo"], " ".join(partes),
              lambda exp=exp, ini=ini: (tarjeta_iniciativa(exp, ini["titulo"], ini["votos"], dips, plano, ini.get("ley"))
                                        if ini["votos"] else tarjeta_ley(ini["ley"])), clave)

    for sem in salida.get("semanas", []):
        vs = [votos_por_id[x] for x in sem["votaciones"] if x in votos_por_id]
        desc = (f"{len(vs)} votaciones en el Pleno: {sem['aprobadas']} aprobadas y {len(vs) - sem['aprobadas']} rechazadas. "
                f"{sem['discrepancias']} votos distintos al del propio grupo." + (f" {len(sem['leyes'])} leyes se han movido." if sem["leyes"] else ""))
        clave = f"{sem['titular']}|{len(vs)}|{sem['aprobadas']}|{sem['ajustadas'][:1]}"
        poner(f"semana/{sem['id']}", f"semana-{sem['id']}", sem["titular"], desc,
              lambda sem=sem, vs=vs: tarjeta_semana(sem, vs, votos_por_id, dips, plano), clave)

    # ---- sobre el proyecto (con la tarjeta de la portada)
    escritas["paginas"] += _escribir_si_cambia(SITIO / "sobre" / "index.html", _pagina(
        "sobre", "sobre", "Sobre Escaño Abierto",
        "Entender lo que se hace en el Congreso: qué se vota, quién lo decide y cómo, con datos oficiales. "
        "Un proyecto independiente de Jorge Garcelán.", "og/portada.png"))
    urls.append("sobre/")

    # ---- provincias: los diputados de cada circunscripción
    por_circ: dict[str, list[int]] = {}
    for i, d in enumerate(dips):
        if d[2] and not _baja(d):
            por_circ.setdefault(d[2], []).append(i)
    for circ, ids in por_circ.items():
        reparto = Counter(dips[i][1] for i in ids)
        desc = (f"{len(ids)} {'diputado' if len(ids) == 1 else 'diputados'} ({', '.join(f'{g} {n}' for g, n in reparto.most_common())}). "
                "Cómo votan, cuándo se apartan de su grupo, qué preguntan al Gobierno y en qué comisiones están.")
        poner(f"provincia/{slug(circ)}", f"provincia-{slug(circ)}", f"Los diputados de {circ}", desc,
              lambda circ=circ, ids=ids: tarjeta_provincia(circ, ids, dips, grupos, plano),
              "|".join(dips[i][0] for i in ids))

    # ---- temas: página, tarjeta y RSS de cada uno
    agenda = salida.get("agenda") or {}
    for tema, nombre, _ in TEMAS:
        vs = [v for v in datos["votaciones"] if tema in v.get("tm", [])]
        ls = [l for l in leyes.values() if tema in l.get("tm", [])]
        ruta = f"tema/{tema}"
        desc = (f"Todo lo que pasa en el Congreso sobre {nombre.lower()}: {len(vs)} votaciones y {len(ls)} leyes "
                f"en la legislatura, y lo que viene en el próximo pleno. Síguelo por RSS.")
        ult = max(vs, key=lambda v: (v["fecha"], v["id"]))["id"] if vs else ""
        poner(ruta, f"tema-{tema}", f"{nombre} en el Congreso", desc,
              lambda nombre=nombre, vs=vs, ls=ls: tarjeta_tema(nombre, vs, ls, dips, plano), f"{len(vs)}|{len(ls)}|{ult}")
        ents = [_entrada_voto(v) for v in vs]
        for l in ls:
            ents += _entradas_tramitacion(l, f"iniciativa/{l['exp'].replace('/', '-')}")
        for pl in agenda.get("plenos", []):
            for x in pl["puntos"]:
                if tema in x.get("tm", []):
                    ents.append({"id": f"od-{pl['sesion']}-{x['n']}", "fecha": agenda.get("generado") or x["fecha"],
                                 "enlace": "", "titulo": f"En el pleno del {fecha_larga(x['fecha'])}: {corto(x['titulo'], 150)}",
                                 "desc": f"{x['seccion']}. " + (f"{x['autor']} pregunta a {x['a']}." if x.get("autor") else "")})
        escritas["rss"] += _escribir_si_cambia(SITIO / ruta / "rss.xml", rss(
            f"{ruta}/rss.xml", f"{nombre} · Escaño Abierto", desc, ruta + "/", ents))

    # ---- RSS: general, por diputado (solo lo destacable) y por iniciativa
    from .construir import _clave_apellidos
    fecha_ses = {x["id"]: x["fecha"] for x in datos["sesiones"]}
    # Identificador estable de cada intervención: sesión, orador y su número de turno en esa sesión.
    turno: dict[tuple, int] = {}
    ivs = []
    for iv in salida.get("intervenciones", []):
        k = (iv["s"], iv["orador"])
        turno[k] = turno.get(k, 0) + 1
        ivs.append((f"{slug(iv['orador'])}-{turno[k]}", iv))
    general = [_entrada_voto(v) for v in datos["votaciones"]]
    for x in datos["sesiones"]:
        if x.get("titular") or x.get("resumen"):
            general.append({"id": f"sesion-{x['id']}", "fecha": x["fecha"], "enlace": f"sesion/{slug(x['id'])}/",
                            "titulo": f"{x['organo']}, {fecha_larga(x['fecha'])}",
                            "desc": x.get("titular") or x["resumen"][:400]})
    for sem in salida.get("semanas", [])[:-1]:  # la semana en curso aún no ha terminado
        general.append({"id": f"semana-{sem['id']}", "fecha": sem["hasta"], "enlace": f"semana/{sem['id']}/",
                        "titulo": f"La semana en el Congreso: {sem['titular']}",
                        "desc": f"Del {fecha_larga(sem['desde'])} al {fecha_larga(sem['hasta'])}. {len(sem['votaciones'])} votaciones, "
                                f"{sem['aprobadas']} aprobadas."})
    escritas["rss"] = _escribir_si_cambia(SITIO / "rss.xml", rss(
        "rss.xml", "Escaño Abierto", "Votaciones, sesiones y resumen semanal del Congreso de los Diputados.", "", general))

    por_apellidos: dict[str, list[int]] = {}
    for i, d in enumerate(dips):
        por_apellidos.setdefault(_clave_apellidos(d[0].split(",")[0]), []).append(i)
    ivs_dip: dict[int, list] = {}
    for n, iv in ivs:
        c = por_apellidos.get(_clave_apellidos(iv["orador"]), [])
        if len(c) == 1:
            ivs_dip.setdefault(c[0], []).append((n, iv))
    for i, d in enumerate(dips):
        ruta = f"diputado/{slug(d[0])}"
        escritas["rss"] += _escribir_si_cambia(SITIO / ruta / "rss.xml", rss(
            f"{ruta}/rss.xml", f"{legible(d[0])} · Escaño Abierto",
            f"Cuándo vota distinto de su grupo y qué dice en sus intervenciones.", ruta + "/",
            _entradas_diputado(i, d, datos["votaciones"], ivs_dip.get(i, []), fecha_ses)))

    debates: dict[str, list] = {}
    for x in datos["sesiones"]:
        for k, p in enumerate(x.get("puntos", [])):
            if p.get("exp") and p.get("estado") != "sin-ds":
                debates.setdefault(p["exp"], []).append({
                    "id": f"debate-{x['id']}-{k}", "fecha": x["fecha"], "enlace": f"sesion/{slug(x['id'])}/",
                    "titulo": f"Debate en {x['organo']}: {p['titulo']}", "desc": f"{p.get('tipo', '')}. {fecha_larga(x['fecha'])}.".lstrip(". ")})
    for exp, ini in iniciativas.items():
        ruta = f"iniciativa/{exp.replace('/', '-')}"
        ents = [_entrada_voto(v) for v in ini["votos"]] + debates.get(exp, [])
        if ini.get("ley"):
            ents += _entradas_tramitacion(ini["ley"], ruta)
        escritas["rss"] += _escribir_si_cambia(SITIO / ruta / "rss.xml", rss(
            f"{ruta}/rss.xml", f"{ini['titulo']} · Escaño Abierto",
            f"{TIPO_EXP.get(exp[:3], 'Iniciativa')} {exp}: tramitación, debates y votaciones.", ruta + "/", ents))

    portada = SITIO / "og" / "portada.png"
    if DIBUJAR and not portada.exists():
        escritas["tarjetas"] += _escribir_si_cambia(portada, tarjeta_portada(plano, dips))

    base = URL_SITIO or ""
    sitemap = "".join(f"<url><loc>{esc_xml(base + '/' + u)}</loc></url>" for u in urls)
    _escribir_si_cambia(SITIO / "sitemap.xml", (
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + sitemap + "</urlset>\n").encode())
    robots = "User-agent: *\nAllow: /\n" + (f"Sitemap: {URL_SITIO}/sitemap.xml\n" if URL_SITIO else "")
    _escribir_si_cambia(SITIO / "robots.txt", robots.encode())
    return escritas
