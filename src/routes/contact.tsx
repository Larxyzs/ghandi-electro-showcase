import { createFileRoute } from "@tanstack/react-router";
import { Phone, MapPin, Clock } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact | Ghandi Home Electro Casablanca" },
      {
        name: "description",
        content:
          "Contactez Ghandi Home Electro : +212 611 945 25, 41 Boulevard Ghandi, Casablanca-Settat. Ouvert du lundi au samedi.",
      },
      { property: "og:title", content: "Contact | Ghandi Home Electro" },
      {
        property: "og:description",
        content: "Appelez-nous ou passez au magasin au 41 Boulevard Ghandi, Casablanca.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  const cards = [
    { icon: Phone, label: t("contact.phone"), value: COMPANY.phone, href: COMPANY.phoneHref },
    { icon: MapPin, label: t("contact.address"), value: COMPANY.address, href: COMPANY.mapsHref },
    { icon: Clock, label: t("contact.hours"), value: t("contact.hours.value") },
  ];

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <Reveal>
          <h1 className="text-4xl font-bold sm:text-5xl">{t("contact.title")}</h1>
          <p className="mt-4 max-w-xl text-foreground/65">{t("contact.subtitle")}</p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.label} delay={i * 110}>
              <div className="h-full rounded-3xl border border-border bg-card p-7 shadow-[var(--shadow-card)]">
                <c.icon className="h-6 w-6 text-brand" />
                <p className="mt-5 text-xs tracking-wide text-foreground/55 uppercase">{c.label}</p>
                {c.href ? (
                  <a
                    href={c.href}
                    target={c.href.startsWith("http") ? "_blank" : undefined}
                    rel="noreferrer"
                    className="mt-1 block font-semibold hover:text-brand"
                  >
                    {c.value}
                  </a>
                ) : (
                  <p className="mt-1 font-semibold">{c.value}</p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal variant="zoom" delay={160} className="mt-12">
          <iframe
            title="Carte Ghandi Home Electro"
            src="https://www.google.com/maps?q=41+Boulevard+Ghandi+Casablanca&output=embed"
            className="h-[420px] w-full rounded-[2rem] border border-border"
            loading="lazy"
          />
        </Reveal>
      </section>
    </SiteLayout>
  );
}