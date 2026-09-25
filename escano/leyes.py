"""Tramitación de las iniciativas legislativas (proyectos y proposiciones de ley) desde los datos abiertos.

El Congreso publica cada día un JSON por tipo con, para cada iniciativa, su autor, la situación actual, el
resultado y la tramitación seguida: fases con órgano y fechas («Comisión de Justicia · Enmiendas · desde
12/01/2024 hasta 10/09/2026»). De ahí salen el embudo de la legislatura, el «congelador» (iniciativas cuyo
plazo de enmiendas se amplía semana tras semana) y la línea de vida de cada ley en su página.
"""
from __future__ import annotations

import json
import re

from .config import BASE, DATOS
from .red import descargar

URL_PAGINA = BASE + "/es/opendata/iniciativas"
RE_FICHERO = re.compile(r"/webpublica/opendata/iniciativas/(ProyectosDeLey|ProposicionesDeLey|IniciativasLegislativasAprobadas)__\d+\.json")
FICHERO = DATOS / "leyes.json"

AUTORES = [(r"socialista", "PSOE"), (r"popular", "PP"), (r"\bvox\b", "VOX"), (r"sumar", "SUMAR"),
           (r"republicano", "ERC"), (r"junts", "JUNTS"), (r"bildu", "BILDU"), (r"vasco|pnv", "PNV"),
           (r"mixto", "MIXTO"), (r"^gobierno", "GOB"), (r"^senado", "SEN"), (r"comunidad|ciudad aut", "CCAA"),
           (r"diputad", "DIP")]
RESULTADOS = [("aprobad", "aprobada"), ("rechazad", "rechazada"), ("retirad", "retirada"), ("decaíd", "decaída"),
              ("subsumid", "subsumida"), ("inadmitid", "inadmitida")]
# Etapas del embudo, de la presentación a la publicación como ley.
ETAPAS = ["Presentadas", "Admitidas a debate", "Con informe en comisión", "Aprobadas en el Congreso",
          "Pasaron por el Senado", "Leyes"]


def _iso(f: str) -> str:
    d, m, a = f.strip().split("/")
    return f"{a}-{m}-{d}"


def _lineas(t: str | None) -> list[str]:
    return [x.strip() for x in (t or "").split("\n") if x.strip()]


def _texto(t: str | None) -> str:
    return " ".join((t or "").split())


def autores(texto: str) -> list[str]:
    out = []
    for linea in _lineas(texto):
        cod = next((c for patron, c in AUTORES if re.search(patron, linea, re.I)), None)
        if cod and cod not in out:
            out.append(cod)
    return out


def fases(texto: str | None) -> list[dict]:
    """«Órgano / Fase / desde … hasta …» -> [{organo, fase, desde, hasta}]."""
    out, bloque = [], []
    for linea in _lineas(texto):
        m = re.match(r"desde (\d\d/\d\d/\d{4})(?: hasta (\d\d/\d\d/\d{4}))?", linea)
        if not m:
            bloque.append(linea)
            continue
        organo, fase = (bloque[-2], bloque[-1]) if len(bloque) >= 2 else ((bloque or [""])[0], "")
        if organo.startswith("Concluido"):
            organo, fase = "Concluido", re.sub(r"^Concluido\s*-\s*\(?|\)$", "", organo).strip()
        out.append({"organo": organo, "fase": fase, "desde": _iso(m.group(1)),
                    "hasta": _iso(m.group(2)) if m.group(2) else ""})
        bloque = []
    return out


def etapa(ini: dict) -> int:
    """Hasta qué etapa del embudo llegó (índice en ETAPAS)."""
    fs = ini["fases"]
    hay = lambda f: any(f(x) for x in fs)
    if ini["estado"] == "aprobada":
        return 5
    if hay(lambda x: x["organo"] == "Senado" or "Senado" in x["fase"]) and ini["origen"] != "SEN":
        return 4
    if hay(lambda x: x["fase"].startswith("Aprobación")) or (ini["origen"] == "SEN" and hay(lambda x: x["fase"] == "Dictamen")):
        return 3
    if hay(lambda x: x["fase"] in ("Informe", "Dictamen", "Nuevo dictamen")):
        return 2
    tomada = hay(lambda x: x["fase"].startswith("Acuerdo subsiguiente") or
                 (x["organo"].startswith("Comisión") and x["fase"] in ("Enmiendas", "Publicación")))
    if ini["tipo"] == "Proyecto de ley" and not (ini["estado"] == "rechazada" and not tomada):
        return 1
    return 1 if tomada else 0


