# Portal: arquitectura, decisiones y puesta en marcha

Versión del 20 de noviembre de 2026. Recoge los cambios que pidió Ricard el 4 de noviembre (packs por tamaño, dos tipos de juego, recuerdos sin foto, cartas sin franja de meses, caja personalizada, guardado en el dispositivo) y los del 20 de noviembre: pantallas de Fotos y Cartas más simples, fechas que se ponen solas cuando la foto las dice claras (y si no, una sugerencia de un toque), el mazo entero a la vista en Cartas, cartas sin recuadros «?» y sin recuerdo estrella, Estilo sin foto de portada ni tono y un archivo de impresión por imprenta. La tarde del 20 de noviembre se sumaron la regla de las fechas que solo dicen el año, una guía para elegir las fotos, una línea en Fotos para quitar presión y un repaso de «Cómo se juega». Acompaña al prototipo navegable del portal. Lo que cambia el producto está en [especificacion.md](especificacion.md); aquí está cómo está hecho y qué queda por decidir.

## Decisiones que esperan a Ricard

| # | Decisión tomada en el prototipo | Por qué | Alternativa |
| --- | --- | --- | --- |
| 1 | **Las fotos no salen del dispositivo.** Se guardan en el navegador (IndexedDB) y el PDF de impresión se genera también en el navegador. Es una desviación del stack (`sharp` + `pdf-lib` en el servidor). | Para la prueba de los 4 socios no hace falta subir fotos de menores a ningún servidor, cuesta 0 € y funciona sin cuentas. El renderizador es el mismo en pantalla y en el PDF, así que lo que se ve es lo que se imprime. | Para clientes reales: subir originales a Supabase Storage (TUS, ya está `tus-js-client`) y generar el PDF en el servidor al confirmarse el pago. |
| 2 | **Sin registro.** El borrador vive en el dispositivo, se guarda solo, se recupera al volver otro día y se puede seguir sin conexión. | Menos fricción para la prueba y nada que perder si se corta la conexión. | Pedir el email en el paso 4, antes de pagar, y sincronizar el borrador con Supabase. |
| 3 | **Extras de juego gratis, extras opcionales de pago.** 2 comodines y 4 cartas en blanco van incluidos (el recuerdo estrella se retiró el 20 de noviembre); segunda copia, envoltorio de regalo, envío urgente y caja personalizada se pagan. | Las mecánicas hacen el juego mejor sin pedir decisiones de compra; los extras suben el ticket medio. | Cualquiera se mueve entre las dos listas cambiando `supabase/catalogo.json`. |
| 4 | **Precios propuestos** (pendientes de Pau): ver tabla de abajo. | Tres packs por tamaño con su claim; cada carta de más se cobra suelta, los avisos de oferta dicen cuándo sale a cuenta pasar al pack mayor y, en cuanto sale más barato, se aplica solo. | Los precios viven en la base de datos (`packs`, `ajustes_catalogo`, `extras`), nunca en el código. |
| 5 | **Fechas: solas solo cuando la foto las dice claras; las dudosas, en blanco y con una sugerencia de un toque.** Se ponen solas la de la cámara y la escrita en el nombre, los metadatos o la carpeta. Quedan en blanco, con su porqué, una fecha de cámara de los últimos 7 días (`DIAS_PREPARACION`), 5 fotos de cámara o más del mismo día de las últimas 9 semanas en una subida, que serán fotos de fotos (`MINIMO_SESION_ESCANEO`, `DIAS_SESION_ESCANEO`), un escaneo sin fecha escrita y las de WhatsApp y las capturas de pantalla: su fecha es la del envío o la captura, y la foto puede ser de antes. Si son de hace más de un mes (`DIAS_PREPARACION_ENVIO`), su mes se sugiere y se pone con un toque; si son del último mes, no se sugiere nada. La fecha del archivo nunca se pone sola. Los contadores de cámara (`IMGP2015.JPG`) no cuentan como año, a cambio de que «Roma2014.jpg» se quede sin año. | Ricard, 20 de noviembre: «no elijas fechas si no las tienes claras» y que al cliente le cueste lo menos posible. Aceptar una sugerencia cuesta un toque, lo mismo que revisar una fecha puesta sola, y no se imprime ninguna fecha dudosa sin que el cliente la haya visto. Para animar, Cartas dice cuántas faltan, cuántas se completan con un toque y «¡Ya casi!» al final, y tras cada toque se abre sola la siguiente. | Cada umbral es una constante en `src/domain/fechas/`. Si se prefiere que el cliente no tenga que tocar nada, el mes de WhatsApp y de las capturas antiguas puede volver a ponerse solo con «≈» (así estuvo la mañana del 20 de noviembre). |
| 6 | **Descarga de los archivos de impresión en la confirmación solo durante el prototipo**, uno por imprenta. La controla `NEXT_PUBLIC_DESCARGA_PDF` en `config/prototipo.ts` (activa salvo que valga `0`), y solo con el pedido pagado. | Los 4 socios necesitan los archivos para las pruebas de imprenta; para clientes no se podrán descargar. | Con Supabase, los archivos se generan en el servidor y solo los ve la administración. |

