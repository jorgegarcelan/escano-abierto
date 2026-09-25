"""Composición de las comisiones del Congreso (datos abiertos, «Órganos del Congreso»).

La página de datos abiertos no enlaza ficheros fijos: pide la lista de comisiones con un POST y, para cada
una, su composición con otro POST que devuelve JSON (nombre, cargo, grupo, fechas de alta y baja).
"""
from __future__ import annotations

import json
import re
import time

import requests

from .config import BASE, DATOS, LEGISLATURA_ROMANA, USER_AGENT

URL_LISTA = (BASE + "/es/opendata/organos?p_p_id=opendata&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view"
             "&p_p_resource_id=resourceIDOrganos&p_p_cacheability=cacheLevelPage")
URL_COMPOSICION = (BASE + "/es/organos/composicion-en-la-legislatura?p_p_id=organos&p_p_lifecycle=2&p_p_state=normal"
                   "&p_p_mode=view&p_p_resource_id=searchOrgano&p_p_cacheability=cacheLevelPage"
                   "&_organos_selectedLegislatura={leg}&_organos_statusOpenData=true"
                   "&_organos_selectedOrganoSup={sup}&_organos_selectedSuborgano={sub}")
FICHERO = DATOS / "comisiones.json"
TIPO_COMISIONES = 3


def _post(url: str, datos: dict) -> dict:
    r = requests.post(url, data=datos, headers={"User-Agent": USER_AGENT}, timeout=60)
    r.raise_for_status()
    time.sleep(0.5)  # ser amables con el servidor del Congreso
    return r.json()


def lista_comisiones(legislatura: int = 15) -> list[dict]:
    """[{nombre, sup, sub}] de las comisiones de la legislatura."""
    d = _post(URL_LISTA, {"_opendata_tipoConsulta": TIPO_COMISIONES, "_opendata_legislatura": legislatura})
    salida = []
    for o in d.get("datosOrganos", []):
        sup = re.search(r"selectedOrganoSup=(\d+)", o.get("urlExport", ""))
        sub = re.search(r"selectedSuborgano=(\d+)", o.get("urlExport", ""))
        if sup and sub:
            salida.append({"nombre": o["descOrgano"].strip(), "sup": sup.group(1), "sub": sub.group(1)})
    return salida


def leer_composicion(datos: dict) -> list[dict]:
    """Miembros de una comisión: [{nombre, cargo, siglas, alta, baja, codigo}]."""
    miembros = []
    for m in datos.get("data", []):
        cod = re.search(r"codParlamentario=(\d+)", m.get("urlFichaDiputado", "") or "")
        miembros.append({
            "nombre": (m.get("apellidosNombre") or "").strip(),
            "cargo": (m.get("descCargo") or "").strip(),
            "siglas": (m.get("siglas") or "").strip(),
            "alta": m.get("fechaAltaFormat") or "",
            "baja": m.get("fechaBajaFormat") or "",
            "codigo": int(cod.group(1)) if cod else None,
        })
    return miembros


def actualizar() -> dict:
    """Descarga la composición de todas las comisiones y la guarda en data/comisiones.json."""
    salida = {}
    for c in lista_comisiones():
        url = URL_COMPOSICION.format(leg=LEGISLATURA_ROMANA, sup=c["sup"], sub=c["sub"])
        datos = _post(url, {"_organos_selectedLegislatura": LEGISLATURA_ROMANA, "_organos_selectedOrganoSup": c["sup"],
                            "_organos_selectedSuborgano": c["sub"], "_organos_compoHistorica": "false"})
        salida[c["nombre"]] = leer_composicion(datos)
    if salida:
        FICHERO.parent.mkdir(parents=True, exist_ok=True)
        FICHERO.write_text(json.dumps(salida, ensure_ascii=False, indent=1))
    return salida


def leer() -> dict:
    return json.loads(FICHERO.read_text()) if FICHERO.exists() else {}
