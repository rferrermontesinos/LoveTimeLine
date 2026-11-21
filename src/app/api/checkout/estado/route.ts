import { NextResponse } from "next/server";
import { stripe } from "@/lib/servidor/pedidos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Estado de una sesión de Stripe, para la página de pedido confirmado. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("session_id") ?? "";
  if (!/^cs_test_[A-Za-z0-9]{10,200}$/.test(id)) return NextResponse.json({ error: "sesion-invalida" }, { status: 400 });
  const cliente = stripe();
  if (!cliente) return NextResponse.json({ error: "sin-stripe" }, { status: 404 });
  try {
    const s = await cliente.checkout.sessions.retrieve(id);
    return NextResponse.json({
      pagado: s.payment_status === "paid",
      pedidoId: s.client_reference_id,
      totalCents: s.amount_total,
      moneda: s.currency?.toUpperCase() ?? null,
    });
  } catch {
    return NextResponse.json({ error: "no-encontrada" }, { status: 404 });
  }
}
