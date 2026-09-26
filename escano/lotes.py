"""Análisis de toda la legislatura con la Batch API de Gemini: mitad de precio, resultados en horas.

    python -m escano lote              # manda lo pendiente, espera y guarda; se puede cortar y relanzar
    python -m escano lote --estado     # cómo va, sin tocar nada
    python -m escano lote --limite 20  # solo 20 peticiones (para probar)
    python -m escano lote --cancelar   # cancela los lotes en marcha; lo ya guardado se conserva

Salvaguardas para no perder nada ni pagar dos veces:
- El estado vive en data/raw/lotes/estado.json y se escribe de forma atómica tras cada paso. Si el proceso
  muere (corte de red, portátil dormido, Ctrl+C), relanzarlo retoma los lotes que ya están en Google.
- Antes de crear un lote se apunta su nombre visible; si el corte llega justo después de crearlo, se reencuentra
  por ese nombre en vez de mandarlo otra vez.
- Las respuestas se descargan enteras a disco antes de procesarlas, y cada análisis válido va a la caché
  (data/analisis/) al momento. Procesar dos veces la misma respuesta no cambia nada.
- Lo que falla (respuesta sin JSON válido, error de una petición, lote caducado) vuelve a la cola, hasta
  MAX_INTENTOS por petición. Lo que siga fallando lo hará `construir` una a una con la API normal.
- Respeta el límite de tokens en cola de la cuenta: si Google rechaza un lote nuevo (429), espera a que acabe otro.
- Un cerrojo impide que dos procesos trabajen a la vez sobre el mismo estado.

Los resúmenes de sesión se piden cuando ya están todas sus intervenciones, porque se escriben a partir de ellas.
"""
from __future__ import annotations

import fcntl
import json
import os
import time
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from . import analisis
from .config import CRUDOS, MODELO, PROVEEDOR, SESIONES
from .construir import analisis_de_sesion, votos_por_fecha

DIR = CRUDOS / "lotes"
ESTADO = DIR / "estado.json"
MAX_INTENTOS = 3
TOKENS_TANDA = 150_000         # por lote (~100 intervenciones, <1 MB): con subidas lentas, los ficheros grandes
                               # se cortan; la cuenta de nivel 1 admite 3 M de tokens en cola en total
ENVIOS_POR_VUELTA = 10         # lotes nuevos entre dos consultas de los que ya están en marcha
MAX_FALLOS_ENVIO = 10          # envíos fallidos seguidos (subida o creación) antes de parar
CARACTERES_POR_TOKEN = 4.0     # medido: 4,25 en español; se redondea a la baja para no quedarse corto
TOKENS_ESQUEMA = 300           # lo que suma cada petición además del texto
ESPERA = 60                    # segundos entre consultas
MAX_LOTES_FALLIDOS = 3         # lotes enteros fallidos seguidos antes de parar a mirar qué pasa
ESPERA_COLA_LLENA = 900        # tras un 429, segundos antes de volver a intentarlo si no acaba ningún lote
# gemini-3.8-flash por lotes, en $ por millón de tokens (precio de promoción hasta el 31-12-2026; luego, el doble)
PRECIO_ENTRADA, PRECIO_SALIDA = 0.375, 1.875

FINALES = {"SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"}


def _log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


# ---------------------------------------------------------------- estado en disco

def _escribir(ruta: Path, texto: str) -> None:
    tmp = ruta.with_name(ruta.name + ".tmp")
    tmp.write_text(texto)
    os.replace(tmp, ruta)


def leer_estado() -> dict:
    if ESTADO.exists():
        return json.loads(ESTADO.read_text())
    return {"modelo": MODELO, "version": analisis.VERSION_PROMPT, "tandas": [], "intentos": {}, "errores": {},
            "lotes_fallidos_seguidos": 0}


def guardar_estado(estado: dict) -> None:
    DIR.mkdir(parents=True, exist_ok=True)
    _escribir(ESTADO, json.dumps(estado, ensure_ascii=False, indent=1))


