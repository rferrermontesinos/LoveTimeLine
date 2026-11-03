# Portal del juego de cartas personalizado

- **Repositorio:** `rferrermontesinos/LoveTimeLine`. Es un nombre interno: el nombre comercial del juego está por decidir.
- **Mientras tanto:** el nombre vive en una sola variable, `config/brand.ts` (`BRAND_NAME = "Nombre provisional"`), y nunca se escribe a mano en componentes, textos ni correos.
- **Marca ajena:** no uses «Timeline» en la interfaz, los textos ni el material de marketing; es una marca registrada de otro juego.
- **Repositorio público:** cualquiera puede ver el código y los documentos. Nunca subas secretos, claves, datos de clientes ni fotos reales.

## Qué es

Una web donde el cliente crea su propio mazo para un juego de fechas: sube fotos, cada una con una fecha (obligatoria) y una descripción (opcional), elige un estilo de carta, retoca la foto (encuadre, recorte, emojis), paga un pack y recibe el mazo impreso en casa.

**Alcance:** mundial, empezando por España. Todo se diseña desde el primer día para varios idiomas, monedas y países de envío, aunque al principio solo se active España en español.

Especificación completa: `docs/especificacion.md`. Léela antes de cambiar cualquier flujo.

## Fase actual: prototipo para los 4 socios

- **Responsable:** Ricard, que trabaja contigo en este repositorio y lleva solo esta primera fase. No repartas tareas entre socios.
- **Validación:** Marc (diseñador) valida todo lo visual antes de implementarlo.
- **Objetivo:** un prototipo funcional con los packs **Pareja** y **Familia**, que los 4 socios puedan usar de principio a fin para crear un mazo de prueba cada uno.
- **Impresión:** con esos 4 mazos de prueba se hacen las pruebas de impresión.
- **Después:** la implantación completa y la comercialización vienen cuando la muestra esté validada.

**Orden de trabajo, sin saltarse pasos:**

1. **Dirección visual:** con la skill `/design-superpowers:creative`.
2. **Mockups:** del portal y de las cartas, con las skills y los conectores de diseño instalados.
3. **Validación de Marc:** sobre esos mockups.
4. **Implementación:** solo de lo que Marc haya validado.

No escribas código de interfaz sin un mockup validado. Si falta un diseño para una pantalla, pídelo; no lo improvises.

## Dirección de diseño

- **Tono:** agradable, familiar y romántico, pensado para parejas y familias, pero moderno y atractivo; nada cursi ni infantil.
- **Herramientas:**
  - `/design-superpowers:creative` para la dirección visual: paleta, tipografía, moodboard y estilos de carta.
  - `/design-superpowers:design` para componer las pantallas.
  - `/design-superpowers:design-review` y `design:accessibility-review` antes de pasar cada diseño a Marc.
  - `design:ux-copy` para los textos de la interfaz.
- **Conectores:** Figma, Canva o el tipo de artifact Design, los que estén conectados en ese momento.
- **Design system:** los tokens de color, tipografía y espaciado salen de la dirección visual validada y viven en un único sitio (`src/styles/tokens`).
- **Estilos de carta:** al menos dos, «Pareja» y «Familia», cada uno como plantilla declarativa (`styles/<id>/style.json` + recursos). El código no conoce estilos concretos.

## Stack

- Next.js (App Router) + TypeScript estricto + Tailwind, con internacionalización `next-intl` desde el principio. Idioma inicial: `es`; el siguiente, `en`.
- Supabase: Postgres, Auth (enlace mágico por email) y Storage, **en región UE**. Subidas reanudables (TUS) para lotes grandes.
- Lectura de fecha:
  - `exifr` para EXIF/XMP;
  - `heic2any` o conversión en el servidor para las fotos HEIC del iPhone.
- Edición de fotos en el navegador:
  - `react-easy-crop` para el recorte;
  - `react-konva` para emojis y textos.
- Generación de archivos de impresión en el servidor: `sharp` + `pdf-lib`.
- Pagos: Stripe Checkout, en modo test durante el prototipo. Los importes se guardan siempre en céntimos y con moneda (EUR al empezar).
- Emails transaccionales: Brevo.
- Despliegue: Vercel, región `fra1`.

Si propones cambiar alguna pieza del stack, explica por qué y espera el visto bueno de Ricard.

## Reglas del dominio

