import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import logo from "@/assets/ghandi-logo.png.asset.json";
import { ContentPage, RichText, pageMeta } from "@/components/ContentPage";
import { useCompany } from "@/lib/company";
import { useI18n } from "@/lib/i18n";
import type { SiteData } from "@/lib/catalog-types";

export const Route = createFileRoute("/qui-sommes-nous")({
  head: () => pageMeta("Qui sommes-nous | Ghandi Home Electro", "Ghandi Home Electro, magasin d'électroménager et de TV au 41 Boulevard Ghandi à Casablanca."),
  component: AboutPage,
});

function AboutPage() {
  const { t } = useI18n();
  const c = useCompany();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const custom = data.settings.content?.pages?.["about"]?.body?.trim();
  return (
    <ContentPage title="Qui sommes-nous">
      <div className="panel mt-3 grid gap-6 p-5 sm:p-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h1 className="text-2xl font-bold">{t("about.title")}</h1>
          {custom ? <div className="mt-4"><RichText text={custom} /></div> : <p className="mt-4 leading-relaxed text-text-2">{t("about.body")}</p>}
          <div className="mt-6 rounded-md bg-page p-4">
            <p className="text-xs text-text-3 uppercase">{t("about.founder")}</p>
            <p className="mt-1 font-bold">{c.founder}</p>
            <p className="mt-2 text-sm text-text-2">{c.address}</p>
          </div>
        </div>
        <div className="grid place-items-center rounded-md bg-page p-8">
          {c.photos[0] ? <img src={c.photos[0]} alt="Magasin Ghandi Home Electro" className="w-full rounded-md object-cover" /> : <img src={logo.url} alt={c.name} className="w-full max-w-[220px] object-contain" />}
        </div>
      </div>
    </ContentPage>
  );
}
