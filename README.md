# Portal del juego de cartas personalizado (prototipo)

Web donde cada cliente crea su propio mazo para un juego de fechas: sube fotos, cada una con su fecha (año, mes y año, o día completo) y una frase opcional, elige el estilo de las cartas, paga un pack y recibe el mazo impreso con la caja y unas instrucciones plegadas al tamaño de una carta.

> **Estado:** prototipo navegable para los 4 socios. Los pagos son de prueba y las fotos no salen del dispositivo. El diseño está pendiente de la validación de Marc (ver [docs/diseno/portal.md](docs/diseno/portal.md)).
>
> El nombre comercial está por decidir y vive solo en [`config/brand.ts`](config/brand.ts).

## Qué hay

| Pantalla | Ruta | Qué hace |
| --- | --- | --- |
| Portada | `/es`, `/en` | Qué es, cómo se juega, packs y precios |
| Configurador | `/es/crear` | 4 pasos: fotos → cartas → estilo → pedido, con barra de precio siempre visible |
| Confirmación | `/es/pedido/confirmado` | Resumen del pedido y descarga del PDF de impresión |
| Cómo se juega | `/es/como-jugar` | Reglas, precisión de fechas, mecánicas y las 5 formas de jugar |
| Instrucciones | `/es/instrucciones` | Folleto de 252 × 176 mm que se pliega hasta 63 × 88 mm, personalizado con el mazo |
| Privacidad | `/es/privacidad` | Qué se hace con las fotos (RGPD) |

**El configurador por dentro:**
- **Fotos:** se arrastran, se elige una carpeta entera o se seleccionan en la galería del móvil. Lee la fecha del EXIF/XMP y del nombre del archivo (`IMG_20190814_…`, WhatsApp, capturas, «verano 2015»…), marca las dudosas para revisar y detecta duplicados por hash.
- **Cartas:** fecha con precisión elegible, frase de 90 caracteres, encuadre por cara y adornos (emojis), con vista previa idéntica a la impresión.
- **Estilo:** Pareja o Familia, color de tinta, título, dedicatoria, foto de portada, tono de las fotos (original, blanco y negro, cálido), idioma del mazo y mecánicas gratuitas.
- **Pedido:** línea temporal ordenada, avisos (baja resolución, fechas o fotos repetidas, fechas por revisar), extras de pago y total calculado en el servidor.

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
pnpm instrucciones:pdf    # regenera public/instrucciones/{es,en}.pdf (con el portal en marcha)
pnpm db:seed              # regenera supabase/seed.sql desde supabase/catalogo.json
```

## Estructura

```
config/            brand.ts (nombre), print.ts (63 × 88 mm, sangrado, zona segura, 300 ppp)
messages/          textos de la interfaz por idioma (es, en)
styles/            estilos de carta declarativos: pareja/style.json, familia/style.json y la plantilla común (plantillas/naipe.json)
src/domain/        lógica pura y testeada: fechas, precios, validación del mazo, recortes, mecánicas
src/lib/carta/     renderizador único de cartas (pantalla y PDF usan el mismo código)
src/lib/pdf/       plan de impresión y PDF con sangrado, TrimBox/BleedBox y marcas de corte
src/lib/servidor/  catálogo, pedidos, Stripe, correo y semilla SQL (solo servidor)
src/components/    configurador, cartas, folleto de instrucciones y piezas de interfaz
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

Repositorio público: nada de secretos, claves, datos de clientes ni fotos reales. Las fotos de prueba se generan (`pnpm fixtures`, `public/muestras/`).