- **Fecha:** obligatoria en cada carta, con precisión elegible (año, mes y año, o fecha completa).
- **Descripción:** opcional, de 90 caracteres como máximo.
- **Cómo se muestran las fechas:** siempre según el idioma del usuario (`Intl.DateTimeFormat`). Por dentro, la fecha se guarda en ISO con su precisión.
- **Packs del prototipo:** Pareja y Familia. Los tamaños y precios viven en la base de datos (`packs`), nunca en el código.
- **Pago y mínimo de cartas:** no se puede pagar si el mazo tiene menos cartas que el pack. Las que sobren se ofrecen como ampliación.
- **Calidad de imagen:** avisa si una foto queda por debajo de 300 ppp al tamaño de impresión y pide confirmación, pero no bloquees.
- **Revisión de fechas:** antes de pagar, avisa de los duplicados exactos y muestra una vista previa de la línea temporal ordenada.
- **Formato de carta:** provisional, 63 × 88 mm, con 3 mm de sangrado y 4 mm de zona segura. Vive en `config/print.ts`, nunca repartido por el código, y está pendiente de las pruebas de impresión.

## Subida de fotos: lo más ágil posible

Es la parte crítica del producto: si subir 60 fotos cuesta, el cliente abandona.

**Formas de subir:**
- Seleccionar una carpeta entera (`webkitdirectory`).
- Arrastrar muchos archivos a la vez.
- En el móvil, selección múltiple de la galería.

**Rendimiento:**
- Subidas en paralelo y reanudables, con barra de progreso global.
- Las fotos se pueden ir editando mientras suben.
- Miniaturas generadas en el navegador para mostrar la cuadrícula al instante.

**Fecha propuesta automáticamente,** en este orden de prioridad:
1. EXIF `DateTimeOriginal`, `CreateDate` y XMP.
2. Patrones del nombre del archivo:
   - `IMG_20190814_…` y `PXL_20190814_…`;
   - `IMG-20190814-WA0001` (WhatsApp);
   - `2019-08-14 …` y `20190814_…`;
   - `Screenshot_2019-08-14…`;
   - y años sueltos en el nombre, como `verano 2015.jpg`, con precisión de año.
3. Fecha de modificación del archivo, solo como último recurso.

**Confianza:** cada fecha propuesta lleva un indicador visible (alta: EXIF; media: nombre; baja: fecha del archivo). Las de confianza baja quedan marcadas como «revisar».

**Edición en lote:** ordenar por fecha, aplicar una fecha a varias fotos seleccionadas y saltar a la siguiente foto sin fecha.

**Otras comprobaciones:**
- Detectar fotos duplicadas por hash y avisar.
- Nada de esto envía las fotos a servicios externos: la lectura de metadatos se hace en el navegador.

## Privacidad (RGPD), no negociable

- Las fotos son datos personales; muchas incluyen a menores.
- Los buckets de Storage son privados y se accede solo con URLs firmadas de corta duración.
- Consentimiento explícito al subir fotos.
- Borrado automático de fotos originales y archivos de impresión 60 días después del envío, con una tarea programada.
- Al ser un proyecto internacional, la base es el RGPD, el más exigente. Cada nuevo país se revisa antes de abrirlo.
- Nada de analítica de terceros sobre las imágenes. No envíes fotos a ningún servicio externo sin aprobación de Ricard.
- No pongas datos ni fotos reales en tests, seeds, logs ni en el repositorio. Las fotos de prueba se generan o salen de bancos con licencia libre.

## Cómo trabajamos

- Ramas por funcionalidad y pull requests pequeños. Nunca hagas push directo a `main`.
- Cada PR incluye tests: Vitest para la lógica y Playwright para la subida, el editor y el pago.
- Antes de dar algo por terminado: `pnpm lint && pnpm typecheck && pnpm test`.
- La lógica del dominio va en `src/domain/`, sin dependencias de React ni de Supabase: precios, validación de mazos, orden temporal y extracción de fechas de metadatos y nombres de archivo.
- Las migraciones de base de datos van en `supabase/migrations/`, siempre con políticas RLS.
- Variables de entorno documentadas en `.env.example`.
- Los diseños validados por Marc se guardan o enlazan en `docs/diseno/`, con la fecha de validación.

## Comandos

```bash
pnpm dev          # servidor local
pnpm test         # tests unitarios
pnpm test:e2e     # Playwright
pnpm print:sample # genera un PDF de impresión de muestra con datos ficticios
```
