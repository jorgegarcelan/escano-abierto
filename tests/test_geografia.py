import json

import pytest

from escano import geo, geografia


def test_cada_provincia_en_una_sola_comunidad():
    provincias = [p for _, _, ps in geografia.CCAA.values() for p in ps]
    assert sorted(provincias) == sorted(geo.CIRCUNSCRIPCIONES)
    assert len(provincias) == len(set(provincias)) == 52
    assert len(geografia.CCAA) == 19


def test_area_de_un_grado_en_el_ecuador():
    # Un cuadrado de 1° × 1° junto al ecuador mide unos 111,2 × 110,6 km.
    anillo = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    assert geografia._area_km2(anillo) == pytest.approx(12364, rel=0.01)
    assert geografia._area_km2(anillo[::-1]) == pytest.approx(geografia._area_km2(anillo))


def test_csv_del_atlas(monkeypatch, tmp_path):
    lineas = [
        "﻿Municipios;Distritos;Secciones;Indicadores de renta media;Periodo;Total",
        "01001 Alegría-Dulantzi;;;Renta neta media por persona;2022;15.116",
        "01001 Alegría-Dulantzi;;;Renta neta media por persona;2023;16.429",
        "01001 Alegría-Dulantzi;0100101 Alegría-Dulantzi distrito 01;;Renta neta media por persona;2023;99.999",
        "01001 Alegría-Dulantzi;;;Renta neta media por hogar;2023;40.000",
        "01002 Amurrio;;;Renta neta media por persona;2023;.",
    ]

    class Respuesta:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def raise_for_status(self): pass
        def iter_lines(self, decode_unicode=False): return (x.encode() for x in lineas)

    from escano import red
    monkeypatch.setattr(red._sesion, "get", lambda *a, **k: Respuesta())
    monkeypatch.setattr(geografia, "CRUDOS_GEO", tmp_path)
    d = geografia._csv_atlas(1, {"Renta neta media por persona": "renta"})
    assert d == {"anio": 2023, "municipios": {"01001": {"renta": 16429.0}}}


def test_datos_versionados_cuadran():
    ruta = geografia.CARPETA / "territorios.json"
    if not ruta.exists():
        pytest.skip("sin data/geografia (python -m escano.geografia)")
    t = json.loads(ruta.read_text())
    E = t["espana"]
    assert sum(c["pob"] for c in t["ccaa"].values()) == E["pob"]
    assert sum(p["pob"] for p in t["provincias"].values()) == E["pob"]
    assert sum(p["esc"] for p in t["provincias"].values()) == E["esc"] == 350
    assert all(len(x["serie"]) == len(t["anios"]) for x in [*t["ccaa"].values(), *t["provincias"].values()])
    # La superficie de España, con los límites del IGN: unos 506.000 km².
    assert 500_000 < E["km2"] < 510_000
