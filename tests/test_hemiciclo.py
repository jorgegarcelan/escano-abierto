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
