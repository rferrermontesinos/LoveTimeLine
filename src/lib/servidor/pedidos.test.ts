import { describe, expect, it } from "vitest";
import catalogoJson from "../../../supabase/catalogo.json";
import { cotizar } from "@/domain/precios/cotizar";
import type { Catalogo } from "@/domain/precios/tipos";
import { marcarPagado, registrarPedido, type SolicitudPedido } from "./pedidos";

type Fila = Record<string, unknown>;

/**
 * Una base de mentira con lo justo de la API de Supabase que usan los pedidos: insertar, y
 * actualizar o leer con filtros `eq` e `in`. `fallar` hace que la próxima operación dé error.
 */
function base(filas: Fila[] = []) {
  const estado = { filas, fallar: null as string | null };
  const consulta = (accion: (f: Fila[]) => unknown) => {
    const filtros: ((f: Fila) => boolean)[] = [];
    const resultado = () => {
      if (estado.fallar) {
        const message = estado.fallar;
        estado.fallar = null;
        return { data: null, error: { message } };
      }
      return { data: accion(estado.filas.filter((f) => filtros.every((p) => p(f)))), error: null };
    };
    const q = {
      eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), q),
      in: (c: string, vs: unknown[]) => (filtros.push((f) => vs.includes(f[c])), q),
      select: () => q,
      maybeSingle: async () => {
        const r = resultado();
        return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
      },
      then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultado()).then(ok, ko),
    };
    return q;
  };
  const sb = {
    from: () => ({
      insert: async (fila: Fila) => {
        if (estado.fallar) return { error: { message: estado.fallar } };
        estado.filas.push(fila);
        return { error: null };
      },
      update: (cambios: Fila) => consulta((fs) => fs.map((f) => Object.assign(f, cambios))),
      select: () => consulta((fs) => fs),
    }),
  };
  return { sb: sb as never, estado };
}

const catalogo = catalogoJson as unknown as Catalogo;
const solicitud: SolicitudPedido = { mazoId: "mazo-1", packId: "pequeno", cartasFoto: 40, cartasTexto: 0, extras: [], mecanicas: [], idioma: "es" };
const pedido = (modo: "simulado" | "stripe") => ({
  pedidoId: "P-ABC-123456",
  solicitud,
  cotizacion: cotizar({ catalogo, packId: "pequeno", cartas: 40 }),
  catalogo,
  modo,
  stripeSessionId: modo === "stripe" ? "cs_test_1" : undefined,
});

describe("registrar un pedido", () => {
  it("lo guarda pendiente (o simulado) y, si la base falla, lanza en vez de seguir como si nada", async () => {
    const { sb, estado } = base();
    await registrarPedido(pedido("stripe"), sb);
    expect(estado.filas[0]).toMatchObject({ id: "P-ABC-123456", estado: "pendiente", stripe_session_id: "cs_test_1" });
    estado.fallar = "sin conexión";
    await expect(registrarPedido(pedido("simulado"), sb)).rejects.toThrow("sin conexión");
  });

  it("sin base configurada no hace nada", async () => {
    await expect(registrarPedido(pedido("simulado"), null)).resolves.toBeUndefined();
  });
});

describe("marcar un pedido como pagado (aviso de Stripe)", () => {
  const fila = (estado: string) => ({ id: "P-ABC-123456", stripe_session_id: "cs_test_1", estado });

  it("la primera vez pasa a pagado; el mismo aviso repetido dice que ya lo estaba", async () => {
    const { sb, estado } = base([fila("pendiente")]);
    expect(await marcarPagado("P-ABC-123456", "cs_test_1", sb)).toBe("pagado");
    expect(estado.filas[0]).toMatchObject({ estado: "pagado" });
    const pagadoEn = estado.filas[0]!.pagado_en;
    expect(await marcarPagado("P-ABC-123456", "cs_test_1", sb)).toBe("ya-estaba");
    expect(estado.filas[0]!.pagado_en).toBe(pagadoEn);
  });

  it("no hace retroceder un pedido que ya va por la imprenta", async () => {
    const { sb, estado } = base([fila("enviado")]);
    expect(await marcarPagado("P-ABC-123456", "cs_test_1", sb)).toBe("ya-estaba");
    expect(estado.filas[0]).toMatchObject({ estado: "enviado" });
  });

  it("uno cancelado a mano antes de que llegara el pago queda pagado: el dinero se ha cobrado", async () => {
    const { sb } = base([fila("cancelado")]);
    expect(await marcarPagado("P-ABC-123456", "cs_test_1", sb)).toBe("pagado");
  });

  it("si la base falla o el pedido no está, lanza (y Stripe reintenta)", async () => {
    const { sb, estado } = base([fila("pendiente")]);
    estado.fallar = "tiempo agotado";
    await expect(marcarPagado("P-ABC-123456", "cs_test_1", sb)).rejects.toThrow("tiempo agotado");
    await expect(marcarPagado("P-OTRO-000000", "cs_test_1", sb)).rejects.toThrow("no está en la base");
    await expect(marcarPagado("P-ABC-123456", "cs_test_otra", sb)).rejects.toThrow("no está en la base");
  });

  it("sin base configurada lo dice, para mandar el correo igualmente", async () => {
    expect(await marcarPagado("P-ABC-123456", "cs_test_1", null)).toBe("sin-base");
  });
});
