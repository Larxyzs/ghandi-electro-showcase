/**
 * Catalogue rebuild — pure logic, one reference at a time.
 *
 *   reference → exact official URL → official page → identity → extraction →
 *   official gallery → AI interpretation (inside importFromUrl) → product
 *
 * Every reference is rebuilt in complete isolation: the payload written for a
 * reference is built ONLY from that reference's own import result, so a value
 * read on product A can never land on product B. A failing reference returns a
 * status instead of throwing, so the batch keeps going, and the reference row
 * itself is never deleted.
 */
import type { ProductSpec } from "./catalog-types";
import { referenceLabel, usableOfficialUrl, type CatalogReference, type ReferenceStatus } from "./catalog-references";

export type RebuildImportResult = {
  status: "verified" | "needs_review" | "failed";
  error: string;
  canonicalUrl: string;
  identity: { brand: string; name: string; model: string; canonicalUrl: string };
  gallery: string[];
  specifications: ProductSpec[];
  characteristics: string;
  price: number | null;
  fields: { label: string; value: string; evidence: string; status: string }[];
  conflicts: string[];
  missing: string[];
};

export type RebuildProductPayload = {
  node_id: string;
  name: string;
  brand: string;
  serial_number: string;
  characteristics: string;
  stock: number;
  price: number | null;
  specifications: ProductSpec[];
  gallery: string[];
  imageUrl?: string;
  source_url: string;
  source_name: string;
  review_state: "verified" | "needs_review";
  extraction_evidence: { label: string; value: string; evidence: string; status: string }[];
};

export type RebuildOutcome = {
  status: ReferenceStatus;
  label: string;
  productId: string | null;
  error: string;
  detail: Record<string, unknown>;
};

export type RebuildDeps = {
  /** Exact-URL import (fetch + identity + gallery + one AI call). */
  importUrl: (url: string) => Promise<RebuildImportResult>;
  /** Resolves the catalogue folder the rebuilt product must live in. */
  resolveNode: (ref: CatalogReference) => Promise<string>;
  saveProduct: (payload: RebuildProductPayload) => Promise<{ id: string }>;
};

const IDENTITY_ERRORS = /IDENTITY|MODEL_MISMATCH|WRONG_PRODUCT/i;
const INACCESSIBLE_ERRORS = /INACCESSIBLE|HTTP_4|HTTP_5|FETCH|TIMEOUT|BLOCKED|NOT_FOUND|CAPTCHA/i;

/** Maps an import result to the persisted per-product rebuild status. */
export function statusFromImport(result: Pick<RebuildImportResult, "status" | "error">): ReferenceStatus {
  if (result.status === "verified") return "verified";
  if (result.status === "needs_review") return "needs_review";
  if (IDENTITY_ERRORS.test(result.error)) return "identity_mismatch";
  if (INACCESSIBLE_ERRORS.test(result.error) || !result.error) return "official_page_inaccessible";
  return "failed";
}

/**
 * Rebuilds ONE product from its reference. Never throws, never substitutes
 * another source: no official URL, or an unreachable one, keeps the reference
 * and reports the exact reason.
 */
export async function rebuildReference(
  ref: CatalogReference,
  deps: RebuildDeps,
): Promise<RebuildOutcome> {
  const label = referenceLabel(ref);
  const url = usableOfficialUrl(ref.official_url) ?? usableOfficialUrl(ref.canonical_url);

  if (!url) {
    return {
      status: "official_page_inaccessible",
      label,
      productId: null,
      error: "OFFICIAL_URL_MISSING",
      detail: { requires_discovery: true },
    };
  }

  let result: RebuildImportResult;
  try {
    result = await deps.importUrl(url);
  } catch (error) {
    return {
      status: "failed",
      label,
      productId: null,
      error: error instanceof Error ? error.message : "REBUILD_FAILED",
      detail: { official_url: url },
    };
  }

  const status = statusFromImport(result);
  if (status === "failed" || status === "official_page_inaccessible" || status === "identity_mismatch") {
    return {
      status,
      label,
      productId: null,
      error: result.error || "OFFICIAL_PAGE_INACCESSIBLE",
      detail: { official_url: url },
    };
  }

  // The saved model stays the one read on THIS page; a mismatch with the
  // reference is reported instead of being overwritten in either direction.
  const savedModel = result.identity.model || ref.model;
  const refModel = (ref.model || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const pageModel = savedModel.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (refModel && pageModel && refModel !== pageModel && !pageModel.includes(refModel)) {
    return {
      status: "identity_mismatch",
      label,
      productId: null,
      error: `IDENTITY_MISMATCH: référence ${ref.model} ≠ page ${savedModel}`,
      detail: { official_url: url, page_model: savedModel },
    };
  }

  let nodeId: string;
  try {
    nodeId = await deps.resolveNode(ref);
  } catch (error) {
    return {
      status: "failed",
      label,
      productId: null,
      error: error instanceof Error ? error.message : "NODE_UNRESOLVED",
      detail: { official_url: url },
    };
  }

  const payload: RebuildProductPayload = {
    node_id: nodeId,
    name: result.identity.name || ref.name || label,
    brand: result.identity.brand || ref.brand,
    serial_number: savedModel,
    characteristics: result.characteristics,
    stock: 0,
    price: result.price,
    specifications: result.specifications,
    gallery: result.gallery,
    ...(result.gallery[0] ? { imageUrl: result.gallery[0] } : {}),
    source_url: result.canonicalUrl || url,
    source_name: ref.manufacturer || ref.brand,
    review_state: status === "verified" ? "verified" : "needs_review",
    extraction_evidence: result.fields,
  };

  try {
    const saved = await deps.saveProduct(payload);
    return {
      status,
      label,
      productId: saved.id,
      error: "",
      detail: {
        official_url: url,
        gallery: result.gallery.length,
        specifications: result.specifications.length,
        conflicts: result.conflicts,
        missing: result.missing,
      },
    };
  } catch (error) {
    return {
      status: "failed",
      label,
      productId: null,
      error: error instanceof Error ? error.message : "SAVE_FAILED",
      detail: { official_url: url },
    };
  }
}

export type RebuildCounters = {
  total: number;
  processed: number;
  verified: number;
  needs_review: number;
  failed: number;
  remaining: number;
};

export function countStatus(counters: RebuildCounters, status: ReferenceStatus): RebuildCounters {
  const next = { ...counters, processed: counters.processed + 1 };
  if (status === "verified") next.verified += 1;
  else if (status === "needs_review") next.needs_review += 1;
  else next.failed += 1;
  next.remaining = Math.max(0, next.total - next.processed);
  return next;
}
