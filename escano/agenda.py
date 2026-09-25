"""Lo que viene: el orden del día de los próximos plenos y las sesiones de comisión de la semana.

La agenda semanal del Congreso (congreso.es/es/agenda) enlaza el orden del día de cada pleno en PDF
(/backoffice_doc/atp/orden_dia/pleno_<sesión>_<ddmmaaaa>.pdf): puntos numerados, agrupados por secciones
(«I. Toma en consideración de Proposiciones de Ley.») y por días, cada uno con su número de expediente.
"""
from __future__ import annotations

import html as htmlmod
import json
import re
import subprocess
import tempfile
from datetime import date, timedelta
from pathlib import Path

from .config import BASE, DATOS
from .leyes import AUTORES
from .red import descargar

URL_SEMANA = (BASE + "/es/agenda?p_p_id=agenda&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view"
              "&_agenda_mvcPath=agendaSemanal&_agenda_tipoagenda=1&_agenda_dia={d}&_agenda_mes={m}&_agenda_anio={a}")
RE_OD = re.compile(r"/backoffice_doc/atp/orden_dia/pleno_(\d+)_(\d{8})\.pdf")
FICHERO = DATOS / "agenda.json"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]
RE_DIA = re.compile(r"^(LUNES|MARTES|MIÉRCOLES|JUEVES|VIERNES|SÁBADO), (\d{1,2}) DE ([A-ZÁÉÍÓÚ]+)$")
RE_SECCION = re.compile(r"^([IVXL]+)\.\s+(.+?)\.?$")
RE_PUNTO = re.compile(r"^(\d+)\.\s+(.*)$")
RE_EXP = re.compile(r"\(Núm\. expte\. ([\d/,\s y]+)\)")
RE_PREGUNTA = re.compile(r"^PREGUNTA de(?:l| la) Diputad[oa] (?:D\.|Dª) (?P<autor>.+?), del Grupo\s+Parlamentario "
                         r"(?P<grupo>[^,]+), que formula a(?:l| la) (?:Excm[oa]\. )?(?:Sr\.|Sra\.)? ?(?P<dest>[^:]+):\s*"
                         r"(?P<preg>.+)$", re.S)


def _grupo(texto: str) -> str | None:
    m = re.search(r"Grupo\s+Parlamentario\s+([^,(]+)", texto)
    if not m:
        return "GOB" if re.match(r"(Proyecto de Ley|Real Decreto)", texto) else None
    return next((c for patron, c in AUTORES if re.search(patron, m.group(1), re.I)), None)


def _nombre(mayus: str) -> str:
    """«MARTA MADRENAS I MIR» -> «Marta Madrenas i Mir»."""
    return " ".join(p.lower() if p in ("DE", "DEL", "LA", "LAS", "LOS", "I", "Y") else
                    "-".join(x.capitalize() for x in p.split("-")) for p in mayus.split())


def resumir(texto: str) -> dict:
    """Título corto de un punto del orden del día, su grupo y, si es pregunta, quién pregunta a quién."""
    if m := RE_PREGUNTA.match(texto):
        dest = re.sub(r"^(?:Vicepresidente|Vicepresidenta) (?:Primer[oa]|Segund[oa]|Tercer[oa]) y ", "", m.group("dest"))
        return {"titulo": m.group("preg").strip(), "autor": _nombre(m.group("autor")), "a": dest.strip(),
                "grupo": _grupo("Grupo Parlamentario " + m.group("grupo"))}
    t = re.sub(r'\s*"BOCG\.[^"]*",.*$', "", texto).strip().rstrip(".")
    g = _grupo(t)
    t = re.sub(r"^De(?:l)? (?:la )?Grupo Parlamentario [^,]+?(?: \([^)]*\))?,\s*", "", t)
    return {"titulo": t[:1].upper() + t[1:], "grupo": g}


