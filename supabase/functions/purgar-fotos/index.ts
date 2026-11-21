// Borra fotos originales, copias y archivos de impresión 60 días después del envío (RGPD).
// La llama cada día pg_cron (ver supabase/migrations/*_esquema_inicial.sql).
//
// Despliegue (una vez):
//   supabase secrets set PURGA_SECRETO=<el mismo valor que el secreto «purga_secreto» de Vault>
//   supabase functions deploy purgar-fotos --no-verify-jwt
//
// No escribe datos personales en los registros: solo cuántos pedidos y archivos ha borrado.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const DIAS = Number(Deno.env.get("PURGA_DIAS") ?? "60");
const LOTE = 1000;

interface PedidoAPurgar {
  pedido_id: string;
  usuario_id: string | null;
  mazo_id: string | null;
}

/** Comparación en tiempo constante, para no filtrar el secreto por tiempos de respuesta. */
function iguales(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diferencia = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diferencia |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diferencia === 0;
}

/** Borra todo lo que hay en una carpeta de un bucket, por lotes. Devuelve cuántos archivos. */
async function vaciar(sb: SupabaseClient, bucket: string, carpeta: string): Promise<number> {
  let total = 0;
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(carpeta, { limit: LOTE });
    if (error) throw new Error(`${bucket}: ${error.message}`);
    if (!data || data.length === 0) return total;
    const rutas = data.map((o) => `${carpeta}/${o.name}`);
    const { error: errorBorrado } = await sb.storage.from(bucket).remove(rutas);
    if (errorBorrado) throw new Error(`${bucket}: ${errorBorrado.message}`);
    total += rutas.length;
    if (data.length < LOTE) return total;
  }
}

Deno.serve(async (req) => {
  const secreto = Deno.env.get("PURGA_SECRETO") ?? "";
  if (secreto.length < 32 || !iguales(req.headers.get("x-purga-secreto") ?? "", secreto)) {
    return new Response("No autorizado", { status: 401 });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await sb.rpc("pedidos_a_purgar", { dias: DIAS });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let pedidos = 0;
  let archivos = 0;
  const fallos: string[] = [];
  for (const p of (data ?? []) as PedidoAPurgar[]) {
    try {
      if (p.usuario_id && p.mazo_id) {
        archivos += await vaciar(sb, "fotos-originales", `${p.usuario_id}/${p.mazo_id}`);
        archivos += await vaciar(sb, "fotos-copias", `${p.usuario_id}/${p.mazo_id}`);
      }
      archivos += await vaciar(sb, "impresion", p.pedido_id);
      const { error: errorMarca } = await sb.from("pedidos").update({ purgado_en: new Date().toISOString() }).eq("id", p.pedido_id);
      if (errorMarca) throw new Error(errorMarca.message);
      pedidos++;
    } catch (e) {
      // Se reintenta mañana: el pedido sigue sin purgado_en.
      fallos.push(`${p.pedido_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`purga: ${pedidos} pedidos, ${archivos} archivos, ${fallos.length} fallos`);
  return Response.json({ pedidos, archivos, fallos }, { status: fallos.length ? 207 : 200 });
});
