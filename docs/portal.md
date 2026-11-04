# Portal: arquitectura, decisiones y puesta en marcha

Versión del 4 de noviembre de 2026. Acompaña al prototipo navegable del portal. Lo que cambia el producto está en [especificacion.md](especificacion.md); aquí está cómo está hecho y qué queda por decidir.

## Decisiones que esperan a Ricard

| # | Decisión tomada en el prototipo | Por qué | Alternativa |
| --- | --- | --- | --- |
| 1 | **Las fotos no salen del dispositivo.** Se guardan en el navegador (IndexedDB) y el PDF de impresión se genera también en el navegador. Es una desviación del stack (`sharp` + `pdf-lib` en el servidor). | Para la prueba de los 4 socios no hace falta subir fotos de menores a ningún servidor, cuesta 0 € y funciona sin cuentas. El renderizador es el mismo en pantalla y en el PDF, así que lo que se ve es lo que se imprime. | Para clientes reales: subir originales a Supabase Storage (TUS, ya está `tus-js-client`) y generar el PDF en el servidor al confirmarse el pago. |
| 2 | **Sin registro.** El borrador vive en el dispositivo; el enlace mágico queda para la versión con Supabase. | Menos fricción para la prueba. | Pedir el email en el paso 4, antes de pagar, y sincronizar el borrador. |
| 3 | **Mecánicas gratis, extras de pago.** Recuerdos estrella, Cuéntalo, 2 comodines y 4 cartas en blanco van incluidos; segunda copia, Pack Retos, acabado lino, envoltorio y envío urgente se pagan. | Las mecánicas hacen el juego mejor sin pedir decisiones de compra; los extras suben el ticket medio. | Cualquiera se mueve entre las dos listas cambiando `supabase/catalogo.json`. |
| 4 | **Precios propuestos** (pendientes de Pau): ver tabla de abajo. | Arrancan en 49 € y crecen por bloques de 10 cartas, sin techo práctico (hasta 300 cartas con foto). | Los precios viven en la base de datos (`packs`, `ajustes_catalogo`, `extras`), nunca en el código. |

## Precios del prototipo

| Concepto | Precio | Notas |
| --- | --- | --- |
| Pack Pareja | 49 € | 40 cartas con foto, que son también el mínimo para pagar |
| Pack Familia | 59 € | 60 cartas con foto |
| Ampliación | 6 € por cada 10 cartas | Se suma sola al pasar del pack; la barra avisa de los huecos libres |
| Caja adicional | 5 € | Una caja cada 120 cartas |
| Segunda copia | 60 % del mazo | Mismo mazo otra vez |
| Pack Retos | 6 € | 12 cartas de reto en el idioma del mazo |
| Acabado lino | 9 € | |
| Envoltorio de regalo | 4 € | |
| Envío urgente | 6 € | |
| Envío en España | Incluido | 5 a 8 días laborables |

Además de las fotos se imprimen siempre la portada (con la dedicatoria detrás), las cartas de las mecánicas y la caja. El total y el número de cartas se calculan en `src/domain/precios/cotizar.ts` y el servidor los recalcula antes de cobrar.

## Formas de jugar

El punto débil del juego: quien hace el mazo conoce todas las fechas. Hay cinco formas de jugar que convierten eso en parte del juego, y están en la web (`/como-jugar`) y en el folleto:

| Modo | Jugadores | Qué hace quien hizo el mazo |
| --- | --- | --- |
| Guardián de la memoria | 3–8 | No compite: presenta cada carta, decide los «Cuéntalo», da las pistas de los comodines y cuenta la historia al darle la vuelta. Recomendado para la primera partida, la del regalo. |
| Nuestra historia (cooperativo) | 2+, en equipo | Todos contra el mazo con 3 vidas; quien hizo el mazo solo puede decir «antes» o «después» una vez por carta. Récord apuntado en el folleto. |
| Duelo con ventaja | 2 | Empieza con 6 cartas y sin comodines; la otra persona con 4 y puede pedir una pista de una palabra por turno. |
| Generaciones | 4+, por equipos | Equipos que mezclan edades: los mayores saben las fechas antiguas y los pequeños las recientes. |
| Clásico | 2–6 | Las reglas base; si juega quien hizo el mazo, empieza con una carta más. |

