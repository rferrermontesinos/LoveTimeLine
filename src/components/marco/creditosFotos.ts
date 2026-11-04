/**
 * Créditos de las fotos de muestra de la web (cartas de ejemplo y mesa de «Cómo se juega»), tal
 * como los publica scripts/muestras/preparar.ts en public/muestras/creditos.json. Los enseñan el
 * pie y la página de privacidad.
 */
import datos from "../../../public/muestras/creditos.json";

export interface CreditoFoto {
  id: string;
  /** Rutas públicas de los archivos que salen de esta foto. */
  archivos: string[];
  fotografo: string;
  /** Página de la foto en el banco de imágenes. */
  pagina: string;
  /** Qué se ve en la foto, por idioma (no es el recuerdo inventado de la carta). */
  descripcion: Record<string, string>;
}

export interface CreditosFotos {
  fuente: string;
  licencia: { nombre: string; url: string };
  fotos: CreditoFoto[];
}

export const CREDITOS_FOTOS: CreditosFotos = datos;
