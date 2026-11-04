import type mensajes from "../messages/es.json";

// Claves de traducción comprobadas por TypeScript: una clave que no existe en es.json no compila.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof mensajes;
  }
}
