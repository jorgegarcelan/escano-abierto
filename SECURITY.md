# Seguridad

Si encuentras una vulnerabilidad, **no abras una incidencia pública**. Avisa en privado desde la pestaña *Security* del repositorio, con [«Report a vulnerability»](https://github.com/jorgegarcelan/escano-abierto/security/advisories/new). Responderé lo antes posible y, cuando esté arreglada, se reconocerá tu aviso si quieres.

Lo que más interesa:

- La función de Vercel de `api/` (el proxy de la noche electoral).
- Los workflows de `.github/workflows/`, que tienen permiso para escribir en el repositorio.
- Cualquier forma de inyectar HTML o JavaScript en la web a partir de los datos (`site/`).
- Claves o datos personales publicados por error en el repositorio o en su historial.

Los errores en los datos (un voto, una cifra, un nombre) no son vulnerabilidades: avísalos con una [incidencia normal](https://github.com/jorgegarcelan/escano-abierto/issues/new/choose).
