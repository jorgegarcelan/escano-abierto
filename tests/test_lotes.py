"""Lotes de la Batch API con una API de Google simulada: cola llena, respuestas rotas y cortes a mitad."""
import json

import pytest

from escano import analisis, lotes, votaciones

TEXTO = "Señorías, " + "el Gobierno debe explicar qué ha pasado en Ceuta este verano. " * 8


def _iv(orden, orador, grupo, extra=""):
    return {"orden": orden, "orador": orador, "cargo": None, "grupo": grupo, "item": "Pregunta sobre Ceuta",
            "exp": None, "seccion": "PREGUNTAS", "texto": f"{extra}{TEXTO}", "reacciones": {}}


class GoogleFalso:
    """Guarda los lotes como Google: sobrevive a que el proceso local muera (es la misma instancia)."""

    def __init__(self, llenas=0, rotas=(), corte_tras_crear=False):
        self.ficheros, self.lotes, self.creados = {}, {}, 0
        self.llenas, self.rotas, self.corte_tras_crear = llenas, set(rotas), corte_tras_crear

    def __call__(self):  # lotes.Api() devuelve esta misma instancia
        return self

    def subir(self, ruta, nombre):
        nombre_f = f"files/{len(self.ficheros)}"
        self.ficheros[nombre_f] = [json.loads(x) for x in ruta.read_text().splitlines()]
        return nombre_f

    def crear(self, fichero, nombre):
        if self.llenas:
            self.llenas -= 1
            return None
        self.creados += 1
        lote = f"batches/{self.creados}"
        self.lotes[lote] = (nombre, fichero)
        if self.corte_tras_crear:
            self.corte_tras_crear = False
            raise KeyboardInterrupt  # el proceso muere antes de apuntar el nombre del lote
        return lote

    def buscar(self, nombre):
        return next((lote for lote, (n, _) in self.lotes.items() if n == nombre), None)

    def consultar(self, lote):
        return {"metadata": {"state": "BATCH_STATE_SUCCEEDED"}, "response": {"responsesFile": self.lotes[lote][1]}}

    def descargar(self, fichero, destino):
        lineas = []
        for pet in self.ficheros[fichero]:
            texto = pet["request"]["contents"][0]["parts"][0]["text"]
            if "Seguid" in texto and pet["key"] not in self.rotas:  # la intervención que falla una vez
                self.rotas.add(pet["key"])
                lineas.append({"key": pet["key"], "response": {"candidates": [{"content": {"parts": [{"text": "{roto"}]},
                                                                                "finishReason": "MAX_TOKENS"}]}})
                continue
            if texto.startswith(analisis.HERRAMIENTA_SESION["description"]):
                datos = {"titular": "Ceuta", "resumen": "Sesión sobre Ceuta.", "titulos": ["Ceuta"], "momentos": []}
            else:
                datos = {"resumen": "Pide explicaciones.", "en_una_frase": "Pide explicaciones sobre Ceuta.",
                         "tono": "crítico", "intensidad": 3, "temas": ["Ceuta"], "cita": "qué ha pasado en Ceuta",
                         "posicion": "a favor", "responde": "sí", "cifras": [{"cita": "inventada", "dato": "1"}]}
            lineas.append({"key": pet["key"], "response": {
                "candidates": [{"content": {"parts": [{"text": json.dumps(datos)}]}}],
                "usageMetadata": {"promptTokenCount": 1000, "candidatesTokenCount": 400}}})
        destino.write_text("\n".join(json.dumps(x) for x in lineas))


@pytest.fixture
def entorno(tmp_path, monkeypatch):
    for sub in ("sesiones", "votaciones", "analisis", "lotes"):
        (tmp_path / sub).mkdir()
    monkeypatch.setattr(lotes, "SESIONES", tmp_path / "sesiones")
    monkeypatch.setattr(votaciones, "VOTACIONES", tmp_path / "votaciones")
    monkeypatch.setattr(analisis, "ANALISIS", tmp_path / "analisis")
    monkeypatch.setattr(lotes, "DIR", tmp_path / "lotes")
    monkeypatch.setattr(lotes, "ESTADO", tmp_path / "lotes" / "estado.json")
    monkeypatch.setattr(lotes, "PROVEEDOR", "gemini")
    monkeypatch.setattr(lotes, "ESPERA_COLA_LLENA", 0)
    monkeypatch.setattr(lotes.time, "sleep", lambda s: None)
    ivs = [_iv(1, "Presidenta", "MESA"), _iv(2, "Núñez Feijóo", "PP"), _iv(3, "Sánchez Pérez-Castejón", "GOB"),
           _iv(4, "Rufián Romero", "ERC", "Seguidamente, ")]
    (tmp_path / "sesiones" / "DSCD-15-PL-205.json").write_text(json.dumps({
        "id": "DSCD-15-PL-205", "serie": "PL", "fecha": "2026-09-16", "organo": "Pleno", "intervenciones": ivs}))
    return tmp_path


def test_pendientes_espera_a_las_intervenciones_para_el_resumen(entorno):
    pend = lotes.pendientes()
    assert [p["tipo"] for p in pend] == ["intervencion"] * 3      # la Mesa no se analiza; el resumen, aún no
    for p in pend:
        analisis.guardar(p, {"resumen": "R.", "tono": "crítico", "intensidad": 2, "temas": [], "cita": None})
    assert [p["tipo"] for p in lotes.pendientes()] == ["sesion"]
    assert lotes.pendientes() == lotes.pendientes()                # determinista: mismas claves siempre


def test_lote_completo_con_cola_llena_y_respuesta_rota(entorno, monkeypatch):
    google = GoogleFalso(llenas=1)
    monkeypatch.setattr(lotes, "Api", google)
    lotes.ejecutar(espera=0)
    assert lotes.pendientes() == []                                # todo analizado, resumen de sesión incluido
    assert len(list((entorno / "analisis").glob("*.json"))) == 4
    estado = lotes.leer_estado()
    assert list(estado["intentos"].values()) == [1]                # la respuesta rota se reintentó una vez
    guardado = json.loads(next(p for p in (entorno / "analisis").glob("*.json")
                               if "Pide" in p.read_text()).read_text())
    assert guardado["cifras"] == [] and guardado["posicion"] == "no aplica"  # depurado igual que en directo
    assert google.creados == 3                                     # intervenciones, reintento y resumen


def test_un_corte_tras_crear_el_lote_no_lo_manda_dos_veces(entorno, monkeypatch):
    google = GoogleFalso(corte_tras_crear=True)
    monkeypatch.setattr(lotes, "Api", google)
    with pytest.raises(KeyboardInterrupt):
        lotes.ejecutar(espera=0)
    assert lotes.leer_estado()["tandas"][0]["estado"] == "creando"
    lotes.ejecutar(espera=0)                                       # relanzar retoma el lote que ya estaba en Google
    assert lotes.pendientes() == []
    primeras = google.ficheros["files/0"]
    assert len(primeras) == 3 and google.creados == 3


def test_limite(entorno, monkeypatch):
    google = GoogleFalso()
    monkeypatch.setattr(lotes, "Api", google)
    lotes.ejecutar(limite=1, espera=0)
    assert google.creados == 1 and len(lotes.pendientes()) == 2
