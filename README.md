# Escaño Abierto

Plenos y comparecencias del Congreso de los Diputados, resumidos y analizados: qué se dijo, en qué tono, si el Gobierno contestó a lo que se le preguntó y cómo votó cada grupo y cada diputado.

La web es estática (`site/`) y lee los ficheros de `site/datos/` que genera el pipeline de Python a partir de los datos oficiales del Congreso: `indice.json` con lo común (grupos, diputados, meses disponibles) y un `AAAA-MM.json` por mes, para no cargar toda la legislatura de golpe.

## Qué hace

| Paso | Fuente | Resultado |
|---|---|---|
| Votaciones | Datos abiertos del Congreso (un JSON por votación, con el voto de cada diputado) | `data/votaciones/AAAA-MM-DD.json` con recuentos por grupo, posición mayoritaria y diputados que votaron distinto a su grupo |
| Diarios de Sesiones | PDF oficial del Pleno (`PL`) y de las comisiones (`CO`) | `data/sesiones/DSCD-15-PL-205.json` con cada turno de palabra, su orador, grupo, asunto, expediente y las reacciones que anota el Diario (aplausos, rumores, protestas) |
| Análisis | API de Claude | Resumen, tono, intensidad (1-5), temas, una cita **verificada literalmente** y, en respuestas del Gobierno, si contesta a la pregunta. Todo queda en caché en `data/analisis/` |
| Web | Todo lo anterior | `site/datos/indice.json` y `site/datos/AAAA-MM.json` |

## Puesta en marcha

Requisitos: Python 3.11+ y `pdftotext` (paquete `poppler-utils` en Linux, `brew install poppler` en macOS).

```bash
git clone https://github.com/<tu-usuario>/escano-abierto.git
cd escano-abierto
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # y pon tu ANTHROPIC_API_KEY
export $(cat .env | xargs)

python -m escano actualizar     # últimos 10 días
python -m http.server -d site   # abre http://localhost:8000
```

Otras órdenes:

```bash
python -m escano actualizar --desde 2026-09-01   # desde una fecha
python -m escano actualizar --sin-ia             # solo descarga y estructura, sin llamar a la API
python -m escano diario PL 205                   # procesa un Diario concreto
python -m escano construir                       # regenera los datos de la web con lo ya descargado
python -m escano reprocesar --sin-ia             # rehace sesiones y votaciones desde data/raw, sin red (tras cambiar el parser)
python -m escano calidad                         # indicadores del parser por sesión
python -m pytest                                 # tests (no necesitan red ni API)
```

El análisis del prototipo (MVP) está en `data/mvp.json`: `construir` lo usa solo en las sesiones que el pipeline aún no ha analizado con IA.

## Enlaces para compartir

`construir` genera una página estática por diputado, votación, sesión e iniciativa (`site/diputado/<nombre>/`, `site/votacion/<id>/`, `site/sesion/<id>/`, `site/iniciativa/<expediente>/`) con su título, descripción y una tarjeta de 1200×630 en `site/og/` (Pillow, tipografías Doto y Geist, licencia OFL, en `escano/fuentes/`). Al abrirlas, redirigen a la vista correspondiente de la web. También escribe `sitemap.xml` y `robots.txt`.

Las redes sociales necesitan direcciones absolutas: al desplegar, define `ESCANO_URL_SITIO` (p. ej. `https://escanoabierto.es`) antes de `construir`.

## Leyes, agenda y semanas

- `python -m escano agenda` descarga la **tramitación** de todos los proyectos y proposiciones de ley de la legislatura (`data/leyes.json`, de los datos abiertos de iniciativas) y el **orden del día** de los plenos convocados esta semana y la siguiente (`data/agenda.json`, del PDF enlazado en la agenda del Congreso). `actualizar` lo hace también.
- La pestaña **Leyes** muestra el embudo de la legislatura, quién propone y quién consigue, el «congelador» (iniciativas cuyo plazo de enmiendas se amplía semana tras semana) y cuánto tarda una ley; cada iniciativa tiene su línea de vida en `#iniciativa-<expediente>`.
- **La semana en el Congreso** (`#semana-AAAA-Sww`) resume cada semana sin IA: la votación más ajustada, las leyes que se han movido, los decretos, las tomas en consideración y quién votó distinto a su grupo. Cada semana tiene página para compartir y entra en el RSS general.
- La portada anuncia el **próximo pleno** con su orden del día.

## Entender y vigilar

