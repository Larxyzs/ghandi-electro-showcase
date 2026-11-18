import { Link } from "@tanstack/react-router";
import { categoryIcon, type CategoryIcon } from "@/components/CategoryIcons";
import type { CatalogNode } from "@/lib/catalog-types";
import { useDynamicText } from "@/lib/dynamic-text";
import { cn } from "@/lib/utils";

/** Ghandi's blue line drawing for a category name. */
export function nodeIcon(name: string): CategoryIcon {
  return categoryIcon(name);
}

/** White tile (picture or icon + name) used for category levels. */
export function CatalogTile({
  node,
  splat,
  count,
  muted,
}: {
  node: CatalogNode;
  splat: string;
  count?: number;
  muted?: boolean;
  shape?: "square" | "circle";
}) {
  const Icon = nodeIcon(node.name);
  const tr = useDynamicText();
  return (
    <Link
      to="/produits/$"
      params={{ _splat: splat }}
      className={cn("group flex h-full flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center transition hover:border-input hover:shadow-[var(--shadow-hover)]", muted && "opacity-50")}
    >
      <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-md">
        {node.image_url ? (
          <img src={node.image_url} alt={tr(node.name)} loading="lazy" className="h-full w-full object-contain p-1 transition group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-[82%] w-[82%] place-items-center rounded-full bg-brand-soft/70 transition group-hover:bg-brand-soft">
            <Icon className="h-[72%] w-[72%] text-brand transition group-hover:scale-[1.05]" strokeWidth={1.6} />
          </div>
        )}
      </div>
      <p className="text-sm font-medium leading-tight">{tr(node.menu_label?.trim() || node.name)}</p>
      {count !== undefined && <p className="text-xs text-text-3">{count} produit{count === 1 ? "" : "s"}</p>}
    </Link>
  );
}
