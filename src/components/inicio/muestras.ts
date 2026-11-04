/**
 * Datos de las cartas de ejemplo de la web (portada, «Cómo se juega», muestrario interno), junto
 * a sus frases (mensajes inicio.muestras). Sin React, para poder usarlos en la escena de la mesa
 * y en los tests; las cartas las dibuja CartaDeMuestra (src/components/carta/Muestra.tsx).
 */
import type { FechaCarta } from "@/domain/fechas/fecha";

export interface CartaMuestra {
  /** Foto a tamaño completo (unos 1000 × 1400 px). */
  foto: string;
  /** La misma foto ligera, para cartas pequeñas (abanico, ejemplos de fechas, mesa). */
  mini?: string;
  fecha: FechaCarta | null;
  descripcion?: string;
  descripcionEnAnverso?: boolean;
  icono?: string | null;
  /** Sin estilo ni paleta, los de por defecto. */
  estiloId?: string;
  paletaId?: string;
}

/** Rutas de una muestra: public/muestras/<clave>.jpg y su versión ligera en mini/. */
export function fotosMuestra(clave: string): Pick<CartaMuestra, "foto" | "mini"> {
  return { foto: `/muestras/${clave}.jpg`, mini: `/muestras/mini/${clave}.jpg` };
}

/**
 * Cartas de ejemplo de la web. Las fotos son de Pexels (las prepara scripts/muestras/preparar.ts;
 * créditos en public/muestras/creditos.json) y los recuerdos, inventados: son de «Ana y Leo», nunca
 * de las personas de las fotos, que no tienen nada que ver con el producto. La frase de cada una
 * está en los mensajes (inicio.muestras.<clave>); úsalas con `useMuestra`. Cada una lleva su
 * paleta, para enseñar las seis; en la mesa de «Cómo se juega» todas van con la misma, como un mazo.
 */
export const MUESTRAS = {
  cita: { ...fotosMuestra("cita"), fecha: { anio: 2015, mes: 11, dia: 7 }, paletaId: "rojo" },
  tren: { ...fotosMuestra("tren"), fecha: { anio: 2016, mes: 7, dia: 12 }, paletaId: "amarillo" },
  picnic: { ...fotosMuestra("picnic"), fecha: { anio: 2017 }, paletaId: "amarillo" },
  playa: { ...fotosMuestra("playa"), fecha: { anio: 2017, mes: 8, dia: 19 }, descripcionEnAnverso: true, paletaId: "rosa" },
  montana: { ...fotosMuestra("montana"), fecha: { anio: 2018, mes: 10 }, paletaId: "verde" },
  furgoneta: { ...fotosMuestra("furgoneta"), fecha: { anio: 2019, mes: 8 }, paletaId: "cobalto" },
  acampada: { ...fotosMuestra("acampada"), fecha: { anio: 2020, mes: 8 }, paletaId: "verde" },
  cumple: { ...fotosMuestra("cumple"), fecha: { anio: 2021, mes: 3, dia: 14 }, paletaId: "rojo" },
  boda: { ...fotosMuestra("boda"), fecha: { anio: 2022, mes: 6, dia: 18 }, paletaId: "rosa", icono: "estrella" },
  nochevieja: { ...fotosMuestra("nochevieja"), fecha: { anio: 2023, mes: 12, dia: 31 }, paletaId: "noche" },
  casa: { ...fotosMuestra("casa"), fecha: { anio: 2024, mes: 4 }, paletaId: "cobalto" },
} satisfies Record<string, CartaMuestra>;

export type ClaveMuestra = keyof typeof MUESTRAS;
