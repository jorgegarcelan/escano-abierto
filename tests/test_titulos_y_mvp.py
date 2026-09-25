"""Títulos de votación sin IA, nombre de las comisiones y relleno con el análisis del MVP."""
import json

from escano import construir as mod_construir
from escano.construir import completar_con_mvp, titulo_votacion
from escano.diario import cabecera


def test_titulo_votacion():
    assert titulo_votacion("Moción consecuencia de interpelación urgente del Grupo Parlamentario Popular en el "
                           "Congreso, sobre la crisis que atraviesa la Ciudad Autónoma de Ceuta.") \
        == "Crisis que atraviesa la Ciudad Autónoma de Ceuta"
    assert titulo_votacion("Real Decreto-ley 21/2026, de 25 de agosto, de transparencia e integridad de las "
                           "actividades de los grupos de interés.") \
        == "RDL 21/2026 de transparencia e integridad de las actividades de los grupos de interés"
    assert titulo_votacion("Proposición de Ley del Grupo Parlamentario Plurinacional SUMAR, de medidas urgentes "
                           "para prohibir la compra especulativa de vivienda.") \
        == "Medidas urgentes para prohibir la compra especulativa de vivienda"
    assert titulo_votacion("Moción del Grupo Parlamentario Mixto, relativa a los planes del Gobierno.", "Punto 1") \
        == "Planes del Gobierno (punto 1)"
    assert titulo_votacion("Tramitación como Proyecto de Ley por el procedimiento de urgencia del Real Decreto-ley "
                           "23/2026, de 8 de septiembre, por el que se adoptan medidas.") \
        == "Tramitar el RDL 23/2026 como proyecto de ley"
    assert titulo_votacion("De la diputada doña Sofía Acedo Reyes, del Grupo Parlamentario Popular en el Congreso, "
                           "que formula a la señora vicepresidenta segunda: ¿Cuál es su valoración de la crisis de "
                           "Ceuta, vicepresidenta?") == "Sofía Acedo Reyes: ¿Cuál es su valoración de la crisis de Ceuta, vicepresidenta?"
    assert titulo_votacion("Sobre la necesidad de transparencia. «BOCG. Congreso de los Diputados», serie D, "
                           "número 573, de 27 de julio de 2026") == "Sobre la necesidad de transparencia"


def test_cabecera_comision():
    texto = ("DIARIO DE SESIONES DEL\nCONGRESO DE LOS DIPUTADOS\nCOMISIONES\nXV LEGISLATURA\n\nAño 2026\n\nNúm. 620\n\n"
             "DE SEGUIMIENTO Y EVALUACIÓN\nDE LOS ACUERDOS DEL PACTO\nDE TOLEDO\nPRESIDENCIA DE LA EXCMA. SRA. D.ª X\n"
             "Sesión núm. 13\n\ncelebrada el martes 22 de septiembre de 2026\n")
    c = cabecera(texto, "CO")
    assert c["organo"] == "Comisión de Seguimiento y Evaluación de los Acuerdos del Pacto de Toledo"
    assert c["fecha"] == "2026-09-22" and c["sesion"] == 13
    assert cabecera(texto.replace("COMISIONES", "PLENO"), "PL")["organo"] == "Pleno"


def test_completar_con_mvp(tmp_path, monkeypatch):
    (tmp_path / "mvp.json").write_text(json.dumps({
        "sesiones": [
            {"id": "m1", "fecha": "2026-09-16", "organo": "Pleno", "dsNombre": "DSCD-15-PL-205", "ds": "u",
             "resumen": "Resumen MVP", "puntos": [{"tipo": "Control", "titulo": "P1", "estado": "analizado", "votos": ["198-1", "no-existe"]}]},
            {"id": "m2", "fecha": "2026-09-23", "organo": "Pleno", "ds": None, "resumen": "Día 23",
             "puntos": [{"tipo": "Votaciones", "titulo": "V", "estado": "sin-ds", "votos": []}]},
            {"id": "m3", "fecha": "2026-09-17", "organo": "Pleno", "dsNombre": "DSCD-15-PL-206", "ds": "u",
             "resumen": "Ya analizado por el pipeline", "puntos": []}],
        "intervenciones": [{"s": "m1", "orador": "A"}, {"s": "m3", "orador": "B"}],
        "votaciones": {"198-1": {"titulo": "Título revisado", "tipo": "Moción", "proponente": "PP", "exp": "173/1"}}}))
    monkeypatch.setattr(mod_construir, "MVP", tmp_path / "mvp.json")
    sesiones = [
        {"id": "DSCD-15-PL-205", "dsNombre": "DSCD-15-PL-205", "ds": "u", "fecha": "2026-09-16", "organo": "Pleno", "resumen": "", "puntos": []},
        {"id": "votos-2026-09-23", "ds": None, "fecha": "2026-09-23", "organo": "Pleno", "resumen": "", "nota": "sin Diario", "puntos": []},
        {"id": "DSCD-15-PL-206", "dsNombre": "DSCD-15-PL-206", "ds": "u", "fecha": "2026-09-17", "organo": "Pleno", "resumen": "Propio", "puntos": []}]
    ivs = [{"s": "DSCD-15-PL-206", "orador": "Propio"}]
    votos = [{"id": "198-1", "titulo": "Largo", "tipo": "x", "proponente": "?", "exp": ""}]
    completar_con_mvp(sesiones, ivs, votos)

    assert votos[0]["titulo"] == "Título revisado"
    s205, s23, s206 = sesiones
    assert s205["resumen"] == "Resumen MVP" and s205["puntos"][0]["votos"] == ["198-1"]
    assert {"s": "DSCD-15-PL-205", "orador": "A"} in ivs
    assert s23["resumen"] == "Día 23" and "nota" not in s23
    assert s206["resumen"] == "Propio" and not any(i["orador"] == "B" for i in ivs)   # el pipeline manda