def leer_iniciativa(d: dict) -> dict:
    exp = "/".join(d["NUMEXPEDIENTE"].split("/")[:2])
    resultado = _lineas(d.get("RESULTADOTRAMITACION"))
    estado = next((e for k, e in RESULTADOS if resultado and k in resultado[0].lower()), "en trámite")
    tipo = "Proyecto de ley" if exp.startswith("121") else "Proposición de ley"
    objeto = _texto(d.get("OBJETO")).rstrip(".")
    organica = bool(re.search(r"\(Orgánica\)|Ley Orgánica (?:de|del|por|sobre|para)\b", objeto[:40] + objeto[-12:]))
    titulo = re.sub(r"\s*\(Orgánica\)\s*$", "", objeto)
    titulo = re.sub(r"^(?:Proyecto|Proposición) de Ley\s*", "Ley ", titulo).replace("Ley Orgánica Orgánica", "Ley Orgánica")
    aut = autores(d.get("AUTOR"))
    ini = {
        "exp": exp, "tipo": tipo, "titulo": titulo, "organica": organica,
        "autores": aut, "origen": "GOB" if tipo == "Proyecto de ley" else ("SEN" if "SEN" in aut else
                                    "CCAA" if "CCAA" in aut else "GRUPOS"),
        "presentada": _iso(d["FECHAPRESENTACION"]) if d.get("FECHAPRESENTACION") else "",
        "tramitacion": _texto(d.get("TIPOTRAMITACION")),
        "comision": _texto(d.get("COMISIONCOMPETENTE")),
        "situacion": " · ".join(_lineas(d.get("SITUACIONACTUAL"))),
        "estado": estado,
        "resultado": resultado[0] if resultado else "",
        "fecha_resultado": _iso(resultado[1]) if len(resultado) > 1 and re.match(r"\d\d/\d\d/\d{4}$", resultado[1]) else "",
        "fases": fases(d.get("TRAMITACIONSEGUIDA")),
        "ampliaciones": len(re.findall(r"Ampliación de enmiendas", d.get("PLAZOS") or "")),
        "diarios": sorted({m for m in re.findall(r"DSCD-\d+-(?:PL|CO)-\d+", d.get("ENLACESDS") or "")},
                          key=lambda x: (x.split("-")[2], int(x.split("-")[3]))),
        "bocg": (re.findall(r"https?://\S+?\.PDF", d.get("ENLACESBOCG") or "") or [""])[0],
    }
    ini["etapa"] = etapa(ini)
    return ini


def leer_aprobadas(datos: list[dict]) -> list[dict]:
    """Normas publicadas en el BOE: leyes, leyes orgánicas y reales decretos-leyes."""
    out = []
    for d in datos:
        t = _texto(d.get("TITULO_LEY"))
        m = re.match(r"(Ley Orgánica|Ley|Real Decreto-ley) (\d+/\d{4})", t)
        out.append({"tipo": {"Leyes organicas": "Ley orgánica", "Leyes": "Ley"}.get(d.get("TIPO"), "Real decreto-ley"),
                    "numero": m.group(2) if m else "", "titulo": t,
                    "fecha": _iso(d["FECHA_LEY"]) if d.get("FECHA_LEY") else "", "pdf": d.get("PDF", "")})
    return sorted(out, key=lambda x: x["fecha"])


def actualizar() -> dict:
    html = descargar(URL_PAGINA, cache=False)
    enlaces: dict[str, str] = {}
    for m in RE_FICHERO.finditer(html.decode("utf-8", "replace") if html else ""):
        enlaces[m.group(1)] = max(enlaces.get(m.group(1), ""), m.group(0))
    if len(enlaces) < 3:
        return leer()
    bajar = lambda k: json.loads(descargar(BASE + enlaces[k], cache=False).decode("utf-8-sig"))
    iniciativas = [leer_iniciativa(d) for k in ("ProyectosDeLey", "ProposicionesDeLey") for d in bajar(k)
                   if str(d.get("LEGISLATURA", "")).endswith("15")]
    datos = {"iniciativas": sorted(iniciativas, key=lambda x: x["exp"]),
             "aprobadas": leer_aprobadas(bajar("IniciativasLegislativasAprobadas"))}
    FICHERO.write_text(json.dumps(datos, ensure_ascii=False, indent=1))
    return datos


def leer() -> dict:
    return json.loads(FICHERO.read_text()) if FICHERO.exists() else {"iniciativas": [], "aprobadas": []}
