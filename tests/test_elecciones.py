from datetime import date

from escano import elecciones, geo


def test_calendario_29n():
    h = {x["hito"]: x for x in elecciones.calendario()}
    assert h["Disolución y convocatoria"]["fecha"] == "2026-10-06"
    assert (h["Presentación de candidaturas"]["fecha"], h["Presentación de candidaturas"]["hasta"]) == ("2026-10-21", "2026-10-26")
    assert h["Listas presentadas en el BOE"]["fecha"] == "2026-10-28"
    assert h["Proclamación de candidaturas"]["fecha"] == "2026-11-02"
    assert (h["Campaña electoral"]["fecha"], h["Campaña electoral"]["hasta"]) == ("2026-11-13", "2026-11-27")
    assert h["Jornada de reflexión"]["fecha"] == "2026-11-28"
    assert h["Votación"]["fecha"] == "2026-11-29"
    # La votación cae el día 54 después de la convocatoria (art. 42 de la LOREG).
    assert (date(2026, 11, 29) - elecciones.CONVOCATORIA).days == 54


def _ley(exp, estado, etapa=1, origen="GRUPOS", ampliaciones=0, tipo="Proposición de ley"):
    return {"exp": exp, "titulo": "Ley de prueba", "tipo": tipo, "origen": origen, "autores": [origen],
            "presentada": "2025-10-06", "estado": estado, "etapa": etapa, "ampliaciones": ampliaciones}


def test_caducan_solo_lo_que_sigue_en_tramite():
    leyes = {"iniciativas": [_ley("122/1", "en trámite", 0), _ley("122/2", "aprobada", 5),
                             _ley("121/3", "caducada", 4, "GOB", 12, "Proyecto de ley"), _ley("122/4", "rechazada")]}
    c = elecciones.caducan(leyes)
    assert c["total"] == 2 and c["proyectos"] == 1 and c["proposiciones"] == 1
    assert c["congelador"] == 1 and c["max_ampliaciones"] == 12
    assert c["lista"][0][0] == "121/3"          # primero, la que más lejos llegó
    assert c["lista"][0][8] == 365              # días en el Congreso hasta la disolución


def test_dhondt_con_barrera_y_ultimo_escano():
    # Ejemplo clásico: 7 escaños.
    r = elecciones.dhondt({"A": 340000, "B": 280000, "C": 160000, "D": 60000, "E": 15000}, 7, validos=860000)
    assert r["escanos"] == {"A": 3, "B": 3, "C": 1}
    assert r["fuera"] == ["E"]                  # 15.000 < 3 % de 860.000
    u = r["ultimo"]
    assert u["gana"] == "B" and u["segundo"] == "A"
    # A necesitaba que 340.000 + x entre 4 superara el último cociente (280.000 / 3).
    assert (340000 + u["faltan"]) / 4 > 280000 / 3 >= (340000 + u["faltan"] - 1) / 4


def test_dhondt_un_escano_y_votos_sin_escano():
    votos = {"A": 10000, "B": 9000, "C": 500}
    r = elecciones.dhondt(votos, 1)
    assert r["escanos"] == {"A": 1}
    assert r["ultimo"]["faltan"] == 1001
    assert elecciones.votos_sin_escano(votos, r["escanos"]) == 9500


def test_path_compacto_y_centroide():
    d = geo._path([[(0, 0), (10, 0), (10, 10), (0, 10)]], 0)
    assert d == "M0 0l10 0 0 10-10 0z"
    area, cx, cy = geo._area_centroide([(0, 0), (10, 0), (10, 10), (0, 10)])
    assert (abs(area), cx, cy) == (100, 5, 5)


