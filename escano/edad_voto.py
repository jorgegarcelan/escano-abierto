"""Cómo votó cada edad en las generales de 2023, del estudio postelectoral del CIS (nº 3420, septiembre de 2023).

Dos tablas de su tabulación por variables sociodemográficas:

- P6aR: a qué partido votó, entre quienes votaron (N = 8.976), por grupo de edad.
- P6aa: el recuerdo de voto de todos los entrevistados (N = 10.104), de donde sale cuántos dicen que no votaron.

El recuerdo de voto del CIS se queda corto con el PP y Vox (en el total, el 23,9 % dice haber votado al PP, que sacó
el 33,1 %). Para cada partido se calcula un factor que lleva su total al resultado real y se aplica a todas las
edades: se conserva la diferencia entre edades, que es lo que importa aquí, con el tamaño real de cada partido.

    python -m escano.edad_voto      # descarga el PDF (una vez), lo lee y escribe data/elecciones/voto-edad.json
"""
from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path

from .config import DATOS
from .red import descargar

PDF = "https://www.cis.es/documents/d/guest/es3420sdmt_a"
EDADES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65-74", "75+"]
PARTIDOS = {"PP": "PP", "PSOE": "PSOE", "VOX": "VOX", "Sumar": "SUMAR", "ERC": "OTROS", "Junts": "OTROS", "EH Bildu": "OTROS",
            "EAJ-PNV": "OTROS", "BNG": "OTROS", "CCa": "OTROS", "UPN": "OTROS", "PACMA": "OTROS", "Otro partido": "OTROS"}
RESULTADO = {"PP": 33.1, "PSOE": 31.7, "VOX": 12.4, "SUMAR": 12.3}   # % de los votos válidos el 23J (Interior)
SALIDA = DATOS / "elecciones" / "voto-edad.json"


def _num(s: str) -> float:
    return 0.0 if s in ("-", "") else float(s.replace(".", "").replace(",", "."))


def _tabla(texto: str, pregunta: str) -> tuple[dict[str, list[float]], list[int]]:
    """Las filas de una pregunta (todas las columnas: total, hombre, mujer y las siete edades) y su (N)."""
    i = texto.index(f"Pregunta {pregunta}\n")
    fin = min(x for x in (texto.find("Pregunta ", i + 1), texto.find("Pág", i)) if x > 0)   # hasta la siguiente pregunta o página
    bloque = texto[i:fin]
    filas, n = {}, []
    for linea in bloque.splitlines():
        m = re.match(r"\s*(.+?)\s{2,}((?:[\d.,]+|-)(?:\s+(?:[\d.,]+|-)){9})\s*$", linea)
        if m:
            filas[m.group(1).strip()] = [_num(x) for x in m.group(2).split()]
        elif linea.strip().startswith("(N)"):
            n = [int(x.replace(".", "")) for x in re.findall(r"\(([\d.]+)\)", linea)]
    return filas, n


def construir() -> dict:
    pdf = descargar(PDF)
    with tempfile.TemporaryDirectory() as d:
        ruta = Path(d) / "cis.pdf"
        ruta.write_bytes(pdf)
        texto = subprocess.run(["pdftotext", "-layout", str(ruta), "-"], capture_output=True, text=True, check=True).stdout
    votos, n = _tabla(texto, "6aR")
    todos, _ = _tabla(texto, "6aa")
    edades_n = n[3:10]                                   # votantes de cada edad en la muestra
    # De cada edad, el reparto entre partidos (sin blanco, nulo, «no recuerda» ni «N.C.»).
    crudo = []
    for j in range(3, 10):
        cuenta = {}
        for fila, pid in PARTIDOS.items():
            if fila in votos:
                cuenta[pid] = cuenta.get(pid, 0) + votos[fila][j]
        tot = sum(cuenta.values())
        crudo.append({p: v / tot * 100 for p, v in cuenta.items()})
    # El factor de cada partido: que el total (las edades, con su peso entre los votantes) dé el resultado real.
    peso = [x / sum(edades_n) for x in edades_n]
    total_crudo = {p: sum(w * c.get(p, 0) for w, c in zip(peso, crudo)) for p in crudo[0]}
    real = dict(RESULTADO, OTROS=100 - sum(RESULTADO.values()))
    factor = {p: real[p] / total_crudo[p] for p in total_crudo}
    ajustado = []
    for c in crudo:
        a = {p: c[p] * factor[p] for p in c}
        s = sum(a.values())
        ajustado.append({p: round(v / s * 100, 1) for p, v in a.items()})
    no_voto = [todos["No votó"][j] for j in range(3, 10)] if "No votó" in todos else None
    return {"fuente": "CIS, estudio 3420 (postelectoral de las generales de 2023), tabulación por variables sociodemográficas",
            "url": PDF, "edades": EDADES, "n": edades_n, "partidos": ["PP", "PSOE", "VOX", "SUMAR", "OTROS"],
            "ajustado": ajustado, "crudo": [{p: round(v, 1) for p, v in c.items()} for c in crudo],
            "factor": {p: round(v, 3) for p, v in factor.items()}, "no_voto": no_voto}


if __name__ == "__main__":
    d = construir()
    SALIDA.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")))
    for e, a, nv in zip(d["edades"], d["ajustado"], d["no_voto"] or [None] * 7):
        print(e, a, f"no votó {nv} %")
    print("factores", d["factor"])
