import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, LayoutGrid, List, PackageSearch, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { normLabel, specSections, type CatalogNode, type Product } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

/** Search params shared by every listing (category, search, brand pages). */
export type BrowseSearch = Record<string, string | undefined>;
export function validateBrowseSearch(raw: Record<string, unknown>): BrowseSearch {
  const out: BrowseSearch = {};
  for (const [k, v] of Object.entries(raw)) if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  return out;
}

type Sort = "pertinence" | "nouveautes" | "prix-asc" | "prix-desc" | "nom";
const SORTS: [Sort, string][] = [
  ["pertinence", "Pertinence"],
  ["nouveautes", "Nouveautés"],
  ["prix-asc", "Prix croissant"],
  ["prix-desc", "Prix décroissant"],
  ["nom", "Nom A-Z"],
];

/* ---- numeric spec ranges ---- */
type RangeDef = { unit: RegExp; label: RegExp; buckets: [number, number, string][] };
const RANGES: RangeDef[] = [
  { label: /taille|diagonale|ecran/, unit: /pouce|"|''|inch/i, buckets: [[0, 43, "Moins de 43 pouces"], [43, 51, "43 – 50 pouces"], [51, 60, "55 pouces"], [60, 70, "65 pouces"], [70, 1e9, "75 pouces et plus"]] },
  { label: /volume|capacite (totale|nette|utile)/, unit: /\bl\b|litre/i, buckets: [[0, 300, "Moins de 300 L"], [300, 400, "300 – 400 L"], [400, 500, "400 – 500 L"], [500, 1e9, "Plus de 500 L"]] },
  { label: /capacite|charge/, unit: /kg/i, buckets: [[0, 7, "Moins de 7 kg"], [7, 9, "7 – 8 kg"], [9, 11, "9 – 10 kg"], [11, 1e9, "11 kg et plus"]] },
  { label: /puissance|btu|refroidissement/, unit: /btu/i, buckets: [[0, 10000, "Moins de 10 000 BTU"], [10000, 15000, "10 000 – 15 000 BTU"], [15000, 20000, "15 000 – 20 000 BTU"], [20000, 1e9, "20 000 BTU et plus"]] },
  { label: /^largeur/, unit: /cm|mm/i, buckets: [[0, 55, "Moins de 55 cm"], [55, 65, "55 – 65 cm"], [65, 80, "65 – 80 cm"], [80, 1e9, "80 cm et plus"]] },
];
const PRIORITY = [/volume|capacite|taille|diagonale|ecran|btu|puissance/, /classe/, /no ?frost|inverter|wi-?fi|technologie|resolution|feux|essorage|gaz|chaud/, /couleur|coloris/, /largeur/];

function parseNumber(value: string, unit: RegExp, label: string) {
  const m = value.replace(/\s/g, "").replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  let n = Number(m[1]);
  if (/mm/i.test(value) && /largeur/.test(label)) n = n / 10;
  if (!unit.test(value) && !unit.test(label)) return null;
  return n;
}

function allSpecs(p: Product) {
  return specSections(p).flatMap((s) => s.rows);
}
function specValue(p: Product, key: string) {
  return allSpecs(p).find((s) => normLabel(s.label) === key)?.value;
}

type SpecFilter = { key: string; label: string; values: [string, number][]; range?: RangeDef };

function buildSpecFilters(products: Product[]): SpecFilter[] {
  const map = new Map<string, { label: string; values: Map<string, number> }>();
  for (const p of products) {
    const seen = new Set<string>();
    for (const s of allSpecs(p)) {
      const key = normLabel(s.label);
      if (!s.value || seen.has(key)) continue;
      seen.add(key);
      const entry = map.get(key) ?? { label: s.label, values: new Map() };
      entry.values.set(s.value, (entry.values.get(s.value) ?? 0) + 1);
      map.set(key, entry);
    }
  }
  const out: SpecFilter[] = [];
  for (const [key, e] of map) {
    const total = [...e.values.values()].reduce((a, b) => a + b, 0);
    if (total < 2) continue;
    const range = RANGES.find((r) => r.label.test(key) && [...e.values.keys()].filter((v) => parseNumber(v, r.unit, key) !== null).length >= 2);
    if (range) {
      const counts = range.buckets.map(() => 0);
      for (const [v, c] of e.values) {
        const n = parseNumber(v, range.unit, key);
        if (n === null) continue;
        const i = range.buckets.findIndex(([a, b]) => n >= a && n < b);
        if (i >= 0) counts[i]! += c;
      }
      const values = range.buckets.map((b, i) => [b[2], counts[i]!] as [string, number]).filter(([, c]) => c > 0);
      if (values.length >= 2) out.push({ key, label: e.label, values, range });
      continue;
    }
    const values = [...e.values.entries()].sort((a, b) => b[1] - a[1]);
    if (values.length >= 2 && values.length <= 20) out.push({ key, label: e.label, values });
  }
  const rank = (k: string) => {
    const i = PRIORITY.findIndex((re) => re.test(k));
    return i < 0 ? 99 : i;
  };
  return out.sort((a, b) => rank(a.key) - rank(b.key)).slice(0, 12);
}

function matchesSpec(p: Product, f: SpecFilter, selected: string[]) {
  const v = specValue(p, f.key);
  if (!v) return false;
  if (!f.range) return selected.includes(v);
  const n = parseNumber(v, f.range.unit, f.key);
  if (n === null) return false;
  return f.range.buckets.some(([a, b, label]) => selected.includes(label) && n >= a && n < b);
}

const split = (v?: string) => (v ? v.split("|").filter(Boolean) : []);
const slug = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

function Fold({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-border py-3 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">
        {title} <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">{children}</div>
    </details>
  );
}

export function ProductBrowser({
  products,
  categories,
  rank,
}: {
  products: Product[];
  /** Child categories offered in the "Catégorie" filter. */
  categories?: { node: CatalogNode; ids: Set<string> }[];
  /** Relevance order for search pages. */
  rank?: (p: Product) => number;
}) {
  const search = useSearch({ strict: false }) as BrowseSearch;
  const navigate = useNavigate();
  const set = (patch: BrowseSearch, keepPage = false) =>
    navigate({
      to: ".",
      search: (prev: BrowseSearch) => {
        const next: BrowseSearch = { ...prev, ...patch };
        if (!keepPage) delete next["p"];
        for (const k of Object.keys(next)) if (!next[k]) delete next[k];
        return next;
      },
      replace: false,
      resetScroll: false,
    } as never);

  const sort = (search["tri"] as Sort) || "pertinence";
  const perPage = [24, 48, 96].includes(Number(search["n"])) ? Number(search["n"]) : 24;
  const mode = search["mode"] === "liste" ? "list" : "grid";
  const page = Math.max(1, Number(search["p"]) || 1);
  const selBrands = split(search["marque"]);
  const selCats = split(search["cat"]);
  const [pMin, pMax] = (search["prix"] ?? "").split("-").map((v) => (v ? Number(v) : null));
  const [panel, setPanel] = useState(false);
  const [extra, setExtra] = useState(0);
  useEffect(() => setExtra(0), [page, search]);

  const prices = products.map((p) => p.price).filter((v): v is number => v !== null);
  const maxPrice = prices.length ? Math.ceil(Math.max(...prices)) : 0;
  const brandCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) if (p.brand) m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);
  const specFilters = useMemo(() => buildSpecFilters(products), [products]);
  const selSpecs = specFilters
    .map((f) => ({ f, sel: split(search[`f_${slug(f.key)}`]) }))
    .filter((x) => x.sel.length > 0);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (selBrands.length && !selBrands.some((b) => slug(b) === slug(p.brand))) return false;
      if (selCats.length && categories && !categories.some((c) => selCats.includes(c.node.slug) && (p.node_ids ?? [p.node_id]).some((id) => c.ids.has(id)))) return false;
      if ((pMin ?? null) !== null || (pMax ?? null) !== null) {
        if (p.price === null) return false;
        if (pMin != null && p.price < pMin) return false;
        if (pMax != null && p.price > pMax) return false;
      }
      return selSpecs.every(({ f, sel }) => matchesSpec(p, f, sel));
    });
    if (sort === "pertinence" && rank) list = [...list].sort((a, b) => rank(a) - rank(b));
    if (sort === "prix-asc") list = [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (sort === "prix-desc") list = [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    if (sort === "nouveautes") list = [...list].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    if (sort === "nom") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, specFilters, categories, rank]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const start = (Math.min(page, pages) - 1) * perPage;
  const visible = filtered.slice(start, start + perPage * (1 + extra));

  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]).join("|");

  const chips: { label: string; clear: BrowseSearch }[] = [
    ...selCats.map((c) => ({ label: categories?.find((x) => x.node.slug === c)?.node.name ?? c, clear: { cat: toggleIn(selCats, c) } })),
    ...selBrands.map((b) => ({ label: brandCounts.find(([n]) => slug(n) === slug(b))?.[0] ?? b, clear: { marque: toggleIn(selBrands, b) } })),
    ...(search["prix"] ? [{ label: `Prix : ${search["prix"].replace("-", " – ")} DH`, clear: { prix: undefined } }] : []),
    ...selSpecs.flatMap(({ f, sel }) => sel.map((v) => ({ label: `${f.label} : ${v}`, clear: { [`f_${slug(f.key)}`]: toggleIn(sel, v) } }))),
  ];
  const clearAll: BrowseSearch = { cat: undefined, marque: undefined, prix: undefined, ...Object.fromEntries(specFilters.map((f) => [`f_${slug(f.key)}`, undefined])) };

  if (products.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <PackageSearch className="h-10 w-10 text-brand" />
        <p className="text-sm text-text-2">Aucun produit pour l'instant.</p>
      </div>
    );
  }

  const check = "flex cursor-pointer items-center gap-2 py-0.5 text-sm";
  const filters = (
    <div>
      {categories && categories.length > 1 && (
        <Fold title="Catégorie">
          {categories.map((c) => (
            <label key={c.node.id} className={check}>
              <input type="checkbox" className="accent-brand" checked={selCats.includes(c.node.slug)} onChange={() => set({ cat: toggleIn(selCats, c.node.slug) })} />
              {c.node.name} <span className="text-text-3">({products.filter((p) => (p.node_ids ?? [p.node_id]).some((id) => c.ids.has(id))).length})</span>
            </label>
          ))}
        </Fold>
      )}
      {brandCounts.length > 1 && (
        <Fold title="Marque">
          {brandCounts.map(([b, c]) => (
            <label key={b} className={check}>
              <input type="checkbox" className="accent-brand" checked={selBrands.some((x) => slug(x) === slug(b))} onChange={() => set({ marque: toggleIn(selBrands.map(slug), slug(b)) })} />
              {b} <span className="text-text-3">({c})</span>
            </label>
          ))}
        </Fold>
      )}
      {prices.length >= 2 && <PriceFilter max={maxPrice} min={pMin ?? null} cur={pMax ?? null} onApply={(a, b) => set({ prix: a === null && b === null ? undefined : `${a ?? 0}-${b ?? maxPrice}` })} />}
      {specFilters.map((f) => {
        const sel = split(search[`f_${slug(f.key)}`]);
        return (
          <Fold key={f.key} title={f.label} defaultOpen={sel.length > 0 || specFilters.indexOf(f) < 4}>
            {f.values.map(([v, c]) => (
              <label key={v} className={check}>
                <input type="checkbox" className="accent-brand" checked={sel.includes(v)} onChange={() => set({ [`f_${slug(f.key)}`]: toggleIn(sel, v) })} />
                <span className="flex-1">{v}</span> <span className="text-text-3">({c})</span>
              </label>
            ))}
          </Fold>
        );
      })}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="panel hidden self-start px-4 py-2 lg:block">
        <p className="border-b border-border py-3 text-base font-bold">Filtrer par</p>
        {filters}
      </aside>
      <div className="min-w-0">
        <div className="panel mb-3 flex flex-wrap items-center gap-3 px-3 py-2.5">
          <button type="button" onClick={() => setPanel(true)} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold lg:hidden">
            <SlidersHorizontal className="h-4 w-4" /> Filtrer {chips.length > 0 && `(${chips.length})`}
          </button>
          <p className="text-sm text-text-2">
            {filtered.length === 0 ? "0 produit" : `${start + 1}–${Math.min(start + visible.length, filtered.length)} sur ${filtered.length} produit${filtered.length > 1 ? "s" : ""}`}
          </p>
          <div className="ms-auto flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5">
              <span className="hidden text-text-2 sm:inline">Trier par</span>
              <select value={sort} onChange={(e) => set({ tri: e.target.value === "pertinence" ? undefined : e.target.value })} className="rounded-md border border-input bg-card px-2 py-1.5">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="hidden items-center gap-1.5 sm:flex">
              <span className="text-text-2">Afficher</span>
              <select value={perPage} onChange={(e) => set({ n: e.target.value === "24" ? undefined : e.target.value })} className="rounded-md border border-input bg-card px-2 py-1.5">
                {[24, 48, 96].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="flex overflow-hidden rounded-md border border-input">
              <button type="button" aria-label="Grille" onClick={() => set({ mode: undefined }, true)} className={cn("p-1.5", mode === "grid" && "bg-brand text-brand-foreground")}><LayoutGrid className="h-4 w-4" /></button>
              <button type="button" aria-label="Liste" onClick={() => set({ mode: "liste" }, true)} className={cn("p-1.5", mode === "list" && "bg-brand text-brand-foreground")}><List className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button key={c.label} type="button" onClick={() => set(c.clear)} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs">
                {c.label} <X className="h-3 w-3" />
              </button>
            ))}
            <button type="button" onClick={() => set(clearAll)} className="text-xs font-bold underline">Tout effacer</button>
          </div>
        )}
        {mode === "grid" ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="space-y-2">{visible.map((p) => <ProductCard key={p.id} product={p} variant="list" />)}</div>
        )}
        {filtered.length === 0 && <p className="panel py-10 text-center text-sm text-text-2">Aucun produit ne correspond à ces filtres.</p>}
        {start + visible.length < filtered.length && (
          <div className="mt-4 text-center md:hidden">
            <button type="button" onClick={() => setExtra(extra + 1)} className="rounded-md border border-input bg-card px-6 py-2.5 text-sm font-bold">Voir plus</button>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="mt-6 flex flex-wrap justify-center gap-1">
            {page > 1 && <PageLink p={page - 1} label="«" />}
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
              .map((p, i, arr) => (
                <span key={p} className="flex gap-1">
                  {i > 0 && p - arr[i - 1]! > 1 && <span className="px-2 py-1.5 text-text-3">…</span>}
                  <PageLink p={p} label={String(p)} active={p === page} />
                </span>
              ))}
            {page < pages && <PageLink p={page + 1} label="»" />}
          </nav>
        )}
      </div>

      {panel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fermer" onClick={() => setPanel(false)} className="absolute inset-0 bg-ink/40" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-xl bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="font-bold">Filtrer</p>
              <button type="button" onClick={() => setPanel(false)} aria-label="Fermer"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4">{filters}</div>
            <div className="border-t border-border p-3">
              <button type="button" onClick={() => setPanel(false)} className="w-full rounded-md bg-brand py-3 text-sm font-bold text-brand-foreground">
                Voir {filtered.length} produit{filtered.length > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageLink({ p, label, active }: { p: number; label: string; active?: boolean }) {
  return (
    <Link to="." search={((prev: BrowseSearch) => ({ ...prev, p: p === 1 ? undefined : String(p) })) as never}
      className={cn("min-w-9 rounded-md border px-3 py-1.5 text-center text-sm", active ? "border-brand bg-brand font-bold text-brand-foreground" : "border-border bg-card")}>
      {label}
    </Link>
  );
}

function PriceFilter({ max, min, cur, onApply }: { max: number; min: number | null; cur: number | null; onApply: (a: number | null, b: number | null) => void }) {
  const [a, setA] = useState(min === null ? "" : String(min));
  const [b, setB] = useState(cur === null ? "" : String(cur));
  return (
    <Fold title="Prix">
      <div className="flex items-center gap-2 pt-1">
        <input inputMode="numeric" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} placeholder="Min" className="w-full rounded-md border border-input px-2 py-1.5 text-sm" />
        <span>–</span>
        <input inputMode="numeric" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ""))} placeholder={String(max)} className="w-full rounded-md border border-input px-2 py-1.5 text-sm" />
      </div>
      <input type="range" min={0} max={max} step={100} value={b ? Number(b) : max} onChange={(e) => setB(e.target.value)} className="mt-2 w-full accent-brand" aria-label="Prix maximum" />
      <button type="button" onClick={() => onApply(a ? Number(a) : null, b ? Number(b) : null)} className="mt-1 w-full rounded-md bg-dark py-1.5 text-xs font-bold text-background">Appliquer</button>
    </Fold>
  );
}
