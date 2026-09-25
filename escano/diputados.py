"""Diputados en activo desde los datos abiertos del Congreso: circunscripción, formación y fecha de alta."""
from __future__ import annotations

import json
import re

from .config import BASE, DATOS
from .red import descargar

URL_PAGINA = BASE + "/es/opendata/diputados"
RE_ACTIVOS = re.compile(r"/webpublica/opendata/diputados/DiputadosActivos__\d+\.json")
FICHERO = DATOS / "diputados.json"


def leer_activos(datos: list[dict]) -> dict[str, dict]:
    """'Apellidos, Nombre' -> {circunscripcion, formacion, alta}."""
    salida = {}
    for d in datos:
        nombre = (d.get("NOMBRE") or "").strip()
        if not nombre:
            continue
        dia, mes, anio = (d.get("FECHAALTA") or "//").split("/")
        salida[nombre] = {
            "circunscripcion": (d.get("CIRCUNSCRIPCION") or "").strip(),
            "formacion": (d.get("FORMACIONELECTORAL") or "").strip(),
            "alta": f"{anio}-{mes}-{dia}" if anio else "",
            "biografia": " ".join((d.get("BIOGRAFIA") or "").split()),
        }
    return salida


def actualizar() -> dict[str, dict]:
    """Descarga la lista de diputados en activo y la guarda en data/diputados.json."""
    html = descargar(URL_PAGINA, cache=False)
    enlaces = sorted(set(RE_ACTIVOS.findall(html.decode("utf-8", "replace")))) if html else []
    if not enlaces:
        return leer()
    crudo = descargar(BASE + enlaces[-1], cache=False)
    activos = leer_activos(json.loads(crudo.decode("utf-8-sig")))
    FICHERO.parent.mkdir(parents=True, exist_ok=True)
    FICHERO.write_text(json.dumps(activos, ensure_ascii=False, indent=1))
    return activos


def leer() -> dict[str, dict]:
    return json.loads(FICHERO.read_text()) if FICHERO.exists() else {}
