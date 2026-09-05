/**
 * Exact-URL product import — the first-class Cindy workflow.
 *
 *   URL exacte → page officielle → identité du produit → galerie officielle
 *   → extraction/validation (OpenAI) → mémoire fabricant → revue admin → catalogue
 *
 * Guarantees:
 *  - one URL = one product, processed in complete isolation (no value of
 *    product A can ever land on product B);
 *  - no search engine is used for an exact URL, and an inaccessible official
 *    page is NEVER replaced by another source: it is reported as failed;
 *  - a failing URL never stops the batch;
 *  - everything deterministic (HTTP, HTML, images, dedupe, database) is code;
 *    the AI is called once per product.
 */
import { fetchOfficialPage, htmlToText } from "./page-fetch.server";
import { extractProductGallery } from "./product-gallery";
import {
  collectSpecCandidates,
  extractProductFromPage,
  identifyProduct,
  modelFromUrl,
  type ExtractedField,
  type ProductIdentity,
} from "./product-extract.server";
import type { ProductSpec } from "./catalog-types";

export type ImportStatus = "verified" | "needs_review" | "failed";

export type ImportedProduct = {
  url: string;
  canonicalUrl: string;
  domain: string;
  identity: ProductIdentity;
  gallery: string[];
  gallerySource: string;
  fields: ExtractedField[];
  specifications: ProductSpec[];
  characteristics: string;
  price: number | null;
  currency: string;
  conflicts: string[];
  missing: string[];
  notes: string;
  fetchMethod: string;
  status: ImportStatus;
  error: string;
};

export type BatchProgress = {
  batchId: string;
  total: number;
  processed: number;
  verified: number;
  needs_review: number;
  failed: number;
  current?: string;
};

const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ------------------------- manufacturer memory ------------------------- */

export type ManufacturerProfile = {
  domain: string;
  brand: string;
  spec_terms: Record<string, string>;
  gallery_patterns: string[];
  quirks: string[];
  corrections: { field: string; means: string; at: string }[];
  notes: string;
};

const profileCache = new Map<string, { profile: ManufacturerProfile | null; at: number }>();
const PROFILE_TTL = 5 * 60 * 1000;

/** Per-manufacturer memory. Rules are never shared between manufacturers. */
export async function getManufacturerProfile(domain: string): Promise<ManufacturerProfile | null> {
  const key = domain.toLowerCase();
  const cached = profileCache.get(key);
  if (cached && Date.now() - cached.at < PROFILE_TTL) return cached.profile;

  const client = await db();
  const { data } = await client
    .from("manufacturer_profiles")
    .select("domain, brand, spec_terms, gallery_patterns, quirks, corrections, notes")
    .eq("domain", key)
    .maybeSingle();

  const profile = data
    ? ({
        domain: data.domain,
        brand: data.brand ?? "",
        spec_terms: (data.spec_terms ?? {}) as Record<string, string>,
        gallery_patterns: (data.gallery_patterns ?? []) as string[],
        quirks: (data.quirks ?? []) as string[],
        corrections: (data.corrections ?? []) as ManufacturerProfile["corrections"],
        notes: data.notes ?? "",
      } satisfies ManufacturerProfile)
    : null;
  profileCache.set(key, { profile, at: Date.now() });
  return profile;
}

/** Turns the profile into short instructions added to the single AI call. */
export function profileHints(profile: ManufacturerProfile | null): string {
  if (!profile) return "";
  const lines: string[] = [];
  for (const [term, meaning] of Object.entries(profile.spec_terms).slice(0, 40)) {
    lines.push(`« ${term} » signifie ${meaning}`);
  }
  for (const quirk of profile.quirks.slice(0, 20)) lines.push(quirk);
  for (const correction of profile.corrections.slice(-20)) {
    lines.push(`Correction admin : « ${correction.field} » = ${correction.means}`);
  }
  if (profile.notes) lines.push(profile.notes);
  return lines.join("\n").slice(0, 2500);
}

