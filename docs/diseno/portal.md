# Diseño del portal: dirección aplicada

| | |
| --- | --- |
| **Estado** | Prototipo navegable, **pendiente de validación de Marc** |
| **Entregado** | 4 de noviembre de 2026 |
| **Validado por Marc** | — (fecha cuando lo valide) |
| **Base** | Dirección visual D «Naipe» (v3), la de las cartas, ver el lienzo de dirección visual |

Ricard pidió el portal completo antes de los mockups validados, sabiendo que el diseño cambiará. Por eso todo lo visual sale de un único sitio (`src/styles/tokens/tokens.css`) y de los estilos de carta (`styles/`), para que los cambios de Marc se apliquen sin tocar las pantallas.

## Idea

**Cálido, lúdico y de mesa.** El portal se comporta como una mesa de juego: fondo de papel, cartas con sombra como si estuvieran apoyadas y piezas que salen de la propia carta (la pestaña de esquina con «?», la franja de 12 meses, el año grande). Nada de corazones ni ilustraciones infantiles: el romanticismo lo ponen las fotos del cliente.

## Tokens

| Token | Valor | Uso | Contraste sobre papel |
| --- | --- | --- | --- |
| `papel` | #F5F0E6 | Fondo | — |
| `papel-2`, `papel-3`, `linea` | #EDE6D8, #E4DCCB, #D9D1C3 | Superficies y divisores | — |
| `tinta` | #141414 | Texto y botones | 16,2:1 |
| `tinta-2` | #5E584F | Texto secundario | 6,2:1 |
| `rosa` | #F7739E | Tinta del estilo Pareja, fondos con texto en tinta | 6,9:1 (texto tinta sobre rosa) |
| `verde` | #22A861 | Tinta del estilo Familia | 6,0:1 (texto tinta sobre verde) |
| `rojo` | #E8402F | Franja de meses, acentos | 4,6:1 (texto tinta sobre rojo) |
| `amarillo` | #FFC93C | Avisos, cinta de prototipo | 12,0:1 (texto tinta sobre amarillo) |
| `cobalto` | #2E56E6 | Foco y enlaces | 5,2:1 |
| `rosa-texto`, `verde-texto`, `rojo-texto` | #B8205F, #11733F, #B42318 | Texto de color sobre papel | ≥ 5:1 |

**Tipografía:** solo Bricolage Grotesque (variable, licencia OFL), en tres registros: titular (800, estrecha), subtitular (800, semiestrecha) y micro (mayúsculas espaciadas). Escala de 1,25 sobre 16 px.

**Formas:** radio de carta de 18 px (≈ 3 mm a escala), controles de 14 px, botones en píldora y pestaña de esquina con el radio solo abajo a la derecha. Sombras solo en las cartas.

## Pantallas para validar

| Pantalla | Qué mirar |
| --- | --- |
| Portada | Abanico de cartas, packs, formas de jugar, tono de los textos |
| Elegir pack | Las dos tarjetas de pack con su carta de muestra y el precio |
| Paso 1 · Fotos | Zona de subida, consentimiento, cuadrícula con fecha corta y punto de confianza (verde alta, amarillo media, rojo revisar) |
| Paso 2 · Cartas | Carta grande con las dos caras, selector de fecha con precisión, frase, encuadre y emojis |
| Paso 3 · Estilo | Vista previa (caja, portada, carta) y controles: estilo, color, título, dedicatoria, portada, tono, idioma, mecánicas |
| Paso 4 · Pedido | Línea temporal por años, comprobaciones con acciones, extras, resumen con el total |
| Barra inferior | Fotos frente al mínimo, total y botón siguiente; siempre visible |
| Confirmación | Abanico de celebración y descarga del PDF |
| Instrucciones | Folleto de 8 paneles, caras A y B, y el esquema de plegado |

## Accesibilidad

- WCAG 2.1 AA revisado con axe-core en las 12 pantallas (escritorio), sin incidencias.
- Foco visible en cobalto en todos los controles; los radios de estilo y portada son radios nativos.
- Deshacer con Ctrl/Cmd+Z (no mientras se escribe ni con diálogos abiertos).
- Las cartas dibujadas en canvas llevan su texto alternativo; las decorativas se ocultan a los lectores de pantalla.
- Movimiento reducido respetado (`prefers-reduced-motion`).
- Pendiente con Marc: revisar en móvil real los objetivos táctiles de la cuadrícula de fotos y del selector de fecha.

## Lo que más necesita la opinión de Marc

1. La pestaña de esquina y la franja de meses como elementos de marca fuera de la carta.
2. El abanico de la portada y de la confirmación (¿demasiadas cartas?).
3. La densidad del paso 3 en móvil (vista previa arriba, controles debajo).
4. La caja: hoy son dos caras del tamaño de una carta; el diseño real depende del troquel de la imprenta.
5. El folleto: la portada y el póster de la cara B.
