import { Link } from "@tanstack/react-router";
import { Box, Folder, Layers, Tag } from "lucide-react";
import { LEVEL_LABELS, type CatalogNode, type NodeLevel } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

const LEVEL_ICON: Record<NodeLevel, typeof Folder> = { 1: Folder, 2: Layers, 3: Tag, 4: Box };

/** Image + label card used for every hierarchy level in the public drill-down. */
export function CatalogTile({
  node,
  splat,
  count,
  shape = "square",
}: {
  node: CatalogNode;
  /** Full splat path for this node, e.g. "gros-electromenager/froid". */
  splat: string;
  count?: number;
  shape?: "square" | "circle";
}) {
  const Icon = LEVEL_ICON[node.level];
  return (
    <Link
      to="/produits/$"
      params={{ _splat: splat }}
      className={cn(
        "group flex h-full flex-col items-center gap-3 border border-border bg-card p-4 text-center shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1.5 hover:border-brand/40",
        shape === "circle" ? "rounded-3xl" : "rounded-2xl",
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-brand-soft/60",
          shape === "circle" ? "aspect-square rounded-full" : "aspect-square rounded-xl",
        )}
      >
        {node.image_url ? (
          <img
            src={node.image_url}
            alt={node.name}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand/40">
            <Icon className="h-9 w-9" />
          </div>
        )}
      </div>
      <div className="mt-auto">
        <p className="text-sm font-semibold group-hover:text-brand sm:text-base">{node.name}</p>
        <p className="mt-0.5 text-[0.7rem] text-foreground/50">
          {count !== undefined ? `${count} modèle(s)` : LEVEL_LABELS[node.level]}
        </p>
      </div>
    </Link>
  );
}
