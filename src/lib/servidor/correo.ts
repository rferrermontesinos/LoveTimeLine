/**
 * Correos transaccionales con Brevo. Sin BREVO_API_KEY no se envía nada: se deja una línea
 * en el log del servidor, sin la dirección del cliente (es un dato personal).
 */
import { BRAND_CONTACT_EMAIL, BRAND_NAME } from "@config/brand";
import { formatearImporte } from "@/domain/precios/cotizar";

const TEXTOS = {
  es: {
    asunto: (id: string) => `Hemos recibido tu pedido ${id}`,
    titulo: "¡Gracias! Tu mazo ya está en marcha",
    cuerpo: (total: string) => `Hemos recibido el pago de ${total}. Revisaremos el archivo de impresión y te avisaremos cuando salga hacia tu casa.`,
    referencia: "Referencia",
    privacidad: "Borramos las fotos y los archivos de impresión 60 días después del envío.",
  },
  en: {
    asunto: (id: string) => `We’ve received your order ${id}`,
    titulo: "Thank you! Your deck is on its way",
    cuerpo: (total: string) => `We’ve received your payment of ${total}. We’ll check the print file and let you know when it ships.`,
    referencia: "Reference",
    privacidad: "We delete the photos and print files 60 days after shipping.",
  },
} as const;

function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function correoConfirmacion(e: { pedidoId: string; totalCents: number; moneda: string; idioma: "es" | "en" }) {
  const t = TEXTOS[e.idioma];
  const total = formatearImporte(e.totalCents, e.moneda.toUpperCase(), e.idioma);
  const html = `<!doctype html><html lang="${e.idioma}"><body style="margin:0;background:#F5F0E6;font-family:Arial,Helvetica,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:18px;overflow:hidden">
<tr><td style="background:#F7739E;height:12px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px"><p style="margin:0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#5E584F">${escapar(BRAND_NAME)}</p>
<h1 style="margin:10px 0 0;font-size:26px;line-height:1.1">${escapar(t.titulo)}</h1></td></tr>
<tr><td style="padding:8px 28px 4px;font-size:16px;line-height:1.5">${escapar(t.cuerpo(total))}</td></tr>
<tr><td style="padding:12px 28px 24px;font-size:14px;color:#5E584F">${escapar(t.referencia)}: <strong style="color:#141414">${escapar(e.pedidoId)}</strong><br>${escapar(t.privacidad)}</td></tr>
</table></td></tr></table></body></html>`;
  return { asunto: t.asunto(e.pedidoId), html };
}

export async function enviarConfirmacion(e: { para: string; pedidoId: string; totalCents: number; moneda: string; idioma: "es" | "en" }) {
  const clave = process.env.BREVO_API_KEY;
  if (!clave) {
    console.info(`[correo] Confirmación del pedido ${e.pedidoId} no enviada: falta BREVO_API_KEY.`);
    return;
  }
  const { asunto, html } = correoConfirmacion(e);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": clave, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_REMITENTE_EMAIL || BRAND_CONTACT_EMAIL, name: process.env.BREVO_REMITENTE_NOMBRE || BRAND_NAME },
      to: [{ email: e.para }],
      subject: asunto,
      htmlContent: html,
      tags: ["pedido-confirmado"],
    }),
  });
  if (!res.ok) console.error(`[correo] Brevo respondió ${res.status} al confirmar el pedido ${e.pedidoId}.`);
}
