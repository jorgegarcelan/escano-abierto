"""Pasadas de IA sobre lo ya analizado, para poder agregarlo: etiquetas de tema unificadas, lugares situados en
su provincia y propuestas agrupadas por tema y grupo.

    python -m escano explora            # hace lo que falte de las tres; lo ya hecho no se repite
    python -m escano explora --solo temas

El resultado vive en data/normalizacion/ y se guarda tras cada trozo (se puede cortar y relanzar). `construir`
solo lo lee: sin clave de API, la web usa lo último que haya.
"""
from __future__ import annotations

import hashlib
import json
import os
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

from . import analisis
from . import temas as mod_temas
from .config import DATOS, SESIONES

DIR = DATOS / "normalizacion"
SISTEMA = ("Eres un documentalista del Congreso de los Diputados de España. Ordenas y unificas etiquetas y textos "
           "breves ya extraídos de los debates, sin valorar a nadie y sin añadir nada que no esté en ellos. "
           "Escribe en español.")

CCAA = {
    "Andalucía": ["Almería", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Málaga", "Sevilla"],
    "Aragón": ["Huesca", "Teruel", "Zaragoza"],
    "Asturias": ["Asturias"],
    "Illes Balears": ["Balears (Illes)"],
    "Canarias": ["Palmas (Las)", "S/C Tenerife"],
    "Cantabria": ["Cantabria"],
    "Castilla y León": ["Ávila", "Burgos", "León", "Palencia", "Salamanca", "Segovia", "Soria", "Valladolid", "Zamora"],
    "Castilla-La Mancha": ["Albacete", "Ciudad Real", "Cuenca", "Guadalajara", "Toledo"],
    "Cataluña": ["Barcelona", "Girona", "Lleida", "Tarragona"],
    "Comunitat Valenciana": ["Alicante/Alacant", "Castellón/Castelló", "Valencia/València"],
    "Extremadura": ["Badajoz", "Cáceres"],
    "Galicia": ["Coruña (A)", "Lugo", "Ourense", "Pontevedra"],
    "Comunidad de Madrid": ["Madrid"],
    "Región de Murcia": ["Murcia"],
    "Navarra": ["Navarra"],
    "País Vasco": ["Araba/Álava", "Bizkaia", "Gipuzkoa"],
    "La Rioja": ["Rioja (La)"],
    "Ceuta": ["Ceuta"],
    "Melilla": ["Melilla"],
}
CIRCUNSCRIPCIONES = sorted(c for cs in CCAA.values() for c in cs)
GRUPOS_PROPUESTAS = ("PSOE", "PP", "VOX", "SUMAR", "ERC", "JUNTS", "BILDU", "PNV", "MIXTO", "GOB")


# ---------------------------------------------------------------- utilidades

def _leer(nombre: str) -> dict:
    f = DIR / f"{nombre}.json"
    return json.loads(f.read_text()) if f.exists() else {}


def _guardar(nombre: str, datos: dict) -> None:
    DIR.mkdir(parents=True, exist_ok=True)
    f = DIR / f"{nombre}.json"
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(datos, ensure_ascii=False, indent=0, sort_keys=True))
    tmp.replace(f)


def _pedir(mensaje: str, esquema: dict, max_tokens: int) -> dict:
    return analisis.ClienteGemini().generar(SISTEMA, mensaje, esquema, max_tokens)


def clave_etiqueta(t: str) -> str:
    return " ".join(t.lower().split())


def recoger() -> list[dict]:
    """Las intervenciones analizadas, con lo que necesitan estas pasadas (solo de la caché, sin API)."""
    from .construir import analisis_de_sesion
    salida = []
    for f in sorted(SESIONES.glob("*.json")):
        ses = json.loads(f.read_text())
        if not ses.get("fecha"):
            continue
        an, _, _ = analisis_de_sesion(ses, [], con_ia=False)
        for iv in ses["intervenciones"]:
            a = an.get(iv["orden"])
            if a:
                salida.append({"s": ses["id"], "fecha": ses["fecha"], "orador": iv["orador"], "g": iv["grupo"],
                               "temas": a.get("temas") or [], "lugares": a.get("territorios") or [],
                               "prop": a.get("propuestas") or [], "frase": a.get("en_una_frase") or ""})
    return salida