## Precios del prototipo

| Concepto | Precio | Notas |
| --- | --- | --- |
| Pack Pequeño · ideal para parejas | 49 € | 40 cartas de recuerdo, con foto o sin foto, que son también el mínimo para pagar. Cada carta de más: 0,80 € |
| Pack Mediano · ideal para familias o amigos | 59 € | 60 cartas. Cada carta de más: 0,70 € |
| Pack Grande · ideal para bodas, aniversarios y grandes celebraciones | 79 € | 100 cartas. Cada carta de más: 0,60 € |
| Cambio de pack | — | El precio nunca pasa del de un pack mayor ni baja al sumar cartas: en cuanto un pack mayor sale más barato, se cobra ese, aunque el mazo aún no tenga sus cartas. Con 53 cartas en el Pequeño (59,40 € sueltas) se pagan los 59 € del Mediano y el aviso dice «Ya te aplicamos el pack Mediano: te ahorras 0,40 € y te caben 7 cartas más sin pagar nada». Se imprimen las cartas que hay, sin huecos en blanco. Un poco antes, el aviso propone sumar cartas («Con 10 cartas más pasas al pack Mediano por solo 2 € más»). |
| Caja adicional | 5 € | Una caja cada 120 cartas |
| Segunda copia | 60 % del mazo | Mismo mazo otra vez |
| Envoltorio de regalo | 4 € | |
| Envío urgente | 6 € | 24–48 h después de imprimir |
| Caja personalizada | 7 € | Con una foto del mazo o una nueva y el título. Sin ella va la caja de siempre, que es de stock |
| Envío en España | Incluido | 5 a 8 días laborables |

Además de los recuerdos se imprimen siempre la portada (con la dedicatoria detrás) y las cartas de las mecánicas (comodines y cartas en blanco); la caja personalizada, si se elige. La caja de siempre es packaging de stock y no va en el archivo de impresión. El total y el número de cartas se calculan en `src/domain/precios/cotizar.ts`, con sus ofertas (`pack-aplicado`, `subir`, `bajar`), y el servidor los recalcula antes de cobrar.

## Tipos de juego

Dos tipos, en la web (`/como-jugar`) y en el folleto. Los textos están en `messages/<idioma>/juego.json` y los números en `src/domain/juego/reglas.ts`. **Las reglas finales son de Jose**, después de sus partidas de prueba.

| Tipo | Personas | Cómo va |
| --- | --- | --- |
| Clásico (competitivo) | 2–6 | 7 cartas por persona (8 para quien hizo el mazo). En tu turno colocas una carta en la línea; si la fecha no encaja, va al descarte y robas. Gana quien coloca todas antes, terminando la ronda para que todos jueguen las mismas veces. |
| Nuestra historia (cooperativo) | 2–6, en equipo | Todos contra el mazo, con tantas vidas como personas más una. Quien hizo el mazo no recibe cartas: es el guardián de la memoria, responde las pistas y cuenta cada recuerdo. Variante «Historia completa» con el mazo entero (una vida por cada 8 cartas). |

