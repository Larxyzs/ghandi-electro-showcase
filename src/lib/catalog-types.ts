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

/**
 * Junk that manufacturer pages expose alongside real product photos:
 * API/JSON endpoints, social-share cards, logos, sprites, tracking pixels.
 * These are never slideshow material.
 */
const JUNK_PATTERNS = [
  /jcr:content/i,
  /vendorlibs/i,
  /\.(?:json|js|css|svg|gif|ico)(?:$|[?#])/i,
  /[-_/](?:share|sharing|og[-_]image|social|thumb(?:nail)?|placeholder|no[-_]image|coming[-_]soon)[-_.]/i,
  /[-_/](?:logo|logos|icon|icons|sprite|badge|banner[-_]ad|pixel|spacer|blank)[-_./]/i,
  /1x1|transparent\.png/i,
];

/** A usable slideshow photo: https, image-like, not junk. */
export function isUsableImage(value: string | null | undefined): value is string {
  const url = (value ?? "").trim();
  if (!url) return false;
  if (!/^https?:\/\//i.test(url) && !/^[\w./-]+\.(?:jpe?g|png|webp|avif)$/i.test(url)) {
    // storage paths (no scheme) are fine, anything else is not
    if (!/^[\w./-]+$/.test(url)) return false;
  }
  if (JUNK_PATTERNS.some((re) => re.test(url))) return false;
  const path = url.split(/[?#]/)[0]!;
  // must end with an image extension (CDN paths without one are usually endpoints)
  if (!/\.(?:jpe?g|png|webp|avif)$/i.test(path)) return false;
  return true;
}

/**
 * Identity key for a slideshow image: ignores query strings, size hints,
 * CDN resizing *and interchangeable CDN mirror hostnames* so the same
 * manufacturer photo can never appear twice.
 */
export function imageKey(value: string) {
  let key = value.trim().toLowerCase();
  try {
    const parsed = new URL(key);
    const host = parsed.hostname
      .replace(/^www\./, "")
      // aws-obg-image-lb-1..5.tcl.com, img3.example.com, cdn-02.brand.com → same origin
      .replace(/(^|\.)((?:[a-z-]*?)(?:img|image|cdn|static|media|lb|assets)[a-z-]*?)-?\d+\./, "$1$2.");
    key = `${host}${parsed.pathname.replace(/\/{2,}/g, "/")}`;
  } catch {
    key = key.split("?")[0]!.split("#")[0]!;
  }
  return key
    .replace(/[?#].*$/, "")
    .replace(/[_-]?\d{2,4}x\d{2,4}/g, "")
    .replace(/@\dx/g, "")
    .replace(/\/(?:w|h|q|c)_\d+/g, "")
    .replace(/[_-]\d{3,4}(?=\.[a-z]{3,4}$)/, "")
    .replace(/\.(?:jpe?g|png|webp|avif)$/, "");
}

/**
 * Cleans a slideshow: drops junk/non-image entries, then keeps the first
 * occurrence of each distinct photo (order preserved).
 */
export function dedupeGallery(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = (raw ?? "").trim();
    if (!isUsableImage(value)) continue;
    const key = imageKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Audit report for one product's slideshow. */
export type GalleryAudit = {
  kept: string[];
  removedDuplicates: string[];
  removedJunk: string[];
  /** true when the slideshow ends up empty (needs research / a main photo). */
  empty: boolean;
};

/**
 * Deep analysis of a slideshow: separates duplicates from non-photo junk so
 * both humans and Cindy can explain exactly what was wrong and fix it.
 */
export function auditGallery(
  values: (string | null | undefined)[],
  mainImage?: string | null,
): GalleryAudit {
  const removedJunk: string[] = [];
  const removedDuplicates: string[] = [];
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const raw of [mainImage, ...values]) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    if (!isUsableImage(value)) {
      removedJunk.push(value);
      continue;
    }
    const key = imageKey(value);
    if (seen.has(key)) {
      removedDuplicates.push(value);
      continue;
    }
    seen.add(key);
    kept.push(value);
  }
  return { kept, removedDuplicates, removedJunk, empty: kept.length === 0 };
}


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