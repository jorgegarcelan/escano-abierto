"""Promesas de los programas del 23J frente a lo que votó cada candidatura en la XV legislatura.

No se mide si una promesa «se cumplió» (la oposición casi nunca puede cumplir): se mide qué votó cada candidatura
sobre lo que prometió. Las reglas son las mismas para todos y el resultado lo decide una regla escrita en código:

1. **Texto.** Cada programa (PDF oficial, `data/raw/programas/2023/`) se pasa a texto por páginas, se quitan
   cabeceras y pies repetidos y se corta sin IA en unidades (párrafos, puntos numerados, viñetas).
2. **Promesas.** Gemini marca qué unidades son promesas: un compromiso de futuro con un objeto identificable
   (una norma, una cifra, un plazo o un cambio comprobable). Quedan fuera los diagnósticos, los valores y los
   verbos sin instrumento («fomentar», «apostar por», «mejorar»). Solo se acepta si la cita es literal.
3. **Candidatos.** Un buscador léxico (BM25, sin IA) propone las doce iniciativas votadas en el Pleno más
   parecidas a cada promesa, a partir de su objeto y su resumen en castellano.
4. **Juicio a ciegas.** Gemini ve la promesa y cada iniciativa sin nombres de partidos ni grupos y sin saber cómo
   votó nadie, y responde solo la relación: cumple, avanza, contradice, relacionada o no relacionada.
5. **Resultado.** Con el voto de los diputados elegidos en esa candidatura (no el grupo de hoy: quien cambió de
   grupo sigue contando para la lista por la que salió), `resultado()` aplica la tabla de RESULTADOS.

    python -m escano promesas [--solo PP] [--limite 50]
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import subprocess
import unicodedata
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .config import CRUDOS, DATOS, SITIO
from .temas import TEMAS

VERSION = "promesas-v1"
CARPETA_PDF = CRUDOS / "programas" / "2023"
CARPETA = DATOS / "promesas"
CACHE = CARPETA / "cache"

# Programa -> candidaturas del 23J (formación electoral de cada diputado en los datos abiertos del Congreso).
PROGRAMAS = {
    "PP": {"pdf": "pp.pdf", "nombre": "Partido Popular", "formaciones": ["PP"], "url": "https://www.pp.es/storage/2023/07/programa_electoral_pp_23j_feijoo_2023.pdf"},
    "PSOE": {"pdf": "psoe.pdf", "nombre": "PSOE", "formaciones": ["PSOE", "PSC-PSOE", "PsdeG-PSOE", "PSE-EE (PSOE)", "PSIB-PSOE", "PSN-PSOE"], "url": "https://www.psoe.es/media-content/2023/07/PROGRAMA_ELECTORAL-GENERALES-2023.pdf"},
    "VOX": {"pdf": "vox.pdf", "nombre": "Vox", "formaciones": ["VOX"], "url": "https://www.voxespana.es/wp-content/uploads/2023/07/Programa-VOX-2023-con-menos-peso.pdf"},
    "SUMAR": {"pdf": "sumar.pdf", "nombre": "Sumar", "formaciones": ["SUMAR"], "url": "https://movimientosumar.es/wp-content/uploads/2023/07/Un-Programa-para-ti.pdf"},
    "ERC": {"pdf": "erc.pdf", "nombre": "ERC", "formaciones": ["ERC"], "url": "https://defensacatalunya.esquerrarepublicana.cat/documents/e2023-programa.pdf"},
    "JUNTS": {"pdf": "junts.pdf", "nombre": "Junts", "formaciones": ["JxCAT-JUNTS"], "url": "https://web.archive.org/web/20230805224113id_/https://janhihaprou.cat/app/uploads/2023/07/Programa-Electoral-Junts-per-Catalunya-23J.pdf"},
    "BILDU": {"pdf": "ehbildu.pdf", "nombre": "EH Bildu", "formaciones": ["EH Bildu"], "url": "https://ehbildu.eus/dokumentuak/23J-COMPROMISO-DE-EUSKAL-HERRIA-BILDU.pdf"},
    "PNV": {"pdf": "pnv.pdf", "nombre": "EAJ-PNV", "formaciones": ["EAJ-PNV"], "url": "https://www.eaj-pnv.eus/es/adjuntos-documentos/20945/pdf/con-voz-propia-programa-electoral-23-j"},
    "BNG": {"pdf": "bng.pdf", "nombre": "BNG", "formaciones": ["BNG"], "url": "https://www.bng.gal/media/bnggaliza/files/2023/07/05/23_bng_xerais_programa.pdf"},
    "UPN": {"pdf": "upn.pdf", "nombre": "UPN", "formaciones": ["UPN"], "url": "https://www.upn.org/wp-content/uploads/2023/07/Programa-Generales-23J_V2-1.pdf"},
}
# Coalición Canaria no publicó programa para las generales de 2023: no se puede cruzar.

RESULTADOS = {
    "a_favor_cumple": "Votó a favor de algo que la cumple",
    "a_favor_avanza": "Votó a favor de algo que avanza hacia ella",
    "en_contra_avanza": "Votó en contra de algo que avanza hacia ella",
    "en_contra_cumple": "Votó en contra de algo que la cumple",
    "en_contra_contradice": "Votó en contra de algo que la contradice",
    "a_favor_contradice": "Votó a favor de algo que la contradice",
    "abstencion": "Se abstuvo",
    "distinto_sentido": "Votos en distinto sentido",
    "no_votada": "No llegó a votarse en el Pleno",
    "sin_competencia": "No depende del Congreso",
    "no_verificable": "No se puede comprobar",
}

SISTEMA = """Analizas programas electorales españoles para una web neutral de transparencia sobre el Congreso de los
Diputados. Aplicas las mismas reglas a todos los partidos, sin valorar ni opinar. Respondes solo con el JSON pedido.
Las citas que devuelves deben ser copia literal del texto que se te da."""

PROMPT_PROMESAS = """Estas son unidades de texto consecutivas del programa electoral de una candidatura a las elecciones
generales de 2023 (cada una con su id). Devuelve SOLO las que sean promesas verificables.

