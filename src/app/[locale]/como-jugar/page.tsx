import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { Pie } from "@/components/marco/Pie";
import { EjemplosPrecision } from "@/components/inicio/CartaVolteable";
import { textoContenidoCaja } from "@/components/juego/contenidoCaja";
import { MesaPartida } from "@/components/juego/MesaPartida";
import { PestanasModos, type PanelModo } from "@/components/juego/PestanasModos";
import { BotonEnlace } from "@/components/ui/Boton";
import { IconoMecanica } from "@/components/ui/IconoMecanica";
import { Chip, Micro, Seccion } from "@/components/ui/Piezas";
import { CARTAS_POR_PERSONA, MAX_PERSONAS, jugadoresPorMazo, vidas, vidasHistoriaCompleta } from "@/domain/juego/reglas";
import { packsActivos } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";
import { obtenerCatalogo } from "@/lib/servidor/catalogo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "juego" });
  return { title: t("titulo"), description: t("intro") };
}

const MODOS = [
  { id: "clasico", color: "var(--color-amarillo)" },
  { id: "historia", color: "var(--color-verde)" },
] as const;

const PARTES = ["preparacion", "turno", "final"] as const;

const MECANICAS = [
  { id: "estrella", clave: "estrella" },
  { id: "comodin", clave: "comodin" },
  { id: "en-blanco", clave: "enBlanco" },
] as const;

/** Ancla de la sección de reglas: las pestañas bajan hasta aquí al llegar con #clasico o #historia. */
const ID_REGLAS = "reglas";