# ---------------------------------------------------------------- etiquetas de tema

TEMAS_FIJOS = [s for s, _, _ in mod_temas.TEMAS]


def normalizar_temas(ivs: list[dict], trozo: int = 400) -> dict:
    """{etiqueta: [canónica, tema fijo]} para todas las etiquetas; solo pide a la IA las que falten."""
    hechas = _leer("temas")
    cuenta = Counter(clave_etiqueta(t) for i in ivs for t in i["temas"] if t.strip())
    faltan = [t for t, _ in cuenta.most_common() if t not in hechas]   # las frecuentes primero: fijan el vocabulario
    esquema = {"type": "object", "required": ["etiquetas"], "properties": {"etiquetas": {"type": "array", "items": {
        "type": "object", "required": ["etiqueta", "canonica", "tema"], "properties": {
            "etiqueta": {"type": "string"},
            "canonica": {"type": "string"},
            "tema": {"type": "string", "enum": TEMAS_FIJOS + ["otro"]}}}}}}
    for k in range(0, len(faltan), trozo):
        lote = faltan[k:k + trozo]
        vocabulario = [c for c, _ in Counter(v[0] for v in hechas.values()).most_common(1500)]
        mensaje = (
            "Unifica estas etiquetas de tema de intervenciones parlamentarias. Para cada una devuelve:\n"
            "- canonica: la forma única de ESA MISMA cosa, para contar juntas sus variantes: plurales, tildes, "
            "mayúsculas, orden de palabras, abreviaturas y sinónimos exactos ('apagón eléctrico' → 'apagón', "
            "'migración' → 'inmigración', 'amnistia' → 'amnistía'). NUNCA la cambies por una categoría más general: "
            "'caso Gürtel' sigue siendo 'caso Gürtel' (no 'corrupción'), 'exhumaciones' sigue siendo 'exhumaciones' "
            "(no 'memoria democrática'), 'baloncesto' sigue siendo 'baloncesto' (no 'deporte'). En la duda, deja la "
            "etiqueta como está. Escribe en minúscula salvo nombres propios ('Ceuta', 'caso Koldo', 'DANA').\n"
            f"- tema: el tema general al que pertenece, uno de: {', '.join(TEMAS_FIJOS)}; u 'otro'.\n\n"
            f"Canónicas ya usadas (reutiliza una solo si es exactamente lo mismo):\n{json.dumps(vocabulario, ensure_ascii=False)}\n\n"
            f"Etiquetas:\n{json.dumps(lote, ensure_ascii=False)}")
        r = _pedir(mensaje, esquema, 6000)
        pedidas = set(lote)
        for x in r.get("etiquetas", []):
            e = clave_etiqueta(x.get("etiqueta", ""))
            if e in pedidas and x.get("canonica", "").strip():
                hechas[e] = [" ".join(x["canonica"].split()), x.get("tema", "otro")]
        _guardar("temas", hechas)
        print(f"  temas: {min(k + trozo, len(faltan))} de {len(faltan)} · {len(hechas)} etiquetas con canónica", flush=True)
    return hechas


# ---------------------------------------------------------------- lugares