@contextmanager
def cerrojo():
    DIR.mkdir(parents=True, exist_ok=True)
    with open(DIR / ".cerrojo", "w") as f:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit("Ya hay otro proceso de lote en marcha.") from None
        yield


# ---------------------------------------------------------------- API REST

class Api:
    BASE = "https://generativelanguage.googleapis.com"

    def __init__(self):
        import requests
        self.requests = requests
        self.sesion = requests.Session()
        # La clave va en cabecera (nunca en la URL): no aparece en errores ni registros.
        self.sesion.headers["x-goog-api-key"] = os.environ["GEMINI_API_KEY"]

    def _pedir(self, metodo: str, url: str, **kw):
        """Reintenta cortes de red y errores 5xx con esperas crecientes (hasta ~1 h en total)."""
        for intento in range(12):
            try:
                r = self.sesion.request(metodo, url, timeout=300, **kw)
            except self.requests.RequestException as e:
                _log(f"  red: {type(e).__name__}; reintento {intento + 1}")
            else:
                if r.status_code < 500:
                    return r
                _log(f"  Google respondió {r.status_code}; reintento {intento + 1}")
            time.sleep(min(600, 5 * 2 ** intento))
        raise RuntimeError(f"Sin respuesta de Google tras varios intentos: {metodo} {url.split('?')[0]}")

    @staticmethod
    def _ok(r, que: str) -> dict:
        if r.status_code != 200:
            raise RuntimeError(f"{que}: Google respondió {r.status_code}: {r.text[:500]}")
        return r.json() if r.content else {}

    def subir(self, ruta: Path, nombre: str) -> str:
        """Subida reanudable por trozos: si la conexión se corta, pregunta a Google cuánto recibió y sigue.

        Con conexiones lentas (unos 30 KB/s) un fichero de 13 MB tarda varios minutos; por eso el límite de
        tiempo es por trozo y holgado (en Python, el de un envío cuenta para el envío entero).
        """
        tam = ruta.stat().st_size
        r = self._pedir("POST", f"{self.BASE}/upload/v1beta/files", json={"file": {"display_name": nombre}}, headers={
            "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": str(tam), "X-Goog-Upload-Header-Content-Type": "application/jsonl"})
        self._ok(r, "Inicio de la subida")
        url = r.headers["X-Goog-Upload-URL"]
        trozo = int(r.headers.get("X-Goog-Upload-Chunk-Granularity", 8 << 20))  # Google exige múltiplos de esto
        desde, fallos = 0, 0
        with open(ruta, "rb") as f:
            while True:
                f.seek(desde)
                datos = f.read(trozo)
                ultimo = desde + len(datos) >= tam
                try:
                    r = self.sesion.post(url, data=datos, timeout=(30, 3600), headers={
                        "X-Goog-Upload-Offset": str(desde),
                        "X-Goog-Upload-Command": "upload, finalize" if ultimo else "upload"})
                    if r.status_code >= 500:
                        raise self.requests.RequestException(f"Google respondió {r.status_code}")
                    if ultimo:
                        return self._ok(r, "Subida")["file"]["name"]
                    self._ok(r, "Subida de un trozo")
                    desde += len(datos)
                    _log(f"  subidos {desde / 2**20:.0f} de {tam / 2**20:.0f} MB")
                except self.requests.RequestException as e:
                    fallos += 1
                    if fallos > 12:
                        raise RuntimeError(f"No se pudo subir {ruta.name}") from e
                    _log(f"  subida cortada ({type(e).__name__}); se retoma, intento {fallos}")
                    time.sleep(min(300, 5 * 2 ** fallos))
                    q = self._pedir("POST", url, headers={"X-Goog-Upload-Command": "query"})
                    if q.headers.get("X-Goog-Upload-Status") != "active":  # sesión caducada o ya cerrada
                        return self.subir(ruta, nombre)
                    desde = int(q.headers.get("X-Goog-Upload-Size-Received", 0))

    def crear(self, fichero: str, nombre: str) -> str | None:
        """Nombre del lote creado, o None si la cuenta tiene la cola llena (429)."""
        r = self._pedir("POST", f"{self.BASE}/v1beta/models/{MODELO}:batchGenerateContent",
                        json={"batch": {"display_name": nombre, "input_config": {"file_name": fichero}}})
        if r.status_code == 429:
            return None
        return self._ok(r, "Creación del lote")["name"]

    def consultar(self, lote: str) -> dict:
        return self._ok(self._pedir("GET", f"{self.BASE}/v1beta/{lote}"), "Consulta del lote")

    def buscar(self, nombre: str) -> str | None:
        """Lote ya creado con ese nombre visible (por si el corte llegó justo después de crearlo)."""
        pagina = ""
        for _ in range(50):
            j = self._ok(self._pedir("GET", f"{self.BASE}/v1beta/batches",
                                     params={"pageSize": 100, **({"pageToken": pagina} if pagina else {})}),
                         "Lista de lotes")
            for op in j.get("operations", []) + j.get("batches", []):
                meta = op.get("metadata", op)
                if meta.get("displayName") == nombre or meta.get("display_name") == nombre:
                    return op["name"]
            pagina = j.get("nextPageToken")
            if not pagina:
                return None
        return None

    def descargar(self, fichero: str, destino: Path) -> None:
        parcial = destino.with_name(destino.name + ".part")
        for intento in range(6):
            try:
                with self.sesion.get(f"{self.BASE}/download/v1beta/{fichero}:download", params={"alt": "media"},
                                     stream=True, timeout=300) as r:
                    if r.status_code != 200:
                        raise RuntimeError(f"descarga: {r.status_code} {r.text[:300]}")
                    with open(parcial, "wb") as f:
                        for trozo in r.iter_content(1 << 20):
                            f.write(trozo)
                os.replace(parcial, destino)
                return
            except (self.requests.RequestException, RuntimeError) as e:
                _log(f"  descarga fallida ({e}); reintento {intento + 1}")
                time.sleep(min(600, 10 * 2 ** intento))
        raise RuntimeError(f"No se pudieron descargar las respuestas de {fichero}")

    def cancelar(self, lote: str) -> None:
        self._pedir("POST", f"{self.BASE}/v1beta/{lote}:cancel")


