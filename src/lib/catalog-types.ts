export type NodeLevel = 1 | 2 | 3;

export type CatalogNode = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  level: NodeLevel;
  sort_order: number;
};

export type Product = {
  id: string;
  node_id: string;
  name: string;
  brand: string;
  serial_number: string;
  stock: number;
  price: number | null;
  image_path: string | null;
  image_url: string | null;
  description: string;
  sort_order: number;
};

export type SiteSettings = {
  primary_color: string;
  secondary_color: string;
  text_color: string;
};

export type SiteData = {
  settings: SiteSettings;
  nodes: CatalogNode[];
  products: Product[];
};

export const LEVEL_LABELS: Record<NodeLevel, string> = {
  1: "Catégorie",
  2: "Type d'appareil",
  3: "Modèle",
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

export function productsIn(nodes: CatalogNode[], products: Product[], nodeId: string) {
  const ids = new Set(subtreeIds(nodes, nodeId));
  return products.filter((p) => ids.has(p.node_id));
}

export const DEFAULT_SETTINGS: SiteSettings = {
  primary_color: "#ffffff",
  secondary_color: "#1266e8",
  text_color: "#0f172a",
};