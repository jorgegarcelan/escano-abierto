"""Servidor local de la web para desarrollo: como `python -m http.server`, pero sin caché.

`http.server` no manda Cache-Control y el navegador guarda los módulos que la web carga al abrir una pestaña
(elecciones.js, geografia.js…): tras un cambio, seguía usando la versión vieja. Aquí todo va con `no-store`.

    python scripts/servir.py            # http://localhost:8000, sirviendo site/
    python scripts/servir.py 8020 site
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SinCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    carpeta = sys.argv[2] if len(sys.argv) > 2 else "site"
    print(f"http://localhost:{puerto} · {carpeta}/ (sin caché)")
    ThreadingHTTPServer(("127.0.0.1", puerto), partial(SinCache, directory=carpeta)).serve_forever()
