"""Genera index.html a partir de plantilla.tpl con los datos reales de la web (../src/datos.json)."""
import json
from pathlib import Path

aqui = Path(__file__).parent
d = json.loads((aqui.parent / "src" / "datos.json").read_text())
t = (aqui / "plantilla.tpl").read_text()
t = t.replace("__DATOS__", json.dumps(d, ensure_ascii=False, separators=(",", ":")))
t = t.replace("__E0__", str(d["embudo"][0])).replace("__E5__", str(d["embudo"][5])).replace("__CONG__", str(d["congelador"]))
(aqui / "index.html").write_text(t)
print("index.html listo")