**Fechas que solo dicen el año (o el mes):** si la carta que se juega o la de la línea solo dice el año, dos cartas del mismo año valen en cualquier orden entre sí; lo mismo con el mismo mes si una no dice el día. En el Clásico la carta se queda; en Nuestra historia no se pierde vida. Se compara con toda la línea, no solo con las vecinas (`huecosValidos` y `puedeIrAntes` en `src/domain/fechas/fecha.ts`). Va en el turno de cada tipo, en la web y en el folleto. Ricard la pidió el 20 de noviembre para Jose; los textos definitivos de cada juego llegarán más adelante.

**Repaso del 20 de noviembre:** Ricard quitó el consejo de primera partida («Para la primera partida, Nuestra historia con quien hizo el mazo de guardián…») y la explicación del mazo de robo en la escena de la mesa, que ahora numera 5 piezas y deja el resto del mazo sin número. Nuestra historia ya no remite al Clásico: su preparación se explica entera.

Cuántas personas caben según el pack (7 cartas cada una y algo de mazo para robar): Pequeño, de 2 a 4 (5 como mucho); Mediano, de 2 a 6; Grande, de 2 a 6 o por parejas.

**Iconos de la esquina:** el comodín (pista de quien hizo el mazo o cambio de carta) y la carta en blanco (para los recuerdos que salen jugando). El recuerdo estrella se retiró el 20 de noviembre: los mazos guardados que lo tenían lo pierden al abrirse, sin más cambios.

## Fechas: solas cuando están claras

`src/domain/fechas/proponer.ts` decide, en el navegador y sin guardar los metadatos en bruto:

- **Se pone sola** la fecha de la cámara (la original de los datos de la foto, o la del nombre que pone el móvil: `IMG_20190814_…`, `PXL_…`, `20190814_123045`); la escrita por una persona en el nombre, en los metadatos o en la carpeta («abuelos 1958», «2015-08 Menorca», «Menorca 2015/»), que gana a la de la cámara si es anterior (una foto de una foto antigua) y, la de la carpeta, solo si es de 2 años antes o más. Un escáner que guarda la fecha original (1987) también la pone.
- **Queda en blanco con su mes como sugerencia de un toque** la de envío de WhatsApp u otra mensajería y la de una captura de pantalla de hace más de un mes: la foto, o lo que sale en la captura, puede ser de antes. Las del último mes quedan en blanco sin sugerencia: casi siempre son reenvíos para el mazo que han perdido la fecha.
- **Queda en blanco**, con la fecha que trae como sugerencia de un toque y su porqué, si seguramente es de preparar el mazo: cámara de los últimos 7 días, 5 o más fotos de cámara del mismo día de las últimas 9 semanas en una subida (fotos de fotos) o un escaneo sin fecha escrita.
- **Nunca se pone sola** la fecha del archivo (es la de la copia o la descarga; como mucho se sugiere, y nunca la del último mes), la de digitalización de un escaneo ni la de un reloj sin configurar.
- **Mazos ya guardados:** al abrirse con estas reglas (`POLITICA_FECHAS` 3, en `src/lib/mazo/tipos.ts`), una sola vez (`mejorarFechasGuardadas` en `src/lib/mazo/migrar.ts`): las cartas que quedaron en blanco con una sugerencia que ahora se pondría sola pasan a tenerla, y el mes de WhatsApp o de una captura que se puso solo con «≈» la mañana del 20 de noviembre vuelve a quedar en blanco, con ese mes como sugerencia. No se tocan las fechas puestas a mano ni las sugerencias ya aceptadas, y no se borra nada.