def _estado_lote(op: dict) -> tuple[str, dict, str | None]:
    """(estado normalizado, estadísticas, fichero de respuestas) de la operación de un lote."""
    meta = op.get("metadata", {})
    estado = (meta.get("state") or "").rsplit("_", 1)[-1] or ("SUCCEEDED" if op.get("done") else "PENDING")
    resp = op.get("response", {})
    fichero = resp.get("responsesFile") or meta.get("output", {}).get("responsesFile")
    return estado, meta.get("batchStats", {}), fichero


# ---------------------------------------------------------------- qué falta

def pendientes(abandonadas: set[str] = frozenset()) -> list[dict]:
    """Peticiones sin respuesta en la caché, calculadas igual que en `construir` (mismas claves)."""
    analisis.RECOGER = []
    try:
        por_fecha = votos_por_fecha()
        for f in sorted(SESIONES.glob("*.json")):
            ses = json.loads(f.read_text())
            if not ses.get("fecha"):
                continue
            antes = len(analisis.RECOGER)
            analisis_de_sesion(ses, por_fecha.get(ses["fecha"], []) if ses["serie"] == "PL" else [])
            nuevas = analisis.RECOGER[antes:]
            if any(p["tipo"] == "intervencion" and p["clave"] not in abandonadas for p in nuevas):
                # Faltan intervenciones: el resumen de la sesión cambiaría al tenerlas, así que se pide después.
                analisis.RECOGER[antes:] = [p for p in nuevas if p["tipo"] == "intervencion"]
        vistas, salida = set(), []
        for p in analisis.RECOGER:  # un mismo texto puede repetirse: basta pedirlo una vez
            if p["clave"] not in vistas:
                vistas.add(p["clave"])
                salida.append(p)
        return salida
    finally:
        analisis.RECOGER = None


