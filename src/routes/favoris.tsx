import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { useFavorites } from "@/lib/favorites";
import type { SiteData } from "@/lib/catalog-types";

export const Route = createFileRoute("/favoris")({
  head: () => ({
    meta: [
      { title: "Mes favoris | Ghandi Home Electro" },
      { name: "description", content: "Les appareils que vous avez gardés en favoris chez Ghandi Home Electro." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Mes favoris | Ghandi Home Electro" },
      { property: "og:description", content: "Vos appareils favoris." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const ids = useFavorites();
  const products = ids.map((id) => data.products.find((p) => p.id === id)).filter((p) => p !== undefined);
  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-7xl px-5 py-10">
        <h1 className="text-2xl font-bold">Mes favoris ({products.length})</h1>
        {products.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
            <Heart className="h-8 w-8 text-brand" />
            <p className="text-sm text-foreground/65">Cliquez sur le cœur d'un produit pour le garder ici.</p>
            <Link to="/produits" className="font-semibold text-brand">Voir les produits</Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
