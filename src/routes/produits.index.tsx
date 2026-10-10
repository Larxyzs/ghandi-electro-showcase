import { useMemo } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductBrowser } from "@/components/ProductBrowser";
import { searchProducts, type SiteData } from "@/lib/catalog-types";

export const Route = createFileRoute("/produits/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search["q"] === "string" && search["q"] !== "" ? { q: search["q"] } : {},
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
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const { q = "" } = Route.useSearch();
  const products = useMemo(() => searchProducts(data.nodes, data.products, q), [data.nodes, data.products, q]);
  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-7xl px-5 py-8">
        <nav className="flex items-center gap-1.5 text-sm text-foreground/65">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-brand"><Home className="h-3.5 w-3.5" /> Accueil</Link>
          <ChevronRight className="h-3.5 w-3.5 text-foreground/35" />
          <span className="font-semibold text-foreground">{q ? "Recherche" : "Tous les produits"}</span>
        </nav>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">
          {q ? `Résultats pour « ${q} »` : "Tous les produits"}{" "}
          <span className="text-base font-medium text-foreground/50">({products.length} produit{products.length === 1 ? "" : "s"})</span>
        </h1>
        <div className="mt-6">
          <ProductBrowser key={q} products={products} />
        </div>
      </section>
    </SiteLayout>
  );
}
