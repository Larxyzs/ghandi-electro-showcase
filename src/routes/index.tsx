import { useMemo } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ArrowRight, PackageSearch, Phone, Search, Sparkles } from "lucide-react";
import logo from "@/assets/ghandi-logo.png.asset.json";
import { SiteLayout } from "@/components/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { BrandMarquee } from "@/components/BrandMarquee";
import { CatalogTile } from "@/components/CatalogTile";
import { ProductCard } from "@/components/ProductCard";
import { useI18n } from "@/lib/i18n";
import { COMPANY } from "@/lib/company";
import { childrenOf, productsIn, type SiteData } from "@/lib/catalog-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ghandi Home Electro | Électroménager à Casablanca" },
      {
        name: "description",
        content:
          "Ghandi Home Electro : téléviseurs, réfrigérateurs, climatiseurs et machines à laver au 41 Boulevard Ghandi, Casablanca. Parcourez le catalogue par rayon.",
      },
      { property: "og:title", content: "Ghandi Home Electro | Électroménager à Casablanca" },
      { property: "og:type", content: "website" },
      {
        property: "og:description",
        content: "Parcourez nos rayons : téléviseurs, réfrigérateurs, climatiseurs, lavage.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ghandi Home Electro" },
      {
        name: "twitter:description",
        content: "Parcourez nos rayons : téléviseurs, réfrigérateurs, climatiseurs, lavage.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t } = useI18n();
  const data = useLoaderData({ from: "__root__" }) as SiteData;

  const categories = useMemo(() => childrenOf(data.nodes, null), [data.nodes]);
  const featured = useMemo(() => data.products.filter((p) => p.featured).slice(0, 8), [data.products]);

  return (
    <SiteLayout>
      {/* Compact brand line — the catalog is the star of this page. */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="aurora pointer-events-none absolute -top-40 end-[-10%] h-[420px] w-[420px] rounded-full opacity-25"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(70%_70%_at_50%_0%,black,transparent)]" />
        <div className="relative mx-auto w-full max-w-6xl px-5 py-10 sm:py-12">
          <Reveal variant="blur" className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <img
                src={logo.url}
                alt="Logo Ghandi Home Electro"
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 object-contain"
              />
              <div>
                <h1 className="text-2xl leading-tight font-bold sm:text-3xl">
                  <span
                    className="gradient-pan bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(120deg, var(--ink) 0%, var(--brand-deep) 60%, var(--brand) 100%)",
                    }}
                  >
                    Ghandi Home Electro
                  </span>
                </h1>
                <p className="mt-1 text-sm text-foreground/65 sm:text-base">
                  Électroménager à Casablanca — TV, froid, lavage, climatisation.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/produits"
                className="shine group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: "var(--gradient-brand)" }}
              >
                <Search className="h-4 w-4" /> {t("hero.cta")}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a
                href={COMPANY.phoneHref}
                className="inline-flex items-center gap-2 rounded-full border border-brand/30 px-6 py-3 text-sm font-semibold text-brand transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-soft"
              >
                <Phone className="h-4 w-4" /> {COMPANY.phone}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Category entry points */}
      <section className="mx-auto w-full max-w-6xl px-5 py-12">
        <Reveal variant="blur" className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-bold sm:text-3xl">Nos rayons</h2>
          <Link
            to="/produits"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
          >
            Tout le catalogue <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        {categories.length === 0 ? (
          <p className="mt-8 rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center text-sm text-foreground/60">
            Le catalogue arrive très bientôt.
          </p>
        ) : (
          <Reveal delay={90} className="mt-8">
            {/* Horizontal scroll on mobile, grid from sm up. */}
            <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-5">
              {categories.map((node) => (
                <div key={node.id} className="w-36 shrink-0 snap-start sm:w-auto">
                  <CatalogTile
                    node={node}
                    splat={node.slug}
                    count={productsIn(data.nodes, data.products, node.id).length}
                    shape="circle"
                  />
                </div>
              ))}
            </div>
          </Reveal>
        )}
      </section>

      {/* Featured models */}
      <section className="border-y border-border bg-brand-soft/40 py-16">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Reveal variant="blur" className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="inline-flex items-center gap-2 text-2xl font-bold sm:text-3xl">
                <Sparkles className="h-6 w-6 text-brand" /> Modèles en vedette
              </h2>
              <p className="mt-2 text-foreground/65">
                Une sélection mise en avant par le magasin.
              </p>
            </div>
          </Reveal>

          {featured.length === 0 ? (
            <div className="mt-8 flex flex-col items-center gap-3 rounded-[2rem] border border-dashed border-border bg-card px-8 py-16 text-center">
              <PackageSearch className="h-8 w-8 text-brand" />
              <p className="text-sm text-foreground/65">
                Aucun modèle en vedette pour l'instant.{" "}
                <Link to="/produits" className="font-semibold text-brand hover:underline">
                  Parcourir le catalogue
                </Link>
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((p, i) => (
                <Reveal key={p.id} delay={(i % 4) * 90}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Brands, further down */}
      <section className="py-14">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Reveal>
            <h2 className="text-center text-2xl font-bold sm:text-3xl">{t("brands.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-foreground/65">
              {t("brands.subtitle")}
            </p>
          </Reveal>
        </div>
        <Reveal delay={120} className="mt-8">
          <BrandMarquee />
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20">
        <Reveal variant="zoom">
          <div
            className="gradient-pan relative overflow-hidden rounded-[2rem] px-8 py-12 text-center text-primary-foreground sm:px-16"
            style={{ background: "var(--gradient-brand)" }}
          >
            <h2 className="text-2xl font-bold sm:text-3xl">{t("cta.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl opacity-90">{t("cta.subtitle")}</p>
            <a
              href={COMPANY.phoneHref}
              className="shine mt-7 inline-flex items-center gap-2 rounded-full bg-background px-7 py-3.5 text-sm font-semibold text-brand transition-transform duration-300 hover:scale-[1.05]"
            >
              <Phone className="h-4 w-4" /> {t("cta.call")}
            </a>
          </div>
        </Reveal>
      </section>
    </SiteLayout>
  );
}
