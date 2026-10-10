"""Histórico de elecciones generales al Congreso (1977–2023) con los ficheros oficiales del Ministerio del Interior.

Interior publica cada elección en ZIP de ancho fijo (especificación FICHEROS.doc, igual en las 16 elecciones):

    https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/02AAAAMM_TOTA.zip   (provincias)
    https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/02AAAAMM_MUNI.zip   (municipios)

- 03 candidaturas: código [8:14], siglas [14:64], denominación [64:214], cabecera de acumulación nacional [226:232]
- 07 totales por ámbito: provincia [11:13] (99 = total), censo de escrutinio [85:93], blancos [125:133],
  nulos [133:141], votos a candidaturas [141:149], escaños [149:155]
- 08 votos por candidatura y ámbito: provincia [11:13], candidatura [14:20], votos [20:28], escaños [28:33]
- 05 municipios: provincia+municipio [11:16] (INE), distrito [16:18] (99 = total), censo de escrutinio [149:157],
  blancos [189:197], nulos [197:205], votos a candidaturas [205:213]
- 06 votos por municipio: provincia+municipio [9:14], distrito [14:16], candidatura [16:22], votos [22:30]

Los escaños son los del fichero (no se recalculan). Las candidaturas se agrupan por su cabecera nacional (la
agrupación del propio Ministerio en cada elección) y cada cabecera se asigna a una familia para poder comparar en el
tiempo; las reglas están en FAMILIAS y se aplican igual a todas las elecciones. El voto CERA no está en los
ficheros de municipios: el mapa municipal es el voto de los residentes en España.

    python -m escano.historico      # descarga lo que falte y escribe data/elecciones/historico*.json
"""
from __future__ import annotations

import json
import math
import re
import unicodedata
import zipfile
from collections import Counter, defaultdict

from .config import CRUDOS, DATOS

URL = "https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/02{id}_{tipo}.zip"
CARPETA = CRUDOS / "elecciones" / "zip"
SALIDA = DATOS / "elecciones"

ELECCIONES = [("197706", "1977-06-15"), ("197903", "1979-03-01"), ("198210", "1982-10-28"), ("198606", "1986-06-22"),
              ("198910", "1989-10-29"), ("199306", "1993-06-06"), ("199603", "1996-03-03"), ("200003", "2000-03-12"),
              ("200403", "2004-03-14"), ("200803", "2008-03-09"), ("201111", "2011-11-20"), ("201512", "2015-12-20"),
              ("201606", "2016-06-26"), ("201904", "2019-04-28"), ("201911", "2019-11-10"), ("202307", "2023-07-23")]
MAPAS_MUNICIPALES = ("201911", "202307")   # las que casan al 100 % con los municipios de es-atlas

# Legislatura que salió de cada elección y presidentes del Gobierno investidos en ella.
LEGISLATURAS = {
    "197706": ("Constituyente", ["Adolfo Suárez (UCD)"]),
    "197903": ("I", ["Adolfo Suárez (UCD)", "Leopoldo Calvo-Sotelo (UCD), 1981"]),
    "198210": ("II", ["Felipe González (PSOE)"]),
    "198606": ("III", ["Felipe González (PSOE)"]),
    "198910": ("IV", ["Felipe González (PSOE)"]),
    "199306": ("V", ["Felipe González (PSOE)"]),
    "199603": ("VI", ["José María Aznar (PP)"]),
    "200003": ("VII", ["José María Aznar (PP)"]),
    "200403": ("VIII", ["José Luis Rodríguez Zapatero (PSOE)"]),
    "200803": ("IX", ["José Luis Rodríguez Zapatero (PSOE)"]),
    "201111": ("X", ["Mariano Rajoy (PP)"]),
    "201512": ("XI", []),   # ninguna investidura: nuevas elecciones
    "201606": ("XII", ["Mariano Rajoy (PP)", "Pedro Sánchez (PSOE), por moción de censura, 2018"]),
    "201904": ("XIII", []),   # ninguna investidura: nuevas elecciones
    "201911": ("XIV", ["Pedro Sánchez (PSOE)"]),
    "202307": ("XV", ["Pedro Sánchez (PSOE)"]),
}