- **Glosario** (`#glosario`) y **«¿Qué significa?»** en cada votación: una frase fija por tipo y resultado (una PNL aprobada no cambia ninguna ley). Los términos técnicos de la web enlazan al glosario.
- **Cómo se hace una ley** (`#como-ley`): siete pasos con las cifras reales de la legislatura.
- **Tus diputados** (`#provincia-<provincia>`): los diputados de cada circunscripción, su voto en las decisiones más ajustadas y sus preguntas. La portada recuerda la provincia elegida.
- **Temas para seguir** (`#tema-<tema>` y `site/tema/<tema>/rss.xml`): votaciones, leyes y puntos del próximo pleno sobre vivienda, sanidad, pensiones…, clasificados por palabras clave (`escano/temas.py`).
- **Preguntas escritas** (`#preguntas`): `python -m escano preguntas --completo` recorre el buscador de iniciativas por meses de registro y por días de cierre; `actualizar` repasa solo lo reciente. Se ven las pendientes, las que llevan más de 60 días sin respuesta y cuánto tarda el Gobierno en contestar.
- **Declaraciones de intereses** en la ficha de cada diputado (`data/intereses.json`, de los datos abiertos).

## Toda la legislatura

Para descargar la XV Legislatura desde el principio (agosto de 2023):

```bash
python -m escano actualizar --desde 2023-08-17 --sin-ia
```

Las votaciones se guardan compactas (`data/votaciones/AAAA-MM-DD.json`: la lista de diputados del día una vez y una letra por diputado en cada votación) para que la legislatura entera quepa en el repositorio. Las tarjetas para compartir (`site/og/`) no se versionan: se dibujan al construir.

## Búsqueda y RSS

La lupa de la barra (o `/`, o Ctrl/⌘+K) busca a la vez en diputados, votaciones, iniciativas, sesiones, temas e intervenciones, sin servidor y tolerando una errata por palabra.

`construir` escribe también canales RSS: `site/rss.xml` (votaciones y sesiones), `site/diputado/<nombre>/rss.xml` (solo lo destacable: votos distintos de los de su grupo e intervenciones analizadas) y `site/iniciativa/<expediente>/rss.xml` (debates y votaciones). La ficha y la vista de cada iniciativa enlazan el suyo con «Seguir».

## Marca

La web usa la marca **Marcador** por defecto: el panel de votaciones del hemiciclo, oscuro, con las cifras en matriz de puntos. Cada marca es una hoja en `site/marcas/<nombre>.css` que se carga encima de la base de `site/index.html`. Se puede probar otra con `?marca=<nombre>` o con el selector del pie (`?marca=tinta` es la base sin hoja extra, la marca original).

## Publicación automática

`.github/workflows/actualizar.yml` se ejecuta de martes a sábado por la mañana: descarga lo nuevo, analiza solo lo que no está en caché, guarda los datos en el repo y publica la web en GitHub Pages.

1. Crea el secreto `ANTHROPIC_API_KEY` en *Settings → Secrets and variables → Actions*.
2. (Opcional) Crea la variable `ESCANO_MODELO` para elegir modelo.
3. En *Settings → Pages*, elige **GitHub Actions** como origen.

## Estructura

```
escano/
  config.py       rutas, URLs y grupos parlamentarios
  red.py          descargas con caché y reintentos
  votaciones.py   votaciones nominales desde los datos abiertos
  diario.py       PDF del Diario → turnos de palabra
  analisis.py     llamadas a Claude (salida estructurada + caché)
  construir.py    une todo en site/datos/
  diputados.py    diputados en activo (circunscripción, formación)
  calidad.py      indicadores del parser
  cli.py          python -m escano …
site/             web estática
data/             datos generados (se versionan, salvo data/raw)
tests/            parser, votaciones y pipeline completo con un cliente simulado
docs/             notas del MVP y hoja de ruta
```

## Criterios

- Las citas solo se publican si aparecen literalmente en el Diario de Sesiones.
- El mismo prompt y los mismos criterios para todos los grupos. El tono y la intensidad son orientativos y cada sesión enlaza al texto oficial.
- Un grupo aparece como «dividido» cuando ningún sentido de voto reúne al 80 % de sus diputados.
- Las descargas esperan medio segundo entre peticiones para no cargar los servidores del Congreso.

## Hoja de ruta

Contexto del MVP e ideas en detalle: [docs/mvp-y-hoja-de-ruta.md](docs/mvp-y-hoja-de-ruta.md).

- [ ] Ficha por diputado: intervenciones, votos, asistencia y tono medio
- [ ] Quién decide: el grupo que inclina las votaciones ajustadas
- [ ] Resumen semanal automático («El pleno en 5 minutos»)
- [ ] Buscador conversacional con citas
- [ ] Enlace de cada intervención al vídeo oficial en el minuto exacto
- [ ] Seguimiento de cada ley desde la toma en consideración hasta el BOE

## Fuentes y licencia

Datos: [Congreso de los Diputados](https://www.congreso.es) (Diario de Sesiones y datos abiertos de votaciones). Si reutilizas los datos, cita la fuente. Este proyecto no está vinculado al Congreso.

Código bajo licencia MIT.
