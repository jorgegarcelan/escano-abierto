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
