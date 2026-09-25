"""Prueba de extremo a extremo con un cliente de Claude simulado (sin red ni API)."""
import json
from dataclasses import asdict
from pathlib import Path
from types import SimpleNamespace

from escano import analisis, construir as mod_construir, votaciones
from escano.diario import dividir

TEXTO = (Path(__file__).parent / "fixtures" / "diario_muestra.txt").read_text()


class ClienteFalso:
    def __init__(self):
        self.messages = self
        self.llamadas = 0

    def create(self, **kw):
        self.llamadas += 1
        herramienta = kw["tool_choice"]["name"]
        if herramienta == "registrar_sesion":
            datos = {"titular": "Ceuta centra el control al Gobierno", "resumen": "Sesión de control centrada en Ceuta.", "titulos": ["Feijóo a Sánchez · imagen de España"]}
        else:
            texto = kw["messages"][0]["content"]
            datos = {"resumen": "Resumen.", "tono": "combativo", "intensidad": 4, "temas": ["Ceuta"],
                     "cita": "hay que temer a quien se lo quiere quitar" if "temer" in texto else "frase inventada",
                     "posicion": "no aplica", "responde": "parcial", "responde_motivo": "Cambia de tema."}
        return SimpleNamespace(content=[SimpleNamespace(type="tool_use", input=datos)])


def test_construir(tmp_path, monkeypatch):
    for mod, nombre, sub in [(mod_construir, "SESIONES", "sesiones"), (mod_construir, "VOTACIONES", "votaciones"),
                             (mod_construir, "SITIO", "site"), (analisis, "ANALISIS", "analisis")]:
        (tmp_path / sub).mkdir(exist_ok=True)
        monkeypatch.setattr(mod, nombre, tmp_path / sub)
    monkeypatch.setattr(mod_construir, "MVP", tmp_path / "sin-mvp.json")
    falso = ClienteFalso()
    monkeypatch.setattr(analisis, "_cliente", lambda: falso)

    ivs = [asdict(i) for i in dividir(TEXTO, {"nunez feijoo": "PP", "nogueras i camero": "JUNTS"})]
    for iv in ivs:  # el fixture es corto; alargamos para superar el mínimo de 250 caracteres
        iv["texto"] = iv["texto"] + " relleno" * 40
    (tmp_path / "sesiones" / "DSCD-15-PL-205.json").write_text(json.dumps({
        "id": "DSCD-15-PL-205", "serie": "PL", "numero": 205, "fecha": "2026-09-16", "sesion": 198,
        "organo": "Pleno", "ds": "https://example/ds.pdf", "intervenciones": ivs}))
    (tmp_path / "votaciones" / "2026-09-23.json").write_text(json.dumps([votaciones.leer_votacion({
        "informacion": {"sesion": 200, "numeroVotacion": 1, "fecha": "23/9/2026", "titulo": "Proposiciones no de Ley.",
                        "textoExpediente": "Proposición no de Ley del Grupo Parlamentario Vasco (EAJ-PNV), sobre la Y vasca."},
        "totales": {"afavor": 1, "enContra": 0, "abstenciones": 0, "noVotan": 0},
        "votaciones": [{"diputado": "Uno, A", "grupo": "GV (EAJ-PNV)", "voto": "Sí"},
                       {"diputado": "Dos, B", "grupo": "GS", "voto": "No vota"}]})]))

    from escano import diputados as mod_dip
    monkeypatch.setattr(mod_dip, "FICHERO", tmp_path / "diputados.json")
    (tmp_path / "diputados.json").write_text(json.dumps(mod_dip.leer_activos([
        {"NOMBRE": "Uno, A", "CIRCUNSCRIPCION": "Bizkaia", "FORMACIONELECTORAL": "EAJ-PNV", "FECHAALTA": "17/08/2023"}])))
    salida = mod_construir.construir(con_ia=True)
    datos, interv = salida["datos"], salida["intervenciones"]
    assert {s["fecha"] for s in datos["sesiones"]} == {"2026-09-16", "2026-09-23"}
    sin_ds = next(s for s in datos["sesiones"] if s["fecha"] == "2026-09-23")
    assert sin_ds["ds"] is None and sin_ds["puntos"][0]["votos"] == ["200-1"]
    assert datos["votaciones"][0]["proponente"] == "PNV"
    assert datos["votaciones"][0]["tipo"] == "Proposición no de ley"
    assert datos["diputados"] == [["Uno, A", "PNV", "Bizkaia", "EAJ-PNV", "2023-08-17"], ["Dos, B", "PSOE", "", "", ""]]
    assert datos["votaciones"][0]["v"] == "SX"                              # una letra por diputado
    assert next(s for s in datos["sesiones"] if s["fecha"] == "2026-09-16")["titular"].startswith("Ceuta")
    assert all(i["g"] != "MESA" for i in interv)
    sanchez = next(i for i in interv if i["orador"] == "Sánchez Pérez-Castejón")
    assert sanchez["cita"] == "hay que temer a quien se lo quiere quitar"   # cita verificada
    assert sanchez["responde"] == "parcial"
    feijoo = next(i for i in interv if i["orador"] == "Núñez Feijóo")
    assert feijoo["cita"] is None                                            # cita inventada descartada
    assert feijoo["responde"] == "no aplica"
    assert json.loads((tmp_path / "site" / "data.json").read_text())["datos"]["sesiones"]

    llamadas = falso.llamadas
    mod_construir.construir(con_ia=True)   # segunda vez: todo sale de la caché
    assert falso.llamadas == llamadas
