import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { PRINT } from "../../config/print";
import { leerZip } from "../../src/lib/pdf/zip";
import catalogo from "../../supabase/catalogo.json";
import { borrarSoloElMazo, cambiarMazo, conFecha, conMesSugerido, fotos, fotosGuardadas, guardado, leerMazo, literal, ponerAnioALasSinFecha, sinFechaAlSubir } from "./mazo-utiles";

/** Cartas físicas que añaden las mecánicas que el catálogo pone por defecto (comodines, en blanco…). */
const CARTAS_DE_MECANICAS = catalogo.mecanicas
  .filter((m) => m.activo && m.porDefecto && m.tipo === "cartas")
  .reduce((s, m) => s + (m.cartasFisicas ?? 0), 0);
/** La portada es una carta más del mazo (tiene su anverso y su reverso). */
const PORTADA = 1;
/** La caja personalizada va en el archivo de impresión como una pieza más (la de siempre, no). */
const CAJA_PERSONALIZADA = 1;

const pequeno = catalogo.packs.find((p) => p.id === "pequeno")!;

/** Empieza un mazo con el pack pequeño, como desde la portada, y da el permiso de las fotos. */
async function empezar(page: Page) {
  await page.goto("/es/crear?pack=pequeno");
  await expect(page.getByRole("heading", { name: "Sube tus fotos" })).toBeVisible();
  await page.getByRole("checkbox", { name: /Tengo permiso/ }).check();
}

async function subir(page: Page, archivos: string[]) {
  await page.getByTestId("entrada-fotos").setInputFiles(archivos);
  await expect(page.getByText(`${archivos.length} fotos añadidas`)).toBeVisible({ timeout: 120_000 });
}

/** Va a un paso con la barra de pasos de arriba. */
async function irA(page: Page, paso: "Fotos" | "Cartas" | "Estilo" | "Pedido") {
  await page.getByRole("navigation", { name: "Pasos" }).getByRole("button", { name: new RegExp(paso) }).click();
}

