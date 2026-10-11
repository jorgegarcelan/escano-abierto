"""Geografía de España: comunidades, provincias y municipios, con los datos del INE.

Es una sección autocontenida (podría servirse en otra web): lee las geometrías de `geo.py` y los escaños de
`data/elecciones/historico.json`, descarga del INE lo demás y escribe `data/geografia/`, que `construir` copia
a `site/datos/geografia/`. Los datos del INE cambian una vez al año, así que no va en la actualización diaria.

    python -m escano.geografia            # descarga (con caché en data/raw/geografia) y escribe data/geografia/

Ficheros:
- `territorios.json`: España, las 19 comunidades y ciudades autónomas y las 52 provincias, con su población desde
  1996, superficie, municipios, edad media, envejecimiento, esperanza de vida, paro, renta y escaños.
- `geo-ccaa.json`: los contornos de las comunidades, en el mismo lienzo que `geo-provincias.json`.
- `municipios.json`: una fila por municipio (posición en el mapa, superficie, población de 1996 y de hoy, renta,
  edad media, mayores de 65 y primera fuerza el 23J), para la historia con el mapa fijo y las fichas.
"""
from __future__ import annotations

import json
import math
import shutil
import time
from pathlib import Path

from . import geo
from .config import CRUDOS, DATOS

CARPETA = DATOS / "geografia"
CRUDOS_GEO = CRUDOS / "geografia"
INE = "https://servicios.ine.es/wstempus/js/ES/"

# Comunidades y ciudades autónomas con su código INE, el nombre oficial, el corto y sus provincias.
CCAA = {
    "01": ("Andalucía", "Andalucía", ["04", "11", "14", "18", "21", "23", "29", "41"]),
    "02": ("Aragón", "Aragón", ["22", "44", "50"]),
    "03": ("Principado de Asturias", "Asturias", ["33"]),
    "04": ("Illes Balears", "Baleares", ["07"]),
    "05": ("Canarias", "Canarias", ["35", "38"]),
    "06": ("Cantabria", "Cantabria", ["39"]),
    "07": ("Castilla y León", "Castilla y León", ["05", "09", "24", "34", "37", "40", "42", "47", "49"]),
    "08": ("Castilla-La Mancha", "Castilla-La Mancha", ["02", "13", "16", "19", "45"]),
    "09": ("Cataluña", "Cataluña", ["08", "17", "25", "43"]),
    "10": ("Comunitat Valenciana", "C. Valenciana", ["03", "12", "46"]),
    "11": ("Extremadura", "Extremadura", ["06", "10"]),
    "12": ("Galicia", "Galicia", ["15", "27", "32", "36"]),
    "13": ("Comunidad de Madrid", "Madrid", ["28"]),
    "14": ("Región de Murcia", "Murcia", ["30"]),
    "15": ("Comunidad Foral de Navarra", "Navarra", ["31"]),
    "16": ("País Vasco", "País Vasco", ["01", "20", "48"]),
    "17": ("La Rioja", "La Rioja", ["26"]),
    "18": ("Ciudad Autónoma de Ceuta", "Ceuta", ["51"]),
    "19": ("Ciudad Autónoma de Melilla", "Melilla", ["52"]),
}
CCAA_DE = {p: c for c, (_, _, ps) in CCAA.items() for p in ps}

# Tablas del INE (servicios.ine.es/wstempus). La de renta e indicadores del Atlas de renta va por provincias.
T_PADRON = 29005            # Cifras oficiales del padrón por municipio (1996–)
T_EDAD = {"00": 3197, "ccaa": 3198, "prov": 3199}          # Edad media de la población
T_ENVEJ = {"00": 1418, "ccaa": 1452, "prov": 1489}         # Índice de envejecimiento (mayores de 64 por cada 100 menores de 16)
T_VIDA = {"00": 1414, "ccaa": 1448, "prov": 1485}          # Esperanza de vida al nacimiento
T_PARO = {"ccaa": 65335, "prov": 65349}                    # EPA: tasa de paro (la provincial trae el total nacional)
T_ATLAS_RENTA, T_ATLAS_DEMO = 30824, 30832                 # Atlas de distribución de renta de los hogares (toda España)