def test_disolucion_no_vacia_diputados_ni_hemiciclo(tmp_path, monkeypatch):
    """Tras la disolución, los datos abiertos traen solo a la Diputación Permanente: se conserva lo anterior."""
    import json
    from escano import diputados, hemiciclo

    previos = {f"Apellido{i}, Nombre": {"circunscripcion": "Madrid", "formacion": "X", "alta": "2023-08-17"} for i in range(350)}
    f = tmp_path / "diputados.json"
    f.write_text(json.dumps(previos))
    monkeypatch.setattr(diputados, "FICHERO", f)
    pocos = [{"NOMBRE": f"Apellido{i}, Nombre", "CIRCUNSCRIPCION": "Madrid", "FORMACIONELECTORAL": "X",
              "FECHAALTA": "17/08/2023"} for i in range(60)]
    pagina = b"/webpublica/opendata/diputados/DiputadosActivos__20261007.json"
    monkeypatch.setattr(diputados, "descargar", lambda url, *a, **k: pagina if "opendata/diputados" in url and not url.endswith(".json")
                        else json.dumps(pocos).encode())
    assert len(diputados.actualizar()) == 350
    assert len(json.loads(f.read_text())) == 350

    plano = {"escanos": {f"D{i}": {"x": i, "y": i, "codigo": i} for i in range(350)}, "gobierno": [], "ancho": 540, "alto": 395}
    h = tmp_path / "hemiciclo.json"
    h.write_text(json.dumps(plano))
    monkeypatch.setattr(hemiciclo, "FICHERO", h)
    monkeypatch.setattr(hemiciclo, "descargar", lambda *a, **k: b"<html>sin plano</html>")
    assert len(hemiciclo.actualizar()["escanos"]) == 350
    assert len(json.loads(h.read_text())["escanos"]) == 350


def test_candidaturas_soria_2023():
    from pathlib import Path
    from escano import candidaturas as C
    filas = C.leer(Path(__file__).parent / "fixtures" / "boe_candidaturas_soria_2023.xml")
    assert {f["provincia"] for f in filas} == {"SORIA"}
    assert C.circunscripcion("SORIA") == "Soria"
    pp = [f for f in filas if f["siglas"] == "PP" and f["tipo"] == "titular"]
    assert [(f["orden"], f["nombre"]) for f in pp] == [(1, "Tomás Cabezón Casas"), (2, "Elena del Vado López")]
    assert any(f["tipo"] == "no_proclamada" for f in filas)          # Escaños en Blanco, en Soria
    for f in filas:
        f["circ"] = "Soria"
    r = C.repite(filas, [["Cabezón Casas, Tomás", "PP", "Soria"], ["Rey de las Heras, Luis Alfonso", "PSOE", "Soria"],
                         ["Pérez López, Nadie", "PP", "Soria"]])
    assert r["Cabezón Casas, Tomás"]["orden"] == 1 and r["Cabezón Casas, Tomás"]["nivel"] == 1
    assert r["Rey de las Heras, Luis Alfonso"]["siglas"] == "PSOE"
    assert "Pérez López, Nadie" not in r


def test_casar_nombres_dificiles():
    from escano import candidaturas as C
    assert C.casar("Guijarro García, Txema", [{"nombre": "José María Guijarro García"}])[0] == 2
    assert C.casar("García Gurrutxaga, Ana", [{"nombre": "Ana García Gurruchaga"}])[0] == 3
    assert C.casar("Rufián Romero, Gabriel", [{"nombre": "Gabriel Rufián i Romero"}])[0] == 1
    # Mismos apellidos, otro nombre de pila: no casa.
    assert C.casar("Rodríguez García, Isabel", [{"nombre": "Pablo Rodríguez García"}])[0] == 0
    assert C.circunscripcion("ILLES BALEARS") == "Balears (Illes)"
    assert C.circunscripcion("SANTA CRUZ DE TENERIFE") == "S/C Tenerife"
    assert C.circunscripcion("A CORUÑA") == "Coruña (A)"
    assert C.circunscripcion("ARABA/ÁLAVA") == "Araba/Álava"


