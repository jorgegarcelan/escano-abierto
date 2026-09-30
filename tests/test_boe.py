"""Nombramientos y ceses del BOE y organigrama del Estado (sin red: títulos y párrafos reales del BOE)."""
from escano import boe, estado


def _doc(titulo, parrafos=(), id_boe="BOE-A-2026-1", departamento="Ministerio de Hacienda", rango="Real Decreto"):
    return {"id": id_boe, "titulo": titulo, "departamento": departamento, "rango": rango, "numero": "1/2026",
            "fecha": "2026-01-01", "alertas": ["139"], "parrafos": list(parrafos)}


def test_nombramiento_en_el_titulo():
    [e] = boe.eventos_de(_doc("Real Decreto 1111/2023, de 5 de diciembre, por el que se nombra Director General de "
                              "Carreteras a don Juan Pedro Fernández Palomino."))
    assert (e["tipo"], e["cargo"], e["persona"], e["genero"]) == (
        "nombramiento", "Director General de Carreteras", "Juan Pedro Fernández Palomino", "m")


def test_cargo_con_a_dentro_y_cese_con_motivo():
    [e] = boe.eventos_de(_doc("Real Decreto 5/2024, de 9 de enero, por el que se nombra Directora General de Apoyo a "
                              "Víctimas del Terrorismo a doña Ana Pérez López."))
    assert e["cargo"] == "Directora General de Apoyo a Víctimas del Terrorismo" and e["genero"] == "f"
    [c] = boe.eventos_de(_doc("Real Decreto 6/2024, de 9 de enero, por el que se dispone el cese de doña Ana Pérez "
                              "López como Directora General de Apoyo a Víctimas del Terrorismo, a petición propia."))
    assert (c["tipo"], c["persona"], c.get("motivo")) == ("cese", "Ana Pérez López", "a petición propia")


def test_decreto_colectivo_de_ministros():
    evs = boe.eventos_de(_doc(
        "Real Decreto 835/2023, de 20 de noviembre, por el que se nombran Ministros del Gobierno.",
        ["De conformidad con lo dispuesto en los artículos 62 y 100 de la Constitución, vengo en nombrar:",
         "Ministro de Asuntos Exteriores, Unión Europea y Cooperación a don José Manuel Albares Bueno.",
         "Ministra de Defensa a doña María Margarita Robles Fernández.",
         "Madrid, 20 de noviembre de 2023."], departamento="Presidencia del Gobierno"))
    assert [(e["cargo"], e["persona"]) for e in evs] == [
        ("Ministro de Asuntos Exteriores, Unión Europea y Cooperación", "José Manuel Albares Bueno"),
        ("Ministra de Defensa", "María Margarita Robles Fernández")]


def test_nombre_solo_en_el_cuerpo():
    [e] = boe.eventos_de(_doc(
        "Orden TMA/992/2023, de 23 de agosto, por la que se publica el cese del Presidente de la Autoridad Portuaria "
        "de Castellón.",
        ["Dar publicidad en el «Boletín Oficial del Estado» al cese de don Enrique Vidal Pérez como Presidente de la "
         "Autoridad Portuaria de Castellón, dispuesto por Acuerdo del Consell de la Generalitat Valenciana.",
         "Madrid, 23 de agosto de 2023.–La Ministra de Transportes, Raquel Sánchez Jiménez."], rango="Orden"))
    assert (e["tipo"], e["cargo"], e["persona"]) == (
        "cese", "Presidente de la Autoridad Portuaria de Castellón", "Enrique Vidal Pérez")


def test_militar_con_grado():
    [e] = boe.eventos_de(_doc("Real Decreto 1035/2023, de 7 de diciembre, por el que se nombra Secretario General "
                              "Técnico al General Consejero Togado del Cuerpo Jurídico Militar don José Luis García Castell."))
    assert (e["cargo"], e["persona"]) == ("Secretario General Técnico", "José Luis García Castell")


