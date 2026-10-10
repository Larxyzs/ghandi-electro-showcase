export type SpecRow = { label: string; value: string };
export type SpecGroup = { title: string; rows: SpecRow[] };

export type BulkItem = {
  key: string;
  sourceUrl: string;
  brand: string;
  category: string;
  name: string;
  model: string;
  priceText: string;
  priceValue: number | null;
  currency: string;
  images: string[];
  specs: SpecRow[];
  specGroups: SpecGroup[];
  needsReview: boolean;
  warnings?: string[];
  /** Section chosen in the importer for this product. */
  nodeId?: string | null;
};

export type BulkOptions = {
  mode: "skip" | "empty" | "all";
  /** Put every product in this one folder (overrides the file's category). */
  folderId: string | null;
  fallbackId: string | null;
  createMissing: boolean;
  copyImages: boolean;
  dropForeignPrice: boolean;
};

export type PreviewRow = {
  key: string;
  status: "new" | "exists" | "problem";
  reason?: string;
  existingId?: string;
};

export type BulkRowResult = {
  key: string;
  outcome: "created" | "updated" | "skipped" | "problem";
  productId?: string;
  error?: string;
  warnings?: string[];
};

const clean = (v: unknown) =>
  typeof v === "string" ? v.normalize("NFC").replace(/\s+/g, " ").trim() : "";

const rows = (v: unknown): SpecRow[] =>
  Array.isArray(v)
    ? v
        .map((r) => ({ label: clean(r?.label), value: clean(r?.value) }))
        .filter((r) => r.label || r.value)
    : [];

/** Tolerant parser: accepts the full file or a bare array of products. */
export function parseBulkFile(text: string): {
  items: BulkItem[];
  failed: { sourceUrl: string; error: string }[];
} {
  const json = JSON.parse(text);
  const list: unknown[] = Array.isArray(json) ? json : Array.isArray(json?.products) ? json.products : [];
  const failed = Array.isArray(json?.failed)
    ? json.failed.map((f: { sourceUrl?: unknown; error?: unknown }) => ({ sourceUrl: clean(f?.sourceUrl), error: clean(f?.error) }))
    : [];
  const items = list.map((raw, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (raw ?? {}) as any;
    const http = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? u.trim() : "");
    const imgs = [
      http(p.mainImage),
      ...(Array.isArray(p.images) ? p.images.map(http) : []),
      ...(Array.isArray(p.otherImages) ? p.otherImages.map(http) : []),
    ].filter(Boolean);
    const pv = typeof p.priceValue === "number" && Number.isFinite(p.priceValue) ? p.priceValue : null;
    return {
      key: `${i}-${clean(p.sourceUrl) || clean(p.model)}`,
      sourceUrl: clean(p.sourceUrl),
      brand: clean(p.brand),
      category: clean(p.category) || clean(p.sourceCategory),
      name: clean(p.name),
      model: clean(p.model),
      priceText: clean(p.price),
      priceValue: pv,
      currency: clean(p.currency).toUpperCase(),
      images: Array.from(new Set(imgs)),
      specs: rows(p.specs),
      specGroups: Array.isArray(p.specGroups)
        ? p.specGroups
            .map((g: { title?: unknown; rows?: unknown }) => ({ title: clean(g?.title), rows: rows(g?.rows) }))
            .filter((g: SpecGroup) => g.rows.length)
        : [],
      needsReview: p.needsReview === true,
      warnings: Array.isArray(p.warnings) ? p.warnings.map(clean).filter(Boolean) : [],
    };
  });
  return { items, failed };
}