Una carta está lista con una fecha válida y no futura, la frase dentro del límite y, si es un recuerdo sin foto, el texto completo (sin huecos como «[nombre]»). Estilo y Pedido se abren en cuanto hay alguna carta; lo que espera a que estén todas listas es el pago (`src/domain/mazo/configuracion.ts`). En Cartas, un aviso grande dice cuántas faltan (con 3 o menos, «¡Ya casi!»), cuántas se completan con un toque y «Completar la siguiente», o que el mazo está listo; en Estilo y Pedido lo dice la barra de abajo. Al usar una sugerencia, la carta queda lista y se abre sola la siguiente por completar, con el foco en su sugerencia y una confirmación al lado («Hecho: la anterior ya tiene fecha (julio de 2008). Te quedan 14 cartas.»); en el móvil, la sugerencia lleva una miniatura de la foto para decidir sin subir. Con la última, se pasa al aviso de mazo listo.

## Pantallas del configurador

1. **Fotos:** una línea que quita presión («No hace falta que sean perfectas: una foto movida de un gran día da más juego que una bonita que no cuenta nada.») con «Ideas para elegirlas», que abre la guía en otra pestaña; el permiso (si se intenta añadir fotos sin él, se resalta y dice qué falta), elegir fotos o una carpeta o arrastrarlas, y la cuadrícula ordenada por fecha con las que no tienen al final. Una sola herramienta: «Seleccionar», para poner la misma fecha a varias o borrarlas.
2. **Cartas:** el aviso de cuántas faltan; la carta abierta, con sus dos caras y sus herramientas (encuadrar, girar, emojis, borrar) a un lado y su fecha y su frase al otro, a la misma altura; y debajo el mazo entero como se jugará, por años y con las que no tienen fecha al final, «Añadir más fotos» (también soltándolas) y, discretas, ideas de recuerdos sin foto («El día que nos conocimos»…). La calidad de impresión solo aparece, en una línea, si la foto se queda corta.
3. **Estilo:** colores, título, dedicatoria, idioma del mazo, caja y extras de juego. La foto de portada es automática (la más reciente con fecha) y las fotos salen siempre con su color.
4. **Pedido:** el pack, la línea del tiempo (la misma vista del mazo que en Cartas), las comprobaciones, los extras y el pago, que no se activa hasta que todas las cartas están listas.

## Cómo está hecho

```
navegador                                             servidor (Next.js en Vercel, fra1)
─────────                                             ──────────────────────────────────
fotos → exifr / nombre / señales de escaneo           /api/catalogo         catálogo (Supabase o semilla)
      → fecha segura o sugerencias                    /api/checkout         recalcula el precio y crea el pago
      → copia de trabajo + miniatura (IndexedDB)       /api/checkout/estado  confirma la vuelta de Stripe
mazo (reductor con deshacer) ── guardado automático   /api/stripe/webhook   marca pagado y envía el correo
renderizador de cartas (canvas) ── pantalla y PDF
PDF de impresión (pdf-lib, 300 ppp, sangrado)
service worker: reabrir /crear sin conexión
```

- **Dominio puro** en `src/domain/` (sin React ni Supabase): extracción de fechas de EXIF y nombres de archivo, señales de escaneo, precisión de fechas, orden temporal, cartas listas, validación del mazo, precios y ofertas, recortes, reparto de mecánicas, reglas del juego y contraste de colores. Es lo más testeado.
- **Un solo estilo de carta, «Naipe», con 6 paletas** (`styles/naipe/style.json` sobre la plantilla `styles/plantillas/naipe.json`). El cliente elige la paleta; el código no conoce estilos concretos y añadir uno es crear su JSON. La plantilla lleva los iconos de la esquina como rutas vectoriales, los mismos en la web y en la carta.
- **Caras de carta:** recuerdo con foto, recuerdo sin foto (texto grande y la fecha detrás), portada, comodín, carta en blanco y caja (la de siempre o la personalizada). Sin franja de meses: se queda la pestaña de la esquina.
- **Un solo renderizador** (`src/lib/carta/dibujar.ts`) para la vista previa, la línea temporal, la confirmación, el muestrario y el PDF.
- **Archivos de impresión** (`src/lib/pdf/`): uno por imprenta, según su perfil en `config/print.ts` (`IMPRENTAS`). Las cartas se dibujan siempre con los 3 mm de sangrado del diseño; si la imprenta pide más, el borde se amplía en espejo, y si pide menos, se recorta. Todas las páginas llevan TrimBox (63 × 88 mm) y BleedBox, a 300 ppp. Orden: portada, recuerdos con y sin foto en orden cronológico, comodines, cartas en blanco y, solo con el extra, la caja personalizada.

  | Perfil | Sangrado | Marcas de corte | Páginas | Página |
  |---|---|---|---|---|
  | AGR · Tipia | 4 mm | No | Caras y reversos en dos PDF, dentro de un ZIP con un `LEEME.txt` que explica cómo casan | 71 × 96 mm |
  | Pinbro | 3 mm | No | Cada carta seguida de su reverso, un solo PDF; cada página por debajo de 3 MB | 69 × 94 mm |
  | Soriano | 2 mm | Sí | Cada carta seguida de su reverso | 79 × 104 mm |
  | Otra imprenta | 3 mm | Sí | Cada carta seguida de su reverso | 81 × 106 mm |

  Todas piden CMYK FOGRA39 y los archivos salen en RGB (sRGB): Pinbro lo convierte; a AGR y a Soriano hay que pedírselo al mandarlo. Convertir a CMYK en la web necesita una librería y un perfil ICC con licencia, y queda pendiente del visto bueno de Ricard.
