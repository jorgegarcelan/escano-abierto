"""Declaraciones de actividades e intereses económicos de los diputados (datos abiertos del Congreso).

Cada diputado declara al tomar posesión (y cuando cambia algo) sus actividades de los últimos años, con
empleador, sector y periodo; sus aportaciones a fundaciones, asociaciones o partidos; los regalos o
donaciones recibidos, y observaciones. El fichero `docacteco` las trae como filas sueltas; aquí se agrupan
por diputado y se limpian lo justo (el sector se escribe de mil maneras: «PÚBLICO», «Publico», «Admón. Pca.»).
"""
from __future__ import annotations

import json
import re
import unicodedata

from .config import BASE, DATOS
from .red import descargar

URL_PAGINA = BASE + "/es/opendata/diputados"
RE_FICHERO = re.compile(r"/webpublica/opendata/diputados/docacteco__\d+\.json")
FICHERO = DATOS / "intereses.json"


def _plano(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


def sector(s: str | None) -> str:
    """Categoría gruesa del sector declarado, que es texto libre: Público, Privado, Partidos y sindicatos,
    Tercer sector u Otro. Solo sirve para resumir; en la ficha se muestra lo que declaró el diputado."""
    t = _plano(s or "")
    if not t.strip():
        return ""
    if re.search(r"partido|politic|sindica", t):
        return "Partidos y sindicatos"
    if re.search(r"\bong\b|no gubernamental|tercer|sociedad civil|societat civil|fundaci|think|asociaci|club", t):
        return "Tercer sector"
    if re.search(r"privad|empresa|consultor|abogac|despacho|banca|inmobil|retail|comerc|industr|energ|hostel|"
                 r"construcc|auditor|contabil|profesion liberal|asesor", t) and "public" not in t:
        return "Privado"
    if re.search(r"p.?bl?ic|admin|adm\.|admon|gobiern|gubernament|ayunt|concejal|diputa|senad|cortes|parlament|"
                 r"legislativ|instituc|comunidad|local|estado|consejer|junta|justicia|funcionari|cargo|alcald|"
                 r"union europea|camara|corporacion|proteccion civil", t):
        return "Público"
    return "Otro"


def _nombre(n: str) -> str:
    """«Abades Martínez,Cristina» -> «Abades Martínez, Cristina»."""
    return re.sub(r"\s*,\s*", ", ", n.strip())


def _limpio(s: str | None) -> str:
    return " ".join((s or "").split())


def leer_filas(filas: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for f in filas:
        d = out.setdefault(_nombre(f.get("NOMBRE", "")), {"actividades": [], "aportaciones": [], "regalos": [],
                                                           "observaciones": [], "registro": ""})
        fecha = "-".join(reversed((f.get("FECHAREGISTRO") or "").split("/")))
        d["registro"] = max(d["registro"], fecha)
        tipo = f.get("TIPO")
        if tipo == "ACTIVIDAD":
            # [periodo, empleador, sector tal como se declaró, descripción, categoría del sector]
            fila = [_limpio(f.get("PERIODO")), _limpio(f.get("EMPLEADOR")), _limpio(f.get("SECTOR")),
                    _limpio(f.get("DESCRIPCION")), sector(f.get("SECTOR"))]
            if fila not in d["actividades"]:
                d["actividades"].append(fila)
        elif tipo == "FUNDACIONES":
            fila = [_limpio(f.get("DESTINATARIO")), _limpio(f.get("DESCRIPCION"))]
            if fila not in d["aportaciones"]:
                d["aportaciones"].append(fila)
        elif tipo == "DONACION":
            fila = [_limpio(f.get("BENEFACTOR")), _limpio(f.get("DESCRIPCION"))]
            if fila not in d["regalos"]:
                d["regalos"].append(fila)
        elif tipo == "OBSERVACIONES" and (t := _limpio(f.get("OBSERVACIONES"))) and t not in d["observaciones"]:
            d["observaciones"].append(t)
    return out


def actualizar() -> dict[str, dict]:
    html = descargar(URL_PAGINA, cache=False)
    enlaces = sorted(set(RE_FICHERO.findall(html.decode("utf-8", "replace")))) if html else []
    if not enlaces:
        return leer()
    datos = leer_filas(json.loads(descargar(BASE + enlaces[-1], cache=False).decode("utf-8-sig")))
    FICHERO.write_text(json.dumps(datos, ensure_ascii=False, indent=1, sort_keys=True))
    return datos


def leer() -> dict[str, dict]:
    return json.loads(FICHERO.read_text()) if FICHERO.exists() else {}
