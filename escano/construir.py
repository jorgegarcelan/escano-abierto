"""Une Diarios, análisis y votaciones en los ficheros que lee la web (site/datos/).

site/datos/indice.json lleva lo común (grupos, diputados, meses disponibles) y site/datos/AAAA-MM.json las
sesiones, votaciones e intervenciones de cada mes, para que la web no tenga que cargar toda la legislatura.
"""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date

from . import diputados as mod_diputados, hemiciclo as mod_hemiciclo, organos as mod_organos
from .analisis import analizar, resumir_sesion
from .config import DATOS, INFO_GRUPOS, SESIONES, SITIO, VOTACIONES

MVP = DATOS / "mvp.json"  # análisis del prototipo; solo rellenan lo que el pipeline aún no ha analizado

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


RE_RDL = re.compile(r"^Real Decreto-ley (\d+/\d{4}), de \d+ de \w+, (.*)$", re.I)
RE_ASUNTO = re.compile(r",\s+(?:sobre|relativ[ao] a|para)\s+(.*)$", re.I)
RE_PREFIJO = re.compile(r"^(?:(?:Proposición no de Ley|Proposición de Ley|Proyecto de Ley|Moción[^,]*?)\s*)?"
                        r"(?:del Grupo Parlamentario [^,]+,\s*)?(?:de\s+)?", re.I)


def titulo_votacion(texto: str, subgrupo: str = "") -> str:
    """Título corto a partir del texto oficial del expediente (sin IA).

    «Moción consecuencia de interpelación urgente del Grupo Parlamentario Popular en el Congreso, sobre la crisis
    que atraviesa la Ciudad Autónoma de Ceuta.» -> «Crisis que atraviesa la Ciudad Autónoma de Ceuta».
    """
    t = (texto or "").strip().split("\n")[0].strip()
    t = re.sub(r"\.?\s*«BOCG[^»]*».*$", "", t)            # referencia al boletín
    t = re.sub(r"\s*\(BOE[^)]*\)\.?", "", t).strip().rstrip(".")
    if m := re.search(r"^Tramitación como Proyecto de Ley.*?Real Decreto-ley (\d+/\d{4})", t, re.I):
        t = f"Tramitar el RDL {m.group(1)} como proyecto de ley"
    elif m := RE_RDL.match(t):
        t = f"RDL {m.group(1)} {m.group(2)}"
    elif m := RE_ASUNTO.search(t):
        t = m.group(1)
    else:
        t = RE_PREFIJO.sub("", t) or t
        if re.match(r"(?:por (?:la|el) que|orgánica)\b", t, re.I):
            t = "Ley " + t[:1].lower() + t[1:]
    t = re.sub(r"^(?:el|la|los|las)\s+", "", t, flags=re.I).strip()
    t = t[:1].upper() + t[1:]
    if len(t) > 110:
        t = t[:110].rsplit(" ", 1)[0].rstrip(",;") + "…"
    if subgrupo and len(subgrupo) <= 60:
        t += f" ({subgrupo[:1].lower() + subgrupo[1:]})"
    return t or "Votación"


def titulo_legible(item: str) -> str:
    t = re.sub(r"\(Número de expediente[^)]*\)\.?", "", item).strip(" —.")
    return t[:1].upper() + t[1:].lower() if t.isupper() else t


def diputados(votaciones: list[dict]) -> list[list[str]]:
    """[nombre, grupo, circunscripción, formación, alta, x, y, código] de cada diputado (x, y: su escaño en el plano) que aparece en las votaciones, en orden estable.

    El grupo es el del voto más reciente. La web usa este orden para leer la cadena `v` de cada votación.
    """
    grupo: dict[str, str] = {}
    for v in sorted(votaciones, key=lambda v: (v["fecha"], v.get("numero") or 0)):
        for d in v.get("votos", []):
            grupo[d["diputado"]] = d["grupo"]
    ficha, plano = mod_diputados.leer(), mod_hemiciclo.leer()["escanos"]
    def fila(n, g):
        f, e = ficha.get(n, {}), plano.get(n, {})
        return [n, g, f.get("circunscripcion", ""), f.get("formacion", ""), f.get("alta", ""),
                e.get("x"), e.get("y"), e.get("codigo")]
    return sorted((fila(n, g) for n, g in grupo.items()), key=lambda x: (x[1], x[0]))


def votos_compactos(v: dict, indice: dict[str, int]) -> str:
    """Una letra por diputado (S, N, A, X = no vota, - = no figura en esta votación)."""
    letras = ["-"] * len(indice)
    for d in v.get("votos", []):
        if d["diputado"] in indice:
            letras[indice[d["diputado"]]] = d["voto"]
    return "".join(letras)


