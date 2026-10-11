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
    [v] = llamamiento.de_sesion(ses)
    assert (v["id"], v["si"], v["no"], v["abst"], v["aprobada"], v["exp"]) == ("203-1", 2, 1, 0, True, "130/000055")
    assert v["tipo"] == "Convalidación o derogación de Reales Decretos-leyes" and v["llamamiento"]
    assert v["titulo"].startswith("Real Decreto-ley 26/2026") and "expediente" not in v["titulo"]
    assert {d["diputado"]: d["voto"] for d in v["votos"]}["Álvaro Vidal, Francesc-Marc"] == "S"


def test_llamamiento_que_no_cuadra_no_se_guarda(tmp_path, monkeypatch):
    ses = _preparar(tmp_path, monkeypatch, "votos emitidos, 3; votos a favor, 1; votos en contra, 2")
    assert llamamiento.de_sesion(ses) == []
