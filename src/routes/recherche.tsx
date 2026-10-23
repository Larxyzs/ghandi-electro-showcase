import { useMemo } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { SiteLayout, WaIcon } from "@/components/SiteLayout";
import { HeaderSearch, splatOf } from "@/components/HeaderSearch";
import { CatalogTile } from "@/components/CatalogTile";
import { ProductBrowser, validateBrowseSearch } from "@/components/ProductBrowser";
import { useCompany, whatsappLinkTo } from "@/lib/company";
import { useLiveEdit } from "@/lib/live-edit";
import {
  nodeHasProducts,
  pathOf,
  specSections,
  subtreeIds,
  visibleChildren,
  type CatalogNode,
  type Product,
  type SiteData,
} from "@/lib/catalog-types";

const fold = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const compact = (v: string) => fold(v).replace(/[\s\-_.]/g, "");

/** 0 = exact reference, 1 = name, 2 = rest, -1 = no match. */
export function searchRank(nodes: CatalogNode[], p: Product, query: string): number {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return 2;
  const cq = compact(query);
  const refs = [p.model ?? "", p.serial_number].map(compact).filter(Boolean);
  if (cq.length >= 3 && refs.some((r) => r === cq)) return 0;
  const name = fold(`${p.brand} ${p.name}`);
  if (terms.every((t) => name.includes(t))) return 1;
  const hay = fold([
    p.name, p.brand, p.model ?? "", p.serial_number, p.characteristics,
    ...pathOf(nodes, p.node_id).map((n) => n.name),
    ...specSections(p).flatMap((s) => s.rows.map((r) => r.value)),
  ].join(" "));
  if (terms.every((t) => hay.includes(t))) return 2;
  if (cq.length >= 3 && refs.some((r) => r.includes(cq))) return 0;
  return -1;
}

function levenshtein(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}

export const Route = createFileRoute("/recherche")({
  validateSearch: validateBrowseSearch,
  head: () => ({
    meta: [
      { title: "Recherche | Ghandi Home Electro" },
      { name: "description", content: "Résultats de recherche dans le catalogue Ghandi Home Electro." },
      { property: "og:title", content: "Recherche | Ghandi Home Electro" },
      { property: "og:description", content: "Résultats de recherche dans le catalogue Ghandi Home Electro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const q = (search["q"] ?? "").trim();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const admin = Boolean(useLiveEdit().admin);
  const company = useCompany();

  const ranks = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of data.products) m.set(p.id, searchRank(data.nodes, p, q));
    return m;
  }, [data.nodes, data.products, q]);
  const results = useMemo(() => (q ? data.products.filter((p) => (ranks.get(p.id) ?? -1) >= 0) : []), [data.products, ranks, q]);

  const categories = useMemo(() => {
    const fams = new Map<string, CatalogNode>();
    for (const p of results) {
      const fam = pathOf(data.nodes, p.node_id)[1] ?? pathOf(data.nodes, p.node_id)[0];
      if (fam) fams.set(fam.id, fam);
    }
    return [...fams.values()].map((node) => ({ node, ids: new Set(subtreeIds(data.nodes, node.id)) }));
  }, [results, data.nodes]);

  const fq = fold(q);
  const exactNode = data.nodes.find((n) => fold(n.name) === fq || fold(n.name) === `${fq}s` || `${fold(n.name)}s` === fq);
  const exactBrand = (data.brands ?? []).find((b) => fold(b.name) === fq);
  const suggestion = !results.length && fq.length >= 3
    ? [...(data.brands ?? []).map((b) => b.name), ...data.nodes.filter((n) => nodeHasProducts(data.nodes, data.products, n.id)).map((n) => n.name)]
        .map((name) => ({ name, d: levenshtein(fold(name), fq) }))
        .filter((x) => x.d > 0 && x.d <= 2)
        .sort((a, b) => a.d - b.d)[0]?.name
    : undefined;
  const tops = visibleChildren(data.nodes, data.products, null, admin);

  return (
    <SiteLayout>
      <section className="shell py-4">
        <div className="panel px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold sm:text-2xl">
            Résultats de recherche pour : « {q} » <span className="text-sm font-normal text-text-2">({results.length} produit{results.length === 1 ? "" : "s"})</span>
          </h1>
          {(exactNode || exactBrand) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {exactNode && nodeHasProducts(data.nodes, data.products, exactNode.id) && (
                <Link to="/produits/$" params={{ _splat: splatOf(data.nodes, exactNode.id) }} className="rounded-md bg-brand-soft px-4 py-2 text-sm font-bold">Voir tous les {exactNode.name} →</Link>
              )}
              {exactBrand && <Link to="/marques/$slug" params={{ slug: exactBrand.slug }} className="rounded-md bg-brand-soft px-4 py-2 text-sm font-bold">Voir la page {exactBrand.name} →</Link>}
            </div>
          )}
        </div>

        {results.length > 0 ? (
          <div className="mt-4">
            <ProductBrowser key={q} products={results} categories={categories} rank={(p) => ranks.get(p.id) ?? 9} />
          </div>
        ) : (
          <div className="panel mt-4 px-5 py-10 text-center">
            <SearchX className="mx-auto h-10 w-10 text-brand" />
            <p className="mt-3 text-lg font-bold">{q ? `Aucun résultat pour « ${q} »` : "Que cherchez-vous ?"}</p>
            {suggestion && (
              <p className="mt-2 text-sm">Vouliez-vous dire <Link to="/recherche" search={{ q: suggestion }} className="font-bold underline">{suggestion}</Link> ?</p>
            )}
            <div className="mx-auto mt-5 max-w-xl"><HeaderSearch className="relative text-start" /></div>
            {data.popularSearches.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-bold text-text-3 uppercase">Recherches populaires</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {data.popularSearches.map((p) => <Link key={p.id} to="/recherche" search={{ q: p.term }} className="rounded-full border border-border px-3 py-1 text-sm hover:border-brand">{p.term}</Link>)}
                </div>
              </div>
            )}
            {q && (
              <a href={whatsappLinkTo(company.whatsappNumber, `Bonjour, je cherche : ${q}. Pouvez-vous m'aider ?`)} target="_blank" rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-whatsapp px-5 py-2.5 text-sm font-bold text-background">
                <WaIcon className="h-4 w-4" /> Demandez-nous ce produit
              </a>
            )}
            {tops.length > 0 && (
              <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {tops.map((n) => <CatalogTile key={n.id} node={n} splat={splatOf(data.nodes, n.id)} />)}
              </div>
            )}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