# ---------- descargas ----------

def _ine(ruta: str, nombre: str, *, refrescar: bool = False) -> list | dict:
    """Pide una ruta de la API del INE y la guarda en data/raw/geografia/<nombre>.json."""
    import requests
    from .red import _sesion
    destino = CRUDOS_GEO / f"{nombre}.json"
    if destino.exists() and not refrescar:
        return json.loads(destino.read_text())
    for intento in range(4):
        try:
            r = _sesion.get(INE + ruta, timeout=240)
            r.raise_for_status()
            datos = r.json()
            break
        except (requests.RequestException, ValueError):
            if intento == 3:
                raise
            time.sleep(3 * 2 ** intento)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(datos, ensure_ascii=False))
    time.sleep(0.4)
    return datos


def _tabla(id_: int, nult: int = 1, filtro: str = "", **kw) -> list[dict]:
    q = f"DATOS_TABLA/{id_}?tip=AM&nult={nult}" + (f"&tv={filtro}" if filtro else "")
    return _ine(q, f"tabla-{id_}-{nult}{'-' + filtro.replace(':', '_') if filtro else ''}", **kw)


def _meta(serie: dict, variable: str) -> str | None:
    return next((m.get("Codigo") for m in serie.get("MetaData", []) if m.get("T3_Variable") == variable), None)


def _territorio(serie: dict) -> str | None:
    """Código del territorio de una serie: '00' (España), 'c01'… (comunidad) o '01'… (provincia)."""
    for m in serie.get("MetaData", []):
        v, c = m.get("T3_Variable"), m.get("Codigo")
        if v in ("Total Nacional", "Totales Territoriales") and c in ("00", ""):
            return "00"
        if v == "Provincias" and c:
            return c
        if v == "Comunidades y Ciudades Autónomas" and c:
            return "c" + c
    return None


def _ultimo(serie: dict) -> tuple[float | None, str | None]:
    datos = [d for d in serie.get("Data", []) if d.get("Valor") is not None]
    if not datos:
        return None, None
    d = max(datos, key=lambda d: d["Fecha"])
    return d["Valor"], str(d["Anyo"]) + (d["T3_Periodo"] if str(d.get("T3_Periodo", "")).startswith("T") else "")


def _es_total(serie: dict, sexo_ok=("0", "", None)) -> bool:
    """Ambos sexos (y el total de nacionalidades y edades cuando la tabla los desglosa)."""
    n = serie.get("Nombre", "")
    if _meta(serie, "Sexo") not in sexo_ok and "Ambos sexos" not in n:
        return False
    return not any(x in n for x in ("Hombres", "Mujeres", "Varones", "Española", "Extranjera"))


def indicador(tablas: dict[str, int], filtro_nombre=lambda n: True, nult: int = 1) -> tuple[dict[str, float], str | None]:
    """Valor más reciente de un indicador para España ('00'), comunidades ('c01'…) y provincias ('01'…)."""
    salida: dict[str, float] = {}
    periodo = None
    for id_ in tablas.values():
        for s in _tabla(id_, nult):
            t = _territorio(s)
            if not t or not _es_total(s) or not filtro_nombre(s.get("Nombre", "")):
                continue
            v, p = _ultimo(s)
            if v is not None and t not in salida:
                salida[t] = v
                periodo = max(periodo or "", p or "")
    return salida, periodo


def paro() -> tuple[dict[str, float], str | None]:
    """Tasa de paro de la EPA: media de los cuatro últimos trimestres (la provincial, trimestre a trimestre, es ruidosa)."""
    salida, periodo = {}, None
    for id_ in T_PARO.values():
        for s in _tabla(id_, 4):
            n = s.get("Nombre", "")
            if not n.startswith("Tasa de paro") or "Ambos sexos" not in n:
                continue
            if "16 a 64" in n or "Española" in n or "Extranjera" in n or not (n.rstrip().endswith("Total.") or "16 y más" in n):
                continue
            t = _territorio(s)
            datos = [d for d in s["Data"] if d.get("Valor") is not None]
            if not t or len(datos) < 4 or t in salida:
                continue
            salida[t] = round(sum(d["Valor"] for d in datos) / len(datos), 2)
            ult = max(datos, key=lambda d: d["Fecha"])
            periodo = f"{ult['Anyo']}{ult['T3_Periodo']}"
    return salida, periodo


