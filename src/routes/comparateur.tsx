import { useMemo, useState } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { PackageSearch, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { addProductToCart } from "@/components/ProductCard";
import { useCompare } from "@/lib/compare";
import { useCart } from "@/lib/cart";
import { formatDH } from "@/lib/company";
import { ancestorAtLevel, normLabel, specSections, type SiteData } from "@/lib/catalog-types";

export const Route = createFileRoute("/comparateur")({
  head: () => ({
    meta: [
      { title: "Comparateur de produits | Ghandi Home Electro" },
      { name: "description", content: "Comparez jusqu'à 4 produits côte à côte : caractéristiques, prix et références." },
      { property: "og:title", content: "Comparateur | Ghandi Home Electro" },
      { property: "og:description", content: "Comparez jusqu'à 4 produits côte à côte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const { ids, remove, clear } = useCompare();
  const { add } = useCart();
  const [diffOnly, setDiffOnly] = useState(false);
  const items = ids.map((id) => data.products.find((p) => p.id === id)).filter((p) => p !== undefined);

  const sections = useMemo(() => {
    const out: { title: string; rows: { key: string; label: string }[] }[] = [];
    for (const p of items) {
      for (const sec of specSections(p)) {
        let s = out.find((x) => normLabel(x.title) === normLabel(sec.title));
        if (!s) out.push((s = { title: sec.title, rows: [] }));
        for (const r of sec.rows) {
          const key = normLabel(r.label);
          if (!s.rows.some((x) => x.key === key)) s.rows.push({ key, label: r.label });
        }
      }
    }
    return out;
  }, [items]);
  const value = (pi: number, title: string, key: string) =>
    specSections(items[pi]!).find((s) => normLabel(s.title) === normLabel(title))?.rows.find((r) => normLabel(r.label) === key)?.value ??
    specSections(items[pi]!).flatMap((s) => s.rows).find((r) => normLabel(r.label) === key)?.value ?? "";
  const families = new Set(items.map((p) => ancestorAtLevel(data.nodes, p.node_id, 2)?.id ?? p.node_id));
  const cols = `minmax(130px,1fr) repeat(${items.length}, minmax(160px,1fr))`;

  return (
    <SiteLayout>
      <section className="shell py-4">
        <div className="panel flex flex-wrap items-center gap-3 px-5 py-4">
          <h1 className="text-xl font-bold sm:text-2xl">Comparateur</h1>
          {items.length > 0 && (
            <>
              <label className="ms-auto flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} /> Afficher uniquement les différences</label>
              <button type="button" onClick={clear} className="text-sm underline">Vider</button>
            </>
          )}
        </div>
        {families.size > 1 && <p className="mt-2 text-xs text-text-3">Ces produits ne sont pas du même type.</p>}
        {items.length === 0 ? (
          <div className="panel mt-3 px-6 py-14 text-center text-sm text-text-2">
            Aucun produit à comparer. Cochez « Comparer » sur les fiches produits.{" "}
            <Link to="/produits" className="font-bold text-foreground underline">Voir le catalogue</Link>
          </div>
        ) : (
          <div className="panel mt-3 overflow-x-auto snap-x">
            <div className="min-w-max md:min-w-0">
              <div className="sticky top-0 z-10 grid border-b border-border bg-card" style={{ gridTemplateColumns: cols }}>
                <div />
                {items.map((p) => (
                  <div key={p.id} className="relative snap-start border-s border-border p-3">
                    <button type="button" onClick={() => remove(p.id)} aria-label="Retirer" className="absolute top-2 end-2"><X className="h-4 w-4" /></button>
                    <Link to="/produits/article/$productId" params={{ productId: p.id }}>
                      <div className="grid aspect-square place-items-center">{p.image_url ? <img src={p.image_url} alt="" className="h-full object-contain" /> : <PackageSearch className="h-8 w-8 text-text-3" />}</div>
                      <p className="mt-2 line-clamp-2 text-sm font-medium">{p.name}</p>
                    </Link>
                    <p className="text-xs text-text-3">{p.model || p.serial_number}</p>
                    <p className="mt-1 font-bold">{p.price !== null ? formatDH(p.price) : "Prix sur demande"}</p>
                    <button type="button" onClick={() => { addProductToCart(add, p); toast.success("Ajouté au panier"); }}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md bg-brand py-2 text-xs font-bold text-brand-foreground">
                      <ShoppingCart className="h-3.5 w-3.5" /> Ajouter au panier
                    </button>
                  </div>
                ))}
              </div>
              {sections.map((sec) => {
                const rows = sec.rows.filter((r) => {
                  if (!diffOnly) return true;
                  const vals = items.map((_, i) => normLabel(value(i, sec.title, r.key)));
                  return new Set(vals).size > 1;
                });
                if (!rows.length) return null;
                return (
                  <div key={sec.title}>
                    <p className="bg-page px-3 py-2 text-sm font-bold">{sec.title}</p>
                    {rows.map((r) => (
                      <div key={r.key} className="grid border-b border-border text-sm" style={{ gridTemplateColumns: cols }}>
                        <div className="p-3 text-text-2">{r.label}</div>
                        {items.map((p, i) => <div key={p.id} className="border-s border-border p-3 font-bold">{value(i, sec.title, r.key) || "—"}</div>)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
