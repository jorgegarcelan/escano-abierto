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