Una unidad es promesa si cumple las tres condiciones:
1. Es un compromiso de futuro del partido o de su futuro gobierno («aprobaremos», «crearemos», «derogaremos», «el
   salario mínimo será…», o la medida en infinitivo dentro de una lista de propuestas).
2. Tiene un objeto identificable: una norma (ley, artículo, impuesto, prestación, organismo), una cifra o un plazo,
   o un cambio de situación comprobable.
3. Se puede comprobar con hechos públicos si ha ocurrido o no.

No son promesas: diagnósticos, críticas, declaraciones de valores, y verbos sin instrumento concreto («fomentar»,
«apostar por», «promover», «impulsar», «mejorar», «reforzar», «estudiar», «avanzar hacia»), salvo que nombren el
instrumento («impulsaremos una ley de X» sí es promesa). Si una unidad contiene varias promesas, elige la principal.

Para cada promesa:
- cita: el fragmento literal de la unidad que contiene la promesa (copiado tal cual, 8 a 60 palabras).
- resumen: la promesa en castellano neutro, en 25 palabras como máximo, sin adjetivos valorativos.
- objeto: qué norma, cifra o cosa cambia, en castellano, 3 a 10 palabras.
- tipo: legislativa (necesita una ley o reforma), presupuestaria, ejecutiva (la decide el Gobierno), resultado
  (un objetivo medible), posicion (postura ante un asunto) o ue_internacional.
- direccion: crear_ampliar, reducir_suprimir, derogar o mantener.
- competencia: directa (necesita ley, reforma constitucional, presupuestos, convalidación de decreto-ley o un acto
  del Congreso), indirecta (la decide el Gobierno, pero el Congreso puede pedírsela) o ninguna (comunidades
  autónomas, ayuntamientos, UE o vida interna del partido).
- verificabilidad: alta, media o baja.
- tema: uno de {temas} u «otro».

