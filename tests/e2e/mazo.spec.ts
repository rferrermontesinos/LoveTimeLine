import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { PRINT } from "../../config/print";
import catalogo from "../../supabase/catalogo.json";
import { borrarSoloElMazo, cambiarMazo, conFecha, fotos, fotosGuardadas, guardado, leerMazo, soloSugeridas } from "./mazo-utiles";

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

test.describe("mazo de principio a fin", () => {
  test("de las fotos al PDF: fechas sugeridas, recuerdo con hueco, paleta, caja propia, oferta, pago y descarga", async ({ page }, info) => {
    test.skip(info.project.name === "movil", "El flujo completo se prueba en escritorio; el móvil tiene el suyo.");
    test.setTimeout(300_000);

    await empezar(page);
    // El pack de la URL se usa una vez y sale de ella.
    await expect(page).toHaveURL(/\/es\/crear$/);
    await expect(page.getByRole("button", { name: /^Pack Pequeño/ })).toBeVisible();

    const archivos = fotos();
    const sugeridas = archivos.filter(soloSugeridas).length;
    await subir(page, archivos);
    const resumen = page.getByRole("list", { name: "Fechas de tus cartas" });
    await expect(resumen).toContainText(`${archivos.length - sugeridas} con fecha`);
    await expect(resumen).toContainText(`${sugeridas} con fecha sugerida`);

    // Cartas: con fechas solo sugeridas, Estilo no se abre.
    await page.getByRole("button", { name: "Siguiente: cartas" }).click();
    await expect(page.getByRole("heading", { name: "Completa las cartas" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Siguiente: estilo" })).toBeDisabled();
    await expect(page.getByText(`Faltan ${sugeridas} cartas por completar`)).toBeVisible();

    // De vuelta en Fotos, todas las sugeridas de una vez.
    await page.getByRole("navigation", { name: "Pasos" }).getByRole("button", { name: /Fotos/ }).click();
    await page.getByRole("button", { name: `Usar las ${sugeridas} fechas sugeridas` }).click();
    await expect(page.getByText(`${sugeridas} fechas sugeridas puestas.`)).toBeVisible();
    await expect(resumen).toContainText(`${archivos.length} con fecha`);

    // Un recuerdo sin foto con un hueco por rellenar, todavía sin fecha.
    await page.getByRole("button", { name: /Añadir un recuerdo sin foto/ }).first().click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Llegó [mascota] a casa" }).click();
    await dialogo.getByRole("button", { name: "Añadir la carta" }).click();
    await expect(dialogo).toBeHidden();

    // Cartas: las fotos, con su ✓; el recuerdo, pendiente, y Estilo sigue cerrado.
    await page.getByRole("button", { name: "Siguiente: cartas" }).click();
    const tira = page.getByRole("list", { name: "Todas las cartas" });
    await expect(tira.getByRole("button", { name: /, lista$/ })).toHaveCount(archivos.length);
    await expect(tira.getByRole("button", { name: /, pendiente$/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Siguiente: estilo" })).toBeDisabled();

    await tira.getByRole("button", { name: /^Llegó \[mascota\] a casa/ }).click();
    await page.getByRole("button", { name: "Completar [mascota]" }).click();
    await page.keyboard.type("Rufo");
    await page.getByRole("radio", { name: "Solo el año" }).first().click();
    await page.getByLabel("Año").first().fill("2020");
    await expect(page.getByText("Carta lista")).toBeVisible();
    await expect(tira.getByRole("button", { name: /, pendiente$/ })).toHaveCount(0);
    await expect(tira.getByRole("button", { name: /^Llegó Rufo a casa, 2020, lista$/ })).toBeVisible();

    // Estilo: paleta, título y caja personalizada con una foto propia.
    await page.getByRole("button", { name: "Siguiente: estilo" }).click();
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

    // Descarga (el interruptor está activo en el prototipo): cada pieza, a dos caras.
    const descarga = page.waitForEvent("download", { timeout: 240_000 });
    await page.getByRole("button", { name: /Descargar el archivo de impresión/ }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe(`prueba-de-impresion-${cartasFisicas}-cartas.pdf`);
    const pdf = await PDFDocument.load(await readFile((await archivo.path())!));
    expect(pdf.getPageCount()).toBe(2 * (cartasFisicas + CAJA_PERSONALIZADA));
    const primera = pdf.getPage(0);
    const mm = 72 / 25.4;
    expect(Math.round(primera.getTrimBox().width / mm)).toBe(PRINT.carta.anchoMm);
    expect(Math.round(primera.getBleedBox().height / mm)).toBe(PRINT.carta.altoMm + 2 * PRINT.sangradoMm);
  });
});

test.describe("guardado en el dispositivo", () => {
  test("al volver sigue donde lo dejaste, con la carta abierta, y se puede empezar otro", async ({ page }) => {
    await empezar(page);
    const archivos = fotos().filter(conFecha).slice(0, 4);
    await subir(page, archivos);
    await page.getByRole("button", { name: "Siguiente: cartas" }).click();
    const tira = page.getByRole("list", { name: "Todas las cartas" });
    await tira.getByRole("button").nth(2).click();
    await expect(tira.getByRole("button").nth(2)).toHaveAttribute("aria-current", "true");
    await expect(guardado(page)).toHaveText(/Guardado en este dispositivo · ahora mismo/);

    await page.reload();
    await expect(page.getByTestId("aviso-reanudar")).toHaveText("Seguimos donde lo dejaste");
    await expect(page.getByText(`«Nuestros recuerdos» · ${archivos.length} cartas · guardado ahora mismo`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Completa las cartas" })).toBeVisible();
    await expect(tira.getByRole("button").nth(2)).toHaveAttribute("aria-current", "true");

    // «Empezar otro mazo» pregunta antes de borrar.
    page.once("dialog", (d) => {
      expect(d.message()).toContain("¿Borrar el mazo actual y empezar otro?");
      void d.accept();
    });
    await page.getByRole("button", { name: "Empezar otro mazo" }).first().click();
    await expect(page.getByRole("heading", { name: "Sube tus fotos" })).toBeVisible();
    await expect(page.getByTestId("aviso-reanudar")).toBeHidden();
    await expect(page.getByRole("list", { name: "Tus cartas" })).toBeHidden();
  });

  test("dos pestañas con el mismo mazo no se pisan", async ({ page, context }) => {
    await empezar(page);
    await subir(page, fotos().filter(conFecha).slice(0, 3));
    await expect(guardado(page)).toHaveText(/Guardado/);

    // La otra pestaña abre el mismo mazo y ve lo que se añade en esta.
    const otra = await context.newPage();
    await otra.goto("/es/crear");
    await expect(otra.getByText(`3 de ${pequeno.cartas} cartas`)).toBeVisible();
    await page.getByRole("button", { name: /Añadir un recuerdo sin foto/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Nuestra boda" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Añadir la carta" }).click();
    await expect(otra.getByText(`4 de ${pequeno.cartas} cartas`)).toBeVisible();

    // Si el mazo cambia a sus espaldas (otra pestaña sin aviso) y aquí también, no lo pisa: avisa.
    await cambiarMazo(otra, (m) => ({ ...m, cartas: m.cartas.slice(0, 2), actualizadoEn: m.actualizadoEn + 1 }));
    await otra.getByRole("button", { name: /Añadir un recuerdo sin foto/ }).first().click();
    await otra.getByRole("dialog").getByRole("button", { name: "Nuestra primera cita" }).click();
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
    const cuadricula = page.getByRole("list", { name: "Tus cartas" }).getByRole("listitem");
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
