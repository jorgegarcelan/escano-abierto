"""Elecciones generales del 29 de noviembre de 2026: datos de la sección «Elecciones» de la web.

Todo sale de fuentes oficiales y se escribe en site/datos/elecciones/:

- `elecciones.json`: el calendario electoral (LOREG), lo que caduca con la disolución, los decretos-leyes que
  tendrá que convalidar la Diputación Permanente y el balance de la legislatura.
- `geo-provincias.json` y `geo-municipios.json`: los mapas, ya proyectados (ver geo.py).

La disolución deja caducados todos los asuntos pendientes del Congreso (art. 207 del Reglamento), salvo los que
deba conocer la Diputación Permanente (los decretos-leyes) y las iniciativas legislativas populares.
"""
from __future__ import annotations

import json
import shutil
from collections import Counter
from datetime import date, timedelta

from .config import DATOS, SITIO

CARPETA = DATOS / "elecciones"          # lo versionado (geometrías, resultados oficiales procesados)
SALIDA = SITIO / "datos" / "elecciones"

# Real Decreto de disolución y convocatoria (BOE del 6 de octubre de 2026). Los plazos de la LOREG se cuentan
# desde el día de la publicación.
CONVOCATORIA = date(2026, 10, 6)
VOTACION = date(2026, 11, 29)


def calendario(conv: date = CONVOCATORIA, votacion: date = VOTACION) -> list[dict]:
    """Los hitos del proceso electoral, con el artículo de la LOREG que los fija."""
    d = lambda n: (conv + timedelta(days=n)).isoformat()
    antes = lambda n: (votacion - timedelta(days=n)).isoformat()
    return [
        {"fecha": conv.isoformat(), "hito": "Disolución y convocatoria",
         "detalle": "El BOE publica el Real Decreto: el Congreso y el Senado quedan disueltos y caducan los asuntos pendientes.",
         "ley": "art. 42"},
        {"fecha": d(15), "hasta": d(20), "hito": "Presentación de candidaturas",
         "detalle": "Los partidos, federaciones, coaliciones y agrupaciones entregan sus listas en cada Junta Electoral Provincial.",
         "ley": "art. 45"},
        {"fecha": d(22), "hito": "Listas presentadas en el BOE",
         "detalle": "Se publican todas las candidaturas presentadas, provincia por provincia.", "ley": "art. 47.1"},
        {"fecha": d(27), "hito": "Proclamación de candidaturas",
         "detalle": "Las Juntas Electorales proclaman las listas válidas; el BOE las publica al día siguiente.",
         "ley": "art. 47.4"},
        {"fecha": (votacion - timedelta(days=16)).isoformat(), "hasta": antes(2), "hito": "Campaña electoral",
         "detalle": "Quince días, de las 0.00 del día 38 tras la convocatoria a las 24.00 del viernes antes de votar.",
         "ley": "art. 51"},
        {"fecha": antes(10), "hito": "Último día para pedir el voto por correo",
         "detalle": "Se pide en cualquier oficina de Correos, en persona o con certificado electrónico.", "ley": "art. 72"},
        {"fecha": antes(4), "hito": "Último día para enviar el voto por correo", "ley": "art. 73"},
        {"fecha": antes(1), "hito": "Jornada de reflexión", "detalle": "Sin campaña ni propaganda.", "ley": "art. 53"},
        {"fecha": votacion.isoformat(), "hito": "Votación",
         "detalle": "Los colegios abren de 9.00 a 20.00. El escrutinio provisional empieza al cerrar las mesas.",
         "ley": "art. 84"},
        {"fecha": (votacion + timedelta(days=25)).isoformat(), "hito": "Constitución de las nuevas Cortes",
         "detalle": "Como tarde 25 días después de la votación, en la fecha que fija el Real Decreto. Empieza la XVI legislatura.",
         "ley": "art. 68.6 CE", "aprox": True},
    ]