def test_candidaturas_correcciones(tmp_path):
    from escano import candidaturas as C
    xml = """<documento><texto>
      <p class="centro_negrita">JUNTA ELECTORAL DE TERUEL</p><p class="centro_cursiva">CONGRESO DE LOS DIPUTADOS</p>
      <p class="parrafo_2">En la página 90214:</p><p class="parrafo_2">Donde dice:</p>
      <p class="centro_redonda">«Candidatura núm.: 13. PARTIDO ANIMALISTA (PACMA)</p><p class="parrafo_2">No proclamada.»</p>
      <p class="parrafo_2">Debe decir:</p><p class="centro_redonda">«Candidatura núm.: 13. PARTIDO ANIMALISTA (PACMA)</p>
      <p class="parrafo_2">1. Elena Campón de Miguel.</p><p class="parrafo_2">Suplentes:</p><p class="parrafo_2">1. Javier Baldoví Jachán.»</p>
      <p class="centro_negrita">JUNTA ELECTORAL DE BIZKAIA</p><p class="centro_cursiva">CONGRESO DE LOS DIPUTADOS</p>
      <p class="centro_redonda">5. VOX (VOX)</p><p class="parrafo_2">Donde dice:</p><p class="parrafo_2">«3. Maria de la O Cordero Garcia.»</p>
      <p class="parrafo_2">Debe decir:</p><p class="parrafo_2">«3. María De La O Cordero García.»</p>
    </texto></documento>"""
    (tmp_path / "x.xml").write_text(xml)
    filas = C.leer(tmp_path / "x.xml")
    assert [(f["siglas"], f["tipo"], f["orden"], f["nombre"]) for f in filas] == [
        ("PACMA", "titular", 1, "Elena Campón de Miguel"), ("PACMA", "suplente", 1, "Javier Baldoví Jachán"),
        ("VOX", "correccion", 3, "María De La O Cordero García")]
    assert filas[2]["antes"] == "Maria de la O Cordero Garcia"


def test_familias_de_partidos():
    from escano.historico import familia
    casos = {("PSOE", ""): "PSOE", ("P.S.O.E.", ""): "PSOE", ("AP-PDP", ""): "PP", ("CD", "COALICION DEMOCRATICA"): "PP", ("P.P.", ""): "PP",
             ("UCD", ""): "UCD", ("CDS", ""): "UCD", ("PCE", ""): "IZQ", ("PODEMOS-IU-EQUO", ""): "IZQ",
             ("EN COMÚ", ""): "IZQ", ("SUMAR", ""): "IZQ", ("COMPROMÍS 2", ""): "IZQ", ("COMPROMÍS-Q", ""): "OTROS",
             ("PSP-US", "PARTIDO SOCIALISTA POPULAR-UNIDAD SOCIALISTA"): "OTROS", ("JxCAT - JUNTS", ""): "CIU",
             ("PDPC", ""): "CIU", ("ERC-CATSÍ", ""): "ERC", ("EAJ-PNV", ""): "PNV", ("AMAIUR", ""): "BILDU",
             ("EH Bildu", ""): "BILDU", ("B.N.G.", ""): "BNG", ("CCa-PNC", ""): "CC", ("C's", ""): "CS", ("VOX", ""): "VOX",
             ("NA+", "NAVARRA SUMA"): "OTROS", ("U.P.N.", ""): "OTROS", ("PRC", ""): "OTROS"}
    for (siglas, nombre), esperada in casos.items():
        assert familia(siglas, nombre) == esperada, siglas


def test_dhondt_reproduce_el_reparto_oficial_de_2023():
    import json
    from pathlib import Path
    from escano import elecciones
    prov = json.loads((Path(__file__).parent.parent / "data" / "elecciones" / "historico-202307.json").read_text())["prov"]
    assert len(prov) == 52 and sum(p["e"] for p in prov.values()) == 350
    for cod, p in prov.items():
        votos = {f"{s}|{k}": v for k, (s, _, v, _) in enumerate(p["c"])}
        oficial = {f"{s}|{k}": e for k, (s, _, _, e) in enumerate(p["c"]) if e}
        assert elecciones.dhondt(votos, p["e"], p["validos"])["escanos"] == oficial, cod


def test_promesas_unidades_y_citas():
    from escano import promesas as P
    pags = ["PROGRAMA 2023\nIntroducción general del partido sobre lo que pensamos hacer\n\n1. Aprobaremos una ley de vivien-\nda asequible con un parque público de 100.000 pisos.\n• Bajaremos el IVA de la luz al 5 % de forma permanente para todos.\n3\n",
            "PROGRAMA 2023\nÍndice de contenidos del programa electoral completo ........ 12\n\nCrearemos una agencia estatal de evaluación de políticas públicas independiente.\n",
            "PROGRAMA 2023\nOtra página con un párrafo largo que no dice nada concreto sobre nada en particular.\n"] * 2
    us = P.unidades(pags, "X")
    textos = [u["texto"] for u in us]
    assert "Aprobaremos una ley de vivienda asequible con un parque público de 100.000 pisos." in textos
    assert any(t.startswith("Bajaremos el IVA") for t in textos)
    assert not any("PROGRAMA 2023" in t or "Índice" in t for t in textos)
    assert us[0]["pagina"] == 1
    assert P.cita_literal("una ley de vivienda asequible con un parque público", textos[1])
    assert not P.cita_literal("una ley de vivienda barata con un parque público", textos[1])


