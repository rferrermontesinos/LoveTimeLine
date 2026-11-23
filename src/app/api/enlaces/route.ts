import { URL_COLABORACION } from "@config/colaboracion";
import { crearEnlaceEnServicio } from "@/lib/servidor/enlaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Crear un enlace para pedir fotos pasa por el portal: esta ruta está detrás de su acceso privado y
 * firma la petición al servicio con un secreto que solo tienen los dos (COLABORACION_CLAVE_SERVICIO).
 * Así nadie de fuera crea enlaces en el servicio. Lo demás (mandar fotos, recogerlas) va directo.
 */
export async function POST(req: Request): Promise<Response> {
  return crearEnlaceEnServicio(req, { base: URL_COLABORACION, secreto: process.env.COLABORACION_CLAVE_SERVICIO });
}
