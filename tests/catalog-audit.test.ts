import { describe, expect, it } from "vitest";
import {
  auditAgainstOfficial,
  auditStoredCatalog,
  formatAuditReport,
  summarizeFindings,
  type AuditProduct,
  type OfficialSnapshot,
} from "@/lib/catalog-audit";
import { dedupeReferences, referenceFromProduct, usableOfficialUrl } from "@/lib/catalog-references";
import { countStatus, rebuildReference, statusFromImport } from "@/lib/catalog-rebuild";
import type { CatalogReference } from "@/lib/catalog-references";

const product = (over: Partial<AuditProduct> = {}): AuditProduct => ({
  id: "p1",
  name: "Réfrigérateur Samsung RB34",
  brand: "Samsung",
  serial_number: "RB34T672EWW",
  node_id: "n1",
  node_path: "Réfrigérateurs / Combinés",
  source_url: "https://www.samsung.com/africa_fr/refrigerators/rb34t672eww/",
  source_name: "Samsung",
  review_state: "verified",
  price: 8990,
  specifications: [{ label: "Capacité totale", value: "344 L" }],
  gallery: ["https://images.samsung.com/a.jpg", "https://images.samsung.com/b.jpg"],
  image_url: "https://images.samsung.com/a.jpg",
  extraction_evidence: [],
  ...over,
});

describe("stored catalog audit", () => {
  it("flags duplicates, empty galleries and non-official sources", () => {
    const findings = auditStoredCatalog(
      [
        product(),
        product({ id: "p2", gallery: [], image_url: null }),
        product({ id: "p3", source_url: "https://www.jumia.ma/samsung-rb34" }),
        product({ id: "p4" }),
      ],
      [],
    );
    const codes = findings.map((f) => f.problem_code);
    expect(codes).toContain("missing_gallery");
    expect(codes).toContain("non_official_source");
    expect(codes.filter((code) => code === "duplicate_model").length).toBeGreaterThan(0);
  });

  it("does not report problems on a clean product", () => {
    const findings = auditStoredCatalog([product()], []);
    expect(findings.filter((f) => f.severity === "critical")).toHaveLength(0);
  });

  it("flags a master reference whose product disappeared", () => {
    const reference: CatalogReference = {
      id: "r1",
      manufacturer: "Samsung",
      brand: "Samsung",
      model: "RB34T672EWW",
      reference: "RB34T672EWW",
      official_url: "https://www.samsung.com/africa_fr/refrigerators/rb34t672eww/",
      canonical_url: "https://www.samsung.com/africa_fr/refrigerators/rb34t672eww/",
      region: "africa_fr",
      product_type: "refrigerateur",
      node_path: "Réfrigérateurs",
      node_id: "n1",
      product_id: null,
      name: "Samsung RB34T672EWW",
      requires_discovery: false,
      active: true,
      source: "freeze",
      last_status: "pending",
      last_error: "",
      last_verified_at: null,
    };
    const findings = auditStoredCatalog([], [reference]);
    expect(findings.map((f) => f.problem_code)).toContain("reference_without_product");
  });
});

describe("official comparison", () => {
  const snapshot = (over: Partial<OfficialSnapshot> = {}): OfficialSnapshot => ({
    status: "verified",
    error: "",
    canonicalUrl: "https://www.samsung.com/africa_fr/refrigerators/rb34t672eww/",
    identity: { brand: "Samsung", name: "Réfrigérateur RB34", model: "RB34T672EWW" },
    gallery: ["https://images.samsung.com/a.jpg", "https://images.samsung.com/b.jpg"],
    specifications: [{ label: "Capacité totale", value: "344 L" }],
    conflicts: [],
    missing: [],
    ...over,
  });

  it("keeps each capacity attached to its own product (no merging)", () => {
    const a = auditAgainstOfficial(
      product({ specifications: [{ label: "Capacité totale", value: "512 L" }] }),
      snapshot({ specifications: [{ label: "Capacité totale", value: "512 L" }] }),
      null,
    );
    const b = auditAgainstOfficial(
      product({ id: "p2", specifications: [{ label: "Capacité totale", value: "462 L" }] }),
      snapshot({ specifications: [{ label: "Capacité totale", value: "462 L" }] }),
      null,
    );
    expect(a.map((f) => f.problem_code)).not.toContain("stale_data");
    expect(b.map((f) => f.problem_code)).not.toContain("stale_data");
  });

  it("reports a real difference with the official page as evidence", () => {
    const findings = auditAgainstOfficial(
      product({ specifications: [{ label: "Capacité totale", value: "462 L" }] }),
      snapshot({ specifications: [{ label: "Capacité totale", value: "512 L" }] }),
      null,
    );
    const stale = findings.find((f) => f.problem_code === "stale_data");
    expect(stale).toBeTruthy();
    expect(stale?.evidence).toContain("512 L");
    expect(stale?.source_url).toContain("samsung.com");
  });

  it("reports an inaccessible official page without substituting a source", () => {
    const findings = auditAgainstOfficial(
      product(),
      snapshot({ status: "failed", error: "OFFICIAL_PAGE_INACCESSIBLE: 403" }),
      null,
    );
    expect(findings.map((f) => f.problem_code)).toContain("official_page_inaccessible");
    expect(findings.every((f) => !f.auto_repair_safe)).toBe(true);
  });

  it("reports an identity mismatch instead of overwriting the product", () => {
    const findings = auditAgainstOfficial(
      product(),
      snapshot({ identity: { brand: "Samsung", name: "Autre", model: "RB38T600ESA" } }),
      null,
    );
    expect(findings.map((f) => f.problem_code)).toContain("identity_mismatch");
  });
});

