"""Temas para seguir, declaraciones de intereses y preguntas escritas."""
from datetime import date

from escano import intereses, preguntas, temas
from escano.construir import resumen_preguntas


def test_temas_por_palabras_clave():
    assert temas.temas_de("Medidas urgentes para garantizar el acceso a la vivienda en alquiler") == ["vivienda"]
    assert "pensiones" in temas.temas_de("Revalorización de las pensiones y del Ingreso Mínimo Vital")
    assert "campo" in temas.temas_de("Evitar que el Pacto Verde europeo arrase el campo español")
    assert temas.temas_de("Dictamen sobre el suplicatorio") == []        # lo que no encaja, sin tema


def test_declaracion_de_intereses():
    filas = [
        {"NOMBRE": "Ruiz López,Ana", "FECHAREGISTRO": "08/08/2023", "TIPO": "ACTIVIDAD", "PERIODO": "2019-2023",
         "EMPLEADOR": "AYUNTAMIENTO DE LUGO", "SECTOR": "PÚBLICO", "DESCRIPCION": "CONCEJALA"},
        {"NOMBRE": "Ruiz López,Ana", "FECHAREGISTRO": "19/09/2023", "TIPO": "ACTIVIDAD", "PERIODO": "2015",
         "EMPLEADOR": "Bufete X", "SECTOR": "Abogacía", "DESCRIPCION": "Abogada"},
        {"NOMBRE": "Ruiz López,Ana", "FECHAREGISTRO": "08/08/2023", "TIPO": "FUNDACIONES",
         "DESTINATARIO": "CRUZ ROJA", "DESCRIPCION": "APORTACIÓN ANUAL"},
        {"NOMBRE": "Ruiz López,Ana", "FECHAREGISTRO": "08/08/2023", "TIPO": "DONACION", "DESCRIPCION": "Ninguno"},
    ]
    d = intereses.leer_filas(filas)["Ruiz López, Ana"]
    assert d["registro"] == "2023-09-19"
    assert d["actividades"][0] == ["2019-2023", "AYUNTAMIENTO DE LUGO", "PÚBLICO", "CONCEJALA", "Público"]
    assert d["actividades"][1][4] == "Privado"
    assert d["aportaciones"] == [["CRUZ ROJA", "APORTACIÓN ANUAL"]] and d["regalos"] == [["", "Ninguno"]]
    assert intereses.sector("Partido Político") == "Partidos y sindicatos" and intereses.sector("ONG") == "Tercer sector"


def test_pregunta_escrita():
    p = preguntas.leer({"id_iniciativa": "184/043980", "fecha_presentado": "18/09/2026", "fecha_calificado": "22/09/2026",
                        "titulo": "Previsiones  acerca de la &quot;vivienda&quot;.",
                        "autor": "Jordà i Roura, Teresa (GR) <br />Estrems Fayos, Etna (GR)"})
    assert p == {"exp": "184/043980", "presentada": "2026-09-18", "calificada": "2026-09-22", "estado": "pendiente",
                 "titulo": 'Previsiones acerca de la "vivienda".',
                 "autores": [["Jordà i Roura, Teresa", "ERC"], ["Estrems Fayos, Etna", "ERC"]]}
    assert preguntas.estado("Tramitado por completo sin req. acuerdo o decisión") == "contestada"
    assert preguntas.estado("Retirado") == "retirada"


def test_resumen_de_preguntas():
    dips = [["Ruiz, Ana", "PP"], ["Gil, Luis", "PSOE"]]
    ps = [{"exp": "184/1", "presentada": "2026-01-10", "calificada": "2026-01-15", "estado": "pendiente",
           "titulo": "Sobre la vivienda", "autores": [["Ruiz, Ana", "PP"]]},
          {"exp": "184/2", "presentada": "2026-09-01", "calificada": "2026-09-05", "estado": "pendiente",
           "titulo": "Sanidad", "autores": [["Ruiz, Ana", "PP"], ["Gil, Luis", "PSOE"]]},
          {"exp": "184/3", "presentada": "2026-02-01", "calificada": "2026-02-05", "estado": "contestada",
           "cerrada": "2026-04-06", "titulo": "Trenes", "autores": [["Gil, Luis", "PSOE"]]}]
    r, listas = resumen_preguntas(ps, dips, date(2026, 9, 25))
    assert r["total"] == 3 and r["estados"] == {"pendiente": 2, "contestada": 1}
    assert r["n_antiguas"] == 1 and r["antiguas"][0][0] == "184/1"       # la de septiembre aún está en plazo
    assert r["diputados"]["0"] == [2, 2, 1] and r["diputados"]["1"] == [2, 1, 0]
    assert r["grupos"]["PP"] == [2, 2, 1] and r["temas"]["vivienda"] == 1
    assert [p[0] for p in listas[1]] == ["184/2", "184/3"]              # de la más reciente a la más antigua
    assert listas[1][1][4] == 60 and r["demora"]["mediana"] == 60 and r["demora"]["fuera"] == 0
