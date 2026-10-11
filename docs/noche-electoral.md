# La noche electoral (29N)

`#elecciones-noche` enseña el escrutinio provisional en directo: hemiciclo, candidaturas, mapa por provincia,
escaños en el aire y cómo se mueven los escaños durante la noche. Mientras no haya datos, ofrece un ensayo con el
23J (los resultados oficiales de 2023 repartidos en el tiempo; las cifras intermedias son simuladas).

## Cómo funciona

- El Ministerio del Interior publica el escrutinio en una web de Indra con JSON propios (`/backend-difu/…`), sin
  cabeceras CORS: el navegador no puede pedirlos directamente.
- `api/resultados.js` es una función de Vercel que los pide, los normaliza (`api/_normalizar.js`) y los sirve en
  `/api/resultados` con 15 segundos de caché en la CDN. Haya los lectores que haya, al Ministerio le llega como
  mucho una petición cada 15 segundos.
- La página consulta `/api/resultados` cada 20 segundos mientras está abierta y visible.
- Petición que se hace: `getScopeDataTopPartidosGanadores/00000000000000000000000b/1/2/1/1/30` (España, Congreso,
  con sus 52 provincias). Si los hijos no traen el código INE, se saca del nomenclátor.

## Qué hay que hacer

1. **Unos días antes** (en 2023 la web oficial apareció 3–4 días antes): localizar la dirección oficial de
   resultados en las notas de prensa del Ministerio del Interior o de La Moncloa. Ojo: hay dominios parecidos
   (`generales29n.es`, `elecciones29n.es`…) registrados por terceros; solo vale el que anuncie el Ministerio.
2. En Vercel → Settings → Environment Variables (Production): `ESCANO_RESULTADOS_URL` = el origen, p. ej.
   `https://resultados.ejemplo.es` (sin barra final). Volver a desplegar.
3. Comprobar `https://<la web>/api/resultados`:
   - `{"estado":"sin-escrutinio"}` antes de las 20.00: todo bien.
   - `{"estado":"error","motivo":"403 …"}`: el cortafuegos del Ministerio bloquea a Vercel. Probar otra región de
     funciones (Settings → Functions) o avisar.
   - `{"estado":"ok", …}`: en directo.
4. Si el nivel de las provincias cambiara, `ESCANO_RESULTADOS_NIVEL` (30 por defecto).

## Probar en local

```
node scripts/noche-local.mjs --muestra
```

Sirve la web en http://localhost:8031/#elecciones-noche con un «Ministerio» de pega que responde la muestra real de
las 22.03 del 23J (`tests/fixtures/resultados_23j_2203.json`). Sin `--muestra`, va contra `ESCANO_RESULTADOS_URL`.
Los tests: `node --test tests/resultados.test.mjs` (también se lanzan desde pytest).
