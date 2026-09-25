"""Fragmentos reales de Diarios de Sesiones (pdftotext -raw) con los casos que ya rompieron el parser."""
from pathlib import Path

from escano import calidad
from escano.diario import cabecera, dividir, rotulos

F = Path(__file__).parent / "fixtures" / "diarios"
MAPA = {"nunez feijoo": "PP", "alvarez de toledo peralta-ramos": "PP", "tomas olivares": "PP"}


def leer(nombre: str) -> str:
    return (F / nombre).read_text()


def test_salto_de_pagina_no_mezcla_turnos():
    ivs = dividir(leer("pl205_salto_de_pagina.raw.txt"), MAPA)
    assert [(i.orador, i.grupo) for i in ivs[:3]] == [
        ("Núñez Feijóo", "PP"), ("Presidenta", "MESA"), ("Sánchez Pérez-Castejón", "GOB")]
    sanchez = ivs[2]
    # El discurso sigue tras el salto de página, sin la cabecera del Diario en medio.
    assert "Señor Feijóo, vamos a ver" in sanchez.texto and "No como ustedes hacen cuando salen a Bruselas" in sanchez.texto
    assert "DIARIO DE SESIONES" not in sanchez.texto and "Pág." not in sanchez.texto
    # Los aplausos a la pregunta van al turno de Feijóo, no al de la Presidencia.
    assert ivs[0].reacciones.get("aplausos") == 1 and not ivs[1].reacciones


def test_apellido_con_guion_tipografico_y_seccion():
    ivs = dividir(leer("pl203_seccion.raw.txt"), MAPA,
                  titulos={"162/000833": "DEL GRUPO PARLAMENTARIO POPULAR EN EL CONGRESO, PARA UNA RESPUESTA DE ESTADO "
                                         "ANTE LA CRISIS DE SEGURIDAD NACIONAL EN CEUTA. (Número de expediente 162/000833)."})
    toledo = next(i for i in ivs if "Toledo" in i.orador)
    assert toledo.orador == "Álvarez de Toledo Peralta-Ramos" and toledo.grupo == "PP"
    assert toledo.seccion == "PROPOSICIONES NO DE LEY"                   # sección terminada en dos puntos
    assert toledo.exp == "162/000833" and "RESPUESTA DE ESTADO ANTE" in toledo.item   # encabezado sin palabras pegadas
    assert toledo.reacciones.get("rumores") == 1


def test_cargo_con_cifras():
    ivs = dividir(leer("pl205_cargo_con_cifras.raw.txt"), MAPA)
    ministro = ivs[-1]
    assert ministro.orador == "Bustinduy Amador" and ministro.grupo == "GOB"
    assert ministro.cargo == "Ministro de Derechos Sociales, Consumo y Agenda 2030"
    assert ivs[-2].grupo == "MESA" and len(ivs[-2].texto) < 200


def test_orador_pegado_se_recupera_del_modo_normal():
    raw, normal = leer("co616_orador_pegado.raw.txt"), leer("co616_orador_pegado.normal.txt")
    sin = dividir(raw, {}, es_comision=True)
    con = dividir(raw, {}, es_comision=True, nombres=rotulos(normal))
    assert len(con) == len(sin)
    director = [i for i in con if i.grupo == "COMP"]
    assert director and director[0].orador.startswith("Director de la Organización Cecu")
    assert director[0].cargo == "Sánchez Carpio"


def test_portada_de_comision():
    c = cabecera(leer("co611_portada.txt"), "CO")
    assert c == {"fecha": "2026-08-28", "sesion": 26, "organo": "Comisión de Interior"}


def test_indicadores_de_calidad():
    ses = {"id": "x", "intervenciones": [
        {"grupo": "PP", "orador": "A", "item": None, "texto": "Hola. (Aplausos).", "reacciones": {"aplausos": 1}},
        {"grupo": "MESA", "orador": "Presidenta", "item": None, "texto": "x" * 3000, "reacciones": {}},
        {"grupo": "?", "orador": "Desconocido", "item": None, "texto": "palabraextremadamentelargaypegada ok", "reacciones": {}}]}
    f = calidad.indicadores(ses)
    assert f["oradores_sin_grupo"] == 1 / 3 and f["mesa_larga"] == 1 / 3 and f["aplausos_en_mesa"] == 0
    assert f["sin_grupo"] == ["Desconocido"]
    assert calidad.avisos(f)
