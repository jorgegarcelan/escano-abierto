"""Home provisional («muy pronto») mientras la web completa no se abre al público.

Con ESCANO_MODO=teaser, scripts/vercel-build.sh publica esto en lugar de la web: una sola página con el
vídeo de presentación, el hemiciclo real (los 350 escaños con su sitio y el voto nominal de una selección de
votaciones) y cifras de la legislatura, todo sacado de site/datos (versionado), y en /quien-lo-dijo/ el juego completo, como adelanto de la web. Solo usa la biblioteca estándar. Las URLs que no existen (/votacion/…, /diputado/…) caen en la misma página (404.html).

    python -m escano.teaser                 # escribe dist-teaser/
    python -m escano.teaser --salida DIR
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

RAIZ = Path(__file__).resolve().parent.parent
SITIO = RAIZ / "site"
FUENTE = RAIZ / "teaser"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]
MESES_CORTOS = [m[:3] for m in MESES]
AMPLIACIONES_CONGELADOR = 8  # el mismo umbral que «El congelador» en la web
DESCRIPCION = "¿Quién votó qué? Muy pronto, el Congreso de los Diputados explicado con sus propios datos."
DESCRIPCION_JUEGO = ("Diez frases literales del Congreso cada día. ¿Sabes de qué grupo es quien habla, y quién es? "
                     "El juego de Escaño Abierto, como adelanto de la web.")
N_MONTAJE = 14  # votaciones que pasan por el hemiciclo de la portada
N_CINTA = 28    # votaciones de la cinta
N_DOCS = 36     # nombres de fichero que flotan en «miles de PDF»
# Frases de trámite (cómo se vota, enmiendas, turnos): son literales, pero no enganchan como muestra en la portada.
TRAMITE = re.compile(r"\bvot(o|a|ar|amos|aremos|ará|aría|ado)\b|enmienda|tramitaci|proposición|moción|iniciativa|señor presidente|"
                     r"señora presidenta|muchas gracias|\bturno\b|\bdictamen", re.I)
# Los grupos del juego (los mismos que en la web) y su nombre corto para la muestra de la portada.
GRUPOS_JUEGO = {"PSOE": "PSOE", "PP": "PP", "VOX": "VOX", "SUMAR": "Sumar", "ERC": "ERC", "JUNTS": "Junts",
                "BILDU": "EH Bildu", "PNV": "PNV", "GOB": "Gobierno"}


def _url_sitio() -> str:
    url = os.environ.get("ESCANO_URL_SITIO") or (
        f"https://{os.environ['VERCEL_PROJECT_PRODUCTION_URL']}" if os.environ.get("VERCEL_PROJECT_PRODUCTION_URL") else "")
    # Las redes piden la imagen a esta URL: el dominio con ñ va en punycode (xn--…).
    partes = urlsplit(url.rstrip("/"))
    return partes._replace(netloc=partes.netloc.encode("idna").decode()).geturl() if partes.netloc else ""


def _numero(n: int) -> str:
    # Norma del español: sin separador hasta cuatro cifras (2152), con punto desde cinco (12.345).
    return f"{n:,}".replace(",", ".") if n >= 10000 else str(n)


def cifras() -> dict:
    indice = json.loads((SITIO / "datos" / "indice.json").read_text())
    leyes = json.loads((SITIO / "datos" / "leyes.json").read_text())["iniciativas"]
    hasta = date.fromisoformat(indice["meta"]["periodo"].split("–")[-1].strip())
    return {
        "votaciones": sum(m["votaciones"] for m in indice["meses"]),
        "congelador": sum(1 for i in leyes if i["estado"] == "en trámite" and i.get("ampliaciones", 0) >= AMPLIACIONES_CONGELADOR),
        "aprobadas": sum(1 for i in leyes if i["estado"] == "aprobada"),
        "iniciativas": len(leyes),
        "fecha": f"{hasta.day} de {MESES[hasta.month - 1]} de {hasta.year}",
    }


def _fecha_corta(iso: str) -> str:
    a, m, d = iso.split("-")
    return f"{int(d)} {MESES_CORTOS[int(m) - 1]} {a}"


def _nombre(apellidos_nombre: str) -> str:
    apellidos, _, nombre = apellidos_nombre.partition(", ")
    return f"{nombre} {apellidos}".strip()


def escena() -> dict:
    """Lo que anima la portada. Los escaños son los de los 350 diputados actuales, con su sitio en el plano. Cada
    votación lleva una letra por escaño (S, N, A, X no vota, - vacío) según quién lo ocupaba ese día. Se eligen
    con una regla fija, igual para todos: repartidas a lo largo de la legislatura y la última al final."""
    indice = json.loads((SITIO / "datos" / "indice.json").read_text())
    dips = indice["diputados"]
    actuales = [d for d in dips if d[5] is not None and not (len(d) > 8 and d[8])]
    escanos = [[d[5], d[6], _nombre(d[0]), d[3]] for d in actuales]
    nominales = []
    for f in sorted((SITIO / "datos").glob("20[0-9][0-9]-[0-9][0-9].json")):
        nominales += [v for v in json.loads(f.read_text())["votaciones"] if len(v.get("v") or "") == len(dips)]
    nominales.sort(key=lambda v: (v["fecha"], [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", v["id"])]))

    def resumen(v: dict) -> dict:
        return {"t": v["titulo"], "f": _fecha_corta(v["fecha"]), "si": v["si"], "no": v["no"], "abst": v["abst"]}

    def por_escano(v: dict) -> str:
        sitio = {(d[5], d[6]): v["v"][i] for i, d in enumerate(dips) if d[5] is not None and v["v"][i] != "-"}
        return "".join(sitio.get((e[0], e[1]), "-") for e in escanos)

    # Nombres de documentos reales (Diarios de Sesiones y ficheros de votación) para la escena «miles de PDF».
    diarios, ficheros = set(), set()
    for f in sorted((SITIO / "datos").glob("20[0-9][0-9]-[0-9][0-9].json"))[-3:]:
        mes = json.loads(f.read_text())
        diarios |= {s["dsNombre"] + ".PDF" for s in mes["sesiones"] if s.get("dsNombre")}
        ficheros |= {v["json"].rsplit("/", 1)[-1] for v in mes["votaciones"] if v.get("json")}
    mitad = N_DOCS // 2
    docs = [x for par in zip(sorted(diarios)[-mitad:], sorted(ficheros)[-mitad:]) for x in par]
    montaje, vistos = [], set()
    if nominales:
        paso = max(1, (len(nominales) - 1) // (N_MONTAJE - 1))
        for v in nominales[::paso][:N_MONTAJE - 1] + [nominales[-1]]:
            if v["titulo"] not in vistos:
                vistos.add(v["titulo"])
                montaje.append({**resumen(v), "v": por_escano(v)})
    cinta, vistos = [], set()
    for v in reversed(nominales):
        if v["titulo"] not in vistos:
            vistos.add(v["titulo"])
            cinta.append(resumen(v))
        if len(cinta) == N_CINTA:
            break
    plano = indice["hemiciclo"]
    return {"plano": [plano["ancho"], plano["alto"]], "escanos": escanos, "montaje": montaje, "cinta": cinta,
            "docs": docs}


def _sin_tildes(t: str) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn").lower().strip()


def _citas() -> list:
    ruta = SITIO / "datos" / "explora-citas.json"
    return json.loads(ruta.read_text()) if ruta.exists() else []


def datos_juego(citas: list) -> dict:
    """Lo que el juego necesita además de las citas: el nombre y el color de cada grupo, y el nombre completo y la
    foto oficial de cada orador cuando sus apellidos identifican a un solo diputado (como en la web)."""
    indice = json.loads((SITIO / "datos" / "indice.json").read_text())
    por_apellidos: dict[str, list] = {}
    for d in indice["diputados"]:
        por_apellidos.setdefault(_sin_tildes(d[0].partition(", ")[0]), []).append(d)
    oradores = {}
    for o in {c[1] for c in citas}:
        ds = por_apellidos.get(_sin_tildes(o), [])
        if len(ds) == 1:
            oradores[o] = [_nombre(ds[0][0]), ds[0][7] if len(ds[0]) > 7 else None]
    grupos = {g: [indice["grupos"].get(g, {}).get("nombre", g), indice["grupos"].get(g, {}).get("color", "#8A8F98")]
              for g in GRUPOS_JUEGO}
    return {"grupos": grupos, "oradores": oradores}


def muestra(citas: list, grupos: dict, hoy: date | None = None) -> dict | None:
    """Una frase para invitar al juego desde la portada, con su grupo y otros tres. Cambia cada día y deja fuera
    las de trámite (cómo se vota, enmiendas…), que son literales pero no enganchan. Si el reto de hoy es especial
    (vivienda…), es su primera frase, con sus cuatro opciones."""
    import random
    hoy = hoy or date.today()
    ruta = SITIO / "datos" / "explora-retos.json"
    especial = json.loads(ruta.read_text()).get(hoy.isoformat()) if ruta.exists() else None
    if isinstance(especial, dict) and especial.get("rondas"):
        r = especial["rondas"][0]
        return {"cita": r["c"][0], "grupos": [[GRUPOS_JUEGO[g], grupos[g][1]] for g in r["grupos"]], "tema": especial["nombre"]}
    buenas = [c for c in citas if c[2] in grupos and 80 <= len(c[0]) <= 170 and not TRAMITE.search(c[0])]
    if not buenas:
        return None
    az = random.Random(hoy.toordinal())
    cita = buenas[az.randrange(len(buenas))]
    elegidos = [cita[2], *az.sample([g for g in grupos if g != cita[2]], 3)]
    az.shuffle(elegidos)
    return {"cita": cita[0], "grupos": [[GRUPOS_JUEGO[g], grupos[g][1]] for g in elegidos]}


def _simbolo() -> str:
    """Los escaños del favicon de la marca, sin el fondo, para la cabecera."""
    svg = (SITIO / "marcas" / "marcador-favicon.svg").read_text()
    return "".join(re.findall(r"<circle[^>]*/>", svg))


def construir(salida: Path) -> dict:
    c = cifras()
    citas = _citas()
    juego_datos = datos_juego(citas)
    html = (FUENTE / "index.html").read_text()
    for clave, valor in {
        "URL": _url_sitio(), "DESCRIPCION": DESCRIPCION, "SIMBOLO": _simbolo(), "FECHA": c["fecha"],
        "VOTACIONES": str(c["votaciones"]), "VOTACIONES_TXT": _numero(c["votaciones"]),
        "CONGELADOR": str(c["congelador"]), "CONGELADOR_TXT": _numero(c["congelador"]),
        "APROBADAS": str(c["aprobadas"]), "APROBADAS_TXT": _numero(c["aprobadas"]),
        "INICIATIVAS_TXT": _numero(c["iniciativas"]), "INICIATIVAS": str(c["iniciativas"]),
        # Dentro de <script>: «</» cortaría el bloque.
        "ESCENA": json.dumps({**escena(), "cifras": c, "muestra": muestra(citas, juego_datos["grupos"])}, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"),
    }.items():
        html = html.replace("{{" + clave + "}}", valor)
    if "{{" in html:
        raise SystemExit(f"teaser: marcador sin rellenar: {re.search(r'{{[^}]*}}', html).group(0)}")

    aviso = (FUENTE / "aviso-legal.html").read_text().replace("{{URL}}", _url_sitio()).replace("{{SIMBOLO}}", _simbolo())
    if "{{" in aviso:
        raise SystemExit("teaser: marcador sin rellenar en aviso-legal.html")

    # El juego, en su propia página (la misma dirección que tendrá en la web completa).
    juego = (FUENTE / "quien-lo-dijo.html").read_text()
    for clave, valor in {"URL": _url_sitio(), "SIMBOLO": _simbolo(), "DESCRIPCION_JUEGO": DESCRIPCION_JUEGO,
                         "DATOS": json.dumps(juego_datos, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")}.items():
        juego = juego.replace("{{" + clave + "}}", valor)
    if "{{" in juego:
        raise SystemExit("teaser: marcador sin rellenar en quien-lo-dijo.html")

    if salida.exists():
        shutil.rmtree(salida)
    (salida / "aviso-legal").mkdir(parents=True)
    (salida / "quien-lo-dijo").mkdir()
    (salida / "quien-lo-dijo" / "index.html").write_text(juego)
    # Las citas, en la misma ruta que en la web: el reto del día sale igual en las dos.
    (salida / "datos").mkdir()
    for nombre in ("explora-citas.json", "explora-retos.json"):
        if (SITIO / "datos" / nombre).exists():
            shutil.copy2(SITIO / "datos" / nombre, salida / "datos" / nombre)
    (salida / "index.html").write_text(html)
    (salida / "404.html").write_text(html)
    (salida / "aviso-legal" / "index.html").write_text(aviso)
    for nombre in ("teaser.mp4", "poster.jpg", "og.png", "og-quien-lo-dijo.png"):
        shutil.copy2(FUENTE / nombre, salida / nombre)
    shutil.copy2(SITIO / "marcas" / "marcador-favicon.svg", salida / "favicon.svg")
    (salida / "robots.txt").write_text("User-agent: *\nAllow: /\n")
    return c


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="escano.teaser", description="Home provisional de Escaño Abierto")
    p.add_argument("--salida", type=Path, default=RAIZ / "dist-teaser")
    a = p.parse_args(argv)
    c = construir(a.salida)
    print(f"Teaser en {a.salida}: {c['votaciones']} votaciones · {c['congelador']} en el congelador · "
          f"{c['aprobadas']}/{c['iniciativas']} aprobadas · datos hasta el {c['fecha']}")


if __name__ == "__main__":
    main()
