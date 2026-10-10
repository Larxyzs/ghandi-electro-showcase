import { useMemo, useState } from "react";
import { PackageSearch, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { normLabel, type Product } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

type Sort = "relevance" | "price-asc" | "price-desc" | "new";
const PAGE = 24;

/** Smart filters: only labels present on at least 2 products of the page. */
function buildSpecFilters(products: Product[]) {
  const map = new Map<string, { label: string; values: Map<string, number> }>();
  for (const p of products) {
    const seen = new Set<string>();
    for (const s of p.specifications ?? []) {
      const key = normLabel(s.label);
      if (!s.value || seen.has(key)) continue;
      seen.add(key);
      const entry = map.get(key) ?? { label: s.label, values: new Map() };
      entry.values.set(s.value, (entry.values.get(s.value) ?? 0) + 1);
      map.set(key, entry);
    }
  }
  return [...map.entries()]
    .map(([key, e]) => ({ key, label: e.label, values: [...e.values.entries()].sort((a, b) => b[1] - a[1]), total: [...e.values.values()].reduce((a, b) => a + b, 0) }))
    .filter((f) => f.total >= 2 && f.values.length >= 2 && f.values.length <= 20)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function specValue(p: Product, key: string) {
  return (p.specifications ?? []).find((s) => normLabel(s.label) === key)?.value;
}

export function ProductBrowser({ products }: { products: Product[] }) {
  const [sort, setSort] = useState<Sort>("relevance");
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [specs, setSpecs] = useState<Record<string, Set<string>>>({});
  const prices = products.map((p) => p.price).filter((v): v is number => v !== null);
  const maxPrice = prices.length ? Math.ceil(Math.max(...prices)) : 0;
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [panel, setPanel] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const brandCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) if (p.brand) m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);
  const specFilters = useMemo(() => buildSpecFilters(products), [products]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (brands.size && !brands.has(p.brand)) return false;
      if (priceMax !== null && p.price !== null && p.price > priceMax) return false;
      for (const [key, set] of Object.entries(specs)) {
        if (set.size && !set.has(specValue(p, key) ?? "")) return false;
      }
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (sort === "price-desc") list = [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    if (sort === "new") list = [...list].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return list;
  }, [products, brands, specs, priceMax, sort]);

  const toggle = (set: Set<string>, v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };
  const activeCount = brands.size + Object.values(specs).reduce((a, s) => a + s.size, 0) + (priceMax !== null ? 1 : 0);

  const filters = (
    <div className="space-y-6">
      {brandCounts.length > 1 && (
        <div>
          <h3 className="mb-2 text-sm font-bold">Marque</h3>
          {brandCounts.map(([b, c]) => (
            <label key={b} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={brands.has(b)} onChange={() => setBrands(toggle(brands, b))} />
              {b} <span className="text-foreground/45">({c})</span>
            </label>
          ))}
        </div>
      )}
      {prices.length >= 2 && (
        <div>
          <h3 className="mb-2 text-sm font-bold">Prix maximum</h3>
          <input type="range" min={0} max={maxPrice} step={100} value={priceMax ?? maxPrice}
            onChange={(e) => setPriceMax(Number(e.target.value))} className="w-full accent-brand" />
          <p className="text-xs text-foreground/60">Jusqu'à {(priceMax ?? maxPrice).toLocaleString("fr-MA")} DH</p>
        </div>
      )}
      {specFilters.map((f) => (
        <div key={f.key}>
          <h3 className="mb-2 text-sm font-bold">{f.label}</h3>
          {f.values.map(([v, c]) => (
            <label key={v} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={specs[f.key]?.has(v) ?? false}
                onChange={() => setSpecs({ ...specs, [f.key]: toggle(specs[f.key] ?? new Set(), v) })} />
              {v} <span className="text-foreground/45">({c})</span>
            </label>
          ))}
        </div>
      ))}
      {activeCount > 0 && (
        <button type="button" onClick={() => { setBrands(new Set()); setSpecs({}); setPriceMax(null); }} className="text-sm font-semibold text-brand">
          Effacer les filtres
        </button>
      )}
    </div>
  );

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-8 py-16 text-center">
        <PackageSearch className="h-8 w-8 text-brand" />
        <p className="text-sm text-foreground/65">Aucun produit pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">{filters}</aside>
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => setPanel(true)} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold lg:hidden">
            <SlidersHorizontal className="h-4 w-4" /> Filtrer {activeCount > 0 && `(${activeCount})`}
          </button>
          <p className="hidden text-sm text-foreground/60 lg:block">{filtered.length} produit(s)</p>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
            <option value="relevance">Pertinence</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
            <option value="new">Nouveautés</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {filtered.slice(0, shown).map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
        {filtered.length === 0 && <p className="py-10 text-center text-sm text-foreground/60">Aucun produit ne correspond à ces filtres.</p>}
        {filtered.length > shown && (
          <div className="mt-8 text-center">
            <button type="button" onClick={() => setShown((s) => s + PAGE)} className="rounded-full border border-brand px-6 py-2.5 text-sm font-semibold text-brand">
              Voir plus ({filtered.length - shown})
            </button>
          </div>
        )}
      </div>

      {panel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fermer" onClick={() => setPanel(false)} className="absolute inset-0 bg-ink/40" />
          <div className={cn("absolute inset-y-0 start-0 w-[85%] max-w-sm overflow-y-auto bg-background p-5")}>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold">Filtrer</p>
              <button type="button" onClick={() => setPanel(false)} aria-label="Fermer"><X className="h-5 w-5" /></button>
            </div>
            {filters}
            <button type="button" onClick={() => setPanel(false)} className="mt-6 w-full rounded-full bg-brand py-3 text-sm font-semibold text-primary-foreground">
              Voir {filtered.length} produit(s)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
