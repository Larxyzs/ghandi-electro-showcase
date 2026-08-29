import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLoaderData, useNavigate } from "@tanstack/react-router";
import { PackageSearch, Search, X } from "lucide-react";
import { searchProducts, type SiteData } from "@/lib/catalog-types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function HeaderSearch() {
  const { t } = useI18n();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const suggestions = useMemo(
    () => (query.trim() ? searchProducts(data.nodes, data.products, query).slice(0, 5) : []),
    [data.nodes, data.products, query],
  );

  return (
    <div ref={wrapRef} className="relative flex justify-end" onMouseEnter={() => setOpen(true)}>
      <div
        className={cn(
          "flex items-center overflow-hidden rounded-full border transition-all duration-300 ease-out",
          open
            ? "absolute end-0 top-0 z-50 w-[min(24rem,calc(100vw-2.5rem))] border-brand/50 bg-card shadow-[var(--shadow-card)] opacity-100"
            : "relative w-10 border-transparent bg-transparent",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t("products.search")}
          aria-expanded={open}
          className="grid h-10 w-10 shrink-0 place-items-center text-foreground/70 hover:text-brand"
        >
          <Search className="h-4.5 w-4.5" />
        </button>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("products.search")}
          aria-label={t("products.search")}
          className={cn(
            "min-w-0 flex-1 bg-transparent py-2 pe-4 text-sm outline-none transition-opacity duration-200",
            open ? "opacity-100" : "pointer-events-none w-0 opacity-0",
          )}
        />
        {open && query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Effacer"
            className="me-2 text-foreground/45 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.trim() === "" && data.popularSearches.length > 0 && (
        <div className="absolute top-12 end-0 z-50 w-[min(26rem,calc(100vw-2.5rem))] rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-[0.7rem] font-semibold tracking-wide text-foreground/50 uppercase">
            Recherches populaires
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.popularSearches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  navigate({ to: "/produits", search: { q: item.term } });
                }}
                className="rounded-full border border-border bg-brand-soft/50 px-3.5 py-1.5 text-xs font-semibold text-brand-deep transition-colors hover:border-brand/40 hover:bg-brand-soft"
              >
                {item.term}
              </button>
            ))}
          </div>
        </div>
      )}

      {open && query.trim() !== "" && (
        <div className="absolute top-12 end-0 z-50 w-[min(26rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          {suggestions.length === 0 ? (
            <p className="px-4 py-5 text-sm text-foreground/60">{t("products.emptySearch")}</p>
          ) : (
            <>
              {suggestions.map((p) => (
                <Link
                  key={p.id}
                  to="/produits/article/$productId"
                  params={{ productId: p.id }}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-brand-soft/60"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-soft/70 text-brand/50">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <PackageSearch className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-foreground/55">{p.brand}</span>
                  </span>
                </Link>
              ))}
              <Link
                to="/produits"
                search={{ q: query.trim() }}
                onClick={() => setOpen(false)}
                className="block border-t border-border px-4 py-3 text-sm font-semibold text-brand hover:bg-brand-soft/60"
              >
                Voir tous les résultats
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
