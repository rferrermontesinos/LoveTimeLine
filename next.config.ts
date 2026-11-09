import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { PERMITIR_INDEXAR } from "./config/prototipo";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Versión del service worker (public/sw.js), distinta en cada compilación: tras desplegar, el
 * navegador instala el nuevo y borra las copias del anterior. En Vercel, el id del despliegue
 * (variable del sistema); en local, la hora de la compilación.
 */
const VERSION_SW = process.env.VERCEL_DEPLOYMENT_ID || Date.now().toString(36);

const nextConfig: NextConfig = {
  // Permite tener dos servidores de desarrollo a la vez (cada uno con su carpeta).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  // Las fotos nunca pasan por el optimizador de imágenes de Next: se procesan en el navegador.
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_VERSION_SW: VERSION_SW },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Prototipo: ningún buscador lo indexa (ver config/prototipo.ts).
          ...(PERMITIR_INDEXAR ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]),
        ],
      },
      {
        // El service worker siempre fresco: si el navegador lo guardara, tardaría en ver el nuevo.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
