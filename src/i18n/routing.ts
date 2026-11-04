import { defineRouting } from "next-intl/routing";

/**
 * Idiomas de la interfaz. El prototipo activa español e inglés; añadir uno nuevo es
 * crear la carpeta messages/<idioma>, sumarla en messages/index.ts y aquí. El idioma del mazo es independiente.
 */
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "always",
});

export type Idioma = (typeof routing.locales)[number];
