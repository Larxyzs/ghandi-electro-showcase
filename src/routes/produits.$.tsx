import { useMemo } from "react";
import { createFileRoute, Link, redirect, useLoaderData } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { SiteLayout, WaIcon } from "@/components/SiteLayout";
import { splatOf } from "@/components/HeaderSearch";
import { CatalogTile } from "@/components/CatalogTile";
import { useDynamicText } from "@/lib/dynamic-text";
import { ProductBrowser, validateBrowseSearch } from "@/components/ProductBrowser";
import { useLiveEdit } from "@/lib/live-edit";
import { FolderLiveEditor } from "@/components/live/FolderLiveEditor";
import { lookupCatalogRedirect } from "@/lib/catalog-redirect.functions";
import { useCompany, whatsappLinkTo } from "@/lib/company";
import {
  findChildBySlug,
  nodeHasProducts,
  productsIn,
  subtreeIds,
  visibleChildren,
  type CatalogNode,
  type SiteData,
} from "@/lib/catalog-types";
import { cn } from "@/lib/utils";
import { SeoText } from "@/components/SeoText";

const SITE = "https://ghandihomeelectro.com";

function resolveTrail(nodes: CatalogNode[], splat: string) {
  const trail: CatalogNode[] = [];
  let parentId: string | null = null;
  for (const segment of splat.split("/").filter(Boolean)) {
    const node = findChildBySlug(nodes, parentId, segment);
    if (!node) return { trail, missing: true };
    trail.push(node);
    parentId = node.id;
  }
  return { trail, missing: false };
}

