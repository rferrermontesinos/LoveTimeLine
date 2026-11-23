import { describe, expect, it } from "vitest";
import { nombreDeIdioma } from "./textos";

describe("nombreDeIdioma", () => {
  it("escribe el nombre en el idioma de la interfaz, con mayúscula", () => {
    expect(nombreDeIdioma("en", "es")).toBe("Inglés");
    expect(nombreDeIdioma("es", "es")).toBe("Español");
    expect(nombreDeIdioma("es", "en")).toBe("Spanish");
    expect(nombreDeIdioma("en", "en")).toBe("English");
  });

  it("con un código que no es válido, el código en mayúsculas", () => {
    expect(nombreDeIdioma("e1", "es")).toBe("E1");
  });
});
