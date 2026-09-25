"""Configuración común: rutas, URLs del Congreso y grupos parlamentarios."""
from __future__ import annotations

import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "data"
CRUDOS = DATOS / "raw"            # PDFs y ZIPs descargados (no se versionan)
VOTACIONES = DATOS / "votaciones"  # una fichero JSON por día
SESIONES = DATOS / "sesiones"      # intervenciones extraídas de cada Diario
ANALISIS = DATOS / "analisis"      # caché de respuestas del modelo
SITIO = RAIZ / "site"

LEGISLATURA = 15
LEGISLATURA_ROMANA = "XV"

BASE = "https://www.congreso.es"
URL_VOTACIONES_DIA = (
    BASE + "/es/opendata/votaciones?p_p_id=votaciones&p_p_lifecycle=0&p_p_state=normal"
    "&p_p_mode=view&targetLegislatura={leg}&targetDate={fecha}"
)
URL_DS = BASE + "/public_oficiales/L{leg}/CONG/DS/{serie}/DSCD-{leg}-{serie}-{num}.PDF"

MODELO = os.environ.get("ESCANO_MODELO", "claude-sonnet-4-5")
USER_AGENT = "escano-abierto/0.1"  # el cortafuegos del Congreso rechaza agentes con URL

# Código del grupo en los JSON oficiales -> clave corta usada en la web.
GRUPOS = {
    "GS": "PSOE",
    "GP": "PP",
    "GVOX": "VOX",
    "GSUMAR": "SUMAR",
    "GR": "ERC",
    "GJxCAT": "JUNTS",
    "GEH Bildu": "BILDU",
    "GV (EAJ-PNV)": "PNV",
    "GMx": "MIXTO",
}

INFO_GRUPOS = {
    "PSOE":  {"nombre": "Grupo Socialista", "color": "#D8342B"},
    "PP":    {"nombre": "Grupo Popular", "color": "#2C7BC4"},
    "VOX":   {"nombre": "Grupo VOX", "color": "#5BA83A"},
    "SUMAR": {"nombre": "Plurinacional SUMAR", "color": "#C92F72"},
    "ERC":   {"nombre": "Grupo Republicano", "color": "#E0A410"},
    "JUNTS": {"nombre": "Junts per Catalunya", "color": "#1FA8A0"},
    "BILDU": {"nombre": "EH Bildu", "color": "#86A832"},
    "PNV":   {"nombre": "Grupo Vasco (EAJ-PNV)", "color": "#2F7A4A"},
    "MIXTO": {"nombre": "Grupo Mixto", "color": "#8A8F98"},
    "GOB":   {"nombre": "Gobierno", "color": "#7152A8"},
    "MESA":  {"nombre": "Presidencia", "color": "#9A9499"},
    "COMP":  {"nombre": "Comparecientes", "color": "#A47A4E"},
    "?":     {"nombre": "Sin identificar", "color": "#B5B0B8"},
}


def grupo_corto(codigo: str) -> str:
    """Normaliza el código de grupo de los datos abiertos ('GV (EAJ-PNV)' -> 'PNV')."""
    codigo = (codigo or "").strip()
    if codigo in GRUPOS:
        return GRUPOS[codigo]
    primera = codigo.split(" ")[0]
    for k, v in GRUPOS.items():
        if primera == k.split(" ")[0]:
            return v
    return "?"
