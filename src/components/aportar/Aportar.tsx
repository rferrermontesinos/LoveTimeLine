"use client";

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { URL_COLABORACION } from "@config/colaboracion";
import { PROPORCION_CARTA } from "@config/print";
import { Boton } from "@/components/ui/Boton";
import { Aviso, Franja, Micro } from "@/components/ui/Piezas";
import { reservarAbajo } from "@/components/ui/reservaAbajo";
import { MAX_AUTOR } from "@/domain/colaboracion/aportacion";
import { idAleatorio } from "@/domain/colaboracion/cifrado";
import { cambiarBorrador, estadoBorrador, type BorradorFecha } from "@/domain/fechas/borrador";
import { aSugerencia, estadoInicial, puestaAMano, type EstadoFecha } from "@/domain/fechas/estado";
import type { FechaCarta } from "@/domain/fechas/fecha";
import { crearDetectorSesion, propuestaDeSesion } from "@/domain/fechas/sesion";
import { MAX_DESCRIPCION } from "@/domain/mazo/limites";
import { clienteColaboracion, ErrorServicio } from "@/lib/colaboracion/api";
import { huellaDelEnlace } from "@/lib/colaboracion/enlace";
import { claveComprobada, prepararAportacion, type ExtraAportacion } from "@/lib/colaboracion/enviar";
import { archivosDeArrastre, enCola, esImagenCompatible, procesarArchivo, type FotoImportada } from "@/lib/importar/procesar";

type Apertura =
  | { tipo: "cargando" }
  | { tipo: "error"; motivo: "noExiste" | "caducado" | "incompleto" | "sinRed" }
  | { tipo: "listo"; clave: Uint8Array<ArrayBuffer> };

/** Una foto elegida y preparada en el móvil, aún sin mandar, con la fecha y la frase que llevará. */
interface Pendiente extends EstadoFecha {
  foto: FotoImportada;
  /** Su miniatura en la lista (se libera al quitarla o al mandarla). */
  url: string;
  /** El año tal como está escrito en su carta (el de su fecha, o lo que se esté tecleando). */
  anio: string;
  /** Quien manda ha cambiado el año: se manda su fecha, aunque sea en blanco. */
  fechaTocada: boolean;
  /** La fecha con la que llegó a la lista (sola, con su mes y su día si los tenía). */
  traida: FechaCarta | null;
  frase: string;
}

/** Lo que no ha entrado en la lista la última vez que se eligieron fotos. */
interface Descartes {
  repetidas: number;
  noImagen: number;
  /** No se han podido abrir (archivo dañado o un formato que este navegador no lee). */
  noLeidas: number;
}

interface Resultado {
  enviadas: number;
  /** Las que no han salido: siguen en la lista para volver a probar. */
  fallidas: number;
  /** El enlace ha dicho que no admite más por ahora. */
  lleno: boolean;
}

const ACEPTA = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
/** Fotos que se preparan y mandan a la vez: pocas, que en el móvil cada una ocupa mucha memoria. */
const A_LA_VEZ = 2;

/** Lleva archivos (no texto ni enlaces arrastrados desde la propia página). */
const conArchivos = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
/** Por nombre: las de cámara, en el orden en que se hicieron (como al subirlas al mazo). */
const porNombre = (a: File, b: File) => a.name.localeCompare(b.name, undefined, { numeric: true });
/** Se cuenta como en Cartas: por caracteres, un emoji es uno. */
const caracteres = (frase: string) => [...frase].length;
/** El año escrito en una carta, como borrador de una fecha de solo año. */
const borradorAnio = (anio: string): BorradorFecha => ({ precision: "anio", dia: "", mes: "", anio });
/** Una fecha puesta sola que resulta ser de una sesión de fotos de fotos: su carta queda sin año. */
const deSesion = (p: Pendiente): Pendiente => {
  const s = aSugerencia(p, "sesion-de-escaneo");
  return s === p ? p : { ...s, anio: "", traida: null };
};

