# Diseño del portal: dirección aplicada

| | |
| --- | --- |
| **Estado** | Prototipo navegable, **pendiente de validación de Marc** |
| **Entregado** | 4 de noviembre de 2026 (segunda versión el mismo día, con los cambios de Ricard); tercera versión el 20 de noviembre, con Fotos y Cartas más simples; por la tarde, la guía para elegir las fotos y la línea que quita presión en Fotos; por la noche, la subida colaborativa: «Pide fotos a los tuyos» en Fotos y la página «Manda tus fotos»; el 22 de noviembre, las cartas a la vista en la primera pantalla de Fotos, la invitación en una sola línea, «Solo cartas y fechas» y, en «Manda tus fotos», las fotos como cartas con su año y una frase antes de mandarlas |
| **Validado por Marc** | — (fecha cuando lo valide) |
| **Base** | Dirección visual D «Naipe» (v3), la de las cartas, ver el lienzo de dirección visual |

Ricard pidió el portal completo antes de los mockups validados, sabiendo que el diseño cambiará. Por eso todo lo visual sale de un único sitio (`src/styles/tokens/tokens.css`), de la plantilla de las cartas (`styles/plantillas/naipe.json`) y de su estilo (`styles/naipe/style.json`), para que los cambios de Marc se apliquen sin tocar las pantallas.

## Idea

**Cálido, lúdico y de mesa.** El portal se comporta como una mesa de juego: fondo de papel, cartas con sombra como si estuvieran apoyadas y piezas que salen de la propia carta (la pestaña de esquina con «?», los iconos de la esquina y el año grande). Nada de corazones ni ilustraciones infantiles: el romanticismo lo ponen las fotos. La franja de meses se ha quitado de las cartas y de la web a petición de Ricard. Desde el 20 de noviembre, en las cartas que se juegan la pestaña solo aparece si lleva un icono (comodín o carta en blanco): sin el recuadro «?» en la cara de la foto ni en la de la fecha. La pestaña con «?» se queda como marca en la portada y la caja.

## Tokens

| Token | Valor | Uso | Contraste sobre papel |
| --- | --- | --- | --- |
| `papel` | #F5F0E6 | Fondo | — |
| `papel-2`, `papel-3`, `linea` | #EDE6D8, #E4DCCB, #D9D1C3 | Superficies y divisores | — |
| `tinta` | #141414 | Texto y botones | 16,2:1 |
| `tinta-2` | #5E584F | Texto secundario | 6,2:1 |
| `rosa` | #F7739E | Paleta por defecto de las cartas, fondos con texto en tinta | 6,9:1 (texto tinta sobre rosa) |
| `verde` | #22A861 | Paleta verde de las cartas, confirmaciones | 6,0:1 (texto tinta sobre verde) |
| `rojo` | #E8402F | Acentos | 4,6:1 (texto tinta sobre rojo) |
| `amarillo` | #FFC93C | Avisos, cinta de prototipo | 12,0:1 (texto tinta sobre amarillo) |
| `cobalto` | #2E56E6 | Foco y enlaces | 5,2:1 |
| `rosa-texto`, `verde-texto`, `rojo-texto` | #B8205F, #11733F, #B42318 | Texto de color sobre papel | ≥ 5:1 |

**Paletas de las cartas** (`styles/naipe/style.json`): rosa (por defecto), rojo, amarillo, verde, cobalto y noche, cada una con fondo de pestaña y reverso, acento para las cartas sin foto y color de texto. Un test comprueba en todas texto sobre fondo ≥ 4,5:1 e icono frente a su hueco ≥ 3:1.

**Tipografía:** solo Bricolage Grotesque (variable, licencia OFL), en tres registros: titular (800, estrecha), subtitular (800, semiestrecha) y micro (mayúsculas espaciadas). Escala de 1,25 sobre 16 px.

**Formas:** radio de carta de 18 px (≈ 3 mm a escala), controles de 14 px, botones en píldora y pestaña de esquina con el radio solo abajo a la derecha. Sombras solo en las cartas.

**Iconos de la esquina:** gorro de bufón (comodín) y lápiz (carta en blanco), apagados desde el 22 de noviembre («Solo cartas y fechas») pero listos para volver, dibujados como rutas en una caja de 24 × 24 con trazos y huecos de 2 unidades o más para imprimirse bien a 2,8 mm. La web pinta exactamente los mismos.

## Pantallas para validar

