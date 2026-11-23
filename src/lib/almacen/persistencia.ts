/**
 * Almacén persistente: pide al navegador que no borre el mazo y sus fotos cuando le falte
 * espacio (sin registrarse, viven solo en este dispositivo). Chrome y Safari lo conceden o no
 * por su cuenta, sin preguntar; Firefox puede preguntarlo a la persona. Se pide una sola vez por
 * carga de página.
 */
export type ResultadoPersistencia = "persistente" | "no-concedido" | "no-disponible";

type GestorAlmacen = Pick<StorageManager, "persist" | "persisted">;

let pedida: Promise<ResultadoPersistencia> | null = null;

export async function solicitarPersistencia(gestor: Partial<GestorAlmacen> | undefined): Promise<ResultadoPersistencia> {
  if (!gestor?.persist) return "no-disponible";
  try {
    if (gestor.persisted && (await gestor.persisted())) return "persistente";
    return (await gestor.persist()) ? "persistente" : "no-concedido";
  } catch {
    return "no-disponible";
  }
}

/** Lo pide una vez por carga de página (las siguientes llamadas devuelven la misma respuesta). */
export function pedirAlmacenPersistente(): Promise<ResultadoPersistencia> {
  if (!pedida) pedida = solicitarPersistencia(typeof navigator !== "undefined" ? navigator.storage : undefined);
  return pedida;
}
