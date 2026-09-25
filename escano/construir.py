"""Une Diarios, análisis y votaciones en site/data.json, el único fichero que lee la web."""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date

from . import diputados as mod_diputados
from .analisis import analizar, resumir_sesion
from .config import INFO_GRUPOS, SESIONES, SITIO, VOTACIONES

PARLAMENTARIOS = ["PSOE", "PP", "VOX", "SUMAR", "ERC", "JUNTS", "BILDU", "PNV", "MIXTO"]
PROPONENTES = [
    (r"socialista", "PSOE"), (r"popular", "PP"), (r"vox", "VOX"), (r"sumar", "SUMAR"),
    (r"republicano", "ERC"), (r"junts", "JUNTS"), (r"bildu", "BILDU"), (r"vasco|pnv", "PNV"),
    (r"mixto", "MIXTO"), (r"real decreto|gobierno", "GOB"),
]
TIPOS = [
    (r"no de ley", "Proposición no de ley"),
    (r"moci[oó]n", "Moción"),
    (r"decreto", "Convalidación RDL"),
    (r"enmiendas? del senado", "Enmiendas del Senado"),
    (r"dictamen", "Dictamen"),
    (r"proposici[oó]n(es)? de ley|toma en consideraci", "Toma en consideración"),
    (r"proyecto de ley", "Proyecto de ley"),
]


def _palabras(s: str) -> set[str]:
    s = "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")
    return {w for w in re.findall(r"[a-z0-9]{4,}", s)}


def parecido(a: str, b: str) -> float:
    pa, pb = _palabras(a), _palabras(b)
    return len(pa & pb) / max(1, min(len(pa), len(pb)))


def proponente(texto: str) -> str | None:
    t = texto.lower()
    m = re.search(r"grupo parlamentario ([^,.(]+)", t)
    objetivo = m.group(1) if m else t[:120]
    for patron, g in PROPONENTES:
        if re.search(patron, objetivo):
            return g
    return None


def tipo_votacion(v: dict) -> str:
    for texto in (v["tipo"], v["titulo"][:80]):
        for patron, nombre in TIPOS:
            if re.search(patron, texto, re.I):
                return nombre
    return v["tipo"] or "Votación"


def titulo_legible(item: str) -> str:
    t = re.sub(r"\(Número de expediente[^)]*\)\.?", "", item).strip(" —.")
    return t[:1].upper() + t[1:].lower() if t.isupper() else t


def diputados(votaciones: list[dict]) -> list[list[str]]:
    """[nombre, grupo, circunscripción, formación, alta] de cada diputado que aparece en las votaciones, en orden estable.

    El grupo es el del voto más reciente. La web usa este orden para leer la cadena `v` de cada votación.
    """
    grupo: dict[str, str] = {}
    for v in sorted(votaciones, key=lambda v: (v["fecha"], v.get("numero") or 0)):
        for d in v.get("votos", []):
            grupo[d["diputado"]] = d["grupo"]
    ficha = mod_diputados.leer()
    return sorted(([n, g, ficha.get(n, {}).get("circunscripcion", ""), ficha.get(n, {}).get("formacion", ""),
                    ficha.get(n, {}).get("alta", "")] for n, g in grupo.items()), key=lambda x: (x[1], x[0]))


def votos_compactos(v: dict, indice: dict[str, int]) -> str:
    """Una letra por diputado (S, N, A, X = no vota, - = no figura en esta votación)."""
    letras = ["-"] * len(indice)
    for d in v.get("votos", []):
        if d["diputado"] in indice:
            letras[indice[d["diputado"]]] = d["voto"]
    return "".join(letras)


def _votacion_web(v: dict, indice: dict[str, int] | None = None) -> dict:
    return {
        "id": v["id"], "fecha": v["fecha"], "tipo": tipo_votacion(v), "titulo": v["titulo"],
        "proponente": proponente(v["titulo"]) or "?", "exp": v.get("exp") or "",
        "si": v["si"], "no": v["no"], "abst": v["abst"], "novota": v["novota"],
        "grupos": {g: (x if x in "SNAD" else "?") for g, x in v["grupos"].items()},
        "conteo": v.get("conteo", {}),
        "discrepantes": [f"{d['diputado']} ({d['grupo']})" for d in v.get("discrepantes", [])],
        "json": v.get("json", ""),
        "v": votos_compactos(v, indice) if indice and v.get("votos") else "",
    }


