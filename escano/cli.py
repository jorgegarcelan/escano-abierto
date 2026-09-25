"""Línea de órdenes.

    python -m escano actualizar                 # últimos 10 días de votaciones + Diarios nuevos + web
    python -m escano actualizar --desde 2026-09-01 --sin-ia
    python -m escano diario PL 205              # (re)procesa un Diario concreto
    python -m escano construir                  # solo regenera site/data.json
"""
from __future__ import annotations

import argparse
from datetime import date, timedelta

from . import diario, diputados, votaciones
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

    mapa = votaciones.mapa_diputados()
    estado = diario.leer_estado()
    for serie in ("PL", "CO"):
        print(f"· Diarios de la serie {serie} desde el nº {estado[serie] + 1}")
        for numero, ruta in diario.nuevos_diarios(serie, estado[serie] + 1):
            ses = diario.procesar_diario(ruta, serie, numero, mapa)
            print(f"  {ses['id']}: {ses['fecha']} · {ses['organo']} · {len(ses['intervenciones'])} turnos")
            estado[serie] = max(estado[serie], numero)
    diario.guardar_estado(estado)

    print("· Construyendo site/data.json" + (" (sin IA)" if not con_ia else ""))
    datos = construir(con_ia=con_ia)
    print(f"  {len(datos['datos']['sesiones'])} sesiones, {len(datos['intervenciones'])} intervenciones analizadas, "
          f"{len(datos['datos']['votaciones'])} votaciones")


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

    c = sub.add_parser("construir", help="regenera site/data.json con lo ya descargado")
    c.add_argument("--sin-ia", action="store_true")

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