def caducan(leyes: dict, disolucion: date = CONVOCATORIA) -> dict:
    """Proyectos y proposiciones de ley que la disolución deja sin terminar.

    Antes de que el Congreso actualice sus datos abiertos aparecen como «en trámite»; después, como «caducada».
    """
    vivas = [i for i in leyes.get("iniciativas", []) if i["estado"] in ("en trámite", "caducada")
             and "popular" not in i.get("titulo", "").lower()[:60]]
    dias = lambda i: (disolucion - date.fromisoformat(i["presentada"])).days if i.get("presentada") else None
    lista = sorted(vivas, key=lambda i: (-i["etapa"], -(i.get("ampliaciones") or 0), i["exp"]))
    return {
        "total": len(vivas),
        "proyectos": sum(i["tipo"] == "Proyecto de ley" for i in vivas),
        "proposiciones": sum(i["tipo"] != "Proyecto de ley" for i in vivas),
        "por_origen": dict(Counter(i["origen"] for i in vivas).most_common()),
        "por_autor": dict(Counter(a for i in vivas for a in i["autores"]).most_common()),
        "por_etapa": [sum(i["etapa"] == k for i in vivas) for k in range(6)],
        "congelador": sum((i.get("ampliaciones") or 0) >= 10 for i in vivas),
        "max_ampliaciones": max((i.get("ampliaciones") or 0 for i in vivas), default=0),
        "dias_medio": round(sum(dias(i) or 0 for i in vivas) / len(vivas)) if vivas else 0,
        # exp, título, tipo, origen, autores, presentada, etapa, ampliaciones, días en trámite, comisión
        "lista": [[i["exp"], i["titulo"], "PL" if i["tipo"] == "Proyecto de ley" else "PPL", i["origen"], i["autores"],
                   i.get("presentada", ""), i["etapa"], i.get("ampliaciones") or 0, dias(i), i.get("comision", "")]
                  for i in lista],
    }


def pendientes_de_convalidar(leyes: dict, votaciones: list[dict], hoy: date | None = None) -> list[dict]:
    """Reales decretos-leyes publicados y aún sin votación de convalidación: los heredará la Diputación Permanente."""
    import re
    hoy = hoy or date.today()
    votados = set()
    for v in votaciones:
        if v.get("tipo", "").startswith("Convalidación"):
            for m in re.finditer(r"(?:Real Decreto-ley|RDL)\s+(\d+/\d{4})", v.get("texto", "") + " " + v.get("titulo", "")):
                votados.add(m.group(1))
    out = []
    for a in leyes.get("aprobadas", []):
        if not _es_rdl(a) or a["numero"] in votados or not a.get("fecha"):
            continue
        publicado = date.fromisoformat(a["fecha"])
        if (hoy - publicado).days > 45:   # los de hace más de 30 días hábiles ya se votaron (o decayeron)
            continue
        out.append({"numero": a["numero"], "titulo": a["titulo"], "fecha": a["fecha"], "pdf": a.get("pdf", ""),
                    # 30 días hábiles desde su promulgación para convalidarlo (art. 86 CE); se cuenta en naturales
                    # aproximados: el plazo exacto lo da el Congreso.
                    "limite_aprox": (publicado + timedelta(days=30)).isoformat()})
    return out


def _es_rdl(a: dict) -> bool:
    """El texto de un real decreto-ley (no las resoluciones que publican su convalidación o derogación)."""
    return a["tipo"] == "Real decreto-ley" and a["titulo"].startswith("Real Decreto-ley")