def padron() -> tuple[dict[str, dict[int, int]], dict[str, str]]:
    """Población de cada municipio (código INE de 5 cifras) por año, desde 1996, y su nombre."""
    pob: dict[str, dict[int, int]] = {}
    nombres: dict[str, str] = {}
    for s in _tabla(T_PADRON, 40, "18:451"):
        cod = _meta(s, "Municipios")
        if not cod or len(cod) != 5:
            continue
        nombres[cod] = next(m["Nombre"] for m in s["MetaData"] if m.get("T3_Variable") == "Municipios")
        pob[cod] = {int(d["Anyo"]): int(d["Valor"]) for d in s["Data"] if d.get("Valor") is not None}
    return pob, nombres


def _csv_atlas(id_: int, indicadores: dict[str, str], *, refrescar: bool = False) -> dict:
    """Lee en streaming el CSV nacional de una tabla del Atlas de renta (cientos de MB, con distritos y secciones; la
    API no lo sirve «por restricciones de volumen») y guarda solo el último año de cada municipio."""
    from .red import _sesion
    destino = CRUDOS_GEO / f"atlas-{id_}.json"
    if destino.exists() and not refrescar:
        return json.loads(destino.read_text())
    salida: dict[str, dict] = {}
    anio: dict[str, int] = {}
    with _sesion.get(f"https://www.ine.es/jaxiT3/files/t/es/csv_bdsc/{id_}.csv", timeout=600, stream=True) as r:
        r.raise_for_status()
        for linea in r.iter_lines(decode_unicode=False):
            partes = linea.decode("utf-8-sig", "replace").split(";")
            if len(partes) != 6 or partes[1] or partes[2]:     # solo las filas de municipio (sin distrito ni sección)
                continue
            muni, _, _, ind, periodo, valor = partes
            campo = indicadores.get(ind)
            cod = muni[:5]
            if not campo or not cod.isdigit() or not periodo.isdigit():
                continue
            try:
                v = float(valor.replace(".", "").replace(",", "."))
            except ValueError:
                continue
            clave = f"{cod}|{campo}"
            if int(periodo) > anio.get(clave, 0):
                anio[clave] = int(periodo)
                salida.setdefault(cod, {})[campo] = v
    datos = {"anio": max(anio.values(), default=None), "municipios": salida}
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(datos, ensure_ascii=False))
    return datos


def atlas_renta() -> tuple[dict[str, dict], str | None]:
    """Del Atlas de distribución de renta de los hogares, lo de cada municipio: renta neta media por persona, edad
    media y porcentaje de mayores de 65 (sus tablas nacionales: 30824, renta; 30832, indicadores demográficos)."""
    renta = _csv_atlas(T_ATLAS_RENTA, {"Renta neta media por persona": "renta"})
    demo = _csv_atlas(T_ATLAS_DEMO, {"Edad media de la población": "edad", "Porcentaje de población de 65 y más años": "may65"})
    salida: dict[str, dict] = {}
    for d in (renta, demo):
        for cod, x in d["municipios"].items():
            salida.setdefault(cod, {}).update(x)
    return salida, str(renta["anio"]) if renta["anio"] else None


# ---------- geometría ----------

def _area_km2(anillo: list[tuple[float, float]]) -> float:
    """Área de un anillo en longitud/latitud sobre la esfera (la fórmula de Chamberlain y Duquette)."""
    R = 6371.0088
    a = 0.0
    for (l1, f1), (l2, f2) in zip(anillo, anillo[1:] + anillo[:1]):
        a += math.radians(l2 - l1) * (2 + math.sin(math.radians(f1)) + math.sin(math.radians(f2)))
    return abs(a * R * R / 2)


