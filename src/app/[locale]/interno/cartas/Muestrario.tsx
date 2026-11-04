"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { CartaCanvas } from "@/components/carta/CartaCanvas";
import { useImagenUrl } from "@/components/carta/Muestra";
import { IconoMecanica } from "@/components/ui/IconoMecanica";
import { Chip, Micro, Seccion } from "@/components/ui/Piezas";
import { textoEn } from "@/domain/precios/tipos";
import { IDIOMAS_MAZO, nombreDeIdioma } from "@/lib/carta/textos";
import { textosInternos } from "@/lib/carta/textosInternos";
import type { Cara, DatosCarta, FotoCarta } from "@/lib/carta/tipos";
import { ESTILOS, ESTILO_POR_DEFECTO, obtenerEstilo, obtenerPaleta, type Estilo, type Paleta } from "@/lib/estilos";
import { cartaPortada, datosCaja, datosCarta, datosPortada, fotoCaja, nuevaCartaTexto, proporcionReversoDe, recortesIniciales } from "@/lib/mazo/derivados";
import { VERSION_MAZO, type Carta, type CartaFoto, type Mazo } from "@/lib/mazo/tipos";

export interface MecanicaMuestrario {
  id: string;
  /** Id del icono en la plantilla, tal como lo asigna el catálogo. */
  icono: string;
  /** Nombre en el idioma de la interfaz. */
  nombre: string;
}

/** Fotos de ejemplo generadas para la web (public/muestras): nunca fotos de clientes. */
const FOTOS = { mar: "/muestras/mar.jpg", luces: "/muestras/luces.jpg", montanas: "/muestras/montanas.jpg" } as const;
type ClaveFoto = keyof typeof FOTOS;
type Imagenes = Record<ClaveFoto, ImageBitmap | null>;

/** Medidas mientras la foto carga: solo sirven para recortes que todavía no se dibujan. */
const MEDIDAS_PROVISIONALES = { ancho: 1000, alto: 1200 };
/** Un mazo de tamaño real, para que la portada y la caja cuenten como en un pedido. */
const CARTAS_DEL_MAZO = 60;
const CARAS: Cara[] = ["anverso", "reverso"];
const TODAS = "todas";

type ClaveSeccion = "foto" | "estrella" | "texto" | "textoLargo" | "portada" | "comodin" | "enBlanco" | "cajaPersonalizada" | "cajaGenerica";
/** Secciones con una nota debajo del título. */
const CON_NOTA = ["textoLargo", "cajaPersonalizada", "cajaGenerica"] as const;
const tieneNota = (id: ClaveSeccion): id is (typeof CON_NOTA)[number] => (CON_NOTA as readonly string[]).includes(id);

interface Muestra {
  id: ClaveSeccion;
  datos: (cara: Cara) => DatosCarta;
  /** La caja de siempre es de stock: una sola, con la paleta por defecto del estilo. */
  unaSola?: boolean;
}

/**
 * Mazo inventado con los textos de ejemplo del idioma del mazo. Pasa por las mismas funciones
 * que el mazo de un cliente (portada, caja, datos de cada cara), así que se ve lo que se imprimiría.
 */
