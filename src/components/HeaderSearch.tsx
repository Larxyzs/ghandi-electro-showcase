import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLoaderData, useNavigate } from "@tanstack/react-router";
import { Folder, PackageSearch, Search, Tag, X } from "lucide-react";
import { pathOf, searchProducts, type CatalogNode, type SiteData } from "@/lib/catalog-types";
import { useDynamicText } from "@/lib/dynamic-text";
import { formatDH } from "@/lib/company";
import { BRAND_NAMES } from "@/lib/brands";

const fold = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function splatOf(nodes: CatalogNode[], id: string) {
  return pathOf(nodes, id).map((n) => n.slug).join("/");
}

/** Big always-visible search bar with instant suggestions. */
export function HeaderSearch({ className }: { className?: string }) {
  const tr = useDynamicText();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const q = query.trim();
  const products = useMemo(
    () => (q ? searchProducts(data.nodes, data.products, q).slice(0, 6) : []),
    [data.nodes, data.products, q],
  );
  const folders = useMemo(
    () => (q.length >= 2 ? data.nodes.filter((n) => fold(n.name).includes(fold(q))).slice(0, 4) : []),
    [data.nodes, q],
  );
  const brands = useMemo(
    () => (q.length >= 2 ? BRAND_NAMES.filter((b) => fold(b).includes(fold(q))).slice(0, 3) : []),
    [q],
  );
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapRef} className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!q) return;
          close();
          navigate({ to: "/produits", search: { q } });
        }}
        className="relative flex items-center rounded-full border-2 border-brand/70 bg-card ps-4 focus-within:border-brand"
      >
        <Search className="h-4.5 w-4.5 shrink-0 text-brand" />
        <input
          type="search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Rechercher un produit, une marque, une référence…"
          aria-label="Rechercher"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Effacer" className="px-2 text-foreground/45">
            <X className="h-4 w-4" />
          </button>
        )}
        <button type="submit" className="m-1 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-primary-foreground">
          OK
        </button>
      </form>

      {open && q && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          {(folders.length > 0 || brands.length > 0) && (
            <div className="flex flex-wrap gap-2 border-b border-border p-3">
              {folders.map((n) => (
                <Link key={n.id} to="/produits/$" params={{ _splat: splatOf(data.nodes, n.id) }} onClick={close}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep">
                  <Folder className="h-3 w-3" /> {tr(n.name)}
                </Link>
              ))}
              {brands.map((b) => (
                <Link key={b} to="/produits" search={{ q: b }} onClick={close}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold">
                  <Tag className="h-3 w-3" /> {b}
                </Link>
              ))}
            </div>
          )}
          {products.length === 0 ? (
            <p className="px-4 py-5 text-sm text-foreground/60">Aucun produit trouvé.</p>
          ) : (
            <>
              {products.map((p) => (
                <Link key={p.id} to="/produits/article/$productId" params={{ productId: p.id }} onClick={close}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-soft/60">
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-card text-brand/50">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-contain" /> : <PackageSearch className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{tr(p.name)}</span>
                    <span className="block truncate text-xs text-foreground/55">{p.brand} {p.model || p.serial_number}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold">{p.price !== null ? formatDH(p.price) : "Prix sur demande"}</span>
                </Link>
              ))}
              <Link to="/produits" search={{ q }} onClick={close}
                className="block border-t border-border px-4 py-3 text-sm font-semibold text-brand hover:bg-brand-soft/60">
                Voir tous les résultats
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
