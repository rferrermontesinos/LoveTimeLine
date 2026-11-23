/**
 * Pedidos en el servidor: cotización con los precios del catálogo (nunca los del navegador),
 * Stripe Checkout en modo test y registro opcional en Supabase.
 */
import Stripe from "stripe";
import { cotizar, type Cotizacion, type LineaCotizacion } from "@/domain/precios/cotizar";
import { textoEn, type Catalogo } from "@/domain/precios/tipos";
import { clienteSupabaseServicio } from "./supabase";

/** El cliente de Supabase con la clave de servicio (null si no hay base configurada). */
type Base = ReturnType<typeof clienteSupabaseServicio>;

export interface SolicitudPedido {
  mazoId: string;
  packId: string;
  cartasFoto: number;
  /** Recuerdos sin foto: se cobran igual que las cartas con foto. */
  cartasTexto: number;
  extras: string[];
  mecanicas: string[];
  idioma: "es" | "en";
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Valida el cuerpo que llega del navegador. Devuelve null si algo no cuadra. */
export function leerSolicitud(cuerpo: unknown): SolicitudPedido | null {
  if (!cuerpo || typeof cuerpo !== "object") return null;
  const c = cuerpo as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === "string" && ID.test(x)) ? (v as string[]) : null);
  const extras = lista(c.extras ?? []);
  const mecanicas = lista(c.mecanicas ?? []);
  if (typeof c.mazoId !== "string" || !ID.test(c.mazoId)) return null;
  if (typeof c.packId !== "string" || !ID.test(c.packId)) return null;
  const cuenta = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 2000 ? v : null);
  const cartasFoto = cuenta(c.cartasFoto);
  const cartasTexto = cuenta(c.cartasTexto ?? 0);
  if (cartasFoto === null || cartasTexto === null) return null;
  if (!extras || !mecanicas) return null;
  return { mazoId: c.mazoId, packId: c.packId, cartasFoto, cartasTexto, extras, mecanicas, idioma: c.idioma === "en" ? "en" : "es" };
}

export function nuevoPedidoId(ahora = Date.now()): string {
  const azar = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `P-${ahora.toString(36).toUpperCase()}-${azar.toUpperCase()}`;
}

/** Nombre de cada línea en el recibo de Stripe. */
export function nombreLinea(l: LineaCotizacion, c: Cotizacion, catalogo: Catalogo, idioma: "es" | "en"): string {
  const en = idioma === "en";
  switch (l.tipo) {
    case "pack":
      return en
        ? `${textoEn(c.packAplicado.nombre, idioma)} pack · ${c.packAplicado.cartas} cards`
        : `Pack ${textoEn(c.packAplicado.nombre, idioma)} · ${c.packAplicado.cartas} cartas`;
    case "cartas-extra":
      return en ? `Extra cards × ${l.cantidad}` : `Cartas extra × ${l.cantidad}`;
    case "caja":
      return en ? `Extra box × ${l.cantidad}` : `Caja extra × ${l.cantidad}`;
    case "envio":
      return en ? "Shipping" : "Envío";
    case "mecanica":
      return textoEn(catalogo.mecanicas.find((m) => m.id === l.id)?.nombre ?? { es: l.id }, idioma);
    case "extra":
      return textoEn(catalogo.extras.find((x) => x.id === l.id)?.nombre ?? { es: l.id }, idioma);
  }
}

export function cotizarSolicitud(catalogo: Catalogo, s: SolicitudPedido): Cotizacion {
  return cotizar({ catalogo, packId: s.packId, cartas: s.cartasFoto + s.cartasTexto, extras: s.extras, mecanicas: s.mecanicas });
}

export function stripe(): Stripe | null {
  const clave = process.env.STRIPE_SECRET_KEY;
  if (!clave) return null;
  // El prototipo solo trabaja en modo test: una clave real se rechaza.
  if (!clave.startsWith("sk_test_") && !clave.startsWith("rk_test_")) throw new Error("STRIPE_SECRET_KEY debe ser una clave de test durante el prototipo");
  return new Stripe(clave);
}

