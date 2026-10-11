"""Cuánto acertaron las encuestas en las generales de 2015 a 2023.

De cada elección, las encuestas de las tres semanas anteriores (las de Wikipedia, como las de ahora): de cada empresa,
la última; su error frente al resultado (la media del error absoluto en los partidos de más del 2,5 %) y hacia dónde
se equivocó con cada partido. Y la media de todas, hecha como la de hoy, para ver cuánto falló «el consenso».

Las páginas de elecciones pasadas ya no cambian: se descargan una vez y quedan en data/raw.
"""
from __future__ import annotations

import json
from datetime import date, timedelta

from bs4 import BeautifulSoup

from .encuestas import _celda_partido, _fechas, _numero, _rejilla, _texto
from .red import descargar

API = "https://en.wikipedia.org/w/api.php?action=parse&page=Opinion_polling_for_the_{}&prop=text&format=json&formatversion=2&redirects=1"
ELECCIONES = [   # id, página, fecha, nombre
    ("202307", "2023_Spanish_general_election", date(2023, 7, 23), "23J 2023"),
    ("201911", "November_2019_Spanish_general_election", date(2019, 11, 10), "10N 2019"),
    ("201904", "April_2019_Spanish_general_election", date(2019, 4, 28), "28A 2019"),
    ("201606", "2016_Spanish_general_election", date(2016, 6, 26), "26J 2016"),
    ("201512", "2015_Spanish_general_election", date(2015, 12, 20), "20D 2015"),
]
# Rótulo de la columna → linaje de partido (el mismo id en todas las elecciones).
LINAJE = {
    "PP": "PP", "PSOE": "PSOE", "Vox": "VOX", "Sumar": "IZQ", "Unidas Podemos": "IZQ", "Unidos Podemos": "IZQ",
    "Podemos": "IZQ", "IU–UPeC": "IU", "IU–LV": "IU", "C's": "CS", "Cs": "CS", "CS": "CS",
    "ERC": "ERC", "ERC–Sobiranistes": "ERC", "ERC–CatSí": "ERC", "Junts": "JUNTS", "JxCat": "JUNTS", "DiL": "JUNTS",
    "CiU": "JUNTS", "PDeCAT": "JUNTS", "CDC": "JUNTS", "PNV": "PNV", "EH Bildu": "BILDU", "Más País": "MP",
    "BNG": "BNG", "Galician Nationalist Bloc": "BNG", "UPYD": "UPYD", "UPyD": "UPYD",
}
VENTANA = 21
AGREGADORES = {"KeyData"}


def _tabla(eid: str, pagina: str, fecha: date) -> tuple[list[dict], dict, dict]:
    """Las encuestas de la tabla del año de la elección y su resultado. También el rótulo de cada linaje."""
    html = json.loads(descargar(API.format(pagina)))["parse"]["text"]
    soup = BeautifulSoup(html, "html.parser")
    tabla = next(t for t in soup.select("table.wikitable")
                 if (h := t.find_previous(["h2", "h3", "h4"])) and "Voting intention" in h.get_text())
    rej = _rejilla(tabla)
    cab = []
    for celda in rej[0]:
        a, img = celda.find("a"), celda.find("img")
        cab.append((a.get("title") if a else None) or (img.get("alt") if img else None) or celda.get_text(strip=True))
    rotulos, encuestas, resultado = {}, [], {}
    for fila in rej[2:]:
        if len(fila) < 6:
            continue
        textos = [_texto(c) for c in fila]
        firma = textos[0]
        if not firma:
            continue
        ini, fin = _fechas(textos[1], fecha.year)
        v, e = {}, {}
        for col, nombre in enumerate(cab):
            lin = LINAJE.get(nombre)
            if not lin or col >= len(textos):
                continue
            pct, esc = _celda_partido(textos[col])
            if pct is not None and lin not in v:   # 2016: «Podemos» y «Unidos Podemos»; vale el primero con dato
                v[lin] = pct
                rotulos.setdefault(lin, nombre)
            if esc and lin not in e:
                e[lin] = esc
        if "general election" in firma.lower():
            if fin == fecha.isoformat():   # la tabla acaba con la fila de la elección anterior: esa no
                resultado = {"v": v, "e": e}
            continue
        if not fin or not v:
            continue
        f = date.fromisoformat(fin)
        if not (fecha - timedelta(days=VENTANA) <= f < fecha):   # las tres semanas de antes; sin las israelitas del día
            continue
        empresa, _, medio = firma.partition("/")
        encuestas.append({"empresa": empresa.strip(), "medio": medio.strip(), "ini": ini, "fin": fin,
                          "n": _numero(textos[2]) if len(textos) > 2 else None, "v": v, "e": e,
                          "cis": empresa.strip().upper().startswith("CIS"), "agregador": empresa.strip() in AGREGADORES})
    return encuestas, resultado, rotulos


