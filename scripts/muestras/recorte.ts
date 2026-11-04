/**
 * Encuadre de las fotos de muestra: el recorte con la proporción de la carta que se saca de
 * cada original antes de reducirlo. Lógica pura (sin sharp) para poder probarla.
 */
import { encajar, recorteCentrado } from "../../src/domain/imagen/recorte";

export interface EncuadreMuestra {
  /** Centro del recorte sobre el original, de 0 (izquierda) a 1 (derecha). Por defecto, 0,5. */
  centroX?: number;
  /** Centro del recorte sobre el original, de 0 (arriba) a 1 (abajo). Por defecto, 0,5. */
  centroY?: number;
  /**
   * Acercamiento sobre el recorte más grande posible: 1 es el mayor que cabe; 1,25, uno un 20 %
   * más pequeño. Sirve para subir las caras en fotos donde quedan muy abajo.
   */
  zoom?: number;
}

/** Rectángulo en píxeles enteros, como lo pide sharp (`extract`). */
export interface Caja {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Recorte con la proporción pedida (ancho/alto), centrado donde dice el encuadre y siempre
 * dentro de la imagen: si el centro pedido lo sacaría por un borde, se arrima a ese borde.
 */
export function recorteMuestra(ancho: number, alto: number, proporcion: number, encuadre: EncuadreMuestra = {}): Caja {
  if (!(ancho > 0 && alto > 0 && proporcion > 0)) throw new Error(`Medidas no válidas: ${ancho} × ${alto}, proporción ${proporcion}`);
  const zoom = Math.max(1, encuadre.zoom ?? 1);
  const mayor = recorteCentrado(ancho, alto, proporcion);
  const w = mayor.ancho / zoom;
  const h = mayor.alto / zoom;
  const cx = limitar01(encuadre.centroX ?? 0.5) * ancho;
  const cy = limitar01(encuadre.centroY ?? 0.5) * alto;
  const r = encajar({ x: cx - w / 2, y: cy - h / 2, ancho: w, alto: h }, ancho, alto);
  // Enteros sin salirse: el tamaño se redondea hacia abajo y el recorte entero se centra en el
  // exacto, así que uno arrimado a un borde sigue tocándolo.
  const width = Math.max(1, Math.floor(r.ancho));
  const height = Math.max(1, Math.floor(r.alto));
  const left = Math.min(Math.max(0, Math.round(r.x + (r.ancho - width) / 2)), ancho - width);
  const top = Math.min(Math.max(0, Math.round(r.y + (r.alto - height) / 2)), alto - height);
  return { left, top, width, height };
}

/** Tamaño final de una muestra con la proporción pedida y el alto dado. */
export function medidasSalida(proporcion: number, alto: number): { ancho: number; alto: number } {
  return { ancho: Math.round(alto * proporcion), alto };
}

function limitar01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
}