function mazoDeEjemplo(estilo: Estilo, idioma: string, imagenes: Imagenes): Mazo {
  const e = textosInternos(idioma).muestrario.ejemplos;
  const proporcion = proporcionReversoDe({ estiloId: estilo.id });
  const foto = (id: ClaveFoto, fecha: CartaFoto["fecha"], cambios: Partial<CartaFoto> = {}): CartaFoto => {
    const bmp = imagenes[id];
    const { ancho, alto } = bmp ? { ancho: bmp.width, alto: bmp.height } : MEDIDAS_PROVISIONALES;
    return {
      tipo: "foto",
      id,
      nombreArchivo: FOTOS[id].split("/").pop()!,
      tipoArchivo: "image/jpeg",
      hash: id,
      ancho,
      alto,
      anchoOriginal: ancho,
      altoOriginal: alto,
      fecha,
      fuente: "manual",
      confianza: "alta",
      revisar: false,
      descripcion: "",
      descripcionEnAnverso: false,
      ...recortesIniciales(ancho, alto, proporcion),
      reversoPersonalizado: false,
      destacada: false,
      adornos: [],
      pppConfirmado: true,
      anadidaEn: 0,
      ...cambios,
    };
  };
  const cartas: Carta[] = [
    foto("mar", { anio: 2019, mes: 8, dia: 14 }, { descripcion: e.foto }),
    foto("luces", { anio: 2021, mes: 12 }, { descripcion: e.estrella, descripcionEnAnverso: true, destacada: true }),
    foto("montanas", { anio: 2015, mes: 5 }),
    nuevaCartaTexto("conocimos", e.texto, { anio: 2010, mes: 3, dia: 6 }, 0),
    { ...nuevaCartaTexto("largo", e.textoLargo, { anio: 2016 }, 0), destacada: true },
  ];
  // Relleno que no se dibuja: solo cuenta en «2010–2021 · 60 recuerdos».
  for (let i = cartas.length; i < CARTAS_DEL_MAZO; i++) cartas.push(nuevaCartaTexto(`relleno-${i}`, "", { anio: 2010 + (i % 12) }, 0));
  return {
    version: VERSION_MAZO,
    id: "muestrario",
    creadoEn: 0,
    actualizadoEn: 0,
    // No se cobra: el mazo solo sirve para sacar los datos de las caras.
    packId: "",
    estiloId: estilo.id,
    paletaId: estilo.paletaPorDefecto,
    titulo: e.titulo,
    dedicatoria: e.dedicatoria,
    portadaId: null,
    caja: { origen: "carta", cartaId: "montanas" },
    tono: "original",
    idiomaMazo: idioma,
    mecanicas: [],
    extras: [],
    consentimientoFotos: null,
    paso: 3,
    cartas,
    pedido: null,
  };
}

function fotoDe(c: Carta | null | undefined, imagenes: Imagenes): FotoCarta | null {
  if (!c || c.tipo !== "foto") return null;
  const bmp = imagenes[c.id as ClaveFoto];
  return bmp ? { imagen: bmp, escala: bmp.width / c.ancho, recorteAnverso: c.recorteAnverso, recorteReverso: c.recorteReverso } : null;
}

/**
 * Muestrario interno de cartas, para que Marc valide la plantilla: todas las caras (anverso y
 * reverso) con datos de ejemplo, en una paleta o en todas, en cada idioma del mazo.
 */