def _error(v: dict, resultado: dict, partidos: list[str]) -> float | None:
    dif = [abs(v[p] - resultado[p]) for p in partidos if p in v and p in resultado]
    return round(sum(dif) / len(dif), 2) if len(dif) >= max(2, len(partidos) - 1) else None


def analizar() -> dict:
    out = []
    for eid, pagina, fecha, nombre in ELECCIONES:
        todas, res, rotulos = _tabla(eid, pagina, fecha)
        R = res["v"]
        partidos = [p for p, x in sorted(R.items(), key=lambda t: -t[1]) if x >= 2.5]
        # De cada empresa, su última encuesta antes de la elección.
        ultimas = {}
        for e in sorted(todas, key=lambda e: e["fin"]):
            ultimas[e["empresa"]] = e
        filas = []
        for e in ultimas.values():
            err = _error(e["v"], R, partidos)
            if err is None:
                continue
            filas.append({**e, "mae": err, "dif": {p: round(e["v"][p] - R[p], 2) for p in partidos if p in e["v"]}})
        filas.sort(key=lambda e: e["mae"])
        # La media «del consenso»: sin el CIS ni las medias de otros, como la de hoy.
        val = [e for e in filas if not e["cis"] and not e["agregador"]]
        media = {p: round(sum(e["v"][p] for e in val if p in e["v"]) / max(1, sum(1 for e in val if p in e["v"])), 2) for p in partidos}
        out.append({"id": eid, "nombre": nombre, "fecha": fecha.isoformat(), "resultado": {p: R[p] for p in partidos},
                    "escanos": {p: res["e"].get(p, [None])[0] for p in partidos}, "partidos": partidos,
                    "rotulos": {p: rotulos.get(p, p) for p in partidos}, "media": media,
                    "media_mae": _error(media, R, partidos), "media_dif": {p: round(media[p] - R[p], 2) for p in partidos},
                    "encuestas": filas})
    # Las empresas en todas las elecciones: su error medio y en cuántas estuvo.
    emp = {}
    for el in out:
        for e in el["encuestas"]:
            emp.setdefault(e["empresa"], []).append({"id": el["id"], "mae": e["mae"]})
    ranking = sorted(({"empresa": k, "n": len(v), "mae": round(sum(x["mae"] for x in v) / len(v), 2), "elecciones": v}
                      for k, v in emp.items()), key=lambda r: (-min(r["n"], 3), r["mae"]))
    return {"elecciones": out, "ranking": ranking}


def escenarios(acierto: dict, media_hoy: dict) -> dict:
    """La media de hoy corregida con el error que tuvo el consenso en cada elección, en los partidos que siguen
    (PP, PSOE, Vox y la izquierda de Sumar y Podemos, que se reparten el error de su espacio según su peso de hoy):
    «si las encuestas fallan como en…», con sus escaños."""
    from .proyeccion import base_2023, proyectar
    base = base_2023()
    out = {}
    for el in acierto["elecciones"]:
        m = dict(media_hoy)   # en puntos
        ajuste = {}
        for lin, d in el["media_dif"].items():
            if lin in ("PP", "PSOE", "VOX"):
                ajuste[lin] = -d
            elif lin == "IZQ":
                izq = [p for p in ("SUMAR", "PODEMOS") if m.get(p)]
                tot = sum(m[p] for p in izq) or 1
                for p in izq:
                    ajuste[p] = -d * m[p] / tot
        for p, d in ajuste.items():
            if p in m:
                m[p] = max(0.1, m[p] + d)
        _, esc = proyectar({p: v / 100 for p, v in m.items()}, base)
        out[el["id"]] = {"ajuste": {p: round(d, 2) for p, d in ajuste.items()}, "media": {p: round(v, 2) for p, v in m.items()},
                         "escanos": esc, "ppvox": esc.get("PP", 0) + esc.get("VOX", 0)}
    return out