def _votacion_web(v: dict, indice: dict[str, int] | None = None) -> dict:
    return {
        "id": v["id"], "fecha": v["fecha"], "tipo": tipo_votacion(v),
        "titulo": titulo_votacion(v["titulo"], v.get("subgrupo", "")), "titulo_fuente": "oficial", "texto": v["titulo"],
        "proponente": proponente(v["titulo"]) or "?", "exp": v.get("exp") or "",
        "si": v["si"], "no": v["no"], "abst": v["abst"], "novota": v["novota"],
        "grupos": {g: (x if x in "SNAD" else "?") for g, x in v["grupos"].items()},
        "conteo": v.get("conteo", {}),
        "discrepantes": [f"{d['diputado']} ({d['grupo']})" for d in v.get("discrepantes", [])],
        "json": v.get("json", ""),
        "v": votos_compactos(v, indice) if indice and v.get("votos") else "",
    }


def completar_con_mvp(sesiones: list[dict], ivs: list[dict], votos: list[dict]) -> None:
    """Rellena con el análisis del MVP las sesiones que el pipeline aún no ha analizado.

    El análisis del pipeline manda siempre: una sesión con intervenciones analizadas no se toca.
    """
    if not MVP.exists():
        return
    mvp = json.loads(MVP.read_text())
    for v in votos:  # títulos revisados a mano en el MVP
        if (m := mvp.get("votaciones", {}).get(v["id"])):
            v.update(m)
            v["titulo_fuente"] = "revisado"
    ids_votos = {v["id"] for v in votos}
    analizadas = {i["s"] for i in ivs}
    for m in mvp.get("sesiones", []):
        p = next((s for s in sesiones if m.get("dsNombre") and s.get("dsNombre") == m["dsNombre"]), None) \
            or next((s for s in sesiones if not m.get("ds") and s["fecha"] == m["fecha"] and s["organo"] == m["organo"]), None)
        m_ivs = [dict(i) for i in mvp.get("intervenciones", []) if i["s"] == m["id"]]
        if p is None:
            m = {**m, "puntos": [{**pt, "votos": [x for x in pt.get("votos", []) if x in ids_votos]} for pt in m["puntos"]],
                 "fuente": "mvp"}
            sesiones.append(m)
            ivs.extend(m_ivs)
            continue
        if p["id"] in analizadas:
            continue
        p["resumen"] = p.get("resumen") or m.get("resumen", "")
        if p["resumen"]:
            p.pop("nota", None)
        # Los puntos del MVP enlazan sus intervenciones; solo sirven si describen el mismo Diario (o ninguno).
        if m.get("dsNombre") == p.get("dsNombre") or not p.get("ds"):
            p["puntos"] = [{**pt, "votos": [x for x in pt.get("votos", []) if x in ids_votos]} for pt in m["puntos"]]
            for i in m_ivs:
                i["s"] = p["id"]
            ivs.extend(m_ivs)
        p["fuente"] = "mvp"


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
            lineas.append(f"- Votación: {v['texto'][:160]} → Sí {v['si']}, No {v['no']}, Abst. {v['abst']}")

        resumen, titular, titulos = "", "", []
        if con_ia and (lineas or asuntos):
            r = resumir_sesion(ses["organo"], ses["fecha"], [titulo_legible(a) for a in asuntos], lineas)
            resumen, titular, titulos = r.get("resumen", ""), r.get("titular", ""), r.get("titulos", [])

        puntos = []
        for i, asunto in enumerate(asuntos):
            seccion = next((iv["seccion"] for iv in ivs if (iv["item"] or iv["seccion"]) == asunto), None)
            hay_analisis = any(iv["orden"] in analisis for iv in ivs if (iv["item"] or iv["seccion"]) == asunto)
            enlazados = [v["id"] for v in votos_dia if parecido(v["texto"], asunto) >= 0.5]
            puntos.append({
                "tipo": (seccion or "Asunto").capitalize(),
                "titulo": titulos[i] if i < len(titulos) else titulo_votacion(titulo_legible(asunto)),
                "exp": next((iv["exp"] for iv in ivs if iv["item"] == asunto and iv["exp"]), None),
                "estado": "analizado" if hay_analisis else "pendiente",
                "itemId": asunto,
                "votos": enlazados,
            })
        # El número de expediente de la votación, cuando no viene en los datos abiertos, sale del asunto enlazado.
        por_id = {v["id"]: v for v in votos_dia}
        for p in puntos:
            for vid in p["votos"]:
                if p["exp"] and not por_id[vid]["exp"]:
                    por_id[vid]["exp"] = p["exp"]
        # Votaciones del día que no casan con ningún asunto debatido en este Diario.
        usados = {vid for p in puntos for vid in p["votos"]}
        sueltas = [v["id"] for v in votos_dia if v["id"] not in usados]
        if sueltas:
            puntos.append({"tipo": "Votaciones", "titulo": "Otras votaciones de la jornada",
                           "estado": "analizado", "votos": sueltas})

        reacciones = Counter()
        termometro: dict[str, Counter] = defaultdict(Counter)   # reacciones durante los turnos de cada grupo
        for iv in ivs:
            reacciones.update(iv.get("reacciones", {}))
            if iv["grupo"] not in ("MESA", "?"):
                termometro[iv["grupo"]]["turnos"] += 1
                termometro[iv["grupo"]].update(iv.get("reacciones", {}))
        sesiones_web.append({
            "id": ses["id"], "fecha": ses["fecha"], "organo": ses["organo"],
            "sesion": f"Sesión nº {ses['sesion']}" if ses.get("sesion") else ses["organo"],
            "ds": ses["ds"], "dsNombre": ses["id"], "titular": titular, "resumen": resumen, "puntos": puntos,
            "reacciones": dict(reacciones), "turnos": sum(1 for iv in ivs if iv["grupo"] != "MESA"),
            "termometro": {g: dict(c) for g, c in termometro.items()},
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
            "resumen": "", "nota": "El Diario de Sesiones de esta jornada aún no se ha publicado. Se muestran las votaciones.",
            "puntos": [{"tipo": v["tipo"], "titulo": v["titulo"][:200], "estado": "sin-ds", "votos": [v["id"]]}
                       for v in vs],
        })

    completar_con_mvp(sesiones_web, ivs_web, web_votos)

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
    escribir_web(salida)
    try:
        from .paginas import generar
        generar(salida, mod_hemiciclo.leer())
    except ImportError:  # sin Pillow no hay tarjetas; la web funciona igual
        print("  (Pillow no está instalado: no se generan las páginas para compartir)")
    return salida


