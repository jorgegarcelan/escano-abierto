# Escaño Abierto

**Entender lo que se hace en el Congreso.** Qué se vota, quién lo decide y cómo, con los datos oficiales del Congreso de los Diputados contados para que cualquiera pueda entenderlos en unos minutos.

🌐 **[escano-abierto.vercel.app](https://escano-abierto.vercel.app)**

El Congreso publica casi todo lo que hace: el voto de cada diputado, cada palabra del Diario de Sesiones, cada ley con sus fases y sus plazos. Pero está repartido en miles de PDF, buscadores y ficheros técnicos. Escaño Abierto lo junta, lo ordena y lo explica, y se actualiza solo cada mañana.

## Qué puedes hacer

**Entender**
- Ver **qué significa cada votación** en una frase: aprobar una proposición no de ley no cambia ninguna ley.
- Consultar el **glosario** con las palabras del Congreso y **cómo se hace una ley**, paso a paso, con las cifras reales de la legislatura.

**Acercarte**
- Encontrar a **tus diputados** por provincia: cómo votan, cuándo se apartan de su grupo, qué preguntan al Gobierno y en qué comisiones están.
- **Seguir un tema** (vivienda, sanidad, pensiones…) por RSS, incluido lo que se votará en el próximo pleno.
- Leer **la semana en el Congreso** y ver el **orden del día del próximo pleno**.

**Pedir cuentas**
- Ver el voto nominal de cada diputado en los **hemiciclos con la disposición real** de los escaños, y quién votó distinto a su grupo.
- Seguir cada **ley desde que se presenta hasta que se publica**, y las que llevan meses en «el congelador».
- Ver cuántas **preguntas al Gobierno** siguen sin respuesta y cuánto tarda en contestar.
- Leer las **declaraciones de actividades e intereses** de cada diputado.

Cada votación, sesión, ley, diputado, provincia, tema y semana tiene una página para compartir, con su tarjeta, y los más relevantes tienen RSS.

## Principios

- **Datos oficiales, siempre enlazados.** Todo sale de fuentes públicas del Congreso y cada dato lleva a su documento original.
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
Declaraciones de intereses     ─┘
```

- Cada mañana, un workflow de GitHub Actions descarga lo nuevo, actualiza `data/` y hace push.
- Cada push despliega en Vercel, que construye la web y dibuja las tarjetas para compartir.
- La web es una sola página estática, sin servidor, que carga los datos por meses.

La metodología completa de cada cálculo está en la sección [Método](https://escano-abierto.vercel.app/#metodo) de la web.

## Desarrollo

Requisitos: Python 3.9 o superior y `pdftotext` (`brew install poppler` en macOS, `poppler-utils` en Linux).

```bash
git clone https://github.com/jorgegarcelan/escano-abierto.git
cd escano-abierto
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m escano construir --sin-ia       # web a partir de los datos del repositorio
python -m http.server 8000 -d site        # http://localhost:8000
```

El repositorio ya incluye los datos de la legislatura, así que no hace falta descargar nada para empezar. Para traer lo nuevo del Congreso:

```bash
python -m escano actualizar --sin-ia      # últimos 10 días, agenda, leyes, preguntas y declaraciones
python -m escano actualizar --desde 2023-08-17 --sin-ia   # toda la XV Legislatura
python -m escano preguntas --completo     # todas las preguntas escritas (la primera vez)
python -m escano reprocesar --sin-ia      # rehace sesiones y votaciones desde data/raw, sin red
python -m escano calidad                  # indicadores de calidad del parser
python -m pytest                          # tests, sin red ni API
```

Sin `--sin-ia`, el pipeline analiza las intervenciones con la API de Claude: copia `.env.example` a `.env` y añade tu `ANTHROPIC_API_KEY`. Los análisis quedan en caché en `data/analisis/`.

### Estructura

```
escano/
  votaciones.py   votaciones nominales (formato compacto en data/votaciones/)
  diario.py       Diario de Sesiones en PDF → turnos de palabra
  leyes.py        tramitación de proyectos y proposiciones de ley
  agenda.py       orden del día de los próximos plenos
  preguntas.py    preguntas escritas al Gobierno
  intereses.py    declaraciones de actividades e intereses
  diputados.py    diputados de la legislatura (en activo y de baja)
  hemiciclo.py    plano oficial del hemiciclo
  organos.py      composición de las comisiones
  temas.py        temas para seguir, por palabras clave
  semanas.py      resumen semanal
  analisis.py     análisis con IA (opcional, con caché)
  construir.py    une todo en site/datos/
  paginas.py      páginas para compartir, tarjetas Open Graph y RSS
  cli.py          python -m escano …
site/             web estática (index.html) y marcas visuales (site/marcas/)
data/             datos procesados, versionados (data/raw, los originales, no)
tests/            parser, votaciones, leyes, agenda, preguntas y pipeline completo
scripts/          build de Vercel
```

### Despliegue

La web se publica en Vercel desde este repositorio (`vercel.json` y `scripts/vercel-build.sh`). Las URL absolutas de tarjetas, RSS y sitemap salen del dominio de producción de Vercel, o de la variable `ESCANO_URL_SITIO` si se define. La actualización diaria está en `.github/workflows/actualizar.yml`; si se añade el secreto `ANTHROPIC_API_KEY`, también analiza con IA las intervenciones nuevas.

## Contribuir

¿Has visto un error o echas algo en falta? [Abre una incidencia](https://github.com/jorgegarcelan/escano-abierto/issues). Las correcciones de datos, del parser y las ideas son bienvenidas.

Las descargas esperan entre peticiones para no cargar los servidores del Congreso; mantén ese criterio si añades fuentes nuevas.

## Autor

Hecho por [Jorge Garcelán](https://jorgegarcelan.com).

## Licencia y fuentes

- Código bajo [licencia MIT](LICENSE).
- Datos: [Congreso de los Diputados](https://www.congreso.es) (datos abiertos, Diario de Sesiones, Boletín Oficial de las Cortes Generales, buscador de iniciativas y agenda), reutilizados conforme a la Ley 37/2007. Si reutilizas los datos, cita la fuente.
- Tipografías de las tarjetas (Doto y Geist): SIL Open Font License.

Escaño Abierto es un proyecto independiente y no está asociado al Congreso de los Diputados ni a ningún organismo público o partido político.
