import { NextResponse } from "next/server";
import { ErrorCotizacion } from "@/domain/precios/cotizar";
import { obtenerCatalogo } from "@/lib/servidor/catalogo";
import { cotizarSolicitud, crearSesionStripe, leerSolicitud, nuevoPedidoId, registrarPedido, stripe } from "@/lib/servidor/pedidos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Crea el pedido: precio calculado aquí con el catálogo, y pago con Stripe en modo test o simulado. */
export async function POST(req: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "cuerpo-invalido" }, { status: 400 });
  }
  const solicitud = leerSolicitud(cuerpo);
  if (!solicitud) return NextResponse.json({ error: "cuerpo-invalido" }, { status: 400 });

  const catalogo = await obtenerCatalogo();
  let cotizacion;
  try {
    cotizacion = cotizarSolicitud(catalogo, solicitud);
  } catch (e) {
    if (e instanceof ErrorCotizacion) return NextResponse.json({ error: e.codigo }, { status: 400 });
    throw e;
  }
  if (!cotizacion.sePuedePagar) {
    return NextResponse.json({ error: "no-se-puede-pagar", faltan: cotizacion.faltan, excedeMaximo: cotizacion.excedeMaximo }, { status: 422 });
  }

  const pedidoId = nuevoPedidoId();
  const base = { pedidoId, totalCents: cotizacion.totalCents, moneda: cotizacion.moneda, cartasFisicas: cotizacion.cartasFisicas };
  const cliente = stripe();
  if (!cliente) {
    try {
      await registrarPedido({ pedidoId, solicitud, cotizacion, catalogo, modo: "simulado" });
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      return NextResponse.json({ error: "pedido" }, { status: 502 });
    }
    return NextResponse.json({ modo: "simulado", ...base });
  }

  const origen = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
  let sesion;
  try {
    sesion = await crearSesionStripe({ stripe: cliente, catalogo, solicitud, cotizacion, pedidoId, origen });
  } catch (e) {
    console.error("Stripe no ha creado la sesión de pago:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "stripe" }, { status: 502 });
  }
  try {
    await registrarPedido({ pedidoId, solicitud, cotizacion, catalogo, modo: "stripe", stripeSessionId: sesion.id });
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    // Sin el pedido guardado, el pago no se podría reconocer: la sesión se cierra antes de que nadie pague.
    await cliente.checkout.sessions.expire(sesion.id).catch(() => undefined);
    return NextResponse.json({ error: "pedido" }, { status: 502 });
  }
  return NextResponse.json({ modo: "stripe", ...base, url: sesion.url, sessionId: sesion.id });
}
