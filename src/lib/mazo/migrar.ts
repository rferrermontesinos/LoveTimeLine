/**
 * Pone al día un mazo guardado en el navegador con una versión anterior del portal, para que
 * quien vuelve otro día siga donde lo dejó. Es puro: no toca el almacén ni el catálogo (lo que
 * depende del catálogo, como extras retirados, lo limpia normalizarSeleccion al abrir el configurador).
 */
import { conPrecision } from "@/domain/fechas/fecha";
import { origenDeNombre } from "@/domain/fechas/nombre-archivo";
import { anterior, DIAS_PREPARACION, DIAS_PREPARACION_ENVIO, esFechaReciente, puedeSerReciente, type Confianza, type MotivoRevision } from "@/domain/fechas/proponer";
import { idsEnSesionGuardada } from "@/domain/fechas/sesion";
import { ESTILO_POR_DEFECTO, obtenerEstilo, obtenerPaleta } from "@/lib/estilos";
import { POLITICA_FECHAS, VERSION_MAZO, type Carta, type CartaFoto, type Mazo, type Paso, type SugerenciaFecha } from "./tipos";

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
  let cartas = (m.cartas as unknown[]).filter((c): c is Carta => esRegistro(c) && (c.tipo === "foto" || c.tipo === "texto") && typeof c.id === "string");
  if (m.politicaFechas !== POLITICA_FECHAS) {
    try {
      cartas = mejorarFechasGuardadas(cartas);
    } catch {
      // Sin la mejora, el mazo se abre tal cual: nunca se pierde por esto.
    }
  }
  const paso = PASOS.includes(m.paso as Paso) ? (m.paso as Paso) : 1;
  return {
    ...(m as unknown as Mazo),
    estiloId: estilo.id,
    paletaId: paleta.id,
    // El tono de las fotos ya no se elige (20-11-2026): todas salen con su color.
    tono: "original",
    politicaFechas: POLITICA_FECHAS,
    caja: esRegistro(m.caja) ? (m.caja as unknown as Mazo["caja"]) : null,
    mecanicas: Array.isArray(m.mecanicas) ? m.mecanicas.filter((x): x is string => typeof x === "string") : [],
    extras: Array.isArray(m.extras) ? m.extras.filter((x): x is string => typeof x === "string") : [],
    paso,
    // Opcional: los mazos guardados antes no la tienen y se abren sin carta abierta.
    cartaAbierta: typeof m.cartaAbierta === "string" || m.cartaAbierta === null ? m.cartaAbierta : undefined,
    cajaBajaConfirmada: typeof m.cajaBajaConfirmada === "string" ? m.cajaBajaConfirmada : undefined,
    cartas,
  };
}

/**
 * Revisa una vez, con las reglas de fechas actuales (POLITICA_FECHAS), las cartas con foto de un
 * mazo guardado antes. Las fechas de la foto ya no están (no se guardan), así que se decide con lo
 * que se guardó: la sugerencia, su motivo, el nombre del archivo y el día en que se añadió la carta,
 * desde el que se cuentan los días de preparación. Nunca toca una fecha puesta a mano ni una
 * sugerencia aceptada, ni las cartas de texto, ni borra nada:
 * - las que se quedaron en blanco con una fecha sugerida que ahora se pondría sola (la de la
 *   cámara, fuera de los días de preparar el mazo) pasan a tenerla;
 * - el mes de un envío por mensajería o de una captura ya no se pone solo: las que lo tenían
 *   puesto solo vuelven a quedar en blanco, con ese mes como sugerencia de un toque.
 */
export function mejorarFechasGuardadas(cartas: Carta[]): Carta[] {
  const enSesion = idsEnSesionGuardada(cartas.filter((c) => c.tipo === "foto"));
  return cartas.map((c): Carta => {
    if (c.tipo === "foto" && esMesPuestoSolo(c)) return mesComoSugerencia(c);
    const s0 = c.sugerencias?.[0];
    if (c.tipo !== "foto" || c.fecha || c.fuente === "manual" || !s0 || !Number.isFinite(c.anadidaEn)) return c;
    const subida = new Date(c.anadidaEn);
    const motivo = s0.motivo ?? c.motivo;
    const poner = (s: SugerenciaFecha, confianza: Confianza): Carta => ({
      ...c,
      fecha: s.fecha,
      fuente: s.fuente,
      confianza,
      revisar: false,
      motivo: undefined,
      sugerencias: [],
    });
    const deEstosDias = (s: SugerenciaFecha) => esFechaReciente(s.fecha, subida, DIAS_PREPARACION);
    switch (motivo) {
      case "fecha-reciente":
        if (enSesion.has(c.id)) return { ...c, motivo: "sesion-de-escaneo" };
        return deEstosDias(s0) ? c : poner(s0, "media");
      case "digitalizada-despues":
      case "fecha-anotada":
      case "sin-datos-de-camara":
      case "fecha-digitalizacion":
        return deEstosDias(s0) ? c : poner(s0, "media");
      case "exif-y-nombre-no-coinciden": {
        // Primero iba la escrita en el nombre; ahora solo gana a la de la cámara si es anterior.
        // Ojo si se sube POLITICA_FECHAS: desde la política 3 este motivo también es el de un año
        // pegado a otras letras frente a una cámara («AnaLeo_1987», con la de la cámara primero), que
        // debe seguir en blanco. Esas cartas no pasan por aquí mientras la política no cambie.
        const s1 = c.sugerencias?.[1];
        const elegida = s0.fuente === "nombre" && s1 && !anterior(s0.fecha, s1.fecha) ? s1 : s0;
        return deEstosDias(elegida) ? c : poner(elegida, "media");
      }
      case "fecha-de-envio":
      case "captura-de-pantalla": {
        // Un reenvío del último mes perdió la fecha de la foto: la suya no sirve ni de pista. Uno
        // más antiguo deja su mes como sugerencia, porque la foto puede ser de antes.
        if (puedeSerReciente(s0.fecha, subida, DIAS_PREPARACION_ENVIO)) return { ...c, motivo, sugerencias: [] };
        const mes: MotivoRevision = motivo === "fecha-de-envio" ? "mes-de-envio" : "mes-de-captura";
        return { ...c, motivo: mes, sugerencias: [{ ...s0, fecha: conPrecision(s0.fecha, "mes"), motivo: mes }] };
      }
      default:
        return c;
    }
  });
}

/**
 * Fecha aproximada puesta sola con las reglas del 20 de noviembre de 2026 por la mañana: el mes de
 * un envío por mensajería o de una captura, del nombre del archivo y con confianza baja. Las puestas
 * a mano y las sugerencias aceptadas llevan otra fuente o confianza alta.
 */
function esMesPuestoSolo(c: CartaFoto): boolean {
  return !!c.fecha && c.fuente === "nombre" && c.confianza === "baja";
}

/** La carta vuelve a quedar en blanco, con su mes como sugerencia. */
function mesComoSugerencia(c: CartaFoto): CartaFoto {
  const fecha = conPrecision(c.fecha!, "mes");
  const motivo: MotivoRevision = origenDeNombre(c.nombreArchivo) === "captura" ? "mes-de-captura" : "mes-de-envio";
  return { ...c, fecha: null, fuente: null, confianza: null, revisar: false, motivo, sugerencias: [{ fecha, fuente: "nombre", motivo }] };
}