def balance(salida: dict) -> dict:
    """La XV legislatura en cifras, de la sesión constitutiva a la disolución."""
    d = salida["datos"]
    votos = d["votaciones"]
    plenos = {v["fecha"] for v in votos}
    margen = lambda v: abs(v["si"] - v["no"])
    ajustadas = [v for v in votos if v["si"] + v["no"] > 300 and margen(v) <= 10]
    leyes = salida.get("leyes") or {"iniciativas": [], "aprobadas": []}
    aprobadas = Counter(a["tipo"] for a in leyes["aprobadas"] if a["tipo"] != "Real decreto-ley" or _es_rdl(a))
    resoluciones = [a["titulo"] for a in leyes["aprobadas"] if a["tipo"] == "Real decreto-ley" and not _es_rdl(a)]
    preguntas = salida.get("preguntas") or []
    estrecha = min(votos, key=lambda v: (margen(v), -(v["si"] + v["no"])), default=None)
    return {
        "desde": "2023-08-17", "hasta": CONVOCATORIA.isoformat(),
        "plenos": len(plenos), "votaciones": len(votos), "ajustadas": len(ajustadas),
        "sesiones": len(d["sesiones"]), "intervenciones": len(salida.get("intervenciones") or []),
        "leyes": aprobadas.get("Ley", 0), "leyes_organicas": aprobadas.get("Ley orgánica", 0),
        "decretos_ley": aprobadas.get("Real decreto-ley", 0),
        "convalidados": sum("de convalidación" in t for t in resoluciones),
        "derogados": sum("de derogación" in t for t in resoluciones),
        "preguntas": len(preguntas), "sin_respuesta": sum(p.get("estado") == "pendiente" for p in preguntas),
        "diputados": len(d["diputados"]),
        "mas_ajustada": {"id": estrecha["id"], "fecha": estrecha["fecha"], "titulo": estrecha["titulo"],
                         "si": estrecha["si"], "no": estrecha["no"]} if estrecha else None,
    }


def escribir(salida: dict) -> None:
    """Escribe los datos de la sección y copia las geometrías versionadas."""
    SALIDA.mkdir(parents=True, exist_ok=True)
    leyes = salida.get("leyes") or {"iniciativas": [], "aprobadas": []}
    datos = {
        "convocatoria": CONVOCATORIA.isoformat(), "votacion": VOTACION.isoformat(),
        "calendario": calendario(),
        "caducan": caducan(leyes),
        "convalidar": pendientes_de_convalidar(leyes, salida["datos"]["votaciones"]),
        "balance": balance(salida),
        # Qué piezas que llegan más tarde ya están (la web no pide lo que no existe).
        "hay": {n: (CARPETA / f"{n}.json").exists() for n in ("candidaturas", "promesas", "resultados")},
    }
    (SALIDA / "elecciones.json").write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
    for f in sorted(CARPETA.glob("*.json")):
        shutil.copyfile(f, SALIDA / f.name)


# ---------- reparto de escaños (art. 163 de la LOREG) ----------

def dhondt(votos: dict[str, int], escanos: int, validos: int | None = None, barrera: float = 0.03) -> dict:
    """Reparto D'Hondt de una circunscripción.

    `votos`: votos de cada candidatura; `validos`: votos válidos (candidaturas + en blanco), sobre los que se mide
    la barrera del 3 %. Devuelve los escaños de cada candidatura, los cocientes ganadores en orden y el último
    escaño: quién lo ganó, quién se quedó más cerca y cuántos votos más le habrían hecho falta.
    """
    validos = validos if validos is not None else sum(votos.values())
    entran = {c: v for c, v in votos.items() if v > 0 and v >= barrera * validos}
    cocientes = sorted(((v / d, v, c) for c, v in entran.items() for d in range(1, escanos + 1)),
                       key=lambda t: (-t[0], -t[1], t[2]))
    ganadores = cocientes[:escanos]
    reparto: dict[str, int] = {}
    for _, _, c in ganadores:
        reparto[c] = reparto.get(c, 0) + 1
    ultimo = None
    if ganadores:
        q, _, quien = ganadores[-1]
        # El primer cociente que se quedó fuera, de una candidatura distinta a la que ganó el último escaño.
        siguiente = next(((q2, c2) for q2, _, c2 in cocientes[escanos:] if c2 != quien), None)
        if siguiente:
            _, otro = siguiente
            # Votos que le faltaban a `otro` para que su siguiente cociente superara al último ganador.
            faltan = int(q * (reparto.get(otro, 0) + 1)) - entran[otro] + 1
            ultimo = {"gana": quien, "cociente": round(q, 2), "segundo": otro, "faltan": max(faltan, 1)}
        else:
            ultimo = {"gana": quien, "cociente": round(q, 2)}
    return {"escanos": reparto, "ultimo": ultimo,
            "fuera": sorted(c for c, v in votos.items() if v > 0 and c not in entran)}


def votos_sin_escano(votos: dict[str, int], reparto: dict[str, int]) -> int:
    """Votos a candidaturas que se quedaron sin ningún escaño en la circunscripción."""
    return sum(v for c, v in votos.items() if not reparto.get(c))
