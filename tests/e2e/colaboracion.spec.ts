/**
 * Subida colaborativa: quien hace el mazo crea un enlace, otra persona manda fotos desde su móvil
 * (otro navegador, sin la clave del prototipo) y entran en el mazo. Necesita la compilación con
 * NEXT_PUBLIC_COLABORACION_URL=/api/colaboracion y COLABORACION_LOCAL=1 (playwright.config.ts).
 */
import path from "node:path";
import { devices, expect, test, type Page } from "@playwright/test";
import { conFecha, fotos, leerMazo } from "./mazo-utiles";

async function crearEnlace(page: Page): Promise<string> {
  await page.goto("/es/crear?pack=pequeno");
  await expect(page.getByRole("heading", { name: "Sube tus fotos" })).toBeVisible();
  const panel = page.getByTestId("panel-colaboracion");
  // Discreto: una sola línea, que se despliega para crear el enlace.
  const resumen = panel.locator("summary");
  await expect(resumen).toHaveText("¿Alguien más tiene fotos? Pídeselas con un enlace");
  await expect(panel.getByRole("button", { name: "Crear enlace" })).toBeHidden();
  await resumen.click();
  await panel.getByRole("button", { name: "Crear enlace" }).click();
  const campo = panel.getByTestId("enlace-colaboracion");
  await expect(campo).toHaveValue(/\/es\/aportar\/[A-Za-z0-9_-]{22}#k=[A-Za-z0-9_-]{43}$/);
  return campo.inputValue();
}

test.describe("pedir fotos con un enlace", () => {
  test("otra persona manda fotos desde su móvil, llegan cifradas y entran en el mazo con su fecha", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const url = await crearEnlace(page);
    const panel = page.getByTestId("panel-colaboracion");
    await expect(panel.getByRole("link", { name: "Mandar por WhatsApp" })).toHaveAttribute("href", `https://wa.me/?text=${encodeURIComponent(`Estoy haciendo un mazo de cartas con nuestros recuerdos. ¿Me mandas tus fotos? Puedes subirlas aquí: ${url}`)}`);
    await expect(panel.locator("summary")).toHaveText(/^Tu enlace para pedir fotos · abierto hasta el \d{1,2} de \w+$/);
    await expect(panel.getByText("Aún no ha llegado ninguna.", { exact: false })).toBeVisible();

    // Quien manda las fotos: otro navegador (otro móvil), sin nada del mazo ni la clave del prototipo.
    const otro = await browser.newContext({ ...devices["Pixel 7"], locale: "es-ES", timezoneId: "Europe/Madrid" });
    const movil = await otro.newPage();
    await movil.goto(url);
    await expect(movil.getByRole("heading", { name: "Manda tus fotos" })).toBeVisible();
    await expect(movil).toHaveTitle(/^Manda tus fotos · /);
    await expect(movil.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // No lleva a ninguna otra página del portal (están cerradas con la clave del prototipo).
    await expect(movil.locator('a[href]:not([href^="#"])')).toHaveCount(0);

    // Sin el permiso no se manda nada: se resalta la casilla.
    await movil.getByRole("button", { name: "Elegir fotos" }).click();
    await expect(movil.getByTestId("permiso-aportar")).toContainText("Marca esta casilla para poder mandar las fotos.");
    await movil.getByLabel("Tu nombre").fill("Tía Carmen");
    await movil.getByRole("checkbox", { name: /Tengo permiso/ }).check();
    const archivos = fotos().filter(conFecha).slice(0, 3);
    await movil.getByTestId("entrada-aportar").setInputFiles(archivos);
    await expect(movil.getByTestId("resultado-aportar")).toHaveText("¡Hecho! Han llegado 3 fotos.", { timeout: 60_000 });
    // La misma foto otra vez no sale de nuevo.
    await movil.getByTestId("entrada-aportar").setInputFiles(archivos.slice(0, 1));
    await expect(movil.getByTestId("resultado-aportar")).toHaveText("1 ya estaba enviada");

    // Quien hace el mazo las ve llegar. Sin su propio permiso de las fotos, no las añade.
    await panel.getByRole("button", { name: "Mirar ahora" }).click();
    await expect(panel.getByTestId("fotos-llegadas")).toContainText("Han llegado 3 fotos");
    await panel.getByRole("button", { name: "Añadir al mazo" }).click();
    await expect(page.getByTestId("permiso-fotos")).toContainText("Marca esta casilla para poder añadir las fotos.");
    await page.getByRole("checkbox", { name: /Tengo permiso/ }).check();
    await panel.getByRole("button", { name: "Añadir al mazo" }).click();
    await expect(page.getByTestId("resumen-subida")).toContainText("3 fotos añadidas · todas con fecha");
    await expect(page.getByText("Enviadas por Tía Carmen.")).toBeVisible();
    // Ya en el mazo guardado, se borran del servicio: no queda ninguna esperando.
    await expect(panel.getByText("Aún no ha llegado ninguna.", { exact: false })).toBeVisible();
    const mazo = await leerMazo(page);
    const cartas = (mazo?.cartas ?? []) as { nombreArchivo?: string; fecha: unknown }[];
    expect(cartas.map((c) => c.nombreArchivo).sort()).toEqual(archivos.map((a) => path.basename(a)).sort());
    expect(cartas.every((c) => c.fecha)).toBe(true);
    await expect(page.getByRole("region", { name: /^Tus cartas/ }).getByRole("listitem")).toHaveCount(3);

    // Al volver otro día, el enlace sigue ahí, plegado en su línea, y las cartas se ven enseguida.
    await page.reload();
    await expect(panel.locator("summary")).toHaveText(/^Tu enlace para pedir fotos · abierto hasta el /);
    await expect(panel.getByTestId("enlace-colaboracion")).toBeHidden();
    await expect(page.getByRole("region", { name: /^Tus cartas/ }).getByRole("listitem").first()).toBeInViewport();
    await panel.locator("summary").click();
    await expect(panel.getByTestId("enlace-colaboracion")).toHaveValue(url);

    // Al cerrar el enlace, deja de funcionar para quien lo tenga.
    page.once("dialog", (d) => {
      expect(d.message()).toBe("¿Cerrar el enlace? Nadie más podrá mandarte fotos con él.");
      void d.accept();
    });
    await panel.getByRole("button", { name: "Cerrar enlace" }).click();
    await expect(panel.getByRole("button", { name: "Crear enlace" })).toBeVisible();
    await movil.reload();
    await expect(movil.getByTestId("aportar-error")).toHaveAttribute("data-motivo", "noExiste");
    await otro.close();
  });

  test("un enlace incompleto o de otro mazo no deja mandar nada, y al empezar otro mazo el enlace se cierra", async ({ page, browser }) => {
    const url = await crearEnlace(page);
    const otro = await browser.newContext({ locale: "es-ES" });
    const visita = await otro.newPage();

    // El de verdad abre el formulario.
    await visita.goto(url);
    await expect(visita.getByRole("button", { name: "Elegir fotos" })).toBeVisible();
    // Con la huella de otra clave, no: el servicio no puede dar una clave que no sea la del dueño.
    // (Mismo camino y otro «#»: el navegador no recarga la página solo; se recarga a mano.)
    await visita.goto(url.replace(/#k=.*/, `#k=${"A".repeat(43)}`));
    await visita.reload();
    await expect(visita.getByTestId("aportar-error")).toHaveText("El enlace está incompleto. Ábrelo entero, tal como te llegó.");
    await expect(visita.getByRole("button", { name: "Elegir fotos" })).toBeHidden();
    // Sin lo de tras «#» (la huella), tampoco se puede comprobar a quién van las fotos.
    await visita.goto(url.split("#")[0]!);
    await visita.reload();
    await expect(visita.getByTestId("aportar-error")).toHaveAttribute("data-motivo", "incompleto");
    // Un id que no existe.
    await visita.goto(url.replace(/aportar\/[^#]+/, `aportar/${"A".repeat(22)}`));
    await expect(visita.getByTestId("aportar-error")).toHaveText("Este enlace ya no funciona. Pide a quien te lo mandó que cree otro.");
    await visita.goto(url);
    await expect(visita.getByRole("button", { name: "Elegir fotos" })).toBeVisible();

    // Empezar otro mazo cierra el enlace del anterior: nadie podría abrir ya lo que llegara.
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Empezar otro mazo" }).click();
    await expect(page.getByTestId("panel-colaboracion").locator("summary")).toHaveText("¿Alguien más tiene fotos? Pídeselas con un enlace");
    await visita.reload();
    await expect(visita.getByTestId("aportar-error")).toHaveAttribute("data-motivo", "noExiste");
    await otro.close();
  });
});
