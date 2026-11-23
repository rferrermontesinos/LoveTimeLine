import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { clasesBoton } from "@/components/ui/Boton";
import { formatearImporte, packsActivos } from "@/domain/precios/cotizar";
import { textoEn, type Catalogo } from "@/domain/precios/tipos";
import { extraCajaPersonalizada } from "@/lib/mazo/derivados";
import { paisesConEnvio } from "./envio";

/** Color de la ficha de cada pack, de menor a mayor: las tintas riso que llevan texto en tinta con contraste AA. */
const COLORES = ["var(--color-rosa)", "var(--color-amarillo)", "var(--color-verde)"] as const;

/**
 * Los packs del catálogo a primera vista, en filas que se comparan de un vistazo (cartas, precio
 * y precio de cada carta de más alineados) y cada una con su botón al configurador con ese pack.
 * Todo sale del catálogo: aquí no hay ni un importe ni un número de cartas escrito a mano.
 */
export async function SelectorPacks({ catalogo, idioma, id }: { catalogo: Catalogo; idioma: string; id?: string }) {
  const t = await getTranslations("inicio.packs");
  const packs = packsActivos(catalogo);
  if (packs.length === 0) return null;
  const caja = extraCajaPersonalizada(catalogo);
  const envio = paisesConEnvio(catalogo, idioma);

  return (
    <section id={id} aria-labelledby="titulo-packs" className="scroll-mt-24">
      <h2 id="titulo-packs" className="tipo-micro text-micro text-tinta-2">
        {t("titulo")}
      </h2>
      <ul className="mt-3 space-y-2.5">
        {packs.map((p, i) => {
          const nombre = textoEn(p.nombre, idioma);
          const extra = t("extra", { precio: formatearImporte(p.precioCartaExtraCents, p.moneda, idioma) });
          return (
            <li
              key={p.id}
              data-pack={p.id}
              className="group relative flex overflow-hidden rounded-[var(--radius-carta)] bg-blanco shadow-[0_1px_2px_rgba(20,20,20,0.08)] transition-shadow duration-150 hover:shadow-[var(--shadow-carta)]"
            >
              {/* Ficha de la esquina, como la pestaña de las cartas: cuántas cartas trae el pack. */}
              <p className="flex w-14 shrink-0 flex-col items-center justify-center px-1 py-3 text-tinta sm:w-[4.75rem]" style={{ background: COLORES[i % COLORES.length] }}>
                <span className="tipo-titular text-[1.85rem] leading-[0.85] sm:text-[2.3rem]">{p.cartas}</span>
                <span className="tipo-micro mt-1 text-[0.625rem] sm:text-[0.6875rem]">{t("unidad", { n: p.cartas })}</span>
              </p>
              {/* Móvil: nombre, para quién y carta de más a la izquierda; precio y botón a la derecha.
                  Desde md, todo en una línea: así los precios quedan en columna y se comparan solos. */}
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-5">
                <div className="row-span-2 min-w-0 self-center md:row-span-1">
                  <h3 className="tipo-titular text-xl leading-none">{nombre}</h3>
                  <p className="mt-1 text-[0.8125rem] leading-snug text-tinta-2 sm:text-sm">{textoEn(p.claim, idioma)}</p>
                  <p className="mt-1 text-[0.75rem] leading-tight text-tinta-2 md:hidden">{extra}</p>
                </div>
                <p className="col-start-2 row-start-1 self-end text-right md:self-center">
                  <span className="tipo-titular block text-[1.9rem] leading-none">{formatearImporte(p.precioCents, p.moneda, idioma)}</span>
                  <span className="mt-1 hidden text-[0.8125rem] leading-tight text-tinta-2 md:block">{extra}</span>
                </p>
                <Link
                  href={`/crear?pack=${p.id}`}
                  aria-label={t("empezarCon", { pack: nombre })}
                  className={clasesBoton("primario", "sm", "col-start-2 row-start-2 min-h-11 self-start justify-self-end px-3.5 after:absolute after:inset-0 after:rounded-[var(--radius-carta)] after:content-[''] md:col-start-3 md:row-start-1 md:self-center md:px-4")}
                >
                  {t("empezar")}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      <ul className="mt-3 space-y-0.5 text-sm text-tinta-2">
        <li>{t("sinFoto")}</li>
        {caja?.precio.tipo === "fijo" && <li>{t("caja", { precio: formatearImporte(caja.precio.cents, catalogo.moneda, idioma) })}</li>}
        {envio && <li>{t("envio", { paises: envio })}</li>}
      </ul>
    </section>
  );
}