def metricas(nacional: dict, validos: int, anterior: dict | None) -> dict:
    """Indicadores clásicos del sistema de partidos, por familias (y por candidatura dentro de «Otros»).

    - Número efectivo de partidos (Laakso-Taagepera): 1 / Σ p², con p la parte de votos (o de escaños).
    - Índice de desproporcionalidad de Gallagher: √(½ Σ (v − e)²), en puntos porcentuales.
    - Volatilidad de Pedersen: ½ Σ |Δ votos| entre familias de partidos respecto a la elección anterior.
    """
    # Las confluencias (En Comú, Compromís-Podemos…) van con su familia; los partidos pequeños, cada uno por su lado.
    unidades: dict[str, dict] = {}
    for cod, x in nacional.items():
        u = unidades.setdefault(x["familia"] if x["familia"] != "OTROS" else cod, {"votos": 0, "escanos": 0, "familia": x["familia"]})
        u["votos"] += x["votos"]
        u["escanos"] += x["escanos"]
    xs = list(unidades.values())
    total_v = sum(x["votos"] for x in xs) or 1
    nep_v = 1 / sum((x["votos"] / total_v) ** 2 for x in xs)
    nep_e = 1 / sum((x["escanos"] / 350) ** 2 for x in xs if x["escanos"])
    gallagher = math.sqrt(0.5 * sum((100 * x["votos"] / validos - 100 * x["escanos"] / 350) ** 2 for x in xs))
    fam = Counter()
    for x in xs:
        fam[x["familia"]] += x["votos"]
    out = {"nep_votos": round(nep_v, 2), "nep_escanos": round(nep_e, 2), "gallagher": round(gallagher, 2)}
    if anterior:
        ta, tb = sum(anterior.values()) or 1, sum(fam.values()) or 1
        out["pedersen"] = round(50 * sum(abs(fam.get(f, 0) / tb - anterior.get(f, 0) / ta) for f in set(fam) | set(anterior)), 2)
    return out, dict(fam)

# Familias, de izquierda a derecha en el hemiciclo (como ORDEN_HEMI en la web) y con los nacionalistas y regionalistas
# al final. Cada regla se busca en las siglas y la denominación de la cabecera nacional, sin tildes y en mayúsculas.
FAMILIAS = [
    ("IZQ", "IU, Podemos y Sumar", "#C92F72",
     r"^(PCE|PSUC|IU|I\.U\.|IC-V|ICV|PODEMOS|EN COMU|ECP|SUMAR|MAS PAIS|MES COMPROM|COMPROMIS(?!-Q)|EN MAREA|UP\b)|IZQUIERDA UNIDA|UNIDAS PODEMOS|UNIDOS PODEMOS|PARTIDO COMUNISTA DE ESPANA"),
    ("BILDU", "HB, Amaiur y EH Bildu", "#86A832", r"^(HB|AMAIUR|EH BILDU)\b|HERRI BATASUNA"),
    ("ERC", "ERC", "#E0A410", r"^(ERC|ESQUERRA|EC-FED)|ESQUERRA REPUBLICANA"),
    ("BNG", "BNG", "#6FA8DC", r"^(BNG|B\.N\.G\.)|BLOQUE NACIONALISTA GALEGO"),
    ("PSOE", "PSOE", "#D8342B", r"^(PSOE|P\.S\.O\.E\.)|PARTIDO SOCIALISTA OBRERO ESPANOL"),
    ("UCD", "UCD y CDS", "#E8862A", r"^(UCD|CDS)\b|UNION DE CENTRO DEMOCRATICO|CENTRO DEMOCRATICO Y SOCIAL"),
    ("CS", "Ciudadanos", "#F05A28", r"^(C'S|CS)\b|CIUDADANOS-PARTIDO DE LA CIUDADANIA|^CIUDADANOS"),
    ("PNV", "PNV", "#2F7A4A", r"PNV|^EAJ"),
    ("CIU", "CiU y Junts", "#1FA8A0", r"^(PDPC|CIU|DL|CDC|JXCAT|JUNTS)\b|CONVERGENCIA I UNIO|PACTE DEMOCRATIC PER CATALUNYA|DEMOCRACIA I LLIBERTAT"),
    ("CC", "Coalición Canaria", "#F2C230", r"^(CC|CCA|AIC)\b|COALICION CANARIA|AGRUPACIONES INDEPENDIENTES DE CANARIAS"),
    ("PP", "PP (antes AP y CD)", "#2C7BC4", r"^(AP|CD|CP|PP|UPN-PP|PP-PAR|PP-FORO)\b|^AP-|^P\.P\.|ALIANZA POPULAR|COALICION POPULAR|PARTIDO POPULAR|COALICION DEMOCRATICA"),
    ("VOX", "Vox", "#5BA83A", r"^VOX\b"),
    ("OTROS", "Otros", "#8A8F98", r""),
]
NOMBRE_FAMILIA = {f[0]: f[1] for f in FAMILIAS}
ORDEN = [f[0] for f in FAMILIAS]


def _plano(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s.upper()) if unicodedata.category(c) != "Mn")


def familia(siglas: str, nombre: str) -> str:
    s, n = _plano(siglas).strip(), _plano(nombre).strip()
    for fid, _, _, patron in FAMILIAS[:-1]:
        if re.search(patron, s) or re.search(patron, n):
            return fid
    return "OTROS"


# ---------- lectura de los ZIP ----------

