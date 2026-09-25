"""La semana en el Congreso: un resumen por semana, sin IA, a partir de votaciones, sesiones y tramitación.

Se calcula aquí (y no en la web) para que la página de cada semana, su tarjeta para compartir y el RSS
cuenten exactamente lo mismo.
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import date, timedelta


def id_semana(iso: str) -> str:
    a, s, _ = date.fromisoformat(iso).isocalendar()
    return f"{a}-S{s:02d}"


def lunes_de(id_: str) -> date:
    a, s = id_.split("-S")
    return date.fromisocalendar(int(a), int(s), 1)


def margen(v: dict) -> int:
    return abs(v["si"] - v["no"])


def aprobada(v: dict) -> bool:
    return v["si"] > v["no"]


def _nombre(discrepante: str) -> str:
    return re.sub(r"\s*\([^()]*\)$", "", discrepante)


def _legible(n: str) -> str:
    return " ".join(reversed(n.split(", "))) if ", " in n else n


def eventos_de_leyes(leyes: list[dict], desde: str, hasta: str) -> list[dict]:
    """Hitos de tramitación dentro de [desde, hasta]: tomas en consideración, aprobaciones, final del trámite."""
    out = []
    dentro = lambda f: bool(f) and desde <= f <= hasta
    for ley in leyes:
        evento = None
        if ley["estado"] != "en trámite" and dentro(ley.get("fecha_resultado")):
            evento = {"aprobada": "Es ley: termina su tramitación", "rechazada": "Rechazada", "retirada": "Retirada",
                      "decaída": "Decae"}.get(ley["estado"])
        for f in ley["fases"]:
            if evento:
                break
            if dentro(f["desde"]) and f["fase"].startswith("Aprobación"):
                evento = "Aprobada en el Congreso" + (" (en comisión)" if "competencia" in f["fase"] else "")
            elif dentro(f["desde"]) and f["fase"].startswith("Acuerdo subsiguiente"):
                evento = "Tomada en consideración"
            elif dentro(f["desde"]) and f["organo"] == "Senado" and ley["origen"] != "SEN":
                evento = "Pasa al Senado"
        if evento:
            out.append({"exp": ley["exp"], "titulo": ley["titulo"], "evento": evento, "estado": ley["estado"]})
    orden = ["Es ley: termina su tramitación", "Aprobada en el Congreso", "Aprobada en el Congreso (en comisión)",
             "Pasa al Senado", "Tomada en consideración", "Rechazada", "Decae", "Retirada"]
    return sorted(out, key=lambda e: orden.index(e["evento"]))


def titular(s: dict, votos: dict[str, dict]) -> str:
    derogados = [votos[x] for x in s["rdl"] if not aprobada(votos[x])]
    leyes = [e for e in s["leyes"] if e["evento"].startswith("Es ley")]
    ajustada = votos[s["ajustadas"][0]] if s["ajustadas"] else None
    if derogados:
        return f"El Congreso tumba el {derogados[0]['titulo'].split(' por ')[0].split(' de ')[0]}"
    if leyes:
        return f"{leyes[0]['titulo']}: termina su tramitación" if len(leyes) == 1 else f"{len(leyes)} leyes terminan su tramitación"
    if ajustada and margen(ajustada) <= 10:
        return f"«{ajustada['titulo']}» se decide por {ajustada['si']} a {ajustada['no']}"
    if s["votaciones"]:
        n = len(s["votaciones"])
        return f"{n} votaciones en el Pleno: {s['aprobadas']} aprobadas y {n - s['aprobadas']} rechazadas"
    return f"{len(s['sesiones'])} sesiones de trabajo, sin votaciones en el Pleno"


def calcular(votaciones: list[dict], sesiones: list[dict], ivs: list[dict], leyes: list[dict],
             diputados: list[list]) -> list[dict]:
    """Una entrada por semana con actividad, de la más antigua a la más reciente."""
    indice = {d[0]: i for i, d in enumerate(diputados)}
    votos = {v["id"]: v for v in votaciones}
    fecha_ses = {s["id"]: s["fecha"] for s in sesiones}
    semanas: dict[str, dict] = {}
    nueva = lambda k: semanas.setdefault(k, {"id": k, "votaciones": [], "sesiones": [], "ivs": []})
    for v in sorted(votaciones, key=lambda v: (v["fecha"], v["id"])):
        nueva(id_semana(v["fecha"]))["votaciones"].append(v)
    for s in sorted(sesiones, key=lambda s: s["fecha"]):
        nueva(id_semana(s["fecha"]))["sesiones"].append(s["id"])
    for i in ivs:
        if i["s"] in fecha_ses:
            nueva(id_semana(fecha_ses[i["s"]]))["ivs"].append(i)

    salida = []
    for k in sorted(semanas):
        w = semanas[k]
        lunes = lunes_de(k)
        desde, hasta = lunes.isoformat(), (lunes + timedelta(days=6)).isoformat()
        vs = w["votaciones"]
        rebeldes = Counter(_nombre(d) for v in vs for d in v.get("discrepantes", []))
        citas = sorted((i for i in w["ivs"] if i.get("cita")), key=lambda i: -int(i.get("int") or 0))[:3]
        temas = Counter(t.lower() for i in w["ivs"] if i["g"] not in ("COMP", "?", "MESA") for t in set(i["temas"]))
        s = {
            "id": k, "desde": desde, "hasta": hasta,
            "fechas": sorted({v["fecha"] for v in vs} | {fecha_ses[x] for x in w["sesiones"]}),
            "votaciones": [v["id"] for v in vs],
            "aprobadas": sum(aprobada(v) for v in vs),
            "ajustadas": [v["id"] for v in sorted(vs, key=lambda v: (margen(v), v["id"]))[:3] if v["si"] + v["no"] > 100],
            "rdl": [v["id"] for v in vs if v["tipo"] == "Convalidación RDL" and not v["titulo"].startswith("Tramitar")],
            "tomas": [v["id"] for v in vs if v["tipo"] == "Toma en consideración"],
            "discrepancias": sum(rebeldes.values()),
            "rebeldes": [[indice[n], c] for n, c in rebeldes.most_common(5) if n in indice],
            "sesiones": w["sesiones"],
            "intervenciones": len(w["ivs"]),
            "citas": [{"orador": i["orador"], "g": i["g"], "cita": i["cita"], "s": i["s"]} for i in citas],
            "temas": temas.most_common(6),
            "leyes": eventos_de_leyes(leyes, desde, hasta),
        }
        s["titular"] = titular(s, votos)
        salida.append(s)
    return salida
