import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Tv, Refrigerator, AirVent, WashingMachine, ShieldCheck, HeartHandshake, Truck, Wrench, Phone } from "lucide-react";
import heroImage from "@/assets/hero-showroom.jpg";
import { SiteLayout } from "@/components/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ghandi Home Electro | Électroménager à Casablanca" },
      {
        name: "description",
        content:
          "Ghandi Home Electro : téléviseurs, réfrigérateurs, climatiseurs et machines à laver au 41 Boulevard Ghandi, Casablanca. Conseil et service de proximité.",
      },
      { property: "og:title", content: "Ghandi Home Electro | Électroménager à Casablanca" },
      {
        property: "og:description",
        content: "Téléviseurs, réfrigérateurs, climatiseurs et machines à laver à Casablanca.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t } = useI18n();

  const categories = [
    { icon: Tv, title: t("cats.tv"), desc: t("cats.tv.desc") },
    { icon: Refrigerator, title: t("cats.fridge"), desc: t("cats.fridge.desc") },
    { icon: AirVent, title: t("cats.ac"), desc: t("cats.ac.desc") },
    { icon: WashingMachine, title: t("cats.washer"), desc: t("cats.washer.desc") },
  ];

  const features = [
    { icon: ShieldCheck, title: t("features.1.title"), desc: t("features.1.desc") },
    { icon: HeartHandshake, title: t("features.2.title"), desc: t("features.2.desc") },
    { icon: Truck, title: t("features.3.title"), desc: t("features.3.desc") },
    { icon: Wrench, title: t("features.4.title"), desc: t("features.4.desc") },
  ];

  return (
    <SiteLayout>
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 end-[-10%] h-[520px] w-[520px] rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <Reveal variant="left">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-1.5 text-xs font-semibold tracking-wide text-brand-deep uppercase">
                {t("hero.badge")}
              </span>
            </Reveal>
            <Reveal variant="left" delay={120}>
              <h1 className="mt-6 text-4xl leading-[1.08] font-bold sm:text-5xl lg:text-6xl">
                {t("hero.title")}
              </h1>
            </Reveal>
            <Reveal variant="left" delay={220}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-foreground/70 sm:text-lg">
                {t("hero.subtitle")}
              </p>
            </Reveal>
            <Reveal variant="left" delay={320}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  to="/produits"
                  className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.03]"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {t("hero.cta")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-brand/30 px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
                >
                  {t("hero.cta2")}
                </Link>
              </div>
            </Reveal>
            <Reveal variant="up" delay={420}>
              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-8">
                {[
                  { k: "4", v: t("hero.stat1") },
                  { k: "1:1", v: t("hero.stat2") },
                  { k: "🇲🇦", v: t("hero.stat3") },
                ].map((s) => (
                  <div key={s.v}>
                    <dt className="text-2xl font-bold text-brand">{s.k}</dt>
                    <dd className="mt-1 text-xs leading-snug text-foreground/60">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal variant="zoom" delay={180} className="relative">
            <div className="overflow-hidden rounded-[2rem] border border-border shadow-[var(--shadow-card)]">
              <img
                src={heroImage}
                alt="Showroom d'électroménager Ghandi Home Electro à Casablanca"
                className="h-full w-full object-cover"
                width={1024}
                height={1024}
              />
            </div>
            <div className="absolute -bottom-6 start-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
              <Phone className="h-5 w-5 text-brand" />
              <div>
                <p className="text-[0.7rem] tracking-wide text-foreground/55 uppercase">
                  {t("contact.phone")}
                </p>
                <a href={COMPANY.phoneHref} className="text-sm font-semibold hover:text-brand">
                  {COMPANY.phone}
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <Reveal>
          <h2 className="text-3xl font-bold sm:text-4xl">{t("cats.title")}</h2>
          <p className="mt-3 max-w-2xl text-foreground/65">{t("cats.subtitle")}</p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c, i) => (
            <Reveal key={c.title} delay={i * 110}>
              <Link
                to="/produits"
                className="group block h-full rounded-3xl border border-border bg-card p-7 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-2 hover:border-brand/40"
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <c.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-6 text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/65">{c.desc}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                  {t("hero.cta")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-brand-soft/50 py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Reveal>
            <h2 className="text-3xl font-bold sm:text-4xl">{t("features.title")}</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {features.map((f, i) => (
              <Reveal key={f.title} variant={i % 2 === 0 ? "left" : "right"} delay={i * 90}>
                <div className="flex h-full gap-5 rounded-3xl border border-border bg-card p-7">
                  <f.icon className="h-7 w-7 shrink-0 text-brand" />
                  <div>
                    <h3 className="text-lg font-semibold">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/65">{f.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <Reveal variant="zoom">
          <div
            className="relative overflow-hidden rounded-[2rem] px-8 py-14 text-center text-primary-foreground sm:px-16"
            style={{ background: "var(--gradient-brand)" }}
          >
            <h2 className="text-3xl font-bold sm:text-4xl">{t("cta.title")}</h2>
            <p className="mx-auto mt-4 max-w-xl opacity-90">{t("cta.subtitle")}</p>
            <a
              href={COMPANY.phoneHref}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-background px-7 py-3 text-sm font-semibold text-brand transition-transform hover:scale-[1.04]"
            >
              <Phone className="h-4 w-4" /> {t("cta.call")}
            </a>
          </div>
        </Reveal>
      </section>
    </SiteLayout>
  );
}