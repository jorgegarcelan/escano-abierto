"""Resumen, tono, intensidad y temas de cada intervención con un modelo de lenguaje.

Funciona con Gemini (por defecto si hay GEMINI_API_KEY) o con Claude (ANTHROPIC_API_KEY); ver config.PROVEEDOR.
Cada respuesta se guarda en data/analisis/ con una clave que depende del texto, del modelo
y de la versión del prompt, así que volver a ejecutar el pipeline no repite llamadas.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import unicodedata
from contextlib import contextmanager

from .config import ANALISIS, MODELO, PROVEEDOR

VERSION_PROMPT = "v2"  # v2: en una frase, motivo de la postura, compromisos, propuestas, cifras, territorios, iniciativas
TONOS = ["combativo", "crítico", "irónico", "defensivo", "técnico", "conciliador", "propositivo"]
MAX_CARACTERES = 24_000  # una intervención larga (p. ej. un debate de investidura) se recorta

SISTEMA = """Eres un analista parlamentario neutral. Analizas intervenciones del Congreso de los Diputados \
de España a partir del Diario de Sesiones oficial. Describe lo que dice el orador sin valorar si tiene razón \
y aplica los mismos criterios a todos los grupos. No inventes nada que no esté en el texto: si un campo no \
aplica, déjalo vacío. Lo que se pida literal, cópialo exactamente del texto. Escribe en español."""

_LITERAL = "copiada LITERALMENTE del texto, sin cambiar ni una palabra"
HERRAMIENTA = {
    "name": "registrar_analisis",
    "description": "Registra el análisis estructurado de una intervención parlamentaria.",
    "input_schema": {
        "type": "object",
        "properties": {
            "resumen": {"type": "string", "description": "2-3 frases fieles a lo dicho, en tercera persona."},
            "en_una_frase": {"type": "string", "description": "Lo esencial en una sola frase de menos de 20 palabras, "
                             "en lenguaje llano y sin tecnicismos, para alguien que no sigue la política "
                             "(p. ej. 'Pide que el Ejército vigile la frontera de Ceuta')."},
            "tono": {"type": "string", "enum": TONOS},
            "intensidad": {"type": "integer", "minimum": 1, "maximum": 5,
                           "description": "1 = exposición serena; 5 = confrontación directa o descalificaciones."},
            "temas": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 5,
                      "description": "De 1 a 5 etiquetas del asunto concreto, de 1 a 3 palabras, en minúscula salvo "
                                     "nombres propios, en la forma más común y sin nombres de partidos "
                                     "(p. ej. 'vivienda', 'Ceuta', 'apagón', 'financiación autonómica')."},
            "cita": {"type": "string", "description": f"Una frase breve y representativa, {_LITERAL}."},
            "posicion": {"type": "string", "enum": ["a favor", "en contra", "abstención", "no aplica"],
                         "description": "Postura sobre la iniciativa que se vota (proposición, moción, decreto, "
                                        "dictamen…), si la expresa. En preguntas, interpelaciones y "
                                        "comparecencias: 'no aplica'."},
            "motivo_posicion": {"type": "string", "description": "Si expresa postura, la razón principal en una frase; "
                                                                 "si no, cadena vacía."},
            "responde": {"type": "string", "enum": ["sí", "parcial", "no", "no aplica"],
                         "description": "Solo para respuestas del Gobierno: ¿contesta a lo que se le pregunta?"},
            "responde_motivo": {"type": "string", "description": "Una frase que justifique 'responde'."},
            "compromisos": {"type": "array", "maxItems": 4, "description": "Solo si habla un miembro del Gobierno: "
                            "compromisos concretos y comprobables de hacer algo (aprobar, invertir, presentar, crear), no "
                            "vaguedades como 'haremos todo lo necesario'. Vacío si no hay.",
                            "items": {"type": "object", "properties": {
                                "cita": {"type": "string", "description": f"La frase del compromiso, {_LITERAL}."},
                                "que": {"type": "string", "description": "Qué se compromete a hacer, en pocas palabras."},
                                "plazo": {"type": "string", "description": "Plazo o fecha si lo da; si no, cadena vacía."}},
                                "required": ["cita", "que", "plazo"]}},
            "propuestas": {"type": "array", "items": {"type": "string"}, "maxItems": 3,
                           "description": "Medidas concretas que el orador pide o propone, en pocas palabras "
                                          "(p. ej. 'bajar el IVA de la luz al 5 %'). Vacío si no propone nada concreto."},
            "cifras": {"type": "array", "maxItems": 4, "description": "Datos numéricos usados como argumento "
                       "(cantidades, porcentajes, plazos con cifra), no números de pasada.",
                       "items": {"type": "object", "properties": {
                           "cita": {"type": "string", "description": f"El fragmento que contiene el dato, {_LITERAL}."},
                           "dato": {"type": "string", "description": "El dato en pocas palabras (p. ej. '7.000 millones para vivienda')."}},
                           "required": ["cita", "dato"]}},
            "territorios": {"type": "array", "items": {"type": "string"}, "maxItems": 6,
                            "description": "Solo lugares de España (comunidades, provincias, municipios) de los que se habla "
                                           "de verdad, no de pasada, con su nombre oficial común ('País Vasco', no "
                                           "'Euskal Herria'). Nunca otros países o territorios fuera de España."},
            "iniciativas": {"type": "array", "items": {"type": "string"}, "maxItems": 5,
                            "description": "Leyes, decretos o iniciativas mencionados por su nombre (p. ej. 'Ley de "
                                           "Vivienda', 'RDL 20/2026')."},
        },
        "required": ["resumen", "en_una_frase", "tono", "intensidad", "temas", "cita", "posicion", "responde"],
    },
}

# Lo que se comprueba contra el Diario en esta ejecución: [aceptados, propuestos].
VERIFICACION = {"cita": [0, 0], "compromisos": [0, 0], "cifras": [0, 0]}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).replace("«", '"').replace("»", '"').replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip().lower()


def cita_verificada(cita: str | None, texto: str) -> str | None:
    """Solo acepta la cita si aparece literalmente en el Diario."""
    if not cita:
        return None
    c = _norm(cita).strip(' ."')
    return cita.strip() if c and c in _norm(texto) else None


def _literales(items: list | None, texto: str, campo: str) -> list:
    """Solo los elementos cuya 'cita' aparece literalmente en el Diario."""
    ok = [x for x in (items or []) if isinstance(x, dict) and cita_verificada(x.get("cita"), texto)]
    VERIFICACION[campo][0] += len(ok)
    VERIFICACION[campo][1] += len(items or [])
    return ok


def _sin_votacion(iv: dict) -> bool:
    """Preguntas, interpelaciones y comparecencias: no se vota nada, así que no hay postura que registrar."""
    t = re.sub(r"\s+", "", f"{iv.get('seccion') or ''} {(iv.get('item') or '')[:300]}").upper()
    return "MOCI" not in t and any(k in t for k in ("PREGUNTA", "QUEFORMULA", "INTERPELACI", "COMPARECENCIA"))


def depurar(datos: dict, iv: dict) -> dict:
    """Comprueba contra el texto lo que debe ser literal y quita lo que no corresponde a quien habla."""
    texto = iv["texto"]
    VERIFICACION["cita"][1] += bool(datos.get("cita"))
    datos["cita"] = cita_verificada(datos.get("cita"), texto)
    VERIFICACION["cita"][0] += bool(datos["cita"])
    if _sin_votacion(iv):
        datos["posicion"], datos["motivo_posicion"] = "no aplica", ""
    if iv["grupo"] != "GOB":
        datos["responde"] = "no aplica"
        datos["compromisos"] = []
    datos["compromisos"] = _literales(datos.get("compromisos"), texto, "compromisos")
    datos["cifras"] = _literales(datos.get("cifras"), texto, "cifras")
    datos["temas"] = [" ".join(t.split()) for t in datos.get("temas", []) if t and t.strip()]
    for k in ("propuestas", "territorios", "iniciativas"):
        datos[k] = [" ".join(x.split()) for x in datos.get(k, []) if isinstance(x, str) and x.strip()]
    for k in ("en_una_frase", "motivo_posicion", "responde_motivo"):
        datos[k] = (datos.get(k) or "").strip()
    return datos


def _clave(*partes: str) -> str:
    return hashlib.sha1("\x1f".join((MODELO, VERSION_PROMPT, *partes)).encode()).hexdigest()


# Tokens gastados en esta ejecución (para estimar el coste).
USO = {"llamadas": 0, "entrada": 0, "salida": 0, "razonamiento": 0}

# Si es una lista, analizar() y resumir_sesion() no llaman a la API: apuntan aquí la petición que falta y
# devuelven None. Lo usa lotes.py para mandar todo lo pendiente a la Batch API de una vez.
RECOGER: list[dict] | None = None


@contextmanager
def solo_cache():
    """Dentro, analizar() y resumir_sesion() devuelven lo que haya en la caché y nunca llaman a la API."""
    global RECOGER
    antes, RECOGER = RECOGER, []
    try:
        yield
    finally:
        RECOGER = antes


class ClienteGemini:
    """Llamada mínima a la API REST de Gemini con salida JSON estructurada.

    La clave va en la cabecera x-goog-api-key (nunca en la URL), así que no aparece en errores ni registros.
    El razonamiento del modelo se cobra como salida: se deja en el nivel más bajo.
    """
    URL = "https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"

    def __init__(self, modelo: str = MODELO, razonamiento: str = "low"):
        import requests
        self.modelo, self.razonamiento = modelo, razonamiento
        self.sesion = requests.Session()
        self.sesion.headers.update({"x-goog-api-key": os.environ["GEMINI_API_KEY"], "Content-Type": "application/json"})

    @staticmethod
    def cuerpo(sistema: str, mensaje: str, esquema: dict, max_tokens: int, razonamiento: str = "low") -> dict:
        """El cuerpo de generateContent; la Batch API usa el mismo en cada línea del fichero."""
        return {
            "systemInstruction": {"parts": [{"text": sistema}]},
            "contents": [{"role": "user", "parts": [{"text": mensaje}]}],
            "generationConfig": {
                "responseMimeType": "application/json", "responseJsonSchema": esquema,
                "maxOutputTokens": max_tokens * 4,  # margen: el razonamiento también cuenta
                "thinkingConfig": {"thinkingLevel": razonamiento},
            },
        }

    @staticmethod
    def leer(respuesta: dict) -> dict:
        """El JSON que ha escrito el modelo. Lanza ValueError si la respuesta no trae uno válido."""
        uso = respuesta.get("usageMetadata", {})
        USO["llamadas"] += 1
        USO["entrada"] += uso.get("promptTokenCount", 0)
        USO["salida"] += uso.get("candidatesTokenCount", 0)
        USO["razonamiento"] += uso.get("thoughtsTokenCount", 0)
        try:
            candidato = respuesta["candidates"][0]
            texto = "".join(p.get("text", "") for p in candidato["content"]["parts"] if not p.get("thought"))
            datos = json.loads(texto)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as e:
            motivo = (respuesta.get("candidates") or [{}])[0].get("finishReason", "sin candidatos")
            raise ValueError(f"respuesta sin JSON válido ({motivo}): {e}") from e
        if not isinstance(datos, dict):
            raise ValueError("el JSON de la respuesta no es un objeto")
        return datos

    def generar(self, sistema: str, mensaje: str, esquema: dict, max_tokens: int) -> dict:
        import requests
        cuerpo = self.cuerpo(sistema, mensaje, esquema, max_tokens, self.razonamiento)
        for intento in range(6):
            try:
                r = self.sesion.post(self.URL.format(modelo=self.modelo), json=cuerpo, timeout=180)
            except requests.RequestException:  # conexión caída o lenta: se reintenta igual que un 503
                time.sleep(min(60, 2 ** intento * 2))
                continue
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(min(60, 2 ** intento * 2))
                continue
            if r.status_code != 200:
                raise RuntimeError(f"Gemini respondió {r.status_code}: {r.text[:400]}")
            return self.leer(r.json())
        raise RuntimeError("Gemini no respondió tras varios intentos")


def _cliente():
    if PROVEEDOR == "gemini":
        return ClienteGemini()
    import anthropic  # import perezoso: el resto del pipeline funciona sin la librería

    return anthropic.Anthropic()


def cuerpo_gemini(peticion: dict) -> dict:
    """Cuerpo de generateContent para una petición apuntada en RECOGER."""
    h = HERRAMIENTAS[peticion["tipo"]]
    return ClienteGemini.cuerpo(SISTEMA, f"{h['description']}\n\n{peticion['mensaje']}", h["input_schema"],
                                peticion["max_tokens"])


def _llamar(cliente, mensaje: str, herramienta: dict, max_tokens: int) -> dict:
    """Pide al modelo un JSON con la forma de `herramienta`. Acepta un cliente de Anthropic o ClienteGemini."""
    if hasattr(cliente, "messages"):  # Anthropic (y el cliente simulado de los tests)
        r = cliente.messages.create(
            model=MODELO, max_tokens=max_tokens, system=SISTEMA, tools=[herramienta],
            tool_choice={"type": "tool", "name": herramienta["name"]}, messages=[{"role": "user", "content": mensaje}])
        return next(b.input for b in r.content if b.type == "tool_use")
    return cliente.generar(SISTEMA, f"{herramienta['description']}\n\n{mensaje}", herramienta["input_schema"], max_tokens)


def guardar(peticion: dict, datos: dict) -> dict:
    """Depura la respuesta del modelo (si es de una intervención) y la guarda en la caché."""
    if peticion["tipo"] == "intervencion":
        datos = depurar(datos, peticion["iv"])
    ANALISIS.mkdir(parents=True, exist_ok=True)
    destino = ANALISIS / f"{peticion['clave']}.json"
    temporal = destino.with_suffix(".tmp")
    temporal.write_text(json.dumps(datos, ensure_ascii=False))
    temporal.replace(destino)  # atómico: un corte a medias no deja un JSON roto en la caché
    return datos


def _pedir(peticion: dict, cliente) -> dict | None:
    if RECOGER is not None:
        RECOGER.append(peticion)
        return None
    datos = _llamar(cliente or _cliente(), peticion["mensaje"], HERRAMIENTAS[peticion["tipo"]], peticion["max_tokens"])
    return guardar(peticion, datos)


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
    iv_min = {k: iv.get(k) for k in ("grupo", "seccion", "item", "texto")}
    return _pedir({"clave": clave, "tipo": "intervencion", "mensaje": mensaje, "max_tokens": 800, "iv": iv_min},
                  cliente)


HERRAMIENTA_SESION = {
    "name": "registrar_sesion",
    "description": "Registra el resumen de una sesión y un título breve para cada asunto.",
    "input_schema": {
        "type": "object",
        "properties": {
            "titular": {"type": "string", "description": "Titular informativo de menos de 14 palabras, con el hecho "
                                                        "principal de la jornada y sin adjetivos valorativos."},
            "resumen": {"type": "string", "description": "3-4 frases informativas, sin adjetivos valorativos."},
            "titulos": {"type": "array", "items": {"type": "string"},
                        "description": "Un título de menos de 12 palabras por asunto, en el mismo orden, "
                                       "con el formato 'Proponente · tema' o 'Pregunta de X a Y · tema'."},
            "momentos": {"type": "array", "maxItems": 3, "description": "Los 3 momentos clave de la jornada.",
                         "items": {"type": "object", "properties": {
                             "que": {"type": "string", "description": "Lo que pasó, en una frase informativa."},
                             "quien": {"type": "array", "items": {"type": "string"},
                                       "description": "Oradores protagonistas, con el nombre tal como aparece."}},
                             "required": ["que", "quien"]}},
        },
        "required": ["titular", "resumen", "titulos", "momentos"],
    },
}


def resumir_sesion(organo: str, fecha: str, asuntos: list[str], lineas: list[str], cliente=None) -> dict | None:
    """Resumen de la sesión y títulos legibles para los asuntos (que el Diario escribe en mayúsculas)."""
    material = ("ASUNTOS:\n" + "\n".join(f"{i + 1}. {a}" for i, a in enumerate(asuntos))
                + "\n\nINTERVENCIONES Y VOTACIONES:\n" + "\n".join(lineas))[:40_000]
    clave = _clave("sesion-v3", organo, fecha, material)  # v3: momentos clave
    cache = ANALISIS / f"{clave}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    return _pedir({"clave": clave, "tipo": "sesion", "max_tokens": 1500, "mensaje": (
        f"Sesión de {organo} del {fecha}. Resume la jornada destacando el asunto que más debate generó "
        f"y los resultados de votación relevantes, y da un título breve a cada asunto.\n\n{material}")}, cliente)


HERRAMIENTAS = {"intervencion": HERRAMIENTA, "sesion": HERRAMIENTA_SESION}
