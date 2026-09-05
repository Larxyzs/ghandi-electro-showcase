/**
 * Master product references — pure logic.
 *
 * A reference is the PERMANENT definition of a product that belongs in the
 * catalogue (brand, model, exact official URL, category). Product rows are the
 * current rebuilt data. Deleting products never deletes references: the
 * reference list is the rebuild queue and the audit baseline.
 */

export type ReferenceStatus =
  | "pending"
  | "processing"
  | "verified"
  | "needs_review"
  | "failed"
  | "official_page_inaccessible"
  | "identity_mismatch";

export type CatalogReferenceDraft = {
  manufacturer: string;
  brand: string;
  model: string;
  reference: string;
  official_url: string | null;
  canonical_url: string | null;
  region: string;
  product_type: string;
  node_path: string;
  node_id: string | null;
  product_id: string | null;
  name: string;
  requires_discovery: boolean;
  active: boolean;
  source: string;
};

export type CatalogReference = CatalogReferenceDraft & {
  id: string;
  last_status: ReferenceStatus;
  last_error: string;
  last_verified_at: string | null;
};

export type ReferenceSourceProduct = {
  id: string;
  name: string;
  brand: string;
  serial_number: string;
  node_id: string;
  source_url?: string | null;
  node_path?: string;
};

const clean = (value: string | null | undefined) => (value ?? "").toString().trim();

/** Host of a URL without "www.", empty when the URL is unusable. */
export function hostOf(url: string | null | undefined): string {
  try {
    return new URL(clean(url)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Region hint carried by the official URL (Morocco first, then North Africa). */
export function regionOf(url: string | null | undefined): string {
  const host = hostOf(url);
  let path = "";
  try {
    path = new URL(clean(url)).pathname.toLowerCase();
  } catch {
    path = "";
  }
  if (host.endsWith(".ma") || /(^|[/_.-])(ma|maroc|morocco)([/_.-]|$)/.test(path)) return "ma";
  if (/\.(dz|tn|ly|eg)$/.test(host)) return "north-africa";
  return host ? "international" : "unknown";
}

/** Only an https manufacturer URL can be a rebuild source. */
export function usableOfficialUrl(url: string | null | undefined): string | null {
  const value = clean(url);
  if (!/^https:\/\/[^\s]+$/i.test(value)) return null;
  if (/^(www\.)?(google|bing|duckduckgo|amazon|jumia|aliexpress|ebay|facebook|instagram)\./i.test(hostOf(value)))
    return null;
  return value;
}

/** Stable identity of a reference: exact official URL, else brand + model. */
export function referenceKey(ref: {
  official_url?: string | null;
  brand?: string | null;
  model?: string | null;
}): string {
  const url = usableOfficialUrl(ref.official_url ?? null);
  if (url) return url.replace(/\/+$/, "").toLowerCase();
  return `${clean(ref.brand).toLowerCase()}|${clean(ref.model).toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
}

/** Turns a stored product into its permanent reference definition. */
export function referenceFromProduct(
  product: ReferenceSourceProduct,
  options: { source?: string } = {},
): CatalogReferenceDraft {
  const official = usableOfficialUrl(product.source_url ?? null);
  const path = clean(product.node_path);
  const model = clean(product.serial_number);
  return {
    manufacturer: clean(product.brand),
    brand: clean(product.brand),
    model,
    reference: model,
    official_url: official,
    canonical_url: official,
    region: regionOf(official),
    product_type: path.split("/").map((p) => p.trim()).filter(Boolean).slice(-1)[0] ?? "",
    node_path: path,
    node_id: product.node_id || null,
    product_id: product.id || null,
    name: clean(product.name),
    // Without an exact official URL a rebuild has to find the page first.
    requires_discovery: !official,
    active: true,
    source: options.source ?? "catalog_snapshot",
  };
}

/** Keeps one entry per reference key, preferring the one with an official URL. */
export function dedupeReferences(list: CatalogReferenceDraft[]): CatalogReferenceDraft[] {
  const byKey = new Map<string, CatalogReferenceDraft>();
  for (const draft of list) {
    const key = referenceKey(draft);
    if (!key || key === "|") continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, draft);
      continue;
    }
    if (!existing.official_url && draft.official_url) byKey.set(key, draft);
  }
  return [...byKey.values()];
}

export function referenceLabel(ref: {
  brand?: string | null;
  model?: string | null;
  name?: string | null;
}): string {
  const parts = [clean(ref.brand), clean(ref.model)].filter(Boolean);
  return parts.join(" ") || clean(ref.name) || "(sans référence)";
}