/**
 * La página que abre quien recibe el enlace: comprueba que la clave es la del dueño del mazo (la
 * huella va tras «#») y prepara las fotos en su propio móvil. Antes de mandarlas, las ve como
 * cartas y, si quiere, les pone el año y una frase (opción A, 22-11-2026). Sencilla a propósito
 * (Ricard: «no pongas muchas opciones… ni más textos»): sin elegir precisión ni explicaciones; las
 * sugerencias de fecha las ve luego quien hace el mazo. Las fotos de una visita se miran juntas,
 * como al añadirlas al mazo, para reconocer una sesión de fotos de fotos. Todo sale cifrado.
 * Pendiente de Marc.
 */
export function Aportar({ id }: { id: string }) {
  const t = useTranslations("colaboracion.aportar");
  const tf = useTranslations("fotos");
  const ids = useId();
  const cliente = useMemo(() => (URL_COLABORACION ? clienteColaboracion(URL_COLABORACION) : null), []);
  const [apertura, setApertura] = useState<Apertura>({ tipo: "cargando" });
  const [nombre, setNombre] = useState("");
  const [consentido, setConsentido] = useState(false);
  const [faltaPermiso, setFaltaPermiso] = useState(false);
  const [hoy] = useState(() => new Date());
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [preparando, setPreparando] = useState<{ hechas: number; total: number } | null>(null);
  const [descartes, setDescartes] = useState<Descartes | null>(null);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [avisarLargas, setAvisarLargas] = useState(false);
  const [encima, setEncima] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const casilla = useRef<HTMLInputElement>(null);
  const botonElegir = useRef<HTMLButtonElement>(null);
  const tituloLista = useRef<HTMLHeadingElement>(null);
  /** Las fotos mandadas en esta visita forman un lote: así se reconoce una sesión de fotos de fotos. */
  const lote = useRef<string | null>(null);
  const sesion = useRef<ReturnType<typeof crearDetectorSesion> | null>(null);
  /** Huellas de lo elegido o mandado en esta visita, para no mandar dos veces la misma foto. */
  const vistas = useRef(new Set<string>());
  /** Miniaturas por liberar, por id de foto. */
  const urls = useRef(new Map<string, string>());
  /** Se está preparando o mandando: no se empieza otra cosa (aunque el estado aún no lo diga). */
  const enMarcha = useRef(false);

  // Abrir el enlace: la clave del servicio tiene que ser la de la huella del enlace.
  useEffect(() => {
    let vivo = true;
    const fin = (a: Apertura) => {
      if (vivo) setApertura(a);
    };
    void (async () => {
      const huella = huellaDelEnlace(window.location.hash);
      if (!cliente || !huella) return fin({ tipo: "error", motivo: "incompleto" });
      try {
        const info = await cliente.info(id);
        const clave = await claveComprobada(info.clavePublica, huella);
        fin(clave ? { tipo: "listo", clave } : { tipo: "error", motivo: "incompleto" });
      } catch (e) {
        const estado = e instanceof ErrorServicio ? e.estado : 0;
        fin({ tipo: "error", motivo: estado === 404 ? "noExiste" : estado === 410 ? "caducado" : "sinRed" });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cliente, id]);

  // Lo que se añade (las cartas, el progreso) aparece donde se está mirando: sin el anclaje del
  // desplazamiento, el navegador lo dejaría por encima de la pantalla si se eligió desde más abajo.
  // (Chrome lo lee del body, no solo de html.)
  useEffect(() => {
    const elementos = [document.documentElement, document.body];
    const antes = elementos.map((e) => e.style.overflowAnchor);
    for (const e of elementos) e.style.overflowAnchor = "none";
    return () => elementos.forEach((e, i) => (e.style.overflowAnchor = antes[i]!));
  }, []);

  // Al dejar la página se liberan las miniaturas.
  useEffect(() => {
    const mapa = urls.current;
    return () => {
      for (const url of mapa.values()) URL.revokeObjectURL(url);
      mapa.clear();
    };
  }, []);

  // Mientras se preparan o se mandan fotos, o quedan fotos sin mandar, avisar antes de cerrar la página.
  const mandando = progreso !== null;
  const ocupado = mandando || preparando !== null;
  const porMandar = pendientes.length > 0;
  useEffect(() => {
    if (!ocupado && !porMandar) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [ocupado, porMandar]);

  const listo = apertura.tipo === "listo" ? apertura : null;
  const largas = pendientes.filter((p) => caracteres(p.frase) > MAX_DESCRIPCION);
  const idFrase = (fotoId: string) => `${ids}-frase-${fotoId}`;

  /** Sin el permiso no se elige ni se manda nada: se resalta la casilla. */
  const pedirPermiso = () => {
    setFaltaPermiso(true);
    casilla.current?.focus();
    casilla.current?.scrollIntoView({ block: "center" });
  };

  const liberar = (fotoId: string) => {
    const url = urls.current.get(fotoId);
    if (url) URL.revokeObjectURL(url);
    urls.current.delete(fotoId);
  };

  /** Pone en la lista una foto recién preparada, con la fecha que trae o en blanco con sus sugerencias. */
  const anadir = (foto: FotoImportada) => {
    sesion.current ??= crearDetectorSesion(hoy);
    // Al llegar al mínimo de una sesión de fotos de fotos, también las de antes de ese día pasan a sugerencia.
    const { enBlanco, anteriores } = sesion.current.registrar(foto.id, foto.propuesta);
    const inicial = estadoInicial(foto.propuesta);
    const url = URL.createObjectURL(foto.mini);
    urls.current.set(foto.id, url);
    const fecha = enBlanco ? aSugerencia(inicial, "sesion-de-escaneo") : inicial;
    const nueva: Pendiente = { ...fecha, foto, url, anio: fecha.fecha ? String(fecha.fecha.anio) : "", fechaTocada: false, traida: fecha.fecha, frase: "" };
    const antes = new Set(anteriores);
    setPendientes((ps) => [...ps.map((p) => (antes.has(p.foto.id) && !p.fechaTocada ? deSesion(p) : p)), nueva]);
  };

  /** Prepara las fotos elegidas en el móvil (fecha, copia y miniatura) y las pone en la lista. */
  const preparar = async (archivos: File[]) => {
    if (!listo || enMarcha.current || archivos.length === 0) return;
    if (!consentido) return pedirPermiso();
    enMarcha.current = true;
    lote.current ??= idAleatorio(12);
    const imagenes = archivos.filter(esImagenCompatible).sort(porNombre);
    const d: Descartes = { repetidas: 0, noImagen: archivos.length - imagenes.length, noLeidas: 0 };
    let hechas = 0;
    let anadidas = 0;
    const habia = pendientes.length;
    setResultado(null);
    setDescartes(null);
    setPreparando({ hechas: 0, total: imagenes.length });
    try {
      await enCola(
        imagenes,
        A_LA_VEZ,
        async (archivo) => {
          const foto = await procesarArchivo(archivo, hoy);
          if (vistas.current.has(foto.hash)) return null;
          vistas.current.add(foto.hash);
          return foto;
        },
        (res) => {
          hechas++;
          if (!res.ok) {
            d.noLeidas++;
            console.warn("No se pudo preparar una foto", res.error);
          } else if (res.valor) {
            anadir(res.valor);
            anadidas++;
          } else d.repetidas++;
          setPreparando({ hechas, total: imagenes.length });
        },
      );
    } finally {
      enMarcha.current = false;
      setPreparando(null);
    }
    if (d.repetidas || d.noImagen || d.noLeidas) setDescartes(d);
    // La lista recién aparecida se anuncia: si nadie ha llevado el foco a otra parte, va a su título.
    const foco = document.activeElement;
    if (anadidas > 0 && habia === 0 && (!foco || foco === document.body || foco === botonElegir.current || foco === entrada.current)) {
      requestAnimationFrame(() => tituloLista.current?.focus());
    }
  };

  const cambiar = (fotoId: string, cambio: (p: Pendiente) => Pendiente) => setPendientes((ps) => ps.map((p) => (p.foto.id === fotoId ? cambio(p) : p)));
  /**
   * El año que se escribe en una carta: si es válido, su fecha pasa a ser ese año; si no, en blanco.
   * Si es el mismo con el que llegó la foto, se queda su fecha entera: no pierde el mes ni el día.
   */
  const ponerAnio = (fotoId: string, texto: string) =>
    cambiar(fotoId, (p) => {
      const b = cambiarBorrador(borradorAnio(p.anio), { anio: texto });
      const escrita = estadoBorrador(b, hoy).fecha;
      const fecha = escrita && p.traida?.anio === escrita.anio ? p.traida : escrita;
      return { ...puestaAMano(p, fecha), anio: b.anio, fechaTocada: true };
    });
  const ponerFrase = (fotoId: string, frase: string) => cambiar(fotoId, (p) => ({ ...p, frase }));

  const quitar = (p: Pendiente) => {
    vistas.current.delete(p.foto.hash);
    liberar(p.foto.id);
    const quedan = pendientes.length - 1;
    setPendientes((ps) => ps.filter((x) => x.foto.id !== p.foto.id));
    // El foco no se pierde con la foto: va al título de la lista o, si ya no queda ninguna, a elegir.
    requestAnimationFrame(() => (quedan > 0 ? tituloLista.current : botonElegir.current)?.focus());
  };

  /** Manda las fotos de la lista, cada una con su fecha (si se ha tocado) y su frase. */
  const mandar = async () => {
    if (!listo || !cliente || enMarcha.current || pendientes.length === 0) return;
    if (!consentido) return pedirPermiso();
    if (largas.length > 0) {
      setAvisarLargas(true);
      document.getElementById(idFrase(largas[0]!.foto.id))?.focus();
      return;
    }
    enMarcha.current = true;
    setAvisarLargas(false);
    const lista = pendientes;
    const autor = nombre.trim() || null;
    const r: Resultado = { enviadas: 0, fallidas: 0, lleno: false };
    let parar: "lleno" | "caducado" | null = null;
    let hechas = 0;
    setResultado(null);
    setDescartes(null);
    setProgreso({ hechas: 0, total: lista.length });
    try {
      await enCola(
        lista,
        A_LA_VEZ,
        async (p) => {
          if (parar) throw new Error(parar);
          const extra: ExtraAportacion = { autor, lote: lote.current ?? idAleatorio(12), enviadaEn: Date.now(), descripcion: p.frase };
          if (p.fechaTocada) extra.fecha = p.fecha;
          // Una foto de una sesión de fotos de fotos va sin año, como aquí: con su fecha como sugerencia.
          const foto = !p.fechaTocada && p.motivo === "sesion-de-escaneo" ? { ...p.foto, propuesta: propuestaDeSesion(p.foto.propuesta) } : p.foto;
          try {
            await cliente.aportar(id, await prepararAportacion(foto, extra, listo.clave, id));
          } catch (e) {
            if (e instanceof ErrorServicio && e.estado === 409) parar = "lleno";
            if (e instanceof ErrorServicio && (e.estado === 404 || e.estado === 410)) parar = "caducado";
            throw e;
          }
        },
        (res) => {
          hechas++;
          if (res.ok) {
            r.enviadas++;
            liberar(res.entrada.foto.id);
            setPendientes((ps) => ps.filter((x) => x.foto.id !== res.entrada.foto.id));
          } else r.fallidas++;
          setProgreso({ hechas, total: lista.length });
        },
      );
    } finally {
      enMarcha.current = false;
      setProgreso(null);
    }
    if (parar === "caducado") return setApertura({ tipo: "error", motivo: "caducado" });
    r.lleno = parar === "lleno";
    setResultado(r);
  };

  // Soltar fotos o carpetas en cualquier punto de la página (y que el navegador no abra la foto).
  const prepararRef = useRef(preparar);
  useEffect(() => {
    prepararRef.current = preparar;
  });
  const activo = !!listo;
  useEffect(() => {
    if (!activo) return;
    let temporizador: number | undefined;
    const sobre = (e: DragEvent) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setEncima(true);
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => setEncima(false), 700);
    };
    const soltar = (e: DragEvent) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      window.clearTimeout(temporizador);
      setEncima(false);
      if (e.dataTransfer) void archivosDeArrastre(e.dataTransfer).then((a) => prepararRef.current(a));
    };
    window.addEventListener("dragover", sobre);
    window.addEventListener("drop", soltar);
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener("dragover", sobre);
      window.removeEventListener("drop", soltar);
    };
  }, [activo]);

  const elegir = () => {
    if (!consentido) return pedirPermiso();
    entrada.current?.click();
  };
  const alElegir = (e: ChangeEvent<HTMLInputElement>) => {
    void preparar([...(e.target.files ?? [])]);
    e.target.value = "";
  };

  const cabecera = (
    <header className="space-y-3">
      <Micro className="text-tinta-2">{t("micro")}</Micro>
      <h1 className="tipo-titular text-[clamp(2.4rem,8vw,3.8rem)] leading-[0.92]">{t("titulo")}</h1>
    </header>
  );

  if (apertura.tipo !== "listo") {
    return (
      <div className="space-y-6">
        {cabecera}
        {apertura.tipo === "cargando" ? (
          <div className="max-w-xs space-y-2" aria-live="polite">
            <Franja valor={0.5} etiqueta={t("cargando")} className="animate-pulse" />
            <p className="text-sm text-tinta-2">{t("cargando")}</p>
          </div>
        ) : (
          <Aviso tono={apertura.motivo === "sinRed" ? "aviso" : "error"}>
            <p data-testid="aportar-error" data-motivo={apertura.motivo} className="text-base">
              {t(apertura.motivo)}
            </p>
          </Aviso>
        )}
      </div>
    );
  }

  const yaHay = porMandar || !!resultado?.enviadas;

  // Con fotos elegidas, lo primero que se ve son ellas, como cartas, antes del formulario (Ricard:
  // el mazo siempre a la vista). El formulario no cambia de sitio en el árbol, así que no se pierde
  // lo escrito ni el foco; solo queda debajo. El progreso y los avisos de lo que no ha entrado van
  // junto a él, donde se acaba de elegir.
  return (
    <div className="space-y-6">
      {cabecera}
      {!yaHay && (
        <>
          <p className="max-w-2xl text-md text-tinta-2">{t("intro")}</p>
          <p className="max-w-2xl text-tinta-2">{tf("sinPresion")}</p>
        </>
      )}

      {resultado && (
        <Aviso
          tono={resultado.fallidas || resultado.lleno ? "aviso" : resultado.enviadas ? "exito" : "info"}
          accion={
            resultado.fallidas > 0 && !resultado.lleno && porMandar ? (
              <Boton variante="secundario" tamano="sm" className="max-sm:min-h-11" onClick={() => void mandar()}>
                {t("reintentar")}
              </Boton>
            ) : undefined
          }
        >
          <p data-testid="resultado-aportar">
            {[
              resultado.enviadas > 0 && (
                <span key="enviadas" className="font-semibold">
                  {t("enviadas", { n: resultado.enviadas })}
                </span>
              ),
              resultado.fallidas > 0 && t("fallidas", { n: resultado.fallidas }),
            ]
              .filter(Boolean)
              .map((parte, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {parte}
                </span>
              ))}
          </p>
          {resultado.lleno && <p className="mt-1">{t("lleno")}</p>}
        </Aviso>
      )}

      {porMandar && (
        <section aria-labelledby={`${ids}-lista`} className="space-y-4" data-testid="lista-aportar">
          <h2 ref={tituloLista} id={`${ids}-lista`} tabIndex={-1} className="tipo-subtitular text-xl outline-none">
            {t("listaTitulo", { n: pendientes.length })}
          </h2>
          {/* Mientras salen, no se cambian: se manda lo que había al pulsar. */}
          <fieldset disabled={mandando} className="min-w-0">
            <ol className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4">
              {pendientes.map((p, i) => (
                <CartaPorMandar
                  key={p.foto.id}
                  p={p}
                  n={i + 1}
                  hoy={hoy}
                  idFrase={idFrase(p.foto.id)}
                  alCambiarAnio={(anio) => ponerAnio(p.foto.id, anio)}
                  alCambiarFrase={(frase) => ponerFrase(p.foto.id, frase)}
                  alQuitar={() => quitar(p)}
                />
              ))}
            </ol>
          </fieldset>
          {/* Siempre a mano mientras se repasa la lista; al final de ella, en su sitio. */}
          <div ref={reservarAbajo} className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-linea bg-papel/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-6 sm:px-6">
            {avisarLargas && largas.length > 0 && (
              <p role="alert" className="text-sm font-semibold text-rojo-texto">
                {t("fraseLarga", { n: largas.length, max: MAX_DESCRIPCION })}
              </p>
            )}
            {progreso ? (
              <div className="space-y-2" aria-live="polite">
                <Franja valor={progreso.total ? progreso.hechas / progreso.total : 0} etiqueta={t("enviando", progreso)} />
                <p className="text-sm font-semibold">{t("enviando", progreso)}</p>
              </div>
            ) : (
              <Boton tamano="lg" className="w-full sm:w-auto" onClick={() => void mandar()} disabled={preparando !== null}>
                {t("mandar", { n: pendientes.length })}
              </Boton>
            )}
          </div>
        </section>
      )}

      {descartes && (
        <Aviso tono="info">
          <p data-testid="descartes-aportar">
            {[
              descartes.repetidas > 0 && t("repetidas", { n: descartes.repetidas }),
              descartes.noLeidas > 0 && t("noLeidas", { n: descartes.noLeidas }),
              descartes.noImagen > 0 && t("noImagen", { n: descartes.noImagen }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Aviso>
      )}

      {preparando && (
        <div className="space-y-2" aria-live="polite">
          <Franja valor={preparando.total ? preparando.hechas / preparando.total : 0} etiqueta={t("preparando", preparando)} />
          <p className="text-sm font-semibold">{t("preparando", preparando)}</p>
        </div>
      )}

      <div className="space-y-5 rounded-[var(--radius-carta)] bg-blanco p-5 sm:p-7">
        <div className="space-y-1.5">
          <label htmlFor={`${ids}-nombre`} className="block font-semibold">
            {t("nombre")} <span className="font-normal text-tinta-2">{t("opcional")}</span>
          </label>
          <input
            id={`${ids}-nombre`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={MAX_AUTOR}
            autoComplete="given-name"
            aria-describedby={`${ids}-nombre-ayuda`}
            className="w-full max-w-sm rounded-[var(--radius-control)] border-2 border-linea bg-papel px-3 py-2.5"
          />
          <p id={`${ids}-nombre-ayuda`} className="text-sm text-tinta-2">
            {t("nombreAyuda")}
          </p>
        </div>

        <label
          data-testid="permiso-aportar"
          className={`flex cursor-pointer items-start gap-3 rounded-[14px] p-3 transition-[background-color,box-shadow] ${
            faltaPermiso && !consentido ? "bg-[#FFF4D6] shadow-[inset_0_0_0_3px_var(--color-amarillo)]" : "bg-papel"
          }`}
        >
          <input
            ref={casilla}
            type="checkbox"
            checked={consentido}
            onChange={(e) => setConsentido(e.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-tinta)]"
          />
          <span className="min-w-0">
            <span className="block text-sm leading-relaxed">{t("consentimiento")}</span>
            {faltaPermiso && !consentido && <span className="mt-1.5 block font-semibold">{t("consentimientoFalta")}</span>}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Boton ref={botonElegir} tamano="lg" variante={porMandar ? "secundario" : "primario"} onClick={elegir} disabled={ocupado}>
            {yaHay ? t("mas") : t("elegir")}
          </Boton>
          <p className="tipo-subtitular hidden text-lg sm:block">{t("arrastrar")}</p>
          <input
            ref={entrada}
            type="file"
            multiple
            accept={ACEPTA}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="entrada-aportar"
            onChange={alElegir}
          />
        </div>
        <p className="text-sm text-tinta-2">{t("consejo")}</p>
      </div>

      <section aria-labelledby={`${ids}-privacidad`} className="space-y-2 border-t-2 border-linea pt-5">
        <h2 id={`${ids}-privacidad`} className="tipo-subtitular text-lg">
          {t("privacidadTitulo")}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-tinta-2">
          <li>{t("privacidad1")}</li>
          <li>{t("privacidad2")}</li>
          <li>{t("privacidad3")}</li>
        </ul>
      </section>

      {encima && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-papel/80 p-6 backdrop-blur-[2px]">
          <div className="rounded-[var(--radius-carta)] border-[3px] border-dashed border-cobalto bg-[#E8EDFD] px-10 py-12 text-center shadow-[var(--shadow-flotante)]">
            <p className="tipo-subtitular text-xl">{t("soltar")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Una foto de la lista, como una carta del mazo: la foto con su año abajo (el de su fecha, si la
 * trae; si no, en blanco para escribirlo) y debajo, si se quiere, una frase. Sin nada más.
 */
function CartaPorMandar({
  p,
  n,
  hoy,
  idFrase,
  alCambiarAnio,
  alCambiarFrase,
  alQuitar,
}: {
  p: Pendiente;
  n: number;
  hoy: Date;
  idFrase: string;
  alCambiarAnio: (anio: string) => void;
  alCambiarFrase: (frase: string) => void;
  alQuitar: () => void;
}) {
  const t = useTranslations("colaboracion.aportar");
  const tf = useTranslations("fechas");
  const idError = useId();
  // Solo con el año entero: un año que no existe o que aún no ha llegado.
  const error = p.anio.length === 4 ? estadoBorrador(borradorAnio(p.anio), hoy).error : null;
  const largo = caracteres(p.frase);
  const demasiado = largo > MAX_DESCRIPCION;
  return (
    <li data-testid="foto-por-mandar" className="min-w-0 space-y-2">
      <div className="relative overflow-hidden rounded-[12px] bg-papel-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt={t("foto", { n })} className="block w-full object-cover" style={{ aspectRatio: PROPORCION_CARTA }} draggable={false} />
        <button
          type="button"
          onClick={alQuitar}
          aria-label={t("quitarFoto", { n })}
          className="absolute right-1.5 top-1.5 grid h-10 w-10 place-items-center rounded-full bg-tinta/60 text-papel transition-colors hover:bg-tinta/80 disabled:opacity-45"
        >
          <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
        <label className="absolute inset-x-0 bottom-0 block bg-papel/90 px-2.5 py-1.5 backdrop-blur-[2px]">
          <span className="sr-only">{t("anioDe", { n })}</span>
          <input
            value={p.anio}
            onChange={(e) => alCambiarAnio(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder={t("anio")}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? idError : undefined}
            className="w-full bg-transparent text-base font-semibold text-tinta placeholder:font-normal placeholder:text-tinta-2 aria-[invalid=true]:text-rojo-texto"
          />
        </label>
      </div>
      {error && (
        <p id={idError} role="alert" className="text-sm font-semibold text-rojo-texto">
          {tf(error)}
        </p>
      )}
      <textarea
        id={idFrase}
        value={p.frase}
        rows={2}
        maxLength={MAX_DESCRIPCION + 20}
        onChange={(e) => alCambiarFrase(e.target.value.replace(/\n/g, " "))}
        placeholder={t("frase")}
        aria-label={t("fraseDe", { n })}
        aria-invalid={demasiado || undefined}
        className="block min-h-16 w-full resize-none rounded-[10px] border-2 border-linea bg-blanco px-2.5 py-2 text-base leading-snug field-sizing-content placeholder:text-tinta-2 focus:border-tinta aria-[invalid=true]:border-rojo-texto"
      />
      {/* La cuenta, solo cerca del máximo. La caja crece con la frase (donde el navegador lo sabe hacer). */}
      {largo >= MAX_DESCRIPCION - 15 && (
        <p className={`text-right text-sm ${demasiado ? "font-bold text-rojo-texto" : "text-tinta-2"}`}>{t("fraseContador", { n: largo, max: MAX_DESCRIPCION })}</p>
      )}
    </li>
  );
}
