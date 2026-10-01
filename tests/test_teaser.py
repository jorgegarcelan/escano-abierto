"""Home provisional: se construye con los datos versionados, sin marcadores sueltos y con URLs absolutas."""
import json
import re

from escano import teaser


def test_construye_pagina_completa(tmp_path, monkeypatch):
    monkeypatch.setenv("ESCANO_URL_SITIO", "https://www.escañoabierto.com/")
    c = teaser.construir(tmp_path / "salida")
    html = (tmp_path / "salida" / "index.html").read_text()
    assert "{{" not in html
    assert 'content="https://www.xn--escaoabierto-dhb.com/og.png"' in html
    assert f'data-n="{c["votaciones"]}"' in html and c["votaciones"] > 0
    assert 0 < c["aprobadas"] <= c["iniciativas"]
    assert (tmp_path / "salida" / "404.html").read_text() == html
    assert 'href="/aviso-legal/"' in html
    assert "{{" not in (tmp_path / "salida" / "aviso-legal" / "index.html").read_text()
    for nombre in ("teaser.mp4", "poster.jpg", "og.png", "favicon.svg", "robots.txt"):
        assert (tmp_path / "salida" / nombre).stat().st_size > 0


def test_numeros_a_la_espanola():
    assert teaser._numero(2152) == "2152"
    assert teaser._numero(12345) == "12.345"


def test_escena_del_hemiciclo(tmp_path):
    teaser.construir(tmp_path)
    html = (tmp_path / "index.html").read_text()
    bloque = re.search(r'<script type="application/json" id="escena">(.*?)</script>', html, re.S).group(1)
    e = json.loads(bloque)
    assert len(e["escanos"]) == 350
    assert e["montaje"] and all(len(m["v"]) == 350 and set(m["v"]) <= set("SNAX-") for m in e["montaje"])
    assert e["cinta"] and e["docs"] and e["cifras"]["votaciones"] > 0


def test_juego_quien_lo_dijo(tmp_path):
    """El juego completo de la web, en su propia página, con las mismas citas (el reto del día sale igual)."""
    teaser.construir(tmp_path)
    portada = (tmp_path / "index.html").read_text()
    assert 'id="juego"' in portada and portada.count('href="/quien-lo-dijo/') >= 3
    e = json.loads(re.search(r'<script type="application/json" id="escena">(.*?)</script>', portada, re.S).group(1))
    assert e["muestra"]["cita"] and len(e["muestra"]["grupos"]) == 4
    assert not teaser.TRAMITE.search(e["muestra"]["cita"])
    juego = (tmp_path / "quien-lo-dijo" / "index.html").read_text()
    assert "{{" not in juego and 'id="quien-lo-dijo"' in juego and "og-quien-lo-dijo.png" in juego
    assert '"escano-qld"' in juego and "QLD_N = 10" in juego   # el mismo registro y las mismas reglas que la web
    assert (tmp_path / "og-quien-lo-dijo.png").stat().st_size > 0
    citas = json.loads((tmp_path / "datos" / "explora-citas.json").read_text())
    assert citas == json.loads((teaser.SITIO / "datos" / "explora-citas.json").read_text())
    if (teaser.SITIO / "datos" / "explora-retos.json").exists():
        assert (tmp_path / "datos" / "explora-retos.json").read_text() == (teaser.SITIO / "datos" / "explora-retos.json").read_text()
    d = json.loads(re.search(r'<script type="application/json" id="datos">(.*?)</script>', juego, re.S).group(1))
    assert set(d["grupos"]) == set(teaser.GRUPOS_JUEGO)
    assert d["oradores"] and all(o in {c[1] for c in citas} for o in d["oradores"])
