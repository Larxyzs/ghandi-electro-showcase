import { useMemo, useState } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { PackageSearch, Search, X } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { useI18n } from "@/lib/i18n";
import type { SiteData } from "@/lib/catalog-types";
import { BRAND_NAMES } from "@/lib/brands";
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
  const [brand, setBrand] = useState<string>("all");
  const [query, setQuery] = useState("");

  const brandOptions = useMemo(() => {
    const fromProducts = data.products.map((p) => p.brand).filter(Boolean);
    return Array.from(new Set([...BRAND_NAMES, ...fromProducts]));
  }, [data.products]);

  const categoryName = useMemo(
    () => new Map(data.categories.map((c) => [c.id, c.name])),
    [data.categories],
  );

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.products.filter((p) => {
      if (active !== "all" && p.category_id !== active) return false;
      if (brand !== "all" && (p.brand ?? "").toLowerCase() !== brand.toLowerCase()) return false;
      if (!q) return true;
      const haystack = [p.name, p.brand, p.serial_number, categoryName.get(p.category_id) ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [active, brand, query, data.products, categoryName]);

  const filtered = query.trim() !== "" || brand !== "all" || active !== "all";

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <Reveal>
          <h1 className="text-4xl font-bold sm:text-5xl">{t("products.title")}</h1>
          <p className="mt-4 max-w-xl text-foreground/65">{t("products.subtitle")}</p>
        </Reveal>

        <Reveal delay={100} className="mt-10 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("products.search")}
              aria-label={t("products.search")}
              className="w-full rounded-full border border-border bg-card py-3 ps-11 pe-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            />
          </div>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            aria-label={t("products.brand")}
            className="rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold outline-none focus:border-brand"
          >
            <option value="all">{t("products.allBrands")}</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
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
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setActive("all");
                  setBrand("all");
                  setQuery("");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-5 py-2 text-sm font-semibold text-foreground/60 hover:border-brand hover:text-brand"
              >
                <X className="h-3.5 w-3.5" /> {t("products.reset")}
              </button>
            )}
          </Reveal>
        )}

        {products.length === 0 ? (
          <Reveal delay={160}>
            <div className="mt-14 flex flex-col items-center gap-4 rounded-[2rem] border border-dashed border-border bg-brand-soft/40 px-8 py-20 text-center">
              <PackageSearch className="h-9 w-9 text-brand" />
              <p className="max-w-md text-foreground/70">
                {data.products.length === 0
                  ? t("products.empty")
                  : filtered
                    ? t("products.emptySearch")
                    : t("products.emptyCat")}
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
                    {p.brand && (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand">
                        {p.brand}
                      </p>
                    )}
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