- **Precio en el servidor:** el navegador solo manda qué quiere; `/api/checkout` valida la petición, recalcula con el catálogo del servidor y crea la sesión de Stripe (solo claves de test) o simula el pago.
- **Idiomas:** `next-intl` con `es` y `en`; el idioma del mazo (meses, textos de las cartas, recuerdos sin foto sugeridos y folleto) es independiente del de la interfaz. Fechas siempre con `Intl.DateTimeFormat`.

## Guía para elegir las fotos

`/<idioma>/guia-fotos`, pública y enlazada desde Fotos y el pie. Cuántas fotos pide cada pack (del catálogo, no del código); cuatro atajos en el móvil, con lo que se hace en Fotos del iPhone y en Google Fotos (favoritas, personas, buscar por lugar o palabra y un álbum para el mazo); el ordenador, las fotos de papel (una foto con el móvil, con buena luz y sin reflejos, basta) y las que tienen otros; y qué fotos dan más juego en la partida. El texto sobre pedir fotos a otros por enlace solo aparece cuando la subida colaborativa está configurada (`NEXT_PUBLIC_COLABORACION_URL`). Sirve también para que la encuentren los buscadores cuando se abra la indexación. Los textos están en `messages/<idioma>/guia.json` y, como el resto del diseño, pendientes de Marc.

## Guardado y sin conexión

- El borrador se guarda solo en IndexedDB mientras se trabaja (las fotos recién importadas, al momento; los cambios, con una pequeña espera), también al ocultar la página, y el navegador lo marca como persistente tras el consentimiento o la primera foto. Al volver otro día, el configurador sigue donde se dejó y la portada ofrece «Continuar mi mazo». Si una importación se corta, no quedan cartas a medias ni fotos sueltas.
- Sin conexión se puede seguir trabajando: un aviso lo explica y el botón de pagar se desactiva hasta que vuelva la red. Un service worker escrito a mano (`public/sw.js`, solo en producción) guarda una copia de las páginas del configurador (primero la red) y de los archivos estáticos y las fuentes de las cartas (primero la copia), nunca de `/api`, de las peticiones internas de Next ni de direcciones con parámetros: las fotos siguen solo en IndexedDB. Cada despliegue tiene su versión (`VERCEL_DEPLOYMENT_ID`, o la hora de compilación en local) y el service worker nuevo borra las copias del anterior.
- Dos pestañas con el mismo borrador no se pisan: la segunda avisa.

## Folleto y muestrario (herramientas internas)

El folleto plegable ya no está en la web: forma parte del producto, dentro del packaging. Se genera con dos herramientas internas que solo responden con `HERRAMIENTAS_INTERNAS=1` (nunca en producción) y llevan `noindex`:

