"""Plano del hemiciclo: dónde se sienta cada diputado.

La página https://www.congreso.es/es/hemiciclo dibuja el plano con un mapa de imagen: un <area shape="circle">
por escaño con sus coordenadas, el nombre del diputado y su código. Incluye también a los miembros del
Gobierno que no son diputados (en el banco azul), que no votan.
"""
from __future__ import annotations

import html
import json
import re

from .config import BASE, DATOS
from .red import descargar

URL = BASE + "/es/hemiciclo"
FICHERO = DATOS / "hemiciclo.json"
RE_AREA = re.compile(r'<area\s+shape="circle"(?P<attrs>[^>]*)>', re.S)
RE_COORDS = re.compile(r'coords="\s*(\d+)\s*,\s*(\d+)')
RE_CODIGO = re.compile(r"getUrlFichaDiputado\((\d+)")
RE_FOTO = re.compile(r"mostrarFotografiaHemiciclo\(\s*'([^']*)'\s*,\s*'[^']*'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'", re.S)


def leer_plano(pagina: str) -> dict:
    """{'escanos': {'Apellidos, Nombre': {x, y, codigo}}, 'gobierno': [{nombre, cargo, x, y}], 'ancho', 'alto'}."""
    escanos, gobierno = {}, []
    for m in RE_AREA.finditer(pagina):
        a = m.group("attrs")
        c, f = RE_COORDS.search(a), RE_FOTO.search(a)
        if not c or not f:
            continue
        x, y = int(c.group(1)), int(c.group(2))
        texto = html.unescape(f.group(2)).strip()
        nombre = re.sub(r"\s*\(.*\)\s*$", "", texto).strip()
        cargo = (re.search(r"\((.*)\)\s*$", texto) or [None, None])[1]
        cod = RE_CODIGO.search(a)
        if not cod:
            # Sin ficha de diputado: miembro del Gobierno que no es diputado. Se sienta en el banco azul
            # pero no vota.
            gobierno.append({"nombre": nombre, "cargo": cargo, "x": x, "y": y})
            continue
        escanos[nombre] = {"x": x, "y": y, "codigo": int(cod.group(1))}
    xs = [e["x"] for e in escanos.values()] + [g["x"] for g in gobierno]
    ys = [e["y"] for e in escanos.values()] + [g["y"] for g in gobierno]
    return {"escanos": escanos, "gobierno": gobierno,
            "ancho": max(xs) + 10 if xs else 0, "alto": max(ys) + 10 if ys else 0}


def actualizar() -> dict:
    pagina = descargar(URL, cache=False)
    if not pagina:
        return leer()
    plano = leer_plano(pagina.decode("utf-8", "replace"))
    if plano["escanos"]:
        FICHERO.parent.mkdir(parents=True, exist_ok=True)
        FICHERO.write_text(json.dumps(plano, ensure_ascii=False, indent=1))
    return plano


def leer() -> dict:
    return json.loads(FICHERO.read_text()) if FICHERO.exists() else {"escanos": {}, "gobierno": []}
