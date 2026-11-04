import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Cabecera, CintaPrototipo } from "@/components/marco/Cabecera";
import { Pie } from "@/components/marco/Pie";
import { EjemplosPrecision } from "@/components/inicio/CartaVolteable";
import { BotonEnlace } from "@/components/ui/Boton";
import { IconoMecanica } from "@/components/ui/IconoMecanica";
import { Micro, Pestana, Seccion } from "@/components/ui/Piezas";
import { jugadoresPorMazo } from "@/domain/juego/reglas";
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

export default async function ComoJugar({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("juego");
  const tm = await getTranslations("modos");
  const n = await getTranslations("nav");
  const catalogo = await obtenerCatalogo();
  const packs = packsActivos(catalogo);
  const lista = (clave: `${(typeof MODOS)[number]["id"]}.${(typeof PARTES)[number]}`) => t.raw(clave) as string[];

  return (
    <>
      <CintaPrototipo />
      <Cabecera />
      <main id="contenido">
        <Seccion className="pb-10 pt-12 sm:pt-16">
          <Micro className="text-tinta-2">{n("comoJugar")}</Micro>
          <h1 className="tipo-titular mt-3 max-w-3xl text-[clamp(2.6rem,8vw,5rem)] leading-[0.9]">{t("titulo")}</h1>
          <p className="mt-5 max-w-2xl text-md text-tinta-2">{t("intro")}</p>
        </Seccion>

        <Seccion className="pb-14">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[var(--radius-carta)] bg-blanco p-6">
              <h2 className="tipo-subtitular text-xl">{t("componentes")}</h2>
              <p className="mt-2 text-tinta-2">{t("componentesTexto")}</p>
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

        <div className="bg-tinta py-16 text-papel">
          <Seccion>
            <h2 className="tipo-titular max-w-3xl text-3xl">{t("tiposTitulo")}</h2>
            <p className="mt-4 max-w-2xl text-md text-papel/80">{t("tiposTexto")}</p>
            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              {MODOS.map((m) => (
                <article key={m.id} className="relative overflow-hidden rounded-[var(--radius-carta)] bg-[#1f1f1f] p-6 pt-[4.8rem]">
                  <Pestana color={m.color}>{m.id === "clasico" ? "1" : "2"}</Pestana>
                  <h3 className="tipo-titular text-2xl">{tm(`${m.id}.nombre`)}</h3>
                  <p className="tipo-micro mt-1 text-micro text-papel/70">
                    {tm(`${m.id}.etiqueta`)} · {tm(`${m.id}.jugadores`)}
                  </p>
                  <p className="mt-3 text-papel/90">{tm(`${m.id}.resumen`)}</p>
                  {PARTES.map((parte) => (
                    <section key={parte} className="mt-6">
                      <h4 className="tipo-subtitular text-lg">{t(parte)}</h4>
                      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-papel/90 marker:text-papel/60">
                        {lista(`${m.id}.${parte}`).map((paso) => (
                          <li key={paso}>{paso}</li>
                        ))}
                      </ol>
                    </section>
                  ))}
                  {m.id === "historia" && (
                    <section className="mt-6 rounded-[14px] bg-papel/10 p-4">
                      <h4 className="tipo-subtitular text-lg">{t("historia.completa")}</h4>
                      <p className="mt-1 text-papel/90">{t("historia.completaTexto")}</p>
                      <p className="mt-3 text-sm text-papel/75">{t("historia.dificultad")}</p>
                    </section>
                  )}
                </article>
              ))}
            </div>
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
                  <IconoMecanica icono={catalogo.mecanicas.find((x) => x.id === m.id)?.icono} />
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
            <h2 className="tipo-titular max-w-xl text-3xl">{n("crear")}</h2>
            <BotonEnlace href="/crear">{n("crear")}</BotonEnlace>
          </div>
        </Seccion>
      </main>
      <Pie />
    </>
  );
}
