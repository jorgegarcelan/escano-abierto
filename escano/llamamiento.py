"""Votaciones públicas por llamamiento, sacadas del Diario de Sesiones.

Cuando se vota por llamamiento (art. 86 del Reglamento: investiduras, leyes orgánicas, reformas constitucionales o
cuando se pide), los diputados responden de viva voz y no hay votación electrónica: no sale en los datos abiertos de
votaciones del Congreso, o sale incompleta. El Diario de Sesiones sí recoge quién dijo «sí», «no» o «abstención»
(también el voto telemático, el Gobierno y la Mesa) y el resultado que lee la Presidencia. Así se votaron, por ejemplo,
las investiduras de la XV legislatura, la amnistía o los decretos-leyes de vivienda del 2 de octubre de 2026.

Los nombres van seguidos, a veces sin espacios o con notas al pie pegadas («Vergara Román, Laura Vidal Sáez, Aina…»):
se casan, letra a letra, con los diputados de las votaciones electrónicas de esos días. Una votación solo se guarda si
cada nombre casa con un diputado y los recuentos dan exactamente el resultado oficial. Va en
data/votaciones/AAAA-MM-DD.json con el mismo formato que las electrónicas y "llamamiento": "<Diario>#<turno>":
- si los datos abiertos ya la tienen igual, no se repite;
- si la tienen incompleta (el 10-1-2024 faltaban los votos de Junts y de un miembro de la Mesa), se sustituye por la
  del Diario, con el mismo id, porque cada voto que sí traía coincide.

    python -m escano.llamamiento        # repasa todos los plenos guardados
"""
from __future__ import annotations

import json
import re
import unicodedata

from . import votaciones
from .config import DATOS, GRUPOS, VOTACIONES

SESIONES = DATOS / "sesiones"

_ = r"\s*"   # el PDF a veces pierde los espacios: «PorlossecretariosdelaMesa…»
RE_LISTA = re.compile(
    rf"(?:Señoras{_}y{_}señores{_}diputados|Miembros{_}de{_}la{_}Mesa|Miembros{_}del{_}Gobierno(?:{_}en{_}funciones)?){_}"
    rf"(?:que{_}(?:dijeron|votaron)(?:{_}telemáticamente)?{_}«(sí|no|abstención)»(?:{_}telemáticamente)?|(ausentes)){_}\d*{_}[:.]"
    rf"|(Votos{_}nulos){_}:", re.I)   # a veces con la llamada a una nota y punto: «…dijeron «sí»5 .»
RE_RUIDO = re.compile(r"cve:\s*\S+\s*DIARIO\s*DE\s*SESIONES\s*DEL\s*CONGRESO\s*DE\s*LOS\s*DIPUTADOS|Núm\.\s*\d+\s.{0,60}?Pág\.\s*\d+")
# Lo que viene tras la última lista, ya en letras sin espacios: «Terminada la votación, dijo», «¿Algún señor…?»…
FINALES = ("terminadalavotacion", "efectuadoel", "realizadoel", "muchasgracias", "hayalgun", "faltaalgun", "algun",
           "votosemitidos", "pausa", "lapresidenta", "elpresidente")
VOTO = {"sí": "S", "no": "N", "abstención": "A"}
CODIGO_GRUPO = {corto: oficial for oficial, corto in GRUPOS.items()}   # 'PSOE' -> 'GS', como en los datos abiertos
SERIE = {"121": "Proyecto de ", "122": "Proposición de ", "124": "Proposición de ", "125": "Proposición de "}


