/**
 * Pone al día un mazo guardado en el navegador con una versión anterior del portal, para que
 * quien vuelve otro día siga donde lo dejó. Es puro: no toca el almacén ni el catálogo (lo que
 * depende del catálogo, como extras retirados, lo limpia normalizarSeleccion al abrir el configurador).
 */
import { conPrecision } from "@/domain/fechas/fecha";
import { anterior, DIAS_PREPARACION, DIAS_PREPARACION_ENVIO, esFechaReciente, puedeSerReciente, type Confianza } from "@/domain/fechas/proponer";
import { idsEnSesionGuardada } from "@/domain/fechas/sesion";
import { ESTILO_POR_DEFECTO, obtenerEstilo, obtenerPaleta } from "@/lib/estilos";
import { POLITICA_FECHAS, VERSION_MAZO, type Carta, type Mazo, type Paso, type SugerenciaFecha } from "./tipos";

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
    cartas,
  };
}

/**
 * Revisa una vez, con las reglas de fechas del 20 de noviembre de 2026, las cartas de un mazo
 * guardado antes: las que se quedaron en blanco con una fecha sugerida que ahora se pondría sola
 * pasan a tenerla. Las fechas de la foto ya no están (no se guardan), así que se decide con lo que
 * se guardó: la sugerencia, su motivo y el día en que se añadió la carta, desde el que se cuentan
 * los días de preparación. No toca las cartas que ya tienen fecha, ni las de texto, ni borra nada.
 */
export function mejorarFechasGuardadas(cartas: Carta[]): Carta[] {
  const enSesion = idsEnSesionGuardada(cartas.filter((c) => c.tipo === "foto"));
  return cartas.map((c): Carta => {
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
        const s1 = c.sugerencias?.[1];
        const elegida = s0.fuente === "nombre" && s1 && !anterior(s0.fecha, s1.fecha) ? s1 : s0;
        return deEstosDias(elegida) ? c : poner(elegida, "media");
      }
      case "fecha-de-envio":
      case "captura-de-pantalla":
        // Un reenvío del último mes perdió la fecha de la foto: la suya no sirve ni de pista.
        if (puedeSerReciente(s0.fecha, subida, DIAS_PREPARACION_ENVIO)) return { ...c, motivo, sugerencias: [] };
        return poner({ ...s0, fecha: conPrecision(s0.fecha, "mes") }, "baja");
      default:
        return c;
    }
  });
}
