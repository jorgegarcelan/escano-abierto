"""Preguntas escritas al Gobierno: quién pregunta y cuántas siguen sin contestar.

No están en los datos abiertos; salen del buscador de iniciativas del Congreso, que devuelve JSON de 25 en
25, de la más reciente a la más antigua. Cada pregunta trae su expediente (184/…), fechas de presentación y
de calificación, autores y el resultado de la tramitación, que queda vacío mientras el Gobierno no contesta
(«Tramitado por completo…» cuando ya lo ha hecho).

El buscador no pagina más allá de unas 14.500 filas, así que se recorre por meses de registro. La fecha de
la respuesta no viene en la fila, pero el buscador filtra por fecha de «cierre»: consultando día a día se
sabe cuándo se cerró cada pregunta, y con ello cuánto tardó el Gobierno.

El Reglamento (art. 190) da al Gobierno veinte días desde la publicación para contestar, prorrogables otros
veinte a petición suya.
"""
from __future__ import annotations

import html
import json
import re
import time
from datetime import date, timedelta

import requests

from .config import BASE, DATOS, USER_AGENT

URL = (BASE + "/es/busqueda-de-iniciativas?p_p_id=iniciativas&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view"
       "&p_p_resource_id=filtrarListado&p_p_cacheability=cacheLevelPage")
FICHERO = DATOS / "preguntas.json"
INICIO = date(2023, 8, 17)  # constitución de la XV Legislatura
RE_AUTOR = re.compile(r"^(.*?)\s*\(([^()]+)\)\s*$")
GRUPOS = {"GP": "PP", "GS": "PSOE", "GVOX": "VOX", "GSUMAR": "SUMAR", "GR": "ERC", "GJxCAT": "JUNTS",
          "GEH Bildu": "BILDU", "GV (EAJ-PNV)": "PNV", "GMx": "MIXTO"}


def _iso(f: str | None) -> str:
    if not f:
        return ""
    d, m, a = f.split("/")
    return f"{a}-{m}-{d}"


def estado(resultado: str | None) -> str:
    r = (resultado or "").lower()
    if not r:
        return "pendiente"
    if r.startswith("tramitado"):
        return "contestada"
    if "retirad" in r:
        return "retirada"
    if "caducad" in r or "extinguid" in r:
        return "caducada"
    return "otra"


def leer(fila: dict) -> dict:
    autores = []
    for a in re.split(r"\s*<br\s*/?>\s*", html.unescape(fila.get("autor") or "")):
        if m := RE_AUTOR.match(a.strip()):
            autores.append([m.group(1), GRUPOS.get(m.group(2), m.group(2))])
    return {"exp": fila["id_iniciativa"], "presentada": _iso(fila.get("fecha_presentado")),
            "calificada": _iso(fila.get("fecha_calificado")), "estado": estado(fila.get("resultado_tram")),
            "titulo": " ".join(html.unescape(fila.get("titulo") or "").split()), "autores": autores}


def pagina(sesion: requests.Session, n: int, filtros: dict) -> list[dict]:
    for intento in range(4):
        try:
            r = sesion.post(URL, timeout=60, data={"_iniciativas_legislatura": "15",
                                                   "_iniciativas_competencias": "Preguntas escritas",
                                                   "_iniciativas_paginaActual": str(n), **filtros})
            r.raise_for_status()
            filas = list((r.json().get("lista_iniciativas") or {}).values())
            return [leer(f) for f in filas if str(f.get("id_iniciativa", "")).startswith("184/")]
        except (requests.RequestException, ValueError):
            time.sleep(2 ** intento * 2)
    raise RuntimeError(f"No se pudo leer la página {n} de preguntas ({filtros})")


def recorrer(sesion: requests.Session, filtros: dict, pausa: float) -> list[dict]:
    out, n = [], 1
    while True:
        filas = pagina(sesion, n, filtros)
        out += filas
        if len(filas) < 25:
            return out
        n += 1
        time.sleep(pausa)


def _rango(tipo: int, desde: date, hasta: date) -> dict:
    """tipo: 0 = fecha de registro, 2 = fecha de cierre."""
    return {"_iniciativas_fechaDe": str(tipo), "_iniciativas_fechaDesde": desde.strftime("%d/%m/%Y"),
            "_iniciativas_fechaHasta": hasta.strftime("%d/%m/%Y")}


def _meses(desde: date, hasta: date):
    d = desde.replace(day=1)
    while d <= hasta:
        sig = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
        yield d, min(sig - timedelta(days=1), hasta)
        d = sig


def actualizar(completo: bool = False, pausa: float = 0.4, aviso=print, hoy: date | None = None) -> dict:
    """Sin `completo`, repasa lo registrado en los dos últimos meses y lo cerrado en los últimos 45 días."""
    hoy = hoy or date.today()
    datos = leer_todo()
    por_exp = {p["exp"]: p for p in datos["preguntas"]}
    sesion = requests.Session()
    sesion.headers["User-Agent"] = USER_AGENT
    sesion.get(BASE + "/es/busqueda-de-iniciativas", timeout=60)  # cookie de sesión del buscador

    inicio = INICIO if completo else hoy - timedelta(days=62)
    for a, b in _meses(inicio, hoy):
        for p in recorrer(sesion, _rango(0, a, b), pausa):
            cerrada = por_exp.get(p["exp"], {}).get("cerrada")
            por_exp[p["exp"]] = {**p, **({"cerrada": cerrada} if cerrada and p["estado"] != "pendiente" else {})}
        aviso(f"  registradas en {a:%Y-%m}: {len(por_exp)} en total")
        time.sleep(pausa)

    # Fecha de cierre, día a día: cuándo se dio por contestada (o retirada) cada pregunta.
    dia = INICIO if completo else hoy - timedelta(days=45)
    while dia <= hoy:
        for p in recorrer(sesion, _rango(2, dia, dia), pausa):
            por_exp.setdefault(p["exp"], p)["cerrada"] = dia.isoformat()
        if dia.day == 1:
            aviso(f"  cierres hasta {dia:%Y-%m}")
        dia += timedelta(days=1)
        time.sleep(pausa)

    datos = {"preguntas": sorted(por_exp.values(), key=lambda p: p["exp"])}
    guardar(datos)
    return datos


def guardar(datos: dict) -> None:
    # Una pregunta por línea: son decenas de miles y así los cambios diarios son diffs pequeños.
    cuerpo = ",\n".join(json.dumps(p, ensure_ascii=False) for p in datos["preguntas"])
    FICHERO.write_text('{"preguntas": [\n' + cuerpo + "\n]}\n")


def leer_todo() -> dict:
    return json.loads(FICHERO.read_text()) if FICHERO.exists() else {"preguntas": []}