def normalizar_lugares(ivs: list[dict], trozo: int = 300) -> dict:
    """{lugar: [ámbito, comunidad, circunscripción]}; solo pide a la IA los que falten."""
    hechos = _leer("lugares")
    cuenta = Counter(" ".join(t.split()) for i in ivs for t in i["lugares"] if t.strip())
    faltan = [t for t, _ in cuenta.most_common() if t not in hechos]
    esquema = {"type": "object", "required": ["lugares"], "properties": {"lugares": {"type": "array", "items": {
        "type": "object", "required": ["lugar", "ambito", "comunidad", "circunscripcion"], "properties": {
            "lugar": {"type": "string"},
            "ambito": {"type": "string", "enum": ["comunidad", "provincia", "municipio", "comarca", "otro"]},
            "comunidad": {"type": "string", "enum": list(CCAA) + [""]},
            "circunscripcion": {"type": "string", "enum": CIRCUNSCRIPCIONES + [""]}}}}}}
    for k in range(0, len(faltan), trozo):
        lote = faltan[k:k + trozo]
        mensaje = (
            "Sitúa cada lugar de España mencionado en el Congreso. Para cada uno devuelve:\n"
            "- ambito: comunidad (autónoma), provincia, municipio, comarca u otro (si no es un lugar concreto de "
            "España: un país, una región extranjera, 'España' entera, un mar…).\n"
            "- comunidad: la comunidad o ciudad autónoma a la que pertenece ('' si ámbito es otro).\n"
            "- circunscripcion: la provincia a la que pertenece, con el nombre exacto de la lista; '' si es una "
            "comunidad de varias provincias o si ámbito es otro. Para 'Madrid', la ciudad y la comunidad, "
            "'Madrid'; para 'Barcelona', 'Barcelona'.\n\n"
            f"Lugares:\n{json.dumps(lote, ensure_ascii=False)}")
        r = _pedir(mensaje, esquema, 6000)
        pedidos = set(lote)
        for x in r.get("lugares", []):
            if x.get("lugar") in pedidos:
                hechos[x["lugar"]] = [x.get("ambito", "otro"), x.get("comunidad", ""), x.get("circunscripcion", "")]
        _guardar("lugares", hechos)
        print(f"  lugares: {min(k + trozo, len(faltan))} de {len(faltan)}", flush=True)
    return hechos


# ---------------------------------------------------------------- propuestas

def tema_de_propuesta(texto: str, etiquetas: list[str], canon: dict) -> str | None:
    """El tema fijo de una propuesta: por sus palabras y, si no, por las etiquetas de su intervención."""
    ts = mod_temas.temas_de(texto)
    if ts:
        return ts[0]
    for t in etiquetas:
        tema = canon.get(clave_etiqueta(t), [None, "otro"])[1]
        if tema in TEMAS_FIJOS:
            return tema
    return None


def propuestas_por_tema(ivs: list[dict], canon: dict) -> dict[tuple[str, str], list[list]]:
    """{(tema, grupo): [[texto, orador, sesión, fecha], …]} de lo más reciente a lo más antiguo."""
    por = defaultdict(list)
    for i in sorted(ivs, key=lambda x: x["fecha"], reverse=True):
        if i["g"] not in GRUPOS_PROPUESTAS:
            continue
        for p in i["prop"]:
            tema = tema_de_propuesta(p, i["temas"], canon)
            if tema:
                por[(tema, i["g"])].append([p, i["orador"], i["s"], i["fecha"]])
    return por