export const Route = createFileRoute("/produits/$")({
  validateSearch: validateBrowseSearch,
  loader: async ({ params }) => {
    const splat = params._splat ?? "";
    const target = await lookupCatalogRedirect({ data: { path: splat } });
    if (target) throw redirect({ href: `/produits/${target}`, statusCode: 301 });
    return null;
  },
  head: ({ matches, params }) => {
    const root = matches[0]?.loaderData as SiteData | undefined;
    const splat = params._splat ?? "";
    const { trail } = root ? resolveTrail(root.nodes, splat) : { trail: [] as CatalogNode[] };
    const node = trail.at(-1);
    const page = Number((matches.at(-1)?.search as Record<string, string> | undefined)?.["p"]) || 1;
    const suffix = page > 1 ? ` – Page ${page}` : "";
    const title = node
      ? `${node.seo_title?.trim() || `${node.name} à Casablanca – Livraison gratuite | Ghandi Home Electro`}${suffix}`
      : "Catalogue | Ghandi Home Electro";
    const description = node?.seo_description?.trim() ||
      (node ? `${node.name} : découvrez notre sélection chez Ghandi Home Electro à Casablanca. Livraison gratuite à Casablanca, Mohammedia et Dar Bouazza, paiement à la livraison.` : "Parcourez le catalogue Ghandi Home Electro par catégorie.");
    const crumbs = trail.map((n, i) => ({
      "@type": "ListItem",
      position: i + 2,
      name: n.name,
      item: `${SITE}/produits/${trail.slice(0, i + 1).map((x) => x.slug).join("/")}`,
    }));
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/produits/${splat}${page > 1 ? `?p=${page}` : ""}` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [{ "@type": "ListItem", position: 1, name: "Accueil", item: SITE }, ...crumbs],
          }),
        },
      ],
    };
  },
  component: BrowsePage,
});

function BrowsePage() {
  const { _splat } = Route.useParams();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const { editing, admin: adminId } = useLiveEdit();
  const admin = Boolean(adminId);
  const company = useCompany();
  const tr = useDynamicText();
  const { trail, missing } = resolveTrail(data.nodes, _splat ?? "");
  const current = trail.at(-1) ?? null;
  const parent = trail.at(-2) ?? null;

  const scoped = useMemo(
    () => (missing ? [] : current ? productsIn(data.nodes, data.products, current.id) : data.products),
    [data.nodes, data.products, current, missing],
  );
  const children = current ? visibleChildren(data.nodes, data.products, current.id, admin) : [];
  const sisters = current ? visibleChildren(data.nodes, data.products, current.parent_id, admin) : [];
  const categories = useMemo(
    () => children.map((node) => ({ node, ids: new Set(subtreeIds(data.nodes, node.id)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.id, data.nodes],
  );
  const isLeafLevel = current && children.length === 0;
  const empty = current ? !nodeHasProducts(data.nodes, data.products, current.id) : false;
  const pathTo = (index: number) => trail.slice(0, index + 1).map((n) => n.slug).join("/");

  return (
    <SiteLayout>
      <section className="shell py-4">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-text-2">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground"><Home className="h-3.5 w-3.5" /> Accueil</Link>
          {trail.map((node, index) => (
            <span key={node.id} className="inline-flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-text-3" />
              <Link to="/produits/$" params={{ _splat: pathTo(index) }} className={cn("hover:text-foreground", index === trail.length - 1 && "font-bold text-foreground")}>{tr(node.name)}</Link>
            </span>
          ))}
        </nav>

        {missing ? (
          <div className="panel mt-4 px-6 py-16 text-center">
            <h1 className="text-xl font-bold">Ce rayon n'existe pas ou plus.</h1>
            <Link to="/produits" className="mt-3 inline-block font-bold underline">Voir tout le catalogue</Link>
          </div>
        ) : empty && !admin ? (
          <div className="panel mt-4 px-6 py-14 text-center">
            <h1 className="text-2xl font-bold">{tr(current!.name)}</h1>
            <p className="mt-2 text-lg font-medium text-text-2">Bientôt disponible</p>
            <p className="mt-1 text-sm text-text-2">Ce rayon n'a pas encore de produits en ligne. Demandez-nous le modèle que vous cherchez.</p>
            <a href={whatsappLinkTo(company.whatsappNumber, `Bonjour, je cherche un produit dans le rayon « ${current!.name} ». Pouvez-vous m'aider ?`)} target="_blank" rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-whatsapp px-5 py-2.5 text-sm font-bold text-background">
              <WaIcon className="h-4 w-4" /> Demander un modèle
            </a>
            {sisters.filter((s) => s.id !== current!.id).length > 0 && (
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {sisters.filter((s) => s.id !== current!.id).map((s) => (
                  <Link key={s.id} to="/produits/$" params={{ _splat: splatOf(data.nodes, s.id) }} className="rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:border-brand">{tr(s.name)}</Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="panel mt-3 px-4 py-4 sm:px-6">
              <h1 className="text-xl font-bold sm:text-2xl">
                {current ? tr(current.name) : "Tous les produits"}{" "}
                <span className="text-sm font-normal text-text-2">({scoped.length} produit{scoped.length === 1 ? "" : "s"})</span>
                {admin && empty && <span className="ms-2 text-sm font-normal text-text-3">(vide — visible seulement par vous)</span>}
              </h1>
              {current?.intro_text?.trim() && <p className="mt-2 max-w-3xl text-sm text-text-2">{current.intro_text}</p>}
              {editing && <FolderLiveEditor key={current?.id ?? "root"} node={current} />}
            </div>

            {children.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {children.map((node) => (
                  <CatalogTile key={node.id} node={node} splat={splatOf(data.nodes, node.id)} count={productsIn(data.nodes, data.products, node.id).length} muted={admin && !nodeHasProducts(data.nodes, data.products, node.id)} />
                ))}
              </div>
            )}
            {isLeafLevel && parent && sisters.length > 1 && (
              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {sisters.map((s) => (
                  <Link key={s.id} to="/produits/$" params={{ _splat: splatOf(data.nodes, s.id) }}
                    className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm", s.id === current!.id ? "border-brand bg-brand font-bold text-brand-foreground" : "border-border bg-card hover:border-input")}>
                    {tr(s.menu_label?.trim() || s.name)}
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-4">
              <ProductBrowser key={current?.id ?? "root"} products={scoped} categories={categories} />
            </div>

            {current?.seo_text?.trim() && <SeoText text={current.seo_text} />}
          </>
        )}
      </section>
    </SiteLayout>
  );
}

