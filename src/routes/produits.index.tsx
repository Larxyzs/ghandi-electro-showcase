import { useMemo, useState } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import type { SiteData } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produits/")({
  head: () => ({
    meta: [
      { title: "Produits | Ghandi Home Electro" },
      {
        name: "description",
        content:
          "Catalogue Ghandi Home Electro : téléviseurs, réfrigérateurs, climatiseurs et machines à laver disponibles à Casablanca.",
      },
      { property: "og:title", content: "Produits | Ghandi Home Electro" },
      {
        property: "og:description",
        content: "Découvrez le catalogue d'électroménager de Ghandi Home Electro à Casablanca.",
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { t } = useI18n();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const [active, setActive] = useState<string>("all");

  const products = useMemo(
    () => (active === "all" ? data.products : data.products.filter((p) => p.category_id === active)),
    [active, data.products],
  );

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <Reveal>
          <h1 className="text-4xl font-bold sm:text-5xl">{t("products.title")}</h1>
          <p className="mt-4 max-w-xl text-foreground/65">{t("products.subtitle")}</p>
        </Reveal>

        {data.categories.length > 0 && (
          <Reveal delay={120} className="mt-10 flex flex-wrap gap-3">
            {[{ id: "all", name: t("products.all") }, ...data.categories].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={cn(
                  "rounded-full border px-5 py-2 text-sm font-semibold transition-colors",
                  active === c.id
                    ? "border-brand bg-brand text-primary-foreground"
                    : "border-border text-foreground/70 hover:border-brand hover:text-brand",
                )}
              >
                {c.name}
              </button>
            ))}
          </Reveal>
        )}

        {products.length === 0 ? (
          <Reveal delay={160}>
            <div className="mt-14 flex flex-col items-center gap-4 rounded-[2rem] border border-dashed border-border bg-brand-soft/40 px-8 py-20 text-center">
              <PackageSearch className="h-9 w-9 text-brand" />
              <p className="max-w-md text-foreground/70">
                {data.products.length === 0 ? t("products.empty") : t("products.emptyCat")}
              </p>
            </div>
          </Reveal>
        ) : (
          <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 110}>
                <Link
                  to="/produits/$productId"
                  params={{ productId: p.id }}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-2 hover:border-brand/40"
                >
                  <div className="relative aspect-4/3 overflow-hidden bg-brand-soft/50">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-brand/40">
                        <PackageSearch className="h-10 w-10" />
                      </div>
                    )}
                    <span
                      className={cn(
                        "absolute top-3 end-3 rounded-full px-3 py-1 text-[0.7rem] font-semibold",
                        p.stock > 0
                          ? "bg-brand text-primary-foreground"
                          : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {p.stock > 0 ? t("product.inStock") : t("product.outOfStock")}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    {p.serial_number && (
                      <p className="mt-1 text-xs text-foreground/50">
                        {t("product.serial")} : {p.serial_number}
                      </p>
                    )}
                    <p className="mt-3 line-clamp-2 text-sm text-foreground/65">{p.description}</p>
                    {p.price !== null && (
                      <p className="mt-4 text-lg font-bold text-brand">
                        {p.price.toLocaleString("fr-MA")} MAD
                      </p>
                    )}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}