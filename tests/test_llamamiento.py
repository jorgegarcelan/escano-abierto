import json

from escano import llamamiento, votaciones


def _preparar(tmp_path, monkeypatch, resultado):
    monkeypatch.setattr(llamamiento, "VOTACIONES", tmp_path)
    monkeypatch.setattr(votaciones, "VOTACIONES", tmp_path)
    (tmp_path / "2026-09-30.json").write_text(json.dumps({
        "diputados": [["Vergara Román, Laura", "PSOE", 1], ["Álvaro Vidal, Francesc-Marc", "ERC", 2],
                      ["Tellado Filgueira, Miguel", "PP", 3]],
        "votaciones": [{"id": "202-1", "sesion": 202, "numero": 1, "v": "SSN"}]}))
    return {"id": "DSCD-15-PL-210", "fecha": "2026-10-02", "sesion": 203, "ds": "https://ejemplo.es/ds.pdf",
            "intervenciones": [
                {"item": "Real Decreto Ley 26/2026, de 29 de septiembre, de vivienda. (Número de expediente. 130/000055)",
                 "exp": "130/000055",
                 "texto": "Se procede al llamamiento. Señoras y señores diputados que dijeron «sí»: Vergara Román, Laura "
                          "Álvaro Vidal, Francesc‑Marc cve: DSCD-15-PL-210 DIARIO DE SESIONES DEL CONGRESO DE LOS DIPUTADOS "
                          "Miembros de la Mesa que dijeron «no»: Tellado Filgueira, Miguel"},
                {"texto": "Efectuado el recuento, dijo"},
                {"texto": f"El resultado de la votación ha sido el siguiente: {resultado}. En consecuencia, queda convalidado."}]}


def test_llamamiento_cuadra(tmp_path, monkeypatch):
    ses = _preparar(tmp_path, monkeypatch, "votos emitidos, 3; votos a favor, 2; votos en contra, 1")
    [v] = llamamiento.juntar([], [], llamamiento.de_sesion(ses))   # el número lo pone juntar(), con las electrónicas
    assert (v["id"], v["si"], v["no"], v["abst"], v["aprobada"], v["exp"]) == ("203-1", 2, 1, 0, True, "130/000055")
    assert v["tipo"] == "Convalidación o derogación de Reales Decretos-leyes" and v["llamamiento"]
    assert v["titulo"].startswith("Real Decreto-ley 26/2026") and "expediente" not in v["titulo"]
    assert {d["diputado"]: d["voto"] for d in v["votos"]}["Álvaro Vidal, Francesc-Marc"] == "S"


def test_llamamiento_que_no_cuadra_no_se_guarda(tmp_path, monkeypatch):
    ses = _preparar(tmp_path, monkeypatch, "votos emitidos, 3; votos a favor, 1; votos en contra, 2")
    assert llamamiento.de_sesion(ses) == []


