"use client";

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { URL_COLABORACION } from "@config/colaboracion";
import { Boton } from "@/components/ui/Boton";
import { Aviso, Franja, Micro } from "@/components/ui/Piezas";
import { MAX_AUTOR } from "@/domain/colaboracion/aportacion";
import { idAleatorio } from "@/domain/colaboracion/cifrado";
import { clienteColaboracion, ErrorServicio } from "@/lib/colaboracion/api";
import { huellaDelEnlace } from "@/lib/colaboracion/enlace";
import { claveComprobada, prepararAportacion } from "@/lib/colaboracion/enviar";
import { archivosDeArrastre, enCola, esImagenCompatible, procesarArchivo } from "@/lib/importar/procesar";

type Apertura =
  | { tipo: "cargando" }
  | { tipo: "error"; motivo: "noExiste" | "caducado" | "incompleto" | "sinRed" }
  | { tipo: "listo"; clave: Uint8Array<ArrayBuffer> };

interface Resultado {
  enviadas: number;
  repetidas: number;
  noImagen: number;
  /** Las que no han salido: se pueden volver a probar. */
  fallidas: File[];
  /** El enlace ha dicho que no admite más por ahora. */
  lleno: boolean;
}

const ACEPTA = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
/** Fotos que se preparan y mandan a la vez: pocas, que en el móvil cada una ocupa mucha memoria. */
const A_LA_VEZ = 2;

/** Lleva archivos (no texto ni enlaces arrastrados desde la propia página). */
const conArchivos = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");

/**
 * La página que abre quien recibe el enlace: comprueba que la clave es la del dueño del mazo (la
 * huella va tras «#») y manda las fotos cifradas, preparadas en su propio móvil. Pendiente de Marc.
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
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [encima, setEncima] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const casilla = useRef<HTMLInputElement>(null);
  /** Las fotos mandadas en esta visita forman un lote: así se reconoce una sesión de fotos de fotos. */
  const lote = useRef<string | null>(null);
  /** Huellas de lo ya mandado (o mandándose) en esta visita, para no mandar dos veces la misma foto. */
  const vistas = useRef(new Set<string>());

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

  // Mientras se mandan fotos, avisar antes de cerrar la página.
  const mandando = progreso !== null;
  useEffect(() => {
    if (!mandando) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [mandando]);

  const listo = apertura.tipo === "listo" ? apertura : null;

  /** Sin el permiso no se manda nada: se resalta la casilla. */
  const pedirPermiso = () => {
    setFaltaPermiso(true);
    casilla.current?.focus();
    casilla.current?.scrollIntoView({ block: "center" });
  };

  const enviar = async (archivos: File[]) => {
    if (!listo || !cliente || mandando || archivos.length === 0) return;
    if (!consentido) return pedirPermiso();
    lote.current ??= idAleatorio(12);
    const imagenes = archivos.filter(esImagenCompatible);
    const r: Resultado = { enviadas: 0, repetidas: 0, noImagen: archivos.length - imagenes.length, fallidas: [], lleno: false };
    let parar: "lleno" | "caducado" | null = null;
    let hechas = 0;
    const hoy = new Date();
    setResultado(null);
    setProgreso({ hechas: 0, total: imagenes.length });
    await enCola(
      imagenes,
      A_LA_VEZ,
      async (archivo) => {
        if (parar) throw new Error(parar);
        const foto = await procesarArchivo(archivo, hoy);
        if (vistas.current.has(foto.hash)) return "repetida" as const;
        vistas.current.add(foto.hash);
        try {
          const paquete = await prepararAportacion(foto, { autor: nombre.trim() || null, lote: lote.current!, enviadaEn: Date.now() }, listo.clave, id);
          await cliente.aportar(id, paquete);
          return "enviada" as const;
        } catch (e) {
          vistas.current.delete(foto.hash);
          if (e instanceof ErrorServicio && e.estado === 409) parar = "lleno";
          if (e instanceof ErrorServicio && (e.estado === 404 || e.estado === 410)) parar = "caducado";
          throw e;
        }
      },
      (res) => {
        hechas++;
        if (!res.ok) r.fallidas.push(res.entrada);
        else if (res.valor === "repetida") r.repetidas++;
        else r.enviadas++;
        setProgreso({ hechas, total: imagenes.length });
      },
    );
    setProgreso(null);
    if (parar === "caducado") return setApertura({ tipo: "error", motivo: "caducado" });
    r.lleno = parar === "lleno";
    setResultado(r);
  };

  // Soltar fotos o carpetas en cualquier punto de la página (y que el navegador no abra la foto).
  const enviarRef = useRef(enviar);
  useEffect(() => {
    enviarRef.current = enviar;
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
      if (e.dataTransfer) void archivosDeArrastre(e.dataTransfer).then((a) => enviarRef.current(a));
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
    void enviar([...(e.target.files ?? [])]);
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

  return (
    <div className="space-y-6">
      {cabecera}
      <p className="max-w-2xl text-md text-tinta-2">{t("intro")}</p>
      <p className="max-w-2xl text-tinta-2">{tf("sinPresion")}</p>

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
          <Boton tamano="lg" onClick={elegir} disabled={mandando}>
            {resultado?.enviadas ? t("mas") : t("elegir")}
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

      {progreso && (
        <div className="space-y-2" aria-live="polite">
          <Franja valor={progreso.total ? progreso.hechas / progreso.total : 0} etiqueta={t("enviando", progreso)} />
          <p className="text-sm font-semibold">{t("enviando", progreso)}</p>
        </div>
      )}

      {resultado && (
        <Aviso
          tono={resultado.fallidas.length || resultado.lleno ? "aviso" : resultado.enviadas ? "exito" : "info"}
          accion={
            resultado.fallidas.length > 0 && !resultado.lleno ? (
              <Boton variante="secundario" tamano="sm" className="max-sm:min-h-11" onClick={() => void enviar(resultado.fallidas)}>
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
              resultado.repetidas > 0 && t("repetidas", { n: resultado.repetidas }),
              resultado.fallidas.length > 0 && t("fallidas", { n: resultado.fallidas.length }),
              resultado.noImagen > 0 && t("noImagen", { n: resultado.noImagen }),
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
