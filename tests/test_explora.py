"""Cálculos de la pestaña Explora: se prueban con datos mínimos, sin API."""
from escano import explora

SESIONES = [{"id": "S1", "fecha": "2026-09-16", "puntos": [
    {"itemId": "Ley X", "exp": "122/000001", "votos": ["1-1"]}]}]


def iv(g, pos=None, motivo="", item="Ley X", **extra):
    return {"s": "S1", "item": item, "orador": f"Orador {g}", "g": g, "pos": pos, "motivo": motivo, **extra}


def test_porque_votan_solo_si_coincide_con_el_voto():
    votos = [{"id": "1-1", "fecha": "2026-09-16", "exp": "122/000001", "grupos": {"PP": "N", "PSOE": "S", "VOX": "N"}}]
    ivs = [iv("PP", "en contra", "Rompe la caja única."), iv("PSOE", "a favor", "Protege a las familias."),
           iv("VOX", "a favor", "Dijo que sí y votó que no.")]
    assert explora.porque_votan(votos, SESIONES, ivs) == 1
    assert votos[0]["porque"]["PP"] == ["Rompe la caja única.", "Orador PP", "S1", "2026-09-16"]
    assert "PSOE" in votos[0]["porque"] and "VOX" not in votos[0]["porque"]   # postura y voto no casan: se calla


def test_porque_votan_por_expediente_si_se_vota_otro_dia():
    votos = [{"id": "2-7", "fecha": "2026-09-18", "exp": "122/000001", "grupos": {"PP": "N"}}]
    explora.porque_votan(votos, SESIONES, [iv("PP", "en contra", "Rompe la caja única.")])
    assert votos[0]["porque"]["PP"][0] == "Rompe la caja única."


def test_contesta_asocia_quien_pregunta():
    ivs = [iv("PP", item="P1", frase="Pregunta por Ceuta."), iv("GOB", item="P1", responde="no", responde_motivo="Cambia de tema.")]
    c = explora.contesta(SESIONES, ivs, min_respuestas=1)
    m = c["ministros"][0]
    assert (m["n"], m["no"]) == (1, 1) and c["por_grupo"]["PP"]["no"] == 1
    assert m["casos"][0][4:] == ["Orador PP", "PP", "Pregunta por Ceuta."]


def test_citas_juego_quita_las_que_delatan_al_grupo():
    ivs = [iv("VOX", cita="Como siempre ha dicho Vox, hay que defender la frontera sur de España."),
           iv("PP", cita="Ustedes han convertido este Congreso en un lugar donde nadie responde a nada.")]
    citas = explora.citas_juego(SESIONES, ivs)
    assert [c[2] for c in citas] == ["PP"]


def test_lugares_separa_lo_central_de_lo_de_pasada():
    mapa = {"Soria": ["municipio", "Castilla y León", "Soria"], "Castilla y León": ["comunidad", "Castilla y León", ""]}
    ivs = [iv("PP", resumen="Pide un tren digno para Soria.", lugares=["Soria"], temas=["ferrocarril"]),
           iv("VOX", resumen="Critica la ley del cine.", lugares=["Soria"], temas=["cine"]),
           iv("PSOE", resumen="Defiende la inversión en Castilla y León.", lugares=["Castilla y León"], temas=[])]
    r = explora.lugares(SESIONES, ivs, mapa, {})
    assert r["Soria"]["n"] == 1 and r["Soria"]["temas"] == [["ferrocarril", 1]] and len(r["Soria"]["pasada"]) == 1
    assert r["Soria"]["comunidad"]["nombre"] == "Castilla y León" and r["Soria"]["comunidad"]["n"] == 1
    assert r["Madrid"]["comunidad"] is None          # comunidad de una sola provincia: cuenta como la provincia


def test_radar_unifica_etiquetas():
    ivs = [iv("PP", temas=["DANA"]), iv("PSOE", temas=["gota fría"]), iv("VOX", temas=["dana", "Gota fría"])]
    canon = {"dana": ["DANA", "clima"], "gota fría": ["DANA", "clima"]}
    r = explora.radar(SESIONES, ivs, canon, minimo=1)
    assert r["temas"]["DANA"]["n"] == 3 and r["temas"]["DANA"]["grupos"] == {"PP": 1, "PSOE": 1, "VOX": 1}


def test_retos_del_dia_fijados():
    """Cada día tiene su reto, y uno ya calculado no cambia aunque cambien las citas."""
    from datetime import date
    from escano import explora
    dips = [[f"Apellido{i} Uno, Nombre{i}", g] for i, g in enumerate(explora.GRUPOS_JUEGO * 4)]
    citas = [[f"Frase {i} de {d[0]}", d[0].partition(",")[0], d[1], "DSCD-15-PL-1", "2025-01-01"]
             for i, d in enumerate(dips)]
    todos, ventana = explora.retos(citas, dips, {}, date(2026, 10, 1), antes=1, despues=2)
    assert list(ventana) == ["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]
    hoy = todos["2026-10-01"]
    assert len(hoy) == 10 and hoy != todos["2026-10-02"]
    assert len({r["c"][1] for r in hoy}) == 10
    assert all(r["c"][2] in r["grupos"] and len(set(r["grupos"])) == 4 for r in hoy)
    assert all(r["c"][1] in r["personas"] and len(set(r["personas"])) == len(r["personas"]) for r in hoy)
    # Mañana entran frases nuevas: lo ya fijado se queda igual y solo se añade el día que falta.
    otras = citas + [["Una frase nueva", "Apellido0 Uno", "PSOE", "DSCD-15-PL-2", "2026-10-02"]]
    todos2, _ = explora.retos(otras, dips, todos, date(2026, 10, 2), antes=1, despues=2)
    assert all(todos2[f] == todos[f] for f in todos)
    assert set(todos2) - set(todos) == {"2026-10-04"}


def test_reto_una_persona_aunque_se_escriba_distinto():
    from escano import explora
    dips = [["Vidal Uno, Álvaro", "ERC"], ["Otro Dos, Ana", "ERC"], ["Otra Tres, Eva", "ERC"]]
    citas = [["a", "Álvaro Vidal", "ERC", "s", "f"], ["b", "Alvaro Vidal", "ERC", "s", "f"],
             ["c", "Vidal Uno", "ERC", "s", "f"], ["d", "Otro Dos", "ERC", "s", "f"], ["e", "Otra Tres", "ERC", "s", "f"]]
    for f in ("2026-01-01", "2026-01-02", "2026-01-03"):
        r = explora.reto(citas, explora.nombres_oradores(citas, dips), f)
        claves = [explora._sin_tildes(o) for x in r for o in x["personas"]]
        assert all(len(set(map(explora._sin_tildes, x["personas"]))) == len(x["personas"]) for x in r)
        assert len({explora._sin_tildes(x["c"][1]) for x in r}) == len(r) and claves