- `/<idioma>/interno/folleto`: una hoja de 252 × 176 mm (4 × 2 paneles de 63 × 88 mm, el tamaño de una carta) a doble cara en un A4 apaisado, genérica (`?generico=1`) o con el mazo guardado en el navegador (personas, vidas y mecánicas según sus cartas). Se dobla por la mitad a lo largo con la cara A fuera y se pliega en acordeón por las tres líneas verticales; la fila superior de la cara A va girada 180° para que las reglas se lean derechas al abrirla. El PDF para la imprenta sale con `pnpm instrucciones:pdf` en `salidas/folleto/`.
- `/<idioma>/interno/cartas`: el muestrario de todas las caras en cada paleta y en los dos idiomas del mazo, para validar el diseño.

Las medidas finales del folleto y de la caja dependen del troquel que se pida a la imprenta.

## Base de datos (Supabase)

Migraciones en `supabase/migrations/` (esquema inicial y catálogo del 4 de noviembre).

| Tabla | Acceso |
| --- | --- |
| `packs`, `extras`, `mecanicas`, `paises`, `ajustes_catalogo` | Lectura pública de lo activo; se editan desde el panel o con la clave de servicio |
| `perfiles` | Cada cual el suyo; el rol no se puede cambiar desde el cliente |
| `mazos`, `cartas` | Solo su propietario; la administración lo ve todo |
| `consentimientos` | Registro inmutable de aceptaciones (fotos, privacidad) |
| `pedidos` | Los crea el servidor; cada cliente ve los suyos |
| Buckets `fotos-originales`, `fotos-copias`, `impresion` | Privados; cada cliente en su carpeta `<usuario>/<mazo>/`; impresión solo para la administración |

**Borrado a los 60 días:** cada día a las 03:15 UTC, `pg_cron` llama a la función `purgar-fotos`, que borra las fotos y el PDF de los pedidos enviados hace más de 60 días y marca `purgado_en`.

**Pruebas:** `pnpm db:test` aplica las migraciones y la semilla (dos veces) sobre un Postgres vacío e imitando lo mínimo de Supabase, y comprueba las reglas de acceso (por ejemplo: B no ve ni toca el mazo de A, nadie se hace admin, el catálogo es público, la purga solo encuentra lo que toca).

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
7. Variables en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (esta, solo de servidor). No activar `HERRAMIENTAS_INTERNAS` en producción.

## Publicación para los socios (URL secreta)

Mientras sea un prototipo, el portal se publica en Vercel (fra1) bajo un subdominio de antipode-prints.com, cerrado con una clave y fuera de los buscadores:

- **Acceso privado** (`src/lib/servidor/acceso.ts`, aplicado en `src/proxy.ts`): con `CLAVE_ACCESO` en el entorno, las páginas y la API responden 403 salvo a quien abre una vez `https://<subdominio>/?acceso=<clave>`. El proxy guarda en ese navegador una cookie `HttpOnly` con la huella SHA-256 de la clave (nunca la clave) durante 90 días y quita la clave de la dirección. Cambiar la clave en Vercel y volver a desplegar deja fuera a todos. El webhook de Stripe y los archivos estáticos (fuentes, fotos de muestra, `sw.js`, `robots.txt`) no se bloquean: no tienen nada privado.
- **Sin buscadores** (`PERMITIR_INDEXAR`, en `config/prototipo.ts`): `robots.txt` con `Disallow: /`, cabecera `X-Robots-Tag: noindex, nofollow, noarchive` en todas las respuestas y `<meta name="robots" content="noindex">` en las páginas. Para la comercialización, `PERMITIR_INDEXAR=1`.
- **Modo demostración:** sin Supabase, Stripe ni Brevo. Las fotos no salen del navegador de cada socio (IndexedDB), el PDF se genera en el navegador y el pago es simulado; al servidor solo llegan el pack y el número de cartas.
- **Variables en Vercel:** `CLAVE_ACCESO` (sensible, solo de servidor) y `HERRAMIENTAS_INTERNAS=1` para que los socios vean el folleto y el muestrario detrás de la clave. Ninguna otra.
- **Dominio:** un registro DNS `CNAME` del subdominio a Vercel, en el proveedor de DNS de antipode-prints.com. El nombre del subdominio no es secreto (los certificados HTTPS son públicos); lo que protege es la clave.

