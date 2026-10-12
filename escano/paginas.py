"""Páginas para compartir: una por diputado, votación, sesión e iniciativa, con su tarjeta Open Graph.

La web es una sola página (index.html) y cada vista tiene su ruta (/diputado/<slug>/, /votacion/<id>/…). Para lo
que merece un enlace propio, este módulo escribe en esa ruta la misma página con su cabecera: el título, la
descripción y la imagen que leen WhatsApp, X o Google (que no ejecutan la web para sacarlos). Lleva en data-ruta
la vista que abre. Las demás rutas (/votaciones/, /elecciones/…) las sirve index.html tal cual (vercel.json).
Estas páginas no se versionan: se escriben en cada construcción. La imagen (1200×630) se dibuja aquí con Pillow,
con la estética Sol de Reforma Digital, la de la web.

Las tarjetas solo llevan datos que no cambian (una votación ya votada, el escaño de un diputado), así
que se regeneran igual y solo se reescriben si su contenido cambia.
"""
from __future__ import annotations

import functools
import hashlib
import html
import os
import re
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape as esc_xml

from .config import LEGISLATURA_ROMANA, SITIO
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
# La estética Sol, de Reforma Digital (site/marcas/sol): fondo blanco y tinta, el rojo de marca, el atardecer en la
# pieza del hemiciclo y en la portada, y el amanecer de su pie en el juego. Titulares en serif, el resto en Geist y
# las cifras y etiquetas en Geist Mono, como en la web.
BLANCO, TINTA, TENUE, APAGADO = (255, 255, 255), (34, 34, 34), (77, 77, 77), (107, 107, 107)
FONDO, LINEA, SUPERFICIE = BLANCO, (228, 228, 228), (242, 242, 242)
ROJO, DOBLEZ, NARANJA, AMARILLO = (223, 23, 23), (165, 14, 14), (255, 122, 26), (255, 190, 11)
AMBAR_CLARO, AMBAR_TEXTO = (255, 243, 209), (107, 74, 0)
# Lo que se lee en el pie de cada tarjeta: la dirección de la página y de dónde salen los datos, para que viajen con la imagen.
DOMINIO = "escañoabierto.com"
CREDITO = "Con datos oficiales del Congreso"
# El sentido del voto, con los colores de la web (el rojo de Sol es de marca, no de «no»).
VOTO = {"S": (47, 138, 91), "N": (194, 59, 46), "A": (201, 150, 42), "X": (222, 222, 222)}
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

@functools.lru_cache(maxsize=None)
def _fuente(archivo: str, tam: int, peso: int):
    from PIL import ImageFont
    f = ImageFont.truetype(str(FUENTES / archivo), tam)
    try:
        ejes = f.get_variation_axes()
        f.set_variation_by_axes([peso if e["name"] in (b"Weight", "Weight") else e["default"] for e in ejes])
    except (OSError, AttributeError):
        pass
    return f


def _tabla(paradas: list, base) -> list:
    """Los 256 colores de un degradado de paradas [(t, color, opacidad)] (t de 0 a 1), sobre el color `base`."""
    out = []
    for v in range(256):
        t = v / 255 * 2 ** .5   # Image.radial_gradient: 255 en las esquinas, a √2 radios del centro
        c, a = paradas[-1][1:]
        for (t0, c0, a0), (t1, c1, a1) in zip(paradas, paradas[1:]):
            if t <= t1:
                s = max(0.0, (t - t0) / (t1 - t0))
                c, a = _mezcla(c0, c1, s), a0 + (a1 - a0) * s
                break
        out.append(_mezcla(base, c, a))
    return out


def _pintar(dist, tabla: list):
    from PIL import Image
    return Image.merge("RGB", [dist.point([c[k] for c in tabla]) for k in range(3)])


def _elipse(w: int, h: int, rx: float, ry: float, cx: float, cy: float):
    """Distancia a (cx, cy) en radios de la elipse (rx, ry), como la mide Image.radial_gradient."""
    from PIL import Image
    g = Image.radial_gradient("L").resize((max(2, round(2 * rx)), max(2, round(2 * ry))), Image.BILINEAR)
    dist = Image.new("L", (w, h), 255)
    dist.paste(g, (round(cx - rx), round(cy - ry)))
    return dist


@functools.lru_cache(maxsize=None)
def _atardecer(w: int, h: int):
    """--atardecer de Sol: radial-gradient(90% 55% at 50% 118%, #ffd34d, amarillo 20 %, naranja 45 %,
    transparente 78 %) sobre el rojo: el sol sube desde abajo."""
    dist = _elipse(w, h, .9 * w, .55 * h, w / 2, 1.18 * h)
    return _pintar(dist, _tabla([(0, (255, 211, 77), 1), (.2, AMARILLO, 1), (.45, NARANJA, 1), (.78, ROJO, 0)], ROJO))


