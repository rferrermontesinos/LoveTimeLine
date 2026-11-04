/**
 * Interruptores del prototipo. Cada uno se lee solo aquí.
 */

/**
 * Descarga del archivo de impresión en la confirmación del pedido. Activa mientras dure el
 * prototipo: cada socio descarga el PDF de su mazo de prueba para las pruebas de impresión. Para
 * la comercialización se apaga con `NEXT_PUBLIC_DESCARGA_PDF=0`: el archivo lo preparamos y lo
 * revisamos nosotros y el cliente no lo descarga.
 *
 * Es `NEXT_PUBLIC_`: Next la copia en el código del navegador al compilar, así que cambiarla
 * pide volver a compilar (y a desplegar).
 */
export const DESCARGA_PDF = descargaPdfActiva(process.env.NEXT_PUBLIC_DESCARGA_PDF);

/** Activa salvo que la variable diga que no («0» o «false»). Sin variable, activa. */
export function descargaPdfActiva(valor: string | undefined): boolean {
  const v = valor?.trim().toLowerCase();
  return v !== "0" && v !== "false";
}
