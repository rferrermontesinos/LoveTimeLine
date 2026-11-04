# Portal del juego de cartas personalizado (prototipo)

Web donde cada cliente crea su propio mazo para un juego de fechas: sube fotos, cada una con su fecha (año, mes y año, o día completo) y una frase opcional, añade si quiere recuerdos sin foto, elige la paleta de las cartas, paga un pack y recibe el mazo impreso con la caja y unas instrucciones plegadas al tamaño de una carta.

> **Estado:** prototipo navegable para los 4 socios. Los pagos son de prueba y las fotos no salen del dispositivo. El diseño está pendiente de la validación de Marc (ver [docs/diseno/portal.md](docs/diseno/portal.md)).
>
> El nombre comercial está por decidir y vive solo en [`config/brand.ts`](config/brand.ts).

## Qué hay

| Pantalla | Ruta | Qué hace |
| --- | --- | --- |
| Portada | `/es`, `/en` | Qué es, los tres packs con su precio a primera vista, tipos de juego y «Continuar mi mazo» si hay un borrador |
| Configurador | `/es/crear?pack=pequeno` | 4 pasos: fotos → cartas → estilo → pedido, con barra de precio siempre visible; empieza en Fotos con el pack elegido |
| Confirmación | `/es/pedido/confirmado` | Resumen del pedido y, durante el prototipo, descarga del PDF de impresión |
| Cómo se juega | `/es/como-jugar` | Una mesa con una partida en marcha, las reglas del Clásico y de Nuestra historia y los iconos de la esquina |
| Privacidad | `/es/privacidad` | Qué se hace con las fotos (RGPD) y autores de las fotos de muestra |
| Folleto (interno) | `/es/interno/folleto` | Folleto de 252 × 176 mm que se pliega hasta 63 × 88 mm, genérico o con el mazo; solo con `HERRAMIENTAS_INTERNAS=1` |
| Muestrario (interno) | `/es/interno/cartas` | Todas las caras de carta en cada paleta, para validar el diseño; solo con `HERRAMIENTAS_INTERNAS=1` |

**El configurador por dentro:**
- **Fotos:** se arrastran, se elige una carpeta entera o se seleccionan en la galería del móvil. La fecha solo se rellena sola cuando es segura (cámara o nombre del archivo sin señales de escaneo); si no, la carta queda en blanco con fechas sugeridas que se aceptan con un toque o en lote. Detecta duplicados por hash. Los recuerdos sin foto («El día que nos conocimos», «Nació [nombre]»…) se añaden aquí o en el paso 2 y cuestan lo mismo que una carta con foto.
- **Cartas:** fecha con precisión elegible, frase de 90 caracteres, encuadre por cara y adornos (emojis), con vista previa idéntica a la impresión. Cada carta lleva ✓ cuando está lista y no se pasa a Estilo hasta tenerlas todas.
- **Estilo:** paleta de color, título, dedicatoria, foto de portada, tono de las fotos (original, blanco y negro, cálido), idioma del mazo, extras de juego gratuitos y caja de siempre o personalizada con una foto.
- **Pedido:** pack y avisos de oferta, línea temporal ordenada, comprobaciones (baja resolución, fechas o fotos repetidas), extras de pago y total calculado en el servidor.
- **Guardado:** el borrador se guarda solo en el dispositivo, sin registrarse, y se puede seguir sin conexión.

## Cómo arrancarlo

Necesitas Node 22 y pnpm 10.

```bash
pnpm install
pnpm dev                  # http://localhost:3000
```

Sin variables de entorno funciona en **modo demostración**: fotos en el navegador (IndexedDB), catálogo desde `supabase/catalogo.json` y pago simulado. Para conectar servicios, copia `.env.example` a `.env.local` y rellena solo lo que uses.

| Servicio | Variables | Sin ellas |
| --- | --- | --- |
| Supabase (UE) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Catálogo de la semilla, pedidos sin guardar |
| Stripe (solo modo test) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Pago simulado |
| Brevo | `BREVO_API_KEY`, `BREVO_REMITENTE_EMAIL`, `BREVO_REMITENTE_NOMBRE` | El correo se registra en el log, sin la dirección del cliente |

## Comandos

```bash
pnpm dev                  # servidor local
pnpm lint && pnpm typecheck && pnpm test   # antes de dar algo por terminado
pnpm test:e2e             # Playwright: subida, editor, pago y PDF (necesita `pnpm fixtures`)
pnpm fixtures [n] [dir]   # genera n fotos sintéticas (sin personas) con fechas en EXIF y nombres
pnpm print:sample [pack]  # PDF de impresión de muestra en salidas/ (con el portal en marcha)
pnpm instrucciones:pdf    # PDF del folleto en salidas/folleto/ (con el portal en marcha y HERRAMIENTAS_INTERNAS=1)
pnpm db:seed              # regenera supabase/seed.sql desde supabase/catalogo.json
```

## Estructura

```
config/            brand.ts (nombre), print.ts (63 × 88 mm, sangrado, zona segura, 300 ppp)
messages/          textos de la interfaz por idioma (es, en)
styles/            estilo de carta declarativo: naipe/style.json (6 paletas) sobre la plantilla plantillas/naipe.json (caras e iconos)
src/domain/        lógica pura y testeada: fechas, precios y ofertas, cartas listas, validación del mazo, recortes, mecánicas, reglas
src/lib/carta/     renderizador único de cartas (pantalla y PDF usan el mismo código)
src/lib/pdf/       plan de impresión y PDF con sangrado, TrimBox/BleedBox y marcas de corte
src/lib/servidor/  catálogo, pedidos, Stripe, correo y semilla SQL (solo servidor)
src/components/    configurador, cartas, portada, folleto de instrucciones y piezas de interfaz
supabase/          migraciones con RLS, semilla, función de borrado a 60 días
tests/e2e/         Playwright
docs/              especificación, arquitectura y diseño
```

## Documentación

- [docs/especificacion.md](docs/especificacion.md): qué se construye y por qué.
- [docs/portal.md](docs/portal.md): arquitectura, decisiones, desviaciones del stack y puesta en marcha de Supabase, Stripe y Brevo.
- [docs/diseno/portal.md](docs/diseno/portal.md): dirección visual aplicada al portal, tokens y accesibilidad; pendiente de validar.
- [CLAUDE.md](CLAUDE.md): reglas del proyecto.

## Privacidad

Repositorio público: nada de secretos, claves, datos de clientes ni fotos reales. Las fotos de prueba se generan (`pnpm fixtures`) y las de muestra de la web son de Pexels, con licencia libre y sus autores en la página de privacidad (`public/muestras/creditos.json`).
