// Subida colaborativa: guarda cifradas las fotos que la familia manda por el enlace de un mazo.
// Toda la lógica está en servicio.ts (probada en src/lib/servidor/colaboracion.test.ts); aquí
// solo se conecta con la base de datos y el bucket privado «aportaciones».
//
// Despliegue: supabase functions deploy colaboracion --no-verify-jwt
// (cualquiera con el enlace puede mandar fotos; quien lo creó se identifica con su token). Crear
// enlaces pide el secreto COLABORACION_CLAVE_SERVICIO, el mismo que tiene el portal (Vercel):
//   supabase secrets set COLABORACION_CLAVE_SERVICIO=<valor largo y aleatorio>
// Sin él, el servicio funciona pero no deja crear enlaces nuevos.
//
// No escribe datos personales en los registros: no ve el contenido de las fotos, ni nombres.
import { createClient } from "npm:@supabase/supabase-js@2";
import { almacenSupabase, crearServicio, type ClienteSupabase } from "./servicio.ts";

/** La clave secreta nueva si la hay; si no, la de servicio de siempre. Las dos saltan RLS. */
function claveServidor(): string {
  try {
    const nuevas = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    if (nuevas.default) return nuevas.default;
  } catch {
    /* sin claves nuevas */
  }
  const antigua = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!antigua) throw new Error("Falta la clave de servicio");
  return antigua;
}

const cliente = createClient(Deno.env.get("SUPABASE_URL")!, claveServidor(), { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(crearServicio(almacenSupabase(cliente as unknown as ClienteSupabase), { claveServicio: Deno.env.get("COLABORACION_CLAVE_SERVICIO") ?? "" }));
