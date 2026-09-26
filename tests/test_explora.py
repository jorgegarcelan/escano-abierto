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
