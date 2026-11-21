/**
 * El enlace para pedir fotos, del lado de quien hace el mazo: sus llaves, su token y cómo se
 * comparte. Todo se guarda en el almacén del navegador junto al mazo (y se borra con él).
 *
 * La llave privada no se puede exportar: las fotos que lleguen solo se abren en este navegador,
 * que es también donde vive el mazo.
 */
import { URL_COLABORACION } from "@config/colaboracion";
import { aBase64url, clavePublicaCruda, crearLlavesDueno, huella, huellaToken, tokenNuevo } from "@/domain/colaboracion/cifrado";
import { borrarDato, guardarDato, leerDato } from "@/lib/almacen/idb";
import { clienteColaboracion, ErrorServicio, type ClienteColaboracion } from "./api";

export interface EnlaceDueno {
  v: 1;
  mazoId: string;
  /** Id del enlace en el servicio. */
  id: string;
  /** Lo que identifica al dueño ante el servicio (que solo guarda su huella). */
  token: string;
  llaves: CryptoKeyPair;
  /** Huella de la clave pública: va tras «#» en el enlace, que no llega a ningún servidor. */
  huellaClave: string;
  caducaEn: number;
  creadoEn: number;
}

const claveDe = (mazoId: string) => `colaboracion:${mazoId}`;

/** El cliente del servicio, si la web lo tiene configurado. */
export function clienteConfigurado(): ClienteColaboracion | null {
  return URL_COLABORACION ? clienteColaboracion(URL_COLABORACION) : null;
}

export async function leerEnlace(mazoId: string): Promise<EnlaceDueno | null> {
  try {
    const e = await leerDato<EnlaceDueno>(claveDe(mazoId));
    return e && e.v === 1 && e.mazoId === mazoId && e.llaves?.privateKey && typeof e.token === "string" ? e : null;
  } catch {
    return null;
  }
}

/** No se pudo guardar la llave en este navegador (sin almacén, o no admite guardar llaves). */
export class ErrorLlave extends Error {
  constructor() {
    super("No se pudo guardar la llave del enlace");
    this.name = "ErrorLlave";
  }
}

/** Crea el enlace en el servicio y guarda sus llaves. Lanza ErrorServicio o ErrorLlave. */
export async function crearEnlace(cliente: ClienteColaboracion, mazoId: string, ahora: number): Promise<EnlaceDueno> {
  const llaves = await crearLlavesDueno();
  const cruda = await clavePublicaCruda(llaves);
  const token = tokenNuevo();
  const { id, caducaEn } = await cliente.crear(aBase64url(cruda), await huellaToken(token));
  const enlace: EnlaceDueno = { v: 1, mazoId, id, token, llaves, huellaClave: await huella(cruda), caducaEn, creadoEn: ahora };
  try {
    await guardarDato(claveDe(mazoId), enlace);
  } catch {
    // Sin la llave guardada nadie podría abrir lo que llegue: el enlace se cierra al momento.
    await cliente.cerrar(id, token).catch(() => undefined);
    throw new ErrorLlave();
  }
  return enlace;
}

export async function olvidarEnlace(mazoId: string): Promise<void> {
  try {
    await borrarDato(claveDe(mazoId));
  } catch {
    /* sin almacén: nada que olvidar */
  }
}

/** Cierra el enlace en el servicio (si ya no estaba, también vale) y lo olvida aquí. */
export async function cerrarEnlace(cliente: ClienteColaboracion, enlace: EnlaceDueno): Promise<void> {
  try {
    await cliente.cerrar(enlace.id, enlace.token);
  } catch (e) {
    if (!(e instanceof ErrorServicio && (e.estado === 404 || e.estado === 403))) throw e;
  }
  await olvidarEnlace(enlace.mazoId);
}

/**
 * Antes de borrar el mazo: cierra su enlace, si tiene, para que nadie siga mandando fotos que ya no
 * podría abrir nadie. Sin esperar más de `ms`: si no hay red, el enlace caduca solo.
 */
export async function cerrarEnlaceDelMazo(mazoId: string, ms = 3000): Promise<void> {
  const cliente = clienteConfigurado();
  if (!cliente) return;
  const enlace = await leerEnlace(mazoId);
  if (!enlace) return;
  await Promise.race([cerrarEnlace(cliente, enlace).catch(() => undefined), new Promise((ok) => setTimeout(ok, ms))]);
}