def test_formatos_de_investidura(tmp_path, monkeypatch):
    """Nombres con punto, «M.a» frente a «Mª», nombre completo frente al corto, nota al pie en mitad de la lista (con un
    «No.» suelto), voto nulo, ausentes, encabezado con llamada a nota y resultado con acotaciones."""
    monkeypatch.setattr(llamamiento, "VOTACIONES", tmp_path)
    monkeypatch.setattr(votaciones, "VOTACIONES", tmp_path)
    monkeypatch.setattr(llamamiento, "SESIONES", tmp_path / "sesiones")
    (tmp_path / "2023-09-21.json").write_text(json.dumps({
        "diputados": [["Núñez Feijóo, Alberto", "PP", 1], ["Moreno Fernández, Mª Isabel", "PSOE", 2],
                      ["Pujol Bonell, Eduard", "JUNTS", 3], ["Rodríguez Suárez, Esther", "PSOE", 4],
                      ["Gómez Ausente, Ana", "PP", 5]],
        "votaciones": [{"id": "4-1", "sesion": 4, "numero": 1, "v": "SNNNS"}]}))
    ses = {"id": "DSCD-15-PL-6", "fecha": "2023-09-29", "sesion": 6, "ds": "",
           "intervenciones": [
               {"orador": "Núñez Feijóo", "cargo": "Candidato a la Presidencia del Gobierno", "texto": "Señorías…"},
               {"item": None, "texto":
                "Por los secretarios se procede al llamamiento. Señoras y señores diputados que dijeron «sí»: "
                "Núñez Feijóo, Alberto. Señoras y señores diputados que dijeron «no»: Moreno Fernández, M.a Isabel. "
                "Rodríguez Suárez, Asunción Esther. 1 Realizado por la señora secretaria el llamamiento del señor Pujol "
                "Bonell, este dijo «sí» y se corrigió. No. Votos nulos: Pujol Bonell, Eduard1 Señoras y señores "
                "diputados ausentes: Gómez Ausente, Ana. Miembros del Gobierno en funciones que dijeron «no»5 . "
                "Terminada la votación, dijo"},
               {"texto": "votos emitidos, 4; votos a favor del candidato, 1. (Protestas). Silencio. Votos en contra "
                         "del candidato, 2 (rumores);unvotonulo. Al no haberse alcanzado la mayoría requerida…"}]}
    [v] = llamamiento.de_sesion(ses)
    assert (v["si"], v["no"], v["abst"], v["novota"], v["aprobada"]) == (1, 2, 0, 2, False)
    assert v["tipo"] == "Investidura"
    assert v["titulo"] == "Investidura de Alberto Núñez Feijóo como presidente del Gobierno."
    votos = {d["diputado"]: d["voto"] for d in v["votos"]}
    assert votos["Rodríguez Suárez, Esther"] == "N" and votos["Moreno Fernández, Mª Isabel"] == "N"
    assert votos["Pujol Bonell, Eduard"] == "X" and votos["Gómez Ausente, Ana"] == "X"


def test_resultado_y_aprobada():
    r, frase, _ = llamamiento._resultado("votos emitidos, 344; sí, 312; no, 32. En consecuencia, queda aprobada la reforma.")
    assert (r["emitidos"], r["si"], r["no"], r["abst"]) == (344, 312, 32, 0) and llamamiento._aprobada(frase, 312, 32)
    r, frase, _ = llamamiento._resultado("Votos emitidos 350; votos sí, 171; votos no, 179; abstenciones, ninguna. En "
                                         "consecuencia, al no haberse obtenido la mayoría absoluta… se devuelve a la Comisión")
    assert (r["si"], r["no"], r["abst"]) == (171, 179, 0) and not llamamiento._aprobada(frase, 171, 179)
    assert llamamiento._resultado("Pido los votos emitidos. (Pausa). Efectuado el recuento, dijo") is None


def _v(id, si, no, votos, **extra):
    return {"id": id, "sesion": 15, "numero": int(id.split("-")[1]), "titulo": "Real Decreto-ley 8/2023, de 27 de diciembre",
            "tipo": "Convalidación o derogación de Reales Decretos-leyes", "subgrupo": "", "exp": None,
            "si": si, "no": no, "abst": 0, "votos": [{"diputado": n, "voto": x} for n, x in votos.items()], **extra}


def test_juntar_con_las_electronicas():
    nueva = _v("15-0", 2, 1, {"A": "S", "B": "S", "C": "N"}, llamamiento="DSCD-15-PL-16#220", titulo="Real Decreto-ley 8/2023")
    # Datos abiertos incompletos (falta B) y coherentes: se sustituyen, con su id y su título.
    [v] = llamamiento.juntar([_v("15-4", 1, 1, {"A": "S", "B": "X", "C": "N"})], [], [nueva])
    assert (v["id"], v["si"], v["llamamiento"], v["titulo"]) == ("15-4", 2, "DSCD-15-PL-16#220", "Real Decreto-ley 8/2023, de 27 de diciembre")
    # Completos e iguales: no se repite.
    assert llamamiento.juntar([_v("15-4", 2, 1, {"A": "S", "B": "S", "C": "N"})], [], [nueva])[0].get("llamamiento") is None
    # Otra votación (votos que no casan): va aparte, con el número siguiente; y en otra pasada, el mismo id.
    otra = llamamiento.juntar([_v("15-4", 1, 2, {"A": "N", "B": "X", "C": "N"})], [], [nueva])
    assert [x["id"] for x in otra] == ["15-4", "15-5"]
    again = llamamiento.juntar([_v("15-4", 1, 2, {"A": "N", "B": "X", "C": "N"})], [otra[1]], [nueva])
    assert [x["id"] for x in again] == ["15-4", "15-5"]