def test_prefiltro():
    item = lambda t, dep="MINISTERIO DE HACIENDA": {"titulo": t, "departamento": dep}
    assert boe.es_candidato(item("Real Decreto 1/2026, por el que se nombra Director General de Tributos a don X Y."))
    assert not boe.es_candidato(item("Resolución de 16 de septiembre, por la que se nombra Profesor Titular de "
                                     "Universidad a don X Y.", "UNIVERSIDADES"))
    assert not boe.es_candidato(item("Resolución por la que se resuelve la convocatoria de libre designación."))


def test_sumario_con_epigrafes_dentro_de_texto():
    """En los números extraordinarios los epígrafes van dentro de «texto»."""
    salida = []
    dep = {"nombre": "PRESIDENCIA DEL GOBIERNO", "texto": {"epigrafe": [{"nombre": "Ceses", "item": [
        {"identificador": "BOE-A-2023-26729", "titulo": "Real Decreto 1232/2023, por el que se dispone el cese de doña "
         "Nadia María Calviño Santamaría como Vicepresidenta Primera del Gobierno."}]}]}}
    boe._items(dep, dep["nombre"], "", salida)
    assert [(i["id"], i["departamento"], i["epigrafe"]) for i in salida] == [
        ("BOE-A-2023-26729", "PRESIDENCIA DEL GOBIERNO", "Ceses")]


def _ev(fecha, tipo, cargo, persona, boe_id, dep="Ministerio de Hacienda"):
    return {"boe": boe_id, "fecha": fecha, "disposicion": "Real Decreto", "departamento": dep, "tipo": tipo,
            "cargo": cargo, "persona": persona, "genero": "m"}


def test_mandatos_con_genero_cese_y_relevo_sin_cese():
    cargos = estado.mandatos([
        _ev("2020-01-10", "nombramiento", "Director General de Tributos", "Ana López Ruiz", "A"),
        _ev("2022-03-01", "cese", "Directora General de Tributos", "Ana López Ruiz", "B"),
        _ev("2022-03-01", "nombramiento", "Director General de Tributos", "Luis Gil Mora", "C"),
        _ev("2024-05-01", "nombramiento", "Directora General de Tributos", "Eva Sanz Díaz", "D"),  # sin cese publicado
    ])
    [c] = cargos.values()
    assert [(m["persona"], m["desde"], m["hasta"]) for m in c["mandatos"]] == [
        ("Ana López Ruiz", "2020-01-10", "2022-03-01"), ("Luis Gil Mora", "2022-03-01", "2024-05-01"),
        ("Eva Sanz Díaz", "2024-05-01", None)]
    assert c["mandatos"][0]["boe_cese"] == "B"


def test_organo_colegiado_varios_a_la_vez_y_cargo_generico_por_ministerio():
    cargos = estado.mandatos([
        _ev("2024-01-01", "nombramiento", "miembro del Consejo de la Comisión Nacional del Mercado de Valores", "A B C", "1"),
        _ev("2024-02-01", "nombramiento", "miembro del Consejo de la Comisión Nacional del Mercado de Valores", "D E F", "2"),
        _ev("2024-03-01", "nombramiento", "Secretario General Técnico", "G H I", "3", dep="Ministerio de Defensa"),
        _ev("2024-03-01", "nombramiento", "Secretaria General Técnica", "J K L", "4", dep="Ministerio de Cultura"),
    ])
    consejo = next(c for c in cargos.values() if c["cargo"].startswith("miembro"))
    assert [m["hasta"] for m in consejo["mandatos"]] == [None, None]
    assert len([c for c in cargos.values() if c["cargo"].startswith("Secretario General Técnico")]) == 2


