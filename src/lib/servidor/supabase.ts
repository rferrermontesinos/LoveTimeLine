/**
 * Clientes de Supabase (región UE). Opcionales en el prototipo: sin variables de entorno,
 * el portal funciona en modo demostración y no se conecta a nada.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Cliente con la clave pública: respeta RLS. */
export function clienteSupabaseServidor(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

/** Cliente de servicio: solo en el servidor (webhook y tareas programadas). Salta RLS. */
export function clienteSupabaseServicio(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, { auth: { persistSession: false } });
}
