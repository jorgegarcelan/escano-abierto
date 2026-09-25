"""Diario de Sesiones: descarga de PDFs, extracción de texto y división en intervenciones.

El Diario marca cada turno de palabra al principio de párrafo:

    El señor NÚÑEZ FEIJÓO: Gracias, señora presidenta...
    El señor PRESIDENTE DEL GOBIERNO (Sánchez Pérez-Castejón): Señor Feijóo...
    La señora PRESIDENTA: Muchas gracias.

y cada asunto del orden del día con un encabezado en mayúsculas que empieza por «—» y
termina con «(Número de expediente 180/001158)».
"""
from __future__ import annotations

import json
import re
import subprocess
import unicodedata
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .config import CRUDOS, DATOS, LEGISLATURA, SESIONES, URL_DS
from .red import descargar

MAYUS = "A-ZÁÉÍÓÚÜÑÀÈÌÒÙÏÇ"
RE_TURNO = re.compile(
    rf"^(?P<art>El|La) señora? (?P<nombre>[{MAYUS}][{MAYUS}'’ .,\-\n]*?)"
    rf"(?:\s*\((?P<paren>[^)]*)\))?:[ \t]*",
    re.M,
)
RE_ITEM = re.compile(r"^—\s*(?P<txt>.+?\(Número de expediente[^)]*\)\.?)", re.M | re.S)
RE_EXP = re.compile(r"(\d{3}/\d{6})")
RE_SECCION = re.compile(rf"^(?P<t>[{MAYUS}][{MAYUS} ,.\-]{{6,90}})$", re.M)
RE_FECHA = re.compile(
    r"(lunes|martes|miércoles|jueves|viernes|sábado|domingo),?\s+(\d{1,2}) de ([a-z]+) de (\d{4})", re.I
)
RE_SESION = re.compile(r"Sesión (?:plenaria )?núm\.?\s*(\d+)", re.I)
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]
REACCIONES = {
    "aplausos": r"[(—–]\s*Aplausos",
    "rumores": r"[(—–]\s*Rumores",
    "protestas": r"[(—–]\s*Protestas",
    "risas": r"[(—–]\s*Risas",
    "llamadas_al_orden": r"llam[oa] al orden",
}
RUIDO = [
    r"^DIARIO DE SESIONES DEL CONGRESO DE LOS DIPUTADOS.*$",
    r"^(PLENO Y DIPUTACIÓN PERMANENTE|COMISIONES)$",
    r"^Núm\. \d+\s*$",
    r"^\d{1,2} de [a-z]+ de \d{4}\s*$",
    r"^Pág\. \d+\s*$",
    r"^cve: DSCD-.*$",
]
OFICIOS_MESA = {"PRESIDENTE", "PRESIDENTA", "VICEPRESIDENTE", "VICEPRESIDENTA",
                "SECRETARIO", "SECRETARIA", "LETRADO", "LETRADA"}


@dataclass
class Intervencion:
    orden: int
    orador: str          # apellidos tal como los imprime el Diario («Núñez Feijóo»)
    cargo: str | None    # «Presidente del Gobierno», «Ministra de Defensa»...
    grupo: str           # PSOE, PP, ..., GOB, MESA, COMP o ?
    item: str | None     # asunto del orden del día
    exp: str | None
    seccion: str | None
    texto: str
    reacciones: dict = field(default_factory=dict)


