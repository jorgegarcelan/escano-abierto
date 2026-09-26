#!/bin/sh
# Construye la web en Vercel: datos de site/datos, páginas para compartir, RSS y tarjetas Open Graph.
# Todo sale de data/ (versionado); no descarga nada del Congreso ni llama a la IA.
set -e
# Home provisional («muy pronto»): con ESCANO_MODO=teaser (solo en Production) se publica una única página con
# el vídeo en lugar de la web. Para abrir la web completa, quita la variable y vuelve a desplegar.
if [ "$ESCANO_MODO" = "teaser" ]; then
  python3 -m escano.teaser --salida /tmp/escano-teaser
  rm -rf site && mv /tmp/escano-teaser site
  exit 0
fi
if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; sys.exit(sys.version_info < (3, 9))'; then
  python3 -m venv /tmp/escano-venv
else
  # Sin Python 3.9+ en la imagen de build: uv trae uno.
  curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null
  "$HOME/.local/bin/uv" venv --python 3.12 /tmp/escano-venv
fi
/tmp/escano-venv/bin/python -m pip install --quiet --disable-pip-version-check "requests>=2.31" "pillow>=10"
/tmp/escano-venv/bin/python -m escano construir --sin-ia
echo "Tarjetas: $(find site/og -name '*.png' | wc -l | tr -d ' ') · URL: ${ESCANO_URL_SITIO:-https://$VERCEL_PROJECT_PRODUCTION_URL}"
