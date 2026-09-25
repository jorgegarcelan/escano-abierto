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


def derivar(v: dict) -> dict:
    """Completa `v` con lo que se deduce de sus votos: posición y recuento por grupo, y discrepantes."""
    por_grupo: dict[str, Counter] = defaultdict(Counter)
    for d in v["votos"]:
        por_grupo[d["grupo"]][d["voto"]] += 1
    posiciones = {g: posicion_grupo(c) for g, c in por_grupo.items()}
    v["grupos"] = posiciones
    v["conteo"] = {g: dict(c) for g, c in por_grupo.items()}
    v["discrepantes"] = [
        d for d in v["votos"]
        if posiciones.get(d["grupo"]) in ("S", "N", "A") and d["voto"] in "SNA" and d["voto"] != posiciones[d["grupo"]]
    ]
    return v


def leer_votacion(datos: dict, url: str = "") -> dict:
    info, tot = datos.get("informacion", {}), datos.get("totales", {})
    votos = []
    for fila in datos.get("votaciones", []):
        asiento = str(fila.get("asiento", "")).strip()
        votos.append({"diputado": fila.get("diputado", "").strip(), "grupo": grupo_corto(fila.get("grupo", "")),
                      "voto": normaliza_voto(fila.get("voto", "")),
                      "asiento": int(asiento) if asiento.isdigit() else None})
    d, m, a = (int(x) for x in str(info.get("fecha", "1/1/2000")).split("/"))
    texto = info.get("textoExpediente", "") or ""
    exp = RE_EXP.search(texto)
    si, no = int(tot.get("afavor", 0) or 0), int(tot.get("enContra", 0) or 0)
    return derivar({
        "id": f"{info.get('sesion')}-{info.get('numeroVotacion')}",
        "sesion": info.get("sesion"),
        "numero": info.get("numeroVotacion"),
        "fecha": date(a, m, d).isoformat(),
        "tipo": (info.get("titulo") or "").rstrip("."),
        "titulo": texto,
        "subgrupo": (info.get("textoSubGrupo") or "").strip().rstrip("."),
        "exp": exp.group(1) if exp else None,
        "asentimiento": tot.get("asentimiento") == "Sí",
        "si": si,
        "no": no,
        "abst": int(tot.get("abstenciones", 0) or 0),
        "novota": int(tot.get("noVotan", 0) or 0),
        "aprobada": si > no,
        "votos": votos,
        "json": url,
    })


# ---------------------------------------------------------------- almacenamiento
#
# Un fichero por día en data/votaciones/AAAA-MM-DD.json, compacto para que la legislatura entera quepa en
# el repositorio: la lista de diputados del día (nombre, grupo, escaño) va una vez, y cada votación lleva
# una letra por diputado de esa lista en `v` (S, N, A, X = no vota, - = no figura).

DERIVADOS = ("votos", "grupos", "conteo", "discrepantes")


def compactar(votaciones: list[dict]) -> dict:
    lista: dict[str, list] = {}
    for v in votaciones:
        for d in v["votos"]:
            lista.setdefault(d["diputado"], [d["diputado"], d["grupo"], d.get("asiento")])
    orden = {n: i for i, n in enumerate(lista)}
    salida = []
    for v in votaciones:
        letras = ["-"] * len(orden)
        for d in v["votos"]:
            letras[orden[d["diputado"]]] = d["voto"]
        salida.append({**{k: x for k, x in v.items() if k not in DERIVADOS}, "v": "".join(letras)})
    return {"diputados": list(lista.values()), "votaciones": salida}


def expandir(datos: dict | list) -> list[dict]:
    if isinstance(datos, list):  # formato anterior: votos con nombre, uno a uno
        return datos
    dips = datos["diputados"]
    salida = []
    for v in datos["votaciones"]:
        v = dict(v)
        letras = v.pop("v")
        v["votos"] = [{"diputado": n, "grupo": g, "voto": x, "asiento": a}
                      for (n, g, a), x in zip(dips, letras) if x != "-"]
        salida.append(derivar(v))
    return salida


def guardar_dia(fecha: str, votaciones: list[dict]) -> None:
    VOTACIONES.mkdir(parents=True, exist_ok=True)
    datos = compactar(votaciones)
    texto = ('{"diputados": [\n' + ",\n".join(json.dumps(d, ensure_ascii=False) for d in datos["diputados"])
             + '\n],\n"votaciones": [\n' + ",\n".join(json.dumps(v, ensure_ascii=False) for v in datos["votaciones"])
             + "\n]}\n")
    (VOTACIONES / f"{fecha}.json").write_text(texto)


def leer_dia(ruta) -> list[dict]:
    return expandir(json.loads(ruta.read_text()))


def leer_todas() -> list[dict]:
    return [v for f in sorted(VOTACIONES.glob("*.json")) for v in leer_dia(f)]


def actualizar_dia(fecha: date) -> list[dict]:
    """Descarga y guarda todas las votaciones de `fecha` en data/votaciones/AAAA-MM-DD.json."""
    salida = []
    for url in enlaces_del_dia(fecha):
        crudo = descargar(url)
        if crudo:
            salida.append(leer_votacion(json.loads(crudo.decode("utf-8-sig")), url))
    if salida:
        guardar_dia(fecha.isoformat(), salida)
    return salida


def mapa_diputados() -> dict[str, str]:
    """Apellidos normalizados -> grupo, a partir de todas las votaciones guardadas.

    El Diario de Sesiones identifica a los oradores por sus apellidos en mayúsculas
    ('El señor NÚÑEZ FEIJÓO:'), y los JSON de votaciones traen 'Núñez Feijóo, Alberto' y su grupo.
    """
    mapa: dict[str, str] = {}
    for v in leer_todas():
        for fila in v.get("votos", []):
            mapa[_sin_tildes(fila["diputado"].split(",")[0])] = fila["grupo"]
    return mapa
