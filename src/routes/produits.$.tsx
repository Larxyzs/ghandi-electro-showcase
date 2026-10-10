import { useMemo } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { useDynamicText } from "@/lib/dynamic-text";
import { ProductBrowser } from "@/components/ProductBrowser";
import { useLiveEdit } from "@/lib/live-edit";
import { FolderLiveEditor } from "@/components/live/FolderLiveEditor";
import {
  childrenOf,
  findChildBySlug,
  productsIn,
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
  const { editing } = useLiveEdit();
  const tr = useDynamicText();

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
  const subFolders = missing ? [] : childrenOf(data.nodes, current?.id ?? null);
  const scoped = useMemo(
    () => (missing ? [] : current ? productsIn(data.nodes, data.products, current.id) : data.products),
    [data.nodes, data.products, current, missing],
  );
  const pathTo = (index: number) => trail.slice(0, index + 1).map((n) => n.slug).join("/");

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-7xl px-5 py-8">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-foreground/65">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-brand">
            <Home className="h-3.5 w-3.5" /> Accueil
          </Link>
          {trail.map((node, index) => (
            <span key={node.id} className="inline-flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-foreground/35" />
              <Link to="/produits/$" params={{ _splat: pathTo(index) }} className="hover:text-brand" activeProps={{ className: "font-semibold text-foreground" }}>
                {tr(node.name)}
              </Link>
            </span>
          ))}
        </nav>

        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">
          {current ? tr(current.name) : "Tous les produits"}{" "}
          <span className="text-base font-medium text-foreground/50">({scoped.length} produit{scoped.length === 1 ? "" : "s"})</span>
        </h1>

        {editing && !missing && <FolderLiveEditor key={current?.id ?? "root"} node={current} />}

        {missing ? (
          <p className="mt-10 rounded-lg border border-dashed border-border px-6 py-16 text-center text-sm text-foreground/60">
            Ce rayon n'existe pas ou plus.{" "}
            <Link to="/produits" className="font-semibold text-brand">Voir tout le catalogue</Link>
          </p>
        ) : (
          <>
            {subFolders.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {subFolders.map((node) => (
                  <Link key={node.id} to="/produits/$" params={{ _splat: [...trail.map((n) => n.slug), node.slug].join("/") }}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand">
                    {tr(node.name)} <span className="text-foreground/45">({productsIn(data.nodes, data.products, node.id).length})</span>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-6">
              <ProductBrowser key={current?.id ?? "root"} products={scoped} />
            </div>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
