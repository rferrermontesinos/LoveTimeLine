/**
 * Pone al día un mazo guardado en el navegador con una versión anterior del portal, para que
 * quien vuelve otro día siga donde lo dejó. Es puro: no toca el almacén ni el catálogo (lo que
 * depende del catálogo, como extras retirados, lo limpia normalizarSeleccion al abrir el configurador).
 */
import { ESTILO_POR_DEFECTO, obtenerEstilo, obtenerPaleta } from "@/lib/estilos";
import { VERSION_MAZO, type Carta, type Mazo, type Paso } from "./tipos";

/** Packs de la primera versión y su equivalente por tamaño. */
const PACKS_ANTIGUOS: Record<string, string> = { pareja: "pequeno", familia: "mediano" };

const PASOS: readonly Paso[] = [1, 2, 3, 4];

type Registro = Record<string, unknown>;

function esRegistro(v: unknown): v is Registro {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function desdeV1(m: Registro): Registro {
  const { tintaId, ...resto } = m;
  const cartas = Array.isArray(m.cartas) ? m.cartas.filter(esRegistro).map((c) => ({ ...c, tipo: "foto" })) : [];
  const packId = typeof m.packId === "string" ? (PACKS_ANTIGUOS[m.packId] ?? m.packId) : "";
  return { ...resto, version: VERSION_MAZO, packId, paletaId: tintaId, estiloId: ESTILO_POR_DEFECTO.id, caja: null, cartas };
}

/** Devuelve el mazo en la versión actual, o null si no se puede leer. */
export function migrarMazo(guardado: unknown): Mazo | null {
  if (!esRegistro(guardado)) return null;
  let m: Registro = guardado;
  if (m.version === 1) m = desdeV1(m);
  if (m.version !== VERSION_MAZO) return null;
  if (typeof m.id !== "string" || !Array.isArray(m.cartas)) return null;

  const estilo = obtenerEstilo(typeof m.estiloId === "string" ? m.estiloId : null);
  const paleta = obtenerPaleta(estilo, typeof m.paletaId === "string" ? m.paletaId : null);
  const cartas = (m.cartas as unknown[]).filter((c): c is Carta => esRegistro(c) && (c.tipo === "foto" || c.tipo === "texto") && typeof c.id === "string");
  const paso = PASOS.includes(m.paso as Paso) ? (m.paso as Paso) : 1;
  return {
    ...(m as unknown as Mazo),
    estiloId: estilo.id,
    paletaId: paleta.id,
    caja: esRegistro(m.caja) ? (m.caja as unknown as Mazo["caja"]) : null,
    mecanicas: Array.isArray(m.mecanicas) ? m.mecanicas.filter((x): x is string => typeof x === "string") : [],
    extras: Array.isArray(m.extras) ? m.extras.filter((x): x is string => typeof x === "string") : [],
    paso,
    cartas,
  };
}
