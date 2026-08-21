import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ChevronRight, Folder, Home, Layers, PackageSearch, Tag } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { ProductCard } from "@/components/ProductCard";
import {
  childrenOf,
  findChildBySlug,
  productsIn,
  type CatalogNode,
  type SiteData,
} from "@/lib/catalog-types";

const LEVEL_ICON = { 1: Folder, 2: Layers, 3: Tag } as const;

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
  const folders = missing ? [] : childrenOf(data.nodes, current?.id ?? null);
  const products = current && current.level === 3 ? productsIn(data.nodes, data.products, current.id) : [];
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

        <Reveal className="mt-6">
          <h1 className="text-3xl font-bold sm:text-4xl">{current?.name ?? "Catalogue"}</h1>
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
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((node, index) => {
              const Icon = LEVEL_ICON[node.level];
              const count = productsIn(data.nodes, data.products, node.id).length;
              return (
                <Reveal key={node.id} delay={(index % 3) * 100}>
                  <Link
                    to="/produits/$"
                    params={{ _splat: [...trail.map((n) => n.slug), node.slug].join("/") }}
                    className="flex h-full items-center gap-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1.5 hover:border-brand/40"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-deep">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{node.name}</span>
                      <span className="block text-xs text-foreground/55">{count} produit(s)</span>
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}

        {current?.level === 3 && (
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
