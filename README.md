# Escaño Abierto

**Entender lo que se hace en el Congreso.** Qué se vota, quién lo decide y cómo, con los datos oficiales del Congreso de los Diputados contados para que cualquiera pueda entenderlos en unos minutos.

🌐 **[escañoabierto.com](https://www.escañoabierto.com)**

El Congreso publica casi todo lo que hace: el voto de cada diputado, cada palabra del Diario de Sesiones, cada ley con sus fases y sus plazos. Pero está repartido en miles de PDF, buscadores y ficheros técnicos. Escaño Abierto lo junta, lo ordena y lo explica, y se actualiza solo cada mañana.

## Qué puedes hacer

**Entender**
- Ver **qué significa cada votación** en una frase: aprobar una proposición no de ley no cambia ninguna ley.
- Consultar el **glosario** con las palabras del Congreso y **cómo se hace una ley**, paso a paso, con las cifras reales de la legislatura.
- Conocer la **geografía de España**: comunidades y provincias, con los datos del INE.

**Acercarte**
- Encontrar a **tus diputados** por provincia: cómo votan, cuándo se apartan de su grupo, qué preguntan al Gobierno y en qué comisiones están.
- Jugar a **¿Quién lo dijo?**: diez frases literales del Diario de Sesiones para adivinar de qué grupo es quien habla, con un reto nuevo cada día.
- **Seguir un tema** (vivienda, sanidad, pensiones…) por RSS, incluido lo que se votará en el próximo pleno.
- Leer **la semana en el Congreso** y ver el **orden del día del próximo pleno**.

**Pedir cuentas**
- Ver el voto nominal de cada diputado en los **hemiciclos con la disposición real** de los escaños, y quién votó distinto a su grupo.
- Seguir cada **ley desde que se presenta hasta que se publica**, y las que llevan meses en «el congelador».
- Ver cuántas **preguntas al Gobierno** siguen sin respuesta y cuánto tarda en contestar.
- Leer las **declaraciones de actividades e intereses** de cada diputado.
- Ver el **organigrama del Estado**: quién ocupa cada alto cargo, desde cuándo y con qué Real Decreto, con cada nombramiento y cese enlazado a su BOE y los cargos que ha tenido cada diputado. Inspirado en el [US Gov Graph](https://graph.civlab.org/us) de CivLab.

**Elecciones del 29N**
- Ver **qué caduca** con la disolución de las Cortes: las leyes y las iniciativas que se quedan por el camino.
- Situar a **los 350 diputados** en el mapa y en el hemiciclo, y saber **quién repite** en las listas.
- Seguir la **media de las encuestas** y la proyección de escaños, y ver cuánto acertaron en las generales anteriores.
- Recorrer el **histórico de elecciones generales** desde 1977, con una ficha por elección y por provincia.

Cada votación, sesión, ley, diputado, provincia, tema y semana tiene una página para compartir, con su tarjeta, y los más relevantes tienen RSS.

## Principios

- **Datos oficiales, siempre enlazados.** Todo sale de fuentes públicas del Congreso y del BOE, y cada dato lleva a su documento original.
- **Las mismas reglas para todos.** Los títulos, explicaciones y resúmenes semanales se generan con reglas fijas, iguales para todos los grupos.
- **IA con garantías.** Cuando interviene un modelo de lenguaje (resúmenes, tono), se indica, y las citas solo se publican si aparecen literalmente en el Diario de Sesiones.
- **Independiente.** No está asociado al Congreso de los Diputados ni a ningún organismo público o partido político.

## Cómo funciona

```
Congreso de los Diputados                    escano/ (Python)                 site/ (web estática)
─────────────────────────                    ────────────────                 ────────────────────
Datos abiertos de votaciones   ─┐
Diarios de Sesiones (PDF)      ─┤
Tramitación de iniciativas     ─┼─▶  descarga ─▶ data/ ─▶ construir ─▶  datos por mes, páginas para
Orden del día de los plenos    ─┤    y parser     (versionado)           compartir, RSS y tarjetas
Preguntas escritas             ─┤
Declaraciones de intereses     ─┤
BOE: nombramientos y ceses     ─┘
```

- Cada mañana, un workflow de GitHub Actions descarga lo nuevo, actualiza `data/` y hace push. Otro recoge las encuestas dos veces al día.
- Cada push despliega en Vercel, que construye la web y dibuja las tarjetas para compartir.
- La web es una sola página estática, sin servidor, que carga los datos por meses.

La metodología completa de cada cálculo está en la sección [Método](https://www.escañoabierto.com/#metodo) de la web.

## Desarrollo

Requisitos: Python 3.9 o superior; para descargar del Congreso, `pdftotext` (`brew install poppler` en macOS, `poppler-utils` en Linux), y para los tests de JavaScript, Node 20 o superior.

```bash
git clone --filter=blob:none https://github.com/jorgegarcelan/escano-abierto.git   # sin el historial de cada dato
cd escano-abierto
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m escano construir --sin-ia       # web a partir de los datos del repositorio
python scripts/servir.py 8000 site       # http://localhost:8000 (sirve las rutas de la web, como Vercel)
```

El repositorio ya incluye los datos de la legislatura, así que no hace falta descargar nada para empezar. Para traer lo nuevo del Congreso:

```bash
python -m escano actualizar --sin-ia      # últimos 10 días, agenda, leyes, preguntas y declaraciones
python -m escano actualizar --desde 2023-08-17 --sin-ia   # toda la XV Legislatura
python -m escano preguntas --completo     # todas las preguntas escritas (la primera vez)
python -m escano estado --desde 2018-06-01   # nombramientos y ceses de altos cargos en el BOE (organigrama)
python -m escano reprocesar --sin-ia      # rehace sesiones y votaciones desde data/raw, sin red
python -m escano calidad                  # indicadores de calidad del parser
python -m pytest                          # tests, sin red ni API
node --test tests/*.test.mjs              # tests de JavaScript
```

Sin `--sin-ia`, el pipeline analiza las intervenciones nuevas con un modelo de lenguaje: copia `.env.example` a `.env` y añade tu `GEMINI_API_KEY` (o, en su lugar, `ANTHROPIC_API_KEY`). Los análisis quedan en caché en `data/analisis/`, y el modelo forma parte de la clave: cambiar de modelo no reutiliza lo ya analizado.

### Estructura

```
escano/
  config.py       rutas, URLs del Congreso y grupos parlamentarios
  red.py          descargas con caché, pausas entre peticiones y reintentos
  votaciones.py   votaciones nominales (formato compacto en data/votaciones/)
  llamamiento.py  votaciones públicas por llamamiento, sacadas del Diario de Sesiones
  diario.py       Diario de Sesiones en PDF → turnos de palabra
  calidad.py      indicadores de calidad del parser
  leyes.py        tramitación de proyectos y proposiciones de ley
  agenda.py       orden del día de los próximos plenos
  preguntas.py    preguntas escritas al Gobierno
  intereses.py    declaraciones de actividades e intereses
  diputados.py    diputados de la legislatura (en activo y de baja)
  hemiciclo.py    plano oficial del hemiciclo
  organos.py      composición de las comisiones
  boe.py          nombramientos y ceses de altos cargos en el BOE
  estado.py       organigrama del Estado a partir de boe.json
  temas.py        temas para seguir, por palabras clave
  semanas.py      resumen semanal, sin IA
  analisis.py     análisis con IA (opcional, con caché); lotes.py, lo mismo por la Batch API de Gemini
  normalizar.py   temas, lugares y propuestas unificados con IA; explora.py, lo que sale de juntarlos
  elecciones.py   sección de las elecciones del 29N, con candidaturas.py (¿repite?), historico.py (1977–2023),
                  geo.py (mapas), encuestas.py, proyeccion.py, aciertos.py, edad_voto.py y promesas.py
  geografia.py    comunidades, provincias y municipios con los datos del INE
  construir.py    une todo en site/datos/
  paginas.py      páginas para compartir, tarjetas Open Graph y RSS
  teaser.py       portada provisional («muy pronto»), solo con ESCANO_MODO=teaser
  cli.py          python -m escano …
site/             web estática (index.html, app.js, app.css y los módulos de elecciones y geografía) y su marca,
                  Marcador (site/marcas/)
api/              función de Vercel de la noche electoral: proxy del escrutinio provisional de Interior
data/             datos procesados, versionados (data/raw, los originales, no)
tests/            tests de Python (pytest) y de JavaScript (node --test)
scripts/          build de Vercel y servidor local
teaser/           la portada provisional
docs/             notas: hoja de ruta, noche electoral y paso a la XVI Legislatura
```

### Despliegue

La web se publica en Vercel desde este repositorio (`vercel.json` y `scripts/vercel-build.sh`). Las URL absolutas de tarjetas, RSS y sitemap salen del dominio de producción de Vercel, o de la variable `ESCANO_URL_SITIO` si se define. La actualización diaria está en `.github/workflows/actualizar.yml`; si se añade el secreto `GEMINI_API_KEY`, también analiza con IA las intervenciones nuevas. Las encuestas se actualizan con `.github/workflows/encuestas.yml`.

## Contribuir

¿Has visto un error o echas algo en falta? [Abre una incidencia](https://github.com/jorgegarcelan/escano-abierto/issues/new/choose). Las correcciones de datos, del parser y las ideas son bienvenidas, y también los PR: en [CONTRIBUTING.md](CONTRIBUTING.md) está cómo preparar el entorno, qué ficheros se generan solos y los criterios del proyecto.

Las descargas esperan entre peticiones para no cargar los servidores del Congreso; mantén ese criterio si añades fuentes nuevas.

Este proyecto tiene un [código de conducta](CODE_OF_CONDUCT.md). Para avisar de una vulnerabilidad, mira [SECURITY.md](SECURITY.md).

## Autor

Hecho por [Jorge Garcelán](https://jorgegarcelan.com).

## Licencia y fuentes

- **Código:** [licencia MIT](LICENSE).
- **Datos elaborados por el proyecto** (`data/` y `site/datos/`: votaciones procesadas, análisis, resúmenes, proyecciones…): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es). Puedes reutilizarlos para lo que quieras citando «Escaño Abierto» con un enlace a la web. Los resúmenes, el tono y los temas de cada intervención los genera un modelo de lenguaje.
- **Fuentes.** Cada una conserva sus condiciones; si reutilizas sus datos, cítalas:
  - [Congreso de los Diputados](https://www.congreso.es): datos abiertos, Diario de Sesiones, Boletín Oficial de las Cortes Generales, buscador de iniciativas y agenda, reutilizados conforme a la Ley 37/2007.
  - [Boletín Oficial del Estado](https://www.boe.es): nombramientos, ceses y candidaturas.
  - [Ministerio del Interior](https://infoelectoral.interior.gob.es): resultados de las elecciones generales desde 1977 y, la noche electoral, el escrutinio provisional.
  - [INE](https://www.ine.es): padrón, renta y otros datos de comunidades, provincias y municipios.
  - [CIS](https://www.cis.es): estudio postelectoral de 2023 (n.º 3420), para el voto por edad.
  - Mapas: [es-atlas](https://www.npmjs.com/package/es-atlas), a partir de la cartografía del [IGN](https://www.ign.es).
  - Encuestas: tablas de [Wikipedia](https://en.wikipedia.org/wiki/Opinion_polling_for_the_2026_Spanish_general_election), con licencia [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es); las encuestas recopiladas en `data/encuestas/` se comparten con esa misma licencia.
  - Mercados de predicción: [Polymarket](https://polymarket.com).
  - Programas electorales de 2023, de la web de cada partido.
- **Tipografías** de las tarjetas (Doto y Geist): SIL Open Font License, con su texto en `escano/fuentes/`.
- **Marca.** El nombre «Escaño Abierto» y los logotipos (`site/marca/` y `site/marcas/`) no están cubiertos por la licencia MIT. Si publicas una versión propia, usa otro nombre y otro logotipo para que nadie la confunda con esta.

Escaño Abierto es un proyecto independiente y no está asociado al Congreso de los Diputados ni a ningún organismo público o partido político.