def _tokens(p: dict) -> int:
    return int(len(p["mensaje"]) / CARACTERES_POR_TOKEN) + TOKENS_ESQUEMA


# ---------------------------------------------------------------- tandas

def _rutas(tid: str) -> dict[str, Path]:
    return {k: DIR / f"{tid}-{k}.jsonl" for k in ("peticiones", "contexto", "respuestas")}


def preparar_tanda(estado: dict, peticiones: list[dict]) -> dict:
    """Escribe a disco el fichero que se sube y el contexto para procesar las respuestas."""
    tid = f"t{len(estado['tandas']) + 1:04d}"
    rutas = _rutas(tid)
    with open(rutas["peticiones"], "w") as fp, open(rutas["contexto"], "w") as fc:
        for p in peticiones:
            fp.write(json.dumps({"key": p["clave"], "request": analisis.cuerpo_gemini(p)}, ensure_ascii=False) + "\n")
            fc.write(json.dumps({k: v for k, v in p.items() if k != "mensaje"}, ensure_ascii=False) + "\n")
    tanda = {"id": tid, "nombre": f"escano-{analisis.VERSION_PROMPT}-{tid}-{int(time.time())}", "lote": None,
             "fichero": None, "estado": "preparada", "n": len(peticiones),
             "tokens": sum(map(_tokens, peticiones)), "creada": datetime.now().isoformat(timespec="seconds")}
    estado["tandas"].append(tanda)
    guardar_estado(estado)
    return tanda


def enviar(api: Api, estado: dict, tanda: dict) -> bool:
    """Sube y crea el lote. False si la cola de la cuenta está llena (se reintentará más tarde)."""
    if not tanda["fichero"]:
        tanda["fichero"] = api.subir(_rutas(tanda["id"])["peticiones"], tanda["nombre"])
        tanda["estado"] = "subida"
        guardar_estado(estado)
    tanda["estado"] = "creando"  # si el proceso muere ahora, al volver se busca por nombre antes de repetir
    guardar_estado(estado)
    try:
        lote = api.crear(tanda["fichero"], tanda["nombre"])
    except RuntimeError as e:
        if "404" in str(e) or "not found" in str(e).lower():  # el fichero subido caducó (48 h): se vuelve a subir
            tanda["fichero"], tanda["estado"] = None, "preparada"
            guardar_estado(estado)
            return False
        raise
    if lote is None:
        tanda["estado"] = "subida"
        guardar_estado(estado)
        return False
    tanda["lote"], tanda["estado"] = lote, "PENDING"
    guardar_estado(estado)
    _log(f"{tanda['id']}: lote creado con {tanda['n']} peticiones (~{tanda['tokens'] / 1e6:.1f} M tokens)")
    return True


def procesar_respuestas(estado: dict, tanda: dict) -> None:
    """Guarda en la caché cada respuesta válida; lo demás suma un intento y vuelve a la cola."""
    rutas = _rutas(tanda["id"])
    contexto = {}
    with open(rutas["contexto"]) as f:
        for linea in f:
            p = json.loads(linea)
            contexto[p["clave"]] = p
    vistas, ok, mal = set(), 0, 0
    uso = {"entrada": 0, "salida": 0, "razonamiento": 0}
    if rutas["respuestas"].exists():
        with open(rutas["respuestas"]) as f:
            for linea in f:
                if not linea.strip():
                    continue
                r = json.loads(linea)
                clave = r.get("key")
                if clave not in contexto:
                    continue
                vistas.add(clave)
                try:
                    if "error" in r or "response" not in r:
                        raise ValueError(json.dumps(r.get("error", "sin respuesta"), ensure_ascii=False)[:300])
                    m = r["response"].get("usageMetadata", {})
                    uso["entrada"] += m.get("promptTokenCount", 0)
                    uso["salida"] += m.get("candidatesTokenCount", 0)
                    uso["razonamiento"] += m.get("thoughtsTokenCount", 0)
                    analisis.guardar(contexto[clave], analisis.ClienteGemini.leer(r["response"]))
                    estado["errores"].pop(clave, None)
                    ok += 1
                except Exception as e:  # una respuesta rara no debe parar el resto
                    estado["intentos"][clave] = estado["intentos"].get(clave, 0) + 1
                    estado["errores"][clave] = str(e)[:300]
                    mal += 1
    for clave in contexto.keys() - vistas:  # sin línea de respuesta: vuelve a la cola
        estado["intentos"][clave] = estado["intentos"].get(clave, 0) + 1
        estado["errores"][clave] = "sin respuesta en el lote"
        mal += 1
    tanda.update(recogida=True, ok=ok, fallidas=mal, uso=uso)
    guardar_estado(estado)
    rutas["peticiones"].unlink(missing_ok=True)  # se puede reconstruir; es lo que más ocupa
    _log(f"{tanda['id']}: {ok} análisis guardados, {mal} a reintentar")


