import { afterEach, describe, expect, it } from "vitest";
import { abrirCanal, idPestana, leerMensaje, type CanalPestanas, type MensajePestana } from "./pestanas";

describe("mensajes entre pestañas", () => {
  it("lee los tres tipos de mensaje", () => {
    expect(leerMensaje({ tipo: "hola", pestana: "a" })).toEqual({ tipo: "hola", pestana: "a" });
    expect(leerMensaje({ tipo: "aqui", pestana: "a" })).toEqual({ tipo: "aqui", pestana: "a" });
    expect(leerMensaje({ tipo: "guardado", pestana: "a", version: { id: "m1", actualizadoEn: 5, otro: 1 } })).toEqual({
      tipo: "guardado",
      pestana: "a",
      version: { id: "m1", actualizadoEn: 5 },
    });
  });

  it("ignora lo que no es uno de los nuestros", () => {
    expect(leerMensaje(null)).toBeNull();
    expect(leerMensaje("hola")).toBeNull();
    expect(leerMensaje({ tipo: "hola" })).toBeNull();
    expect(leerMensaje({ tipo: "hola", pestana: "" })).toBeNull();
    expect(leerMensaje({ tipo: "borrar", pestana: "a" })).toBeNull();
    expect(leerMensaje({ tipo: "guardado", pestana: "a" })).toBeNull();
    expect(leerMensaje({ tipo: "guardado", pestana: "a", version: { id: "m1" } })).toBeNull();
  });

  it("cada pestaña tiene su propio identificador", () => {
    expect(idPestana()).not.toBe(idPestana());
  });
});

describe("canal entre pestañas", () => {
  const abiertos: CanalPestanas[] = [];
  afterEach(() => {
    abiertos.splice(0).forEach((c) => c.cerrar());
  });

  it("lo que envía una pestaña llega a las otras, no a ella misma", async () => {
    const recibidosA: MensajePestana[] = [];
    const recibidosB: MensajePestana[] = [];
    const llegado = new Promise<void>((resolver) => {
      const b = abrirCanal("b", (m) => {
        recibidosB.push(m);
        resolver();
      });
      if (b) abiertos.push(b);
    });
    const a = abrirCanal("a", (m) => recibidosA.push(m));
    expect(a).not.toBeNull();
    abiertos.push(a!);

    a!.enviar({ tipo: "guardado", pestana: "a", version: { id: "m1", actualizadoEn: 7 } });
    await llegado;
    // Un momento más por si a «a» le llegara su propio mensaje.
    await new Promise((r) => setTimeout(r, 20));
    expect(recibidosB).toEqual([{ tipo: "guardado", pestana: "a", version: { id: "m1", actualizadoEn: 7 } }]);
    expect(recibidosA).toEqual([]);
  });

  it("enviar con el canal cerrado no rompe nada", () => {
    const a = abrirCanal("a", () => undefined);
    a!.cerrar();
    expect(() => a!.enviar({ tipo: "hola", pestana: "a" })).not.toThrow();
  });
});
