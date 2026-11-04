# Estilos de carta

Cada estilo es una plantilla declarativa: el código no conoce estilos concretos.

- `plantillas/<id>.json`: geometría de una familia de cartas (medidas en mm sobre la carta terminada), fuentes, tonos de foto e iconos de mecánicas. Hoy hay una: `naipe` (dirección D).
- `<estilo>/style.json`: un estilo concreto sobre una plantilla: nombre, tintas que puede elegir el cliente y colores.

Para añadir un estilo nuevo basta con crear `styles/<id>/style.json` y registrarlo en `src/lib/estilos.ts` (lista de estilos activos). Si necesita otra geometría, se crea otra plantilla y su dibujante en `src/lib/carta/`.

Las fuentes de las cartas (`public/fonts/cartas/`) son instancias estáticas de Bricolage Grotesque, con licencia SIL Open Font License 1.1 (`public/fonts/OFL.txt`).
