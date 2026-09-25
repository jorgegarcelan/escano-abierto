"""Diputados de la legislatura desde los datos abiertos del Congreso: circunscripción, formación, alta y baja."""
from __future__ import annotations

import json
import re

from .config import BASE, DATOS
from .red import descargar

URL_PAGINA = BASE + "/es/opendata/diputados"
RE_ACTIVOS = re.compile(r"/webpublica/opendata/diputados/DiputadosActivos__\d+\.json")
RE_BAJAS = re.compile(r"/webpublica/opendata/diputados/DiputadosDeBaja__\d+\.json")
FICHERO = DATOS / "diputados.json"


def _iso(f: str | None) -> str:
    dia, mes, anio = ((f or "").strip() + "//").split("/")[:3]
    return f"{anio}-{int(mes):02d}-{int(dia):02d}" if anio else ""


def leer_activos(datos: list[dict]) -> dict[str, dict]:
    """'Apellidos, Nombre' -> {circunscripcion, formacion, alta, biografia[, baja]}."""
    salida = {}
    for d in datos:
        nombre = (d.get("NOMBRE") or "").strip()
        if not nombre:
            continue
        salida[nombre] = {
            "circunscripcion": (d.get("CIRCUNSCRIPCION") or "").strip(),
            "formacion": (d.get("FORMACIONELECTORAL") or "").strip(),
            "alta": _iso(d.get("FECHAALTA")),
            "biografia": " ".join((d.get("BIOGRAFIA") or "").split()),
        }
        if d.get("FECHABAJA"):
            salida[nombre]["baja"] = _iso(d["FECHABAJA"])
    return salida


def actualizar() -> dict[str, dict]:
    """Descarga los diputados en activo y los de baja y los guarda en data/diputados.json."""
    html = descargar(URL_PAGINA, cache=False)
    texto = html.decode("utf-8", "replace") if html else ""
    enlaces = sorted(set(RE_ACTIVOS.findall(texto)))
    if not enlaces:
        return leer()
    todos = {}
    bajas = sorted(set(RE_BAJAS.findall(texto)))
    if bajas:
        todos.update(leer_activos(json.loads(descargar(BASE + bajas[-1], cache=False).decode("utf-8-sig"))))
    activos = leer_activos(json.loads(descargar(BASE + enlaces[-1], cache=False).decode("utf-8-sig")))
    todos.update({n: {k: x for k, x in d.items() if k != "baja"} for n, d in activos.items()})  # quien vuelve, manda el alta
    FICHERO.parent.mkdir(parents=True, exist_ok=True)
    FICHERO.write_text(json.dumps(todos, ensure_ascii=False, indent=1))
    return todos


def leer() -> dict[str, dict]:
    return json.loads(FICHERO.read_text()) if FICHERO.exists() else {}