def actualizar_tandas(api: Api, estado: dict) -> bool:
    """Consulta los lotes en marcha y recoge los terminados. True si ha cambiado algo de la caché o la cola."""
    cambio = False
    for t in estado["tandas"]:
        if t["estado"] == "creando" and not t["lote"]:
            t["lote"] = api.buscar(t["nombre"])
            t["estado"] = "PENDING" if t["lote"] else "subida"
            guardar_estado(estado)
        if not t["lote"] or t.get("recogida"):
            continue
        if t["estado"] not in FINALES:
            nuevo, stats, fichero = _estado_lote(api.consultar(t["lote"]))
            if nuevo != t["estado"]:
                _log(f"{t['id']}: {t['estado']} → {nuevo} {stats or ''}")
            t["estado"], t["respuestas"] = nuevo, fichero
            guardar_estado(estado)
        if t["estado"] in FINALES:
            if t.get("respuestas") and not _rutas(t["id"])["respuestas"].exists():
                api.descargar(t["respuestas"], _rutas(t["id"])["respuestas"])
            if t["estado"] == "SUCCEEDED":
                estado["lotes_fallidos_seguidos"] = 0
            else:
                estado["lotes_fallidos_seguidos"] += 1
                _log(f"{t['id']}: el lote terminó en {t['estado']}; lo que no tenga respuesta vuelve a la cola")
            procesar_respuestas(estado, t)
            cambio = True
    return cambio


def _en_vuelo(estado: dict) -> set[str]:
    """Claves de las tandas aún sin recoger (no se deben volver a mandar)."""
    claves = set()
    for t in estado["tandas"]:
        if not t.get("recogida") and t["estado"] != "descartada":
            with open(_rutas(t["id"])["contexto"]) as f:
                claves.update(json.loads(linea)["clave"] for linea in f)
    return claves


def resumen(estado: dict) -> str:
    tandas = estado["tandas"]
    uso = {k: sum(t.get("uso", {}).get(k, 0) for t in tandas) for k in ("entrada", "salida", "razonamiento")}
    coste = (uso["entrada"] * PRECIO_ENTRADA + (uso["salida"] + uso["razonamiento"]) * PRECIO_SALIDA) / 1e6
    en_marcha = [t for t in tandas if not t.get("recogida") and t["estado"] != "descartada"]
    agotadas = sum(1 for n in estado["intentos"].values() if n >= MAX_INTENTOS)
    return (f"{sum(t.get('ok', 0) for t in tandas)} análisis guardados por lotes · {len(en_marcha)} lotes en marcha "
            f"({sum(t['n'] for t in en_marcha)} peticiones) · {agotadas} abandonadas · "
            f"{uso['entrada'] / 1e6:.1f} M tokens de entrada, {uso['salida'] / 1e6:.2f} M de salida · ~{coste:.2f} $")


# ---------------------------------------------------------------- órdenes

