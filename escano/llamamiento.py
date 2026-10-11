"""Votaciones públicas por llamamiento, sacadas del Diario de Sesiones.

Cuando se pide votación por llamamiento (art. 86 del Reglamento), los diputados responden de viva voz y no hay
votación electrónica: no sale en los datos abiertos de votaciones del Congreso. El Diario de Sesiones sí recoge
quién dijo «sí», «no» o «abstención» (también el voto telemático, el Gobierno y la Mesa) y el resultado que lee la Presidencia.
Así se votaron, por ejemplo, los dos decretos-leyes de vivienda del 2 de octubre de 2026.

Los nombres van seguidos, sin separador («Vergara Román, Laura Vidal Sáez, Aina…»): se casan con los diputados de
la última votación electrónica de esos días. Una votación solo se guarda si cada nombre casa con un diputado y los
recuentos dan exactamente el resultado oficial. Se guardan en data/votaciones/AAAA-MM-DD.json junto a las
electrónicas del día, con su mismo formato y "llamamiento": true; el enlace es el del Diario.

    python -m escano.llamamiento        # repasa todos los plenos guardados
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import date

from . import votaciones
from .config import DATOS, GRUPOS, VOTACIONES

SESIONES = DATOS / "sesiones"

RE_LISTA = re.compile(r"(?:Señoras y señores diputados|Miembros de la Mesa|Miembros del Gobierno) que (?:dijeron|votaron) "
                      r"«(sí|no|abstención)»(?: telemáticamente)?:")
RE_RUIDO = re.compile(r"cve: \S+ DIARIO DE SESIONES DEL CONGRESO DE LOS DIPUTADOS|Núm\. \d+ .{0,60}?Pág\. \d+")
RE_RESULTADO = re.compile(r"resultado de la votación (?:ha sido el siguiente|es el siguiente)[^.]*?: votos emitidos, (\d+); "
                          r"votos a favor, (\d+); votos en contra, (\d+)(?:; (?:abstenciones, (\d+)|ninguna abstención))?")
VOTO = {"sí": "S", "no": "N", "abstención": "A"}
CODIGO_GRUPO = {corto: oficial for oficial, corto in GRUPOS.items()}   # 'PSOE' -> 'GS', como en los datos abiertos


def _norma(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[‐-―−]", "-", s)
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def _diputados_del_dia(fecha: str) -> list[list]:
    """[nombre, grupo, asiento] de la última votación electrónica hasta `fecha`."""
    for f in sorted(VOTACIONES.glob("*.json"), reverse=True):
        if f.stem <= fecha:
            datos = json.loads(f.read_text())
            if isinstance(datos, dict) and not all(v.get("llamamiento") for v in datos["votaciones"]):
                return datos["diputados"]
    return []


def _casar(texto: str, nombres: dict[str, str]) -> tuple[list[str], str]:
    """Parte una lista de nombres seguidos: en cada punto, el nombre conocido más largo. Devuelve los nombres y lo que
    no ha casado (vacío si todo)."""
    t, k, salida = _norma(RE_RUIDO.sub(" ", texto)), 0, []
    claves = sorted(nombres, key=len, reverse=True)
    while k < len(t):
        if t[k] == " ":
            k += 1
            continue
        n = next((c for c in claves if t.startswith(c, k) and (k + len(c) == len(t) or t[k + len(c)] in " .")), None)
        if not n:
            return salida, t[k:k + 60]
        salida.append(nombres[n])
        k += len(n)
    return salida, ""


def de_sesion(ses: dict) -> list[dict]:
    """Las votaciones por llamamiento de una sesión, ya comprobadas, en el formato de votaciones.leer_votacion."""
    ivs = ses.get("intervenciones", [])
    dips = _diputados_del_dia(ses["fecha"])
    if not dips:
        return []
    nombres = {_norma(d[0]): d[0] for d in dips}
    info = {d[0]: d for d in dips}
    previas = [v for f in [VOTACIONES / f"{ses['fecha']}.json"] if f.exists()
               for v in votaciones.leer_dia(f) if not v.get("llamamiento") and v["sesion"] == ses["sesion"]]
    numero = max((v["numero"] or 0 for v in previas), default=0)
    salida = []
    for k, iv in enumerate(ivs):
        texto = iv.get("texto", "")
        cortes = list(RE_LISTA.finditer(texto))
        if not cortes:
            continue
        votos: dict[str, str] = {}
        for j, m in enumerate(cortes):
            fin = cortes[j + 1].start() if j + 1 < len(cortes) else len(texto)
            lista, resto = _casar(texto[m.end():fin], nombres)
            if resto:
                print(f"  llamamiento {ses['id']}: no se reconoce «{resto}»; no se guarda")
                lista = None
                break
            for n in lista:
                votos[n] = VOTO[m.group(1)]
        if lista is None:
            continue
        res = next((RE_RESULTADO.search(x.get("texto", "")) for x in ivs[k + 1:k + 4] if RE_RESULTADO.search(x.get("texto", ""))), None)
        if not res:
            print(f"  llamamiento {ses['id']}: sin resultado leído por la Presidencia; no se guarda")
            continue
        emitidos, si, no, abst = (int(x or 0) for x in res.groups())
        cuenta = {x: sum(1 for v in votos.values() if v == x) for x in "SNA"}
        if (cuenta["S"], cuenta["N"], cuenta["A"]) != (si, no, abst) or len(votos) != emitidos:
            print(f"  llamamiento {ses['id']}: {cuenta} no cuadra con {si}-{no}-{abst} ({emitidos}); no se guarda")
            continue
        numero += 1
        item = (iv.get("item") or "").strip()
        titulo = re.sub(r"\s*\((?:B\.O\.E\.|Número de expediente)[^)]*\)", "", item).strip().rstrip(".") + "."
        titulo = titulo.replace("Real Decreto Ley", "Real Decreto-ley")
        d, m_, a = (int(x) for x in reversed(ses["fecha"].split("-")))
        v = votaciones.leer_votacion({
            "informacion": {"sesion": ses["sesion"], "numeroVotacion": numero, "fecha": f"{d}/{m_}/{a}",
                            "titulo": "Convalidación o derogación de Reales Decretos-leyes" if titulo.startswith("Real Decreto")
                            else "Votación pública por llamamiento",
                            "textoExpediente": titulo},
            "totales": {"asentimiento": "No", "presentes": emitidos, "afavor": si, "enContra": no,
                        "abstenciones": abst, "noVotan": len(dips) - emitidos},
            "votaciones": [{"diputado": n, "grupo": CODIGO_GRUPO.get(info[n][1], info[n][1]), "asiento": info[n][2] or "",
                            "voto": {"S": "Sí", "N": "No", "A": "Abstención"}.get(votos.get(n), "No vota")}
                           for n in info]}, ses.get("ds", ""))
        v["exp"] = iv.get("exp") or v["exp"]
        v["llamamiento"] = True
        salida.append(v)
    return salida


def actualizar() -> list[dict]:
    """Repasa los plenos guardados y deja sus votaciones por llamamiento en el fichero de su día."""
    todas = []
    for f in sorted(SESIONES.glob("DSCD-*-PL-*.json")):
        ses = json.loads(f.read_text())
        if "«sí»" not in json.dumps(ses, ensure_ascii=False):
            continue
        nuevas = de_sesion(ses)
        if not nuevas:
            continue
        dia = VOTACIONES / f"{ses['fecha']}.json"
        electronicas = [v for v in votaciones.leer_dia(dia) if not v.get("llamamiento")] if dia.exists() else []
        votaciones.guardar_dia(ses["fecha"], electronicas + nuevas)
        todas += nuevas
    return todas


if __name__ == "__main__":
    for v in actualizar():
        print(f"{v['id']} · {v['fecha']} · {v['titulo'][:80]} · {v['si']}-{v['no']}-{v['abst']}")
