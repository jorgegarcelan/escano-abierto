# Sol, de Reforma Digital

Ficheros del sistema de diseño Sol de [Reforma Digital](https://github.com/samuelcorsan/reforma-digital), con su
licencia MIT (`LICENSE`), sin cambios. Commit `4a5e9763a3d13ce80a74a80741767e9d516c4f8d` (12-10-2026).

| Aquí | Allí |
|---|---|
| `tokens.css` | `packages/design/sol/tokens.css` |
| `botones.css` | `packages/design/sol/botones.css` |
| `r.svg` | la R de `apps/web/components/sol/logo.tsx`, en tinta (la R nunca va roja sobre amarillo) |

`../sol.css` traduce las variables de Escaño a las de Sol y compone la portada, la barra y el pie. Para traer una
versión nueva, se vuelven a descargar los dos CSS con el commit que toque:

    curl -sfO https://raw.githubusercontent.com/samuelcorsan/reforma-digital/<commit>/packages/design/sol/tokens.css
    curl -sfO https://raw.githubusercontent.com/samuelcorsan/reforma-digital/<commit>/packages/design/sol/botones.css

Lo que no se trae: las fuentes de pago (FFF Tool Serif Text y Ufficio; Sol tampoco las sirve y usa Georgia y Geist),
los iconos de Nucleo (licencia comercial) y los componentes de React y Tailwind.