Unidades:
{unidades}"""

PROMPT_JUICIO = """Una promesa electoral y una lista de iniciativas votadas en el Pleno del Congreso entre 2023 y 2026.
Los nombres de partidos y grupos se han sustituido por [GRUPO]. Para cada iniciativa, di qué relación tiene con la
promesa, atendiendo solo a su contenido:
- cumple: aprobarla haría lo que la promesa dice (total o en lo esencial).
- avanza: va en la misma dirección, pero solo en parte.
- contradice: aprobarla iría en la dirección contraria a la promesa.
- relacionada: trata del mismo asunto, pero ni la cumple ni la contradice.
- no_relacionada: trata de otra cosa.
Sé estricto: cumple o contradice solo cuando la relación sea clara a partir del texto. Explica cada relación que no
sea no_relacionada en 20 palabras como máximo.

Promesa: {promesa}
Objeto: {objeto}

Iniciativas:
{actos}"""

ESQ_PROMESAS = {"type": "object", "properties": {"promesas": {"type": "array", "items": {"type": "object", "properties": {
    "id": {"type": "string"}, "cita": {"type": "string"}, "resumen": {"type": "string"}, "objeto": {"type": "string"},
    "tipo": {"type": "string", "enum": ["legislativa", "presupuestaria", "ejecutiva", "resultado", "posicion", "ue_internacional"]},
    "direccion": {"type": "string", "enum": ["crear_ampliar", "reducir_suprimir", "derogar", "mantener"]},
    "competencia": {"type": "string", "enum": ["directa", "indirecta", "ninguna"]},
    "verificabilidad": {"type": "string", "enum": ["alta", "media", "baja"]},
    "tema": {"type": "string"}},
    "required": ["id", "cita", "resumen", "objeto", "tipo", "direccion", "competencia", "verificabilidad", "tema"]}}},
    "required": ["promesas"]}
ESQ_JUICIO = {"type": "object", "properties": {"relaciones": {"type": "array", "items": {"type": "object", "properties": {
    "id": {"type": "string"}, "relacion": {"type": "string", "enum": ["cumple", "avanza", "contradice", "relacionada", "no_relacionada"]},
    "motivo": {"type": "string"}}, "required": ["id", "relacion"]}}}, "required": ["relaciones"]}


# ---------- 1. texto y unidades ----------

_VINETA = re.compile(r"^\s*(?:\d{1,3}\s*[\.\)]|[•▪●◦·‣⁃➢➤►✓\-–—]|[-]|[a-z]\))\s+")


def paginas(pdf: Path) -> list[str]:
    salida = subprocess.run(["pdftotext", "-enc", "UTF-8", str(pdf), "-"], capture_output=True, check=True).stdout
    return salida.decode("utf-8", "replace").split("\f")


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).replace("«", '"').replace("»", '"').replace("“", '"').replace("”", '"').replace("’", "'")
    s = re.sub(r"(\w)-\s+(\w)", r"\1\2", s)          # palabras partidas al final de línea
    return re.sub(r"\s+", " ", s).strip().lower()


def unidades(paginas_texto: list[str], sigla: str) -> list[dict]:
    """Corta el programa en unidades sin IA: párrafos, puntos numerados y viñetas, con su página."""
    lineas_pag = [[l.rstrip() for l in p.splitlines()] for p in paginas_texto]
    # Cabeceras, pies y laterales: líneas cortas que se repiten en más del 30 % de las páginas.
    cuenta = Counter(_norm(l) for ls in lineas_pag for l in set(ls) if l.strip() and len(l) < 120)
    repetidas = {l for l, n in cuenta.items() if n > max(3, 0.3 * len(lineas_pag))} | {""}
    out = []
    for npag, ls in enumerate(lineas_pag, 1):
        bloques, actual = [], []
        for l in ls:
            if _norm(l) in repetidas or re.fullmatch(r"\s*\d{1,3}\s*", l):   # vacía, repetida o número de página
                if actual:
                    bloques.append(actual)
                    actual = []
                continue
            if _VINETA.match(l) and actual:
                bloques.append(actual)
                actual = []
            actual.append(l.strip())
        if actual:
            bloques.append(actual)
        for b in bloques:
            texto = ""
            for l in b:   # une las líneas reparando las palabras partidas con guion
                texto = texto[:-1] + l if texto.endswith("-") and l[:1].islower() else (texto + " " + l if texto else l)
            texto = _VINETA.sub("", texto).strip()
            if re.search(r"\.{5,}\s*\d+\s*$", texto):   # línea del índice
                continue
            for trozo in _partir(texto):
                if len(trozo.split()) >= 8:
                    out.append({"id": f"{sigla}-{npag:03d}-{len(out) + 1:04d}", "pagina": npag, "texto": trozo})
    return out


def _partir(texto: str, maximo: int = 1100) -> list[str]:
    if len(texto) <= maximo:
        return [texto]
    frases, trozos, actual = re.split(r"(?<=[\.;:])\s+(?=[A-ZÁÉÍÓÚÑÇ«\"])", texto), [], ""
    for f in frases:
        if actual and len(actual) + len(f) > maximo:
            trozos.append(actual)
            actual = f
        else:
            actual = f"{actual} {f}".strip()
    return trozos + ([actual] if actual else [])


def cita_literal(cita: str, texto: str) -> bool:
    c = _norm(cita).strip(' ."')
    return len(c.split()) >= 5 and c in _norm(texto)


# ---------- 2. promesas (Gemini) ----------

def _cache(clave: str, pedir) -> dict:
    ruta = CACHE / f"{hashlib.sha1((VERSION + clave).encode()).hexdigest()}.json"
    if ruta.exists():
        return json.loads(ruta.read_text())
    datos = pedir()
    CACHE.mkdir(parents=True, exist_ok=True)
    tmp = ruta.with_suffix(".tmp")
    tmp.write_text(json.dumps(datos, ensure_ascii=False))
    tmp.replace(ruta)
    return datos


def _gemini(mensaje: str, esquema: dict, max_tokens: int) -> dict:
    from .analisis import ClienteGemini
    return ClienteGemini().generar(SISTEMA, mensaje, esquema, max_tokens)


def tandas(us: list[dict], caracteres: int = 7000) -> list[list[dict]]:
    out, actual, n = [], [], 0
    for u in us:
        if actual and n + len(u["texto"]) > caracteres:
            out.append(actual)
            actual, n = [], 0
        actual.append(u)
        n += len(u["texto"])
    return out + ([actual] if actual else [])


def extraer(sigla: str, limite: int | None = None, hilos: int = 6) -> list[dict]:
    """Las promesas verificadas (cita literal) de un programa."""
    us = unidades(paginas(CARPETA_PDF / PROGRAMAS[sigla]["pdf"]), sigla)
    por_id = {u["id"]: u for u in us}
    temas = ", ".join(s for s, _, _ in TEMAS)
    lotes = tandas(us)[:limite]

    def una(lote):
        texto = "\n".join(f"[{u['id']}] {u['texto']}" for u in lote)
        return _cache("promesas\x1f" + texto, lambda: _gemini(PROMPT_PROMESAS.format(temas=temas, unidades=texto), ESQ_PROMESAS, 6000))

    promesas = []
    with ThreadPoolExecutor(hilos) as ex:
        for r in ex.map(una, lotes):
            for p in r.get("promesas", []):
                u = por_id.get(p.get("id"))
                if not u or not cita_literal(p.get("cita", ""), u["texto"]):
                    continue
                promesas.append({**p, "sigla": sigla, "pagina": u["pagina"], "tema": p["tema"] if p["tema"] in {s for s, _, _ in TEMAS} else "otro"})
    return promesas


# ---------- 3. iniciativas votadas y buscador ----------

def actos(votaciones: list[dict]) -> list[dict]:
    """Las votaciones del Pleno agrupadas por iniciativa (expediente) o, sin expediente, por asunto y día.

    En una ley, la votación clave es la última sin «(enmienda…)» ni «(punto…)» en el título (la de conjunto o la
    del dictamen) fuera de las enmiendas del Senado; si no la hay, la última.
    """
    # Por expediente y título: algunas votaciones heredan por error el expediente de otra iniciativa del mismo día.
    grupos: dict[tuple, list[dict]] = defaultdict(list)
    for v in votaciones:
        base = re.sub(r"\s*\([^()]*\)\s*$", "", v["titulo"]).strip()
        grupos[(v["exp"] or v["fecha"], base[:90].lower())].append(v)
    out, usados = [], Counter()
    for (clave, _), vs in grupos.items():
        vs.sort(key=lambda v: (v["fecha"], int(v["id"].split("-")[1]) if v["id"].split("-")[-1].isdigit() else 0))
        sin_sufijo = [v for v in vs if not re.search(r"\((?:enmienda|enmiendas|resto|votación en bloque|punto|voto particular)", v["titulo"], re.I)
                      and v["tipo"] != "Enmiendas del Senado"]
        es_ley = bool(re.match(r"1(2[12]|21)/", clave)) or vs[0]["tipo"] in ("Proyecto de ley", "Toma en consideración", "Dictamen")
        if clave.startswith("130/"):   # decreto-ley: la convalidación (no la votación de tramitarlo como proyecto)
            claves = [next((v for v in vs if not v["titulo"].startswith("Tramitar")), vs[0])["id"]]
        else:
            claves = [(sin_sufijo or vs)[-1]["id"]] if es_ley else [v["id"] for v in vs]   # una PNL o moción: todos sus puntos
        toma = next((v["id"] for v in vs if v["tipo"] == "Toma en consideración"), None)
        usados[clave] += 1
        out.append({"id": clave if usados[clave] == 1 else f"{clave}·{usados[clave]}", "tipo": vs[0]["tipo"], "fecha": vs[-1]["fecha"],
                    "vinculante": bool(re.match(r"1(21|22|30)/", clave)) or vs[0]["tipo"] in ("Proyecto de ley", "Toma en consideración", "Dictamen", "Enmiendas del Senado", "Convalidación RDL"),
                    "titulo": re.sub(r"\s*\([^()]*\)\s*$", "", vs[0]["titulo"]).strip(),
                    "texto": vs[0]["texto"][:700], "claves": claves, "toma": toma if toma not in claves else None,
                    "votos": [v["id"] for v in vs], "tm": sorted({t for v in vs for t in v.get("tm", [])})})
    return out


_VACIAS = set("""a al algo algun alguna algunas alguno algunos ante antes como con contra cual cuando de del desde donde
durante e el ella ellas ellos en entre era es esa esas ese eso esos esta estas este esto estos fue ha han hasta la las le
les lo los mas me mi mientras muy nos o os otra otras otro otros para pero por porque que quien se sea segun ser si sin
sobre su sus tambien tan te tiene todo todos tras tu un una uno unos y ya ley leyes proposicion proyecto grupo
parlamentario relativa sobre medidas gobierno congreso modificacion organica real decreto""".split())


def _tokens(s: str) -> list[str]:
    s = "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")
    return [t[:6] for t in re.findall(r"[a-z0-9ñ]{3,}", s) if t not in _VACIAS]


class Buscador:
    """BM25 sobre el título y el texto de cada iniciativa (raíces de seis letras, sin palabras vacías)."""

    def __init__(self, docs: list[dict], k1: float = 1.4, b: float = 0.75):
        self.docs, self.k1, self.b = docs, k1, b
        self.tf = [Counter(_tokens(d["titulo"] + " " + d["texto"])) for d in docs]
        self.largo = [sum(t.values()) for t in self.tf]
        self.medio = sum(self.largo) / max(1, len(self.largo))
        df = Counter(t for tf in self.tf for t in tf)
        n = len(docs)
        self.idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}

    def buscar(self, consulta: str, tema: str | None = None, n: int = 12) -> list[dict]:
        q = Counter(_tokens(consulta))
        puntos = []
        for i, tf in enumerate(self.tf):
            s = sum(self.idf.get(t, 0) * tf[t] * (self.k1 + 1) / (tf[t] + self.k1 * (1 - self.b + self.b * self.largo[i] / self.medio))
                    for t in q if t in tf)
            if s > 0:
                if tema and tema in self.docs[i]["tm"]:
                    s *= 1.25
                puntos.append((s, i))
        return [self.docs[i] for _, i in sorted(puntos, reverse=True)[:n]]


_GRUPOS = re.compile(r"(?:Grupos? Parlamentarios? (?:de |del )?)?(?:Socialista|Popular en el Congreso|Popular|VOX|Vox|Plurinacional SUMAR|"
                     r"SUMAR|Sumar|Republicano|Junts per Catalunya|Euskal Herria Bildu|EH Bildu|Vasco \(EAJ-PNV\)|EAJ-PNV|PNV|Mixto|"
                     r"PSOE|PP|ERC|Junts|Bildu|BNG|UPN|Coalición Canaria|Podemos)(?:\s*\([^)]*\))?", re.U)


def anonimo(s: str) -> str:
    """Quita nombres de partidos y grupos (el juicio se hace a ciegas)."""
    return re.sub(r"(\[GRUPO\][,\sy]*)+\[GRUPO\]", "[GRUPO]", _GRUPOS.sub("[GRUPO]", s))


# ---------- 4. juicio a ciegas ----------

def juzgar(promesa: dict, candidatos: list[dict]) -> dict[str, dict]:
    import random
    orden = candidatos[:]
    random.Random(promesa["id"] if "id" in promesa else promesa["resumen"]).shuffle(orden)   # el orden no debe influir
    lista = "\n".join(f"[{a['id']}] ({a['tipo']}, {a['fecha'][:4]}) {anonimo(a['titulo'])}. {anonimo(a['texto'])[:500]}" for a in orden)
    mensaje = PROMPT_JUICIO.format(promesa=promesa["resumen"], objeto=promesa["objeto"], actos=lista)
    r = _cache("juicio\x1f" + mensaje, lambda: _gemini(mensaje, ESQ_JUICIO, 3000))
    validos = {a["id"] for a in candidatos}
    return {x["id"]: x for x in r.get("relaciones", []) if x.get("id") in validos}


# ---------- 5. voto de cada candidatura y resultado ----------

def posicion(voto: str, indices: list[int]) -> str | None:
    """Postura de una candidatura en una votación: la mayoría de sus diputados que votaron; «D» si más del 20 % votó
    distinto; None si ninguno votó (o no era diputado)."""
    if not voto:
        return None
    c = Counter(voto[i] for i in indices if i < len(voto) and voto[i] in "SNA")
    if not c:
        return None
    (x, n), total = c.most_common(1)[0], sum(c.values())
    return x if n / total >= 0.8 else "D"


PESO = [(r"conjunto|votación final", 0), (r"Convalidación", 1), (r"Enmiendas del Senado", 2), (r"Dictamen", 3),
        (r"totalidad", 4), (r"Toma en consideración", 5), (r"Proyecto de ley", 3), (r"Moción", 7), (r"Proposición no de ley", 7)]


def peso(acto: dict) -> int:
    return next((p for patron, p in PESO if re.search(patron, acto["tipo"] + " " + acto["titulo"], re.I)), 6)


def resultado(promesa: dict, relaciones: list[tuple[dict, str, str | None]]) -> tuple[str, list]:
    """Aplica la tabla de RESULTADOS. `relaciones`: (acto, relación, postura de la candidatura)."""
    if promesa["competencia"] == "ninguna":
        return "sin_competencia", []
    utiles = [(a, r, p) for a, r, p in relaciones if r in ("cumple", "avanza", "contradice") and p]
    if not utiles:
        return "no_votada", []
    # Lo más específico primero (cumple y contradice antes que avanza) y, a igualdad, la votación de más peso.
    utiles.sort(key=lambda x: (x[1] == "avanza", peso(x[0]), x[0]["fecha"]))
    sentido = lambda r, p: None if p in ("A", "D") else ("coherente" if (r == "contradice") == (p == "N") else "contrario")
    sentidos = {sentido(r, p) for _, r, p in utiles if r != "avanza" or len(utiles) == 1} - {None}
    if len(sentidos) > 1:
        return "distinto_sentido", utiles
    a, r, p = utiles[0]
    if p == "A":
        return "abstencion", utiles
    if p == "D":
        return "distinto_sentido", utiles
    if r == "contradice":
        return ("en_contra_contradice" if p == "N" else "a_favor_contradice"), utiles
    if p == "S":
        return ("a_favor_cumple" if r == "cumple" else "a_favor_avanza"), utiles
    return ("en_contra_cumple" if r == "cumple" else "en_contra_avanza"), utiles


def ejecutar(solo: str | None = None, limite: int | None = None) -> dict:
    """Extrae, busca, juzga y escribe data/promesas/promesas.json."""
    indice = json.loads((SITIO / "datos" / "indice.json").read_text())
    dips = indice["diputados"]
    votaciones = [v for f in sorted((SITIO / "datos").glob("[0-9][0-9][0-9][0-9]-[0-9][0-9].json"))
                  for v in json.loads(f.read_text())["votaciones"]]
    por_id = {v["id"]: v for v in votaciones}
    A = actos(votaciones)
    buscador = Buscador(A)
    salida = {"version": VERSION, "programas": {}}
    previo = DATOS / "elecciones" / "promesas.json"   # se publica con el resto de la sección (elecciones.escribir)
    if previo.exists() and solo:
        salida = json.loads(previo.read_text())
    for sigla, prog in PROGRAMAS.items():
        if solo and sigla != solo:
            continue
        indices = [i for i, d in enumerate(dips) if d[3] in prog["formaciones"]]
        promesas = extraer(sigla, limite)
        print(f"  {sigla}: {len(promesas)} promesas verificables")

        def una(p):
            if p["competencia"] == "ninguna" or p["verificabilidad"] == "baja":
                return p, {}
            cands = buscador.buscar(f"{p['objeto']} {p['resumen']}", p["tema"])
            return p, juzgar(p, cands) if cands else {}

        lista = []
        with ThreadPoolExecutor(6) as ex:
            for p, rel in ex.map(una, promesas):
                filas = []
                for a in A:
                    if a["id"] not in rel:
                        continue
                    posturas = {posicion(por_id[v]["v"], indices) for v in a["claves"]} - {None}
                    postura = posturas.pop() if len(posturas) == 1 else ("D" if posturas else None)
                    filas.append((a, rel[a["id"]]["relacion"], postura))
                if p["verificabilidad"] == "baja":
                    res, utiles = "no_verificable", []
                else:
                    res, utiles = resultado(p, filas)
                lista.append({"id": p["id"], "pagina": p["pagina"], "cita": p["cita"], "resumen": p["resumen"], "objeto": p["objeto"],
                              "tipo": p["tipo"], "tema": p["tema"], "competencia": p["competencia"], "verificabilidad": p["verificabilidad"],
                              "resultado": res,
                              "votos": [[a["id"], a["claves"][0], a["fecha"], a["titulo"][:160], r, x,
                                         (rel.get(a["id"]) or {}).get("motivo", ""), int(a["vinculante"])] for a, r, x in utiles[:4]]})
        salida["programas"][sigla] = {"nombre": prog["nombre"], "url": prog["url"], "diputados": len(indices),
                                      "promesas": sorted(lista, key=lambda x: x["id"])}
    salida["resultados"] = RESULTADOS
    from .analisis import USO
    print(f"  Gemini: {USO['llamadas']} llamadas, {USO['entrada']:,} tokens de entrada y {USO['salida']:,} de salida")
    previo.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")))
    return salida
