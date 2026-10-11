from datetime import date, datetime

from escano import encuestas as en


def test_fechas_del_trabajo_de_campo():
    assert en._fechas("7–8 Oct", 2026) == ("2026-10-07", "2026-10-08")
    assert en._fechas("29 Dec–5 Jan", 2026) == ("2025-12-29", "2026-01-05")   # empieza el año anterior
    assert en._fechas("31 Dec", 2025) == ("2025-12-31", "2025-12-31")
    assert en._fechas("26 Sep–3 Oct", 2026) == ("2026-09-26", "2026-10-03")
    assert en._fechas("?", 2026) == (None, None)


def test_celda_de_partido():
    assert en._celda_partido("31.9 123/140") == (31.9, [123, 140])
    assert en._celda_partido("30.4 130") == (30.4, [130, 130])
    assert en._celda_partido("? 8") == (None, [8, 8])
    assert en._celda_partido("–") == (None, None)


def test_media_ultima_de_cada_empresa_sin_cis():
    encuestas = [
        {"empresa": "A", "fin": "2026-10-01", "n": 1000, "v": {"PP": 30.0}},
        {"empresa": "A", "fin": "2026-09-01", "n": 1000, "v": {"PP": 50.0}},   # la vieja de A no cuenta
        {"empresa": "B", "fin": "2026-10-01", "n": 1000, "v": {"PP": 34.0}},
        {"empresa": "CIS", "fin": "2026-10-01", "n": 4000, "v": {"PP": 20.0}, "cis": True},
        {"empresa": "KeyData", "fin": "2026-10-01", "n": 1000, "v": {"PP": 90.0}, "agregador": True},
    ]
    m = en.media(encuestas, date(2026, 10, 1), desde=date(2026, 10, 1))
    assert m["dias"] == ["2026-10-01"]
    assert m["partidos"]["PP"]["m"] == [32.0]
    assert m["partidos"]["PP"]["s"] == [2.0]


def test_veda_del_24_al_29_a_las_20():
    assert not en.en_veda(datetime(2026, 11, 23, 23, 59))
    assert en.en_veda(datetime(2026, 11, 24, 0, 1))
    assert en.en_veda(datetime(2026, 11, 29, 19, 59))
    assert not en.en_veda(datetime(2026, 11, 29, 20, 0))


def test_proyeccion_reproduce_2023():
    """Con el resultado de 2023 como «media» y los escaños de 2023, el modelo devuelve el Congreso de 2023."""
    import json
    from escano import proyeccion as pr
    from escano.config import DATOS
    base = pr.base_2023()
    D = json.loads((DATOS / "elecciones" / "historico-202307.json").read_text())
    _, tot = pr.proyectar({p: v for p, v in base["nacional"].items() if p != "OTROS"}, base, escanos={c: p["e"] for c, p in D["prov"].items()})
    assert tot == {"PP": 137, "PSOE": 121, "VOX": 33, "SUMAR": 31, "ERC": 7, "JUNTS": 7, "BILDU": 6, "PNV": 5, "BNG": 1, "UPN": 1, "CC": 1}


def test_dhondt_y_barrera():
    from escano import proyeccion as pr
    assert pr.dhondt({"A": .40, "B": .30, "C": .20, "D": .025}, 5) == {"A": 2, "B": 2, "C": 1}


def test_opciones_de_polymarket_en_castellano():
    assert en._opcion_es("December 31, 2026") == "31 de diciembre de 2026"
    assert en._opcion_es("Alberto Núñez Feijóo") == "Alberto Núñez Feijóo"
    assert en._opcion_es("PP") == "PP"