export async function crearSesionStripe(e: {
  stripe: Stripe;
  catalogo: Catalogo;
  solicitud: SolicitudPedido;
  cotizacion: Cotizacion;
  pedidoId: string;
  origen: string;
}): Promise<Stripe.Checkout.Session> {
  const { cotizacion: c, solicitud: s } = e;
  const paises = e.catalogo.paises.filter((p) => p.activo).map((p) => p.codigo) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
  return e.stripe.checkout.sessions.create({
    mode: "payment",
    locale: s.idioma,
    client_reference_id: e.pedidoId,
    line_items: c.lineas
      .filter((l) => l.importeCents > 0)
      .map((l) => ({
        quantity: 1,
        price_data: { currency: c.moneda.toLowerCase(), unit_amount: l.importeCents, product_data: { name: nombreLinea(l, c, e.catalogo, s.idioma) } },
      })),
    shipping_address_collection: { allowed_countries: paises },
    metadata: {
      pedidoId: e.pedidoId,
      mazoId: s.mazoId,
      packId: s.packId,
      packAplicado: c.packAplicado.id,
      cartasFoto: String(s.cartasFoto),
      cartasTexto: String(s.cartasTexto),
      cartasFisicas: String(c.cartasFisicas),
      extras: s.extras.join(","),
      mecanicas: s.mecanicas.join(","),
    },
    success_url: `${e.origen}/${s.idioma}/pedido/confirmado?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${e.origen}/${s.idioma}/crear?pago=cancelado`,
  });
}

/** Guarda el pedido en Supabase si está configurado. Sin Supabase no hace nada. */
/**
 * Guarda el pedido en Supabase, si está configurado. Lanza si no se ha podido: sin el pedido en la
 * base, el aviso de pago de Stripe no encontraría qué marcar.
 */
export async function registrarPedido(
  e: {
    pedidoId: string;
    solicitud: SolicitudPedido;
    cotizacion: Cotizacion;
    catalogo: Catalogo;
    modo: "simulado" | "stripe";
    stripeSessionId?: string;
  },
  sb: Base = clienteSupabaseServicio(),
): Promise<void> {
  if (!sb) return;
  const { error } = await sb.from("pedidos").insert({
    id: e.pedidoId,
    mazo_ref: e.solicitud.mazoId,
    estado: e.modo === "simulado" ? "simulado" : "pendiente",
    modo: e.modo,
    pack_id: e.cotizacion.packAplicado.id,
    pack_elegido_id: e.cotizacion.pack.id,
    cartas_foto: e.solicitud.cartasFoto,
    cartas_texto: e.solicitud.cartasTexto,
    cartas_fisicas: e.cotizacion.cartasFisicas,
    lineas: e.cotizacion.lineas,
    catalogo_version: e.catalogo.version,
    extras: e.solicitud.extras,
    mecanicas: e.solicitud.mecanicas,
    total_cents: e.cotizacion.totalCents,
    moneda: e.cotizacion.moneda,
    idioma: e.solicitud.idioma,
    stripe_session_id: e.stripeSessionId ?? null,
  });
  if (error) throw new Error(`No se pudo registrar el pedido en Supabase: ${error.message}`);
}

/**
 * Cómo ha quedado un pedido al llegar el aviso de pago: recién pagado, ya lo estaba (Stripe puede
 * mandar el mismo aviso más de una vez) o sin base en la que comprobarlo.
 */
export type ResultadoPago = "pagado" | "ya-estaba" | "sin-base";

/**
 * Marca el pedido como pagado si aún no lo estaba (pendiente, o cancelado a mano antes de que
 * llegara el pago). Lanza si la base falla o el pedido no está: el webhook responde con error y
 * Stripe vuelve a mandar el aviso más tarde.
 */
export async function marcarPagado(pedidoId: string, sessionId: string, sb: Base = clienteSupabaseServicio()): Promise<ResultadoPago> {
  if (!sb) return "sin-base";
  const { data, error } = await sb
    .from("pedidos")
    .update({ estado: "pagado", pagado_en: new Date().toISOString() })
    .eq("id", pedidoId)
    .eq("stripe_session_id", sessionId)
    .in("estado", ["pendiente", "cancelado"])
    .select("id");
  if (error) throw new Error(`No se pudo marcar el pedido como pagado: ${error.message}`);
  if (data && data.length > 0) return "pagado";
  const { data: existente, error: errorLectura } = await sb.from("pedidos").select("estado").eq("id", pedidoId).eq("stripe_session_id", sessionId).maybeSingle();
  if (errorLectura) throw new Error(`No se pudo leer el pedido: ${errorLectura.message}`);
  if (!existente) throw new Error(`El pedido ${pedidoId} no está en la base`);
  return "ya-estaba";
}
