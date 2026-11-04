import { NextResponse } from "next/server";
import { obtenerCatalogo } from "@/lib/servidor/catalogo";

export const revalidate = 300;

/** Catálogo público: packs, ampliaciones, extras y mecánicas con sus precios en céntimos. */
export async function GET() {
  return NextResponse.json(await obtenerCatalogo());
}
