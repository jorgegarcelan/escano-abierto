"""Tramitación de leyes, orden del día del pleno y resumen semanal."""
from pathlib import Path

from escano import agenda, leyes, semanas

FIXTURES = Path(__file__).parent / "fixtures"

TRAMITADA = {
    "LEGISLATURA": "Leg.15", "TIPO": "Proyecto de ley", "NUMEXPEDIENTE": "121/000001/0000",
    "OBJETO": "Proyecto de Ley Orgánica de representación paritaria y presencia \nequilibrada de mujeres y hombres.",
    "FECHAPRESENTACION": "07/12/2023", "AUTOR": "Gobierno", "TIPOTRAMITACION": "Urgente",
    "RESULTADOTRAMITACION": "Aprobado con modificaciones \n10/09/2024", "SITUACIONACTUAL": "Cerrado",
    "COMISIONCOMPETENTE": "Comisión de Igualdad",
    "PLAZOS": "Hasta: 03/02/2024 (14:00) De enmiendas \nHasta: 07/02/2024 (18:00) Ampliación de enmiendas al articulado \n",
    "TRAMITACIONSEGUIDA": "Comisión de Igualdad \nEnmiendas \ndesde 15/12/2023 hasta 25/04/2024 \nComisión de Igualdad \n"
                          "Informe \ndesde 25/04/2024 hasta 13/06/2024 \nPleno \nAprobación \ndesde 20/06/2024 hasta 27/06/2024 \n"
                          "Senado \ndesde 27/06/2024 hasta 17/07/2024 \nConcluido - (Aprobado con modificaciones) \n"
                          "desde 23/07/2024 hasta 10/09/2024",
    "ENLACESDS": "https://www.congreso.es/public_oficiales/L15/CONG/DS/PL/DSCD-15-PL-25.PDF#page=3 \n "
                 "https://www.congreso.es/public_oficiales/L15/CONG/DS/CO/DSCD-15-CO-145.PDF#page=2",
}
RECHAZADA = {
    "NUMEXPEDIENTE": "122/000006/0000", "OBJETO": "Proposición de Ley de reforma del Código Penal (Orgánica).",
    "FECHAPRESENTACION": "22/09/2023", "AUTOR": "Grupo Parlamentario Plurinacional SUMAR \nGrupo Parlamentario Socialista",
    "RESULTADOTRAMITACION": "Rechazado \n19/12/2023", "SITUACIONACTUAL": "Cerrado",
    "TRAMITACIONSEGUIDA": "Boletín Oficial de las Cortes Generales \nPublicación \ndesde 26/09/2023 hasta 29/09/2023 \n"
                          "Pleno \nToma en consideración \ndesde 07/11/2023 hasta 19/12/2023 \nConcluido - (Rechazado) \n"
                          "desde 19/12/2023 hasta 19/12/2023",
}


def test_iniciativa_aprobada():
    ley = leyes.leer_iniciativa(TRAMITADA)
    assert ley["exp"] == "121/000001" and ley["estado"] == "aprobada" and ley["etapa"] == 5
    assert ley["titulo"] == "Ley Orgánica de representación paritaria y presencia equilibrada de mujeres y hombres"
    assert ley["organica"] and ley["autores"] == ["GOB"] and ley["fecha_resultado"] == "2024-09-10"
    assert ley["fases"][0] == {"organo": "Comisión de Igualdad", "fase": "Enmiendas", "desde": "2023-12-15", "hasta": "2024-04-25"}
    assert ley["fases"][-1]["organo"] == "Concluido" and ley["fases"][-1]["fase"] == "Aprobado con modificaciones"
    assert ley["ampliaciones"] == 1 and ley["diarios"] == ["DSCD-15-CO-145", "DSCD-15-PL-25"]


def test_proposicion_rechazada_en_la_toma():
    ley = leyes.leer_iniciativa(RECHAZADA)
    assert ley["estado"] == "rechazada" and ley["etapa"] == 0     # no pasó de la toma en consideración
    assert ley["autores"] == ["SUMAR", "PSOE"] and ley["origen"] == "GRUPOS" and ley["organica"]


def test_orden_del_dia():
    od = agenda.leer_orden_del_dia((FIXTURES / "orden_dia_pleno_201.txt").read_text(), 2026)
    assert od["sesion"] == "201" and od["dias"] == ["2026-09-29", "2026-09-30"] and len(od["puntos"]) == 40
    p1 = od["puntos"][0]
    assert p1["seccion"] == "Toma en consideración de Proposiciones de Ley" and p1["hora"] == "15:00"
    assert p1["exp"] == ["122/000287"] and p1["grupo"] == "PP" and "BOCG" not in p1["titulo"]
    mocion = next(p for p in od["puntos"] if p["exp"] == ["173/000194"])
    assert mocion["grupo"] == "MIXTO" and mocion["titulo"].startswith("Relativa a las medidas")
    preg = next(p for p in od["puntos"] if p["exp"] == ["180/001189"])
    assert preg["autor"] == "Marta Madrenas i Mir" and preg["a"] == "Ministra de Vivienda y Agenda Urbana"
    assert preg["grupo"] == "JUNTS" and preg["titulo"].startswith("¿Cree que rectificar") and preg["fecha"] == "2026-09-30"
    assert od["puntos"][29]["grupo"] == "GOB"                        # debate de totalidad de un proyecto de ley


def test_semana():
    assert semanas.id_semana("2026-09-23") == "2026-S39" and str(semanas.lunes_de("2026-S39")) == "2026-09-21"
    v = lambda i, f, si, no, tipo="Moción", tit="Algo": {"id": i, "fecha": f, "si": si, "no": no, "tipo": tipo,
                                                         "titulo": tit, "discrepantes": []}
    votos = [v("1-1", "2026-09-22", 200, 140), v("1-2", "2026-09-23", 170, 172),
             v("1-3", "2026-09-23", 160, 180, "Convalidación RDL", "RDL 21/2026 por el que se adoptan medidas")]
    votos[0]["discrepantes"] = ["Ruiz, Ana (PP)", "Ruiz, Ana (PP)"]
    ley = leyes.leer_iniciativa(TRAMITADA)
    [s] = semanas.calcular(votos, [], [], [ley], [["Ruiz, Ana", "PP"]])
    assert s["id"] == "2026-S39" and s["aprobadas"] == 1 and s["ajustadas"][0] == "1-2"
    assert s["rdl"] == ["1-3"] and s["rebeldes"] == [[0, 2]]
    assert s["titular"] == "El Congreso tumba el RDL 21/2026"
    assert semanas.eventos_de_leyes([ley], "2024-06-17", "2024-06-23")[0]["evento"] == "Aprobada en el Congreso"
    assert semanas.eventos_de_leyes([ley], "2024-09-09", "2024-09-15")[0]["evento"].startswith("Es ley")
