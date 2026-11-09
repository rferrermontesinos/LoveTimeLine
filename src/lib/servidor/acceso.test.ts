import { describe, expect, it } from "vitest";
import { COOKIE_ACCESO, decidirAcceso, huellaClave, igualesSeguro, PARAM_ACCESO } from "./acceso";

const CLAVE = "clave-de-prueba-123";
const url = (ruta: string) => new URL(ruta, "https://prueba.ejemplo.test");

describe("acceso privado al prototipo", () => {
  it("sin clave en el entorno no bloquea nada", async () => {
    expect(await decidirAcceso({ clave: undefined, url: url("/es/crear"), cookie: undefined })).toEqual({ tipo: "pasar" });
    expect(await decidirAcceso({ clave: "  ", url: url("/es"), cookie: undefined })).toEqual({ tipo: "pasar" });
  });

  it("sin enlace ni cookie, deniega páginas y API", async () => {
    for (const ruta of ["/", "/es", "/es/crear?pack=pequeno", "/api/checkout", "/api/catalogo"]) {
      expect(await decidirAcceso({ clave: CLAVE, url: url(ruta), cookie: undefined })).toEqual({ tipo: "denegar" });
    }
  });

  it("con el enlace secreto, deja entrar y quita la clave de la dirección", async () => {
    const d = await decidirAcceso({ clave: CLAVE, url: url(`/es/crear?pack=mediano&${PARAM_ACCESO}=${CLAVE}`), cookie: undefined });
    expect(d.tipo).toBe("entrar");
    if (d.tipo !== "entrar") return;
    expect(d.destino.pathname).toBe("/es/crear");
    expect(d.destino.searchParams.get("pack")).toBe("mediano");
    expect(d.destino.searchParams.has(PARAM_ACCESO)).toBe(false);
    expect(d.huella).toBe(await huellaClave(CLAVE));
    expect(d.huella).not.toContain(CLAVE);
  });

  it("con una clave equivocada en el enlace, deniega", async () => {
    expect(await decidirAcceso({ clave: CLAVE, url: url(`/?${PARAM_ACCESO}=otra`), cookie: undefined })).toEqual({ tipo: "denegar" });
  });

  it("con la cookie de la huella, deja pasar; con otra, deniega", async () => {
    const huella = await huellaClave(CLAVE);
    expect(await decidirAcceso({ clave: CLAVE, url: url("/es/crear"), cookie: huella })).toEqual({ tipo: "pasar" });
    expect(await decidirAcceso({ clave: CLAVE, url: url("/es/crear"), cookie: CLAVE })).toEqual({ tipo: "denegar" });
    expect(await decidirAcceso({ clave: "nueva-clave", url: url("/es/crear"), cookie: huella })).toEqual({ tipo: "denegar" });
  });

  it("el webhook de Stripe nunca se bloquea", async () => {
    expect(await decidirAcceso({ clave: CLAVE, url: url("/api/stripe/webhook"), cookie: undefined })).toEqual({ tipo: "pasar" });
  });

  it("compara en tiempo constante y distingue longitudes", () => {
    expect(igualesSeguro("abc", "abc")).toBe(true);
    expect(igualesSeguro("abc", "abd")).toBe(false);
    expect(igualesSeguro("abc", "abcd")).toBe(false);
    expect(COOKIE_ACCESO).toMatch(/^[a-z_]+$/);
  });
});
