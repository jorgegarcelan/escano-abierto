# Cómo contribuir

Gracias por echar una mano. Escaño Abierto sale de datos públicos y vive de que mucha gente los mire: un voto mal atribuido, un Diario de Sesiones que el parser trocea mal o una idea para contar mejor algo son tan valiosos como el código.

## Formas de ayudar

- **Avisar de un dato erróneo.** [Abre una incidencia](https://github.com/jorgegarcelan/escano-abierto/issues/new/choose) con el enlace a la página de la web y el del documento oficial. Es lo más útil que se puede hacer sin programar.
- **Arreglar un fallo** de la web o del pipeline.
- **Mejorar el parser** de los Diarios de Sesiones: cada caso raro (un orador pegado al texto, un salto de página, un apellido con guion) es un test nuevo en `tests/fixtures/diarios/`.
- **Proponer o construir algo nuevo.** Para cambios grandes, abre antes una incidencia y lo hablamos: así nadie trabaja en algo que luego no encaja.

Las incidencias y los PR, mejor en español. Si no lo hablas, en inglés también vale.

## Preparar el entorno

Hace falta Python 3.9 o superior y, para los tests de JavaScript, Node 20 o superior.

```bash
git clone --filter=blob:none https://github.com/jorgegarcelan/escano-abierto.git   # sin el historial de cada dato: clona mucho más rápido
cd escano-abierto
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m escano construir --sin-ia     # la web a partir de los datos del repositorio, sin red ni IA
python scripts/servir.py 8000 site     # http://localhost:8000
```

El repositorio trae los datos de toda la legislatura: no hace falta descargar nada ni tener claves de API para trabajar en la web o en el código. Solo para descargar lo nuevo del Congreso hace falta `pdftotext` (`brew install poppler` en macOS, `poppler-utils` en Linux), y solo para analizar con IA intervenciones nuevas, una clave en `.env` (ver `.env.example`).

## Qué es código y qué se genera

| | Dónde | ¿Se edita a mano? |
|---|---|---|
| Pipeline (descarga, parser, cálculos) | `escano/` | Sí |
| Web | `site/index.html`, `site/app.js`, `site/app.css`, `site/elecciones*.js`, `site/geografia.js` | Sí |
| Marca y tipografías | `site/marca/`, `site/marcas/`, `escano/fuentes/` | Sí |
| Función de la noche electoral (Vercel) | `api/` | Sí |
| Build y servidor local | `scripts/` | Sí |
| Portada provisional «muy pronto» (solo con `ESCANO_MODO=teaser`) | `teaser/`, `escano/teaser.py` | Sí |
| Tests | `tests/` | Sí |
| Datos procesados (versionados) | `data/`, `site/datos/`, `site/**/rss.xml`, `site/sitemap.xml` | **No** |
| Páginas para compartir y tarjetas (no versionadas) | `site/<tipo>/<id>/index.html`, `site/og/` | **No** |
| Descargas originales (no versionadas) | `data/raw/` | **No** |

Los datos los escribe el pipeline y los actualiza un bot cada mañana en `main`. Si un dato está mal, el arreglo va en el código que lo genera (y, si hace falta, en un test), no en el JSON.

## Antes de abrir un PR

1. **Abre el PR contra `main`**, con un cambio por PR. Cuanto más pequeño, antes se revisa.
2. **Pasa los tests.** No necesitan red ni claves, y tardan unos segundos:
   ```bash
   python -m pytest
   node --test tests/*.test.mjs
   ```
   Si arreglas un fallo, añade el test que lo habría detectado.
3. **No incluyas datos regenerados.** Tras `construir` verás cambiados cientos de ficheros de `data/` y `site/datos/`: no los subas, porque el bot los regenera a diario y darían conflictos. Añade solo tus ficheros (`git add escano/… site/app.js`) o deshaz los datos con:
   ```bash
   git restore data site/datos site/rss.xml site/sitemap.xml 'site/*/*/rss.xml'
   ```
   La excepción es un PR cuyo objetivo sea justo cambiar datos; dilo en la descripción.
4. **Si cambia algo visible**, adjunta una captura.

## Criterios del proyecto

- **Datos oficiales, siempre enlazados.** Todo dato nuevo debe salir de una fuente pública y llevar a su documento original.
- **Las mismas reglas para todos.** Títulos, explicaciones, resúmenes y clasificaciones se generan con reglas fijas, iguales para todos los grupos y partidos. Un cambio que trate distinto a un grupo no se acepta, aunque el resultado parezca más justo en un caso concreto.
- **IA con garantías.** Lo que genera un modelo de lenguaje se indica en la web, y una cita solo se publica si aparece literalmente en el Diario de Sesiones. Los análisis quedan en caché en `data/analisis/` y el modelo forma parte de la clave: cambiar de modelo no reutiliza lo ya analizado.
- **Sin cargar a las fuentes.** Las descargas pasan por `escano/red.py`, que guarda en caché, espera entre peticiones y reintenta con calma. Úsalo para cualquier fuente nueva y no lances descargas masivas en paralelo.
- **Pocas dependencias.** El build de Vercel solo instala `requests` y `pillow`: los módulos que carga `construir` no pueden importar otras librerías arriba del todo (hazlo dentro de la función que las usa, como `encuestas.py` con `bs4`). La web no tiene framework ni paso de compilación.
- **Código en español** (nombres, comentarios y mensajes), como el resto del proyecto. Imita el estilo del fichero que tocas.

## Licencia

Al contribuir aceptas que tu código se publique con la [licencia MIT](LICENSE) y que los datos que aportes se puedan reutilizar con la licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es), como el resto del proyecto.

Este proyecto tiene un [código de conducta](CODE_OF_CONDUCT.md). Al participar te comprometes a respetarlo.
