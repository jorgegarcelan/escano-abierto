"""Resumen, tono, intensidad y temas de cada intervención con la API de Claude.

Cada respuesta se guarda en data/analisis/ con una clave que depende del texto, del modelo
y de la versión del prompt, así que volver a ejecutar el pipeline no repite llamadas.
"""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata

from .config import ANALISIS, MODELO

VERSION_PROMPT = "v1"
TONOS = ["combativo", "crítico", "irónico", "defensivo", "técnico", "conciliador", "propositivo"]
MAX_CARACTERES = 24_000  # una intervención larga (p. ej. un debate de investidura) se recorta

SISTEMA = """Eres un analista parlamentario neutral. Analizas intervenciones del Congreso de los Diputados \
de España a partir del Diario de Sesiones oficial. Describe lo que dice el orador sin valorar si tiene razón \
y aplica los mismos criterios a todos los grupos. Escribe en español."""

HERRAMIENTA = {
    "name": "registrar_analisis",
    "description": "Registra el análisis estructurado de una intervención parlamentaria.",
    "input_schema": {
        "type": "object",
        "properties": {
            "resumen": {"type": "string", "description": "2-3 frases fieles a lo dicho, en tercera persona."},
            "tono": {"type": "string", "enum": TONOS},
            "intensidad": {"type": "integer", "minimum": 1, "maximum": 5,
                           "description": "1 = exposición serena; 5 = confrontación directa o descalificaciones."},
            "temas": {"type": "array", "items": {"type": "string"}, "maxItems": 5,
                      "description": "Etiquetas cortas en minúscula (p. ej. 'vivienda', 'Ceuta')."},
            "cita": {"type": "string",
                     "description": "Una frase breve COPIADA LITERALMENTE del texto, la más representativa."},
            "posicion": {"type": "string", "enum": ["a favor", "en contra", "abstención", "no aplica"],
                         "description": "Postura sobre la iniciativa debatida, si la expresa."},
            "responde": {"type": "string", "enum": ["sí", "parcial", "no", "no aplica"],
                         "description": "Solo para respuestas del Gobierno: ¿contesta a lo que se le pregunta?"},
            "responde_motivo": {"type": "string", "description": "Una frase que justifique 'responde'."},
        },
        "required": ["resumen", "tono", "intensidad", "temas", "cita", "posicion", "responde"],
    },
}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).replace("«", '"').replace("»", '"').replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip().lower()


def cita_verificada(cita: str | None, texto: str) -> str | None:
    """Solo acepta la cita si aparece literalmente en el Diario."""
    if not cita:
        return None
    c = _norm(cita).strip(' ."')
    return cita.strip() if c and c in _norm(texto) else None


def _clave(*partes: str) -> str:
    return hashlib.sha1("\x1f".join((MODELO, VERSION_PROMPT, *partes)).encode()).hexdigest()


def _cliente():
    import anthropic  # import perezoso: el resto del pipeline funciona sin la librería

    return anthropic.Anthropic()


def analizar(iv: dict, pregunta_previa: str | None = None, cliente=None) -> dict | None:
    """Analiza una intervención (dict de diario.Intervencion). Devuelve None si no merece análisis."""
    if iv["grupo"] == "MESA" or len(iv["texto"]) < 250:
        return None
    clave = _clave(iv["texto"], pregunta_previa or "")
    cache = ANALISIS / f"{clave}.json"
    if cache.exists():
        return json.loads(cache.read_text())

    contexto = [
        f"Orador: {iv['orador']}" + (f" ({iv['cargo']})" if iv.get("cargo") else ""),
        f"Grupo: {iv['grupo']}",
        f"Asunto: {iv.get('item') or iv.get('seccion') or 'sin identificar'}",
    ]
    if pregunta_previa:
        contexto.append(f"Pregunta o intervención a la que responde:\n{pregunta_previa[:4000]}")
    mensaje = "\n".join(contexto) + f"\n\nTexto de la intervención:\n{iv['texto'][:MAX_CARACTERES]}"

    cliente = cliente or _cliente()
    r = cliente.messages.create(
        model=MODELO,
        max_tokens=800,
        system=SISTEMA,
        tools=[HERRAMIENTA],
        tool_choice={"type": "tool", "name": "registrar_analisis"},
        messages=[{"role": "user", "content": mensaje}],
    )
    datos = next(b.input for b in r.content if b.type == "tool_use")
    datos["cita"] = cita_verificada(datos.get("cita"), iv["texto"])
    if iv["grupo"] != "GOB":
        datos["responde"] = "no aplica"
    ANALISIS.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(datos, ensure_ascii=False))
    return datos


HERRAMIENTA_SESION = {
    "name": "registrar_sesion",
    "description": "Registra el resumen de una sesión y un título breve para cada asunto.",
    "input_schema": {
        "type": "object",
        "properties": {
            "resumen": {"type": "string", "description": "3-4 frases informativas, sin adjetivos valorativos."},
            "titulos": {"type": "array", "items": {"type": "string"},
                        "description": "Un título de menos de 12 palabras por asunto, en el mismo orden, "
                                       "con el formato 'Proponente · tema' o 'Pregunta de X a Y · tema'."},
        },
        "required": ["resumen", "titulos"],
    },
}


def resumir_sesion(organo: str, fecha: str, asuntos: list[str], lineas: list[str], cliente=None) -> dict:
    """Resumen de la sesión y títulos legibles para los asuntos (que el Diario escribe en mayúsculas)."""
    material = ("ASUNTOS:\n" + "\n".join(f"{i + 1}. {a}" for i, a in enumerate(asuntos))
                + "\n\nINTERVENCIONES Y VOTACIONES:\n" + "\n".join(lineas))[:40_000]
    clave = _clave("sesion", organo, fecha, material)
    cache = ANALISIS / f"{clave}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    cliente = cliente or _cliente()
    r = cliente.messages.create(
        model=MODELO,
        max_tokens=1500,
        system=SISTEMA,
        tools=[HERRAMIENTA_SESION],
        tool_choice={"type": "tool", "name": "registrar_sesion"},
        messages=[{"role": "user", "content": (
            f"Sesión de {organo} del {fecha}. Resume la jornada destacando el asunto que más debate generó "
            f"y los resultados de votación relevantes, y da un título breve a cada asunto.\n\n{material}")}],
    )
    datos = next(b.input for b in r.content if b.type == "tool_use")
    ANALISIS.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(datos, ensure_ascii=False))
    return datos