def _clave_apellidos(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")
    return " ".join(s.replace("-", " ").split())


def extras_diputados(nombres: list[str]) -> dict:
    """Lo que la ficha carga aparte: biografía, comisiones y turnos de palabra por órgano.

    Los turnos salen de los Diarios procesados (data/sesiones): el Diario nombra al orador por sus apellidos,
    que se casan con los del diputado cuando no hay ambigüedad.
    """
    ficha = mod_diputados.leer()
    salida = {n: {"bio": ficha.get(n, {}).get("biografia", ""), "comisiones": [], "turnos": {}} for n in nombres}
    for comision, miembros in mod_organos.leer().items():
        for m in miembros:
            if m["nombre"] in salida and m.get("codigo") and not m.get("baja"):
                salida[m["nombre"]]["comisiones"].append([comision, m["cargo"]])
    por_apellidos: dict[str, list[str]] = defaultdict(list)
    for n in nombres:
        por_apellidos[_clave_apellidos(n.split(",")[0])].append(n)
    for f in sorted(SESIONES.glob("*.json")):
        ses = json.loads(f.read_text())
        for iv in ses.get("intervenciones", []):
            if iv["grupo"] in ("MESA", "COMP"):
                continue
            candidatos = por_apellidos.get(_clave_apellidos(iv["orador"]), [])
            if len(candidatos) == 1:
                t = salida[candidatos[0]]["turnos"]
                t[ses["organo"]] = t.get(ses["organo"], 0) + 1
    return {n: e for n, e in salida.items() if e["bio"] or e["comisiones"] or e["turnos"]}


def escribir_web(salida: dict) -> None:
    """Parte la salida por meses: site/datos/indice.json y site/datos/AAAA-MM.json."""
    d = salida["datos"]
    fecha_sesion = {s["id"]: s["fecha"] for s in d["sesiones"]}
    meses: dict[str, dict] = defaultdict(lambda: {"sesiones": [], "votaciones": [], "intervenciones": []})
    for s in d["sesiones"]:
        meses[s["fecha"][:7]]["sesiones"].append(s)
    for v in d["votaciones"]:
        meses[v["fecha"][:7]]["votaciones"].append(v)
    for i in salida["intervenciones"]:
        meses[fecha_sesion.get(i["s"], "0000-00")[:7]]["intervenciones"].append(i)

    carpeta = SITIO / "datos"
    carpeta.mkdir(parents=True, exist_ok=True)
    for viejo in carpeta.glob("[0-9][0-9][0-9][0-9]-[0-9][0-9].json"):
        if viejo.stem not in meses:
            viejo.unlink()
    for mes, contenido in meses.items():
        (carpeta / f"{mes}.json").write_text(json.dumps(contenido, ensure_ascii=False))
    indice = {
        "meta": d["meta"], "grupos": d["grupos"], "diputados": d["diputados"],
        "hemiciclo": {k: v for k, v in mod_hemiciclo.leer().items() if k != "escanos"},
        "meses": [{"mes": m, "sesiones": len(c["sesiones"]), "votaciones": len(c["votaciones"]),
                   "intervenciones": len(c["intervenciones"])} for m, c in sorted(meses.items())],
    }
    (carpeta / "indice.json").write_text(json.dumps(indice, ensure_ascii=False))
    (carpeta / "diputados-extra.json").write_text(
        json.dumps(extras_diputados([x[0] for x in d["diputados"]]), ensure_ascii=False))
    (SITIO / "data.json").unlink(missing_ok=True)   # formato anterior, en un solo fichero