def superficies(topo: dict, objeto: str) -> dict[str, float]:
    """Superficie de cada geometría en km² (los anillos interiores, enclaves de otro municipio, se restan)."""
    arcos = geo._arcos(topo)
    salida = {}
    for g in topo["objects"][objeto]["geometries"]:
        total = 0.0
        for pol in geo._anillos(g):
            for k, anillo in enumerate(pol):
                a = _area_km2(geo._anillo_puntos(anillo, arcos))
                total += a if k == 0 else -a
        salida[str(g.get("id", ""))] = round(total, 2)
    return salida


def capas() -> tuple[dict, dict, dict]:
    """Contornos de las comunidades (en el lienzo de geo-provincias), y centroide y superficie de cada municipio."""
    geo.descargar()
    topo = json.loads((geo.CARPETA_CRUDOS / "municipalities.json").read_text())
    _, proj = geo._capa(topo, "provinces", 0.5, 1)    # la misma proyección que geo.escribir()
    ccaa, _ = geo._capa(topo, "autonomous_regions", 0.4, 1, proj, es_canarias=lambda c: c == "05")
    munis, _ = geo._capa(topo, "municipalities", 2.0, 0, proj)
    area = superficies(topo, "municipalities")
    geo_ccaa = {"ancho": geo.ANCHO, "alto": geo.ALTO, "canarias": proj.recuadro,
                "ccaa": {c: {"n": CCAA[c][0], "corto": CCAA[c][1], "d": x["d"], "c": x["c"], "bb": x["bb"]}
                         for c, x in sorted(ccaa.items()) if c in CCAA}}
    return geo_ccaa, {c: m["c"] for c, m in munis.items()}, area


# ---------- escaños y voto ----------

def escanos() -> dict[str, int]:
    """Escaños de cada provincia en las últimas generales (los que reparte el decreto de convocatoria)."""
    h = json.loads((DATOS / "elecciones" / "historico.json").read_text())
    return {c: p["e"] for c, p in h["elecciones"][-1]["prov"].items()}


def primera_fuerza() -> tuple[dict[str, int], list[str], dict[str, list[str]]]:
    """Familia política más votada en cada municipio el 23J (índice en `orden`), y el nombre y color de cada familia."""
    ruta = DATOS / "elecciones" / "municipios-202307.json"
    if not ruta.exists():
        return {}, [], {}
    familias = {f["id"]: [f["nombre"], f["color"]]
                for f in json.loads((DATOS / "elecciones" / "historico.json").read_text())["familias"]}
    m = json.loads(ruta.read_text())
    orden = m["orden"]
    salida = {}
    for cod, fila in m["municipios"].items():
        votos = fila[2:2 + len(orden)]
        if any(votos):
            salida[cod] = max(range(len(orden)), key=lambda k: votos[k])
    return salida, orden, {f: familias[f] for f in orden if f in familias}


# ---------- escribir ----------

def _r(x, d=1):
    return None if x is None else round(x, d)