def _zip(id_: str, tipo: str) -> zipfile.ZipFile:
    ruta = CARPETA / f"02{id_}_{tipo}.zip"
    if not ruta.exists():
        from .red import descargar
        CARPETA.mkdir(parents=True, exist_ok=True)
        if descargar(URL.format(id=id_, tipo=tipo), ruta) is None:
            raise RuntimeError(f"Interior no tiene {ruta.name}")
    return zipfile.ZipFile(ruta)


def _lineas(z: zipfile.ZipFile, prefijo: str) -> list[str]:
    nombre = next(n for n in z.namelist() if n.upper().startswith(prefijo) and n.upper().endswith(".DAT"))
    return [l for l in z.read(nombre).decode("latin-1").splitlines() if l.strip()]


def _n(s: str) -> int:
    s = s.strip()
    return int(s) if s else 0   # algún registro antiguo trae el campo en blanco (1993)


def candidaturas(z: zipfile.ZipFile) -> dict[str, dict]:
    """código -> {siglas, nombre, nac (código de su cabecera nacional)}."""
    return {l[8:14]: {"siglas": l[14:64].strip(), "nombre": l[64:214].strip(), "nac": l[226:232]} for l in _lineas(z, "03")}


def leer_eleccion(id_: str) -> dict:
    """Totales nacionales y por circunscripción de una elección, por candidatura (cabecera nacional) y familia."""
    z = _zip(id_, "TOTA")
    cand = candidaturas(z)
    prov = {}
    for l in _lineas(z, "07"):
        if l[11:13] == "99":
            continue
        prov[l[11:13]] = {"censo": _n(l[85:93]), "blancos": _n(l[125:133]), "nulos": _n(l[133:141]),
                          "candidaturas": _n(l[141:149]), "escanos": _n(l[149:155]), "lista": []}
    for l in _lineas(z, "08"):
        if l[11:13] == "99":
            continue
        c = cand[l[14:20]]
        cab = cand.get(c["nac"], c)
        prov[l[11:13]]["lista"].append({"siglas": c["siglas"], "nac": c["nac"], "familia": familia(cab["siglas"], cab["nombre"]),
                                        "votos": _n(l[20:28]), "escanos": _n(l[28:33])})
    nacional: dict[str, dict] = {}
    for p in prov.values():
        for x in p["lista"]:
            cab = cand.get(x["nac"], {"siglas": x["siglas"], "nombre": ""})
            t = nacional.setdefault(x["nac"], {"siglas": cab["siglas"], "nombre": cab["nombre"], "familia": x["familia"],
                                               "votos": 0, "escanos": 0})
            t["votos"] += x["votos"]
            t["escanos"] += x["escanos"]
    return {"prov": prov, "nacional": nacional}


def leer_municipios(id_: str) -> dict[str, dict]:
    """INE del municipio -> {censo, votantes, familias: Counter} (sin el voto CERA, que no va en estos ficheros)."""
    z = _zip(id_, "MUNI")
    cand = candidaturas(z)
    fam = {}
    for cod, c in cand.items():
        cab = cand.get(c["nac"], c)
        fam[cod] = familia(cab["siglas"], cab["nombre"])
    mun = {}
    for l in _lineas(z, "05"):
        if l[16:18] == "99":
            mun[l[11:16]] = {"censo": _n(l[149:157]), "votantes": _n(l[189:197]) + _n(l[197:205]) + _n(l[205:213]),
                             "familias": Counter()}
    for l in _lineas(z, "06"):
        if l[14:16] == "99" and l[9:14] in mun:
            mun[l[9:14]]["familias"][fam[l[16:22]]] += _n(l[22:30])
    return mun


# ---------- salida para la web ----------

def _validos(p: dict) -> int:
    return p["candidaturas"] + p["blancos"]


def resumen(id_: str, fecha: str, e: dict) -> dict:
    """Lo que necesitan los gráficos del histórico: nacional por familia y provincia por familia."""
    prov = e["prov"]
    censo = sum(p["censo"] for p in prov.values())
    votantes = sum(p["candidaturas"] + p["blancos"] + p["nulos"] for p in prov.values())
    fam = defaultdict(lambda: [0, 0])
    for x in e["nacional"].values():
        fam[x["familia"]][0] += x["votos"]
        fam[x["familia"]][1] += x["escanos"]
    partidos = sorted(e["nacional"].values(), key=lambda x: (-x["escanos"], -x["votos"]))
    validos = sum(_validos(p) for p in prov.values())
    return {
        "id": id_, "fecha": fecha, "censo": censo, "votantes": votantes, "validos": validos,
        "blancos": sum(p["blancos"] for p in prov.values()), "nulos": sum(p["nulos"] for p in prov.values()),
        "fam": {f: fam[f] for f in ORDEN if f in fam},
        # siglas, denominación, familia, votos, escaños: las que sacaron escaño o más del 1 % de los votos válidos
        "partidos": [[x["siglas"], x["nombre"], x["familia"], x["votos"], x["escanos"]] for x in partidos
                     if x["escanos"] or x["votos"] >= 0.01 * validos],
        "prov": {c: {"e": p["escanos"], "censo": p["censo"], "votantes": p["candidaturas"] + p["blancos"] + p["nulos"],
                     "validos": _validos(p),
                     "fam": {f: v for f, v in _por_familia(p["lista"]).items()}} for c, p in sorted(prov.items())},
    }


