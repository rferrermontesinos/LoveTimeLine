import { getTranslations } from "next-intl/server";
import { BRAND_NAME } from "@config/brand";
import { Link } from "@/i18n/navigation";
import { Marca } from "./Cabecera";

export async function Pie() {
  const t = await getTranslations("pie");
  const n = await getTranslations("nav");
  return (
    <footer className="mt-24 bg-tinta text-papel">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <Marca className="[&_span:last-child]:text-papel" />
          <p className="max-w-md text-sm text-papel/80">{t("texto", { marca: BRAND_NAME })}</p>
          <p className="text-sm text-papel/70">{t("fuentes")}</p>
        </div>
        <nav aria-label={n("pie")} className="grid grid-cols-2 gap-2 text-sm">
          <Link className="hover:underline" href="/crear">
            {n("crear")}
          </Link>
          <Link className="hover:underline" href="/como-jugar">
            {n("comoJugar")}
          </Link>
          <Link className="hover:underline" href="/privacidad">
            {n("privacidad")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
