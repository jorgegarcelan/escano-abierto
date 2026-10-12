# Sol, de Reforma Digital

Ficheros del sistema de diseño Sol de [Reforma Digital](https://github.com/samuelcorsan/reforma-digital), con su
licencia MIT (`LICENSE`), sin cambios. Comprobados contra el commit `ef14a9ece7e7705814f8d36381eba447a404658a`
(12-10-2026).

| Aquí | Allí |
|---|---|
| `tokens.css` | `packages/design/sol/tokens.css` |
| `botones.css` | `packages/design/sol/botones.css` |
| `r.svg` | la R de `apps/web/components/sol/logo.tsx`, en tinta (la R nunca va roja sobre amarillo) |
| `favicon.svg` | el símbolo de Escaño con los colores de su icono (`apps/web/app/icon.svg`: rojo, y blanco en modo oscuro) |
| `apple-touch-icon.png` | el símbolo en blanco sobre `--atardecer` (lo dibuja Pillow con el degradado de `escano/paginas.py`) |

Lo que se adapta, no se copia (sus componentes son de React; aquí se llevan sus medidas y su estructura):

| Aquí | Allí |
|---|---|
| `../sol.css`, cabecera | `apps/web/components/sol/header.css` (80 px, `.boton-fantasma`, la acción en `.boton-claro`) |
| `../sol.css` e `index.html`, portada | `.in-hero` de `apps/web/components/sol/iniciativa.css` (la cabecera dentro del atardecer) |
| `../sol.css`, secciones y «El proyecto» | `.in-seccion` y `.in-manifiesto` de `iniciativa.css`; tipos `.t-*` de `sol/tokens.css` |
| `../sol.css` e `index.html`, pie | `apps/web/components/sol/footer.css` y `footer.tsx` (`.pie-sol`) |
| `../sol.css`, menú del móvil | la hoja amarilla de `header.css` (`.in-menu`) |
| `../sol.js` | los chevrones pixelados y la flecha de enlace externo de `apps/web/components/sol/icon.tsx` |
| `escano/paginas.py`, tarjetas Open Graph | su `og/template.html` y la portada: atardecer, amanecer, serif (Gelasio, con las medidas de Georgia) y cifras en Geist Mono |

`../sol.css` traduce las variables de Escaño a las de Sol y compone la web; `../sol.js` cambia las flechas de texto de
enlaces y botones (→, ↗, ↓, ←) por esos iconos. Para traer una versión nueva de los dos CSS, se vuelven a descargar
con el commit que toque:

    curl -sfO https://raw.githubusercontent.com/samuelcorsan/reforma-digital/<commit>/packages/design/sol/tokens.css
    curl -sfO https://raw.githubusercontent.com/samuelcorsan/reforma-digital/<commit>/packages/design/sol/botones.css

Lo que no se trae: las fuentes de pago (FFF Tool Serif Text y Ufficio; Sol tampoco las sirve y usa Georgia y Geist),
los iconos de Nucleo (licencia comercial: el bocadillo del pie es propio) y los componentes de React y Tailwind.