test.describe("mazo de principio a fin", () => {
  test("de las fotos al PDF: fechas solas, fecha a varias, recuerdo con hueco, paleta, caja propia, oferta, pago y descarga", async ({ page }, info) => {
    test.skip(info.project.name === "movil", "El flujo completo se prueba en escritorio; el móvil tiene el suyo.");
    test.setTimeout(480_000);

    await empezar(page);
    // El pack de la URL se usa una vez y sale de ella.
    await expect(page).toHaveURL(/\/es\/crear$/);
    await expect(page.getByRole("button", { name: /^Pack Pequeño/ })).toBeVisible();
    // Sin presión: una foto imperfecta vale, y la guía para elegirlas se abre aparte (no corta la subida).
    const sinPresion = page.getByTestId("sin-presion");
    await expect(sinPresion).toContainText("No hace falta que sean perfectas");
    const guia = sinPresion.getByRole("link", { name: "Ideas para elegirlas (se abre en otra pestaña)" });
    await expect(guia).toHaveAttribute("href", "/es/guia-fotos");
    await expect(guia).toHaveAttribute("target", "_blank");

    // Salen ya con fecha las que la traen clara: de la cámara o escrita en el nombre. Las de WhatsApp
    // y las capturas se quedan en blanco con su mes como sugerencia (la foto puede ser de antes), y
    // las que no traen más que la del archivo, con esa. Van al final de la cuadrícula.
    const archivos = fotos();
    const sinFecha = archivos.filter(sinFechaAlSubir).length;
    const conMes = archivos.filter(conMesSugerido);
    expect(conMes.length).toBeGreaterThan(1);
    await subir(page, archivos);
    await expect(page.getByTestId("resumen-subida")).toContainText(`${sinFecha} sin fecha`);
    await expect(page.getByText(`${sinFecha} tienen una fecha sugerida: si es la buena, en Cartas la pones con un toque.`)).toBeVisible();
    await expect(page.getByTestId("fotos-sin-fecha").getByRole("button")).toHaveCount(sinFecha);
    const enFotos = page.getByRole("region", { name: /^Tus cartas/ });
    await expect(enFotos.getByRole("button", { name: /\. Fecha aproximada: / })).toHaveCount(0);

    // Cartas: cuántas faltan, en grande, y el mazo como se jugará, con las que no tienen fecha al final.
    await page.getByRole("button", { name: "Siguiente: cartas" }).click();
    await expect(page.getByRole("heading", { name: "Completa las cartas" })).toBeVisible();
    const pendientes = page.getByTestId("mazo-pendientes");
    await expect(pendientes).toContainText(`Te faltan ${sinFecha} cartas por completar`);
    await expect(pendientes).toContainText(`${archivos.length - sinFecha} de ${archivos.length} cartas listas · ${sinFecha} tienen una fecha sugerida: si es la buena, basta un toque`);
    const mazo = page.getByTestId("linea-del-mazo");
    const actual = mazo.locator('[aria-current="true"]');
    await expect(mazo.getByRole("heading", { name: `Sin fecha · ${sinFecha}` })).toBeVisible();
    await expect(mazo.getByRole("button", { name: /, por completar$/ })).toHaveCount(sinFecha);
    await expect(mazo.getByRole("button", { name: /, lista$/ })).toHaveCount(archivos.length - sinFecha);

    // Una de WhatsApp: la carta dice de dónde sale su mes, y con un toque queda lista y se pasa sola
    // a la siguiente sin completar, con el foco en su sugerencia.
    const whatsapp = path.basename(conMes.find((a) => /-WA\d+\.jpg$/.test(a))!);
    await mazo.getByRole("button", { name: `${whatsapp}, sin fecha, por completar` }).click();
    await expect(page.getByText(/Es el mes en que llegó por WhatsApp/)).toBeVisible();
    await page.getByRole("button", { name: "Usar esta fecha" }).click();
    await expect(mazo.getByRole("button", { name: new RegExp(`^${literal(whatsapp)}, .+ de \\d{4}, lista$`) })).toBeVisible();
    await expect(actual).toHaveAccessibleName(/, sin fecha, por completar$/);
    await expect(page.locator(":focus")).toHaveText("Usar esta fecha");
    const faltan = sinFecha - 1;
    await expect(page.getByRole("status").filter({ hasText: "Hecho:" })).toHaveText(new RegExp(`Hecho: la anterior ya tiene fecha \\(.+ de \\d{4}\\)\\. Te quedan ${faltan} cartas\\.`));
    await expect(pendientes).toContainText(`Te faltan ${faltan} cartas por completar`);

    // Estilo y Pedido se abren aunque falten cartas; lo que espera a que estén todas es el pago.
    await page.getByRole("button", { name: "Siguiente: estilo" }).click();
    await expect(page.getByRole("heading", { name: "Elige el estilo" })).toBeVisible();
    await expect(page.getByText(`Faltan ${faltan} cartas por completar`)).toBeVisible();
    await page.getByRole("button", { name: "Siguiente: pedido" }).click();
    await expect(page.getByRole("heading", { name: "Revisa y haz el pedido" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Pagar .* \(prueba\)/ })).toBeDisabled();
    await expect(page.getByText(`Para pagar, completa antes las ${faltan} cartas que faltan.`)).toBeVisible();

    // En Fotos, el mismo año a todas las que no tienen fecha.
    await irA(page, "Fotos");
    expect(await ponerAnioALasSinFecha(page, 2016)).toBe(faltan);

    // Cartas: todo listo. Un recuerdo sin foto desde las ideas de abajo, con un hueco por rellenar.
    await page.getByRole("button", { name: "Siguiente: cartas" }).click();
    await expect(page.getByTestId("mazo-listo")).toContainText("¡Tu mazo está listo!");
    await page.getByTestId("ideas-recuerdo").getByRole("button", { name: "Nació [nombre]" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Añadir la carta" }).click();
    await expect(dialogo).toBeHidden();

    // Se abre la carta nueva, que va al final: está por completar, y el aviso anima.
    await expect(actual).toHaveAccessibleName("Nació [nombre], sin fecha, por completar");
    await expect(pendientes).toContainText("¡Ya casi! Te falta 1 carta");
    // «Siguiente» con la carta a medias: la primera vez lleva a la fecha y lo pide; la segunda, pasa.
    await page.getByRole("button", { name: "Siguiente →", exact: true }).click();
    await expect(page.getByText(/falta la fecha.*pulsa otra vez «Siguiente» para dejarla para luego/)).toBeVisible();
    await expect(actual).toHaveAccessibleName(/^Nació \[nombre\]/);
    expect(await page.evaluate(() => !!document.activeElement?.closest("fieldset"))).toBe(true);
    await page.getByRole("button", { name: "Siguiente →", exact: true }).click();
    await expect(actual).not.toHaveAccessibleName(/^Nació \[nombre\]/);
    await mazo.getByRole("button", { name: /^Nació \[nombre\]/ }).click();
    await expect(page.getByText(/pulsa otra vez/)).toBeHidden();
    await page.getByRole("button", { name: "Completar [nombre]" }).click();
    await page.keyboard.type("Leo");
    await page.getByRole("radio", { name: "Solo el año" }).first().click();
    await page.getByLabel("Año").first().fill("2020");
    await expect(page.getByText("Carta lista")).toBeVisible();
    await expect(mazo.getByRole("button", { name: /, por completar$/ })).toHaveCount(0);
    await expect(mazo.getByRole("button", { name: "Nació Leo, 2020, lista" })).toBeVisible();
    await expect(page.getByTestId("mazo-listo")).toContainText(`Las ${archivos.length + 1} cartas tienen su fecha y están correctas.`);

    // Estilo: paleta, título y caja personalizada con una foto propia.
    await page.getByTestId("mazo-listo").getByRole("button", { name: /Siguiente: estilo/ }).click();
    await expect(page.getByRole("heading", { name: "Elige el estilo" })).toBeVisible();
    await page.getByRole("radiogroup", { name: "Colores" }).locator("label").filter({ hasText: "Cobalto" }).click();
    await expect(page.getByRole("radio", { name: "Cobalto" })).toBeChecked();
    await page.getByRole("textbox", { name: "Título del mazo" }).fill("Prueba de impresión");
    const caja = page.getByTestId("bloque-caja");
    await caja.getByRole("switch", { name: /Caja personalizada/ }).click();
    await caja.getByTestId("entrada-foto-caja").setInputFiles(archivos[0]!);
    await expect(caja.getByRole("radio", { name: "Tu foto" })).toBeChecked({ timeout: 30_000 });

    // Pedido: con un pack mayor faltan cartas y la oferta propone volver al que ya se cubre.
    await page.getByRole("button", { name: "Siguiente: pedido" }).click();
    await expect(page.getByRole("heading", { name: "Revisa y haz el pedido" })).toBeVisible();
    await page.getByRole("radiogroup", { name: "Packs" }).locator("label").filter({ hasText: "Mediano" }).click();
    const ofertas = page.getByTestId("ofertas-pedido");
    await expect(ofertas).toContainText("Con el pack Pequeño ya podrías pagar");
    await ofertas.getByRole("button", { name: "Cambiar al pack Pequeño" }).click();
    await expect(page.getByRole("radio", { name: "Pequeño" })).toBeChecked();

    // Cartas físicas: los recuerdos (fotos y el de texto), la portada y las de las mecánicas.
    const recuerdos = archivos.length + 1;
    expect(recuerdos).toBeGreaterThanOrEqual(pequeno.cartas);
    const cartasFisicas = recuerdos + PORTADA + CARTAS_DE_MECANICAS;
    await expect(page.getByText(`Se imprimen ${cartasFisicas} cartas`)).toBeVisible();

    await page.getByRole("checkbox", { name: /He revisado/ }).check();
    await page.getByRole("button", { name: /Pagar .* \(prueba\)/ }).click();
    await expect(page).toHaveURL(/\/es\/pedido\/confirmado$/);
    await expect(page.getByRole("heading", { name: "Pedido de prueba hecho" })).toBeVisible();
    await expect(page.getByText(`${cartasFisicas} cartas impresas`)).toBeVisible();

    // Descarga (el interruptor está activo en el prototipo): un archivo por imprenta, cada pieza a
    // dos caras, con el sangrado, las marcas y el reparto de páginas que pide cada una.
    const piezas = cartasFisicas + CAJA_PERSONALIZADA;
    const base = `prueba-de-impresion-${cartasFisicas}-cartas`;
    const enMm = (pt: number) => Math.round(pt / (72 / 25.4));
    const medidas = (caja: { width: number; height: number }) => [enMm(caja.width), enMm(caja.height)];
    const { anchoMm: ancho, altoMm: alto } = PRINT.carta;
    const descargar = async (imprenta: string, tipo: "PDF" | "ZIP") => {
      const descarga = page.waitForEvent("download", { timeout: 240_000 });
      await page.getByRole("button", { name: `Descargar ${tipo} para ${imprenta}` }).click();
      const d = await descarga;
      return { nombre: d.suggestedFilename(), bytes: new Uint8Array(await readFile((await d.path())!)) };
    };

    // Pinbro: un PDF con cada carta seguida de su reverso, 3 mm de sangrado y sin marcas (la página es la cara).
    const pinbro = await descargar("Pinbro", "PDF");
    expect(pinbro.nombre).toBe(`${base}-${ancho}x${alto}-pinbro.pdf`);
    const pdfPinbro = await PDFDocument.load(pinbro.bytes);
    expect(pdfPinbro.getPageCount()).toBe(2 * piezas);
    expect(medidas(pdfPinbro.getPage(0).getTrimBox())).toEqual([ancho, alto]);
    expect(medidas(pdfPinbro.getPage(0).getMediaBox())).toEqual([ancho + 6, alto + 6]);
    expect(pinbro.bytes.length / (2 * piezas)).toBeLessThan(3_000_000);

    // Soriano: 2 mm de sangrado y las marcas de corte en un margen alrededor.
    const pdfSoriano = await PDFDocument.load((await descargar("Soriano", "PDF")).bytes);
    expect(pdfSoriano.getPageCount()).toBe(2 * piezas);
    const soriano = pdfSoriano.getPage(0);
    expect(medidas(soriano.getTrimBox())).toEqual([ancho, alto]);
    expect(medidas(soriano.getBleedBox())).toEqual([ancho + 4, alto + 4]);
    expect(medidas(soriano.getMediaBox())).toEqual([ancho + 4 + 2 * PRINT.marcasCorte.margenMm, alto + 4 + 2 * PRINT.marcasCorte.margenMm]);
    // Sin ninguna fuente: el rótulo de cada página va como imagen (una sin incrustar no pasa las comprobaciones de la imprenta).
    const fuentes = pdfSoriano.context.enumerateIndirectObjects().filter(([, o]) => o instanceof PDFDict && o.get(PDFName.of("Type")) === PDFName.of("Font"));
    expect(fuentes).toHaveLength(0);

    // AGR (Tipia): un ZIP con el PDF de las caras, el de los reversos en el mismo orden y una nota; 4 mm de sangrado.
    const agr = await descargar("AGR · Tipia", "ZIP");
    expect(agr.nombre).toBe(`${base}-${ancho}x${alto}-agr.zip`);
    const partes = leerZip(agr.bytes);
    expect(partes.map((p) => p.nombre)).toEqual([`${base}-caras.pdf`, `${base}-reversos.pdf`, "LEEME.txt"]);
    for (const parte of partes.slice(0, 2)) {
      const pdf = await PDFDocument.load(parte.bytes);
      expect(pdf.getPageCount()).toBe(piezas);
      expect(medidas(pdf.getPage(0).getMediaBox())).toEqual([ancho + 8, alto + 8]);
      expect(medidas(pdf.getPage(0).getTrimBox())).toEqual([ancho, alto]);
    }
    const nota = new TextDecoder().decode(partes[2]!.bytes);
    expect(nota).toContain(`la página 1 es el reverso de la página 1 de ${base}-caras.pdf`);
    expect(nota).toContain("La última página de cada archivo es la caja.");
  });
});

test.describe("fechas de copias y escaneos", () => {
  // scripts/fixtures.ts: 5 fotos de fotos hechas con el móvil el mismo día (el del nombre,
  // IMG_AAAAMMDD_…), dos escaneadas con su fecha (el año en el nombre, 1958, y la original anotada
  // en sus datos, 1987) y dos sin ninguna pista. «Hoy» se fija respecto a ese día, para que la
  // prueba no dependa de cuándo se generaron las fotos.
  const casos = [
    { dias: 1, cuando: "del día anterior: seguramente son de preparar el mazo", motivo: /Es de estos últimos días/ },
    { dias: 20, cuando: "muchas del mismo día de hace unas semanas: fotos de fotos", motivo: /Muchas fotos de la misma subida tienen este mismo día reciente/ },
  ];
  for (const caso of casos) {
    test(`las fotos ${caso.cuando}, sin fecha y con el porqué; las escaneadas con su fecha, fechadas`, async ({ page }, info) => {
      test.skip(info.project.name === "movil", "La lógica es la misma; basta con probarla en escritorio.");
      test.setTimeout(120_000);
      const carpeta = path.join(process.cwd(), "tests", "fixtures", "generadas", "escaner");
      const archivos = readdirSync(carpeta).map((n) => path.join(carpeta, n));
      const recientes = archivos.filter((a) => /^IMG_\d{8}_\d{6}\.jpg$/.test(path.basename(a)));
      expect(recientes).toHaveLength(5);
      const [, anio, mes, dia] = /^IMG_(\d{4})(\d{2})(\d{2})_/.exec(path.basename(recientes[0]!))!;
      await page.clock.setSystemTime(new Date(Number(anio), Number(mes) - 1, Number(dia) + caso.dias, 12));

      await empezar(page);
      await subir(page, archivos);
      await expect(page.getByTestId("resumen-subida")).toContainText(`${archivos.length - 2} sin fecha`);
      await expect(guardado(page)).toContainText("Guardado");
      const cartas = ((await leerMazo(page))?.cartas ?? []) as { nombreArchivo?: string; fecha: unknown }[];
      expect(cartas.filter((c) => /^IMG_\d{8}_/.test(c.nombreArchivo ?? "") && !c.fecha)).toHaveLength(recientes.length);
      expect(cartas.filter((c) => c.fecha).map((c) => c.nombreArchivo).sort()).toEqual(["abuelos 1958.jpg", "boda tios.jpg"]);

      // En Cartas, la carta dice por qué está en blanco y deja usar la fecha que trae con un toque:
      // queda lista y se pasa sola a la siguiente sin completar.
      const nombre = path.basename(recientes[0]!);
      await page.getByRole("button", { name: `Editar ${nombre}. Sin fecha` }).click();
      await expect(page.getByRole("heading", { name: "Completa las cartas" })).toBeVisible();
      await expect(page.getByText(caso.motivo)).toBeVisible();
      await page.getByRole("button", { name: "Usar esta fecha" }).click();
      const mazo = page.getByTestId("linea-del-mazo");
      await expect(mazo.getByRole("button", { name: new RegExp(`^${literal(nombre)}, .+, lista$`) })).toBeVisible();
      await expect(mazo.locator('[aria-current="true"]')).toHaveAccessibleName(/, sin fecha, por completar$/);
    });
  }
});

test.describe("caja personalizada", () => {
  test("sin ninguna foto para ella no deja pagar y el aviso lleva a elegirla", async ({ page }, info) => {
    test.skip(info.project.name === "movil", "La lógica es la misma; basta con probarla en escritorio.");
    // Un mazo solo con un recuerdo sin foto: la caja no tiene de dónde sacar la suya. Sin fotos,
    // Cartas ofrece escribir uno.
    await empezar(page);
    await irA(page, "Cartas");
    await page.getByRole("button", { name: /Añadir un recuerdo sin foto/ }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "El día que nos conocimos" }).click();
    await dialogo.getByRole("button", { name: "Añadir la carta" }).click();
    await expect(dialogo).toBeHidden();
    await page.getByRole("radio", { name: "Solo el año" }).first().click();
    await page.getByLabel("Año").first().fill("2012");
    await expect(page.getByText("Carta lista")).toBeVisible();

    await page.getByRole("button", { name: "Siguiente: estilo" }).click();
    await page.getByTestId("bloque-caja").getByRole("switch", { name: /Caja personalizada/ }).click();
    await page.getByRole("button", { name: "Siguiente: pedido" }).click();
    await expect(page.getByRole("heading", { name: "Revisa y haz el pedido" })).toBeVisible();
    const aviso = page.getByRole("listitem").filter({ hasText: "La caja personalizada aún no tiene foto" });
    await expect(aviso).toBeVisible();
    await aviso.getByRole("button", { name: "Elegir foto" }).click();
    await expect(page.getByRole("heading", { name: "Elige el estilo" })).toBeVisible();
  });
});

test.describe("guardado en el dispositivo", () => {
  test("al volver sigue donde lo dejaste, con la carta abierta, y se puede empezar otro", async ({ page }) => {
    await empezar(page);
    const archivos = fotos().filter(conFecha).slice(0, 4);
    await subir(page, archivos);
    await page.getByRole("button", { name: "Siguiente: cartas" }).click();
    const mazo = page.getByTestId("linea-del-mazo");
    await mazo.getByRole("button").nth(2).click();
    await expect(mazo.getByRole("button").nth(2)).toHaveAttribute("aria-current", "true");
    await expect(guardado(page)).toHaveText(/Guardado en este dispositivo · ahora mismo/);

    await page.reload();
    await expect(page.getByTestId("aviso-reanudar")).toHaveText("Seguimos donde lo dejaste");
    await expect(page.getByText(`«Nuestros recuerdos» · ${archivos.length} cartas · guardado ahora mismo`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Completa las cartas" })).toBeVisible();
    await expect(mazo.getByRole("button").nth(2)).toHaveAttribute("aria-current", "true");

    // «Empezar otro mazo» pregunta antes de borrar.
    page.once("dialog", (d) => {
      expect(d.message()).toContain("¿Borrar el mazo actual y empezar otro?");
      void d.accept();
    });
    await page.getByRole("button", { name: "Empezar otro mazo" }).first().click();
    await expect(page.getByRole("heading", { name: "Sube tus fotos" })).toBeVisible();
    await expect(page.getByTestId("aviso-reanudar")).toBeHidden();
    await expect(page.getByRole("region", { name: /^Tus cartas/ })).toBeHidden();
  });

  test("dos pestañas con el mismo mazo no se pisan", async ({ page, context }) => {
    await empezar(page);
    await subir(page, fotos().filter(conFecha).slice(0, 3));
    await expect(guardado(page)).toHaveText(/Guardado/);

    // La otra pestaña abre el mismo mazo, va a Cartas y ve lo que se añade en la primera (los
    // recuerdos sin foto se añaden desde las ideas de Cartas).
    const otra = await context.newPage();
    await otra.goto("/es/crear");
    await expect(otra.getByText(`3 de ${pequeno.cartas} cartas`)).toBeVisible();
    await irA(otra, "Cartas");
    await expect(otra.getByRole("heading", { name: "Completa las cartas" })).toBeVisible();
    await expect(guardado(otra)).toHaveText(/Guardado/);
    await page.getByRole("button", { name: "Siguiente: cartas" }).click();
    await page.getByTestId("ideas-recuerdo").getByRole("button", { name: "Nuestra boda" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Añadir la carta" }).click();
    await expect(otra.getByText(`4 de ${pequeno.cartas} cartas`)).toBeVisible();

    // Si el mazo cambia a sus espaldas (otra pestaña sin aviso) y aquí también, no lo pisa: avisa.
    await cambiarMazo(otra, (m) => ({ ...m, cartas: m.cartas.slice(0, 2), actualizadoEn: m.actualizadoEn + 1 }));
    await otra.getByTestId("ideas-recuerdo").getByRole("button", { name: "El día que nos conocimos" }).click();
    await otra.getByRole("dialog").getByRole("button", { name: "Añadir la carta" }).click();
    await expect(otra.getByText(/Has cambiado este mazo en otra pestaña/)).toBeVisible();
    await expect(guardado(otra)).toHaveText("Sin guardar: el mazo ha cambiado en otra pestaña");
    expect((await leerMazo(otra))?.cartas).toHaveLength(2);

    await otra.getByRole("button", { name: "Cargar la versión más reciente" }).click();
    await expect(otra.getByText(`2 de ${pequeno.cartas} cartas`)).toBeVisible();
    await expect(guardado(otra)).toHaveText(/Guardado/);
    await otra.close();
  });

  test("una importación cortada de golpe conserva las cartas leídas y no deja fotos sueltas", async ({ page, context }) => {
    test.setTimeout(180_000);
    await empezar(page);
    await expect(guardado(page)).toHaveText(/Guardado/);
    const archivos = fotos();
    await page.getByTestId("entrada-fotos").setInputFiles(archivos);

    // Se corta a mitad (el navegador se cierra de golpe: sin «pagehide» ni nada que guarde al salir),
    // medio segundo después de ver unas cuantas cartas. Antes, el mazo se guardaba cada 2 s como
    // mucho durante la importación; ahora, en cuanto entra cada carta.
    const cuadricula = page.getByRole("region", { name: /^Tus cartas/ }).getByRole("listitem");
    await expect.poll(() => cuadricula.count(), { timeout: 60_000, intervals: [50] }).toBeGreaterThanOrEqual(6);
    const vistas = await cuadricula.count();
    expect(vistas).toBeLessThan(archivos.length);
    await page.waitForTimeout(500);
    const roto = page.waitForEvent("crash");
    // La respuesta no llega nunca: la página ya no existe.
    void (await context.newCDPSession(page)).send("Page.crash").catch(() => undefined);
    await roto;
    await page.close();

    // Al volver, las cartas que ya se veían siguen ahí…
    const otra = await context.newPage();
    await otra.goto("/es/crear");
    await expect(otra.getByTestId("aviso-reanudar")).toBeVisible();
    const mazo = await leerMazo(otra);
    const cartas = (mazo?.cartas ?? []) as { id: string; tipo: string }[];
    expect(cartas.length).toBeGreaterThanOrEqual(vistas);
    // …y todas tienen su foto, y no queda ninguna foto sin carta (se borran al poco de abrir).
    const ids = cartas.filter((c) => c.tipo === "foto").map((c) => c.id).sort();
    await expect.poll(() => fotosGuardadas(otra)).toEqual(ids);
  });

  test("las fotos de una importación cortada antes de guardar el mazo no se quedan en el dispositivo", async ({ page }) => {
    await empezar(page);
    await subir(page, fotos().filter(conFecha).slice(0, 3));
    await expect.poll(() => fotosGuardadas(page).then((f) => f.length)).toBe(3);

    // Sin mazo guardado (se cortó antes de guardarlo por primera vez), con las fotos ya escritas.
    await page.goto("/es/privacidad");
    await borrarSoloElMazo(page);
    expect(await fotosGuardadas(page)).toHaveLength(3);

    // Al volver se empieza un mazo nuevo y esas fotos, que no son de nadie, se borran.
    await page.goto("/es/crear");
    await expect(page.getByRole("heading", { name: "Sube tus fotos" })).toBeVisible();
    await expect(page.getByTestId("aviso-reanudar")).toBeHidden();
    await expect.poll(() => fotosGuardadas(page)).toEqual([]);
  });

  test("al volver de Stripe sin pagar, el pedido pendiente se quita y se avisa", async ({ page }) => {
    await empezar(page);
    await subir(page, fotos().filter(conFecha).slice(0, 2));
    await expect(guardado(page)).toHaveText(/Guardado/);
    await cambiarMazo(page, (m) => ({
      ...m,
      pedido: { id: "pedido-prueba", modo: "stripe", estado: "pendiente", totalCents: 4900, moneda: "EUR", cartasFisicas: 47, fecha: 0 },
    }));

    await page.goto("/es/crear?pago=cancelado");
    await expect(page.getByText("Has cancelado el pago. Tu mazo sigue aquí, tal cual.")).toBeVisible();
    await expect(page).toHaveURL(/\/es\/crear$/);
    await expect.poll(async () => (await leerMazo(page))?.pedido ?? null).toBeNull();

    // Al recargar ya no se avisa.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Sube tus fotos" })).toBeVisible();
    await expect(page.getByText("Has cancelado el pago.")).toBeHidden();
  });
});

test.describe("pack del enlace", () => {
  test("con «Atrás» no se vuelve a aplicar el ?pack= del enlace", async ({ page }) => {
    // Un mazo guardado con el pack pequeño que se abre desde la portada con el pack mediano.
    await empezar(page);
    await expect(guardado(page)).toHaveText(/Guardado/);
    await page.goto("/es/crear?pack=mediano");
    await expect(page).toHaveURL(/\/es\/crear$/);
    const barra = page.getByRole("button", { name: /^Pack Mediano/ });
    await expect(barra).toBeVisible();
    await expect(page.getByText(/Hemos pasado tu mazo al pack Mediano/)).toBeVisible();

    // Se cambia a Pequeño en el selector, se va a otra página del portal y se vuelve con «Atrás».
    await barra.click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("radiogroup", { name: "Packs" }).locator("label").filter({ hasText: "Pequeño" }).click();
    await expect(dialogo.getByRole("radio", { name: "Pequeño" })).toBeChecked();
    await dialogo.getByRole("button", { name: "Listo" }).click();
    await expect(page.getByRole("button", { name: /^Pack Pequeño/ })).toBeVisible();
    await expect.poll(async () => (await leerMazo(page))?.packId).toBe("pequeno");
    await page.getByRole("link", { name: /, Inicio$/ }).click();
    await expect(page).toHaveURL(/\/es$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/es\/crear$/);

    // Sigue el que se eligió a mano, sin aviso de cambio de pack.
    await expect(page.getByRole("heading", { name: "Sube tus fotos" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pack Pequeño/ })).toBeVisible();
    await expect(page.getByText(/Hemos pasado tu mazo al pack/)).toBeHidden();
    expect((await leerMazo(page))?.packId).toBe("pequeno");
  });
});

test.describe("móvil", () => {
  test("de Fotos a Pedido sin que nada se salga a lo ancho", async ({ page }, info) => {
    test.skip(info.project.name !== "movil", "Solo en el móvil.");
    const desborda = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    await empezar(page);
    await subir(page, fotos().filter(conFecha).slice(0, 6));
    expect(await desborda()).toBe(false);
    // Con cartas, se empiezan a ver en la primera pantalla, sin bajar: por encima de la barra de abajo.
    await page.evaluate(() => window.scrollTo(0, 0));
    const primera = await page.getByRole("region", { name: /^Tus cartas/ }).getByRole("listitem").first().boundingBox();
    const visibleHasta = await page.evaluate(() => window.innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--reserva-abajo")) || 0));
    expect(primera!.y + 60).toBeLessThan(visibleHasta);

    const pasos: [string, string][] = [
      ["Siguiente: cartas", "Completa las cartas"],
      ["Siguiente: estilo", "Elige el estilo"],
      ["Siguiente: pedido", "Revisa y haz el pedido"],
    ];
    for (const [boton, titulo] of pasos) {
      await page.getByRole("button", { name: boton }).click();
      await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
      expect(await desborda()).toBe(false);
    }
    // Con menos cartas que el pack no se puede pagar, y se dice por qué.
    await expect(page.getByRole("button", { name: /Pagar .* \(prueba\)/ })).toBeDisabled();
    await expect(page.getByText("Antes de pagar, resuelve lo que está marcado en rojo.")).toBeVisible();
  });
});
