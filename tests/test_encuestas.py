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