Mecánicas que lo refuerzan: **Cuéntalo** (1 de cada 4 cartas: si la historia convence al grupo, te quedas la carta aunque falles), **Recuerdos estrella** (hasta 5: acertarlas da una carta extra), **comodines** y **cartas en blanco** para los recuerdos nuevos que salen jugando. Las reglas finales son de Jose.

## Cómo está hecho

```
navegador                                             servidor (Next.js en Vercel, fra1)
─────────                                             ──────────────────────────────────
fotos → exifr / nombre de archivo → fecha propuesta   /api/catalogo         catálogo (Supabase o semilla)
      → copia de trabajo + miniatura (IndexedDB)       /api/checkout         recalcula el precio y crea el pago
mazo (reductor con deshacer) ── guardado automático   /api/checkout/estado  confirma la vuelta de Stripe
renderizador de cartas (canvas) ── pantalla y PDF     /api/stripe/webhook   marca pagado y envía el correo
PDF de impresión (pdf-lib, 300 ppp, sangrado)
```

- **Dominio puro** en `src/domain/` (sin React ni Supabase): extracción de fechas de EXIF y nombres de archivo, precisión de fechas, orden temporal, validación del mazo, precios, recortes y reparto de mecánicas. Es lo más testeado.
- **Estilos declarativos:** `styles/<id>/style.json` sobre una plantilla (`styles/plantillas/naipe.json`). El código no conoce estilos concretos; añadir uno es crear su JSON.
- **Un solo renderizador** (`src/lib/carta/dibujar.ts`) para la vista previa, la línea temporal, la confirmación y el PDF.
- **PDF de impresión** (`src/lib/pdf/`): una página por cara (anverso y reverso intercalados) de 81 × 106 mm: carta de 63 × 88 mm con 3 mm de sangrado y 6 mm de margen para las marcas de corte, con TrimBox y BleedBox. Orden: portada, fotos en orden cronológico, comodines, cartas en blanco, retos y caja.
- **Precio en el servidor:** el navegador solo manda qué quiere; `/api/checkout` valida la petición, recalcula con el catálogo del servidor y crea la sesión de Stripe (solo claves de test) o simula el pago.
- **Idiomas:** `next-intl` con `es` y `en`; el idioma del mazo (meses, textos de las cartas, retos e instrucciones) es independiente del de la interfaz. Fechas siempre con `Intl.DateTimeFormat`.

## Instrucciones plegables

Una hoja de 252 × 176 mm (4 × 2 paneles de 63 × 88 mm, el tamaño de una carta) impresa a doble cara en un A4 apaisado:

1. Se dobla por la mitad a lo largo con la cara A fuera.
2. Se pliega en acordeón por las tres líneas verticales, con la portada delante.

La fila superior de la cara A va girada 180° para que, al abrir la portada, las reglas 1 a 4 se lean derechas y en orden. La cara B es un póster con «¿Cuándo fue?», la tabla de récords del modo cooperativo, el título del mazo y la dedicatoria. Se personaliza con el mazo en `/instrucciones`; la versión genérica en PDF está en `public/instrucciones/{es,en}.pdf` (`pnpm instrucciones:pdf`). Las medidas finales dependen del troquel de la caja que pida Pau a la imprenta.

## Base de datos (Supabase)

Migración: `supabase/migrations/20261104090000_esquema_inicial.sql`.

| Tabla | Acceso |
| --- | --- |
| `packs`, `extras`, `mecanicas`, `paises`, `ajustes_catalogo` | Lectura pública de lo activo; se editan desde el panel o con la clave de servicio |
| `perfiles` | Cada cual el suyo; el rol no se puede cambiar desde el cliente |
| `mazos`, `cartas` | Solo su propietario; la administración lo ve todo |
| `consentimientos` | Registro inmutable de aceptaciones (fotos, privacidad) |
| `pedidos` | Los crea el servidor; cada cliente ve los suyos |
| Buckets `fotos-originales`, `fotos-copias`, `impresion` | Privados; cada cliente en su carpeta `<usuario>/<mazo>/`; impresión solo para la administración |