def leer_orden_del_dia(texto: str, anio: int) -> dict:
    """Texto de pdftotext -layout -> {sesion, dias, puntos: [{n, seccion, fecha, hora, texto, exp, titulo, grupo…}]}."""
    lineas = [l.rstrip() for l in texto.replace("\f", "\n").split("\n")]
    sesion = next((m.group(1) for l in lineas if (m := re.search(r"Sesión nº\s*(\d+)", l))), "")
    puntos, actual, seccion, fecha, hora = [], None, "", "", ""
    for l in lineas:
        s = l.strip()
        if not s or re.fullmatch(r"\d{1,3}", s):
            continue
        if m := RE_DIA.match(s):
            fecha = date(anio, MESES.index(m.group(3).lower()) + 1, int(m.group(2))).isoformat()
            actual = None
            continue
        if m := re.match(r"^A las (\d{1,2})(?:[.:](\d\d))? horas", s):
            hora = f"{int(m.group(1)):02d}:{m.group(2) or '00'}"
            continue
        if (m := RE_SECCION.match(s)) and not l.startswith(" "):
            seccion, actual = m.group(2).strip(), None
            continue
        if (m := RE_PUNTO.match(s)) and not l.startswith(" "):
            actual = {"n": int(m.group(1)), "seccion": seccion, "fecha": fecha, "hora": hora, "texto": m.group(2)}
            puntos.append(actual)
            continue
        if actual is not None:
            actual["texto"] += " " + s
    for p in puntos:
        p["texto"] = " ".join(p["texto"].split())
        m = RE_EXP.search(p["texto"])
        p["exp"] = [x.strip() for x in re.split(r",|\sy\s", m.group(1)) if x.strip()] if m else []
        p["texto"] = RE_EXP.sub("", p["texto"]).strip()
        p.update(resumir(p["texto"]))
    return {"sesion": sesion, "dias": sorted({p["fecha"] for p in puntos if p["fecha"]}), "puntos": puntos}


def comisiones_de_la_semana(pagina: str) -> list[dict]:
    """Filas de la agenda con enlace a una sesión de comisión: fecha, hora, órgano y asunto."""
    out = []
    for fila in re.findall(r"<tr>(.*?)</tr>", pagina, re.S):
        m = re.search(r"sesiones-de-comisiones\?[^\"]*fecha=(\d\d)/(\d\d)/(\d{4})\">(.*?)</a>(.*?)</div>", fila, re.S)
        if not m:
            continue
        limpio = lambda x: " ".join(htmlmod.unescape(re.sub(r"<[^>]+>", " ", x)).split())
        hora = limpio((re.findall(r"<td>(.*?)</td>", fila, re.S) or [""])[0])
        asunto = re.sub(r"\s*(Nota de prensa|Ver directo|YouTube[^.]*|Torrespaña \d)\.?", "", limpio(m.group(5))).strip(" .")
        out.append({"fecha": f"{m.group(3)}-{m.group(2)}-{m.group(1)}", "hora": hora,
                    "organo": limpio(m.group(4)).rstrip("."), "asunto": asunto})
    return out


def _pdf_a_texto(datos: bytes) -> str:
    with tempfile.TemporaryDirectory() as d:
        ruta = Path(d) / "od.pdf"
        ruta.write_bytes(datos)
        return subprocess.run(["pdftotext", "-layout", str(ruta), "-"], capture_output=True, text=True, check=True).stdout


def actualizar(hoy: date | None = None) -> dict:
    """Plenos y comisiones de esta semana y la siguiente. Guarda data/agenda.json."""
    hoy = hoy or date.today()
    lunes = hoy - timedelta(days=hoy.weekday())
    plenos, comisiones, vistos = [], [], set()
    for semana in (lunes, lunes + timedelta(days=7)):
        pagina = descargar(URL_SEMANA.format(d=semana.day, m=semana.month, a=semana.year), cache=False)
        if not pagina:
            continue
        pagina = pagina.decode("utf-8", "replace")
        comisiones += [c for c in comisiones_de_la_semana(pagina) if c not in comisiones]
        for m in RE_OD.finditer(pagina):
            if m.group(0) in vistos:
                continue
            vistos.add(m.group(0))
            pdf = descargar(BASE + m.group(0), cache=False)
            if pdf:
                od = leer_orden_del_dia(_pdf_a_texto(pdf), int(m.group(2)[4:]))
                plenos.append({**od, "pdf": BASE + m.group(0)})
    datos = {"generado": hoy.isoformat(), "plenos": plenos, "comisiones": sorted(comisiones, key=lambda c: c["fecha"])}
    FICHERO.write_text(json.dumps(datos, ensure_ascii=False, indent=1))
    return datos


def leer() -> dict:
    return json.loads(FICHERO.read_text()) if FICHERO.exists() else {"plenos": [], "comisiones": []}