export function Muestrario({ mecanicas }: { mecanicas: MecanicaMuestrario[] }) {
  const locale = useLocale();
  // Textos de la herramienta, fuera de los mensajes públicos (ver textosInternos).
  const t = textosInternos(locale).muestrario;
  const id = useId();
  const [estiloId, setEstiloId] = useState(ESTILO_POR_DEFECTO.id);
  const estilo = obtenerEstilo(estiloId);
  const [eleccion, setEleccion] = useState<string>(estilo.paletaPorDefecto);
  const [idioma, setIdioma] = useState<string>((IDIOMAS_MAZO as readonly string[]).includes(locale) ? locale : IDIOMAS_MAZO[0]);
  const [guias, setGuias] = useState(false);

  const mar = useImagenUrl(FOTOS.mar);
  const luces = useImagenUrl(FOTOS.luces);
  const montanas = useImagenUrl(FOTOS.montanas);
  const imagenes = useMemo<Imagenes>(() => ({ mar, luces, montanas }), [mar, luces, montanas]);
  const mazo = useMemo(() => mazoDeEjemplo(estilo, idioma, imagenes), [estilo, idioma, imagenes]);

  const todas = eleccion === TODAS;
  const paletas = todas ? estilo.paletas : [obtenerPaleta(estilo, eleccion)];
  const porDefecto = obtenerPaleta(estilo, null);
  const icono = (mecanica: string) => mecanicas.find((m) => m.id === mecanica)?.icono ?? null;
  const carta = (cartaId: string) => mazo.cartas.find((c) => c.id === cartaId)!;
  const portada = cartaPortada(mazo);
  const caja = fotoCaja(mazo);
  const imagenCaja = caja ? imagenes[caja.id as ClaveFoto] : null;

  const muestras: Muestra[] = [
    { id: "foto", datos: () => ({ ...datosCarta(carta("mar"), null), foto: fotoDe(carta("mar"), imagenes) }) },
    { id: "estrella", datos: () => ({ ...datosCarta(carta("luces"), icono("estrella")), foto: fotoDe(carta("luces"), imagenes) }) },
    { id: "texto", datos: () => datosCarta(carta("conocimos"), null) },
    { id: "textoLargo", datos: () => datosCarta(carta("largo"), icono("estrella")) },
    { id: "portada", datos: (cara) => ({ ...datosPortada(mazo, cara), foto: fotoDe(portada, imagenes) }) },
    { id: "comodin", datos: () => ({ tipo: "comodin", icono: icono("comodin") }) },
    { id: "enBlanco", datos: () => ({ tipo: "en-blanco", icono: icono("en-blanco") }) },
    {
      id: "cajaPersonalizada",
      datos: (cara) => ({
        ...datosCaja(mazo, cara, "personalizada"),
        foto: caja && imagenCaja ? { imagen: imagenCaja, escala: imagenCaja.width / caja.ancho, recorteAnverso: caja.recorte, recorteReverso: caja.recorte } : null,
      }),
    },
    { id: "cajaGenerica", unaSola: true, datos: (cara) => datosCaja(mazo, cara, "generica") },
  ];

  return (
    <Seccion className="space-y-10 py-10 sm:py-12">
      <header className="space-y-3">
        <Micro className="text-tinta-2">{t.interna}</Micro>
        <h1 className="tipo-titular text-[clamp(2.4rem,7vw,4.4rem)] leading-[0.9]">{t.titulo}</h1>
        <p className="max-w-2xl text-md text-tinta-2">{t.texto}</p>
        <Chip color="var(--color-amarillo)">{t.pendiente}</Chip>
      </header>

      <div className="flex flex-col gap-6 rounded-[24px] bg-papel-2 p-5 sm:p-6 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-10">
        {ESTILOS.length > 1 && (
          <Grupo leyenda={t.estilo}>
            {ESTILOS.map((e) => (
              <Opcion
                key={e.id}
                nombre={`${id}-estilo`}
                activo={e.id === estilo.id}
                alElegir={() => {
                  setEstiloId(e.id);
                  if (eleccion !== TODAS) setEleccion(e.paletaPorDefecto);
                }}
              >
                {textoEn(e.nombre, locale)}
              </Opcion>
            ))}
          </Grupo>
        )}
        <Grupo leyenda={t.paleta}>
          <Opcion nombre={`${id}-paleta`} activo={todas} alElegir={() => setEleccion(TODAS)}>
            <Muestras paletas={estilo.paletas} />
            {t.todas}
          </Opcion>
          {estilo.paletas.map((p) => (
            <Opcion key={p.id} nombre={`${id}-paleta`} activo={!todas && p.id === paletas[0]?.id} alElegir={() => setEleccion(p.id)}>
              <Muestras paletas={[p]} />
              {textoEn(p.nombre, locale)}
            </Opcion>
          ))}
        </Grupo>
        <Grupo leyenda={t.idioma}>
          {IDIOMAS_MAZO.map((codigo) => (
            <Opcion key={codigo} nombre={`${id}-idioma`} activo={idioma === codigo} alElegir={() => setIdioma(codigo)}>
              {nombreDeIdioma(codigo, locale)}
            </Opcion>
          ))}
        </Grupo>
        <button
          type="button"
          role="switch"
          aria-checked={guias}
          onClick={() => setGuias(!guias)}
          className="tipo-boton flex min-h-11 items-center gap-3 self-start rounded-full bg-blanco px-4 text-sm text-tinta transition-colors hover:bg-papel-3 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cobalto lg:self-end"
        >
          <span aria-hidden="true" className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-tinta transition-colors ${guias ? "bg-tinta" : "bg-blanco"}`}>
            <span className={`h-3 w-3 rounded-full transition-transform duration-150 ${guias ? "translate-x-[18px] bg-papel" : "translate-x-[2px] bg-tinta"}`} />
          </span>
          {t.guias}
        </button>
      </div>

      <div className={todas ? "space-y-12" : "grid gap-x-10 gap-y-12 lg:grid-cols-2"}>
        {muestras.map((m) => (
          <SeccionMuestra
            key={m.id}
            titulo={t.secciones[m.id]}
            nota={tieneNota(m.id) ? t.notas[m.id] : undefined}
            paletas={m.unaSola ? [porDefecto] : paletas}
            enRejilla={todas && !m.unaSola}
            datos={m.datos}
            estilo={estilo}
            idioma={idioma}
            guias={guias}
            locale={locale}
            caras={{ anverso: t.anverso, reverso: t.reverso }}
          />
        ))}
        <SeccionIconos titulo={t.secciones.iconos} paletas={paletas} mecanicas={mecanicas} estilo={estilo} locale={locale} enRejilla={todas} />
      </div>
    </Seccion>
  );
}

function SeccionMuestra({
  titulo,
  nota,
  paletas,
  enRejilla,
  datos,
  estilo,
  idioma,
  guias,
  locale,
  caras,
}: {
  titulo: string;
  nota?: string;
  paletas: Paleta[];
  enRejilla: boolean;
  datos: (cara: Cara) => DatosCarta;
  estilo: Estilo;
  idioma: string;
  guias: boolean;
  locale: string;
  caras: Record<Cara, string>;
}) {
  const idTitulo = useId();
  return (
    <section aria-labelledby={idTitulo} aria-describedby={nota ? `${idTitulo}-nota` : undefined} className="space-y-4 border-t border-linea pt-6">
      <div>
        <h2 id={idTitulo} className="tipo-subtitular text-xl">
          {titulo}
        </h2>
        {nota && (
          <p id={`${idTitulo}-nota`} className="mt-1 text-sm text-tinta-2">
            {nota}
          </p>
        )}
      </div>
      <ul className={enRejilla ? "grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" : "grid max-w-[560px]"}>
        {paletas.map((p) => {
          const nombre = textoEn(p.nombre, locale);
          return (
            <li key={p.id}>
              <figure>
                <div className="grid grid-cols-2 gap-3">
                  {CARAS.map((cara) => (
                    <div key={cara}>
                      <CartaCanvas
                        cara={cara}
                        datos={datos(cara)}
                        estiloId={estilo.id}
                        paletaId={p.id}
                        tono="original"
                        idiomaMazo={idioma}
                        guias={guias}
                        etiqueta={`${titulo} · ${nombre} · ${caras[cara]}`}
                      />
                      <p aria-hidden="true" className="tipo-micro mt-2 text-micro text-tinta-2">
                        {caras[cara]}
                      </p>
                    </div>
                  ))}
                </div>
                <figcaption className="mt-1 flex items-center gap-2 text-sm font-semibold">
                  <Muestras paletas={[p]} />
                  {nombre}
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Los iconos de la esquina como en la web (IconoMecanica), sobre el color de la pestaña. */
function SeccionIconos({
  titulo,
  paletas,
  mecanicas,
  estilo,
  locale,
  enRejilla,
}: {
  titulo: string;
  paletas: Paleta[];
  mecanicas: MecanicaMuestrario[];
  estilo: Estilo;
  locale: string;
  enRejilla: boolean;
}) {
  const idTitulo = useId();
  return (
    <section aria-labelledby={idTitulo} className="space-y-4 border-t border-linea pt-6">
      <h2 id={idTitulo} className="tipo-subtitular text-xl">
        {titulo}
      </h2>
      <ul className={enRejilla ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid max-w-[560px]"}>
        {paletas.map((p) => (
          <li key={p.id} className="rounded-[16px] bg-blanco p-4">
            <p className="text-sm font-semibold">{textoEn(p.nombre, locale)}</p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
              {mecanicas.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <span className="grid place-items-center rounded-[0_0_12px_0] p-1.5" style={{ background: p.fondo }}>
                    <IconoMecanica icono={m.icono} tamano="sm" estiloId={estilo.id} paletaId={p.id} />
                  </span>
                  {m.nombre}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Grupo({ leyenda, children }: { leyenda: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="tipo-micro mb-2 text-micro text-tinta-2">{leyenda}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

/** Opción de un grupo de radios: el texto visible es su nombre accesible y las flechas cambian de opción. */
function Opcion({ nombre, activo, alElegir, children }: { nombre: string; activo: boolean; alElegir: () => void; children: ReactNode }) {
  return (
    <label className="block cursor-pointer rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalto">
      <input type="radio" name={nombre} checked={activo} onChange={alElegir} className="sr-only" />
      <span
        className={`tipo-boton flex min-h-11 items-center gap-2 rounded-full px-4 text-sm transition-colors ${activo ? "bg-tinta text-papel" : "bg-blanco text-tinta hover:bg-papel-3"}`}
      >
        {children}
      </span>
    </label>
  );
}

/** Círculo con el color de la pestaña de una paleta (o de varias, en porciones). */
function Muestras({ paletas }: { paletas: Paleta[] }) {
  const fondo =
    paletas.length === 1
      ? paletas[0]!.fondo
      : `conic-gradient(${paletas.map((p, i) => `${p.fondo} ${(i / paletas.length) * 360}deg ${((i + 1) / paletas.length) * 360}deg`).join(", ")})`;
  return <span aria-hidden="true" className="inline-block h-5 w-5 shrink-0 rounded-full ring-1 ring-tinta/20" style={{ background: fondo }} />;
}
