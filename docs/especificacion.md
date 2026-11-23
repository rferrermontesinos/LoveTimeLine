# Especificación del portal (v0.2, 3 de noviembre de 2026)

## Objetivo de esta fase

Un prototipo que los 4 socios usen de principio a fin: cada uno crea un mazo de prueba (packs Pareja o Familia) en menos de 20 minutos desde el móvil, lo «paga» en modo test, y Ricard obtiene 4 archivos listos para hacer las pruebas de impresión.

Lo lleva Ricard. Marc valida el diseño. La implantación completa y la comercialización vienen después, con la muestra validada.

**Alcance futuro:** mundial, empezando por España. El prototipo solo activa España, español y euros, pero idiomas, monedas, formatos de fecha y zonas de envío quedan preparados desde el principio.

## Etapas del prototipo

| Etapa | Qué sale | Herramientas | Quién valida |
| --- | --- | --- | --- |
| 1. Dirección visual | Moodboard, paleta, tipografías, tono e ideas de estilo de carta Pareja y Familia | `/design-superpowers:creative` | Marc |
| 2. Mockups de cartas | Anverso y reverso de cada estilo, con fecha por año, mes y día, con y sin descripción, foto vertical y horizontal | `/design-superpowers:design`, Figma o Canva o el artifact Design | Marc |
| 3. Mockups del portal | Portada, elegir pack y estilo, subida masiva, editor de carta, revisión del mazo y pago, en móvil y escritorio | `/design-superpowers:design`, `design:ux-copy` | Marc |
| 4. Revisión | Accesibilidad, coherencia y textos | `/design-superpowers:design-review`, `design:accessibility-review` | Ricard |
| 5. Implementación | Solo lo validado, en las fases técnicas de abajo | Claude Code | Ricard |
| 6. Pruebas | 4 mazos de prueba de los socios impresos y revisados | Skill `revision-impresion-cartas` | Los 4 socios |

**Dirección de diseño:** agradable, familiar y romántica, pensada para parejas y familias, moderna y atractiva; nada cursi ni infantil.

## Flujo del cliente

1. **Portada:** qué es, ejemplo de mazo, cómo se juega y el botón «Crear mi mazo».
2. **Registro:** con enlace mágico por email. El borrador se guarda solo.
3. **Elegir pack y estilo:** Pareja o Familia. El estilo se puede cambiar en cualquier momento.
4. **Subida masiva** (ver la sección siguiente).
5. **Completar cartas:**
   - la fecha viene propuesta y el usuario confirma o corrige;
   - precisión: año, mes o día;
   - descripción opcional.
6. **Retocar:** encuadre y recorte con proporción fija, rotación, emojis y pegatinas, y vista previa con el estilo (anverso con foto, reverso con fecha).
7. **Revisar:**
   - línea temporal ordenada;
   - avisos de baja resolución, fechas duplicadas, fotos duplicadas y fechas de confianza baja;
   - contador frente al pack elegido.
8. **Pagar:** Stripe Checkout en modo test durante el prototipo, con dirección de envío.
9. **Seguimiento:** emails de pedido confirmado, en producción y enviado, y página de estado del pedido.

## Subida masiva y fechas automáticas

**Entradas:**
- seleccionar una carpeta entera;
- arrastrar varios archivos;
- en el móvil, selección múltiple de la galería.

**Formatos:** JPG, PNG, HEIC y WEBP.

**Experiencia:**
- Cuadrícula de miniaturas al instante, generadas en el navegador.
- Subidas en paralelo y reanudables, con progreso global.
- Se puede editar mientras se sube.

**Orden de prioridad para proponer la fecha:**

| Prioridad | Fuente | Ejemplos | Precisión | Confianza |
| --- | --- | --- | --- | --- |
| 1 | EXIF / XMP | `DateTimeOriginal`, `CreateDate` | Día | Alta |
| 2 | Nombre del archivo con fecha completa | `IMG_20190814_123045.jpg`, `PXL_20190814_…`, `IMG-20190814-WA0001.jpg`, `2019-08-14 playa.jpg`, `Screenshot_2019-08-14-…` | Día | Media |
| 3 | Nombre del archivo con año o mes | `verano 2015.jpg`, `2015-08 Menorca.jpg` | Año o mes | Media |
| 4 | Fecha de modificación del archivo | — | Día | Baja: marcar «revisar» |

**Herramientas de edición:**
- Ordenar por fecha.
- Seleccionar varias fotos y ponerles la misma fecha.
- «Siguiente foto sin fecha».
- Deshacer.

**Duplicados:** las fotos repetidas se detectan por hash del archivo y el portal avisa.

**Privacidad:** la extracción de fechas se hace en el navegador y no envía las fotos a ningún servicio externo.

**Lógica:** la extracción a partir del nombre es una función pura en `src/domain/fechas/` con una batería amplia de tests de patrones.

## Panel de administración (Ricard, en el prototipo)

- Cola de pedidos por estado: pagado → archivos generados → revisado → en imprenta → enviado.
- Vista previa de todas las cartas de un pedido y botón «Regenerar archivos».
- Descarga del PDF de impresión: anverso y reverso, con sangrado y marcas de corte según `config/print.ts`.
- Gestión de packs y precios.

## Modelo de datos (borrador)

| Tabla | Campos clave |
| --- | --- |
| `profiles` | id, email, nombre, idioma, pais, consentimiento_fotos_at |
| `decks` | id, owner_id, style_id, titulo, estado (borrador/pagado), pack_id |
| `cards` | id, deck_id, orden, foto_original_path, foto_preview_path, hash, recorte (json), adornos (json), fecha, precision (año/mes/día), fecha_fuente (exif/nombre/archivo/manual), fecha_confianza, descripcion, ppp_estimado |
| `packs` | id, nombre (Pareja/Familia), cartas, precio_cents, moneda, activo |
| `orders` | id, deck_id, stripe_session_id, importe_cents, moneda, pais_envio, envio (json), estado, tracking, archivos_path, borrar_despues_de |
| `styles` | id, nombre, version, activo (las plantillas viven en el repo) |

Todas las tablas con RLS: cada cliente solo ve lo suyo y el rol admin lo ve todo.

## Generación de impresión

- La genera un trabajo en el servidor al confirmarse el pago por webhook, de forma idempotente.
- A cada foto original le aplica su recorte y sus adornos, y la renderiza a 300 ppp con el estilo y la fecha en el reverso.
- Salida: un PDF por pedido, con una página por carta y cara, sangrado y marcas de corte. El formato exacto (RGB o CMYK, tamaño de pliego) se fija con las pruebas de impresión.
- Un test de regresión visual compara el PDF de muestra con una referencia validada por Marc.

## Fuera del prototipo

- Más packs y ampliaciones.
- Códigos de descuento de influencers.
- Otros idiomas y países.
- Importar desde Google Fotos o iCloud.
- Cartas de contexto (hitos conocidos por año).
- Versión digital del juego.
- Regalo con tarjeta: quien regala paga y quien recibe crea el mazo.

## Preguntas abiertas

- [ ] Nombre comercial y dominio.
- [ ] Tamaño de carta, papel y acabado, tras las pruebas de impresión.
- [ ] Formato de archivo que pide la imprenta.
- [ ] Número de cartas de los packs Pareja y Familia, y sus precios.
- [ ] Reglas finales y mecánicas propias.
