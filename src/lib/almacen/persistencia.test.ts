import { describe, expect, it, vi } from "vitest";
import { solicitarPersistencia } from "./persistencia";

describe("almacén persistente", () => {
  it("si ya lo es, no lo vuelve a pedir", async () => {
    const persist = vi.fn(async () => true);
    expect(await solicitarPersistencia({ persisted: async () => true, persist })).toBe("persistente");
    expect(persist).not.toHaveBeenCalled();
  });

  it("lo pide y cuenta si el navegador lo concede", async () => {
    expect(await solicitarPersistencia({ persisted: async () => false, persist: async () => true })).toBe("persistente");
    expect(await solicitarPersistencia({ persisted: async () => false, persist: async () => false })).toBe("no-concedido");
    expect(await solicitarPersistencia({ persist: async () => true })).toBe("persistente");
  });

  it("sin la función o si falla, sigue sin él", async () => {
    expect(await solicitarPersistencia(undefined)).toBe("no-disponible");
    expect(await solicitarPersistencia({})).toBe("no-disponible");
    expect(
      await solicitarPersistencia({
        persist: async () => {
          throw new Error("no");
        },
      }),
    ).toBe("no-disponible");
  });
});
