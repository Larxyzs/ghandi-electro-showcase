export type NodeLevel = 1 | 2 | 3 | 4;

/** Deepest folder level: level 4 (Format) is optional. */
export const MAX_LEVEL: NodeLevel = 4;

/** Products (Modèles) live in a Produit (level 3) or, when it has some, a Format (level 4). */
export function canHoldProducts(level: NodeLevel) {
  return level >= 3;
}

export type CatalogNode = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  level: NodeLevel;
  sort_order: number;
  /** Raw stored value: a storage path or an https URL. */
  image_path: string | null;
  /** Ready-to-render URL (signed when stored in the bucket). */
  image_url: string | null;
};

export type ProductSpec = { label: string; value: string };

/** Reusable premium marketing blocks rendered on the public product page. */
export type MarketingSection =
  | { type: "full_image"; image: string; title?: string; body?: string }
  | { type: "image_text"; image: string; title: string; body: string; reverse?: boolean }
  | { type: "feature"; title: string; body: string }
  | { type: "two_images"; images: string[]; title?: string }
  | { type: "three_images"; images: string[]; title?: string }
  | { type: "overlay"; image: string; title: string; body: string }
  | { type: "video"; url: string; title?: string }
  | { type: "specs"; title?: string };

export type Product = {
  id: string;
  /** Primary folder. */
  node_id: string;
  /** Every folder this product appears in (includes node_id). */
  node_ids?: string[];
  name: string;
  brand: string;
  serial_number: string;
  stock: number;
  price: number | null;
  image_path: string | null;
  image_url: string | null;
  /** Product characteristics (formerly "description"). */
  characteristics: string;
  specifications: ProductSpec[];
  /** Ready-to-render slideshow URLs (signed when stored in the bucket). */
  gallery: string[];
  /** Raw stored slideshow values (storage paths or https URLs) — admin editing. */
  gallery_paths?: string[];
  marketing_sections: MarketingSection[];
  source_url: string | null;
  source_name: string | null;
  sort_order: number;
  featured: boolean;
};

export type SiteMode = "online" | "maintenance" | "coming_soon" | "closed";

export const SITE_MODE_LABELS: Record<SiteMode, string> = {
  online: "En ligne",
  maintenance: "Maintenance",
  coming_soon: "Bientôt disponible",
  closed: "Fermé",
};

export type SiteSettings = {
  primary_color: string;
  secondary_color: string;
  text_color: string;
  site_mode: SiteMode;
};

export type PopularSearch = { id: string; term: string; sort_order: number };

export type SiteData = {
  settings: SiteSettings;
  nodes: CatalogNode[];
  products: Product[];
  popularSearches: PopularSearch[];
};

export const LEVEL_LABELS: Record<NodeLevel, string> = {
  1: "Catégorie",
  2: "Type de produit",
  3: "Produit",
  4: "Format",
};

export function childrenOf(nodes: CatalogNode[], parentId: string | null) {
  return nodes
    .filter((n) => n.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/** Ancestor chain from level 1 down to the given node (inclusive). */
export function pathOf(nodes: CatalogNode[], nodeId: string | null): CatalogNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: CatalogNode[] = [];
  let current = nodeId ? byId.get(nodeId) : undefined;
  while (current) {
    chain.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return chain;
}

export function findChildBySlug(nodes: CatalogNode[], parentId: string | null, slug: string) {
  return nodes.find((n) => n.parent_id === parentId && n.slug === slug) ?? null;
}

/** All descendant node ids (including the node itself). */
export function subtreeIds(nodes: CatalogNode[], nodeId: string): string[] {
  const ids = [nodeId];
  for (const child of nodes.filter((n) => n.parent_id === nodeId)) {
    ids.push(...subtreeIds(nodes, child.id));
  }
  return ids;
}

/** All folders a product is listed in (primary + extra categories). */
export function nodeIdsOf(product: Product): string[] {
  const extra = product.node_ids ?? [];
  return extra.includes(product.node_id) ? extra : [product.node_id, ...extra];
}

export function productsIn(nodes: CatalogNode[], products: Product[], nodeId: string) {
  const ids = new Set(subtreeIds(nodes, nodeId));
  return products.filter((p) => nodeIdsOf(p).some((id) => ids.has(id)));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Loose multi-word search over product name, brand, serial and its folder path. */
export function searchProducts(nodes: CatalogNode[], products: Product[], query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return products;
  return products.filter((product) => {
    const haystack = normalize(
      [
        product.name,
        product.brand,
        product.serial_number,
        product.characteristics,
        ...pathOf(nodes, product.node_id).map((n) => n.name),
      ].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}

/** Level-1 / level-2 ancestor of a product's folder, if any. */
export function ancestorAtLevel(nodes: CatalogNode[], nodeId: string, level: NodeLevel) {
  return pathOf(nodes, nodeId).find((n) => n.level === level) ?? null;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  primary_color: "#ffffff",
  secondary_color: "#1266e8",
  text_color: "#0f172a",
  site_mode: "online",
};