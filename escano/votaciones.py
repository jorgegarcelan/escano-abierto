"""Votaciones del Pleno desde los datos abiertos del Congreso.

Cada votación se publica como JSON con esta forma:

    {"informacion": {"sesion", "numeroVotacion", "fecha", "titulo", "textoExpediente"},
     "totales": {"asentimiento", "presentes", "afavor", "enContra", "abstenciones", "noVotan"},
     "votaciones": [{"asiento", "diputado", "grupo", "voto"}, ...]}
"""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date

from .config import BASE, LEGISLATURA_ROMANA, URL_VOTACIONES_DIA, VOTACIONES, grupo_corto
from .red import descargar

RE_JSON = re.compile(r"/webpublica/opendata/votaciones/Leg\d+/Sesion\d+/\d{8}/Votacion\d+/VOT_\d+\.json")
RE_EXP = re.compile(r"\b(\d{3}/\d{6})\b")


def _sin_tildes(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def normaliza_voto(v: str) -> str:
    v = _sin_tildes(v or "").strip()
    if v.startswith("si"):
        return "S"
    if v.startswith("no vota") or v == "novota":
        return "X"
    if v.startswith("no"):
        return "N"
    if v.startswith("abst"):
        return "A"
    return "X"


def enlaces_del_dia(fecha: date) -> list[str]:
    """URLs de los JSON de todas las votaciones celebradas en `fecha`."""
    url = URL_VOTACIONES_DIA.format(leg=LEGISLATURA_ROMANA, fecha=fecha.strftime("%d/%m/%Y"))
    html = descargar(url, cache=False)
    if not html:
        return []
    rutas = sorted(set(RE_JSON.findall(html.decode("utf-8", "replace"))))
    # Solo las del día pedido: la página puede mostrar la última sesión si no hubo votaciones ese día.
    marca = fecha.strftime("%Y%m%d")
    return [BASE + r for r in rutas if f"/{marca}/" in r]


def posicion_grupo(conteo: dict[str, int], umbral: float = 0.8) -> str:
    """Sentido mayoritario del grupo: S/N/A, o D (dividido) si nadie llega al umbral."""
    emitidos = {k: v for k, v in conteo.items() if k in "SNA"}
    total = sum(emitidos.values())
    if not total:
        return "X"
    sentido, n = max(emitidos.items(), key=lambda kv: kv[1])
    return sentido if n / total >= umbral else "D"


def leer_votacion(datos: dict, url: str = "") -> dict:
    info, tot = datos.get("informacion", {}), datos.get("totales", {})
    votos = []
    por_grupo: dict[str, Counter] = defaultdict(Counter)
    for fila in datos.get("votaciones", []):
        g = grupo_corto(fila.get("grupo", ""))
        v = normaliza_voto(fila.get("voto", ""))
        votos.append({"diputado": fila.get("diputado", "").strip(), "grupo": g, "voto": v})
        por_grupo[g][v] += 1

    posiciones = {g: posicion_grupo(c) for g, c in por_grupo.items()}
    discrepantes = [
        v for v in votos
        if posiciones.get(v["grupo"]) in ("S", "N", "A") and v["voto"] in "SNA" and v["voto"] != posiciones[v["grupo"]]
    ]
    d, m, a = (int(x) for x in str(info.get("fecha", "1/1/2000")).split("/"))
    texto = info.get("textoExpediente", "") or ""
    exp = RE_EXP.search(texto)
    si, no = int(tot.get("afavor", 0) or 0), int(tot.get("enContra", 0) or 0)
    return {
        "id": f"{info.get('sesion')}-{info.get('numeroVotacion')}",
        "sesion": info.get("sesion"),
        "numero": info.get("numeroVotacion"),
        "fecha": date(a, m, d).isoformat(),
        "tipo": (info.get("titulo") or "").rstrip("."),
        "titulo": texto,
        "exp": exp.group(1) if exp else None,
        "asentimiento": tot.get("asentimiento") == "Sí",
        "si": si,
        "no": no,
        "abst": int(tot.get("abstenciones", 0) or 0),
        "novota": int(tot.get("noVotan", 0) or 0),
        "aprobada": si > no,
        "grupos": posiciones,
        "conteo": {g: dict(c) for g, c in por_grupo.items()},
        "discrepantes": discrepantes,
        "votos": votos,
        "json": url,
    }


def actualizar_dia(fecha: date) -> list[dict]:
    """Descarga y guarda todas las votaciones de `fecha` en data/votaciones/AAAA-MM-DD.json."""
    salida = []
    for url in enlaces_del_dia(fecha):
        crudo = descargar(url)
        if crudo:
            salida.append(leer_votacion(json.loads(crudo.decode("utf-8-sig")), url))
    if salida:
        VOTACIONES.mkdir(parents=True, exist_ok=True)
        (VOTACIONES / f"{fecha.isoformat()}.json").write_text(json.dumps(salida, ensure_ascii=False, indent=1))
    return salida


def mapa_diputados() -> dict[str, str]:
    """Apellidos normalizados -> grupo, a partir de todas las votaciones guardadas.

    El Diario de Sesiones identifica a los oradores por sus apellidos en mayúsculas
    ('El señor NÚÑEZ FEIJÓO:'), y los JSON de votaciones traen 'Núñez Feijóo, Alberto' y su grupo.
    """
    mapa: dict[str, str] = {}
    for f in sorted(VOTACIONES.glob("*.json")):
        for v in json.loads(f.read_text()):
            for fila in v.get("votos", []):
                apellidos = fila["diputado"].split(",")[0]
                mapa[_sin_tildes(apellidos)] = fila["grupo"]
    return mapa
