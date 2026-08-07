import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import { COMPANY } from "@/lib/company";
import logo from "@/assets/ghandi-logo.png.asset.json";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos | Ghandi Home Electro" },
      {
        name: "description",
        content:
          "Ghandi Home Electro, magasin d'électroménager familial fondé par Khaled Douiou au cœur de Casablanca.",
      },
      { property: "og:title", content: "À propos | Ghandi Home Electro" },
      {
        property: "og:description",
        content: "Un magasin d'électroménager familial de confiance à Casablanca.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { t } = useI18n();
  return (
    <SiteLayout>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-20 lg:grid-cols-2">
        <div>
          <Reveal variant="left">
            <span className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">
              {t("about.eyebrow")}
            </span>
          </Reveal>
          <Reveal variant="left" delay={120}>
            <h1 className="mt-5 text-4xl font-bold sm:text-5xl">{t("about.title")}</h1>
          </Reveal>
          <Reveal variant="left" delay={220}>
            <p className="mt-6 leading-relaxed text-foreground/70">{t("about.body")}</p>
          </Reveal>
          <Reveal variant="up" delay={320}>
            <div className="mt-8 rounded-3xl border border-border bg-card p-6">
              <p className="text-xs tracking-wide text-foreground/55 uppercase">
                {t("about.founder")}
              </p>
              <p className="mt-1 text-lg font-semibold">{COMPANY.founder}</p>
              <p className="mt-3 text-sm text-foreground/65">{COMPANY.address}</p>
            </div>
          </Reveal>
        </div>
        <Reveal variant="right" delay={160}>
          <div className="flex items-center justify-center rounded-[2rem] border border-border bg-brand-soft/60 p-16">
            <img src={logo.url} alt={COMPANY.name} className="w-full max-w-xs object-contain" />
          </div>
        </Reveal>
      </section>
    </SiteLayout>
  );
}