export default async function ComoJugar({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("juego");
  const tm = await getTranslations("modos");
  const n = await getTranslations("nav");
  const tcaja = await getTranslations("juego.contenidoCaja");
  const catalogo = await obtenerCatalogo();
  const packs = packsActivos(catalogo);
  const iconoDe = (id: string) => catalogo.mecanicas.find((m) => m.id === id)?.icono ?? null;
  const pasos = (clave: `${(typeof MODOS)[number]["id"]}.${(typeof PARTES)[number]}`) => t.raw(clave) as string[];
  const personas = Array.from({ length: MAX_PERSONAS - 1 }, (_, i) => i + 2);

  const paneles: PanelModo[] = MODOS.map((m) => ({
    id: m.id,
    nombre: tm(`${m.id}.nombre`),
    color: m.color,
    contenido: (
      <div className="rounded-[var(--radius-carta)] bg-[#1f1f1f] p-5 sm:p-8">
        <p className="max-w-3xl text-md text-papel/90">{tm(`${m.id}.resumen`)}</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          <li>
            <Chip color={m.color} className="text-tinta">
              {tm(`${m.id}.etiqueta`)}
            </Chip>
          </li>
          <li>
            <Chip className="text-tinta">{tm(`${m.id}.jugadores`)}</Chip>
          </li>
          <li>
            <Chip className="text-tinta">{t("reglas.cartasPorPersona", { n: CARTAS_POR_PERSONA })}</Chip>
          </li>
        </ul>
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {PARTES.map((parte) => (
            <section key={parte}>
              <h3 className="tipo-subtitular text-lg">{t(parte)}</h3>
              <ol className="mt-3 space-y-3">
                {pasos(`${m.id}.${parte}`).map((paso, i) => (
                  <li key={paso} className="flex gap-3">
                    <span aria-hidden="true" className="tipo-titular mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.85rem] leading-none text-tinta" style={{ background: m.color }}>
                      {i + 1}
                    </span>
                    <span className="text-papel/90">{paso}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        {m.id === "historia" && (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <section className="rounded-[14px] bg-papel/10 p-5">
              <h3 className="tipo-subtitular text-lg">{t("reglas.vidasTitulo")}</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {personas.map((p) => (
                  <li key={p}>
                    <Chip className="text-tinta">{t("reglas.vidasFila", { personas: p, vidas: vidas(p) })}</Chip>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-[14px] bg-papel/10 p-5">
              <h3 className="tipo-subtitular text-lg">{t("historia.completa")}</h3>
              <p className="mt-1 text-papel/90">{t("historia.completaTexto")}</p>
              <p className="mt-3 text-sm font-semibold">{t("reglas.completaVidas")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {packs.map((p) => (
                  <li key={p.id}>
                    <Chip className="text-tinta">{t("reglas.packVidas", { pack: textoEn(p.nombre, locale), vidas: vidasHistoriaCompleta(p.cartas) })}</Chip>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-papel/75">{t("historia.dificultad")}</p>
            </section>
          </div>
        )}
      </div>
    ),
  }));

  return (
    <>
      <CintaPrototipo />
      <Cabecera />
      <main id="contenido">
        <Seccion className="pb-8 pt-12 sm:pt-16">
          <Micro className="text-tinta-2">{n("comoJugar")}</Micro>
          <h1 className="tipo-titular mt-3 max-w-3xl text-[clamp(2.6rem,8vw,5rem)] leading-[0.9]">{t("titulo")}</h1>
          <p className="mt-5 max-w-2xl text-md text-tinta-2">{t("intro")}</p>
        </Seccion>

        {/* La mesa con una partida en marcha */}
        <Seccion className="pb-14">
          <h2 className="tipo-titular text-3xl">{t("mesa.titulo")}</h2>
          <p className="mb-6 mt-3 max-w-2xl text-md text-tinta-2">{t("mesa.texto")}</p>
          <MesaPartida idioma={locale} iconos={{ comodin: iconoDe("comodin"), enBlanco: iconoDe("en-blanco") }} />
        </Seccion>

        <Seccion className="pb-14">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[var(--radius-carta)] bg-blanco p-6">
              <h2 className="tipo-subtitular text-xl">{t("componentes")}</h2>
              <p className="mt-2 text-tinta-2">{textoContenidoCaja(catalogo.mecanicas, locale, (clave, valores) => tcaja(clave, valores))}</p>
            </div>
            <div className="rounded-[var(--radius-carta)] bg-blanco p-6">
              <h2 className="tipo-subtitular text-xl">{t("jugadores.titulo")}</h2>
              <p className="mt-2 text-tinta-2">{t("jugadores.texto")}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {packs.map((p) => {
                  const j = jugadoresPorMazo(p.cartas);
                  return (
                    <li key={p.id}>
                      <span className="font-semibold">{textoEn(p.nombre, locale)}</span>: {t("jugadores.rango", { n: j.recomendado })}
                      {j.maximo > j.recomendado && ` (${t("jugadores.maximo", { n: j.maximo })})`}
                      {j.porParejas && `. ${t("jugadores.parejas")}`}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Seccion>

        {/* Reglas de los dos tipos de juego, en pestañas */}
        <div id={ID_REGLAS} className="scroll-mt-16 bg-tinta py-16 text-papel">
          <Seccion>
            <h2 className="tipo-titular max-w-3xl text-3xl">{t("tiposTitulo")}</h2>
            <p className="mb-8 mt-4 max-w-2xl text-md text-papel/80">{t("tiposTexto")}</p>
            <PestanasModos paneles={paneles} etiqueta={t("reglas.etiqueta")} idSeccion={ID_REGLAS} />
            <p className="tipo-subtitular mt-8 max-w-2xl rounded-[var(--radius-carta)] bg-amarillo p-6 text-xl text-tinta">{t("consejo")}</p>
          </Seccion>
        </div>

        <Seccion className="py-16">
          <div className="grid items-center gap-8 rounded-[28px] bg-papel-2 p-6 sm:p-10 lg:grid-cols-[1fr_minmax(0,420px)]">
            <div>
              <h2 className="tipo-titular text-3xl">{t("fechas")}</h2>
              <p className="mt-4 max-w-xl text-md text-tinta-2">{t("fechasTexto")}</p>
            </div>
            <EjemplosPrecision idioma={locale} />
          </div>
        </Seccion>

        <Seccion className="pb-16">
          <h2 className="tipo-titular text-3xl">{t("mecanicas.titulo")}</h2>
          <p className="mt-3 max-w-2xl text-md text-tinta-2">{t("mecanicas.texto")}</p>
          <ul className="mt-6 grid gap-3 md:grid-cols-3">
            {MECANICAS.map((m) => (
              <li key={m.id} className="rounded-[var(--radius-carta)] bg-blanco p-5">
                <div className="flex items-center gap-3">
                  <IconoMecanica icono={iconoDe(m.id)} />
                  <h3 className="tipo-subtitular text-lg">{t(`mecanicas.${m.clave}.nombre`)}</h3>
                </div>
                {m.clave === "enBlanco" ? (
                  <p className="mt-3 text-tinta-2">{t("mecanicas.enBlanco.texto")}</p>
                ) : (
                  <dl className="mt-3 space-y-2 text-sm">
                    {MODOS.map((modo) => (
                      <div key={modo.id}>
                        <dt className="font-semibold">{tm(`${modo.id}.nombre`)}</dt>
                        <dd className="text-tinta-2">{t(`mecanicas.${m.clave}.${modo.id}`)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion className="pb-16">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-[28px] bg-rosa p-8 sm:p-10">
            <div className="max-w-xl">
              <h2 className="tipo-titular text-3xl">{t("cta.titulo")}</h2>
              <p className="mt-3 text-md">{t("cta.texto")}</p>
            </div>
            <BotonEnlace href="/crear" tamano="lg">
              {n("crear")}
            </BotonEnlace>
          </div>
        </Seccion>
      </main>
      <Pie />
    </>
  );
}
