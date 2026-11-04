import { PRINT } from "@config/print";
import { pppEfectivo, recorteCentrado, recorteReversoDesdeAnverso, type Rect } from "@/domain/imagen/recorte";
import { rangoAnios } from "@/domain/mazo/ordenar";
import type { CartaParaValidar } from "@/domain/mazo/validar";
import { asignarIconos, type MecanicaIcono } from "@/domain/mecanicas/asignar";
import type { Catalogo } from "@/domain/precios/tipos";
import { PROPORCION_ANVERSO, proporcionReverso } from "@/lib/carta/dibujar";
import type { Cara, DatosCarta } from "@/lib/carta/tipos";
import { obtenerPlantilla, obtenerEstilo } from "@/lib/estilos";
import type { FotoImportada } from "@/lib/importar/procesar";
import { textoRecuerdos } from "@/lib/carta/textos";
import type { Carta, Mazo } from "./tipos";

const ANCHO_FOTO_MM = PRINT.carta.anchoMm + 2 * PRINT.sangradoMm;

export function proporcionReversoDe(mazo: Pick<Mazo, "estiloId">): number {
  const plantilla = obtenerPlantilla(obtenerEstilo(mazo.estiloId).plantilla);
  return proporcionReverso(plantilla.reverso.altoFoto);
}

export function recortesIniciales(ancho: number, alto: number, propReverso: number): { recorteAnverso: Rect; recorteReverso: Rect } {
  const recorteAnverso = recorteCentrado(ancho, alto, PROPORCION_ANVERSO);
  return { recorteAnverso, recorteReverso: recorteReversoDesdeAnverso(recorteAnverso, propReverso, ancho, alto) };
}

export function cartaDesdeFoto(f: FotoImportada, propReverso: number, ahora: number): Carta {
  return {
    id: f.id,
    nombreArchivo: f.nombreArchivo,
    tipoArchivo: f.tipoArchivo,
    hash: f.hash,
    ancho: f.ancho,
    alto: f.alto,
    anchoOriginal: f.anchoOriginal,
    altoOriginal: f.altoOriginal,
    fecha: f.propuesta?.fecha ?? null,
    fuente: f.propuesta?.fuente ?? null,
    confianza: f.propuesta?.confianza ?? null,
    revisar: f.propuesta?.revisar ?? false,
    motivo: f.propuesta?.motivo,
    descripcion: "",
    descripcionEnAnverso: false,
    ...recortesIniciales(f.ancho, f.alto, propReverso),
    reversoPersonalizado: false,
    destacada: false,
    adornos: [],
    pppConfirmado: false,
    anadidaEn: ahora,
  };
}

/** Resolución efectiva de impresión: la peor de las dos caras. */
export function pppDeCarta(c: Pick<Carta, "recorteAnverso" | "recorteReverso">): number {
  return Math.round(Math.min(pppEfectivo(c.recorteAnverso, ANCHO_FOTO_MM), pppEfectivo(c.recorteReverso, ANCHO_FOTO_MM)));
}

export function paraValidar(c: Carta): CartaParaValidar {
  return {
    id: c.id,
    fecha: c.fecha,
    revisar: c.revisar,
    hash: c.hash,
    descripcion: c.descripcion,
    ppp: pppDeCarta(c),
    pppConfirmado: c.pppConfirmado,
  };
}

export function mecanicasIcono(mazo: Pick<Mazo, "mecanicas">, catalogo: Catalogo): MecanicaIcono[] {
  return catalogo.mecanicas
    .filter((m) => m.activo && m.tipo === "icono" && m.icono && mazo.mecanicas.includes(m.id))
    .map((m) => ({ id: m.id, icono: m.icono!, asignacion: m.asignacion ?? "manual", maxCartas: m.maxCartas, cadaN: m.cadaN }));
}

export function iconosDelMazo(mazo: Pick<Mazo, "mecanicas" | "cartas">, catalogo: Catalogo): Map<string, string> {
  return asignarIconos(
    mazo.cartas.map((c) => ({ id: c.id, destacada: c.destacada })),
    mecanicasIcono(mazo, catalogo),
  );
}

export function maxEstrellas(catalogo: Catalogo): number {
  return catalogo.mecanicas.find((m) => m.id === "estrella")?.maxCartas ?? 5;
}

export function cartaPortada(mazo: Mazo): Carta | null {
  return mazo.cartas.find((c) => c.id === mazo.portadaId) ?? mazo.cartas.find((c) => c.destacada) ?? mazo.cartas[0] ?? null;
}

/** «2012–2026 · 43 recuerdos» en el idioma del mazo. */
export function subtituloPortada(mazo: Mazo): string {
  const rango = rangoAnios(mazo.cartas);
  const n = textoRecuerdos(mazo.cartas.length, mazo.idiomaMazo);
  if (!rango) return n;
  const anios = rango[0] === rango[1] ? String(rango[0]) : `${rango[0]}–${rango[1]}`;
  return `${anios} · ${n}`;
}

export function aniosPortada(mazo: Mazo): string {
  const rango = rangoAnios(mazo.cartas);
  if (!rango) return "";
  return rango[0] === rango[1] ? String(rango[0]) : `${rango[0]}–${rango[1]}`;
}

/** Datos de dibujo de una carta de foto (sin la imagen, que se añade al dibujar). */
export function datosCarta(c: Carta, icono: string | null): Omit<DatosCarta, "foto"> {
  return {
    tipo: "foto",
    fecha: c.fecha,
    descripcion: c.descripcion,
    descripcionEnAnverso: c.descripcionEnAnverso,
    icono,
    adornos: c.adornos,
  };
}

/** Datos de dibujo de la portada y de la caja (sin la imagen), para la vista previa y para imprimir. */
export function datosPortada(mazo: Mazo, tipo: "portada" | "caja", cara: Cara): Omit<DatosCarta, "foto"> {
  return {
    tipo,
    titulo: mazo.titulo,
    subtitulo: cara === "anverso" ? subtituloPortada(mazo) : aniosPortada(mazo),
    dedicatoria: mazo.dedicatoria,
  };
}
