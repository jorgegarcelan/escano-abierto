from pathlib import Path

from escano.diario import cabecera, dividir

TEXTO = (Path(__file__).parent / "fixtures" / "diario_muestra.txt").read_text()
MAPA = {"nunez feijoo": "PP", "nogueras i camero": "JUNTS", "belarra urteaga": "MIXTO"}


def test_cabecera():
    c = cabecera(TEXTO)
    assert c["fecha"] == "2026-09-16"
    assert c["sesion"] == 198
    assert c["organo"] == "Pleno"


def test_turnos_y_grupos():
    ivs = dividir(TEXTO, MAPA)
    quien = [(i.orador, i.grupo) for i in ivs]
    assert ("Núñez Feijóo", "PP") in quien
    assert ("Sánchez Pérez-Castejón", "GOB") in quien
    assert ("Cuerpo Caballero", "GOB") in quien          # cargo partido en dos líneas
    assert ("Navarro Garzón", "MESA") in quien           # vicepresidenta de la Cámara, no del Gobierno
    assert ("Nogueras i Camero", "JUNTS") in quien
    assert ("Belarra", "MIXTO") in quien                 # un solo apellido
    assert all(i.orador != "Presidenta" or i.grupo == "MESA" for i in ivs)


def test_sumario_excluido_y_ruido_eliminado():
    ivs = dividir(TEXTO, MAPA)
    feijoo = next(i for i in ivs if i.orador == "Núñez Feijóo")
    assert "Pág." not in feijoo.texto and "cve:" not in feijoo.texto
    assert "España en el mundo" in feijoo.texto          # palabra partida por guion reconstruida


def test_asuntos_expedientes_y_reacciones():
    ivs = dividir(TEXTO, MAPA)
    feijoo = next(i for i in ivs if i.orador == "Núñez Feijóo")
    assert feijoo.exp == "180/001158"
    assert feijoo.seccion == "PREGUNTAS"
    assert feijoo.reacciones == {"aplausos": 1}
    sanchez = next(i for i in ivs if i.grupo == "GOB")
    assert sanchez.reacciones == {"aplausos": 1, "rumores": 1}
    nogueras = next(i for i in ivs if i.orador == "Nogueras i Camero")
    assert nogueras.exp == "180/001153"
    assert "Número de expediente" not in feijoo.texto
