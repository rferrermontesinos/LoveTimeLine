import type { Mensajes } from "../messages";

// Claves de traducción comprobadas por TypeScript: una clave que no existe en messages/es no compila.
declare module "next-intl" {
  interface AppConfig {
    Messages: Mensajes;
  }
}
