"""Plano del hemiciclo desde la página oficial (fragmento real)."""
from pathlib import Path

from escano.hemiciclo import leer_plano


def test_leer_plano():
    p = leer_plano((Path(__file__).parent / "fixtures" / "hemiciclo_muestra.html").read_text())
    assert p["escanos"]["Armengol Socias, Francina"] == {"x": 270, "y": 382, "codigo": 185}
    assert p["escanos"]["Sánchez Pérez-Castejón, Pedro"]["x"] == 190          # la bancada socialista, a la izquierda
    ministro = p["gobierno"][0]                                                # no es diputado: no vota
    assert ministro["nombre"] == "Cuerpo Caballero, Carlos" and "Ministro de Economía" in ministro["cargo"]
    assert "Cuerpo Caballero, Carlos" not in p["escanos"]


def test_composicion_de_comision():
    import json
    from escano.organos import leer_composicion
    m = leer_composicion(json.loads((Path(__file__).parent / "fixtures" / "comision_muestra.json").read_text()))
    assert m[0]["nombre"] == "Ruiz Boix, Juan Carlos" and m[0]["cargo"] == "Presidente"
    assert m[0]["codigo"] == 68 and m[0]["siglas"] == "GS" and m[0]["baja"] == ""