def ejecutar(limite: int | None = None, tokens_tanda: int = TOKENS_TANDA, espera: int = ESPERA) -> None:
    if PROVEEDOR != "gemini":
        raise SystemExit("La Batch API está implementada para Gemini: define GEMINI_API_KEY.")
    with cerrojo():
        estado = leer_estado()
        if (estado["modelo"], estado["version"]) != (MODELO, analisis.VERSION_PROMPT):
            if any(not t.get("recogida") for t in estado["tandas"]):
                raise SystemExit(f"Hay lotes en marcha de {estado['modelo']} {estado['version']}: recógelos antes "
                                 "o cancélalos con --cancelar.")
            estado.update(modelo=MODELO, version=analisis.VERSION_PROMPT, intentos={}, errores={})
        api = Api()
        enviadas = 0
        recalcular, cola, lleno_desde, fallos_envio = True, [], None, 0
        while True:
            if actualizar_tandas(api, estado):
                recalcular, lleno_desde = True, None
            if estado["lotes_fallidos_seguidos"] >= MAX_LOTES_FALLIDOS:
                raise SystemExit(f"{MAX_LOTES_FALLIDOS} lotes seguidos han fallado: revisa {ESTADO} antes de seguir.")
            if recalcular:
                abandonadas = {c for c, n in estado["intentos"].items() if n >= MAX_INTENTOS}
                vuelo = _en_vuelo(estado)
                cola = [p for p in pendientes(abandonadas) if p["clave"] not in vuelo and p["clave"] not in abandonadas]
                recalcular = False
                _log(f"Pendientes: {len(cola)} peticiones · {resumen(estado)}")

            # Primero, las tandas ya subidas que la cola llena dejó esperando; después, tandas nuevas.
            esperando = [t for t in estado["tandas"] if t["estado"] in ("preparada", "subida")]
            puede = lleno_desde is None or time.time() - lleno_desde > ESPERA_COLA_LLENA
            envios = 0
            quedan = lambda: esperando or (cola and (limite is None or enviadas < limite))  # noqa: E731
            while puede and envios < ENVIOS_POR_VUELTA and quedan():
                envios += 1
                if esperando:
                    tanda = esperando.pop(0)
                else:
                    trozo, tokens = [], 0
                    tope = limite - enviadas if limite is not None else len(cola)
                    while cola and len(trozo) < tope and (not trozo or tokens + _tokens(cola[0]) <= tokens_tanda):
                        tokens += _tokens(cola[0])
                        trozo.append(cola.pop(0))
                    tanda = preparar_tanda(estado, trozo)
                    enviadas += len(trozo)
                try:
                    enviada = enviar(api, estado, tanda)
                except RuntimeError as e:  # la tanda sigue en disco y se reintenta en la siguiente vuelta
                    fallos_envio += 1
                    _log(f"{tanda['id']}: no se pudo enviar ({e}); se reintentará")
                    if fallos_envio >= MAX_FALLOS_ENVIO:
                        raise SystemExit(f"{MAX_FALLOS_ENVIO} envíos seguidos han fallado: revisa la conexión.") from e
                    break
                fallos_envio = 0
                if not enviada:
                    _log("La cola de lotes de la cuenta está llena: se espera a que termine alguno.")
                    lleno_desde, puede = time.time(), False

            en_marcha = [t for t in estado["tandas"] if not t.get("recogida") and t["estado"] != "descartada"]
            if not en_marcha and (not cola or (limite is not None and enviadas >= limite)):
                break
            if envios < ENVIOS_POR_VUELTA:  # si se ha cortado por el tope de envíos, se sigue sin esperar
                time.sleep(espera)

        _log(f"Terminado. {resumen(estado)}")
        if estado["errores"]:
            _log(f"{len(estado['errores'])} peticiones con error (detalle en {ESTADO}); `construir` hará las que "
                 "falten una a una.")


def mostrar_estado() -> None:
    estado = leer_estado()
    for t in estado["tandas"]:
        print(f"{t['id']} {t['estado']:<10} {t['n']:>5} peticiones · {t.get('ok', '-')} ok · "
              f"{t.get('fallidas', '-')} fallidas · {t['lote'] or ''}")
    print(resumen(estado))