def _sin_tildes(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def _titulo(s: str) -> str:
    """'NÚÑEZ FEIJÓO' -> 'Núñez Feijóo' respetando partículas."""
    menores = {"de", "del", "la", "las", "los", "y", "i"}
    palabras = s.strip().lower().split()
    return " ".join(p if (p in menores and i) else p[:1].upper() + p[1:] for i, p in enumerate(palabras))


# ---------------------------------------------------------------- descarga

def url_diario(serie: str, numero: int) -> str:
    return URL_DS.format(leg=LEGISLATURA, serie=serie, num=numero)


def texto_pdf(ruta: Path) -> str:
    """Convierte el PDF a texto con pdftotext (poppler-utils)."""
    salida = subprocess.run(["pdftotext", "-enc", "UTF-8", str(ruta), "-"], capture_output=True, check=True)
    return salida.stdout.decode("utf-8", "replace")


def nuevos_diarios(serie: str, desde: int, max_huecos: int = 3) -> list[tuple[int, Path]]:
    """Descarga Diarios consecutivos desde `desde` hasta encontrar `max_huecos` números sin publicar."""
    encontrados, huecos, n = [], 0, desde
    while huecos < max_huecos:
        destino = CRUDOS / f"DSCD-{LEGISLATURA}-{serie}-{n}.pdf"
        if descargar(url_diario(serie, n), destino) is None:
            huecos += 1
        else:
            huecos = 0
            encontrados.append((n, destino))
        n += 1
    return encontrados


# ---------------------------------------------------------------- análisis del texto

def limpiar(texto: str) -> str:
    for patron in RUIDO:
        texto = re.sub(patron, "", texto, flags=re.M)
    texto = texto.replace("\f", "\n")
    texto = re.sub(r"(\w)-\n([a-záéíóúñ])", r"\1\2", texto)   # palabras partidas a final de línea
    texto = re.sub(r"[ \t]+", " ", texto)
    return re.sub(r"\n{3,}", "\n\n", texto)


def cabecera(texto: str) -> dict:
    """Fecha y número de sesión a partir de la primera página."""
    inicio = texto[:4000]
    fecha = None
    if m := RE_FECHA.search(inicio):
        mes = MESES.index(m.group(3).lower()) + 1
        fecha = f"{m.group(4)}-{mes:02d}-{int(m.group(2)):02d}"
    ses = RE_SESION.search(inicio)
    organo = "Pleno"
    if c := re.search(r"^(COMISIÓN [^\n]+)$", inicio, re.M):
        organo = _titulo(c.group(1))
    return {"fecha": fecha, "sesion": int(ses.group(1)) if ses else None, "organo": organo}


def cuerpo(texto: str) -> str:
    """Quita el sumario: el acta empieza en «Se abre la sesión»."""
    i = texto.find("Se abre la sesión")
    return texto[i:] if i >= 0 else texto


def clasificar(nombre: str, paren: str | None, mapa: dict[str, str], es_comision: bool) -> tuple[str, str | None, str]:
    """Devuelve (orador, cargo, grupo)."""
    nombre = " ".join(nombre.split())
    if paren:  # «PRESIDENTE DEL GOBIERNO (Sánchez Pérez-Castejón)» o «VICEPRESIDENTA (Navarro Garzón)»
        cargo, orador = _titulo(nombre), " ".join(paren.split())
        if nombre in OFICIOS_MESA:
            return orador, cargo, "MESA"
        if re.search(r"MINISTR|PRESIDENT[EA] DEL GOBIERNO|VICEPRESIDENT", nombre):
            return orador, cargo, "GOB"
        # Comparecientes: «TORREGROSA GRANADO (coordinadora de FEDER)»
        return _titulo(nombre), " ".join(paren.split()), mapa.get(_sin_tildes(nombre), "COMP" if es_comision else "?")
    if nombre in OFICIOS_MESA:
        return _titulo(nombre), _titulo(nombre), "MESA"
    grupo = mapa.get(_sin_tildes(nombre))
    if grupo is None:  # a veces el Diario usa un solo apellido
        candidatos = {g for k, g in mapa.items() if k.startswith(_sin_tildes(nombre))}
        grupo = candidatos.pop() if len(candidatos) == 1 else ("COMP" if es_comision else "?")
    return _titulo(nombre), None, grupo


def dividir(texto: str, mapa: dict[str, str] | None = None, es_comision: bool = False) -> list[Intervencion]:
    mapa = mapa or {}
    cuerpo_txt = cuerpo(limpiar(texto))

    # Asuntos y secciones con su posición en el texto.
    marcas: list[tuple[int, str, str]] = []
    tramos = []
    for m in RE_ITEM.finditer(cuerpo_txt):
        marcas.append((m.start(), "item", " ".join(m.group("txt").split())))
        tramos.append((m.start(), m.end()))
    for m in RE_SECCION.finditer(cuerpo_txt):
        dentro_de_item = any(a <= m.start() < b for a, b in tramos)
        if not dentro_de_item:
            marcas.append((m.start(), "seccion", m.group("t").strip()))
    marcas.sort()

    turnos = list(RE_TURNO.finditer(cuerpo_txt))
    salida: list[Intervencion] = []
    for n, m in enumerate(turnos):
        fin = turnos[n + 1].start() if n + 1 < len(turnos) else len(cuerpo_txt)
        # Si dentro del turno empieza un asunto nuevo, el texto del turno acaba ahí.
        corte = next((p for p, tipo, _ in marcas if m.end() < p < fin and tipo == "item"), fin)
        bruto = cuerpo_txt[m.end():corte]
        item = seccion = exp = None
        for p, tipo, t in marcas:
            if p > m.start():
                break
            if tipo == "item":
                item = t
                e = RE_EXP.search(t)
                exp = e.group(1) if e else None
            else:
                seccion = t
        texto_turno = " ".join(bruto.split())
        reacciones = {k: len(re.findall(p, texto_turno, re.I)) for k, p in REACCIONES.items()}
        orador, cargo, grupo = clasificar(m.group("nombre"), m.group("paren"), mapa, es_comision)
        salida.append(Intervencion(n, orador, cargo, grupo, item, exp, seccion, texto_turno,
                                   {k: v for k, v in reacciones.items() if v}))
    return salida


def procesar_diario(ruta: Path, serie: str, numero: int, mapa: dict[str, str]) -> dict:
    """Extrae y guarda las intervenciones de un Diario en data/sesiones/<id>.json."""
    texto = texto_pdf(ruta)
    cab = cabecera(texto)
    ivs = dividir(texto, mapa, es_comision=(serie == "CO"))
    ses = {
        "id": f"DSCD-{LEGISLATURA}-{serie}-{numero}",
        "serie": serie,
        "numero": numero,
        **cab,
        "ds": url_diario(serie, numero),
        "intervenciones": [asdict(i) for i in ivs],
    }
    SESIONES.mkdir(parents=True, exist_ok=True)
    (SESIONES / f"{ses['id']}.json").write_text(json.dumps(ses, ensure_ascii=False, indent=1))
    return ses


# ---------------------------------------------------------------- estado

ESTADO = DATOS / "estado.json"


def leer_estado() -> dict:
    if ESTADO.exists():
        return json.loads(ESTADO.read_text())
    # Punto de partida razonable; ajústalo si quieres empezar antes.
    return {"PL": 204, "CO": 619}


def guardar_estado(estado: dict) -> None:
    ESTADO.parent.mkdir(parents=True, exist_ok=True)
    ESTADO.write_text(json.dumps(estado, indent=1))
