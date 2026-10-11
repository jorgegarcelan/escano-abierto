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

# Legislatura que se sigue. Al constituirse unas Cortes nuevas se cambian estas tres constantes (ver docs/xvi-legislatura.md).
LEGISLATURA = 15
LEGISLATURA_ROMANA = "XV"
INICIO_LEGISLATURA = "2023-08-17"   # sesión constitutiva

BASE = "https://www.congreso.es"
URL_VOTACIONES_DIA = (
    BASE + "/es/opendata/votaciones?p_p_id=votaciones&p_p_lifecycle=0&p_p_state=normal"
    "&p_p_mode=view&targetLegislatura={leg}&targetDate={fecha}"
)
URL_DS = BASE + "/public_oficiales/L{leg}/CONG/DS/{serie}/DSCD-{leg}-{serie}-{num}.PDF"

def _cargar_env() -> None:
    """Carga .env (si existe) en el entorno sin pisar lo que ya esté definido. Nunca lo imprime."""
    fichero = RAIZ / ".env"
    if not fichero.exists():
        return
    for linea in fichero.read_text().splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            clave, valor = linea.split("=", 1)
            os.environ.setdefault(clave.strip(), valor.strip().strip('"').strip("'"))


_cargar_env()

# Proveedor de IA: Gemini, salvo que solo haya clave de Claude (ANTHROPIC_API_KEY). ESCANO_PROVEEDOR lo fuerza.
# El modelo forma parte de la clave de la caché (data/analisis): un build sin claves (Vercel, una copia del repo) tiene
# que usar el mismo que la generó, o no encuentra ningún análisis.
PROVEEDOR = os.environ.get("ESCANO_PROVEEDOR") or (
    "anthropic" if os.environ.get("ANTHROPIC_API_KEY") and not os.environ.get("GEMINI_API_KEY") else "gemini")
_MODELO_POR_DEFECTO = {"gemini": "gemini-3.8-flash", "anthropic": "claude-sonnet-4-5"}
MODELO = os.environ.get("ESCANO_MODELO") or _MODELO_POR_DEFECTO[PROVEEDOR]
if PROVEEDOR == "gemini" and not MODELO.startswith("gemini"):  # un ESCANO_MODELO de Claude heredado
    MODELO = _MODELO_POR_DEFECTO["gemini"]
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