def test_rango_y_grupo():
    assert estado.rango("Vicepresidente Primero del Gobierno") == 1
    assert estado.rango("Vicepresidente del Consorcio de la Zona Especial Canaria") == 4
    assert estado.rango("Secretario de Estado de Hacienda") == 2
    assert estado.grupo("Embajador de España en la República de Serbia", "Ministerio de Asuntos Exteriores") == "exterior"
    assert estado.grupo("Delegado del Gobierno en Ceuta", "Ministerio de Política Territorial") == "territorio"


def test_nuevo_gobierno_cierra_a_los_ministros_salientes():
    cargos = estado.mandatos([
        _ev("2021-07-12", "nombramiento", "Ministra de Justicia", "María Pilar Llop Cuenca", "1", dep="Presidencia del Gobierno"),
        _ev("2021-07-12", "nombramiento", "Ministro del Interior", "Fernando Grande-Marlaska Gómez", "2", dep="Presidencia del Gobierno"),
        _ev("2023-11-17", "nombramiento", "Presidente del Gobierno", "Pedro Sánchez Pérez-Castejón", "3", dep="Jefatura del Estado"),
        _ev("2023-11-21", "nombramiento", "Ministro del Interior", "Fernando Grande-Marlaska Gómez", "4", dep="Presidencia del Gobierno"),
        _ev("2023-11-21", "nombramiento", "Ministro de la Presidencia, Justicia y Relaciones con las Cortes", "Félix Bolaños García", "4",
            dep="Presidencia del Gobierno"),
    ])
    justicia = cargos[estado.clave("Ministro de Justicia")]["mandatos"][0]
    assert justicia["hasta"] == "2023-11-21" and "nuevo Gobierno" in justicia["motivo"]
    interior = cargos[estado.clave("Ministro del Interior")]["mandatos"]
    assert [(m["desde"], m["hasta"]) for m in interior] == [("2021-07-12", None)]  # sigue: se renueva en el cargo


def test_cese_de_militar_con_grado_y_nombramiento_en_el_cuerpo():
    [c] = boe.eventos_de(_doc("Real Decreto 343/2020, de 11 de febrero, por el que se dispone el cese del Teniente General "
                              "del Cuerpo General del Ejército del Aire don Miguel Ángel Martín Pérez como Jefe del Mando de "
                              "Apoyo Logístico del Ejército del Aire."))
    assert (c["tipo"], c["persona"], c["cargo"]) == ("cese", "Miguel Ángel Martín Pérez",
                                                     "Jefe del Mando de Apoyo Logístico del Ejército del Aire")
    [n] = boe.eventos_de(_doc(
        "Resolución de 29 de julio de 2021, de la Presidencia del Consejo Rector de la Agencia Española de Cooperación "
        "Internacional para el Desarrollo, por la que se publica el nombramiento como Director de la Agencia.",
        ["Ordenar la publicación en el «Boletín Oficial del Estado» del nombramiento como Director de la Agencia Española "
         "de Cooperación Internacional para el Desarrollo de don Antón Leis García, con efectos del día 23 de agosto."],
        rango="Resolución"))
    assert (n["tipo"], n["persona"]) == ("nombramiento", "Antón Leis García")
    assert n["cargo"] == "Director de la Agencia Española de Cooperación Internacional para el Desarrollo"


def test_delegaciones_de_protocolo_fuera():
    assert boe.eventos_de(_doc("Real Decreto 562/2019, de 4 de octubre, por el que se nombra Presidenta de la Delegación "
                               "que asistirá al Consistorio Cardenalicio a doña Carmen Calvo Poyato.")) == []


def test_quien_pasa_a_otro_cargo_deja_el_anterior():
    cargos = estado.mandatos([
        _ev("2020-01-10", "nombramiento", "Director General de Tributos", "Ana López Ruiz", "A", dep="Ministerio de Hacienda y Función Pública"),
        _ev("2023-12-01", "nombramiento", "Secretaria de Estado de Hacienda", "Ana López Ruiz", "B"),
    ])
    dg = cargos[estado.clave("Director General de Tributos")]["mandatos"][0]
    assert dg["hasta"] == "2023-12-01" and "otro cargo" in dg["motivo"]