## Pagos (Stripe, modo test)

- `STRIPE_SECRET_KEY` con una clave `sk_test_…` o `rk_test_…`; el servidor rechaza cualquier otra.
- Webhook a `/api/stripe/webhook` con `checkout.session.completed` y `checkout.session.async_payment_succeeded`, y su `STRIPE_WEBHOOK_SECRET`. En local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- Envío limitado a los países activos del catálogo. Tarjeta de prueba: 4242 4242 4242 4242.
- Sin clave, el pago se simula y el pedido nace pagado. Si se cancela en Stripe, se vuelve al paso Pedido con el borrador tal cual y un aviso de que no se ha cobrado nada; se puede volver a pagar.

## Correo (Brevo)

`BREVO_API_KEY` más un remitente verificado (`BREVO_REMITENTE_EMAIL`, `BREVO_REMITENTE_NOMBRE`). El correo de confirmación (es y en) sale del webhook. Sin clave, se escribe una línea en el log sin la dirección del cliente. Las plantillas de Brevo están por crear con la cuenta definitiva.

## Fotos de muestra

Las fotos de la web y del muestrario son de Pexels (licencia libre, también comercial), recortadas y sin metadatos con `scripts/muestras/preparar.ts`; los autores salen en la página de privacidad. No se usan fotos con menores en las páginas públicas ni se da a entender que las personas de las fotos recomiendan el producto. Los recuerdos de ejemplo son inventados («Ana y Leo»).

## Pruebas

| Qué | Cómo | Estado |
| --- | --- | --- |
| Lógica (fechas, escaneos, cartas listas, precios y ofertas, validación, recortes, mecánicas, reglas, plan de impresión, reductor, paletas, guardado, service worker, fotos de muestra, semilla) | `pnpm test` (Vitest) | 670 pruebas en 47 archivos |
| Configurador de principio a fin (empezar en Fotos con un pack, fechas solas y sugeridas de un toque con salto a la siguiente, la misma fecha a varias, fechas de preparar el mazo y fotos de fotos, Estilo y Pedido con cartas pendientes, «Siguiente» con la fecha en blanco, recuerdo sin foto desde las ideas, paleta, caja personalizada con y sin foto, oferta, pago simulado y cancelado, PDF), en escritorio y móvil | `tests/e2e/mazo.spec.ts` | 22 |
| Volver sin conexión y service worker tras un despliegue | `tests/e2e/sin-conexion.spec.ts` | 4 |
| Portada, «Cómo se juega» (con la regla de las fechas de solo el año), guía para elegir las fotos, créditos de las fotos y rutas internas cerradas | `tests/e2e/paginas.spec.ts` | 36 |
| Migración, semilla y RLS | `pnpm db:test` | 19 comprobaciones |

Las pruebas de Playwright (`pnpm test:e2e`, 62 en total entre escritorio y móvil; 5 se saltan a propósito porque solo tienen sentido en uno de los dos) compilan la web con `NEXT_PUBLIC_DESCARGA_PDF=1`. `pnpm print:sample` genera los archivos de impresión con datos ficticios, uno por imprenta: recorre el portal como un cliente con fotos sintéticas y deja en `salidas/` un mazo con portada y dedicatoria, una carta con frase, un recuerdo sin foto, las cartas de las mecánicas y la caja personalizada (`--sin-caja` la quita).

## Siguientes pasos

1. Marc valida el diseño del portal y de las cartas (ver [diseno/portal.md](diseno/portal.md) y el muestrario interno).
2. Ricard decide sobre la tabla de arriba, sobre todo los puntos 1 y 5; Pau, los precios; Jose prueba las reglas.
3. Los 4 socios crean su mazo en la vista previa y Ricard manda a cada imprenta su archivo para las pruebas.
4. Con el formato confirmado: ajustar `config/print.ts`, el troquel de la caja y el folleto.
5. Conectar Supabase (registro, sincronización del borrador, subida TUS) y generar la impresión en el servidor; quitar la descarga pública del PDF.
6. Panel de administración y plantillas de Brevo.