@functools.lru_cache(maxsize=None)
def _amanecer(w: int, h: int):
    """El pie de Sol: el atardecer al revés, de amarillo claro a naranja, con un brillo arriba."""
    from PIL import Image
    alto = Image.linear_gradient("L").resize((w, h), Image.BILINEAR)
    base = _pintar(alto, [_mezcla((255, 211, 77), AMARILLO, min(1, v / 255 / .46)) if v / 255 <= .46
                          else _mezcla(AMARILLO, NARANJA, (v / 255 - .46) / .54) for v in range(256)])
    brillo = _elipse(w, h, .8 * w, .7 * h, w / 2, -.12 * h).point(lambda v: round(255 * max(0.0, 1 - v / 255 * 2 ** .5 / .7)))
    return Image.composite(Image.new("RGB", (w, h), (255, 229, 143)), base, brillo)


# El símbolo de Escaño (site/marca/simbolo-tinta.svg, caja 2 5,4 96 53,2): tres filas de escaños y, arriba en el
# centro, el escaño abierto.
SIMBOLO = [(8, 54), (11.2, 37.93), (20.3, 24.3), (33.93, 15.2), (66.07, 15.2), (79.7, 24.3), (88.8, 37.93), (92, 54),
           (21, 54), (24.89, 39.5), (35.5, 28.89), (50, 25), (64.5, 28.89), (75.11, 39.5), (79, 54),
           (34, 54), (38.69, 42.69), (50, 38), (61.31, 42.69), (66, 54)]
ABIERTO = (50, 12)
# La R de Reforma Digital (apps/web/components/sol/logo.tsx, caja 144 × 192): cuerpo, esquina doblada y dos cuadros.
R_CUERPO = [(48, 0), (96, 0), (96, 48), (48, 48), (48, 96), (96, 96), (96, 144), (48, 144), (48, 192), (0, 192), (0, 48),
            (48, 48)]
R_DOBLEZ = [(0, 48), (48, 0), (48, 48)]
R_CUADROS = [(96, 48), (96, 144)]
PIEZA = (640, 116, 1136, 542)   # la pieza del atardecer de las tarjetas con hemiciclo


