import path from "node:path";
import { crearServicio } from "@datos/functions/colaboracion/servicio";
import { almacenLocal } from "@/lib/servidor/colaboracionLocal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El servicio de la subida colaborativa servido desde Next, solo para desarrollo y pruebas
 * (COLABORACION_LOCAL=1, con NEXT_PUBLIC_COLABORACION_URL=/api/colaboracion): guarda los paquetes
 * cifrados en `.colaboracion-local/`, fuera de git. En producción el servicio es la función
 * «colaboracion» de Supabase y esta ruta responde 404.
 */
let servir: ((req: Request) => Promise<Response>) | null = null;

async function manejar(req: Request): Promise<Response> {
  if (process.env.COLABORACION_LOCAL !== "1") return new Response("No encontrado", { status: 404 });
  // Sin el freno de enlaces por hora: las pruebas crean muchos seguidos (los límites tienen sus
  // propias pruebas en src/lib/servidor/colaboracion.test.ts).
  // Con COLABORACION_CLAVE_SERVICIO, crear enlaces la pide como en Supabase (solo desde /api/enlaces).
  servir ??= crearServicio(almacenLocal({ carpeta: path.join(process.cwd(), ".colaboracion-local") }), {
    limites: { maxEnlacesActivos: 10_000, maxEnlacesPorHora: 10_000 },
    claveServicio: process.env.COLABORACION_CLAVE_SERVICIO || null,
  });
  return servir(req);
}

export const GET = manejar;
export const POST = manejar;
export const DELETE = manejar;
export const OPTIONS = manejar;