def _por_familia(lista: list[dict]) -> dict[str, list[int]]:
    out: dict[str, list[int]] = {}
    for x in lista:
        t = out.setdefault(x["familia"], [0, 0])
        t[0] += x["votos"]
        t[1] += x["escanos"]
    return {f: out[f] for f in ORDEN if f in out}


def detalle(e: dict) -> dict:
    """Todas las candidaturas de cada circunscripción (para el D'Hondt, el precio del escaño y el último escaño)."""
    from .elecciones import dhondt, votos_sin_escano
    out = {}
    for c, p in sorted(e["prov"].items()):
        lista = sorted(p["lista"], key=lambda x: -x["votos"])
        votos = {x["siglas"] + "|" + x["nac"]: x["votos"] for x in lista}
        r = dhondt(votos, p["escanos"], _validos(p))
        reparto_oficial = {x["siglas"] + "|" + x["nac"]: x["escanos"] for x in lista if x["escanos"]}
        u = r["ultimo"] if r["escanos"] == reparto_oficial else None   # 1977 S/C Tenerife no casa: no se inventa
        out[c] = {"e": p["escanos"], "validos": _validos(p), "blancos": p["blancos"],
                  "sin_escano": votos_sin_escano(votos, reparto_oficial),
                  "c": [[x["siglas"], x["familia"], x["votos"], x["escanos"]] for x in lista if x["votos"]],
                  **({"ultimo": {"gana": u["gana"].split("|")[0], "segundo": u["segundo"].split("|")[0],
                                 "faltan": u["faltan"]}} if u and u.get("segundo") else {})}
    return out


def municipios_web(id_: str) -> dict:
    """INE -> [censo, votantes, votos de cada familia en el orden de ORDEN (0 si no tuvo)]."""
    mun = leer_municipios(id_)
    return {"orden": ORDEN, "municipios": {c: [m["censo"], m["votantes"], *[m["familias"].get(f, 0) for f in ORDEN]]
                                            for c, m in sorted(mun.items())}}


def escribir() -> dict:
    SALIDA.mkdir(parents=True, exist_ok=True)
    elecciones, por_provincia, anterior = [], defaultdict(dict), None
    for id_, fecha in ELECCIONES:
        e = leer_eleccion(id_)
        r = resumen(id_, fecha, e)
        validos = r["validos"]
        r["metricas"], anterior = metricas(e["nacional"], validos, anterior)
        leg, presidentes = LEGISLATURAS[id_]
        r["legislatura"], r["presidentes"] = leg, presidentes
        elecciones.append(r)
        d = detalle(e)
        r["metricas"]["sin_escano"] = sum(p["sin_escano"] for p in d.values())
        dump(SALIDA / f"historico-{id_}.json", {"id": id_, "fecha": fecha, "prov": d})
        for cod, p in d.items():
            por_provincia[cod][id_] = {**p, "censo": e["prov"][cod]["censo"], "nulos": e["prov"][cod]["nulos"]}
    # La duración de cada legislatura: hasta la elección siguiente (la XV, hasta la disolución de 2026).
    for a, b in zip(elecciones, elecciones[1:] + [{"fecha": "2026-10-06"}]):
        a["hasta"] = b["fecha"]
    historico = {"familias": [{"id": f, "nombre": n, "color": c} for f, n, c, _ in FAMILIAS], "elecciones": elecciones}
    dump(SALIDA / "historico.json", historico)
    carpeta = SALIDA / "provincias"
    carpeta.mkdir(exist_ok=True)
    for cod, porid in por_provincia.items():   # todo el histórico de una provincia, para su ficha
        dump(carpeta / f"{cod}.json", porid)
    for id_ in MAPAS_MUNICIPALES:
        dump(SALIDA / f"municipios-{id_}.json", municipios_web(id_))
    return historico


def dump(ruta, datos) -> None:
    ruta.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    h = escribir()
    for e in h["elecciones"]:
        print(e["fecha"], " ".join(f"{f}:{v[1]}" for f, v in e["fam"].items() if v[1]),
              f"· participación {e['votantes'] / e['censo']:.1%}")
    for f in sorted(SALIDA.glob("historico*.json")) + sorted(SALIDA.glob("municipios-*.json")):
        print(f"{f.name}: {f.stat().st_size / 1024:.0f} KB")