class Tarjeta:
    """Lienzo de 1200×630 con la cabecera y el pie de la marca (Sol).

    fondo: "blanco" (la de cada página), "atardecer" (la portada) o "amanecer" (el juego). El contenido va entre
    y=130 y y=545; debajo, el pie con la dirección de la página y el crédito, que dibuja `png()`.
    """

    def __init__(self, fondo: str = "blanco"):
        from PIL import Image, ImageDraw  # import perezoso: el resto del pipeline no necesita Pillow
        self.fondo = fondo
        self.img = (_atardecer(W, H) if fondo == "atardecer" else _amanecer(W, H) if fondo == "amanecer"
                    else Image.new("RGB", (W, H), FONDO)).copy()
        self.d = ImageDraw.Draw(self.img)
        self.tinta = BLANCO if fondo == "atardecer" else TINTA                       # cabecera y pie
        self.suave = (255, 226, 214) if fondo == "atardecer" else APAGADO if fondo == "blanco" else TENUE
        self.caja = None
        self._logo(64, 48)
        self._reforma(W - 64, 48)

    def geist(self, tam: int, peso: int = 400):
        return _fuente("Geist.ttf", tam, peso)

    def mono(self, tam: int, peso: int = 500):
        return _fuente("GeistMono.ttf", tam, peso)

    def serif(self, tam: int, peso: int = 400):
        """Los titulares de Sol van en su serif; se sirve Georgia y aquí, Gelasio, la libre con sus medidas."""
        return _fuente("Gelasio.ttf", tam, peso)

    def _suave(self, caja: tuple[int, int, int, int], dibujar):
        """Dibuja círculos a triple tamaño y los reduce: Pillow no suaviza los bordes y los puntos pequeños
        (el símbolo, los escaños) se verían dentados. dibujar(d, s) recibe el lienzo y la escala."""
        from PIL import Image, ImageDraw
        x0, y0, x1, y1 = caja
        s = 3
        capa = Image.new("RGBA", ((x1 - x0) * s, (y1 - y0) * s), (0, 0, 0, 0))
        dibujar(ImageDraw.Draw(capa), s)
        capa = capa.resize((x1 - x0, y1 - y0), Image.LANCZOS)
        self.img.paste(capa, (x0, y0), capa)

    def _logo(self, x: int, y: int):
        k = 32 / 53.2   # el símbolo, de 32 px de alto
        color = BLANCO if self.fondo == "atardecer" else ROJO if self.fondo == "blanco" else TINTA

        def simbolo(d, s):
            for cx, cy in SIMBOLO:
                X, Y, r = (cx - 2) * k * s, (cy - 5.4) * k * s, 4.3 * k * s
                d.ellipse([X - r, Y - r, X + r, Y + r], fill=color)
            X, Y, r = (ABIERTO[0] - 2) * k * s, (ABIERTO[1] - 5.4) * k * s, 3.5 * k * s
            d.ellipse([X - r, Y - r, X + r, Y + r], outline=color, width=round(1.6 * k * s))
        self._suave((x, y, x + 60, y + 34), simbolo)
        f = self.geist(18, 600)
        self.d.text((x + 96 * k + 12, y + 14), "Escaño", font=f, fill=self.tinta, anchor="ls")
        self.d.text((x + 96 * k + 12, y + 32), "Abierto", font=f, fill=self.tinta, anchor="ls")

    def _reforma(self, x1: int, y: int):
        """«Un proyecto de», la R y «Reforma / Digital», alineado a la derecha en x1."""
        f, fp, k = self.geist(16, 700), self.geist(16, 400), 30 / 192
        xt = x1 - max(f.getlength("Reforma"), f.getlength("Digital"))
        xr = xt - 10 - 144 * k
        cuerpo = BLANCO if self.fondo == "atardecer" else ROJO if self.fondo == "blanco" else TINTA
        punto = lambda p: (xr + p[0] * k, y + 1 + p[1] * k)
        self.d.polygon([punto(p) for p in R_CUERPO], fill=cuerpo)
        self.d.polygon([punto(p) for p in R_DOBLEZ], fill=DOBLEZ)
        for qx, qy in R_CUADROS:
            self.d.rectangle([punto((qx, qy)), punto((qx + 48, qy + 48))], fill=cuerpo)
        self.d.text((xt, y + 14), "Reforma", font=f, fill=self.tinta, anchor="ls")
        self.d.text((xt, y + 29), "Digital", font=f, fill=self.tinta, anchor="ls")
        self.d.text((xr - 12, y + 22), "Un proyecto de", font=fp, fill=self.suave, anchor="rs")

    def rotulo(self, x: int, y: int, texto: str, color=ROJO, tam: int = 17, ancho: int = 540):
        """Etiqueta de Sol (.t-etiqueta): Geist Mono en mayúsculas con 0,08 em entre letras; se corta con «…»."""
        f, paso = self.mono(tam, 500), tam * .08
        texto = texto.upper()
        largo = lambda s: sum(f.getlength(ch) + paso for ch in s)
        if largo(texto) > ancho:
            while texto and largo(texto + "…") > ancho:
                texto = texto[:-1]
            texto = texto.rstrip(" ·") + "…"
        for ch in texto:
            self.d.text((x, y), ch, font=f, fill=color)
            x += f.getlength(ch) + paso
        return x

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

    def etiqueta(self, x: int, y: int, texto: str, fondo, color=BLANCO):
        """El resultado, en una píldora de Sol con el texto en Geist Mono."""
        f, tam = self.mono(16, 500), 16
        paso = tam * .06
        ancho = sum(f.getlength(ch) + paso for ch in texto) - paso
        self.d.rounded_rectangle([x, y, x + ancho + 32, y + 34], radius=17, fill=fondo)
        cx = x + 16
        for ch in texto:
            self.d.text((cx, y + 18), ch, font=f, fill=color, anchor="lm")
            cx += f.getlength(ch) + paso

    def cifra(self, xy, texto: str, tam: int = 84):
        """Las cifras grandes, en Geist Mono (como en la web: la serif solo tiene números de estilo antiguo)."""
        self.d.text(xy, texto, font=self.mono(tam, 500), fill=TINTA, anchor="ls")

    def pieza(self) -> tuple[int, int, int, int]:
        """A la derecha, la pieza de los proyectos de Sol (su .rc-marco), como el último pleno de la portada de la web:
        gris, con un sol que asoma por detrás y una tarjeta blanca que sale por el borde de abajo. Devuelve la caja del
        hemiciclo dentro de la tarjeta."""
        from PIL import Image, ImageChops, ImageDraw, ImageFilter
        x0, y0, x1, y1 = PIEZA
        w, h = x1 - x0, y1 - y0
        pieza = Image.new("RGB", (w, h), SUPERFICIE)
        # El sol: un disco del 96 % del ancho que empieza al 30 % del alto, con su brillo arriba (circle at 50% 22%).
        d = round(.96 * w)
        sol = _pintar(_elipse(d, d, .9265 * d, .9265 * d, d / 2, .22 * d),
                      _tabla([(0, (255, 211, 77), 1), (.36, AMARILLO, 1), (1, NARANJA, 1)], NARANJA))
        disco = Image.new("L", (d * 3, d * 3), 0)
        ImageDraw.Draw(disco).ellipse([0, 0, d * 3 - 1, d * 3 - 1], fill=255)
        pieza.paste(sol, ((w - d) // 2, round(.3 * h)), disco.resize((d, d), Image.LANCZOS))
        mascara = Image.new("L", (w * 3, h * 3), 0)
        ImageDraw.Draw(mascara).rounded_rectangle([0, 0, w * 3 - 1, h * 3 - 1], radius=28 * 3, fill=255)
        self.img.paste(pieza, (x0, y0), mascara.resize((w, h), Image.LANCZOS))
        c = (x0 + 52, y0 + 36, x1 - 52, y1)
        # La sombra de --sombra-flota, cálida, recortada a la pieza.
        sombra = Image.new("L", (W, H), 0)
        ImageDraw.Draw(sombra).rounded_rectangle([c[0] + 2, c[1] + 10, c[2] - 2, c[3] + 30], radius=20, fill=70)
        sombra = sombra.filter(ImageFilter.GaussianBlur(14))
        recorte = Image.new("L", (W, H), 0)
        recorte.paste(mascara.resize((w, h), Image.LANCZOS), (x0, y0))
        self.img = Image.composite(Image.new("RGB", (W, H), (120, 40, 0)), self.img, ImageChops.multiply(sombra, recorte))
        self.d = ImageDraw.Draw(self.img)
        self.d.rounded_rectangle(c, radius=20, fill=BLANCO, corners=(True, True, False, False))
        self.caja = c
        return c[0] + 18, c[1] + 22, c[2] - 18, c[3] - 52

    def leyenda(self, texto: str):
        """El pie del hemiciclo, dentro de la tarjeta blanca."""
        x0, _, x1, y1 = self.caja
        self.d.text(((x0 + x1) / 2, y1 - 20), texto, font=self.geist(16, 500), fill=APAGADO, anchor="ms")

    def hemiciclo(self, plano: dict, escanos: list[tuple], caja: tuple[int, int, int, int]):
        """escanos: [(x, y, color, radio_extra)] en coordenadas del plano oficial."""
        x0, y0, x1, y1 = caja
        esc = min((x1 - x0) / plano["ancho"], (y1 - y0) / plano["alto"])
        ox = ((x1 - x0) - plano["ancho"] * esc) / 2
        oy = ((y1 - y0) - plano["alto"] * esc) / 2
        r = 5.1 * esc

        def escanos_(d, s):
            for x, y, color, extra in escanos:
                cx, cy, rr = (ox + x * esc) * s, (oy + y * esc) * s, (r + extra) * s
                if extra:
                    d.ellipse([cx - rr - 5 * s, cy - rr - 5 * s, cx + rr + 5 * s, cy + rr + 5 * s], fill=_mezcla(FONDO, color, .25))
                d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color)
        self._suave((round(x0), round(y0), round(x1), round(y1)), escanos_)

    def _pie(self, ruta: str):
        if self.fondo != "atardecer":
            self.d.line([(64, 566), (W - 64, 566)], fill=LINEA if self.fondo == "blanco" else _mezcla(NARANJA, TINTA, .18),
                        width=1)
        self.d.text((64, 598), DOMINIO + (f"/{ruta}" if ruta else ""), font=self.mono(16, 400), fill=self.suave, anchor="ls")
        self.d.text((W - 64, 598), CREDITO, font=self.geist(17, 500), fill=self.suave, anchor="rs")

    def png(self, ruta: str = "") -> bytes:
        """ruta: la de su página (votacion/101-1), que se lee en el pie."""
        import io
        from PIL import Image
        self._pie(ruta)
        b = io.BytesIO()
        # 256 colores (octree: conserva los colores exactos de los escaños, que ocupan poco) y difuminado, para que los
        # degradados del atardecer y el amanecer no se vean a franjas.
        paleta = self.img.quantize(256, method=Image.Quantize.FASTOCTREE)
        self.img.quantize(palette=paleta, dither=Image.Dither.FLOYDSTEINBERG).save(b, "PNG", optimize=True)
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


def tarjeta_votacion(v: dict, dips: list, plano: dict) -> "Tarjeta":
    t = Tarjeta()
    a, m, d = v["fecha"].split("-")
    t.rotulo(64, 132, f"Votación · {int(d)} {MESES[int(m) - 1]} {a}")
    y = t.texto((64, 168), v["titulo"], t.serif(44), TINTA, 540, 4, 1.12)
    t.etiqueta(64, max(y + 16, 380), resultado(v).upper(), VOTO["S"] if aprobada(v) else VOTO["N"])
    t.cifra((60, 540), f"{v['si']} – {v['no']}")
    if plano.get("ancho"):
        t.hemiciclo(plano, _escanos_voto(v, dips, plano), t.pieza())
        t.leyenda(f"Sí {v['si']} · No {v['no']} · Abst. {v['abst']} · No votan {v['novota']}")
    return t


def tarjeta_diputado(i: int, dips: list, grupos: dict, plano: dict) -> "Tarjeta":
    t = Tarjeta()
    n, g, circ, form = dips[i][:4]
    nombre_g = grupos.get(g, {}).get("nombre", g)
    t.rotulo(64, 132, "Diputado · " + nombre_g)
    y = t.texto((64, 168), legible(n), t.serif(60), TINTA, 540, 3, 1.06)
    linea = " · ".join(x for x in (circ, f"lista de {form}" if form else "") if x)
    t.texto((64, y + 14), linea, t.geist(26, 400), TENUE, 540, 2)
    if plano.get("ancho") and dips[i][5] is not None:
        escanos = []
        yo = dips[i]
        for j, d in enumerate(dips):
            # Solo los diputados de hoy; a quien ya no lo es se le pinta en su antiguo escaño.
            if d[5] is None or (j != i and (_baja(d) or (_baja(yo) and (d[5], d[6]) == (yo[5], yo[6])))):
                continue
            base = _hex(grupos.get(d[1], {}).get("color", "#8A8F98"))
            escanos.append((d[5], d[6], TINTA if j == i else _mezcla(FONDO, base, .32), 4 if j == i else 0))
        escanos.sort(key=lambda e: e[3])  # el suyo, encima
        t.hemiciclo(plano, escanos, t.pieza())
        t.leyenda("Su escaño en el hemiciclo")
    return t


def tarjeta_sesion(s: dict, votos: list, dips: list, plano: dict) -> "Tarjeta":
    t = Tarjeta()
    t.rotulo(64, 132, f"{s['organo']} · {fecha_larga(s['fecha'])}")
    titulo = s.get("titular") or (re.split(r"(?<=[.!?])\s", s.get("resumen") or "")[0]) or s.get("sesion", "")
    t.texto((64, 168), titulo, t.serif(44), TINTA, 540, 5, 1.12)
    t.d.text((64, 538), f"{len(votos)} votaciones · {len(s.get('puntos', []))} asuntos", font=t.geist(26, 600),
             fill=TINTA, anchor="ls")
    if votos and plano.get("ancho"):
        dest = min(votos, key=lambda v: abs(v["si"] - v["no"]))
        t.hemiciclo(plano, _escanos_voto(dest, dips, plano), t.pieza())
        t.leyenda(f"La más ajustada: {dest['si']} – {dest['no']}")
    return t


def tarjeta_iniciativa(exp: str, titulo: str, votos: list, dips: list, plano: dict, ley: dict | None = None) -> "Tarjeta":
    t = Tarjeta()
    tipo = ley["tipo"] + (" orgánica" if ley.get("organica") else "") if ley else TIPO_EXP.get(exp[:3], "Iniciativa")
    t.rotulo(64, 132, f"{tipo} · {exp}")
    y = t.texto((64, 168), titulo, t.serif(44), TINTA, 540, 4, 1.12)
    if votos:
        ult = votos[-1]
        t.etiqueta(64, max(y + 16, 380), resultado(ult).upper(), VOTO["S"] if aprobada(ult) else VOTO["N"])
        t.cifra((60, 540), f"{ult['si']} – {ult['no']}")
        if plano.get("ancho"):
            t.hemiciclo(plano, _escanos_voto(ult, dips, plano), t.pieza())
            a, m, d = ult["fecha"].split("-")
            t.leyenda(f"La última votación, {int(d)} de {MESES[int(m) - 1]} de {a}")
    return t


def _etapas(t: "Tarjeta", ley: dict, x: int, y: int, ancho: int):
    """Las seis etapas de la tramitación en una fila de puntos, con la alcanzada resaltada."""
    paso = ancho / (len(ETAPAS) - 1)
    corta = ley["estado"] not in ("en trámite", "aprobada")
    t.d.line([(x, y), (x + paso * min(ley["etapa"], 5), y)], fill=TINTA, width=3)
    t.d.line([(x + paso * ley["etapa"], y), (x + ancho, y)], fill=LINEA, width=3)
    for k, nombre in enumerate(ETAPAS):
        cx = x + paso * k
        on, cortada = k <= ley["etapa"], corta and k == ley["etapa"] + 1
        color = (ROJO if k == ley["etapa"] else TINTA) if on else (VOTO["N"] if cortada else (190, 190, 190))
        r = 11 if on else 9
        t.d.ellipse([cx - r, y - r, cx + r, y + r], fill=color if on else FONDO, outline=color, width=3)
        t.d.text((cx, y + 30), nombre, font=t.geist(17, 600 if on else 400), fill=TINTA if on else APAGADO, anchor="ma")


def tarjeta_ley(ley: dict) -> "Tarjeta":
    t = Tarjeta()
    tipo = ley["tipo"] + (" orgánica" if ley.get("organica") else "")
    t.rotulo(64, 132, f"{tipo} · {ley['exp']}", ancho=1070)
    y = t.texto((64, 168), ley["titulo"], t.serif(48), TINTA, 1070, 3, 1.12)
    # Los estados, con los colores de Sol: aprobada y rechazada como el voto; en trámite, en ámbar.
    fondo, color = ((VOTO["S"], BLANCO) if ley["estado"] == "aprobada" else
                    (VOTO["N"], BLANCO) if ley["estado"] in ("rechazada", "inadmitida") else
                    (AMBAR_CLARO, AMBAR_TEXTO) if ley["estado"] == "en trámite" else (SUPERFICIE, TENUE))
    texto = ESTADO_LEY.get(ley["estado"], ley["estado"]).upper()
    t.etiqueta(64, max(y + 16, 360), texto, fondo, color)
    if ley["estado"] == "en trámite" and ley.get("ampliaciones", 0) >= 8:
        x = 64 + 32 + sum(t.mono(16).getlength(ch) + 16 * .06 for ch in texto) + 20
        t.d.text((x, max(y + 16, 360) + 18), f"Plazo de enmiendas ampliado {ley['ampliaciones']} veces",
                 font=t.geist(22, 400), fill=TENUE, anchor="lm")
    _etapas(t, ley, 120, 470, 960)
    return t


def tarjeta_semana(sem: dict, vs: list, votos_por_id: dict, dips: list, plano: dict) -> "Tarjeta":
    t = Tarjeta()
    a, b = sem["desde"].split("-"), sem["hasta"].split("-")
    rango = (f"{int(a[2])}–{int(b[2])} {MESES[int(b[1]) - 1]} {b[0]}" if a[1] == b[1]
             else f"{int(a[2])} {MESES[int(a[1]) - 1][:3]} – {int(b[2])} {MESES[int(b[1]) - 1][:3]} {b[0]}")
    t.rotulo(64, 132, f"La semana en el Congreso · {rango}")
    t.texto((64, 168), sem["titular"], t.serif(44), TINTA, 540, 5, 1.12)
    t.d.text((64, 538), f"{len(vs)} votaciones · {sem['aprobadas']} aprobadas · {len(vs) - sem['aprobadas']} rechazadas",
             font=t.geist(24, 600), fill=TINTA, anchor="ls")
    dest = votos_por_id.get((sem["ajustadas"] or [None])[0])
    if dest and plano.get("ancho"):
        t.hemiciclo(plano, _escanos_voto(dest, dips, plano), t.pieza())
        t.leyenda(f"La más ajustada: {dest['si']} – {dest['no']}")
    return t


def tarjeta_provincia(circ: str, ids: list[int], dips: list, grupos: dict, plano: dict) -> "Tarjeta":
    t = Tarjeta()
    t.rotulo(64, 132, "Tus diputados")
    y = t.texto((64, 168), circ, t.serif(64), TINTA, 540, 2, 1.06)
    reparto = Counter(dips[i][1] for i in ids)
    t.texto((64, y + 14), f"{len(ids)} {'diputado' if len(ids) == 1 else 'diputados'}: " +
            ", ".join(f"{g} {n}" for g, n in reparto.most_common()), t.geist(26, 400), TENUE, 540, 3)
    if plano.get("ancho"):
        esc = []
        for j, d in enumerate(dips):
            if d[5] is None or _baja(d):
                continue
            base = _hex(grupos.get(d[1], {}).get("color", "#8A8F98"))
            esc.append((d[5], d[6], base if j in ids else LINEA, 3 if j in ids else 0))
        esc.sort(key=lambda e: e[3])
        t.hemiciclo(plano, esc, t.pieza())
        t.leyenda(f"Sus {len(ids)} escaños, en color")
    return t


def tarjeta_tema(nombre: str, votos: list, leyes: list, dips: list, plano: dict) -> "Tarjeta":
    t = Tarjeta()
    t.rotulo(64, 132, "Seguir un tema en el Congreso")
    y = t.texto((64, 168), nombre, t.serif(60), TINTA, 540, 3, 1.06)
    vivas = sum(l["estado"] == "en trámite" for l in leyes)
    t.texto((64, y + 16), f"{len(votos)} votaciones · {len(leyes)} leyes, {vivas} en trámite", t.geist(26, 400), TENUE, 540, 2)
    if votos and plano.get("ancho"):
        ult = max(votos, key=lambda v: (v["fecha"], v["id"]))
        t.hemiciclo(plano, _escanos_voto(ult, dips, plano), t.pieza())
        t.leyenda(f"La última: {corto(ult['titulo'], 38)}")
    return t


def tarjeta_portada(plano: dict, dips: list) -> "Tarjeta":
    """La de la portada, como su hero: el atardecer entero, el titular en blanco y el hemiciclo en blanco."""
    t = Tarjeta("atardecer")
    y = t.texto((64, 160), "Lo que pasa en el Congreso, contado para cualquiera.", t.serif(64), BLANCO, 600, 4, 1.08)
    t.texto((64, y + 24), "Qué se dijo, cómo se votó y qué cambia. Con datos oficiales, en lenguaje claro y con "
            "código abierto.", t.geist(24, 400), BLANCO, 560, 3, 1.45)
    if plano.get("ancho"):
        blancos = [(d[5], d[6], BLANCO, 0) for d in dips if d[5] is not None and not _baja(d)]
        t.hemiciclo(plano, blancos, (690, 150, 1136, 500))
    return t


def tarjeta_juego(grupos: dict) -> "Tarjeta":
    """¿Quién lo dijo?, en el amanecer del pie de Sol: una cita tachada y cuatro grupos para elegir."""
    from PIL import Image, ImageDraw, ImageFilter
    t = Tarjeta("amanecer")
    y = t.texto((64, 150), "¿Quién lo dijo?", t.serif(96), TINTA, 560, 2, 1.0)
    t.texto((68, y + 22), "Frases literales del Congreso. Adivina de qué grupo es quien habla.", t.geist(26, 400),
            TINTA, 520, 3, 1.35)
    c = (660, 128, W - 64, 528)
    sombra = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sombra).rounded_rectangle([c[0] + 4, c[1] + 14, c[2] - 4, c[3] + 10], radius=20, fill=80)
    t.img = Image.composite(Image.new("RGB", (W, H), (120, 40, 0)), t.img, sombra.filter(ImageFilter.GaussianBlur(14)))
    t.d = ImageDraw.Draw(t.img)
    t.d.rounded_rectangle(c, radius=20, fill=BLANCO)
    x0, x1 = c[0] + 32, c[2] - 32
    t.d.text((x0 - 4, c[1] + 18), "«", font=t.serif(96), fill=ROJO)
    for k, ancho in enumerate((1, .92, .64)):
        yy = c[1] + 132 + k * 34
        t.d.rounded_rectangle([x0, yy, x0 + (x1 - x0) * ancho, yy + 16], radius=8, fill=SUPERFICIE)
    f = t.geist(20, 600)
    for k, g in enumerate(("PSOE", "PP", "VOX", "SUMAR")):
        w = (x1 - x0) // 2 - 6
        cx, cy = x0 + (k % 2) * (w + 12), c[1] + 252 + (k // 2) * 64
        t.d.rounded_rectangle([cx, cy, cx + w, cy + 50], radius=25, fill=SUPERFICIE)
        color = _hex(grupos.get(g, {}).get("color", "#888888"))
        t.d.ellipse([cx + 20, cy + 18, cx + 34, cy + 32], fill=color)
        t.d.text((cx + 46, cy + 25), g, font=f, fill=TINTA, anchor="lm")
    return t


# ---------------------------------------------------------------- páginas

# Las secciones de la web (sus rutas, para el sitemap): las sirve index.html tal cual.
SECCIONES = ["elecciones", "geografia", "dias", "votaciones", "leyes", "temas", "explora", "diputados",
             "grupos", "organigrama", "oradores", "metodo", "glosario", "como-ley", "preguntas"]
INDEX = SITIO / "index.html"   # la plantilla: la propia web (fijada aquí; los tests cambian SITIO)
_PLANTILLA: list[str] = []
_META = re.compile(r"<!--meta.*?<!--/meta-->", re.S)


def _pagina(ruta: str, hashweb: str, titulo: str, desc: str, imagen: str, feed: bool = False, fecha: str = "") -> bytes:
    """index.html con la cabecera de esta página y, en data-ruta, la vista que abre. Las votaciones y sesiones llevan
    su fecha (data-fecha): si no caen en el periodo que carga la web, carga su mes."""
    if not _PLANTILLA:
        _PLANTILLA.append(INDEX.read_text())
    url = f"{URL_SITIO}/{ruta}/" if URL_SITIO else f"/{ruta}/"
    img = f"{URL_SITIO}/{imagen}" if URL_SITIO else f"/{imagen}"
    e = lambda s: html.escape(s, quote=True)
    meta = f"""<!--meta-->
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
<!--/meta-->"""
    pagina, n = _META.subn(lambda _: meta, _PLANTILLA[0], count=1)
    if not n:
        raise SystemExit("paginas: index.html no tiene el bloque <!--meta--> … <!--/meta-->")
    # La etiqueta <html> de index.html, sea cual sea la marca, con la ruta (y la fecha) de la página.
    pagina = re.sub(r"<html( [^>]*)?>", lambda m: f'<html{m[1] or ""} data-ruta="{e(hashweb)}"'
                    + (f' data-fecha="{e(fecha)}"' if fecha else "") + ">", pagina, count=1)
    return pagina.encode()


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
    _PLANTILLA.clear()
    urls = ["", *(f"{v}/" for v in SECCIONES)]

    def poner(ruta: str, hashweb: str, titulo: str, desc: str, tarjeta, clave: str = "", fecha: str = "") -> None:
        """clave: resumen de lo que dibuja la tarjeta cuando puede cambiar (una ley que avanza, la semana en
        curso). Va en el nombre del fichero, así que un cambio da una tarjeta nueva y las redes no se quedan
        con la vieja en caché."""
        imagen = f"og/{ruta}-{hashlib.sha1(clave.encode()).hexdigest()[:8]}.png" if clave else f"og/{ruta}.png"
        feed = ruta.startswith(("diputado/", "iniciativa/", "tema/"))
        escritas["paginas"] += _escribir_si_cambia(SITIO / ruta / "index.html",
                                                   _pagina(ruta, hashweb, titulo, desc, imagen, feed, fecha))
        destino = SITIO / imagen
        # Una tarjeta ya dibujada no se vuelve a dibujar: su contenido no cambia.
        if DIBUJAR and not destino.exists():
            escritas["tarjetas"] += _escribir_si_cambia(destino, tarjeta().png(ruta))
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
              lambda v=v: tarjeta_votacion(v, dips, plano), fecha=v["fecha"])

    for s in datos["sesiones"]:
        vs = [votos_por_id[x] for p in s.get("puntos", []) for x in p.get("votos", []) if x in votos_por_id]
        titulo = f"{s['organo']}, {fecha_larga(s['fecha'])}"
        desc = s.get("titular") or (s.get("resumen") or "")[:220] or f"{len(s.get('puntos', []))} asuntos en el orden del día."
        poner(f"sesion/{slug(s['id'])}", f"sesion-{s['id']}", titulo, desc,
              lambda s=s, vs=vs: tarjeta_sesion(s, vs, dips, plano), fecha=s["fecha"])

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

    # ---- el juego
    poner("quien-lo-dijo", "quien-lo-dijo", "¿Quién lo dijo?",
          "Diez frases literales dichas en el Congreso esta legislatura. Adivina de qué grupo es quien habla, "
          "y quién es. Un reto nuevo cada día.", lambda: tarjeta_juego(grupos))

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
        escritas["tarjetas"] += _escribir_si_cambia(portada, tarjeta_portada(plano, dips).png())
    # La portada (index.html) también necesita URLs absolutas: X no resuelve una og:image relativa y se queda con la
    # tarjeta que tenía en caché. Solo con URL_SITIO (en Vercel); en local, index.html no se toca.
    if URL_SITIO:
        cab = INDEX.read_text()
        nueva = cab.replace('<meta property="og:image" content="/og/portada.png">',
                            f'<meta property="og:url" content="{URL_SITIO}/">\n'
                            f'<meta property="og:site_name" content="Escaño Abierto">\n'
                            f'<meta property="og:locale" content="es_ES">\n'
                            f'<meta property="og:image" content="{URL_SITIO}/og/portada.png">', 1)
        nueva = nueva.replace('<meta name="twitter:card" content="summary_large_image">\n<!--/meta-->',
                              f'<meta name="twitter:card" content="summary_large_image">\n'
                              f'<meta name="twitter:image" content="{URL_SITIO}/og/portada.png">\n<!--/meta-->', 1)
        _escribir_si_cambia(INDEX, nueva.encode())

    base = URL_SITIO or ""
    sitemap = "".join(f"<url><loc>{esc_xml(base + '/' + u)}</loc></url>" for u in urls)
    _escribir_si_cambia(SITIO / "sitemap.xml", (
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + sitemap + "</urlset>\n").encode())
    robots = "User-agent: *\nAllow: /\n" + (f"Sitemap: {URL_SITIO}/sitemap.xml\n" if URL_SITIO else "")
    _escribir_si_cambia(SITIO / "robots.txt", robots.encode())
    return escritas