def construir(con_ia: bool = True) -> dict:
    votaciones = [v for f in sorted(VOTACIONES.glob("*.json")) for v in json.loads(f.read_text())]
    lista_diputados = diputados(votaciones)
    indice = {d[0]: i for i, d in enumerate(lista_diputados)}
    web_votos = [_votacion_web(v, indice) for v in votaciones]
    por_fecha: dict[str, list[dict]] = defaultdict(list)
    for v in web_votos:
        por_fecha[v["fecha"]].append(v)

    # Escaños actuales por grupo: los del último voto con más presentes.
    escanos = Counter()
    if votaciones:
        ultimo = max(votaciones, key=lambda v: (v["fecha"], v["si"] + v["no"] + v["abst"] + v["novota"]))
        escanos = Counter({g: sum(c.values()) for g, c in ultimo["conteo"].items()})

    sesiones_web, ivs_web, fechas_con_ds = [], [], set()
    for f in sorted(SESIONES.glob("*.json")):
        ses = json.loads(f.read_text())
        if not ses.get("fecha"):
            continue
        ivs = ses["intervenciones"]
        analisis: dict[int, dict] = {}
        previa = None
        for iv in ivs:
            if iv["grupo"] == "MESA":
                continue
            if con_ia:
                es_respuesta = iv["grupo"] == "GOB" and previa and previa["grupo"] != "GOB"
                a = analizar(iv, previa["texto"] if es_respuesta else None)
                if a:
                    analisis[iv["orden"]] = a
            previa = iv

        # Asuntos en orden de aparición.
        asuntos = []
        for iv in ivs:
            clave = iv["item"] or iv["seccion"] or "Sesión"
            if clave not in asuntos:
                asuntos.append(clave)

        votos_dia = por_fecha.get(ses["fecha"], []) if ses["serie"] == "PL" else []
        lineas = []
        for iv in ivs:
            if (a := analisis.get(iv["orden"])):
                lineas.append(f"- {iv['orador']} ({iv['grupo']}) sobre «{(iv['item'] or '')[:120]}»: {a['resumen']}")
        for v in votos_dia:
            lineas.append(f"- Votación: {v['titulo'][:160]} → Sí {v['si']}, No {v['no']}, Abst. {v['abst']}")

        resumen, titular, titulos = "", "", []
        if con_ia and (lineas or asuntos):
            r = resumir_sesion(ses["organo"], ses["fecha"], [titulo_legible(a) for a in asuntos], lineas)
            resumen, titular, titulos = r.get("resumen", ""), r.get("titular", ""), r.get("titulos", [])

        puntos = []
        for i, asunto in enumerate(asuntos):
            seccion = next((iv["seccion"] for iv in ivs if (iv["item"] or iv["seccion"]) == asunto), None)
            hay_analisis = any(iv["orden"] in analisis for iv in ivs if (iv["item"] or iv["seccion"]) == asunto)
            enlazados = [v["id"] for v in votos_dia if parecido(v["titulo"], asunto) >= 0.5]
            puntos.append({
                "tipo": (seccion or "Asunto").capitalize(),
                "titulo": titulos[i] if i < len(titulos) else titulo_legible(asunto),
                "exp": next((iv["exp"] for iv in ivs if iv["item"] == asunto and iv["exp"]), None),
                "estado": "analizado" if hay_analisis else "pendiente",
                "itemId": asunto,
                "votos": enlazados,
            })
        # Votaciones del día que no casan con ningún asunto debatido en este Diario.
        usados = {vid for p in puntos for vid in p["votos"]}
        sueltas = [v["id"] for v in votos_dia if v["id"] not in usados]
        if sueltas:
            puntos.append({"tipo": "Votaciones", "titulo": "Otras votaciones de la jornada",
                           "estado": "analizado", "votos": sueltas})

        reacciones = Counter()
        for iv in ivs:
            reacciones.update(iv.get("reacciones", {}))
        sesiones_web.append({
            "id": ses["id"], "fecha": ses["fecha"], "organo": ses["organo"],
            "sesion": f"Sesión nº {ses['sesion']}" if ses.get("sesion") else ses["organo"],
            "ds": ses["ds"], "dsNombre": ses["id"], "titular": titular, "resumen": resumen, "puntos": puntos,
            "reacciones": dict(reacciones),
        })
        if ses["serie"] == "PL":
            fechas_con_ds.add(ses["fecha"])

        for iv in ivs:
            a = analisis.get(iv["orden"])
            if not a:
                continue
            ivs_web.append({
                "s": ses["id"], "item": iv["item"] or iv["seccion"] or "Sesión", "orador": iv["orador"],
                "g": iv["grupo"], "rol": iv["cargo"] or INFO_GRUPOS.get(iv["grupo"], {}).get("nombre", ""),
                "pos": None if a.get("posicion") == "no aplica" else a.get("posicion"),
                "tono": a["tono"], "int": a["intensidad"], "temas": a["temas"], "resumen": a["resumen"],
                "cita": a.get("cita"), "responde": a.get("responde"), "responde_motivo": a.get("responde_motivo"),
                "reacciones": iv.get("reacciones", {}),
            })

    # Plenos con votaciones pero sin Diario publicado todavía.
    for fecha, vs in por_fecha.items():
        if fecha in fechas_con_ds:
            continue
        sesiones_web.append({
            "id": f"votos-{fecha}", "fecha": fecha, "organo": "Pleno",
            "sesion": f"Sesión nº {vs[0]['id'].split('-')[0]}", "ds": None,
            "resumen": "El Diario de Sesiones de esta jornada aún no se ha publicado. Se muestran las votaciones.",
            "puntos": [{"tipo": v["tipo"], "titulo": v["titulo"][:200], "estado": "sin-ds", "votos": [v["id"]]}
                       for v in vs],
        })

    fechas = sorted({s["fecha"] for s in sesiones_web})
    grupos = {g: {**INFO_GRUPOS[g], "codigo": g, "escanos": escanos.get(g, 0)} for g in INFO_GRUPOS}
    salida = {
        "datos": {
            "meta": {"periodo": f"{fechas[0]} – {fechas[-1]}" if fechas else "",
                     "generado": date.today().isoformat()},
            "grupos": grupos,
            "sesiones": sesiones_web,
            "votaciones": web_votos,
            "diputados": lista_diputados,
        },
        "intervenciones": ivs_web,
    }
    SITIO.mkdir(parents=True, exist_ok=True)
    (SITIO / "data.json").write_text(json.dumps(salida, ensure_ascii=False))
    return salida
