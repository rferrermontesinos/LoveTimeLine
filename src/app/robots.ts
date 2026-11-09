import type { MetadataRoute } from "next";
import { PERMITIR_INDEXAR } from "@config/prototipo";

/** Mientras sea un prototipo, ningún buscador entra (ver config/prototipo.ts). */
export default function robots(): MetadataRoute.Robots {
  return { rules: PERMITIR_INDEXAR ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" } };
}
