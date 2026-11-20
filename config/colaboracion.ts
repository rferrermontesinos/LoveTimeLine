/**
 * Subida colaborativa por enlace: la familia manda fotos al mazo desde su móvil.
 *
 * Las fotos viajan cifradas desde el navegador de quien las manda hasta el del dueño del mazo; el
 * servicio que las guarda mientras tanto solo ve bytes que no puede abrir. En producción es la
 * función `colaboracion` de Supabase (región UE, ver supabase/functions/colaboracion); en
 * desarrollo y en las pruebas, la ruta /api/colaboracion de la propia web, que guarda en una
 * carpeta local (ver `COLABORACION_LOCAL` en .env.example).
 *
 * `NEXT_PUBLIC_COLABORACION_URL` es la dirección base del servicio. Sin ella, la función no se
 * ofrece en ninguna pantalla. Es `NEXT_PUBLIC_`: se lee al compilar.
 */
export const URL_COLABORACION = urlColaboracion(process.env.NEXT_PUBLIC_COLABORACION_URL);

/** Días que dura un enlace. Al caducar se borra del servicio todo lo que no se haya añadido aún. */
export const DIAS_ENLACE = 14;

/**
 * La dirección del servicio, sin barra final, o null si no hay o no vale. Una ruta («/api/…») es
 * de la propia web; si no, solo https (o http en el propio ordenador, para desarrollo).
 */
export function urlColaboracion(valor: string | undefined): string | null {
  const v = valor?.trim();
  if (!v) return null;
  if (v.startsWith("/")) return v.startsWith("//") ? null : v.replace(/\/+$/, "") || null;
  try {
    const u = new URL(v);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
    if (u.search || u.hash || u.username || u.password) return null;
    return `${u.origin}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}
