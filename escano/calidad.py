"""Indicadores de calidad del parser de los Diarios de Sesiones.

Sirven para notar cuándo el parser se rompe sin tener que leer los Diarios: oradores sin grupo, turnos de la
Presidencia anormalmente largos (señal de que se ha tragado a otro orador), asuntos sin expediente, etc.
"""
from __future__ import annotations

import json
from pathlib import Path

from .config import SESIONES

# Umbrales a partir de los cuales el informe avisa.
LIMITES = {
    "oradores_sin_grupo": 0.02,      # proporción de turnos con grupo «?»
    "mesa_larga": 0.01,              # turnos de la Presidencia de más de 2.500 caracteres
    "aplausos_en_mesa": 0.25,        # parte de los aplausos anotados en turnos de la Presidencia
    "palabras_pegadas": 0.001,       # palabras de más de 25 letras (pdftotext pegando palabras)
}


def indicadores(ses: dict) -> dict:
    ivs = [iv for iv in ses.get("intervenciones", [])]
    n = len(ivs) or 1
    mesa = [iv for iv in ivs if iv["grupo"] == "MESA"]
    aplausos = sum(iv.get("reacciones", {}).get("aplausos", 0) for iv in ivs)
    aplausos_mesa = sum(iv.get("reacciones", {}).get("aplausos", 0) for iv in mesa)
    palabras = [w for iv in ivs for w in iv["texto"].split()]
    return {
        "id": ses["id"], "organo": ses.get("organo"), "turnos": len(ivs),
        "oradores_sin_grupo": sum(iv["grupo"] == "?" for iv in ivs) / n,
        "mesa_larga": sum(len(iv["texto"]) > 2500 for iv in mesa) / n,
        "aplausos_en_mesa": aplausos_mesa / aplausos if aplausos else 0.0,
        "palabras_pegadas": sum(len(w.strip(".,;:¿?¡!«»()")) > 25 for w in palabras) / (len(palabras) or 1),
        "asuntos_sin_expediente": sum(1 for a in {iv["item"] for iv in ivs if iv["item"]} if "expediente" not in a.lower()),
        "sin_grupo": sorted({iv["orador"] for iv in ivs if iv["grupo"] == "?"}),
    }


def informe(carpeta: Path = SESIONES) -> list[dict]:
    return [indicadores(json.loads(f.read_text())) for f in sorted(carpeta.glob("*.json"))]


def avisos(fila: dict) -> list[str]:
    return [f"{k} {fila[k]:.1%}" for k, lim in LIMITES.items() if fila[k] > lim]


def imprimir(filas: list[dict]) -> int:
    """Imprime el informe y devuelve el número de sesiones con avisos."""
    malas = 0
    print(f"{'sesión':<17} {'turnos':>6} {'sin grupo':>9} {'mesa larga':>10} {'aplausos mesa':>13} {'pegadas':>8}")
    for f in filas:
        a = avisos(f)
        malas += bool(a)
        print(f"{f['id']:<17} {f['turnos']:>6} {f['oradores_sin_grupo']:>9.1%} {f['mesa_larga']:>10.1%} "
              f"{f['aplausos_en_mesa']:>13.1%} {f['palabras_pegadas']:>8.2%}" + (f"   ⚠ {', '.join(a)}" if a else ""))
        if f["sin_grupo"]:
            print(f"{'':<17} sin grupo: {', '.join(f['sin_grupo'][:6])}")
    return malas
