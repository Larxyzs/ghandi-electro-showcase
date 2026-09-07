/**
 * Persistence for the manufacturer extraction registry.
 *
 * Stored rules (table `manufacturer_gallery_rules`) override the built-in ones,
 * so the one-time deep inspection can teach Cindy a manufacturer's real
 * carousel structure without any code change.
 */
import {
  BUILTIN_MANUFACTURER_RULES,
  EMPTY_GALLERY_RULES,
  domainOfUrl,
  rulesForUrl,
  type ManufacturerRules,
} from "./manufacturer-rules";

type Cache = { registry: ManufacturerRules[]; at: number };
let cache: Cache | null = null;
const TTL = 5 * 60 * 1000;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const normalise = (row: Record<string, unknown>): ManufacturerRules => {
  const gallery = (row["gallery"] ?? {}) as Partial<ManufacturerRules["gallery"]>;
  const identity = (row["identity"] ?? {}) as Partial<ManufacturerRules["identity"]>;
  return {
    brand: String(row["brand"] ?? ""),
    domains: ((row["domains"] ?? []) as string[]).map((d) => String(d).toLowerCase()),
    identity: {
      model_attributes: identity.model_attributes ?? [],
      model_in_url_slug: identity.model_in_url_slug ?? true,
    },
    gallery: { ...EMPTY_GALLERY_RULES, ...gallery },
    verified: Boolean(row["verified"]),
    verified_by: String(row["verified_by"] ?? ""),
    sample_urls: ((row["sample_urls"] ?? []) as string[]).map(String),
    notes: String(row["notes"] ?? ""),
  };
};

/** Built-in registry with stored entries layered on top (by brand). */
export async function manufacturerRegistry(options: { fresh?: boolean } = {}): Promise<ManufacturerRules[]> {
  if (!options.fresh && cache && Date.now() - cache.at < TTL) return cache.registry;

  const byBrand = new Map<string, ManufacturerRules>();
  for (const entry of BUILTIN_MANUFACTURER_RULES) byBrand.set(entry.brand.toLowerCase(), entry);

  try {
    const client = await db();
    const { data } = await client
      .from("manufacturer_gallery_rules")
      .select("brand, domains, identity, gallery, verified, verified_by, sample_urls, notes");
    for (const row of data ?? []) {
      const stored = normalise(row as unknown as Record<string, unknown>);
      if (!stored.brand) continue;
      const builtin = byBrand.get(stored.brand.toLowerCase());
      byBrand.set(stored.brand.toLowerCase(), {
        ...stored,
        domains: stored.domains.length ? stored.domains : (builtin?.domains ?? []),
      });
    }
  } catch {
    /* built-in registry still applies */
  }

  const registry = [...byBrand.values()];
  cache = { registry, at: Date.now() };
  return registry;
}

/** The verified rules that own this exact official URL, if any. */
export async function rulesForOfficialUrl(url: string): Promise<ManufacturerRules | null> {
  return rulesForUrl(url, await manufacturerRegistry());
}

/** Saves rules discovered by the one-time deep inspection. */
export async function saveManufacturerRules(entry: ManufacturerRules) {
  const client = await db();
  const row = {
    brand: entry.brand,
    domains: entry.domains.map((d) => d.toLowerCase().replace(/^www\./, "")) as never,
    identity: entry.identity as never,
    gallery: entry.gallery as never,
    verified: entry.verified,
    verified_by: entry.verified_by,
    sample_urls: entry.sample_urls as never,
    notes: entry.notes.slice(0, 2000),
    updated_at: new Date().toISOString(),
  };
  const { error } = await client
    .from("manufacturer_gallery_rules")
    .upsert(row, { onConflict: "brand" });
  if (error) throw new Error(error.message);
  cache = null;
  return { ok: true as const, brand: entry.brand };
}

export { domainOfUrl };
