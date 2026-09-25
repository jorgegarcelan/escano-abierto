from escano.votaciones import leer_votacion, normaliza_voto, posicion_grupo


def _fila(nombre, grupo, voto):
    return {"asiento": "1", "diputado": nombre, "grupo": grupo, "voto": voto}


DATOS = {
    "informacion": {"sesion": 200, "numeroVotacion": 5, "fecha": "23/9/2026",
                    "titulo": "Mociones consecuencia de interpelaciones urgentes.",
                    "textoExpediente": "Moción consecuencia de interpelación urgente del Grupo Parlamentario Popular en el Congreso, sobre la nefasta política educativa de su Gobierno."},
    "totales": {"asentimiento": "No", "presentes": 6, "afavor": 3, "enContra": 2, "abstenciones": 0, "noVotan": 1},
    "votaciones": [
        _fila("Uno, A", "GP", "Sí"), _fila("Dos, B", "GP", "Sí"), _fila("Tres, C", "GJxCAT", "Sí"),
        _fila("Cuatro, D", "GS", "No"), _fila("Cinco, E", "GV (EAJ-PNV)", "No"), _fila("Seis, F", "GS", "No vota"),
    ],
}


def test_normaliza_voto():
    assert [normaliza_voto(v) for v in ["Sí", "No", "Abstención", "No vota"]] == ["S", "N", "A", "X"]


def test_posicion_grupo():
    assert posicion_grupo({"S": 9, "N": 1}) == "S"
    assert posicion_grupo({"S": 5, "N": 5}) == "D"
    assert posicion_grupo({"X": 3}) == "X"


def test_leer_votacion():
    v = leer_votacion(DATOS)
    assert v["id"] == "200-5" and v["fecha"] == "2026-09-23"
    assert (v["si"], v["no"], v["novota"]) == (3, 2, 1) and v["aprobada"]
    assert v["grupos"] == {"PP": "S", "JUNTS": "S", "PSOE": "N", "PNV": "N"}
    assert v["conteo"]["PSOE"] == {"N": 1, "X": 1}
    assert v["discrepantes"] == []


def test_formato_compacto_ida_y_vuelta(tmp_path, monkeypatch):
    from escano import votaciones as mv
    monkeypatch.setattr(mv, "VOTACIONES", tmp_path)
    a = mv.derivar({"id": "1-1", "fecha": "2026-09-09", "si": 2, "no": 1, "json": "u", "votos": [
        {"diputado": "A, Ana", "grupo": "PP", "voto": "S", "asiento": 3},
        {"diputado": "B, Bea", "grupo": "PP", "voto": "S", "asiento": None},
        {"diputado": "C, Carlos", "grupo": "PSOE", "voto": "N", "asiento": 7}]})
    b = mv.derivar({"id": "1-2", "fecha": "2026-09-09", "si": 1, "no": 0, "json": "u", "votos": [
        {"diputado": "C, Carlos", "grupo": "PSOE", "voto": "S", "asiento": 7}]})
    mv.guardar_dia("2026-09-09", [a, b])
    assert '"v": "-", ' not in (tmp_path / "2026-09-09.json").read_text()
    x, y = mv.leer_todas()
    assert x == a and y == b                 # nada se pierde al compactar
    assert y["grupos"] == {"PSOE": "S"}
