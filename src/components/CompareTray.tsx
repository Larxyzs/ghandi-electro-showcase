import { useState } from "react";
import { Link, useLoaderData } from "@tanstack/react-router";
import { ArrowLeftRight, PackageSearch, X } from "lucide-react";
import { useCompare } from "@/lib/compare";
import type { SiteData } from "@/lib/catalog-types";

/** Right-edge "Comparer (n)" tab + bottom bar with the compared products. */
export function CompareTray() {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const { ids, remove, clear } = useCompare();
  const [open, setOpen] = useState(false);
  const items = ids.map((id) => data.products.find((p) => p.id === id)).filter((p) => p !== undefined);
  if (items.length === 0) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} aria-label={`Comparer (${items.length})`}
        className="fixed end-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 rounded-s-md border border-e-0 border-border bg-card px-2 py-3 text-xs font-bold shadow-[var(--shadow-hover)]">
        <ArrowLeftRight className="h-5 w-5 text-brand" />
        <span className="[writing-mode:vertical-rl]">Comparer</span>
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand text-brand-foreground">{items.length}</span>
      </button>
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card shadow-[var(--shadow-menu)]">
          <div className="shell flex flex-wrap items-center gap-3 py-3">
            <div className="flex flex-1 gap-2 overflow-x-auto">
              {items.map((p) => (
                <div key={p.id} className="relative flex w-40 shrink-0 items-center gap-2 rounded-md border border-border p-1.5">
                  {p.image_url ? <img src={p.image_url} alt="" className="h-10 w-10 object-contain" /> : <PackageSearch className="h-6 w-6 text-text-3" />}
                  <span className="line-clamp-2 text-xs">{p.name}</span>
                  <button type="button" onClick={() => remove(p.id)} aria-label="Retirer" className="absolute -top-2 -end-2 grid h-5 w-5 place-items-center rounded-full border border-border bg-card"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={clear} className="text-sm text-text-2 underline">Vider</button>
            <Link to="/comparateur" onClick={() => setOpen(false)} className="rounded-md bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground">Comparer</Link>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer"><X className="h-5 w-5" /></button>
          </div>
        </div>
      )}
    </>
  );
}
