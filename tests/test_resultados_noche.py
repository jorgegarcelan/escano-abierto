"""La noche electoral: los tests del proxy (api/resultados.js) están en JavaScript; aquí se lanzan con Node."""
import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(not shutil.which("node"), reason="hace falta Node para probar la función de Vercel")
def test_proxy_de_resultados():
    raiz = Path(__file__).parent.parent
    r = subprocess.run(["node", "--test", "tests/resultados.test.mjs"], cwd=raiz, capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-2000:]