def construir_datos() -> dict:
    pob, nombres = padron()
    anios = sorted({a for s in pob.values() for a in s})
    ult = anios[-1]
    adrh, anio_renta = atlas_renta()
    geo_ccaa, centro, area = capas()
    edad, p_edad = indicador(T_EDAD)
    envej, p_envej = indicador(T_ENVEJ)
    vida, p_vida = indicador(T_VIDA)
    tparo, p_paro = paro()
    esc = escanos()
    gana, orden, familias = primera_fuerza()

    def agregado(cods: list[str]) -> dict:
        serie = [sum(pob[c].get(a, 0) for c in cods) for a in anios]
        hoy = serie[-1]
        km2 = sum(area.get(c, 0) for c in cods)
        pequenos = [c for c in cods if 0 < pob[c].get(ult, 0) < 1000]
        con_renta = [c for c in cods if adrh.get(c, {}).get("renta") and pob[c].get(ult)]
        pob_renta = sum(pob[c][ult] for c in con_renta)
        mayor = max(cods, key=lambda c: pob[c].get(ult, 0)) if cods else None
        pierden = [c for c in cods if pob[c].get(anios[0]) and pob[c].get(ult, 0) < pob[c][anios[0]]]
        return {
            "pob": hoy, "serie": serie, "km2": round(km2), "dens": _r(hoy / km2 if km2 else None),
            "mun": len([c for c in cods if pob[c].get(ult)]),
            "mun_peq": len(pequenos), "pob_peq": sum(pob[c][ult] for c in pequenos),
            "pierden": len(pierden),
            # Renta: media de sus municipios ponderada por población (el Atlas no da totales provinciales).
            "renta": round(sum(adrh[c]["renta"] * pob[c][ult] for c in con_renta) / pob_renta) if pob_renta else None,
            "mayor": [mayor, nombres.get(mayor), pob[mayor].get(ult)] if mayor else None,
        }

    por_prov: dict[str, list[str]] = {}
    for c in pob:
        por_prov.setdefault(c[:2], []).append(c)

    provincias = {}
    for p in sorted(geo.CIRCUNSCRIPCIONES):
        cods = por_prov.get(p, [])
        d = agregado(cods)
        provincias[p] = {"n": geo.CIRCUNSCRIPCIONES[p], "corto": geo.NOMBRE_CORTO.get(p, geo.CIRCUNSCRIPCIONES[p]),
                         "ccaa": CCAA_DE[p], **d, "edad": _r(edad.get(p)), "envej": _r(envej.get(p)),
                         "vida": _r(vida.get(p), 2), "paro": _r(tparo.get(p)), "esc": esc.get(p)}
    ccaa = {}
    for c, (nombre, corto, ps) in CCAA.items():
        cods = [m for p in ps for m in por_prov.get(p, [])]
        ccaa[c] = {"n": nombre, "corto": corto, "provincias": ps, **agregado(cods),
                   "edad": _r(edad.get("c" + c)), "envej": _r(envej.get("c" + c)), "vida": _r(vida.get("c" + c), 2),
                   "paro": _r(tparo.get("c" + c)), "esc": sum(esc.get(p, 0) for p in ps)}
    espana = {"n": "España", **agregado(list(pob)), "edad": _r(edad.get("00")), "envej": _r(envej.get("00")),
              "vida": _r(vida.get("00"), 2), "paro": _r(tparo.get("00")), "esc": sum(esc.values())}

    territorios = {
        "anios": anios,
        "fuentes": {"padron": ult, "renta": anio_renta, "edad": p_edad, "envej": p_envej, "vida": p_vida, "paro": p_paro},
        "espana": espana, "ccaa": ccaa, "provincias": provincias,
    }
    # Municipios: [nombre, x, y, km2, pob_hoy, pob_1996 (o el primer año con dato), renta, edad, % >65, primera fuerza]
    filas = {}
    for c in sorted(pob):
        if c not in centro or not pob[c].get(ult):
            continue
        a0 = next((a for a in anios if pob[c].get(a)), None)
        x = adrh.get(c, {})
        filas[c] = [nombres[c], centro[c][0], centro[c][1], area.get(c) or None, pob[c][ult], pob[c].get(anios[0]) if a0 == anios[0] else None,
                    _r(x.get("renta"), 0), _r(x.get("edad")), _r(x.get("may65")), gana.get(c)]
    municipios = {"anio": ult, "anio0": anios[0], "orden": orden, "familias": familias,
                  "campos": ["nombre", "x", "y", "km2", "pob", "pob0", "renta", "edad", "may65", "gana"], "m": filas}
    return {"territorios": territorios, "geo-ccaa": geo_ccaa, "municipios": municipios}


def escribir_datos() -> dict:
    datos = construir_datos()
    CARPETA.mkdir(parents=True, exist_ok=True)
    for nombre, d in datos.items():
        (CARPETA / f"{nombre}.json").write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")))
    return datos


def escribir(carpeta: Path) -> None:
    """Copia lo versionado (data/geografia/) a la web. Lo llama `construir`."""
    if not CARPETA.exists():
        return
    carpeta.mkdir(parents=True, exist_ok=True)
    for f in sorted(CARPETA.glob("*.json")):
        shutil.copyfile(f, carpeta / f.name)


if __name__ == "__main__":
    d = escribir_datos()
    for f in sorted(CARPETA.glob("*.json")):
        print(f"{f.name}: {f.stat().st_size / 1024:.0f} KB")
    t = d["territorios"]
    print(f"{len(d['municipios']['m'])} municipios · padrón {t['fuentes']}")