def test_nombre_compuesto_antes_del_cargo_y_correcciones_fuera():
    [e] = boe.eventos_de(_doc("Real Decreto 636/2020, de 30 de junio, por el que se nombra a doña Heide-Elena Nicolás "
                              "Martínez como Agente del Reino de España ante el Tribunal Europeo de Derechos Humanos."))
    assert (e["persona"], e["cargo"]) == ("Heide-Elena Nicolás Martínez",
                                          "Agente del Reino de España ante el Tribunal Europeo de Derechos Humanos")
    assert boe.eventos_de(_doc("Corrección de errores del Real Decreto 357/2018, por el que se nombran Ministros del "
                               "Gobierno.", ["En la página 58729, donde dice: «Ministra de Justicia a doña X Y»"])) == []


def test_cargo_compuesto_con_guion_es_el_principal():
    assert estado.clave("Abogada General del Estado-Directora del Servicio Jurídico del Estado") == \
        estado.clave("Abogado General del Estado")
    assert estado.clave("Directora General de la Fábrica Nacional de Moneda y Timbre-Real Casa de la Moneda") != \
        estado.clave("Directora General de la Fábrica Nacional de Moneda y Timbre")


def test_renovacion_con_nombre_mas_largo_sigue_el_mandato():
    cargos = estado.mandatos([
        _ev("2018-06-07", "nombramiento", "Ministra de Defensa", "Margarita Robles Fernández", "1", dep="Presidencia del Gobierno"),
        _ev("2020-01-10", "nombramiento", "Presidente del Gobierno", "Pedro Sánchez Pérez-Castejón", "2", dep="Jefatura del Estado"),
        _ev("2020-01-13", "nombramiento", "Ministra de Defensa", "María Margarita Robles Fernández", "3", dep="Presidencia del Gobierno"),
    ])
    [m] = cargos[estado.clave("Ministro de Defensa")]["mandatos"]
    assert (m["desde"], m["hasta"], [r["boe"] for r in m["renovaciones"]]) == ("2018-06-07", None, ["3"])
    assert estado._slug_diputado("María Margarita Robles Fernández",
                                 {"margarita robles fernandez": "robles-fernandez-margarita"}) == "robles-fernandez-margarita"


def test_cese_en_funciones_y_citas_de_otros_decretos():
    [c] = boe.eventos_de(_doc(
        "Real Decreto 336/2019, de 29 de abril, por el que se declara el cese de don Pedro Sánchez Pérez-Castejón como "
        "Presidente del Gobierno.",
        ["Vengo en declarar el cese de don Pedro Sánchez Pérez-Castejón como Presidente del Gobierno, que continuará en "
         "funciones hasta la toma de posesión del nuevo Presidente del Gobierno."]))
    assert c["en_funciones"]
    cargos = estado.mandatos([
        _ev("2018-06-02", "nombramiento", "Presidente del Gobierno", "Pedro Sánchez Pérez-Castejón", "1"), c | {"fecha": "2019-04-30"},
        _ev("2020-01-08", "nombramiento", "Presidente del Gobierno", "Pedro Sánchez Pérez-Castejón", "3")])
    [m] = cargos["presidente-del-gobierno"]["mandatos"]
    assert m["hasta"] is None and m["en_funciones"][0]["fecha"] == "2019-04-30" and m["renovaciones"][0]["boe"] == "3"
    assert boe.eventos_de(_doc(
        "Real Decreto 604/2026, por el que se dispone el cese y nombramiento de titulares de las vocalías de la Comisión.",
        ["Como consecuencia del Real Decreto 257/2026, de 26 de marzo, por el que se dispone el cese de doña María Jesús "
         "Montero Cuadrado como Ministra de Hacienda, procede renovar las vocalías."])) == []
