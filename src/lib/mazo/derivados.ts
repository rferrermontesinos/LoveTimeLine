import { PRINT } from "@config/print";
import { pppEfectivo, recorteCentrado, recorteReversoDesdeAnverso, type Rect } from "@/domain/imagen/recorte";
import { rangoAnios } from "@/domain/mazo/ordenar";
import type { CartaParaValidar } from "@/domain/mazo/validar";
import { asignarIconos, type MecanicaIcono } from "@/domain/mecanicas/asignar";
import type { Catalogo, Extra } from "@/domain/precios/tipos";
import { PROPORCION_ANVERSO, proporcionReverso } from "@/lib/carta/dibujar";
import type { Cara, DatosCarta, VarianteCaja } from "@/lib/carta/tipos";
import { obtenerPlantilla, obtenerEstilo } from "@/lib/estilos";
import type { FotoImportada } from "@/lib/importar/procesar";
import { textoRecuerdos } from "@/lib/carta/textos";
import { esFoto, type Carta, type CartaFoto, type CartaTexto, type FotoCaja, type Mazo } from "./tipos";
import type { FechaCarta } from "@/domain/fechas/fecha";

const ANCHO_FOTO_MM = PRINT.carta.anchoMm + 2 * PRINT.sangradoMm;

export function proporcionReversoDe(mazo: Pick<Mazo, "estiloId">): number {
  const plantilla = obtenerPlantilla(obtenerEstilo(mazo.estiloId).plantilla);
  return proporcionReverso(plantilla.reverso.altoFoto);
}

export function recortesIniciales(ancho: number, alto: number, propReverso: number): { recorteAnverso: Rect; recorteReverso: Rect } {
  const recorteAnverso = recorteCentrado(ancho, alto, PROPORCION_ANVERSO);
  return { recorteAnverso, recorteReverso: recorteReversoDesdeAnverso(recorteAnverso, propReverso, ancho, alto) };
}

/**
 * Carta nueva a partir de una foto importada. La fecha solo viene puesta si era segura; si no,
 * queda en blanco con sus sugerencias y el motivo. De los metadatos solo se guarda el resultado.
 */
