# MVP y hoja de ruta

Notas del primer prototipo de Escaño Abierto (publicado el 24 de septiembre de 2026) y de las ideas para las siguientes versiones.

## Estado del MVP

El MVP cubre los plenos del 15, 16, 22 y 23 de septiembre de 2026 y una sesión de comparecencias en la Comisión de Sanidad. Incluye 58 intervenciones analizadas (resumen, tono, intensidad de 1 a 5, temas y una cita) y 19 votaciones importantes con el resultado oficial y la posición de cada grupo.

### Lo que no cubre todavía

- **La última semana solo tiene votaciones y orden del día.** El Congreso aún no había publicado el Diario de Sesiones del 22 y 23 de septiembre, así que las intervenciones analizadas son de la semana anterior.
- **Muchos debates están sin analizar.** Del MVP solo se pudieron leer las primeras ~30 páginas de cada Diario. Por eso faltan, por ejemplo, las preguntas 11–18 del día 16 y el debate de los decretos. La web marca cada punto como analizado, parcial o pendiente.
- **Por grupo sale lo que votó la mayoría, no el recuento exacto.** Se contrastó con los totales oficiales; donde no cuadraba aparece «s/d» (sin dato) o «Dividido».
- **Resúmenes, tono y citas están generados por IA.** Cada sesión enlaza a su Diario oficial para comprobarlas.

### Lo que ya sale

- El Congreso **derogó el decreto de transparencia de los lobbies** (RDL 21/2026) por 155 a 179.
- **Ceuta** ocupó casi toda la sesión de control del 16 de septiembre.
- La **moción del PP sobre educación** (punto I) salió adelante por 177 a 171 gracias a Junts.

### Siguiente paso

La versión en código de este repositorio descarga todos los Diarios y las votaciones y los analiza con la API de Claude cada día. Así se cubren los huecos del MVP y se puede ver el voto de cada diputado.

## Ideas para siguientes versiones

### Sobre lo que se dice

- **¿Contestó o se escabulló?** Puntuar si el ministro responde de verdad a la pregunta o cambia de tema. Pasó el 16 de septiembre: Feijóo preguntó por Ceuta y Sánchez acabó hablando del voto de los nietos. Daría un ranking de quién esquiva más.
- **Termómetro de la cámara.** El Diario de Sesiones anota «(Aplausos)», «(Rumores)», «(Protestas)» y las llamadas al orden de la presidenta. Con eso se mide cuánto ruido hay en cada sesión y cómo evoluciona semana a semana.
- **Mismo tema, distintas palabras.** Sobre Ceuta, unos dicen «invasión» y otros «crisis humanitaria». Un comparador del vocabulario de cada partido sobre el mismo asunto.
- **Verificador de cifras.** Detectar los datos que se citan («SMI +66 %», «309 millones», «400.000 plazas de FP») y contrastarlos con el INE, el BOE o Eurostat.
- **Promesas del Gobierno.** Guardar cada «vamos a aprobar…» y seguir si se cumple.

### Sobre cómo se vota

- **Quién decide.** En las votaciones ajustadas, saber qué grupo inclina la balanza. Junts dio la victoria al PP en educación (177 a 171) y en la derogación del decreto de los lobbies.
- **Voto de cada diputado.** Los datos oficiales incluyen el voto de cada uno. Con eso salen los diputados que votan distinto a su grupo, las ausencias y la disciplina de cada grupo.
- **Vida de una ley.** Seguir cada iniciativa desde la toma en consideración hasta el BOE, pasando por enmiendas y Senado.

### Producto

- **Ficha de tu diputado.** Por provincia, con sus intervenciones, votos, asistencia y tono medio.
- **Preguntar al Congreso.** Un buscador conversacional con citas. Por ejemplo: «¿qué ha dicho el PNV sobre la Y vasca este año?».
- **Resumen semanal automático.** «El pleno en 5 minutos», generado cada jueves por la noche.
- **Vídeo al minuto exacto.** Enlazar cada intervención al vídeo oficial del Congreso en el momento en que empieza.

### Ya incluido en la versión en código

- «¿Contesta?» en las respuestas del Gobierno.
- Termómetro de la cámara (aplausos, rumores, protestas y llamadas al orden por sesión).
- Voto de cada diputado y lista de quienes votaron distinto a su grupo.
