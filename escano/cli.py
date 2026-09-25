"""Línea de órdenes.

    python -m escano actualizar                 # últimos 10 días de votaciones + Diarios nuevos + web
    python -m escano actualizar --desde 2026-09-01 --sin-ia
    python -m escano diario PL 205              # (re)procesa un Diario concreto
    python -m escano construir                  # solo regenera la web con lo ya descargado
    python -m escano reprocesar                 # rehace sesiones y votaciones desde los ficheros descargados, sin red
    python -m escano calidad                    # indicadores del parser por sesión
    python -m escano agenda                     # solo el orden del día de los próximos plenos
    python -m escano preguntas [--completo]     # preguntas escritas al Gobierno (la primera vez, --completo)
"""
from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor
from datetime import date, timedelta

import json

from . import agenda, calidad, diario, diputados, hemiciclo, intereses, leyes, organos, preguntas, votaciones
from .config import CRUDOS, VOTACIONES
from .construir import construir


def _fechas(desde: date, hasta: date):
    d = desde
    while d <= hasta:
        if d.weekday() < 5:  # el Pleno se reúne de martes a jueves; las comisiones, de lunes a viernes
            yield d
        d += timedelta(days=1)


def actualizar(desde: date, hasta: date, con_ia: bool) -> None:
    print(f"· Votaciones del {desde} al {hasta}")
    for d in _fechas(desde, hasta):
        n = len(votaciones.actualizar_dia(d))
        if n:
            print(f"  {d}: {n} votaciones")

    print(f"· Diputados en activo: {len(diputados.actualizar())}")
    print(f"· Plano del hemiciclo: {len(hemiciclo.actualizar()['escanos'])} escaños")
    print(f"· Comisiones: {len(organos.actualizar())}")
    print(f"· Iniciativas legislativas: {len(leyes.actualizar()['iniciativas'])}")
    print(f"· Declaraciones de intereses: {len(intereses.actualizar())} diputados")
    pr = preguntas.actualizar()["preguntas"]
    print(f"· Preguntas escritas: {len(pr)}, {sum(p['estado'] == 'pendiente' for p in pr)} sin contestar")
    ag = agenda.actualizar()
    print(f"· Agenda: {len(ag['plenos'])} plenos convocados, {len(ag['comisiones'])} sesiones de comisión")

    mapa = votaciones.mapa_diputados()
    estado = diario.leer_estado()
    for serie in ("PL", "CO"):
        print(f"· Diarios de la serie {serie} desde el nº {estado[serie] + 1}")
        for numero, ruta in diario.nuevos_diarios(serie, estado[serie] + 1):
            ses = diario.procesar_diario(ruta, serie, numero, mapa)
            print(f"  {ses['id']}: {ses['fecha']} · {ses['organo']} · {len(ses['intervenciones'])} turnos")
            estado[serie] = max(estado[serie], numero)
    diario.guardar_estado(estado)

    print("· Construyendo la web" + (" (sin IA)" if not con_ia else ""))
    datos = construir(con_ia=con_ia)
    print(f"  {len(datos['datos']['sesiones'])} sesiones, {len(datos['intervenciones'])} intervenciones analizadas, "
          f"{len(datos['datos']['votaciones'])} votaciones")


def reprocesar(con_ia: bool) -> None:
    """Vuelve a procesar los Diarios y las votaciones ya descargados (data/raw), sin pedir nada a la red.

    Úsalo después de cambiar el parser.
    """
    print("· Votaciones")
    for f in sorted(VOTACIONES.glob("*.json")):
        nuevas = []
        for v in votaciones.leer_dia(f):
            crudo = descargar_cache(v.get("json", ""))
            nuevas.append(votaciones.leer_votacion(json.loads(crudo.decode("utf-8-sig")), v["json"]) if crudo else v)
        votaciones.guardar_dia(f.stem, nuevas)
        print(f"  {f.stem}: {len(nuevas)}")
    mapa = votaciones.mapa_diputados()
    print("· Diarios")
    rutas = sorted(CRUDOS.glob(f"DSCD-{diario.LEGISLATURA}-*.pdf"))
    # Cada Diario es independiente: se procesan en paralelo (pdftotext es lo que más tarda).
    with ProcessPoolExecutor() as ex:
        for ses in ex.map(_procesar, rutas, [mapa] * len(rutas), chunksize=4):
            if ses:
                print(f"  {ses['id']}: {ses['fecha']} · {ses['organo']} · {len(ses['intervenciones'])} turnos")
    print("· Construyendo la web" + (" (sin IA)" if not con_ia else ""))
    construir(con_ia=con_ia)
    calidad.imprimir(calidad.informe())