def sintetizar_propuestas(ivs: list[dict], canon: dict, minimo: int = 6, maximo: int = 500, hilos: int = 6) -> dict:
    """Agrupa en líneas lo que propone cada grupo sobre cada tema. Rehace solo las combinaciones que han cambiado."""
    hechas = _leer("propuestas")
    por = propuestas_por_tema(ivs, canon)
    esquema = {"type": "object", "required": ["lineas"], "properties": {"lineas": {"type": "array", "maxItems": 8, "items": {
        "type": "object", "required": ["titulo", "indices"], "properties": {
            "titulo": {"type": "string"},
            "indices": {"type": "array", "items": {"type": "integer"}}}}}}}
    tareas, totales = [], {}
    for (tema, g), completa in por.items():
        lista = completa[:maximo]   # las más recientes: bastan para ver las líneas y acotan el coste
        totales[f"{tema}|{g}"] = len(completa)
        if len(lista) < minimo:
            continue
        clave = f"{tema}|{g}"
        firma = hashlib.sha1(json.dumps([x[0] for x in lista], ensure_ascii=False).encode()).hexdigest()
        previa = hechas.get(clave, {})
        base = previa.get("total_sintesis", 0)
        # Se rehace si no existe o si ha crecido de verdad (un 10 %, y al menos 10 propuestas): cada día entran
        # propuestas nuevas y rehacerlo todo a diario costaría unos 25 $ al mes para cambiar muy poco.
        if not previa or (previa.get("firma") != firma and len(completa) - base >= max(10, base // 10)):
            tareas.append((clave, tema, g, lista, firma))

    def una(t):
        clave, tema, g, lista, firma = t
        mensaje = (
            f"Estas son propuestas concretas que ha hecho en el Congreso el grupo {g} sobre el tema "
            f"'{mod_temas.NOMBRE[tema]}'. Agrúpalas en un máximo de 8 líneas: cada línea junta propuestas que "
            "piden en esencia lo mismo. Para cada línea da un 'titulo' breve y neutro que diga qué se propone "
            "(p. ej. 'Bajar el IVA de la luz'), y los 'indices' de las propuestas que la forman. Ordena las líneas "
            "de más a menos propuestas. Deja fuera las propuestas sueltas que no se repiten.\n\n"
            + "\n".join(f"{k}. {x[0]}" for k, x in enumerate(lista)))
        try:
            r = _pedir(mensaje, esquema, 2500)
        except Exception as e:  # una combinación que falla no para las demás; se reintenta en la próxima pasada
            print(f"  propuestas: {clave} falló ({e})", flush=True)
            return clave, None
        lineas = []
        for ln in r.get("lineas", []):
            idx = sorted({k for k in ln.get("indices", []) if isinstance(k, int) and 0 <= k < len(lista)})
            if len(idx) >= 2 and ln.get("titulo", "").strip():
                lineas.append({"titulo": ln["titulo"].strip(), "n": len(idx),
                               "ejemplos": [lista[k] for k in idx[:3]]})
        lineas.sort(key=lambda x: -x["n"])
        return clave, {"tema": tema, "grupo": g, "firma": firma, "total": totales[clave],
                       "total_sintesis": totales[clave], "lineas": lineas}

    hechos = 0
    with ThreadPoolExecutor(hilos) as ex:
        for clave, res in ex.map(una, tareas):
            if res is None:
                continue
            hechas[clave] = res
            hechos += 1
            if hechos % 10 == 0 or hechos == len(tareas):
                _guardar("propuestas", hechas)
                print(f"  propuestas: {hechos} de {len(tareas)} combinaciones de tema y grupo", flush=True)
    for clave, n in totales.items():   # el total cambia aunque las más recientes (y sus líneas) no
        if clave in hechas:
            hechas[clave]["total"] = n
    _guardar("propuestas", hechas)
    return hechas


def ejecutar(solo: str | None = None) -> None:
    if not os.environ.get("GEMINI_API_KEY"):
        raise SystemExit("Hace falta GEMINI_API_KEY.")
    ivs = recoger()
    print(f"· {len(ivs)} intervenciones analizadas", flush=True)
    canon = _leer("temas")
    if solo in (None, "temas"):
        canon = normalizar_temas(ivs)
    if solo in (None, "lugares"):
        normalizar_lugares(ivs)
    if solo in (None, "propuestas"):
        sintetizar_propuestas(ivs, canon)
    u = analisis.USO
    coste = (u["entrada"] * 0.75 + (u["salida"] + u["razonamiento"]) * 3.75) / 1e6
    print(f"· {u['llamadas']} llamadas · {u['entrada']} tokens de entrada, {u['salida']} de salida · ~{coste:.2f} $")
