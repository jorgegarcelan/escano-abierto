"""Páginas para compartir: slug igual que la web, etiquetas Open Graph y redirección a la vista."""
from escano import paginas


def test_slug_igual_que_la_web():
    assert paginas.slug("Rufián Romero, Gabriel") == "rufian-romero-gabriel"
    assert paginas.slug("Álvarez de Toledo Peralta-Ramos, Cayetana") == "alvarez-de-toledo-peralta-ramos-cayetana"


def test_pagina_con_open_graph(monkeypatch):
    monkeypatch.setattr(paginas, "URL_SITIO", "https://ejemplo.es")
    h = paginas._pagina("votacion/198-16", "votacion-198-16", "RDL 21/2026", "Derogado por 155 a 179.",
                        "og/votacion/198-16.png").decode()
    assert '<meta property="og:image" content="https://ejemplo.es/og/votacion/198-16.png">' in h
    assert '<meta property="og:title" content="RDL 21/2026">' in h
    assert 'twitter:card" content="summary_large_image"' in h
    assert '../../#votacion-198-16' in h                      # lleva a la vista de la web


def test_resultado():
    v = {"si": 155, "no": 179, "tipo": "Convalidación RDL"}
    assert paginas.resultado(v) == "Derogado"
    assert paginas.resultado({**v, "si": 342, "no": 0, "titulo": "Tramitar el RDL 20/2026 como proyecto de ley"}) == "Aprobada"


def test_rss_valido_y_ordenado(monkeypatch):
    import xml.etree.ElementTree as ET
    monkeypatch.setattr(paginas, "URL_SITIO", "https://ejemplo.es")
    x = paginas.rss("rss.xml", "Escaño Abierto", "Votaciones", "", [
        {"id": "a", "fecha": "2026-09-09", "titulo": "Vieja & <rara>", "desc": "d", "enlace": "votacion/1/"},
        {"id": "b", "fecha": "2026-09-23", "titulo": "Nueva", "desc": "d", "enlace": "votacion/2/"},
        {"id": "c", "fecha": "2026-01-15", "titulo": "Invierno", "desc": "d", "enlace": "votacion/3/"}])
    items = ET.fromstring(x).find("channel").findall("item")
    assert [i.findtext("title") for i in items] == ["Nueva", "Vieja & <rara>", "Invierno"]
    assert items[0].findtext("link") == "https://ejemplo.es/votacion/2/"
    assert items[0].findtext("pubDate") == "Wed, 23 Sep 2026 12:00:00 +0200"   # horario de verano
    assert items[2].findtext("pubDate").endswith("+0100")                      # y de invierno


def test_rss_diputado_solo_lo_destacable():
    d = ["Ruiz, Ana", "PP", "Madrid", "PP", "", None, None, None]
    vs = [{"id": "1-1", "fecha": "2026-09-09", "titulo": "Ley A", "tipo": "Moción", "si": 200, "no": 150,
           "v": "SN", "grupos": {"PP": "S"}},
          {"id": "1-2", "fecha": "2026-09-09", "titulo": "Ley B", "tipo": "Moción", "si": 200, "no": 150,
           "v": "NS", "grupos": {"PP": "S"}},
          {"id": "1-3", "fecha": "2026-09-10", "titulo": "Ley C", "tipo": "Moción", "si": 200, "no": 150,
           "v": "XS", "grupos": {"PP": "S"}}]
    ivs = [("ruiz-1", {"s": "DSCD-15-PL-1", "item": "P2 · Vivienda", "resumen": "Pide más vivienda.", "cita": None})]
    e = paginas._entradas_diputado(0, d, vs, ivs, {"DSCD-15-PL-1": "2026-09-11"})
    assert [x["titulo"] for x in e] == ["Vota no, su grupo sí: Ley B", "Interviene: Vivienda"]
