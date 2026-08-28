import { useMemo, useState } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ChevronRight, Home, PackageSearch, Search, SlidersHorizontal, X } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { ProductCard } from "@/components/ProductCard";
import { CatalogTile } from "@/components/CatalogTile";
import {
  childrenOf,
  findChildBySlug,
  productsIn,
  searchProducts,
  type CatalogNode,
  type SiteData,
} from "@/lib/catalog-types";

export const Route = createFileRoute("/produits/$")({
  head: () => ({
    meta: [
      { title: "Catalogue | Ghandi Home Electro" },
      {
        name: "description",
        content:
          "Parcourez le catalogue Ghandi Home Electro par catégorie, type d'appareil et modèle.",
      },
      { property: "og:title", content: "Catalogue | Ghandi Home Electro" },
      { property: "og:type", content: "website" },
      {
        property: "og:description",
        content: "Parcourez le catalogue Ghandi Home Electro par catégorie et type d'appareil.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Catalogue | Ghandi Home Electro" },
      {
        name: "twitter:description",
        content: "Parcourez le catalogue Ghandi Home Electro par catégorie et type d'appareil.",
      },
    ],
  }),
  component: BrowsePage,
});

function BrowsePage() {
  const { _splat } = Route.useParams();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const [query, setQuery] = useState("");

  const segments = (_splat ?? "").split("/").filter(Boolean);
  const trail: CatalogNode[] = [];
  let parentId: string | null = null;
  let missing = false;
  for (const segment of segments) {
    const node = findChildBySlug(data.nodes, parentId, segment);
    if (!node) {
      missing = true;
      break;
    }
    trail.push(node);
    parentId = node.id;
  }

  const current = trail.at(-1) ?? null;
  const term = query.trim();
  const allFolders = missing ? [] : childrenOf(data.nodes, current?.id ?? null);
  /** Models live directly in this node; sub-formats are browsed as their own tiles. */
  const ownProducts =
    current && current.level >= 3 ? data.products.filter((p) => p.node_id === current.id) : [];

  /** Search covers everything under the current rayon: name, reference, brand, folder path. */
  const scoped = useMemo(
    () =>
      missing
        ? []
        : current
          ? productsIn(data.nodes, data.products, current.id)
          : data.products,
    [data.nodes, data.products, current, missing],
  );
  const matches = useMemo(
    () => (term ? searchProducts(data.nodes, scoped, term) : []),
    [data.nodes, scoped, term],
  );
  const folders = term
    ? allFolders.filter((n) => n.name.toLowerCase().includes(term.toLowerCase()))
    : allFolders;
  const products = term ? matches : ownProducts;
  const pathTo = (index: number) => trail.slice(0, index + 1).map((n) => n.slug).join("/");

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-6xl px-5 py-16">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm">
          <Link to="/produits" className="inline-flex items-center gap-1.5 font-semibold hover:text-brand">
            <Home className="h-3.5 w-3.5" /> Produits
          </Link>
          {trail.map((node, index) => (
            <span key={node.id} className="inline-flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-foreground/35" />
              <Link
                to="/produits/$"
                params={{ _splat: pathTo(index) }}
                className="font-semibold hover:text-brand"
                activeProps={{ className: "text-brand" }}
              >
                {node.name}
              </Link>
            </span>
          ))}
        </nav>

        <Reveal className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-bold sm:text-4xl">{current?.name ?? "Catalogue"}</h1>
          <Link
            to="/produits"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground/70 hover:border-brand hover:text-brand"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Recherche &amp; filtres
          </Link>
        </Reveal>

        {missing && (
          <p className="mt-10 rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-foreground/60">
            Ce rayon n'existe pas ou plus.{" "}
            <Link to="/produits" className="font-semibold text-brand">
              Voir tout le catalogue
            </Link>
          </p>
        )}

        {folders.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {folders.map((node, index) => (
              <Reveal key={node.id} delay={(index % 4) * 90}>
                <CatalogTile
                  node={node}
                  splat={[...trail.map((n) => n.slug), node.slug].join("/")}
                  count={productsIn(data.nodes, data.products, node.id).length}
                />
              </Reveal>
            ))}
          </div>
        )}

        {current && current.level >= 3 && (products.length > 0 || folders.length === 0) && (
          <div className="mt-12">
            {products.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-dashed border-border bg-brand-soft/40 px-8 py-20 text-center">
                <PackageSearch className="h-9 w-9 text-brand" />
                <p className="text-foreground/70">Aucun produit dans ce modèle pour le moment.</p>
              </div>
            ) : (
              <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p, i) => (
                  <Reveal key={p.id} delay={(i % 3) * 110}>
                    <ProductCard product={p} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