def _ritmo_del_log(minutos: int = 10) -> float | None:
    """Análisis guardados por minuto en los últimos `minutos`, según las líneas del registro."""
    log = DIR / "lote.log"
    if not log.exists():
        return None
    ahora = datetime.now()
    total = 0
    for linea in log.read_text().splitlines()[-2000:]:
        if "análisis guardados," not in linea or not linea.startswith("["):
            continue
        h = datetime.strptime(linea[1:9], "%H:%M:%S").replace(year=ahora.year, month=ahora.month, day=ahora.day)
        if 0 <= (ahora - h).total_seconds() <= minutos * 60:
            total += int(linea.split(": ", 1)[1].split()[0])
    return total / minutos


def ver(cada: int = 5) -> None:
    """Progreso en directo (solo lee: se puede abrir y cerrar sin afectar al proceso del lote)."""
    base, hechos_base, calculado = 0, 0, 0.0
    while True:
        estado = leer_estado()
        tandas = estado["tandas"]
        hechos = sum(t.get("ok", 0) for t in tandas)
        if time.time() - calculado > 30:  # recalcular lo pendiente cuesta un par de segundos
            base, hechos_base, calculado = len(pendientes()), hechos, time.time()
        restantes = max(0, base - (hechos - hechos_base))  # entre recálculos, se descuenta lo que se va guardando
        total = hechos + restantes
        frac = hechos / total if total else 1.0
        barra = "█" * round(frac * 40) + "░" * (40 - round(frac * 40))
        en_google = [t for t in tandas if t["lote"] and not t.get("recogida")]
        esperando = [t for t in tandas if t["estado"] in ("preparada", "subida", "creando")]
        uso = {k: sum(t.get("uso", {}).get(k, 0) for t in tandas) for k in ("entrada", "salida", "razonamiento")}
        coste = (uso["entrada"] * PRECIO_ENTRADA + (uso["salida"] + uso["razonamiento"]) * PRECIO_SALIDA) / 1e6
        ritmo = _ritmo_del_log()
        vivo = os.system("pgrep -f 'escano lote$' >/dev/null 2>&1") == 0
        lineas = [
            f"Análisis de la legislatura · {estado['modelo']} por lotes · {datetime.now():%H:%M:%S}",
            "",
            f"  {barra} {frac:6.1%}",
            f"  {hechos:,} guardados de {total:,} · faltan {restantes:,}".replace(",", "."),
            "",
            f"  En Google:   {len(en_google)} lotes ({sum(t['n'] for t in en_google)} peticiones)"
            + (f" · {len(esperando)} esperando a subir" if esperando else ""),
            f"  Ritmo:       {ritmo:.0f} análisis/min (últimos 10 min)" if ritmo else "  Ritmo:       calculando…",
            f"  Quedan:      ~{restantes / ritmo:.0f} min" if ritmo and restantes else "",
            f"  Coste:       {coste:.2f} $ hasta ahora"
            + (f" · ~{coste / hechos * total:.0f} $ al acabar" if hechos > 500 else ""),
            f"  Reintentos:  {len(estado['errores'])} con error · "
            f"{sum(1 for n in estado['intentos'].values() if n >= MAX_INTENTOS)} abandonadas",
            f"  Proceso:     {'en marcha' if vivo else 'PARADO: relánzalo con python -m escano lote'}",
            "",
            "  Últimos eventos:",
        ]
        log = DIR / "lote.log"
        if log.exists():
            lineas += ["    " + x for x in log.read_text().splitlines()[-6:]]
        print("\033[2J\033[H" + "\n".join(lineas), flush=True)
        time.sleep(cada)


def cancelar() -> None:
    with cerrojo():
        estado = leer_estado()
        api = Api()
        for t in estado["tandas"]:
            if t["lote"] and t["estado"] in ("PENDING", "RUNNING") and not t.get("recogida"):
                api.cancelar(t["lote"])
                _log(f"{t['id']}: cancelación pedida (lo que ya haya terminado se recogerá igualmente)")
            elif t["estado"] in ("preparada", "subida"):
                t["estado"] = "descartada"
        guardar_estado(estado)
