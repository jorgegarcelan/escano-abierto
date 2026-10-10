# Paso a la XVI legislatura

Las elecciones del 29 de noviembre de 2026 cierran la XV legislatura. Las Cortes nuevas se constituyen, como tarde,
25 días después (en la fecha que fija el Real Decreto de convocatoria). Esto es lo que cambia y en qué orden.

## Desde la disolución (6 de octubre) hasta la constitución

- **Diputados, plano del hemiciclo y comisiones.** Con la cámara disuelta, los datos abiertos del Congreso pueden traer
  solo a la Diputación Permanente. `diputados.actualizar()`, `hemiciclo.actualizar()` y `organos.actualizar()`
  conservan entonces lo anterior (umbral de 300 diputados o escaños; la mitad de miembros en comisiones).
- **Votaciones de la Diputación Permanente.** Convalida los decretos-leyes. Sus votaciones tienen unos sesenta miembros:
  no cuentan para los escaños por grupo (`construir`: solo votos con 300 presentes o más).
- **Leyes.** Pasan a «caducada» en los datos abiertos (`leyes.RESULTADOS`). La sección de elecciones las cuenta igual
  antes y después de ese cambio.
- **Preguntas escritas.** Las que no tengan respuesta caducan con la legislatura.

## Al constituirse las Cortes

1. `escano/config.py`: `LEGISLATURA = 16`, `LEGISLATURA_ROMANA = "XVI"`, `INICIO_LEGISLATURA` = fecha de la sesión
   constitutiva. Todo lo demás (URLs del Diario de Sesiones, votaciones, preguntas, iniciativas, tarjetas y enlaces de
   la web a las fichas del Congreso) lee de ahí.
2. **Archivar la XV** antes del primer `actualizar` de la XVI: copiar `data/` y `site/datos/` a una rama o carpeta
   `archivo/xv/` (decisión pendiente: si la web sigue mostrando la XV junto a la XVI, con un selector de legislatura,
   o si la XV queda como web estática aparte).
3. Vaciar lo que es de una sola legislatura: `data/votaciones/`, `data/sesiones/`, `data/estado.json` (avance de los
   Diarios), `data/preguntas.json`, `data/leyes.json`, `data/retos.json`. La caché de análisis (`data/analisis/`)
   puede quedarse: está indexada por el texto.
4. Grupos parlamentarios: revisar `config.GRUPOS` e `INFO_GRUPOS` con los grupos que se formen (códigos de los datos
   abiertos, nombre y color) y `ORDEN_HEMI` en `site/index.html`.
5. El plano del hemiciclo de la XVI aparece cuando el Congreso asigna los escaños (unas semanas después de la
   constitución); hasta entonces la web dibuja el hemiciclo genérico.
6. Glosario y textos que nombran la XV («La XV empezó el 17 de agosto de 2023»).

## Pendiente de decidir

- ¿Se mantiene la XV navegable dentro de la web (selector de legislatura) o se congela aparte?
- ¿La sección de elecciones se queda como «Elecciones 2026» con los resultados, o se retira al constituirse las Cortes?