export function cartaDesdeFoto(f: FotoImportada, propReverso: number, ahora: number): CartaFoto {
  const { automatica, sugerencias, motivo } = f.propuesta;
  return {
    tipo: "foto",
    id: f.id,
    nombreArchivo: f.nombreArchivo,
    tipoArchivo: f.tipoArchivo,
    hash: f.hash,
    ancho: f.ancho,
    alto: f.alto,
    anchoOriginal: f.anchoOriginal,
    altoOriginal: f.altoOriginal,
    fecha: automatica?.fecha ?? null,
    fuente: automatica?.fuente ?? null,
    confianza: automatica?.confianza ?? null,
    revisar: false,
    motivo: automatica ? undefined : motivo,
    sugerencias: automatica ? [] : sugerencias.map(({ fecha, fuente, motivo: m }) => ({ fecha, fuente, motivo: m })),
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

/** Recuerdo sin foto: fecha y texto con el estilo del mazo. Se cobra como una carta con foto. */
export function nuevaCartaTexto(id: string, descripcion: string, fecha: FechaCarta | null, ahora: number): CartaTexto {
  return {
    tipo: "texto",
    id,
    fecha,
    fuente: fecha ? "manual" : null,
    confianza: fecha ? "alta" : null,
    revisar: false,
    descripcion,
    destacada: false,
    anadidaEn: ahora,
  };
}

/** Ids con foto guardada en el navegador: las cartas con foto y la foto propia de la caja. */
export function fotosVivas(mazo: Pick<Mazo, "cartas" | "caja">): Set<string> {
  const ids = new Set(mazo.cartas.filter(esFoto).map((c) => c.id));
  if (mazo.caja?.origen === "propia") ids.add(mazo.caja.id);
  return ids;
}

/**
 * Fotos sueltas al abrir el configurador: de las que había en el dispositivo al abrirlo, las que
 * no usa ninguno de estos mazos (el guardado y el de ahora). Sin mazo, todas: una importación
 * cortada antes de guardar el primer mazo no deja fotos personales sin forma de borrarlas. Solo
 * mira las de antes de abrir: una foto recién guardada cuya carta aún no ha entrado en el mazo
 * nunca está en la lista.
 */
export function fotosSueltas(alAbrir: Iterable<string>, ...mazos: (Pick<Mazo, "cartas" | "caja"> | null)[]): string[] {
  const vivas = new Set(mazos.flatMap((m) => (m ? [...fotosVivas(m)] : [])));
  return [...alAbrir].filter((id) => !vivas.has(id));
}

/** Resolución efectiva de impresión: la peor de las dos caras. */
export function pppDeCarta(c: Pick<CartaFoto, "recorteAnverso" | "recorteReverso">): number {
  return Math.round(Math.min(pppEfectivo(c.recorteAnverso, ANCHO_FOTO_MM), pppEfectivo(c.recorteReverso, ANCHO_FOTO_MM)));
}

export function paraValidar(c: Carta): CartaParaValidar {
  const foto = esFoto(c);
  return {
    id: c.id,
    tipo: c.tipo,
    fecha: c.fecha,
    revisar: c.revisar,
    hash: foto ? c.hash : null,
    descripcion: c.descripcion,
    ppp: foto ? pppDeCarta(c) : null,
    pppConfirmado: foto ? c.pppConfirmado : true,
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

/** Foto de la portada: la elegida, si no la primera estrella con foto, si no la primera con foto. */
export function cartaPortada(mazo: Pick<Mazo, "cartas" | "portadaId">): CartaFoto | null {
  const fotos = mazo.cartas.filter(esFoto);
  return fotos.find((c) => c.id === mazo.portadaId) ?? fotos.find((c) => c.destacada) ?? fotos[0] ?? null;
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

/** Datos de dibujo de una carta de recuerdo (sin la imagen, que se añade al dibujar). */
export function datosCarta(c: Carta, icono: string | null): Omit<DatosCarta, "foto"> {
  if (c.tipo === "texto") return { tipo: "texto", fecha: c.fecha, texto: c.descripcion, icono };
  return {
    tipo: "foto",
    fecha: c.fecha,
    descripcion: c.descripcion,
    descripcionEnAnverso: c.descripcionEnAnverso,
    icono,
    adornos: c.adornos,
  };
}

/** Datos de dibujo de la portada (sin la imagen), para la vista previa y para imprimir. */
export function datosPortada(mazo: Mazo, cara: Cara): Omit<DatosCarta, "foto"> {
  return {
    tipo: "portada",
    titulo: mazo.titulo,
    subtitulo: cara === "anverso" ? subtituloPortada(mazo) : aniosPortada(mazo),
    dedicatoria: mazo.dedicatoria,
  };
}

/** Extra de la caja personalizada: se busca por su efecto en el catálogo, nunca por su id. */
export function extraCajaPersonalizada(catalogo: Pick<Catalogo, "extras">): Extra | null {
  return catalogo.extras.find((x) => x.activo && x.efecto === "caja-personalizada") ?? null;
}

/** ¿Lleva el mazo la caja personalizada (extra de pago)? Si no, va en la caja de siempre. */
export function esCajaPersonalizada(mazo: Pick<Mazo, "extras">, catalogo: Pick<Catalogo, "extras">): boolean {
  const extra = extraCajaPersonalizada(catalogo);
  return !!extra && mazo.extras.includes(extra.id);
}

export function varianteCaja(mazo: Pick<Mazo, "extras">, catalogo: Pick<Catalogo, "extras">): VarianteCaja {
  return esCajaPersonalizada(mazo, catalogo) ? "personalizada" : "generica";
}

/** Foto de la caja personalizada: lo que hace falta para dibujarla y para imprimirla. */
export interface FotoDeCaja {
  /** Id de la foto en el almacén del navegador (una carta o la foto propia de la caja). */
  id: string;
  /** Ancho de la copia de trabajo, en la que está medido el recorte. */
  ancho: number;
  /** Recorte de la foto para la cara de la caja. */
  recorte: Rect;
}

/**
 * Foto de la caja personalizada: la foto propia de la caja, la carta elegida o, si no hay
 * ninguna (o la carta ya no está o no tiene foto), la de la portada. De una carta se usa el
 * recorte del reverso, que es el más parecido a la cara de la caja.
 */
export function fotoCaja(mazo: Pick<Mazo, "cartas" | "portadaId" | "caja">): FotoDeCaja | null {
  const caja = mazo.caja;
  if (caja?.origen === "propia") return { id: caja.id, ancho: caja.ancho, recorte: caja.recorte };
  const elegida = caja?.origen === "carta" ? mazo.cartas.filter(esFoto).find((c) => c.id === caja.cartaId) : undefined;
  const carta = elegida ?? cartaPortada(mazo);
  return carta ? { id: carta.id, ancho: carta.ancho, recorte: carta.recorteReverso } : null;
}

/**
 * Proporción (ancho / alto) de la foto en la cara de la caja personalizada: la misma que en la
 * portada, a todo el ancho con sangrado y hasta la banda del título.
 */
export function proporcionCaja(mazo: Pick<Mazo, "estiloId">): number {
  const plantilla = obtenerPlantilla(obtenerEstilo(mazo.estiloId).plantilla);
  return proporcionReverso(PRINT.carta.altoMm - plantilla.portada.banda);
}

/**
 * Resolución con la que se imprimiría la foto de la caja. Al dibujarla, el recorte se ajusta a la
 * proporción de la cara recortando por el centro: si es más ancho, se pierde ancho.
 */
export function pppFotoCaja(foto: Pick<FotoDeCaja, "recorte">, proporcion: number): number {
  const r = foto.recorte;
  return Math.round(pppEfectivo({ ...r, ancho: Math.min(r.ancho, r.alto * proporcion) }, ANCHO_FOTO_MM));
}

/**
 * Foto propia para la caja (una foto que no es carta), con el recorte inicial centrado a la
 * proporción de la cara de la caja. De la foto solo se guardan sus datos, no los metadatos.
 */
export function cajaPropia(
  f: Pick<FotoImportada, "id" | "nombreArchivo" | "tipoArchivo" | "hash" | "ancho" | "alto" | "anchoOriginal" | "altoOriginal">,
  proporcion: number,
): Extract<FotoCaja, { origen: "propia" }> {
  return {
    origen: "propia",
    id: f.id,
    nombreArchivo: f.nombreArchivo,
    tipoArchivo: f.tipoArchivo,
    hash: f.hash,
    ancho: f.ancho,
    alto: f.alto,
    anchoOriginal: f.anchoOriginal,
    altoOriginal: f.altoOriginal,
    recorte: recorteCentrado(f.ancho, f.alto, proporcion),
  };
}

/**
 * Datos de dibujo de una cara de la caja (sin la imagen). La variante va explícita: una foto
 * nula también es una foto que aún está cargando. La caja de siempre no lleva nada del mazo.
 */
export function datosCaja(mazo: Mazo, cara: Cara, variante: VarianteCaja): Omit<DatosCarta, "foto"> {
  if (variante === "generica") return { tipo: "caja", variante };
  return {
    tipo: "caja",
    variante,
    titulo: mazo.titulo,
    subtitulo: cara === "anverso" ? subtituloPortada(mazo) : aniosPortada(mazo),
  };
}
