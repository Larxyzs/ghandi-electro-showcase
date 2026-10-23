import { useMemo } from "react";
import { createFileRoute, Link, notFound, useLoaderData } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { splatOf } from "@/components/HeaderSearch";
import { ProductBrowser, validateBrowseSearch } from "@/components/ProductBrowser";
import { pathOf, subtreeIds, type CatalogNode, type SiteData } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marques/$slug")({
  validateSearch: validateBrowseSearch,
  head: ({ matches, params }) => {
    const root = matches[0]?.loaderData as SiteData | undefined;
    const brand = root?.brands?.find((b) => b.slug === params.slug);
    const name = brand?.name ?? params.slug.toUpperCase();
    const title = `${name} au Maroc – Électroménager et TV | Ghandi Home Electro`;
    const description = brand?.description?.trim() || `Produits ${name} chez Ghandi Home Electro à Casablanca. Livraison partout au Maroc, paiement à la livraison.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `https://ghandihomeelectro.com/marques/${params.slug}` }],
    };
  },
  component: BrandPage,
});

function BrandPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const brand = data.brands?.find((b) => b.slug === slug);
  if (!brand) throw notFound();
  const rayon = search["rayon"];
  const all = useMemo(() => data.products.filter((p) => p.brand.toLowerCase() === brand.name.toLowerCase()), [data.products, brand.name]);
  const rayonNode = rayon ? data.nodes.find((n) => splatOf(data.nodes, n.id) === rayon) : undefined;
  const scoped = useMemo(() => {
    if (!rayonNode) return all;
    const ids = new Set(subtreeIds(data.nodes, rayonNode.id));
    return all.filter((p) => (p.node_ids ?? [p.node_id]).some((id) => ids.has(id)));
  }, [all, rayonNode, data.nodes]);

  const chips = useMemo(() => {
    const m = new Map<string, { node: CatalogNode; count: number }>();
    for (const p of all) {
      const path = pathOf(data.nodes, p.node_id);
      for (const n of path.slice(0, 2)) {
        const e = m.get(n.id) ?? { node: n, count: 0 };
        e.count++;
        m.set(n.id, e);
      }
    }
    return [...m.values()].sort((a, b) => a.node.level - b.node.level || b.count - a.count);
  }, [all, data.nodes]);

  return (
    <SiteLayout>
      <section className="shell py-4">
        <nav className="flex items-center gap-1.5 text-xs text-text-2">
          <Link to="/" className="inline-flex items-center gap-1"><Home className="h-3.5 w-3.5" /> Accueil</Link>
          <ChevronRight className="h-3.5 w-3.5" /> <Link to="/marques">Marques</Link>
          <ChevronRight className="h-3.5 w-3.5" /> <span className="font-bold text-foreground">{brand.name}</span>
        </nav>
        <div className="panel mt-3 flex flex-col items-start gap-4 px-5 py-5 sm:flex-row sm:items-center">
          {brand.logo && <img src={brand.logo} alt={brand.name} className="h-14 w-auto object-contain" />}
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">{brand.name} chez Ghandi Home Electro <span className="text-sm font-normal text-text-2">({scoped.length} produit{scoped.length === 1 ? "" : "s"})</span></h1>
            {brand.description && <p className="mt-1 text-sm text-text-2">{brand.description}</p>}
          </div>
        </div>
        {chips.length > 0 && (
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <Link to="/marques/$slug" params={{ slug }} search={{}} className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm", !rayonNode ? "border-brand bg-brand font-bold text-brand-foreground" : "border-border bg-card")}>Tout</Link>
            {chips.map(({ node, count }) => (
              <Link key={node.id} to="/marques/$slug" params={{ slug }} search={{ rayon: splatOf(data.nodes, node.id) }}
                className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm", rayonNode?.id === node.id ? "border-brand bg-brand font-bold text-brand-foreground" : "border-border bg-card")}>
                {node.name} ({count})
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4"><ProductBrowser key={rayon ?? "all"} products={scoped} /></div>
      </section>
    </SiteLayout>
  );
}
