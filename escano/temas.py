"""Temas fijos para seguir lo que pasa en el Congreso: vivienda, sanidad, pensiones…

Es una clasificación por palabras clave, sin IA, que se aplica igual a votaciones, leyes, puntos del orden
del día y preguntas escritas. Es deliberadamente conservadora: un asunto puede tener varios temas o
ninguno, y lo que no encaja en ninguno no se fuerza.
"""
from __future__ import annotations

import re
import unicodedata

# slug, nombre, expresión (sobre el texto en minúsculas y sin tildes)
TEMAS = [
    ("vivienda", "Vivienda", r"vivienda|alquiler|desahuci|hipotec|okupa|ocupacion ilegal|inquilin|arrendamiento"),
    ("sanidad", "Sanidad", r"sanidad|sanitari|salud|hospital|medic[oa]s?\b|farmac|enfermer|pacientes?|atencion primaria|vacun|cancer|salud mental"),
    ("educacion", "Educación", r"educaci|educativ|escuel|colegio|universi|profesor|docente|alumn|estudiante|becas?\b|formacion profesional"),
    ("pensiones", "Pensiones y Seguridad Social", r"pension|jubilaci|seguridad social|pacto de toledo|ingreso minimo vital"),
    ("empleo", "Empleo y trabajo", r"empleo|trabajador|laboral|salario|smi\b|despido|sindica|autonomos?\b|jornada|convenio colectivo|paro\b|desemple"),
    ("impuestos", "Economía e impuestos", r"impuest|fiscal|tribut|\biva\b|\birpf\b|hacienda|presupuest|deuda publica|financiacion autonomica|inflacion|economi|industri|competitividad|empresas?\b|banca\b|bancari"),
    ("energia", "Energía", r"energ|electric|apagon|suministro electrico|nuclear|renovable|gas natural|combustible|carburante|luz\b"),
    ("clima", "Clima y medio ambiente", r"clima|medio ambiente|medioambient|emisiones|contaminaci|residuos|biodiversidad|incendio|sequia|agua\b|hidrologic|dana\b|costas\b"),
    ("campo", "Campo, pesca y alimentación", r"agricult|agrari|ganad|pesca|pesquer|alimentaci|rural|regadio|forestal|el campo|\bpac\b|pacto verde"),
    ("igualdad", "Igualdad y violencia de género", r"igualdad|violencia de genero|violencia machista|mujeres|feminis|lgtb|trans\b|paridad|violencia vicaria"),
    ("inmigracion", "Inmigración", r"inmigra|migra|extranjer|asilo|refugiad|regularizaci|frontera|menores no acompanados"),
    ("seguridad", "Seguridad e Interior", r"guardia civil|policia|seguridad ciudadana|interior|terroris|narcotrafic|crimen organizado|prisiones|penitenciar"),
    ("justicia", "Justicia", r"justicia|judicial|jueces|tribunal|fiscal general|codigo penal|amnistia|poder judicial|\bcgpj\b|procesal"),
    ("defensa", "Defensa", r"defensa|fuerzas armadas|militar|ejercito|\botan\b|armada\b"),
    ("exteriores", "Política exterior y UE", r"exterior|internacional|union europea|\bue\b|palestin|israel|gaza|ucrania|rusia|marruecos|venezuela|sahara|convenio entre|acuerdo entre el reino"),
    ("territorial", "Comunidades y territorio", r"cataluna|catalan|pais vasco|euskadi|galicia|canarias|baleares|ceuta|melilla|estatuto de autonomia|comunidad autonoma|financiacion autonomica|despoblaci|reto demografico"),
    ("transporte", "Transporte e infraestructuras", r"transporte|ferrocarril|tren\b|renfe|adif|carretera|autovia|aeropuerto|puerto|movilidad|trafico|cercanias"),
    ("cultura", "Cultura, deporte y medios", r"cultura|cultural|patrimonio|deport|cine\b|audiovisual|rtve|medios de comunicacion|lengua"),
    ("social", "Derechos sociales y consumo", r"dependencia|discapacidad|pobreza|infancia|familia|consum|clientela|servicios sociales|juventud|mayores\b"),
    ("tecnologia", "Tecnología y ciencia", r"digital|tecnolog|inteligencia artificial|ciencia|investigaci|telecomunic|ciberseguridad|datos personales"),
    ("democracia", "Democracia e instituciones", r"corrupci|transparencia|constituci|reglamento del congreso|electoral|secretos oficiales|memoria democratica|monarquia|corona\b|partidos politicos"),
]
_RE = [(s, n, re.compile(p)) for s, n, p in TEMAS]
NOMBRE = {s: n for s, n, _ in TEMAS}


def plano(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", (t or "").lower()) if unicodedata.category(c) != "Mn")


def temas_de(*textos: str) -> list[str]:
    t = plano(" ".join(x for x in textos if x))
    return [s for s, _, r in _RE if r.search(t)]