**Borrado a los 60 días:** cada día a las 03:15 UTC, `pg_cron` llama a la función `purgar-fotos`, que borra las fotos y el PDF de los pedidos enviados hace más de 60 días y marca `purgado_en`.

**Pruebas:** `pnpm db:test` aplica la migración y la semilla (dos veces) sobre un Postgres vacío e imitando lo mínimo de Supabase, y comprueba 19 reglas de acceso (por ejemplo: B no ve ni toca el mazo de A, nadie se hace admin, el catálogo es público, la purga solo encuentra lo que toca).

### Puesta en marcha

1. Crear el proyecto en región UE (Frankfurt) y enlazarlo: `supabase link --project-ref <ref>`.
2. Aplicar el esquema y el catálogo: `supabase db push` y después `supabase/seed.sql` en el editor SQL (o `psql`). Si cambia `supabase/catalogo.json`, regenerar con `pnpm db:seed`.
3. Crear los dos secretos de la tarea de borrado, en el editor SQL:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<cadena aleatoria de 32+ caracteres>', 'purga_secreto');
   ```
4. Desplegar la función con el mismo secreto: `supabase secrets set PURGA_SECRETO=<el mismo valor>` y `supabase functions deploy purgar-fotos --no-verify-jwt`.
5. Auth: enlace mágico por email; URL del sitio y de redirección con el dominio de Vercel.
6. Dar el rol de administración a Ricard: `update perfiles set rol = 'admin' where id = '<su uuid>';`.
7. Variables en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (esta, solo de servidor).

## Pagos (Stripe, modo test)

- `STRIPE_SECRET_KEY` con una clave `sk_test_…` o `rk_test_…`; el servidor rechaza cualquier otra.
- Webhook a `/api/stripe/webhook` con `checkout.session.completed` y `checkout.session.async_payment_succeeded`, y su `STRIPE_WEBHOOK_SECRET`. En local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- Envío limitado a los países activos del catálogo. Tarjeta de prueba: 4242 4242 4242 4242.
- Sin clave, el pago se simula y el pedido nace pagado.

## Correo (Brevo)

`BREVO_API_KEY` más un remitente verificado (`BREVO_REMITENTE_EMAIL`, `BREVO_REMITENTE_NOMBRE`). El correo de confirmación (es y en) sale del webhook. Sin clave, se escribe una línea en el log sin la dirección del cliente. Las plantillas de Brevo están por crear con la cuenta definitiva.

## Pruebas

| Qué | Cómo | Estado |
| --- | --- | --- |
| Lógica (fechas, precios, validación, recortes, mecánicas, plan de impresión, reductor, semilla) | `pnpm test` (Vitest) | 111 tests |
| Subida, edición, estilo, pago simulado y PDF de 100 páginas | `pnpm test:e2e` (Playwright, escritorio y móvil) | Pasa |
| Migración, semilla y RLS | `pnpm db:test` | 19 comprobaciones |
| Accesibilidad WCAG 2.1 AA | axe-core sobre las 12 pantallas | Sin incidencias |

## Siguientes pasos

1. Marc valida el diseño del portal y de las cartas (ver [diseno/portal.md](diseno/portal.md)).
2. Ricard decide sobre la tabla de arriba, sobre todo el punto 1.
3. Los 4 socios crean su mazo en la vista previa y Ricard manda los 4 PDF a la imprenta para las pruebas.
4. Con el formato confirmado: ajustar `config/print.ts`, el troquel de la caja y el folleto.
5. Conectar Supabase (registro, sincronización del borrador, subida TUS) y generar la impresión en el servidor.
6. Panel de administración y plantillas de Brevo.