| Pantalla | Qué mirar |
| --- | --- |
| Portada | Los tres packs a primera vista con su claim y precio, «Continuar mi mazo», abanico de cartas con las fotos de muestra, tipos de juego, tono de los textos |
| Cómo se juega | La mesa con una partida en marcha (3 piezas numeradas, el resto del mazo sin número; sin comodín ni carta en blanco desde el 22 de noviembre, con su hueco libre en la mesa), las reglas de los dos tipos con qué pasa con las fechas de solo el año |
| Guía para elegir las fotos | Cuántas fotos según el pack, los cuatro atajos numerados con iPhone y Android, las tarjetas de ordenador, papel y fotos de otros, la franja oscura de consejos y la llamada a crear el mazo |
| Paso 1 · Fotos | Vacío: la línea «No hace falta que sean perfectas…» con el enlace a la guía, consentimiento que se resalta si se intenta añadir fotos sin él y zona de subida con «o arrastra aquí archivos o una carpeta». Con cartas (22 de noviembre), lo primero son ellas: encima, «Añadir fotos», «Añadir una carpeta» (solo en ordenador) y «Seleccionar» con «Poner fecha» y «Borrar», la invitación en una línea y el resumen de la subida («N fotos añadidas · M sin fecha»); cuadrícula por fecha con las que no tienen al final y «≈» en las fechas aproximadas. En el móvil, con cartas, sin la línea que quita presión ni el título «Tus cartas», para que la primera carta asome en la primera pantalla (comprobado en iPhone SE, iPhone 14 y Pixel 7) |
| Paso 1 · Fotos: pedir fotos con un enlace | Una sola línea discreta con un «+» verde, «¿Alguien más tiene fotos? Pídeselas con un enlace», que se despliega: «Crear enlace»; después, «Mandar por WhatsApp» como botón principal, el enlace con «Copiar enlace» y «Más opciones» y «Cerrar enlace» discreto. Con el enlace creado, la línea dice «Tu enlace para pedir fotos · abierto hasta el …» y se queda plegada al volver; cuántas han llegado, con «Añadir al mazo», va fuera de la línea, a la vista |
| Manda tus fotos (quien recibe el enlace) | Lo primero que ve la familia del cliente, casi siempre en el móvil: la marca sin menú ni enlaces, «Manda tus fotos» con el truco para encontrarlas en Fotos del iPhone o Google Fotos, su nombre (opcional), el permiso que se resalta si falta, «Elegir fotos»; las fotos elegidas como cartas (dos columnas en el móvil), cada una con su año abajo y una frase opcional debajo, y «Mandar las N fotos» siempre a mano abajo; el progreso y el «¡Hecho!», y «Tus fotos, a salvo» con tres puntos; y los avisos de enlace caducado o incompleto |
| Paso 2 · Cartas | Aviso grande de cuántas faltan (o «¡Tu mazo está listo!»), la carta abierta con sus dos caras y herramientas a la misma altura que su fecha y su frase, sugerencias de fecha de un toque, el mazo entero por años con «Sin fecha» al final y punto amarillo en las que faltan, «Añadir más fotos» y las ideas de recuerdos sin foto |
| Paso 3 · Estilo | Paleta como elección principal, caja de siempre o personalizada con su foto, vista previa (caja, portada, carta), título, dedicatoria e idioma (los extras de juego con su icono, solo si se vuelven a encender) |
| Paso 4 · Pedido | Pack y cambio de pack, avisos de oferta, el mazo como se jugará, comprobaciones, extras, resumen con el total y pago bloqueado mientras falten cartas por completar |
| Barra inferior | Cartas frente al pack, oferta en una línea, total y siguiente paso; en Estilo y Pedido, cuántas cartas faltan por completar; estado del guardado |
| Confirmación | Abanico de celebración y descarga del PDF (solo durante el prototipo) |
| Muestrario interno | Las caras que se imprimen hoy, en cada paleta: foto, recuerdo sin foto, portada, caja de siempre y personalizada (la frase también delante, el comodín y la carta en blanco vuelven si se encienden) |
| Folleto interno | Los 8 paneles de cada cara, la fila de mini cartas del póster y el esquema de plegado |

## Accesibilidad

- WCAG 2.1 AA revisado con axe-core en las pantallas del configurador y las páginas públicas, sin incidencias.
- Foco visible en cobalto en todos los controles; las paletas son radios nativos.
- Los pasos bloqueados (Estilo y Pedido, sin ninguna carta) se anuncian (`aria-disabled` con su motivo) y siguen siendo enfocables.
- Deshacer con Ctrl/Cmd+Z (no mientras se escribe ni con diálogos abiertos).
- Las cartas dibujadas en canvas llevan su texto alternativo; las decorativas se ocultan a los lectores de pantalla. La escena de la mesa es una sola imagen con su descripción.
- Movimiento reducido respetado (`prefers-reduced-motion`).
- Objetivos táctiles de 44 px en móvil.

## Lo que más necesita la opinión de Marc

1. La pestaña de esquina como elemento de marca fuera de la carta, ahora sin la franja de meses y, en las cartas que se juegan, solo con icono; y los dos iconos (comodín y carta en blanco).
2. La cara del recuerdo sin foto y la carta en blanco: que se vean del mismo mazo.
3. La caja de siempre (solo la marca) frente a la personalizada (foto y título).
4. Los packs en la portada: si se entienden y se comparan bien en el móvil.
5. La mesa de «Cómo se juega» y las fotos de muestra.
6. La densidad del paso 3 en móvil (vista previa arriba, controles debajo).
7. El folleto interno: la portada y el póster de la cara B.
8. La guía para elegir las fotos: es la primera página de contenido largo y usa las piezas de siempre (tarjetas blancas, números de color y la franja oscura).
9. La subida colaborativa: la línea de Fotos que se despliega (WhatsApp como botón principal, con el botón oscuro de siempre y no con los colores de WhatsApp) y la página «Manda tus fotos», que es la primera impresión de la marca para quien aún no la conoce; en ella, las cartas por mandar con el año sobre la foto y la frase debajo.
10. Fotos con cartas (22 de noviembre): el mazo arriba con sus botones encima, y la mesa de «Cómo se juega» sin comodín ni carta en blanco, que deja libres dos esquinas.