def _procesar(ruta, mapa):
    _, _, serie, numero = ruta.stem.split("-")
    try:
        return diario.procesar_diario(ruta, serie, int(numero), mapa)
    except Exception as e:  # un PDF raro no debe parar la legislatura entera
        print(f"  {ruta.name}: no se pudo procesar ({e})")
        return None


def descargar_cache(url: str) -> bytes | None:
    """El fichero de `url` si ya está en data/raw; nunca va a la red."""
    import hashlib
    if not url:
        return None
    nombre = url.rstrip("/").split("/")[-1].split("?")[0] or "index"
    ruta = CRUDOS / f"{hashlib.sha1(url.encode()).hexdigest()[:10]}-{nombre}"
    return ruta.read_bytes() if ruta.exists() else None


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="escano", description="Escaño Abierto")
    sub = p.add_subparsers(dest="orden", required=True)

    a = sub.add_parser("actualizar", help="descarga datos nuevos y regenera la web")
    a.add_argument("--desde", type=date.fromisoformat, default=date.today() - timedelta(days=10))
    a.add_argument("--hasta", type=date.fromisoformat, default=date.today())
    a.add_argument("--sin-ia", action="store_true", help="no llama a la API de Claude")

    d = sub.add_parser("diario", help="procesa un Diario de Sesiones concreto")
    d.add_argument("serie", choices=["PL", "CO"])
    d.add_argument("numero", type=int)

    c = sub.add_parser("construir", help="regenera los datos de la web con lo ya descargado")
    c.add_argument("--sin-ia", action="store_true")

    r = sub.add_parser("reprocesar", help="rehace sesiones y votaciones con lo ya descargado, sin red")
    r.add_argument("--sin-ia", action="store_true")

    sub.add_parser("calidad", help="indicadores del parser por sesión")
    pq = sub.add_parser("preguntas", help="descarga las preguntas escritas al Gobierno")
    pq.add_argument("--completo", action="store_true", help="recorre toda la legislatura, no solo lo nuevo")
    sub.add_parser("agenda", help="descarga el orden del día de los próximos plenos y la tramitación de leyes")

    args = p.parse_args(argv)
    if args.orden == "actualizar":
        actualizar(args.desde, args.hasta, not args.sin_ia)
    elif args.orden == "diario":
        from .config import CRUDOS
        from .red import descargar
        ruta = CRUDOS / f"DSCD-{diario.LEGISLATURA}-{args.serie}-{args.numero}.pdf"
        if descargar(diario.url_diario(args.serie, args.numero), ruta) is None:
            raise SystemExit("Ese Diario no está publicado.")
        ses = diario.procesar_diario(ruta, args.serie, args.numero, votaciones.mapa_diputados())
        print(f"{ses['id']}: {ses['fecha']} · {len(ses['intervenciones'])} turnos")
    elif args.orden == "construir":
        construir(con_ia=not args.sin_ia)
    elif args.orden == "reprocesar":
        reprocesar(con_ia=not args.sin_ia)
    elif args.orden == "preguntas":
        pr = preguntas.actualizar(completo=args.completo)["preguntas"]
        print(f"{len(pr)} preguntas, {sum(p['estado'] == 'pendiente' for p in pr)} sin contestar")
    elif args.orden == "agenda":
        ag = agenda.actualizar()
        print(f"{len(ag['plenos'])} plenos convocados, {len(ag['comisiones'])} sesiones de comisión, "
              f"{len(leyes.actualizar()['iniciativas'])} iniciativas legislativas")
    elif args.orden == "calidad":
        raise SystemExit(1 if calidad.imprimir(calidad.informe()) else 0)
