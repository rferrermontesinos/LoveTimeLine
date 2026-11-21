import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { enviarConfirmacion } from "@/lib/servidor/correo";
import { marcarPagado, stripe } from "@/lib/servidor/pedidos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Webhook de Stripe: marca el pedido como pagado y manda el correo de confirmación. */
export async function POST(req: Request) {
  const cliente = stripe();
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!cliente || !secreto) return NextResponse.json({ error: "sin-configurar" }, { status: 501 });
  const firma = req.headers.get("stripe-signature");
  if (!firma) return NextResponse.json({ error: "sin-firma" }, { status: 400 });

  let evento: Stripe.Event;
  try {
    evento = cliente.webhooks.constructEvent(await req.text(), firma, secreto);
  } catch {
    return NextResponse.json({ error: "firma-invalida" }, { status: 400 });
  }

  if (evento.type === "checkout.session.completed" || evento.type === "checkout.session.async_payment_succeeded") {
    const s = evento.data.object as Stripe.Checkout.Session;
    if (s.payment_status === "paid" && s.client_reference_id) {
      await marcarPagado(s.client_reference_id, s.id);
      const email = s.customer_details?.email;
      if (email) {
        await enviarConfirmacion({
          para: email,
          pedidoId: s.client_reference_id,
          totalCents: s.amount_total ?? 0,
          moneda: s.currency ?? "eur",
          idioma: s.locale === "en" ? "en" : "es",
        });
      }
    }
  }
  return NextResponse.json({ recibido: true });
}