def _norma(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[‐-―−]", "-", s)
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def _clave(s: str) -> str:
    """Solo las letras y las comas: así casan «Fernández, Isaura» y «Fernández,Isaura», «M.a» y «María», «Eduard5»."""
    s = re.sub(r"\bM\s*\.?\s*ª\.?|\bM\.\s*a\b\.?", "María", s)   # «M.a» y «Mª»
    return re.sub(r"[^a-z,]", "", _norma(s))


RE_NOTA = re.compile(r"\s\d{1,2}\s+(?=[A-ZÁÉÍÓÚ][a-záéíóú]+\s)")   # «… Vallugera Balañà, Pilar 1 Realizado por la…»
PROSA = re.compile(r"\b(?:que|se|dijo|secretari\w*|llamamiento|voto|Presidencia|Reglamento|escrutinio)\b")


def _sin_notas(texto: str) -> str:
    """Quita las notas al pie que el Diario intercala en las listas: «1 Realizado por la señora secretaria segunda el
    llamamiento del señor Sancho Íñiguez… computándose como tal el voto.» Son frases; los nombres no."""
    while m := RE_NOTA.search(texto):
        k = m.end()
        # Frase a frase mientras sea prosa, o un trozo sin coma («No.»): los nombres siempre la llevan.
        while (p := re.search(r"\.(?:\s|$)", texto[k:])) and (PROSA.search(f := texto[k:k + p.end()]) or "," not in f):
            k += p.end()
        if k == m.end():
            break
        texto = texto[:m.start()] + " " + texto[k:]
    return texto


def _casar(texto: str, nombres: dict[str, str]) -> tuple[list[str], str]:
    """Parte una lista de nombres seguidos: en cada punto, el nombre conocido más largo. Si no hay ninguno, los
    apellidos, si solo los lleva un diputado («Rodríguez Suárez, Asunción Esther» es «Rodríguez Suárez, Esther»),
    saltando el nombre hasta el diputado siguiente. Devuelve los nombres y lo que no ha casado (vacío si todo)."""
    t, k, salida = _clave(_sin_notas(re.sub(r"\([^)]*\)", " ", RE_RUIDO.sub(" ", texto)))), 0, []   # sin acotaciones
    claves = sorted(nombres, key=len, reverse=True)
    por_apellidos: dict[str, list[str]] = {}
    for c in claves:
        por_apellidos.setdefault(c.split(",")[0] + ",", []).append(c)
    unicos = sorted((a for a, cs in por_apellidos.items() if len(cs) == 1), key=len, reverse=True)
    empieza = lambda j: any(t.startswith(c, j) for c in claves) or any(t.startswith(a, j) for a in unicos)
    while k < len(t):
        if t[k] == ",":
            k += 1
            continue
        n = next((c for c in claves if t.startswith(c, k)), None)
        if n:
            salida.append(nombres[n])
            k += len(n)
            continue
        if a := next((a for a in unicos if t.startswith(a, k)), None):
            j = k + len(a) + 1
            while j < len(t) and not empieza(j) and not t.startswith(FINALES, j):
                j += 1
            salida.append(nombres[por_apellidos[a][0]])
            k = j
            continue
        return (salida, "") if t.startswith(FINALES, k) else (salida, t[k:k + 60])
    return salida, ""


def _numero(x: str | None) -> int:
    return 0 if x is None or x.lower() in ("ninguna", "ninguno", "cero") else int(x)


def _resultado(texto: str) -> tuple[dict, str, str] | None:
    """El primer «votos emitidos, N; …» con cifras: los recuentos, el texto del resultado con lo que sigue («En
    consecuencia…») y lo que lo anuncia («El resultado de la votación de la enmienda… ha sido el siguiente»)."""
    m = re.search(r"votos\s*emitidos,?\s*(\d+)", texto, re.I)
    if not m:
        return None
    resto = re.sub(r"\([^)]*\)", " ", texto[m.start():m.start() + 900])   # fuera las acotaciones (protestas, aplausos)
    fin = re.search(r"En consecuencia|Al (?:no )?haber|Señorías|[Nn]o habiendo|Y ahora|\n", resto[len(m.group(0)):])
    cuenta = resto[:len(m.group(0)) + fin.start()] if fin else resto[:400]
    num = r",?\s*(\d+|ninguna|ninguno|cero)"
    si = re.search(rf"(?:a\s*favor|\bsí)(?:\s*del\s*candidato)?{num}", cuenta, re.I)
    no = re.search(rf"(?:en\s*contra|\bno)(?:\s*del\s*candidato)?{num}", cuenta, re.I)
    ab = re.search(rf"abstenci[oó]n(?:es)?{num}", cuenta, re.I)
    nu = re.search(r"(\d+|un|uno)\s*votos?\s*nulos?", cuenta, re.I)
    if not (si and no):
        return None
    r = {"emitidos": int(m.group(1)), "si": _numero(si.group(1)), "no": _numero(no.group(1)),
         "abst": _numero(ab.group(1)) if ab else 0,
         "nulos": (1 if nu.group(1).lower() in ("un", "uno") else int(nu.group(1))) if nu else 0}
    return r, resto[:len(cuenta) + 500], texto[max(0, m.start() - 300):m.start()]


def _aprobada(frase: str, si: int, no: int) -> bool:
    if re.search(r"no habiendo alcanzado|al no haberse (?:alcanzado|obtenido)|no ha obtenido|rechazad|derogad", frase, re.I):
        return False
    if re.search(r"otorgada la confianza|aprobad|convalidad|se toma en consideración|levantado el veto|ratificado", frase, re.I):
        return True
    return si > no


def _diputados_del_dia(fecha: str) -> list[list]:
    """[nombre, grupo, asiento] de la votación electrónica más cercana a `fecha` (antes, o la primera después)."""
    dias = sorted(VOTACIONES.glob("*.json"))
    antes = [f for f in dias if f.stem <= fecha][::-1]
    for f in antes + [f for f in dias if f.stem > fecha]:
        datos = json.loads(f.read_text())
        if isinstance(datos, dict) and any(not v.get("llamamiento") for v in datos["votaciones"]):
            return datos["diputados"]
    return []


def _titulo_iniciativa(item: str, exp: str | None) -> str:
    """El título de la iniciativa: el oficial de data/leyes.json si está; si no, el del orden del día."""
    leyes = DATOS / "leyes.json"
    if exp and leyes.exists():
        ini = next((i for i in json.loads(leyes.read_text()).get("iniciativas", []) if i.get("exp") == exp), None)
        if ini and ini.get("titulo"):
            return SERIE.get(exp[:3], "") + ini["titulo"].rstrip(".")
    t = re.sub(r"\s*\((?:B\.O\.E\.|Número de expediente)[^)]*\)\.?|\s*«BOCG[^»]*»\.?", "", item or "").strip().rstrip(".")
    if t.isupper():   # «PROPOSICIÓN DE REFORMA DEL ARTÍCULO 49 DE LA CONSTITUCIÓN ESPAÑOLA»
        t = t.lower().capitalize()
        for w in ("Constitución Española", "Constitución", "Cataluña", "Gobierno", "Senado", "Congreso", "Ley Orgánica",
                  "Cortes Generales"):
            t = re.sub(rf"\b{w}\b", w, t, flags=re.I)
    t = re.sub(r"Real Decreto[- ]Ley", "Real Decreto-ley", t, flags=re.I)
    return t


def _describir(ses: dict, iv: dict, intro: str, frase: str) -> tuple[str, str, str]:
    """tipo, título y subgrupo de la votación, según lo que anuncia y lo que proclama la Presidencia."""
    todo = f"{intro} {frase}"
    if re.search(r"candidato", frase, re.I):
        cand = next((x["orador"] for x in ses["intervenciones"] if re.search(r"candidat", x.get("cargo") or "", re.I)), None)
        nombre = next((d for d in _diputados_del_dia(ses["fecha"]) if cand and d[0].split(",")[0] == cand), None)
        quien = " ".join(reversed(nombre[0].split(", "))) if nombre else (cand or "")
        previas = sum(1 for f in sorted(SESIONES.glob("DSCD-*-PL-*.json"))   # votaciones de investidura anteriores
                      if "votos a favor del candidato" in (txt := f.read_text())
                      and ((s := json.loads(txt)).get("fecha") or "") < ses["fecha"]
                      and any(re.search(r"candidat", x.get("cargo") or "", re.I) and x["orador"] == cand
                              for x in s["intervenciones"]))
        vuelta = " (segunda votación)" if previas else ""
        return "Investidura", f"Investidura de {quien} como presidente del Gobierno{vuelta}.".replace("de  como", "como"), ""
    base = _titulo_iniciativa(iv.get("item") or "", iv.get("exp"))
    if re.search(r"enmienda a la totalidad", frase, re.I):
        clase = (re.search(r"enmienda a la totalidad de (texto alternativo|devolución)", todo, re.I) or [None, ""])[1]
        g = re.search(r"(?:ha presentado|presentad[oa] por|del) (?:el )?(Grupo (?:Parlamentario )?[A-ZÁÉÍÓÚ][\w()-]*)", todo)
        return ("Debates de totalidad de iniciativas legislativas",
                f"Enmienda a la totalidad{' de ' + clase if clase else ''}{' del ' + g.group(1) if g else ''} a la {base[:1].lower() + base[1:]}.", "")
    if re.search(r"veto del Senado", frase, re.I):
        return "Veto del Senado", base + ".", ""
    if re.search(r"se toma en consideración", frase, re.I):
        return "Toma en consideración de Proposiciones de Ley", base + ".", ""
    if re.search(r"reforma (?:del artículo|constitucional)", base, re.I):
        return "Proposición de reforma constitucional", base + ".", "Votación de conjunto"
    if re.search(r"(?:proposición|proyecto) de ley orgánica", frase, re.I):
        return "Dictámenes de Comisiones sobre iniciativas legislativas", base + ".", "Votación de conjunto"
    if base.startswith("Real Decreto"):
        return "Convalidación o derogación de Reales Decretos-leyes", base + ".", ""
    return "Votación pública por llamamiento", base + ".", ""


def de_sesion(ses: dict) -> list[dict]:
    """Las votaciones por llamamiento de una sesión, ya comprobadas, en el formato de votaciones.leer_votacion.
    `numero` va sin poner: lo decide actualizar() al juntarlas con las electrónicas del día."""
    ivs = ses.get("intervenciones", [])
    dips = _diputados_del_dia(ses["fecha"])
    if not dips:
        return []
    nombres = {_clave(d[0]): d[0] for d in dips}
    info = {d[0]: d for d in dips}
    salida = []
    for k, iv in enumerate(ivs):
        texto = iv.get("texto", "")
        cortes = [m for m in RE_LISTA.finditer(texto)]
        if not any(m.group(1) for m in cortes):
            continue
        votos: dict[str, str] = {}
        nulos, error = 0, ""
        for j, m in enumerate(cortes):
            lista, resto = _casar(texto[m.end():cortes[j + 1].start() if j + 1 < len(cortes) else len(texto)], nombres)
            if resto:
                error = resto
                break
            for n in lista:
                if m.group(1):
                    votos[n] = VOTO[m.group(1).lower()]
                elif m.group(3):   # votos nulos: cuentan como emitidos, pero no son ni sí, ni no, ni abstención
                    votos[n] = "X"
                    nulos += 1
        if error:
            print(f"  llamamiento {ses['id']} (turno {k}): no se reconoce «{error}»; no se guarda")
            continue
        tras = texto[cortes[-1].end():]
        res = next((r for t in [tras] + [x.get("texto", "") for x in ivs[k + 1:k + 6]] if (r := _resultado(t))), None)
        if not res:
            print(f"  llamamiento {ses['id']} (turno {k}): sin resultado leído por la Presidencia; no se guarda")
            continue
        r, frase, intro = res
        cuenta = {x: sum(1 for v in votos.values() if v == x) for x in "SNA"}
        if (cuenta["S"], cuenta["N"], cuenta["A"], nulos) != (r["si"], r["no"], r["abst"], r["nulos"]) or len(votos) != r["emitidos"]:
            print(f"  llamamiento {ses['id']} (turno {k}): {cuenta}+{nulos} nulos no cuadra con {r}; no se guarda")
            continue
        tipo, titulo, subgrupo = _describir(ses, iv, intro, frase)
        d, m_, a = (int(x) for x in reversed(ses["fecha"].split("-")))
        v = votaciones.leer_votacion({
            "informacion": {"sesion": ses["sesion"], "numeroVotacion": 0, "fecha": f"{d}/{m_}/{a}",
                            "titulo": tipo, "textoExpediente": titulo, "textoSubGrupo": subgrupo},
            "totales": {"asentimiento": "No", "presentes": r["emitidos"], "afavor": r["si"], "enContra": r["no"],
                        "abstenciones": r["abst"], "noVotan": len(dips) - r["emitidos"] + r["nulos"]},
            "votaciones": [{"diputado": n, "grupo": CODIGO_GRUPO.get(info[n][1], info[n][1]), "asiento": info[n][2] or "",
                            "voto": {"S": "Sí", "N": "No", "A": "Abstención"}.get(votos.get(n), "No vota")}
                           for n in info]}, ses.get("ds", ""))
        v["exp"] = iv.get("exp") or v["exp"]
        v["aprobada"] = _aprobada(frase, r["si"], r["no"])
        v["llamamiento"] = f"{ses['id']}#{k}"
        salida.append(v)
    return salida


def _palabras(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]{4,}", _norma(s)))


def _misma(e: dict, v: dict) -> bool:
    """¿Es `e` (de los datos abiertos) esta misma votación? Mismo asunto y, quien votó en `e`, votó igual."""
    pa, pb = _palabras(e["titulo"]), _palabras(v["titulo"])
    if not (e.get("exp") and e["exp"] == v.get("exp")) and len(pa & pb) / max(1, min(len(pa), len(pb))) < 0.6:
        return False
    nuevo = {d["diputado"]: d["voto"] for d in v["votos"]}
    return all(nuevo.get(d["diputado"]) == d["voto"] for d in e["votos"] if d["voto"] in "SNA")


def juntar(electronicas: list[dict], previas: list[dict], nuevas: list[dict]) -> list[dict]:
    """Las votaciones del día: las electrónicas y las de llamamiento, sin repetir ninguna y con ids estables."""
    salida = list(electronicas)
    previa = {v["llamamiento"]: v for v in previas if isinstance(v.get("llamamiento"), str)}
    for v in nuevas:
        sesion = [e for e in salida if e["sesion"] == v["sesion"] and not e.get("llamamiento")]
        if (p := previa.get(v["llamamiento"])) or (p := next((e for e in sesion if _misma(e, v)), None)):
            if not p.get("llamamiento") and (p["si"], p["no"], p["abst"]) == (v["si"], v["no"], v["abst"]):
                continue   # los datos abiertos ya la tienen completa
            # La de los datos abiertos, incompleta, o la que ya se guardó: mismo id y mismos títulos, votos del Diario.
            v = {**v, **{c: p[c] for c in ("id", "numero", "tipo", "titulo", "subgrupo") if p.get(c) is not None},
                 "exp": p.get("exp") or v.get("exp")}
            salida = [x for x in salida if x["id"] != v["id"]]
        else:
            n = max((x["numero"] or 0 for x in salida if x["sesion"] == v["sesion"]), default=0) + 1
            v = {**v, "id": f"{v['sesion']}-{n}", "numero": n}
        salida.append(v)
    return sorted(salida, key=lambda x: (x["sesion"] or 0, x["numero"] or 0))


def actualizar() -> list[dict]:
    """Repasa los plenos guardados y deja sus votaciones por llamamiento en el fichero de su día."""
    todas = []
    for f in sorted(SESIONES.glob("DSCD-*-PL-*.json")):
        ses = json.loads(f.read_text())
        if "«sí»" not in json.dumps(ses, ensure_ascii=False):
            continue
        nuevas = de_sesion(ses)
        if not nuevas:
            continue
        dia = VOTACIONES / f"{ses['fecha']}.json"
        hoy = votaciones.leer_dia(dia) if dia.exists() else []
        juntas = juntar([v for v in hoy if not v.get("llamamiento")], [v for v in hoy if v.get("llamamiento")], nuevas)
        votaciones.guardar_dia(ses["fecha"], juntas)
        todas += [v for v in juntas if v.get("llamamiento")]
    return todas


if __name__ == "__main__":
    for v in actualizar():
        print(f"{v['id']:7} · {v['fecha']} · {v['si']}-{v['no']}-{v['abst']} · {'aprobada' if v['aprobada'] else 'rechazada'}"
              f" · {v['tipo'][:30]} · {v['titulo'][:90]}")