/** Stores an admin correction under this manufacturer only. */
export async function rememberManufacturerRule(input: {
  domain: string;
  brand?: string;
  term?: string;
  means?: string;
  quirk?: string;
  note?: string;
}) {
  const domain = domainOf(input.domain) || input.domain.toLowerCase().replace(/^www\./, "");
  if (!domain) throw new Error("DOMAIN_REQUIRED");
  const client = await db();
  const existing = await getManufacturerProfile(domain);

  const spec_terms = { ...(existing?.spec_terms ?? {}) };
  if (input.term && input.means) spec_terms[input.term.trim()] = input.means.trim();
  const quirks = [...(existing?.quirks ?? [])];
  if (input.quirk && !quirks.includes(input.quirk.trim())) quirks.push(input.quirk.trim());
  const corrections = [...(existing?.corrections ?? [])];
  if (input.term && input.means) {
    corrections.push({ field: input.term.trim(), means: input.means.trim(), at: new Date().toISOString() });
  }

  const row = {
    domain,
    brand: input.brand?.trim() || existing?.brand || "",
    spec_terms: spec_terms as never,
    quirks: quirks as never,
    corrections: corrections.slice(-100) as never,
    notes: (input.note ?? existing?.notes ?? "").slice(0, 1500),
  };
  const { error } = await client.from("manufacturer_profiles").upsert(row, { onConflict: "domain" });
  if (error) throw new Error(error.message);
  profileCache.delete(domain);
  return { ok: true as const, domain };
}

/* ------------------------------ one URL -------------------------------- */

