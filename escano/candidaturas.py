"""Candidaturas al Congreso publicadas en el BOE y «¿Repite?»: qué diputados vuelven a ir en las listas.

Las Juntas Electorales Provinciales publican todas las listas en una sola disposición por fase, en la sección III
del BOE (departamento 1330): las presentadas el día 22 tras la convocatoria y las proclamadas el día 28 (art. 47 de
la LOREG), más las correcciones que lleguen después por los recursos. El XML es muy regular:

    <p class="centro_negrita">JUNTA ELECTORAL DE SORIA</p>
    <p class="centro_cursiva">CONGRESO DE LOS DIPUTADOS</p>
    <p class="centro_redonda">3. PARTIDO POPULAR (PP)</p>
    <p class="parrafo_2">1. Tomás Cabezón Casas.</p>
    <p class="parrafo_2">Suplentes:</p> …
    <p class="centro_cursiva">SENADO</p>                        (no se lee)

Los nombres del BOE («Nombre Apellido1 Apellido2») se casan con los del Congreso («Apellidos, Nombre») por niveles,
del más seguro al menos: idénticos, mismos apellidos con nombre de pila compatible (inicial, apodo, hipocorístico,
traducción), apellidos «fonéticos» (tx = ch, ny = ñ…) y, solo en la misma provincia, apellidos casi iguales.
Probado con 2023: los 410 diputados casan en su provincia y no hay falsos positivos en los niveles 1 a 3.

    python -m escano candidaturas [--desde 2026-10-27 --hasta 2026-11-15]
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from difflib import SequenceMatcher
from pathlib import Path

from .config import CRUDOS, DATOS

JUNTAS_PROVINCIALES = "1330"
CARPETA = CRUDOS / "elecciones" / "boe"
FICHERO = DATOS / "elecciones" / "candidaturas.json"
_TITULO = re.compile(r"^(?P<correccion>Corrección de errores de las )?candidaturas (?P<fase>presentadas|proclamadas) "
                     r"para las? elecciones al Congreso de los Diputados", re.I)   # el BOE de 2023: «para la elecciones»


# ---------- buscar en el BOE ----------

def del_dia(d: date) -> list[dict]:
    """Disposiciones de candidaturas al Congreso en el BOE de `d` (presentadas, proclamadas o correcciones)."""
    from .boe import URL_SUMARIO, _get, _lista
    r = _get(URL_SUMARIO.format(fecha=f"{d:%Y%m%d}"), headers={"Accept": "application/json"})
    if r is None:
        return []
    out = []

    def items(nodo):
        if isinstance(nodo, list):
            for x in nodo:
                yield from items(x)
        elif isinstance(nodo, dict):
            if "identificador" in nodo and "titulo" in nodo:
                yield nodo
                return
            for v in nodo.values():
                if isinstance(v, (dict, list)):
                    yield from items(v)

    for diario in _lista(r.json()["data"]["sumario"]["diario"]):
        for sec in _lista(diario.get("seccion")):
            for dep in _lista(sec.get("departamento")):
                if dep.get("codigo") != JUNTAS_PROVINCIALES:
                    continue
                for it in items(dep):
                    m = _TITULO.match(it["titulo"])
                    if m:
                        out.append({"fecha": d.isoformat(), "id": it["identificador"], "fase": m["fase"].lower(),
                                    "correccion": bool(m["correccion"])})
    return out


def descargar(id_boe: str) -> Path:
    from .boe import URL_XML, _get
    ruta = CARPETA / f"{id_boe}.xml"
    if not ruta.exists():
        r = _get(URL_XML.format(id=id_boe))
        if r is None:
            raise RuntimeError(f"El BOE no tiene {id_boe}")
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_bytes(r.content)
    return ruta


# ---------- leer las listas ----------

_CAND = re.compile(r"^(?:Candidatura\s+n[úu]m(?:ero|\.)?\s*:?\s*)?(?P<num>\d+)\s*\.\s*(?P<resto>.+?)\s*$", re.I)
_PERSONA = re.compile(r"^(?P<orden>\d+)\s*\.\s*(?P<nombre>\S.*?)\s*\.?\s*$")
_SUPLENTES = re.compile(r"^Suplentes?\s*:?\s*$", re.I)
_NO_PROCLAMADA = re.compile(r"^(No proclamada|La candidatura ha sido retirada)\.?$", re.I)
_JUNTA = re.compile(r"^JUNTA ELECTORAL (?:PROVINCIAL )?DE (?P<prov>.+)$", re.I)
_PARENTESIS = re.compile(r"\s*\(([^()]*)\)")
_DONDE_DICE = re.compile(r"^Donde dice\s*:?$", re.I)
_DEBE_DECIR = re.compile(r"^Debe decir\s*:?$", re.I)


def _texto(p) -> str:
    return " ".join("".join(p.itertext()).split())


def separar_siglas(resto: str) -> tuple[str, str]:
    """El último () o [] equilibrado del final: «… (PSOE) [PSE-EE (PSOE)]» -> («… (PSOE)», «PSE-EE (PSOE)»)."""
    resto = resto.strip().strip("«»").rstrip(" .").strip()
    if resto and resto[-1] in ")]":
        apertura, nivel = ("(" if resto[-1] == ")" else "["), 0
        for i in range(len(resto) - 1, -1, -1):
            c = resto[i]
            if c in ")]":
                nivel += 1
            elif c in "([":
                nivel -= 1
                if nivel == 0:
                    if c == apertura:
                        return resto[:i].strip(), resto[i + 1:-1].strip()
                    break
        if "[" in resto:   # corchete desparejado (BOE de 2019)
            i = resto.rindex("[")
            return resto[:i].strip(), resto[i + 1:-1].strip().lstrip("(").strip()
    return resto, ""


def _persona(crudo: str) -> dict:
    notas = [n.strip() for n in _PARENTESIS.findall(crudo)]
    nombre = re.sub(r"[«»“”\"]", "", _PARENTESIS.sub("", crudo)).strip(" .")
    indep = [n for n in notas if n.lower().startswith("independ")]
    resto = [n for n in notas if n not in indep]
    apodos = [n for n in resto if len(n.split()) == 1 and not n.isupper()]
    return {"nombre": " ".join(nombre.split()), "independiente": bool(indep),
            "apodo": apodos[0] if apodos else "", "afiliacion": "; ".join(n for n in resto if n not in apodos)}


def leer(ruta_xml: Path) -> list[dict]:
    """Una fila por persona (o por candidatura no proclamada) de las listas al Congreso.

    En las correcciones, cada «Donde dice: «…» Debe decir: «…»» da una fila de tipo «correccion» con el nombre
    anterior y el nuevo, que `escribir` aplica sobre la lista original.
    """
    raiz = ET.parse(ruta_xml).getroot()
    filas, provincia, camara, cand, tipo = [], None, None, None, "titular"
    modo, antes = None, None          # dentro de un «Donde dice / Debe decir»
    for p in raiz.find("texto").iter("p"):          # los encabezados se reconocen por el texto (2019 ≠ 2023)
        clase, t = p.get("class", ""), _texto(p)
        if not t:
            continue
        m = _JUNTA.match(t)
        if m:
            provincia, camara, cand = m["prov"].strip(), None, None
            continue
        if t.upper().startswith("CIRCUNSCRIPCIÓN ELECTORAL"):   # islas: solo el Senado
            continue
        if t.upper() in ("CONGRESO DE LOS DIPUTADOS", "SENADO"):
            camara, cand = ("congreso" if t.upper().startswith("CONGRESO") else "senado"), None
            continue
        if camara != "congreso" or provincia is None:
            continue
        if _DONDE_DICE.match(t):
            modo = "dice"
            continue
        if _DEBE_DECIR.match(t):
            modo = "debe"
            continue
        limpio = t.strip("«»").strip()
        m = _CAND.match(limpio) if clase.startswith("centro") else None
        if m:
            if modo == "dice":          # la versión equivocada de una candidatura entera: no se lee
                continue
            nombre, siglas = separar_siglas(m["resto"])
            cand = {"provincia": provincia, "num": int(m["num"]), "candidatura": nombre, "siglas": siglas}
            tipo, modo = "titular", None
            continue
        if cand is None and not modo:
            continue
        if modo == "dice":
            m = _PERSONA.match(limpio) if t.startswith("«") else None
            if m:
                antes = (int(m["orden"]), _persona(m["nombre"])["nombre"])
            continue
        if modo == "debe":
            m = _PERSONA.match(limpio)
            if m and antes and cand:
                filas.append({**cand, "orden": int(m["orden"]), "tipo": "correccion", "antes": antes[1],
                              **_persona(m["nombre"])})
            modo, antes = None, None
            continue
        if cand is None:
            continue
        if _SUPLENTES.match(limpio):
            tipo = "suplente"
        elif _NO_PROCLAMADA.match(limpio):
            filas.append({**cand, "orden": None, "nombre": None, "tipo": "no_proclamada",
                          "independiente": False, "apodo": "", "afiliacion": ""})
        else:
            m = _PERSONA.match(limpio)
            if m:
                filas.append({**cand, "orden": int(m["orden"]), "tipo": tipo, **_persona(m["nombre"])})
            elif not t.startswith("En la página"):
                print(f"  candidaturas: línea sin reconocer en {provincia} · {cand['siglas']}: {t!r}", file=sys.stderr)
    return filas


def _sin_tildes(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def circunscripcion(nombre_junta: str) -> str | None:
    """«SORIA», «ILLES BALEARS», «A CORUÑA», «SANTA CRUZ DE TENERIFE»… -> nombre de la circunscripción del Congreso."""
    from .geo import CIRCUNSCRIPCIONES
    clave = lambda s: re.sub(r"[^a-z]", "", _sin_tildes(s.lower()))
    norm = clave(nombre_junta)
    alias = {"illesbalears": "balearsilles", "balears": "balearsilles", "baleares": "balearsilles", "acoruna": "corunaa",
             "lacoruna": "corunaa", "laspalmas": "palmaslas", "larioja": "riojala",
             "santacruzdetenerife": "sctenerife", "alava": "arabaalava", "araba": "arabaalava", "alicante": "alicantealacant",
             "alacant": "alicantealacant", "castellon": "castelloncastello", "castello": "castelloncastello",
             "valencia": "valenciavalencia", "vizcaya": "bizkaia", "guipuzcoa": "gipuzkoa", "gerona": "girona",
             "lerida": "lleida", "orense": "ourense"}
    norm = alias.get(norm, norm)
    for c in CIRCUNSCRIPCIONES.values():
        k = clave(c)
        if norm == k or norm == clave(c.split("/")[0]) or (len(c.split("/")) > 1 and norm == clave(c.split("/")[1])):
            return c
    return None


# ---------- casar nombres ----------

_PARTICULAS = {"de", "del", "la", "las", "los", "el", "y", "i", "e", "d", "l", "da", "dos", "das", "do", "von"}
# Hipocorísticos y nombres en catalán, gallego o euskera -> forma castellana (sin tildes, en minúsculas).
_PILA = {
    "m": "maria", "ma": "maria", "mari": "maria", "txema": "jose maria", "chema": "jose maria", "josema": "jose maria",
    "pepe": "jose", "pep": "jose", "josep": "jose", "xose": "jose", "joseba": "jose", "maribel": "maria isabel",
    "mertxe": "mercedes", "merce": "mercedes", "montse": "montserrat", "nacho": "ignacio", "inaki": "ignacio",
    "ignasi": "ignacio", "santi": "santiago", "toni": "antonio", "antoni": "antonio", "anton": "antonio",
    "pere": "pedro", "joan": "juan", "jordi": "jorge", "miquel": "miguel", "mikel": "miguel", "francesc": "francisco",
    "paco": "francisco", "xisco": "francisco", "cisco": "francisco", "lluis": "luis", "carles": "carlos",
    "enric": "enrique", "vicent": "vicente", "xavier": "javier", "xabier": "javier", "quim": "joaquin",
    "joaquim": "joaquin", "jaume": "jaime", "josepa": "josefa", "pepa": "josefa", "lola": "dolores", "concha": "concepcion",
    "conchi": "concepcion", "pili": "pilar", "charo": "rosario", "inma": "inmaculada", "mamen": "maria carmen",
    "maite": "maria teresa", "marimar": "maria mar", "francina": "francisca", "francesca": "francisca",
    "jon": "juan", "koldo": "luis", "patxi": "francisco", "txomin": "domingo",
    "manel": "manuel", "agusti": "agustin", "marti": "martin", "andreu": "andres", "esteve": "esteban",
}


def tokens(s: str) -> list[str]:
    s = _sin_tildes(s.lower()).replace("ª", "a").replace("·", "")
    return [t for t in re.sub(r"[^a-z ]", " ", s).split() if t not in _PARTICULAS]


def fonetico(t: str) -> str:
    t = t.replace("tx", "ch").replace("ny", "n").replace("v", "b").replace("k", "c").replace("y", "i")
    return re.sub(r"(?<!c)h", "", t)


def _pila(ts: list[str]) -> set[str]:
    return {x for t in ts for x in _PILA.get(t, t).split()}


def partir_indice(nombre: str) -> tuple[list[str], list[str]]:
    """«Rey de las Heras, Luis Alfonso» -> (['luis', 'alfonso'], ['rey', 'heras'])."""
    apellidos, _, pila = nombre.partition(",")
    return tokens(pila), tokens(apellidos)


def _pila_compatible(boe: list[str], idx: list[str], apodo: str) -> bool:
    if not boe or not idx:
        return not boe and not idx
    a, b = set(boe), set(idx)
    if a <= b or b <= a:                        # «María Margarita» contiene a «Margarita»
        return True
    if apodo and set(tokens(apodo)) & b:        # BOE «Ignacio (Nacho)» y Congreso «Nacho»
        return True
    a, b = _pila(boe), _pila(idx)               # «Txema» = «José María», «Pere Lluís» = «Pedro Luis»
    return a <= b or b <= a


def nivel(cand: dict, pila_idx: list[str], ap_idx: list[str]) -> int:
    """1 idénticos · 2 apellidos iguales y nombre compatible · 3 apellidos fonéticos · 4 apellidos casi iguales · 0 no."""
    tb = cand.setdefault("_tk", tokens(cand["nombre"]))
    if tb == pila_idx + ap_idx:
        return 1
    n, apodo = len(ap_idx), cand.get("apodo", "")
    if not n or len(tb) <= n or not _pila_compatible(tb[:-n], pila_idx, apodo):
        return 0
    if tb[-n:] == ap_idx:
        return 2
    if [fonetico(t) for t in tb[-n:]] == [fonetico(t) for t in ap_idx]:
        return 3
    if SequenceMatcher(None, " ".join(tb[-n:]), " ".join(ap_idx)).ratio() >= 0.85:
        return 4
    return 0


def casar(nombre_indice: str, candidatos: list[dict], max_nivel: int = 3) -> tuple[int, list[dict]]:
    """Mejor nivel (hasta `max_nivel`) y los candidatos que lo alcanzan; más de uno es un homónimo."""
    pila, ap = partir_indice(nombre_indice)
    ap_fon = {fonetico(t) for t in ap}
    mejor, quienes = 0, []
    for c in candidatos:
        if not c.get("nombre"):
            continue
        tk = c.setdefault("_tk", tokens(c["nombre"]))
        if not ({fonetico(t) for t in tk} & ap_fon):   # filtro rápido: algún apellido en común
            continue
        k = nivel(c, pila, ap)
        if not k or k > max_nivel:
            continue
        if not mejor or k < mejor:
            mejor, quienes = k, [c]
        elif k == mejor:
            quienes.append(c)
    return mejor, quienes


# ---------- ¿Repite? ----------

def repite(filas: list[dict], diputados: list[list]) -> dict:
    """Cada diputado de la legislatura que termina, con su puesto en las listas nuevas (si va en alguna).

    `diputados`: las filas de indice.json ([nombre, grupo, circunscripción, partido, alta, x, y, código, baja]).
    Se busca primero en su provincia (con los cuatro niveles) y después en toda España (solo niveles 1 a 3); si hay
    homónimos, desempata la provincia.
    """
    personas = [f for f in filas if f.get("nombre")]
    por_prov: dict[str, list[dict]] = {}
    for f in personas:
        por_prov.setdefault(f.get("circ") or "", []).append(f)
    salida = {}
    for d in diputados:
        nombre, circ = d[0], d[2]
        k, quienes = casar(nombre, por_prov.get(circ, []), max_nivel=4)
        if not k:
            k, quienes = casar(nombre, personas, max_nivel=3)
        if not k:
            continue
        quienes.sort(key=lambda c: (c.get("circ") != circ, c["tipo"] != "titular", c["orden"]))
        c = quienes[0]
        salida[nombre] = {"circ": c.get("circ") or c["provincia"], "siglas": c["siglas"], "candidatura": c["candidatura"],
                          "orden": c["orden"], "tipo": c["tipo"], "nivel": k, "homonimos": len(quienes) > 1,
                          "otra_provincia": (c.get("circ") or "") != circ}
    return salida


def fase_de(ruta_xml: Path) -> str:
    """«presentadas» o «proclamadas», según el título de la disposición."""
    titulo = ET.parse(ruta_xml).getroot().findtext("metadatos/titulo") or ""
    m = re.search(r"candidaturas (presentadas|proclamadas)", titulo, re.I)
    return m.group(1).lower() if m else ""


def escribir(ids: list[str], diputados: list[list], fase: str | None = None) -> dict:
    """Lee las disposiciones `ids` (la principal primero, luego las correcciones) y guarda listas y cruce."""
    fase = fase or fase_de(descargar(ids[0]))
    filas: list[dict] = []
    for i, id_boe in enumerate(ids):
        nuevas = leer(descargar(id_boe))
        for c in (f for f in nuevas if f["tipo"] == "correccion"):   # «Donde dice / Debe decir»: un nombre
            for f in filas:
                if (f["provincia"], f["siglas"], f["orden"], f["nombre"]) == (c["provincia"], c["siglas"], c["orden"], c["antes"]):
                    f.update({k: c[k] for k in ("nombre", "independiente", "apodo", "afiliacion")})
        completas = [f for f in nuevas if f["tipo"] != "correccion"]
        if i and completas:   # una corrección con listas enteras sustituye las de esa provincia y candidatura
            fuera = {(f["provincia"], f["siglas"]) for f in completas}
            filas = [f for f in filas if (f["provincia"], f["siglas"]) not in fuera]
        filas += completas
    for f in filas:
        f["circ"] = circunscripcion(f["provincia"]) or f["provincia"]
    listas: dict[str, list] = {}
    for f in filas:
        prov = listas.setdefault(f["circ"], [])
        lista = next((x for x in prov if x["siglas"] == f["siglas"]), None)
        if lista is None:
            lista = {"num": f["num"], "nombre": f["candidatura"], "siglas": f["siglas"], "titulares": [], "suplentes": [],
                     "proclamada": True}
            prov.append(lista)
        if f["tipo"] == "no_proclamada":
            lista["proclamada"] = False
        else:
            lista["titulares" if f["tipo"] == "titular" else "suplentes"].append(
                [f["nombre"], 1 if f["independiente"] else 0])
    datos = {"fase": fase, "boe": ids, "listas": {c: sorted(v, key=lambda x: x["num"]) for c, v in sorted(listas.items())},
             "repite": repite(filas, diputados)}
    FICHERO.parent.mkdir(parents=True, exist_ok=True)
    FICHERO.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
    return datos


def buscar(desde: date, hasta: date) -> list[dict]:
    encontradas, d = [], desde
    while d <= hasta:
        encontradas += del_dia(d)
        d += timedelta(days=1)
    return encontradas


def actualizar(desde: date, hasta: date, diputados: list[list]) -> dict | None:
    """Busca en el BOE las últimas candidaturas publicadas (proclamadas si ya están; si no, presentadas)."""
    todas = buscar(desde, hasta)
    for fase in ("proclamadas", "presentadas"):
        principal = [x for x in todas if x["fase"] == fase and not x["correccion"]]
        if principal:
            correcciones = [x["id"] for x in todas if x["fase"] == fase and x["correccion"]]
            return escribir([principal[-1]["id"], *correcciones], diputados, fase)
    return None


def leer_guardado() -> dict | None:
    return json.loads(FICHERO.read_text()) if FICHERO.exists() else None
