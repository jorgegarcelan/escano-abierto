"""Lo que se saca de juntar los análisis de toda la legislatura: por qué vota cada grupo, si el Gobierno contesta,
qué se dice de cada territorio, de qué se habla cada semana, qué propone cada grupo y citas para el juego.

Todo se calcula a partir de lo ya analizado, sin llamar a la API. Las pasadas de IA que unifican etiquetas,
lugares y propuestas viven en normalizar.py y dejan su resultado en data/; aquí solo se leen.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict

# Voto del grupo en los datos oficiales -> postura que expresa en el debate.
VOTO_A_POSTURA = {"S": "a favor", "N": "en contra", "A": "abstención"}
MAX_MOTIVO = 220


def _intervenciones_por_asunto(sesiones: list[dict], ivs: list[dict]) -> tuple[dict, dict]:
    """(votación -> intervenciones con postura del asunto enlazado, expediente -> las mismas)."""
    por_asunto = defaultdict(list)
    for i in ivs:
        if i.get("pos"):
            por_asunto[(i["s"], i["item"])].append(i)
    por_voto, por_exp = defaultdict(list), defaultdict(list)
    for s in sesiones:
        for p in s.get("puntos", []):
            lista = por_asunto.get((s["id"], p.get("itemId")), [])
            if not lista:
                continue
            for vid in p.get("votos", []):
                por_voto[vid].extend(lista)
            if p.get("exp"):
                por_exp[p["exp"]].extend(lista)
    return por_voto, por_exp


def porque_votan(votaciones: list[dict], sesiones: list[dict], ivs: list[dict]) -> int:
    """Añade a cada votación "porque": {grupo: [motivo, orador, sesión, fecha]} del debate de esa iniciativa.

    Solo se usa el motivo si la postura expresada en el debate coincide con lo que votó el grupo: si difieren
    (enmiendas, cambios de última hora), se calla antes que confundir. Devuelve cuántas votaciones lo tienen.
    """
    por_voto, por_exp = _intervenciones_por_asunto(sesiones, ivs)
    fecha = {s["id"]: s["fecha"] for s in sesiones}
    con = 0
    for v in votaciones:
        candidatas = por_voto.get(v["id"]) or por_exp.get(v.get("exp") or "") or []
        porque = {}
        for i in candidatas:
            g = i["g"]
            if g in porque or not i.get("motivo"):
                continue
            if VOTO_A_POSTURA.get(v["grupos"].get(g, "?")) != i["pos"]:
                continue
            motivo = i["motivo"] if len(i["motivo"]) <= MAX_MOTIVO else i["motivo"][:MAX_MOTIVO - 1].rstrip() + "…"
            porque[g] = [motivo, i["orador"], i["s"], fecha.get(i["s"], v["fecha"])]
        if porque:
            v["porque"] = porque
            con += 1
    return con


def contesta(sesiones: list[dict], ivs: list[dict], min_respuestas: int = 20) -> dict:
    """Cómo responde cada miembro del Gobierno en el control, según la valoración de la IA, y a quién.

    Cada respuesta se asocia a la última intervención de otro grupo en el mismo asunto (quien preguntó).
    """
    fecha = {s["id"]: s["fecha"] for s in sesiones}
    por_orador: dict[str, dict] = {}
    por_grupo = defaultdict(lambda: {"sí": 0, "parcial": 0, "no": 0})
    previa: dict[tuple, dict] = {}
    for i in ivs:
        clave = (i["s"], i["item"])
        if i["g"] != "GOB":
            previa[clave] = i
            continue
        r = i.get("responde")
        if r not in ("sí", "parcial", "no"):
            continue
        o = por_orador.setdefault(i["orador"], {"rol": i.get("rol", ""), "sí": 0, "parcial": 0, "no": 0, "casos": []})
        o[r] += 1
        p = previa.get(clave)
        if p:
            por_grupo[p["g"]][r] += 1
        o["casos"].append([fecha.get(i["s"], ""), i["s"], r, i.get("responde_motivo", ""), p["orador"] if p else "",
                           p["g"] if p else "", (p or {}).get("frase", "")])
    ministros = []
    for nombre, o in por_orador.items():
        n = o["sí"] + o["parcial"] + o["no"]
        if n < min_respuestas:
            continue
        casos = sorted(o["casos"], reverse=True)[:40]
        ministros.append({"orador": nombre, "rol": o["rol"], "n": n, "si": o["sí"], "parcial": o["parcial"],
                          "no": o["no"], "casos": casos})
    ministros.sort(key=lambda m: -m["n"])
    return {"ministros": ministros,
            "por_grupo": {g: {"si": c["sí"], "parcial": c["parcial"], "no": c["no"]} for g, c in por_grupo.items()
                          if sum(c.values()) >= min_respuestas}}


# Palabras que delatan al grupo del orador en su propia cita (el juego sería trivial).
DELATAN = {
    "PP": ("popular", "feijóo", "feijoo"), "PSOE": ("socialista", "sánchez", "psoe"), "VOX": ("vox", "abascal"),
    "SUMAR": ("sumar", "podemos", "yolanda díaz"), "ERC": ("esquerra", "republicana", "erc"),
    "JUNTS": ("junts", "puigdemont"), "BILDU": ("bildu", "euskal herria"), "PNV": ("pnv", "euzko", "jeltzale"),
    "MIXTO": ("mixto",), "GOB": ("gobierno de españa", "este gobierno", "mi gobierno", "mi ministerio"),
}
GRUPOS_JUEGO = ("PSOE", "PP", "VOX", "SUMAR", "ERC", "JUNTS", "BILDU", "PNV", "GOB")


def citas_juego(sesiones: list[dict], ivs: list[dict], por_grupo: int = 300) -> list[list]:
    """Citas verificadas para «¿Quién lo dijo?»: [cita, orador, grupo, sesión, fecha].

    Mismo número por grupo, sin las que delatan al grupo, y elegidas por un hash del texto: la muestra es
    estable de un día a otro (no reescribe el fichero entero cada mañana).
    """
    import hashlib
    fecha = {s["id"]: s["fecha"] for s in sesiones}
    candidatas = defaultdict(list)
    for i in ivs:
        c, g = i.get("cita"), i["g"]
        if not c or g not in GRUPOS_JUEGO or not 60 <= len(c) <= 220:
            continue
        if any(p in c.lower() for p in DELATAN.get(g, ())):
            continue
        candidatas[g].append((hashlib.sha1(c.encode()).hexdigest(), [c, i["orador"], g, i["s"], fecha.get(i["s"], "")]))
    salida = []
    for g in GRUPOS_JUEGO:
        salida += [x for _, x in sorted(candidatas[g])[:por_grupo]]
    return salida


def _sin_tildes(t: str) -> str:
    import unicodedata
    t = "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
    return " ".join(t.lower().split())


def nombres_oradores(citas: list[list], diputados: list[list]) -> dict:
    """Orador del Diario -> nombre completo, cuando sus apellidos identifican a un solo diputado (como en la web)."""
    por_apellidos = defaultdict(list)
    for d in diputados:
        por_apellidos[_sin_tildes(d[0].partition(", ")[0])].append(d[0])
    nombres = {}
    for o in {c[1] for c in citas}:
        ds = por_apellidos.get(_sin_tildes(o), [])
        if len(ds) == 1:
            apellidos, _, nombre = ds[0].partition(", ")
            nombres[o] = f"{nombre} {apellidos}".strip()
    return nombres


def reto(citas: list[list], nombres: dict, fecha: str, n: int = 10, pool: list[list] | None = None) -> list[dict]:
    """El reto de «¿Quién lo dijo?» de un día: n citas de n personas distintas (dos como mucho por grupo), con las
    cuatro opciones de grupo y las tres de persona. La misma fecha da siempre el mismo reto con las mismas citas.

    pool: las citas de las que se sacan las frases, si no son todas (un reto temático); las opciones de persona
    salen siempre de todas."""
    import random
    az = random.Random(f"qld-{fecha}")
    # Una persona, una clave: el Diario a veces escribe el mismo nombre de dos formas («Álvaro Vidal» y «Alvaro
    # Vidal», «Madrenas i Mir» y «Marta Madrenas i Mir»).
    clave = lambda o: _sin_tildes(nombres.get(o, o))
    personas = defaultdict(dict)
    for c in citas + (pool or []):
        personas[c[2]].setdefault(clave(c[1]), c[1])
    orden = list(pool if pool is not None else citas)
    az.shuffle(orden)
    rondas, vistos, por_grupo = [], set(), Counter()
    for c in orden:
        if len(rondas) == n:
            break
        if clave(c[1]) in vistos or por_grupo[c[2]] >= 2:
            continue
        vistos.add(clave(c[1]))
        por_grupo[c[2]] += 1
        grupos = [c[2], *az.sample([g for g in GRUPOS_JUEGO if g != c[2]], 3)]
        otros = [o for k, o in personas[c[2]].items() if k != clave(c[1])]
        quienes = [c[1], *az.sample(otros, min(2, len(otros)))]
        az.shuffle(grupos)
        az.shuffle(quienes)
        rondas.append({"c": c, "grupos": grupos, "personas": quienes})
    return rondas


def citas_de_tema(tema: str, carpeta) -> list[list]:
    """Las citas comprobadas de toda la legislatura que tratan de un tema fijo (temas.py, por palabras clave sobre
    la propia frase), con los mismos filtros que las del juego: [cita, orador, grupo, sesión, fecha]."""
    import json
    from .temas import temas_de
    salida, vistas = [], set()
    for f in sorted(carpeta.glob("20[0-9][0-9]-[0-9][0-9].json")):
        mes = json.loads(f.read_text())
        fecha = {x["id"]: x["fecha"] for x in mes["sesiones"]}
        for i in mes["intervenciones"]:
            c, g = i.get("cita"), i["g"]
            if not c or c in vistas or g not in GRUPOS_JUEGO or not 60 <= len(c) <= 220:
                continue
            if any(p in c.lower() for p in DELATAN.get(g, ())) or tema not in temas_de(c):
                continue
            vistas.add(c)
            salida.append([c, i["orador"], g, i["s"], fecha.get(i["s"], "")])
    return salida


def reto_tematico(fecha: str, tema: str, citas: list[list], diputados: list[list], carpeta) -> dict:
    """Un reto especial: las diez frases de un tema (vivienda, sanidad…). Se guarda como {"tema", "nombre",
    "rondas"} en lugar de la lista de rondas; la web enseña «Especial vivienda»."""
    from .temas import NOMBRE
    pool = citas_de_tema(tema, carpeta)
    nombres = nombres_oradores(citas + pool, diputados)
    rondas = reto(citas, nombres, f"{fecha}-{tema}", pool=pool)
    if len(rondas) < 10:
        raise SystemExit(f"Solo hay frases para {len(rondas)} rondas sobre {tema}.")
    return {"tema": tema, "nombre": NOMBRE[tema], "rondas": rondas}


def retos(citas: list[list], diputados: list[list], previos: dict, hoy, antes: int = 2,
          despues: int = 14) -> tuple[dict, dict]:
    """Fija los retos del día de antemano: (todos, ventana).

    Un reto ya calculado no se vuelve a tocar, aunque cambien las citas (cada mañana entran frases nuevas): así es
    el mismo para quien juega de madrugada y para quien juega después de la actualización. Solo se calculan los
    días que faltan. La ventana (de `antes` días atrás a `despues` días adelante) es lo que se publica en la web:
    cubre a quien tiene otra hora en su dispositivo y los días sin actualización.
    """
    from datetime import timedelta
    nombres = nombres_oradores(citas, diputados)
    todos = dict(previos)
    ventana = {}
    for k in range(-antes, despues + 1):
        fecha = (hoy + timedelta(days=k)).isoformat()
        if fecha not in todos and citas:
            todos[fecha] = reto(citas, nombres, fecha)
        if fecha in todos:
            ventana[fecha] = todos[fecha]
    return dict(sorted(todos.items())), ventana


# ---------------------------------------------------------------- radar de temas

def _lunes(fecha: str) -> str:
    from datetime import date, timedelta
    d = date.fromisoformat(fecha)
    return (d - timedelta(days=d.weekday())).isoformat()


def radar(sesiones: list[dict], ivs: list[dict], canon: dict, max_temas: int = 400, minimo: int = 8) -> dict:
    """De qué se habla cada semana, con las etiquetas unificadas: serie semanal, grupos y los que se disparan.

    Una intervención cuenta una vez por etiqueta. Las etiquetas aún sin unificar se usan tal cual.
    """
    from .normalizar import clave_etiqueta
    fecha = {s["id"]: s["fecha"] for s in sesiones}
    semanas = sorted({_lunes(f) for f in fecha.values()})
    k_semana = {s: k for k, s in enumerate(semanas)}
    series = defaultdict(lambda: [0] * len(semanas))
    grupos = defaultdict(Counter)
    tema_fijo, primera = {}, {}
    for i in ivs:
        f = fecha.get(i["s"])
        if not f:
            continue
        k = k_semana[_lunes(f)]
        vistos = set()
        for t in i.get("temas", []):
            c, fijo = canon.get(clave_etiqueta(t), [" ".join(t.split()), "otro"])
            if c in vistos:
                continue
            vistos.add(c)
            series[c][k] += 1
            grupos[c][i["g"]] += 1
            tema_fijo.setdefault(c, fijo)
            primera[c] = min(primera.get(c, f), f)
    top = sorted((c for c in series if sum(series[c]) >= minimo), key=lambda c: -sum(series[c]))[:max_temas]
    # Lo que se dispara en cada una de las últimas semanas: muy por encima de su media de las 8 anteriores.
    destacados = []
    for k in range(max(0, len(semanas) - 16), len(semanas)):
        filas = []
        for c in top:
            n = series[c][k]
            if n < 3:
                continue
            antes = series[c][max(0, k - 8):k]
            media = sum(antes) / len(antes) if antes else 0
            nuevo = primera[c] >= semanas[k]
            if nuevo or n >= 2 * media + 2:
                filas.append([c, n, round(media, 1), nuevo])
        filas.sort(key=lambda x: (-(x[1] - x[2]), x[0]))
        destacados.append({"semana": semanas[k], "temas": filas[:12]})
    return {"semanas": semanas, "destacados": destacados,
            "temas": {c: {"tema": tema_fijo[c], "n": sum(series[c]), "primera": primera[c], "serie": series[c],
                          "grupos": dict(grupos[c].most_common())} for c in top}}


# ---------------------------------------------------------------- territorio

def lugares(sesiones: list[dict], ivs: list[dict], mapa: dict, canon: dict, por_lista: int = 40) -> dict[str, dict]:
    """Lo que se dice de cada circunscripción y, aparte, de su comunidad (si tiene varias provincias).

    "central" son las intervenciones cuyo resumen nombra el lugar: hablan de él, no lo citan de pasada (la IA a
    veces confunde lugares con apellidos, como Soria). Las cifras y los temas salen solo de esas.
    """
    import unicodedata
    from .normalizar import CCAA, clave_etiqueta

    def plano(t: str) -> str:
        return "".join(c for c in unicodedata.normalize("NFD", t.lower()) if unicodedata.category(c) != "Mn")

    fecha = {s["id"]: s["fecha"] for s in sesiones}
    comunidad_de = {c: ccaa for ccaa, cs in CCAA.items() for c in cs}
    vacio = lambda: {"n": 0, "central": [], "pasada": [], "grupos": Counter(), "temas": Counter()}
    por_circ = {c: vacio() for c in comunidad_de}
    por_ccaa = {ccaa: vacio() for ccaa, cs in CCAA.items() if len(cs) > 1}
    for i in sorted(ivs, key=lambda x: fecha.get(x["s"], ""), reverse=True):
        texto = plano(f"{i.get('resumen', '')} {i.get('frase', '')}")
        destinos = {}
        for lugar in i.get("lugares", []):
            ambito, ccaa, circ = mapa.get(" ".join(lugar.split()), ["otro", "", ""])
            if circ in por_circ:
                destino = por_circ[circ]
            elif ambito == "comunidad" and ccaa in CCAA:
                destino = por_circ[CCAA[ccaa][0]] if len(CCAA[ccaa]) == 1 else por_ccaa[ccaa]
            else:
                continue
            central = bool(re.search(rf"\b{re.escape(plano(lugar))}\b", texto))
            if id(destino) not in destinos or central:
                destinos[id(destino)] = (destino, lugar, central)
        for d, lugar, central in destinos.values():
            fila = [fecha.get(i["s"], ""), i["s"], i["orador"], i["g"], lugar, i.get("frase") or ""]
            if not central:
                if len(d["pasada"]) < por_lista:
                    d["pasada"].append(fila)
                continue
            d["n"] += 1
            d["grupos"][i["g"]] += 1
            for t in i.get("temas", []):
                d["temas"][canon.get(clave_etiqueta(t), [t])[0]] += 1
            if len(d["central"]) < por_lista:
                d["central"].append(fila)
    for d in [*por_circ.values(), *por_ccaa.values()]:
        d["grupos"] = dict(d["grupos"].most_common())
        d["temas"] = [[t, n] for t, n in d["temas"].most_common(12)]
    return {c: {**d, "comunidad": ({"nombre": comunidad_de[c], **por_ccaa[comunidad_de[c]]}
                                   if comunidad_de[c] in por_ccaa else None)}
            for c, d in por_circ.items()}


# ---------------------------------------------------------------- propuestas

def propuestas(sintesis: dict) -> dict:
    """{tema: {grupo: {"total", "lineas"}}} a partir de la síntesis guardada en data/normalizacion."""
    salida = defaultdict(dict)
    for x in sintesis.values():
        if x.get("lineas"):
            salida[x["tema"]][x["grupo"]] = {"total": x["total"], "lineas": x["lineas"]}
    return dict(salida)
