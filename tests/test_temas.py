"""Temas por palabras clave: los casos reales que se colaban en un tema que no era el suyo."""
import pytest

from escano.temas import temas_de


@pytest.mark.parametrize("texto", [
    # RD 933/2021: registro de viajeros en hospedajes y alquiler de coches (votaciones 70-1 … 70-10)
    "Proposición no de Ley relativa a la revisión y readecuación de la normativa derivada del Real Decreto 933/2021, "
    "por el que se establecen las obligaciones de registro documental e información de las personas físicas o jurídicas "
    "que ejercen actividades de hospedaje y alquiler de vehículos a motor",
    "Saturación del aparcamiento de la estación intermodal y vehículos de alquiler.",
    "Armonización de la normativa en materia de arrendamiento de vehículos de transporte con conductor.",
    # 122/000199: ocupación de territorios, derecho internacional
    "Ley sobre el cumplimiento de las obligaciones internacionales de no reconocimiento y no asistencia a situaciones "
    "de ocupación ilegal de territorios",
])
def test_no_es_vivienda(texto):
    assert "vivienda" not in temas_de(texto)


@pytest.mark.parametrize("texto", [
    "Ley Orgánica contra la ocupación ilegal y para la convivencia vecinal y la protección de la seguridad de las "
    "personas y cosas en las comunidades de propietarios",
    "Moción relativa a la inseguridad ciudadana y a la ocupación ilegal que afectan especialmente a Cataluña",
    "Ley Orgánica de medidas urgentes para hacer frente a la ocupación ilegal de inmuebles",
    "Ley para la regulación de los contratos de alquiler temporales y alquiler de habitaciones",
    "Ley para la modificación de la Ley 29/1994, de 24 de noviembre, de Arrendamientos Urbanos",
    "Prórroga de la suspensión de desahucios",
])
def test_si_es_vivienda(texto):
    assert "vivienda" in temas_de(texto)


@pytest.mark.parametrize("texto,tema", [
    ("Protección de los menores tutelados en situación de desamparo", "empleo"),
    ("Solicitudes tramitadas al amparo de la Ley de Memoria Democrática", "empleo"),
    ("Medidas ante la grave situación del campo andaluz", "energia"),
    ("Reclamando el cese del Fiscal General del Estado", "impuestos"),
    ("Que España respalde la investigación de la Fiscalía del Tribunal Penal Internacional", "impuestos"),
    ("Solicitud de creación de una Comisión de Investigación sobre la denominada Operación Cataluña", "tecnologia"),
    ("Ley orgánica del Derecho de Defensa", "defensa"),
    ("Defensa del olivar en el contexto de la sobreinstalación de plantas de generación renovable", "defensa"),
    ("Reforma de la Ley por el Derecho a la Vivienda: veto a fondos y capital extranjero", "inmigracion"),
    ("Garantizar el campo español frente a la competencia desleal extranjera", "inmigracion"),
    ("Evaluación de los efectos del impuesto sobre el patrimonio en la competitividad", "cultura"),
    ("País donde se han producido mayores incrementos de aprendices de español", "social"),
])
def test_falsos_positivos_de_otros_temas(texto, tema):
    assert tema not in temas_de(texto)


@pytest.mark.parametrize("texto,tema", [
    ("Medidas para reducir el paro juvenil", "empleo"),
    ("Rebaja del IVA de la luz y el gas", "energia"),
    ("Medidas fiscales para las familias", "impuestos"),
    ("Proyecto de investigación científica en el CSIC", "tecnologia"),
    ("Gasto en defensa y compromisos con la OTAN", "defensa"),
    ("Planificación militar de la defensa y el nuevo concepto de seguridad", "defensa"),
    ("Ley de derechos y libertades de los extranjeros en España", "inmigracion"),
    ("Candidatura de Sigüenza como Patrimonio de la Humanidad", "cultura"),
    ("Protección del patrimonio histórico frente al expolio", "cultura"),
    ("Control de las residencias de mayores", "social"),
    ("Atención a las personas mayores que viven solas", "social"),
])
def test_siguen_en_su_tema(texto, tema):
    assert tema in temas_de(texto)
