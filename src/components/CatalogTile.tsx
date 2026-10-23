import { Link } from "@tanstack/react-router";
import {
  AirVent, Box, Coffee, CookingPot, Fan, Flame, Heater, Microwave, Refrigerator, Shirt, Snowflake, Sofa,
  Speaker, Tv, Utensils, WashingMachine, Wind, Droplets, Sparkles, type LucideIcon,
} from "lucide-react";
import type { CatalogNode } from "@/lib/catalog-types";
import { useDynamicText } from "@/lib/dynamic-text";
import { cn } from "@/lib/utils";

const ICONS: [RegExp, LucideIcon][] = [
  [/refrig|frigo|mini bar|table top/, Refrigerator],
  [/congel/, Snowflake],
  [/machine a laver|lave-linge|seche-linge|linge/, WashingMachine],
  [/vaisselle|evier/, Droplets],
  [/televis|tv|telev|ecran/, Tv],
  [/\bson\b|barre de son|audio/, Speaker],
  [/climat/, AirVent],
  [/ventil/, Fan],
  [/hotte|air/, Wind],
  [/micro-onde/, Microwave],
  [/cuisiniere|plaque|four|cuisson|encastrable/, Flame],
  [/chauffe|chauffage|radiateur/, Heater],
  [/cafe|petit dej|bouilloire|grille/, Coffee],
  [/culinaire|robot|blender/, CookingPot],
  [/fer|vapeur/, Shirt],
  [/aspir|sol|entretien/, Sparkles],
  [/confort/, Sofa],
  [/petit electro/, Utensils],
  [/gros electro/, Refrigerator],
];

/** Clean line icon picked from a category name. */
export function nodeIcon(name: string): LucideIcon {
  const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ICONS.find(([re]) => re.test(n))?.[1] ?? Box;
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
          <img src={node.image_url} alt={tr(node.name)} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <Icon className="h-10 w-10 text-brand" strokeWidth={1.4} />
        )}
      </div>
      <p className="text-sm font-medium leading-tight">{tr(node.menu_label?.trim() || node.name)}</p>
      {count !== undefined && <p className="text-xs text-text-3">{count} produit{count === 1 ? "" : "s"}</p>}
    </Link>
  );
}