describe("audit report", () => {
  it("counts and formats findings", () => {
    const findings = auditStoredCatalog([product({ gallery: [], image_url: null })], []);
    const summary = summarizeFindings(1, findings);
    expect(summary.checked).toBe(1);
    const report = formatAuditReport(summary, findings);
    expect(report).toContain("CONTRÔLE DU CATALOGUE");
    expect(report).toContain("1");
  });
});

describe("master references", () => {
  it("only accepts official URLs", () => {
    expect(usableOfficialUrl("https://www.jumia.ma/x")).toBeNull();
    expect(usableOfficialUrl("https://www.lg.com/africa_fr/x")).toBeTruthy();
  });

  it("deduplicates references and prefers the one with an official URL", () => {
    const base = referenceFromProduct(product(), "Réfrigérateurs");
    const noUrl = referenceFromProduct(product({ id: "p9", source_url: null }), "Réfrigérateurs");
    const list = dedupeReferences([noUrl, base]);
    expect(list).toHaveLength(1);
    expect(list[0]!.official_url).toContain("samsung.com");
  });
});

describe("rebuild isolation", () => {
  const reference = (over: Partial<CatalogReference> = {}): CatalogReference => ({
    id: "r1",
    manufacturer: "Samsung",
    brand: "Samsung",
    model: "RB34T672EWW",
    reference: "RB34T672EWW",
    official_url: "https://www.samsung.com/africa_fr/refrigerators/rb34t672eww/",
    canonical_url: "",
    region: "africa_fr",
    product_type: "refrigerateur",
    node_path: "Réfrigérateurs",
    node_id: "n1",
    product_id: "p1",
    name: "Samsung RB34T672EWW",
    requires_discovery: false,
    active: true,
    source: "freeze",
    last_status: "pending",
    last_error: "",
    last_verified_at: null,
    ...over,
  });

  const deps = (result: Partial<Parameters<typeof statusFromImport>[0]> & Record<string, unknown>) => {
    const saved: unknown[] = [];
    return {
      saved,
      deps: {
        importFromUrl: async () => result as never,
        saveProduct: async (payload: unknown) => {
          saved.push(payload);
          return "new-id";
        },
        resolveNode: async () => "n1",
      },
    };
  };

  it("keeps only its own reference data in the payload", async () => {
    const { deps: d, saved } = deps({
      status: "verified",
      error: "",
      canonicalUrl: "https://www.samsung.com/africa_fr/refrigerators/rb34t672eww/",
      identity: { brand: "Samsung", name: "Réfrigérateur RB34", model: "RB34T672EWW" },
      gallery: ["https://images.samsung.com/a.jpg"],
      specifications: [{ label: "Capacité totale", value: "344 L" }],
      characteristics: "",
      marketingSections: [],
      evidence: [],
      conflicts: [],
      missing: [],
    });
    const outcome = await rebuildReference(reference(), d as never);
    expect(outcome.status).toBe("verified");
    expect(saved).toHaveLength(1);
    expect(JSON.stringify(saved[0])).toContain("RB34T672EWW");
  });

  it("never substitutes a source when the official URL is missing", async () => {
    const { deps: d, saved } = deps({ status: "verified", error: "" });
    const outcome = await rebuildReference(
      reference({ official_url: "", canonical_url: "", requires_discovery: true }),
      d as never,
    );
    expect(outcome.status).toBe("official_page_inaccessible");
    expect(saved).toHaveLength(0);
  });

  it("isolates a failing reference", async () => {
    const failing = {
      importFromUrl: async () => {
        throw new Error("boom");
      },
      saveProduct: async () => "x",
      resolveNode: async () => "n1",
    };
    const outcome = await rebuildReference(reference(), failing as never);
    expect(outcome.status).toBe("failed");
    expect(outcome.error).toContain("boom");
  });

  it("counts statuses", () => {
    let counters = { processed: 0, verified: 0, needs_review: 0, failed: 0, inaccessible: 0 };
    counters = countStatus(counters, "verified");
    counters = countStatus(counters, "failed");
    expect(counters.processed).toBe(2);
    expect(counters.verified).toBe(1);
    expect(counters.failed).toBe(1);
  });
});