/** Reads ONE exact official product URL and returns its verified data. */
export async function importFromUrl(
  url: string,
  options: { signal?: AbortSignal; batchId?: string | null; persist?: boolean } = {},
): Promise<ImportedProduct> {
  const clean = url.trim().replace(/[)\]},.;]+$/, "");
  const domain = domainOf(clean);

  const empty: ImportedProduct = {
    url: clean,
    canonicalUrl: clean,
    domain,
    identity: { brand: "", name: "", model: "", family: "", canonicalUrl: clean },
    gallery: [],
    gallerySource: "none",
    fields: [],
    specifications: [],
    characteristics: "",
    price: null,
    currency: "",
    conflicts: [],
    missing: [],
    notes: "",
    fetchMethod: "",
    status: "failed",
    error: "",
  };

  let result: ImportedProduct;
  try {
    const page = await fetchOfficialPage(clean, options.signal ? { signal: options.signal } : {});
    const html = page.html;
    const pageText = htmlToText(html);

    const identity = identifyProduct(html, clean);
    if (!identity.model) identity.model = modelFromUrl(clean);

    // Gallery: authoritative slideshow only, in the manufacturer's own order.
    const gallery = extractProductGallery(html, page.finalUrl || clean, {
      brand: identity.brand,
      model: identity.model,
      name: identity.name,
    });

    const profile = await getManufacturerProfile(domain);
    if (!identity.brand && profile?.brand) identity.brand = profile.brand;

    const candidates = collectSpecCandidates(html);
    const extraction = await extractProductFromPage({
      url: clean,
      html,
      pageText,
      identity,
      candidates,
      profileHints: profileHints(profile),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    const { extractOfficialPrice } = await import("./cindy.server");
    const { price, currency } = extractOfficialPrice(html);

    const missing = [...extraction.missing];
    if (gallery.images.length === 0) missing.push("galerie officielle");

    result = {
      ...empty,
      canonicalUrl: extraction.identity.canonicalUrl || clean,
      identity: extraction.identity,
      gallery: gallery.images,
      gallerySource: gallery.source,
      fields: extraction.fields,
      specifications: extraction.specifications,
      characteristics: extraction.characteristics,
      price,
      currency,
      conflicts: extraction.conflicts,
      missing,
      notes: extraction.notes,
      fetchMethod: page.method,
      status: extraction.status === "verified" && missing.length === 0 ? "verified" : "needs_review",
      error: "",
    };
  } catch (error) {
    result = {
      ...empty,
      status: "failed",
      error: error instanceof Error ? error.message : "IMPORT_FAILED",
    };
  }

  if (options.persist !== false) {
    try {
      const client = await db();
      await client.from("product_imports").upsert(
        {
          url: result.url,
          batch_id: options.batchId ?? null,
          canonical_url: result.canonicalUrl,
          domain: result.domain,
          brand: result.identity.brand,
          model: result.identity.model,
          name: result.identity.name,
          status: result.status,
          fetch_method: result.fetchMethod,
          gallery: result.gallery as never,
          fields: result.fields as never,
          payload: {
            specifications: result.specifications,
            characteristics: result.characteristics,
            price: result.price,
            currency: result.currency,
            conflicts: result.conflicts,
            missing: result.missing,
            notes: result.notes,
            gallery_source: result.gallerySource,
          } as never,
          error: result.error,
        },
        { onConflict: "url" },
      );
    } catch {
      /* the import result itself still goes back to Cindy */
    }
  }

  return result;
}

/* ------------------------------- batches ------------------------------- */

/** Unique, ordered list of the http(s) URLs contained in a free-text message. */
export function parseUrls(input: string | string[]): string[] {
  const text = Array.isArray(input) ? input.join("\n") : input;
  const found = text.match(/https?:\/\/[^\s"'<>()]+/gi) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of found) {
    const url = raw.replace(/[)\]},.;]+$/, "");
    const key = url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

/**
 * Processes many exact URLs with per-product isolation, bounded concurrency and
 * live progress. 3 failures out of 100 leave the other 97 finished.
 */
export async function importBatch(
  urls: string[],
  options: {
    concurrency?: number;
    signal?: AbortSignal;
    onProgress?: (progress: BatchProgress) => void;
    onProduct?: (product: ImportedProduct, index: number) => void | Promise<void>;
  } = {},
): Promise<{ batchId: string; results: ImportedProduct[]; progress: BatchProgress }> {
  const list = parseUrls(urls);
  const client = await db();

  let batchId = "";
  try {
    const { data } = await client
      .from("import_batches")
      .insert({ total: list.length, state: "running" })
      .select("id")
      .single();
    batchId = data?.id ?? "";
  } catch {
    /* progress tracking is best-effort */
  }

  const progress: BatchProgress = {
    batchId,
    total: list.length,
    processed: 0,
    verified: 0,
    needs_review: 0,
    failed: 0,
  };
  const results: ImportedProduct[] = new Array(list.length);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 6));

  const { runIsolated } = await import("./batch-runner");
  await runIsolated(
    list,
    async (url, index) => {
      progress.current = url;
      // Per-product isolation: importFromUrl never throws, a failure is data.
      const product = await importFromUrl(url, {
        ...(options.signal ? { signal: options.signal } : {}),
        batchId: batchId || null,
      });
      results[index] = product;
      progress.processed += 1;
      if (product.status === "verified") progress.verified += 1;
      else if (product.status === "needs_review") progress.needs_review += 1;
      else progress.failed += 1;

      try {
        await options.onProduct?.(product, index);
      } catch {
        /* a follow-up failure (e.g. saving) must not stop the batch */
      }
      options.onProgress?.({ ...progress });

      if (batchId) {
        try {
          await client
            .from("import_batches")
            .update({
              processed: progress.processed,
              verified: progress.verified,
              needs_review: progress.needs_review,
              failed: progress.failed,
            })
            .eq("id", batchId);
        } catch {
          /* ignore */
        }
      }
      return product;
    },
    { concurrency, ...(options.signal ? { signal: options.signal } : {}) },
  );


  if (batchId) {
    try {
      await client.from("import_batches").update({ state: "done" }).eq("id", batchId);
    } catch {
      /* ignore */
    }
  }

  return { batchId, results: results.filter(Boolean), progress };
}

/** Already-imported URLs, so a resumed batch does not redo finished work. */
export async function alreadyImported(urls: string[]): Promise<Set<string>> {
  const list = parseUrls(urls);
  if (list.length === 0) return new Set();
  const client = await db();
  const { data } = await client
    .from("product_imports")
    .select("url, status")
    .in("url", list)
    .neq("status", "failed");
  return new Set((data ?? []).map((row) => row.url));
}