def test_promesas_juicio_a_ciegas_y_posicion():
    from escano import promesas as P
    assert P.anonimo("Proposición no de Ley del Grupo Parlamentario Popular en el Congreso, sobre X") == "Proposición no de Ley del [GRUPO], sobre X"
    assert "[GRUPO]" in P.anonimo("Proposición de los Grupos Parlamentarios Socialista, Plurinacional SUMAR y Vasco (EAJ-PNV)")
    assert "Socialista" not in P.anonimo("Grupos Parlamentarios Socialista y Plurinacional SUMAR")
    assert P.posicion("SSSNA-", [0, 1, 2]) == "S"
    assert P.posicion("SSNNA-", [0, 1, 2, 3]) == "D"        # 50 % distinto: dividido
    assert P.posicion("SSSN--", [4, 5]) is None             # no eran diputados o no votaron


def test_promesas_regla_de_resultado():
    from escano import promesas as P
    ley = {"id": "121/1", "tipo": "Proyecto de ley", "titulo": "Ley de X", "fecha": "2025-01-01"}
    pnl = {"id": "162/1", "tipo": "Proposición no de ley", "titulo": "Sobre X", "fecha": "2024-01-01"}
    p = {"competencia": "directa"}
    assert P.resultado({"competencia": "ninguna"}, [])[0] == "sin_competencia"
    assert P.resultado(p, [])[0] == "no_votada"
    assert P.resultado(p, [(ley, "cumple", "S")])[0] == "a_favor_cumple"
    assert P.resultado(p, [(ley, "cumple", "N")])[0] == "en_contra_cumple"
    assert P.resultado(p, [(ley, "contradice", "N")])[0] == "en_contra_contradice"
    assert P.resultado(p, [(ley, "contradice", "S")])[0] == "a_favor_contradice"
    assert P.resultado(p, [(ley, "avanza", "N")])[0] == "en_contra_avanza"
    assert P.resultado(p, [(ley, "cumple", "A")])[0] == "abstencion"
    # A favor de una ley que la cumple y en contra de una PNL que también: distinto sentido.
    assert P.resultado(p, [(ley, "cumple", "S"), (pnl, "cumple", "N")])[0] == "distinto_sentido"
    # La ley pesa más que la PNL cuando las dos van en el mismo sentido.
    r, utiles = P.resultado(p, [(pnl, "cumple", "S"), (ley, "cumple", "S")])
    assert r == "a_favor_cumple" and utiles[0][0] is ley


def test_promesas_actos_agrupa_por_iniciativa():
    from escano import promesas as P
    v = lambda i, tipo, titulo, exp, fecha="2025-01-01": {"id": i, "tipo": tipo, "titulo": titulo, "texto": titulo, "exp": exp, "fecha": fecha, "v": ""}
    A = {a["id"]: a for a in P.actos([
        v("1-1", "Proyecto de ley", "Movilidad (enmienda 3)", "121/9"), v("1-2", "Proyecto de ley", "Movilidad", "121/9"),
        v("2-1", "Enmiendas del Senado", "Movilidad", "121/9", "2025-02-01"),
        v("3-1", "Convalidación RDL", "RDL 1/2025 de medidas", "130/1"), v("3-2", "Convalidación RDL", "Tramitar el RDL 1/2025 como proyecto de ley", "130/1"),
        v("4-1", "Toma en consideración", "Proposición de los Grupos A y B", "122/5"), v("4-2", "Toma en consideración", "Ley de otra cosa", "122/5")])}
    assert A["121/9"]["claves"] == ["1-2"] and A["121/9"]["vinculante"]
    assert A["130/1"]["claves"] == ["3-1"]
    assert {"122/5", "122/5·2"} <= set(A)                      # dos iniciativas con el mismo expediente por error
