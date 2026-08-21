import { useMemo, useState } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ChevronRight, PackageSearch, Search, X } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { ProductCard } from "@/components/ProductCard";
import { useI18n } from "@/lib/i18n";
import {
  ancestorAtLevel,
  childrenOf,
  searchProducts,
  type SiteData,
} from "@/lib/catalog-types";
import { BRAND_NAMES } from "@/lib/brands";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/produits/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Produits | Ghandi Home Electro" },
      {
        name: "description",
        content:
          "Catalogue Ghandi Home Electro : téléviseurs, réfrigérateurs, climatiseurs et machines à laver disponibles à Casablanca.",
      },
      { property: "og:title", content: "Produits | Ghandi Home Electro" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Découvrez le catalogue d'électroménager de Ghandi Home Electro à Casablanca.",
      },
      { name: "twitter:title", content: "Produits | Ghandi Home Electro" },
      {
        name: "twitter:description",
        content: "Découvrez le catalogue d'électroménager de Ghandi Home Electro à Casablanca.",
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { t } = useI18n();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [brands, setBrands] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [availability, setAvailability] = useState<"all" | "in" | "out">("all");

  const categories = useMemo(() => childrenOf(data.nodes, null), [data.nodes]);
  const types = useMemo(
    () =>
      data.nodes
        .filter((n) => n.level === 2 && (category === "all" || n.parent_id === category))
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [data.nodes, category],
  );
  const brandOptions = useMemo(() => {
    const fromProducts = data.products.map((p) => p.brand).filter(Boolean);
    return Array.from(new Set([...BRAND_NAMES, ...fromProducts]));
  }, [data.products]);

  const products = useMemo(() => {
    const min = minPrice.trim() === "" ? null : Number(minPrice);
    const max = maxPrice.trim() === "" ? null : Number(maxPrice);
    return searchProducts(data.nodes, data.products, q).filter((p) => {
      if (category !== "all" && ancestorAtLevel(data.nodes, p.node_id, 1)?.id !== category)
        return false;
      if (type !== "all" && ancestorAtLevel(data.nodes, p.node_id, 2)?.id !== type) return false;
      if (brands.length > 0 && !brands.some((b) => b.toLowerCase() === (p.brand ?? "").toLowerCase()))
        return false;
      if (availability === "in" && p.stock <= 0) return false;
      if (availability === "out" && p.stock > 0) return false;
      if (min !== null && (p.price === null || p.price < min)) return false;
      if (max !== null && (p.price === null || p.price > max)) return false;
      return true;
    });
  }, [data.nodes, data.products, q, category, type, brands, availability, minPrice, maxPrice]);

  const anyFilter =
    q.trim() !== "" ||
    category !== "all" ||
    type !== "all" ||
    brands.length > 0 ||
    availability !== "all" ||
    minPrice !== "" ||
    maxPrice !== "";

  const reset = () => {
    setCategory("all");
    setType("all");
    setBrands([]);
    setAvailability("all");
    setMinPrice("");
    setMaxPrice("");
    navigate({ to: ".", search: { q: "" } });
  };

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <Reveal>
          <h1 className="text-4xl font-bold sm:text-5xl">{t("products.title")}</h1>
          <p className="mt-4 max-w-xl text-foreground/65">{t("products.subtitle")}</p>
        </Reveal>

        {categories.length > 0 && (
          <Reveal delay={80} className="mt-8 flex flex-wrap gap-3">
            {categories.map((node) => (
              <Link
                key={node.id}
                to="/produits/$"
                params={{ _splat: node.slug }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground/70 hover:border-brand hover:text-brand"
              >
                {node.name} <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </Reveal>
        )}

        <Reveal delay={100} className="relative mt-8">
          <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            type="search"
            value={q}
            onChange={(e) => navigate({ to: ".", search: { q: e.target.value } })}
            placeholder={t("products.search")}
            aria-label={t("products.search")}
            className="w-full rounded-full border border-border bg-card py-3 ps-11 pe-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
          />
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <Reveal variant="left" className="space-y-6 self-start rounded-3xl border border-border bg-card p-5">
            <div>
              <h2 className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
                Catégorie
              </h2>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setType("all");
                }}
                className={`mt-2 ${field}`}
              >
                <option value="all">{t("products.all")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h2 className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
                Type d'appareil
              </h2>
              <select value={type} onChange={(e) => setType(e.target.value)} className={`mt-2 ${field}`}>
                <option value="all">{t("products.all")}</option>
                {types.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h2 className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
                {t("products.brand")}
              </h2>
              <div className="mt-2 space-y-1.5">
                {brandOptions.map((b) => (
                  <label key={b} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={brands.includes(b)}
                      onChange={(e) =>
                        setBrands((prev) =>
                          e.target.checked ? [...prev, b] : prev.filter((x) => x !== b),
                        )
                      }
                      className="h-4 w-4 accent-[var(--brand)]"
                    />
                    {b}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">Prix (MAD)</h2>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min"
                  aria-label="Prix minimum"
                  className={field}
                />
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  aria-label="Prix maximum"
                  className={field}
                />
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
                Disponibilité
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { id: "all", label: t("products.all") },
                    { id: "in", label: t("product.inStock") },
                    { id: "out", label: t("product.outOfStock") },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAvailability(option.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold",
                      availability === option.id
                        ? "border-brand bg-brand text-primary-foreground"
                        : "border-border text-foreground/65 hover:border-brand hover:text-brand",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {anyFilter && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-2 text-sm font-semibold text-foreground/60 hover:border-brand hover:text-brand"
              >
                <X className="h-3.5 w-3.5" /> {t("products.reset")}
              </button>
            )}
          </Reveal>

          <div>
            {products.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-dashed border-border bg-brand-soft/40 px-8 py-20 text-center">
                <PackageSearch className="h-9 w-9 text-brand" />
                <p className="max-w-md text-foreground/70">
                  {data.products.length === 0
                    ? t("products.empty")
                    : anyFilter
                      ? t("products.emptySearch")
                      : t("products.emptyCat")}
                </p>
              </div>
            ) : (
              <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p, i) => (
                  <Reveal key={p.id} delay={(i % 3) * 110}>
                    <ProductCard product={p} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
