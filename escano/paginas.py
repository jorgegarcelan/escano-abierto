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

import html
import os
import re
import unicodedata
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape as esc_xml

from .config import SITIO

# Dirección pública de la web (p. ej. https://escanoabierto.es). Las redes necesitan URLs absolutas para
# las imágenes; sin ella, las páginas llevan rutas relativas a la raíz del sitio.
URL_SITIO = os.environ.get("ESCANO_URL_SITIO", "").rstrip("/")
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
    if v["tipo"] == "Convalidación RDL":
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
        for j, d in enumerate(dips):
            if d[5] is None:
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


def tarjeta_iniciativa(exp: str, titulo: str, votos: list, dips: list, plano: dict) -> bytes:
    t = Tarjeta()
    t.d.text((64, 150), f"{TIPO_EXP.get(exp[:3], 'Iniciativa').upper()} · {exp}", font=t.geist(21, 600), fill=APAGADO)
    y = t.texto((64, 190), titulo, t.geist(46, 650), TINTA, 560, 4, 1.12)
    if votos:
        ult = votos[-1]
        t.etiqueta(64, max(y + 18, 400), resultado(ult).upper(), VOTO["S"] if aprobada(ult) else VOTO["N"])
        t.d.text((64, 560), f"{ult['si']} – {ult['no']}", font=t.doto(96), fill=TINTA, anchor="ls")
        if plano.get("ancho"):
            t.hemiciclo(plano, _escanos_voto(ult, dips, plano), (660, 130, 1150, 520))
    return t.png()


def tarjeta_portada(plano: dict, dips: list) -> bytes:
    t = Tarjeta()
    t.d.text((64, 250), "ESCAÑO", font=t.doto(120), fill=TINTA)
    t.d.text((64, 370), "ABIERTO", font=t.doto(120), fill=TINTA)
    t.d.text((68, 520), "Qué se dijo en el Congreso y cómo se votó.", font=t.geist(30, 500), fill=APAGADO)
    if plano.get("ancho"):
        grises = [(d[5], d[6], (94, 100, 109), 0) for d in dips if d[5] is not None]
        t.hemiciclo(plano, grises, (660, 130, 1150, 520))
    return t.png()


# ---------------------------------------------------------------- páginas

def _pagina(ruta: str, hashweb: str, titulo: str, desc: str, imagen: str) -> bytes:
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


def generar(salida: dict, plano: dict) -> dict:
    """Escribe las páginas, las tarjetas, sitemap.xml y robots.txt. Devuelve cuántas se han escrito."""
    datos = salida["datos"]
    dips, grupos = datos["diputados"], datos["grupos"]
    escritas = {"paginas": 0, "tarjetas": 0}
    urls = [""]

    def poner(ruta: str, hashweb: str, titulo: str, desc: str, tarjeta) -> None:
        imagen = f"og/{ruta}.png"
        escritas["paginas"] += _escribir_si_cambia(SITIO / ruta / "index.html", _pagina(ruta, hashweb, titulo, desc, imagen))
        destino = SITIO / imagen
        # Una tarjeta ya dibujada no se vuelve a dibujar: su contenido no cambia.
        if not destino.exists():
            escritas["tarjetas"] += _escribir_si_cambia(destino, tarjeta())
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

    iniciativas: dict[str, dict] = {}
    for v in sorted(datos["votaciones"], key=lambda v: (v["fecha"], v["id"])):
        if v.get("exp"):
            iniciativas.setdefault(v["exp"], {"titulo": re.sub(r"\s*\([^()]*\)\s*$", "", v["titulo"]), "votos": []})["votos"].append(v)
    for exp, ini in iniciativas.items():
        ult = ini["votos"][-1]
        desc = f"{TIPO_EXP.get(exp[:3], 'Iniciativa')} {exp}. {resultado(ult)} por {ult['si']} a {ult['no']} el {fecha_larga(ult['fecha'])}."
        poner(f"iniciativa/{exp.replace('/', '-')}", f"iniciativa-{exp.replace('/', '-')}", ini["titulo"], desc,
              lambda exp=exp, ini=ini: tarjeta_iniciativa(exp, ini["titulo"], ini["votos"], dips, plano))

    portada = SITIO / "og" / "portada.png"
    if not portada.exists():
        escritas["tarjetas"] += _escribir_si_cambia(portada, tarjeta_portada(plano, dips))

    base = URL_SITIO or ""
    sitemap = "".join(f"<url><loc>{esc_xml(base + '/' + u)}</loc></url>" for u in urls)
    _escribir_si_cambia(SITIO / "sitemap.xml", (
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + sitemap + "</urlset>\n").encode())
    robots = "User-agent: *\nAllow: /\n" + (f"Sitemap: {URL_SITIO}/sitemap.xml\n" if URL_SITIO else "")
    _escribir_si_cambia(SITIO / "robots.txt", robots.encode())
    return escritas
